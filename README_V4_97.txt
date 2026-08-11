DIGIHITS V4.97 – UTAN SERVICE WORKER

- sw.js är borttagen ur paketet.
- All registrering/referens till Service Worker är borttagen ur index.html.
- Digihits är fortfarande onlinebaserat och använder Supabase + Spotify som tidigare.
- Ingen spel-, konto-, Spotify-, match-, chatt- eller historikfunktion har ändrats i denna version.
- Syftet är att nya GitHub Pages-versioner ska slå igenom mer förutsägbart utan gammal Service Worker-cache.

Kontroll:
JavaScript syntax: PASS.
Alla onclick-handlers: PASS.
Dubbla HTML-ID:n: 0.
Dubbla funktioner: 0.
Service Worker-referenser: 0.
