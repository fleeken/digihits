DIGIHITS V4.91 - UNIKA KONTON OCH PROFILNAMN

E-POST
- Supabase Auth ar fortsatt den slutliga sparren mot dubbla e-postkonton.
- Samma e-postadress kan inte skapa tva separata Auth-konton.

SPELARNAMN
- Ny tabell: public.digihits_profiles.
- Unikt index pa lower(trim(display_name)).
- Viktor, viktor och VIKTOR raknas som samma namn.
- Samtidiga forsok att ta samma namn stoppas av databasen, inte bara JavaScript.
- Feltext: Spelarnamnet anvands redan. Valj ett annat.
- Profilnamnet synkas till befintliga online_players-rader sa samma namn visas i alla matcher.
- Befintliga profilnamn migreras vid SQL-korning. Vid gamla dubbletter behaller aldsta kontot namnet och andra valjer nytt.

VIKTIGT
Kor ONLINE_V4_91_UNIQUE_PROFILES.sql en gang i Supabase SQL Editor.

JavaScript syntax och knappkopplingar kontrolleras vid paketering.
