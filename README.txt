DIGIHITS V4.81

IPHONE – PLACERA KORT
- Aktivt inputfält blur:as innan placeringsläget öppnas.
- Alla input/select/textarea är minst 16 px på mobil för att undvika Safari auto-zoom.
- Placeringsläget använder riktig 100% visual viewport/safe-area.
- 100vw-problematik är borttagen i placeringsläget.
- Ingen transform/zoom får ligga kvar på spelcontainern.
- Tidslinjen behåller horisontell swipe.

LÅTURVAL – SVERIGE
- Spotify Search begränsas med market=SE.
- Digihits söker dynamiskt efter Sverige-relevanta topplistor/hitlistor och aktuella hits.
- Exempel på källsökningar: Top 50 Sweden, Topplistan Sverige, Hits Sverige,
  Svenska Hits, Hot Hits Sweden, Viral Sweden, Ny musik Sverige.
- Playlistlåtar kombineras med aktuella år, radiohits och välkända decenniehits.
- Poddar/sagor/spoken word-filtreringen är kvar.
- En lokal rullande cache byggs successivt upp till max 1000 unika låtar.
- Om Spotify returnerar popularity används den för prioritering.
- Urvalet slumpas inom starka popularitetsband så samma topplåtar inte återkommer hela tiden.

VIKTIGT
Spotify Web API erbjuder inte längre ett enkelt officiellt endpoint som returnerar
'exakt Sveriges 1000 mest spelade låtar'. V4.81 bygger därför en Sverige-mainstream-pool
dynamiskt från Spotify-sökning, relevanta publika playlists och aktuella låtar.

JavaScript syntax: PASS.
Ingen ny SQL krävs.
