const supabaseAuth = (() => {
  const root = "https://zttkujhoyuxerdewofkb.supabase.co";
  const key = "sb_publishable_lV9EA-XC2KQP5lBxr74puA_Zy1959R0";
  const sessionKey = "digihits-auth-session";
  const spotifyKey = "digihits-spotify-session", spotifyClientId = "096b8f046aba41759da21ada77d8f920", spotifyRedirect = "https://fleeken.github.io/digihits/";
  let realtimeChannel;

  async function fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try { return await fetch(url, { ...options, signal: controller.signal, cache: "no-store" }); }
    catch (error) { throw new Error(error.name === "AbortError" ? "Inloggningen tog fÃ¶r lÃ¥ng tid. Kontrollera nÃ¤tet och fÃ¶rsÃ¶k igen." : "Kunde inte ansluta till servern. Kontrollera nÃ¤tet och fÃ¶rsÃ¶k igen."); }
    finally { clearTimeout(timer); }
  }
  async function spotifyJson(response, fallback) {
    const text = await response.text();
    try { return JSON.parse(text); } catch { throw new Error(`${fallback} (HTTP ${response.status || "okänd"}).`); }
  }

  async function request(path, body, method = "POST", accessToken = key) {
    const response = await fetchWithTimeout(`${root}/auth/v1${path}`, {
      method,
      headers: { apikey: key, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.msg || data.message || "Kunde inte kontakta kontotjänsten.");
    return data;
  }
  const tokenExpiresSoon = (token) => { try { return JSON.parse(atob(token.split(".")[1].replaceAll("-", "+").replaceAll("_", "/"))).exp * 1000 < Date.now() + 60000; } catch { return true; } };
  async function dataRequest(path, body, method = "GET") {
    const token = (await supabaseAuth.refreshSession()).access_token;
    const response = await fetch(`${root}/rest/v1/${path}`, { method, headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Kunde inte kontakta matchservern.");
    return data;
  }

  return {
    async signUp(name, email, password) {
      const redirectTo = encodeURIComponent(`${location.origin}${location.pathname}`);
      return request(`/signup?redirect_to=${redirectTo}`, { email, password, data: { display_name: name } });
    },
    async signIn(email, password) {
      const data = await request("/token?grant_type=password", { email, password });
      localStorage.setItem(sessionKey, JSON.stringify(data));
      return data;
    },
    async refreshSession(force = false) {
      const session = this.session();
      if (!session?.access_token) throw new Error("Logga in igen.");
      if (!force && !tokenExpiresSoon(session.access_token)) return session;
      if (!session.refresh_token) throw new Error("Logga in igen.");
      const refreshed = await request("/token?grant_type=refresh_token", { refresh_token: session.refresh_token });
      const next = { ...session, ...refreshed, refresh_token: refreshed.refresh_token || session.refresh_token };
      localStorage.setItem(sessionKey, JSON.stringify(next));
      return next;
    },
    verify(email, password) { return request("/token?grant_type=password", { email, password }); },
    async playerNameTaken(name) {
      const keyName = name.trim().toLocaleLowerCase("sv-SE");
      const response = await fetch(`${root}/rest/v1/rpc/digihits_player_name_taken`, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ requested_name: keyName }) });
      if (!response.ok) throw new Error("Kunde inte kontrollera spelarnamnet.");
      return await response.json();
    },
    requestPasswordReset(email) {
      const redirectTo = encodeURIComponent(`${location.origin}${location.pathname}?reset=1`);
      return request(`/recover?redirect_to=${redirectTo}`, { email });
    },
    updatePassword(accessToken, password, currentPassword) { return request("/user", { password, ...(currentPassword ? { current_password: currentPassword } : {}) }, "PUT", accessToken); },
    async deleteAccount(confirmation) {
      const token = this.session()?.access_token;
      if (!token) throw new Error("Du är inte inloggad.");
      const response = await fetch(`${root}/functions/v1/delete-account`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ confirmation }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Kunde inte radera kontot.");
    },
    dataRequest,
    subscribeMatches(callback) {
      if (!window.supabase || !this.session()?.access_token) return;
      if (realtimeChannel) realtimeChannel.unsubscribe();
      const client = window.supabase.createClient(root, key, { auth: { persistSession: false } });
      client.realtime.setAuth(this.session().access_token);
      realtimeChannel = client.channel("digihits-matches").on("postgres_changes", { event: "*", schema: "public", table: "online_matches" }, callback).on("postgres_changes", { event: "*", schema: "public", table: "online_players" }, callback).subscribe();
    },
    unsubscribeMatches() { if (realtimeChannel) { realtimeChannel.unsubscribe(); realtimeChannel = null; } },
    session() {
      try { return JSON.parse(localStorage.getItem(sessionKey)); } catch { return null; }
    },
    async user(accessToken) {
      const response = await fetch(`${root}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${accessToken}` } });
      if (!response.ok && accessToken === this.session()?.access_token) {
        try { return await this.user((await this.refreshSession(true)).access_token); }
        catch (error) { if (response.status === 401 || response.status === 403) throw new Error("SESSION_EXPIRED"); throw error; }
      }
      if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "SESSION_EXPIRED" : "Kunde inte läsa kontot.");
      return response.json();
    },
    consumeVerification() {
      const values = new URLSearchParams(location.hash.slice(1));
      const access_token = values.get("access_token");
      if (!access_token) return null;
      const session = { access_token, refresh_token: values.get("refresh_token") };
      localStorage.setItem(sessionKey, JSON.stringify(session));
      history.replaceState({}, "", `${location.pathname}${location.search}`);
      return { session, type: values.get("type") };
    },
    signOut() { this.unsubscribeMatches(); localStorage.removeItem(sessionKey); }
    ,spotifyScope() { try { return JSON.parse(atob(this.session()?.access_token.split(".")[1].replaceAll("-", "+").replaceAll("_", "/"))).sub || "default"; } catch { return "default"; } },
    spotifyStorageKey() { return `${spotifyKey}-${this.spotifyScope()}`; },
    pkceStorageKey() { return `digihits-spotify-pkce-${this.spotifyScope()}`; },
    spotify() { try { return JSON.parse(localStorage.getItem(this.spotifyStorageKey())); } catch { return null; } },
    disconnectSpotify() { localStorage.removeItem(this.spotifyStorageKey()); },
    async spotifyToken() {
      const session = this.spotify(); if (!session) throw new Error("Anslut Spotify Premium först.");
      if (session.expires_at > Date.now() + 30000) return session.access_token;
      const body = new URLSearchParams({ client_id: spotifyClientId, grant_type: "refresh_token", refresh_token: session.refresh_token });
      const response = await fetch("https://accounts.spotify.com/api/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
      const token = await spotifyJson(response, "Spotify svarade inte korrekt"); if (!response.ok) throw new Error("Spotify-sessionen har gått ut. Anslut kontot igen.");
      const refreshed = { ...session, ...token, refresh_token: token.refresh_token || session.refresh_token, expires_at: Date.now() + token.expires_in * 1000 };
      localStorage.setItem(this.spotifyStorageKey(), JSON.stringify(refreshed)); return refreshed.access_token;
    },
    async connectSpotify(showAccountPicker = false) {
      const verifier = Array.from(crypto.getRandomValues(new Uint8Array(64)), (value) => value.toString(16).padStart(2, "0")).join("");
      const challenge = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
      const state = verifier.slice(0, 32); localStorage.setItem(this.pkceStorageKey(), JSON.stringify({ verifier, state, startedAt: Date.now() })); sessionStorage.setItem("digihits-spotify-pending", "1");
      const params = new URLSearchParams({ client_id: spotifyClientId, response_type: "code", redirect_uri: spotifyRedirect, code_challenge_method: "S256", code_challenge: challenge, state, scope: "user-read-private user-read-email streaming user-modify-playback-state" });
      if (showAccountPicker) params.set("show_dialog", "true");
      location.assign(`https://accounts.spotify.com/authorize?${params}`);
    },
    async consumeSpotify() {
      const params = new URLSearchParams(location.search), code = params.get("code"), pkceKey = this.pkceStorageKey(), saved = JSON.parse(localStorage.getItem(pkceKey) || "null"), clean = () => { history.replaceState({}, "", location.pathname); sessionStorage.removeItem("digihits-spotify-pending"); document.documentElement.classList.remove("spotify-callback"); document.querySelector("#spotify-connecting")?.setAttribute("hidden", ""); };
      if (!code) return null;
      if (!saved || Date.now() - saved.startedAt > 60000 || !/^[A-Za-z0-9._~-]{43,128}$/.test(saved.verifier || "") || params.get("state") !== saved.state) { localStorage.removeItem(pkceKey); clean(); return null; }
      try {
        const body = new URLSearchParams({ client_id: spotifyClientId, grant_type: "authorization_code", code, redirect_uri: spotifyRedirect, code_verifier: saved.verifier });
        const response = await fetch("https://accounts.spotify.com/api/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
        const token = await spotifyJson(response, "Spotify-inloggningen kunde inte slutföras"); if (!response.ok) throw new Error(token.error_description || "Spotify-inloggningen misslyckades.");
        const profileResponse = await fetch("https://api.spotify.com/v1/me", { headers: { Authorization: `Bearer ${token.access_token}` } });
        const profile = await spotifyJson(profileResponse, "Spotify kunde inte läsa kontot"); if (!profileResponse.ok || profile.product !== "premium") throw new Error("Ett Spotify Premium-konto krävs.");
        const session = { ...token, name: profile.display_name || profile.id, id: profile.id, expires_at: Date.now() + token.expires_in * 1000 };
        localStorage.setItem(this.spotifyStorageKey(), JSON.stringify(session)); return session;
      } finally { localStorage.removeItem(pkceKey); clean(); }
    }
  };
})();
