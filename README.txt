DIGIHITS V4.30 – SPELA ONLINE

VIKTIGT:
Kör ONLINE_V4_30.sql en gång i Supabase SQL Editor innan du använder onlineläget.

SPELA ONLINE:
- Anonymt användar-ID sparas i webbläsaren.
- Namnet sparas lokalt.
- Max 10 aktiva online-matcher per spelare.
- Skapa match -> dela matchkod.
- Gå med via matchkod.
- Mina matcher visar DIN TUR / Väntar.
- Matchen kan fortsätta timmar eller dagar senare.
- Varje spelare använder Spotify Premium på sin egen mobil när det är dennes tur.
- Samma regler:
  artist + låtnamn
  tidslinje
  låsta/olåsta kort
  Fortsätt / Lås in
  max 3 Byta-låt-kort
  fel placering -> olåsta kort försvinner och turen går vidare
  10 låsta kort -> vinst
- Drag/drop + tryckplacering finns även online.
- Tidslinjekort visar år, artist och låtnamn.
- Motspelaren ser inte dina olåsta kort i spelarlistan under din tur.

LOKALT:
Alla funktioner från V4.29/V4.28 är kvar.

SÄKERHET:
Online-läget använder ett anonymt lokalt userID och öppna Supabase RLS-policies för prototypen.
Det är lämpligt för test men bör ersättas med Supabase Auth innan en större publik lansering.
