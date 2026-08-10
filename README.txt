DIGIHITS V4.73 – GLÖMT LÖSENORD

NYTT
- GLÖMT LÖSENORD? finns under inloggningsknapparna.
- Spelaren skriver sin e-post och trycker GLÖMT LÖSENORD?.
- Supabase skickar en återställningslänk.
- När länken öppnas visas Välj nytt lösenord i Digihits.
- Spelaren skriver nytt lösenord två gånger och sparar.
- Efter ändringen är spelaren inloggad igen.
- Digihits lagrar aldrig lösenordet.

SÄKERHET
- Meddelandet efter återställningsbegäran avslöjar inte om e-postadressen finns registrerad.
- Minst 6 tecken krävs.
- Båda lösenordsfälten måste matcha.

SUPABASE – VIKTIGT
Authentication -> URL Configuration -> Redirect URLs
måste innehålla din Digihits-adress, exempel:
https://fleeken.github.io/digihits/

Ingen ny databasändring krävs.
ONLINE_V4_73_PASSWORD_RESET.sql innehåller endast instruktionen ovan.
