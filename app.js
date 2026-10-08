(function(){
'use strict';
var DOW=['po','út','st','čt','pá','so','ne'];
var DOWL=['Pondělí','Úterý','Středa','Čtvrtek','Pátek','Sobota','Neděle'];
var MON=['ledna','února','března','dubna','května','června','července','srpna','září','října','listopadu','prosince'];
var TYPES={
  uceni:{n:'Učení',s:['Otevři materiál k tomuhle kroku a polož vedle sebe sešit nebo prázdný dokument (2 minuty)','Přečti první část a napiš si 3 klíčová slova','Zavři materiál a z hlavy napiš, co z toho víš','Doplň, co ti v tom chybělo']},
  tvorba:{n:'Tvorba',s:['Otevři prázdný dokument nebo program a pojmenuj ho (2 minuty)','Udělej nejhorší možnou verzi, hlavně ať něco existuje (10 minut)','Projdi to a vyber jednu věc, kterou zlepšíš','Zlepši tu jednu věc']},
  oslovit:{n:'Oslovit lidi',s:['Napiš jméno jedné osoby nebo firmy, kterým napíšeš (2 minuty)','Napiš 3 věty: kdo jsi, co nabízíš nebo chceš a co po nich chceš','Odešli to dřív, než to začneš předělávat','Zapiš si datum, kdy se připomeneš']},
  uklid:{n:'Úklid a pořádek',s:['Nastav časovač na 10 minut a vyber jedno malé místo (jeden stůl nebo jednu zásuvku)','Vyndej všechno z toho místa a roztřiď na tři hromádky: nechat, vyhodit, dát jinam','Hromádku na vyhození rovnou odnes','Vrať zpět jen to, co ponecháváš']},
  pohyb:{n:'Pohyb a zdraví',s:['Obleč se na pohyb, nic víc (2 minuty)','Udělej 5 minut rozcvičky nebo chůze','Pokračuj dalších 5 minut, jen jestli se ti chce','Zapiš si, jak ti bylo']},
  admin:{n:'Vyřizování',s:['Otevři to, co je potřeba vyřídit, a přečti jen první stránku nebo e-mail (2 minuty)','Napiš 3 věci, které musíš dodat nebo zjistit','Udělej tu nejsnazší z nich hned','Zapiš si termín na zbytek']},
  jine:{n:'Jiné',s:['Napiš jednou větou, jak poznáš, že je to hotové (2 minuty)','Vypiš 3 věci, které k tomu potřebuješ (informace, věci nebo lidi)','Udělej tu nejmenší z nich, do 10 minut']}
};
function tplSteps(tp,t){return (TYPES[tp]||TYPES.jine).s.map(function(x){return x.replace('{t}',t)})}
var STUCK={
  tel:{l:'Telefon',t:'Dej telefon do jiné místnosti nebo ho otoč displejem dolů mimo dosah. Zavři aplikace. Pět minut na úkolu.'},
  nechce:{l:'Nechce se mi',t:'Řekni si: jen pět minut, potom smím přestat. Otevři úkol a udělej úplně první pohyb. Většinou se to rozjede.'},
  unava:{l:'Únava',t:'Napij se vody a udělej 10 dřepů, nebo se projdi. Potom pět minut na úkolu, nic víc.'},
  nevim:{l:'Nevím, co dělat',t:''}
};
var LS='rozjezd-state-v1';
var S=defaults(),dirty=false,saving=false,tmr=null,db=null,sref=null,unsub=null,fbAuth=null,fbUser=null;
var stuckType=null,tab='dnes',planDay='today',stuckOpen=false,stuckKey=null,np=null,editing=null,editVal='',delArm='',openD={};
var T={dur:1500,left:1500,running:false,endAt:0,credited:0},tInt=null,wake=null;

/* ---------- state ---------- */
function defaults(){return {v:1,upd:0,
  profile:{vision:'',areas:[{id:'a1',n:'Oblast 1'},{id:'a2',n:'Oblast 2'},{id:'a3',n:''},{id:'a4',n:''}],deadlineLabel:'',deadline:'',minMin:20,reward:'Odpočinek',onboarded:false},
  tasks:{},minutes:{},stepsDone:{},stuck:[],goals:[],reviews:{}}}
function normalize(d){var b=defaults(),o=Object.assign({},b,d||{});
  o.profile=Object.assign({},b.profile,(d&&d.profile)||{});
  if(!Array.isArray(o.profile.areas)||!o.profile.areas.length)o.profile.areas=b.profile.areas;
  ['tasks','minutes','stepsDone','reviews'].forEach(function(k){if(!o[k]||typeof o[k]!=='object')o[k]={}});
  if(!Array.isArray(o.stuck))o.stuck=[];if(!Array.isArray(o.goals))o.goals=[];
  o.goals.forEach(function(g){if(!Array.isArray(g.items))g.items=[];g.items.forEach(function(it){if(!Array.isArray(it.steps))it.steps=[]})});
  return o}
function uid(){return Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-4)}
function $(id){return document.getElementById(id)}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function key(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function parseKey(k){var p=k.split('-').map(Number);return new Date(p[0],p[1]-1,p[2])}
function addDays(k,n){var d=parseKey(k);d.setDate(d.getDate()+n);return key(d)}
function today(){return key(new Date())}
function dow(k){return (parseKey(k).getDay()+6)%7}
function weekStart(k){return addDays(k,-dow(k))}
function fmt(s){s=Math.max(0,s);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function toast(m){var t=$('toast');t.textContent=m;t.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(function(){t.classList.remove('show')},2600)}
function areas(){return S.profile.areas.filter(function(a){return a.n.trim()})}
function areaIdx(id){for(var i=0;i<S.profile.areas.length;i++)if(S.profile.areas[i].id===id)return i;return 0}
function areaName(id){var a=S.profile.areas.filter(function(x){return x.id===id})[0];return a&&a.n.trim()?a.n:(areas()[0]||{n:'Oblast'}).n}

/* ---------- persistence and sync ---------- */
function setSync(k){var p=$('sync');p.className='pill '+({ok:'ok',wait:'wait',err:'err',local:''}[k]||'');
  $('syncTxt').textContent={ok:'Synchronizováno',wait:'Ukládám',err:'Chyba ukládání',local:fbUser?'Offline':'Jen v tomto zařízení'}[k]}
function saveLocal(){try{localStorage.setItem(LS,JSON.stringify(S))}catch(e){}}
function loadLocal(){try{var r=localStorage.getItem(LS);if(r)return normalize(JSON.parse(r))}catch(e){}return null}
function touch(){dirty=true;S.upd=Date.now();saveLocal();setSync(sref?'wait':'local');clearTimeout(tmr);tmr=setTimeout(flush,600)}
function prune(){var cut=addDays(today(),-150);
  ['tasks','minutes','stepsDone','reviews'].forEach(function(k){Object.keys(S[k]).forEach(function(d){if(d<cut)delete S[k][d]})});
  if(S.stuck.length>200)S.stuck=S.stuck.slice(-200)}
async function flush(){
  if(saving){tmr=setTimeout(flush,300);return}
  if(!dirty)return;
  saving=true;dirty=false;prune();saveLocal();
  try{if(sref){await sref.set({s:JSON.stringify(S),upd:S.upd});setSync('ok')}else setSync('local')}
  catch(e){dirty=true;setSync('err')}
  finally{saving=false}
}
function onSnap(snap){
  if(!snap.exists){if(S.profile.onboarded||S.upd>0){dirty=true;clearTimeout(tmr);tmr=setTimeout(flush,100)}else setSync('ok');return}
  var d=snap.data(),ru=d.upd||0;
  if(ru>S.upd&&!dirty&&!saving){try{S=normalize(JSON.parse(d.s));S.upd=ru;saveLocal();renderAll(true);afterLoad()}catch(e){}setSync('ok');return}
  if(ru<S.upd&&!dirty&&!saving){dirty=true;clearTimeout(tmr);tmr=setTimeout(flush,100);return}
  if(!dirty&&!saving)setSync('ok');
}
function loadScript(src){return new Promise(function(res,rej){var s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s)})}
function initSync(){
  var cfg=window.ROZJEZD_FIREBASE;
  if(!cfg||!cfg.apiKey||!navigator.onLine&&!window.firebase){updateSyncUI();return}
  var base='https://www.gstatic.com/firebasejs/10.12.2/';
  loadScript(base+'firebase-app-compat.js').then(function(){return loadScript(base+'firebase-auth-compat.js')}).then(function(){return loadScript(base+'firebase-firestore-compat.js')}).then(function(){
    window.firebase.initializeApp(cfg);fbAuth=window.firebase.auth();db=window.firebase.firestore();
    fbAuth.onAuthStateChanged(function(u){
      if(unsub){unsub();unsub=null}
      fbUser=u;sref=null;
      if(u){sref=db.collection('users').doc(u.uid);unsub=sref.onSnapshot(onSnap,function(){setSync('err')})}
      else setSync('local');
      updateSyncUI();
    });
  }).catch(function(){updateSyncUI()});
}
function syErr(e){var c=e&&e.code||'';return ({'auth/invalid-email':'E-mail nevypadá správně.','auth/missing-password':'Zadej heslo.','auth/weak-password':'Heslo musí mít aspoň 6 znaků.','auth/email-already-in-use':'Tenhle e-mail už účet má. Zkus Přihlásit.','auth/invalid-credential':'E-mail nebo heslo nesedí.','auth/wrong-password':'E-mail nebo heslo nesedí.','auth/user-not-found':'Takový účet není. Zkus Vytvořit účet.','auth/network-request-failed':'Chybí připojení k internetu.','auth/too-many-requests':'Moc pokusů, zkus to za chvíli.'})[c]||'Přihlášení se nepovedlo.'}
function updateSyncUI(){
  var cfg=window.ROZJEZD_FIREBASE&&window.ROZJEZD_FIREBASE.apiKey;
  $('syncForm').hidden=!cfg||!!fbUser;$('syOut').hidden=!fbUser;
  $('syncNote').textContent=!cfg?'Synchronizace zatím není zapnutá. Data jsou jen v tomto zařízení. Dokud ji nezapneš, používej zálohu níže.':fbUser?'Přihlášená. Všechno, co zapíšeš, se objeví i v ostatních zařízeních.':'Přihlas se stejným e-mailem a heslem na telefonu i na počítači a data se budou sdílet. Nejdřív si účet vytvoř tlačítkem Vytvořit účet.';
  if(fbUser)$('syWho').textContent=fbUser.email||'';
}

/* ---------- streak ---------- */
function doneCount(k){return (S.tasks[k]||[]).filter(function(t){return t.done}).length}
function counts(k){return doneCount(k)>0||(S.stepsDone[k]||0)>0||(S.minutes[k]||0)>=S.profile.minMin}
function streakInfo(){
  var t=today(),k=counts(t)?t:addDays(t,-1),n=0;
  while(counts(k)){n++;k=addDays(k,-1)}
  var all={};[S.tasks,S.minutes,S.stepsDone].forEach(function(o){Object.keys(o).forEach(function(x){all[x]=1})});
  var keys=Object.keys(all).filter(counts).sort(),best=0,run=0,prev=null;
  keys.forEach(function(x){run=(prev&&addDays(prev,1)===x)?run+1:1;if(run>best)best=run;prev=x});
  return {cur:n,best:Math.max(best,n),hasHistory:keys.some(function(x){return x<addDays(t,-1)})};
}

/* ---------- render: today ---------- */
function tile(cls,num,unit,label,sub,extra){return '<div class="tile '+cls+'"><span class="micro">'+esc(label)+'</span><span class="num'+(String(num).length>5?' sm':'')+'">'+num+(unit?'<small>'+unit+'</small>':'')+'</span><span class="sub">'+esc(sub)+'</span>'+(extra||'')+'</div>'}
function renderBento(){
  var t=today(),si=streakInfo(),mins=S.minutes[t]||0,ok=counts(t),p=S.profile,dt;
  if(p.deadline){var d=Math.round((parseKey(p.deadline)-parseKey(t))/864e5);
    dt=d>=0?tile(d<=7?'warn':'',''+d,'dní',p.deadlineLabel||'Termín','do '+parseKey(p.deadline).getDate()+'. '+(parseKey(p.deadline).getMonth()+1)+'.'):tile('good','Hotovo','',p.deadlineLabel||'Termín','termín už proběhl')}
  else dt=tile('','—','','Termín','zatím není zadaný','<button class="link" data-act="goto-settings">Nastavit termín</button>');
  $('bento').innerHTML=tile(ok?'hot':'',si.cur,si.cur===1?'den':'dní','Řetěz','nejdelší '+si.best)+tile('',mins,'min','Dnes soustředění','minimum '+p.minMin+' min')+dt+tile(ok?'good':'warn',ok?'Odemčeno':'Zamčeno','','Odměna',p.reward||'Odpočinek');
}
function renderBanner(){
  var t=today(),si=streakInfo(),b=$('banner'),cls='banner',h;
  if(counts(t)){cls+=' good';h='<strong>Dnešek je splněný.</strong><span class="note">Řetěz drží ('+si.cur+'). Všechno navíc je bonus.</span>'}
  else if(counts(addDays(t,-1))){cls+=' warn';h='<strong>Řetěz žije ('+si.cur+'). Dnes ho udrž.</strong><span class="note">Stačí jeden hotový krok z karty Další krok, jeden úkol nebo '+S.profile.minMin+' minut soustředění.</span>'}
  else if(si.hasHistory){cls+=' warn';h='<strong>Včera se vynechalo. Dnes ne.</strong><span class="note">Jeden výpadek je normální. Dva po sobě začínají být návyk. Spusť časovač na 5 minut.</span>'}
  else h='<strong>Začni dnes.</strong><span class="note">Podívej se na kartu Další krok, spusť časovač na 10 minut a řetěz je na světě.</span>';
  b.className=cls;b.innerHTML=h;
  var s='',st=addDays(t,-13);
  for(var i=0;i<14;i++){var k=addDays(st,i),c='cell';if(counts(k))c+=' on';else if(k<t)c+=' miss';if(k===t)c+=' today';s+='<span class="'+c+'" title="'+k+'"></span>'}
  b.insertAdjacentHTML('beforeend','<div class="strip s14" aria-label="Posledních 14 dní" style="margin-top:8px">'+s+'</div>');
}
function itemSteps(it){return it.steps&&it.steps.length?it.steps:tplSteps(it.tp,it.t)}
function pickItem(areaId){
  for(var i=0;i<S.goals.length;i++){var its=S.goals[i].items;for(var j=0;j<its.length;j++){if(!its[j].done&&its[j].a===areaId)return its[j]}}
  return null}
function effArea(){var as=areas();if(np&&as.some(function(a){return a.id===np}))return np;
  for(var i=0;i<as.length;i++)if(pickItem(as[i].id))return as[i].id;return as.length?as[0].id:'a1'}
function nextStep(areaId){
  var it=pickItem(areaId);
  if(!it)return {title:areaName(areaId),text:'V téhle oblasti zatím nemáš žádný krok. V záložce Cesta si přidej cíl a první krok, ten ti pak tady rozdělím na malé kroky.',empty:true};
  var steps=itemSteps(it),sd=Math.min(it.sd||0,steps.length-1);
  return {title:it.t,idx:sd,total:steps.length,text:steps[sd],advance:function(){
    it.sd=sd+1;if(it.sd>=steps.length){it.done=true;it.sd=0;return 'Hotovo: '+it.t}}};
}
function renderNext(){
  var p=effArea(),n=nextStep(p);
  $('npChips').innerHTML=areas().map(function(a){return '<button class="chip" data-act="np" data-p="'+a.id+'" aria-pressed="'+(a.id===p)+'">'+esc(a.n)+'</button>'}).join('');
  var h='<span class="micro">'+esc(n.title)+(n.total?' · krok '+(n.idx+1)+' z '+n.total:'')+'</span><p class="ns-text">'+esc(n.text)+'</p>';
  if(n.advance)h+='<div class="row">'+(T.running?'<span class="ns-time" id="nsTime">'+fmt(tLeft())+'</span>':'<button class="btn primary" data-act="ns-start">Spustit 10 minut</button>')+'<button class="btn" data-act="ns-done">Hotovo, další krok</button></div>';
  else if(n.empty)h+='<div class="row"><button class="btn" data-act="tab" data-tab="cesta">Otevřít Cestu</button></div>';
  $('nextBody').innerHTML=h;
}
function dayKey(){return planDay==='tmr'?addDays(today(),1):today()}
function txtHtml(kind,text,id,ctx){
  if(editing&&editing.kind===kind&&editing.id===id)return '<input type="text" class="editin" id="editIn" value="'+esc(editVal)+'" maxlength="140" aria-label="Upravit text">';
  return '<button class="edit" data-act="'+kind+'-edit" data-id="'+id+'" data-ctx="'+esc(ctx||'')+'" title="Klikni pro úpravu">'+esc(text)+'</button>'}
function renderTasks(){
  var as=areas(),sel=$('taskArea'),o=as.map(function(a){return '<option value="'+a.id+'">'+esc(a.n)+'</option>'}).join('');
  if(sel.innerHTML!==o){var cur=sel.value;sel.innerHTML=o;if(cur)sel.value=cur}
  var k=dayKey(),list=S.tasks[k]||[];
  $('taskAdd').disabled=list.length>=3;
  $('taskText').placeholder=list.length>=3?'Na tenhle den už máš 3 věci':'Co konkrétně uděláš?';
  if(!list.length){$('taskList').innerHTML='<li class="note">'+(planDay==='tmr'?'Na zítřek nic není. Večer si napiš jednu věc, ráno nebudeš přemýšlet, čím začít.':'Dnes zatím žádný úkol. Napiš jednu věc, kterou zvládneš i ve špatný den.')+'</li>';return}
  $('taskList').innerHTML=list.map(function(t,i){
    return '<li class="item'+(t.done?' done':'')+'"><button class="chk" data-act="task-toggle" data-id="'+t.id+'" aria-label="'+(t.done?'Vrátit zpět':'Hotovo')+'">✓</button>'+
      '<div class="txt">'+(i===0?'<div class="main-mark">Hlavní věc</div>':'')+txtHtml('task',t.t,t.id,k)+'</div>'+
      '<button class="tag c'+areaIdx(t.a)+'" data-act="task-area" data-id="'+t.id+'" title="Změnit oblast">'+esc(areaName(t.a))+'</button>'+
      '<button class="x" data-act="task-del" data-id="'+t.id+'" aria-label="Smazat">×</button></li>'}).join('');
}

/* ---------- timer ---------- */
function tLeft(){return T.running?Math.max(0,Math.ceil((T.endAt-Date.now())/1000)):T.left}
function renderTimer(){
  $('tDisp').textContent=fmt(tLeft());
  $('tChips').innerHTML=[[300,'5 min'],[600,'10 min'],[1500,'25 min'],[3000,'50 min']].map(function(p){return '<button class="chip" data-act="timer-dur" data-s="'+p[0]+'" aria-pressed="'+(T.dur===p[0])+'"'+(T.running?' disabled':'')+'>'+p[1]+'</button>'}).join('');
  $('tBtns').innerHTML=(T.running?'<button class="btn primary" data-act="timer-pause">Pauza</button>':'<button class="btn primary" data-act="timer-start">Start</button>')+'<button class="btn" data-act="timer-reset">Znovu</button>';
}
function saveTimer(){try{localStorage.setItem('rozjezd-timer',JSON.stringify(T))}catch(e){}}
function creditPartial(l){
  var whole=Math.floor((T.dur-l)/60),add=whole-Math.floor((T.credited||0)/60);
  if(add>0){var t=today();S.minutes[t]=(S.minutes[t]||0)+add;T.credited=whole*60;touch();renderBento();renderBanner();toast('+'+add+' min započítáno')}
}
function startTimer(sec){
  if(T.running)return;
  if(sec){T.dur=sec;T.left=sec;T.credited=0}
  if(T.left<=0)T.left=T.dur;
  T.endAt=Date.now()+T.left*1000;T.running=true;saveTimer();
  clearInterval(tInt);tInt=setInterval(tick,500);
  try{if(navigator.wakeLock)navigator.wakeLock.request('screen').then(function(w){wake=w}).catch(function(){})}catch(e){}
  renderTimer();renderNext();
}
function releaseWake(){try{if(wake){wake.release();wake=null}}catch(e){}}
function pauseTimer(){if(!T.running)return;var pl=tLeft();creditPartial(pl);T.left=pl;T.running=false;clearInterval(tInt);saveTimer();releaseWake();renderTimer();renderNext();document.title='Rozjezd'}
function resetTimer(){var rl=tLeft();if(T.running||T.left<T.dur)creditPartial(rl);T.credited=0;T.running=false;clearInterval(tInt);T.left=T.dur;saveTimer();releaseWake();renderTimer();renderNext();document.title='Rozjezd'}
function beep(){try{var C=window.AudioContext||window.webkitAudioContext,c=new C(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=880;g.gain.value=.15;o.start();o.stop(c.currentTime+.35)}catch(e){}}
function tick(){
  var l=tLeft();$('tDisp').textContent=fmt(l);var ne=$('nsTime');if(ne)ne.textContent=fmt(l);document.title=fmt(l)+' · Rozjezd';
  if(l<=0){
    var mins=Math.max(0,Math.round(T.dur/60)-Math.floor((T.credited||0)/60)),t=today();T.credited=0;T.running=false;clearInterval(tInt);T.left=T.dur;saveTimer();releaseWake();
    S.minutes[t]=(S.minutes[t]||0)+mins;touch();beep();document.title='Rozjezd';
    toast('+'+mins+' min soustředění'+(counts(t)?'. Minimum splněno.':''));renderAll();
  }
}
function renderStuck(){
  var p=$('stuckPanel');p.hidden=!stuckOpen;if(!stuckOpen)return;
  var h='<p class="note" style="margin-bottom:10px">Co tě teď brzdí?</p><div class="stuck-opts">'+Object.keys(STUCK).map(function(k){return '<button class="chip" data-act="stuck-pick" data-k="'+k+'" aria-pressed="'+(stuckKey===k)+'">'+STUCK[k].l+'</button>'}).join('')+'</div>';
  if(stuckKey&&stuckKey!=='nevim')h+='<div class="step" style="margin-top:12px"><p>'+esc(STUCK[stuckKey].t)+'</p><div class="row"><button class="btn primary" data-act="stuck-start">Spustit 5 minut</button></div></div>';
  if(stuckKey==='nevim'){var ns=nextStep(effArea());
    if(ns.advance)h+='<div class="step" style="margin-top:12px"><p class="note">Rozhodovat nemusíš. Tohle je tvůj další krok:</p><p class="ns-text">'+esc(ns.text)+'</p><div class="row"><button class="btn primary" data-act="ns-start">Spustit 10 minut</button></div></div>';
    else{h+='<p class="note" style="margin:12px 0 8px">Nemáš tu zatím žádný krok. Vyber, o jaký úkol jde, a dám ti úplně první pohyb:</p><div class="stuck-opts">'+Object.keys(TYPES).map(function(k){return '<button class="chip" data-act="stuck-type" data-k="'+k+'" aria-pressed="'+(stuckType===k)+'">'+TYPES[k].n+'</button>'}).join('')+'</div>';
      if(stuckType)h+='<div class="step" style="margin-top:12px"><p class="ns-text">'+esc(tplSteps(stuckType,'tenhle úkol')[0])+'</p><div class="row"><button class="btn primary" data-act="stuck-start">Spustit 5 minut</button></div></div>'}}
  p.innerHTML=h;
}

/* ---------- render: goals ---------- */
function goalState(){
  var first=-1;S.goals.forEach(function(g,i){if(first<0&&g.items.some(function(x){return !x.done}))first=i});
  return S.goals.map(function(g,i){return g.items.length&&g.items.every(function(x){return x.done})?'ok':i===first?'act':'wait'})}
function typeOptions(cur){return Object.keys(TYPES).map(function(k){return '<option value="'+k+'"'+(k===cur?' selected':'')+'>'+TYPES[k].n+'</option>'}).join('')}
function renderGoals(){
  var st=goalState(),lbl={ok:'Hotovo',act:'Aktivní',wait:'Čeká'};
  if(!S.goals.length)$('goals').innerHTML='<div class="card"><p class="note">Zatím tu není žádný cíl. Přidej první níže.</p></div>';
  else $('goals').innerHTML=S.goals.map(function(g,i){
    var d=g.items.filter(function(x){return x.done}).length,n=g.items.length,pc=n?Math.round(d/n*100):0;
    return '<div class="card goal"><div class="row between"><h3>'+txtHtml('goal',g.name,g.id,'')+'</h3><span class="status '+(st[i]==='act'?'act':st[i]==='ok'?'ok':'')+'">'+lbl[st[i]]+'</span></div>'+
      '<div class="row between"><div class="bar" style="flex:1"><b style="width:'+pc+'%"></b></div><span class="micro">'+d+'/'+n+'</span></div>'+
      '<ul class="list">'+g.items.map(function(x){
        return '<li class="item'+(x.done?' done':'')+'"><button class="chk" data-act="item-toggle" data-g="'+g.id+'" data-id="'+x.id+'" aria-label="Přepnout hotovo">✓</button><div class="txt">'+txtHtml('item',x.t,x.id,g.id)+'</div>'+
        '<button class="tag c'+areaIdx(x.a)+'" data-act="item-area" data-g="'+g.id+'" data-id="'+x.id+'" title="Změnit oblast">'+esc(areaName(x.a))+'</button>'+
        (x.done?'':'<button class="link" data-act="item-today" data-g="'+g.id+'" data-id="'+x.id+'">na dnes</button>')+
        '<button class="x" data-act="item-del" data-g="'+g.id+'" data-id="'+x.id+'" aria-label="Smazat">×</button>'+
        '<details class="steps" data-d="'+x.id+'"'+(openD[x.id]?' open':'')+'><summary>Malé kroky ('+(x.steps.length?x.steps.length+' vlastní':'šablona: '+(TYPES[x.tp||'jine']||TYPES.jine).n)+')</summary><label class="lbl" style="margin-top:8px">Typ úkolu<select data-type="'+x.id+'" data-g="'+g.id+'">'+typeOptions(x.tp||'jine')+'</select></label><textarea data-steps="'+x.id+'" data-g="'+g.id+'" placeholder="Chceš vlastní kroky? Napiš jeden na řádek. Když nic nenapíšeš, použije se šablona podle typu.">'+esc(x.steps.join('\n'))+'</textarea></details></li>'}).join('')+'</ul>'+
      '<div class="row"><button class="link" data-act="goal-del" data-id="'+g.id+'">'+(delArm===g.id?'Opravdu smazat celý cíl?':'Smazat cíl')+'</button></div></div>'}).join('');
  var gs=$('itemGoal'),go=S.goals.map(function(g){return '<option value="'+g.id+'">'+esc(g.name)+'</option>'}).join('');
  if(gs.innerHTML!==go){var c1=gs.value;gs.innerHTML=go;if(c1)gs.value=c1}
  var it0=$('itemType');if(!it0.options.length)it0.innerHTML=typeOptions('jine');
  var ia=$('itemArea'),ao=areas().map(function(a){return '<option value="'+a.id+'">'+esc(a.n)+'</option>'}).join('');
  if(ia.innerHTML!==ao){var c2=ia.value;ia.innerHTML=ao;if(c2)ia.value=c2}
}

/* ---------- render: week, settings ---------- */
function renderWeek(){
  var t=today(),ws=weekStart(t),wm=0,wt=0,i;
  for(i=0;i<7;i++){var k=addDays(ws,i);if(k<=t){wm+=S.minutes[k]||0;wt+=doneCount(k)+(S.stepsDone[k]||0)}}
  var si=streakInfo();
  $('wkBento').innerHTML=tile('',wm,'min','Tento týden','soustředění')+tile('',wt,'','Tento týden','hotových úkolů a kroků')+tile('hot',si.cur,'','Řetěz teď','dní v řadě')+tile('',si.best,'','Rekord','nejdelší řetěz');
  var vals=[],mx=S.profile.minMin;
  for(i=6;i>=0;i--){var kk=addDays(t,-i);vals.push({k:kk,v:S.minutes[kk]||0});if((S.minutes[kk]||0)>mx)mx=S.minutes[kk]||0}
  var H=100,top=16,svg='<svg viewBox="0 0 320 150" width="100%" style="min-width:300px;max-width:560px" role="img" aria-label="Minuty soustředění za posledních 7 dní">';
  var ty=top+H-(S.profile.minMin/mx)*H;
  svg+='<line class="tl" x1="0" x2="320" y1="'+ty+'" y2="'+ty+'" stroke-width="1"/><text x="2" y="'+(ty-3)+'">minimum '+S.profile.minMin+'</text>';
  vals.forEach(function(o,j){var x=14+j*44,h=(o.v/mx)*H,y=top+H-h;
    svg+='<rect class="bv'+(o.v?'':' zero')+'" x="'+x+'" y="'+(o.v?y:top+H-3)+'" width="30" height="'+(o.v?h:3)+'" rx="4"/>';
    if(o.v)svg+='<text x="'+(x+15)+'" y="'+(y-4)+'" text-anchor="middle">'+o.v+'</text>';
    svg+='<text x="'+(x+15)+'" y="'+(top+H+16)+'" text-anchor="middle">'+DOW[dow(o.k)]+'</text>'});
  $('chart').innerHTML=svg+'</svg>';
  var st=weekStart(addDays(t,-28)),g='';
  for(i=0;i<35;i++){var k2=addDays(st,i),c='cell';if(k2>t)c+=' fut';else if(counts(k2))c+=' on';else c+=' miss';if(k2===t)c+=' today';g+='<span class="'+c+'" title="'+k2+'">'+parseKey(k2).getDate()+'</span>'}
  $('grid35').innerHTML=g;
  var cut=Date.now()-14*864e5,cnt={};S.stuck.forEach(function(x){if(x.ts>=cut)cnt[x.t]=(cnt[x.t]||0)+1});
  var ks=Object.keys(STUCK).filter(function(k){return cnt[k]}).sort(function(a,b){return cnt[b]-cnt[a]});
  $('stuckStats').innerHTML=ks.length?ks.map(function(k){return '<div class="hbar"><span>'+STUCK[k].l+'</span><div class="bar"><b style="width:'+Math.round(cnt[k]/cnt[ks[0]]*100)+'%"></b></div><span class="micro">'+cnt[k]+'×</span></div>'}).join('')+'<p class="note">Za posledních 14 dní. Nejčastější překážka je to, co má smysl vyřešit jako první.</p>':'<p class="note">Zatím nic. Když se zaseknes, použij tlačítko na záložce Dnes a tady uvidíš, co tě brzdí nejvíc.</p>';
}
function renderReview(){
  var wk=weekStart(today()),r=S.reviews[wk]||{};
  $('rvWeek').textContent='Týden od '+parseKey(wk).getDate()+'. '+MON[parseKey(wk).getMonth()]+'. Vyplň to na konci týdne, zabere to 5 minut.';
  $('rvWin').value=r.win||'';$('rvBlock').value=r.block||'';$('rvNext').value=r.next||'';
}
function renderSettings(){
  var p=S.profile,a=document.activeElement&&document.activeElement.id;
  var set=function(id,v){if(a!==id)$(id).value=v};
  set('setVision',p.vision||'');
  ['a1','a2','a3','a4'].forEach(function(id,i){var ar=p.areas.filter(function(x){return x.id===id})[0];set('setA'+(i+1),ar?ar.n:'')});
  set('setDLabel',p.deadlineLabel||'');set('setDate',p.deadline||'');set('setMin',p.minMin);set('setReward',p.reward||'');
}
function renderAll(remote){
  var d=new Date();
  $('dateLbl').textContent=DOWL[dow(today())]+' '+d.getDate()+'. '+MON[d.getMonth()];
  $('visionLbl').textContent=S.profile.vision||'';
  renderBento();renderBanner();renderNext();renderTasks();renderTimer();renderStuck();renderGoals();renderWeek();renderSettings();
  var a=document.activeElement;if(!remote||!(a&&/^rv/.test(a.id)))renderReview();
  $('onb').hidden=!!S.profile.onboarded;
}
function showTab(t){tab=t;
  ['dnes','cesta','tyden','nast'].forEach(function(x){$('tab-'+x).hidden=x!==t});
  document.querySelectorAll('.tabs button').forEach(function(b){b.setAttribute('aria-selected',String(b.dataset.tab===t))});
  try{localStorage.setItem('rozjezd-tab',t)}catch(e){}
  if(t==='tyden')renderWeek();
}

/* ---------- editing ---------- */
function commitEdit(save){
  if(!editing)return;var e=editing;editing=null;
  if(save){var v=editVal.trim();if(v){
    if(e.kind==='task'){var t=(S.tasks[e.ctx]||[]).filter(function(x){return x.id===e.id})[0];if(t&&t.t!==v){t.t=v;touch()}}
    else if(e.kind==='goal'){var g=S.goals.filter(function(x){return x.id===e.id})[0];if(g&&g.name!==v){g.name=v;touch()}}
    else{var gg=S.goals.filter(function(x){return x.id===e.ctx})[0];var it=gg&&gg.items.filter(function(x){return x.id===e.id})[0];if(it&&it.t!==v){it.t=v;touch()}}}}
  renderAll();
}
function startEdit(kind,id,ctx,cur){editing={kind:kind,id:id,ctx:ctx};editVal=cur;renderAll();setTimeout(function(){var e=$('editIn');if(e){e.focus();e.select()}},0)}
function findItem(gid,id){var g=S.goals.filter(function(x){return x.id===gid})[0];return {g:g,it:g&&g.items.filter(function(x){return x.id===id})[0]}}
function confetti(){
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  var c=document.createElement('canvas');c.id='confetti';document.body.appendChild(c);
  var w=c.width=window.innerWidth,h=c.height=window.innerHeight,x=c.getContext('2d');if(!x){c.remove();return}
  var cs=getComputedStyle(document.documentElement),cols=['--accent','--good','--c0','--c1','--c3'].map(function(v){return cs.getPropertyValue(v).trim()||'#d9b46a'});
  var ps=[];for(var i=0;i<140;i++)ps.push({x:w/2,y:h*0.6,vx:(Math.random()-.5)*14,vy:-Math.random()*16-4,r:Math.random()*5+3,c:cols[i%cols.length],rot:Math.random()*6});
  var t0=performance.now();
  (function f(t){var d=t-t0;x.clearRect(0,0,w,h);ps.forEach(function(p){p.vy+=0.45;p.x+=p.vx;p.y+=p.vy;p.rot+=0.2;x.save();x.translate(p.x,p.y);x.rotate(p.rot);x.fillStyle=p.c;x.globalAlpha=Math.max(0,1-d/2200);x.fillRect(-p.r,-p.r/2,p.r*2,p.r);x.restore()});
    if(d<2200)requestAnimationFrame(f);else c.remove()})(t0);
}
function afterLoad(){}

/* ---------- events ---------- */
document.addEventListener('click',function(e){
  var b=e.target.closest('[data-act]');if(!b||b.disabled)return;
  var a=b.dataset.act,id=b.dataset.id,i;
  if(a==='tab'){showTab(b.dataset.tab);return}
  if(a==='goto-settings'){showTab('nast');setTimeout(function(){var el=$('setDate');el.scrollIntoView({block:'center'});el.focus()},30);return}
  if(a==='onb-go'){
    var as=[1,2,3].map(function(n){return $('obA'+n).value.trim()});
    if(!as[0]||!as[1]){toast('Napiš aspoň dvě oblasti');return}
    S.profile.vision=$('obVision').value.trim();
    S.profile.areas=[{id:'a1',n:as[0]},{id:'a2',n:as[1]},{id:'a3',n:as[2]},{id:'a4',n:''}];
    S.profile.minMin=Math.min(240,Math.max(5,parseInt($('obMin').value,10)||20));
    S.profile.onboarded=true;
    if(!S.goals.length)S.goals.push({id:uid(),name:'Můj první cíl',items:[
      {id:uid(),t:'Napsat jednou větou, čeho chci dosáhnout do konce roku',a:'a1',tp:'tvorba',done:false,steps:[],sd:0},
      {id:uid(),t:'Rozepsat první 3 malé kroky k tomu cíli',a:'a1',tp:'tvorba',done:false,steps:[],sd:0}]});
    touch();renderAll();toast('Hotovo. Podívej se na Další krok.');return}
  if(a==='plan-day'){planDay=b.dataset.d;document.querySelectorAll('[data-act="plan-day"]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b))});renderTasks();return}
  if(a==='task-toggle'){var l=S.tasks[dayKey()]||[],t=l.filter(function(x){return x.id===id})[0];if(t){var was=counts(today());t.done=!t.done;touch();renderAll();if(t.done)toast(!was&&counts(today())?'Minimum splněno. Odměna odemčená.':'Hotovo')}return}
  if(a==='task-del'){S.tasks[dayKey()]=(S.tasks[dayKey()]||[]).filter(function(x){return x.id!==id});touch();renderAll();return}
  if(a==='task-edit'){var tt=(S.tasks[b.dataset.ctx]||[]).filter(function(x){return x.id===id})[0];if(tt)startEdit('task',id,b.dataset.ctx,tt.t);return}
  if(a==='task-area'){var t1=(S.tasks[dayKey()]||[]).filter(function(x){return x.id===id})[0];if(t1){var ac=areas(),ix=ac.map(function(x){return x.id}).indexOf(t1.a);t1.a=ac[(ix+1)%ac.length].id;touch();renderAll()}return}
  if(a==='timer-start'){startTimer();return}
  if(a==='timer-pause'){pauseTimer();return}
  if(a==='timer-reset'){resetTimer();return}
  if(a==='timer-dur'){if(!T.running){T.dur=+b.dataset.s;T.left=T.dur;T.credited=0;saveTimer();renderTimer()}return}
  if(a==='stuck-open'){stuckOpen=!stuckOpen;if(!stuckOpen){stuckKey=null;stuckType=null}renderStuck();return}
  if(a==='stuck-pick'){stuckKey=b.dataset.k;S.stuck.push({ts:Date.now(),t:stuckKey});touch();renderStuck();renderWeek();return}
  if(a==='stuck-start'){startTimer(300);toast('Pět minut. Jedeš.');window.scrollTo({top:0,behavior:'smooth'});return}
  if(a==='stuck-type'){stuckType=b.dataset.k;renderStuck();return}
  if(a==='np'){np=b.dataset.p;renderNext();if(stuckOpen)renderStuck();return}
  if(a==='ns-start'){if(T.running){toast('Časovač už běží');return}startTimer(600);toast('10 minut. Jen tenhle krok.');return}
  if(a==='ns-done'){var nn=nextStep(effArea());if(!nn.advance)return;var msg=nn.advance();S.stepsDone[today()]=(S.stepsDone[today()]||0)+1;touch();
    if(T.running)resetTimer();renderAll();if(msg){confetti();toast(msg)}else toast('Krok splněn. Řetěz drží.');return}
  if(a==='goal-edit'){var g0=S.goals.filter(function(x){return x.id===id})[0];if(g0)startEdit('goal',id,'',g0.name);return}
  if(a==='goal-del'){if(delArm!==id){delArm=id;renderGoals();return}delArm='';S.goals=S.goals.filter(function(x){return x.id!==id});touch();renderAll();return}
  if(a==='item-edit'){var f0=findItem(b.dataset.ctx,id);if(f0.it)startEdit('item',id,b.dataset.ctx,f0.it.t);return}
  var f=findItem(b.dataset.g,id);
  if(a==='item-toggle'&&f.it){f.it.done=!f.it.done;if(f.it.done)f.it.sd=0;touch();renderAll();if(f.it.done)confetti();return}
  if(a==='item-del'&&f.g){f.g.items=f.g.items.filter(function(x){return x.id!==id});touch();renderAll();return}
  if(a==='item-area'&&f.it){var ac2=areas(),ix2=ac2.map(function(x){return x.id}).indexOf(f.it.a);f.it.a=ac2[(ix2+1)%ac2.length].id;touch();renderAll();return}
  if(a==='item-today'&&f.it){var tl=S.tasks[today()]||(S.tasks[today()]=[]);
    if(tl.some(function(y){return y.t===f.it.t}))toast('Tohle už na dnes máš');
    else if(tl.length>=3)toast('Na dnes už máš 3 věci');
    else{tl.push({id:uid(),t:f.it.t,a:f.it.a,done:false});touch();renderAll();toast('Přidáno do dnešního plánu')}return}
  if(a==='sy-in'||a==='sy-up'){
    if(!fbAuth){toast('Synchronizace není zapnutá');return}
    var em=$('syEmail').value.trim(),pw=$('syPass').value;
    var pr=a==='sy-in'?fbAuth.signInWithEmailAndPassword(em,pw):fbAuth.createUserWithEmailAndPassword(em,pw);
    pr.then(function(){$('syPass').value='';toast('Přihlášená')}).catch(function(er){toast(syErr(er))});return}
  if(a==='sy-out'){if(fbAuth)fbAuth.signOut();return}
  if(a==='bk-save'){
    var blob=new Blob([JSON.stringify(S,null,1)],{type:'application/json'}),u=URL.createObjectURL(blob),an=document.createElement('a');
    an.href=u;an.download='rozjezd-zaloha-'+today()+'.json';document.body.appendChild(an);an.click();an.remove();setTimeout(function(){URL.revokeObjectURL(u)},4000);toast('Záloha stažena');return}
  if(a==='bk-load'){$('bkFile').click();return}
});
document.addEventListener('submit',function(e){e.preventDefault()});
$('taskForm').addEventListener('submit',function(){
  var v=$('taskText').value.trim();if(!v)return;
  var k=dayKey(),l=S.tasks[k]||(S.tasks[k]=[]);
  if(l.length>=3){toast('Maximálně 3 věci na den');return}
  l.push({id:uid(),t:v,a:$('taskArea').value||'a1',done:false});$('taskText').value='';touch();renderAll();$('taskText').focus();
});
$('goalForm').addEventListener('submit',function(){
  var v=$('goalText').value.trim();if(!v)return;
  S.goals.push({id:uid(),name:v,items:[]});$('goalText').value='';touch();renderAll()});
$('itemForm').addEventListener('submit',function(){
  var v=$('itemText').value.trim();if(!v)return;
  var g=S.goals.filter(function(x){return x.id===$('itemGoal').value})[0];if(!g){toast('Nejdřív přidej cíl');return}
  g.items.push({id:uid(),t:v,a:$('itemArea').value||'a1',tp:$('itemType').value||'jine',done:false,steps:[],sd:0});$('itemText').value='';touch();renderAll()});
$('manualForm').addEventListener('submit',function(){
  var m=parseInt($('manMin').value,10);if(!(m>0))return;
  var t=today();S.minutes[t]=(S.minutes[t]||0)+Math.min(600,m);$('manMin').value='';touch();renderAll();toast('+'+m+' min přičteno')});
['rvWin','rvBlock','rvNext'].forEach(function(id){$(id).addEventListener('input',function(){
  var wk=weekStart(today());S.reviews[wk]={win:$('rvWin').value,block:$('rvBlock').value,next:$('rvNext').value};touch()})});
$('setVision').addEventListener('change',function(){S.profile.vision=this.value.trim();touch();renderAll()});
[1,2,3,4].forEach(function(n){$('setA'+n).addEventListener('change',function(){
  var ar=S.profile.areas.filter(function(x){return x.id==='a'+n})[0];
  var v=this.value.trim();if(n<=2&&!v){toast('Oblast 1 a 2 musí mít název');renderSettings();return}
  if(ar)ar.n=v;else S.profile.areas.push({id:'a'+n,n:v});touch();renderAll()})});
$('setDLabel').addEventListener('change',function(){S.profile.deadlineLabel=this.value.trim();touch();renderAll()});
$('setDate').addEventListener('change',function(){S.profile.deadline=this.value;touch();renderAll()});
$('setMin').addEventListener('change',function(){S.profile.minMin=Math.min(240,Math.max(5,parseInt(this.value,10)||20));touch();renderAll()});
$('setReward').addEventListener('change',function(){S.profile.reward=this.value.trim();touch();renderAll()});
$('bkFile').addEventListener('change',function(){
  var f=this.files&&this.files[0];this.value='';if(!f)return;
  var r=new FileReader();r.onload=function(){try{var o=normalize(JSON.parse(r.result));S=o;S.profile.onboarded=true;touch();renderAll();toast('Záloha nahrána')}catch(e){toast('Soubor se nepodařilo načíst')}};r.readAsText(f)});
document.addEventListener('input',function(e){
  var t=e.target;if(!t)return;
  if(t.id==='editIn'){editVal=t.value;return}
  if(t.dataset&&t.dataset.steps){var f=findItem(t.dataset.g,t.dataset.steps);if(f.it){f.it.steps=t.value.split('\n').map(function(x){return x.trim()}).filter(Boolean);f.it.sd=0;touch()}}
});
document.addEventListener('change',function(e){var t=e.target;if(t&&t.dataset&&t.dataset.type){var f=findItem(t.dataset.g,t.dataset.type);if(f.it){f.it.tp=t.value;f.it.sd=0;touch();openD[f.it.id]=true;renderAll()}}});
document.addEventListener('toggle',function(e){var d=e.target;if(d&&d.dataset&&d.dataset.d)openD[d.dataset.d]=d.open},true);
document.addEventListener('keydown',function(e){if(e.target&&e.target.id==='editIn'){if(e.key==='Enter'){e.preventDefault();commitEdit(true)}else if(e.key==='Escape')commitEdit(false)}});
document.addEventListener('focusout',function(e){if(e.target&&e.target.id==='editIn')commitEdit(true)});
document.addEventListener('visibilitychange',function(){if(!document.hidden){if(T.running)tick();renderAll(true)}});
window.addEventListener('online',function(){if(dirty)flush()});

/* ---------- start ---------- */
function init(){
  var l=loadLocal();if(l)S=l;
  try{var tb=localStorage.getItem('rozjezd-tab');if(tb&&$('tab-'+tb))tab=tb}catch(e){}
  try{var ts=JSON.parse(localStorage.getItem('rozjezd-timer')||'null');if(ts&&ts.dur){T=Object.assign(T,ts);if(T.running){clearInterval(tInt);tInt=setInterval(tick,500)}}}catch(e){}
  showTab(tab);renderAll();setSync('local');updateSyncUI();initSync();
  if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol))navigator.serviceWorker.register('sw.js').catch(function(){});
}
init();
})();
