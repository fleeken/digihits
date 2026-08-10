DIGIHITS V4.76 – AUTH OMBYGGT

Kontosystemet använder nu Supabase Auth REST direkt i stället för att vara beroende av
Supabase JS Auth-klienten för de kritiska kontoknapparna.

Kontrollerat:
- SKAPA KONTO -> /auth/v1/signup
- LOGGA IN -> /auth/v1/token?grant_type=password
- GLÖMT LÖSENORD -> /auth/v1/recover
- NYTT LÖSENORD -> /auth/v1/user
- Session sparas lokalt och refreshas med refresh token.
- Verifierings-/återställningscallback läses från URL.
- Alla kontoknappar är kopplade till definierade funktioner.
- JavaScript syntax: PASS.
- Inga authClient-referenser finns kvar i kritiska konto-flödet.

Ingen ny SQL krävs.
Supabase Site URL / Redirect URL ska vara:
https://fleeken.github.io/digihits/
