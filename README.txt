DIGIHITS V4.18

MATCHSKYDD / MINNE:
- Aktiv match sparas lokalt på båda mobilerna.
- Minnet gäller i 6 timmar.
- Vid vanlig omladdning försöker Digihits återansluta automatiskt.
- Vid ny öppning visas "Fortsätt senaste matchen?" på startsidan.
- Matchkod + roll (matchmobil/spelmobil) sparas lokalt.
- Matchens riktiga data ligger fortfarande i Supabase, så spelstatus, tidslinjer och turordning återställs därifrån.
- beforeunload-varning används under aktiv match.
- pagehide + visibilitychange sparar session även när mobilen suspenderar/stänger fliken.
- "Lämna match" har egen bekräftelseruta och rensar därefter lokalt matchminne.
- Avslutad match rensar automatiskt lokalt matchminne.

VIKTIGT:
iOS Safari och andra mobilwebbläsare får själva bestämma om den inbyggda
"Vill du lämna sidan?"-dialogen faktiskt visas. Det kan inte tvingas från JavaScript.
Därför är återanslutningen den viktigaste säkerheten.
