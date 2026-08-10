DIGIHITS V4.75 – KONTOFIX

- Spelets REST/Supabase-databasklient är återställd.
- Supabase Auth och spelets databasanrop fungerar sida vid sida.
- Skapa konto använder e-postverifiering och redirect tillbaka till Digihits.
- Logga in använder email + password.
- Glömt lösenord använder Supabase reset-länk.
- Konto-initiering vid sidstart är tyst; ingen röd varning visas innan användaren gjort något.
- Tekniska Auth-fel översätts till begriplig svensk text.
- JavaScript syntax och alla inline-knappar kontrollerade: PASS.
- Ingen ny SQL krävs utöver V4.72-konto-SQL om den inte redan körts.
