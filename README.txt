DIGIHITS V4.80 – KRITISK RUNTIME-FIX

EXAKT FEL HITTAT
- actionBusy lästes av Starta ny match och Gå med i match innan variabeln någonsin hade deklarerats.
- Det ger ReferenceError direkt vid knapptrycket, innan funktionernas try/catch.
- actionBusy deklareras nu globalt som false innan någon knappfunktion kan använda den.

EXTRA SKYDD
- STARTA NY MATCH går via safeCreateOnlineMatch().
- GÅ MED I MATCHEN går via safeJoinOnlineMatch().
- Om ett oväntat synkront runtime-fel ändå uppstår återställs actionBusy och användaren får ett begripligt fel.

AUDIT
- JavaScript syntax: PASS.
- Alla onclick-handlers har definierade funktioner: PASS.
- Dubbla funktionsdefinitioner: 0.
- Dubbla HTML-ID:n: 0.
- Kritiska state-variabler verifierade som deklarerade.
- Profilnamn krävs fortfarande och användaren förs till profilredigeringen om det saknas.

Ingen ny SQL krävs.
