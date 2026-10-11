-- Musikquiz: kör själv i Supabase SQL Editor.
-- Skapar endast det nya schemat musikquiz och en separat RPC.
-- Ändrar inga Digihits-tabeller, konton eller poäng.
begin;
-- Isolated Musikquiz schema. Clients use only the membership-checked RPC.
create schema musikquiz;
revoke all on schema musikquiz from public, anon, authenticated;
grant usage on schema musikquiz to authenticated;
create table musikquiz.questions(id int primary key, question text not null, options jsonb not null check(jsonb_array_length(options)=4), correct int not null check(correct between 0 and 3), category text not null);
create table musikquiz.rooms(code text primary key check(code ~ '^[0-9]{6}$'), host uuid not null, phase text not null default 'lobby' check(phase in ('lobby','start_countdown','ready','round_countdown','reading','answering','results','finished')), round int not null default 0, deck int[] not null, starts_at timestamptz, deadline timestamptz, created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '24 hours');
create index rooms_host_created on musikquiz.rooms(host,created_at);
create table musikquiz.players(code text references musikquiz.rooms on delete cascade, user_id uuid not null, name text not null check(length(name) between 1 and 18), score int not null default 0, avatar int not null check(avatar between 0 and 11), ready boolean not null default false, joined_at timestamptz not null default now(), primary key(code,user_id));
create unique index player_name_unique on musikquiz.players(code,lower(name));
create table musikquiz.answers(code text references musikquiz.rooms on delete cascade, round int not null, user_id uuid not null, choice int not null check(choice between 0 and 3), primary key(code,round,user_id), foreign key(code,user_id) references musikquiz.players on delete cascade);
alter table musikquiz.questions enable row level security;
alter table musikquiz.rooms enable row level security;
alter table musikquiz.players enable row level security;
alter table musikquiz.answers enable row level security;
revoke all on all tables in schema musikquiz from public,anon,authenticated;

create function musikquiz.api(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid := auth.uid(); c text := payload->>'code'; n text := trim(payload->>'name');
 r musikquiz.rooms%rowtype; q musikquiz.questions%rowtype; d int[]; own_choice int; p jsonb; out_question jsonb; tries int:=0;
begin
 if u is null then raise exception 'Anslutningen saknas. Försök igen.'; end if;
 if action='create' then
  if n is null or length(n) not between 1 and 18 then raise exception 'Skriv ett namn med 1–18 tecken.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,0));
  if (select count(*) from musikquiz.rooms where host=u and created_at>now()-interval '1 hour')>=15 then raise exception 'Du har skapat många matcher. Försök igen senare.'; end if;
  select array_agg(id) into d from (select id from musikquiz.questions order by random() limit 10) t;
  if coalesce(array_length(d,1),0)<10 then raise exception 'Frågorna är inte redo ännu.'; end if;
  loop
   c:=(100000+floor(random()*900000))::int::text;
   begin
    insert into musikquiz.rooms(code,host,deck) values(c,u,d); exit;
   exception when unique_violation then tries:=tries+1; if tries>10 then raise exception 'Försök skapa matchen igen.'; end if;
   end;
  end loop;
  insert into musikquiz.players(code,user_id,name,avatar,ready) values(c,u,n,(payload->>'avatar')::int,true);
 end if;
 if c is null or c !~ '^[0-9]{6}$' then raise exception 'Matchkoden ska vara sex siffror.'; end if;
 select * into r from musikquiz.rooms where code=c for update;
 if not found or r.expires_at<now() then raise exception 'Matchen finns inte eller har gått ut.'; end if;
 if action='join' and not exists(select 1 from musikquiz.players where code=c and user_id=u) then
  if r.phase<>'lobby' then raise exception 'Matchen har redan startat.'; end if;
  if n is null or length(n) not between 1 and 18 then raise exception 'Skriv ett namn med 1–18 tecken.'; end if;
  if (select count(*) from musikquiz.players where code=c)>=20 then raise exception 'Matchen är full (20 spelare).'; end if;
  begin
   insert into musikquiz.players(code,user_id,name,avatar) values(c,u,n,(payload->>'avatar')::int);
  exception when unique_violation then raise exception 'Namnet används i matchen. Välj ett annat.';
  end;
 end if;
 if not exists(select 1 from musikquiz.players where code=c and user_id=u) then raise exception 'Du är inte med i den här matchen.'; end if;
 if r.phase='start_countdown' and now()>=r.starts_at then
  update musikquiz.rooms set phase='ready' where code=c returning * into r;
 elsif r.phase='round_countdown' and now()>=r.starts_at then
  update musikquiz.rooms set phase='reading' where code=c returning * into r;
 end if;
 if action in ('start','round','heard','finish') and r.host<>u then raise exception 'Bara värden kan göra det.'; end if;
 if action='start' then
  if r.phase<>'lobby' then raise exception 'Matchen har redan startat.'; end if;
  if (select count(*) from musikquiz.players where code=c)<2 then raise exception 'Vänta tills minst en gäst har anslutit.'; end if;
  if exists(select 1 from musikquiz.players where code=c and user_id<>r.host and not ready) then raise exception 'Alla gäster behöver markera sig redo.'; end if;
  update musikquiz.rooms set phase='start_countdown',starts_at=now()+interval '5 seconds' where code=c returning * into r;
 elsif action='round' then
  if r.phase not in ('ready','results') then raise exception 'Vänta tills omgången är klar.'; end if;
  if r.round>=array_length(r.deck,1) then
   update musikquiz.rooms set phase='finished' where code=c returning * into r;
  else
   update musikquiz.rooms set round=round+1,phase='round_countdown',starts_at=now()+interval '3 seconds',deadline=null where code=c returning * into r;
  end if;
 elsif action='heard' then
  if r.phase='reading' then update musikquiz.rooms set phase='answering',deadline=now()+interval '20 seconds' where code=c returning * into r; end if;
 elsif action='answer' then
  if r.phase<>'answering' or now()>=r.deadline then raise exception 'Svarstiden är slut.'; end if;
  if (payload->>'choice')::int not between 0 and 3 then raise exception 'Välj ett svar.'; end if;
  insert into musikquiz.answers(code,round,user_id,choice) values(c,r.round,u,(payload->>'choice')::int) on conflict do nothing;
 elsif action='finish' then
  update musikquiz.rooms set phase='finished' where code=c returning * into r;
 elsif action='ready' then
  if r.phase<>'lobby' then raise exception 'Matchen har redan startat.'; end if;
  if r.host<>u then update musikquiz.players set ready=coalesce((payload->>'ready')::boolean,false) where code=c and user_id=u; end if;
 elsif action='leave' then
  if r.phase<>'lobby' or r.host=u then raise exception 'Du kan bara lämna lobbyn som gäst.'; end if;
  delete from musikquiz.players where code=c and user_id=u; return jsonb_build_object('left',true);
 elsif action not in ('state','create','join') then raise exception 'Okänd åtgärd.';
 end if;
 if r.phase='answering' and (now()>=r.deadline or (select count(*) from musikquiz.answers where code=c and round=r.round)=(select count(*) from musikquiz.players where code=c)) then
  select * into q from musikquiz.questions where id=r.deck[r.round];
  update musikquiz.players pl set score=pl.score+1 where pl.code=c and exists(select 1 from musikquiz.answers a where a.code=c and a.round=r.round and a.user_id=pl.user_id and a.choice=q.correct);
  update musikquiz.rooms set phase='results' where code=c returning * into r;
 end if;
 select jsonb_agg(jsonb_build_object('id',user_id,'name',name,'score',score,'avatar',avatar,'ready',ready,'host',user_id=r.host) order by score desc,joined_at) into p from musikquiz.players where code=c;
 select choice into own_choice from musikquiz.answers where code=c and round=r.round and user_id=u;
 if r.phase in ('reading','answering','results') then
  select * into q from musikquiz.questions where id=r.deck[r.round];
  out_question:=jsonb_build_object('text',q.question,'category',q.category);
  if r.phase in ('answering','results') then out_question:=out_question||jsonb_build_object('options',q.options); end if;
  if r.phase='results' then out_question:=out_question||jsonb_build_object('correct',q.correct); end if;
 end if;
 return jsonb_build_object('code',c,'phase',r.phase,'round',r.round,'total',array_length(r.deck,1),'host',r.host=u,'me',u,'players',p,'startsAt',r.starts_at,'deadline',r.deadline,'serverTime',clock_timestamp(),'question',out_question,'choice',own_choice,'answered',(select count(*) from musikquiz.answers where code=c and round=r.round));
end $$;
revoke all on function musikquiz.api(text,jsonb) from public,anon,authenticated;
grant execute on function musikquiz.api(text,jsonb) to authenticated;
create function public.musikquiz(action text,payload jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$ select musikquiz.api(action,payload); $$;
revoke all on function public.musikquiz(text,jsonb) from public,anon,authenticated;
grant execute on function public.musikquiz(text,jsonb) to authenticated;

insert into musikquiz.questions(id,question,options,correct,category) values
(1,'Vem gjorde låten ”Dancing Queen” känd?','["Queen", "Bee Gees", "Boney M.", "ABBA"]'::jsonb,3,'70-tal'),
(2,'Vem gjorde låten ”Mamma Mia” känd?','["Europe", "Ace of Base", "ABBA", "Roxette"]'::jsonb,2,'70-tal'),
(3,'Vem gjorde låten ”We Will Rock You” känd?','["Kiss", "AC/DC", "The Beatles", "Queen"]'::jsonb,3,'70-tal'),
(4,'Vem gjorde låten ”Bohemian Rhapsody” känd?','["Elton John", "David Bowie", "Queen", "The Rolling Stones"]'::jsonb,2,'70-tal'),
(5,'Vem gjorde låten ”Stayin'' Alive” känd?','["ABBA", "Village People", "The Beach Boys", "Bee Gees"]'::jsonb,3,'70-tal'),
(6,'Vem gjorde låten ”Y.M.C.A.” känd?','["Boney M.", "Kiss", "Bee Gees", "Village People"]'::jsonb,3,'70-tal'),
(7,'Vem gjorde låten ”Rasputin” känd?','["Queen", "ABBA", "Boney M.", "The Jackson 5"]'::jsonb,2,'70-tal'),
(8,'Vem gjorde låten ”I Will Survive” känd?','["Dolly Parton", "Cher", "Gloria Gaynor", "Tina Turner"]'::jsonb,2,'70-tal'),
(9,'Vem gjorde låten ”Imagine” känd?','["John Lennon", "Bob Dylan", "Elvis Presley", "Elton John"]'::jsonb,0,'70-tal'),
(10,'Vem gjorde låten ”Jolene” känd?','["Madonna", "Diana Ross", "Dolly Parton", "Tina Turner"]'::jsonb,2,'Country'),
(11,'Vem gjorde låten ”Hotel California” känd?','["Metallica", "AC/DC", "Nirvana", "Eagles"]'::jsonb,3,'70-tal'),
(12,'Vem gjorde låten ”Your Song” känd?','["Bruce Springsteen", "David Bowie", "Rod Stewart", "Elton John"]'::jsonb,3,'70-tal'),
(13,'Vem gjorde låten ”Hey Jude” känd?','["The Doors", "The Rolling Stones", "The Beatles", "The Beach Boys"]'::jsonb,2,'60-tal'),
(14,'Vem gjorde låten ”Yellow Submarine” känd?','["ABBA", "Bee Gees", "Queen", "The Beatles"]'::jsonb,3,'60-tal'),
(15,'Vem gjorde låten ”Good Vibrations” känd?','["The Beach Boys", "The Beatles", "The Who", "The Kinks"]'::jsonb,0,'60-tal'),
(16,'Vem gjorde låten ”Jailhouse Rock” känd?','["Chuck Berry", "Elvis Presley", "Frank Sinatra", "Johnny Cash"]'::jsonb,1,'50-tal'),
(17,'Vem gjorde låten ”Johnny B. Goode” känd?','["Elvis Presley", "Ray Charles", "Little Richard", "Chuck Berry"]'::jsonb,3,'50-tal'),
(18,'Vem gjorde låten ”What a Wonderful World” känd?','["Frank Sinatra", "Tom Jones", "Louis Armstrong", "Elvis Presley"]'::jsonb,2,'60-tal'),
(19,'Vem gjorde låten ”Respect” känd?','["Whitney Houston", "Tina Turner", "Diana Ross", "Aretha Franklin"]'::jsonb,3,'Soul'),
(20,'Vem gjorde låten ”Stand by Me” känd?','["Ben E. King", "Ray Charles", "James Brown", "Stevie Wonder"]'::jsonb,0,'60-tal'),
(21,'Vem gjorde låten ”Billie Jean” känd?','["Michael Jackson", "Lionel Richie", "Stevie Wonder", "Prince"]'::jsonb,0,'80-tal'),
(22,'Vem gjorde låten ”Thriller” känd?','["Michael Jackson", "George Michael", "Prince", "Madonna"]'::jsonb,0,'80-tal'),
(23,'Vem gjorde låten ”Like a Prayer” känd?','["Whitney Houston", "Tina Turner", "Cyndi Lauper", "Madonna"]'::jsonb,3,'80-tal'),
(24,'Vem gjorde låten ”Material Girl” känd?','["Dolly Parton", "Annie Lennox", "Madonna", "Cher"]'::jsonb,2,'80-tal'),
(25,'Vem gjorde låten ”Take On Me” känd?','["Depeche Mode", "a-ha", "Duran Duran", "Pet Shop Boys"]'::jsonb,1,'80-tal'),
(26,'Vem gjorde låten ”Never Gonna Give You Up” känd?','["George Michael", "Sting", "Rick Astley", "Phil Collins"]'::jsonb,2,'80-tal'),
(27,'Vem gjorde låten ”Girls Just Want to Have Fun” känd?','["Tina Turner", "Cher", "Madonna", "Cyndi Lauper"]'::jsonb,3,'80-tal'),
(28,'Vem gjorde låten ”I Wanna Dance with Somebody” känd?','["Mariah Carey", "Janet Jackson", "Whitney Houston", "Céline Dion"]'::jsonb,2,'80-tal'),
(29,'Vem gjorde låten ”Livin'' on a Prayer” känd?','["Aerosmith", "Europe", "Bon Jovi", "Guns N'' Roses"]'::jsonb,2,'Rock'),
(30,'Vem gjorde låten ”The Final Countdown” känd?','["Europe", "Bon Jovi", "Kiss", "Queen"]'::jsonb,0,'80-tal'),
(31,'Vem gjorde låten ”Africa” känd?','["Foreigner", "Toto", "Dire Straits", "Journey"]'::jsonb,1,'80-tal'),
(32,'Vem gjorde låten ”Eye of the Tiger” känd?','["Survivor", "AC/DC", "Queen", "Europe"]'::jsonb,0,'80-tal'),
(33,'Vem gjorde låten ”Sweet Dreams (Are Made of This)” känd?','["Eurythmics", "Depeche Mode", "Pet Shop Boys", "a-ha"]'::jsonb,0,'80-tal'),
(34,'Vem gjorde låten ”Last Christmas” känd?','["ABBA", "Bee Gees", "Wham!", "Take That"]'::jsonb,2,'Julmusik'),
(35,'Vem gjorde låten ”Faith” känd?','["Phil Collins", "Prince", "George Michael", "David Bowie"]'::jsonb,2,'80-tal'),
(36,'Vem gjorde låten ”The Best” känd?','["Cher", "Madonna", "Whitney Houston", "Tina Turner"]'::jsonb,3,'80-tal'),
(37,'Vem gjorde låten ”Born in the U.S.A.” känd?','["Bryan Adams", "Bruce Springsteen", "Bob Dylan", "Billy Joel"]'::jsonb,1,'Rock'),
(38,'Vem gjorde låten ”Back in Black” känd?','["AC/DC", "Iron Maiden", "Metallica", "Kiss"]'::jsonb,0,'Hårdrock'),
(39,'Vem gjorde låten ”Sweet Child o'' Mine” känd?','["Nirvana", "Guns N'' Roses", "Metallica", "Bon Jovi"]'::jsonb,1,'Hårdrock'),
(40,'Vem gjorde låten ”The Look” känd?','["Europe", "Ace of Base", "ABBA", "Roxette"]'::jsonb,3,'Svenskt'),
(41,'Vem gjorde låten ”It Must Have Been Love” känd?','["ABBA", "The Cardigans", "Roxette", "Ace of Base"]'::jsonb,2,'Svenskt'),
(42,'Vem gjorde låten ”Smells Like Teen Spirit” känd?','["Green Day", "Pearl Jam", "Nirvana", "Oasis"]'::jsonb,2,'90-tal'),
(43,'Vem gjorde låten ”Wonderwall” känd?','["Radiohead", "Blur", "Coldplay", "Oasis"]'::jsonb,3,'90-tal'),
(44,'Vem gjorde låten ”Wannabe” känd?','["All Saints", "Spice Girls", "TLC", "Destiny''s Child"]'::jsonb,1,'90-tal'),
(45,'Vem gjorde låten ”I Want It That Way” känd?','["NSYNC", "Backstreet Boys", "Westlife", "Take That"]'::jsonb,1,'90-tal'),
(46,'Vem gjorde låten ”...Baby One More Time” känd?','["Jennifer Lopez", "Britney Spears", "Shakira", "Christina Aguilera"]'::jsonb,1,'90-tal'),
(47,'Vem gjorde låten ”Believe” känd?','["Annie Lennox", "Madonna", "Céline Dion", "Cher"]'::jsonb,3,'90-tal'),
(48,'Vem gjorde låten ”Barbie Girl” känd?','["Ace of Base", "Vengaboys", "Aqua", "ABBA"]'::jsonb,2,'90-tal'),
(49,'Vem gjorde låten ”The Sign” känd?','["Aqua", "Ace of Base", "Roxette", "The Cardigans"]'::jsonb,1,'Svenskt'),
(50,'Vem gjorde låten ”Lovefool” känd?','["Roxette", "Kent", "Ace of Base", "The Cardigans"]'::jsonb,3,'Svenskt'),
(51,'Vem gjorde låten ”Macarena” känd?','["Vengaboys", "Gipsy Kings", "Aqua", "Los del Río"]'::jsonb,3,'90-tal'),
(52,'Vem gjorde låten ”My Heart Will Go On” känd?','["Whitney Houston", "Shania Twain", "Mariah Carey", "Céline Dion"]'::jsonb,3,'Filmmusik'),
(53,'Vem gjorde låten ”I Will Always Love You (från filmen Bodyguard)” känd?','["Whitney Houston", "Tina Turner", "Mariah Carey", "Céline Dion"]'::jsonb,0,'Filmmusik'),
(54,'Vem gjorde låten ”All I Want for Christmas Is You” känd?','["Mariah Carey", "Whitney Houston", "Céline Dion", "Ariana Grande"]'::jsonb,0,'Julmusik'),
(55,'Vem gjorde låten ”U Can''t Touch This” känd?','["Snoop Dogg", "MC Hammer", "Eminem", "Vanilla Ice"]'::jsonb,1,'Hiphop'),
(56,'Vem gjorde låten ”Gangsta''s Paradise” känd?','["Coolio", "MC Hammer", "Eminem", "Dr. Dre"]'::jsonb,0,'Hiphop'),
(57,'Vem gjorde låten ”Lose Yourself” känd?','["Eminem", "Jay-Z", "Drake", "Kanye West"]'::jsonb,0,'Hiphop'),
(58,'Vem gjorde låten ”Whenever, Wherever” känd?','["Jennifer Lopez", "Rihanna", "Beyoncé", "Shakira"]'::jsonb,3,'00-tal'),
(59,'Vem gjorde låten ”Single Ladies (Put a Ring on It)” känd?','["Alicia Keys", "Shakira", "Rihanna", "Beyoncé"]'::jsonb,3,'00-tal'),
(60,'Vem gjorde låten ”Umbrella” känd?','["Katy Perry", "Rihanna", "Lady Gaga", "Beyoncé"]'::jsonb,1,'00-tal'),
(61,'Vem gjorde låten ”Poker Face” känd?','["Katy Perry", "Britney Spears", "P!nk", "Lady Gaga"]'::jsonb,3,'00-tal'),
(62,'Vem gjorde låten ”I Kissed a Girl” känd?','["Taylor Swift", "Rihanna", "Katy Perry", "Lady Gaga"]'::jsonb,2,'00-tal'),
(63,'Vem gjorde låten ”Viva la Vida” känd?','["Oasis", "Maroon 5", "Coldplay", "U2"]'::jsonb,2,'00-tal'),
(64,'Vem gjorde låten ”Mr. Brightside” känd?','["The Killers", "Coldplay", "Oasis", "Green Day"]'::jsonb,0,'00-tal'),
(65,'Vem gjorde låten ”Boulevard of Broken Dreams” känd?','["Foo Fighters", "Green Day", "Nirvana", "Blink-182"]'::jsonb,1,'Rock'),
(66,'Vem gjorde låten ”Hey Ya!” känd?','["Destiny''s Child", "The Black Eyed Peas", "Outkast", "Nelly"]'::jsonb,2,'00-tal'),
(67,'Vem gjorde låten ”I Gotta Feeling” känd?','["Outkast", "Maroon 5", "The Black Eyed Peas", "Daft Punk"]'::jsonb,2,'00-tal'),
(68,'Vem gjorde låten ”Rehab” känd?','["Lily Allen", "Adele", "Duffy", "Amy Winehouse"]'::jsonb,3,'Soul'),
(69,'Vem gjorde låten ”Cry Me a River” känd?','["Justin Timberlake", "Bruno Mars", "Justin Bieber", "Usher"]'::jsonb,0,'00-tal'),
(70,'Vem gjorde låten ”Fallin''” känd?','["Beyoncé", "Alicia Keys", "Rihanna", "Mary J. Blige"]'::jsonb,1,'00-tal'),
(71,'Vem gjorde låten ”Get Lucky” känd?','["Calvin Harris", "Avicii", "Swedish House Mafia", "Daft Punk"]'::jsonb,3,'Dansmusik'),
(72,'Vem gjorde låten ”Wake Me Up” känd?','["David Guetta", "Tiësto", "Avicii", "Kygo"]'::jsonb,2,'Svenskt'),
(73,'Vem gjorde låten ”Levels” känd?','["Daft Punk", "Martin Garrix", "Avicii", "Calvin Harris"]'::jsonb,2,'Dansmusik'),
(74,'Vem gjorde låten ”Don''t You Worry Child” känd?','["The Chainsmokers", "Swedish House Mafia", "Disclosure", "Daft Punk"]'::jsonb,1,'Dansmusik'),
(75,'Vem gjorde låten ”Rolling in the Deep” känd?','["Beyoncé", "Adele", "Sia", "Lady Gaga"]'::jsonb,1,'10-tal'),
(76,'Vem gjorde låten ”Hello” känd?','["Rihanna", "Katy Perry", "Taylor Swift", "Adele"]'::jsonb,3,'10-tal'),
(77,'Vem gjorde låten ”Shape of You” känd?','["Shawn Mendes", "Harry Styles", "Justin Bieber", "Ed Sheeran"]'::jsonb,3,'10-tal'),
(78,'Vem gjorde låten ”Perfect” känd?','["Sam Smith", "Bruno Mars", "Lewis Capaldi", "Ed Sheeran"]'::jsonb,3,'10-tal'),
(79,'Vem gjorde låten ”Shake It Off” känd?','["Taylor Swift", "Ariana Grande", "Katy Perry", "Miley Cyrus"]'::jsonb,0,'10-tal'),
(80,'Vem gjorde låten ”Happy” känd?','["Usher", "Pharrell Williams", "Justin Timberlake", "Bruno Mars"]'::jsonb,1,'10-tal'),
(81,'Vem gjorde låten ”Just the Way You Are” känd?','["Justin Bieber", "Bruno Mars", "Sam Smith", "Ed Sheeran"]'::jsonb,1,'10-tal'),
(82,'Vem gjorde låten ”Chandelier” känd?','["Sia", "Lorde", "Adele", "Lana Del Rey"]'::jsonb,0,'10-tal'),
(83,'Vem gjorde låten ”Wrecking Ball” känd?','["Miley Cyrus", "Demi Lovato", "Taylor Swift", "Selena Gomez"]'::jsonb,0,'10-tal'),
(84,'Vem gjorde låten ”Despacito (med Daddy Yankee)” känd?','["Ricky Martin", "Bad Bunny", "Luis Fonsi", "Enrique Iglesias"]'::jsonb,2,'10-tal'),
(85,'Vem gjorde låten ”Blinding Lights” känd?','["Justin Bieber", "Drake", "The Weeknd", "Bruno Mars"]'::jsonb,2,'20-tal'),
(86,'Vem gjorde låten ”As It Was” känd?','["Shawn Mendes", "Justin Bieber", "Harry Styles", "Ed Sheeran"]'::jsonb,2,'20-tal'),
(87,'Vem gjorde låten ”Flowers” känd?','["Dua Lipa", "Miley Cyrus", "Ariana Grande", "Taylor Swift"]'::jsonb,1,'20-tal'),
(88,'Vem gjorde låten ”Don''t Start Now” känd?','["Adele", "Billie Eilish", "Katy Perry", "Dua Lipa"]'::jsonb,3,'Pop'),
(89,'Vem gjorde låten ”bad guy” känd?','["Ariana Grande", "Dua Lipa", "Billie Eilish", "Olivia Rodrigo"]'::jsonb,2,'Pop'),
(90,'Vem gjorde låten ”drivers license” känd?','["Billie Eilish", "Olivia Rodrigo", "Taylor Swift", "Sabrina Carpenter"]'::jsonb,1,'20-tal'),
(91,'Vem gjorde låten ”Dance Monkey” känd?','["Dua Lipa", "Tones and I", "Lorde", "Sia"]'::jsonb,1,'Pop'),
(92,'Vem gjorde låten ”Känn ingen sorg för mig Göteborg” känd?','["Tomas Ledin", "Kent", "Lars Winnerbäck", "Håkan Hellström"]'::jsonb,3,'Svenskt'),
(93,'Vem gjorde låten ”Sommartider” känd?','["Lasse Stefanz", "ABBA", "Gyllene Tider", "Roxette"]'::jsonb,2,'Svenskt'),
(94,'Vem gjorde låten ”Sommaren är kort” känd?','["Tomas Ledin", "Magnus Uggla", "Björn Skifs", "Ted Gärdestad"]'::jsonb,0,'Svenskt'),
(95,'Vem gjorde låten ”Sol, vind och vatten” känd?','["Ted Gärdestad", "Mats Paulson", "Lasse Berghagen", "Tomas Ledin"]'::jsonb,0,'Svenskt'),
(96,'Vem gjorde låten ”Främling” känd?','["Charlotte Perrelli", "Carola", "Lena Philipsson", "Sanna Nielsen"]'::jsonb,1,'Svenskt'),
(97,'Vem gjorde låten ”Euphoria” känd?','["Zara Larsson", "Carola", "Måns Zelmerlöw", "Loreen"]'::jsonb,3,'Eurovision'),
(98,'Vem gjorde låten ”Tattoo” känd?','["Cornelia Jakobs", "Charlotte Perrelli", "Sanna Nielsen", "Loreen"]'::jsonb,3,'Eurovision'),
(99,'Vem gjorde låten ”Heroes” känd?','["Danny Saucedo", "Eric Saade", "Måns Zelmerlöw", "Benjamin Ingrosso"]'::jsonb,2,'Eurovision'),
(100,'Vem gjorde låten ”Waterloo” känd?','["Europe", "Roxette", "Ace of Base", "ABBA"]'::jsonb,3,'Eurovision'),
(101,'Vem gjorde låten ”Mera mål” känd?','["Sean Banan", "Petter", "Markoolio", "Timbuktu"]'::jsonb,2,'Svenskt'),
(102,'Vem gjorde låten ”Musik non stop” känd?','["Roxette", "Kent", "Gyllene Tider", "The Cardigans"]'::jsonb,1,'Svenskt'),
(103,'Vem gjorde låten ”Jag kommer” känd?','["Molly Sandén", "Veronica Maggio", "Zara Larsson", "Laleh"]'::jsonb,1,'Svenskt'),
(104,'Vem gjorde låten ”Goliat” känd?','["Robyn", "Laleh", "Molly Sandén", "Veronica Maggio"]'::jsonb,1,'Svenskt'),
(105,'Vem gjorde låten ”Dancing On My Own” känd?','["Zara Larsson", "Tove Lo", "Lykke Li", "Robyn"]'::jsonb,3,'Svenskt'),
(106,'Vem gjorde låten ”Lush Life” känd?','["Laleh", "Zara Larsson", "Tove Lo", "Robyn"]'::jsonb,1,'Svenskt'),
(107,'Vem gjorde låten ”Alla vill till himmelen men ingen vill dö” känd?','["Håkan Hellström", "Petter", "Timbuktu", "Markoolio"]'::jsonb,2,'Svenskt'),
(108,'Vem gjorde låten ”Kung för en dag” känd?','["Björn Skifs", "Magnus Uggla", "Tomas Ledin", "Orup"]'::jsonb,1,'Svenskt'),
(109,'Vem gjorde låten ”En kväll i juni” känd?','["Cornelis Vreeswijk", "Ted Gärdestad", "Tomas Ledin", "Lasse Berghagen"]'::jsonb,3,'Svenskt'),
(110,'Vem gjorde låten ”Three Little Birds” känd?','["Jimmy Cliff", "Shaggy", "Bob Marley", "Peter Tosh"]'::jsonb,2,'Reggae'),
(111,'Vem gjorde låten ”Ring of Fire” känd?','["Kenny Rogers", "Elvis Presley", "Johnny Cash", "Willie Nelson"]'::jsonb,2,'Country'),
(112,'Vilket instrument har vanligtvis 88 tangenter?','["Piano", "Flöjt", "Fiol", "Gitarr"]'::jsonb,0,'Instrument'),
(113,'Hur många strängar har en vanlig gitarr?','["Fyra", "Sex", "Åtta", "Tolv"]'::jsonb,1,'Instrument'),
(114,'Vilket instrument spelar man genom att slå på skinn med trumpinnar?','["Trumpet", "Fiol", "Dragspel", "Trummor"]'::jsonb,3,'Instrument'),
(115,'Vilket av dessa är ett blåsinstrument?','["Gitarr", "Harpa", "Piano", "Saxofon"]'::jsonb,3,'Instrument'),
(116,'Vad kallas personen som leder en orkester?','["Producent", "Kompositör", "Dirigent", "Solist"]'::jsonb,2,'Musikkoll'),
(117,'Vilken musikstil förknippas särskilt med Jamaica?','["Heavy metal", "Reggae", "Country", "Opera"]'::jsonb,1,'Genrer'),
(118,'Vilket land kommer ABBA från?','["Norge", "Finland", "Sverige", "Danmark"]'::jsonb,2,'Svenskt'),
(119,'Vilken stad förknippas med The Beatles?','["Birmingham", "Manchester", "London", "Liverpool"]'::jsonb,3,'60-tal'),
(120,'Vad heter de två kvinnliga medlemmarna i ABBA?','["Annie och Sara", "Carola och Lena", "Agnetha och Anni-Frid", "Marie och Agneta"]'::jsonb,2,'Svenskt'),
(121,'Vem var sångare i Queen?','["Bono", "Freddie Mercury", "Robert Plant", "Mick Jagger"]'::jsonb,1,'Rock'),
(122,'Vilken duo bestod av Marie Fredriksson och Per Gessle?','["Roxette", "First Aid Kit", "Wham!", "Eurythmics"]'::jsonb,0,'Svenskt'),
(123,'Vilken Disneyfilm förknippas med ”Let It Go”?','["Lejonkungen", "Frost", "Aladdin", "Vaiana"]'::jsonb,1,'Filmmusik'),
(124,'Vilken film innehåller ”Hakuna Matata”?','["Frost", "Skönheten och odjuret", "Lejonkungen", "Djungelboken"]'::jsonb,2,'Filmmusik'),
(125,'Vilken artist kallades ofta ”The King of Pop”?','["Prince", "Elvis Presley", "Michael Jackson", "Justin Bieber"]'::jsonb,2,'Pop'),
(126,'Vilken artist förknippas med smeknamnet ”The King of Rock and Roll”?','["Bob Dylan", "Bruce Springsteen", "Elvis Presley", "Freddie Mercury"]'::jsonb,2,'Rock'),
(127,'Vilket av dessa band kommer från Norge?','["Europe", "a-ha", "ABBA", "Roxette"]'::jsonb,1,'80-tal'),
(128,'Vilken artist hette Tim Bergling?','["Tiësto", "Kygo", "Avicii", "Alesso"]'::jsonb,2,'Svenskt'),
(129,'Vilket ord används för en låts del som ofta återkommer och är lätt att sjunga med i?','["Refräng", "Outro", "Intro", "Solo"]'::jsonb,0,'Musikkoll'),
(130,'Vad kallas det när man sjunger utan instrument?','["Remix", "Playback", "Karaoke", "A cappella"]'::jsonb,3,'Musikkoll'),
(131,'Vilket av dessa instrument har stråke?','["Fiol", "Trumpet", "Trummor", "Piano"]'::jsonb,0,'Instrument'),
(132,'Vilken musikstil förknippas ofta med cowboyhattar och Nashville?','["Techno", "Reggae", "Punk", "Country"]'::jsonb,3,'Genrer'),
(133,'Vad betyder ett solo i musik oftast?','["En musiker eller sångare står i centrum", "Publiken sjunger", "Låten tar slut", "Alla är tysta"]'::jsonb,0,'Musikkoll'),
(134,'Vilket svenskt band vann Eurovision 1974?','["Europe", "Roxette", "Gyllene Tider", "ABBA"]'::jsonb,3,'Eurovision'),
(135,'Vilken grupp förknippas med medlemmarna Baby, Scary, Sporty, Ginger och Posh?','["Spice Girls", "ABBA", "TLC", "Destiny''s Child"]'::jsonb,0,'90-tal'),
(136,'Vilken av dessa artister är känd för att spela elgitarr?','["Luciano Pavarotti", "Jimi Hendrix", "Adele", "Frank Sinatra"]'::jsonb,1,'Rock'),
(137,'Vilken musikstil förknippas med rap?','["Opera", "Hiphop", "Country", "Vals"]'::jsonb,1,'Genrer'),
(138,'Vad heter personen som skriver musik?','["DJ", "Dirigent", "Kompositör", "Trummis"]'::jsonb,2,'Musikkoll'),
(139,'Vilket instrument är Louis Armstrong särskilt förknippad med?','["Gitarr", "Fiol", "Piano", "Trumpet"]'::jsonb,3,'Jazz'),
(140,'Vilken artist är känd för sin moonwalk?','["Bob Marley", "Michael Jackson", "Elton John", "Ed Sheeran"]'::jsonb,1,'Pop'),
(141,'Vad kallas en ny version där en artist framför någon annans låt?','["Cover", "Refräng", "Duett", "Festival"]'::jsonb,0,'Musikkoll')
on conflict(id) do update set question=excluded.question,options=excluded.options,correct=excluded.correct,category=excluded.category;

commit;
