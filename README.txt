DIGIHITS V4.12

Ledarmobil:
- Ingen text "Spelar".
- Visuell Spotify-tidslinje med aktuell tid och total låtlängd.
- PAUSA
- FORTSÄTT SPELA
- SPELA FRÅN BÖRJAN
- FÖRSÖK SPELA IGEN visas bara om automatisk start misslyckas.

Flöde:
- När nästa spelare trycker REDO väljs nästa låt.
- Ledarmobilen upptäcker den förberedda låten via Supabase och försöker starta den automatiskt i Spotify.
- Vid FORTSÄTT väljs ny låt och samma automatiska uppspelning sker.
- Progressbaren läser riktig playback-status från Spotify cirka var 1,5 sekund.
