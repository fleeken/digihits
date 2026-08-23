const storageKey = "digihits-home-v1";
const state = JSON.parse(localStorage.getItem(storageKey) || "null") || {
  playerName: "Spelare",
  matches: [],
  history: []
};
state.history ||= [];
state.matches = state.matches.filter((match) => !match.isTest);
state.stats ||= { wins: 0, losses: 0, walkovers: 0, streak: 0 };
state.stats.currentStreak ||= 0;
state.soloStats ||= { bestRounds: null, fewestMistakes: null };
state.soloProgress ||= {};
state.settledResults ||= [];
state.archivedResults ||= [];
state.selfWalkovers ||= [];
state.selectedTracks ||= {};
state.recentTrackIds ||= [];
state.changeTrackCards ??= 0;
state.roundUnlocked ||= [];
state.lockedTimeline ||= [{ id: "digi-001", year: 1956, artist: "Elvis Presley", title: "Hound Dog" }];
state.currentCard ||= null;
state.guessDraft ||= null;
state.guessFinalized ||= null;
state.placementDraft ||= null;
state.chatUnread ||= {};
state.chatMatchCode ||= null;
state.friends ||= [];
state.friendRequests ||= [];
state.friendNotifications ||= [];
state.blocks ||= [];
state.friendInvites ||= [];
state.sentMatchInvites ||= [];
state.friendChatId ||= null;
state.friendChatUnread ||= {};
state.sentFriendRequests ||= [];
state.pushNotificationsEnabled ??= false;
state.seenTurnNotices ||= {};
let currentPlacementCorrect = true, roundLoading = false;
let viewingLatestRound = false, viewingHistoryResult = false, returnToFinalResult = false, historyResultEntry = null, historyResultRounds = 0, historyPlayerScores = {};
const latestRounds = {};
let spotifyPlayer, spotifyDeviceId, spotifyPlayerReady, spotifyPlaying = false, wasPausedByUser = false, pausedForNavigation = false, loadedSpotifyCardId = null, songPosition = 0, songDuration = 0, songTimer, trackStartPromise = null, songStarting = false;
const mobileBrowser = /iPhone|iPad|Android/i.test(navigator.userAgent);
const testDeck = [...window.DIGIHITS_TRACKS.reduce((tracks, card) => {
  tracks.set(`${card.artist}:${card.title}`.toLowerCase(), card);
  return tracks;
}, new Map()).values()];
const activeCard = () => state.currentCard || testDeck[5];
// Enda källan för matchtyp: S0 är reserverat för solomatcher.
// Därmed kan en onlinematch aldrig hamna i solo-flöde eller solostatistik.
const isSoloMatch = (match) => String(match?.code || "").startsWith("S0");
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
  state.recentTrackIds = [card.id, ...state.recentTrackIds.filter((id) => id !== card.id)].slice(0, 30);
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
    if (!window.Spotify) await new Promise((ready, fail) => { window.addEventListener("digihits-spotify-ready", ready, { once: true }); setTimeout(() => fail(new Error("Spotify-spelaren kunde inte laddas.")), 10000); });
    spotifyPlayer = new window.Spotify.Player({ name: "Digihits", getOAuthToken: (callback) => supabaseAuth.spotifyToken().then(callback).catch(() => callback("")), volume: 0.7 });
    const player = spotifyPlayer, isCurrentPlayer = () => spotifyPlayer === player;
    const playerFailure = ({ message }) => { if (!isCurrentPlayer()) return; spotifyPlaying = false; setPlayButton(false); reject(new Error(message || "Spotify-spelaren tappade anslutningen.")); };
    player.addListener("ready", ({ device_id }) => { if (!isCurrentPlayer()) return; spotifyDeviceId = device_id; resolve(device_id); });
    player.addListener("not_ready", () => { if (!isCurrentPlayer()) return; spotifyDeviceId = null; spotifyPlaying = false; setPlayButton(false); });
    player.addListener("player_state_changed", (playerState) => { if (isCurrentPlayer() && playerState && loadedSpotifyCardId === state.currentCard?.id) { updateSongTimeline(playerState.position, playerState.duration, !playerState.paused); setPlayButton(!playerState.paused); } });
    player.addListener("initialization_error", playerFailure);
    player.addListener("authentication_error", playerFailure);
    player.addListener("account_error", playerFailure);
    player.addListener("playback_error", ({ message }) => { if (!isCurrentPlayer()) return; spotifyPlaying = false; setPlayButton(false); console.warn("Spotify playback:", message); });
    player.connect();
  });
  try { return await spotifyPlayerReady; }
  catch (error) { resetSpotifyPlayer(); throw error; }
}
const normaliseTrackText = (value) => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const answerText = (value) => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter((word) => !["the", "a", "an", "en", "ett", "den", "det", "de", "and", "och"].includes(word)).join("");
function editDistance(left, right) { const row = Array.from({ length: right.length + 1 }, (_, index) => index); for (let i = 1; i <= left.length; i += 1) { let previous = row[0]; row[0] = i; for (let j = 1; j <= right.length; j += 1) { const saved = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1)); previous = saved; } } return row[right.length]; }
function oneTranspositionAway(left, right) { if (left.length !== right.length) return false; const index = [...left].findIndex((letter, i) => letter !== right[i]); return index >= 0 && left[index] === right[index + 1] && left[index + 1] === right[index] && left.slice(index + 2) === right.slice(index + 2); }
function closeAnswer(answer, expected) { const left = answerText(answer), right = answerText(expected); if (!left || !right) return false; if (left === right || oneTranspositionAway(left, right)) return true; return editDistance(left, right) <= (right.length <= 5 ? 1 : Math.max(1, Math.floor(right.length * 0.18))); }
function titleAnswerMatches(answer, expected) { const mainTitle = String(expected).replace(/\s*\([^)]*\)/g, "").trim(); return closeAnswer(answer, expected) || (mainTitle !== String(expected).trim() && closeAnswer(answer, mainTitle)); }
const artistAliases = Object.fromEntries(Object.entries({ "The Beatles": ["John Lennon", "Paul McCartney", "George Harrison", "Ringo Starr"], Queen: ["Freddie Mercury"], ABBA: ["Agnetha Fältskog", "Anni-Frid Lyngstad", "Frida"], Roxette: ["Marie Fredriksson", "Per Gessle"], "The Police": ["Sting"], Eagles: ["Don Henley"], Nirvana: ["Kurt Cobain"], Oasis: ["Liam Gallagher", "Noel Gallagher"], Metallica: ["James Hetfield"], Coldplay: ["Chris Martin"], U2: ["Bono"], "The Rolling Stones": ["Mick Jagger", "Keith Richards"], "Fleetwood Mac": ["Stevie Nicks", "Lindsey Buckingham", "Christine McVie"], "Bee Gees": ["Barry Gibb", "Robin Gibb", "Maurice Gibb"], "Destiny's Child": ["Beyoncé", "Beyonce"], "Ace of Base": ["Jenny Berggren", "Linn Berggren", "Ulf Ekberg"], "Gyllene Tider": ["Per Gessle"], Kent: ["Joakim Berg"] }).map(([artist, aliases]) => [answerText(artist), aliases]));
artistAliases[answerText("Jackson 5")] = ["Michael Jackson"];
function artistAnswerMatches(answer, expected) { const cleanAnswer = String(answer || "").trim(); if (!cleanAnswer) return false; const aliases = artistAliases[answerText(expected)] || [], parts = cleanAnswer.split(/\s*(?:,|&|\/|\boch\b|\band\b)\s*/i).map((part) => part.trim()).filter(Boolean), expectedParts = String(expected).split(/\s*(?:,|&|\/|\boch\b|\band\b)\s*/i).map((part) => part.trim()).filter((part) => answerText(part).length >= 4), lastName = (value) => String(value).trim().split(/\s+/).at(-1); if (closeAnswer(cleanAnswer, expected) || closeAnswer(cleanAnswer, lastName(expected)) || expectedParts.some((part) => closeAnswer(cleanAnswer, part) || closeAnswer(cleanAnswer, lastName(part)))) return true; if (parts.length === 1) return aliases.some((alias) => closeAnswer(parts[0], alias) || closeAnswer(parts[0], lastName(alias))); return parts.length > 0 && parts.length <= 3 && parts.every((part) => aliases.some((alias) => closeAnswer(part, alias) || closeAnswer(part, lastName(alias)))); }
function soloResultStats(correct, mistakes, rounds) { return `<span>RÄTT PLACERADE KORT: <strong class="solo-correct">${correct}/10</strong></span><span>FELPLACERADE KORT: <strong class="solo-mistakes">${mistakes}</strong></span><span>${rounds === 1 ? "OMGÅNG" : "OMGÅNGAR"}: <strong class="solo-rounds">${rounds}</strong></span>`; }
function completeSongGuess(guess, card) { const artist = String(guess?.artist || "").trim(), title = String(guess?.title || "").trim(); return Boolean(artist && title && ((artistAnswerMatches(artist, card.artist) && titleAnswerMatches(title, card.title)) || (artistAnswerMatches(title, card.artist) && titleAnswerMatches(artist, card.title)))); }
function renderGuessChecks(card, guess = {}) { const answers = document.querySelectorAll(".result-checks .result-check"), fullAnswer = completeSongGuess(guess, card); [["artist", "Artist"], ["title", "Låtnamn"]].forEach(([key, label], index) => { const right = fullAnswer || (key === "artist" ? artistAnswerMatches(guess[key], card[key]) : titleAnswerMatches(guess[key], card[key])); answers[index + 1].className = `result-check ${right ? "good" : "bad"}`; answers[index + 1].innerHTML = `${right ? "☑" : "✕"} &nbsp; ${right ? "Rätt" : "Fel"} ${label.toLowerCase()}<small>Du skrev: ${guess[key] || "–"}</small>`; }); }
const unsuitableSpotifyVersion = /(cover|karaoke|instrumental|tribute|live|sped up|slowed|nightcore|re-recorded|remix)/i;
async function resolveSpotifyTrack(token, card) {
  const cached = state.selectedTracks[card.id];
  if (cached?.uri) return cached;
  const search = await fetch(`https://api.spotify.com/v1/search?type=track&limit=10&market=SE&q=${encodeURIComponent(`${card.title} ${card.artist}`)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!search.ok) { const error = new Error("Spotify kunde inte söka efter låten."); error.code = "SPOTIFY_SEARCH"; throw error; }
  const items = (await search.json()).tracks?.items || [];
  const title = normaliseTrackText(card.title), artist = normaliseTrackText(card.artist);
  const usable = items.filter((item) => item.type === "track" && item.is_playable !== false && !unsuitableSpotifyVersion.test(`${item.name} ${item.album?.name || ""}`));
  const titleMatch = (item) => { const value = normaliseTrackText(item.name); return value === title || value.startsWith(title) || title.startsWith(value); };
  const artistMatch = (item) => item.artists.some((entry) => { const value = normaliseTrackText(entry.name); return value === artist || value.includes(artist) || artist.includes(value); });
  const track = usable.find((item) => titleMatch(item) && artistMatch(item));
  if (!track) { const error = new Error("Spotify kunde inte verifiera rätt originalversion av låten."); error.code = "TRACK_NOT_FOUND"; throw error; }
  const resolved = { uri: track.uri, duration_ms: track.duration_ms };
  state.selectedTracks[card.id] = resolved; save();
  return resolved;
}
async function playableSpotifyTrack(token, replacements = 0) {
  try { return await resolveSpotifyTrack(token, activeCard()); }
  catch (error) {
    if (error?.code !== "TRACK_NOT_FOUND" || replacements >= 50) throw error;
    await dealCard();
    return playableSpotifyTrack(token, replacements + 1);
  }
}
async function playCurrentTrack(retry = true) {
  songStarting = true;
  $("#play-sample").textContent = "LÅTEN STARTAR…"; $("#play-sample").className = "button button-green";
  updateSongTimeline(0, songDuration, false);
  const token = await supabaseAuth.spotifyToken(), track = await playableSpotifyTrack(token), card = activeCard();
  const device = await ensureSpotifyPlayer(); if (mobileBrowser) await spotifyPlayer.activateElement(); await spotifyPlayer?.pause().catch(() => {}); await spotifyPlayer?.seek(0).catch(() => {});
  const transfer = await fetch("https://api.spotify.com/v1/me/player", { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ device_ids: [device], play: false }) });
  if (!transfer.ok && retry) { resetSpotifyPlayer(); return playCurrentTrack(false); }
  if (!transfer.ok) throw new Error("Spotify kunde inte ansluta spelaren.");
  await new Promise((resolve) => setTimeout(resolve, 180));
  const play = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${device}`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ uris: [track.uri], position_ms: 0 }) });
  if (!play.ok && retry) { resetSpotifyPlayer(); return playCurrentTrack(false); }
  if (!play.ok) throw new Error("Spotify kunde inte starta låten.");
  await new Promise((resolve) => setTimeout(resolve, 700));
  const rewind = await spotifyPlayer?.seek(0).catch(() => false);
  await new Promise((resolve) => setTimeout(resolve, 250));
  const playback = await spotifyPlayer?.getCurrentState().catch(() => null), playingRequestedTrack = playback && !playback.paused && playback.track_window?.current_track?.uri === track.uri && playback.position < 2500;
  if ((!rewind || !playingRequestedTrack) && retry) { resetSpotifyPlayer(); return playCurrentTrack(false); }
  if (!rewind || !playingRequestedTrack) throw new Error("Spotify kunde inte starta låten från början.");
  loadedSpotifyCardId = card.id; wasPausedByUser = false; pausedForNavigation = false; songStarting = false; updateSongTimeline(0, track.duration_ms, true); setPlayButton(true);
}
function setPlayButton(playing) { if (!playing && songStarting) return; spotifyPlaying = playing; $("#play-sample").textContent = playing ? "⏸ PAUSA LÅT" : "▶ SPELA LÅT"; $("#play-sample").className = `button ${playing ? "button-secondary" : "button-green"}`; }
function stopCurrentTrack(keepForResume = false) { Promise.resolve(spotifyPlayer?.pause()).catch(() => {}); clearInterval(songTimer); pausedForNavigation = keepForResume && Boolean(state.currentCard && loadedSpotifyCardId); if (!keepForResume) { loadedSpotifyCardId = null; pausedForNavigation = false; } setPlayButton(false); }
function startCurrentTrack() { clearInterval(songTimer); loadedSpotifyCardId = null; songPosition = 0; songDuration = 0; $("#song-timeline").hidden = true; wasPausedByUser = false; pausedForNavigation = false; songStarting = false; setPlayButton(false); spotifyPlayer?.pause().catch(() => {}); if (!mobileBrowser && supabaseAuth.spotify()) { trackStartPromise = playCurrentTrack().catch(() => { songStarting = false; setPlayButton(false); }).finally(() => { trackStartPromise = null; }); } }
function resumeRoundTrack() { if (!pausedForNavigation || !state.currentCard || mobileBrowser) return; if (spotifyPlayer && loadedSpotifyCardId === state.currentCard.id) spotifyPlayer.resume().then(() => { pausedForNavigation = false; setPlayButton(true); }).catch(() => playCurrentTrack().catch(() => {})); else startCurrentTrack(); }

const $ = (selector) => document.querySelector(selector);
$("#guess-form button[type=submit]").textContent = "SPARA & VIDARE TILL TIDSLINJEN";
if (document.documentElement.classList.contains("spotify-callback")) $("#spotify-connecting").hidden = false;
let currentView = "welcome", chatPoll = 0, realtimeFallbackPoll = 0, realtimeRefreshing = false;
let resultIsLocked = false;
const code = () => Array.from({ length: 6 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
function dialog(message, action, danger = false, confirmText = "FORTSÄTT", cancelText = "AVBRYT") {
  $("#dialog-message").textContent = message; $("#dialog-cancel").hidden = !action; $("#dialog-cancel").textContent = cancelText; $("#dialog-confirm").textContent = action ? confirmText : "OK"; $("#dialog-confirm").className = `button ${danger ? "button-leave" : "button-primary"}`; $("#app-dialog").hidden = false;
  $("#dialog-cancel").onclick = () => { $("#app-dialog").hidden = true; };
  $("#dialog-confirm").onclick = () => { $("#app-dialog").hidden = true; action?.(); };
}
function dialogProgress(message) { const progress = document.createElement("div"); progress.id = "dialog-progress"; progress.className = "dialog-progress"; progress.innerHTML = "<i></i>"; $("#dialog-message").textContent = message; $("#dialog-message").after(progress); $("#dialog-cancel").hidden = true; $("#dialog-confirm").hidden = true; $("#app-dialog").hidden = false; }
function closeDialogProgress() { $("#dialog-progress")?.remove(); $("#dialog-confirm").hidden = false; $("#app-dialog").hidden = true; }
window.alert = (message) => dialog(String(message));

function save() { localStorage.setItem(storageKey, JSON.stringify(state)); }
function showTurnNotice(match) {
  const notice = match?.turnNotice;
  if (!notice?.type) return;
  const noticeId = `${match.id}:${notice.issued_at || notice.type}`;
  if (state.seenTurnNotices[noticeId]) return;
  state.seenTurnNotices[noticeId] = true; save();
  const opponent = notice.opponent_name || "din motspelare", code = notice.match_code || match.code;
  const message = notice.type === "timeout"
    ? `Du har varit inaktiv i matchen mot ${opponent} med matchkod ${code} i 72 timmar. Turen går nu automatiskt över till nästa spelare.`
    : `Det har gått 48 timmar sedan du spelade i matchen mot ${opponent} med matchkod ${code}. Efter ytterligare 24 timmars inaktivitet i denna match går turen automatiskt över till nästa spelare.`;
  dialog(message);
}
async function showHistoryResult(entry) {
  viewingHistoryResult = true; returnToFinalResult = false; historyResultEntry = entry; state.activeMatchCode = entry.code;
  let players = entry.players || [];
  try { players = await supabaseAuth.dataRequest(`online_players?match_id=eq.${entry.id}&select=id,user_id,display_name,locked_timeline,last_round,rounds_started&order=turn_order`); } catch { /* sparad reservdata används */ }
  let summary = $("#final-match-overview");
  if (!summary) { summary = document.createElement("section"); summary.id = "final-match-overview"; summary.className = "final-match-overview"; $(".result-match-code").before(summary); }
  const winner = players.find((player) => String(player.user_id) === String(entry.result?.winner_id))?.display_name || "Vinnaren", won = String(entry.result?.winner_id) === String(state.userId);
  const rounds = Math.max(1, ...players.map((player) => Number(player.rounds_started || 0))); historyResultRounds = rounds;
  historyPlayerScores = Object.fromEntries(players.map((player) => { const locked = Math.max(1, (player.locked_timeline || []).length), saved = player.last_round?.score || {}, playerRounds = Number(player.last_round?.rounds || player.rounds_started || 0), correct = Math.max(locked, Number(saved.correct) || 0), hasMistakes = Number.isFinite(Number(saved.mistakes)) && saved.mistakes !== "", mistakes = hasMistakes ? Math.max(0, Number(saved.mistakes)) : Math.max(0, playerRounds - Math.max(0, correct - 1)); return [player.id, { correct, mistakes, rounds: playerRounds }]; }));
  summary.innerHTML = `<h1>Slutresultat</h1><p class="final-winner">${won ? "DU VANN MATCHEN" : "DU FÖRLORADE MATCHEN"}</p><p class="final-rounds">${rounds === 1 ? "OMGÅNG" : "OMGÅNGAR"}: <strong>${rounds}</strong></p><div class="match-summary"><small>MATCHKOD</small><strong>${escapeHtml(entry.code)}</strong></div><div class="match-metrics"><div><strong>${players.length || "–"}</strong><small>SPELARE</small></div><div><strong>AVSLUTAD</strong><small>MATCHSTATUS</small></div><div><strong>10</strong><small>FÖRST TILL</small></div></div><div class="overview-players">${players.map((player) => { const score = historyPlayerScores[player.id]; latestRounds[player.id] = player.last_round; return `<article class="overview-player ${String(player.user_id) === String(entry.result?.winner_id) ? "your-turn" : ""}"><div class="overview-player-header"><strong>${escapeHtml(player.display_name)}</strong></div><small>${score.correct}/10 rätt placerade · ${score.mistakes} felplacerade · ${player.swap_cards || 0}/3 Byt-låt-kort</small><button class="timeline-button final-player-round" data-player-round="${player.id}" type="button">VISA SENASTE OMGÅNG</button></article>`; }).join("")}</div>`;
  summary.hidden = false; $(".result-match-code").hidden = true; $("#solo-result-score").hidden = true; $(".result-head").hidden = true; $(".result-checks").hidden = true; $(".result-actions").hidden = true; $("#result-timeline").hidden = true; $("#result-back").hidden = false; $("#result-back").textContent = "← Tillbaka"; showView("result");
}
function settleResult(match, userId, players = []) {
  const result = match.last_result;
  if (result?.type === "solo") return;
  if (!result?.winner_id) return;
  const alreadySettled = state.settledResults.includes(match.id), alreadyArchived = state.archivedResults.includes(match.id);
  const won = result.winner_id === userId;
  const winner = players.find((player) => String(player.user_id) === String(result.winner_id))?.display_name || "Motspelaren", opponent = players.find((player) => String(player.user_id) !== String(userId))?.display_name || "Motspelaren";
  if (!alreadySettled) { state.stats.wins += won ? 1 : 0; state.stats.losses += won ? 0 : 1; state.stats.walkovers += won && result.type === "walkover" ? 1 : 0; state.stats.currentStreak = won ? state.stats.currentStreak + 1 : 0; state.stats.streak = Math.max(state.stats.streak, state.stats.currentStreak); state.settledResults.push(match.id); }
  const entry = { id: match.id, code: match.code, mode: "online", title: `${state.playerName}, ${opponent}`, opponentName: opponent, leaveReason: result.type === "walkover" ? (won ? "DU VANN - WALK OVER" : "DU LÄMNADE - WALK OVER") : won ? "DU VANN MATCHEN" : "DU FÖRLORADE MATCHEN", result };
  if (!alreadyArchived) { state.history.unshift(entry); state.archivedResults.push(match.id); }
  save();
  if (!won && !alreadyArchived && !state.selfWalkovers.includes(match.id)) { const message = `Du förlorade matchen mot ${winner}. Matchens resultat går att se på startsidan under Historik.`; if (window.Notification?.permission === "granted") new Notification("Digihits", { body: message }); dialog(message, () => showHistoryResult(entry), false, "VISA SLUTRESULTAT", "OK"); }
}
function closeHomeAccordions() {
  document.querySelectorAll("[data-accordion]").forEach((section) => { section.classList.remove("is-open"); section.querySelector(".accordion-toggle").setAttribute("aria-expanded", "false"); section.querySelector(".accordion-mark")?.replaceChildren("›"); });
}
function renderRoundResult(correct, card = activeCard(), snapshot = null) {
  $("#final-match-overview")?.setAttribute("hidden", ""); $(".result-head").hidden = false; $(".result-checks").hidden = false; $(".result-actions").hidden = false; $("#result-timeline").hidden = false;
  const solo = isSoloMatch(state.matches.find((match) => match.code === state.activeMatchCode));
  let wrongButton = $("#wrong-matches"), overviewButton = $("#wrong-overview");
  if (!wrongButton) { wrongButton = document.createElement("button"); wrongButton.id = "wrong-matches"; wrongButton.className = "lobby-back wrong-match-button"; wrongButton.type = "button"; wrongButton.textContent = "TILLBAKA TILL DINA MATCHER"; wrongButton.addEventListener("click", () => { state.roundUnlocked = []; save(); showView("home", true); }); $("#result-back").after(wrongButton); }
  if (!overviewButton) { overviewButton = document.createElement("button"); overviewButton.id = "wrong-overview"; overviewButton.className = "lobby-back wrong-match-button"; overviewButton.type = "button"; overviewButton.textContent = "TILL MATCHÖVERSIKT"; overviewButton.addEventListener("click", () => openMatch(state.activeMatchCode)); wrongButton.after(overviewButton); }
  const unlocked = snapshot?.unlocked ?? state.roundUnlocked, locked = snapshot?.locked ?? state.lockedTimeline, guess = snapshot?.guess ?? state.currentGuess ?? {};
  const attempts = state.matches.find((match) => match.code === state.activeMatchCode)?.round || 0;
  const correctCards = locked.length + (correct ? 1 : 0);
  const score = solo ? soloProgress(state.matches.find((match) => match.code === state.activeMatchCode), locked) : { correct: 0, mistakes: 0 };
  if (solo) { score.correct = Math.max(1, score.correct, correctCards); score.mistakes = Math.max(0, score.mistakes, correct ? 0 : 1); state.soloProgress[state.activeMatchCode] = score; save(); }
  $(".result-match-code").hidden = solo; $("#result-code-label").textContent = solo ? "FELPLACERADE KORT" : "MATCHKOD";
  $("#result-code").textContent = solo ? String(score.mistakes) : state.activeMatchCode || "------";
  $("#result-code").style.color = solo ? "#ff8b9d" : "";
  $("#result-code").classList.toggle("solo-mistake-count", solo);
  $("#solo-result-score").hidden = !solo; $("#solo-result-score").innerHTML = soloResultStats(score.correct, score.mistakes, attempts);
  $(".result-actions").classList.toggle("solo-result-actions", solo);
  const cards = [...unlocked, { ...card, status: solo ? (correct ? "RÄTT PLACERAT" : "FEL PLACERAT") : correct ? "OLÅST" : "FELPLACERAT" }];
  $("#result-song").textContent = `${card.artist} – ${card.title} (${card.year})`;
  renderGuessChecks(card, guess);
  $("#placement-result").className = `result-check ${correct ? "good" : "bad"}`;
  $("#placement-result").textContent = solo ? (correct ? "☑  Rätt placerat" : "✕  Fel placerat") : correct ? "☑  Rätt placering" : "✕  Fel placering";
  const timeline = snapshot?.timeline || [...locked.map((item, index) => ({ ...item, status: index === 0 ? "STARTKORT" : solo ? "RÄTT PLACERAT" : "LÅST" })), ...cards].sort((a, b) => a.year - b.year);
  $("#result-timeline").innerHTML = timeline.map((item) => `<article class="year-card ${item.status === "STARTKORT" ? "locked-card" : /FEL ?PLACERAT/.test(item.status) ? "misplaced-card" : solo ? "correct-card" : item.status === "LÅST" ? "locked-card" : "unlocked-card"}"${item.status === "STARTKORT" ? " style=\"border-color:#58657a;background:#202632\"" : ""}><strong>${item.year}</strong><small><span class="card-song">${item.title}<br>${item.artist}</span><span class="card-status">${item.status}</span></small></article>`).join("");
  $("#result-continue").hidden = !correct && !solo;
  $("#result-continue").textContent = solo ? "▶ FORTSÄTT MED NY LÅT" : "▶ FORTSÄTT OMGÅNG";
  $("#result-lock").hidden = !correct || solo; $("#change-track-area").hidden = !correct || solo;
  const onlyContinue = !$("#result-continue").hidden && $("#result-lock").hidden;
  $(".result-actions").style.gridTemplateColumns = onlyContinue ? "minmax(0,300px)" : "";
  $(".result-actions").style.justifyContent = onlyContinue ? "center" : "";
  $("#result-back").hidden = true; wrongButton.hidden = correct || solo; overviewButton.hidden = correct || solo || score.correct >= 10;
  $("#result-lock").textContent = `🔒 LÅS IN ${unlocked.length + (correct ? 1 : 0)} KORT`;
}

function updateTurnBadge() { const count = state.matches.filter((match) => !isSoloMatch(match) && match.status === "active").length; if (navigator.setAppBadge) (count ? navigator.setAppBadge(count) : navigator.clearAppBadge()).catch(() => {}); }
function renderFriends() {
  const requests = $("#friend-requests"), sent = $("#friend-sent-requests"), sentMatches = $("#friend-sent-match-invites"), friends = $("#friends-list"), invites = $("#friend-invites"); if (!requests || !sent || !sentMatches || !friends || !invites) return;
  const unreadCount = Object.values(state.friendChatUnread).reduce((total, count) => total + Number(count || 0), 0), requestCount = state.friendRequests.length, inviteCount = state.friendInvites.length; $("#friend-request-count").textContent = `Vänförfrågan ${requestCount}`; $("#friend-request-count").hidden = !requestCount; $("#friend-match-invite-count").textContent = `Ny match ${inviteCount}`; $("#friend-match-invite-count").hidden = !inviteCount; $("#friend-chat-alert").hidden = !unreadCount; $("#friend-chat-count").textContent = String(unreadCount);
  invites.innerHTML = `<h3 class="friend-section-title">Inkommande matchinbjudningar</h3>${state.friendInvites.length ? state.friendInvites.map((invite) => `<article class="friend-row"><strong>${escapeHtml(invite.sender_name)} har bjudit in dig till match</strong><div class="friend-actions"><button class="button button-green" data-join-friend-match="${invite.match_code}" data-invite-id="${invite.invite_id}" type="button">GÅ MED</button><button class="button button-secondary" data-decline-match-invite="${invite.invite_id}" type="button">AVVISA</button></div></article>`).join("") : `<p class="friend-empty">Du har inga inkommande matchinbjudningar.</p>`}`;
  sentMatches.innerHTML = `<h3 class="friend-section-title">Skickade matchförfrågningar</h3>${state.sentMatchInvites.length ? state.sentMatchInvites.map((invite) => invite.status === "pending" ? `<article class="friend-row"><strong>Inbjudan skickad till ${escapeHtml(invite.recipient_name || "spelaren")} · MATCHKOD ${escapeHtml(invite.match_code)}.</strong></article>` : `<article class="friend-row ${invite.status === "accepted" ? "friend-request-accepted" : "friend-request-declined"}"><strong>Matchförfrågan ${invite.status === "accepted" ? "accepterad" : "avvisad"} av ${escapeHtml(invite.recipient_name || "spelaren")} · MATCHKOD ${escapeHtml(invite.match_code)}.</strong><button class="button button-secondary" data-dismiss-sent-match-invite="${invite.invite_id}" type="button">OK</button></article>`).join("") : `<p class="friend-empty">Du har inga matchförfrågningar.</p>`}`;
  requests.innerHTML = `<h3 class="friend-section-title">Inkommande vänförfrågningar</h3>${state.friendRequests.length ? state.friendRequests.map((friend) => `<article class="friend-row"><strong>${escapeHtml(friend.display_name)}</strong><div class="friend-actions"><button class="button button-green" data-friend-answer="${friend.request_id}" data-friend-accept="true" type="button">ACCEPTERA</button><button class="button button-secondary" data-friend-answer="${friend.request_id}" type="button">AVVISA</button></div></article>`).join("") : `<p class="friend-empty">Du har inga inkommande vänförfrågningar.</p>`}`;
  sent.innerHTML = `<h3 class="friend-section-title">Skickade vänförfrågningar</h3>${state.sentFriendRequests.length ? state.sentFriendRequests.map((request) => { const name = escapeHtml(request.display_name || "spelaren"); return request.status === "accepted" ? `<article class="friend-row friend-request-accepted"><strong>Du är nu vän med ${name}.</strong><button class="button button-secondary" data-dismiss-friend-request="${request.request_id}" type="button">OK</button></article>` : request.status === "declined" ? `<article class="friend-row friend-request-declined"><strong>${name} avvisade din vänförfrågan.</strong><button class="button button-secondary" data-dismiss-friend-request="${request.request_id}" type="button">OK</button></article>` : `<article class="friend-row"><strong>Vänförfrågan till ${name} – väntar på svar.</strong></article>`; }).join("") : `<p class="friend-empty">Du har inga skickade vänförfrågningar.</p>`}`;
  friends.innerHTML = `<h3 class="friend-section-title">Vänskapslista</h3>${state.friends.length ? state.friends.map((friend) => { const unread = Number(state.friendChatUnread[friend.friend_id] || 0), name = String(friend.display_name || "").toLocaleLowerCase("sv-SE"), played = state.history.filter((match) => match.mode === "online" && String(match.opponentName || String(match.title || "").split(", ").at(-1)).toLocaleLowerCase("sv-SE") === name), isWalkover = (match) => /WALK/i.test(match.leaveReason || ""), wins = played.filter((match) => !isWalkover(match) && /VANN/i.test(match.leaveReason || "")).length, losses = played.filter((match) => !isWalkover(match) && /FÖRLORADE/i.test(match.leaveReason || "")).length, walkovers = played.filter(isWalkover).length; return `<article class="friend-row"><strong>${escapeHtml(friend.display_name)}</strong><div class="friend-stats"><div><b>${wins}</b><small>VINSTER MOT</small></div><div><b>${losses}</b><small>FÖRLUSTER MOT</small></div><div><b>${walkovers}</b><small>WALK OVER</small></div><div><b>${played.length}</b><small>SPELADE MATCHER</small></div></div><div class="friend-actions friend-main-actions"><button class="button button-primary" data-open-friend-chat="${friend.friend_id}" type="button">VISA CHATT${unread ? `<span class="chat-badge">${unread}</span>` : ""}</button><button class="button button-green" data-create-friend-match="${friend.friend_id}" type="button">SKAPA NY MATCH MOT</button><button class="button button-leave" data-remove-friend="${friend.friend_id}" data-friend-name="${escapeHtml(friend.display_name)}" type="button">TA BORT VÄN</button><button class="button button-leave" data-block-friend="${friend.friend_id}" data-friend-name="${escapeHtml(friend.display_name)}" type="button">BLOCKERA VÄN</button></div></article>`; }).join("") : `<p class="friend-empty">Du har inga vänner ännu.</p>`}${state.friendNotifications.map((notice) => `<article class="friend-row friend-request-declined"><strong>${escapeHtml(notice.display_name)} tog bort dig som vän.</strong><button class="button button-secondary" data-dismiss-friend-notice="${notice.notice_id}" type="button">OK</button></article>`).join("")}<h3 class="friend-section-title">Blockerade personer</h3>${state.blocks.length ? state.blocks.map((block) => `<article class="friend-row"><strong>${escapeHtml(block.display_name)}</strong><button class="button button-secondary" data-unblock-friend="${block.blocked_id}" type="button">TA BORT BLOCKERING</button></article>`).join("") : `<p class="friend-empty">Du har inga blockerade personer.</p>`}`;
}
async function syncFriends() {
  if (!supabaseAuth.session()?.access_token) return;
  const [friends, requests, invites, unreads, sentRequests, sentMatchInvites, notifications, blocks] = await Promise.all([supabaseAuth.dataRequest("rpc/digihits_my_friends", {}, "POST"), supabaseAuth.dataRequest("rpc/digihits_my_friend_requests", {}, "POST"), supabaseAuth.dataRequest("rpc/digihits_my_match_invites", {}, "POST"), supabaseAuth.dataRequest("rpc/digihits_my_friend_unreads", {}, "POST"), supabaseAuth.dataRequest("rpc/digihits_my_sent_friend_requests", {}, "POST"), supabaseAuth.dataRequest("rpc/digihits_my_sent_match_invites", {}, "POST"), supabaseAuth.dataRequest("rpc/digihits_my_friend_notifications", {}, "POST"), supabaseAuth.dataRequest("rpc/digihits_my_blocks", {}, "POST")]);
  state.friends = friends || []; state.friendRequests = requests || []; state.friendInvites = invites || []; state.friendChatUnread = Object.fromEntries((unreads || []).map((item) => [item.friend_id, Number(item.unread_count)])); state.sentFriendRequests = sentRequests || []; state.sentMatchInvites = sentMatchInvites || []; state.friendNotifications = notifications || []; state.blocks = blocks || []; save(); renderFriends();
}
function alignResetButtons() { document.querySelectorAll(".section-subtitle").forEach((title) => { const reset = title.nextElementSibling; if (!reset?.classList.contains("reset-row") || title.parentElement.classList.contains("section-heading")) return; const heading = document.createElement("div"); heading.className = "section-heading"; title.before(heading); heading.append(title, reset); }); }
function render() {
  updateTurnBadge();
  $("#player-name").textContent = state.playerName;
  const spotifyPanel = $("#spotify-status");
  if (spotifyPanel) spotifyPanel.textContent = "Apple Music-previews används för uppspelning.";
  $("#enable-notifications").textContent = state.pushNotificationsEnabled ? "INAKTIVERA NOTISER" : "AKTIVERA NOTISER";
  const turns = state.matches.filter((match) => !isSoloMatch(match) && match.status === "active").length;
  $("#turn-count").textContent = `Din tur ${turns}`;
  $("#turn-count").classList.toggle("has-turn", turns > 0);
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
    const solo = isSoloMatch(match);
    const soloScore = solo ? soloProgress(match) : null;
    const unread = solo ? 0 : Number(state.chatUnread[match.code] || 0);
    const label = solo ? "ÖPPNA SOLOMATCH HÄR" : match.status === "active" ? "ÖPPNA MATCH HÄR" : "VISA MATCH HÄR";
    const status = solo ? "DIN TUR" : match.status === "active" ? "DIN TUR" : match.status === "opponent" ? "MOTSTÅNDARES TUR" : "VÄNTAR PÅ MOTSPELARE";
    const players = `${match.status === "waiting" ? "1" : "2"} spelare · Omgång ${match.round || 1}`;
    const lock = match.locked ? "🔒" : "🔓";
    const lockLabel = match.locked ? "Match låst" : "Match olåst";
    return `<article class="match ${solo ? "solo" : match.status}">${solo ? "" : `<button class="match-lock-top ${match.locked ? "is-locked" : "is-unlocked"}" title="${lockLabel}" aria-label="${lockLabel}" type="button">${lock}</button>`}<div class="match-top"><strong>${match.title}</strong></div>${solo ? `<div class="solo-card-stats"><div><strong>${soloScore.correct}/10</strong><small>RÄTT PLACERADE</small></div><div><strong>${soloScore.mistakes}</strong><small>FELPLACERADE</small></div><div><strong>${match.round || 1}</strong><small>${(match.round || 1) === 1 ? "OMGÅNG" : "OMGÅNGAR"}</small></div></div>` : `<small>${players}</small><div class="match-status">● ${status}</div><div class="match-code">MATCHKOD &nbsp; <strong>${match.code}</strong></div>`}<div class="match-footer"><button class="match-open" data-open-match="${match.code}" type="button">● ${label}${unread ? `<span class="chat-badge">${unread}</span>` : ""}</button><div class="match-card-actions"><button class="match-icon delete-icon" data-delete-match="${match.code}" title="Lämna match" aria-label="Lämna match" type="button">🗑</button></div></div></article>`;
  };
  const soloMatches = state.matches.filter(isSoloMatch);
  const active = state.matches.filter((match) => !isSoloMatch(match) && (match.status === "active" || match.status === "opponent"));
  const waitingMatches = state.matches.filter((match) => !isSoloMatch(match) && match.status === "waiting");
  matches.innerHTML = state.matches.length ? `
    <h3 class="match-group-title">Mina solomatcher</h3>
    ${soloMatches.length ? soloMatches.map(renderCard).join("") : `<p class="match-empty">Du har inga solomatcher.</p>`}
    <h3 class="match-group-title">Mina onlinematcher</h3>
    <h4 class="match-group-title">Pågående matcher</h4>
    ${active.length ? active.map(renderCard).join("") : `<p class="match-empty">Inga pågående matcher.</p>`}
    <h3 class="match-group-title">Väntar på motspelare</h3>
    ${waitingMatches.length ? waitingMatches.map(renderCard).join("") : `<p class="match-empty">Inga matcher väntar på motspelare.</p>`}` : `<p class="muted">Du har inga matcher ännu.</p>`;
  const onlineMatches = state.matches.filter((match) => !isSoloMatch(match)).sort((a, b) => ({ active: 0, opponent: 1, waiting: 2 }[a.status] - { active: 0, opponent: 1, waiting: 2 }[b.status]) || new Date(a.updatedAt || 0) - new Date(b.updatedAt || 0));
  matches.innerHTML = state.matches.length ? `<h3 class="match-group-title">Mina solomatcher</h3>${soloMatches.length ? soloMatches.map(renderCard).join("") : `<p class="match-empty">Du har inga solomatcher.</p>`}<h3 class="match-group-title">Mina onlinematcher</h3>${onlineMatches.length ? onlineMatches.map(renderCard).join("") : `<p class="match-empty">Du har inga onlinematcher.</p>`}` : `<p class="muted">Du har inga matcher än.</p>`;
  const historyCard = (match) => { const outcomeClass = /WALK/i.test(match.leaveReason || "") ? "history-walkover" : /VANN/i.test(match.leaveReason || "") ? "history-won" : /FÖRLORADE/i.test(match.leaveReason || "") ? "history-lost" : ""; return `<article class="history-match ${match.mode === "solo" ? "solo-win" : match.leaveReason === "DU LÄMNADE INNAN MATCHSTART" ? "early-leave" : "walkover"} ${outcomeClass}">${match.mode === "online" ? `<strong>MOT ${escapeHtml(match.opponentName || String(match.title || "motspelaren").split(", ").at(-1))}</strong><small class="history-code">MATCHKOD <b>${escapeHtml(match.code || "------")}</b></small><span>${match.leaveReason}</span>` : `<strong>${match.title}</strong>${match.rounds ? `<div class="solo-card-stats"><div><strong>${match.correct}/10</strong><small>RÄTT PLACERADE</small></div><div><strong>${match.mistakes}</strong><small>FELPLACERADE</small></div><div><strong>${match.rounds}</strong><small>${match.rounds === 1 ? "OMGÅNG" : "OMGÅNGAR"}</small></div></div>` : `<span>${match.leaveReason}</span>`}`}${match.mode === "online" && match.result ? `<button class="timeline-button" data-history-result="${match.id}" type="button">VISA SLUTRESULTAT</button>` : ""}</article>`; };
  const soloHistory = state.history.filter((match) => match.mode === "solo"), onlineHistory = state.history.filter((match) => match.mode !== "solo");
  matches.querySelectorAll("[data-open-match]").forEach((button) => { const unread = Number(state.chatUnread[button.dataset.openMatch] || 0); if (unread) button.closest(".match")?.querySelector(".match-lock-top")?.insertAdjacentHTML("beforebegin", `<button class="match-chat-alert" data-open-chat="${button.dataset.openMatch}" title="Öppna chatt: ${unread} nya meddelanden" aria-label="Öppna chatt" type="button">✉<b>${unread}</b></button>`); });
  const history = $("#history");
  if (history) history.innerHTML = `<h3 class="section-subtitle">Solomatcher</h3><div class="reset-row"><button class="reset-button" data-reset-history="solo">NOLLSTÄLL SOLOMATCHER</button></div>${soloHistory.length ? soloHistory.map(historyCard).join("") : `<p class="history-empty">Inga avslutade solomatcher.</p>`}<h3 class="section-subtitle">Onlinematcher</h3><div class="reset-row"><button class="reset-button" data-reset-history="online">NOLLSTÄLL ONLINEMATCHER</button></div>${onlineHistory.length ? onlineHistory.map(historyCard).join("") : `<p class="history-empty">Inga avslutade onlinematcher.</p>`}`;
  alignResetButtons(); renderFriends();
}

function showView(view, focusMatches = false, fromHistory = false) {
  if (view === "guess" && state.guessFinalized?.matchCode === state.activeMatchCode && state.guessFinalized?.cardId === activeCard()?.id) view = "timeline";
  document.documentElement.classList.remove("booting");
  const gameView = view === "guess" || view === "timeline";
  if (!gameView) stopCurrentTrack(true);
  if (view !== "chat") { clearInterval(chatPoll); chatPoll = 0; }
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
  refreshChatButtons(match);
  $("#lobby-code").textContent = match.code;
  $("#copy-lobby-code").textContent = "KOPIERA KOD";
  $("#copy-lobby-code").classList.remove("is-copied");
  showView("lobby");
}

const escapeHtml = (value) => String(value || "").replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
function refreshChatButtons(match = state.matches.find((item) => item.code === state.activeMatchCode)) {
  const unread = Number(match && !isSoloMatch(match) ? state.chatUnread[match.code] || 0 : 0);
  [$("#lobby-chat"), $("#match-chat")].filter(Boolean).forEach((button) => { button.hidden = !match || isSoloMatch(match); button.innerHTML = `VISA CHATT${unread ? ` <span class="chat-badge">${unread}</span>` : ""}`; });
}
async function loadChat() {
  const match = state.matches.find((item) => item.code === state.chatMatchCode);
  if (!match?.id) return;
  const messages = await supabaseAuth.dataRequest(`online_messages?match_id=eq.${match.id}&select=id,user_id,display_name,body,message,created_at&order=created_at.asc`);
  if (currentView !== "chat") return;
  const user = await supabaseAuth.user(supabaseAuth.session()?.access_token);
  $("#chat-messages").innerHTML = messages.length ? messages.map((message) => `<article class="chat-message ${message.user_id === user.id ? "mine" : ""}"><strong>${escapeHtml(message.display_name)}</strong>${escapeHtml(message.body || message.message)}<time>${new Date(message.created_at).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}</time></article>`).join("") : `<p class="chat-empty">Inga meddelanden ännu.</p>`;
  $("#chat-messages").scrollTop = $("#chat-messages").scrollHeight;
  state.chatUnread[match.code] = 0; save(); render(); refreshChatButtons(match);
}
async function openChat(matchCode = state.activeMatchCode) {
  const match = state.matches.find((item) => item.code === matchCode);
  if (!match || isSoloMatch(match)) { dialog("Chatt finns bara i onlinematcher."); return; }
  state.chatMatchCode = match.code; state.chatReturnView = currentView; state.chatUnread[match.code] = 0; save();
  $("#chat-title").textContent = match.title; $("#chat-input").value = ""; showView("chat"); await loadChat(); clearInterval(chatPoll); chatPoll = setInterval(() => { if (currentView === "chat") loadChat().catch(() => {}); }, 2500);
}
function handleChatRealtime(payload) {
  if (payload.table === "digihits_friend_messages") { handleFriendChatRealtime(payload); return; }
  if (payload.eventType !== "INSERT" || String(payload.new?.user_id) === String(state.userId)) return;
  const match = state.matches.find((item) => String(item.id) === String(payload.new?.match_id));
  if (!match) return;
  if (currentView === "chat" && state.chatMatchCode === match.code) { loadChat().catch(() => {}); return; }
  state.chatUnread[match.code] = Number(state.chatUnread[match.code] || 0) + 1; save(); render(); refreshChatButtons();
}
async function loadFriendChat() {
  const friend = state.friends.find((item) => item.friend_id === state.friendChatId); if (!friend) return;
  const messages = await supabaseAuth.dataRequest("rpc/digihits_my_friend_messages", { friend: friend.friend_id }, "POST");
  if (currentView !== "friend-chat") return;
  const user = await supabaseAuth.user(supabaseAuth.session()?.access_token);
  $("#friend-chat-messages").innerHTML = messages.length ? messages.map((message) => `<article class="chat-message ${message.sender_id === user.id ? "mine" : ""}"><strong>${message.sender_id === user.id ? "Du" : escapeHtml(friend.display_name)}</strong>${escapeHtml(message.body)}<time>${new Date(message.created_at).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}</time></article>`).join("") : `<p class="chat-empty">Inga meddelanden ännu.</p>`;
  $("#friend-chat-messages").scrollTop = $("#friend-chat-messages").scrollHeight;
  await supabaseAuth.dataRequest("rpc/digihits_mark_friend_chat_read", { friend: friend.friend_id }, "POST"); state.friendChatUnread[friend.friend_id] = 0; save(); renderFriends();
}
async function openFriendChat(friendId) {
  const friend = state.friends.find((item) => item.friend_id === friendId); if (!friend) return;
  state.friendChatId = friendId; save(); $("#friend-chat-title").textContent = friend.display_name; $("#friend-chat-input").value = ""; showView("friend-chat"); await loadFriendChat();
}
function handleFriendChatRealtime(payload) {
  if (payload.eventType !== "INSERT" || String(payload.new?.sender_id) === String(state.userId)) return;
  const friendId = String(payload.new?.sender_id);
  if (!state.friends.some((friend) => String(friend.friend_id) === friendId)) return;
  if (currentView === "friend-chat" && friendId === String(state.friendChatId)) loadFriendChat().catch(() => {});
  else { state.friendChatUnread[friendId] = Number(state.friendChatUnread[friendId] || 0) + 1; save(); renderFriends(); }
}

function openMatch(matchCode) {
  const match = state.matches.find((item) => item.code === matchCode);
  if (!match) return;
  const soloMatch = isSoloMatch(match);
  state.activeMatchCode = matchCode; save();
  refreshChatButtons(match);
  $("#overview-code").textContent = soloMatch ? "SOLOMATCH" : match.code;
  $("#overview-code").previousElementSibling.textContent = soloMatch ? "SPELTYP" : "MATCHKOD";
  const playersMetric = $("#overview-players-count").parentElement;
  $(".match-view").classList.toggle("solo-match-view", soloMatch);
  playersMetric.hidden = false;
  playersMetric.style.display = "";
  playersMetric.parentElement.classList.toggle("solo-metrics", soloMatch);
  $("#next-round").nextElementSibling.hidden = soloMatch;
  $("#overview-players-count").textContent = soloMatch ? String(match.round || 1) : "2";
  playersMetric.querySelector("small").textContent = soloMatch ? ((match.round || 1) === 1 ? "OMGÅNG" : "OMGÅNGAR") : "SPELARE";
  const isYourTurn = match.status === "active", isWaiting = match.status === "waiting";
  const score = soloMatch ? soloProgress(match) : null;
  $("#overview-round").textContent = soloMatch ? String(score.mistakes) : "1";
  $("#overview-round-label").textContent = soloMatch ? "FELPLACERADE" : "OMGÅNG";
  $("#overview-target").textContent = soloMatch ? `${score.correct}/10` : "10";
  $("#overview-target-label").textContent = soloMatch ? "RÄTT PLACERADE" : "FÖRST TILL";
  $("#turn-message").hidden = soloMatch;
  $("#turn-message").textContent = isYourTurn ? "DIN TUR" : isWaiting ? "VÄNTAR PÅ MOTSPELARE" : "VÄNTAR PÅ MOTSPELARE";
  $("#turn-message").classList.toggle("waiting", !isYourTurn);
  const pendingRound = state.pendingResult?.matchCode === matchCode || (state.currentCard && (!state.currentCardMatchCode || state.currentCardMatchCode === matchCode));
  $("#next-round").classList.toggle("is-visible", isYourTurn);
  if (!roundLoading) $("#next-round").textContent = pendingRound ? "ÅTERUPPTA OMGÅNG" : "STARTA NÄSTA OMGÅNG";
  $("#overview-players").hidden = true;
  $("#overview-players").innerHTML = soloMatch ? `<button class="timeline-button show-player-round" type="button">VISA SENASTE SPELADE OMGÅNG</button>` : "";
  let friendBox = $("#match-friend-invites");
  if (!friendBox) { friendBox = document.createElement("section"); friendBox.id = "match-friend-invites"; friendBox.className = "match-friend-invites"; $("#overview-players").after(friendBox); }
  friendBox.hidden = true; friendBox.innerHTML = ""; let overviewLoading = $("#overview-loading"); if (!overviewLoading) { overviewLoading = document.createElement("div"); overviewLoading.id = "overview-loading"; overviewLoading.className = "overview-loading"; overviewLoading.innerHTML = "<i></i>LADDAR MATCHÖVERSIKT…"; $("#overview-players").before(overviewLoading); }
  showView("match");
  if (match.id) { overviewLoading.hidden = false; loadOverviewPlayers(match.id, isYourTurn, soloMatch); }
  else overviewLoading.hidden = true;
}
async function loadOverviewPlayers(matchId, isYourTurn, solo = false) {
  try {
    const players = await supabaseAuth.dataRequest(`online_players?match_id=eq.${matchId}&active=eq.true&select=id,user_id,display_name,turn_order,locked_timeline,last_round,rounds_started,swap_cards&order=turn_order`);
    const match = state.matches.find((item) => item.id === matchId), friendBox = $("#match-friend-invites");
    if (friendBox && match && !solo) { friendBox.hidden = false; const locked = match.locked || players.some((player) => Number(player.rounds_started || 0) >= 2); if (locked) friendBox.innerHTML = `<small>BJUD IN VÄN TILL MATCHEN</small><p>MATCHEN ÄR LÅST EFTERSOM OMGÅNG TVÅ REDAN PÅBÖRJATS.</p>`; else { const playerNames = new Set(players.map((player) => String(player.display_name).toLocaleLowerCase("sv-SE"))), sent = new Map(state.sentMatchInvites.filter((invite) => String(invite.match_code) === String(match.code)).map((invite) => [String(invite.recipient_id), invite])), inviteableFriends = state.friends.filter((friend) => String(friend.friend_id) !== String(state.userId) && (!playerNames.has(String(friend.display_name).toLocaleLowerCase("sv-SE")) || sent.has(String(friend.friend_id)))); friendBox.innerHTML = `<small>BJUD IN VÄN TILL MATCHEN</small>${inviteableFriends.length ? `<div>${inviteableFriends.map((friend) => { const invite = sent.get(String(friend.friend_id)); return invite ? `<p class="match-invite-status ${invite.status}">${escapeHtml(friend.display_name)} · ${invite.status === "pending" ? "INBJUDAN SKICKAD" : invite.status === "accepted" ? "INBJUDAN ACCEPTERAD" : "INBJUDAN AVVISAD"}</p>` : `<button class="button button-secondary" data-invite-friend="${friend.friend_id}" type="button">${escapeHtml(friend.display_name)} · BJUD IN HÄR</button>`; }).join("")}</div>` : `<p>DU HAR INGA FLER VÄNNER ATT BJUD IN TILL DENNA MATCH.</p>`}`; } }
    if (friendBox && match && !solo) { const joinRequests = await supabaseAuth.dataRequest("rpc/digihits_my_match_join_requests", { match_code_input: match.code }, "POST").catch(() => []); if (joinRequests.length) friendBox.insertAdjacentHTML("beforeend", joinRequests.map((request) => `<article class="block-join-request"><strong>${escapeHtml(request.requester_name)} som du har blockerat vill gå med i denna match.</strong><div><button class="button button-secondary" data-match-join-request="${request.request_id}" type="button">AVVISA</button><button class="button button-green" data-match-join-request="${request.request_id}" data-allow-match-join="true" type="button">TILLÅT</button></div></article>`).join("")); }
    if (!solo) $("#overview-players-count").textContent = String(players.length);
    players.forEach((player) => { latestRounds[player.id] = player.last_round; });
    if (solo) {
      const player = players[0] || {};
      const correct = Math.max(1, (player.locked_timeline || []).length);
      const mistakes = Math.max(0, (player.rounds_started || 0) - Math.max(0, correct - 1));
      const match = state.matches.find((item) => item.id === matchId);
      const score = { correct, mistakes }; if (match) state.soloProgress[match.code] = score;
      $("#overview-round").textContent = String(score.mistakes);
      $("#overview-round-label").textContent = "FELPLACERADE";
      $("#overview-target").textContent = `${score.correct}/10`;
      $("#overview-target-label").textContent = "RÄTT PLACERADE";
    } else {
      $("#overview-round").textContent = String(Math.max(1, ...players.map((player) => player.rounds_started || 0)));
      $("#overview-round-label").textContent = "OMGÅNG";
      $("#overview-target").textContent = "10";
      $("#overview-target-label").textContent = "FÖRST TILL";
    }
    $("#overview-players").innerHTML = solo ? `<button class="timeline-button show-player-round" data-player-round="${players[0]?.id || ""}" type="button">VISA SENASTE SPELADE OMGÅNG</button>` : players.map((player, index) => { const friend = state.friends.some((item) => String(item.friend_id) === String(player.user_id)), pending = state.sentFriendRequests.some((item) => String(item.recipient_id) === String(player.user_id) && item.status === "pending"); const friendControl = String(player.user_id) === String(state.userId) ? "" : friend ? `<small class="already-friend">REDAN VÄN MED</small>` : pending ? `<small class="already-friend">VÄNFÖRFRÅGAN SKICKAD</small>` : `<button class="button button-green add-match-friend" data-add-match-friend="${player.user_id}" data-player-name="${escapeHtml(player.display_name)}" type="button">LÄGG TILL VÄN</button>`; return `<article class="overview-player ${isYourTurn && index === 0 ? "your-turn" : ""}"><div class="overview-player-header"><span class="turn-order">${player.turn_order + 1}</span><strong>${player.display_name}</strong>${friendControl}</div><small>${(player.locked_timeline || []).length}/10 låsta kort · ${player.last_round?.outcome === "locked" ? (player.last_round.cards || []).length : 0} olåsta · 0/3 Byt låt-kort</small><button class="timeline-button show-player-round" data-player-round="${player.id}" type="button">VISA SENASTE SPELADE OMGÅNG</button></article>`; }).join("");
    $("#overview-players").querySelectorAll(".overview-player > small:not(.already-friend)").forEach((line) => line.remove());
    $("#overview-players").hidden = false;
  } catch { /* matchvyn behåller sin lokala reservvy */ } finally { $("#overview-loading")?.setAttribute("hidden", ""); }
}
function showLatestRound(round) {
  $("#final-match-overview")?.setAttribute("hidden", ""); $(".result-head").hidden = false; $(".result-checks").hidden = false; $(".result-actions").hidden = false; $("#result-timeline").hidden = false;
  if (!round) { dialog("Ingen spelad omgång ännu."); return; }
  viewingLatestRound = true;
  const playedCard = (round.cards || []).at(-1);
  if (playedCard) { $("#result-song").textContent = `${playedCard.artist} – ${playedCard.title} (${playedCard.year})`; renderGuessChecks(playedCard, round.guess || {}); } const solo = Boolean(state.matches.find((match) => match.code === state.activeMatchCode)?.solo), storedScore = round.historyScore || round.score || {}; const attempts = Number(storedScore.rounds || round.rounds || 0) || (viewingHistoryResult ? historyResultRounds : 0) || state.matches.find((match) => match.code === state.activeMatchCode)?.round || 0, correctCards = Math.max((round.timeline || round.cards || []).filter((card) => !/FEL ?PLACERAT/.test(card.status)).length, Number(storedScore.correct) || 0), hasMistakes = Number.isFinite(Number(storedScore.mistakes)) && storedScore.mistakes !== "", mistakes = hasMistakes ? Math.max(0, Number(storedScore.mistakes)) : Math.max(0, attempts - Math.max(0, correctCards - 1)); $(".result-match-code").hidden = solo; $("#result-code-label").textContent = solo ? "FELPLACERADE KORT" : "MATCHKOD"; $("#result-code").textContent = solo ? String(mistakes) : state.activeMatchCode || "------"; $("#result-code").classList.toggle("solo-mistake-count", solo); $("#solo-result-score").hidden = !(solo || viewingHistoryResult); $("#solo-result-score").innerHTML = soloResultStats(correctCards, mistakes, attempts);
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
  state.placementDraft = { matchCode: state.activeMatchCode, cardId: activeCard()?.id, position: Number(position) }; save();
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
  state.currentGuess = null; state.guessDraft = null; state.guessFinalized = null; state.placementDraft = null; $("#guess-artist").value = ""; $("#guess-track").value = ""; $("#secret-card").classList.remove("is-placed"); $("#lock-placement").classList.remove("is-visible"); $("#placed-message").textContent = ""; $("#change-track-area").hidden = false;
  const cards = [...state.lockedTimeline.map((card, index) => ({ ...card, status: index === 0 ? "STARTKORT" : "LÅST" })), ...state.roundUnlocked].sort((a, b) => a.year - b.year);
  const slot = (index) => `<div class="slot" data-slot="${index}">PLACERA<br>HÄR</div>`;
  $("#timeline-row").innerHTML = cards.map((card, index) => `${(index === 0 || cards[index - 1].year !== card.year) ? slot(index) : ""}<article class="year-card ${card.status === "STARTKORT" ? "locked-card" : card.status === "OLÅST" ? "unlocked-card" : ""}"><strong>${card.year}</strong><small><span class="card-song">${card.title}<br>${card.artist}</span><span class="card-status">${card.status}</span></small></article>`).join("") + slot(cards.length); save();
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
function hasCorrectSongGuess(card) { return completeSongGuess(state.currentGuess, card); }
function soloProgress(match, locked = state.lockedTimeline) { const code = match?.code || state.activeMatchCode; const fallback = { correct: Math.max(1, locked.length || 0), mistakes: Math.max(0, (match?.round || 0) - Math.max(0, (locked.length || 0) - 1)) }; const saved = state.soloProgress?.[code]; if (!saved || typeof saved !== "object") state.soloProgress[code] = fallback; else { saved.correct = Math.max(1, Number(saved.correct) || fallback.correct); saved.mistakes = Math.max(0, Number(saved.mistakes) || 0); } return state.soloProgress[code]; }
function addMatch(matchCode) {
  state.matches.unshift({ code: matchCode, title: `${state.playerName}, väntar på motspelare`, status: "waiting" });
  save(); render(); openLobby(matchCode);
}
async function syncMatches() {
  const user = await supabaseAuth.user(supabaseAuth.session()?.access_token);
  const previousActive = state.matches.find((match) => match.code === state.activeMatchCode);
  const rows = await supabaseAuth.dataRequest(`online_players?user_id=eq.${user.id}&active=eq.true&select=match_id,online_matches(id,code,status,phase,current_user_id,last_result,turn_notice,updated_at)`);
  let players = []; try { const ids = rows.map((row) => row.match_id).join(","); if (ids) players = await supabaseAuth.dataRequest(`online_players?match_id=in.(${ids})&select=match_id,user_id,display_name,rounds_started`); } catch { /* matchlistan fungerar även om namnfrågan nekas */ }
  rows.forEach((row) => { if (row.online_matches?.status === "finished") settleResult(row.online_matches, user.id, players.filter((player) => String(player.match_id) === String(row.match_id))); });
  state.matches = rows.map((row) => { const match = row.online_matches, matchPlayers = players.filter((player) => String(player.match_id) === String(row.match_id)), solo = isSoloMatch(match), opponent = matchPlayers.find((player) => String(player.user_id) !== String(user.id))?.display_name || "motspelare"; return !match || match.status === "finished" ? null : { code: match.code, id: match.id, title: solo ? "Solomatch" : match.status === "waiting" ? `${state.playerName}, väntar på motspelare` : `${state.playerName}, ${opponent}`, status: match.status === "waiting" ? "waiting" : String(match.current_user_id) === String(user.id) ? "active" : "opponent", solo, locked: match.phase === "locked" || (solo && match.phase === "solo_locked"), round: Math.max(1, ...matchPlayers.map((player) => player.rounds_started || 0)), turnNotice: match.turn_notice, updatedAt: match.updated_at }; }).filter(Boolean).sort((a, b) => ({ active: 0, opponent: 1, waiting: 2 }[a.status] - { active: 0, opponent: 1, waiting: 2 }[b.status]) || new Date(a.updatedAt || 0) - new Date(b.updatedAt || 0));
  save(); render();
  const activeMatch = state.matches.find((match) => match.code === state.activeMatchCode);
  const activeMatchChanged = !previousActive || previousActive.status !== activeMatch?.status || previousActive.title !== activeMatch?.title || previousActive.round !== activeMatch?.round || previousActive.locked !== activeMatch?.locked;
  if ((currentView === "lobby" || currentView === "match") && activeMatch && activeMatchChanged) openMatch(activeMatch.code);
  if (["guess", "timeline"].includes(currentView) && !resultIsLocked && activeMatch && activeMatch.status !== "active") openMatch(activeMatch.code);
  if (!activeMatch && state.activeMatchCode && ["lobby", "match", "guess", "timeline"].includes(currentView)) showView("home", true);
  state.matches.forEach(showTurnNotice);
}
async function refreshRealtimeState() { if (realtimeRefreshing || document.visibilityState !== "visible" || !supabaseAuth.session()?.access_token) return; realtimeRefreshing = true; try { await Promise.all([syncMatches(), syncFriends()]); if (currentView === "chat") await loadChat(); else if (currentView === "friend-chat") await loadFriendChat(); else await refreshActiveRound(); } catch { /* nästa Realtime- eller reservsynk försöker igen */ } finally { realtimeRefreshing = false; } }
function startRealtime() { supabaseAuth.subscribeMatches(() => refreshRealtimeState(), handleChatRealtime); clearInterval(realtimeFallbackPoll); realtimeFallbackPoll = setInterval(refreshRealtimeState, 5000); }
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
    await refreshRealtimeState();
  }
});
async function createOnlineMatch(inviteFriendId = null) {
  const user = await supabaseAuth.user(supabaseAuth.session()?.access_token); const matchCode = code();
  const starter = pickFreshTrack(testDeck), deck = [starter, ...testDeck.filter((card) => card.id !== starter.id)];
  const matches = await supabaseAuth.dataRequest("online_matches", { code: matchCode, status: "waiting", deck, used_track_ids: [starter.id], target_cards: 10, current_user_id: user.id, phase: "waiting", turn_started_at: new Date().toISOString(), updated_at: new Date().toISOString() }, "POST");
  await supabaseAuth.dataRequest("online_players", { match_id: matches[0].id, user_id: user.id, display_name: state.playerName, turn_order: 0, locked_timeline: [deck[0]], turn_cards: [], swap_cards: 0, rounds_started: 0, active: true, history_hidden: false, updated_at: new Date().toISOString() }, "POST");
  if (inviteFriendId) await supabaseAuth.dataRequest("rpc/digihits_invite_friend", { match_code_input: matchCode, recipient: inviteFriendId }, "POST");
  rememberTrack(starter); state.changeTrackCards = 0; save(); await syncMatches(); if (inviteFriendId) await syncFriends(); openMatch(matchCode);
}
async function createSoloMatch() {
  const user = await supabaseAuth.user(supabaseAuth.session()?.access_token), matchCode = `S0${code().slice(2)}`;
  const starter = pickFreshTrack(testDeck), deck = [starter, ...testDeck.filter((card) => card.id !== starter.id)];
  const matches = await supabaseAuth.dataRequest("online_matches", { code: matchCode, status: "active", deck, used_track_ids: [starter.id], target_cards: 10, current_user_id: user.id, phase: "solo", updated_at: new Date().toISOString() }, "POST");
  await supabaseAuth.dataRequest("online_players", { match_id: matches[0].id, user_id: user.id, display_name: state.playerName, turn_order: 0, locked_timeline: [starter], turn_cards: [], swap_cards: 0, rounds_started: 0, active: true, history_hidden: false, updated_at: new Date().toISOString() }, "POST");
  rememberTrack(starter); state.changeTrackCards = 0; state.soloProgress[matchCode] = { correct: 1, mistakes: 0 }; save(); await syncMatches(); openMatch(matchCode);
}
async function joinOnlineMatch(matchCode, allowOwnBlock = false) {
  const found = await supabaseAuth.dataRequest(`online_matches?code=eq.${matchCode}&select=*`); const match = found[0];
  if (!match) throw new Error("Matchkoden hittades inte.");
  if (match.phase === "locked") throw new Error("Matchen är låst eftersom andra omgången redan är påbörjad.");
  if (!["waiting", "active"].includes(match.status)) throw new Error("Matchkoden hittades inte eller matchen är avslutad.");
  const players = await supabaseAuth.dataRequest(`online_players?match_id=eq.${match.id}&active=eq.true&select=*`);
  if (players.length >= 8) throw new Error("Matchen är full – 8 spelare är redan med i matchen.");
  const user = await supabaseAuth.user(supabaseAuth.session()?.access_token); if (players.some((player) => player.user_id === user.id)) throw new Error("Du är redan med i matchen.");
  const deck = expandedMatchDeck(match.deck || []), available = deck.filter((card) => !(match.used_track_ids || []).includes(card.id));
  if (!available.length) throw new Error("Det finns inget ledigt startkort i matchen.");
  const starter = pickFreshTrack(available);
  const result = await supabaseAuth.dataRequest("rpc/digihits_request_match_join", { match_code_input: matchCode, starter_card: starter, allow_own_block: allowOwnBlock }, "POST");
  if (result.status === "confirm") return dialog(`${result.name} som du har blockerat är med i denna match. Vill du verkligen gå med i den här matchen?`, () => joinOnlineMatch(matchCode, true), false, "GÅ MED");
  if (result.status === "pending") return dialog(`${result.name || "En spelare"} har blockerat dig, du kan därmed inte gå med i denna match om du inte blir accepterad att gå med.`);
  rememberTrack(starter); state.changeTrackCards = 0; save(); await syncMatches(); openMatch(matchCode);
}

$("#create-match").addEventListener("click", async () => { try { await createOnlineMatch(); } catch (error) { alert(error.message); } });
$("#create-solo-match").addEventListener("click", async () => { try { await createSoloMatch(); } catch (error) { alert(error.message); } });
$("#join-match").addEventListener("click", async () => {
  const value = $("#match-code").value.trim().toUpperCase();
  if (!/^[A-Z0-9]{5,6}$/.test(value)) { dialog("Skriv en giltig matchkod med fem eller sex tecken."); return; } try { await joinOnlineMatch(value); $("#match-code").value = ""; } catch (error) { dialog(error.message || "Det gick inte att gå med i matchen."); }
});
$("#friend-search-form")?.addEventListener("submit", async (event) => { event.preventDefault(); const input = $("#friend-search"), feedback = $("#friend-feedback"), requested = input.value.trim(); if (!requested) return; try { await supabaseAuth.dataRequest("rpc/digihits_send_friend_request", { requested }, "POST"); input.value = ""; feedback.textContent = "Vänförfrågan är skickad."; feedback.classList.remove("error"); feedback.hidden = false; await syncFriends(); } catch (error) { feedback.textContent = error.message; feedback.classList.add("error"); feedback.hidden = false; } });
document.addEventListener("click", async (event) => {
  const answer = event.target.closest("[data-friend-answer]"), dismiss = event.target.closest("[data-dismiss-friend-request]"), dismissNotice = event.target.closest("[data-dismiss-friend-notice]"), unblock = event.target.closest("[data-unblock-friend]"), block = event.target.closest("[data-block-friend]"), declineInvite = event.target.closest("[data-decline-match-invite]"), dismissMatchInvite = event.target.closest("[data-dismiss-sent-match-invite]"), create = event.target.closest("[data-create-friend-match]"), remove = event.target.closest("[data-remove-friend]"), invite = event.target.closest("[data-join-friend-match]"), chat = event.target.closest("[data-open-friend-chat]");
  try {
    if (answer) { const accepting = answer.dataset.friendAccept === "true", friend = state.friendRequests.find((item) => String(item.request_id) === String(answer.dataset.friendAnswer)); if (accepting) dialogProgress(`ACCEPTERAR VÄNFÖRFRÅGAN FRÅN ${friend?.display_name || "SPELAREN"}…`); try { await supabaseAuth.dataRequest("rpc/digihits_answer_friend_request", { request_id: answer.dataset.friendAnswer, accept_request: accepting }, "POST"); await syncFriends(); } finally { if (accepting) closeDialogProgress(); } }
    else if (dismiss) { await supabaseAuth.dataRequest("rpc/digihits_dismiss_sent_friend_request", { request_id: dismiss.dataset.dismissFriendRequest }, "POST"); await syncFriends(); }
    else if (dismissNotice) { await supabaseAuth.dataRequest("rpc/digihits_dismiss_friend_notification", { notice: dismissNotice.dataset.dismissFriendNotice }, "POST"); await syncFriends(); }
    else if (unblock) { await supabaseAuth.dataRequest("rpc/digihits_unblock_friend", { target: unblock.dataset.unblockFriend }, "POST"); await syncFriends(); }
    else if (block) dialog(`Vill du blockera ${block.dataset.friendName}?`, async () => { await supabaseAuth.dataRequest("rpc/digihits_block_friend", { target: block.dataset.blockFriend }, "POST"); await syncFriends(); }, true, "BLOCKERA");
    else if (declineInvite) { await supabaseAuth.dataRequest("rpc/digihits_dismiss_match_invite", { invite: declineInvite.dataset.declineMatchInvite }, "POST"); await syncFriends(); }
    else if (dismissMatchInvite) { await supabaseAuth.dataRequest("rpc/digihits_dismiss_sent_match_invite", { invite: dismissMatchInvite.dataset.dismissSentMatchInvite }, "POST"); await syncFriends(); }
    else if (create) { const friend = state.friends.find((item) => String(item.friend_id) === String(create.dataset.createFriendMatch)); dialog(`Vill du skapa en match mot ${friend?.display_name || "den här spelaren"}?`, async () => { try { await createOnlineMatch(create.dataset.createFriendMatch); } catch (error) { alert(error.message); } }, false, "JA"); }
    else if (remove) dialog(`Är du säker på att du vill ta bort ${remove.dataset.friendName}?`, async () => { dialogProgress(`TAR BORT ${remove.dataset.friendName} FRÅN VÄNSKAPSLISTAN…`); try { await supabaseAuth.dataRequest("rpc/digihits_remove_friend", { target: remove.dataset.removeFriend }, "POST"); await syncFriends(); } finally { closeDialogProgress(); } }, true, "JA");
    else if (invite) { dialogProgress("ACCEPTERAR MATCHINBJUDAN…"); try { const starter = pickFreshTrack(testDeck), matchCode = await supabaseAuth.dataRequest("rpc/digihits_accept_match_invite", { invite: invite.dataset.inviteId, starter }, "POST"); await syncMatches(); const existing = state.matches.find((match) => match.code === matchCode); if (!existing) throw new Error("Matchinbjudan kunde inte öppnas."); openMatch(existing.code); await syncFriends(); } finally { closeDialogProgress(); } }
    else if (chat) await openFriendChat(chat.dataset.openFriendChat);
  } catch (error) { dialog(error.message || "Det gick inte att gå med i matchen."); }
});
document.addEventListener("click", async (event) => { const button = event.target.closest("[data-invite-friend]"); if (!button) return; const friend = state.friends.find((item) => String(item.friend_id) === String(button.dataset.inviteFriend)); if (state.sentMatchInvites.some((invite) => String(invite.match_code) === String(state.activeMatchCode) && String(invite.recipient_id) === String(button.dataset.inviteFriend))) return dialog("Inbjudan redan skickad."); dialog(`Vill du lägga till ${friend?.display_name || "spelaren"} till denna match?`, async () => { try { await supabaseAuth.dataRequest("rpc/digihits_invite_friend", { match_code_input: state.activeMatchCode, recipient: button.dataset.inviteFriend }, "POST"); await syncFriends(); openMatch(state.activeMatchCode); } catch (error) { alert(error.message); } }, false, "JA"); });
document.addEventListener("click", async (event) => { const button = event.target.closest("[data-add-match-friend]"); if (!button) return; dialog(`Vill du lägga till ${button.dataset.playerName} i din vänskapslista?`, async () => { try { await supabaseAuth.dataRequest("rpc/digihits_send_friend_request", { requested: button.dataset.playerName }, "POST"); state.sentFriendRequests = [...state.sentFriendRequests.filter((item) => String(item.recipient_id) !== String(button.dataset.addMatchFriend)), { recipient_id: String(button.dataset.addMatchFriend), display_name: button.dataset.playerName, status: "pending" }]; save(); button.replaceWith(Object.assign(document.createElement("small"), { className: "already-friend", textContent: "VÄNFÖRFRÅGAN SKICKAD" })); } catch (error) { alert(error.message); } }, false, "JA"); });
document.addEventListener("click", async (event) => { const button = event.target.closest("[data-match-join-request]"); if (!button) return; try { await supabaseAuth.dataRequest("rpc/digihits_answer_match_join_request", { request: button.dataset.matchJoinRequest, allow_join: button.dataset.allowMatchJoin === "true" }, "POST"); await syncMatches(); if (state.activeMatchCode) openMatch(state.activeMatchCode); } catch (error) { alert(error.message); } });
$("#matches").addEventListener("click", (event) => {
  const chatButton = event.target.closest("[data-open-chat]");
  if (chatButton) { openChat(chatButton.dataset.openChat).catch((error) => alert(error.message)); return; }
  const openButton = event.target.closest("[data-open-match]");
  if (openButton) { openMatch(openButton.dataset.openMatch); return; }
  const deleteButton = event.target.closest("[data-delete-match]");
  if (deleteButton) {
    const match = state.matches.find((item) => item.code === deleteButton.dataset.deleteMatch); if (!match) return; const opponent = String(match.title || "").split(", ").find((name) => name.toLocaleLowerCase("sv-SE") !== String(state.playerName).toLocaleLowerCase("sv-SE")) || "motspelaren", message = match.solo ? "Vill du verkligen avsluta solomatchen?" : match.status === "waiting" ? `Vill du verkligen lämna matchen med matchkoden ${match.code}?` : `Vill du verkligen lämna matchen mot ${opponent} med matchkoden ${match.code}? Du kommer därmed lämna walk over.`;
    dialog(message, async () => { try { const user = await supabaseAuth.user(supabaseAuth.session()?.access_token), players = await supabaseAuth.dataRequest(`online_players?match_id=eq.${match.id}&select=user_id`), winner = players.find((player) => player.user_id !== user.id)?.user_id; if (winner) { state.selfWalkovers.push(match.id); save(); } await supabaseAuth.dataRequest(`online_matches?id=eq.${match.id}`, { status: "finished", last_result: winner ? { winner_id: winner, type: "walkover" } : null, updated_at: new Date().toISOString() }, "PATCH"); state.history.unshift({ ...match, ...(match.solo ? { mode: "solo" } : {}), leaveReason: match.solo ? "RADERAD SOLOMATCH" : match.status === "waiting" ? "DU LÄMNADE INNAN MATCHSTART" : "DU LÄMNADE - WALK OVER" }); await syncMatches(); } catch (error) { alert(error.message); } }, true);
  }
});
$("#history")?.addEventListener("click", (event) => { const scope = event.target.closest("[data-reset-history]")?.dataset.resetHistory; if (!scope) return; const solo = scope === "solo"; dialog(`Nollställ avslutade ${solo ? "solomatcher" : "onlinematcher"}?`, () => { state.history = state.history.filter((match) => solo ? match.mode !== "solo" : match.mode === "solo"); save(); render(); }, true, "NOLLSTÄLL"); });
$("#history")?.addEventListener("click", (event) => { const button = event.target.closest("[data-history-result]"); if (button) { const entry = state.history.find((match) => String(match.id) === String(button.dataset.historyResult)); if (entry?.result) showHistoryResult(entry); } });
$("#copy-lobby-code").addEventListener("click", async () => {
  const value = $("#lobby-code").textContent;
  try { await navigator.clipboard.writeText(value); } catch { /* local file mode can block clipboard */ }
  const button = $("#copy-lobby-code");
  button.textContent = "KOD KOPIERAD";
  button.classList.add("is-copied");
});
$("#lobby-leave").addEventListener("click", () => showView("home"));
[$("#lobby-chat"), $("#match-chat")].forEach((button) => button.addEventListener("click", () => openChat().catch((error) => alert(error.message))));
$("#chat-back").addEventListener("click", () => { const view = state.chatReturnView === "lobby" ? "lobby" : "match"; if (view === "lobby") openLobby(state.activeMatchCode); else openMatch(state.activeMatchCode); });
$("#chat-form").addEventListener("submit", async (event) => { event.preventDefault(); const match = state.matches.find((item) => item.code === state.chatMatchCode), body = $("#chat-input").value.trim(); if (!match?.id || !body) return; const user = await supabaseAuth.user(supabaseAuth.session()?.access_token); try { await supabaseAuth.dataRequest("online_messages", { match_id: match.id, user_id: user.id, display_name: state.playerName, body, message: body }, "POST"); $("#chat-input").value = ""; await loadChat(); } catch (error) { alert(error.message); } });
$("#friend-chat-back").addEventListener("click", () => showView("home", true));
$("#friend-chat-form").addEventListener("submit", async (event) => { event.preventDefault(); const body = $("#friend-chat-input").value.trim(); if (!state.friendChatId || !body) return; try { await supabaseAuth.dataRequest("rpc/digihits_send_friend_message", { friend: state.friendChatId, message_body: body }, "POST"); $("#friend-chat-input").value = ""; await loadFriendChat(); } catch (error) { alert(error.message); } });
window.resumeDigihitsRound = async () => { const button = $("#next-round"); if (button.disabled) return; if (!supabaseAuth.spotify()) { dialog("Du måste ansluta till ett Spotify Premium-konto.", () => supabaseAuth.connectSpotify().catch((error) => alert(error.message)), false, "ANSLUT KONTO"); return; } roundLoading = true; button.disabled = true; const label = button.textContent; button.textContent = "LADDAR OMGÅNG…"; try { const pending = state.pendingResult; if (pending?.matchCode === state.activeMatchCode) { currentPlacementCorrect = true; resultIsLocked = true; renderRoundResult(true, pending.card, pending.snapshot); showView("result"); return; } await syncMatches(); button.textContent = "LADDAR OMGÅNG…"; const match = state.matches.find((item) => item.code === state.activeMatchCode); if (!match || match.status !== "active") throw new Error("Omgången kan inte återupptas just nu."); await restoreRoundUnlocked(); const existingCard = Boolean(state.currentCard); if (!existingCard) { state.roundUnlocked = []; save(); await markRoundStarted(); await dealCard(); } resetTurnInput(); showView("guess"); if (existingCard) { pausedForNavigation = true; resumeRoundTrack(); } else startCurrentTrack(); } catch (error) { alert(error.message); } finally { roundLoading = false; button.disabled = false; button.textContent = label; } };
$("#next-round").addEventListener("click", window.resumeDigihitsRound);
$("#overview-players").addEventListener("click", (event) => { const button = event.target.closest(".show-player-round"); if (!button) return; showLatestRound(latestRounds[button.dataset.playerRound]); });
document.addEventListener("click", (event) => { const button = event.target.closest(".final-player-round"); if (button) { const id = button.dataset.playerRound; returnToFinalResult = true; showLatestRound({ ...(latestRounds[id] || {}), historyScore: historyPlayerScores[id] }); } });
$("#play-sample").addEventListener("click", async () => { try { if (trackStartPromise) { await trackStartPromise; return; } const playerState = await spotifyPlayer?.getCurrentState().catch(() => null), expected = state.selectedTracks[activeCard().id]?.uri, sameTrack = expected && playerState?.track_window?.current_track?.uri === expected, actuallyPlaying = Boolean(playerState && !playerState.paused); if (actuallyPlaying && sameTrack) { await spotifyPlayer.pause(); wasPausedByUser = true; setPlayButton(false); } else if ((wasPausedByUser || pausedForNavigation) && sameTrack) { await spotifyPlayer.resume(); wasPausedByUser = false; pausedForNavigation = false; setPlayButton(true); } else { trackStartPromise = playCurrentTrack().finally(() => { trackStartPromise = null; }); await trackStartPromise; } } catch (error) { songStarting = false; setPlayButton(false); if (/ansluta spelaren|starta låten|spelaren kunde inte laddas/i.test(error.message)) dialog("Spotify behöver anslutas igen innan låten kan spelas.", () => { resetSpotifyPlayer(); supabaseAuth.disconnectSpotify(); supabaseAuth.connectSpotify(true).catch((issue) => alert(issue.message)); }, false, "ANSLUT KONTO"); else alert(error.message); } });
$("#replay-track").addEventListener("click", async () => { try { if (trackStartPromise) await trackStartPromise; loadedSpotifyCardId = null; trackStartPromise = playCurrentTrack().finally(() => { trackStartPromise = null; }); await trackStartPromise; } catch (error) { alert(error.message); } });
[$("#guess-artist"), $("#guess-track")].forEach((field) => field.addEventListener("input", () => { if (!activeCard()) return; state.guessDraft = { matchCode: state.activeMatchCode, cardId: activeCard().id, artist: $("#guess-artist").value, title: $("#guess-track").value }; save(); }));
$("#guess-form").addEventListener("submit", (event) => { event.preventDefault(); state.currentGuess = { artist: $("#guess-artist").value.trim(), title: $("#guess-track").value.trim() }; state.guessDraft = null; state.guessFinalized = { matchCode: state.activeMatchCode, cardId: activeCard()?.id }; save(); $("#change-track-area").hidden = false; showView("timeline"); });
$("#skip-guess")?.addEventListener("click", () => $("#guess-form").requestSubmit());
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
  const solo = isSoloMatch(match);
  const user = await supabaseAuth.user(supabaseAuth.session()?.access_token);
  const players = await supabaseAuth.dataRequest(`online_players?match_id=eq.${match.id}&active=eq.true&select=id,user_id,turn_order,locked_timeline,rounds_started,swap_cards,last_round&order=turn_order`);
  const mine = players.findIndex((player) => String(player.user_id) === String(user.id)), minePlayer = players[mine], next = players[(mine + 1) % players.length];
  if (!minePlayer || !next || (!solo && players.length < 2)) throw new Error("Det finns ingen aktiv motspelare i matchen.");
  const currentCard = activeCard(), cardsToLock = currentPlacementCorrect ? [...state.roundUnlocked, currentCard] : [], earnedSwapCard = false;
  const target = (await supabaseAuth.dataRequest(`online_matches?id=eq.${match.id}&select=target_cards`))[0]?.target_cards || 10, won = currentPlacementCorrect && (minePlayer.locked_timeline || []).length + cardsToLock.length >= target;
  const roundCards = currentPlacementCorrect ? cardsToLock.map((card) => ({ ...card, status: solo ? "RÄTT PLACERAT" : "LÅST DENNA OMGÅNG" })) : [...state.roundUnlocked.map((card) => ({ ...card, status: solo ? "RÄTT PLACERAT" : "OLÅST" })), { ...currentCard, status: solo ? "FEL PLACERAT" : "FELPLACERAT" }];
  const previousScore = minePlayer.last_round?.score || {}, priorCorrect = Math.max(1, Number(previousScore.correct) || (minePlayer.locked_timeline || []).length), priorMistakes = Math.max(0, Number(previousScore.mistakes) || Math.max(0, Number(minePlayer.rounds_started || 0) - Math.max(0, priorCorrect - 1))), score = { correct: currentPlacementCorrect ? priorCorrect + cardsToLock.length : priorCorrect, mistakes: priorMistakes + (currentPlacementCorrect ? 0 : 1) };
  const lastRound = { ended_at: new Date().toISOString(), rounds: Number(minePlayer.rounds_started || 0), outcome: won ? "won" : currentPlacementCorrect ? "locked" : "wrong", guess: state.currentGuess || {}, cards: roundCards, score, timeline: savedTimeline || [...(minePlayer.locked_timeline || []).map((card, index) => ({ ...card, status: index === 0 ? "STARTKORT" : solo ? "RÄTT PLACERAT" : "LÅST" })), ...roundCards] };
  const currentSwapCards = Math.max(0, Math.min(3, Number(state.changeTrackCards ?? minePlayer.swap_cards) || 0));
  await supabaseAuth.dataRequest(`online_players?id=eq.${minePlayer.id}`, { locked_timeline: currentPlacementCorrect ? [...(minePlayer.locked_timeline || []), ...cardsToLock] : minePlayer.locked_timeline, turn_cards: [], current_card: null, last_round: lastRound, swap_cards: currentSwapCards, updated_at: new Date().toISOString() }, "PATCH");
  const lockMatch = match.locked || (minePlayer.rounds_started || 0) >= 2;
  await supabaseAuth.dataRequest(`online_matches?id=eq.${match.id}`, { status: won ? "finished" : "active", current_user_id: won ? null : next.user_id, phase: won ? "finished" : solo ? (lockMatch ? "solo_locked" : "solo") : lockMatch ? "locked" : "turn_ready", last_result: { ...lastRound, player_id: user.id, ...(won ? { winner_id: user.id, type: solo ? "solo" : "win" } : {}) }, ...(solo || won ? {} : { turn_started_at: new Date().toISOString(), turn_reminder_sent_at: null, turn_notice: null }), updated_at: new Date().toISOString() }, "PATCH");
  await syncMatches();
  let soloSummary = null;
  if (won && solo) {
    const rounds = Math.max(1, minePlayer.rounds_started || 1);
    const mistakes = Math.max(0, rounds - (target - 1));
    state.soloStats.bestRounds = state.soloStats.bestRounds ? Math.min(state.soloStats.bestRounds, rounds) : rounds;
    state.soloStats.fewestMistakes = state.soloStats.fewestMistakes === null || state.soloStats.fewestMistakes === undefined ? mistakes : Math.min(state.soloStats.fewestMistakes, mistakes);
    soloSummary = { rounds, mistakes, correct: target };
    state.history.unshift({ title: "Solomatch", mode: "solo", rounds, mistakes, correct: target, leaveReason: `${rounds} OMGÅNGAR · ${mistakes} FELPLACERADE · ${target} RÄTT PLACERADE` });
  }
  state.roundUnlocked = []; state.lockedTimeline = currentPlacementCorrect ? [...(minePlayer.locked_timeline || []), ...cardsToLock] : minePlayer.locked_timeline || []; state.changeTrackCards = currentSwapCards; state.currentCard = null; state.currentCardMatchCode = null; save();
  return { won, earnedSwapCard, soloSummary };
}
async function dealCard() {
  const match = state.matches.find((item) => item.code === state.activeMatchCode);
  if (!match?.id) throw new Error("Matchdata saknas.");
  const user = await supabaseAuth.user(supabaseAuth.session()?.access_token);
  const rows = await supabaseAuth.dataRequest(`online_matches?id=eq.${match.id}&select=deck,used_track_ids`);
  const matchData = rows[0], deck = expandedMatchDeck(matchData.deck || []); let used = new Set(matchData.used_track_ids || []), available = deck.filter((card) => !used.has(card.id));
  if (!available.length) { const players = await supabaseAuth.dataRequest(`online_players?match_id=eq.${match.id}&select=locked_timeline,turn_cards,current_card`), knownCards = players.flatMap((player) => [...(player.locked_timeline || []), ...(player.turn_cards || []), ...(player.current_card ? [player.current_card] : [])]); used = new Set(knownCards.map((card) => card?.id).filter(Boolean)); available = deck.filter((card) => !used.has(card.id)); if (!available.length) throw new Error("Det finns inga lediga låtar kvar i matchen."); }
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
  const serverCard = rows[0]?.current_card || null, sameCard = state.currentCard?.id === serverCard?.id && state.currentCardMatchCode === match.code, savedGuess = sameCard ? state.currentGuess : null, savedDraft = sameCard ? state.guessDraft : null, savedFinalized = sameCard ? state.guessFinalized : null, savedPlacement = sameCard ? state.placementDraft : null;
  state.roundUnlocked = rows[0]?.turn_cards || [];
  state.lockedTimeline = rows[0]?.locked_timeline || state.lockedTimeline;
  state.currentCard = serverCard; state.currentCardMatchCode = state.currentCard ? match.code : null; state.changeTrackCards = rows[0]?.swap_cards || 0; if (isSoloMatch(match)) state.soloProgress[match.code] ||= { correct: state.lockedTimeline.length, mistakes: Math.max(0, (rows[0]?.rounds_started || 0) - Math.max(0, state.lockedTimeline.length - 1)) };
  save(); resetTurnInput();
  if (savedGuess) state.currentGuess = savedGuess;
  if (savedFinalized) state.guessFinalized = savedFinalized;
  if (savedDraft) { state.guessDraft = savedDraft; $("#guess-artist").value = savedDraft.artist || ""; $("#guess-track").value = savedDraft.title || ""; }
  if (savedPlacement && state.currentCard && savedPlacement.cardId === state.currentCard.id && Number.isInteger(savedPlacement.position)) placeCard(savedPlacement.position);
  save();
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
  const solo = isSoloMatch(state.matches.find((match) => match.code === state.activeMatchCode));
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
  if (soloOutcome?.won) { $("#result-continue").hidden = true; dialog(`Grattis, du har nu 10 rätt placerade kort och matchen är slut. Du klarade det med ${soloOutcome.soloSummary.mistakes} felplacerade kort efter ${soloOutcome.soloSummary.rounds} omgångar.`); }
  else if (earnedSwapCard) dialog(solo ? "Grattis, du vann ett byt-låt-kort eftersom du gissade rätt för både artist och låtnamn! Byt-låt-kort påverkar inte antalet genomförda omgångar." : "Grattis, du vann ett byt-låt-kort eftersom du gissade rätt för både artist och låtnamn!");
  else if (hasCorrectSongGuess(resultCard) && state.changeTrackCards >= 3) dialog("Du gissade rätt för både artist och låtnamn, men du har redan 3/3 byt-låt-kort.");
  else if (!currentPlacementCorrect && !solo) dialog("Du placerade kortet på fel plats. Turen har gått över till nästa spelare.");
});
$("#result-continue").addEventListener("click", async () => { const solo = isSoloMatch(state.matches.find((match) => match.code === state.activeMatchCode)); state.pendingResult = null; if (!solo) state.roundUnlocked.push({ ...activeCard(), status: "OLÅST" }); save(); try { if (solo) await markRoundStarted(); else await saveRoundUnlocked(); await dealCard(); await syncMatches(); } catch (error) { alert(error.message); return; } resultIsLocked = false; $("#result-back").hidden = false; resetTurnInput(); showView("guess"); startCurrentTrack(); });
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
$("#result-back").addEventListener("click", () => { if (returnToFinalResult && historyResultEntry) { returnToFinalResult = false; viewingLatestRound = false; showHistoryResult(historyResultEntry); } else if (viewingHistoryResult) { viewingHistoryResult = false; viewingLatestRound = false; showView("home", true); } else if (viewingLatestRound) { viewingLatestRound = false; showView("match"); } else if (!currentPlacementCorrect) { state.roundUnlocked = []; save(); showView("home", true); } else showView("match"); });
$("#brand-home").addEventListener("click", () => showView(currentView === "welcome" ? "welcome" : "home"));
$("#install-app").addEventListener("click", () => dialog("I Safari: tryck på Dela-knappen längst ned, välj Lägg till på hemskärmen och bekräfta."));
const pushKeyBytes = (value) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (character) => character.charCodeAt(0));
$("#enable-notifications").addEventListener("click", async () => { try { if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("Notiser stöds inte i den här webbläsaren."); const registration = await navigator.serviceWorker.ready, existingSubscription = await registration.pushManager.getSubscription(); if (state.pushNotificationsEnabled) { if (existingSubscription) { await supabaseAuth.dataRequest(`push_subscriptions?endpoint=eq.${encodeURIComponent(existingSubscription.endpoint)}`, null, "DELETE"); await existingSubscription.unsubscribe(); } state.pushNotificationsEnabled = false; save(); render(); dialog("Notiser är inaktiverade på den här enheten."); return; } const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission(); if (permission !== "granted") throw new Error("Notiser tilläts inte. Du kan ändra detta i iPhones inställningar."); const key = window.DIGIHITS_VAPID_PUBLIC_KEY; if (!key) throw new Error("Notisservern är inte klar ännu."); const subscription = existingSubscription || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushKeyBytes(key) }); const user = await supabaseAuth.user(supabaseAuth.session()?.access_token), endpoint = encodeURIComponent(subscription.endpoint), data = { endpoint: subscription.endpoint, user_id: String(user.id), subscription: subscription.toJSON() }, existing = await supabaseAuth.dataRequest(`push_subscriptions?endpoint=eq.${endpoint}&select=endpoint`); if (existing.length) await supabaseAuth.dataRequest(`push_subscriptions?endpoint=eq.${endpoint}`, data, "PATCH"); else await supabaseAuth.dataRequest("push_subscriptions", data, "POST"); state.pushNotificationsEnabled = true; save(); render(); dialog("Notiser är aktiverade på den här enheten."); } catch (error) { dialog(error.message); } });
window.addEventListener("popstate", (event) => {
  if (resultIsLocked && currentView === "result") { history.pushState({ view: "result" }, "", "#result"); return; }
  if (event.state?.view === "guess" && state.guessFinalized?.matchCode === state.activeMatchCode && state.guessFinalized?.cardId === activeCard()?.id) { history.replaceState({ view: "timeline" }, "", "#timeline"); showView("timeline", false, true); return; }
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
document.querySelectorAll("input, textarea").forEach((field) => { if (field.type === "password") field.autocomplete = /login|current/.test(field.id) ? "current-password" : "new-password"; else if (field.type === "email") field.autocomplete = "email"; else field.autocomplete = "off"; field.setAttribute("autocorrect", "off"); field.setAttribute("autocapitalize", "off"); field.spellcheck = false; });
document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view, button.classList.contains("lobby-back"))));
document.querySelectorAll("[data-accordion]").forEach((section) => {
  section.querySelector(".accordion-toggle").addEventListener("click", () => {
    const open = section.classList.toggle("is-open");
    section.querySelector(".accordion-toggle").setAttribute("aria-expanded", String(open));
    if (section.id === "friends-section" && open) syncFriends().catch(() => {});
  });
});
$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = $("#login-submit"); if (submit.disabled) return; submit.disabled = true; $("#login-progress").hidden = false;
  try {
    const data = await supabaseAuth.signIn($("#login-email").value.trim(), $("#login-password").value);
    $("#player-email").textContent = data.user.email;
    state.playerName = data.user.user_metadata?.display_name || state.playerName;
    save(); render(); closeHomeAccordions(); showView("home"); startRealtime(); syncMatches().catch(() => {}); syncFriends().catch(() => {});
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

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js?v=3.92").catch(() => {});
render();
if ((window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone) && supabaseAuth.session()?.access_token && window.Notification?.permission === "default") setTimeout(() => dialog("Vill du slå på notiser för Digihits? Du får en notis när det är din tur eller när du får en matchinbjudan.", () => $("#enable-notifications").click(), false, "AKTIVERA NOTISER"), 700);
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
    $("#player-email").textContent = user.email; state.playerName = user.user_metadata?.display_name || state.playerName; state.userId = user.id; save(); render();
    await syncMatches(); await syncFriends(); await restoreRoundUnlocked(); startRealtime();
    try { const spotify = await supabaseAuth.consumeSpotify(); if (spotify) { render(); dialog(`Spotify Premium är anslutet som ${spotify.name}.`); } } catch (error) { alert(error.message); }
    const view = location.hash.slice(1) || "home";
    if (view === "match" && state.activeMatchCode) openMatch(state.activeMatchCode);
    else if (view === "lobby" && state.activeMatchCode) openLobby(state.activeMatchCode);
    else if (view === "result" && state.activeMatchCode) await restoreResultView();
    else if (view === "chat" && state.chatMatchCode) { showView("chat", false, true); await loadChat(); }
    else if (view === "friend-chat" && state.friendChatId) { showView("friend-chat", false, true); await loadFriendChat(); }
    else showView(view === "welcome" ? "home" : view, new URLSearchParams(location.search).get("matches") === "1", true);
  }).catch((error) => { if (error?.message === "SESSION_EXPIRED") { supabaseAuth.signOut(); showView("welcome"); return; } showView(location.hash.slice(1) || "home", false, true); });
} else document.documentElement.classList.remove("booting");

// Kontofria Apple Music/iTunes-previews. Ingen Spotify-inloggning eller SDK används.
let applePreviewAudio = null, applePreviewCardId = null, applePreviewPreparing = null;
$(".brand small").textContent = "v4.29";
const unsuitableAppleVersion = /(cover|karaoke|instrumental|tribute|live|sped up|slowed|nightcore|re-recorded|remix)/i;
supabaseAuth.spotify = () => ({ name: "Apple-previews" });
supabaseAuth.consumeSpotify = async () => null;
function itunesJsonp(url) {
  return new Promise((resolve, reject) => {
    const callback = `digihitsApple_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script"); let timer;
    const clean = () => { clearTimeout(timer); script.remove(); delete window[callback]; };
    const fail = () => { clean(); reject(new Error("Kunde inte hämta låtpreview just nu.")); };
    timer = setTimeout(fail, 10000);
    window[callback] = (data) => { clean(); resolve(data); };
    script.onerror = fail; script.src = `${url}&callback=${callback}`; document.head.append(script);
  });
}
async function resolveApplePreview(card) {
  const cached = state.selectedTracks[card.id];
  if (cached?.preview_url) return cached;
  const endpoint = new URL("https://zttkujhoyuxerdewofkb.supabase.co/functions/v1/apple-preview");
  endpoint.search = new URLSearchParams({ title: card.title, artist: card.artist });
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error("Kunde inte hämta låtpreview just nu.");
  const data = await response.json();
  const title = normaliseTrackText(card.title), artist = normaliseTrackText(card.artist);
  const songs = data.results || [];
  const titleMatch = (song) => { const value = normaliseTrackText(song.trackName); return value === title || value.startsWith(title) || title.startsWith(value); };
  const artistMatch = (song) => { const value = normaliseTrackText(song.artistName); return value === artist || value.includes(artist) || artist.includes(value); };
  const track = songs.find((song) => song.previewUrl && titleMatch(song) && artistMatch(song) && !unsuitableAppleVersion.test(`${song.trackName} ${song.collectionName || ""}`));
  if (!track) { const error = new Error("Det finns ingen spelbar preview för den låten."); error.code = "APPLE_TRACK_NOT_FOUND"; throw error; }
  const resolved = { preview_url: track.previewUrl, duration_ms: 30000 };
  state.selectedTracks[card.id] = resolved; save();
  return resolved;
}
function appleAudio() {
  if (applePreviewAudio) return applePreviewAudio;
  applePreviewAudio = new Audio(); applePreviewAudio.preload = "auto";
  applePreviewAudio.addEventListener("timeupdate", () => updateSongTimeline(applePreviewAudio.currentTime * 1000, (Number.isFinite(applePreviewAudio.duration) ? applePreviewAudio.duration : 30) * 1000, !applePreviewAudio.paused));
  applePreviewAudio.addEventListener("ended", () => setPlayButton(false));
  applePreviewAudio.addEventListener("error", () => { songStarting = false; setPlayButton(false); });
  return applePreviewAudio;
}
async function prepareApplePreview(card = activeCard()) {
  const track = await resolveApplePreview(card), audio = appleAudio();
  if (applePreviewCardId !== card.id || audio.src !== track.preview_url) { audio.pause(); audio.src = track.preview_url; audio.load(); applePreviewCardId = card.id; }
  return track;
}
async function playCurrentTrack(retry = true) {
  songStarting = true; $("#play-sample").textContent = "LÅTEN STARTAR…"; $("#play-sample").className = "button button-green";
  try {
    const card = activeCard();
    const track = await prepareApplePreview(card), audio = appleAudio();
    audio.pause(); audio.currentTime = 0;
    await audio.play();
    wasPausedByUser = false; pausedForNavigation = false; songStarting = false;
    updateSongTimeline(0, track.duration_ms, true); setPlayButton(true);
  } catch (error) {
    if (retry && error?.code === "APPLE_TRACK_NOT_FOUND") { await dealCard(); return playCurrentTrack(false); }
    songStarting = false; setPlayButton(false); throw error;
  }
}
function setPlayButton(playing) { if (!playing && songStarting) return; spotifyPlaying = playing; $("#play-sample").textContent = playing ? "⏸ PAUSA LÅT" : "▶ SPELA LÅT"; $("#play-sample").className = `button ${playing ? "button-secondary" : "button-green"}`; }
function stopCurrentTrack(keepForResume = false) { applePreviewAudio?.pause(); clearInterval(songTimer); pausedForNavigation = keepForResume && Boolean(state.currentCard && applePreviewCardId === state.currentCard.id); if (!keepForResume) { applePreviewCardId = null; } setPlayButton(false); }
function startCurrentTrack() { clearInterval(songTimer); applePreviewAudio?.pause(); applePreviewCardId = null; songPosition = 0; songDuration = 0; $("#song-timeline").hidden = true; wasPausedByUser = false; pausedForNavigation = false; songStarting = false; setPlayButton(false); applePreviewPreparing = prepareApplePreview().catch(() => null).finally(() => { applePreviewPreparing = null; }); }
function resumeRoundTrack() { if (!pausedForNavigation || !applePreviewAudio || applePreviewCardId !== state.currentCard?.id) return; applePreviewAudio.play().then(() => { pausedForNavigation = false; setPlayButton(true); }).catch(() => {}); }
$("#play-sample").addEventListener("click", async (event) => { event.stopImmediatePropagation(); try { if (applePreviewPreparing) await applePreviewPreparing; const audio = appleAudio(); if (!audio.paused && applePreviewCardId === state.currentCard?.id) { audio.pause(); wasPausedByUser = true; setPlayButton(false); } else if ((wasPausedByUser || pausedForNavigation) && applePreviewCardId === state.currentCard?.id) { await audio.play(); wasPausedByUser = false; pausedForNavigation = false; setPlayButton(true); } else await playCurrentTrack(); } catch (error) { alert(error.message); } }, true);
$("#replay-track").addEventListener("click", async (event) => { event.stopImmediatePropagation(); try { if (applePreviewPreparing) await applePreviewPreparing; await playCurrentTrack(); } catch (error) { alert(error.message); } }, true);
