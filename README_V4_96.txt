DIGIHITS V4.96 – STABIL BAS + UTVALDA FÖRBÄTTRINGAR

GRUND
- V4.87 används som bas för att återfå det tidigare flytet.
- Matchskapande, gå-med-flöde, matchöppning, turmotor, placering, chatt och historik lämnas i V4.87-strukturen.

BEHÅLLNA SENARE FÖRBÄTTRINGAR
- Skicka verifieringsmail igen.
- Unikt profilnamn när V4.91 SQL finns/körs.
- Digihits-loggan tar alltid användaren till startsidan.
- Byt Spotify-konto utan att påverka Digihits-kontot.
- Bättre Spotify 403/401/429-felhantering via centrala Spotify API-funktionen.
- Igenkännbar låtversion prioriteras; remix/instrumental/karaoke m.m. filtreras.
- Samma år undviks i följd när alternativ finns.
- Samma årtal bildar ett sammanhängande block i tidslinjen.
- Matchlås från V4.87 är kvar.

KONTROLL
- JavaScript syntax: PASS.
- Alla onclick-handlers: PASS.
- Dubbla HTML-ID:n: 0.
- Dubbla funktioner: 0.
- Kritiska spel-/konto-/Spotify-funktioner finns.
- V4.87:s skapa-match-flöde är bevarat och öppnar matchen direkt efter skapande.
