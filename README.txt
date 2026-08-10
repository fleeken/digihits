DIGIHITS V4.79 – MATCHSKAPANDE REPARERAT + FULL AUDIT

KRITISK FIX
- V4.78 skickade Auth-JWT till spelets REST-tabeller. Det kan bryta befintliga RLS-policyer som spelet tidigare fungerade med.
- Spelets databasåtkomst använder därför åter publishable-key-rollen som tidigare fungerade.
- Kontots UUID används fortfarande som user_id, så matcher/historik följer rätt konto mellan enheter.
- Konto/Auth och spel-databas är separerade.

NY MATCH – STAGAD KONTROLL
1. Verifierar giltig kontosession.
2. Kontrollerar online_matches och online_players mot Supabase.
3. Kontrollerar antal aktiva matcher.
4. Kontrollerar Spotify automatiskt.
5. Hämtar Spotify-låtar.
6. Skapar matchraden.
7. Skapar spelarraden med profilnamnet.
8. Öppnar matchen.

- Om spelarraden misslyckas tas den halvskapade matchraden bort automatiskt.
- Fel loggas med exakt steg internt och spelaren får begriplig text.
- Gå med i match får samma databas/session-preflight.
- Saknas profilnamn förs spelaren till profilnamnsredigeringen.

AUDIT
- JavaScript syntax PASS.
- Alla onclick-knappar matchar definierade funktioner.
- 0 dubbla funktioner.
- 0 dubbla statiska HTML-ID:n.
- Kritiska konto-, profil-, match-, Spotify-, tur-, placering-, chatt- och leave-funktioner verifierade.

Ingen ny SQL krävs.
