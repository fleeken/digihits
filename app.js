const storageKey = "digihits-home-v1";
const state = JSON.parse(localStorage.getItem(storageKey) || "null") || {
  playerName: "Spelare",
  matches: [],
  history: []
};
state.history ||= [];
state.stats ||= { wins: 0, losses: 0, walkovers: 0, streak: 0 };
state.stats.currentStreak ||= 0;
state.soloStats ||= { bestRounds: null, fewestMistakes: null };
state.soloProgress ||= {};
state.settledResults ||= [];
state.selectedTracks ||= {};
state.recentTrackIds ||= [];
state.changeTrackCards ??= 0;
state.roundUnlocked ||= [];
state.lockedTimeline ||= [{ id: "digi-001", year: 1956, artist: "Elvis Presley", title: "Hound Dog" }];
state.currentCard ||= null;
let currentPlacementCorrect = true;
let viewingLatestRound = false;
const latestRounds = {};
let spotifyPlayer, spotifyDeviceId, spotifyPlayerReady, spotifyPlaying = false, wasPausedByUser = false, pausedForNavigation = false, loadedSpotifyCardId = null, songPosition = 0, songDuration = 0, songTimer, trackStartPromise = null;
const mobileBrowser = /iPhone|iPad|Android/i.test(navigator.userAgent);
const testDeck = [...window.DIGIHITS_TRACKS.reduce((tracks, card) => {
  tracks.set(`${card.artist}:${card.title}`.toLowerCase(), card);
  return tracks;
}, new Map()).values()];
const activeCard = () => state.currentCard || testDeck[5];
function expandedMatchDeck(deck = []) {
  const existing = new Set(deck.map((card) => `${normaliseTrackText(card.artist)}:${normaliseTrackText(card.title)}`));
  return [...deck, ...testDeck.filter((card) => !existing.has(`${normaliseTrackText(card.artist)}:${normaliseTrackText(card.title)}`))];
}
function pickFreshTrack(cards, used = []) {
  const available = cards.filter((card) => !used.includes(card.id));
  const fresh = available.filter((card) => !state.recentTrackIds.includes(card.id));
  const pool = fresh.length ? fresh : available;
  const swedish = pool.filter((card) => card.country === "SE"), international = pool.filter((card) => card.country !== "SE");
  const selection = swedish.length && (Math.random() < 0.3 || !international.length) ? swedish : international.length ? international : pool;
  return selection[Math.floor(Math.random() * selection.length)];
}
function rememberTrack(card) {
  state.recentTrackIds = [card.id, ...state.recentTrackIds.filter((id) => id !== card.id)].slice(0, 6);
}
const songTime = (milliseconds) => `${Math.floor(milliseconds / 60000)}:${String(Math.floor(milliseconds / 1000) % 60).padStart(2, "0")}`;
function resetSpotifyPlayer() { spotifyPlayer?.disconnect?.().catch(() => {}); spotifyPlayer = null; spotifyDeviceId = null; spotifyPlayerReady = null; loadedSpotifyCardId = null; spotifyPlaying = false; wasPausedByUser = false; pausedForNavigation = false; }
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
    spotifyPlayer.addListener("not_ready", resetSpotifyPlayer);
    spotifyPlayer.addListener("player_state_changed", (playerState) => playerState && updateSongTimeline(playerState.position, playerState.duration, !playerState.paused));
    spotifyPlayer.addListener("account_error", ({ message }) => reject(new Error(message)));
    spotifyPlayer.connect();
  });
  return spotifyPlayerReady;
}
const normaliseTrackText = (value) => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const answerText = (value) => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter((word, index) => !(index === 0 && ["the", "a", "an", "en", "ett", "den", "det", "de"].includes(word))).join("");
function editDistance(left, right) { const row = Array.from({ length: right.length + 1 }, (_, index) => index); for (let i = 1; i <= left.length; i += 1) { let previous = row[0]; row[0] = i; for (let j = 1; j <= right.length; j += 1) { const saved = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1)); previous = saved; } } return row[right.length]; }
function closeAnswer(answer, expected) { const left = answerText(answer), right = answerText(expected); if (!left || !right) return false; if (left === right) return true; return editDistance(left, right) <= (right.length <= 5 ? 1 : Math.max(1, Math.floor(right.length * 0.18))); }
const artistAliases = Object.fromEntries(Object.entries({ "The Beatles": ["John Lennon", "Paul McCartney", "George Harrison", "Ringo Starr"], Queen: ["Freddie Mercury"], ABBA: ["Agnetha Fältskog", "Anni-Frid Lyngstad", "Frida"], Roxette: ["Marie Fredriksson", "Per Gessle"], "The Police": ["Sting"], Eagles: ["Don Henley"], Nirvana: ["Kurt Cobain"], Oasis: ["Liam Gallagher", "Noel Gallagher"], Metallica: ["James Hetfield"], Coldplay: ["Chris Martin"], U2: ["Bono"], "The Rolling Stones": ["Mick Jagger", "Keith Richards"], "Fleetwood Mac": ["Stevie Nicks", "Lindsey Buckingham", "Christine McVie"], "Bee Gees": ["Barry Gibb", "Robin Gibb", "Maurice Gibb"], "Destiny's Child": ["Beyoncé", "Beyonce"], "Ace of Base": ["Jenny Berggren", "Linn Berggren", "Ulf Ekberg"], "Gyllene Tider": ["Per Gessle"], Kent: ["Joakim Berg"] }).map(([artist, aliases]) => [answerText(artist), aliases]));
artistAliases[answerText("Jackson 5")] = ["Michael Jackson"];
function artistAnswerMatches(answer, expected) { const aliases = artistAliases[answerText(expected)] || [], parts = String(answer).split(/\s*(?:,|&|\/|\boch\b|\band\b)\s*/i).map((part) => part.trim()).filter(Boolean); if (closeAnswer(answer, expected)) return true; if (parts.length === 1) return aliases.some((alias) => closeAnswer(parts[0], alias)); return parts.length <= 3 && parts.every((part) => aliases.some((alias) => closeAnswer(part, alias))); }
const unsuitableSpotifyVersion = /(cover|karaoke|instrumental|tribute|live|sped up|slowed|nightcore|re-recorded|remix)/i;
async function resolveSpotifyTrack(token, card) {
  const cached = state.selectedTracks[card.id];
  if (cached?.uri) return cached;
  const search = await fetch(`https://api.spotify.com/v1/search?type=track&limit=10&market=SE&q=${encodeURIComponent(`track:${card.title} artist:${card.artist}`)}`, { headers: { Authorization: `Bearer ${token}` } });
  const items = (await search.json()).tracks?.items || [];
  const title = normaliseTrackText(card.title), artist = normaliseTrackText(card.artist);
  const track = items.find((item) => item.type === "track" && item.is_playable !== false && !unsuitableSpotifyVersion.test(`${item.name} ${item.album?.name || ""}`) && normaliseTrackText(item.name).startsWith(title) && item.artists.some((entry) => normaliseTrackText(entry.name) === artist));
  if (!track) throw new Error("Spotify kunde inte verifiera rätt originalversion av låten.");
  const resolved = { uri: track.uri, duration_ms: track.duration_ms };
  state.selectedTracks[card.id] = resolved; save();
  return resolved;
}
async function playCurrentTrack(retry = true) {
  const token = await supabaseAuth.spotifyToken(), card = activeCard(), track = await resolveSpotifyTrack(token, card);
  const device = await ensureSpotifyPlayer(); if (mobileBrowser) await spotifyPlayer.activateElement(); await spotifyPlayer?.pause().catch(() => {}); await spotifyPlayer?.seek(0).catch(() => {});
  const transfer = await fetch("https://api.spotify.com/v1/me/player", { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ device_ids: [device], play: false }) });
  if (!transfer.ok && retry) { resetSpotifyPlayer(); return playCurrentTrack(false); }
  if (!transfer.ok) throw new Error("Spotify kunde inte ansluta spelaren.");
  await new Promise((resolve) => setTimeout(resolve, 180));
  const play = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${device}`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ uris: [track.uri], position_ms: 0 }) });
  if (!play.ok && retry) { resetSpotifyPlayer(); return playCurrentTrack(false); }
  if (!play.ok) throw new Error("Spotify kunde inte starta låten.");
  setTimeout(() => spotifyPlayer?.seek(0).catch(() => {}), 250); setTimeout(() => spotifyPlayer?.seek(0).catch(() => {}), 750);
  loadedSpotifyCardId = card.id; wasPausedByUser = false; pausedForNavigation = false; updateSongTimeline(0, track.duration_ms, true); setPlayButton(true);
}
function setPlayButton(playing) { spotifyPlaying = playing; $("#play-sample").textContent = playing ? "⏸ PAUSA LÅT" : "▶ SPELA LÅT"; $("#play-sample").className = `button ${playing ? "button-secondary" : "button-green"}`; }
function stopCurrentTrack(keepForResume = false) { Promise.resolve(spotifyPlayer?.pause()).catch(() => {}); clearInterval(songTimer); pausedForNavigation = keepForResume && Boolean(state.currentCard && loadedSpotifyCardId); if (!keepForResume) { loadedSpotifyCardId = null; pausedForNavigation = false; } setPlayButton(false); }
function startCurrentTrack() { clearInterval(songTimer); loadedSpotifyCardId = null; wasPausedByUser = false; pausedForNavigation = false; setPlayButton(false); spotifyPlayer?.pause().catch(() => {}); if (!mobileBrowser && supabaseAuth.spotify()) { trackStartPromise = playCurrentTrack().catch(() => {}).finally(() => { trackStartPromise = null; }); } }
function resumeRoundTrack() { if (!pausedForNavigation || !state.currentCard || mobileBrowser) return; if (spotifyPlayer && loadedSpotifyCardId === state.currentCard.id) spotifyPlayer.resume().then(() => { pausedForNavigation = false; setPlayButton(true); }).catch(() => playCurrentTrack().catch(() => {})); else startCurrentTrack(); }

const $ = (selector) => document.querySelector(selector);
$("#guess-form button[type=submit]").textContent = "NÄSTA";
if (document.documentElement.classList.contains("spotify-callback")) $("#spotify-connecting").hidden = false;
let currentView = "welcome";
let resultIsLocked = false;
const code = () => Array.from({ length: 6 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
function dialog(message, action, danger = false, confirmText = "FORTSÄTT") {
  $("#dialog-message").textContent = message; $("#dialog-cancel").hidden = !action; $("#dialog-confirm").textContent = action ? confirmText : "OK"; $("#dialog-confirm").className = `button ${danger ? "button-leave" : "button-primary"}`; $("#app-dialog").hidden = false;
  $("#dialog-cancel").onclick = () => { $("#app-dialog").hidden = true; };
  $("#dialog-confirm").onclick = () => { $("#app-dialog").hidden = true; action?.(); };
}
window.alert = (message) => dialog(String(message));

function save() { localStorage.setItem(storageKey, JSON.stringify(state)); }
function settleResult(match, userId) {
  const result = match.last_result;
  if (result?.type === "solo") return;
  if (!result?.winner_id || state.settledResults.includes(match.id)) return;
  const won = result.winner_id === userId;
  state.stats.wins += won ? 1 : 0; state.stats.losses += won ? 0 : 1; state.stats.walkovers += won && result.type === "walkover" ? 1 : 0; state.stats.currentStreak = won ? state.stats.currentStreak + 1 : 0; state.stats.streak = Math.max(state.stats.streak, state.stats.currentStreak);
  state.settledResults.push(match.id); save();
}
function closeHomeAccordions() {
  document.querySelectorAll("[data-accordion]").forEach((section) => { section.classList.remove("is-open"); section.querySelector(".accordion-toggle").setAttribute("aria-expanded", "false"); section.querySelector(".accordion-mark")?.replaceChildren("›"); });
}
function renderRoundResult(correct, card = activeCard(), snapshot = null) {
  const solo = Boolean(state.matches.find((match) => match.code === state.activeMatchCode)?.solo || String(state.activeMatchCode || "").startsWith("S0"));
  let wrongButton = $("#wrong-matches"), overviewButton = $("#wrong-overview");
  if (!wrongButton) { wrongButton = document.createElement("button"); wrongButton.id = "wrong-matches"; wrongButton.className = "lobby-back wrong-match-button"; wrongButton.type = "button"; wrongButton.textContent = "TILLBAKA TILL DINA MATCHER"; wrongButton.addEventListener("click", () => { state.roundUnlocked = []; save(); showView("home", true); }); $("#result-back").after(wrongButton); }
  if (!overviewButton) { overviewButton = document.createElement("button"); overviewButton.id = "wrong-overview"; overviewButton.className = "lobby-back wrong-match-button"; overviewButton.type = "button"; overviewButton.textContent = "TILL MATCHÖVERSIKT"; overviewButton.addEventListener("click", () => openMatch(state.activeMatchCode)); wrongButton.after(overviewButton); }
  const unlocked = snapshot?.unlocked ?? state.roundUnlocked, locked = snapshot?.locked ?? state.lockedTimeline, guess = snapshot?.guess ?? state.currentGuess ?? {};
  const attempts = state.matches.find((match) => match.code === state.activeMatchCode)?.round || 0;
  const correctCards = locked.length + (correct ? 1 : 0);
  const score = solo ? soloProgress(state.matches.find((match) => match.code === state.activeMatchCode), locked) : null;
  $("#result-code-label").textContent = solo ? "FELPLACERADE KORT" : "MATCHKOD";
  $("#result-code").textContent = solo ? String(score.mistakes) : state.activeMatchCode || "------";
  $("#result-code").style.color = solo ? "#ff8b9d" : "";
  $("#result-code").classList.toggle("solo-mistake-count", solo);
  $("#solo-result-score").hidden = !solo; $("#solo-result-score").innerHTML = `RÄTT PLACERADE KORT: <strong style="color:#72ffad">${score.correct}</strong>`;
  $(".result-actions").classList.toggle("solo-result-actions", solo);
  const cards = [...unlocked, { ...card, status: solo ? (correct ? "RÄTT PLACERAT" : "FEL PLACERAT") : correct ? "OLÅST" : "FELPLACERAT" }];
  $("#result-song").textContent = `${card.title} – ${card.artist} (${card.year})`;
  const answers = document.querySelectorAll(".result-checks .result-check");
  [["artist", "Artist"], ["title", "Låtnamn"]].forEach(([key, label], index) => {
    const right = key === "artist" ? artistAnswerMatches(guess[key], card[key]) : closeAnswer(guess[key], card[key]);
    answers[index + 1].className = `result-check ${right ? "good" : "bad"}`;
    answers[index + 1].innerHTML = `${right ? "☑" : "✕"} &nbsp; ${right ? "Rätt" : "Fel"} ${label.toLowerCase()}<small>Du skrev: ${guess[key] || "–"}</small>`;
  });
  $("#placement-result").className = `result-check ${correct ? "good" : "bad"}`;
  $("#placement-result").textContent = solo ? (correct ? "☑  Rätt placerat" : "✕  Fel placerat") : correct ? "☑  Rätt placering" : "✕  Fel placering";
  const timeline = snapshot?.timeline || [...locked.map((item, index) => ({ ...item, status: index === 0 ? "STARTKORT" : solo ? "RÄTT PLACERAT" : "LÅST" })), ...cards].sort((a, b) => a.year - b.year);
  $("#result-timeline").innerHTML = timeline.map((item) => `<article class="year-card ${item.status === "STARTKORT" ? "locked-card" : /FEL ?PLACERAT/.test(item.status) ? "misplaced-card" : solo ? "correct-card" : item.status === "LÅST" ? "locked-card" : "unlocked-card"}"${item.status === "STARTKORT" ? " style=\"border-color:#58657a;background:#202632\"" : ""}><strong>${item.year}</strong><small><span class="card-song">${item.title}<br>${item.artist}</span><span class="card-status">${item.status}</span></small></article>`).join("");
  $("#result-continue").hidden = !correct && !solo;
  $("#result-lock").hidden = !correct || solo; $("#change-track-area").hidden = !correct || solo;
  const onlyContinue = !$("#result-continue").hidden && $("#result-lock").hidden;
  $(".result-actions").style.gridTemplateColumns = onlyContinue ? "minmax(0,300px)" : "";
  $(".result-actions").style.justifyContent = onlyContinue ? "center" : "";
  $("#result-back").hidden = true; wrongButton.hidden = correct || solo; overviewButton.hidden = correct || solo;
  $("#result-lock").textContent = `🔒 LÅS IN ${unlocked.length + (correct ? 1 : 0)} KORT`;
}

function render() {
  $("#player-name").textContent = state.playerName;
  const spotify = supabaseAuth.spotify();
  $("#spotify-status").textContent = spotify ? "Spotify Premium är anslutet." : "Premium krävs för uppspelning.";
  $("#connect-spotify").textContent = spotify ? spotify.name : "ANSLUT DITT SPOTIFY PREMIUM HÄR";
  $("#connect-spotify").className = `button ${spotify ? "button-green" : "button-red"} spotify-button`;
  $("#switch-spotify").hidden = false;
  const waiting = state.matches.filter((match) => !match.solo && match.status === "opponent").length;
  const turns = state.matches.filter((match) => !match.solo && match.status === "active").length;
  $("#waiting-count").textContent = `Väntar på ${waiting}`;
  $("#turn-count").textContent = `Din tur ${turns}`;
  $("#stat-wins").textContent = `${state.stats.wins} st`;
  $("#stat-losses").textContent = `${state.stats.losses} st`;
  $("#stat-walkovers").textContent = `${state.stats.walkovers} st`;
  $("#stat-streak").textContent = `${state.stats.streak} st`;
  $("#solo-best-rounds").textContent = state.soloStats.bestRounds ? `${state.soloStats.bestRounds} st` : "–";
  $("#solo-fewest-mistakes").textContent = state.soloStats.fewestMistakes ?? "–";
  $("#change-track-area").innerHTML = `<button class="button change-track-button" id="use-change-track" type="button" aria-disabled="${!state.changeTrackCards}">${state.changeTrackCards ? `ANVÄND ETT BYT-LÅT-KORT ${state.changeTrackCards}/3` : "DU HAR INGET BYT-LÅT-KORT 0/3"}</button>`;
  $("#change-track-area").style.cssText += ";width:300px;max-width:100%;box-sizing:border-box"; $("#lock-placement").style.cssText += ";width:300px;max-width:100%;box-sizing:border-box";
  const matches = $("#matches");
  const renderCard = (match) => {
    const label = match.solo ? "ÖPPNA SOLOMATCH HÄR" : match.status === "active" ? "ÖPPNA MATCH HÄR" : "VISA MATCH HÄR";
    const status = match.solo ? "DIN TUR" : match.status === "active" ? "DIN TUR" : match.status === "opponent" ? "MOTSTÅNDARES TUR" : "VÄNTAR PÅ MOTSPELARE";
    const players = `${match.status === "waiting" ? "1" : "2"} spelare · Omgång ${match.round || 1}`;
    const lock = match.locked ? "🔒" : "🔓";
    const lockLabel = match.locked ? "Match låst" : "Match olåst";
    return `<article class="match ${match.solo ? "solo" : match.status}">${match.solo ? "" : `<button class="match-lock-top ${match.locked ? "is-locked" : "is-unlocked"}" title="${lockLabel}" aria-label="${lockLabel}" type="button">${lock}</button>`}<div class="match-top"><strong>${match.title}</strong></div>${match.solo ? "" : `<small>${players}</small><div class="match-status">● ${status}</div><div class="match-code">MATCHKOD &nbsp; <strong>${match.code}</strong></div>`}<div class="match-footer"><button class="match-open" data-open-match="${match.code}" type="button">● ${label}</button><div class="match-card-actions"><button class="match-icon delete-icon" data-delete-match="${match.code}" title="Lämna match" aria-label="Lämna match" type="button">🗑</button></div></div></article>`;
  };
  const soloMatches = state.matches.filter((match) => match.solo);
  const active = state.matches.filter((match) => !match.solo && (match.status === "active" || match.status === "opponent"));
  const waitingMatches = state.matches.filter((match) => !match.solo && match.status === "waiting");
  matches.innerHTML = state.matches.length ? `
    <h3 class="match-group-title">Mina solomatcher</h3>
    ${soloMatches.length ? soloMatches.map(renderCard).join("") : `<p class="match-empty">Du har inga solomatcher.</p>`}
    <h3 class="match-group-title">Mina onlinematcher</h3>
    <h4 class="match-group-title">Pågående matcher</h4>
    ${active.length ? active.map(renderCard).join("") : `<p class="match-empty">Inga pågående matcher.</p>`}
    <h3 class="match-group-title">Väntar på motspelare</h3>
    ${waitingMatches.length ? waitingMatches.map(renderCard).join("") : `<p class="match-empty">Inga matcher väntar på motspelare.</p>`}` : `<p class="muted">Du har inga matcher ännu.</p>`;
  const onlineMatches = state.matches.filter((match) => !match.solo).sort((a, b) => ({ active: 0, opponent: 1, waiting: 2 }[a.status] - { active: 0, opponent: 1, waiting: 2 }[b.status]) || new Date(a.updatedAt || 0) - new Date(b.updatedAt || 0));
  matches.innerHTML = state.matches.length ? `<h3 class="match-group-title">Mina solomatcher</h3>${soloMatches.length ? soloMatches.map(renderCard).join("") : `<p class="match-empty">Du har inga solomatcher.</p>`}<h3 class="match-group-title">Mina onlinematcher</h3>${onlineMatches.length ? onlineMatches.map(renderCard).join("") : `<p class="match-empty">Du har inga onlinematcher.</p>`}` : `<p class="muted">Du har inga matcher än.</p>`;
  const historyCard = (match) => `<article class="history-match ${match.mode === "solo" && match.leaveReason.includes("VINST") ? "solo-win" : match.leaveReason === "DU LÄMNADE INNAN MATCHSTART" ? "early-leave" : "walkover"}"><strong>${match.title}</strong><span>${match.leaveReason}</span></article>`;
  const soloHistory = state.history.filter((match) => match.mode === "solo"), onlineHistory = state.history.filter((match) => match.mode !== "solo");
  const soloHistoryElement = $("#solo-history"), onlineHistoryElement = $("#online-history");
  if (soloHistoryElement && onlineHistoryElement) {
    soloHistoryElement.innerHTML = soloHistory.length ? soloHistory.map(historyCard).join("") : `<p class="history-empty">Inga avslutade solomatcher.</p>`;
    onlineHistoryElement.innerHTML = onlineHistory.length ? onlineHistory.map(historyCard).join("") : `<p class="history-empty">Inga avslutade onlinematcher.</p>`;
  }
}

function showView(view, focusMatches = false, fromHistory = false) {
  document.documentElement.classList.remove("booting");
  const gameView = view === "guess" || view === "timeline";
  if (!gameView) stopCurrentTrack(true);
  if (view === "timeline") { $("#change-track-area").hidden = false; $("#change-track-area").querySelectorAll(".no-change-cards").forEach((element) => element.remove()); }
  currentView = view;
  document.querySelectorAll("[data-view-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.viewPanel === view);
  });
  if (gameView) resumeRoundTrack();
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
  const soloMatch = Boolean(match.solo || String(match.code || "").startsWith("S0") || match.title === "Solomatch");
  state.activeMatchCode = matchCode; save();
  $("#overview-code").textContent = match.solo ? "SOLOMATCH" : match.code;
  $("#overview-code").previousElementSibling.textContent = match.solo ? "SPELTYP" : "MATCHKOD";
  const playersMetric = $("#overview-players-count").parentElement;
  playersMetric.hidden = soloMatch;
  playersMetric.style.display = soloMatch ? "none" : "";
  playersMetric.parentElement.classList.toggle("solo-metrics", soloMatch);
  $("#next-round").nextElementSibling.hidden = match.solo;
  $("#overview-players-count").textContent = match.solo ? "1" : "2";
  const isYourTurn = match.status === "active", isWaiting = match.status === "waiting";
  const score = match.solo ? soloProgress(match) : null;
  $("#overview-round").textContent = match.solo ? String(score.mistakes) : "1";
  $("#overview-round-label").textContent = match.solo ? "FELPLACERADE" : "OMGÅNG";
  $("#overview-target").textContent = match.solo ? String(score.correct) : "10";
  $("#overview-target-label").textContent = match.solo ? "RÄTT PLACERADE" : "FÖRST TILL";
  $("#turn-message").hidden = match.solo;
  $("#turn-message").textContent = isYourTurn ? "DIN TUR" : isWaiting ? "VÄNTAR PÅ MOTSPELARE" : "VÄNTAR PÅ MOTSPELARE";
  $("#turn-message").classList.toggle("waiting", !isYourTurn);
  const pendingRound = state.pendingResult?.matchCode === matchCode || (state.currentCard && (!state.currentCardMatchCode || state.currentCardMatchCode === matchCode));
  $("#next-round").classList.toggle("is-visible", isYourTurn);
  $("#next-round").textContent = pendingRound ? "ÅTERUPPTA OMGÅNG" : "STARTA NÄSTA OMGÅNG";
  $("#overview-players").innerHTML = `<article class="overview-player ${isYourTurn ? "your-turn" : ""}"><div class="overview-player-header"><span class="turn-order">1</span><strong>${state.playerName}</strong></div><small>1/10 låsta kort · 0 olåsta · 0/3 Byt låt-kort</small><button class="timeline-button show-player-round" type="button">VISA SENASTE SPELADE OMGÅNG</button></article>${match.solo ? "" : `<article class="overview-player"><div class="overview-player-header"><span class="turn-order">2</span><strong>Testspelare</strong></div><small>1/10 låsta kort · 0 olåsta · 0/3 Byt låt-kort</small><button class="timeline-button show-player-round" type="button">VISA SENASTE SPELADE OMGÅNG</button></article>`}`;
  showView("match");
  if (match.id) loadOverviewPlayers(match.id, isYourTurn, match.solo);
}
async function loadOverviewPlayers(matchId, isYourTurn, solo = false) {
  try {
    const players = await supabaseAuth.dataRequest(`online_players?match_id=eq.${matchId}&active=eq.true&select=id,display_name,turn_order,locked_timeline,last_round,rounds_started&order=turn_order`);
    $("#overview-players-count").textContent = String(players.length);
    players.forEach((player) => { latestRounds[player.id] = player.last_round; });
    if (solo) {
      const player = players[0] || {};
      const correct = Math.max(1, (player.locked_timeline || []).length);
      const mistakes = Math.max(0, (player.rounds_started || 0) - Math.max(0, correct - 1));
      const match = state.matches.find((item) => item.id === matchId);
      const score = match ? soloProgress(match, player.locked_timeline || []) : { correct, mistakes };
      $("#overview-round").textContent = String(score.mistakes);
      $("#overview-round-label").textContent = "FELPLACERADE";
      $("#overview-target").textContent = String(score.correct);
      $("#overview-target-label").textContent = "RÄTT PLACERADE";
    } else {
      $("#overview-round").textContent = String(Math.max(1, ...players.map((player) => player.rounds_started || 0)));
      $("#overview-round-label").textContent = "OMGÅNG";
      $("#overview-target").textContent = "10";
      $("#overview-target-label").textContent = "FÖRST TILL";
    }
    $("#overview-players").innerHTML = players.map((player, index) => `<article class="overview-player ${isYourTurn && index === 0 ? "your-turn" : ""}"><div class="overview-player-header"><span class="turn-order">${player.turn_order + 1}</span><strong>${player.display_name}</strong></div><small>${(player.locked_timeline || []).length}/10 låsta kort · ${player.last_round?.outcome === "locked" ? (player.last_round.cards || []).length : 0} olåsta · 0/3 Byt låt-kort</small><button class="timeline-button show-player-round" data-player-round="${player.id}" type="button">VISA SENASTE SPELADE OMGÅNG</button></article>`).join("");
  } catch { /* matchvyn behåller sin lokala reservvy */ }
}
function showLatestRound(round) {
  if (!round) { dialog("Ingen spelad omgång ännu."); return; }
  viewingLatestRound = true;
  const playedCard = (round.cards || []).at(-1);
  if (playedCard) $("#result-song").textContent = `${playedCard.title} – ${playedCard.artist} (${playedCard.year})`; const solo = Boolean(state.matches.find((match) => match.code === state.activeMatchCode)?.solo); const attempts = state.matches.find((match) => match.code === state.activeMatchCode)?.round || 0, correctCards = (round.timeline || round.cards || []).filter((card) => !/FEL ?PLACERAT/.test(card.status)).length; $("#result-code-label").textContent = solo ? "FELPLACERADE KORT" : "MATCHKOD"; $("#result-code").textContent = solo ? String(Math.max(0, attempts - Math.max(0, correctCards - 1))) : state.activeMatchCode || "------"; $("#result-code").classList.toggle("solo-mistake-count", solo); $("#solo-result-score").hidden = !solo; $("#solo-result-score").innerHTML = `RÄTT PLACERADE KORT: <strong>${correctCards}</strong>`;
  const latestTimeline = (round.timeline || round.cards || []).slice();
  if (round.outcome !== "wrong") latestTimeline.sort((a, b) => a.year - b.year);
  round.timeline = latestTimeline;
  let wrongButton = $("#wrong-matches");
  if (!wrongButton) { wrongButton = document.createElement("button"); wrongButton.id = "wrong-matches"; wrongButton.className = "lobby-back wrong-match-button"; wrongButton.type = "button"; wrongButton.textContent = "← TILL MINA MATCHER"; wrongButton.addEventListener("click", () => showView("home", true)); $("#result-back").after(wrongButton); }
  const wrong = round.outcome === "wrong"; $("#result-back").hidden = false; $("#result-back").textContent = "← Tillbaka"; wrongButton.hidden = true; $("#placement-result").className = `result-check ${wrong ? "bad" : "good"}`; $("#placement-result").textContent = solo ? (wrong ? "✕  Fel placerat" : "☑  Rätt placerat") : wrong ? "✕  Fel placering" : "☑  Rätt placering";
  const overviewButton = $("#wrong-overview"); if (overviewButton) overviewButton.hidden = true;
  $("#result-timeline").innerHTML = (round.timeline || round.cards || []).map((card) => `<article class="year-card ${card.status === "STARTKORT" ? "locked-card" : /FEL ?PLACERAT/.test(card.status) ? "misplaced-card" : solo ? "correct-card" : card.status === "OLÅST" ? "unlocked-card" : "locked-card"}"${card.status === "STARTKORT" ? " style=\"border-color:#58657a;background:#202632\"" : ""}><strong>${card.year}</strong><small><span class="card-song">${card.title}<br>${card.artist}</span><span class="card-status">${card.status || (wrong ? "OLÅST" : "LÅST DENNA OMGÅNG")}</span></small></article>`).join("");
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
  state.currentGuess = null; $("#guess-artist").value = ""; $("#guess-track").value = ""; $("#secret-card").classList.remove("is-placed"); $("#lock-placement").classList.remove("is-visible"); $("#placed-message").textContent = ""; $("#change-track-area").hidden = false;
  const cards = [...state.lockedTimeline.map((card, index) => ({ ...card, status: index === 0 ? "STARTKORT" : "LÅST" })), ...state.roundUnlocked].sort((a, b) => a.year - b.year);
  const slot = (index) => `<div class="slot" data-slot="${index}">PLACERA<br>HÄR</div>`;
  $("#timeline-row").innerHTML = cards.map((card, index) => `${(index === 0 || cards[index - 1].year !== card.year) ? slot(index) : ""}<article class="year-card ${card.status === "STARTKORT" ? "locked-card" : card.status === "OLÅST" ? "unlocked-card" : ""}"><strong>${card.year}</strong><small><span class="card-song">${card.title}<br>${card.artist}</span><span class="card-status">${card.status}</span></small></article>`).join("") + slot(cards.length);
}

async function updateSwapCards(delta) {
  const match = state.matches.find((item) => item.code === state.activeMatchCode);
  if (!match?.id) return state.changeTrackCards;
  const user = await supabaseAuth.user(supabaseAuth.session()?.access_token);
  const player = (await supabaseAuth.dataRequest("online_players?match_id=eq." + match.id + "&user_id=eq." + user.id + "&select=id,swap_cards"))[0];
  const cards = Math.max(0, Math.min(3, (player?.swap_cards || 0) + delta));
  if (player) await supabaseAuth.dataRequest(`online_players?id=eq.${player.id}`, { swap_cards: cards, updated_at: new Date().toISOString() }, "PATCH");
  state.changeTrackCards = cards; save(); render(); return cards;
}
function hasCorrectSongGuess(card) {
  const guess = state.currentGuess || {};
  return artistAnswerMatches(guess.artist, card.artist) && closeAnswer(guess.title, card.title);
}
function soloProgress(match, locked = state.lockedTimeline) { const code = match?.code || state.activeMatchCode; const fallback = { correct: Math.max(1, locked.length || 0), mistakes: Math.max(0, (match?.round || 0) - Math.max(0, (locked.length || 0) - 1)) }; const saved = state.soloProgress?.[code]; if (!saved || typeof saved !== "object") state.soloProgress[code] = fallback; else { saved.correct = Math.max(1, Number(saved.correct) || fallback.correct); saved.mistakes = Math.max(0, Number(saved.mistakes) || 0); } return state.soloProgress[code]; }
function addMatch(matchCode) {
  state.matches.unshift({ code: matchCode, title: `${state.playerName}, väntar på motspelare`, status: "waiting" });
  save(); render(); openLobby(matchCode);
}
async function syncMatches() {
  const user = await supabaseAuth.user(supabaseAuth.session()?.access_token);
  const rows = await supabaseAuth.dataRequest(`online_players?user_id=eq.${user.id}&active=eq.true&select=match_id,online_matches(id,code,status,phase,current_user_id,last_result,updated_at)`);
  rows.forEach((row) => { if (row.online_matches?.status === "finished") settleResult(row.online_matches, user.id); });
  let players = []; try { const ids = rows.map((row) => row.match_id).join(","); if (ids) players = await supabaseAuth.dataRequest(`online_players?match_id=in.(${ids})&select=match_id,user_id,display_name,rounds_started`); } catch { /* matchlistan fungerar även om namnfrågan nekas */ }
  state.matches = rows.map((row) => { const match = row.online_matches, matchPlayers = players.filter((player) => player.match_id === row.match_id), solo = String(match?.code || "").startsWith("S0") || String(match?.phase || "").startsWith("solo"), opponent = matchPlayers.find((player) => player.user_id !== user.id)?.display_name || "motspelare"; return !match || match.status === "finished" ? null : { code: match.code, id: match.id, title: solo ? "Solomatch" : match.status === "waiting" ? `${state.playerName}, väntar på motspelare` : `${state.playerName}, ${opponent}`, status: match.status === "waiting" ? "waiting" : match.current_user_id === user.id ? "active" : "opponent", solo, locked: match.phase === "locked" || match.phase === "solo_locked", round: Math.max(1, ...matchPlayers.map((player) => player.rounds_started || 0)), updatedAt: match.updated_at }; }).filter(Boolean).sort((a, b) => ({ active: 0, opponent: 1, waiting: 2 }[a.status] - { active: 0, opponent: 1, waiting: 2 }[b.status]) || new Date(a.updatedAt || 0) - new Date(b.updatedAt || 0));
  save(); render();
  const activeMatch = state.matches.find((match) => match.code === state.activeMatchCode);
  if ((currentView === "lobby" || currentView === "match") && activeMatch) openMatch(activeMatch.code);
  if (["guess", "timeline"].includes(currentView) && !resultIsLocked && activeMatch && activeMatch.status !== "active") openMatch(activeMatch.code);
  if (!activeMatch && state.activeMatchCode && ["lobby", "match", "guess", "timeline"].includes(currentView)) showView("home", true);
}
function startRealtime() { supabaseAuth.subscribeMatches(() => syncMatches().catch(() => {})); }
async function refreshActiveRound() {
  if (!["guess", "timeline"].includes(currentView)) return;
  const match = state.matches.find((item) => item.code === state.activeMatchCode && item.status === "active");
  if (!match?.id) return;
  const user = await supabaseAuth.user(supabaseAuth.session()?.access_token);
  const player = (await supabaseAuth.dataRequest(`online_players?match_id=eq.${match.id}&user_id=eq.${user.id}&select=current_card,turn_cards,locked_timeline`))[0];
  if (!player?.current_card) return;
  state.currentCard = player.current_card; state.currentCardMatchCode = match.code; state.roundUnlocked = player.turn_cards || []; state.lockedTimeline = player.locked_timeline || state.lockedTimeline; save();
}
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible" && supabaseAuth.session()?.access_token) {
    if (spotifyPlayer && !(await spotifyPlayer.getCurrentState().catch(() => null))) resetSpotifyPlayer();
    await syncMatches().catch(() => {});
    await refreshActiveRound().catch(() => {});
  }
});
async function createOnlineMatch() {
  const user = await supabaseAuth.user(supabaseAuth.session()?.access_token); const matchCode = code();
  const starter = pickFreshTrack(testDeck), deck = [starter, ...testDeck.filter((card) => card.id !== starter.id)];
  const matches = await supabaseAuth.dataRequest("online_matches", { code: matchCode, status: "waiting", deck, used_track_ids: [starter.id], target_cards: 10, current_user_id: user.id, phase: "waiting", updated_at: new Date().toISOString() }, "POST");
  await supabaseAuth.dataRequest("online_players", { match_id: matches[0].id, user_id: user.id, display_name: state.playerName, turn_order: 0, locked_timeline: [deck[0]], turn_cards: [], swap_cards: 0, rounds_started: 0, active: true, history_hidden: false, updated_at: new Date().toISOString() }, "POST");
  rememberTrack(starter); state.changeTrackCards = 0; save(); await syncMatches(); openMatch(matchCode);
}
async function createSoloMatch() {
  const user = await supabaseAuth.user(supabaseAuth.session()?.access_token), matchCode = `S0${code().slice(2)}`;
  const starter = pickFreshTrack(testDeck), deck = [starter, ...testDeck.filter((card) => card.id !== starter.id)];
  const matches = await supabaseAuth.dataRequest("online_matches", { code: matchCode, status: "active", deck, used_track_ids: [starter.id], target_cards: 10, current_user_id: user.id, phase: "solo", updated_at: new Date().toISOString() }, "POST");
  await supabaseAuth.dataRequest("online_players", { match_id: matches[0].id, user_id: user.id, display_name: state.playerName, turn_order: 0, locked_timeline: [starter], turn_cards: [], swap_cards: 0, rounds_started: 0, active: true, history_hidden: false, updated_at: new Date().toISOString() }, "POST");
  rememberTrack(starter); state.changeTrackCards = 0; state.soloProgress[matchCode] = { correct: 1, mistakes: 0 }; save(); await syncMatches(); openMatch(matchCode);
}
async function joinOnlineMatch(matchCode) {
  const user = await supabaseAuth.user(supabaseAuth.session()?.access_token);
  const found = await supabaseAuth.dataRequest(`online_matches?code=eq.${matchCode}&select=*`); const match = found[0];
  if (!match) throw new Error("Matchkoden hittades inte.");
  if (match.phase === "locked") throw new Error("Matchen är låst eftersom andra omgången redan är påbörjad.");
  if (match.status !== "waiting") throw new Error("Matchkoden hittades inte eller matchen är redan startad.");
  const players = await supabaseAuth.dataRequest(`online_players?match_id=eq.${match.id}&select=*`);
  if (players.some((player) => player.user_id === user.id)) throw new Error("Du är redan med i matchen.");
  const deck = expandedMatchDeck(match.deck || []), available = deck.filter((card) => !(match.used_track_ids || []).includes(card.id));
  if (!available.length) throw new Error("Det finns inget ledigt startkort i matchen.");
  const starter = pickFreshTrack(available);
  await supabaseAuth.dataRequest("online_players", { match_id: match.id, user_id: user.id, display_name: state.playerName, turn_order: players.length, locked_timeline: [starter], turn_cards: [], swap_cards: 0, rounds_started: 0, active: true, history_hidden: false, updated_at: new Date().toISOString() }, "POST");
  await supabaseAuth.dataRequest(`online_matches?id=eq.${match.id}`, { status: "active", phase: "turn_ready", current_user_id: players[0]?.user_id || user.id, deck, used_track_ids: [...(match.used_track_ids || []), starter.id], updated_at: new Date().toISOString() }, "PATCH");
  rememberTrack(starter); state.changeTrackCards = 0; save(); await syncMatches(); openMatch(matchCode);
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
$("#create-solo-match").addEventListener("click", async () => { try { await createSoloMatch(); } catch (error) { alert(error.message); } });
$("#join-match").addEventListener("click", async () => {
  const value = $("#match-code").value.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(value)) { $("#match-code").focus(); return; } try { await joinOnlineMatch(value); $("#match-code").value = ""; } catch (error) { alert(error.message); }
});
$("#matches").addEventListener("click", (event) => {
  const openButton = event.target.closest("[data-open-match]");
  if (openButton) { openMatch(openButton.dataset.openMatch); return; }
  const deleteButton = event.target.closest("[data-delete-match]");
  if (deleteButton) {
    dialog("Vill du verkligen lämna matchen?", async () => { const match = state.matches.find((item) => item.code === deleteButton.dataset.deleteMatch); if (!match) return; try { const user = await supabaseAuth.user(supabaseAuth.session()?.access_token), players = await supabaseAuth.dataRequest(`online_players?match_id=eq.${match.id}&select=user_id`), winner = players.find((player) => player.user_id !== user.id)?.user_id; await supabaseAuth.dataRequest(`online_matches?id=eq.${match.id}`, { status: "finished", last_result: winner ? { winner_id: winner, type: "walkover" } : null, updated_at: new Date().toISOString() }, "PATCH"); state.history.unshift({ ...match, ...(match.solo ? { mode: "solo" } : {}), leaveReason: match.solo ? "RADERAD SOLOMATCH" : match.status === "waiting" ? "DU LÄMNADE INNAN MATCHSTART" : "DU LÄMNADE - WALK OVER" }); await syncMatches(); } catch (error) { alert(error.message); } }, true);
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
window.resumeDigihitsRound = async () => { const button = $("#next-round"); if (button.disabled) return; button.disabled = true; const label = button.textContent; button.textContent = "LADDAR OMGÅNG…"; try { const pending = state.pendingResult; if (pending?.matchCode === state.activeMatchCode) { currentPlacementCorrect = true; resultIsLocked = true; renderRoundResult(true, pending.card, pending.snapshot); showView("result"); return; } await syncMatches(); const match = state.matches.find((item) => item.code === state.activeMatchCode); if (!match || match.status !== "active") throw new Error("Omgången kan inte återupptas just nu."); await restoreRoundUnlocked(); const existingCard = Boolean(state.currentCard); if (!existingCard) { state.roundUnlocked = []; save(); await markRoundStarted(); await dealCard(); } resetTurnInput(); showView("guess"); if (existingCard) { pausedForNavigation = true; resumeRoundTrack(); } else startCurrentTrack(); } catch (error) { alert(error.message); } finally { button.disabled = false; button.textContent = label; } };
$("#next-round").addEventListener("click", window.resumeDigihitsRound);
$("#overview-players").addEventListener("click", (event) => { const button = event.target.closest(".show-player-round"); if (!button) return; showLatestRound(latestRounds[button.dataset.playerRound]); });
$("#play-sample").addEventListener("click", async () => { try { if (trackStartPromise) { await trackStartPromise; return; } if (spotifyPlaying) { await spotifyPlayer.pause(); wasPausedByUser = true; setPlayButton(false); } else { const playerState = await spotifyPlayer?.getCurrentState().catch(() => null), expected = state.selectedTracks[activeCard().id]?.uri, sameTrack = expected && playerState?.track_window?.current_track?.uri === expected; if ((wasPausedByUser || pausedForNavigation) && sameTrack) { await spotifyPlayer.resume(); wasPausedByUser = false; pausedForNavigation = false; setPlayButton(true); } else { trackStartPromise = playCurrentTrack().finally(() => { trackStartPromise = null; }); await trackStartPromise; } } } catch (error) { alert(error.message); } });
$("#replay-track").addEventListener("click", async () => { try { loadedSpotifyCardId = null; await playCurrentTrack(); } catch (error) { alert(error.message); } });
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
  const solo = Boolean(match.solo);
  const user = await supabaseAuth.user(supabaseAuth.session()?.access_token);
  const players = await supabaseAuth.dataRequest(`online_players?match_id=eq.${match.id}&active=eq.true&select=id,user_id,turn_order,locked_timeline,rounds_started,swap_cards&order=turn_order`);
  const mine = players.findIndex((player) => player.user_id === user.id), minePlayer = players[mine], next = players[(mine + 1) % players.length];
  const currentCard = activeCard(), cardsToLock = currentPlacementCorrect ? [...state.roundUnlocked, currentCard] : [], earnedSwapCard = false;
  const target = (await supabaseAuth.dataRequest(`online_matches?id=eq.${match.id}&select=target_cards`))[0]?.target_cards || 10, won = currentPlacementCorrect && (minePlayer.locked_timeline || []).length + cardsToLock.length >= target;
  const roundCards = currentPlacementCorrect ? cardsToLock.map((card) => ({ ...card, status: solo ? "RÄTT PLACERAT" : "LÅST DENNA OMGÅNG" })) : [...state.roundUnlocked.map((card) => ({ ...card, status: solo ? "RÄTT PLACERAT" : "OLÅST" })), { ...currentCard, status: solo ? "FEL PLACERAT" : "FELPLACERAT" }];
  const lastRound = { ended_at: new Date().toISOString(), outcome: won ? "won" : currentPlacementCorrect ? "locked" : "wrong", guess: state.currentGuess || {}, cards: roundCards, timeline: savedTimeline || [...(minePlayer.locked_timeline || []).map((card, index) => ({ ...card, status: index === 0 ? "STARTKORT" : solo ? "RÄTT PLACERAT" : "LÅST" })), ...roundCards] };
  await supabaseAuth.dataRequest(`online_players?id=eq.${minePlayer.id}`, { locked_timeline: currentPlacementCorrect ? [...(minePlayer.locked_timeline || []), ...cardsToLock] : minePlayer.locked_timeline, turn_cards: [], current_card: null, last_round: lastRound, swap_cards: earnedSwapCard ? (minePlayer.swap_cards || 0) + 1 : minePlayer.swap_cards || 0, updated_at: new Date().toISOString() }, "PATCH");
  const lockMatch = match.locked || (minePlayer.rounds_started || 0) >= 2;
  await supabaseAuth.dataRequest(`online_matches?id=eq.${match.id}`, { status: won ? "finished" : "active", current_user_id: won ? null : next.user_id, phase: won ? "finished" : solo ? (lockMatch ? "solo_locked" : "solo") : lockMatch ? "locked" : "turn_ready", last_result: { ...lastRound, player_id: user.id, ...(won ? { winner_id: user.id, type: solo ? "solo" : "win" } : {}) }, updated_at: new Date().toISOString() }, "PATCH");
  if (won && solo) {
    const rounds = Math.max(1, minePlayer.rounds_started || 1);
    const mistakes = Math.max(0, rounds - (target - 1));
    state.soloStats.bestRounds = state.soloStats.bestRounds ? Math.min(state.soloStats.bestRounds, rounds) : rounds;
    state.soloStats.fewestMistakes = state.soloStats.fewestMistakes === null || state.soloStats.fewestMistakes === undefined ? mistakes : Math.min(state.soloStats.fewestMistakes, mistakes);
    state.history.unshift({ title: "Solomatch", mode: "solo", leaveReason: `VINST – ${rounds} OMGÅNGAR` });
  }
  state.roundUnlocked = []; state.lockedTimeline = currentPlacementCorrect ? [...(minePlayer.locked_timeline || []), ...cardsToLock] : minePlayer.locked_timeline || []; state.changeTrackCards = earnedSwapCard ? (minePlayer.swap_cards || 0) + 1 : minePlayer.swap_cards || 0; state.currentCard = null; state.currentCardMatchCode = null; save();
  return { won, earnedSwapCard };
}
async function dealCard() {
  const match = state.matches.find((item) => item.code === state.activeMatchCode);
  if (!match?.id) throw new Error("Matchdata saknas.");
  const user = await supabaseAuth.user(supabaseAuth.session()?.access_token);
  const rows = await supabaseAuth.dataRequest(`online_matches?id=eq.${match.id}&select=deck,used_track_ids`);
  const matchData = rows[0], deck = expandedMatchDeck(matchData.deck || []), used = new Set(matchData.used_track_ids || []), available = deck.filter((card) => !used.has(card.id));
  if (!available.length) throw new Error("Alla testlåtar i matchen är använda.");
  const card = pickFreshTrack(available);
  await supabaseAuth.dataRequest(`online_matches?id=eq.${match.id}`, { deck, used_track_ids: [...used, card.id], updated_at: new Date().toISOString() }, "PATCH");
  await supabaseAuth.dataRequest(`online_players?match_id=eq.${match.id}&user_id=eq.${user.id}`, { current_card: card, updated_at: new Date().toISOString() }, "PATCH");
  state.currentCard = card; state.currentCardMatchCode = match.code; rememberTrack(card); save();
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
  const rows = await supabaseAuth.dataRequest(`online_players?match_id=eq.${match.id}&user_id=eq.${user.id}&select=turn_cards,current_card,locked_timeline,swap_cards,rounds_started`);
  state.roundUnlocked = rows[0]?.turn_cards || [];
  state.lockedTimeline = rows[0]?.locked_timeline || state.lockedTimeline;
  state.currentCard = rows[0]?.current_card || null; state.currentCardMatchCode = state.currentCard ? match.code : null; state.changeTrackCards = rows[0]?.swap_cards || 0; if (match.solo) state.soloProgress[match.code] ||= { correct: state.lockedTimeline.length, mistakes: Math.max(0, (rows[0]?.rounds_started || 0) - Math.max(0, state.lockedTimeline.length - 1)) };
  save(); resetTurnInput();
}
async function markRoundStarted() {
  const match = state.matches.find((item) => item.code === state.activeMatchCode);
  if (!match?.id) return;
  const user = await supabaseAuth.user(supabaseAuth.session()?.access_token);
  const players = await supabaseAuth.dataRequest(`online_players?match_id=eq.${match.id}&user_id=eq.${user.id}&select=id,rounds_started`);
  const player = players[0];
  if (player) { const rounds = (player.rounds_started || 0) + 1; await supabaseAuth.dataRequest(`online_players?id=eq.${player.id}`, { rounds_started: rounds, updated_at: new Date().toISOString() }, "PATCH"); const local = state.matches.find((match) => match.code === state.activeMatchCode); if (local) { local.round = rounds; save(); } }
}
async function restoreResultView() {
  const match = state.matches.find((item) => item.code === state.activeMatchCode);
  if (!match?.id) { showView("home", true); return; }
  if (state.pendingResult?.matchCode === match.code) { currentPlacementCorrect = true; renderRoundResult(true, state.pendingResult.card, state.pendingResult.snapshot); showView("result", false, true); return; }
  const user = await supabaseAuth.user(supabaseAuth.session()?.access_token);
  const player = (await supabaseAuth.dataRequest("online_players?match_id=eq." + match.id + "&user_id=eq." + user.id + "&select=last_round"))[0], round = player?.last_round;
  if (!round) { openMatch(match.code); return; }
  if (round.outcome === "wrong") {
    const card = (round.cards || []).at(-1);
    if (card) { currentPlacementCorrect = false; renderRoundResult(false, card, { timeline: round.timeline, guess: round.guess, unlocked: (round.cards || []).slice(0, -1), locked: [] }); showView("result", false, true); return; }
  }
  showLatestRound(round);
}
$("#lock-placement").addEventListener("click", async () => {
  viewingLatestRound = false;
  const solo = Boolean(state.matches.find((match) => match.code === state.activeMatchCode)?.solo || String(state.activeMatchCode || "").startsWith("S0"));
  const resultCard = activeCard(), placedAt = Number($("#placed-card")?.dataset.position), baseTimeline = [...state.lockedTimeline.map((card, index) => ({ ...card, status: index === 0 ? "STARTKORT" : solo ? "RÄTT PLACERAT" : "LÅST" })), ...state.roundUnlocked.map((card) => ({ ...card, status: solo ? "RÄTT PLACERAT" : "OLÅST" }))].sort((a, b) => a.year - b.year), resultSnapshot = { locked: [...state.lockedTimeline], unlocked: [...state.roundUnlocked], guess: { ...(state.currentGuess || {}) } };
  currentPlacementCorrect = placementIsCorrect();
  if (solo) { const score = soloProgress(state.matches.find((match) => match.code === state.activeMatchCode)); currentPlacementCorrect ? score.correct += 1 : score.mistakes += 1; save(); }
  let earnedSwapCard = false;
  if (hasCorrectSongGuess(resultCard) && state.changeTrackCards < 3) {
    try { await updateSwapCards(1); earnedSwapCard = true; } catch (error) { alert(error.message); return; }
  }
  if (!currentPlacementCorrect) { resultSnapshot.timeline = [...baseTimeline]; resultSnapshot.timeline.splice(placedAt, 0, { ...resultCard, status: solo ? "FEL PLACERAT" : "FELPLACERAT" }); }
  else if (!solo) { state.pendingResult = { matchCode: state.activeMatchCode, card: resultCard, snapshot: resultSnapshot }; save(); }
  stopCurrentTrack(); resultIsLocked = true; $("#result-back").hidden = true;
  let soloOutcome;
  if (!currentPlacementCorrect || solo) { try { soloOutcome = await handoverTurn(currentPlacementCorrect ? null : resultSnapshot.timeline); } catch (error) { alert(error.message); return; } }
  renderRoundResult(currentPlacementCorrect, resultCard, resultSnapshot); showView("result");
  if (soloOutcome?.won) $("#result-continue").hidden = true;
  if (earnedSwapCard) dialog(solo ? "Grattis, du vann ett byt-låt-kort eftersom du gissade rätt för både artist och låtnamn! Byt-låt-kort påverkar inte antalet genomförda omgångar." : "Grattis, du vann ett byt-låt-kort eftersom du gissade rätt för både artist och låtnamn!");
  else if (!currentPlacementCorrect && !solo) dialog("Du placerade kortet på fel plats. Turen har gått över till nästa spelare.");
});
$("#result-continue").addEventListener("click", async () => { const solo = Boolean(state.matches.find((match) => match.code === state.activeMatchCode)?.solo); state.pendingResult = null; if (!solo) state.roundUnlocked.push({ ...activeCard(), status: "OLÅST" }); save(); try { if (solo) await markRoundStarted(); else await saveRoundUnlocked(); await dealCard(); } catch (error) { alert(error.message); return; } resultIsLocked = false; $("#result-back").hidden = false; resetTurnInput(); showView("guess"); startCurrentTrack(); });
$("#change-track-area").addEventListener("click", async (event) => {
  if (!event.target.closest("#use-change-track")) return;
  if (!state.changeTrackCards) { dialog("Du har inga byt-låt-kort."); return; }
  dialog("Är du säker på att du vill använda ett av dina byt-låt-kort?", async () => { try { await dealCard(); await updateSwapCards(-1); } catch (error) { alert(error.message); return; } resetTurnInput(); showView("guess"); startCurrentTrack(); }, false, "ANVÄND BYT-LÅT-KORT");
});
$("#result-lock").addEventListener("click", async () => {
  try {
    if (String(state.activeMatchCode || "").startsWith("S0")) return;
    state.pendingResult = null; save(); const outcome = await handoverTurn();
    resultIsLocked = true; $("#result-back").hidden = true; showView("home", true); dialog(outcome.earnedSwapCard ? "Grattis, du vann ett byt-låt-kort eftersom du gissade rätt för både artist och låtnamn!" : outcome.won ? "Du vann matchen!" : "Korten är låsta. Turen har gått vidare till nästa spelare.");
  } catch (error) { alert(error.message); }
});
$("#result-back").addEventListener("click", () => { if (viewingLatestRound) { viewingLatestRound = false; showView("match"); } else if (!currentPlacementCorrect) { state.roundUnlocked = []; save(); showView("home", true); } else showView("match"); });
$("#brand-home").addEventListener("click", () => showView(currentView === "welcome" ? "welcome" : "home"));
$("#install-app").addEventListener("click", () => dialog("I Safari: tryck på Dela-knappen längst ned, välj Lägg till på hemskärmen och bekräfta."));
window.addEventListener("popstate", (event) => {
  if (resultIsLocked && currentView === "result") { history.pushState({ view: "result" }, "", "#result"); return; }
  showView(event.state?.view || "welcome", false, true);
});
$("#reset-solo-stats")?.addEventListener("click", () => dialog("Nollställ statistik för solomatcher?", () => { state.soloStats = { bestRounds: null, fewestMistakes: null }; save(); render(); }, true, "NOLLSTÄLL"));
$("#reset-online-stats")?.addEventListener("click", () => dialog("Nollställ statistik för onlinematcher?", () => { state.stats = { wins: 0, losses: 0, walkovers: 0, streak: 0, currentStreak: 0 }; save(); render(); }, true, "NOLLSTÄLL"));
$("#reset-solo-history")?.addEventListener("click", () => dialog("Nollställ avslutade solomatcher?", () => { state.history = state.history.filter((match) => match.mode !== "solo"); save(); render(); }, true, "NOLLSTÄLL"));
$("#reset-online-history")?.addEventListener("click", () => dialog("Nollställ avslutade onlinematcher?", () => { state.history = state.history.filter((match) => match.mode === "solo"); save(); render(); }, true, "NOLLSTÄLL"));
$("#change-password").addEventListener("click", () => showView("change-password"));
$("#logout").addEventListener("click", () => { supabaseAuth.signOut(); showView("welcome"); });
$("#delete-account").addEventListener("click", () => { $("#delete-confirmation").value = ""; $("#delete-error").hidden = true; $("#delete-modal").hidden = false; $("#delete-confirmation").focus(); });
$("#delete-cancel").addEventListener("click", () => { $("#delete-modal").hidden = true; });
$("#delete-account-form").addEventListener("submit", (event) => {
  event.preventDefault(); const confirmation = $("#delete-confirmation").value;
  if (confirmation !== "RADERA") { $("#delete-error").hidden = false; return; }
  $("#delete-error").hidden = true; $("#delete-progress").hidden = false; $("#delete-submit").disabled = true;
  supabaseAuth.deleteAccount(confirmation).then(() => {
    state.playerName = "Spelare"; state.matches = []; state.history = []; state.stats = { wins: 0, losses: 0, walkovers: 0, streak: 0 }; state.soloStats = { bestRounds: null, fewestMistakes: null };
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
    else if (view === "result" && state.activeMatchCode) await restoreResultView();
    else showView(view === "welcome" ? "home" : view, false, true);
  }).catch(() => { supabaseAuth.signOut(); showView("welcome"); });
} else document.documentElement.classList.remove("booting");
