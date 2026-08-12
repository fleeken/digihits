// Match rendering entrypoint. The legacy implementation is moved behind this boundary incrementally.
function renderOnlineGame(){
  return renderOnlineGameLegacy();
}

function renderStablePlacementView(){
  const placementActive=!!(
    onlinePlacementMode||
    onlineView==="place"||
    onlineMatchViewState?.view===MATCH_VIEWS.PLACE
  );
  if(!placementActive||!onlineMatch?.current_song)return false;
  onlineView="place";
  onlineHideScreens();
  $("onlineTurnPlayer")?.classList.remove("hidden");
  $("onlinePlaceScreen")?.classList.remove("hidden");
  renderOnlineTimeline();
  requestAnimationFrame(bindOnlineSecretDrag);
  return true;
}

function renderWaitingMatchScreen(match){
  const screen=document.getElementById("onlineWaitingScreen");
  if(!screen)return;
  screen.classList.remove("hidden");
  const code=String(match?.code||"");
  screen.innerHTML=`<div class="waitingMatchCode">
    <div class="waitingMatchCodeLabel">MATCHKOD</div>
    <div class="waitingMatchCodeValue">${escapeHtml(code||"–")}</div>
    <button type="button" class="copyCodeBtn" onclick="copyMatchCode('${escapeHtml(code)}',this)">KOPIERA KOD</button>
  </div>`;
}

function renderOnlineOverview(){
  const el=document.getElementById("onlineOverviewScreen");
  if(!el||!onlineMatch)return;
  const players=onlinePlayers||[];
  const target=Number(onlineMatch.target_cards||10);
  const rows=players.map(p=>{
    const locked=(p.locked_timeline||[]).length;
    const unlocked=(p.turn_cards||[]).length;
    const current=String(p.user_id||"")===String(onlineMatch.current_user_id||"");
    const playerId=String(p.id||p.user_id||"");
    const open=onlineOverviewTimelineOpen===playerId;
    const cards=onlineAllTimeline(p);
    const timeline=open?`<div class="overviewTimeline"><div class="onlineTimeline">${cards.map(c=>onlineCardMarkup(c,(p.turn_cards||[]).some(x=>x.id===c.id))).join("")}</div></div>`:"";
    return `<div class="overviewPlayer ${current?"active":""}"><div class="overviewPlayerHead"><span>${escapeHtml(p.display_name||"Spelare")}</span>${current?"<span class=\"ok\">DIN TUR</span>":""}</div><div class="overviewPlayerMeta">${locked}/${target} låsta kort · ${unlocked} olåsta · ${p.swap_cards||0}/3 Byt låt-kort</div><button type="button" class="btn dark overviewTimelineBtn" onclick="toggleOverviewTimeline('${playerId}')">${open?"DÖLJ TIDSLINJE":"VISA TIDSLINJE"}</button>${timeline}</div>`;
  }).join("");
  el.innerHTML=`<div class="matchOverview"><div class="overviewCode"><span class="matchCodeLabel">MATCHKOD</span><strong class="code">${escapeHtml(onlineMatch.code||"–")}</strong><button type="button" class="copyCodeBtn" onclick="copyMatchCode('${escapeHtml(String(onlineMatch.code||""))}',this)">KOPIERA KOD</button></div><div class="overviewStats"><div class="overviewStat"><b>${players.length}</b><span>SPELARE</span></div><div class="overviewStat"><b>${onlineMatch.phase==="turn_ready"?"REDO":"PÅGÅR"}</b><span>OMGÅNG</span></div><div class="overviewStat"><b>${target}</b><span>MÅL KORT</span></div></div><div class="overviewPlayers">${rows||"<div class=\"mut\">Inga spelare ännu.</div>"}</div></div>`;
  $("onlineGameTitle").textContent="Matchöversikt";
  $("onlineGameSub").textContent="";
  onlineHideScreens();
  el.classList.remove("hidden");
}

function renderOnlinePlayers(force=false){
  if(!$("onlineGamePlayers"))return;
  const current=onlineMatch?.current_user_id;
  Object.keys(onlinePlayerTimelineOpen).forEach(id=>{
    if(onlinePlayerTimelineOpen[id])rememberOnlinePlayerTimelineScroll(id);
  });
  Object.keys(onlineLastRoundOpen).forEach(id=>{
    if(onlineLastRoundOpen[id]){
      const el=document.querySelector(`[data-last-round="${id}"]`);
      if(el)onlineLastRoundScroll[id]=el.scrollLeft;
    }
  });
  const key=onlinePlayersKey()+"::"+JSON.stringify(onlineLastRoundOpen);
  if(!force && key===onlinePlayersRenderKey)return;
  onlinePlayersRenderKey=key;
  const opponents=onlinePlayers.filter(p=>String(p.user_id||"")!==String(ensureOnlineUserId()));
  $("onlineGamePlayers").innerHTML=opponents.length?opponents.map(p=>{
    const currentMark=p.user_id===current;
    const locked=(p.locked_timeline||[]).length;
    const roundOpen=!!onlineLastRoundOpen[p.id];
    return `<div class="prow ${currentMark?"active":""}" style="display:block">
      <div class="playerRowActions"><div style="flex:1;min-width:130px">
        <div class="pname">${p.display_name}</div>
        <div class="pmeta">${locked}/${onlineMatch.target_cards||10} låsta kort · ${p.swap_cards||0}/3 Byta-låt-kort</div>
      </div></div>
      <div class="playerRoundRow"><button type="button" class="btn dark roundHistoryBtn" onclick="toggleOnlineLastRound(${p.id})">${roundOpen?"DÖLJ SENAST SPELAD OMGÅNG":"VISA SENAST SPELAD OMGÅNG"}</button></div>
      ${roundOpen?`<div class="lastRoundPanel"><div class="lastRoundTitle">SENAST SPELAD OMGÅNG – GISSNINGAR OCH TIDSLINJE</div><div class="lastRoundScroll" data-last-round="${p.id}">${lastRoundTimelineHtml(p.last_round)}</div></div>`:""}
    </div>`;
  }).join(""): `<div class="mut" style="font-size:11px">Ingen motståndare har gått med ännu.</div>`;
  requestAnimationFrame(()=>{
    opponents.forEach(p=>{
      if(onlineLastRoundOpen[p.id]){
        const el=document.querySelector(`[data-last-round="${p.id}"]`);
        if(el){
          el.scrollLeft=Number(onlineLastRoundScroll[p.id]||0);
          el.addEventListener("scroll",()=>{onlineLastRoundScroll[p.id]=el.scrollLeft},{passive:true});
        }
      }
    });
  });
}

function rememberOnlinePlayerTimelineScroll(playerId){
  const el=document.querySelector(`[data-player-timeline="${playerId}"]`);
  if(el)onlinePlayerTimelineScroll[playerId]=el.scrollLeft;
}

function renderOnlineTimeline(force=false){
  const el=$("onlineTimeline");
  if(!el||!onlineMyPlayer)return;
  const key=onlineTimelineKey();
  if(!force && key===onlineTimelineRenderKey && el.children.length){
    bindOnlineTimelineScroll();
    return;
  }
  rememberOnlineTimelineScroll();
  onlineTimelineRenderKey=key;
  const cards=onlineAllTimeline(onlineMyPlayer);
  el.innerHTML="";
  for(let i=0;i<=cards.length;i++){
    if(onlineSelected===i){
      const pocket=document.createElement("div");
      pocket.className="pendingSlot";
      pocket.innerHTML=`<div class="pendingPocket"><div class="pendingCard"><div class="note">♫</div><b>HEMLIGT KORT</b><div class="hiddenYear">????</div></div></div>
      <div class="pendingActions">
        <button type="button" id="onlineConfirmPlacementBtn" class="btn cyan full">BEKRÄFTA PLATS</button>
        <button type="button" id="onlineMoveAgainBtn" class="btn dark full">ÅNGRA PLACERING</button>
      </div>`;
      el.appendChild(pocket);
      bindInstantAction(pocket.querySelector("#onlineConfirmPlacementBtn"),confirmOnlinePlacement);
      bindInstantAction(pocket.querySelector("#onlineMoveAgainBtn"),clearOnlinePlacement);
    }else{
      const insideSameYearBlock=i>0&&i<cards.length&&Number(cards[i-1]?.year)===Number(cards[i]?.year);
      if(!insideSameYearBlock){
        const drop=document.createElement("button");
        drop.type="button";
        drop.className="onlineDrop";
        drop.dataset.index=String(i);
        drop.innerHTML="PLACERA<br>HÄR";
        drop.addEventListener("click",()=>selectOnlinePlacement(i));
        el.appendChild(drop);
      }
    }
    if(i<cards.length){
      const c=cards[i];
      const risk=(onlineMyPlayer.turn_cards||[]).some(x=>x.id===c.id);
      const holder=document.createElement("div");
      holder.innerHTML=onlineCardMarkup(c,risk);
      el.appendChild(holder.firstElementChild);
    }
  }
  $("onlineSecretCard").classList.toggle("hidden",onlineSelected!==null);
  bindOnlineTimelineScroll();
  restoreOnlineTimelineScroll();
}

function normalizeOnlinePlacementIndex(i){
  const cards=onlineAllTimeline(onlineMyPlayer);
  let idx=Math.max(0,Math.min(cards.length,Number(i)||0));
  if(idx>0&&idx<cards.length&&Number(cards[idx-1]?.year)===Number(cards[idx]?.year)){
    const year=Number(cards[idx]?.year);
    while(idx<cards.length&&Number(cards[idx]?.year)===year)idx++;
  }
  return idx;
}

function findOnlineDrop(x,y){
  return [...document.querySelectorAll("#onlineTimeline .onlineDrop")].find(z=>{
    const r=z.getBoundingClientRect();
    return x>=r.left-22&&x<=r.right+22&&y>=r.top-20&&y<=r.bottom+20;
  })||null;
}

function resetOnlineDrag(){
  const card=$("onlineSecretCard");
  if(!card)return;
  onlineDragging=false;
  card.classList.remove("dragging");
  ["position","left","top","width","margin","zIndex"].forEach(k=>card.style[k]="");
  if(onlineDragZone){onlineDragZone.classList.remove("selected");onlineDragZone=null;}
}

function bindOnlineSecretDrag(){
  const card=$("onlineSecretCard");
  if(!card||card.dataset.onlineBound==="1")return;
  card.dataset.onlineBound="1";
  card.addEventListener("pointerdown",e=>{
    if(!onlineMatch?.current_song)return;
    const r=card.getBoundingClientRect();
    onlineDragging=true;onlineDragOffsetX=e.clientX-r.left;onlineDragOffsetY=e.clientY-r.top;
    card.style.position="fixed";card.style.left=r.left+"px";card.style.top=r.top+"px";card.style.width=r.width+"px";card.style.margin="0";card.style.zIndex="99999";
    card.classList.add("dragging");card.setPointerCapture(e.pointerId);e.preventDefault();
  });
  card.addEventListener("pointermove",e=>{
    if(!onlineDragging)return;
    card.style.left=(e.clientX-onlineDragOffsetX)+"px";
    card.style.top=(e.clientY-onlineDragOffsetY)+"px";
    const z=findOnlineDrop(e.clientX,e.clientY);
    if(onlineDragZone&&onlineDragZone!==z)onlineDragZone.classList.remove("selected");
    onlineDragZone=z;if(z)z.classList.add("selected");
  });
  card.addEventListener("pointerup",e=>{
    if(!onlineDragging)return;
    const z=onlineDragZone||findOnlineDrop(e.clientX,e.clientY);
    resetOnlineDrag();
    if(z)selectOnlinePlacement(Number(z.dataset.index));
  });
  card.addEventListener("pointercancel",resetOnlineDrag);
}

function showOnlineLocalResult(r,decision,held=false){
  const decisionButtonsEl=$("onlineDecisionButtons");
  const decisionTimelineEl=$("onlineDecisionTimeline");
  if(decisionButtonsEl&&decisionTimelineEl&&decisionTimelineEl.parentNode===decisionButtonsEl.parentNode&&decisionTimelineEl.previousElementSibling!==decisionButtonsEl){
    decisionTimelineEl.parentNode.insertBefore(decisionButtonsEl,decisionTimelineEl);
  }
  onlineHideScreens();
  $("onlineResultScreen").classList.remove("hidden");
  const resultKey=onlineResultKey(r,decision);
  if(resultKey===onlineResultRenderKey){
    if(decision&&!$("onlineDecisionTimeline").classList.contains("hidden")){
      const rail=$("onlineDecisionTimeline").querySelector(".onlineTimeline");
      if(rail)onlineDecisionScrollLeft=rail.scrollLeft;
    }
    if(!decision||$("onlineDecisionButtons").querySelector("button"))return;
  }
  onlineResultRenderKey=resultKey;
  $("onlineResultTitle").textContent=r.placeOk?"RÄTT PLACERING":"FEL PLACERING";
  $("onlineReveal").textContent=`${r.song.title} – ${r.song.artist} (${r.song.year})`;
  const shownGuess=r.guess||{};
  $("onlineChecks").innerHTML=`<div class="check">${r.placeOk?"✅ Rätt placering":"❌ Fel placering"}</div>
    <div class="check">${r.artistOk?"✅ Rätt artist":"❌ Fel artist"}${shownGuess.guessed?`<div class="yourGuess">Du skrev: ${esc(shownGuess.artist||"–")}</div>`:""}</div>
    <div class="check">${r.titleOk?"✅ Rätt låtnamn":"❌ Fel låtnamn"}${shownGuess.guessed?`<div class="yourGuess">Du skrev: ${esc(shownGuess.title||"–")}</div>`:""}</div>
    ${r.artistOk&&r.titleOk?`<div class="swapWinMessage">Grattis, du vann ett byt-låt-kort</div>`:""}`;
  $("onlineBonus").innerHTML="";
  if(!r.placeOk){
    onlineDecisionOpen=true;
    renderWrongPlacementTimeline(r);
  }else if(decision){
    onlineDecisionOpen=true;
    $("onlineDecisionTimeline").classList.remove("hidden");
    renderOnlineDecisionTimeline();
  }else{
    onlineDecisionOpen=false;
    $("onlineDecisionTimeline").classList.add("hidden");
  }
  $("onlineDecisionButtons").innerHTML=decision
    ? `<button type="button" class="btn purple continueBtn" onclick="onlineContinue()">▶ FORTSÄTT<br><small>Riskera ${(onlineMyPlayer.turn_cards||[]).length} olåsta kort</small></button>
       <button type="button" class="btn green lockCardBtn" onclick="onlineLockIn()">🔒 LÅS IN ${(onlineMyPlayer.turn_cards||[]).length} KORT</button>`
    : "";
}

function renderOnlineDecisionTimeline(){
  const panel=$("onlineDecisionTimeline");
  if(!panel)return;
  const existingRail=panel.querySelector(".onlineTimeline");
  if(existingRail)onlineDecisionScrollLeft=existingRail.scrollLeft;
  const cards=onlineAllTimeline(onlineMyPlayer);
  panel.innerHTML=`<div class="onlineTimeline">${cards.map(c=>onlineCardMarkup(c,(onlineMyPlayer.turn_cards||[]).some(x=>x.id===c.id))).join("")}</div>`;
  const rail=panel.querySelector(".onlineTimeline");
  if(rail){
    requestAnimationFrame(()=>{rail.scrollLeft=onlineDecisionScrollLeft});
    rail.addEventListener("scroll",()=>{onlineDecisionScrollLeft=rail.scrollLeft},{passive:true});
  }
}

function renderWrongPlacementTimeline(r){
  const panel=$("onlineDecisionTimeline");
  if(!panel)return;
  const locked=(r.locked_before||[]).map(c=>({card:c,state:"locked"}));
  const unlocked=(r.unlocked_before||[]).map(c=>({card:c,state:"unlocked"}));
  const base=[...locked,...unlocked].sort((a,b)=>a.card.year-b.card.year);
  const idx=Math.max(0,Math.min(base.length,Number(r.attempted_index)||0));
  base.splice(idx,0,{card:r.song,state:"wrong"});
  panel.innerHTML=`<div class="lastRoundScroll"><div class="lastRoundRail">${base.map(x=>lastRoundCardHtml(x.card,x.state)).join("")}</div></div>`;
  panel.classList.remove("hidden");
}

function updateOnlineSwapButton(){
  const btn=$("onlineSwapBtn");
  if(!btn)return;
  const count=Math.max(0,Number(onlineMyPlayer?.swap_cards||0));
  if(count<1){
    btn.innerHTML=`DU HAR INGA BYT-LÅT-KORT <span class="onlineSwapBtnCount">0/3</span>`;
    btn.disabled=true;
  }else{
    btn.innerHTML=`BYT LÅT <span class="onlineSwapBtnCount">${count}/3</span>`;
    btn.disabled=false;
  }
  btn.classList.remove("hidden");
}

function onlineCardMarkup(card,risk=false){
  const c=card||{};
  return `<div class="onlinePlaced ${risk?"risk":""}">
    <div class="year">${c.year??""}</div>
    <div class="title"><strong>${escapeHtml(c.title||"")}</strong><br>${escapeHtml(c.artist||"")}</div>
    <div class="mut" style="font-size:9px;margin-top:5px">${risk?"OLÅST":"LÅST"}</div>
  </div>`;
}

function roundGuessHtml(entry){
  if(!entry)return "";
  const song=entry.song||entry.card||entry;
  const guess=entry.guess||song?._round_guess||null;
  const title=song?.title||"Okänd låt";
  const artistGuess=(guess?.artist||"").trim();
  const titleGuess=(guess?.title||"").trim();
  const artistOk=!!guess?.artistOk;
  const titleOk=!!guess?.titleOk;
  const guessed=!!guess?.guessed;
  const artistHtml=guessed
    ? `<span class="${artistOk?"lastRoundGuessOk":"lastRoundGuessBad"}">${artistOk?"✓":"✕"} Artist: ${escapeHtml(artistGuess||"—")}</span>`
    : `<span class="lastRoundGuessNone">Artist: ingen gissning</span>`;
  const titleHtml=guessed
    ? `<span class="${titleOk?"lastRoundGuessOk":"lastRoundGuessBad"}">${titleOk?"✓":"✕"} Låtnamn: ${escapeHtml(titleGuess||"—")}</span>`
    : `<span class="lastRoundGuessNone">Låtnamn: ingen gissning</span>`;
  return `<div class="lastRoundGuessItem"><div class="lastRoundGuessSong">${escapeHtml(title)} · ${escapeHtml(song?.artist||"")}</div><div class="lastRoundGuessRow">${artistHtml}${titleHtml}</div></div>`;
}

function onlineAllTimeline(p){
  return [...(p?.locked_timeline||[]),...(p?.turn_cards||[])].sort((a,b)=>a.year-b.year);
}

function onlineTimelineKey(){
  if(!onlineMyPlayer)return "";
  const locked=(onlineMyPlayer.locked_timeline||[]).map(x=>`${x.id||x.title}:${x.year}`).join("|");
  const risk=(onlineMyPlayer.turn_cards||[]).map(x=>`${x.id||x.title}:${x.year}`).join("|");
  return [onlineMatch?.current_song?.id||"",onlineSelected===null?"none":String(onlineSelected),locked,risk].join("::");
}

function rememberOnlineTimelineScroll(){
  const el=$("onlineTimeline");
  if(el)onlineTimelineScrollLeft=el.scrollLeft;
}

function restoreOnlineTimelineScroll(){
  const el=$("onlineTimeline");
  if(!el)return;
  requestAnimationFrame(()=>{el.scrollLeft=onlineTimelineScrollLeft;});
}

function bindOnlineTimelineScroll(){
  const el=$("onlineTimeline");
  if(!el||el.dataset.scrollBound==="1")return;
  el.dataset.scrollBound="1";
  el.addEventListener("scroll",()=>{onlineTimelineScrollLeft=el.scrollLeft},{passive:true});
}

function bindInstantAction(button,handler){
  if(!button)return;
  let lastTouch=0;
  button.addEventListener("touchend",e=>{
    if(button.disabled)return;
    lastTouch=Date.now();
    e.preventDefault();
    e.stopPropagation();
    handler(e);
  },{passive:false});
  button.addEventListener("click",e=>{
    if(Date.now()-lastTouch<700){e.preventDefault();return;}
    if(button.disabled)return;
    handler(e);
  });
}

function onlinePlayersKey(){
  const current=onlineMatch?.current_user_id||"";
  const target=onlineMatch?.target_cards||10;
  const rows=onlinePlayers.map(p=>({
    id:p.id,user_id:p.user_id,name:p.display_name,current:p.user_id===current,
    locked:(p.locked_timeline||[]).map(x=>[x.id||x.title,x.year,x.title,x.artist]),
    risk:(p.turn_cards||[]).map(x=>[x.id||x.title,x.year,x.title,x.artist]),
    swaps:p.swap_cards||0,last_round:p.last_round||null,open:false
  }));
  return JSON.stringify({current,target,rows});
}

function roundGuessListHtml(round){
  const attempts=round?.attempts||[];
  if(!attempts.length)return `<div class="mut" style="font-size:10px;margin-bottom:8px">Inga sparade gissningar från omgången.</div>`;
  return `<div class="lastRoundGuessList">${attempts.map(roundGuessHtml).join("")}</div>`;
}

function lastRoundCardHtml(card,state){
  if(!card)return "";
  const cls=state==="wrong"?"wrong":state==="unlocked"?"unlocked":state==="newlocked"?"newlocked":"";
  const label=state==="wrong"?"FEL PLACERAT":state==="unlocked"?"OLÅST":state==="newlocked"?"LÅST DENNA OMGÅNG":"LÅST";
  return `<div class="lastRoundCard ${cls}"><div class="year">${card.year}</div><div class="txt"><strong>${card.title}</strong><br>${card.artist||""}</div><div class="state">${label}</div></div>`;
}

function lastRoundTimelineHtml(round){
  if(!round)return `<div class="mut" style="font-size:11px">Ingen avslutad omgång ännu.</div>`;
  const attemptsHtml=roundGuessListHtml(round);
  if(round.outcome==="wrong"){
    const locked=(round.locked||[]).map(c=>({card:c,state:"locked"}));
    const unlocked=(round.unlocked||[]).map(c=>({card:c,state:"unlocked"}));
    const wrong=round.wrong_card?{card:round.wrong_card,state:"wrong",index:Number(round.wrong_index)}:null;
    const base=[...locked,...unlocked].sort((a,b)=>a.card.year-b.card.year);
    if(wrong){const idx=Math.max(0,Math.min(base.length,wrong.index));base.splice(idx,0,wrong);}
    return `${attemptsHtml}<div class="lastRoundSectionLabel">TIDSLINJEN NÄR OOMGÅNGEN MISSLYCKADES</div><div class="lastRoundRail">${base.map(x=>lastRoundCardHtml(x.card,x.state)).join("")}</div>`;
  }
  const newlyLockedIds=new Set((round.newly_locked||[]).map(c=>String(c.id||c.title)));
  const cards=(round.locked||[]).map(c=>({card:c,state:newlyLockedIds.has(String(c.id||c.title))?"newlocked":"locked"})).sort((a,b)=>a.card.year-b.card.year);
  return `${attemptsHtml}<div class="lastRoundSectionLabel">TIDSLINJEN EFTER LÅS IN</div><div class="lastRoundRail">${cards.map(x=>lastRoundCardHtml(x.card,x.state)).join("")}</div>`;
}
