'use strict';
(() => {
 const URL='https://zttkujhoyuxerdewofkb.supabase.co',KEY='sb_publishable_lV9EA-XC2KQP5lBxr74puA_Zy1959R0';
 const avatars=['🎸','🎤','🎧','🎹','🥁','🎷','🎺','🪇','🦊','🐼','🐸','🦄'];
 let selectedAvatar=readStoreAvatar();
 function readStoreAvatar(){try{const n=Number(localStorage.getItem('musikquiz-avatar'));return Number.isInteger(n)&&n>=0&&n<12?n:0}catch{return 0}}
 const $=id=>document.getElementById(id), app=$('app');
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const readStore=k=>{try{return JSON.parse(localStorage.getItem(k))}catch{return null}};
 const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
 let session=readStore('musikquiz-session-v1'), room=readStore('musikquiz-room-v1'), state=null, busy=false, pollBusy=false, offset=0, signature='',spoken='', voiceError=false, voiceActive=false, previousRanks=[],errorTimer,toastTimer;
 let authPromise=null;
 let boardKey='',boardFrame=0,boardRows=[];
 const BOARD_ANIMATION_MS=3000,BOARD_HOLD_MS=5000;
 let pendingCode=new URLSearchParams(location.search).get('code')?.replace(/\D/g,'').slice(0,6)||'';
 function error(e){$('error').textContent=e.message||String(e);$('error').hidden=false;clearTimeout(errorTimer);errorTimer=setTimeout(()=>$('error').hidden=true,6500)}
 function toast(t){$('toast').textContent=t;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,2500)}
 async function http(path,body,token){const r=await fetch(URL+path,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const v=await r.json();if(!r.ok){const e=new Error(v.code==='PGRST202'?'Matchfunktionen är inte aktiverad ännu.':v.message||v.msg||v.error_description||'Anslutningen misslyckades. Försök igen.');e.status=r.status;throw e}return v}
 async function auth(){if(session?.access_token&&session.expires_at>Date.now()+60000)return session;if(authPromise)return authPromise;authPromise=(async()=>{let s;if(session?.refresh_token){try{s=await http('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token})}catch(e){if(e.status>=400&&e.status<500){session=null;save('musikquiz-session-v1',null)}else throw e}}if(!s)s=await http('/auth/v1/signup',{data:{digihits_guest:true,display_name:'Quiz-'+crypto.randomUUID().slice(0,12)}});if(!s.access_token)throw new Error('Gästanslutning är inte tillgänglig just nu.');s.expires_at=Date.now()+s.expires_in*1000;session=s;save('musikquiz-session-v1',s);return s})().finally(()=>authPromise=null);return authPromise}
 async function rpc(action,payload={}){const s=await auth();try{return await http('/rest/v1/rpc/musikquiz',{action,payload},s.access_token)}catch(e){if(e.status===401){session.expires_at=0;const next=await auth();return http('/rest/v1/rpc/musikquiz',{action,payload},next.access_token)}throw e}}
 async function perform(action,payload={}){if(busy)return;busy=true;setDisabled(true);try{const next=await rpc(action,{code:room?.code,...payload});if(next.left){reset();return}receive(next);$('error').hidden=true}catch(e){error(e)}finally{busy=false;setDisabled(false)}}
 function setDisabled(v){document.querySelectorAll('[data-busy]').forEach(b=>b.disabled=v||b.dataset.blocked==='true');document.querySelectorAll('[data-choice]').forEach(b=>b.disabled=v||state?.phase!=='answering'||Date.now()+offset>=new Date(state.deadline).getTime())}
 function reset(){hideScoreboard();speechSynthesisSafeCancel();room=null;state=null;pendingCode='';signature='';spoken='';save('musikquiz-room-v1',null);$('countdown').hidden=true;home();history.replaceState(null,'',location.pathname)}
 function home(){
  app.innerHTML=`<section class="entry-home card narrow"><button class="primary" id="create" data-busy>Skapa match</button><div class="divider">eller gå med</div><label class="label" for="code">Matchkod · 6 siffror</label><input class="code-input" id="code" type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="off" placeholder="000000" value="${esc(pendingCode)}"><button class="primary button-gap" id="join" data-busy>Gå med i match</button></section>`;
  $('code').addEventListener('input',e=>e.target.value=e.target.value.replace(/\D/g,''));
  $('create').onclick=()=>{if(!busy)profileStep('create')};
  $('join').onclick=checkCode;$('code').onkeydown=e=>{if(e.key==='Enter')checkCode()};
 }
 async function checkCode(){
  if(busy)return;const code=$('code').value;
  if(!/^\d{6}$/.test(code)){error(new Error('Skriv matchkodens sex siffror.'));$('code').focus();return}
  busy=true;setDisabled(true);
  try{const checked=await rpc('check',{code});if(!checked.canJoin)throw new Error('Matchen går inte att ansluta till.');pendingCode=code;$('error').hidden=true;
   if(checked.member){receive(await rpc('state',{code}))}else{profileStep('join',code)}
  }catch(e){error(e)}finally{busy=false;setDisabled(false)}
 }
 function profileStep(action,code=''){
  $('error').hidden=true;
  app.innerHTML=`<section class="card narrow"><h2 class="page-title">Vem spelar?</h2><p class="muted">${action==='create'?'Du blir värd för en ny match.':'Matchkod: '+esc(code)}</p><label class="label" for="name">Ditt namn</label><input id="name" maxlength="18" placeholder="Ditt spelarnamn" autocomplete="nickname" value="${esc(readStore('musikquiz-name')||'')}"><label class="label">Välj din avatar</label><div class="avatar-picker" role="group" aria-label="Välj avatar">${avatars.map((a,i)=>`<button type="button" class="avatar-option ${selectedAvatar===i?'chosen':''}" data-avatar="${i}" aria-label="Avatar ${i+1}" aria-pressed="${selectedAvatar===i}">${a}</button>`).join('')}</div><p class="small muted">Namn och avatar låses när du går med.</p><button class="primary button-gap" id="play" data-busy>Spela!</button><button class="text-button" id="back" data-busy>Tillbaka</button></section>`;
  document.querySelectorAll('[data-avatar]').forEach(b=>b.onclick=()=>{selectedAvatar=Number(b.dataset.avatar);try{localStorage.setItem('musikquiz-avatar',selectedAvatar)}catch{}document.querySelectorAll('[data-avatar]').forEach(n=>{const chosen=Number(n.dataset.avatar)===selectedAvatar;n.classList.toggle('chosen',chosen);n.setAttribute('aria-pressed',chosen)})});
  const play=()=>{if(busy)return;const name=$('name').value.trim();if(!name){error(new Error('Skriv ditt spelarnamn först.'));$('name').focus();return}save('musikquiz-name',name);unlockVoice();perform(action,{name,code,avatar:selectedAvatar})};
  $('play').onclick=play;$('name').onkeydown=e=>{if(e.key==='Enter')play()};$('back').onclick=()=>{if(!busy)home()};
 }
 function unlockVoice(){if(!('speechSynthesis'in window))return;try{const u=new SpeechSynthesisUtterance('');u.lang='sv-SE';speechSynthesis.speak(u)}catch{}}
 function speechSynthesisSafeCancel(){if('speechSynthesis'in window)speechSynthesis.cancel();voiceActive=false}
 function prepareResults(s,old){
  if(s.phase!=='results'||Number.isFinite(Date.parse(s.resultsAt)))return s;
  const key=s.code+':'+s.round,cached=readStore('musikquiz-result-fallback-v1');
  let baseline;
  if(cached?.key===key&&Number.isFinite(Date.parse(cached.startedAt))){baseline=cached}
  else{
   const previous=old?.code===s.code&&old.phase!=='results'?old.players:s.players;
   baseline={key,startedAt:Number.isFinite(Date.parse(s.serverTime))?s.serverTime:new Date().toISOString(),players:previous.map((p,i)=>({id:p.id,score:p.score,rank:i+1}))};
   save('musikquiz-result-fallback-v1',baseline);
  }
  return {...s,resultsAt:baseline.startedAt,players:s.players.map((p,i)=>{const before=baseline.players.find(x=>x.id===p.id);return {...p,previousScore:p.previousScore??before?.score??p.score,previousRank:p.previousRank??before?.rank??i+1,roundPoints:p.roundPoints??Math.max(0,p.score-(before?.score??p.score))}})};
 }
 function receive(s){if(!s?.code)throw new Error('Matchen kunde inte läsas.');offset=new Date(s.serverTime).getTime()-Date.now();const old=state;s=prepareResults(s,old);if(old?.phase!=='results'&&s.phase==='results')previousRanks=(old?.players||s.players).map(p=>p.id);state=s;room={code:s.code};save('musikquiz-room-v1',room);const sig=JSON.stringify({...s,serverTime:undefined});if(sig!==signature){signature=sig;render(old)}tick();if(s.host&&s.phase==='reading'&&spoken!==s.code+':'+s.round){spoken=s.code+':'+s.round;readQuestion()}}
 function players(list,board=false){return `<ol class="players ${board?'leaderboard':''}">${list.map((p,i)=>`<li class="player" ${board?`data-player="${esc(p.id)}"`:''}>${board?`<span class="rank">${i+1}</span>`:''}<span class="avatar">${avatars[p.avatar]||'🎵'}</span><span class="player-name">${esc(p.name)}${p.id===state.me?' <span class="muted small">(du)</span>':''}${p.host?'<br><span class="host-tag">VÄRD</span>':''}</span>${board?`<span class="score">${p.score}<small> p</small></span>`:`<span class="ready-tag ${p.ready?'is-ready':''}">${p.ready?'✓ Redo':'Ej redo'}</span>`}</li>`).join('')}</ol>`}
 function hostButton(action,label,blocked=false){return state.host?`<button class="primary button-gap" data-action="${action}" data-busy ${blocked?'disabled data-blocked="true"':''}>${label}</button>`:''}
 function waiting(t){return `<div class="waiting"><span class="pulse"></span>${t}</div>`}
 function render(old){const s=state;let body='';const head=`<div class="room-head"><div><div class="eyebrow">${s.host?'Du är värd':'Du är med'}</div><h2 class="page-title">${s.phase==='lobby'?'Samla gänget.':s.phase==='finished'?'Vilken match!':'Nu kör vi.'}</h2></div><div class="center"><div class="muted small">MATCHKOD</div><div class="room-code">${esc(s.code)}</div></div></div>`;
 if(s.phase==='lobby'){const link=joinLink();body=`<div class="lobby-layout"><div class="card invite center"><h2>Bjud in till matchen</h2><p class="muted small">Skanna QR-koden eller dela länken.</p><div class="qr" id="qr"></div><button id="share" class="secondary">Dela matchlänk ↗</button><p class="help">Varje spelare använder sin egen telefon. Värden styr spelet och läser upp frågorna.</p></div><div class="card"><div class="stage-top"><h2>Spelare</h2><span class="pill">${s.players.length}/20</span></div>${players(s.players)}${hostButton('start','Starta match',s.players.length<2||s.players.some(p=>!p.host&&!p.ready))}${s.host?'<p class="help">Slå på ljudet. Alla gäster behöver markera sig redo innan ni startar.</p>':`<button id="ready" class="${s.players.find(p=>p.id===s.me)?.ready?'secondary':'primary'} button-gap" data-busy>${s.players.find(p=>p.id===s.me)?.ready?'✓ Du är redo · ändra till ej redo':'Markera mig redo'}</button>${waiting('Väntar på att alla är redo…')}`}</div></div>`;
 }else if(['start_countdown','ready','round_countdown'].includes(s.phase)){body=`<div class="card narrow center"><div class="podium" aria-hidden="true">♫</div><h2 class="page-title">${s.round?'Nästa musikfråga':'Är ni redo?'}</h2><p class="muted">Tio frågor. Upp till 1 000 poäng för snabba rätta svar.<br>Alternativen visas när frågan är uppläst.</p>${s.phase==='ready'?hostButton('round','Starta omgång 1'):''}${waiting(s.host?'Samla alla kring värdens ljud.':'Väntar på värden…')}</div>`;
 }else if(['reading','answering','results'].includes(s.phase)){const q=s.question;body=`<div class="narrow"><div class="card"><div class="stage-top"><span class="pill">FRÅGA ${s.round} / ${s.total}</span><span class="muted small">${esc(q.category)}</span>${s.phase==='answering'?'<span id="timer" class="timer"></span>':''}</div><h2 class="question">${esc(q.text)}</h2>`;
 if(s.phase==='reading'){body+=`<div class="read-status"><span class="sound" aria-hidden="true">♫</span>${s.host?'Frågan läses upp på din telefon.':'Lyssna på frågan från värdens telefon.'}<br><span class="muted small">Svaren visas när uppläsningen är klar.</span></div>${s.host?'<button id="read" class="secondary button-gap">Läs upp frågan igen</button><button id="heard" class="secondary button-gap">Frågan är uppläst – visa svar</button><p class="help" id="voice-help">Om ingen röst hörs: tryck på ”Läs upp frågan igen”. Om din telefon saknar svensk röst kan du läsa frågan högt och sedan visa svaren.</p>':''}`}
 else{body+=`<div class="answers">${q.options.map((a,i)=>`<button class="answer ${s.choice===i?'selected':''} ${s.phase==='results'?(i===q.correct?'correct':s.choice===i?'wrong':''):''}" data-choice="${i}" ${s.phase==='results'?'disabled':''}><span class="letter">${'ABCD'[i]}</span><span>${esc(a)}</span></button>`).join('')}</div>`;
 if(s.phase==='answering')body+=`<div class="progress-track"><div id="time-progress"></div></div><div class="status-row"><span class="muted small">${s.choice!==null?'Svar valt ✓ · du kan ändra':'Välj ditt svar'}</span><span class="muted small">${s.answered}/${s.players.length} har svarat</span></div>`;
 else body+=`<div class="result-banner ${s.choice===q.correct?'':'wrong'}">${s.choice===q.correct?'Rätt svar! +'+(s.players.find(p=>p.id===s.me)?.roundPoints??1)+' poäng':s.choice===null?'Du hann inte svara.':'Inte riktigt den här gången.'}<br><span class="small">Rätt svar: ${esc(q.options[q.correct])}</span></div>`;
 }body+='</div>';
 if(s.phase==='results')body+=`<div class="round-controls">${hostButton('round',s.round===s.total?'Visa slutresultat':'Starta omgång '+(s.round+1))}${s.host?'':waiting('Väntar på nästa omgång…')}</div>`;
 body+='</div>';
 }else if(s.phase==='finished'){const max=s.players[0]?.score||0;const winners=s.players.filter(p=>p.score===max).map(p=>p.name);body=`<div class="card narrow center"><div class="podium" aria-hidden="true">🏆</div><div class="eyebrow" style="justify-content:center">Slutresultat</div><h2 class="finish-heading">${esc(winners.join(' & '))}</h2><p class="muted">${winners.length>1?'Delad seger':'Vinnare'} med ${max} poäng. Bra spelat, allihop!</p>${players(s.players,true)}<button class="primary button-gap" id="new">Spela igen</button><button class="primary button-gap" id="home">Till startsidan</button></div>`}
 if(['lobby','ready','results'].includes(s.phase))body+=`<div class="exit-actions"><button class="danger" id="leave" data-busy>${s.host?'Avsluta match':'Lämna match'}</button></div>`;
 app.innerHTML=head+body;
 document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{unlockVoice();perform(b.dataset.action)});
 document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>perform('answer',{choice:Number(b.dataset.choice)}));
 if($('read'))$('read').onclick=()=>readQuestion();if($('heard'))$('heard').onclick=()=>{speechSynthesisSafeCancel();perform('heard')};
 if($('ready'))$('ready').onclick=()=>perform('ready',{ready:!s.players.find(p=>p.id===s.me).ready});
 if($('new'))$('new').onclick=reset;
 if($('home'))$('home').onclick=reset;
 if($('leave'))$('leave').onclick=confirmExit;
 if($('share')){$('share').onclick=share;const qr=qrcode(0,'M');qr.addData(joinLink());qr.make();$('qr').innerHTML=qr.createSvgTag({cellSize:4,margin:0,scalable:true})}
 if(s.phase==='results'&&old?.phase!=='results')document.querySelector('.question')?.scrollIntoView({behavior:'instant',block:'start'});
 if(s.phase!=='results')hideScoreboard();
 setDisabled(busy);
 }
 function confirmExit(){
  if(busy||!state||document.getElementById('exit-confirm'))return;
  const code=state.code,action=state.host?'finish':'leave',trigger=$('leave');
  const dialog=document.createElement('dialog');dialog.id='exit-confirm';dialog.className='exit-confirm';
  dialog.setAttribute('aria-labelledby','exit-title');dialog.setAttribute('aria-describedby','exit-description');
  dialog.innerHTML=`<h2 id="exit-title">Är du säker?</h2><p id="exit-description" class="muted">${state.host?'Matchen avslutas för alla spelare.':'Du lämnar matchen. De andra kan fortsätta spela.'}</p><div class="confirm-actions"><button class="secondary" id="exit-no" autofocus>Nej</button><button class="danger" id="exit-yes">Ja</button></div>`;
  const close=()=>{dialog.close();dialog.remove();if(trigger?.isConnected)trigger.focus()};
  document.body.append(dialog);dialog.showModal();$('exit-no').focus();
  $('exit-no').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close()});
  $('exit-yes').onclick=()=>{close();if(state?.code!==code)return;if(!['lobby','ready','results'].includes(state.phase)){toast('Omgången har startat. Försök igen mellan frågorna.');return}perform(action)};
 }
 function hideScoreboard(){
  if(boardFrame)cancelAnimationFrame(boardFrame);boardFrame=0;boardKey='';boardRows=[];
  $('scoreboard-overlay')?.remove();document.body.classList.remove('showing-scoreboard');
  [app,document.querySelector('header'),document.querySelector('footer')].forEach(el=>{if(el)el.inert=false});
 }
 function resultElapsed(){return state?.resultsAt?Math.max(0,Date.now()+offset-new Date(state.resultsAt).getTime()):Infinity}
 function updateScoreboard(){
  if(state?.phase!=='results'||resultElapsed()>=BOARD_ANIMATION_MS+BOARD_HOLD_MS){if($('scoreboard-overlay'))hideScoreboard();return}
  const s=state,key=s.code+':'+s.round+':'+s.resultsAt+':'+s.players.map(p=>p.id+':'+p.score).join(',');
  if(boardKey!==key){
   hideScoreboard();boardKey=key;
   const overlay=document.createElement('section');overlay.id='scoreboard-overlay';overlay.className='scoreboard-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','scoreboard-title');overlay.tabIndex=-1;
   overlay.innerHTML=`<div class="scoreboard-inner"><div class="eyebrow">Efter fråga ${s.round} av ${s.total}</div><h2 id="scoreboard-title">Topplistan</h2><p class="muted">${s.players.find(p=>p.id===s.me)?.roundPoints?'+ '+s.players.find(p=>p.id===s.me).roundPoints+' poäng till dig!':'Nya chanser i nästa fråga.'}</p><ol class="scoreboard-list">${s.players.map((p,i)=>`<li class="player scoreboard-row ${p.id===s.me?'is-me':''}" data-id="${esc(p.id)}"><span class="rank">${i+1}</span><span class="avatar">${avatars[p.avatar]||'🎵'}</span><span class="player-name">${esc(p.name)}${p.id===s.me?'<small>Du</small>':''}</span><span class="score"><span class="score-number">${p.previousScore??p.score}</span><small class="score-gain">+${p.roundPoints||0}</small></span></li>`).join('')}</ol><p id="scoreboard-status" class="center muted small" aria-live="polite">Poängen räknas…</p></div>`;
   document.body.append(overlay);document.body.classList.add('showing-scoreboard');[app,document.querySelector('header'),document.querySelector('footer')].forEach(el=>{if(el)el.inert=true});overlay.focus({preventScroll:true});
   boardRows=[...overlay.querySelectorAll('.scoreboard-row')].map((row,i)=>({row,p:s.players[i],i,number:row.querySelector('.score-number'),rank:row.querySelector('.rank')}));
  }
  drawScoreboard();
 }
 function drawScoreboard(){
  if(boardFrame)cancelAnimationFrame(boardFrame);boardFrame=0;
  if(state?.phase!=='results'||!$('scoreboard-overlay'))return;
  const elapsed=resultElapsed();if(elapsed>=BOARD_ANIMATION_MS+BOARD_HOLD_MS){hideScoreboard();return}
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const countProgress=reduced?1:Math.min(1,elapsed/1800),moveProgress=reduced?1:Math.max(0,Math.min(1,(elapsed-1800)/1200));
  const ease=t=>1-Math.pow(1-t,3);
  boardRows.forEach(({row,p,i,number,rank})=>{const before=p.previousScore??p.score,oldIndex=(p.previousRank??i+1)-1;number.textContent=Math.round(before+(p.score-before)*ease(countProgress)).toLocaleString('sv-SE');row.style.transform=`translateY(${(oldIndex-i)*84*(1-ease(moveProgress))}px)`;row.style.zIndex=oldIndex>i?'2':'1';rank.textContent=moveProgress<.5?oldIndex+1:i+1;row.classList.toggle('moving',oldIndex!==i&&moveProgress<1)});
  const status=$('scoreboard-status');const text=elapsed<BOARD_ANIMATION_MS?'Poäng och placeringar uppdateras…':'Rätt svar visas om '+Math.ceil((BOARD_ANIMATION_MS+BOARD_HOLD_MS-elapsed)/1000)+' s';if(status.textContent!==text)status.textContent=text;
  if(elapsed<BOARD_ANIMATION_MS)boardFrame=requestAnimationFrame(drawScoreboard);
 }
 function joinLink(){return location.origin+location.pathname+'?code='+state.code}
 async function share(){const url=joinLink();try{if(navigator.share)await navigator.share({title:'Musikquiz',text:'Spela Musikquiz med oss! Matchkod '+state.code,url});else{await navigator.clipboard.writeText(url);toast('Matchlänken är kopierad')}}catch(e){if(e.name!=='AbortError'){const input=document.createElement('input');input.value=url;app.append(input);input.select();const copied=document.execCommand('copy');input.remove();if(copied)toast('Matchlänken är kopierad');else error(new Error('Matchlänk: '+url))}}}
 function readQuestion(){if(!state?.host||state.phase!=='reading')return;speechSynthesisSafeCancel();voiceError=false;if(!('speechSynthesis'in window)){voiceError=true;showVoiceError();return}try{const utterance=new SpeechSynthesisUtterance(state.question.text);utterance.lang='sv-SE';const voice=speechSynthesis.getVoices().find(v=>v.lang.toLowerCase().startsWith('sv'));if(voice)utterance.voice=voice;utterance.rate=.95;const code=state.code,round=state.round;utterance.onstart=()=>{voiceActive=true};utterance.onend=()=>{voiceActive=false;if(state?.code===code&&state.round===round&&state.phase==='reading')perform('heard')};utterance.onerror=e=>{voiceActive=false;if(!['canceled','interrupted'].includes(e.error)){voiceError=true;showVoiceError()}};speechSynthesis.speak(utterance);setTimeout(()=>{if(state?.phase==='reading'&&!voiceActive&&!speechSynthesis.speaking){showVoiceError()}},2500)}catch{showVoiceError()}}
 function showVoiceError(){if($('voice-help')){$('voice-help').textContent='Tryck på ”Läs upp frågan igen” för att aktivera rösten. Om det fortfarande är tyst: läs frågan högt och tryck sedan på ”Frågan är uppläst – visa svar”.';$('voice-help').classList.add('voice-warning')}}
 function tick(){if(!state)return;updateScoreboard();const s=state,now=Date.now()+offset,overlay=$('countdown');const counting=['start_countdown','round_countdown'].includes(s.phase);overlay.hidden=!counting;if(counting){const left=Math.max(0,Math.ceil((new Date(s.startsAt).getTime()-now)/1000));const text=s.phase==='start_countdown'?'Matchen börjar':'Omgång '+s.round+' börjar';const key=text+left;if(overlay.dataset.key!==key){overlay.dataset.key=key;overlay.innerHTML=`<h2>${text}</h2><strong>${left||'♫'}</strong><p>${left?'Gör dig redo!':'Strax kör vi…'}</p>`}}if(s.phase==='answering'){const left=Math.max(0,(new Date(s.deadline).getTime()-now)/1000);if($('timer'))$('timer').textContent=Math.ceil(left);if($('time-progress'))$('time-progress').style.width=(left/20*100)+'%';document.querySelectorAll('[data-choice]').forEach(b=>b.disabled=busy||left<=0)}}
 async function poll(){if(!room||!state||pollBusy||busy||document.hidden)return;pollBusy=true;const activeRoom=room;try{const next=await rpc('state',{code:activeRoom.code});if(room!==activeRoom)return;receive(next);const net=$('connection');if(net)net.remove()}catch(e){if(e.status===400||e.status===403){error(e);reset()}else if(!$('connection')){const n=document.createElement('p');n.id='connection';n.className='center muted small';n.textContent='Återansluter till matchen…';app.append(n)}}finally{pollBusy=false}}
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){poll();tick()}});
 window.addEventListener('online',poll);setInterval(poll,900);setInterval(tick,100);home();
 if(pendingCode)checkCode();else if(room)perform('state');
})();
