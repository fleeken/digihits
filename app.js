const APP_VERSION = "6.72"
document.querySelector("#brand-home small").textContent = `v${APP_VERSION}`;
const currentHomeImage = document.querySelector(".home-illustration img");
if (currentHomeImage) currentHomeImage.src = "assets/home-friends-clean-lamp-v659.webp?v=6.59";
const storageKey = "digihits-home-v1";
const state = JSON.parse(localStorage.getItem(storageKey) || "null") || {
  playerName: "Spelare",
  matches: [],
  history: []
};
state.history = (state.history || []).slice(0, 5);
state.matches = state.matches.filter((match) => !match.isTest);
state.stats ||= { wins: 0, losses: 0, walkovers: 0, streak: 0 };
state.stats.currentStreak ||= 0;
state.stats.walkoverLeaves ||= 0;
state.stats.achievementXp ||= 0;
state.stats.comebackReady ??= false;
state.onlineCorrect ||= 0;
state.soloStats ||= { bestRounds: null, fewestMistakes: null };
state.soloProgress ||= {};
state.settledResults ||= [];
state.archivedResults ||= [];
state.selfWalkovers ||= [];
state.selectedTracks ||= {};
state.recentTrackIds ||= [];
state.changeTrackCards ??= 0;
state.pendingSwapAward ||= null;
state.achievements ||= {};
state.dailyAchievements ||= {};
state.dailyProgress ||= {};
state.achievementAccounts ||= {};
state.menuSeenByUser ||= {};
state.avatar ||= { skin: "Mellan", hair: "Kort", beard: "Ingen", hat: "Ingen", top: "T-shirt", legs: "Jeans", shoes: "Sneakers", accessory: "Inget", piercing: "Ingen" };
state.avatar.eyes ||= "Runda";
state.career ||= { onlineMatchesCreated: 0, playedWith: [], dailyOpponents: {}, fullHouse: false };
state.career.onlineMatchesCreated ||= 0;
state.career.createdMatchCodes ||= [];
state.career.startedMatchCodes ||= [];
state.career.playedWith ||= [];
state.career.friendIds ||= [];
state.career.dailyOpponents ||= {};
state.career.fullHouse ??= false;
state.friendCareerOpen ||= {};
state.swapUsedThisRound ??= false;
state.roundResumeViews ||= {};
state.roundAnimationSeen ||= {};
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
state.seenFinalChanceNotices ||= {};
let currentPlacementCorrect = true, roundLoading = false;
let viewingLatestRound = false, viewingHistoryResult = false, returnToFinalResult = false, latestRoundReturnView = "match", historyResultEntry = null, historyResultRounds = 0, historyPlayerScores = {}, matchInviteCandidates = [];
let achievementPopupQueue = [];
const menuViewState = { home: "home", matches: "matches", friends: "friends", career: "career", "game-history": "game-history" };
let pendingTimelineDeal = null;
let skipCardDeal = false;
const activeCardDealAnimations = new Set();
const latestRounds = {};
let spotifyPlayer, spotifyDeviceId, spotifyPlayerReady, spotifyPlaying = false, wasPausedByUser = false, pausedForNavigation = false, loadedSpotifyCardId = null, songPosition = 0, songDuration = 0, songTimer, trackStartPromise = null, songStarting = false;
const mobileBrowser = /iPhone|iPad|Android/i.test(navigator.userAgent);
const testDeck = [...window.DIGIHITS_TRACKS.reduce((tracks, card) => {
  tracks.set(`${card.artist}:${card.title}`.toLowerCase(), card);
  return tracks;
}, new Map()).values()];
const activeCard = () => state.currentCard || testDeck[5];
const animationWait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
function animationStage() {
  let stage = document.querySelector("#card-animation-stage");
  if (!stage) { stage = document.createElement("div"); stage.id = "card-animation-stage"; stage.setAttribute("aria-hidden", "true"); document.body.append(stage); }
  return stage;
}
const animationDeck = () => `<div class="card-deck"><em class="dealer-arm"><u></u></em>${Array.from({ length: 10 }, (_, index) => `<i style="--deck-index:${index}"></i>`).join("")}<b><span>♫</span>HEMLIGA LÅTKORT</b></div>`;
const isUnlockedStatus = (status = "") => ["OLÅST", "OLÅST KORT", "LÅST DENNA OMGÅNG"].includes(status);
const cardStatusLabel = (status = "") => isUnlockedStatus(status) ? "OLÅST KORT" : /FEL ?PLACERAT/.test(status) ? "FELPLACERAT" : status === "LÅST" ? "LÅST KORT" : status;
const animationCard = (card, className = "", secret = false) => `<article class="animation-card ${className}"><span>♫</span><strong>${secret ? "????" : card?.year || "????"}</strong><small>${secret ? "HEMLIGT KORT" : `${escapeHtml(card?.title || "HEMLIGT KORT")}<br>${escapeHtml(card?.artist || "")}`}</small></article>`;
async function animateCardDeal(card, starter = null, beforeClose = null) {
  beforeClose?.(); return;
  skipCardDeal = false;
  const stage = animationStage();
  stage.innerHTML = animationDeck(); stage.className = "is-active is-dealing";
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const fly = async (flyingCard, secret, target, duration) => {
    if (!target || skipCardDeal) return;
    const deckBounds = stage.querySelector(".card-deck").getBoundingClientRect(), topCardBounds = stage.querySelector(".card-deck i:last-of-type").getBoundingClientRect();
    const targetBounds = target.getBoundingClientRect();
    stage.insertAdjacentHTML("beforeend", animationCard(flyingCard, "fly-card", secret));
    const element = stage.lastElementChild;
    const sourceScale = Math.max(.24, Math.min(.58, Math.min(topCardBounds.width / targetBounds.width, topCardBounds.height / targetBounds.height))), startX = topCardBounds.left + topCardBounds.width / 2 - targetBounds.width / 2, startY = topCardBounds.top + topCardBounds.height / 2 - targetBounds.height / 2, exitX = startX - targetBounds.width * .62, exitY = startY - targetBounds.height * .1;
    Object.assign(element.style, { left: `${startX}px`, top: `${startY}px`, width: `${targetBounds.width}px`, height: `${targetBounds.height}px` });
    target.classList.add("deal-target");
    const start = { x: 0, y: 0 }, exit = { x: exitX - startX, y: exitY - startY }, finish = { x: targetBounds.left - startX, y: targetBounds.top - startY }, control = { x: (exit.x + finish.x) / 2, y: Math.min(exit.y, finish.y) - 105 };
    const curve = Array.from({ length: 12 }, (_, index) => { const t = (index + 1) / 12, inverse = 1 - t; return { x: inverse * inverse * exit.x + 2 * inverse * t * control.x + t * t * finish.x, y: inverse * inverse * exit.y + 2 * inverse * t * control.y + t * t * finish.y, t }; });
    const loosened = { x: exit.x * .62, y: exit.y * .35 }, lifted = { x: exit.x, y: exit.y }, points = [start, loosened, lifted, ...curve];
    const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y)), totalLength = lengths.reduce((sum, length) => sum + length, 0), offsets = [0, .18, .34, ...curve.map((_, index) => .34 + .66 * ((index + 1) / curve.length))];
    const travelDuration = Math.max(duration, Math.min(3300, totalLength / .24));
    const frames = points.map((point, index) => { const t = point.t ?? 0, scale = index === 0 ? sourceScale : index === 1 ? sourceScale + (1 - sourceScale) * .3 : index === 2 ? .82 : 1 + Math.sin(Math.PI * t) * .02, rotation = index === 0 ? -7 : index === 1 ? -6 : index === 2 ? -2.5 : Math.sin(Math.PI * t * 2) * 1.5; return { offset: offsets[index], transform: `translate3d(${point.x}px,${point.y}px,0) rotate(${rotation}deg) scale(${scale})`, opacity: 1 }; });
    element.style.transform = frames[0].transform; element.style.opacity = "0.98";
    stage.classList.add("is-extracting");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const movement = element.animate(frames, { duration: travelDuration, easing: "linear", fill: "forwards" }); activeCardDealAnimations.add(movement);
    await movement.finished.catch(() => {}); activeCardDealAnimations.delete(movement);
    stage.classList.remove("is-extracting"); target.classList.remove("deal-target"); target.classList.add("deal-arrived"); element.remove();
    setTimeout(() => target.classList.remove("deal-arrived"), 700);
    await animationWait(220);
  };
  await animationWait(1050);
  if (starter) await fly(starter, false, $("#timeline-row .year-card"), 1600);
  await fly(card, true, $("#secret-card"), 1750);
  if (!skipCardDeal) { stage.classList.add("is-leaving"); await animationWait(750); }
  beforeClose?.();
  stage.className = ""; stage.replaceChildren();
}
async function enterNewCardGuess() {
  pendingTimelineDeal = null;
  showView("guess");
  startCurrentTrack();
}
document.addEventListener("pointerdown", () => { const stage = document.querySelector("#card-animation-stage.is-dealing"); if (!stage) return; skipCardDeal = true; activeCardDealAnimations.forEach((animation) => { try { animation.finish(); } catch {} }); }, true);
async function animateSwapReveal(card) {
  const stage = animationStage();
  stage.innerHTML = `<div class="swap-reveal-copy">KORTET DU BYTER UT</div><div class="swap-flip-scene"><article class="swap-flip-card"><div class="swap-flip-face swap-flip-back"><span>♫</span><strong>HEMLIGT KORT</strong><small>År: ????</small></div><div class="swap-flip-face swap-flip-front"><span>♫</span><strong>${escapeHtml(card?.artist || "Okänd artist")}</strong><b>${escapeHtml(card?.title || "Okänd låt")}</b><small>${escapeHtml(card?.year || "????")}</small></div></article></div>`;
  stage.className = "is-active is-swap";
  await animationWait(5200);
  stage.className = ""; stage.replaceChildren();
}
async function animateTimelineOutcome(correct) {
  return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const row = document.querySelector("#result-timeline") || document.querySelector("#timeline-row");
  if (!row) return;
  const affected = [...row.querySelectorAll(correct ? ".unlocked-card, .correct-card" : ".unlocked-card, .misplaced-card")];
  if (!affected.length) return;
  await animationWait(correct ? 700 : 5000);
  const stage = animationStage();
  if (correct) {
    row.classList.add("locking-cards");
    affected.forEach((item, index) => item.style.setProperty("--card-delay", `${index * 180}ms`));
    await animationWait(1650 + affected.length * 180);
    row.classList.remove("locking-cards"); affected.forEach((item) => item.style.removeProperty("--card-delay")); return;
  }
  stage.innerHTML = animationDeck(); stage.className = "is-active deck-only is-dealing";
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const deck = stage.querySelector(".card-deck").getBoundingClientRect(), targetX = deck.left + deck.width / 2, targetY = deck.top + deck.height / 2;
  await Promise.all(affected.map((item, index) => { const bounds = item.getBoundingClientRect(), dx = targetX - (bounds.left + bounds.width / 2), dy = targetY - (bounds.top + bounds.height / 2); return item.animate([{ transform: "translateY(-12px)", opacity: 1, filter: "none" }, { offset: .2, transform: "translateY(-12px) scale(1.04)", boxShadow: "0 0 26px #ff536f", borderColor: "#ff536f" }, { transform: `translate(${dx}px,${dy}px) rotate(${8 + index * 4}deg) scale(.28)`, opacity: 0, filter: "hue-rotate(325deg)" }], { duration: 1750, delay: index * 330, easing: "cubic-bezier(.42,0,.72,.35)", fill: "forwards" }).finished; }));
  affected.forEach((item) => item.remove()); row.classList.add("timeline-centered"); row.scrollTo({ left: Math.max(0, (row.scrollWidth - row.clientWidth) / 2), behavior: "smooth" });
  await animationWait(1000); stage.className = ""; stage.replaceChildren();
}
const roundStripMarkup = new WeakMap();
function renderRoundPlayers() {
  const match = state.matches.find((item) => item.code === state.activeMatchCode), players = match?.players || [];
  const finalSummary = $("#final-match-overview"), isFinal = finalSummary && !finalSummary.hidden;
  const round = Math.max(1, Number(match?.round) || 0, ...players.map((player) => Number(player.rounds_started) || 0));
  document.querySelectorAll(".view-round-number").forEach((label) => {
    label.hidden = !match || isSoloMatch(match) || (label.closest('[data-view-panel="result"]') && isFinal);
    if (label.dataset.round !== String(round)) { label.innerHTML = `Omgång <strong>${round}</strong>`; label.dataset.round = String(round); }
  });
  document.querySelectorAll(".round-player-strip").forEach((strip) => {
    const hidden = isSoloMatch(match) || !players.length || (strip.id === "result-player-strip" && isFinal);
    const banner = strip.closest(".match-turn-banner");
    if (banner) banner.hidden = hidden;
    if (hidden) { strip.hidden = true; return; }
    strip.hidden = false;
    strip.dataset.playerCount = String(players.length);
    const markup = `<div>${players.map((player) => { const current = String(player.user_id) === String(match.currentUserId), score = Math.max(1, Array.isArray(player.locked_timeline) ? player.locked_timeline.length : Number(player.last_round?.score?.correct) || 1), friend = state.friends.find((item) => String(item.friend_id) === String(player.user_id)), avatar = String(player.user_id) === String(state.userId) ? ownAvatarChoice() : avatarChoice(friend || player), name = String(player.display_name || "Spelare"), turnLabel = `${name}${/s$/i.test(name) ? "" : "s"} tur`; latestRounds[player.user_id || player.id] = player.last_round; return `<button type="button" class="round-player ${current ? "is-current" : ""}" data-round-player="${escapeHtml(player.user_id || player.id)}"><i class="avatar-art" style="${avatarArtStyle(avatar.genre, avatar.variant)}"></i><span><strong>${escapeHtml(name)}</strong><b>${score}/10</b></span>${current ? `<small>${escapeHtml(turnLabel)}</small>` : ""}</button>`; }).join("")}</div>`;
    // Compare source markup, not browser-normalized HTML; retain avatars and scroll on unchanged syncs.
    if (roundStripMarkup.get(strip) !== markup) { strip.innerHTML = markup; roundStripMarkup.set(strip, markup); }
  });
}
function updateRoundStartButton() {
  if (roundLoading) return;
  const button = $("#next-round"), match = state.matches.find((item) => item.code === state.activeMatchCode);
  if (!button || !match) return;
  const pending = state.pendingResult?.matchCode === match.code || (state.currentCard && (!state.currentCardMatchCode || state.currentCardMatchCode === match.code)) || (match.status === "active" && ["guess", "timeline", "result"].includes(state.roundResumeViews[match.code]));
  const started = (match.players || []).some((player) => Number(player.rounds_started) > 0);
  button.textContent = pending ? (isSoloMatch(match) ? "ÅTERUPPTA MATCH" : "ÅTERUPPTA OMGÅNG") : started ? "STARTA NÄSTA OMGÅNG" : "STARTA MATCH";
  button.disabled = false;
  button.classList.toggle("is-visible", match.status === "active");
}
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
const answerNumbers = { zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10", noll: "0", en: "1", ett: "1", tva: "2", tre: "3", fyra: "4", fem: "5", sex: "6", sju: "7", atta: "8", nio: "9", tio: "10" };
const answerText = (value) => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).map((word) => answerNumbers[word] || word).filter((word) => !["the", "a", "an", "en", "ett", "den", "det", "de", "and", "och"].includes(word)).join("");
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
if (document.documentElement.classList.contains("spotify-callback")) $("#spotify-connecting").hidden = false;
let currentView = "welcome", chatPoll = 0, realtimeFallbackPoll = 0, realtimeRefreshing = false;
let profileReturnView = "home", profileReturnMenu = "home";
const menuForView = (view) => ["match", "lobby", "guess", "timeline", "result", "chat", "matches"].includes(view) ? "matches" : ["friends", "career", "game-history"].includes(view) ? view : "home";
let resultIsLocked = false;
const code = () => Array.from({ length: 6 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
function dialog(message, action, danger = false, confirmText = "FORTSÄTT", cancelText = "AVBRYT") {
  $("#dialog-message").classList.remove("level-rules"); $("#dialog-message").textContent = message; $("#dialog-cancel").hidden = !action; $("#dialog-cancel").textContent = cancelText; $("#dialog-confirm").textContent = action ? confirmText : "OK"; $("#dialog-confirm").className = `button ${danger ? "button-leave" : "button-primary"}`; $("#app-dialog").hidden = false;
  $("#dialog-cancel").onclick = () => { $("#app-dialog").hidden = true; };
  $("#dialog-confirm").onclick = () => { $("#app-dialog").hidden = true; action?.(); };
}
function dialogProgress(message) { const progress = document.createElement("div"); progress.id = "dialog-progress"; progress.className = "dialog-progress"; progress.innerHTML = "<i></i>"; $("#dialog-message").textContent = message; $("#dialog-message").after(progress); $("#dialog-cancel").hidden = true; $("#dialog-confirm").hidden = true; $("#app-dialog").hidden = false; }
function closeDialogProgress() { $("#dialog-progress")?.remove(); $("#dialog-confirm").hidden = false; $("#app-dialog").hidden = true; }
window.alert = (message) => dialog(String(message));

function save() {
  state.history = state.history.slice(0, 5);
  if (state.userId) state.achievementAccounts[state.userId] = { achievements: { ...state.achievements }, dailyAchievements: { ...state.dailyAchievements }, dailyProgress: { ...state.dailyProgress } };
  localStorage.setItem(storageKey, JSON.stringify(state));
}
function activateAchievementAccount(userId) {
  const id = String(userId), previousId = state.userId && String(state.userId);
  if (previousId) state.achievementAccounts[previousId] = { achievements: { ...state.achievements }, dailyAchievements: { ...state.dailyAchievements }, dailyProgress: { ...state.dailyProgress } };
  const saved = state.achievementAccounts[id];
  state.userId = id;
  state.achievements = saved ? { ...(saved.achievements || {}) } : previousId && previousId !== id ? {} : { ...state.achievements };
  state.dailyAchievements = saved ? { ...(saved.dailyAchievements || {}) } : previousId && previousId !== id ? {} : { ...state.dailyAchievements };
  state.dailyProgress = saved ? { ...(saved.dailyProgress || {}) } : previousId && previousId !== id ? {} : { ...state.dailyProgress };
  achievementPopupQueue = [];
  save();
}
async function loadPermanentAchievements(userId) {
  try {
    const rows = await supabaseAuth.dataRequest("digihits_profiles?id=eq." + encodeURIComponent(userId) + "&select=career_achievements");
    const keys = Array.isArray(rows?.[0]?.career_achievements) ? rows[0].career_achievements : [];
    keys.forEach((id) => state.achievements[id] = true);
    state.stats.achievementXp = Math.max(Number(state.stats.achievementXp) || 0, Object.values(state.achievements).filter(Boolean).length * 3);
    save();
  } catch { /* lokalt kontosparande används om profilen inte kan läsas */ }
}
const avatarChoices = { skin: ["Ljus", "Mellan", "Mörk"], hair: ["Kort", "Lockigt", "Långt", "Mohawk", "Flätor"], beard: ["Ingen", "Skägg", "Mustasch", "Stubb"], hat: ["Ingen", "Keps", "Beanie", "Hatt", "Cowboyhatt"], top: ["T-shirt", "Skinnjacka", "Hoodie", "Glitterjacka", "Kavaj"], legs: ["Jeans", "Skinnbyxor", "Vida byxor", "Kjol"], shoes: ["Sneakers", "Boots", "Platåskor", "Cowboyboots"], accessory: ["Inget", "Solglasögon", "Kedja", "Hörlurar", "Gitarr"], piercing: ["Ingen", "Näsring", "Öronring", "Ögonbrynspiercing"] };
const avatarGenres = { Pop: { top: "Glitterjacka", shoes: "Sneakers", accessory: "Solglasögon", hair: "Långt" }, Rock: { top: "Skinnjacka", legs: "Skinnbyxor", shoes: "Boots", accessory: "Gitarr", beard: "Stubb" }, Hiphop: { top: "Hoodie", hat: "Keps", shoes: "Sneakers", accessory: "Kedja" }, Disco: { top: "Glitterjacka", legs: "Vida byxor", shoes: "Platåskor", accessory: "Solglasögon" }, Country: { top: "Kavaj", hat: "Cowboyhatt", shoes: "Cowboyboots", legs: "Jeans" }, Punk: { hair: "Mohawk", top: "Skinnjacka", shoes: "Boots", piercing: "Näsring" }, EDM: { top: "Hoodie", accessory: "Hörlurar", hair: "Flätor", shoes: "Sneakers" }, Jazz: { top: "Kavaj", hat: "Hatt", shoes: "Boots", accessory: "Solglasögon" } };
const avatarRandom = (part) => avatarChoices[part][Math.floor(Math.random() * avatarChoices[part].length)];
function renderAvatar() { const panel = $("#avatar-panel"); if (!panel) return; const a = state.avatar, skin = { Ljus: "#f4c7a1", Mellan: "#c7865c", Mörk: "#71452d" }[a.skin], hair = { Kort: "#352014", Lockigt: "#6c432a", Långt: "#1a1513", Mohawk: "#c53b75", Flätor: "#2a2022" }[a.hair], top = { "T-shirt": "#4fc9ee", Skinnjacka: "#25252c", Hoodie: "#7956cf", Glitterjacka: "#d29b33", Kavaj: "#496a94" }[a.top], legs = { Jeans: "#355b98", Skinnbyxor: "#25252c", "Vida byxor": "#8d477f", Kjol: "#c84c72" }[a.legs], hat = { Ingen: "", Keps: "🧢", Beanie: "🧶", Hatt: "🎩", Cowboyhatt: "🤠" }[a.hat], accessory = { Inget: "", Solglasögon: "🕶️", Kedja: "⛓️", Hörlurar: "🎧", Gitarr: "🎸" }[a.accessory], face = { Ingen: "🙂", Skägg: "🧔", Mustasch: "🥸", Stubb: "😎" }[a.beard], piercing = { Ingen: "", Näsring: "·", Öronring: "◌", Ögonbrynspiercing: "˙" }[a.piercing]; panel.innerHTML = `<h3>MIN ARTIST-AVATAR</h3><div class="avatar-layout"><div class="artist-avatar" style="--skin:${skin};--hair:${hair};--top:${top};--legs:${legs}"><i class="avatar-hat">${hat}</i><i class="avatar-hair"></i><i class="avatar-head"></i><i class="avatar-face">${face}${piercing}</i><i class="avatar-body"></i><i class="avatar-accessory">${accessory}</i><i class="avatar-legs"></i><i class="avatar-shoes">${a.shoes === "Sneakers" ? "👟" : a.shoes === "Boots" ? "🥾" : a.shoes === "Platåskor" ? "👠" : "🤠"}</i></div><div class="avatar-controls">${Object.entries(avatarChoices).map(([part, options]) => `<div class="avatar-control"><label>${({ skin: "HUDTON", hair: "FRISYR", beard: "ANSIKTSBEHÅRING", hat: "HUVUDBONAD", top: "ÖVERKROPP", legs: "BEN", shoes: "SKOR", accessory: "ACCESSOAR", piercing: "PIERCING" })[part]}</label><select data-avatar-part="${part}">${options.map((value) => `<option${a[part] === value ? " selected" : ""}>${value}</option>`).join("")}</select><button class="avatar-random" data-avatar-random="${part}" type="button">SLUMPA</button></div>`).join("")}</div></div><div class="avatar-actions"><button class="button button-purple" data-avatar-random-all type="button">SLUMPA HELA AVATAREN</button></div><div class="avatar-genres"><strong>SLUMPA EFTER GENRE:</strong>${Object.keys(avatarGenres).map((genre) => `<button data-avatar-genre="${genre}" type="button">${genre.toUpperCase()}</button>`).join("")}</div>`; }
document.addEventListener("change", (event) => { const select = event.target.closest("[data-avatar-part]"); if (!select) return; state.avatar[select.dataset.avatarPart] = select.value; save(); renderAvatar(); });
document.addEventListener("click", (event) => { const randomPart = event.target.closest("[data-avatar-random]"), randomAll = event.target.closest("[data-avatar-random-all]"), genre = event.target.closest("[data-avatar-genre]"); if (!randomPart && !randomAll && !genre) return; if (randomPart) state.avatar[randomPart.dataset.avatarRandom] = avatarRandom(randomPart.dataset.avatarRandom); if (randomAll) Object.keys(avatarChoices).forEach((part) => { state.avatar[part] = avatarRandom(part); }); if (genre) Object.assign(state.avatar, Object.fromEntries(Object.keys(avatarChoices).map((part) => [part, avatarRandom(part)])), avatarGenres[genre.dataset.avatarGenre]); save(); renderAvatar(); });
avatarChoices.eyes = ["Runda", "Skarpa", "Glada"];
function renderAvatar() { const panel = $("#avatar-panel"); if (!panel) return; const a = state.avatar, choices = ["skin", "eyes", "hair", "beard", "hat", "top", "accessory", "piercing"], labels = { skin: "HUDTON", eyes: "ÖGON", hair: "FRISYR", beard: "ANSIKTSBEHÅRING", hat: "HUVUDBONAD", top: "ÖVERKROPP", accessory: "ACCESSOAR", piercing: "PIERCING" }, skin = { Ljus: "#f4c7a1", Mellan: "#c7865c", Mörk: "#71452d" }[a.skin], hair = { Kort: "#352014", Lockigt: "#6c432a", Långt: "#1a1513", Mohawk: "#c53b75", Flätor: "#2a2022" }[a.hair], top = { "T-shirt": "#4fc9ee", Skinnjacka: "#24242d", Hoodie: "#7956cf", Glitterjacka: "#d29b33", Kavaj: "#496a94" }[a.top]; panel.innerHTML = `<h3>MIN ARTIST-AVATAR</h3><div class="avatar-layout portrait-layout"><div class="artist-avatar portrait-avatar" style="--skin:${skin};--hair:${hair};--top:${top}"><i class="portrait-shoulders"></i><i class="portrait-neck"></i><i class="portrait-face"></i><i class="portrait-hair hair-${a.hair.toLowerCase().replace("å", "a")}"></i><i class="portrait-eyes eyes-${a.eyes.toLowerCase()}"></i><i class="portrait-nose"></i><i class="portrait-mouth"></i><i class="portrait-beard beard-${a.beard.toLowerCase()}"></i><i class="portrait-hat hat-${a.hat.toLowerCase().replace("å", "a")}"></i><i class="portrait-accessory accessory-${a.accessory.toLowerCase().replaceAll(" ", "-")}"></i><i class="portrait-piercing piercing-${a.piercing.toLowerCase().replace("ö", "o")}"></i></div><div class="avatar-controls">${choices.map((part) => `<div class="avatar-control"><label>${labels[part]}</label><select data-avatar-part="${part}">${avatarChoices[part].map((value) => `<option${a[part] === value ? " selected" : ""}>${value}</option>`).join("")}</select><button class="avatar-random" data-avatar-random="${part}" type="button">SLUMPA</button></div>`).join("")}</div></div><div class="avatar-actions"><button class="button button-purple" data-avatar-random-all type="button">SLUMPA HELA AVATAREN</button></div><div class="avatar-genres"><strong>SLUMPA EFTER GENRE:</strong>${Object.keys(avatarGenres).map((genre) => `<button data-avatar-genre="${genre}" type="button">${genre.toUpperCase()}</button>`).join("")}</div>`; }
// Första riktiga avatarversionen: genre väljer ett faktiskt illustrerat porträtt.
const avatarStyles = ["Pop", "Rock", "Hiphop", "EDM", "Country", "Indie", "R&B", "Metal", "Reggae", "Jazz"];
function renderAvatar() {
  const panel = $("#avatar-panel"); if (!panel) return;
  state.avatar ||= {};
  const genre = avatarStyles.includes(state.avatar.genre) ? state.avatar.genre : "Pop";
  state.avatar.genre = genre;
  const genreClass = genre.toLowerCase();
  const accountAvatar = $("#change-avatar"); if (accountAvatar) accountAvatar.className = `mini-avatar account-avatar mini-${genreClass}`;
  panel.innerHTML = `<h3>MIN ARTIST-AVATAR</h3><div class="genre-avatar-layout"><div class="genre-avatar genre-${genreClass}" role="img" aria-label="${genre}-artist"></div><div class="genre-avatar-copy"><p>Välj en artiststil eller slumpa fram en helt ny look.</p><div class="genre-style-grid">${avatarStyles.map((style) => `<button type="button" class="${style === genre ? "is-selected" : ""}" data-avatar-style="${style}">${style.toUpperCase()}</button>`).join("")}</div><button type="button" class="button avatar-shuffle" data-avatar-style-random>SLUMPA ARTISTSTIL</button><p class="avatar-coming">Detaljval kommer med ett sammanhållet avatarpaket.</p></div></div>`;
}
document.addEventListener("click", (event) => {
  const style = event.target.closest("[data-avatar-style]"), variant = event.target.closest("[data-avatar-variant]"), random = event.target.closest("[data-avatar-style-random]"), saveAvatar = event.target.closest("[data-avatar-save]");
  if (!style && !variant && !random && !saveAvatar) return;
  if (saveAvatar) { persistAvatar().then(() => dialog("Avatar sparad.")); return; }
  state.avatar ||= {};
  state.avatarDirty = true;
  if (variant) state.avatar.variant = Number(variant.dataset.avatarVariant);
  else { state.avatar.genre = style ? style.dataset.avatarStyle : avatarStyles[Math.floor(Math.random() * avatarStyles.length)]; state.avatar.variant = Math.floor(Math.random() * 6); }
  state.selectedAvatar = { genre: state.avatar.genre, variant: state.avatar.variant };
  save(); renderAvatar();
});
const avatarV2Defaults = { skin: "Mellan", eyes: "Brun", eyeShape: "Runda", hair: "Vågor", hairColor: "Mörk", presentation: "Neutral", outfit: "Street", accessory: "Inget", hat: "Ingen", genre: "Pop" };
const avatarV2Options = { skin: ["Ljus", "Mellan", "Mörk"], eyes: ["Brun", "Blå", "Grön", "Grå"], eyeShape: ["Runda", "Skarpa", "Glada"], hair: ["Buzz", "Vågor", "Lockar", "Långt", "Mohawk", "Flätor"], hairColor: ["Mörk", "Brun", "Blond", "Röd", "Lila"], presentation: ["Neutral", "Feminin", "Maskulin", "Androgyn"], outfit: ["Street", "Rock", "Pop", "EDM", "Indie", "Country"], accessory: ["Inget", "Hörlurar", "AirPods", "Glasögon", "Öronringar", "Kedja"], hat: ["Ingen", "Keps", "Beanie"] };
const avatarV2Labels = { skin: "HUDTON", eyes: "ÖGONFÄRG", eyeShape: "ÖGON", hair: "FRISYR", hairColor: "HÅRFÄRG", presentation: "UTTRYCK", outfit: "KLÄDSTIL", accessory: "ACCESSOAR", hat: "HUVUDBONAD" };
const avatarGenrePresets = { Pop: { outfit: "Pop", hair: "Långt", accessory: "Glasögon" }, Rock: { outfit: "Rock", hair: "Vågor", accessory: "Kedja" }, Hiphop: { outfit: "Street", hair: "Flätor", hat: "Keps" }, EDM: { outfit: "EDM", hair: "Buzz", accessory: "Hörlurar" }, Country: { outfit: "Country", hair: "Långt", hat: "Keps" }, Indie: { outfit: "Indie", hair: "Lockar", accessory: "Glasögon" } };
function avatarV2() { state.avatarV2 = { ...avatarV2Defaults, ...(state.avatarV2 || {}) }; return state.avatarV2; }
function avatarArtClass(genre) { return genre === "R&B" ? "rnb" : genre.toLowerCase(); }
function avatarArtStyle(genre, variant) { const col = variant % 2, row = Math.floor(variant / 2); return `--avatar-art:url('assets/avatar-${avatarArtClass(genre)}.png');--avatar-x:${col ? "100" : "0"}%;--avatar-y:${row * 50}%`; }
const avatarPortraitProfiles = [
  { presentation: "Feminin", skin: "Ljus", outfit: "Artistlook 1" }, { presentation: "Maskulin", skin: "Ljus", outfit: "Artistlook 2" },
  { presentation: "Maskulin", skin: "Mörk", outfit: "Artistlook 3" }, { presentation: "Feminin", skin: "Ljus", outfit: "Artistlook 4" },
  { presentation: "Feminin", skin: "Mellan", outfit: "Artistlook 5" }, { presentation: "Androgyn", skin: "Mellan", outfit: "Artistlook 6" }
];
function avatarProfileIndex(traits, fallback = 0) { const wanted = traits || {}, scored = avatarPortraitProfiles.map((profile, index) => ({ index, score: (profile.presentation === wanted.presentation ? 2 : 0) + (profile.skin === wanted.skin ? 2 : 0) + (profile.outfit === wanted.outfit ? 1 : 0) + (index === fallback ? .1 : 0) })); return scored.sort((a, b) => b.score - a.score)[0].index; }
function avatarChoice(value = {}) { let hash = 0; for (const char of String(value.friend_id || value.user_id || value.display_name || "digihits")) hash = (hash * 31 + char.charCodeAt(0)) >>> 0; const genre = avatarStyles.includes(value.avatar_genre || value.genre) ? (value.avatar_genre || value.genre) : avatarStyles[hash % avatarStyles.length], variant = Number.isInteger(Number(value.avatar_variant ?? value.variant)) && Number(value.avatar_variant ?? value.variant) >= 0 && Number(value.avatar_variant ?? value.variant) < 6 ? Number(value.avatar_variant ?? value.variant) : hash % 6; return { genre, variant }; }
function ownAvatarChoice() { const saved = state.selectedAvatar; if (avatarStyles.includes(saved?.genre) && Number.isInteger(Number(saved?.variant)) && Number(saved.variant) >= 0 && Number(saved.variant) < 6) return { genre: saved.genre, variant: Number(saved.variant) }; const choice = avatarChoice({ ...(state.avatar || {}), user_id: state.avatar?.user_id || state.userId, display_name: state.playerName }); state.selectedAvatar = { ...choice }; return choice; }
function updateProfileToggleAvatar() { const button = document.querySelector(".profile-toggle"); if (!button) return; const avatar = ownAvatarChoice(); button.className = "profile-toggle avatar-art"; button.style.cssText = avatarArtStyle(avatar.genre, avatar.variant); button.replaceChildren(); button.setAttribute("aria-label", "Min profil"); }
async function persistAvatar() { const token = supabaseAuth.session()?.access_token, a = ownAvatarChoice(), traits = avatarRig(state.avatar); if (!token) return; await supabaseAuth.dataRequest("rpc/digihits_set_avatar", { chosen_genre: a.genre, chosen_variant: a.variant, chosen_traits: traits }, "POST").catch(() => supabaseAuth.dataRequest("rpc/digihits_set_avatar", { chosen_genre: a.genre, chosen_variant: a.variant }, "POST")).catch(() => {}); state.avatarDirty = false; save(); }
function renderAvatarRig() { const panel = $("#avatar-panel"); if (!panel) return; state.avatar ||= {}; const genre = avatarStyles.includes(state.avatar.genre) ? state.avatar.genre : "Pop", variant = Number.isInteger(state.avatar.variant) && state.avatar.variant >= 0 && state.avatar.variant < 6 ? state.avatar.variant : 0; state.avatar.genre = genre; state.avatar.variant = variant; const accountAvatar = $("#change-avatar"); if (accountAvatar) { accountAvatar.className = "mini-avatar account-avatar avatar-art"; accountAvatar.style.cssText = avatarArtStyle(genre, variant); accountAvatar.replaceChildren(); } panel.innerHTML = `<h3>MIN ARTIST-AVATAR</h3><div class="avatar-choice-layout"><div class="avatar-choice-preview avatar-art" style="${avatarArtStyle(genre, variant)}" role="img" aria-label="${genre}-artist"></div><div class="avatar-choice-copy"><p>Välj genre och sedan en av sex unika artist-avatarer.</p><div class="avatar-genre-grid">${avatarStyles.map((style) => `<button type="button" class="${style === genre ? "is-selected" : ""}" data-avatar-style="${style}">${style.toUpperCase()}</button>`).join("")}</div><div class="avatar-variant-grid">${Array.from({ length: 6 }, (_, index) => `<button type="button" class="avatar-art ${index === variant ? "is-selected" : ""}" style="${avatarArtStyle(genre, index)}" data-avatar-variant="${index}" aria-label="Välj avatar ${index + 1}"></button>`).join("")}</div><button type="button" class="button avatar-shuffle" data-avatar-style-random>SLUMPA AVATAR</button><button type="button" class="button button-green" data-avatar-save>SPARA AVATAR</button></div></div>`; }
document.addEventListener("change", (event) => { const select = event.target.closest("[data-avatar-v2]"); if (!select) return; avatarV2()[select.dataset.avatarV2] = select.value; save(); renderAvatar(); });
document.addEventListener("click", (event) => { const genre = event.target.closest("[data-avatar-v2-genre]"), random = event.target.closest("[data-avatar-v2-random]"); if (!genre && !random) return; const a = avatarV2(); if (genre) Object.assign(a, avatarGenrePresets[genre.dataset.avatarV2Genre], { genre: genre.dataset.avatarV2Genre }); else Object.entries(avatarV2Options).forEach(([part, values]) => a[part] = values[Math.floor(Math.random() * values.length)]); save(); renderAvatar(); });
function friendAvatarStyle(name) { let hash = 0; for (const char of String(name || "")) hash = (hash * 31 + char.charCodeAt(0)) >>> 0; return avatarStyles[hash % avatarStyles.length].toLowerCase(); }
function renderAvatarRig() { const panel = $("#avatar-panel"); if (!panel) return; state.avatar ||= {}; const genre = avatarStyles.includes(state.avatar.genre) ? state.avatar.genre : "Pop", variant = Number.isInteger(state.avatar.variant) && state.avatar.variant >= 0 && state.avatar.variant < 6 ? state.avatar.variant : 0, profile = avatarPortraitProfiles[variant]; Object.assign(state.avatar, { genre, variant, presentation: profile.presentation, skin: profile.skin, outfit: profile.outfit }); const accountAvatar = $("#change-avatar"); if (accountAvatar) { accountAvatar.className = "mini-avatar account-avatar avatar-art"; accountAvatar.style.cssText = avatarArtStyle(genre, variant); accountAvatar.replaceChildren(); } panel.innerHTML = `<h3>MIN ARTIST-AVATAR</h3><div class="avatar-choice-layout"><div class="avatar-choice-preview avatar-art" style="${avatarArtStyle(genre, variant)}" role="img" aria-label="${genre}-artist"></div><div class="avatar-choice-copy"><p>Välj genre, könsuttryck, hudton och en matchande outfit.</p><div class="avatar-genre-grid">${avatarStyles.map((style) => `<button type="button" class="${style === genre ? "is-selected" : ""}" data-avatar-style="${style}">${style.toUpperCase()}</button>`).join("")}</div><div class="avatar-trait-grid"><label>UTTRYCK<select data-avatar-trait="presentation">${["Feminin", "Maskulin", "Androgyn"].map((value) => `<option${profile.presentation === value ? " selected" : ""}>${value}</option>`).join("")}</select></label><label>HUDTON<select data-avatar-trait="skin">${["Ljus", "Mellan", "Mörk"].map((value) => `<option${profile.skin === value ? " selected" : ""}>${value}</option>`).join("")}</select></label></div><p class="avatar-look-label">OUTFIT · VÄLJ EN FÄRDIG ARTISTLOOK</p><div class="avatar-variant-grid">${avatarPortraitProfiles.map((item, index) => `<button type="button" class="avatar-art ${index === variant ? "is-selected" : ""}" style="${avatarArtStyle(genre, index)}" data-avatar-variant="${index}" aria-label="${item.presentation}, ${item.skin}, ${item.outfit}"><span>${item.presentation}<br>${item.skin}</span></button>`).join("")}</div><button type="button" class="button avatar-shuffle" data-avatar-style-random>SLUMPA AVATAR</button><button type="button" class="button button-green" data-avatar-save>SPARA AVATAR</button></div></div>`; }
document.addEventListener("change", (event) => { const select = event.target.closest("[data-avatar-trait]"); if (!select) return; state.avatar ||= {}; const current = avatarPortraitProfiles[Number(state.avatar.variant) || 0], traits = { ...current, [select.dataset.avatarTrait]: select.value }, variant = avatarProfileIndex(traits, Number(state.avatar.variant) || 0); Object.assign(state.avatar, avatarPortraitProfiles[variant], { variant }); save(); renderAvatar(); });
function renderAvatar() {
  renderAvatarRig();
  updateProfileToggleAvatar();
}
function openAvatarEditor() { showView("avatar"); }
$("#change-avatar")?.addEventListener("click", openAvatarEditor);
$("#change-avatar-link")?.addEventListener("click", openAvatarEditor);
$("#avatar-back")?.addEventListener("click", () => showView("profile"));
function showTurnNotice(match) {
  if (isSoloMatch(match) || !["active", "opponent"].includes(match?.status) || (match.players || []).length < 2) return;
  if (!match.players.some((player) => Number(player.rounds_started || 0) > 0)) return;
  const notice = match?.turnNotice;
  if (!state.userId || !notice?.user_id || String(notice.user_id) !== String(state.userId)) return;
  if (!["reminder", "timeout"].includes(notice.type)) return;
  if (notice.type === "reminder" && (match.status !== "active" || String(match.currentUserId) !== String(state.userId))) return;
  const noticeId = `${state.userId}:${match.id}:${notice.issued_at || notice.type}`;
  if (state.seenTurnNotices[noticeId]) return;
  state.seenTurnNotices[noticeId] = true; save();
  const opponent = notice.opponent_name || "din motspelare", code = notice.match_code || match.code;
  const message = notice.type === "timeout"
    ? `Du har varit inaktiv i matchen mot ${opponent} med matchkod ${code} i 72 timmar. Turen går nu automatiskt över till nästa spelare.`
    : `Det har gått 48 timmar sedan du spelade i matchen mot ${opponent} med matchkod ${code}. Efter ytterligare 24 timmars inaktivitet i denna match går turen automatiskt över till nästa spelare.`;
  dialog(message);
}
function showFinalChanceNotice(match) {
  const result = match?.lastResult;
  if (match?.status !== "active" || !result?.awaiting_final_chance || String(result.leader_id) === String(state.userId)) return;
  const noticeId = String(match.id) + ":" + String(result.ended_at || result.leader_id);
  if (state.seenFinalChanceNotices[noticeId]) return;
  state.seenFinalChanceNotices[noticeId] = true; save();
  const leaderPlayer = match.players?.find((player) => String(player.user_id) === String(result.leader_id)), leader = leaderPlayer?.display_name || "Motspelaren", leaderRounds = Number(leaderPlayer?.rounds_started || 0), finalists = (match.players || []).filter((player) => String(player.user_id) !== String(result.leader_id) && Number(player.rounds_started || 0) < leaderRounds), finalNames = finalists.map((player) => player.display_name).join(" och ");
  if (finalists.some((player) => String(player.user_id) === String(state.userId))) dialog(leader + " har lagt 10 kort och du har nu chansen att också hamna på 10 rätt placerade kort. Vid lika avgörs matchen i form av en golden point.");
  else dialog("Du förlorade matchen men vinnaren är ännu inte korad. " + leader + " har lagt 10 rätt placerade kort men " + (finalNames || "övriga spelare") + " har en sista chans till lika. Vid lika avgörs matchen i en golden point.");
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
  const comeback = won && state.stats.comebackReady;
  if (!alreadySettled) { state.stats.wins += won ? 1 : 0; state.stats.losses += won ? 0 : 1; state.stats.walkovers += won && result.type === "walkover" ? 1 : 0; state.stats.currentStreak = won ? state.stats.currentStreak + 1 : 0; state.stats.streak = Math.max(state.stats.streak, state.stats.currentStreak); state.stats.comebackReady = won ? false : true; state.settledResults.push(match.id); }
  const entry = { id: match.id, code: match.code, mode: "online", title: `${state.playerName}, ${opponent}`, opponentName: opponent, leaveReason: result.type === "walkover" ? (won ? "DU VANN - WALK OVER" : "DU LÄMNADE - WALK OVER") : won ? "DU VANN MATCHEN" : "DU FÖRLORADE MATCHEN", result };
  if (!alreadyArchived) { state.history.unshift(entry); state.archivedResults.push(match.id); }
  save();
  if (won) evaluateCareerAchievements(comeback);
  if (!won && !alreadyArchived && !state.selfWalkovers.includes(match.id)) { const message = `Du förlorade matchen mot ${winner}. Matchens resultat går att se på startsidan under Historik.`; if (window.Notification?.permission === "granted") new Notification("Digihits", { body: message }); dialog(message, () => showHistoryResult(entry), false, "VISA SLUTRESULTAT", "OK"); }
}
function grantAchievement(id, label) {
  if (state.achievements[id]) return false;
  state.achievements[id] = true;
  state.stats.achievementXp += 3;
  achievementPopupQueue.push(label);
  return true;
}
function localDateKey(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}
function grantDailyAchievement(id, label) {
  const today = localDateKey();
  state.dailyAchievements[today] ||= {};
  if (state.dailyAchievements[today][id]) return false;
  state.dailyAchievements[today][id] = true;
  state.stats.achievementXp += 3;
  achievementPopupQueue.push(label);
  return true;
}
function showAchievementPopups() {
  if (currentView !== "result" || !achievementPopupQueue.length) return;
  if (!$("#app-dialog").hidden) { setTimeout(showAchievementPopups, 250); return; }
  const label = achievementPopupQueue.shift();
  dialog("Utmärkelse upplåst: " + label + "!\n\nDu får +3 onlinepoäng.", showAchievementPopups, false, "OK");
}
function finishAchievementAwards() {
  if (!achievementPopupQueue.length) return;
  save(); render();
  if (currentView === "result") showAchievementPopups();
}
function evaluateCareerAchievements(comeback = false) {
  const opponents = new Set(state.history.filter((match) => match.mode === "online").map((match) => String(match.opponentName || "").trim()).filter(Boolean)).size;
  const todayOpponents = new Set(state.career.dailyOpponents[localDateKey()] || []).size;
  if (state.stats.wins >= 1) grantAchievement("firstWin", "Första vinsten");
  if (state.stats.streak >= 3) grantAchievement("streak3", "3 vinster i rad");
  if (state.stats.wins >= 10) grantAchievement("wins10", "10 onlinevinster");
  if (state.stats.wins >= 25) grantAchievement("wins25", "25 onlinevinster");
  if (state.stats.streak >= 5) grantAchievement("streak5", "5 vinster i rad");
  if (comeback) grantAchievement("comeback", "Vändningen");
  if (state.onlineCorrect >= 100) grantAchievement("correct100", "100 rätt placerade kort");
  if (opponents >= 3) grantAchievement("threeFriends", "Vunnit mot 3 vänner");
  if (opponents >= 5) grantAchievement("fiveFriends", "Vunnit mot 5 vänner");
  if (state.career.startedMatchCodes.length >= 5) grantAchievement("matchmaker", "Matchmakaren");
  if (state.career.playedWith.length >= 5) grantAchievement("socialPlayer", "Sällskapsspelare");
  if (state.career.friendIds.length >= 5) grantAchievement("friendshipTone", "Vänskapston");
  if (state.career.fullHouse) grantAchievement("fullHouse", "Fullt hus");
  if (todayOpponents >= 3) grantDailyAchievement("eveningDj", "Kvällens DJ");
  if (state.stats.wins * 3 - state.stats.walkoverLeaves + state.stats.achievementXp >= 90) grantAchievement("goldRecord", "Guldskiva nådd");
  finishAchievementAwards();
}
function closeHomeAccordions() {
  document.querySelectorAll("[data-accordion]").forEach((section) => { section.classList.remove("is-open"); section.querySelector(".accordion-toggle").setAttribute("aria-expanded", "false"); section.querySelector(".accordion-mark")?.replaceChildren("›"); });
}
function renderRoundResult(correct, card = activeCard(), snapshot = null) {
  $("#final-match-overview")?.setAttribute("hidden", ""); $(".result-head").hidden = false; $(".result-checks").hidden = false; $(".result-actions").hidden = false; $("#result-timeline").hidden = false;
  const solo = isSoloMatch(state.matches.find((match) => match.code === state.activeMatchCode));
  let wrongButton = $("#wrong-matches"), overviewButton = $("#wrong-overview");
  if (!wrongButton) { wrongButton = document.createElement("button"); wrongButton.id = "wrong-matches"; wrongButton.hidden = true; $("#result-back").after(wrongButton); }
  if (!overviewButton) { overviewButton = document.createElement("button"); overviewButton.id = "wrong-overview"; overviewButton.className = "lobby-back wrong-match-button"; overviewButton.type = "button"; overviewButton.textContent = "TILL MATCHÖVERSIKT"; overviewButton.addEventListener("click", async () => { if (!currentPlacementCorrect) await animateTimelineOutcome(false); openMatch(state.activeMatchCode); }); wrongButton.after(overviewButton); }
  const unlocked = snapshot?.unlocked ?? state.roundUnlocked, locked = snapshot?.locked ?? state.lockedTimeline, guess = snapshot?.guess ?? state.currentGuess ?? {};
  const attempts = state.matches.find((match) => match.code === state.activeMatchCode)?.round || 0;
  const correctCards = locked.length + (correct ? 1 : 0);
  const score = solo ? { ...soloProgress(state.matches.find((match) => match.code === state.activeMatchCode), locked), ...(snapshot?.score || {}) } : snapshot?.score || { correct: Math.max(1, locked.length + (correct ? unlocked.length + 1 : 0)), mistakes: correct ? 0 : 1 };
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
  $("#placement-result").textContent = solo ? (correct ? "☑  Rätt placerat" : "✕  Fel placerat") : correct ? "☑  Rätt placering" : "✕  Fel placering · Du förlorar dina olåsta kort.";
  const timeline = snapshot?.timeline || [...locked.map((item, index) => ({ ...item, status: index === 0 ? "STARTKORT" : "LÅST" })), ...cards].sort((a, b) => a.year - b.year);
  $("#result-timeline").classList.remove("timeline-centered"); $("#result-timeline").innerHTML = timeline.map((item) => `<article class="year-card ${item.status === "STARTKORT" || item.status === "LÅST" ? "locked-card" : /FEL ?PLACERAT/.test(item.status) ? "misplaced-card" : !solo && isUnlockedStatus(item.status) ? "unlocked-card" : solo ? "correct-card" : "locked-card"}"${item.status === "STARTKORT" ? " style=\"border-color:#58657a;background:#202632\"" : ""}><strong>${item.year}</strong><small><span class="card-song">${item.title}<br>${item.artist}</span><span class="card-status">${cardStatusLabel(item.status)}</span></small></article>`).join("");
  $("#result-continue").hidden = !correct && !solo;
  $("#result-continue").textContent = solo ? "▶ FORTSÄTT MED NY LÅT" : "▶ FORTSÄTT OMGÅNG & TA ETT TILL HEMLIGT LÅTKORT";
  $("#result-lock").hidden = !correct || solo; $("#change-track-area").hidden = !correct || solo;
  const onlyContinue = !$("#result-continue").hidden && $("#result-lock").hidden;
  $(".result-actions").style.gridTemplateColumns = onlyContinue ? "minmax(0,300px)" : "";
  $(".result-actions").style.justifyContent = onlyContinue ? "center" : "";
  $("#result-back").hidden = true; wrongButton.hidden = true; overviewButton.hidden = correct || score.correct >= 10;
  $("#result-lock").textContent = "🔒 AVSLUTA OMGÅNG & LÅS IN MINA OLÅSTA KORT";
}

function updateTurnBadge() { const count = state.matches.filter((match) => !isSoloMatch(match) && match.status === "active").length; if (navigator.setAppBadge) (count ? navigator.setAppBadge(count) : navigator.clearAppBadge()).catch(() => {}); }
function careerLevel(points = 0) { return [{ name:"Uppvärmning", min:-Infinity },{ name:"Soundcheck", min:1 },{ name:"Genombrott", min:9 },{ name:"Hitmakare", min:24 },{ name:"Listetta", min:50 },{ name:"Guldskiva", min:90 },{ name:"Platinaskiva", min:150 },{ name:"Digihits-legendar", min:250 }].filter((level) => points >= level.min).at(-1).name; }
function careerProgress(points = 0) { const steps = [0, 1, 9, 24, 50, 90, 150, 250], index = steps.reduce((found, min, i) => points >= min ? i : found, 0), next = steps[index + 1]; return next ? Math.max(0, Math.min(100, ((points - steps[index]) / (next - steps[index])) * 100)) : 100; }
function careerNextLabel(points = 0) { const levels = [{ name:"Soundcheck", min:1 },{ name:"Genombrott", min:9 },{ name:"Hitmakare", min:24 },{ name:"Listetta", min:50 },{ name:"Guldskiva", min:90 },{ name:"Platinaskiva", min:150 },{ name:"Digihits-legendar", min:250 }], next = levels.find((level) => points < level.min); return next ? `${next.min - points}p KVAR TILL ${next.name.toUpperCase()}` : "HÖGSTA NIVÅN"; }
let lastCareerSync = "";
const achievementNames = { firstWin:"Första vinsten", firstSwap:"Första byt-låt-kortet", matchmaker:"Matchmakaren", hattrick:"Hattrick", fullHouse:"Fullt hus", eveningDj:"Kvällens DJ", friendshipTone:"Vänskapston", socialPlayer:"Sällskapsspelare", comeback:"Vändningen", streak3:"3 vinster i rad", threeFriends:"3 olika vänner", fiveFriends:"5 olika vänner", wins10:"10 onlinevinster", correct100:"100 rätt placerade", streak5:"5 vinster i rad", goldRecord:"Guldskiva nådd", wins25:"25 onlinevinster" };
function friendAchievementMarkup(friend) { const earned = (Array.isArray(friend?.career_achievements) ? friend.career_achievements : []).filter((id) => achievementNames[id]); return `<section class="achievement-list"><h3>UTMÄRKELSER</h3>${earned.length ? `<div>${earned.map((id) => `<span class="achievement earned"><small>${achievementNames[id]}</small></span>`).join("")}</div>` : "<p>INGA UTMÄRKELSER UPPLÅSTA ÄN</p>"}</section>`; }
function persistCareer() { const points = Number(state.stats?.wins || 0) * 3 - Number(state.stats?.walkoverLeaves || 0) + Number(state.stats?.achievementXp || 0), achievementKeys = Object.keys(state.achievements || {}).filter((id) => state.achievements[id]), key = `${points}|${achievementKeys.join(",")}`; if (key === lastCareerSync || !supabaseAuth.session()?.access_token) return; lastCareerSync = key; supabaseAuth.dataRequest("rpc/digihits_set_career", { career_points_input: points, achievement_keys: achievementKeys }, "POST").catch(() => supabaseAuth.dataRequest("rpc/digihits_set_career", { career_points_input: points }, "POST")).catch(() => { lastCareerSync = ""; }); }
function renderFriends() {
  updateBottomBadges();
  const requests = $("#friend-requests"), sent = $("#friend-sent-requests"), sentMatches = $("#friend-sent-match-invites"), friends = $("#friends-list"), invites = $("#friend-invites"); if (!requests || !sent || !sentMatches || !friends || !invites) return;
  const requestCount = state.friendRequests.length, inviteCount = state.friendInvites.length; $("#friend-request-count").textContent = `Vänförfrågan ${requestCount}`; $("#friend-request-count").hidden = !requestCount; $("#friend-match-invite-count").textContent = `Ny match ${inviteCount}`; $("#friend-match-invite-count").hidden = !inviteCount;
  invites.innerHTML = `<h3 class="friend-section-title">Inkommande matchinbjudningar</h3>${state.friendInvites.length ? state.friendInvites.map((invite) => `<article class="friend-row"><strong>${escapeHtml(invite.sender_name)} har bjudit in dig till match</strong><div class="friend-actions"><button class="button button-green" data-join-friend-match="${invite.match_code}" data-invite-id="${invite.invite_id}" type="button">GÅ MED</button><button class="button button-secondary" data-decline-match-invite="${invite.invite_id}" type="button">AVVISA</button></div></article>`).join("") : `<p class="friend-empty">Du har inga inkommande matchinbjudningar.</p>`}`;
  sentMatches.innerHTML = `<h3 class="friend-section-title">Skickade matchförfrågningar</h3>${state.sentMatchInvites.length ? state.sentMatchInvites.map((invite) => invite.status === "pending" ? `<article class="friend-row"><strong>Inbjudan skickad till ${escapeHtml(invite.recipient_name || "spelaren")} · MATCHKOD ${escapeHtml(invite.match_code)}.</strong></article>` : `<article class="friend-row ${invite.status === "accepted" ? "friend-request-accepted" : "friend-request-declined"}"><strong>Matchförfrågan ${invite.status === "accepted" ? "accepterad" : "avvisad"} av ${escapeHtml(invite.recipient_name || "spelaren")} · MATCHKOD ${escapeHtml(invite.match_code)}.</strong><button class="button button-secondary" data-dismiss-sent-match-invite="${invite.invite_id}" type="button">OK</button></article>`).join("") : `<p class="friend-empty">Du har inga matchförfrågningar.</p>`}`;
  requests.innerHTML = `<h3 class="friend-section-title">Inkommande vänförfrågningar</h3>${state.friendRequests.length ? state.friendRequests.map((friend) => `<article class="friend-row"><strong>${escapeHtml(friend.display_name)}</strong><div class="friend-actions"><button class="button button-green" data-friend-answer="${friend.request_id}" data-friend-accept="true" type="button">ACCEPTERA</button><button class="button button-secondary" data-friend-answer="${friend.request_id}" type="button">AVVISA</button></div></article>`).join("") : `<p class="friend-empty">Du har inga inkommande vänförfrågningar.</p>`}`;
  sent.innerHTML = `<h3 class="friend-section-title">Skickade vänförfrågningar</h3>${state.sentFriendRequests.length ? state.sentFriendRequests.map((request) => { const name = escapeHtml(request.display_name || "spelaren"); return request.status === "accepted" ? `<article class="friend-row friend-request-accepted"><strong>Du är nu vän med ${name}.</strong><button class="button button-secondary" data-dismiss-friend-request="${request.request_id}" type="button">OK</button></article>` : request.status === "declined" ? `<article class="friend-row friend-request-declined"><strong>${name} avvisade din vänförfrågan.</strong><button class="button button-secondary" data-dismiss-friend-request="${request.request_id}" type="button">OK</button></article>` : `<article class="friend-row"><strong>Vänförfrågan till ${name} – väntar på svar.</strong></article>`; }).join("") : `<p class="friend-empty">Du har inga skickade vänförfrågningar.</p>`}`;
  friends.innerHTML = `<h3 class="friend-section-title">Vänskapslista</h3>${state.friends.length ? state.friends.map((friend) => { return `<article class="friend-row friend-profile"><strong>${escapeHtml(friend.display_name)}</strong><div class="friend-actions friend-main-actions"><button class="button button-green" data-create-friend-match="${friend.friend_id}" type="button">SKAPA NY MATCH MOT</button><button class="button button-leave account-danger" data-remove-friend="${friend.friend_id}" data-friend-name="${escapeHtml(friend.display_name)}" type="button">TA BORT VÄN</button></div></article>`; }).join("") : `<p class="friend-empty">Du har inga vänner ännu.</p>`}${state.friendNotifications.map((notice) => `<article class="friend-row friend-request-declined"><strong>${escapeHtml(notice.display_name)} tog bort dig som vän.</strong><button class="button button-secondary" data-dismiss-friend-notice="${notice.notice_id}" type="button">OK</button></article>`).join("")}`;
  friends.querySelectorAll(".friend-row.friend-profile").forEach((row) => { const name = row.querySelector(":scope > strong"), actions = row.querySelector(".friend-main-actions"); if (!name || !actions) return; const create = actions.querySelector("[data-create-friend-match]"), remove = actions.querySelector("[data-remove-friend]"), friend = state.friends.find((item) => String(item.friend_id) === String(create?.dataset.createFriendMatch)), avatar = document.createElement("span"), identity = document.createElement("div"), choice = avatarChoice(friend); avatar.className = "mini-avatar friend-avatar avatar-art"; avatar.style.cssText = avatarArtStyle(choice.genre, choice.variant); identity.className = "friend-identity"; name.before(identity); identity.append(avatar, name); const career = document.createElement("button"); career.type = "button"; career.className = "button friend-career-button"; career.dataset.friendCareer = friend?.friend_id || ""; career.textContent = state.friendCareerOpen[friend?.friend_id] ? "DÖLJ MUSIKKARRIÄR" : "VISA MUSIKKARRIÄR"; remove ? actions.insertBefore(career, remove) : actions.append(career); if (state.friendCareerOpen[friend?.friend_id]) { const points = Number(friend?.career_points || 0), level = careerLevel(points), card = document.createElement("section"); card.className = "friend-career-card level-panel"; card.innerHTML = `<div class="level-head"><div><small>ONLINE-NIVÅ</small><b>${level}</b></div></div><div class="level-progress"><i style="width:${careerProgress(points)}%"></i><strong>ONLINEPOÄNG: ${points}</strong></div><small class="level-next">${careerNextLabel(points)}</small>${friendAchievementMarkup(friend)}`; row.append(card); } });
}
document.addEventListener("click", (event) => { const button = event.target.closest("[data-friend-career]"); if (!button) return; const friendId = button.dataset.friendCareer, row = button.closest(".friend-row"), friend = state.friends.find((item) => String(item.friend_id) === String(friendId)); if (!row || !friend) return; const open = !state.friendCareerOpen[friendId]; state.friendCareerOpen[friendId] = open; save(); button.textContent = open ? "DÖLJ MUSIKKARRIÄR" : "VISA MUSIKKARRIÄR"; row.querySelector(".friend-career-card")?.remove(); if (!open) return; const points = Number(friend.career_points || 0), card = document.createElement("section"), level = careerLevel(points); card.className = "friend-career-card level-panel"; card.innerHTML = `<div class="level-head"><div><small>ONLINE-NIVÅ</small><b>${level}</b></div></div><div class="level-progress"><i style="width:${careerProgress(points)}%"></i><strong>ONLINEPOÄNG: ${points}</strong></div><small class="level-next">${careerNextLabel(points)}</small>${friendAchievementMarkup(friend)}`; row.append(card); });
async function syncFriends() {
  if (!supabaseAuth.session()?.access_token) return;
  const [friends, requests, invites, unreads, sentRequests, sentMatchInvites, notifications] = await Promise.all([supabaseAuth.dataRequest("rpc/digihits_my_friends", {}, "POST"), supabaseAuth.dataRequest("rpc/digihits_my_friend_requests", {}, "POST"), supabaseAuth.dataRequest("rpc/digihits_my_match_invites", {}, "POST"), supabaseAuth.dataRequest("rpc/digihits_my_friend_unreads", {}, "POST"), supabaseAuth.dataRequest("rpc/digihits_my_sent_friend_requests", {}, "POST"), supabaseAuth.dataRequest("rpc/digihits_my_sent_match_invites", {}, "POST"), supabaseAuth.dataRequest("rpc/digihits_my_friend_notifications", {}, "POST")]);
  state.friends = friends || []; state.career.friendIds = [...new Set([...state.career.friendIds, ...state.friends.map((friend) => String(friend.friend_id))])]; state.friendRequests = requests || []; state.friendInvites = invites || []; state.friendChatUnread = Object.fromEntries((unreads || []).map((item) => [item.friend_id, Number(item.unread_count)])); state.sentFriendRequests = sentRequests || []; state.sentMatchInvites = sentMatchInvites || []; state.friendNotifications = notifications || []; state.blocks = []; evaluateCareerAchievements(); save(); renderFriends();
  const hasLocalAvatar = avatarStyles.includes(state.avatar?.genre) && Number.isInteger(Number(state.avatar?.variant)) && Number(state.avatar.variant) >= 0 && Number(state.avatar.variant) < 6;
  if (hasLocalAvatar || state.avatarServerLoaded) { state.avatarServerLoaded = true; return; }
  supabaseAuth.dataRequest("rpc/digihits_my_avatar", {}, "POST").then((rows) => { const saved = rows?.[0]; if (!saved || state.avatarDirty) return; state.avatar = { ...state.avatar, genre: saved.avatar_genre, variant: Number(saved.avatar_variant), traits: saved.avatar_traits || state.avatar?.traits }; state.avatarServerLoaded = true; save(); renderAvatar(); }).catch(() => {});
}
function alignResetButtons() { document.querySelectorAll(".section-subtitle").forEach((title) => { const reset = title.nextElementSibling; if (!reset?.classList.contains("reset-row") || title.parentElement.classList.contains("section-heading")) return; const heading = document.createElement("div"); heading.className = "section-heading"; title.before(heading); heading.append(title, reset); }); }
function render() {
  persistCareer();
  updateTurnBadge();
  $("#player-name").textContent = state.playerName;
  const spotifyPanel = $("#spotify-status");
  if (spotifyPanel) spotifyPanel.textContent = "Apple Music-previews används för uppspelning.";
  $("#enable-notifications").textContent = state.pushNotificationsEnabled ? "INAKTIVERA NOTISER" : "AKTIVERA NOTISER";
  const turns = state.matches.filter((match) => !isSoloMatch(match) && match.status === "active").length;
  $("#turn-count").textContent = `Din tur ${turns}`;
  $("#turn-count").hidden = !turns;
  $("#turn-count").classList.toggle("has-turn", turns > 0);
  $("#stat-wins").textContent = `${state.stats.wins} st`;
  $("#stat-losses").textContent = `${state.stats.losses} st`;
  $("#stat-walkovers").textContent = `${state.stats.walkovers} st`;
  $("#stat-streak").textContent = `${state.stats.streak} st`;
  const levelSteps = [{ name: "Uppvärmning", min: -Infinity }, { name: "Soundcheck", min: 1 }, { name: "Genombrott", min: 9 }, { name: "Hitmakare", min: 24 }, { name: "Listetta", min: 50 }, { name: "Guldskiva", min: 90 }, { name: "Platinaskiva", min: 150 }, { name: "Digihits-legendar", min: 250 }], points = state.stats.wins * 3 - state.stats.walkoverLeaves + state.stats.achievementXp, levelIndex = Math.max(0, levelSteps.reduce((found, level, index) => points >= level.min ? index : found, 0)), level = levelSteps[levelIndex], nextLevel = levelSteps[levelIndex + 1], levelFloor = levelIndex ? level.min : 0, progress = nextLevel ? Math.max(0, Math.min(100, ((points - levelFloor) / (nextLevel.min - levelFloor)) * 100)) : 100;
  const levelPanel = $("#level-panel");
  const opponents = new Set(state.history.filter((match) => match.mode === "online").map((match) => String(match.opponentName || "").trim()).filter(Boolean)).size;
  const achievements = [
    ["firstWin", "★", "Första vinsten", "Vinn din första onlinematch.", "online"],
    ["firstSwap", "♫", "Första byt-låt-kortet", "Gissa både rätt artist och låtnamn i en onlinematch.", "online"],
    ["matchmaker", "✦", "Matchmakaren", "Spela fem onlinematcher med minst en annan deltagare.", "online"],
    ["hattrick", "3", "Hattrick", "Lås in tre kort rätt i samma omgång.", "online"],
    ["fullHouse", "8", "Fullt hus", "Spela en onlinematch med minst fyra spelare.", "online"],
    ["eveningDj", "♫", "Kvällens DJ", "Slutför omgångar mot tre olika personer under samma dag.", "online"],
    ["dailyStart", "▶", "Dagens start", "Slutför dagens första omgång så att resultatvyn visas.", "solo ELLER online"],
    ["doubleHit", "✌", "Dubbelträff", "Gissa både artist och låttitel rätt i samma slutförda omgång.", "solo ELLER online"],
    ["quickStart", "⚡", "Snabbstart", "Placera rätt i dagens första slutförda omgång.", "solo ELLER online"],
    ["socialToneDaily", "♥", "Social ton", "Slutför en omgång i en onlinematch idag.", "online"],
    ["soloDaily", "★", "Solisten", "Slutför en omgång i en solomatch idag.", "solo"],
    ["fullGuard", "◆", "Helgardering", "Gissa artist och låttitel rätt och placera kortet rätt i samma omgång.", "solo ELLER online"],
    ["fullSpeed", "↯", "Full fart", "Slutför minst en soloomgång och en onlineomgång under samma dag.", "solo OCH online"],
    ["friendshipTone", "♥", "Vänskapston", "Bli vän med fem olika personer.", "online"],
    ["socialPlayer", "☻", "Sällskapsspelare", "Spela mot fem olika personer.", "online"],
    ["comeback", "↟", "Vändningen", "Vinn en onlinematch direkt efter en förlust.", "online"],
    ["streak3", "🔥", "3 vinster i rad", "Vinn tre onlinematcher i följd.", "online"],
    ["threeFriends", "♟", "3 olika vänner", "Vinn mot tre olika vänner.", "online"],
    ["fiveFriends", "♛", "5 olika vänner", "Vinn mot fem olika vänner.", "online"],
    ["wins10", "10", "10 onlinevinster", "Vinn totalt tio onlinematcher.", "online"],
    ["correct100", "100", "100 rätt placerade", "Placera totalt 100 kort rätt i onlinematcher.", "online"],
    ["streak5", "⚡", "5 vinster i rad", "Vinn fem onlinematcher i följd.", "online"],
    ["goldRecord", "◆", "Guldskiva nådd", "Nå minst 90 onlinepoäng.", "online"],
    ["wins25", "25", "25 onlinevinster", "Vinn totalt 25 onlinematcher.", "online"]
  ];
  const todayAchievements = state.dailyAchievements[localDateKey()] || {};
  const dailyAchievementIds = new Set(["eveningDj", "dailyStart", "doubleHit", "quickStart", "socialToneDaily", "soloDaily", "fullGuard", "fullSpeed"]);
  const achievementButton = ([id, icon, label, description, mode]) => "<button class=\"achievement " + ((dailyAchievementIds.has(id) ? todayAchievements[id] : state.achievements[id]) ? "earned" : "") + "\" data-achievement-info=\"" + id + "\" data-achievement-label=\"" + label + "\" data-achievement-description=\"" + description + "\" type=\"button\"><b>" + icon + "</b><small><span>" + label + "</span><em>" + mode + "</em></small></button>";
  const dailyMarkup = "<section class=\"achievement-list career-section-panel\"><h3>Dagliga utmärkelser</h3><div>" + achievements.filter(([id]) => dailyAchievementIds.has(id)).map(achievementButton).join("") + "</div></section>";
  const permanentMarkup = "<section class=\"achievement-list career-section-panel\"><h3>Permanenta utmärkelser</h3><div>" + achievements.filter(([id]) => !dailyAchievementIds.has(id)).map(achievementButton).join("") + "</div></section>";
  levelPanel.innerHTML = "<section class=\"career-section-panel career-level-panel\"><div class=\"level-head\"><div><small>ONLINE-NIVÅ</small><b>" + level.name + "</b></div><button type=\"button\" aria-label=\"Information om nivåer\">INFORMATION</button></div><div class=\"level-progress\"><i style=\"width:" + progress + "%\"></i><strong>ONLINEPOÄNG: " + points + "</strong></div><small class=\"level-next\">" + (nextLevel ? Math.max(0, nextLevel.min - points) + "p KVAR TILL " + nextLevel.name.toUpperCase() : "HÖGSTA NIVÅN") + "</small></section>" + dailyMarkup + permanentMarkup;
  levelPanel.querySelector("button").onclick = () => { dialog("Poängregler:\n• Vinst: +3 poäng\n• Förlust: 0 poäng\n• Lämnar walk over: −1 poäng\n\nUtmärkelser:\n• Varje utmärkelse ger +3 poäng\n• Tryck på en utmärkelse för att se exakt hur den låses upp\n• Dagliga utmärkelser nollställs varje dag kl 00:00\n• Permanenta utmärkelser kan bara låsas upp en gång per Digihits-konto\n\nNivåer:\n• Uppvärmning: 0 eller mindre\n• Soundcheck: 1–8\n• Genombrott: 9–23\n• Hitmakare: 24–49\n• Listetta: 50–89\n• Guldskiva: 90–149\n• Platinaskiva: 150–249\n• Digihits-legendar: 250+"); $("#dialog-message").classList.add("level-rules"); $("#dialog-message").innerHTML = $("#dialog-message").textContent.split("\n").map((line) => line.startsWith("• ") ? `<span class="level-rule-item">${escapeHtml(line.slice(2))}</span>` : line ? `<span class="level-rule-line">${escapeHtml(line)}</span>` : `<span class="level-rule-gap"></span>`).join(""); };
  renderAvatar();
  $("#solo-best-rounds").textContent = state.soloStats.bestRounds ? `${state.soloStats.bestRounds} st` : "–";
  $("#solo-fewest-mistakes").textContent = state.soloStats.fewestMistakes ?? "–";
  $("#change-track-area").innerHTML = state.changeTrackCards ? `<button class="button change-track-button" id="use-change-track" type="button">ANVÄND ETT BYT-LÅT-KORT ${state.changeTrackCards}/3</button>` : "";
  $("#change-track-area").style.cssText += ";width:300px;max-width:100%;box-sizing:border-box"; $("#lock-placement").style.cssText += ";width:300px;max-width:100%;box-sizing:border-box";
  const matches = $("#matches");
  const renderCard = (match) => {
    const solo = isSoloMatch(match);
    const soloScore = solo ? soloProgress(match) : null;
    const label = solo ? "ÖPPNA SOLOMATCH HÄR" : match.status === "active" ? "ÖPPNA MATCH HÄR" : "VISA MATCHÖVERSIKT HÄR";
    const status = solo ? "DIN TUR" : match.status === "active" ? "DIN TUR" : match.status === "opponent" ? "MOTSTÅNDARES TUR" : "VÄNTAR PÅ MOTSPELARE";
    const matchPlayers = match.players?.length ? match.players : String(match.title || "").split(", ").filter(Boolean).map((display_name) => ({ display_name }));
    const playerRows = matchPlayers.map((player) => { const correct = Math.max(1, Number(player.last_round?.score?.correct) || (player.locked_timeline || []).length || 0); return `<div><strong>${escapeHtml(player.display_name)} <b>(${correct}/10p)</b></strong></div>`; }).join("");
    const unread = !solo ? Number(state.chatUnread[match.code] || 0) : 0;
    return `<article class="match ${solo ? "solo" : match.status}">${solo ? "" : `<div class="match-status match-status-top">● ${status}</div>${unread ? `<button class="match-chat-alert" data-open-chat="${match.code}" title="Nya chattmeddelanden" aria-label="Öppna chatt" type="button">✉<b>${unread}</b></button>` : ""}<button class="match-icon delete-icon match-delete-top" data-delete-match="${match.code}" title="Lämna match" aria-label="Lämna match" type="button">🗑</button>`}${solo ? `<div class="match-top"><strong>Solomatch</strong></div><div class="solo-card-stats"><div><strong>${soloScore.correct}/10</strong><small>RÄTT PLACERADE</small></div><div><strong>${soloScore.mistakes}</strong><small>FELPLACERADE</small></div><div><strong>${match.round || 1}</strong><small>${(match.round || 1) === 1 ? "OMGÅNG" : "OMGÅNGAR"}</small></div></div>` : `<div class="match-player-list">${playerRows}</div>`}<div class="match-footer"><button class="match-open" data-open-match="${match.code}" type="button">${label}</button>${solo ? `<div class="match-card-actions"><button class="match-icon delete-icon" data-delete-match="${match.code}" title="Lämna match" aria-label="Lämna match" type="button">🗑</button></div>` : ""}</div>${solo ? "" : `<div class="match-code match-code-bottom">MATCHKOD <strong>${match.code}</strong></div>`}</article>`;
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
  matches.innerHTML = `<section class="match-list-panel"><h3 class="match-group-title">Mina solomatcher</h3>${soloMatches.length ? soloMatches.map(renderCard).join("") : `<p class="match-empty">Du har inga solomatcher.</p>`}</section><section class="match-list-panel"><h3 class="match-group-title">Mina onlinematcher</h3>${onlineMatches.length ? onlineMatches.map(renderCard).join("") : `<p class="match-empty">Du har inga onlinematcher.</p>`}</section>`;
  const historyCard = (match) => { const outcomeClass = /WALK/i.test(match.leaveReason || "") ? "history-walkover" : /VANN/i.test(match.leaveReason || "") ? "history-won" : /FÖRLORADE/i.test(match.leaveReason || "") ? "history-lost" : ""; return `<article class="history-match ${match.mode === "solo" ? "solo-win" : match.leaveReason === "DU LÄMNADE INNAN MATCHSTART" ? "early-leave" : "walkover"} ${outcomeClass}">${match.mode === "online" ? `<strong>MOT ${escapeHtml(match.opponentName || String(match.title || "motspelaren").split(", ").at(-1))}</strong><small class="history-code">MATCHKOD <b>${escapeHtml(match.code || "------")}</b></small><span>${match.leaveReason}</span>` : `<strong>${match.title}</strong>${match.rounds ? `<div class="solo-card-stats"><div><strong>${match.correct}/10</strong><small>RÄTT PLACERADE</small></div><div><strong>${match.mistakes}</strong><small>FELPLACERADE</small></div><div><strong>${match.rounds}</strong><small>${match.rounds === 1 ? "OMGÅNG" : "OMGÅNGAR"}</small></div></div>` : `<span>${match.leaveReason}</span>`}`}${match.mode === "online" && match.result ? `<button class="timeline-button" data-history-result="${match.id}" type="button">VISA SLUTRESULTAT</button>` : ""}</article>`; };
  const soloHistory = state.history.filter((match) => match.mode === "solo"), onlineHistory = state.history.filter((match) => match.mode !== "solo");
  const history = $("#history");
  if (history) history.innerHTML = `<section class="history-section-panel"><h3 class="section-subtitle">Avslutade solomatcher</h3><div class="reset-row"><button class="reset-button" data-reset-history="solo">NOLLSTÄLL SOLOMATCHER</button></div>${soloHistory.length ? soloHistory.map(historyCard).join("") : `<p class="history-empty">Inga avslutade solomatcher.</p>`}</section><section class="history-section-panel"><h3 class="section-subtitle">Avslutade onlinematcher</h3><div class="reset-row"><button class="reset-button" data-reset-history="online">NOLLSTÄLL ONLINEMATCHER</button></div>${onlineHistory.length ? onlineHistory.map(historyCard).join("") : `<p class="history-empty">Inga avslutade onlinematcher.</p>`}</section>`;
  alignResetButtons(); renderFriends();
}

function updateBottomBadges() {
  const menu = document.getElementById("bottom-menu");
  if (!menu || !state.userId) return;
  const seen = state.menuSeenByUser[state.userId] ||= { career: [], history: [] };
  const earned = Object.keys(state.achievements).filter((id) => state.achievements[id]);
  const historyIds = state.history.map((entry) => String(entry.id ?? entry.code)).filter((id) => id !== "undefined");
  let changed = false;
  for (const [view, key, ids] of [["career", "career", earned], ["game-history", "history", historyIds]]) {
    if (currentView === view && ids.some((id) => !seen[key].includes(id))) { seen[key] = [...new Set([...seen[key], ...ids])]; changed = true; }
  }
  if (changed) save();
  const turns = state.matches.filter((match) => !isSoloMatch(match) && match.status === "active");
  const invitations = new Set((state.friendInvites || []).map((invite) => String(invite.match_code || invite.id)).filter((code) => !turns.some((match) => String(match.code) === code)));
  const counts = { home: 0, matches: turns.length + invitations.size, friends: (state.friendRequests || []).length, career: earned.filter((id) => !seen.career.includes(id)).length, "game-history": historyIds.filter((id) => !seen.history.includes(id)).length };
  menu.querySelectorAll("[data-bottom-menu]").forEach((button) => {
    let badge = button.querySelector(".menu-count");
    if (!badge) { badge = document.createElement("b"); badge.className = "menu-count"; badge.setAttribute("aria-live", "polite"); button.append(badge); }
    const count = counts[button.dataset.bottomMenu] || 0;
    badge.hidden = count === 0;
    badge.textContent = String(count);
    button.setAttribute("aria-label", `${button.querySelector("span").textContent}${count ? `, ${count} att uppmärksamma` : ""}`);
  });
}
function initializeMenuPages() {
  const home = document.querySelector('[data-view-panel="home"]');
  for (const [view, id] of [["matches", "my-matches-section"], ["friends", "friends-section"], ["career", "career-section"], ["game-history", "game-history-section"]]) {
    const section = document.getElementById(id);
    const page = document.createElement("section");
    page.className = "view";
    page.dataset.viewPanel = view;
    page.setAttribute("aria-label", section.querySelector(".accordion-label").textContent);
    home.after(page);
    page.append(section);
  }
  for (const section of document.querySelectorAll('[data-view-panel] > [data-accordion]')) {
    section.removeAttribute("data-accordion");
    section.classList.add("is-open", "menu-page-section");
    const heading = section.querySelector(".accordion-toggle");
    const badges = heading.querySelector(".match-badges");
    if (badges) { const statusRow = document.createElement("div"); statusRow.className = "menu-status-row"; statusRow.append(badges); heading.replaceWith(statusRow); }
    else heading.remove();
  }
  home.querySelector(".hero > h1")?.remove();
}
initializeMenuPages();
let finishWelcomeTurn = null;
function prepareWelcomeTurn(view) {
  finishWelcomeTurn?.();
  if (currentView !== "welcome" || !["login", "signup"].includes(view) || matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
  const card = document.querySelector('[data-view-panel="welcome"].active .welcome-card');
  if (!card || !card.animate) return null;
  const bounds = card.getBoundingClientRect(), copy = card.cloneNode(true);
  copy.removeAttribute("id");
  copy.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
  copy.setAttribute("aria-hidden", "true"); copy.inert = true;
  copy.classList.add("welcome-turn-copy");
  Object.assign(copy.style, { position:"fixed", top:`${bounds.top}px`, left:`${bounds.left}px`, width:`${bounds.width}px`, height:`${bounds.height}px`, maxWidth:"none", margin:"0", pointerEvents:"none", zIndex:"60" });
  document.body.append(copy);
  const animations = [];
  const finish = () => { animations.forEach((animation) => animation.cancel()); copy.remove(); if (finishWelcomeTurn === finish) finishWelcomeTurn = null; };
  finishWelcomeTurn = finish;
  return () => {
    const target = document.querySelector(`[data-view-panel="${view}"] .auth-card`);
    if (!target) { finish(); return; }
    const timing = { duration:950, easing:"cubic-bezier(.22,.7,.25,1)", fill:"both" };
    animations.push(copy.animate([
      { transform:"perspective(1400px) rotateY(0deg)", opacity:1, transformOrigin:"left center" },
      { transform:"perspective(1400px) rotateY(-82deg)", opacity:0, transformOrigin:"left center" }
    ], timing));
    animations.push(target.animate([
      { transform:"perspective(1400px) rotateY(38deg) scale(.94)", opacity:.35, transformOrigin:"right center" },
      { transform:"perspective(1400px) rotateY(0deg) scale(1)", opacity:1, transformOrigin:"right center" }
    ], timing));
    Promise.all(animations.map((animation) => animation.finished)).then(finish, finish);
  };
}
function showView(view, focusMatches = false, fromHistory = false) {
  const playWelcomeTurn = prepareWelcomeTurn(view);
  if (view === "home" && focusMatches) view = "matches";
  if (view === "friend-chat") view = "home";
  if (view === "guess" && state.guessFinalized?.matchCode === state.activeMatchCode && state.guessFinalized?.cardId === activeCard()?.id) view = "timeline";
  if ((view === "guess" || view === "timeline" || (view === "result" && state.pendingResult?.matchCode === state.activeMatchCode)) && state.activeMatchCode) { state.roundResumeViews[state.activeMatchCode] = view; save(); }
  const replayRow = $(".replay-row"), songTimeline = $("#song-timeline"); let timelinePlayer = $("#timeline-player"); if (!timelinePlayer) { timelinePlayer = document.createElement("div"); timelinePlayer.id = "timeline-player"; } if (replayRow && songTimeline) { if (view === "timeline") { const strip = $(".timeline-view .round-player-strip"); strip ? strip.after(timelinePlayer) : $(".timeline-view")?.prepend(timelinePlayer); timelinePlayer.append(replayRow, songTimeline); } else { const guessView = $(".guess-view"), back = $(".guess-top .back-link") || $(".guess-view > .guess-back"); if (back) { back.classList.add("guess-back"); guessView?.prepend(back); } $(".guess-top")?.before(replayRow, songTimeline); } }
  document.documentElement.classList.remove("booting");
  const gameView = view === "guess" || view === "timeline";
  if (!gameView) stopCurrentTrack(true);
  if (view !== "chat") { clearInterval(chatPoll); chatPoll = 0; }
  if (view === "timeline") { $("#change-track-area").hidden = !state.changeTrackCards; $("#change-track-area").querySelectorAll(".no-change-cards").forEach((element) => element.remove()); }
  const profileLayer = ["profile", "avatar", "change-password"].includes(view);
  if (view === "profile" && !["profile", "avatar", "change-password"].includes(currentView)) { profileReturnView = currentView; profileReturnMenu = menuForView(currentView); }
  currentView = view;
  const selectedMenu = profileLayer ? profileReturnMenu : menuForView(view);
  if (!profileLayer) menuViewState[selectedMenu] = view;
  updateBottomBadges();
  const bottomMenu = $("#bottom-menu");
  if (bottomMenu) {
    bottomMenu.hidden = ["welcome", "login", "signup", "forgot-password", "reset-password"].includes(view);
    const profileToggle = document.querySelector(".profile-toggle");
    if (profileToggle) { profileToggle.hidden = bottomMenu.hidden; updateProfileToggleAvatar(); }
    const selected = selectedMenu;
    bottomMenu.querySelectorAll("button").forEach((button) => { if (button.dataset.bottomMenu === selected) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current"); });
  }
  if (["match", "guess", "timeline", "result"].includes(view)) renderRoundPlayers();
  if (view === "match") updateRoundStartButton();
  document.querySelectorAll("[data-view-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.viewPanel === view);
  });
  if (view === "result") setTimeout(showAchievementPopups, 0);
  if (gameView) resumeRoundTrack();
  playWelcomeTurn?.();
  if (!fromHistory) history.pushState({ view }, "", `#${view}`);
  requestAnimationFrame(() => {
    if (focusMatches) $("#my-matches-section").scrollIntoView({ block: "start" });
    else window.scrollTo({ top: 0, left: 0 });
  });
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-bottom-menu]");
  if (!button) return;
  showView(menuViewState[button.dataset.bottomMenu] || button.dataset.bottomMenu);
});
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
  const matchLeave = document.querySelector('[data-view-panel="match"] .button-leave');
  const isOnlyPlayer = soloMatch || (match.players || []).length <= 1;
  matchLeave.textContent = isOnlyPlayer ? "RADERA MATCH" : "LÄMNA MATCHEN";
  matchLeave.onclick = () => dialog(soloMatch ? "Vill du verkligen radera denna solomatch?" : isOnlyPlayer ? "Vill du verkligen radera denna onlinematch?" : "Vill du verkligen lämna matchen och därmed lämna walk over?", async () => {
    try {
      const user = await supabaseAuth.user(supabaseAuth.session()?.access_token);
      const players = await supabaseAuth.dataRequest("online_players?match_id=eq." + match.id + "&active=eq.true&select=user_id");
      const winner = isOnlyPlayer ? null : players.find((player) => String(player.user_id) !== String(user.id))?.user_id;
      if (winner) { state.stats.walkoverLeaves += 1; save(); }
      await supabaseAuth.dataRequest("online_matches?id=eq." + match.id, { status: "finished", last_result: winner ? { winner_id: winner, type: "walkover" } : null, updated_at: new Date().toISOString() }, "PATCH");
      state.history.unshift({ ...match, ...(soloMatch ? { mode: "solo" } : {}), leaveReason: soloMatch ? "RADERAD SOLOMATCH" : isOnlyPlayer ? "RADERAD ONLINE-MATCH" : "DU LÄMNADE - WALK OVER" });
      await syncMatches();
      showView("home", true);
    } catch (error) { dialog(error.message || "Kunde inte avsluta matchen."); }
  }, true, "JA", "NEJ");
  state.activeMatchCode = matchCode; save();
  refreshChatButtons(match);
  $("#overview-code").textContent = soloMatch ? "SOLOMATCH" : match.code;
  $("#overview-code").previousElementSibling.textContent = soloMatch ? "SPELTYP" : "MATCHKOD";
  const playersMetric = $("#overview-players-count").parentElement;
  $(".match-view").classList.toggle("solo-match-view", soloMatch);
  playersMetric.hidden = false;
  playersMetric.style.display = "";
  playersMetric.parentElement.classList.toggle("solo-metrics", soloMatch);
  $("#overview-players-count").textContent = soloMatch ? String(match.round || 1) : "2";
  playersMetric.querySelector("small").textContent = soloMatch ? ((match.round || 1) === 1 ? "OMGÅNG" : "OMGÅNGAR") : "SPELARE";
  const isYourTurn = match.status === "active", isWaiting = match.status === "waiting";
  const matchStarted = (match.players || []).some((player) => Number(player.rounds_started || 0) > 0);
  const score = soloMatch ? soloProgress(match) : null;
  $("#overview-round").textContent = soloMatch ? String(score.mistakes) : !matchStarted ? "MAX 8 SPELARE PER MATCH" : "1";
  $("#overview-round-label").textContent = soloMatch ? "FELPLACERADE" : !matchStarted ? "" : "OMGÅNG";
  $("#overview-target").textContent = soloMatch ? `${score.correct}/10` : "10";
  $("#overview-target-label").textContent = soloMatch ? "RÄTT PLACERADE" : "FÖRST TILL";
  // Button state is shared with return navigation and completed loading.
  $("#next-round").classList.toggle("is-visible", isYourTurn);
  updateRoundStartButton();
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
    if (match) { match.players = players; if (match.code === state.activeMatchCode) renderRoundPlayers(); }
    if (friendBox && match && !solo) { friendBox.hidden = false; const locked = match.locked || players.some((player) => Number(player.rounds_started || 0) >= 2); if (locked) friendBox.innerHTML = `<small>BJUD IN VÄN TILL MATCHEN</small><p>MATCHEN ÄR LÅST EFTERSOM OMGÅNG TVÅ REDAN PÅBÖRJATS.</p>`; else { const playerNames = new Set(players.map((player) => String(player.display_name).toLocaleLowerCase("sv-SE"))), sent = new Map(state.sentMatchInvites.filter((invite) => String(invite.match_code) === String(match.code)).map((invite) => [String(invite.recipient_id), invite])); matchInviteCandidates = state.friends.filter((friend) => String(friend.friend_id) !== String(state.userId) && !playerNames.has(String(friend.display_name).toLocaleLowerCase("sv-SE")) && !sent.has(String(friend.friend_id))); const sentRows = [...sent.values()].map((invite) => `<p class="match-invite-status ${invite.status}">${escapeHtml(invite.recipient_name || "Spelaren")} · ${invite.status === "pending" ? "INBJUDAN SKICKAD" : invite.status === "accepted" ? "INBJUDAN ACCEPTERAD" : "INBJUDAN AVVISAD"}</p>`).join(""); friendBox.innerHTML = `<small>BJUD IN VÄN TILL MATCHEN</small>${matchInviteCandidates.length ? `<button class="button button-green" id="open-invite-friends" type="button">BJUD IN VÄN TILL MATCHEN</button>` : `<p>DU HAR INGA FLER VÄNNER ATT BJUD IN TILL DENNA MATCH.</p>`}${sentRows}`; } }
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
      const waitingForStart = !players.some((player) => Number(player.rounds_started || 0) > 0);
      $("#overview-round").textContent = waitingForStart ? "MAX 8 SPELARE PER MATCH" : String(Math.max(1, ...players.map((player) => player.rounds_started || 0)));
      $("#overview-round-label").textContent = waitingForStart ? "" : "OMGÅNG";
      if (waitingForStart && isYourTurn && !roundLoading && !state.pendingResult && !state.currentCard) $("#next-round").textContent = "STARTA MATCH";
      $("#overview-target").textContent = "10";
      $("#overview-target-label").textContent = "FÖRST TILL";
    }
    $("#overview-players").innerHTML = solo ? `<button class="timeline-button show-player-round" data-player-round="${players[0]?.id || ""}" type="button">VISA SENASTE SPELADE OMGÅNG</button>` : players.map((player, index) => { const friend = state.friends.some((item) => String(item.friend_id) === String(player.user_id)), pending = state.sentFriendRequests.some((item) => String(item.recipient_id) === String(player.user_id) && item.status === "pending"), saved = player.last_round?.score || {}, correct = Math.max(1, Number(saved.correct) || (player.locked_timeline || []).length), mistakes = Number.isFinite(Number(saved.mistakes)) && saved.mistakes !== "" ? Math.max(0, Number(saved.mistakes)) : Math.max(0, Number(player.rounds_started || 0) - Math.max(0, correct - 1)), swapCards = Math.max(0, Number(player.swap_cards) || 0); const friendControl = String(player.user_id) === String(state.userId) ? "" : friend ? `<small class="already-friend">REDAN VÄN MED</small>` : pending ? `<small class="already-friend">VÄNFÖRFRÅGAN SKICKAD</small>` : `<button class="button button-green add-match-friend" data-add-match-friend="${player.user_id}" data-player-name="${escapeHtml(player.display_name)}" type="button">LÄGG TILL VÄN</button>`; return `<article class="overview-player ${isYourTurn && index === 0 ? "your-turn" : ""}"><div class="overview-player-header"><span class="turn-order">${player.turn_order + 1}</span><strong>${player.display_name}</strong>${friendControl}</div><div class="overview-player-stats"><div><strong>${correct}/10</strong><small>RÄTT PLACERADE</small></div><div><strong>${mistakes}</strong><small>FELPLACERADE</small></div><div><strong>${swapCards}/3</strong><small>BYT-LÅT-KORT</small></div></div><button class="timeline-button show-player-round" data-player-round="${player.id}" type="button">VISA SENASTE SPELADE OMGÅNG</button></article>`; }).join("");
    $("#overview-players").hidden = false;
    if (!solo && players.length > 2) players.forEach((player) => {
      if (String(player.user_id) === String(state.userId)) return;
      const roundButton = [...document.querySelectorAll("#overview-players [data-player-round]")].find((item) => String(item.dataset.playerRound) === String(player.id));
      if (!roundButton) return;
      const removeButton = document.createElement("button");
      removeButton.className = "button button-leave remove-match-player";
      removeButton.type = "button";
      removeButton.dataset.removeMatchPlayer = player.user_id;
      removeButton.dataset.playerName = player.display_name;
      removeButton.textContent = "AVVISA SPELARE FRÅN MATCHEN";
      roundButton.after(removeButton);
    });
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
  if (!wrongButton) { wrongButton = document.createElement("button"); wrongButton.id = "wrong-matches"; wrongButton.hidden = true; $("#result-back").after(wrongButton); }
  const wrong = round.outcome === "wrong"; $("#result-back").hidden = false; $("#result-back").textContent = "← Tillbaka"; wrongButton.hidden = true; $("#placement-result").className = `result-check ${wrong ? "bad" : "good"}`; $("#placement-result").textContent = solo ? (wrong ? "✕  Fel placerat" : "☑  Rätt placerat") : wrong ? "✕  Fel placering" : "☑  Rätt placering";
  let overviewButton = $("#wrong-overview");
  if (!overviewButton) { overviewButton = document.createElement("button"); overviewButton.id = "wrong-overview"; overviewButton.className = "lobby-back wrong-match-button"; overviewButton.type = "button"; overviewButton.textContent = "TILL MATCHÖVERSIKT"; overviewButton.addEventListener("click", () => openMatch(state.activeMatchCode)); $("#result-back").after(overviewButton); }
  overviewButton.hidden = !state.activeMatchCode;
  $("#result-timeline").innerHTML = (round.timeline || round.cards || []).map((card) => { const status = card.status || (wrong ? "OLÅST" : "LÅST"), unlocked = !solo && (isUnlockedStatus(status) || (wrong && status === "RÄTT PLACERAT")); return `<article class="year-card ${status === "STARTKORT" || status === "LÅST" ? "locked-card" : /FEL ?PLACERAT/.test(status) ? "misplaced-card" : unlocked ? "unlocked-card" : solo ? "correct-card" : "locked-card"}"${status === "STARTKORT" ? " style=\"border-color:#58657a;background:#202632\"" : ""}><strong>${card.year}</strong><small><span class="card-song">${card.title}<br>${card.artist}</span><span class="card-status">${cardStatusLabel(unlocked ? "OLÅST" : status)}</span></small></article>`; }).join("");
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
  $("#change-track-area").hidden = !state.changeTrackCards;
  $("#lock-placement").classList.add("is-visible");
  $("#placed-message").textContent = "";
}
function placementIsCorrect() {
  const cards = [...state.lockedTimeline, ...state.roundUnlocked].sort((a, b) => a.year - b.year);
  const position = Number($("#placed-card")?.dataset.position);
  return (!cards[position - 1] || cards[position - 1].year <= activeCard().year) && (!cards[position] || activeCard().year <= cards[position].year);
}
function resetTurnInput() {
  state.currentGuess = null; state.guessDraft = null; state.guessFinalized = null; state.placementDraft = null; $("#guess-artist").value = ""; $("#guess-track").value = ""; $("#secret-card").classList.remove("is-placed"); $("#lock-placement").classList.remove("is-visible"); $("#placed-message").textContent = ""; $("#change-track-area").hidden = !state.changeTrackCards; if (state.currentCard && state.pendingSwapAward?.cardId !== state.currentCard.id) void settlePendingSwapAward();
  const cards = [...state.lockedTimeline.map((card, index) => ({ ...card, status: index === 0 ? "STARTKORT" : "LÅST" })), ...state.roundUnlocked].sort((a, b) => a.year - b.year);
  const slot = (index) => `<div class="slot" data-slot="${index}">PLACERA<br>HÄR</div>`;
  $("#timeline-row").innerHTML = cards.map((card, index) => `${(index === 0 || cards[index - 1].year !== card.year) ? slot(index) : ""}<article class="year-card ${card.status === "STARTKORT" ? "locked-card" : card.status === "OLÅST" ? "unlocked-card" : ""}"><strong>${card.year}</strong><small><span class="card-song">${card.title}<br>${card.artist}</span><span class="card-status">${cardStatusLabel(card.status)}</span></small></article>`).join("") + slot(cards.length); save();
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
async function settlePendingSwapAward() { const pending = state.pendingSwapAward; if (!pending || pending.matchCode !== state.activeMatchCode) return; state.pendingSwapAward = null; const used = state.swapUsedThisRound; state.swapUsedThisRound = false; save(); if (!used) { grantAchievement("firstSwap", "Första byt-låt-kortet"); if (state.changeTrackCards < 3) await updateSwapCards(1); finishAchievementAwards(); } }
function hasCorrectSongGuess(card) { return completeSongGuess(state.currentGuess, card); }
function soloProgress(match, locked = state.lockedTimeline) { const code = match?.code || state.activeMatchCode, player = (match?.players || []).find((item) => String(item.user_id) === String(state.userId)), started = Number(player?.rounds_started || 0), fallback = { correct: Math.max(1, locked.length || 0), mistakes: Math.max(0, started - Math.max(0, (locked.length || 0) - 1)) }; const saved = state.soloProgress?.[code]; if (!saved || typeof saved !== "object") state.soloProgress[code] = fallback; else { saved.correct = Math.max(1, Number(saved.correct) || fallback.correct); saved.mistakes = started === 0 ? 0 : Math.max(0, Number(saved.mistakes) || 0); } return state.soloProgress[code]; }
function addMatch(matchCode) {
  state.matches.unshift({ code: matchCode, title: `${state.playerName}, väntar på motspelare`, status: "waiting" });
  save(); render(); openLobby(matchCode);
}
async function syncMatches() {
  const user = await supabaseAuth.user(supabaseAuth.session()?.access_token);
  const previousActive = state.matches.find((match) => match.code === state.activeMatchCode);
  const rows = await supabaseAuth.dataRequest(`online_players?user_id=eq.${user.id}&active=eq.true&select=match_id,online_matches(id,code,status,phase,current_user_id,last_result,turn_notice,updated_at)`);
  let players = []; try { const ids = rows.map((row) => row.match_id).join(","); if (ids) players = await supabaseAuth.dataRequest(`online_players?match_id=in.(${ids})&active=eq.true&select=id,match_id,user_id,display_name,turn_order,rounds_started,locked_timeline,last_round,swap_cards&order=turn_order`); } catch { /* matchlistan fungerar även om namnfrågan nekas */ }
  rows.forEach((row) => { if (row.online_matches?.status === "finished") settleResult(row.online_matches, user.id, players.filter((player) => String(player.match_id) === String(row.match_id))); });
  state.matches = rows.map((row) => { const match = row.online_matches, matchPlayers = players.filter((player) => String(player.match_id) === String(row.match_id)), solo = isSoloMatch(match), opponent = matchPlayers.find((player) => String(player.user_id) !== String(user.id))?.display_name || "motspelare"; return !match || match.status === "finished" ? null : { code: match.code, id: match.id, title: solo ? "Solomatch" : match.status === "waiting" ? `${state.playerName}, väntar på motspelare` : `${state.playerName}, ${opponent}`, status: match.status === "waiting" ? "waiting" : String(match.current_user_id) === String(user.id) ? "active" : "opponent", currentUserId: match.current_user_id, solo, locked: match.phase === "locked" || (solo && match.phase === "solo_locked"), round: Math.max(1, ...matchPlayers.map((player) => player.rounds_started || 0)), players: matchPlayers, turnNotice: match.turn_notice, lastResult: match.last_result, updatedAt: match.updated_at }; }).filter(Boolean).sort((a, b) => ({ active: 0, opponent: 1, waiting: 2 }[a.status] - { active: 0, opponent: 1, waiting: 2 }[b.status]) || new Date(a.updatedAt || 0) - new Date(b.updatedAt || 0));
  state.matches.filter((match) => !match.solo && match.players.length >= 2 && state.career.createdMatchCodes.includes(String(match.code))).forEach((match) => { if (!state.career.startedMatchCodes.includes(String(match.code))) state.career.startedMatchCodes.push(String(match.code)); });
  evaluateCareerAchievements();
  save(); render();
  const activeMatch = state.matches.find((match) => match.code === state.activeMatchCode);
  renderRoundPlayers();
  if (currentView === "match") updateRoundStartButton();
  const activeMatchChanged = !previousActive || previousActive.status !== activeMatch?.status || previousActive.title !== activeMatch?.title || previousActive.round !== activeMatch?.round || previousActive.locked !== activeMatch?.locked;
  if ((currentView === "lobby" || currentView === "match") && activeMatch && activeMatchChanged) openMatch(activeMatch.code);
  if (["guess", "timeline"].includes(currentView) && !resultIsLocked && activeMatch && activeMatch.status !== "active") openMatch(activeMatch.code);
  if (!activeMatch && state.activeMatchCode && ["lobby", "match", "guess", "timeline"].includes(currentView)) showView("home", true);
  state.matches.forEach((match) => { showTurnNotice(match); showFinalChanceNotice(match); });
}
async function refreshRealtimeState() { if (realtimeRefreshing || document.visibilityState !== "visible" || !supabaseAuth.session()?.access_token) return; realtimeRefreshing = true; try { await Promise.all([syncMatches(), syncFriends()]); if (currentView === "chat") await loadChat(); else if (currentView === "friend-chat") await loadFriendChat(); else if (currentView === "match") { const match = state.matches.find((item) => item.code === state.activeMatchCode); if (match?.id) await loadOverviewPlayers(match.id, match.status === "active", isSoloMatch(match)); } else await refreshActiveRound(); } catch { /* nästa Realtime- eller reservsynk försöker igen */ } finally { realtimeRefreshing = false; } }
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
  const matches = await supabaseAuth.dataRequest("online_matches", { code: matchCode, status: "waiting", deck, used_track_ids: [starter.id], target_cards: 10, current_user_id: user.id, phase: "waiting", turn_started_at: null, updated_at: new Date().toISOString() }, "POST");
  await supabaseAuth.dataRequest("online_players", { match_id: matches[0].id, user_id: user.id, display_name: state.playerName, turn_order: 0, locked_timeline: [deck[0]], turn_cards: [], swap_cards: 0, rounds_started: 0, active: true, history_hidden: false, updated_at: new Date().toISOString() }, "POST");
  if (inviteFriendId) await supabaseAuth.dataRequest("rpc/digihits_invite_friend", { match_code_input: matchCode, recipient: inviteFriendId }, "POST");
  rememberTrack(starter); state.changeTrackCards = 0; state.career.createdMatchCodes.push(matchCode); save(); await syncMatches(); if (inviteFriendId) await syncFriends(); openMatch(matchCode);
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
  const answer = event.target.closest("[data-friend-answer]"), dismiss = event.target.closest("[data-dismiss-friend-request]"), dismissNotice = event.target.closest("[data-dismiss-friend-notice]"), declineInvite = event.target.closest("[data-decline-match-invite]"), dismissMatchInvite = event.target.closest("[data-dismiss-sent-match-invite]"), create = event.target.closest("[data-create-friend-match]"), remove = event.target.closest("[data-remove-friend]"), invite = event.target.closest("[data-join-friend-match]"), chat = event.target.closest("[data-open-friend-chat]");
  try {
    if (answer) { const accepting = answer.dataset.friendAccept === "true", friend = state.friendRequests.find((item) => String(item.request_id) === String(answer.dataset.friendAnswer)); if (accepting) dialogProgress(`ACCEPTERAR VÄNFÖRFRÅGAN FRÅN ${friend?.display_name || "SPELAREN"}…`); try { await supabaseAuth.dataRequest("rpc/digihits_answer_friend_request", { request_id: answer.dataset.friendAnswer, accept_request: accepting }, "POST"); await syncFriends(); } finally { if (accepting) closeDialogProgress(); } }
    else if (dismiss) { await supabaseAuth.dataRequest("rpc/digihits_dismiss_sent_friend_request", { request_id: dismiss.dataset.dismissFriendRequest }, "POST"); await syncFriends(); }
    else if (dismissNotice) { await supabaseAuth.dataRequest("rpc/digihits_dismiss_friend_notification", { notice: dismissNotice.dataset.dismissFriendNotice }, "POST"); await syncFriends(); }
    else if (declineInvite) { await supabaseAuth.dataRequest("rpc/digihits_dismiss_match_invite", { invite: declineInvite.dataset.declineMatchInvite }, "POST"); await syncFriends(); }
    else if (dismissMatchInvite) { await supabaseAuth.dataRequest("rpc/digihits_dismiss_sent_match_invite", { invite: dismissMatchInvite.dataset.dismissSentMatchInvite }, "POST"); await syncFriends(); }
    else if (create) { const friend = state.friends.find((item) => String(item.friend_id) === String(create.dataset.createFriendMatch)); dialog(`Vill du skapa en match mot ${friend?.display_name || "den här spelaren"}?`, async () => { try { await createOnlineMatch(create.dataset.createFriendMatch); } catch (error) { alert(error.message); } }, false, "JA"); }
    else if (remove) dialog(`Är du säker på att du vill ta bort ${remove.dataset.friendName}?`, async () => { dialogProgress(`TAR BORT ${remove.dataset.friendName} FRÅN VÄNSKAPSLISTAN…`); try { await supabaseAuth.dataRequest("rpc/digihits_remove_friend", { target: remove.dataset.removeFriend }, "POST"); await syncFriends(); } finally { closeDialogProgress(); } }, true, "JA");
    else if (invite) { dialogProgress("ACCEPTERAR MATCHINBJUDAN…"); try { const starter = pickFreshTrack(testDeck), matchCode = await supabaseAuth.dataRequest("rpc/digihits_accept_match_invite", { invite: invite.dataset.inviteId, starter }, "POST"); await syncMatches(); const existing = state.matches.find((match) => match.code === matchCode); if (!existing) throw new Error("Matchinbjudan kunde inte öppnas."); openMatch(existing.code); await syncFriends(); } finally { closeDialogProgress(); } }
    else if (chat) await openFriendChat(chat.dataset.openFriendChat);
  } catch (error) { dialog(error.message || "Det gick inte att gå med i matchen."); }
});
document.addEventListener("click", async (event) => { const button = event.target.closest("[data-invite-friend]"); if (!button) return; const friend = state.friends.find((item) => String(item.friend_id) === String(button.dataset.inviteFriend)); if (state.sentMatchInvites.some((invite) => String(invite.match_code) === String(state.activeMatchCode) && String(invite.recipient_id) === String(button.dataset.inviteFriend))) return dialog("Inbjudan redan skickad."); dialog(`Vill du lägga till ${friend?.display_name || "spelaren"} till denna match?`, async () => { try { await supabaseAuth.dataRequest("rpc/digihits_invite_friend", { match_code_input: state.activeMatchCode, recipient: button.dataset.inviteFriend }, "POST"); await syncFriends(); openMatch(state.activeMatchCode); } catch (error) { alert(error.message); } }, false, "JA"); });
document.addEventListener("click", (event) => { if (!event.target.closest("#open-invite-friends")) return; $("#dialog-title").textContent = "Bjud in vän"; $("#dialog-message").innerHTML = matchInviteCandidates.length ? `<div class="invite-picker">${matchInviteCandidates.map((friend) => `<div><strong>${escapeHtml(friend.display_name)}</strong><button class="button button-green" data-invite-friend="${friend.friend_id}" type="button">BJUD IN</button></div>`).join("")}</div>` : "Du har inga fler vänner att bjuda in."; $("#dialog-cancel").hidden = true; $("#dialog-confirm").textContent = "STÄNG"; $("#dialog-confirm").className = "button button-secondary"; $("#dialog-confirm").onclick = () => { $("#app-dialog").hidden = true; }; $("#app-dialog").hidden = false; });
document.addEventListener("click", async (event) => { const button = event.target.closest("[data-add-match-friend]"); if (!button) return; dialog(`Vill du lägga till ${button.dataset.playerName} i din vänskapslista?`, async () => { try { await supabaseAuth.dataRequest("rpc/digihits_send_friend_request", { requested: button.dataset.playerName }, "POST"); state.sentFriendRequests = [...state.sentFriendRequests.filter((item) => String(item.recipient_id) !== String(button.dataset.addMatchFriend)), { recipient_id: String(button.dataset.addMatchFriend), display_name: button.dataset.playerName, status: "pending" }]; save(); button.replaceWith(Object.assign(document.createElement("small"), { className: "already-friend", textContent: "VÄNFÖRFRÅGAN SKICKAD" })); } catch (error) { alert(error.message); } }, false, "JA"); });
document.addEventListener("click", async (event) => { const button = event.target.closest("[data-match-join-request]"); if (!button) return; try { await supabaseAuth.dataRequest("rpc/digihits_answer_match_join_request", { request: button.dataset.matchJoinRequest, allow_join: button.dataset.allowMatchJoin === "true" }, "POST"); await syncMatches(); if (state.activeMatchCode) openMatch(state.activeMatchCode); } catch (error) { alert(error.message); } });
document.addEventListener("click", async (event) => { const button = event.target.closest("[data-remove-match-player]"); if (!button) return; const name = button.dataset.playerName || "spelaren"; dialog("Vill du verkligen avvisa " + name + " från matchen?\n\nNär samtliga spelare tryckt på Avvisa " + name + " tas spelaren bort från matchen.", async () => { try { const result = await supabaseAuth.dataRequest("rpc/digihits_vote_remove_match_player", { match_code_input: state.activeMatchCode, remove_player: button.dataset.removeMatchPlayer }, "POST"); const vote = Array.isArray(result) ? result[0] : result; await syncMatches(); openMatch(state.activeMatchCode); if (!vote?.removed) dialog("Din avvisning är sparad. Väntar på övriga spelares avvisning (" + (vote?.votes || 1) + "/" + (vote?.needed || "?") + ")."); } catch (error) { dialog(error.message || "Kunde inte avvisa spelaren."); } }, true, "AVVISA"); });
$("#matches").addEventListener("click", (event) => {
  const chatButton = event.target.closest("[data-open-chat]");
  if (chatButton) { openChat(chatButton.dataset.openChat).catch((error) => alert(error.message)); return; }
  const openButton = event.target.closest("[data-open-match]");
  if (openButton) { openMatch(openButton.dataset.openMatch); return; }
  const deleteButton = event.target.closest("[data-delete-match]");
  if (deleteButton) {
    const match = state.matches.find((item) => item.code === deleteButton.dataset.deleteMatch); if (!match) return; const opponent = String(match.title || "").split(", ").find((name) => name.toLocaleLowerCase("sv-SE") !== String(state.playerName).toLocaleLowerCase("sv-SE")) || "motspelaren", message = match.solo ? "Vill du verkligen avsluta solomatchen?" : match.status === "waiting" ? `Vill du verkligen lämna matchen med matchkoden ${match.code}?` : `Vill du verkligen lämna matchen mot ${opponent} med matchkoden ${match.code}? Du kommer därmed lämna walk over.`;
    dialog(message, async () => { try { const user = await supabaseAuth.user(supabaseAuth.session()?.access_token), players = await supabaseAuth.dataRequest(`online_players?match_id=eq.${match.id}&select=user_id`), winner = players.find((player) => player.user_id !== user.id)?.user_id; if (winner) { state.selfWalkovers.push(match.id); state.stats.walkoverLeaves += 1; save(); } await supabaseAuth.dataRequest(`online_matches?id=eq.${match.id}`, { status: "finished", last_result: winner ? { winner_id: winner, type: "walkover" } : null, updated_at: new Date().toISOString() }, "PATCH"); state.history.unshift({ ...match, ...(match.solo ? { mode: "solo" } : {}), leaveReason: match.solo ? "RADERAD SOLOMATCH" : match.status === "waiting" ? "DU LÄMNADE INNAN MATCHSTART" : "DU LÄMNADE - WALK OVER" }); await syncMatches(); } catch (error) { alert(error.message); } }, true);
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
[$("#lobby-chat"), $("#match-chat")].filter(Boolean).forEach((button) => button.addEventListener("click", () => openChat().catch((error) => alert(error.message))));
$("#chat-back").addEventListener("click", () => { const view = state.chatReturnView === "lobby" ? "lobby" : "match"; if (view === "lobby") openLobby(state.activeMatchCode); else openMatch(state.activeMatchCode); });
$("#chat-form").addEventListener("submit", async (event) => { event.preventDefault(); const match = state.matches.find((item) => item.code === state.chatMatchCode), body = $("#chat-input").value.trim(); if (!match?.id || !body) return; const user = await supabaseAuth.user(supabaseAuth.session()?.access_token); try { await supabaseAuth.dataRequest("online_messages", { match_id: match.id, user_id: user.id, display_name: state.playerName, body, message: body }, "POST"); $("#chat-input").value = ""; await loadChat(); } catch (error) { alert(error.message); } });
$("#friend-chat-back").addEventListener("click", () => showView("home", true));
$("#friend-chat-form").addEventListener("submit", async (event) => { event.preventDefault(); const body = $("#friend-chat-input").value.trim(); if (!state.friendChatId || !body) return; try { await supabaseAuth.dataRequest("rpc/digihits_send_friend_message", { friend: state.friendChatId, message_body: body }, "POST"); $("#friend-chat-input").value = ""; await loadFriendChat(); } catch (error) { alert(error.message); } });
document.addEventListener("click", (event) => { const achievement = event.target.closest("[data-achievement-info]"); if (!achievement) return; dialog(achievement.dataset.achievementLabel + "\n\n" + achievement.dataset.achievementDescription + "\n\nBelöning: +3 onlinepoäng."); });
window.resumeDigihitsRound = async () => { const button = $("#next-round"); if (button.disabled) return; if (!supabaseAuth.spotify()) { dialog("Du måste ansluta till ett Spotify Premium-konto.", () => supabaseAuth.connectSpotify().catch((error) => alert(error.message)), false, "ANSLUT KONTO"); return; } roundLoading = true; button.disabled = true; const label = button.textContent; const loadingLabel = /STARTA MATCH/.test(label) ? "STARTAR MATCH…" : "LADDAR OMGÅNG…"; let enteredRound = false; button.textContent = loadingLabel; try { const pending = state.pendingResult; if (pending?.matchCode === state.activeMatchCode) { currentPlacementCorrect = pending.correct !== false; resultIsLocked = true; renderRoundResult(currentPlacementCorrect, pending.card, pending.snapshot); enteredRound = true; showView("result"); return; } await syncMatches(); button.textContent = loadingLabel; const match = state.matches.find((item) => item.code === state.activeMatchCode); if (!match || match.status !== "active") throw new Error("Omgången kan inte återupptas just nu."); await restoreRoundUnlocked(); const existingCard = Boolean(state.currentCard); if (existingCard) { enteredRound = true; showView(state.roundResumeViews[state.activeMatchCode] || "guess"); pausedForNavigation = true; resumeRoundTrack(); return; } state.roundUnlocked = []; save(); await markRoundStarted(); button.textContent = loadingLabel; await dealCard(); resetTurnInput(); enteredRound = true; await enterNewCardGuess(); } catch (error) { alert(error.message); } finally { roundLoading = false; button.disabled = false; if (!enteredRound) button.textContent = label; updateRoundStartButton(); } };
$("#next-round").addEventListener("click", window.resumeDigihitsRound);
$("#overview-players").addEventListener("click", (event) => { const button = event.target.closest(".show-player-round"); if (!button) return; showLatestRound(latestRounds[button.dataset.playerRound]); });
document.addEventListener("click", (event) => { const button = event.target.closest(".final-player-round"); if (button) { const id = button.dataset.playerRound; returnToFinalResult = true; showLatestRound({ ...(latestRounds[id] || {}), historyScore: historyPlayerScores[id] }); } });
document.addEventListener("click", (event) => { const button = event.target.closest("[data-round-player]"); if (!button) return; const storedRound = latestRounds[button.dataset.roundPlayer]; if (!storedRound) { dialog("Spelaren har ingen spelad omgång ännu."); return; } const shouldLockCards = !button.classList.contains("is-current") && storedRound.outcome !== "wrong", lockStatus = (card) => ({ ...card, status: shouldLockCards && ["OLÅST", "LÅST DENNA OMGÅNG"].includes(card.status) ? "LÅST" : card.status }), round = { ...storedRound, cards: (storedRound.cards || []).map(lockStatus), timeline: (storedRound.timeline || []).map(lockStatus) }; latestRoundReturnView = currentView; showLatestRound(round); });
$("#play-sample").addEventListener("click", async () => { try { if (trackStartPromise) { await trackStartPromise; return; } const playerState = await spotifyPlayer?.getCurrentState().catch(() => null), expected = state.selectedTracks[activeCard().id]?.uri, sameTrack = expected && playerState?.track_window?.current_track?.uri === expected, actuallyPlaying = Boolean(playerState && !playerState.paused); if (actuallyPlaying && sameTrack) { await spotifyPlayer.pause(); wasPausedByUser = true; setPlayButton(false); } else if ((wasPausedByUser || pausedForNavigation) && sameTrack) { await spotifyPlayer.resume(); wasPausedByUser = false; pausedForNavigation = false; setPlayButton(true); } else { trackStartPromise = playCurrentTrack().finally(() => { trackStartPromise = null; }); await trackStartPromise; } } catch (error) { songStarting = false; setPlayButton(false); if (/ansluta spelaren|starta låten|spelaren kunde inte laddas/i.test(error.message)) dialog("Spotify behöver anslutas igen innan låten kan spelas.", () => { resetSpotifyPlayer(); supabaseAuth.disconnectSpotify(); supabaseAuth.connectSpotify(true).catch((issue) => alert(issue.message)); }, false, "ANSLUT KONTO"); else alert(error.message); } });
$("#replay-track").addEventListener("click", async () => { try { if (trackStartPromise) await trackStartPromise; loadedSpotifyCardId = null; trackStartPromise = playCurrentTrack().finally(() => { trackStartPromise = null; }); await trackStartPromise; } catch (error) { alert(error.message); } });
[$("#guess-artist"), $("#guess-track")].forEach((field) => field.addEventListener("input", () => { if (!activeCard()) return; state.guessDraft = { matchCode: state.activeMatchCode, cardId: activeCard().id, artist: $("#guess-artist").value, title: $("#guess-track").value }; save(); }));
$("#guess-form").addEventListener("submit", async (event) => { event.preventDefault(); state.currentGuess = { artist: $("#guess-artist").value.trim(), title: $("#guess-track").value.trim() }; state.guessDraft = null; state.guessFinalized = { matchCode: state.activeMatchCode, cardId: activeCard()?.id }; save(); $("#change-track-area").hidden = !state.changeTrackCards; showView("timeline"); });
let dragTarget = null, dragOffsetX = 0, dragOffsetY = 0;
function startDrag(card, event) {
  const bounds = card.getBoundingClientRect(); dragOffsetX = event.clientX - bounds.left; dragOffsetY = event.clientY - bounds.top;
  try { card.setPointerCapture(event.pointerId); } catch {}
  card.classList.add("dragging");
  card.style.setProperty("width", `${bounds.width}px`, "important"); card.style.setProperty("height", `${bounds.height}px`, "important");
  dragTarget = null;
  moveCard(event);
}
$("#secret-card").addEventListener("pointerdown", (event) => startDrag($("#secret-card"), event));
$("#timeline-row").addEventListener("pointerdown", (event) => { const card = event.target.closest(".placed-card"); if (card) { event.preventDefault(); startDrag(card, event); } });
function moveCard(event) {
  const card = document.querySelector(".dragging");
  card.style.left = `${event.clientX - dragOffsetX}px`;
  card.style.top = `${event.clientY - dragOffsetY}px`;
  const timeline = $("#timeline-row"), bounds = timeline.getBoundingClientRect();
  if (event.clientX < bounds.left + 46) timeline.scrollLeft -= 18;
  else if (event.clientX > bounds.right - 46) timeline.scrollLeft += 18;
  document.querySelectorAll("[data-slot]").forEach((slot) => slot.classList.remove("is-target"));
  const slots = [...document.querySelectorAll("[data-slot]")], direct = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-slot]");
  const closest = slots.map((slot) => { const area = slot.getBoundingClientRect(), centerX = area.left + area.width / 2, centerY = area.top + area.height / 2; return { slot, distance: Math.hypot(event.clientX - centerX, event.clientY - centerY) }; }).sort((a, b) => a.distance - b.distance)[0];
  dragTarget = direct || (closest?.distance <= 145 ? closest.slot : null);
  dragTarget?.classList.add("is-target");
}
document.addEventListener("pointermove", (event) => { if (document.querySelector(".dragging")) moveCard(event); });
document.addEventListener("pointerup", () => {
  const card = document.querySelector(".dragging");
  if (!card) return;
  card.classList.remove("dragging");
  card.style.left = ""; card.style.top = ""; card.style.removeProperty("width"); card.style.removeProperty("height");
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
  const target = (await supabaseAuth.dataRequest(`online_matches?id=eq.${match.id}&select=target_cards`))[0]?.target_cards || 10;
  const projectedCorrect = currentPlacementCorrect ? (minePlayer.locked_timeline || []).length + cardsToLock.length : (minePlayer.locked_timeline || []).length;
  const projectedRounds = Number(minePlayer.rounds_started || 0);
  const playerScores = players.map((player) => { const saved = player.last_round?.score || {}; return { user_id: player.user_id, correct: String(player.user_id) === String(user.id) ? projectedCorrect : Math.max(1, Number(saved.correct) || (player.locked_timeline || []).length), rounds: String(player.user_id) === String(user.id) ? projectedRounds : Number(player.rounds_started || 0) }; });
  const highestCorrect = Math.max(...playerScores.map((item) => item.correct)), maxRounds = Math.max(...playerScores.map((item) => item.rounds)), allPlayersHadEqualTurns = playerScores.every((item) => item.rounds >= maxRounds), leaders = playerScores.filter((item) => item.correct === highestCorrect);
  const finalReady = !solo && highestCorrect >= target && allPlayersHadEqualTurns;
  const winnerId = solo && projectedCorrect >= target ? user.id : finalReady && leaders.length === 1 ? leaders[0].user_id : null;
  const awaitingFinalChance = !solo && projectedCorrect >= target && !finalReady;
  const won = Boolean(winnerId);
  const roundCards = currentPlacementCorrect ? cardsToLock.map((card) => ({ ...card, status: solo ? "RÄTT PLACERAT" : "LÅST DENNA OMGÅNG" })) : [...state.roundUnlocked.map((card) => ({ ...card, status: solo ? "RÄTT PLACERAT" : "OLÅST" })), { ...currentCard, status: solo ? "FEL PLACERAT" : "FELPLACERAT" }];
  const previousScore = minePlayer.last_round?.score || {}, priorCorrect = Math.max(1, Number(previousScore.correct) || (minePlayer.locked_timeline || []).length), priorMistakes = Math.max(0, Number(previousScore.mistakes) || Math.max(0, Number(minePlayer.rounds_started || 0) - Math.max(0, priorCorrect - 1))), score = { correct: currentPlacementCorrect ? priorCorrect + cardsToLock.length : priorCorrect, mistakes: priorMistakes + (currentPlacementCorrect ? 0 : 1) };
  const lastRound = { ended_at: new Date().toISOString(), rounds: Number(minePlayer.rounds_started || 0), outcome: won ? "won" : currentPlacementCorrect ? "locked" : "wrong", guess: state.currentGuess || {}, cards: roundCards, score, timeline: savedTimeline || [...(minePlayer.locked_timeline || []).map((card, index) => ({ ...card, status: index === 0 ? "STARTKORT" : "LÅST" })), ...roundCards] };
  const currentSwapCards = Math.max(0, Math.min(3, Number(state.changeTrackCards ?? minePlayer.swap_cards) || 0));
  await supabaseAuth.dataRequest(`online_players?id=eq.${minePlayer.id}`, { locked_timeline: currentPlacementCorrect ? [...(minePlayer.locked_timeline || []), ...cardsToLock] : minePlayer.locked_timeline, turn_cards: [], current_card: null, last_round: lastRound, swap_cards: currentSwapCards, updated_at: new Date().toISOString() }, "PATCH");
  const lockMatch = match.locked || (minePlayer.rounds_started || 0) >= 2;
  await supabaseAuth.dataRequest(`online_matches?id=eq.${match.id}`, { status: won ? "finished" : "active", current_user_id: won ? null : next.user_id, phase: won ? "finished" : solo ? (lockMatch ? "solo_locked" : "solo") : lockMatch ? "locked" : "turn_ready", last_result: { ...lastRound, player_id: user.id, ...(won ? { winner_id: winnerId, type: solo ? "solo" : "win" } : {}), ...(awaitingFinalChance ? { awaiting_final_chance: true, leader_id: user.id } : {}) }, ...(solo || won ? {} : { turn_started_at: new Date().toISOString(), turn_reminder_sent_at: null, turn_notice: null }), updated_at: new Date().toISOString() }, "PATCH");
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
  return { won, winnerId, awaitingFinalChance, earnedSwapCard, soloSummary };
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
  const starter = !state.roundAnimationSeen[match.code] && state.lockedTimeline.length === 1 ? state.lockedTimeline[0] : null;
  state.roundAnimationSeen[match.code] = true; pendingTimelineDeal = { card, starter }; save();
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
  state.currentCard = serverCard; state.currentCardMatchCode = state.currentCard ? match.code : null; state.changeTrackCards = rows[0]?.swap_cards || 0; if (state.currentCard && state.pendingSwapAward?.cardId !== state.currentCard.id) await settlePendingSwapAward(); if (isSoloMatch(match)) state.soloProgress[match.code] ||= { correct: state.lockedTimeline.length, mistakes: Math.max(0, (rows[0]?.rounds_started || 0) - Math.max(0, state.lockedTimeline.length - 1)) };
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
  if (player) { const rounds = (player.rounds_started || 0) + 1, startedAt = new Date().toISOString(); await supabaseAuth.dataRequest(`online_players?id=eq.${player.id}`, { rounds_started: rounds, updated_at: startedAt }, "PATCH"); if (!isSoloMatch(match)) await supabaseAuth.dataRequest(`online_matches?id=eq.${match.id}`, { turn_started_at: startedAt, turn_reminder_sent_at: null, turn_notice: null, updated_at: startedAt }, "PATCH"); const local = state.matches.find((match) => match.code === state.activeMatchCode); if (local) { local.round = rounds; save(); } }
  if (!isSoloMatch(match)) { const participants = await supabaseAuth.dataRequest(`online_players?match_id=eq.${match.id}&active=eq.true&select=user_id`), others = participants.map((item) => String(item.user_id)).filter((id) => id !== String(user.id)), today = localDateKey(); if (participants.length >= 2 && state.career.createdMatchCodes.includes(String(match.code))) state.career.startedMatchCodes = [...new Set([...state.career.startedMatchCodes, String(match.code)])]; state.career.fullHouse ||= participants.length >= 4; state.career.playedWith = [...new Set([...state.career.playedWith, ...others])]; state.career.dailyOpponents[today] = [...new Set([...(state.career.dailyOpponents[today] || []), ...others])]; save(); evaluateCareerAchievements(); }
}
async function restoreResultView() {
  const match = state.matches.find((item) => item.code === state.activeMatchCode);
  if (!match?.id) { showView("home", true); return; }
  if (state.pendingResult?.matchCode === match.code) { currentPlacementCorrect = state.pendingResult.correct !== false; renderRoundResult(currentPlacementCorrect, state.pendingResult.card, state.pendingResult.snapshot); showView("result", false, true); return; }
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
  const resultCard = activeCard(), placedAt = Number($("#placed-card")?.dataset.position), baseTimeline = [...state.lockedTimeline.map((card, index) => ({ ...card, status: index === 0 ? "STARTKORT" : "LÅST" })), ...state.roundUnlocked.map((card) => ({ ...card, status: solo ? "RÄTT PLACERAT" : "OLÅST" }))].sort((a, b) => a.year - b.year), resultSnapshot = { locked: [...state.lockedTimeline], unlocked: [...state.roundUnlocked], guess: { ...(state.currentGuess || {}) }, placedPosition: placedAt };
  currentPlacementCorrect = placementIsCorrect();
  const today = localDateKey();
  state.dailyProgress[today] ||= { solo: false, online: false, rounds: 0 };
  const daily = state.dailyProgress[today], firstRoundToday = daily.rounds === 0, songCorrect = hasCorrectSongGuess(resultCard);
  daily.rounds += 1; daily.solo ||= solo; daily.online ||= !solo;
  grantDailyAchievement("dailyStart", "Dagens start");
  if (songCorrect) grantDailyAchievement("doubleHit", "Dubbelträff");
  if (firstRoundToday && currentPlacementCorrect) grantDailyAchievement("quickStart", "Snabbstart");
  grantDailyAchievement(solo ? "soloDaily" : "socialToneDaily", solo ? "Solisten" : "Social ton");
  if (songCorrect && currentPlacementCorrect) grantDailyAchievement("fullGuard", "Helgardering");
  if (daily.solo && daily.online) grantDailyAchievement("fullSpeed", "Full fart");
  save();
  if (!solo && currentPlacementCorrect) { state.onlineCorrect += 1; if (state.roundUnlocked.length + 1 >= 3) grantAchievement("hattrick", "Hattrick"); save(); evaluateCareerAchievements(); }
  if (!solo) {
    const match = state.matches.find((item) => item.code === state.activeMatchCode), player = (match?.players || []).find((item) => String(item.user_id) === String(state.userId)), savedScore = player?.last_round?.score || {}, priorCorrect = Math.max(1, Number(savedScore.correct) || state.lockedTimeline.length), priorMistakes = Number.isFinite(Number(savedScore.mistakes)) && savedScore.mistakes !== "" ? Math.max(0, Number(savedScore.mistakes)) : Math.max(0, Number(player?.rounds_started || 0) - Math.max(0, priorCorrect - 1));
    resultSnapshot.score = { correct: currentPlacementCorrect ? priorCorrect + state.roundUnlocked.length + 1 : priorCorrect, mistakes: priorMistakes + (currentPlacementCorrect ? 0 : 1) };
  }
  if (solo) { const score = soloProgress(state.matches.find((match) => match.code === state.activeMatchCode)); currentPlacementCorrect ? score.correct += 1 : score.mistakes += 1; resultSnapshot.score = { ...score }; save(); }
  let earnedSwapCard = false;
  if (currentPlacementCorrect && hasCorrectSongGuess(resultCard) && state.changeTrackCards < 3) { state.pendingSwapAward = { matchCode: state.activeMatchCode, cardId: resultCard.id }; state.swapUsedThisRound = false; save(); earnedSwapCard = true; }
  if (!currentPlacementCorrect) { resultSnapshot.timeline = [...baseTimeline]; resultSnapshot.timeline.splice(Math.max(0, Math.min(placedAt, baseTimeline.length)), 0, { ...resultCard, placedPosition: placedAt, status: solo ? "FEL PLACERAT" : "FELPLACERAT" }); }
  if (solo || currentPlacementCorrect) { state.pendingResult = { matchCode: state.activeMatchCode, card: resultCard, snapshot: resultSnapshot, correct: currentPlacementCorrect }; save(); }
  resultIsLocked = true; $("#result-back").hidden = true;
  renderRoundResult(currentPlacementCorrect, resultCard, resultSnapshot); showView("result");
  let soloOutcome;
  if (!currentPlacementCorrect || solo) { try { soloOutcome = await handoverTurn(currentPlacementCorrect ? null : resultSnapshot.timeline); } catch (error) { alert(error.message); return; } }
  if (soloOutcome?.won) { state.pendingResult = null; delete state.roundResumeViews[state.activeMatchCode]; save(); }
  if (soloOutcome?.won) { $("#result-continue").hidden = true; dialog(`Grattis, du har nu 10 rätt placerade kort och matchen är slut. Du klarade det med ${soloOutcome.soloSummary.mistakes} felplacerade kort efter ${soloOutcome.soloSummary.rounds} omgångar.`); }
  else if (earnedSwapCard) dialog(solo ? "Grattis, du vann ett byt-låt-kort eftersom du gissade rätt för både artist och låtnamn! Byt-låt-kort påverkar inte antalet genomförda omgångar." : "Grattis, du vann ett byt-låt-kort eftersom du gissade rätt för både artist och låtnamn!");
  else if (currentPlacementCorrect && hasCorrectSongGuess(resultCard) && state.changeTrackCards >= 3) dialog("Du gissade rätt för både artist och låtnamn, men du har redan 3/3 byt-låt-kort.");
  else if (!currentPlacementCorrect && !solo) dialog("Du placerade kortet på fel plats. Turen har gått över till nästa spelare.");
});
$("#result-continue").addEventListener("click", async () => { const solo = isSoloMatch(state.matches.find((match) => match.code === state.activeMatchCode)); await animateTimelineOutcome(currentPlacementCorrect); state.pendingResult = null; if (!solo) state.roundUnlocked.push({ ...activeCard(), status: "OLÅST" }); save(); try { if (solo) await markRoundStarted(); else await saveRoundUnlocked(); await dealCard(); await settlePendingSwapAward(); await syncMatches(); } catch (error) { alert(error.message); return; } resultIsLocked = false; $("#result-back").hidden = false; resetTurnInput(); await enterNewCardGuess(); });
$("#change-track-area").addEventListener("click", async (event) => {
  if (!event.target.closest("#use-change-track")) return;
  if (!state.changeTrackCards) { dialog("Du har inga byt-låt-kort."); return; }
  dialog("Är du säker på att du vill använda ett av dina byt-låt-kort?", async () => { const discardedCard = { ...activeCard() }; try { await animateSwapReveal(discardedCard); await updateSwapCards(-1); state.swapUsedThisRound = true; save(); await dealCard(); await settlePendingSwapAward(); } catch (error) { alert(error.message); return; } resetTurnInput(); await enterNewCardGuess(); }, false, "ANVÄND BYT-LÅT-KORT");
});
$("#result-lock").addEventListener("click", async () => {
  try {
    if (String(state.activeMatchCode || "").startsWith("S0")) return;
    await animateTimelineOutcome(true);
    state.pendingResult = null; delete state.roundResumeViews[state.activeMatchCode]; save(); const outcome = await handoverTurn();
    resultIsLocked = true; $("#result-back").hidden = true; showView("home", true); if (outcome.awaitingFinalChance) dialog("Du har nått 10 rätt placerade kort! Inväntar motspelarens sista chans till vinst så att alla får spela lika många omgångar."); else if (outcome.won && String(outcome.winnerId) === String((await supabaseAuth.user(supabaseAuth.session()?.access_token)).id)) { const entry = state.history.find((item) => String(item.id) === String(state.activeMatchCode) || String(item.code) === String(state.activeMatchCode)); dialog("Grattis till vinsten!", () => entry ? showHistoryResult(entry) : showView("home", true), false, "VISA SLUTRESULTAT", "OK"); } else if (!outcome.won) dialog(outcome.earnedSwapCard ? "Grattis, du vann ett byt-låt-kort eftersom du gissade rätt för både artist och låtnamn!" : "Korten är låsta. Turen har gått vidare till nästa spelare.");
  } catch (error) { alert(error.message); }
});
$("#result-back").addEventListener("click", () => { if (returnToFinalResult && historyResultEntry) { returnToFinalResult = false; viewingLatestRound = false; showHistoryResult(historyResultEntry); } else if (viewingHistoryResult) { viewingHistoryResult = false; viewingLatestRound = false; showView("home", true); } else if (viewingLatestRound) { viewingLatestRound = false; showView(latestRoundReturnView || "match"); } else if (!currentPlacementCorrect) { state.roundUnlocked = []; save(); showView("home", true); } else showView("match"); });
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
$("#reset-online-stats")?.addEventListener("click", () => dialog("Nollställ statistik för onlinematcher?", () => { state.stats = { wins: 0, losses: 0, walkovers: 0, walkoverLeaves: 0, achievementXp: 0, streak: 0, currentStreak: 0 }; save(); render(); }, true, "NOLLSTÄLL"));
$("#reset-solo-history")?.addEventListener("click", () => dialog("Nollställ avslutade solomatcher?", () => { state.history = state.history.filter((match) => match.mode !== "solo"); save(); render(); }, true, "NOLLSTÄLL"));
$("#reset-online-history")?.addEventListener("click", () => dialog("Nollställ avslutade onlinematcher?", () => { state.history = state.history.filter((match) => match.mode === "solo"); save(); render(); }, true, "NOLLSTÄLL"));
$("#change-password").addEventListener("click", () => showView("change-password"));
$("#logout").addEventListener("click", () => { achievementPopupQueue = []; save(); supabaseAuth.signOut(); showView("welcome"); });
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
    activateAchievementAccount(data.user.id); await loadPermanentAchievements(data.user.id);
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

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js?v=6.27", { updateViaCache: "none" }).then((registration) => registration.update()).catch(() => {});
// Första renderingen sker efter att avatarens delar har initierats.
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
  else supabaseAuth.user(verification.session.access_token).then(async (user) => {
    $("#player-email").textContent = user.email;
    state.playerName = user.user_metadata?.display_name || state.playerName;
    activateAchievementAccount(user.id); await loadPermanentAchievements(user.id);
    save(); render(); syncMatches().catch(() => {}); startRealtime(); showView("home");
  }).catch(() => showView("login"));
} else if (supabaseAuth.session()?.access_token) {
  supabaseAuth.user(supabaseAuth.session().access_token).then(async (user) => {
    $("#player-email").textContent = user.email; state.playerName = user.user_metadata?.display_name || state.playerName; activateAchievementAccount(user.id); await loadPermanentAchievements(user.id); render();
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
const avatarRigDefaults = { skin: "Mellan", presentation: "Androgyn", eyes: "Brun", hair: "Vågor", hairColor: "Mörk", outfit: "Pop", accessory: "Hörlurar", headwear: "Ingen", facialHair: "Ingen" };
const avatarRigOptions = { skin: ["Ljus", "Mellan", "Mörk", "Djup"], presentation: ["Feminin", "Maskulin", "Androgyn"], eyes: ["Brun", "Blå", "Grön", "Grå"], hair: ["Kort", "Vågor", "Lockar", "Långt", "Buzz", "Flätor"], hairColor: ["Mörk", "Brun", "Blond", "Röd", "Lila"], outfit: ["Pop", "Street", "Rock", "EDM", "Indie", "Country"], accessory: ["Inget", "Hörlurar", "AirPods", "Glasögon", "Öronringar", "Kedja"], headwear: ["Ingen", "Keps", "Beanie"], facialHair: ["Ingen", "Stubb", "Skägg", "Mustasch"] };
const avatarRigLabels = { skin: "HUDTON", presentation: "UTTRYCK", eyes: "ÖGONFÄRG", hair: "FRISYR", hairColor: "HÅRFÄRG", outfit: "OUTFIT", accessory: "ACCESSOAR", headwear: "HUVUDBONAD", facialHair: "ANSIKTSBEHÅRING" };
const avatarRigPresets = { Pop: { outfit: "Pop", accessory: "Öronringar", hairColor: "Lila" }, Rock: { outfit: "Rock", accessory: "Kedja", facialHair: "Stubb" }, Hiphop: { outfit: "Street", headwear: "Keps", accessory: "Hörlurar" }, EDM: { outfit: "EDM", accessory: "Hörlurar", hair: "Buzz" }, Country: { outfit: "Country", headwear: "Keps", hair: "Vågor" }, Indie: { outfit: "Indie", accessory: "Glasögon" }, "R&B": { outfit: "Pop", accessory: "Öronringar", hair: "Lockar" }, Metal: { outfit: "Rock", hair: "Långt", accessory: "Kedja" }, Reggae: { outfit: "Street", hair: "Flätor", accessory: "Hörlurar" }, Jazz: { outfit: "Indie", accessory: "Glasögon" } };
function avatarRig(value = {}) { const old = avatarChoice(value), seeded = [{ skin: "Ljus", presentation: "Feminin" }, { skin: "Ljus", presentation: "Maskulin" }, { skin: "Mörk", presentation: "Maskulin" }, { skin: "Ljus", presentation: "Feminin" }, { skin: "Mellan", presentation: "Feminin" }, { skin: "Mellan", presentation: "Androgyn" }][old.variant] || {}; return { ...avatarRigDefaults, ...avatarRigPresets[old.genre], ...seeded, ...(value.avatar_traits || value.traits || {}) }; }
function avatarRigSvg(raw, mini = false) { const a = avatarRig(raw), skin = { Ljus: "#f5c8a4", Mellan: "#c9875f", Mörk: "#865238", Djup: "#56352c" }[a.skin], hair = { Mörk: "#1c1720", Brun: "#5a3329", Blond: "#d8b06b", Röd: "#b95345", Lila: "#7c4caf" }[a.hairColor], eye = { Brun: "#563827", Blå: "#4499c9", Grön: "#5da873", Grå: "#9ba7b8" }[a.eyes], outfit = { Pop: "#ed5fa4", Street: "#44aee1", Rock: "#252536", EDM: "#8a61df", Indie: "#cc8c49", Country: "#467d6e" }[a.outfit], faceRx = a.presentation === "Maskulin" ? 56 : a.presentation === "Feminin" ? 51 : 54, hairShape = a.hair === "Buzz" ? `<path d="M95 103q5-51 55-51t55 51q-55-27-110 0"/>` : a.hair === "Kort" ? `<path d="M87 113q4-67 63-67t63 67l-17-20-13 13-16-17-17 15-18-15-16 17z"/>` : a.hair === "Lockar" ? `<path d="M87 118q-5-48 19-68 12-13 26-4 18-14 35 0 19-10 31 9 17 18 10 63l-19-19-18 13-21-16-20 16-22-14z"/>` : a.hair === "Långt" ? `<path d="M88 195V105q3-60 62-60t62 60v90l-23-18v-68q-39 17-78 0v68z"/>` : a.hair === "Flätor" ? `<path d="M89 205V103q3-57 61-57t61 57v102l-14-20-12 21-14-21-14 21-14-21-15 21-14-21-15 21z"/>` : `<path d="M88 124q4-78 62-78t62 78l-22-30q-40 22-80 0z"/>`, accessory = a.accessory === "Hörlurar" ? `<path class="rig-line" d="M105 137v-21q0-45 45-45t45 45v21"/><rect x="91" y="132" width="22" height="39" rx="10"/><rect x="187" y="132" width="22" height="39" rx="10"/>` : a.accessory === "AirPods" ? `<path class="rig-line" d="M101 144v23m98-23v23"/>` : a.accessory === "Glasögon" ? `<g fill="none" stroke="#d4e4fa" stroke-width="5"><circle cx="126" cy="142" r="18"/><circle cx="174" cy="142" r="18"/><path d="M144 142h12m36 0h14m-112 0h14"/></g>` : a.accessory === "Öronringar" ? `<g fill="none" stroke="#f0c865" stroke-width="5"><circle cx="96" cy="154" r="9"/><circle cx="204" cy="154" r="9"/></g>` : a.accessory === "Kedja" ? `<path d="M116 222q34 28 68 0" fill="none" stroke="#f0c865" stroke-width="5"/>` : "", headwear = a.headwear === "Keps" ? `<path d="M91 106q10-58 59-58t59 58l-25-14q-35 16-68 0z" fill="#24364a"/><path d="M104 101q44 13 97 1l18 15q-70 12-121-5z" fill="#172331"/>` : a.headwear === "Beanie" ? `<path d="M91 108q9-63 59-63t59 63l-14 10H105z" fill="#394a65"/><path d="M94 107h112v18H94z" fill="#28394f"/>` : "", beard = a.facialHair === "Skägg" ? `<path d="M110 166q7 38 40 38t40-38q-40 19-80 0" fill="#2e2222" opacity=".85"/>` : a.facialHair === "Stubb" ? `<path d="M113 171q37 24 74 0-8 24-37 24t-37-24" fill="#332a2a" opacity=".42"/>` : a.facialHair === "Mustasch" ? `<path d="M130 164q10-10 20 0 10-10 20 0-9 12-20 5-11 7-20-5" fill="#2f2423"/>` : "", makeup = a.presentation === "Feminin" ? `<path d="M116 139l10-5m48 0 10 5" stroke="#6f3f58" stroke-width="3"/><path d="M140 174q10 7 20 0" stroke="#be5d73" stroke-width="4" fill="none"/>` : ""; return `<svg class="avatar-rig-svg${mini ? " avatar-rig-mini-svg" : ""}" viewBox="0 0 300 300" aria-hidden="true"><rect width="300" height="300" rx="34" fill="#07152a"/><circle cx="150" cy="150" r="132" fill="#0d2541"/><path d="M45 300q15-88 105-88t105 88" fill="${outfit}"/><path d="M93 300q12-55 57-55t57 55" fill="#ffffff22"/><rect x="132" y="190" width="36" height="42" rx="16" fill="${skin}"/><ellipse cx="150" cy="143" rx="${faceRx}" ry="70" fill="${skin}"/><ellipse cx="94" cy="148" rx="10" ry="15" fill="${skin}"/><ellipse cx="206" cy="148" rx="10" ry="15" fill="${skin}"/><g fill="${hair}">${hairShape}</g>${headwear}<g fill="${eye}"><ellipse cx="126" cy="143" rx="8" ry="6"/><ellipse cx="174" cy="143" rx="8" ry="6"/></g><g fill="#111"><circle cx="126" cy="143" r="3"/><circle cx="174" cy="143" r="3"/></g><path d="M145 151h10l-4 10" fill="none" stroke="#8d5847" stroke-width="3"/><path d="M137 177q13 10 26 0" fill="none" stroke="#6b3641" stroke-width="4" stroke-linecap="round"/>${makeup}${beard}${accessory}<style>.rig-line{fill:none;stroke:#e9f3ff;stroke-width:8;stroke-linecap:round}.avatar-rig-svg rect{stroke-linejoin:round}</style></svg>`; }
function renderAvatarRig() { const panel = $("#avatar-panel"); if (!panel) return; state.avatar ||= {}; state.avatar.traits = avatarRig(state.avatar); const a = state.avatar.traits; const accountAvatar = $("#change-avatar"); if (accountAvatar) { accountAvatar.className = "mini-avatar account-avatar avatar-rig-mini"; accountAvatar.replaceChildren(); accountAvatar.insertAdjacentHTML("beforeend", avatarRigSvg(a, true)); } panel.innerHTML = `<h3>MIN ARTIST-AVATAR</h3><div class="avatar-rig-layout"><div class="avatar-rig-preview">${avatarRigSvg(a)}</div><div class="avatar-rig-controls">${Object.entries(avatarRigOptions).map(([part, choices]) => `<label>${avatarRigLabels[part]}<select data-avatar-rig="${part}">${choices.map((choice) => `<option${a[part] === choice ? " selected" : ""}>${choice}</option>`).join("")}</select></label>`).join("")}<button type="button" class="button button-purple" data-avatar-rig-random>SLUMPA ALLT</button><button type="button" class="button button-green" data-avatar-save>SPARA AVATAR</button></div></div><div class="avatar-rig-genres"><b>SNABBSTIL EFTER GENRE</b>${avatarStyles.map((genre) => `<button type="button" data-avatar-rig-genre="${genre}">${genre.toUpperCase()}</button>`).join("")}</div>`; }
document.addEventListener("change", (event) => { const select = event.target.closest("[data-avatar-rig]"); if (!select) return; state.avatar ||= {}; state.avatar.traits = { ...avatarRig(state.avatar), [select.dataset.avatarRig]: select.value }; save(); renderAvatar(); });
document.addEventListener("click", (event) => { const genre = event.target.closest("[data-avatar-rig-genre]"), random = event.target.closest("[data-avatar-rig-random]"); if (!genre && !random) return; state.avatar ||= {}; state.avatar.traits = random ? Object.fromEntries(Object.entries(avatarRigOptions).map(([part, values]) => [part, values[Math.floor(Math.random() * values.length)]])) : { ...avatarRig(state.avatar), ...avatarRigPresets[genre.dataset.avatarRigGenre] }; save(); renderAvatar(); });
function renderAvatarRig() { const panel = $("#avatar-panel"); if (!panel) return; state.avatar ||= {}; const choice = ownAvatarChoice(), accountAvatar = $("#change-avatar"); state.avatar.genre = choice.genre; state.avatar.variant = choice.variant; save(); if (accountAvatar) { accountAvatar.className = "mini-avatar account-avatar avatar-art"; accountAvatar.style.cssText = avatarArtStyle(choice.genre, choice.variant); accountAvatar.replaceChildren(); } panel.innerHTML = `<h3>MIN ARTIST-AVATAR</h3><div class="avatar-choice-layout"><div class="avatar-choice-preview avatar-art" style="${avatarArtStyle(choice.genre, choice.variant)}" role="img" aria-label="${choice.genre}-avatar"></div><div class="avatar-choice-copy"><p>Välj en musikgenre och sedan en av sex färdiga avatarer.</p><div class="avatar-genre-grid">${avatarStyles.map((genre) => `<button type="button" class="${genre === choice.genre ? "is-selected" : ""}" data-avatar-style="${genre}">${genre.toUpperCase()}</button>`).join("")}</div><div class="avatar-variant-grid">${Array.from({ length: 6 }, (_, index) => `<button type="button" class="avatar-art ${index === choice.variant ? "is-selected" : ""}" style="${avatarArtStyle(choice.genre, index)}" data-avatar-variant="${index}" aria-label="Välj avatar ${index + 1}"></button>`).join("")}</div><button type="button" class="button avatar-shuffle" data-avatar-style-random>SLUMPA AVATAR</button><button type="button" class="button button-green" data-avatar-save>SPARA AVATAR</button></div></div>`; }
$(".brand small").textContent = "v6.27";
render();
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
