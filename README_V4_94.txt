DIGIHITS V4.94 – STABILITET + BYT SPOTIFY-KONTO

- Döda funktioner från gamla lokala spelsystemet är borttagna.
- Gamla resume/playback-hjälpare som pekade på borttagna vyer är borttagna.
- Matchen renderas innan startsidan döljs. Fel kan därför inte lämna en vit huvudvy.
- Realtime/chat-initiering är defensiv.
- Ny knapp: BYT SPOTIFY-KONTO.
- Byte rensar endast Spotify-token/enhet, aldrig Digihits-konto/matcher/historik.
- Spotify OAuth öppnas med konto-dialog så annat Spotify-konto kan väljas.

KONTROLLER
JavaScript syntax: PASS.
Alla onclick-handlers: PASS.
Dubbla HTML-ID:n: 0.
Dubbla funktioner: 0.
Oväntade referenser till saknade DOM-element: 0.
Kritiska konto-, profil-, Spotify-, match-, tur-, placerings-, resultat-, chatt-, historik- och leave-funktioner: PASS.
Legacy lokala matchfunktioner: borttagna.

Ingen ny SQL krävs.
