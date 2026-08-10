DIGIHITS V4.68 – GÅ MED I MATCH / FLERA MOTSTÅNDARE

REGEL
- En ny deltagare får gå med medan matchen väntar eller under första varvet.
- Så fort NÅGON spelare har startat sin andra omgång låses matchen för nya deltagare.
- Exakt feltext:
  Andra omgången har tyvärr redan påbörjats.

FLERA SPELARE
- Matchlogiken är inte längre låst till exakt två spelare.
- Upp till 8 deltagare kan vara med i samma match.
- Den som går med under första varvet läggs sist i turordningen.
- En pågående tur nollställs inte när en ny deltagare ansluter.
- Nästa tur går till nästa aktiva spelare i turn_order och loopar sedan tillbaka till första.
- Matchrubriken kan visa flera motståndare.

TEKNIK
- rounds_started sparas per spelare.
- Räknaren ökar när spelaren faktiskt startar sin tur.
- Misslyckad turstart före listen-läget rullar tillbaka räknaren.

VIKTIGT
Kör ONLINE_V4_68_ROUNDS.sql en gång i Supabase SQL Editor.
