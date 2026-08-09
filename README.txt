DIGIHITS V4.13

V4.12 hade en konkret autoplay-bugg:
låten markerades som autostartad innan Spotify hade verifierat playback.
Om första försöket misslyckades gjordes därför inget nytt försök.

V4.13:
- markerar låten som startad först efter verifierad playback
- kontrollerar att exakt rätt Spotify track faktiskt spelar
- upp till 6 retry-försök i samma jobb
- upptäcker Spotify-sessionen igen mellan försöken
- extra automatisk retry om Spotify fortfarande inte svarar
- skydd mot parallella autoplay-jobb
- aktiv Spotify-session prioriteras före gammalt sparat device-id
- ledarmobilen läser Supabase var 350 ms för snabbare respons efter REDO
- FÖRSÖK SPELA IGEN visas bara som reserv efter att automatiken misslyckats

Spotify Connect är en extern tjänst, så absolut 100% garanti kan ingen webbapp ge.
Men appen förlitar sig nu inte längre på ett enda Spotify-anrop.
