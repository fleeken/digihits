DIGIHITS V4.3 - HARDENED TEST VERSION

SQL:
- Har du redan kört SUPABASE_V4.sql behöver du INTE köra SQL igen.

GitHub:
- Ersätt index.html
- Ersätt sw.js
- manifest.webmanifest kan ligga kvar, men det är okej att ersätta den också.

Kontroll:
- Startsidan ska visa V4.3.
- Max 8 spelare.
- SKAPA MATCH visar tydlig status och fel.
- Matchskapande städar halvskapade poster vid fel.
- Dubbeltryck skyddas på kritiska knappar.
- Byta-låt-kort visas alltid 0/3 till 3/3.
- Spelaren får separata besked: Rätt/Fel placering, Rätt/Fel artist, Rätt/Fel låtnamn.
- Efter rätt placering: Fortsätt eller Lås in.
- Vid fel placering förloras bara turens olåsta kort.
