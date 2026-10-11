"""Curated family question bank; answers are served only by the protected RPC."""
import json, random
from pathlib import Path
songs='''
ABBA|Dancing Queen|Bee Gees|Queen|Boney M.|70-tal
ABBA|Mamma Mia|Roxette|Ace of Base|Europe|70-tal
Queen|We Will Rock You|Kiss|The Beatles|AC/DC|70-tal
Queen|Bohemian Rhapsody|Elton John|David Bowie|The Rolling Stones|70-tal
Bee Gees|Stayin' Alive|ABBA|Village People|The Beach Boys|70-tal
Village People|Y.M.C.A.|Boney M.|Bee Gees|Kiss|70-tal
Boney M.|Rasputin|ABBA|Queen|The Jackson 5|70-tal
Gloria Gaynor|I Will Survive|Dolly Parton|Tina Turner|Cher|70-tal
John Lennon|Imagine|Elvis Presley|Bob Dylan|Elton John|70-tal
Dolly Parton|Jolene|Tina Turner|Madonna|Diana Ross|Country
Eagles|Hotel California|AC/DC|Metallica|Nirvana|70-tal
Elton John|Your Song|Rod Stewart|David Bowie|Bruce Springsteen|70-tal
The Beatles|Hey Jude|The Rolling Stones|The Beach Boys|The Doors|60-tal
The Beatles|Yellow Submarine|Queen|ABBA|Bee Gees|60-tal
The Beach Boys|Good Vibrations|The Beatles|The Kinks|The Who|60-tal
Elvis Presley|Jailhouse Rock|Johnny Cash|Frank Sinatra|Chuck Berry|50-tal
Chuck Berry|Johnny B. Goode|Elvis Presley|Little Richard|Ray Charles|50-tal
Louis Armstrong|What a Wonderful World|Frank Sinatra|Elvis Presley|Tom Jones|60-tal
Aretha Franklin|Respect|Diana Ross|Tina Turner|Whitney Houston|Soul
Ben E. King|Stand by Me|Ray Charles|James Brown|Stevie Wonder|60-tal
Michael Jackson|Billie Jean|Prince|Lionel Richie|Stevie Wonder|80-tal
Michael Jackson|Thriller|Madonna|Prince|George Michael|80-tal
Madonna|Like a Prayer|Whitney Houston|Cyndi Lauper|Tina Turner|80-tal
Madonna|Material Girl|Cher|Dolly Parton|Annie Lennox|80-tal
a-ha|Take On Me|Duran Duran|Depeche Mode|Pet Shop Boys|80-tal
Rick Astley|Never Gonna Give You Up|George Michael|Phil Collins|Sting|80-tal
Cyndi Lauper|Girls Just Want to Have Fun|Madonna|Cher|Tina Turner|80-tal
Whitney Houston|I Wanna Dance with Somebody|Mariah Carey|Céline Dion|Janet Jackson|80-tal
Bon Jovi|Livin' on a Prayer|Europe|Guns N' Roses|Aerosmith|Rock
Europe|The Final Countdown|Bon Jovi|Kiss|Queen|80-tal
Toto|Africa|Journey|Foreigner|Dire Straits|80-tal
Survivor|Eye of the Tiger|Europe|Queen|AC/DC|80-tal
Eurythmics|Sweet Dreams (Are Made of This)|Depeche Mode|Pet Shop Boys|a-ha|80-tal
Wham!|Last Christmas|ABBA|Take That|Bee Gees|Julmusik
George Michael|Faith|Phil Collins|Prince|David Bowie|80-tal
Tina Turner|The Best|Cher|Madonna|Whitney Houston|80-tal
Bruce Springsteen|Born in the U.S.A.|Bryan Adams|Bob Dylan|Billy Joel|Rock
AC/DC|Back in Black|Metallica|Iron Maiden|Kiss|Hårdrock
Guns N' Roses|Sweet Child o' Mine|Nirvana|Bon Jovi|Metallica|Hårdrock
Roxette|The Look|Ace of Base|ABBA|Europe|Svenskt
Roxette|It Must Have Been Love|The Cardigans|Ace of Base|ABBA|Svenskt
Nirvana|Smells Like Teen Spirit|Pearl Jam|Green Day|Oasis|90-tal
Oasis|Wonderwall|Blur|Coldplay|Radiohead|90-tal
Spice Girls|Wannabe|Destiny's Child|TLC|All Saints|90-tal
Backstreet Boys|I Want It That Way|NSYNC|Take That|Westlife|90-tal
Britney Spears|...Baby One More Time|Christina Aguilera|Jennifer Lopez|Shakira|90-tal
Cher|Believe|Madonna|Céline Dion|Annie Lennox|90-tal
Aqua|Barbie Girl|Ace of Base|Vengaboys|ABBA|90-tal
Ace of Base|The Sign|Roxette|The Cardigans|Aqua|Svenskt
The Cardigans|Lovefool|Roxette|Kent|Ace of Base|Svenskt
Los del Río|Macarena|Gipsy Kings|Aqua|Vengaboys|90-tal
Céline Dion|My Heart Will Go On|Whitney Houston|Mariah Carey|Shania Twain|Filmmusik
Whitney Houston|I Will Always Love You (från filmen Bodyguard)|Céline Dion|Mariah Carey|Tina Turner|Filmmusik
Mariah Carey|All I Want for Christmas Is You|Ariana Grande|Whitney Houston|Céline Dion|Julmusik
MC Hammer|U Can't Touch This|Vanilla Ice|Eminem|Snoop Dogg|Hiphop
Coolio|Gangsta's Paradise|Eminem|Dr. Dre|MC Hammer|Hiphop
Eminem|Lose Yourself|Jay-Z|Drake|Kanye West|Hiphop
Shakira|Whenever, Wherever|Jennifer Lopez|Rihanna|Beyoncé|00-tal
Beyoncé|Single Ladies (Put a Ring on It)|Rihanna|Alicia Keys|Shakira|00-tal
Rihanna|Umbrella|Beyoncé|Lady Gaga|Katy Perry|00-tal
Lady Gaga|Poker Face|Katy Perry|Britney Spears|P!nk|00-tal
Katy Perry|I Kissed a Girl|Lady Gaga|Rihanna|Taylor Swift|00-tal
Coldplay|Viva la Vida|Oasis|U2|Maroon 5|00-tal
The Killers|Mr. Brightside|Coldplay|Green Day|Oasis|00-tal
Green Day|Boulevard of Broken Dreams|Blink-182|Nirvana|Foo Fighters|Rock
Outkast|Hey Ya!|The Black Eyed Peas|Destiny's Child|Nelly|00-tal
The Black Eyed Peas|I Gotta Feeling|Outkast|Maroon 5|Daft Punk|00-tal
Amy Winehouse|Rehab|Adele|Duffy|Lily Allen|Soul
Justin Timberlake|Cry Me a River|Justin Bieber|Usher|Bruno Mars|00-tal
Alicia Keys|Fallin'|Beyoncé|Rihanna|Mary J. Blige|00-tal
Daft Punk|Get Lucky|Avicii|Calvin Harris|Swedish House Mafia|Dansmusik
Avicii|Wake Me Up|David Guetta|Kygo|Tiësto|Svenskt
Avicii|Levels|Calvin Harris|Daft Punk|Martin Garrix|Dansmusik
Swedish House Mafia|Don't You Worry Child|Daft Punk|The Chainsmokers|Disclosure|Dansmusik
Adele|Rolling in the Deep|Sia|Lady Gaga|Beyoncé|10-tal
Adele|Hello|Taylor Swift|Rihanna|Katy Perry|10-tal
Ed Sheeran|Shape of You|Shawn Mendes|Justin Bieber|Harry Styles|10-tal
Ed Sheeran|Perfect|Sam Smith|Bruno Mars|Lewis Capaldi|10-tal
Taylor Swift|Shake It Off|Katy Perry|Ariana Grande|Miley Cyrus|10-tal
Pharrell Williams|Happy|Bruno Mars|Usher|Justin Timberlake|10-tal
Bruno Mars|Just the Way You Are|Ed Sheeran|Justin Bieber|Sam Smith|10-tal
Sia|Chandelier|Adele|Lorde|Lana Del Rey|10-tal
Miley Cyrus|Wrecking Ball|Taylor Swift|Selena Gomez|Demi Lovato|10-tal
Luis Fonsi|Despacito (med Daddy Yankee)|Enrique Iglesias|Ricky Martin|Bad Bunny|10-tal
The Weeknd|Blinding Lights|Bruno Mars|Drake|Justin Bieber|20-tal
Harry Styles|As It Was|Shawn Mendes|Ed Sheeran|Justin Bieber|20-tal
Miley Cyrus|Flowers|Dua Lipa|Ariana Grande|Taylor Swift|20-tal
Dua Lipa|Don't Start Now|Adele|Katy Perry|Billie Eilish|Pop
Billie Eilish|bad guy|Olivia Rodrigo|Dua Lipa|Ariana Grande|Pop
Olivia Rodrigo|drivers license|Sabrina Carpenter|Billie Eilish|Taylor Swift|20-tal
Tones and I|Dance Monkey|Sia|Lorde|Dua Lipa|Pop
Håkan Hellström|Känn ingen sorg för mig Göteborg|Lars Winnerbäck|Kent|Tomas Ledin|Svenskt
Gyllene Tider|Sommartider|ABBA|Roxette|Lasse Stefanz|Svenskt
Tomas Ledin|Sommaren är kort|Ted Gärdestad|Magnus Uggla|Björn Skifs|Svenskt
Ted Gärdestad|Sol, vind och vatten|Tomas Ledin|Lasse Berghagen|Mats Paulson|Svenskt
Carola|Främling|Lena Philipsson|Charlotte Perrelli|Sanna Nielsen|Svenskt
Loreen|Euphoria|Måns Zelmerlöw|Zara Larsson|Carola|Eurovision
Loreen|Tattoo|Cornelia Jakobs|Sanna Nielsen|Charlotte Perrelli|Eurovision
Måns Zelmerlöw|Heroes|Eric Saade|Benjamin Ingrosso|Danny Saucedo|Eurovision
ABBA|Waterloo|Roxette|Europe|Ace of Base|Eurovision
Markoolio|Mera mål|Petter|Timbuktu|Sean Banan|Svenskt
Kent|Musik non stop|Roxette|The Cardigans|Gyllene Tider|Svenskt
Veronica Maggio|Jag kommer|Molly Sandén|Laleh|Zara Larsson|Svenskt
Laleh|Goliat|Veronica Maggio|Robyn|Molly Sandén|Svenskt
Robyn|Dancing On My Own|Zara Larsson|Lykke Li|Tove Lo|Svenskt
Zara Larsson|Lush Life|Tove Lo|Robyn|Laleh|Svenskt
Timbuktu|Alla vill till himmelen men ingen vill dö|Petter|Markoolio|Håkan Hellström|Svenskt
Magnus Uggla|Kung för en dag|Tomas Ledin|Björn Skifs|Orup|Svenskt
Lasse Berghagen|En kväll i juni|Ted Gärdestad|Tomas Ledin|Cornelis Vreeswijk|Svenskt
Bob Marley|Three Little Birds|Jimmy Cliff|Peter Tosh|Shaggy|Reggae
Johnny Cash|Ring of Fire|Elvis Presley|Willie Nelson|Kenny Rogers|Country
'''.strip().splitlines()
questions=[]
for row in songs:
 a,s,b,c,d,category=row.split('|');questions.append({'question':f'Vem gjorde låten ”{s}” känd?','options':[a,b,c,d],'correct':0,'category':category})
extra='''
Vilket instrument har vanligtvis 88 tangenter?|Piano|Gitarr|Fiol|Flöjt|Instrument
Hur många strängar har en vanlig gitarr?|Sex|Fyra|Åtta|Tolv|Instrument
Vilket instrument spelar man genom att slå på skinn med trumpinnar?|Trummor|Trumpet|Fiol|Dragspel|Instrument
Vilket av dessa är ett blåsinstrument?|Saxofon|Piano|Gitarr|Harpa|Instrument
Vad kallas personen som leder en orkester?|Dirigent|Producent|Kompositör|Solist|Musikkoll
Vilken musikstil förknippas särskilt med Jamaica?|Reggae|Country|Opera|Heavy metal|Genrer
Vilket land kommer ABBA från?|Sverige|Norge|Danmark|Finland|Svenskt
Vilken stad förknippas med The Beatles?|Liverpool|London|Manchester|Birmingham|60-tal
Vad heter de två kvinnliga medlemmarna i ABBA?|Agnetha och Anni-Frid|Marie och Agneta|Carola och Lena|Annie och Sara|Svenskt
Vem var sångare i Queen?|Freddie Mercury|Mick Jagger|Bono|Robert Plant|Rock
Vilken duo bestod av Marie Fredriksson och Per Gessle?|Roxette|Eurythmics|Wham!|First Aid Kit|Svenskt
Vilken Disneyfilm förknippas med ”Let It Go”?|Frost|Lejonkungen|Aladdin|Vaiana|Filmmusik
Vilken film innehåller ”Hakuna Matata”?|Lejonkungen|Frost|Djungelboken|Skönheten och odjuret|Filmmusik
Vilken artist kallades ofta ”The King of Pop”?|Michael Jackson|Elvis Presley|Prince|Justin Bieber|Pop
Vilken artist förknippas med smeknamnet ”The King of Rock and Roll”?|Elvis Presley|Freddie Mercury|Bob Dylan|Bruce Springsteen|Rock
Vilket av dessa band kommer från Norge?|a-ha|ABBA|Roxette|Europe|80-tal
Vilken artist hette Tim Bergling?|Avicii|Alesso|Kygo|Tiësto|Svenskt
Vilket ord används för en låts del som ofta återkommer och är lätt att sjunga med i?|Refräng|Intro|Outro|Solo|Musikkoll
Vad kallas det när man sjunger utan instrument?|A cappella|Karaoke|Playback|Remix|Musikkoll
Vilket av dessa instrument har stråke?|Fiol|Trumpet|Trummor|Piano|Instrument
Vilken musikstil förknippas ofta med cowboyhattar och Nashville?|Country|Reggae|Techno|Punk|Genrer
Vad betyder ett solo i musik oftast?|En musiker eller sångare står i centrum|Alla är tysta|Låten tar slut|Publiken sjunger|Musikkoll
Vilket svenskt band vann Eurovision 1974?|ABBA|Roxette|Europe|Gyllene Tider|Eurovision
Vilken grupp förknippas med medlemmarna Baby, Scary, Sporty, Ginger och Posh?|Spice Girls|ABBA|Destiny's Child|TLC|90-tal
Vilken av dessa artister är känd för att spela elgitarr?|Jimi Hendrix|Luciano Pavarotti|Adele|Frank Sinatra|Rock
Vilken musikstil förknippas med rap?|Hiphop|Opera|Country|Vals|Genrer
Vad heter personen som skriver musik?|Kompositör|Dirigent|Trummis|DJ|Musikkoll
Vilket instrument är Louis Armstrong särskilt förknippad med?|Trumpet|Gitarr|Piano|Fiol|Jazz
Vilken artist är känd för sin moonwalk?|Michael Jackson|Elton John|Ed Sheeran|Bob Marley|Pop
Vad kallas en ny version där en artist framför någon annans låt?|Cover|Refräng|Festival|Duett|Musikkoll
'''.strip().splitlines()
for row in extra:
 q,a,b,c,d,category=row.split('|');questions.append({'question':q,'options':[a,b,c,d],'correct':0,'category':category})
rng=random.Random(42)
for i,q in enumerate(questions,1):
 correct=q['options'][0];rng.shuffle(q['options']);q['correct']=q['options'].index(correct);q['id']=i
assert len({q['question'] for q in questions})==len(questions)
assert all(len(set(q['options']))==4 for q in questions)
Path('musikquiz/questions.json').write_text(json.dumps(questions,ensure_ascii=False,indent=2)+'\n')
esc=lambda x:"'"+str(x).replace("'","''")+"'"
values=[f"({q['id']},{esc(q['question'])},{esc(json.dumps(q['options'],ensure_ascii=False))}::jsonb,{q['correct']},{esc(q['category'])})" for q in questions]
Path('musikquiz/questions.sql').write_text('insert into musikquiz.questions(id,question,options,correct,category) values\n'+',\n'.join(values)+'\non conflict(id) do update set question=excluded.question,options=excluded.options,correct=excluded.correct,category=excluded.category;\n')
print(len(questions),'questions validated')
