const supabaseAuth = (() => {
  const root = "https://zttkujhoyuxerdewofkb.supabase.co";
  const key = "sb_publishable_lV9EA-XC2KQP5lBxr74puA_Zy1959R0";
  const sessionKey = "digihits-auth-session";
  let realtimeChannel;

  async function fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try { return await fetch(url, { ...options, signal: controller.signal, cache: "no-store" }); }
    catch (error) { throw new Error(error.name === "AbortError" ? "Inloggningen tog fÃ¶r lÃ¥ng tid. Kontrollera nÃ¤tet och fÃ¶rsÃ¶k igen." : "Kunde inte ansluta till servern. Kontrollera nÃ¤tet och fÃ¶rsÃ¶k igen."); }
    finally { clearTimeout(timer); }
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
  async function dataRequest(path, body, method = "GET") {
    const token = supabaseAuth.session()?.access_token;
    if (!token) throw new Error("Logga in igen.");
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
      if (!response.ok) throw new Error("Kunde inte läsa kontot.");
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
  };
})();
