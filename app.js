const storageKey = "digihits-home-v1";
const state = JSON.parse(localStorage.getItem(storageKey) || "null") || {
  playerName: "Spelare",
  matches: [],
  history: []
};
state.history ||= [];
state.stats ||= { wins: 0, losses: 0, walkovers: 0, streak: 0 };
state.selectedTracks ||= {};
state.changeTrackCards ??= 1;
state.roundUnlocked ||= [];
state.lockedTimeline ||= [{ id: "starter-1983", year: 1983, artist: "The Police", title: "Every Breath You Take" }];
state.currentCard ||= null;
let currentPlacementCorrect = true;
let viewingLatestRound = false;
const latestRounds = {};
let spotifyPlayer, spotifyDeviceId, spotifyPlayerReady, spotifyPlaying = false, loadedSpotifyCardId = null, songPosition = 0, songDuration = 0, songTimer;
const mobileBrowser = /iPhone|iPad|Android/i.test(navigator.userAgent);
const testDeck = [
  { id: "starter-1983", year: 1983, artist: "The Police", title: "Every Breath You Take" },
  { id: "track-1978", year: 1978, artist: "Earth, Wind & Fire", title: "September" },
  { id: "track-1982", year: 1982, artist: "Toto", title: "Africa" },
  { id: "track-1990", year: 1990, artist: "Roxette", title: "It Must Have Been Love" },
  { id: "track-1998", year: 1998, artist: "Britney Spears", title: "...Baby One More Time" },
  { id: "track-2004", year: 2004, artist: "Usher", title: "Yeah!" },
  { id: "track-2011", year: 2011, artist: "Adele", title: "Rolling in the Deep" },
  { id: "track-2017", year: 2017, artist: "Ed Sheeran", title: "Shape of You" },
  { id: "track-2020", year: 2020, artist: "The Weeknd", title: "Blinding Lights" },
  { id: "track-2023", year: 2023, artist: "Miley Cyrus", title: "Flowers" }
];
const activeCard = () => state.currentCard || testDeck[5];
const songTime = (milliseconds) => `${Math.floor(milliseconds / 60000)}:${String(Math.floor(milliseconds / 1000) % 60).padStart(2, "0")}`;
function updateSongTimeline(position, duration, playing) {
  songPosition = position; songDuration = duration || songDuration; $("#song-timeline").hidden = !songDuration; if (songDuration) $("#song-timeline").removeAttribute("hidden"); $("#song-current").textContent = songTime(songPosition); $("#song-duration").textContent = songTime(songDuration); $("#song-progress").style.width = `${songDuration ? Math.min(100, songPosition / songDuration * 100) : 0}%`;
  clearInterval(songTimer); if (playing) songTimer = setInterval(() => updateSongTimeline(Math.min(songDuration, songPosition + 500), songDuration, true), 500);
}
async function ensureSpotifyPlayer() {
  if (spotifyDeviceId) return spotifyDeviceId;
  if (spotifyPlayerReady) return spotifyPlayerReady;
  spotifyPlayerReady = new Promise(async (resolve, reject) => {
    if (!window.Spotify) await new Promise((ready, fail) => { window.onSpotifyWebPlaybackSDKReady = ready; setTimeout(() => fail(new Error("Spotify-spelaren kunde inte laddas.")), 10000); });
    spotifyPlayer = new window.Spotify.Player({ name: "Digihits", getOAuthToken: (callback) => supabaseAuth.spotifyToken().then(callback).catch(() => callback("")), volume: 0.7 });
    spotifyPlayer.addListener("ready", ({ device_id }) => { spotifyDeviceId = device_id; resolve(device_id); });
    spotifyPlayer.addListener("player_state_changed", (playerState) => playerState && updateSongTimeline(playerState.position, playerState.duration, !playerState.paused));
    spotifyPlayer.addListener("account_error", ({ message }) => reject(new Error(message)));
    spotifyPlayer.connect();
  });
  return spotifyPlayerReady;
}
async function playCurrentTrack() {
  const token = await supabaseAuth.spotifyToken(), card = activeCard();
  const search = await fetch(`https://api.spotify.com/v1/search?type=track&limit=1&q=${encodeURIComponent(`track:${card.title} artist:${card.artist}`)}`, { headers: { Authorization: `Bearer ${token}` } });
  const track = (await search.json()).tracks?.items?.[0]; if (!track) throw new Error("Låten hittades inte på Spotify.");
  const device = await ensureSpotifyPlayer(); if (mobileBrowser) await spotifyPlayer.activateElement();
  await fetch("https://api.spotify.com/v1/me/player", { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ device_ids: [device], play: false }) });
  const play = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${device}`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ uris: [track.uri] }) });
  if (!play.ok) throw new Error("Spotify kunde inte starta låten.");
  loadedSpotifyCardId = card.id; updateSongTimeline(0, track.duration_ms, true); setPlayButton(true);
}
function setPlayButton(playing) { spotifyPlaying = playing; $("#play-sample").textContent = playing ? "⏸ PAUSA LÅT" : "▶ SPELA LÅT"; $("#play-sample").className = `button ${playing ? "button-secondary" : "button-green"}`; }
function stopCurrentTrack() { spotifyPlayer?.pause(); clearInterval(songTimer); loadedSpotifyCardId = null; setPlayButton(false); }
function startCurrentTrack() { stopCurrentTrack(); if (!mobileBrowser && supabaseAuth.spotify()) playCurrentTrack().catch(() => {}); }

const $ = (selector) => document.querySelector(selector);
$("#guess-form button[type=submit]").textContent = "NÄSTA";
if (document.documentElement.classList.contains("spotify-callback")) $("#spotify-connecting").hidden = false;
let currentView = "welcome";
let resultIsLocked = false;
const code = () => Array.from({ length: 6 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
function dialog(message, action, danger = false) {
  $("#dialog-message").textContent = message; $("#dialog-cancel").hidden = !action; $("#dialog-confirm").textContent = action ? "FORTSÄTT" : "OK"; $("#dialog-confirm").className = `button ${danger ? "button-leave" : "button-primary"}`; $("#app-dialog").hidden = false;
  $("#dialog-cancel").onclick = () => { $("#app-dialog").hidden = true; };
  $("#dialog-confirm").onclick = () => { $("#app-dialog").hidden = true; action?.(); };
}
window.alert = (message) => dialog(String(message));

function save() { localStorage.setItem(storageKey, JSON.stringify(state)); }
function closeHomeAccordions() {
  document.querySelectorAll("[data-accordion]").forEach((section) => { section.classList.remove("is-open"); section.querySelector(".accordion-toggle").setAttribute("aria-expanded", "false"); section.querySelector(".accordion-mark")?.replaceChildren("›"); });
}
function renderRoundResult(correct, card = activeCard(), snapshot = null) {
  let wrongButton = $("#wrong-matches");
  if (!wrongButton) { wrongButton = document.createElement("button"); wrongButton.id = "wrong-matches"; wrongButton.className = "lobby-back wrong-match-button"; wrongButton.type = "button"; wrongButton.textContent = "GÅ TILLBAKA TILL DINA MATCHER"; wrongButton.addEventListener("click", () => { state.roundUnlocked = []; save(); showView("home", true); }); $("#result-back").after(wrongButton); }
  const unlocked = snapshot?.unlocked ?? state.roundUnlocked, locked = snapshot?.locked ?? state.lockedTimeline, guess = snapshot?.guess ?? state.currentGuess ?? {};
  const cards = [...unlocked, { ...card, status: correct ? "OLÅST" : "FELPLACERAT" }];
  $("#result-song").textContent = `${card.title} – ${card.artist} (${card.year})`;
  const answers = document.querySelectorAll(".result-checks .result-check");
  [["artist", "Artist"], ["title", "Låtnamn"]].forEach(([key, label], index) => {
    const right = String(guess[key] || "").toLowerCase() === String(card[key]).toLowerCase();
    answers[index + 1].className = `result-check ${right ? "good" : "bad"}`;
    answers[index + 1].innerHTML = `${right ? "☑" : "✕"} &nbsp; ${right ? "Rätt" : "Fel"} ${label.toLowerCase()}<small>Du skrev: ${guess[key] || "–"}</small>`;
  });
  $("#placement-result").className = `result-check ${correct ? "good" : "bad"}`;
  $("#placement-result").textContent = correct ? "☑  Rätt placering" : "✕  Fel placering";
  const timeline = snapshot?.timeline || [...locked.map((item) => ({ ...item, status: "LÅST" })), ...cards].sort((a, b) => a.year - b.year);
  $("#result-timeline").innerHTML = timeline.map((item) => `<article class="year-card ${item.status === "FELPLACERAT" ? "misplaced-card" : item.status === "LÅST" ? "locked-card" : "unlocked-card"}"><strong>${item.year}</strong><small>${item.title}<br>${item.artist}<br>${item.status}</small></article>`).join("");
  $("#result-continue").hidden = !correct;
  $("#result-lock").hidden = !correct; $("#change-track-area").hidden = !correct;
  $("#result-back").hidden = true; wrongButton.hidden = correct;
  $("#result-lock").textContent = `🔒 LÅS IN ${unlocked.length + (correct ? 1 : 0)} KORT`;
}

function render() {
  $("#player-name").textContent = state.playerName;
  const spotify = supabaseAuth.spotify();
  $("#spotify-status").textContent = spotify ? "Spotify Premium är anslutet." : "Premium krävs för uppspelning.";
  $("#connect-spotify").textContent = spotify ? spotify.name : "ANSLUT DITT SPOTIFY PREMIUM HÄR";
  $("#connect-spotify").className = `button ${spotify ? "button-green" : "button-red"} spotify-button`;
  $("#switch-spotify").hidden = !spotify;
  const waiting = state.matches.filter((match) => match.status === "waiting").length;
  const turns = state.matches.filter((match) => match.status === "active").length;
  $("#waiting-count").textContent = `Väntar på ${waiting}`;
  $("#turn-count").textContent = `Din tur ${turns}`;
  $("#stat-wins").textContent = `${state.stats.wins} st`;
  $("#stat-losses").textContent = `${state.stats.losses} st`;
  $("#stat-walkovers").textContent = `${state.stats.walkovers} st`;
  $("#stat-streak").textContent = `${state.stats.streak} st`;
  $("#change-track-area").innerHTML = state.changeTrackCards ? `<button class="button change-track-button" id="use-change-track" type="button">ANVÄND BYT-LÅT-KORT ${state.changeTrackCards}/3</button>` : `<p class="no-change-cards">Du har inga byt-låt-kort.</p>`;
  $("#change-track-area").style.cssText += ";width:300px;max-width:100%;box-sizing:border-box"; $("#lock-placement").style.cssText += ";width:300px;max-width:100%;box-sizing:border-box";
  const matches = $("#matches");
  const renderCard = (match) => {
    const label = match.status === "active" ? "DIN TUR – ÖPPNA MATCH HÄR" : "VISA MATCH HÄR";
    const players = match.status === "waiting" ? "1 spelare · Omgång 1" : "2 spelare · Omgång 1";
    const lock = match.locked ? "🔒" : "🔓";
    const lockLabel = match.locked ? "Match låst" : "Match olåst";
    return `<article class="match ${match.status}"><button class="match-lock-top ${match.locked ? "is-locked" : "is-unlocked"}" title="${lockLabel}" aria-label="${lockLabel}" type="button">${lock}</button><div class="match-top"><strong>${match.title}</strong></div><small>${players}</small><div class="match-code">MATCHKOD &nbsp; <strong>${match.code}</strong></div><div class="match-footer"><button class="match-open" data-open-match="${match.code}" type="button">● ${label}</button><div class="match-card-actions"><button class="match-icon delete-icon" data-delete-match="${match.code}" title="Lämna match" aria-label="Lämna match" type="button">🗑</button></div></div></article>`;
  };
  const active = state.matches.filter((match) => match.status === "active" || match.status === "opponent");
  const waitingMatches = state.matches.filter((match) => match.status === "waiting");
  matches.innerHTML = state.matches.length ? `
    <h3 class="match-group-title">Pågående matcher</h3>
    ${active.length ? active.map(renderCard).join("") : `<p class="match-empty">Inga pågående matcher.</p>`}
    <h3 class="match-group-title">Väntar på motspelare</h3>
    ${waitingMatches.length ? waitingMatches.map(renderCard).join("") : `<p class="match-empty">Inga matcher väntar på motspelare.</p>`}` : `<p class="muted">Du har inga matcher ännu.</p>`;
  const history = $("#history");
  history.innerHTML = state.history.length ? state.history.map((match) => `<article class="history-match ${match.leaveReason === "DU LÄMNADE INNAN MATCHSTART" ? "early-leave" : "walkover"}"><strong>${match.title}</strong><span>${match.leaveReason}</span></article>`).join("") : `<p class="history-empty">Ingen historik ännu.</p>`;
}

function showView(view, focusMatches = false, fromHistory = false) {
  document.documentElement.classList.remove("booting");
  if (view !== "guess" && view !== "timeline") stopCurrentTrack();
  currentView = view;
  document.querySelectorAll("[data-view-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.viewPanel === view);
  });
  if (!fromHistory) history.pushState({ view }, "", `#${view}`);
  requestAnimationFrame(() => {
    if (focusMatches) $("#my-matches-section").scrollIntoView({ block: "start" });
    else window.scrollTo({ top: 0, left: 0 });
  });
}

function openLobby(matchCode) {
  const match = state.matches.find((item) => item.code === matchCode);
  if (!match) return;
  state.activeMatchCode = matchCode; save();
  $("#lobby-code").textContent = match.code;
  $("#copy-lobby-code").textContent = "KOPIERA KOD";
  $("#copy-lobby-code").classList.remove("is-copied");
  showView("lobby");
}

function openMatch(matchCode) {
  const match = state.matches.find((item) => item.code === matchCode);
  if (!match) return;
  state.activeMatchCode = matchCode; save();
  if (match.status === "waiting") { openLobby(matchCode); return; }
  $("#overview-code").textContent = match.code;
  const isYourTurn = match.status === "active";
  $("#overview-round").textContent = "1";
  $("#turn-message").textContent = isYourTurn ? "DIN TUR" : "VÄNTAR PÅ TESTSPELARE";
  $("#turn-message").classList.toggle("waiting", !isYourTurn);
  $("#next-round").classList.toggle("is-visible", isYourTurn);
  $("#overview-players").innerHTML = `<article class="overview-player ${isYourTurn ? "your-turn" : ""}"><div class="overview-player-header"><span class="turn-order">1</span><strong>${state.playerName}</strong></div><small>1/10 låsta kort · 0 olåsta · 0/3 Byt låt-kort</small><button class="timeline-button show-player-round" type="button">VISA SENASTE SPELADE OMGÅNG</button></article><article class="overview-player"><div class="overview-player-header"><span class="turn-order">2</span><strong>Testspelare</strong></div><small>1/10 låsta kort · 0 olåsta · 0/3 Byt låt-kort</small><button class="timeline-button show-player-round" type="button">VISA SENASTE SPELADE OMGÅNG</button></article>`;
  showView("match");
  if (match.id) loadOverviewPlayers(match.id, isYourTurn);
}
async function loadOverviewPlayers(matchId, isYourTurn) {
  try {
    const players = await supabaseAuth.dataRequest(`online_players?match_id=eq.${matchId}&active=eq.true&select=id,display_name,turn_order,locked_timeline,last_round&order=turn_order`);
    players.forEach((player) => { latestRounds[player.id] = player.last_round; });
    $("#overview-players").innerHTML = players.map((player, index) => `<article class="overview-player ${isYourTurn && index === 0 ? "your-turn" : ""}"><div class="overview-player-header"><span class="turn-order">${player.turn_order + 1}</span><strong>${player.display_name}</strong></div><small>${(player.locked_timeline || []).length}/10 låsta kort · ${player.last_round?.outcome === "locked" ? (player.last_round.cards || []).length : 0} olåsta · 0/3 Byt låt-kort</small><button class="timeline-button show-player-round" data-player-round="${player.id}" type="button">VISA SENASTE SPELADE OMGÅNG</button></article>`).join("");
  } catch { /* matchvyn behåller sin lokala reservvy */ }
}
function showLatestRound(round) {
  if (!round) { dialog("Ingen spelad omgång ännu."); return; }
  viewingLatestRound = true;
  const latestTimeline = (round.timeline || round.cards || []).slice();
  round.timeline = latestTimeline;
  let wrongButton = $("#wrong-matches");
  if (!wrongButton) { wrongButton = document.createElement("button"); wrongButton.id = "wrong-matches"; wrongButton.className = "lobby-back wrong-match-button"; wrongButton.type = "button"; wrongButton.textContent = "← TILL MINA MATCHER"; wrongButton.addEventListener("click", () => showView("home", true)); $("#result-back").after(wrongButton); }
  const wrong = round.outcome === "wrong"; $("#result-back").hidden = false; $("#result-back").textContent = "← Tillbaka"; wrongButton.hidden = true; $("#placement-result").className = `result-check ${wrong ? "bad" : "good"}`; $("#placement-result").textContent = wrong ? "✕  Fel placering" : "☑  Rätt placering";
  $("#result-timeline").innerHTML = (round.timeline || round.cards || []).map((card) => `<article class="year-card ${card.status === "FELPLACERAT" ? "misplaced-card" : card.status === "OLÅST" ? "unlocked-card" : "locked-card"}"><strong>${card.year}</strong><small>${card.title}<br>${card.artist}<br>${card.status || (wrong ? "OLÅST" : "LÅST DENNA OMGÅNG")}</small></article>`).join("");
  $("#result-continue").hidden = true; $("#result-lock").hidden = true; showView("result");
}

function placeCard(position) {
  const card = `<article class="year-card placed-card" id="placed-card"><strong>????</strong><small>HEMLIGT KORT</small></article>`;
  const row = $("#timeline-row");
  row.querySelectorAll(".slot.has-card").forEach((slot) => { slot.classList.remove("has-card"); slot.innerHTML = "PLACERA<br>HÄR"; });
  const slot = row.querySelector(`[data-slot="${position}"]`);
  slot.classList.add("has-card"); slot.innerHTML = card;
  $("#placed-card").dataset.position = position;
  $("#secret-card").classList.add("is-placed");
  $("#change-track-area").hidden = false;
  $("#lock-placement").classList.add("is-visible");
  $("#placed-message").textContent = "";
}
function placementIsCorrect() {
  const cards = [...state.lockedTimeline, ...state.roundUnlocked].sort((a, b) => a.year - b.year);
  const position = Number($("#placed-card")?.dataset.position);
  return (!cards[position - 1] || cards[position - 1].year <= activeCard().year) && (!cards[position] || activeCard().year <= cards[position].year);
}
function resetTurnInput() {
  state.currentGuess = null; $("#guess-artist").value = ""; $("#guess-track").value = ""; $("#secret-card").classList.remove("is-placed"); $("#lock-placement").classList.remove("is-visible"); $("#placed-message").textContent = "";
  const cards = [...state.lockedTimeline.map((card) => ({ ...card, status: "LÅST" })), ...state.roundUnlocked].sort((a, b) => a.year - b.year);
  const slot = (index) => `<div class="slot" data-slot="${index}">PLACERA<br>HÄR</div>`;
  $("#timeline-row").innerHTML = cards.map((card, index) => `${(index === 0 || cards[index - 1].year !== card.year) ? slot(index) : ""}<article class="year-card ${card.status === "OLÅST" ? "unlocked-card" : ""}"><strong>${card.year}</strong><small>${card.title}<br>${card.artist}<br>${card.status}</small></article>`).join("") + slot(cards.length);
}

function addMatch(matchCode) {
  state.matches.unshift({ code: matchCode, title: `${state.playerName}, väntar på motspelare`, status: "waiting" });
  save(); render(); openLobby(matchCode);
}
async function syncMatches() {
  const user = await supabaseAuth.user(supabaseAuth.session()?.access_token);
  const rows = await supabaseAuth.dataRequest(`online_players?user_id=eq.${user.id}&active=eq.true&select=match_id,online_matches(id,code,status,current_user_id)`);
  state.matches = rows.map((row) => { const match = row.online_matches; return !match || match.status === "finished" ? null : { code: match.code, id: match.id, title: match.status === "waiting" ? `${state.playerName}, väntar på motspelare` : `${state.playerName}, motståndare`, status: match.status === "waiting" ? "waiting" : match.current_user_id === user.id ? "active" : "opponent" }; }).filter(Boolean);
  save(); render();
}
function startRealtime() { supabaseAuth.subscribeMatches(() => syncMatches().catch(() => {})); }
async function createOnlineMatch() {
  const user = await supabaseAuth.user(supabaseAuth.session()?.access_token); const matchCode = code();
  const deck = testDeck;
  const matches = await supabaseAuth.dataRequest("online_matches", { code: matchCode, status: "waiting", deck, used_track_ids: ["starter-1983"], target_cards: 10, current_user_id: user.id, phase: "waiting", updated_at: new Date().toISOString() }, "POST");
  await supabaseAuth.dataRequest("online_players", { match_id: matches[0].id, user_id: user.id, display_name: state.playerName, turn_order: 0, locked_timeline: [deck[0]], turn_cards: [], swap_cards: 0, rounds_started: 0, active: true, history_hidden: false, updated_at: new Date().toISOString() }, "POST");
  await syncMatches(); openLobby(matchCode);
}
async function joinOnlineMatch(matchCode) {
  const user = await supabaseAuth.user(supabaseAuth.session()?.access_token);
  const found = await supabaseAuth.dataRequest(`online_matches?code=eq.${matchCode}&select=*`); const match = found[0];
  if (!match || match.status !== "waiting") throw new Error("Matchkoden hittades inte eller matchen är redan startad.");
  const players = await supabaseAuth.dataRequest(`online_players?match_id=eq.${match.id}&select=*`);
  if (players.some((player) => player.user_id === user.id)) throw new Error("Du är redan med i matchen.");
  await supabaseAuth.dataRequest("online_players", { match_id: match.id, user_id: user.id, display_name: state.playerName, turn_order: players.length, locked_timeline: match.deck?.slice(0, 1) || [], turn_cards: [], swap_cards: 0, rounds_started: 0, active: true, history_hidden: false, updated_at: new Date().toISOString() }, "POST");
  await supabaseAuth.dataRequest(`online_matches?id=eq.${match.id}`, { status: "active", phase: "turn_ready", current_user_id: players[0]?.user_id || user.id, updated_at: new Date().toISOString() }, "PATCH");
  await syncMatches();
}

function addTestMatches() {
  state.matches = state.matches.filter((match) => !match.isTest);
  state.matches.push(
    { code: "GRON01", title: `${state.playerName}, Testspelare`, status: "active", locked: false, isTest: true },
    { code: "GUL001", title: `Testspelare, ${state.playerName}`, status: "opponent", locked: true, isTest: true },
    { code: "BLA001", title: `${state.playerName}, väntar på motspelare`, status: "waiting", locked: false, isTest: true }
  );
  save(); render();
}

$("#create-match").addEventListener("click", async () => { try { await createOnlineMatch(); } catch (error) { alert(error.message); } });
$("#join-match").addEventListener("click", async () => {
  const value = $("#match-code").value.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(value)) { $("#match-code").focus(); return; } try { await joinOnlineMatch(value); $("#match-code").value = ""; } catch (error) { alert(error.message); }
});
$("#add-test-matches").addEventListener("click", addTestMatches);
$("#clear-test-matches").addEventListener("click", () => { state.matches = state.matches.filter((match) => !match.isTest); save(); render(); });
$("#matches").addEventListener("click", (event) => {
  const openButton = event.target.closest("[data-open-match]");
  if (openButton) { openMatch(openButton.dataset.openMatch); return; }
  const deleteButton = event.target.closest("[data-delete-match]");
  if (deleteButton) {
    dialog("Vill du verkligen lämna matchen?", async () => { const match = state.matches.find((item) => item.code === deleteButton.dataset.deleteMatch); if (!match) return; try { await supabaseAuth.dataRequest(`online_matches?id=eq.${match.id}`, { status: "finished", updated_at: new Date().toISOString() }, "PATCH"); state.history.unshift({ ...match, leaveReason: match.status === "waiting" ? "DU LÄMNADE INNAN MATCHSTART" : "DU LÄMNADE - WALK OVER" }); await syncMatches(); } catch (error) { alert(error.message); } }, true);
  }
});
$("#copy-lobby-code").addEventListener("click", async () => {
  const value = $("#lobby-code").textContent;
  try { await navigator.clipboard.writeText(value); } catch { /* local file mode can block clipboard */ }
  const button = $("#copy-lobby-code");
  button.textContent = "KOD KOPIERAD";
  button.classList.add("is-copied");
});
$("#lobby-leave").addEventListener("click", () => showView("home"));
$("#next-round").addEventListener("click", async () => { try { await restoreRoundUnlocked(); state.roundUnlocked = []; save(); await dealCard(); } catch (error) { alert(error.message); return; } resetTurnInput(); showView("guess"); startCurrentTrack(); });
$("#overview-players").addEventListener("click", (event) => { const button = event.target.closest(".show-player-round"); if (!button) return; showLatestRound(latestRounds[button.dataset.playerRound]); });
$("#play-sample").addEventListener("click", async () => { try { if (spotifyPlaying) { await spotifyPlayer.pause(); setPlayButton(false); } else if (spotifyPlayer && loadedSpotifyCardId === activeCard().id) { await spotifyPlayer.resume(); setPlayButton(true); } else await playCurrentTrack(); } catch (error) { alert(error.message); } });
$("#replay-track").addEventListener("click", async () => { try { if (spotifyPlayer && loadedSpotifyCardId === activeCard().id) { if (mobileBrowser) await spotifyPlayer.activateElement(); await spotifyPlayer.pause(); await spotifyPlayer.seek(0); await spotifyPlayer.resume(); updateSongTimeline(0, songDuration, true); setPlayButton(true); } else await playCurrentTrack(); } catch (error) { alert(error.message); } });
$("#guess-form").addEventListener("submit", (event) => { event.preventDefault(); state.currentGuess = { artist: $("#guess-artist").value.trim(), title: $("#guess-track").value.trim() }; save(); $("#change-track-area").hidden = false; showView("timeline"); });
$("#skip-guess").addEventListener("click", () => { $("#change-track-area").hidden = false; showView("timeline"); });
let dragTarget = null;
function startDrag(card, event) {
  card.setPointerCapture(event.pointerId);
  card.classList.add("dragging");
  dragTarget = null;
  moveCard(event);
}
$("#secret-card").addEventListener("pointerdown", (event) => startDrag($("#secret-card"), event));
$("#timeline-row").addEventListener("pointerdown", (event) => { const card = event.target.closest(".placed-card"); if (card) startDrag(card, event); });
function moveCard(event) {
  const card = document.querySelector(".dragging");
  card.style.left = `${event.clientX - card.offsetWidth / 2}px`;
  card.style.top = `${event.clientY - card.offsetHeight / 2}px`;
  const timeline = $("#timeline-row"), bounds = timeline.getBoundingClientRect();
  if (event.clientX < bounds.left + 46) timeline.scrollLeft -= 18;
  else if (event.clientX > bounds.right - 46) timeline.scrollLeft += 18;
  document.querySelectorAll("[data-slot]").forEach((slot) => slot.classList.remove("is-target"));
  dragTarget = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-slot]") || null;
  dragTarget?.classList.add("is-target");
}
document.addEventListener("pointermove", (event) => { if (document.querySelector(".dragging")) moveCard(event); });
document.addEventListener("pointerup", () => {
  const card = document.querySelector(".dragging");
  if (!card) return;
  card.classList.remove("dragging");
  card.style.left = ""; card.style.top = "";
  document.querySelectorAll("[data-slot]").forEach((slot) => slot.classList.remove("is-target"));
  if (dragTarget) placeCard(dragTarget.dataset.slot);
  dragTarget = null;
});
async function handoverTurn(savedTimeline = null) {
  const match = state.matches.find((item) => item.code === state.activeMatchCode);
  if (!match?.id) return;
  const user = await supabaseAuth.user(supabaseAuth.session()?.access_token);
  const players = await supabaseAuth.dataRequest(`online_players?match_id=eq.${match.id}&active=eq.true&select=id,user_id,turn_order,locked_timeline&order=turn_order`);
  const mine = players.findIndex((player) => player.user_id === user.id), minePlayer = players[mine], next = players[(mine + 1) % players.length];
  const currentCard = activeCard(), cardsToLock = currentPlacementCorrect ? [...state.roundUnlocked, currentCard] : [];
  const roundCards = currentPlacementCorrect ? cardsToLock.map((card) => ({ ...card, status: "LÅST DENNA OMGÅNG" })) : [...state.roundUnlocked.map((card) => ({ ...card, status: "OLÅST" })), { ...currentCard, status: "FELPLACERAT" }];
  const lastRound = { ended_at: new Date().toISOString(), outcome: currentPlacementCorrect ? "locked" : "wrong", guess: state.currentGuess || {}, cards: roundCards, timeline: savedTimeline || [...(minePlayer.locked_timeline || []).map((card) => ({ ...card, status: "LÅST" })), ...roundCards] };
  await supabaseAuth.dataRequest(`online_players?id=eq.${minePlayer.id}`, { locked_timeline: currentPlacementCorrect ? [...(minePlayer.locked_timeline || []), ...cardsToLock] : minePlayer.locked_timeline, turn_cards: [], current_card: null, last_round: lastRound, updated_at: new Date().toISOString() }, "PATCH");
  await supabaseAuth.dataRequest(`online_matches?id=eq.${match.id}`, { current_user_id: next.user_id, phase: "turn_ready", last_result: { ...lastRound, player_id: user.id }, updated_at: new Date().toISOString() }, "PATCH");
  state.roundUnlocked = []; state.lockedTimeline = currentPlacementCorrect ? [...(minePlayer.locked_timeline || []), ...cardsToLock] : minePlayer.locked_timeline || []; state.currentCard = null; save(); syncMatches().catch(() => {});
}
async function dealCard() {
  const match = state.matches.find((item) => item.code === state.activeMatchCode);
  if (!match?.id) throw new Error("Matchdata saknas.");
  const user = await supabaseAuth.user(supabaseAuth.session()?.access_token);
  const rows = await supabaseAuth.dataRequest(`online_matches?id=eq.${match.id}&select=deck,used_track_ids`);
  const matchData = rows[0], used = new Set(matchData.used_track_ids || []), available = (matchData.deck?.length > 1 ? matchData.deck : testDeck).filter((card) => !used.has(card.id));
  if (!available.length) throw new Error("Alla testlåtar i matchen är använda.");
  const card = available[Math.floor(Math.random() * available.length)];
  await supabaseAuth.dataRequest(`online_matches?id=eq.${match.id}`, { used_track_ids: [...used, card.id], updated_at: new Date().toISOString() }, "PATCH");
  await supabaseAuth.dataRequest(`online_players?match_id=eq.${match.id}&user_id=eq.${user.id}`, { current_card: card, updated_at: new Date().toISOString() }, "PATCH");
  state.currentCard = card; save();
}
async function saveRoundUnlocked() {
  const match = state.matches.find((item) => item.code === state.activeMatchCode);
  if (!match?.id) return;
  const user = await supabaseAuth.user(supabaseAuth.session()?.access_token);
  await supabaseAuth.dataRequest(`online_players?match_id=eq.${match.id}&user_id=eq.${user.id}`, { turn_cards: state.roundUnlocked, updated_at: new Date().toISOString() }, "PATCH");
}
async function restoreRoundUnlocked() {
  const match = state.matches.find((item) => item.code === state.activeMatchCode);
  if (!match?.id) return;
  const user = await supabaseAuth.user(supabaseAuth.session()?.access_token);
  const rows = await supabaseAuth.dataRequest(`online_players?match_id=eq.${match.id}&user_id=eq.${user.id}&select=turn_cards,current_card,locked_timeline`);
  state.roundUnlocked = rows[0]?.turn_cards || [];
  state.lockedTimeline = rows[0]?.locked_timeline || state.lockedTimeline;
  state.currentCard = rows[0]?.current_card || null;
  save(); resetTurnInput();
}
$("#lock-placement").addEventListener("click", async () => { viewingLatestRound = false; const resultCard = activeCard(), placedAt = Number($("#placed-card")?.dataset.position), baseTimeline = [...state.lockedTimeline.map((card) => ({ ...card, status: "LÅST" })), ...state.roundUnlocked.map((card) => ({ ...card, status: "OLÅST" }))].sort((a, b) => a.year - b.year), resultSnapshot = { locked: [...state.lockedTimeline], unlocked: [...state.roundUnlocked], guess: { ...(state.currentGuess || {}) } }; currentPlacementCorrect = placementIsCorrect(); if (!currentPlacementCorrect) { resultSnapshot.timeline = [...baseTimeline]; resultSnapshot.timeline.splice(placedAt, 0, { ...resultCard, status: "FELPLACERAT" }); } stopCurrentTrack(); resultIsLocked = true; $("#result-back").hidden = true; $("#placed-message").textContent = "PLACERING LÅST"; if (!currentPlacementCorrect) { try { await handoverTurn(resultSnapshot.timeline); } catch (error) { alert(error.message); return; } } renderRoundResult(currentPlacementCorrect, resultCard, resultSnapshot); showView("result"); if (!currentPlacementCorrect) dialog("Du placerade kortet på fel plats. Turen har gått över till nästa spelare."); });
$("#result-continue").addEventListener("click", async () => { state.roundUnlocked.push({ ...activeCard(), status: "OLÅST" }); save(); try { await saveRoundUnlocked(); await dealCard(); } catch (error) { alert(error.message); return; } resultIsLocked = false; $("#result-back").hidden = false; resetTurnInput(); showView("guess"); startCurrentTrack(); });
$("#change-track-area").addEventListener("click", async (event) => {
  if (!event.target.closest("#use-change-track")) return;
  try { await dealCard(); } catch (error) { alert(error.message); return; } state.changeTrackCards--; save(); render(); resetTurnInput(); showView("guess"); startCurrentTrack();
});
$("#result-lock").addEventListener("click", async () => {
  try {
    await handoverTurn();
    resultIsLocked = true; $("#result-back").hidden = true; showView("home", true); dialog("Korten är låsta. Turen har gått vidare till nästa spelare.");
  } catch (error) { alert(error.message); }
});
$("#result-back").addEventListener("click", () => { if (viewingLatestRound) { viewingLatestRound = false; showView("match"); } else if (!currentPlacementCorrect) { state.roundUnlocked = []; save(); showView("home", true); } else showView("match"); });
$("#brand-home").addEventListener("click", () => showView(currentView === "welcome" ? "welcome" : "home"));
window.addEventListener("popstate", (event) => {
  if (resultIsLocked && currentView === "result") { history.pushState({ view: "result" }, "", "#result"); return; }
  showView(event.state?.view || "welcome", false, true);
});
$("#reset-history").addEventListener("click", () => dialog("Vill du nollställa all historik?", () => { state.history = []; save(); render(); }, true));
$("#reset-stats").addEventListener("click", () => dialog("Vill du nollställa all statistik?", () => { state.stats = { wins: 0, losses: 0, walkovers: 0, streak: 0 }; save(); render(); }, true));
$("#change-password").addEventListener("click", () => showView("change-password"));
$("#logout").addEventListener("click", () => { supabaseAuth.signOut(); showView("welcome"); });
$("#delete-account").addEventListener("click", () => { $("#delete-confirmation").value = ""; $("#delete-error").hidden = true; $("#delete-modal").hidden = false; $("#delete-confirmation").focus(); });
$("#delete-cancel").addEventListener("click", () => { $("#delete-modal").hidden = true; });
$("#delete-account-form").addEventListener("submit", (event) => {
  event.preventDefault(); const confirmation = $("#delete-confirmation").value;
  if (confirmation !== "RADERA") { $("#delete-error").hidden = false; return; }
  $("#delete-error").hidden = true; $("#delete-progress").hidden = false; $("#delete-submit").disabled = true;
  supabaseAuth.deleteAccount(confirmation).then(() => {
    state.playerName = "Spelare"; state.matches = []; state.history = []; state.stats = { wins: 0, losses: 0, walkovers: 0, streak: 0 };
    save(); supabaseAuth.signOut(); $("#delete-modal").hidden = true; showView("welcome"); alert("Kontot är raderat.");
  }).catch((error) => { $("#delete-error").textContent = error.message; $("#delete-error").hidden = false; }).finally(() => { $("#delete-progress").hidden = true; $("#delete-submit").disabled = false; });
});
$("#forgot-password").addEventListener("click", () => showView("forgot-password"));
$("#forgot-password-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#forgot-progress").hidden = false; $("#forgot-success").hidden = true; $("#forgot-submit").disabled = true;
  try { await supabaseAuth.requestPasswordReset($("#forgot-email").value.trim()); $("#forgot-success").hidden = false; }
  catch (error) { alert(error.message); }
  finally { $("#forgot-progress").hidden = true; $("#forgot-submit").disabled = false; }
});
$("#change-password-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const next = $("#new-password").value;
  if (next !== $("#confirm-password").value) { alert("De nya lösenorden matchar inte."); return; }
  $("#change-progress").hidden = false; $("#change-submit").disabled = true;
  let verified;
  const email = supabaseAuth.session()?.user?.email || $("#player-email").textContent.trim();
  try { verified = await supabaseAuth.verify(email, $("#current-password").value); }
  catch { $("#change-progress").hidden = true; $("#change-submit").disabled = false; alert("Nuvarande lösenord är fel."); return; }
  try { await supabaseAuth.updatePassword(verified.access_token, next, $("#current-password").value); alert("Lösenordet är ändrat."); showView("home"); }
  catch (error) { alert(`Kunde inte spara nytt lösenord: ${error.message}`); }
  finally { $("#change-progress").hidden = true; $("#change-submit").disabled = false; }
});
$("#reset-password-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const next = $("#reset-new-password").value;
  if (next !== $("#reset-confirm-password").value) { alert("De nya lösenorden matchar inte."); return; }
  try { await supabaseAuth.updatePassword(supabaseAuth.session()?.access_token, next); alert("Lösenordet är ändrat."); showView("login"); }
  catch (error) { alert(error.message); }
});
$("#connect-spotify").addEventListener("click", () => supabaseAuth.connectSpotify().catch((error) => alert(error.message)));
$("#switch-spotify").addEventListener("click", () => { supabaseAuth.disconnectSpotify(); render(); supabaseAuth.connectSpotify(true).catch((error) => alert(error.message)); });
document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view, button.classList.contains("lobby-back"))));
document.querySelectorAll("[data-accordion]").forEach((section) => {
  section.querySelector(".accordion-toggle").addEventListener("click", () => {
    const open = section.classList.toggle("is-open");
    section.querySelector(".accordion-toggle").setAttribute("aria-expanded", String(open));
  });
});
$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = $("#login-submit"); if (submit.disabled) return; submit.disabled = true; $("#login-progress").hidden = false;
  try {
    const data = await supabaseAuth.signIn($("#login-email").value.trim(), $("#login-password").value);
    $("#player-email").textContent = data.user.email;
    state.playerName = data.user.user_metadata?.display_name || state.playerName;
    save(); render(); closeHomeAccordions(); showView("home"); startRealtime(); syncMatches().catch(() => {});
  } catch (error) { alert(error.message); }
  finally { submit.disabled = false; $("#login-progress").hidden = true; }
});
$("#signup-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#signup-progress").hidden = false;
  try {
    const name = $("#signup-name").value.trim();
    const email = $("#signup-email").value.trim();
    if (await supabaseAuth.playerNameTaken(name)) { alert("Spelarnamnet är redan registrerat. Välj ett annat spelarnamn."); $("#signup-name").focus(); return; }
    const data = await supabaseAuth.signUp(name, email, $("#signup-password").value);
    state.playerName = name; $("#player-email").textContent = email; save(); render();
    if (data.access_token) { localStorage.setItem("digihits-auth-session", JSON.stringify(data)); startRealtime(); showView("home"); }
    else alert("Nästan klart!\n\nÖppna mejlet vi just skickade och klicka på länken i mejlet. Titta även i skräpposten om mejlet inte syns inom några minuter.");
  } catch (error) { alert(/unique|duplicate|profile/i.test(error.message) ? "Spelarnamnet är redan registrerat. Välj ett annat spelarnamn." : error.message); }
  finally { $("#signup-progress").hidden = true; }
});

render();
$("#timeline-row").after($("#change-track-area"));
$("#change-track-area").after($("#lock-placement"));
$("#change-track-area").classList.add("placement-change-track");
document.querySelectorAll('input[type="password"]').forEach((input) => {
  const wrap = document.createElement("div"); wrap.className = "password-field"; input.before(wrap); wrap.append(input);
  const button = document.createElement("button"); button.type = "button"; button.className = "password-toggle"; button.textContent = "👁"; button.setAttribute("aria-label", "Visa lösenord");
  button.addEventListener("click", () => { const show = input.type === "password"; input.type = show ? "text" : "password"; button.setAttribute("aria-label", show ? "Dölj lösenord" : "Visa lösenord"); }); wrap.append(button);
});
const verification = supabaseAuth.consumeVerification();
if (verification || new URLSearchParams(location.search).get("reset") === "1") {
  if (verification?.type === "recovery" || new URLSearchParams(location.search).get("reset") === "1") showView("reset-password");
  else supabaseAuth.user(verification.session.access_token).then((user) => {
    $("#player-email").textContent = user.email;
    state.playerName = user.user_metadata?.display_name || state.playerName;
    save(); render(); syncMatches().catch(() => {}); startRealtime(); showView("home");
  }).catch(() => showView("login"));
} else if (supabaseAuth.session()?.access_token) {
  supabaseAuth.user(supabaseAuth.session().access_token).then(async (user) => {
    $("#player-email").textContent = user.email; state.playerName = user.user_metadata?.display_name || state.playerName; save(); render();
    await syncMatches(); await restoreRoundUnlocked(); startRealtime();
    try { const spotify = await supabaseAuth.consumeSpotify(); if (spotify) { render(); dialog(`Spotify Premium är anslutet som ${spotify.name}.`); } } catch (error) { alert(error.message); }
    const view = location.hash.slice(1) || "home";
    if (view === "match" && state.activeMatchCode) openMatch(state.activeMatchCode);
    else if (view === "lobby" && state.activeMatchCode) openLobby(state.activeMatchCode);
    else showView(view === "welcome" ? "home" : view, false, true);
  }).catch(() => { supabaseAuth.signOut(); showView("welcome"); });
} else document.documentElement.classList.remove("booting");
