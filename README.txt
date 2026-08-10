DIGIHITS V4.78 – FULL AUDIT + PROFILNAMN

PROFILNAMN
- Spelarnamnet är en fast profilinställning.
- Visas som text med liten pennsymbol för redigering.
- Sparas i Supabase Auth user_metadata.
- Samma profilnamn används i alla matcher.
- Om profilnamn saknas och användaren trycker STARTA NY MATCH eller GÅ MED I MATCHEN,
  stoppas åtgärden och användaren förs direkt till profilnamnsfältet.

KRITISK MATCHFIX
- Spelets REST-anrop använder nu den inloggade användarens Supabase access token.
- Realtime får också användarens access token.
- Detta är nödvändigt när Supabase RLS/policies baseras på auth.uid() och var en möjlig
  orsak till att inloggad användare inte kunde skapa match.

FULL STATISK AUDIT
- JavaScript syntax: PASS.
- Alla inline-knappar har definierade funktioner: PASS.
- Dubbla funktionsdefinitioner: 0.
- Dubbla statiska HTML-ID:n: 0.
- Kritiska konto-, profil-, match-, Spotify-, placerings-, chatt- och lämna-match-funktioner finns.
- Alla button-element har type=button.
- Dubbla onlineSwapBtnCount-id:t är borttaget.

Ingen ny SQL krävs.
