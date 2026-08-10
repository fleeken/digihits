DIGIHITS V4.61 – SPOTIFY SEARCH FIX

V4.60 kunde ge "Invalid limit".
Orsak: Spotify ändrade Search API i februari 2026.
Max limit är numera 10, inte 50.

FIX:
- Alla Spotify Search-anrop använder limit=10.
- Offset hålls inom ett säkert intervall.
- Om Spotify ändå nekar offset gör Digihits automatiskt ett nytt försök utan offset.
- Låtar hämtas i flera små batchar.
- Poolen hålls mindre för att minska API-anrop och Development Mode-kvot.
- Starta tur, Fortsätt och Byt-låt använder samma säkra låthämtning.
- Tydlig status visas medan nästa låt hämtas.

SQL:
Ingen ny SQL krävs om ONLINE_V4_60_SPOTIFY_POOL.sql redan körts.
