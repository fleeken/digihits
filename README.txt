DIGIHITS V4.60 – AUTOMATISK SPOTIFY-LÅTPOOL

VIKTIG ÄNDRING
Tidigare byggdes onlinematchen från den hårdkodade TRACKS-listan i index.html.
Den kunde därför ta slut.

Nu:
- Nya onlinematcher hämtar låtar direkt från Spotify Search.
- Digihits håller en buffert av Spotify-låtar i matchen.
- När bufferten går under cirka 8 låtar fylls den automatiskt upp mot cirka 35.
- Spelaren ska därför inte möta "Kortleken är slut" i en normal match.
- Starta tur, Fortsätt med ett kort till och Använd Byt-låt-kort använder samma automatiska påfyllning.
- Spotify-spår som redan använts sparas per match och filtreras bort vid ny påfyllning.
- Låtar som redan ligger i tidslinjer, aktuell låt och låtar som redan väntar i poolen filtreras också bort.
- Om Spotify API tillfälligt inte kan leverera någon ny låt visas ett Spotify-fel i stället för "Kortleken är slut".

SQL
Kör ONLINE_V4_60_SPOTIFY_POOL.sql en gång.
Den lägger till used_track_ids på online_matches.

OBS
Den gamla TRACKS-listan finns fortfarande kvar i filen för äldre, inaktiva legacy-funktioner,
men onlineläget använder den inte längre.
