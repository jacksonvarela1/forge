const BUILD='v24';
/* ---- storage: same call shape as the artifact API, backed by localStorage outside artifacts ---- */
const rawstorage = window.storage ?? {
  get: async k => { const v = localStorage.getItem(k); return v == null ? null : { value: v }; },
  set: async (k, v) => { localStorage.setItem(k, v); return {}; },
};

/* ---- fighters ----
   Name-based profiles, no passwords: each fighter on a device gets their own
   log, weight, notes, camp start and settings. The original install keeps its
   un-prefixed keys, so nothing already logged moves an inch; everyone else
   lives under their own prefix. Who is active and the roster are shared. */
let WHO='';
const SHARED_KEYS={'forge:who':1,'forge:names':1};
/* every key a fighter owns, so backup, restore and profile switches loop one
   list instead of each remembering its own */
const STORE_KEYS=['forge:bench','forge:bk','forge:week','forge:done','forge:opts','forge:iq','forge:bw','forge:notes','forge:start','forge:startv','forge:check','forge:skip','forge:resume','forge:extra','forge:camps','forge:finish'];
function slugOf(n){return String(n||'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function nsKey(k){
  if(SHARED_KEYS[k])return k;
  const s=slugOf(WHO);
  if(!WHO||WHO.toLowerCase()==='jackson')return k;
  return 'forge:p:'+s+':'+k.slice(6);
}
const storage={
  get:k=>rawstorage.get(nsKey(k)),
  /* nobody is named yet: a stray write would land on the original fighter's
     un-prefixed keys, so it goes nowhere */
  set:(k,v)=>(!WHO&&!SHARED_KEYS[k])?Promise.resolve({}):rawstorage.set(nsKey(k),v),
};
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
/* the coach only speaks a name he has clips for; everyone else gets the same
   lines without one, which still beats a robot saying the wrong name */
function coachNamed(){return !WHO||WHO.toLowerCase()==='jackson';}

/* ---------------- RENDER ---------------- */
const DK=['mon','tue','wed','thu','fri','sat','sun'];
const typeColor={technical:'--steel',moderate:'--ember',hard:'--ember',recovery:'--restore'};
const typeText={technical:'Technical',moderate:'Skill + Work',hard:'Hard',recovery:'Restore'};
function css(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim();}
function fmt(s){const m=Math.floor(s/60),ss=s%60;return String(m).padStart(2,'0')+':'+String(ss).padStart(2,'0');}
/* ---- inline move lookup ---- */
const ALIAS={
 'Stance':['stance'],
 'Step-Drag':['step-drag','step drag','footwork'],
 'Pivot':['pivot'],
 'Switch Stance':['switch stance'],
 'Cutting the Angle':['cut the angle','angle'],
 'In-and-Out':['in-out','in and out'],
 'Jab (1)':['jab'],
 'Cross (2)':['cross'],
 'Lead Hook (3)':['hook'],
 'Rear Hook (4)':['rear hook'],
 'Lead Uppercut (5)':['uppercut'],
 'Rear Uppercut (6)':['rear uppercut'],
 'Body Shots':['body jab','body hook','body shot','body-head','head-body-head','body only'],
 'Teep':['teep'],
 'Roundhouse':['roundhouse'],
 'Leg Kick':['leg kick'],
 'Calf Kick':['calf kick'],
 'Body Kick':['body kick','body roundhouse'],
 'Head Kick':['head kick','head roundhouse'],
 'Switch Kick':['switch kick'],
 'Question Mark Kick':['question mark'],
 'Check':['check'],
 'Knee':['knee'],
 'Elbow':['elbow'],
 'Slip':['slip','slip the swing','slip cross','slip jab'],
 'Roll':['roll'],
 'Parry':['parry'],
 'Catch':['catch'],
 'Shell':['shell'],
 'Body Kick Cover':['body kick cover','cover the body kick'],
 'Head Kick Cover':['head kick cover','cover the head kick'],
 'Clinch Defense':['clinch defense','frame, inside position'],
 'Catch the Teep':['catch the teep'],
 'Collar Tie':['collar tie'],
 'Long Guard':['long guard','frame'],
 'Pull':['pull'],
 'Shoulder Roll':['shoulder roll'],
 'Check Hook':['check hook'],
 'Pull Counter':['pull counter','pull, then'],
 'Cross Counter':['cross counter'],
 'Roll Counter':['roll counter','roll, then','counter the hook'],
 'Sprawl Counter':['sprawl into','sprawl counter','counter the shot'],
 'Check and Return':['check, return','check into','return kick'],
 'Intercept':['intercept','hit the advance','teep the advance'],
 'Feint':['feint'],
 'Level Change Fake':['level fake','level-change','level change'],
 'Hand Feint into Kick':['hand feint'],
 'Broken Rhythm':['broken','rhythm','fast-fast-slow'],
 'Half Beat':['half beat','half-beat'],
 'Baiting':['bait:','bait'],
 'Sprawl':['sprawl'],
 'Up-Down':['up-down','up down'],
 'Plank Shoulder Tap':['plank shoulder tap'],
 '90/90 Hip Switch':['90/90'],
 'Deep Squat Hold':['deep squat'],
 'Leg Swings':['leg swing'],
 'Pigeon':['pigeon'],
 'T-Spine Opener':['t-spine','thoracic'],
 'Towel Dislocates':['dislocate','towel'],
 'Ankle Work':['ankle'],
 'Neck Isometrics':['neck'],
 'Bag Distance':['range check','bag distance'],
 'Sitting Down on Shots':['sit down','sit-down','sitting down'],
 'Kicking Through':['kick through','kicking through','through the bag'],
 'Shin Conditioning':['shin'],
 'Working the Swing':['the swing'],
 'Bag Clinch':['clinch','cup the top'],
 'Punch-Out Drill':['punch-out','punch out'],
 'Wrapping Hands':['wrap'],
 'Shadowboxing':['light shadow','fast shadow','shadow 40','free shadow','shadow, constant'],
 'Hand-Kick-Hand':['hand-kick-hand','kick-hand-kick','kick to hands'],
 'Chain into Low Kick':['chain into low'],
 'Long Chain / Burst':['6-strike','six-strike','burst','five-punch','long chains','5-strike'],
 'Chase Kick':['chase kick'],
 'Hit the Return':['hit the return'],
 'Walk-Down':['walk-down','walk it down','pressure'],
 'Entry, Kick, Exit':['entry, kick, exit'],
 'Double Attack':['fake the kick'],
 'Pause and Restart':['pause mid-chain','pause, then','pause and go'],
 'Stutter Step':['stutter'],
 'Circling':['circle away','circle one way'],
 'Free Flow':['free flow','free boxing','free kick flow','free defensive','fight sim','fight pace'],
 'Torso Rotations':['torso rotation'],
 'Static Stretches':['hamstring + groin','shoulders, lats','full body 60','nasal breathing','neck + chest']
};
const KEYMAP=[];
(function(){
  const MM={};
  CATS.forEach(c=>c.moves.forEach(m=>{MM[m.name]=m;}));
  Object.keys(ALIAS).forEach(n=>{const m=MM[n];if(m)ALIAS[n].forEach(k=>KEYMAP.push([k.toLowerCase(),m]));});
  CATS.forEach(c=>c.moves.forEach(m=>{const b=m.name.replace(/\s*\(.*\)/,'').toLowerCase();if(!KEYMAP.some(e=>e[0]===b))KEYMAP.push([b,m]);}));
  KEYMAP.sort((a,b)=>b[0].length-a[0].length);
})();
const PCOL=['--p1','--p1','--p2','--p2','--p3','--p3','--p4','--p4','--p5','--p5'];
const NUMMOVE={name:'Combo Key',tag:'The number shorthand.',steps:['1 jab, 2 cross, 3 lead hook, 4 rear hook, 5 lead uppercut, 6 rear uppercut.','Read left to right: 1-2-3 is jab, cross, lead hook.'],cue:'Say the numbers out loud as you throw. Wires the shorthand in fast.',vid:'boxing number system combos'};
function matchMove(label){
  const L=label.toLowerCase();
  for(const e of KEYMAP){if(L.includes(e[0]))return e[1];}
  if(/\d-\d/.test(L))return NUMMOVE;
  return null;
}
/* the VIDEO line is the app's only bridge to seeing a move performed, so it
   opens the search instead of asking you to retype it */
function vidHref(q){return 'https://www.youtube.com/results?search_query='+encodeURIComponent(q);}
function liRich(arr){
  return arr.map(it=>{
    const label=it[0],cue=it.length>1?it[1]:'';
    /* an optional third element is a video search for this drill itself */
    const vq=it.length>2&&it[2]?`<div class="mvid"><b>VIDEO:</b> <a class="glink" href="${vidHref(it[2])}" target="_blank" rel="noopener">${it[2]}</a></div>`:'';
    const mv=matchMove(label);
    if(!mv)return `<li><b>${label}</b>${cue?`<span class="cue"> ${cue}</span>`:''}${vq}</li>`;
    const det=`<div class="ldet"><div class="ldtag">${mv.tag}</div><ul>${mv.steps.map(s=>`<li>${s}</li>`).join('')}</ul><div class="ldcue"><b>FIX:</b> ${mv.cue}</div><div class="ldvid"><b>VIDEO:</b> <a class="glink" href="${vidHref(mv.vid)}" target="_blank" rel="noopener">${mv.vid}</a></div></div>`;
    return `<li class="exp"><button class="lrow lbtn" type="button"><b>${label}</b>${cue?`<span class="cue"> ${cue}</span>`:''}<span class="chev">&#9656;</span></button>${vq}${det}</li>`;
  }).join('');
}
/* earliest week each move appears, derived from the actual drills */
const MOVEWEEK={};
(function(){
  try{
    Object.keys(WARM).forEach(k=>{(WARM[k]||[]).forEach(it=>{const m=matchMove(it[0]);if(m&&MOVEWEEK[m.name]===undefined)MOVEWEEK[m.name]=0;});});
    Object.keys(COOL).forEach(k=>{(COOL[k]||[]).forEach(it=>{const m=matchMove(it[0]);if(m&&MOVEWEEK[m.name]===undefined)MOVEWEEK[m.name]=0;});});
    W.forEach((w,wi)=>{DK.forEach(k=>{const d=w.d[k];if(!d)return;
      const scan=a=>(a||[]).forEach(it=>{const m=matchMove(it[0]);if(m&&MOVEWEEK[m.name]===undefined)MOVEWEEK[m.name]=wi;});
      scan(d.t);scan(d.r);});});
    /* the matcher resolves ties by key length, so a few moves never bind.
       pin those deterministically instead of dropping them from the deck. */
    const FIX={'Rear Hook (4)':0,'Rear Uppercut (6)':0,'Shell':2,'Pull':3,'Level Change':1,'The Rest':0,'T-Spine Opener':0,'Body Kick Cover':4,'Head Kick Cover':4,'Clinch Defense':7,'Collar Tie':7};
    /* Bag Work is pinned to the week the bag actually arrives. The literal has
       to stay in step with BAGWEEK below, which cannot be referenced from here
       without hitting its temporal dead zone inside this IIFE. */
    const CATFALL={'Bag Work':4};
    CATS.forEach(c=>c.moves.forEach(m=>{
      if(MOVEWEEK[m.name]===undefined)
        MOVEWEEK[m.name]=FIX[m.name]!==undefined?FIX[m.name]:(CATFALL[c.cat]!==undefined?CATFALL[c.cat]:0);
    }));
    /* Applied AFTER the scan, not as a fallback: the keyword matcher binds these
       to the wrong week rather than failing to bind them at all. Roundhouse was
       landing on week 10 because week 1's "Body roundhouse" matches the Body Kick
       alias first, so the app announced it as new in the final week. */
    /* Wrapping Hands would otherwise bind to week 6's "Wrap and glove up"
       reminder; the wraps matter from the week the bag arrives. Keep the 4 in
       step with BAGWEEK, which is unreachable from inside this IIFE. */
    const PIN={'Roundhouse':0,'Head Kick':3,'Wrapping Hands':4};
    Object.keys(PIN).forEach(n=>{if(MOVEWEEK[n]!==undefined)MOVEWEEK[n]=PIN[n];});
  }catch(e){}
})();
function newIn(wi){return Object.keys(MOVEWEEK).filter(n=>MOVEWEEK[n]===wi);}

let wIdx=0,dIdx=0;
/* Rounds trimmed off today's session before it starts: the short-day valve
   corner note 07 prescribes. Resets whenever the day changes, never persisted. */
let CUT=0;
let LASTTOT=0;
let DONE={};
function todayISO(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function dkey(w,d){return w+'-'+d;}
function isDone(w,d){return !!DONE[dkey(w,d)];}
function toggleDone(w,d){
  const k=dkey(w,d);
  if(DONE[k]){
    /* a stray tap on an old cell should not quietly erase a week of history */
    const st=parseISO(DONE[k]);
    if(st&&Math.round((noonToday()-st)/86400000)>7&&typeof confirm==='function'&&!confirm('This one was logged over a week ago. Remove it from your record?'))return;
    delete DONE[k];
  }else{
    DONE[k]=todayISO();
    if(SKIP[k]){delete SKIP[k];saveSkip();}
  }
  saveDone();paintDone();render();buildGrid();
  if(totDone()>=W.length*7){
    if(!FINISH)showFinale();
    else if(!FINISH.full){FINISH.tot=totDone();FINISH.full=true;saveFinish();showFinale();}
  }
}
function weekFull(i){for(let d=0;d<7;d++)if(!isDone(i,d))return false;return true;}
function paintDone(){
  document.querySelectorAll('.wchip').forEach((c,x)=>{
    c.classList.toggle('full',weekFull(x));
    /* a chip fills from the bottom with the days logged in that week */
    const n=weekCount(x),p=Math.round(100*n/7),tint=c.classList.contains('active')?'rgba(15,19,25,.32)':'rgba(126,155,138,.30)';
    c.style.backgroundImage=n?'linear-gradient(to top,'+tint+' '+p+'%,transparent '+p+'%)':'none';
  });
  document.querySelectorAll('.daytab .dot').forEach((dt,x)=>dt.classList.toggle('dn',isDone(wIdx,x)));
  paintNow();
}
/* Where you actually are today, which is a different question from which week
   you happen to be looking at. The completed-week dot sits at the bottom of a
   chip and is green; this marker sits at the top and is ember, so browsing
   ahead never makes you lose your place. */
function paintNow(){
  paintCampBar();paintHero();paintHeat();
  const slot=todaySlot();
  document.querySelectorAll('.wchip').forEach((c,x)=>c.classList.toggle('now',!!slot&&x===slot.w));
  document.querySelectorAll('.daytab').forEach((t,x)=>t.classList.toggle('now',!!slot&&x===slot.d&&wIdx===slot.w));
  const btn=backTodayEl;
  if(btn){
    const away=!!slot&&(wIdx!==slot.w||dIdx!==slot.d);
    btn.style.display=away?'':'none';
    if(away)btn.textContent='Back to week '+(slot.w+1)+' '+DAYMETA[DK[slot.d]].abbr;
  }
}
/* ---- camp calendar ----
   The app stores the Monday that camp week 1 started, so it can tell you which
   week you are actually in instead of making you remember. Everything degrades
   gracefully if it was never set. */
let START=null,BW=[],NOTES={},CHECKS={},PRERESTORE=null,SAVEFAIL='';
/* SKIP: cells deliberately let go after a layoff (never counted as owed).
   EXTRA: sessions outside the 70. CAMPS: finished camps archived by Run it back.
   FINISH: the one-time record of closing a camp out. RESUME: what the last
   Pick up changed, so it can be undone. */
let SKIP={},EXTRA=[],CAMPS=[],FINISH=null,RESUME=null,PRECAMP=null,BK='';
function isoOf(dt){return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');}
/* Anchored at noon, not midnight: subtracting two midnights across a daylight
   saving boundary gives 23 or 25 hours and rounds to the wrong day. */
function parseISO(s){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||''));return m?new Date(+m[1],+m[2]-1,+m[3],12,0,0):null;}
function mondayOf(dt){const d=new Date(dt.getFullYear(),dt.getMonth(),dt.getDate(),12,0,0);const off=(d.getDay()+6)%7;d.setDate(d.getDate()-off);return d;}
function noonToday(){const n=new Date();return new Date(n.getFullYear(),n.getMonth(),n.getDate(),12,0,0);}
/* Camp began Sunday 12 July 2026, so week 1 runs from Monday the 13th. The
   program's week is Monday to Sunday with restore on the Sunday, which puts
   that first Sunday ahead of week 1 rather than inside it. */
const CAMP_START='2026-07-13';
const START_MIGRATION='2';
/* the original camp has a fixed history; a new fighter's camp starts the
   Monday of the week they walk in */
function forwardMonday(){
  const d=new Date();d.setDate(d.getDate()-1);
  const m=mondayOf(d);
  if(isoOf(m)<isoOf(d))m.setDate(m.getDate()+7);
  return isoOf(m);
}
function defaultStart(){return coachNamed()?CAMP_START:forwardMonday();}
/* Which camp week today falls in, counting from START (negative before it,
   10 or more after it), or null if no start date is set. */
function campWeekRaw(){
  const s=parseISO(START);
  if(!s)return null;
  const days=Math.round((mondayOf(new Date())-mondayOf(s))/86400000);
  return Math.round(days/7);
}
/* unset: no start date. pre: it has not begun. live: inside the 10 weeks.
   over: the calendar has run out, which is where the app used to go blank. */
function campPhase(){
  const w=campWeekRaw();
  if(w===null)return 'unset';
  return w<0?'pre':(w>=W.length?'over':'live');
}
/* {w,d} of today within the camp, or null if today falls outside the 10 weeks */
function todaySlot(){
  const w=campWeekRaw();
  if(w===null||w<0||w>=W.length)return null;
  return {w:w,d:(new Date().getDay()+6)%7};
}
function campDayCount(){
  const s=parseISO(START);
  if(!s)return 0;
  return Math.round((noonToday()-s)/86400000)+1;
}
function isSkipped(w,d){return !!SKIP[dkey(w,d)];}
function totDone(){return Object.keys(DONE).length;}
/* newest logged date, and how long ago that was */
function lastLogISO(){let m='';Object.keys(DONE).forEach(k=>{const v=DONE[k];if(typeof v==='string'&&v>m)m=v;});return m||null;}
function daysSinceLast(){const l=lastLogISO();const d=l?parseISO(l):null;return d?Math.round((noonToday()-d)/86400000):null;}
/* after Pick up the calendar was re-anchored on purpose, so the quiet days
   before it no longer count as a layoff */
function daysSinceActive(){
  const l=lastLogISO()||'',r=RESUME&&RESUME.on?RESUME.on:'';
  const m=r>l?r:l;
  const d=m?parseISO(m):null;
  return d?Math.round((noonToday()-d)/86400000):null;
}
/* furthest session logged, as week*7+day, so Pick up resumes after it */
function highestLogged(){let h=-1;Object.keys(DONE).forEach(k=>{const m=/^(\d+)-(\d+)$/.exec(k);if(m){const v=(+m[1])*7+(+m[2]);if(v>h)h=v;}});return h;}
function resumeWeek(){return Math.max(0,Math.min(W.length-1,Math.floor((highestLogged()+1)/7)));}
/* eight days without a log is a layoff, not a missed session. Past the end of
   the calendar with sessions left is the same thing seen from the other side. */
function lapsed(){
  const ph=campPhase();
  if(ph==='over')return !FINISH&&highestLogged()+1<W.length*7;
  if(ph!=='live')return false;
  const ds=daysSinceActive();
  return ds===null?campDayCount()>8:ds>=8;
}
/* sessions before today's cell that are neither logged nor let go */
function owedBehind(slot){
  let n=0;
  for(let w=0;w<=slot.w;w++)for(let d=0;d<7;d++){
    if(w===slot.w&&d>=slot.d)continue;
    if(!isDone(w,d)&&!isSkipped(w,d))n++;
  }
  return n;
}
const RANKS=[[0,'Walk-on'],[1,'Debut'],[7,'Novice'],[14,'Amateur'],[28,'Prospect'],[42,'Contender'],[56,'Main Card'],[70,'Camp Done']];
function rankOf(n){let r=RANKS[0][1];RANKS.forEach(x=>{if(n>=x[0])r=x[1];});return r;}
/* consecutive training days, forgiving exactly one missing day in a row: rest
   days are part of the plan, a week off is not */
function streak(){
  const days=new Set(Object.keys(DONE).map(k=>DONE[k]).filter(v=>typeof v==='string'));
  let n=0,gap=0;const d=new Date();
  for(let i=0;i<400;i++){
    const iso=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    if(days.has(iso)){n++;gap=0;}
    else if(i>0){gap++;if(gap>=2)break;}
    d.setDate(d.getDate()-1);
  }
  return n;
}

const stripEl=document.getElementById('weekstrip');
W.forEach((w,i)=>{const b=document.createElement('button');b.className='wchip';b.textContent=w.n;
 b.addEventListener('click',()=>{if(!guardSwitch(i,dIdx))return;selectWeek(i);saveWeek(i);});stripEl.appendChild(b);});

const backTodayEl=document.getElementById('backtoday');
if(backTodayEl)backTodayEl.addEventListener('click',()=>{
  const slot=todaySlot();
  if(!slot||!guardSwitch(slot.w,slot.d))return;
  selectWeek(slot.w);saveWeek(slot.w);selectDay(slot.d);
});
const daysEl=document.getElementById('days');
DK.forEach((k,i)=>{const m=DAYMETA[k];const b=document.createElement('button');b.className='daytab';
 b.innerHTML=`<span class="abbr">${m.abbr}</span><span class="dot" style="background:var(${typeColor[m.type]})"></span>`;
 b.addEventListener('click',()=>{if(!guardSwitch(wIdx,i))return;selectDay(i);});daysEl.appendChild(b);});

const panel=document.getElementById('panel');
panel.addEventListener('click',e=>{const b=e.target.closest('.lbtn');if(!b)return;b.closest('li').classList.toggle('open');});
function durMin(du){
  const x=du.match(/(\d+)\s*x\s*(\d+):(\d+)/);
  if(x){const n=+x[1],m=+x[2]+(+x[3])/60;return Math.round(n*m+(n-1));}
  const m=du.match(/(\d+)/);return m?+m[1]:0;
}
function render(){
 try{
  const w=W[wIdx],k=DK[dIdx],m=DAYMETA[k],day=w.d[k];
  const nw=newIn(wIdx);
  const col=`var(${typeColor[m.type]})`;
  let segs='';for(let s2=1;s2<=5;s2++)segs+=`<div class="seg" style="background:${s2<=m.intensity?col:'var(--line)'}"></div>`;
  const effRounds=day.tm?Math.max(1,day.tm.rounds-CUT):0;
  const rl=day.tm?`${effRounds} x ${fmt(day.tm.work)}`:'';
  /* the stepper hides while a session is live so it cannot fight the timer */
  const stepper=(day.tm&&!(T&&T.segs&&T.state==='run'&&T.wk===wIdx&&T.dk===k))?` <button class="cutbtn" id="cutminus" type="button" ${effRounds<=1?'disabled':''}>&minus;</button><button class="cutbtn" id="cutplus" type="button" ${CUT<=0?'disabled':''}>+</button>`:'';
  const B=[];
  const dt=adaptItems(day.t),dr=adaptItems(day.r);
  if(m.warm)B.push({n:'Warm-up',s:'Warm',du:'5 min',it:WARM[m.warm]});
  if(k==='thu'||k==='sat'){B.push({n:'Work',s:'Work',du:rl,it:dt,step:1});{const fm=dr&&dr[0]?/(\d+)\s*min/.exec(String(dr[0][0])):null;B.push({n:'Finisher',s:'Fin',du:(fm?fm[1]:'5')+' min',it:dr,sec:1});}}
  else if(k==='sun'){B.push({n:'Session',s:'Flow',du:'40 min',it:dt});if(dr&&dr.length)B.push({n:'Checkpoint',s:'Chk',du:'',it:dr,sec:1});}
  else{B.push({n:'Technique',s:'Tech',du:'15 min',it:dt});B.push({n:'Rounds',s:'Rnds',du:rl,it:dr,sec:1,step:1});}
  /* Partner work is billed at 10 minutes and comes OUT of the Rounds block, it is
     never bolted on top: the session is capped at 60 minutes and a free sixth
     block is how a 45 minute session quietly becomes 70. */
  if(PARTNER_ON&&PARTNER[k]&&PARTNER[k].length&&k!=='sun')B.push({n:'With a partner',s:'Duo',du:'10 min',it:PARTNER[k],sec:1});
  if(k==='fri'&&STREETWK.indexOf(wIdx)>=0)B.push({n:'Street',s:'Street',du:'8 min',it:STREET,sec:1});
  if(m.cool)B.push({n:'Cooldown',s:'Cool',du:'5 min',it:COOL[m.cool]});
  let tot=0,flow='';
  B.forEach(b=>{const mn=(b.step&&day.tm)?Math.round(effRounds*day.tm.work/60+(effRounds-1)*day.tm.rest/60):durMin(b.du);tot+=mn;if(mn>0)flow+=`<div class="fseg" style="flex:${mn}"><span class="fl">${b.s}</span><span class="fm">${mn}'</span></div>`;});
  LASTTOT=tot;
  const flowbar=`<div class="flow">${flow}<div class="ftot">&#8776; ${tot} min</div></div>`;
  const blocks=B.map(b=>b.it&&b.it.length?`<div class="block${b.sec?' sec':''}"><div class="blabel"><span class="name">${b.n}</span><span class="dur">${b.du}${b.step?stepper:''}</span></div><ul class="items">${liRich(b.it)}</ul></div>`:'').join('');
  panel.innerHTML=`
   <div class="phase" style="border-left-color:var(${PCOL[wIdx]})"><div class="ph" style="color:var(${PCOL[wIdx]})">Week ${w.n} of 10 · ${w.phase}</div><div class="th">${w.theme}</div><div class="nt">${adaptNote(w.note)}</div>${nw.length?`<div class="nlab">New this week</div><div class="newrow">${nw.slice(0,6).map(n=>`<span class="nchip">${n}</span>`).join('')}${nw.length>6?`<span class="nchip" style="color:var(--muted)">+${nw.length-6} more</span>`:''}</div>`:''}</div>
   <div class="dhead"><div><div class="dtitle">${m.title}</div><div class="dfocus">${m.focus}</div></div><span class="badge" style="color:${col};border-color:${col}">${typeText[m.type]}</span></div>
   <div class="pairline">${m.lift}</div>
   ${(wIdx>0&&NOTES[dkey(wIdx-1,dIdx)])?`<div class="pairline"><b>Last ${m.abbr}:</b> ${String(NOTES[dkey(wIdx-1,dIdx)]).replace(/</g,'&lt;')}</div>`:''}
   <div class="meter">${segs}<span class="mlabel">Intensity ${m.intensity}/5</span></div>
   <div class="swrow"><button class="sw${VOICE_ON?' on':''}" id="swV" type="button">${VOICE_ON?'&#9679;':'&#9675;'} Voice coach</button><button class="sw${CALLER_ON?' on':''}" id="swC" type="button">${CALLER_ON?'&#9679;':'&#9675;'} Combo caller</button></div>
   <div class="swrow"><button class="sw${BAG_ON?' on':''}" id="swB" type="button">${BAG_ON?'&#9679;':'&#9675;'} Heavy bag</button><button class="sw${PARTNER_ON?' on':''}" id="swP" type="button">${PARTNER_ON?'&#9679;':'&#9675;'} Partner</button></div>
   ${flowbar}
   ${blocks}
   ${m.flag?`<div class="flag">${m.flag}</div>`:''}
   ${(MAKEUP&&MAKEUP.w===wIdx&&MAKEUP.d===dIdx)?`<div class="flag">Makeup session: trimmed short on purpose so tomorrow&rsquo;s real session survives it. Run what is here, mark it done, and the missed cell fills in. No guilt, just reps.</div>`:''}
   ${(wIdx>=BAGWEEK&&!bagLive())?`<div class="flag">Bag drills run as shadow until you tick: ${[!BAG_ON&&'a bag',!WRAPS_ON&&'wraps',!GLOVES_ON&&'gloves'].filter(Boolean).join(' and ')}. Chase snap and a clean recovery instead of impact.${!WRAPS_ON?' Bare knuckles on a bag is how a good week ends a training month, and wraps are twelve dollars.':''}</div>`:''}
   ${(BAG_ON&&wIdx===BAGWEEK)?`<div class="flag">Bag work starts this week. Most of the week is still air work until the bag is hanging. The moment it is up: wraps and 16 oz gloves every round, hands and kicks at 50 percent, and stop the second a wrist or a shin complains.</div>`:''}${(BAG_ON&&wIdx===BAGWEEK+1)?`<div class="flag">First full week on the bag. Wraps and 16 oz gloves every round, no exceptions. Hands and kicks stay at 50 percent all week no matter how good it feels: your wrists and shins are brand new to impact. Boxer’s wrist happens in week one on the bag, not week five. Sore shins mean back off, not push on.</div>`:''}
   ${(PARTNER_ON&&k!=='sun')?`<div class="flag">${wIdx<=BAGWEEK?`Partner drills start in week ${BAGWEEK+1}. Until you have a partner these are a preview. `:''}${PARTNER_RULES}</div>`:''}
   ${k==='sun'?checkCard():''}
   <div class="dbtnwrap"><button class="dbtn${isDone(wIdx,dIdx)?' on':''}" id="dbtn" type="button">${isDone(wIdx,dIdx)?'&#10003; Session logged':'Mark session done'}</button>
    <textarea class="srch notebox" id="notebox" rows="2" placeholder="How did it go? What felt off? Two words is enough.">${(NOTES[dkey(wIdx,dIdx)]||'').replace(/</g,'&lt;')}</textarea></div>`;
  const db=document.getElementById('dbtn');
  if(db)db.addEventListener('click',()=>toggleDone(wIdx,dIdx));
  const nb=document.getElementById('notebox');
  if(nb)nb.addEventListener('change',()=>{
    const k=dkey(wIdx,dIdx),v=nb.value.trim();
    if(v)NOTES[k]=v;else delete NOTES[k];
    saveNotes();buildGrid();
  });
  const sv=document.getElementById('swV');
  if(sv)sv.addEventListener('click',()=>{VOICE_ON=!VOICE_ON;if(!VOICE_ON){vstop();callerStop();}saveOpts();render();});
  const sc=document.getElementById('swC');
  if(sc)sc.addEventListener('click',()=>{CALLER_ON=!CALLER_ON;if(!CALLER_ON)callerStop();else if(T&&T.running)callerStart();saveOpts();render();});
  const sb=document.getElementById('swB');
  if(sb)sb.addEventListener('click',()=>{BAG_ON=!BAG_ON;saveOpts();render();});
  const sp=document.getElementById('swP');
  if(sp)sp.addEventListener('click',()=>{PARTNER_ON=!PARTNER_ON;saveOpts();render();});
  const cm=document.getElementById('cutminus');
  if(cm)cm.addEventListener('click',()=>{CUT++;render();});
  const cp=document.getElementById('cutplus');
  if(cp)cp.addEventListener('click',()=>{CUT=Math.max(0,CUT-1);render();});
  const ck=document.getElementById('ckrow');
  if(ck)ck.addEventListener('click',e=>{
    const b=e.target.closest('.ckchip');
    if(!b)return;
    if(b.dataset.ck==='none'){CHECKS[wIdx]=[0,0,0,0,0];saveChecks();render();return;}
    const i=+b.dataset.ck;
    const cur=CHECKS[wIdx]||[0,0,0,0,0];
    cur[i]=cur[i]?0:1;
    CHECKS[wIdx]=cur;
    saveChecks();render();
  });
  paintDone();
  /* Never rebuild a timer that is mid-session on this same day. render() runs
     again every time you mark a session done or flip a switch, and reloading
     would silently reset a live round back to Ready. */
  if(!(T&&T.segs&&T.state==='run'&&T.wk===wIdx&&T.dk===k))loadTimer(k,day);
 }catch(e){if(panel)panel.innerHTML='<div class="empty"><b>Hiccup</b>Could not draw that day. Tap another day, then come back.</div>';}
}
function selectWeek(i){
  wIdx=i;CUT=0;MAKEUP=null;
  try{document.documentElement.style.setProperty('--ph','var('+(PCOL[i]||'--ember')+')');}catch(e){}
  document.querySelectorAll('.wchip').forEach((c,x)=>{
    const on=x===i;
    c.classList.toggle('active',on);
    c.classList.toggle('full',weekFull(x));
    c.style.background=on?`var(${PCOL[x]})`:'var(--surface)';
    c.style.color=on?'#0F1319':`var(${PCOL[x]})`;
    c.style.borderColor=`var(${PCOL[x]})`;
  });
  render();
}
function selectDay(i){if(MAKEUP&&(MAKEUP.w!==wIdx||MAKEUP.d!==i))MAKEUP=null;dIdx=i;CUT=0;document.querySelectorAll('.daytab').forEach((t,x)=>t.classList.toggle('active',x===i));render();
 const t=document.querySelectorAll('.daytab')[i];if(t)t.scrollIntoView({inline:'center',block:'nearest',behavior:'smooth'});}

/* ---- log grid ---- */
const gridEl=document.getElementById('grid'),statsEl=document.getElementById('stats'),
      todayCardEl=document.getElementById('todaycard'),weightCardEl=document.getElementById('weightcard'),
      logToolsEl=document.getElementById('logtools');

/* ---- bodyweight ----
   He is told to trust only the 7 day average, so the average is what the app
   shows big and the raw entry is what it shows small. */
function bwSorted(){return BW.slice().sort((a,b)=>a.d<b.d?-1:1);}
function bwAvg(endISO,days){
  const end=parseISO(endISO);if(!end)return null;
  const from=new Date(end.getFullYear(),end.getMonth(),end.getDate()-(days-1));
  const win=BW.filter(x=>{const d=parseISO(x.d);return d&&d>=from&&d<=end;});
  if(!win.length)return null;
  return win.reduce((a,x)=>a+x.w,0)/win.length;
}
function bwTrend(){
  const s=bwSorted();
  if(s.length<2)return null;
  const last=s[s.length-1].d;
  const now=bwAvg(last,7);
  const prevEnd=parseISO(last);prevEnd.setDate(prevEnd.getDate()-7);
  const then=bwAvg(isoOf(prevEnd),7);
  if(now==null||then==null)return null;
  return {now:now,delta:now-then,first:s[0],last:s[s.length-1]};
}
/* the 7 day average over the last 90 days, raw weigh-ins as dots, broken across long gaps */
function bwChart(s){
  if(s.length<2)return '';
  const last=parseISO(s[s.length-1].d);
  const first=new Date(last.getFullYear(),last.getMonth(),last.getDate()-89,12,0,0);
  const pts=s.filter(x=>{const d=parseISO(x.d);return d&&d>=first;});
  if(pts.length<2)return '';
  const av=pts.map(x=>({d:parseISO(x.d),a:bwAvg(x.d,7),w:x.w}));
  const WW=300,HH=84,pad=7,t0=av[0].d.getTime(),t1=av[av.length-1].d.getTime();
  const ys=[];av.forEach(p=>{ys.push(p.a);ys.push(p.w);});
  const mn=Math.min.apply(null,ys)-1,mx=Math.max.apply(null,ys)+1;
  const X=d=>pad+(WW-2*pad)*(d.getTime()-t0)/((t1-t0)||1),Y=v=>HH-pad-(HH-2*pad)*(v-mn)/((mx-mn)||1);
  let line='';
  av.forEach((p,i)=>{line+=((i&&(p.d-av[i-1].d)<=10*86400000)?'L':'M')+X(p.d).toFixed(1)+' '+Y(p.a).toFixed(1);});
  const dots=av.map(p=>'<circle cx="'+X(p.d).toFixed(1)+'" cy="'+Y(p.w).toFixed(1)+'" r="1.8" class="bwdot"></circle>').join('');
  return '<svg class="bwchart" viewBox="0 0 '+WW+' '+HH+'" preserveAspectRatio="none" aria-hidden="true"><path d="'+line+'" class="bwpath"></path>'+dots+'</svg>';
}
function paintWeight(){
  if(!weightCardEl)return;
  const s=bwSorted(),t=bwTrend();
  const latest=s.length?s[s.length-1]:null;
  const avg=latest?bwAvg(latest.d,7):null;
  let body;
  if(!s.length){
    body='<div class="bwnote">Log it most mornings, first thing, after the bathroom. Single days are noise, the 7 day average is the signal.</div>';
  }else{
    const total=s.length>1?(s[s.length-1].w-s[0].w):0;
    const lp=parseISO(latest.d);
    const age=lp?Math.round((noonToday()-lp)/86400000):0;
    const wk=t?t.delta:null;
    const col=wk==null?'--muted':(wk<-1.2?'--ember':(wk<=0?'--restore':'--steel'));
    body=`<div class="bwrow">
        <div class="bwbig">${avg!=null?avg.toFixed(1):latest.w.toFixed(1)}<span class="bwunit">lb avg</span></div>
        <div class="bwside">
          <div class="bwline">Last entry <b>${latest.w.toFixed(1)}</b> on ${latest.d.slice(5)}</div>
          ${age>7?`<div class="bwline">7 day average as of <b>${shortDate(latest.d)}</b>, ${age} days ago</div>`:`<div class="bwline">This week <b style="color:var(${col})">${wk==null?'not enough data':(wk>0?'+':'')+wk.toFixed(1)+' lb'}</b></div>`}
          <div class="bwline">Since you started <b>${total>0?'+':''}${total.toFixed(1)} lb</b> over ${s.length} entries</div>
        </div>
      </div>
      ${bwChart(s)}
      ${wk!=null&&wk<-1.2&&age<=7?'<div class="bwnote">You are down more than 1.2 lb this week. If next week looks the same, eat more, not less: past that rate the loss starts coming out of muscle instead of fat.</div>':''}`;
  }
  /* The last fortnight, so a missed morning is visible instead of silently
     dragging the average around. Tap an entry to delete it. */
  const recent=s.slice(-14).reverse().map(x=>
    `<button class="bwchip" type="button" data-d="${x.d}" title="Tap to remove">${x.d.slice(5)} <b>${x.w.toFixed(1)}</b></button>`).join('');
  weightCardEl.innerHTML=`<div class="card"><div class="cardhead"><span class="cardtitle">Bodyweight</span></div>
    ${body}
    <div class="bwform"><input class="srch bwinput" id="bwdate" type="date" value="${todayISO()}" max="${todayISO()}"><input class="srch bwinput" id="bwval" type="number" step="0.1" inputmode="decimal" placeholder="weight"><button class="sw bwadd" id="bwadd" type="button">Log it</button></div>
    ${recent?`<div class="bwnote">Logged so far, tap one to remove it:</div><div class="bwchips">${recent}</div>`:''}</div>`;
  const inp=document.getElementById('bwval'),btn=document.getElementById('bwadd'),dat=document.getElementById('bwdate');
  if(btn)btn.addEventListener('click',()=>{
    const v=parseFloat(inp&&inp.value);
    if(!isFinite(v)||v<=0||v>1000)return;
    /* any date, not just today: missing a morning should not mean losing it */
    const d=(dat&&parseISO(dat.value))?dat.value:todayISO();
    BW=BW.filter(x=>x.d!==d);
    BW.push({d:d,w:Math.round(v*10)/10});
    saveBW();paintWeight();
  });
  if(inp)inp.addEventListener('keydown',e=>{if(e.key==='Enter'&&btn)btn.click();});
  weightCardEl.querySelectorAll('.bwchip').forEach(c=>c.addEventListener('click',()=>{
    BW=BW.filter(x=>x.d!==c.dataset.d);saveBW();paintWeight();
  }));
}

/* ---- today, and what you owe ---- */
/* one dated nudge per key week, surfaced where he actually looks */
const MILESTONES={
 4:'Bag work starts this week. Wraps and gloves every round, and hands and kicks stay at 50 percent.',
 6:'Lifting deloads this week while the bag load arrives. That is the plan working, not you slacking.',
 7:'Call a gym this week and ask about a beginner or fundamentals slot. The Gear tab has the maps and what to say.',
 9:'Book the trial class for the week after camp. Mouthguard ordered? Gear tab.',
};
const MONS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function shortDate(iso){const d=parseISO(iso);return d?MONS[d.getMonth()]+' '+d.getDate():String(iso||'');}
function campEndDate(){const s=parseISO(START);if(!s)return null;const e=mondayOf(s);e.setDate(e.getDate()+W.length*7-1);return e;}
function nextMondayISO(){const m=mondayOf(new Date());m.setDate(m.getDate()+7);return isoOf(m);}
function abtn(a,label,cls,extra){return `<button class="sw${cls?' '+cls:''}" data-act="${a}"${extra||''} type="button">${label}</button>`;}
function lastSessionText(){const h=highestLogged();return h<0?'':'Week '+(Math.floor(h/7)+1)+' '+DAYMETA[DK[h%7]].abbr;}
function sessionRunning(){return !!(T&&T.segs&&T.state==='run');}
/* switching day or week while a round is live would silently destroy it */
function guardSwitch(w,d){
  if(!sessionRunning())return true;
  if(T.wk===w&&T.dk===DK[d])return true;
  return typeof confirm!=='function'||confirm('A session is running. End it and switch?');
}

/* A layoff is the one place the old app punished you: a wall of owed cells and
   no way back in. Pick up re-anchors the calendar so today is the next week you
   have not done, lets the unlogged days before it go quietly, and never edits a
   logged cell. */
function welcomeHTML(){
  const ds=daysSinceLast(),wk=resumeWeek(),h=highestLogged();
  const gap=ds===null?'No session logged yet.':`${ds} day${ds===1?'':'s'} since your last session.`;
  const where=h>=0?` The last one logged was <b>${lastSessionText()}</b>.`:'';
  const ret=(ds!==null&&ds>=14)?'<div class="bwnote" style="color:var(--ember)">Return week: run everything at 50 percent, no knees or elbows, and back off at any sore shin or wrist.</div>':'';
  return `<div class="wb"><div class="wbt">Welcome back</div>
    <div class="bwline">${gap}${where} Nothing you logged gets touched and there is no catch-up. The calendar moves to you.</div>${ret}
    <div class="bwform">${abtn('resume','Pick up at Week '+(wk+1),'pri')}</div></div>`;
}
/* the log lives in one browser and nothing else; say so before it matters */
function backupNudge(){
  if(totDone()<5)return '';
  const bd=BK?parseISO(BK):null;
  const age=bd?Math.round((noonToday()-bd)/86400000):999;
  if(age<14)return '';
  return '<div class="bwnote" style="color:var(--ember)">'+(bd?'Last backup '+age+' days ago.':'No backup yet.')+' Your log lives only in this browser. <button class="bwchip" data-act="backupnow" type="button">Copy backup now</button></div>';
}
/* undo is offered only while the new camp is untouched, so it can never discard new work */
function undoCampHTML(){return (PRECAMP&&totDone()===0)?'<div class="bwform">'+abtn('undocamp','Undo run it back')+'</div>':'';}
function undoResumeHTML(){
  return (RESUME&&RESUME.on===todayISO())?`<div class="bwform">${abtn('undoresume','Undo pick up')}</div>`:'';
}
function doResume(){
  if(sessionRunning()&&typeof confirm==='function'&&!confirm('A session is running. End it and move the calendar?'))return false;
  const wk=resumeWeek();
  const prev=START;
  const mon=mondayOf(new Date());
  mon.setDate(mon.getDate()-7*wk);
  START=isoOf(mon);
  const slot=todaySlot();
  const added=[];
  if(slot){
    for(let w=0;w<=slot.w;w++)for(let d=0;d<7;d++){
      if(w===slot.w&&d>=slot.d)break;
      if(!isDone(w,d)&&!isSkipped(w,d)){const k=dkey(w,d);SKIP[k]=todayISO();added.push(k);}
    }
  }
  RESUME={start:prev,added:added,on:todayISO()};
  saveStart();saveSkip();saveResume();recomputeBagWeek();
  if(slot){wIdx=slot.w;dIdx=slot.d;}
  MAKEUP=null;CUT=0;
  selectWeek(wIdx);selectDay(dIdx);paintDone();buildGrid();
  return true;
}
function undoResume(){
  if(!RESUME)return;
  START=RESUME.start;
  RESUME.added.forEach(k=>{delete SKIP[k];});
  RESUME=null;
  saveStart();saveSkip();saveResume();recomputeBagWeek();
  const slot=todaySlot();
  if(slot){wIdx=slot.w;dIdx=slot.d;}
  selectWeek(wIdx);selectDay(dIdx);paintDone();buildGrid();
}

function liveHTML(slot){
  const stamp=DONE[dkey(slot.w,slot.d)],doneToday=stamp===todayISO(),m=DAYMETA[DK[slot.d]];
  const fresh=campDayCount()<=1;
  const owed=fresh?0:owedBehind(slot);
  const lap=lapsed();
  const status=doneToday?'Logged. That is the day.':(stamp?`Logged ${shortDate(stamp)}, not today.`:'Not logged yet.');
  /* the most recent timed day inside the last week that was neither logged nor
     let go; Sunday is a flow day with no rounds, so it is never a makeup */
  let mk=null;
  if(!fresh&&!lap){
    const floor=slot.w*7+slot.d-7;
    outer:for(let w=slot.w;w>=0;w--)for(let d=(w===slot.w?slot.d-1:6);d>=0;d--){
      if(w*7+d<floor)break outer;
      const dy=W[w].d[DK[d]];
      if(!isDone(w,d)&&!isSkipped(w,d)&&dy&&dy.tm){mk={w:w,d:d};break outer;}
    }
  }
  const dn=Math.min(70,Math.max(1,campDayCount()));
  return `<div class="card${doneToday?' cardon':''}"><div class="cardhead"><span class="cardtitle">Today</span><span class="cardtag">Week ${slot.w+1} &middot; ${m.abbr}</span></div>
      <div class="todaytitle">${m.title}</div>
      <div class="bwline"><b>Day ${dn} of 70</b>${streak()>1?` &middot; ${streak()} straight`:''}. ${status}${owed?` <b>${owed}</b> session${owed>1?'s':''} still open behind you.`:(fresh?'':' Nothing outstanding behind you.')}</div>
      ${MILESTONES[slot.w]?`<div class="bwnote" style="color:var(--ember)">${MILESTONES[slot.w]}</div>`:''}
      <div class="bwform">${abtn('gotoday','Open today','pri')}${(stamp&&!doneToday)?abtn('trainnow','Train today'):`<button class="sw${doneToday?' on':''}" data-act="marktoday" type="button">${doneToday?'&#10003; Done':'Mark done'}</button>`}</div>
      ${mk?`<div class="bwform">${abtn('makeup','Make up '+DAYMETA[DK[mk.d]].abbr+' &middot; short version','',` data-w="${mk.w}" data-d="${mk.d}"`)}</div>`:''}
      ${backupNudge()}${lap?welcomeHTML():''}${undoResumeHTML()}${undoCampHTML()}</div>`;
}

/* the 10 weeks are over. This used to be a dead end that told you to set a
   start date you had already set. */
const RB={open:false};
function rbHTML(){
  if(!RB.open)return '';
  return `<div class="wb"><div class="wbt">Run it back</div>
    <div class="bwline">This camp (${totDone()} sessions, your notes and tape grades) is saved to your history, then Camp ${CAMPS.length+2} starts clean. Weight, fight IQ and gear settings carry over, and you can undo it.</div>
    <div class="bwform"><input class="srch bwinput" id="rbdate" type="date" value="${nextMondayISO()}">${abtn('runbackgo','Start Camp '+(CAMPS.length+2),'pri')}${abtn('runbackcancel','Cancel')}</div></div>`;
}
function overHTML(){
  const tot=totDone(),full=tot>=W.length*7,end=campEndDate();
  const endTxt=end?`Camp ended Sunday ${MONS[end.getMonth()]} ${end.getDate()}`:'Camp ended';
  const menu=[[8,0,'Mon &middot; kicks'],[8,2,'Wed &middot; boxing'],[7,3,'Thu &middot; output'],[8,4,'Fri &middot; defense']];
  return `<div class="card${full?' cardon':''}"><div class="cardhead"><span class="cardtitle">${full?'Camp complete':'Camp ended'}</span><span class="cardtag">${tot} / 70</span></div>
      <div class="todaytitle">${full?'All 70 sessions':endTxt}</div>
      <div class="bwline">${full?endTxt+'. ':''}<b>${tot} of 70</b> sessions logged${CAMPS.length?` &middot; Camp ${CAMPS.length+1}`:''}.</div>
      ${backupNudge()}${lapsed()?welcomeHTML():''}${undoResumeHTML()}
      <div class="bwform">${FINISH?abtn('replay','Replay finale')+(FINISH.full?'':abtn('reopen','Reopen camp')):abtn('closeout',full?'See your finale':'Close out camp',lapsed()?'':'pri')}${abtn('runback','Run it back',(FINISH||full)?'pri':'')}</div>
      ${rbHTML()}${undoCampHTML()}
      <div class="bwnote">Keep going between camps: four sessions a week from the camp's own days. Tue, Sat and Sun stay open so lifting and rest still land.</div>
      <div class="bwchips">${menu.map(x=>abtn('menu',x[2],'obchip',` data-w="${x[0]}" data-d="${x[1]}"`)).join('')}</div>
      ${abtn('extrascroll','Log a session outside the camp')}</div>`;
}
function preHTML(){
  const s=parseISO(START);
  const days=s?Math.max(0,Math.round((s-noonToday())/86400000)):0;
  return `<div class="card"><div class="cardhead"><span class="cardtitle">Today</span><span class="cardtag">Not started</span></div>
      <div class="todaytitle">Camp starts ${shortDate(START)}</div>
      <div class="bwline">${days} day${days===1?'':'s'} to go. Until then the Moves tab and a few easy shadow rounds are plenty.</div>${undoCampHTML()}</div>`;
}
function paintToday(){
  if(!todayCardEl)return;
  const ph=campPhase();
  if(ph==='live')todayCardEl.innerHTML=liveHTML(todaySlot())+(lapsed()?'':taleHTML());
  else if(ph==='over')todayCardEl.innerHTML=overHTML();
  else if(ph==='pre')todayCardEl.innerHTML=preHTML();
  else todayCardEl.innerHTML=`<div class="card"><div class="cardhead"><span class="cardtitle">Today</span></div>
      <div class="bwnote">Set the date your camp started and this becomes a live calendar: it will jump you to today's session and show what you still owe.</div></div>`;
}
/* Week tab landing: the first thing seen after a layoff or after the camp ends */
function lifeBannerHTML(){
  if(ONBOARD)return '';
  const ph=campPhase();
  if(ph==='pre'&&PRECAMP&&totDone()===0)return '<div class="wb"><div class="wbt">New camp</div><div class="bwline">Camp '+(CAMPS.length+1)+' opens '+shortDate(START)+'.</div>'+undoCampHTML()+'</div>';
  if(ph==='over'){
    if(lapsed())return welcomeHTML()+undoResumeHTML();
    const full=totDone()>=W.length*7;
    if(!FINISH)return `<div class="wb"><div class="wbt">${full?'Camp complete':'Camp ended'}</div><div class="bwline">${totDone()} of 70 logged.</div><div class="bwform">${abtn('closeout',full?'See your finale':'Close out camp','pri')}${abtn('gologtab','More options')}</div></div>`;
    return `<div class="wb"><div class="wbt">Camp finished</div><div class="bwline">${FINISH.tot} of 70 logged. What next?</div><div class="bwform">${abtn('runback','Run it back','pri')}${abtn('gologtab','Keep going')}${FINISH.full?'':abtn('reopen','Reopen camp')}</div></div>`;
  }
  if(ph==='live'&&lapsed())return welcomeHTML()+undoResumeHTML();
  if(RESUME&&RESUME.on===todayISO())return `<div class="wb">${undoResumeHTML()}</div>`;
  return '';
}
/* A makeup is the missed day trimmed to about two rounds plus its technique
   block: enough to bank the skill without wrecking tomorrow's real session. */
let MAKEUP=null;
function goMakeup(w,d){
  if(!guardSwitch(w,d))return;
  selectWeek(w);saveWeek(w);selectDay(d);
  const day=W[w].d[DK[d]];
  const keep=(DK[d]==='thu'||DK[d]==='sat')?3:2;
  if(day&&day.tm)CUT=Math.max(0,day.tm.rounds-keep);
  MAKEUP={w:w,d:d};
  render();setView('week');
}

/* ---- keeping going: sessions outside the 70 ---- */
const EX={t:'bag',m:30};
const EXTYPES=[['class','Class'],['bag','Bag'],['shadow','Shadow'],['run','Run'],['other','Other']];
function extraHTML(){
  const recent=EXTRA.slice(-4).map((x,i,a)=>({x:x,i:EXTRA.length-a.length+i})).reverse()
    .map(o=>`<button class="bwchip" data-act="extradel" data-i="${o.i}" type="button">${shortDate(o.x.d)} ${esc(o.x.t)} <b>${o.x.m}m</b></button>`).join('');
  return `<div class="card" id="extracard"><div class="cardhead"><span class="cardtitle">Log any session</span><span class="cardtag">${EXTRA.length} outside the camp</span></div>
    <div class="bwnote">Class, bag, a run, anything. It counts toward your lifetime total and never touches the 70.</div>
    <div class="bwchips">${EXTYPES.map(t=>`<button class="sw obchip${EX.t===t[0]?' on':''}" data-act="extratype" data-t="${t[0]}" type="button">${t[1]}</button>`).join('')}</div>
    <div class="bwform"><button class="cutbtn" data-act="extramin" data-d="-5" type="button">&minus;</button><span class="bwline" style="align-self:center;min-width:64px;text-align:center"><b>${EX.m}</b> min</span><button class="cutbtn" data-act="extramin" data-d="5" type="button">+</button>${abtn('extralog','Log it','pri')}</div>
    ${recent?`<div class="bwnote">Latest, tap one to remove it:</div><div class="bwchips">${recent}</div>`:''}</div>`;
}
function lifetimeSessions(){return totDone()+EXTRA.length+CAMPS.reduce((a,c)=>a+Object.keys(c.done||{}).length,0);}

/* ---- run it back: archive this camp, start the next ---- */
async function runItBack(){
  if(sessionRunning()&&typeof confirm==='function'&&!confirm('A session is running. End it and start a new camp?'))return false;
  const dt=document.getElementById('rbdate');
  const pick=(dt&&parseISO(dt.value))?isoOf(mondayOf(parseISO(dt.value))):nextMondayISO();
  const entry={n:CAMPS.length+1,start:START,ended:todayISO(),done:DONE,notes:NOTES,check:CHECKS,skip:SKIP,finish:FINISH};
  const nextCamps=CAMPS.concat([entry]);
  /* the archive is written first: if it cannot be saved, nothing is cleared */
  try{await storage.set('forge:camps',JSON.stringify(nextCamps));}
  catch(e){SAVEFAIL='Could not save to this browser, so the old camp was not archived and nothing was cleared.';try{paintTools();}catch(_){}return false;}
  PRECAMP={done:DONE,notes:NOTES,check:CHECKS,skip:SKIP,finish:FINISH,start:START,resume:RESUME,camps:CAMPS};
  CAMPS=nextCamps;
  DONE={};NOTES={};CHECKS={};SKIP={};FINISH=null;RESUME=null;START=pick;RB.open=false;
  saveDone();saveNotes();saveChecks();saveSkip();saveFinish();saveResume();saveStart();saveWeek(0);
  recomputeBagWeek();
  wIdx=0;dIdx=0;
  const slot=todaySlot();
  if(slot){wIdx=slot.w;dIdx=slot.d;}
  selectWeek(wIdx);selectDay(dIdx);paintDone();buildGrid();
  return true;
}
function undoCamp(){
  if(!PRECAMP||totDone()>0)return;
  const p=PRECAMP;PRECAMP=null;
  CAMPS=p.camps;DONE=p.done;NOTES=p.notes;CHECKS=p.check;SKIP=p.skip;FINISH=p.finish;START=p.start;RESUME=p.resume||null;
  saveCamps();saveDone();saveNotes();saveChecks();saveSkip();saveFinish();saveResume();saveStart();recomputeBagWeek();
  const slot=todaySlot();
  if(slot){wIdx=slot.w;dIdx=slot.d;}else{wIdx=Math.max(0,Math.min(W.length-1,wIdx));}
  selectWeek(wIdx);selectDay(dIdx);paintDone();buildGrid();
}

/* ---- the finale: the moment 70 sessions turn into something ---- */
function finaleSummary(f){return 'The Forge camp: '+f.tot+' of 70 sessions logged. Rank: '+rankOf(f.tot)+'. Ten weeks of solo striking.';}
function showFinale(){
  if(!FINISH){FINISH={on:todayISO(),tot:totDone(),full:totDone()>=W.length*7,tape:(CHECKS[W.length-1]||null)};saveFinish();}
  const el=finaleEl;
  if(!el)return;
  const f=FINISH;
  const tier=f.full?'All 70. Every one logged.':(f.tot>=42?'That is a real camp.':'They all count.');
  const held=(f.tape&&f.tape.length)?f.tape.filter(Boolean).length:null;
  const R=2*Math.PI*92,off=(R*(1-Math.max(0,Math.min(1,f.tot/(W.length*7))))).toFixed(1);
  el.innerHTML=sparksHTML(18)+`<div class="fin-in">
    <div class="fin-kick">THE FORGE &middot; ${f.on?shortDate(f.on).toUpperCase():''}</div>
    <div class="fin-ringwrap"><svg class="fin-ring" viewBox="0 0 200 200" aria-hidden="true"><circle class="rbg" cx="100" cy="100" r="92"></circle><circle class="fin-fg" cx="100" cy="100" r="92" transform="rotate(-90 100 100)" style="stroke-dasharray:${R.toFixed(1)};--fin-off:${off}"></circle></svg>
      <div class="fin-num"><b>${f.tot}</b><span>of 70 sessions</span></div></div>
    <div class="fin-tier">${tier}</div>
    ${rankEmblem(f.tot,true)}<div class="fin-rank">${rankOf(f.tot).toUpperCase()}</div>
    ${held!==null?`<div class="bwnote">Week 10 tape: held ${held} of 5 checkpoints.${held===5?' Book the trial class. You earned the right to be taught live.':''}</div>`:''}
    <div class="bwform fin-btns">${abtn('fightcard','Fight card')}${abtn('finalecopy','Copy my camp')}${abtn('finaleclose','Close','pri')}</div></div>`;
  el.classList.add('on');
  try{bell('done');saySeq([vrand(VP.done)],true);}catch(e){}
}
function closeFinale(){
  const el=finaleEl;
  if(el){el.classList.remove('on');el.innerHTML='';}
  paintDone();buildGrid();
}
async function copyFinale(btn){
  if(!FINISH)return;
  try{await navigator.clipboard.writeText(finaleSummary(FINISH));if(btn)btn.textContent='Copied';}
  catch(e){if(btn)btn.textContent='Could not copy';}
}

/* ending a live round before changing whose camp this is, or the old timer
   would carry on as a ghost inside the new fighter's world */
function endLiveSession(){stopTick();callerStop();vstop();mediaOff();loadTimer(DK[dIdx],W[wIdx].d[DK[dIdx]]);}
async function switchFighter(name){
  if(sessionRunning()){
    if(typeof confirm==='function'&&!confirm('A session is running. End it and switch fighters?'))return false;
    endLiveSession();
  }
  WHO=name;await saveWho();boot();return true;
}
/* one handler for every lifecycle button, so cards can re-render freely */
function lifeAct(a,b){
  const ds=b&&b.dataset?b.dataset:{};
  switch(a){
    case 'resume':doResume();break;
    case 'undoresume':undoResume();break;
    case 'closeout':
      if(!FINISH&&totDone()<W.length*7&&typeof confirm==='function'&&!confirm('Close out at '+totDone()+' of 70? That hides Pick up. You can reopen the camp afterwards.'))break;
      showFinale();break;
    case 'replay':showFinale();break;
    case 'reopen':FINISH=null;saveFinish();closeFinale();break;
    case 'finaleclose':closeFinale();break;
    case 'finalecopy':copyFinale(b);break;
    case 'runback':RB.open=true;buildGrid();setView('log');break;
    case 'runbackcancel':RB.open=false;buildGrid();break;
    case 'runbackgo':runItBack();break;
    case 'undocamp':undoCamp();break;
    case 'extratype':EX.t=ds.t||EX.t;paintTools();break;
    case 'extramin':EX.m=Math.max(5,Math.min(240,EX.m+(+ds.d||0)));paintTools();break;
    case 'extralog':EXTRA.push({d:todayISO(),t:EX.t,m:EX.m});saveExtra();buildGrid();break;
    case 'extradel':{const i=+ds.i;if(i>=0&&i<EXTRA.length&&!(typeof confirm==='function'&&!confirm('Remove this session?'))){EXTRA.splice(i,1);saveExtra();buildGrid();}break;}
    case 'extrascroll':{const c=document.getElementById('extracard');if(c&&c.scrollIntoView)c.scrollIntoView({behavior:'smooth',block:'start'});break;}
    case 'menu':{const w=+ds.w,d=+ds.d;if(!guardSwitch(w,d))break;selectWeek(w);saveWeek(w);selectDay(d);setView('week');break;}
    case 'makeup':goMakeup(+ds.w,+ds.d);break;
    case 'gotoday':{const s=todaySlot();if(!s||!guardSwitch(s.w,s.d))break;selectWeek(s.w);saveWeek(s.w);selectDay(s.d);setView('week');break;}
    case 'marktoday':{
      const s=todaySlot();
      if(s){const k=dkey(s.w,s.d);if(DONE[k]&&DONE[k]!==todayISO()){DONE[k]=todayISO();saveDone();paintDone();render();buildGrid();}else toggleDone(s.w,s.d);}
      break;
    }
    case 'trainnow':{const s=todaySlot();if(s){DONE[dkey(s.w,s.d)]=todayISO();saveDone();paintDone();render();buildGrid();}break;}
    case 'gologtab':setView('log');break;
    case 'herostart':{
      if(T&&T.state==='done')elReset.click();
      if(!(T&&T.segs&&T.running))elGo.click();
      setFocus(true);break;
    }
    case 'fightcard':openFightCard();break;
    case 'cardshare':shareFightCard();break;
    case 'cardclose':closeFightCard();break;
    case 'benchtype':CB.t=ds.t||CB.t;paintTools();break;
    case 'benchlog':{
      const el=document.getElementById('cbval');
      const v=parseFloat(ds.v!=null?ds.v:(el&&el.value!==''?el.value:CB.v));
      if(!isFinite(v)||v<=0||v>10000)break;
      BENCH.push({d:todayISO(),t:CB.t,v:Math.round(v*10)/10});CB.v='';saveBench();paintTools();break;
    }
    case 'benchdel':{const i=+ds.id;if(i>=0&&i<BENCH.length&&!(typeof confirm==='function'&&!confirm('Remove this result?'))){BENCH.splice(i,1);saveBench();paintTools();}break;}
    case 'backupnow':{const e=document.getElementById('expbtn');if(e)e.click();break;}
  }
}
document.addEventListener('click',e=>{
  const b=e.target&&e.target.closest?e.target.closest('[data-act]'):null;
  if(b)lifeAct(b.dataset.act,b);
});


/* ================= v24: the forge's own staging =================
   Everything below is drawn from data the app already keeps. Nothing here adds
   a server, a library or a file. */

/* rounds banked: every timed round actually worked, the number a fighter counts */
function roundsOf(w,d){const dy=W[w]&&W[w].d[DK[d]];return dy&&dy.tm?dy.tm.rounds:0;}
function roundsIn(doneMap){let n=0;Object.keys(doneMap||{}).forEach(k=>{const m=/^(\d+)-(\d+)$/.exec(k);if(m)n+=roundsOf(+m[1],+m[2]);});return n;}
function roundsBanked(){return roundsIn(DONE);}
function lifetimeRounds(){return roundsBanked()+CAMPS.reduce((a,c)=>a+roundsIn(c.done),0);}
function weekCount(w){let n=0;for(let d=0;d<7;d++)if(isDone(w,d))n++;return n;}
function weekRounds(w){let n=0;for(let d=0;d<7;d++)if(isDone(w,d))n+=roundsOf(w,d);return n;}

/* forge heat: how hot the last week has been, 0 to 1, drives the glow behind the title */
function heatOf(){
  const cut=new Date(noonToday());cut.setDate(cut.getDate()-6);
  const c=isoOf(cut),days=new Set();
  Object.keys(DONE).forEach(k=>{const v=DONE[k];if(typeof v==='string'&&v>=c)days.add(v);});
  return Math.min(1,days.size/6);
}
function paintHeat(){try{document.documentElement.style.setProperty('--heat',String(heatOf()));}catch(e){}}

/* rank as chevrons, one more for every step up the ladder */
function rankIdx(n){let r=0;RANKS.forEach((x,i)=>{if(n>=x[0])r=i;});return r;}
function rankEmblem(n,big){
  const idx=Math.min(rankIdx(n),6);
  if(!idx)return '';
  let p='';
  for(let i=0;i<idx;i++){const y=26-i*4;p+='<path d="M7 '+y+' L20 '+(y-8)+' L33 '+y+'"></path>';}
  return '<svg class="remblem'+(big?' big':'')+(rankIdx(n)>=7?' gold':'')+'" viewBox="0 -4 40 32" aria-hidden="true">'+p+'</svg>';
}

/* embers rising off a finished session: pure CSS, a dozen specks, gone under reduced motion */
function sparksHTML(n){
  let h='';
  for(let i=0;i<(n||14);i++){
    const x=(i*37+11)%100,d=(2.6+((i*53)%17)/10).toFixed(1),dl=(((i*29)%23)/10).toFixed(1),s=3+((i*7)%4),dx=(i%2?'-':'')+(6+(i%5)*5)+'px';
    h+='<i style="left:'+x+'%;--d:'+d+'s;--dl:'+dl+'s;--s:'+s+'px;--dx:'+dx+'"></i>';
  }
  return '<div class="sparks" aria-hidden="true">'+h+'</div>';
}

/* one line from the corner, steady for the day so it does not flicker between visits */
const CORNERLINES={
 mon:['Kicks are loud. Land every one balanced and quiet.','Turn the hip over and the leg takes care of itself.','The base foot decides everything. Plant it, then throw.'],
 tue:['A combo is a sentence. Finish it somewhere new.','Hands lead, legs carry. Stay long and loose.','Chain it. Do not stop between punches to think.'],
 wed:['Boxing is angles. Hit, then be gone.','Light feet tonight. The heavy work is already done.','Retract faster than you throw.'],
 thu:['The hard one. Breathe through the nose whenever you can.','Pace is a skill. Earn it round by round.','Slow down before you get ugly.'],
 fri:['Defense is a counter in disguise.','Small slips. A big lean is just a slow miss.','Make them miss, then make them pay.'],
 sat:['Hands only. Chin down, elbows in, breathe out.','Day six. Show up honest and finish clean.','The last round should look like the first.'],
 sun:['Restore day. Slow is the whole job.','Film it, watch it, say one thing out loud.','Mobility is what keeps next week possible.']
};
function cornerOfDay(){
  const a=CORNERLINES[DK[dIdx]]||CORNERLINES.mon;
  return a[Math.floor(noonToday().getTime()/86400000)%a.length];
}

/* tale of the tape: this week against last, fight-promo style */
function taleHTML(){
  const slot=todaySlot();
  if(!slot||ONBOARD)return '';
  const a=slot.w,b=slot.w-1;
  const A={s:weekCount(a),r:weekRounds(a)},B=b>=0?{s:weekCount(b),r:weekRounds(b)}:null;
  if(!A.s&&!(B&&B.s))return '';
  const tape=w=>{const c=CHECKS[w];return c?c.filter(Boolean).length:null;};
  const row=(label,x,y,f)=>{
    const xs=x==null?'&middot;':(f?f(x):x),ys=y==null?'&middot;':(f?f(y):y);
    const both=x!=null&&y!=null;
    return '<div class="tt"><div class="tl'+(both&&x>y?' win':'')+'">'+xs+'</div><div class="tm">'+label+'</div><div class="tr'+(both&&y>x?' win':'')+'">'+ys+'</div></div>';
  };
  return '<div class="card tale"><div class="cardhead"><span class="cardtitle">Tale of the tape</span><span class="cardtag">WEEK '+(a+1)+(b>=0?' VS WEEK '+(b+1):'')+'</span></div>'+
    '<div class="tt tth"><div class="tl">THIS WEEK</div><div class="tm"></div><div class="tr">LAST WEEK</div></div>'+
    row('SESSIONS',A.s,B?B.s:null)+row('ROUNDS',A.r,B?B.r:null)+row('TAPE',tape(a),b>=0?tape(b):null,v=>v+'/5')+'</div>';
}

/* the Combine: three tests you can repeat, so progress is a number and not a feeling */
let BENCH=[];
const BTESTS=[['punch','Punch-out 30s'],['teep','Clean teeps 60s'],['plank','Plank hold']];
const BUNIT={punch:'punches',teep:'teeps',plank:'seconds'};
const CB={t:'punch',v:''};
function benchRows(t){return BENCH.filter(x=>x.t===t).sort((x,y)=>x.d<y.d?-1:(x.d>y.d?1:0));}
function benchSpark(rows){
  if(rows.length<2)return '';
  const pts=rows.slice(-12),WW=300,HH=60,pad=6;
  const vs=pts.map(p=>p.v),mn=Math.min.apply(null,vs),mx=Math.max.apply(null,vs);
  const X=i=>pad+(WW-2*pad)*i/(pts.length-1),Y=v=>HH-pad-(HH-2*pad)*(v-mn)/((mx-mn)||1);
  let line='';pts.forEach((p,i)=>{line+=(i?'L':'M')+X(i).toFixed(1)+' '+Y(p.v).toFixed(1);});
  const dots=pts.map((p,i)=>'<circle cx="'+X(i).toFixed(1)+'" cy="'+Y(p.v).toFixed(1)+'" r="2.2" class="bwdot"></circle>').join('');
  return '<svg class="bwchart cbspark" viewBox="0 0 '+WW+' '+HH+'" preserveAspectRatio="none" aria-hidden="true"><path d="'+line+'" class="bwpath"></path>'+dots+'</svg>';
}
function benchHTML(){
  const rows=benchRows(CB.t);
  const best=rows.reduce((m,x)=>Math.max(m,x.v),0);
  const last=rows.length?rows[rows.length-1].v:null,first=rows.length?rows[0].v:null;
  const delta=(last!=null&&rows.length>1)?Math.round((last-first)*10)/10:null;
  const recent=rows.slice(-4).reverse().map(x=>'<button class="bwchip" data-act="benchdel" data-id="'+BENCH.indexOf(x)+'" type="button">'+shortDate(x.d)+' <b>'+x.v+'</b></button>').join('');
  return '<div class="card" id="benchcard"><div class="cardhead"><span class="cardtitle">The Combine</span><span class="cardtag">'+rows.length+' logged</span></div>'+
    '<div class="bwnote">Three tests you can repeat. Run them in weeks 1, 5 and 10, same time of day, and watch the number climb.</div>'+
    '<div class="bwchips">'+BTESTS.map(t=>'<button class="sw obchip'+(CB.t===t[0]?' on':'')+'" data-act="benchtype" data-t="'+t[0]+'" type="button">'+t[1]+'</button>').join('')+'</div>'+
    (last!=null?'<div class="bwrow"><div class="bwbig">'+last+'<span class="bwunit">'+BUNIT[CB.t]+' last</span></div><div class="bwside"><div class="bwline">Best <b>'+best+'</b></div>'+(delta!=null?'<div class="bwline">Since the first <b style="color:var('+(delta>=0?'--restore':'--ember')+')">'+(delta>0?'+':'')+delta+'</b></div>':'')+'</div></div>':'')+
    benchSpark(rows)+
    '<div class="bwform"><input class="srch bwinput" id="cbval" type="number" inputmode="numeric" placeholder="'+BUNIT[CB.t]+'"><button class="sw pri" data-act="benchlog" type="button">Log it</button></div>'+
    (recent?'<div class="bwnote">Latest, tap one to remove it:</div><div class="bwchips">'+recent+'</div>':'')+'</div>';
}
function saveBench(){return saveKey('forge:bench',JSON.stringify(BENCH));}

/* the fight card: a poster of your camp, drawn on a canvas, shared as a picture */
const PHEX=['#6FA8C7','#6FA8C7','#8B9DC9','#8B9DC9','#9B8AC4','#9B8AC4','#EA8C3A','#EA8C3A','#D9A441','#D9A441'];
function cardStats(){
  const tot=totDone(),bws=bwSorted();
  const wd=bws.length>1?(bwAvg(bws[bws.length-1].d,7)-bws[0].w):null;
  const cells=[];
  for(let w=0;w<10;w++)for(let d=0;d<7;d++)cells.push(isDone(w,d)?1:0);
  const weeks=Array.from({length:10},(_,w)=>weekCount(w)>0?1:0).reduce((a,b)=>a+b,0);
  return {name:WHO||'Jackson',tot:tot,rank:rankOf(tot),rankIdx:rankIdx(tot),rounds:lifetimeRounds(),streak:streak(),
    day:Math.min(70,Math.max(0,campDayCount())),phase:campPhase(),cells:cells,wd:wd,weeks:weeks,camp:CAMPS.length+1,date:todayISO()};
}
function fitText(ctx,txt,maxW,start,fontFn){let s=start;ctx.font=fontFn(s);while(ctx.measureText(txt).width>maxW&&s>40){s-=6;ctx.font=fontFn(s);}return s;}
function spaced(ctx,txt,x,y,sp,align){
  const ch=String(txt).split('');let w=0;
  ch.forEach(c=>{w+=ctx.measureText(c).width+sp;});w-=sp;
  let cx=align==='center'?x-w/2:(align==='right'?x-w:x);
  ch.forEach(c=>{ctx.fillText(c,cx,y);cx+=ctx.measureText(c).width+sp;});
}
function drawFightCard(cv,s){
  const ctx=cv&&cv.getContext?cv.getContext('2d'):null;
  if(!ctx)return false;
  const Wd=1080,Ht=1920;
  cv.width=Wd;cv.height=Ht;
  const OSW=px=>'700 '+px+'px Oswald, Impact, sans-serif',MONO=px=>'500 '+px+'px "JetBrains Mono", Menlo, monospace';
  let g=ctx.createLinearGradient(0,0,0,Ht);g.addColorStop(0,'#0F1319');g.addColorStop(1,'#1d140b');ctx.fillStyle=g;ctx.fillRect(0,0,Wd,Ht);
  g=ctx.createRadialGradient(920,220,10,920,220,780);g.addColorStop(0,'rgba(234,140,58,0.38)');g.addColorStop(1,'rgba(234,140,58,0)');ctx.fillStyle=g;ctx.fillRect(0,0,Wd,Ht);
  ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=2;
  for(let x=-Ht;x<Wd;x+=52){ctx.beginPath();ctx.moveTo(x,Ht);ctx.lineTo(x+Ht,0);ctx.stroke();}
  ctx.strokeStyle='rgba(234,140,58,0.6)';ctx.lineWidth=4;ctx.strokeRect(40,40,Wd-80,Ht-80);
  ctx.textBaseline='alphabetic';ctx.textAlign='left';
  ctx.fillStyle='#EA8C3A';ctx.font=MONO(32);spaced(ctx,'THE FORGE  /  FIGHT CARD'+(s.camp>1?'  /  CAMP '+s.camp:''),90,150,9,'left');
  const nm=String(s.name).toUpperCase();
  const sz=fitText(ctx,nm,Wd-180,200,OSW);
  ctx.fillStyle='#ECE6DA';ctx.fillText(nm,90,150+sz+14);
  const rule=150+sz+54;
  ctx.fillStyle='#EA8C3A';ctx.fillRect(90,rule,220,8);
  ctx.fillStyle='#8A94A3';ctx.font=MONO(34);spaced(ctx,'RECORD',90,rule+110,12,'left');
  const rec=s.tot+'-0';
  const rs=fitText(ctx,rec,Wd-180,360,OSW);
  ctx.fillStyle='#ECE6DA';ctx.fillText(rec,86,rule+110+rs);
  const ry=rule+110+rs+110;
  ctx.fillStyle='#EA8C3A';ctx.font=OSW(84);
  const rn=s.rank.toUpperCase();
  const ex=90;
  let off=0;
  if(s.rankIdx>0){
    ctx.strokeStyle=s.rankIdx>=7?'#D9A441':'#EA8C3A';ctx.lineWidth=9;ctx.lineCap='round';ctx.lineJoin='round';
    for(let i=0;i<Math.min(s.rankIdx,6);i++){const y=ry-18-i*18;ctx.beginPath();ctx.moveTo(ex+4,y);ctx.lineTo(ex+44,y-26);ctx.lineTo(ex+84,y);ctx.stroke();}
    off=120;
  }
  ctx.fillStyle='#EA8C3A';ctx.font=OSW(84);ctx.fillText(rn,ex+off,ry);
  ctx.fillStyle='#8A94A3';ctx.font=MONO(32);
  const status=s.phase==='live'?'CAMP DAY '+s.day+' OF 70':(s.phase==='over'?(s.tot>=70?'CAMP COMPLETE':'CAMP ENDED'):(s.phase==='pre'?'CAMP STARTS '+shortDate(START).toUpperCase():'NEW CAMP'));
  spaced(ctx,status,90,ry+64,8,'left');
  // four numbers
  const sy=ry+190;
  const wdTxt=s.wd==null?s.weeks+'/10':((s.wd>0?'+':'')+s.wd.toFixed(1));
  const stats=[[String(s.rounds),'ROUNDS'],[String(s.streak),'STREAK'],[String(s.tot),'SESSIONS'],[wdTxt,s.wd==null?'WEEKS':'LB']];
  const colW=(Wd-180)/4;
  stats.forEach((st,i)=>{
    const cx=90+colW*i+colW/2;
    ctx.textAlign='center';ctx.fillStyle='#ECE6DA';ctx.font=OSW(86);ctx.fillText(st[0],cx,sy);
    ctx.fillStyle='#8A94A3';ctx.font=MONO(26);spaced(ctx,st[1],cx,sy+48,8,'center');
  });
  ctx.textAlign='left';
  // the camp itself: ten weeks across, seven days down, in phase colour
  const cell=46,gap=8,gw=10*cell+9*gap,gx=(Wd-gw)/2,gy=sy+120;
  for(let w=0;w<10;w++)for(let d=0;d<7;d++){
    ctx.fillStyle=s.cells[w*7+d]?PHEX[w]:'#2A323D';
    ctx.fillRect(gx+w*(cell+gap),gy+d*(cell+gap),cell,cell);
  }
  ctx.fillStyle='#8A94A3';ctx.font=MONO(26);spaced(ctx,'TEN WEEKS, SEVEN DAYS EACH',Wd/2,gy+7*(cell+gap)+30,6,'center');
  ctx.fillStyle='#8A94A3';ctx.font=MONO(28);ctx.textAlign='left';ctx.fillText(s.date,90,Ht-96);
  ctx.textAlign='right';ctx.fillText('jacksonvarela1.github.io/forge',Wd-90,Ht-96);
  ctx.textAlign='left';
  return true;
}
let CARDURL='';
async function openFightCard(){
  if(!cardviewEl)return false;
  const cv=document.createElement('canvas');
  try{await document.fonts.load('700 100px Oswald');await document.fonts.load('500 30px "JetBrains Mono"');}catch(e){}
  if(!drawFightCard(cv,cardStats()))return false;
  let url='';
  try{url=cv.toDataURL('image/png');}catch(e){return false;}
  CARDURL=url;
  cardviewEl.innerHTML='<div class="cv-in"><img class="cv-img" src="'+url+'" alt="Your Forge fight card"><div class="bwform cv-btns">'+abtn('cardshare','Share','pri')+abtn('cardclose','Close')+'</div><div class="bwnote">Or press and hold the picture to save it.</div></div>';
  cardviewEl.classList.add('on');
  return true;
}
function closeFightCard(){if(cardviewEl){cardviewEl.classList.remove('on');cardviewEl.innerHTML='';}CARDURL='';}
async function shareFightCard(){
  if(!CARDURL)return false;
  try{
    const blob=await (await fetch(CARDURL)).blob();
    const file=new File([blob],'forge-fight-card.png',{type:'image/png'});
    if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:'My Forge fight card'});return true;}
    /* an installed iPhone web app must never navigate away to a download */
    if(navigator.standalone){const n=cardviewEl&&cardviewEl.querySelector?cardviewEl.querySelector('.bwnote'):null;if(n)n.textContent='Sharing is not available here. Press and hold the picture to save it.';return false;}
    const a=document.createElement('a');a.href=CARDURL;a.download='forge-fight-card.png';document.body.appendChild(a);a.click();a.remove();
    return true;
  }catch(e){
    if(e&&e.name!=='AbortError'){const n=cardviewEl&&cardviewEl.querySelector?cardviewEl.querySelector('.bwnote'):null;if(n)n.textContent='Could not open the share sheet. Press and hold the picture to save it.';}
    return false;
  }
}

/* ---- backup ----
   There is no account and no server. Months of training live in one browser
   profile, so an export that survives a cleared cache is not optional. */
function paintTools(){
  if(!logToolsEl)return;
  /* the fighter card: who this camp belongs to, what they own, who else
     trains on this phone */
  const eqChip=(id,label,on)=>`<button class="sw obchip${on?' on':''}" data-eq="${id}" type="button">${on?'&#9679;':'&#9675;'} ${label}</button>`;
  const others=NAMES.filter(n=>slugOf(n)!==slugOf(WHO||'jackson'));
  const fighter=`<div class="card"><div class="cardhead"><span class="cardtitle">Fighter</span><span class="cardtag">${esc((WHO||'Jackson').toUpperCase())}</span></div>
    ${GOALS?`<div class="bwline">Here to <b>${esc(GOALS)}</b>.</div>`:''}
    <div class="bwnote">Gear on hand. The program adapts around whatever is tapped on. Real bell swaps the round beeps for a struck bell and a wood clack.</div>
    <div class="bwchips">${eqChip('gl','Gloves',GLOVES_ON)}${eqChip('wr','Wraps',WRAPS_ON)}${eqChip('bag','Bag',BAG_ON)}${eqChip('p','Partner',PARTNER_ON)}${eqChip('snd','Real bell',SND==='bell')}</div>
    ${others.length?`<div class="bwnote">Also training on this phone:</div><div class="bwchips">${others.map(n=>`<button class="bwchip" data-who="${esc(n)}" type="button">${esc(n)}</button>`).join('')}</div>`:''}
    <div class="bwform">${abtn('fightcard','Make my fight card','pri')}<button class="sw" id="addfighter" type="button">Add a fighter</button></div></div>`;
  logToolsEl.innerHTML=benchHTML()+extraHTML()+fighter+`<div class="card"><div class="cardhead"><span class="cardtitle">Camp start and backup</span></div>
    <div class="bwline">Camp week 1 started Monday <b>${START||'not set'}</b>. Change it if that is wrong and every week renumbers.</div>
    <div class="bwform"><input class="srch bwinput" id="startval" type="date" value="${START||''}"><button class="sw" id="startset" type="button">Set</button></div>
    <div class="bwnote">Your log lives only in this browser. Back it up now and again, and before you ever clear your history or switch phones. Last backup: ${BK?shortDate(BK):'never'}.</div>
    <div class="bwform"><button class="sw" id="expbtn" type="button">Copy backup</button><button class="sw" id="impbtn" type="button">Restore</button>${PRERESTORE?'<button class="sw" id="undobtn" type="button">Undo restore</button>':''}</div>
    ${SAVEFAIL?`<div class="bwnote" style="color:var(--ember)">${SAVEFAIL}</div>`:''}
    <div id="iomsg" class="bwnote"></div>
    <div class="bwform"><button class="sw" id="updchk" type="button">Check for update</button><button class="sw" id="repairbtn" type="button">Repair app</button></div>
    <div class="bwnote" id="updmsg">Build ${BUILD}. Repair reloads the app fresh and never touches your log.</div></div>`;
  const msg=t=>{const e=document.getElementById('iomsg');if(e)e.textContent=t;};
  const cvi=document.getElementById('cbval');
  if(cvi){cvi.value=CB.v;cvi.addEventListener('input',()=>{CB.v=cvi.value;});}
  const um=t=>{const e=document.getElementById('updmsg');if(e)e.textContent=t;};
  const uc=document.getElementById('updchk');
  if(uc)uc.addEventListener('click',async()=>{
    um('Checking...');
    await checkUpdate(true);
    um(updateReady()?'A new build is ready. Tap Update on the bar at the bottom.':'You are on the newest build ('+BUILD+').');
  });
  const rp=document.getElementById('repairbtn');
  if(rp)rp.addEventListener('click',()=>{
    if(typeof confirm==='function'&&!confirm('Reload the app from scratch? It needs internet. Your log and settings are not touched.'))return;
    repairApp();
  });
  /* fighter card wiring: gear toggles write straight to opts, name chips
     switch the whole app to that fighter's world, add opens onboarding */
  logToolsEl.querySelectorAll('.obchip[data-eq]').forEach(c=>c.addEventListener('click',()=>{
    const id=c.dataset.eq;
    if(id==='gl')GLOVES_ON=!GLOVES_ON;
    if(id==='wr')WRAPS_ON=!WRAPS_ON;
    if(id==='bag')BAG_ON=!BAG_ON;
    if(id==='p')PARTNER_ON=!PARTNER_ON;
    if(id==='snd')SND=SND==='bell'?'classic':'bell';
    saveOpts();render();buildGrid();
  }));
  logToolsEl.querySelectorAll('.bwchip[data-who]').forEach(c=>c.addEventListener('click',()=>switchFighter(c.dataset.who)));
  const af=document.getElementById('addfighter');
  if(af)af.addEventListener('click',()=>{
    if(sessionRunning()){
      if(typeof confirm==='function'&&!confirm('A session is running. End it and add a fighter?'))return;
      endLiveSession();
    }
    ONBOARD=true;
    OB_STATE.name='';
    paintOnboard();setView('week');
    try{window.scrollTo(0,0);}catch(e){}
  });
  const sv=document.getElementById('startset');
  if(sv)sv.addEventListener('click',()=>{
    const v=document.getElementById('startval');
    const d=parseISO(v&&v.value);
    if(!d)return msg('That date did not read right.');
    START=isoOf(mondayOf(d));saveStart();recomputeBagWeek();
    {const ns=todaySlot();if(ns){wIdx=ns.w;dIdx=ns.d;}}
    selectWeek(wIdx);selectDay(dIdx);paintDone();buildGrid();
    msg('Camp week 1 now starts '+START+'.');
  });
  const ex=document.getElementById('expbtn');
  if(ex)ex.addEventListener('click',async()=>{
    const dump=JSON.stringify({v:1,done:DONE,bw:BW,notes:NOTES,check:CHECKS,start:START,iq:IQ,week:wIdx,skip:SKIP,extra:EXTRA,camps:CAMPS,finish:FINISH,bench:BENCH,opts:{v:VOICE_ON,c:CALLER_ON,bag:BAG_ON,p:PARTNER_ON,gl:GLOVES_ON,wr:WRAPS_ON,goals:GOALS,snd:SND}});
    try{await navigator.clipboard.writeText(dump);BK=todayISO();saveBk();paintToday();msg('Backup copied. Paste it somewhere safe: a note to yourself, an email, anywhere.');}
    catch(e){
      const ta=document.createElement('textarea');ta.className='srch';ta.rows=4;ta.value=dump;
      logToolsEl.appendChild(ta);ta.select();msg('Could not reach the clipboard. Select the text above and copy it by hand.');
    }
  });
  const un=document.getElementById('undobtn');
  if(un)un.addEventListener('click',()=>{
    if(!PRERESTORE)return;
    DONE=PRERESTORE.done;BW=PRERESTORE.bw;NOTES=PRERESTORE.notes;CHECKS=PRERESTORE.check||{};START=PRERESTORE.start;IQ=PRERESTORE.iq;
    SKIP=PRERESTORE.skip||{};EXTRA=PRERESTORE.extra||[];CAMPS=PRERESTORE.camps||[];FINISH=PRERESTORE.finish||null;BENCH=PRERESTORE.bench||[];RESUME=PRERESTORE.resume||null;
    PRERESTORE=null;
    saveDone();saveBW();saveNotes();saveChecks();saveStart();saveIQ();saveSkip();saveExtra();saveCamps();saveFinish();saveBench();saveResume();
    paintDone();buildGrid();paintToday();paintWeight();paintIQ();render();
    const e=document.getElementById('iomsg');if(e)e.textContent='Put back the way it was before the restore.';
  });
  const im=document.getElementById('impbtn');
  if(im)im.addEventListener('click',()=>{
    const ta=document.createElement('textarea');ta.className='srch';ta.rows=4;ta.placeholder='paste your backup here, then hit Restore again';
    ta.id='impbox';
    const existing=document.getElementById('impbox');
    if(!existing){logToolsEl.appendChild(ta);msg('Paste the backup above, then hit Restore again.');return;}
    try{
      const o=JSON.parse(existing.value);
      if(!o||typeof o!=='object')throw 0;
      /* snapshot first: restoring an older backup over a newer log is the one
         way this screen can destroy training history */
      PRERESTORE={done:JSON.parse(JSON.stringify(DONE)),bw:BW.slice(),notes:JSON.parse(JSON.stringify(NOTES)),check:JSON.parse(JSON.stringify(CHECKS)),start:START,iq:JSON.parse(JSON.stringify(IQ)),skip:JSON.parse(JSON.stringify(SKIP)),extra:EXTRA.slice(),camps:JSON.parse(JSON.stringify(CAMPS)),finish:FINISH,bench:BENCH.slice(),resume:RESUME?JSON.parse(JSON.stringify(RESUME)):null};
      const startB4=START,skipB4=JSON.stringify(SKIP);
      if(o.done&&typeof o.done==='object')DONE=o.done;
      if(Array.isArray(o.bw))BW=o.bw.filter(x=>x&&x.d&&isFinite(x.w));
      if(o.notes&&typeof o.notes==='object')NOTES=o.notes;
      if(o.check&&typeof o.check==='object')CHECKS=o.check;
      if(typeof o.start==='string'&&parseISO(o.start))START=o.start;
      if(o.iq&&typeof o.iq.r==='number')IQ=o.iq;
      if(o.skip&&typeof o.skip==='object'&&!Array.isArray(o.skip))SKIP=o.skip;
      if(Array.isArray(o.extra))EXTRA=o.extra.filter(y=>y&&y.d&&isFinite(y.m));
      if(Array.isArray(o.camps))CAMPS=o.camps.filter(y=>y&&typeof y==='object');
      if(o.done&&typeof o.done==='object')FINISH=(o.finish&&typeof o.finish==='object')?o.finish:null;
      if(Array.isArray(o.bench))BENCH=o.bench.filter(y=>y&&y.d&&y.t&&isFinite(y.v));
      if(o.opts&&typeof o.opts==='object'){const p=o.opts;VOICE_ON=p.v!==false;CALLER_ON=p.c!==false;BAG_ON=p.bag!==false;PARTNER_ON=p.p===true;GLOVES_ON=p.gl!==false;WRAPS_ON=p.wr!==false;if(typeof p.goals==='string')GOALS=p.goals;SND=p.snd==='classic'?'classic':'bell';saveOpts();}
      if(START!==startB4||JSON.stringify(SKIP)!==skipB4)RESUME=null;
      recomputeBagWeek();
      saveDone();saveBW();saveNotes();saveChecks();saveStart();saveIQ();saveSkip();saveExtra();saveCamps();saveFinish();saveBench();saveResume();
      existing.remove();
      paintDone();buildGrid();paintToday();paintWeight();paintIQ();render();
      msg('Restored. '+Object.keys(DONE).length+' sessions and '+BW.length+' weigh-ins are back. What was here before this restore is saved under Undo below, until you close the app.');
    }catch(e){msg('That did not parse as a backup. Paste the whole thing, including the braces.');}
  });
}
function buildGrid(){
  if(!gridEl)return;
  const slot=todaySlot();
  let h=`<div class="ghead"><span class="gwn"></span>${DK.map(k=>`<span class="ghd">${DAYMETA[k].abbr[0]}</span>`).join('')}</div>`;
  W.forEach((w,i)=>{
    if(i===0||W[i-1].phase!==w.phase)h+=`<div class="gphl" style="color:var(${PCOL[i]})">${esc(String(w.phase).toUpperCase())}</div>`;
    h+=`<div class="grow"><span class="gwn">W${w.n}</span>`;
    for(let d=0;d<7;d++){
      const on=isDone(i,d)?' on':'';
      /* today gets the ring; anything before today that is still empty reads as owed */
      const isToday=slot&&i===slot.w&&d===slot.d;
      const past=slot&&(i<slot.w||(i===slot.w&&d<slot.d));
      const cls=isToday?' today':(on?'':(isSkipped(i,d)?' skip':(past?' owed':'')));
      const note=NOTES[dkey(i,d)]?' noted':'';
      h+=`<button class="gcell${on}${cls}${note}" data-w="${i}" data-d="${d}" aria-label="Week ${w.n} ${DAYMETA[DK[d]].abbr}, ${on?'done':(cls.indexOf('skip')>=0?'let go':(cls.indexOf('owed')>=0?'owed':'not done'))}"></button>`;
    }
    h+='</div>';
  });
  gridEl.innerHTML=h;
  const tot=totDone();
  const eg=document.getElementById('logempty');
  if(eg)eg.style.display=tot?'none':'';
  /* this week's completion, which is the number that actually moves week to week */
  let wkDone=0,wkOf=7;
  if(slot){for(let d=0;d<7;d++)if(isDone(slot.w,d))wkDone++;}
  const over=campPhase()==='over';
  statsEl.innerHTML=`<div class="stat"><div class="sv">${tot}-0</div><div class="sl">record</div></div>
   <div class="stat"><div class="sv">${slot?wkDone+'/'+wkOf:(over?tot+'/70':streak())}</div><div class="sl">${slot?'this week':(over?'camp':'day streak')}</div></div>
   <div class="stat"><div class="sv rk">${rankEmblem(tot)}${rankOf(tot)}</div><div class="sl">rank</div></div>
   <div class="stat"><div class="sv">${lifetimeRounds()}</div><div class="sl">rounds</div></div>`;
  /* rank as a ladder you can see yourself climbing, not a static word */
  const next=RANKS.find(r=>r[0]>tot);
  const prev=RANKS.filter(r=>r[0]<=tot).slice(-1)[0]||RANKS[0];
  const span=next?next[0]-prev[0]:1;
  const into=next?tot-prev[0]:1;
  statsEl.innerHTML+=`<div class="rankstrip"><div class="rstrack"><div class="rsfill" style="width:${next?Math.round(100*into/span):100}%"></div></div><div class="rslabel">${next?`${next[0]-tot} session${next[0]-tot>1?'s':''} to ${next[1].toUpperCase()}`:'CAMP DONE'}${(EXTRA.length||CAMPS.length)?` &middot; ${lifetimeSessions()} LIFETIME`:''}</div></div>`;
  paintToday();paintWeight();paintTools();
}
if(gridEl)gridEl.addEventListener('click',e=>{const c=e.target.closest('.gcell');if(!c)return;toggleDone(+c.dataset.w,+c.dataset.d);});

/* ---- moves ---- */
const catbarEl=document.getElementById('catbar'),movesEl=document.getElementById('moves');
CATS.forEach((c,i)=>{
 const chip=document.createElement('button');chip.className='catchip'+(i===0?' active':'');chip.textContent=c.cat;
 chip.addEventListener('click',()=>{document.querySelectorAll('.catchip').forEach(x=>x.classList.remove('active'));chip.classList.add('active');
  document.getElementById('sec-'+i).scrollIntoView({behavior:'smooth',block:'start'});});
 catbarEl.appendChild(chip);
 const sec=document.createElement('div');sec.className='msection';sec.id='sec-'+i;
 let h=`<div class="mshead">${c.cat}</div>`;
 if(c.numbox)h+=`<div class="numbox">${c.numbox}</div>`;
 c.moves.forEach(mv=>{
  const wk=MOVEWEEK[mv.name];
  h+=`<div class="move"><div class="mtop"><span class="mname">${mv.name}</span>${wk!==undefined?`<span class="mwk">WK ${wk+1}</span>`:''}<span class="mtag">${mv.tag}</span></div>
      <ul>${mv.steps.map(s=>`<li>${s}</li>`).join('')}</ul>
      <div class="mcue"><b>CUE:</b> ${mv.cue}</div>
      <div class="mvid"><b>VIDEO:</b> <a class="glink" href="${vidHref(mv.vid)}" target="_blank" rel="noopener">${mv.vid}</a></div></div>`;});
 sec.innerHTML=h;movesEl.appendChild(sec);
});

/* ---- fight IQ ---- */
const cardEl=document.getElementById('card'),iqstatsEl=document.getElementById('iqstats');
let IQ={r:0,w:0},qcur=null,qrev=false;
const FLAT=[];CATS.forEach(c=>c.moves.forEach(m=>FLAT.push({m,cat:c.cat})));
function qpool(){
  const p=FLAT.filter(x=>{const w=MOVEWEEK[x.m.name];return w===undefined?false:w<=wIdx;});
  return p.length?p:FLAT;
}
function qpick(){const P=qpool();let n=P[Math.floor(Math.random()*P.length)];if(qcur&&P.length>1&&n.m.name===qcur.m.name)return qpick();return n;}
function qnext(){qcur=qpick();qrev=false;paintCard();}
function paintCard(){
  if(!cardEl)return;
  if(!qcur){qcur=qpick();}
  const m=qcur.m;
  const ans=qrev?`<div class="qans"><ul>${m.steps.map(x=>`<li>${x}</li>`).join('')}</ul><div class="qcue"><b>FIX:</b> ${m.cue}</div></div>
    <div class="qbtns"><button class="qbtn bad" id="qbad" type="button">Missed it</button><button class="qbtn good" id="qgood" type="button">Knew it</button></div>`
   :`<div class="qbtns"><button class="qbtn rev" id="qrev" type="button">Reveal</button></div>`;
  cardEl.innerHTML=`<div class="qcard"><div class="qcat">${qcur.cat}</div><div class="qname">${m.name}</div><div class="qtag">${m.tag}</div><div class="qask">What is the one fix?</div>${qrev?'':''}</div>${ans}`;
  const rv=document.getElementById('qrev');if(rv)rv.addEventListener('click',()=>{qrev=true;paintCard();});
  const gd=document.getElementById('qgood');if(gd)gd.addEventListener('click',()=>{IQ.r++;saveIQ();paintIQ();qnext();});
  const bd=document.getElementById('qbad');if(bd)bd.addEventListener('click',()=>{IQ.w++;saveIQ();paintIQ();qnext();});
  paintIQ();
}
function paintIQ(){
  if(!iqstatsEl)return;
  const t=IQ.r+IQ.w,pct=t?Math.round(100*IQ.r/t):0;
  iqstatsEl.innerHTML=`<div class="stat"><div class="sv">${IQ.r}</div><div class="sl">knew it</div></div>
   <div class="stat"><div class="sv">${IQ.w}</div><div class="sl">missed</div></div>
   <div class="stat"><div class="sv">${pct}%</div><div class="sl">fight iq</div></div>`;
  const iq=document.getElementById('iqnote');
  if(iq)iq.textContent='Drawing from your week 1 to '+W[wIdx].n+' vocabulary. '+qpool().length+' moves in the deck. Think of the fix, reveal, grade yourself honestly.';
}

/* ---- search ---- */
const srch=document.getElementById('srch');
if(srch)srch.placeholder='Search '+FLAT.length+' moves. Try check hook, teep, wrap...';
if(srch)srch.addEventListener('input',()=>{
  const q=srch.value.trim().toLowerCase();
  let anyHit=0;
  document.querySelectorAll('#moves .msection').forEach(sec=>{
    let vis=0;
    sec.querySelectorAll('.move').forEach(mv=>{
      const hit=!q||mv.textContent.toLowerCase().includes(q);
      mv.classList.toggle('hide',!hit);if(hit)vis++;
    });
    anyHit+=vis;
    sec.classList.toggle('hide',q&&!vis);
  });
  const nm=document.getElementById('nomoves');
  if(nm)nm.style.display=(q&&!anyHit)?'':'none';
});

/* ---- voice engine ---- */
const NAME='Jackson';
const VP={
 open:['Alright','Here we go','Let us go','Time to work','Okay'],
 begin:['Let us go.','Here we go.','Time to work.','Get after it.','Go to work.'],
 push:['Go.','Up.','Now.','Move.','Let us go.','On it.'],
 praise:['That is it.','Nice.','Good.','Beautiful.','Yes.','Sharp.','There it is.','Clean.','Keep going.','Love that.'],
 mid:['Halfway. Stay sharp.','Halfway there. Breathe.'],
 thirty:['Thirty seconds. Keep it clean.','Thirty left. Hands up.','Thirty. Stay long.'],
 ten:['Ten seconds. Finish strong.','Ten. Empty it out.','Last ten. Dig in.','Ten seconds. Do not coast.','Ten. Give me everything.'],
 tenlast:['Last ten of the session. Empty the tank.','Ten seconds left. Leave nothing.','Last ten. Finish it.'],
 rest:['Nice work. Breathe.','Good round. Breathe it down.','That is a round. Shake it out.','Good work. Reset.','Nice. Get your air back.','That is the way. Breathe.'],
 lastwork:['Last round. Leave nothing.','Final round. Everything you have.','Last one. Make it the best one.','This is the last one. Empty it.'],
 done:['That is the session.','Session done.','That is it for today.','Work is done.'],
 donetail:['Good work, '+NAME+'. Go log it.','Well done, '+NAME+'. Log it.','Nice work today, '+NAME+'. Log it.'],
 donetailg:['Good work. Go log it.','Well done. Log it.','Nice work today. Log it.']
};
/* A cornerman does not say the same thing twice in ninety seconds. Each pool
   remembers its recent picks and draws from what is left, falling back to the
   full pool only when everything has been said recently. */
const VHIST=new WeakMap();
function vrand(a){
  if(!a||!a.length)return '';
  /* the combo pool lists this week's calls twice to weight them, so memory is
     sized by DISTINCT calls or it outgrows the pool and allows an instant repeat */
  const distinct=new Set(a).size;
  if(distinct<3)return a[Math.floor(Math.random()*a.length)];
  let h=VHIST.get(a)||[];
  const fresh=a.filter(x=>h.indexOf(x)<0);
  const pool=fresh.length?fresh:a;
  const pick=pool[Math.floor(Math.random()*pool.length)];
  h.push(pick);
  const cap=Math.ceil(distinct/2);
  if(h.length>cap)h=h.slice(h.length-cap);
  VHIST.set(a,h);
  return pick;
}
let VOICE_ON=true,CALLER_ON=true,vvoice=null,vready=false;
let BAG_ON=true,PARTNER_ON=false,GLOVES_ON=true,WRAPS_ON=true,GOALS='';
function vpick(){try{const vs=speechSynthesis.getVoices();const en=vs.filter(v=>/^en/i.test(v.lang));const us=en.filter(v=>/en[-_]US/i.test(v.lang));
  /* downloaded system voices beat the compact defaults: Premium, then Enhanced, then the old preference order */
  vvoice=us.find(v=>/premium/i.test(v.name))||us.find(v=>/enhanced/i.test(v.name))||en.find(v=>/premium/i.test(v.name))||en.find(v=>/enhanced/i.test(v.name))||us.find(v=>/(Google US English|Samantha|Ava|Allison)/i.test(v.name))||vs.find(v=>/en[-_](US|GB)/i.test(v.lang))||en[0]||null;}catch(e){}}
function vinit(){if(vready)return;try{const u=new SpeechSynthesisUtterance(' ');u.volume=0;speechSynthesis.speak(u);vpick();speechSynthesis.onvoiceschanged=vpick;vready=true;}catch(e){}}
const VNUM={'1':'one','2':'two','3':'three','4':'four','5':'five','6':'six'};
function vnorm(t){
  return String(t)
    .replace(/\b\d(?:-\d)+\b/g,m=>m.split('-').map(d=>VNUM[d]||d).join(' '))
    .replace(/\bx(\d+)\b/gi,'')
    .replace(/\b90\/90\b/g,'ninety ninety')
    .replace(/\bt-spine\b/gi,'upper back')
    .replace(/\s*\+\s*/g,' and ')
    .replace(/\s*&\s*/g,' and ')
    .replace(/\s{2,}/g,' ').trim();
}
/* ---- clip coach ----
   iOS routes speechSynthesis through its own channel that ignores Bluetooth,
   so the coach ships as pre-generated audio clips played through WebAudio,
   which follows the media route like music does. Browser speech stays as the
   automatic fallback for any missing clip or when no manifest is present. */
const CLIPS=(typeof window!=='undefined'&&window.AUDIO_MANIFEST)||null;
const clipCache={};
let clipCur=null,clipToken=0,sayChain=Promise.resolve();
async function clipBuffer(key){
  if(clipCache[key]!==undefined)return clipCache[key];
  try{
    if(!CLIPS||!CLIPS.map[key]||!ac)return (clipCache[key]=null);
    const res=await fetch('audio/'+CLIPS.map[key]);
    if(!res.ok)return (clipCache[key]=null);
    const audio=await ac.decodeAudioData(await res.arrayBuffer());
    return (clipCache[key]=audio);
  }catch(e){return (clipCache[key]=null);}
}
function clipStop(){clipToken++;try{if(clipCur)clipCur.stop();}catch(e){}clipCur=null;}
async function playSeq(parts,tok){
  for(const p of parts){
    if(tok!==clipToken)return;
    const key=vnorm(p);
    if(!key)continue;
    const b=CLIPS?await clipBuffer(key):null;
    if(tok!==clipToken)return;
    if(b&&ac){
      await new Promise(done=>{try{const s=ac.createBufferSource();s.buffer=b;s.connect(ac.destination);clipCur=s;s.onended=done;s.start();
        /* clips carry a silent tail; do not make the next line wait for it */
        if(ac.state==='running')setTimeout(done,Math.max(150,(b.duration-0.5)*1000));}catch(e){done();}});
      clipCur=null;
    }else{
      try{
        const u=new SpeechSynthesisUtterance(key);u.rate=1.02;u.pitch=1.02;u.volume=1;if(vvoice)u.voice=vvoice;
        await new Promise(done=>{u.onend=done;u.onerror=done;speechSynthesis.speak(u);setTimeout(done,8000);});
      }catch(e){}
    }
  }
}
function saySeq(parts,cut){
  if(!VOICE_ON)return;
  const ps=(parts||[]).map(p=>String(p||'').trim()).filter(Boolean);
  if(!ps.length)return;
  try{
    if(cut){vstop();sayChain=Promise.resolve();}
    if(!CLIPS){
      /* no manifest: the browser's own speech queue handles ordering, as v9 did */
      ps.forEach(p=>{
        const key=vnorm(p);
        if(!key)return;
        const u=new SpeechSynthesisUtterance(key);u.rate=1.02;u.pitch=1.02;u.volume=1;if(vvoice)u.voice=vvoice;
        speechSynthesis.speak(u);
      });
      return;
    }
    const tok=clipToken;
    sayChain=sayChain.then(()=>playSeq(ps,tok)).catch(()=>{});
  }catch(e){}
}
function say(t,cut){saySeq([t],cut);}
function vstop(){try{speechSynthesis.cancel();}catch(e){}clipStop();}

/* ---- combo caller ---- */
const CALLADD={
 1:['Jab','One two','One two three','Two three two','Leg kick','Teep','One two, leg kick','Body kick','Check it','Double jab','Jab to the body','One two, step out','Double jab, cross'],
 2:['One one two','One two three two','One two five two','Calf kick','Switch kick','Kick, hands, kick','One six three','Body jab','Rear teep','Two three','One two, slip','Calf kick, same leg again'],
 3:['One two three two three','Hand, kick, hand','Question mark kick','Three two three','Body, then head','Level fake, one two','Five strikes','Kick, hand, kick','One two, body kick','Jab, cross, switch kick','Three to the body, three to the head'],
 4:['Feint the jab, cross','Hand feint, low kick','Low, low, high','Body feint, uppercut','Teep feint, leg kick','Sell it first','Fake the shot, go high','Show the teep, throw the cross','Feint low, finish high'],
 5:['Check hook','Pull counter','Cross counter','Slip and counter','Sprawl, uppercut','Check and return','Counter it','Make him miss','Catch it, send it back','Slip outside, dig the body'],
 6:['One two, pivot, hook','Angle, then kick','Switch stance, kick','Circle out','Off angle','In and out','Cut the angle','One two, angle out','Southpaw kick, switch back'],
 7:['Sit down on it','Power one two','Kick through it','Heavy hands','Body kick, hard','Sit down, one two','Through the target, not at it'],
 8:['Walk it down','Hit the return','Chase kick','Punch out','Pressure','Cut him off','Six strikes, no pause','Cut the exit'],
 9:['Fast fast slow','Pause, then finish','Burst of six','Stutter step','Change the pace','Half beat','Slow hands, then explode','Break the beat, then finish'],
 10:['Free','Your call','Make it up','Whatever you see','Improvise','Show me something new','String it all together']
};
const CALLCUE=['Hands up','Snap it back','Pivot','Breathe','Angle off','Chin down','Do not stand still','Land balanced','Turn the hip over','Elbows in','Move your head','Reset your stance','Loose arms, no locked elbows'];
/* free rounds get a cornerman, not a dictation machine: one short tactical
   prompt at a time, real silence between. Lines stay under 8 words. */
const FREECALL=['He is cutting you off. Angle out.','Doubling his jab. Answer it.','You are square. Fix your feet.','Change levels. Body, then head.','Circle off the power hand.','Second combo. Do not admire the first.','Make him miss. Make him pay.','Get in, do the work, get out.','Where is your jab?','He is timing your rhythm. Break it.','Feet first, hands second.','Level change, then answer up top.','He is breathing hard. Go now.','You won that exchange. Take another.','Stop waiting. Make something happen.'];
/* defense rounds: the voice plays the opponent. Weeks 1-4 call the attack and
   the answer, week 5 on calls the attack only so he chooses. */
const DEFPAIR=['Jab. Slip right.','Jab. Slip left.','One two. Catch, then counter.','Hook. Roll under.','Low kick. Check it.','Teep. Parry and step in.','He shoots. Sprawl.','Double jab. Parry, parry.','Body shot. Elbows in.'];
const DEFATK=['Jab.','Double jab.','Right hand.','One two.','Lead hook.','Body shot.','Low kick.','Head kick.','Teep.','He shoots.','Jab jab.','He swings wide.','Level change.'];
/* memoised so the same array identity comes back per week, which is what lets
   vrand's repeat-suppression history work on the combo pool too */
const POOLCACHE={};
function poolFor(wi){
  if(POOLCACHE[wi])return POOLCACHE[wi];
  let p=[];for(let i=1;i<=wi+1;i++)p=p.concat(CALLADD[i]||[]);p=p.concat(CALLADD[wi+1]||[]);
  POOLCACHE[wi]=p;return p;
}
let callT=null;
function callerStop(){if(callT){clearTimeout(callT);callT=null;}}
/* A call must match the round it lands in: no punch combos in a teep round,
   no kick calls in a hands-only round, movement cues only in footwork rounds. */
const KICKCALL=/kick|teep|knee|check/i;
const BAGCALL=/sit down|through it|through the target|heavy hands|power one two|body kick, hard/i;
const HANDCALL=/jab|one|two|three|four|five|six|hook|cross|uppercut|body shot|punch|straight|hands|feint the|sell it|fake the shot/i;
function poolFilterFor(label){
  const L=String(label).toLowerCase();
  const teeps=/teep/.test(L),kicks=/kick/.test(L);
  const hands=/jab|hand|punch|box|combo|1-2|straight|counter|body/.test(L);
  let f=null;
  if(/footwork only|no punches|feet only|move only|movement only/.test(L))f=c=>!KICKCALL.test(c)&&!HANDCALL.test(c);
  else if(/jab only|jabs only/.test(L))f=c=>/jab/i.test(c)&&!KICKCALL.test(c);
  else if(teeps&&!kicks&&!hands)f=c=>/teep/i.test(c)&&!HANDCALL.test(c);
  else if((teeps||kicks)&&!hands)f=c=>KICKCALL.test(c)&&!HANDCALL.test(c);
  else if(hands&&!teeps&&!kicks)f=c=>!KICKCALL.test(c);
  /* The round label is not always enough: a generic label like "pivot after
     every chain" on boxing day would otherwise let the full pool through, and
     Wednesday, Thursday and Saturday are hands only by design. The day's own
     weapon rule always applies on top. */
  const dayw=(DAYMETA[DK[dIdx]]||{}).weapons;
  if(dayw==='hands'){const inner=f;f=c=>!KICKCALL.test(c)&&(!inner||inner(c));}
  if(!bagLive()){const inner2=f;f=c=>!BAGCALL.test(c)&&(!inner2||inner2(c));}
  return f;
}
/* filtered pools are memoised so vrand keeps its repeat history across calls */
const FPC=new WeakMap();
const DEFCACHE=new WeakMap();
function defPool(base){
  if((DAYMETA[DK[dIdx]]||{}).weapons!=='hands')return base;
  let p=DEFCACHE.get(base);
  if(!p){p=base.filter(c=>!KICKCALL.test(c)&&!/shoots|sprawl|level change/i.test(c));DEFCACHE.set(base,p);}
  return p;
}
function fromPool(pool,filter,key){
  let p=pool;
  if(filter){
    let m=FPC.get(pool);if(!m){m=new Map();FPC.set(pool,m);}
    const ck=String(key||'')+'|'+((DAYMETA[DK[dIdx]]||{}).weapons||'')+'|'+(bagLive()?1:0);
    p=m.get(ck);
    if(!p){p=pool.filter(filter);m.set(ck,p);}
  }
  return p.length?vrand(p):vrand(CALLCUE.filter(c=>!KICKCALL.test(c)&&!HANDCALL.test(c)));
}
/* the day's own corner cues, spoken mid-round: Monday hears kick corrections,
   Wednesday hears boxing ones. Same voiced lines the rest announcements use.
   A cue still has to fit the round: no kick coaching in a jab-only round, and
   nothing kick-flavored at all on a hands-only day. */
function dayCue(filter){
  const a=CORNER[DK[dIdx]];
  if(!a||!a.length)return vrand(CALLCUE);
  const dayw=(DAYMETA[DK[dIdx]]||{}).weapons;
  for(let i=0;i<3;i++){
    const c=endp(vrand(a));
    if(dayw==='hands'&&KICKCALL.test(c))continue;
    if(filter&&(KICKCALL.test(c)||HANDCALL.test(c))&&!filter(c))continue;
    return c;
  }
  const neutral=CALLCUE.filter(c=>!KICKCALL.test(c)&&!HANDCALL.test(c));
  return neutral.length?vrand(neutral):vrand(CALLCUE);
}
function callerPick(ctx,label){
  const pool=poolFor(wIdx);
  const flavor=ctx==='station'?roundCall(label,DK[dIdx]):ctx;
  const filter=poolFilterFor(label);
  const r=Math.random();
  if(r<0.10)return vrand(VP.praise);
  if(flavor==='defense')return r<0.20?vrand(CALLCUE):(r<0.32?dayCue(filter):vrand(defPool(wIdx>=4?DEFATK:DEFPAIR)));
  if(flavor==='free')return r<0.22?vrand(CALLCUE):(r<0.36?dayCue(filter):fromPool(FREECALL,filter,label));
  return r<0.20?vrand(CALLCUE):(r<0.34?dayCue(filter):fromPool(pool,filter,label));
}
/* cadence per round type: defense is stimulus-response (fast), technique and
   stations sit mid, free rounds get sparse corner prompts with real silence */
function callerDelay(ctx){
  if(ctx==='defense')return 5000+Math.random()*3000;
  if(ctx==='free')return 20000+Math.random()*10000;
  if(ctx==='station')return 9000+Math.random()*6000;
  return 8000+Math.random()*4000;
}
function callerStart(){
  callerStop();
  if(!CALLER_ON||!VOICE_ON)return;
  if(!T||!T.segs||!T.segs[T.i]||T.segs[T.i].type!=='work'||!T.segs[T.i].call)return;
  const fire=()=>{
    if(!T||!T.running||!T.segs||T.segs[T.i].type!=='work'){callT=null;return;}
    const sg=T.segs[T.i];
    if(!sg.call){callT=null;return;}
    say(callerPick(sg.call,sg.label),false);
    plan();
  };
  const plan=()=>{
    const sg=T&&T.segs&&T.segs[T.i]?T.segs[T.i]:null;
    const ctx=sg&&sg.call?(sg.call==='station'?'station':roundCall(sg.label,DK[dIdx])):null;
    callT=setTimeout(fire,callerDelay(ctx==='station'?'station':ctx));
  };
  plan();
}

/* ---- corner cues ---- */
const CORNER={
 mon:['Base foot. Turn it all the way over.','Land balanced, hands back up.','Chamber the knee before you extend.','Kick through it, not at it.','Shin, not foot.'],
 tue:['Every combo ends somewhere new. Pivot off.','Snap each punch back to your chin.','Body first, then head.','Let each rotation feed the next one.','Do not reset between punches. Chain it.'],
 wed:['Rear heel spins out on the cross.','Retract faster than you throw.','Lead hand stays home when the cross goes.','Light feet tonight. You hinged heavy this morning.','Do not lean past your front foot.'],
 thu:['Form holds when the arms burn. Slow down before you get ugly.','Breathe through your nose. Bring it down.','Level change from the legs, never the waist.','Output, not flailing.','Land in stance, not flat footed.'],
 fri:['Small slips. A big lean is just a slow miss.','Come up already throwing.','Defense and counter are one motion.','Do not freeze. React and fire.','Eyes up. Hands up.'],
 sat:['Hands up even when you are gassed.','Reach long, stop short of locked, snap it home.','Turn the body on every hook.','Last round should look like the first.','Keep the pace honest.'],
 sun:[]
};
function cornerCue(){const a=CORNER[DK[dIdx]]||[];return a.length?a[Math.floor(Math.random()*a.length)]:'';}

/* ---- the weekly tape ----
   The week 10 exam, run every Sunday instead of once. Film one round at half
   speed, watch it back, tap what held up. What keeps failing is next week's
   focus, and by week 10 the checkpoint is a formality instead of a surprise. */
function checkCard(){
  const cur=CHECKS[wIdx]||[0,0,0,0,0];
  const chips=CHECK5.map((c,i)=>`<button class="ckchip${cur[i]?' on':''}" data-ck="${i}" type="button">${c[0]}</button>`).join('')+'<button class="ckchip" data-ck="none" type="button">Nothing held</button>';
  const held=cur.filter(Boolean).length;
  /* which checkpoint fails most across every graded week */
  let worst='',worstMiss=0;
  const graded=Object.keys(CHECKS);
  if(graded.length){
    CHECK5.forEach((c,i)=>{
      const miss=graded.filter(w=>!(CHECKS[w]||[])[i]).length;
      if(miss>worstMiss){worstMiss=miss;worst=c[0];}
    });
  }
  const legend=CHECK5.map(c=>`<div class="bwline"><b>${c[0]}:</b> ${c[1]}</div>`).join('');
  return `<div class="card"><div class="cardhead"><span class="cardtitle">The weekly tape</span><span class="cardtag">${CHECKS[wIdx]?held+'/5 this week':'not graded yet'}</span></div>
    <div class="bwnote">Film one round of shadow at half speed, watch it back once, and tap what held up. Grade it like a coach who does not like you.</div>
    <div class="bwchips" id="ckrow">${chips}</div>
    ${legend}
    ${worst&&worstMiss>1?`<div class="bwnote" style="color:var(--ember)">${worst} has failed ${worstMiss} of your ${graded.length} graded weeks. That is next week's focus, every session.</div>`:''}
  </div>`;
}
/* Exact-label swaps for weeks 5-10 when there is no bag yet. Derived from the
   program's own NO BAG YET notes: shadow versions chase snap and full
   retraction instead of impact. Filled per drill; unknown labels pass through. */
const NOBAG_MAP={
 'Range check 2 min':['Slow-motion roundhouse x8 each','five counts out, five counts back, the foot never touches down between reps'],
 'Leg kick x15 each':['Leg kick x15 each','snap and a clean recovery instead of impact, full pivot every rep'],
 'Body kick x15 each':['Body kick x15 each','hip all the way over, freeze a beat at extension, return on balance'],
 'Power teep x15 each':['Power teep x15 each','knee up a beat, then drive, standing foot pivoted'],
 'Switch kick x12 each':['Switch kick x12 each','kick and hold 3 seconds at extension, then return on balance'],
 'R1 kicks only':['R1 kicks only','full turn, land balanced, never at half hip'],
 '1-2 at 70% x20':['1-2 snap x20','arm loose like a towel snap, fist tight only at the end, never lock the elbow out'],
 '1-2-3 x15':['1-2-3 x15','picture him stepping in, the hook meets him mid-step'],
 'Uppercuts in close x12 each':['Uppercuts in close x12 each','imagine the clinch, dig up short from the legs'],
 'Rotate every 30 sec on the bag. Rest per the timer.':['Rotate every 30 sec. Rest per the timer. Count reps, the number is the standard.'],
 '30s max output':['30s punch-out, 90 straights'],
 '30s 1-2 on the bag, max hands':['30s 1-2, max hands'],
 'Touch, slip, counter x15 each':['Touch, slip, counter x15 each','flash the jab as his, slip it, cross back'],
 'R1|slip-counter on the bag only':['R1','slip-counter only, make every miss real'],
 'Rotate every 30 sec, hands on the bag. Rest per the timer.':['Rotate every 30 sec, hands only. Rest per the timer. Count the reps.'],
 '30s max straights':['30s max straights, count 90'],
 'Teep the advance x15':['Teep the advance x15','he steps in, the teep meets him mid-step'],
 'Chase kick x12 each':['Chase kick x12 each','he backs off, step with him, the body kick lands as he moves'],
 'Knees x15 each':['Knees x15 each','collar tie in the air, pull down as the knee drives up'],
 'Hit the return x12':['Hit the return x12','he comes back at you, you are already throwing'],
 'Elbows in close x12 each':['Elbows in close x12 each','chest to chest range, short and sharp'],
 'Hit the advance x15':['Hit the advance x15','1-2 as he steps in, that is timing'],
 'In-out on the swing x12':['In-out x12','in behind the jab, out before the answer'],
 'Rotate every 30 sec on the bag. Rest per the timer. Hardest session of the camp.':['Rotate every 30 sec. Rest per the timer. Hardest session of the camp. Count reps.'],
 'The swing is the attack':['He is always coming forward','every attack you imagine, make it miss'],
 'Slip the swing, 2-3 x15':['Slip the jab, 2-3 x15'],
 'Pivot off it, hook x12':['Pivot off him, hook x12']
};
/* Bag work is week 5 of every camp. It used to be derived from a real-world
   delivery date, which made a resume, a buddy or a second camp announce a bag
   that was not coming. The re-pin below stays so the Moves badges follow it. */
let BAGWEEK=4;
function recomputeBagWeek(){
  BAGWEEK=4;
  try{
    CATS.forEach(c=>{if(c.cat==='Bag Work')c.moves.forEach(m=>{MOVEWEEK[m.name]=BAGWEEK;});});
    MOVEWEEK['Wrapping Hands']=BAGWEEK;
  }catch(e){}
}
/* a bag round needs the bag, wraps and gloves; without all three it runs as shadow */
function bagLive(){return BAG_ON&&WRAPS_ON&&GLOVES_ON;}
function adaptItems(arr){
  if(!arr||bagLive()||wIdx<BAGWEEK)return arr;
  return arr.map(it=>{
    const sub=NOBAG_MAP[it.length>1?it[0]+'|'+it[1]:'']||NOBAG_MAP[it[0]];
    return sub?sub.slice():it;
  });
}
function adaptNote(note){
  const parts=String(note).split(/\s*no bag yet[:.]?\s*/i);
  if(parts.length<2)return note;
  return bagLive()?parts[0]:parts[0]+' No bag yet: '+parts[1];
}
/* Additive partner block per day, shown when the Partner switch is on.
   Everything choreographed or single-technique: two beginners, no pads. */
const PARTNER={
 mon:[['Teep distance game, 2 min each','he walks in slow, your light teep to the belt line resets him. Below the chest, never the knee'],
      ['Leg-catch balance, 60s each leg','he holds your extended roundhouse and walks, you hop and keep the hip turned']],
 tue:[['Caller rounds','he calls number combos, you throw them at range, zero contact. Swap caller each round'],
      ['1-for-1 flow','slow 2-3 punch combos to gloves and guard only, he answers with the same. Whoever punches wears the gloves']],
 wed:[['Jab tag','jabs only, score by touching glove or lead shoulder. Force scores nothing, head is off limits'],
      ['Parry and return, 1 min each','slow marked jabs at your guard, you parry and jab back into the air an inch short of his shoulder']],
 thu:[['Swap in one station: mirror footwork 30s','he leads, you keep exact range. Swap roles next round'],
      ['Or teep-back 30s','he marches forward, you stop him with light teeps to the hip']],
 fri:[['Defense reps x10 each','slow announced jabs and crosses that stop at your guard: slip, parry, block. Swap'],
      ['Once he is here: add one counter','defend, then jab back into the air an inch short of his shoulder. The one throwing wears the gloves']],
 sat:[['Called combos at range, 30s stations','he calls, you throw in the air at his chest height, zero contact. You wear the gloves, he stays a full step outside your range. Swap every station'],
      ['Caller station','he calls random combos, you throw them in the air at range']],
 sun:[]
};
const PARTNER_RULES='Partner rules, agreed out loud before you touch gloves. Percentage is set BEFORE the round and nobody raises it mid-round. No head contact at all, and the week 9 mouthguard does not change that: a mouthguard protects teeth and jaws, it does not protect brains, and two beginners with nobody watching have no business trading head shots. Body contact is touch only. Kicks stay light, land above the knee, and never shin on shin until you both have pads. No free sparring. Whoever is striking wears the gloves. Any hard contact, accidental or not, ends the round for both of you. Ten minutes, and it comes out of your rounds, not on top of them.';

/* What to do when it is not a drill: fence, cover, hold on, get up. Display only,
   billed 8 minutes. Solo work builds hands and a plan, not pressure; leaving is the win. */
const STREETWK=[2,5,8];
const STREET=[
 ['Fence and talk, 2 min','hands open at chest height, palms out, feet bladed. Say "I do not want any trouble" out loud. The fence is a guard and a boundary, never a challenge'],
 ['Cover up x10','forearms against the head, elbows in, chin down. Cover first, then step out and leave. Practice it from the fence, not from a fighting stance'],
 ['Cover, collar tie x5 each side','cover a swing, then wrap the back of the neck with your near hand and keep your elbows in. You are holding on, not winning'],
 ['Stand up from the floor x3 each side','one hand and one foot down, back toward a wall, rise into stance with your hands up. Slow first, then a little faster']
];
/* ---- round-aware calling ---- */
function roundCall(label,k){
  const L=String(label).toLowerCase();
  if(/free|flow|fight sim|your call|make it up|improvise|whatever/.test(L))return 'free';
  if(k==='fri'||/defen|counter|slip|pull |roll |catch|check|bait|make it miss|make him miss|react|shell/.test(L))return 'defense';
  return 'combo';
}
function stationCall(nm){
  const L=String(nm).toLowerCase();
  if(/push-up|push up|climber|plank|up-down|up down|hollow|leg raise|twist|bicycle/.test(L))return null;
  return 'station';
}

/* ---- timer ---- */
function buildSegs(k,day){
  if(!day.tm)return null;
  const R=Math.max(1,day.tm.rounds-CUT),wk2=day.tm.work,rs=day.tm.rest,segs=[];
  const CQ=(CORNER[k]||[]).slice();
  let ci=Math.floor(Math.random()*Math.max(1,CQ.length));
  const nextCue=()=>{if(!CQ.length)return '';const c=CQ[ci%CQ.length];ci++;return c;};
  if(k==='thu'||k==='sat'){
    const st=adaptItems(day.t).filter(x=>/^30s/i.test(x[0])).map(x=>x[0].replace(/^30s\s*/i,''));
    for(let r=1;r<=R;r++){
      st.forEach((nm,i)=>segs.push({d:30,type:'work',label:nm,next:i<st.length-1?st[i+1]:(r<R?'rest '+fmt(rs):''),round:r,call:stationCall(nm)}));
      if(r<R)segs.push({d:rs,type:'rest',label:'Rest',next:st[0],round:r,cue:nextCue()});
    }
  }else{
    /* an id-only round (R1) carries its rule in the label; a titled round keeps
       the title as the label and the rule as its own spoken line */
    const items=adaptItems(day.r||[]).map(x=>(x.length>1&&x[0].length<=4)?{L:x[0]+' · '+x[1],det:''}:{L:x[0],det:x.length>1?String(x[1]):''});
    for(let r=1;r<=R;r++){
      const it=items[r-1]||{L:'Round '+r,det:''};
      const L=it.L;
      segs.push({d:wk2,type:'work',label:L,detail:it.det,next:r<R?'rest '+fmt(rs):'',round:r,call:roundCall(L,k)});
      if(r<R)segs.push({d:rs,type:'rest',label:'Rest',next:items[r]?items[r].L:('Round '+(r+1)),round:r,cue:nextCue()});
    }
  }
  if(segs.length)segs.unshift({d:10,type:'prep',label:'Get set',next:segs[0].label,round:1});
  return {segs,rounds:R};
}
let T=null;
const elPhase=document.getElementById('tphase'),elClock=document.getElementById('tclock'),elRound=document.getElementById('tround'),elName=document.getElementById('tname'),elNext=document.getElementById('tnext'),elGo=document.getElementById('tgo'),elSkip=document.getElementById('tskip'),elReset=document.getElementById('treset');
let ac=null,wl=null;
async function wakeOn(){try{if('wakeLock' in navigator&&!wl){wl=await navigator.wakeLock.request('screen');wl.addEventListener('release',()=>{wl=null;});}}catch(e){}}
function wakeOff(){try{if(wl){wl.release();wl=null;}}catch(e){}}

/* ---- media session: keeps the screen on, claims the audio route, survives lock ---- */
const wakevid=document.getElementById('wakevid'),keepEl=document.getElementById('keep');
function silentWavURL(){
  try{
    const sr=8000,sec=1,n=sr*sec,sz=44+n*2,b=new ArrayBuffer(sz),v=new DataView(b);
    const ws=(o,t)=>{for(let i=0;i<t.length;i++)v.setUint8(o+i,t.charCodeAt(i));};
    ws(0,'RIFF');v.setUint32(4,sz-8,true);ws(8,'WAVE');ws(12,'fmt ');v.setUint32(16,16,true);
    v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);
    v.setUint16(32,2,true);v.setUint16(34,16,true);ws(36,'data');v.setUint32(40,n*2,true);
    return URL.createObjectURL(new Blob([b],{type:'audio/wav'}));
  }catch(e){return '';}
}
try{const u=silentWavURL();if(u&&keepEl)keepEl.src=u;}catch(e){}
function mediaOn(){
  try{if(keepEl&&keepEl.src)keepEl.play().catch(()=>{});}catch(e){}
  try{if(wakevid)wakevid.play().catch(()=>{});}catch(e){}
  wakeOn();
  try{
    if('mediaSession' in navigator){
      navigator.mediaSession.metadata=new MediaMetadata({title:'The Forge · '+DAYMETA[DK[dIdx]].title,artist:'Week '+W[wIdx].n+' · Corner is live',album:'10 Week Camp'});
      navigator.mediaSession.setActionHandler('play',()=>{try{if(T&&!T.running)elGo.click();}catch(e){}});
      navigator.mediaSession.setActionHandler('pause',()=>{try{if(T&&T.running)elGo.click();}catch(e){}});
    }
  }catch(e){}
}
function mediaOff(){
  try{if(keepEl)keepEl.pause();}catch(e){}
  try{if(wakevid)wakevid.pause();}catch(e){}
  wakeOff();
}
let PAINTED_DAY=todayISO();
function calRefresh(){
  try{
    if(sessionRunning())return;
    const t=todayISO();
    if(t===PAINTED_DAY)return;
    PAINTED_DAY=t;
    const slot=todaySlot();
    if(slot){wIdx=slot.w;dIdx=slot.d;selectWeek(wIdx);selectDay(dIdx);}
    paintDone();buildGrid();
  }catch(e){}
}
function onWake(){resync();calRefresh();try{paintUpdate();checkUpdate(false);}catch(e){}}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')onWake();});
window.addEventListener('focus',onWake);
window.addEventListener('pageshow',onWake);
function beep(f,d){if(!ac)return;const o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.value=f;o.connect(g);g.connect(ac.destination);const t=ac.currentTime;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.35,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.start(t);o.stop(t+d);}
let SND='bell';
/* a struck bell is a few inharmonic partials with different decays, no files */
function bellStrike(base,decay,vol){
  if(!ac)return;
  const t=ac.currentTime;
  [[1,1],[2.76,.55],[5.4,.3],[8.93,.16]].forEach((p,i)=>{
    const o=ac.createOscillator(),g=ac.createGain();
    o.type='sine';o.frequency.value=base*p[0];o.connect(g);g.connect(ac.destination);
    const peak=.3*p[1]*(vol||1),life=decay/(1+i*.7);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+.004);g.gain.exponentialRampToValueAtTime(.0001,t+life);
    o.start(t);o.stop(t+life+.05);
  });
}
/* two wood sticks: the ten second warning boxers actually hear */
function clack(){
  if(!ac||SND==='classic')return;
  [0,.11].forEach((dt,i)=>{
    const t=ac.currentTime+dt,o=ac.createOscillator(),g=ac.createGain();
    o.type='square';o.frequency.value=i?760:980;o.connect(g);g.connect(ac.destination);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.22,t+.002);g.gain.exponentialRampToValueAtTime(.0001,t+.045);
    o.start(t);o.stop(t+.06);
  });
}
function bell(k2){
  if(SND==='classic'){
    if(k2==='work'){beep(880,.14);setTimeout(()=>beep(880,.14),160);}else if(k2==='tick'){beep(720,.12);}else if(k2==='rest'){beep(440,.22);}else{beep(660,.15);setTimeout(()=>beep(830,.15),180);setTimeout(()=>beep(990,.28),360);}
    return;
  }
  if(k2==='work')bellStrike(660,1.6);
  else if(k2==='tick')clack();
  else if(k2==='rest')bellStrike(440,.9,.8);
  else{bellStrike(660,1.4);setTimeout(()=>bellStrike(660,1.4),520);setTimeout(()=>bellStrike(660,2.2),1040);}
}
const elProg=document.getElementById('tprog');
function segCol(t){return css(t==='work'?'--ember':(t==='rest'?'--steel':'--muted'));}
function paintProg(){
  if(!elProg)return;
  if(T&&T.state==='done')return;
  if(!T||!T.segs){elProg.style.width='100%';elProg.style.background=css('--line');return;}
  const sg=T.segs[T.i];
  elProg.style.background=segCol(sg.type);
  elProg.style.width=Math.max(0,Math.min(100,100*T.left/sg.d))+'%';
}
const PHTXT={prep:'Prep',work:'Work',rest:'Rest'};
const PHCOL={prep:'--muted',work:'--ember',rest:'--steel'};
function showSeg(){
  if(!T||!T.segs)return;
  if(T.state==='done')return;
  const sg=T.segs[T.i];
  const work=sg.type==='work';
  elName.textContent=sg.label;
  elNext.textContent=sg.cue?sg.cue:(sg.next?('next: '+sg.next):'');
  elRound.textContent='R'+sg.round+' / '+T.rounds;
  elClock.textContent=fmt(Math.max(T.left,0));
  elPhase.textContent=T.state==='ready'?'Ready':(PHTXT[sg.type]||'Work');
  elPhase.style.color=css(T.state==='ready'?'--muted':(PHCOL[sg.type]||'--ember'));
  elClock.style.color=(T.state==='run'&&work)?css('--ember'):css('--bone');
  paintProg();
  paintFocus();
}
function stopTick(){if(T&&T.int){clearInterval(T.int);T.int=null;}if(T)T.running=false;}
function loadTimer(k,day){
  if(T&&T.state==='run'){vstop();mediaOff();}
  stopTick();callerStop();
  const cfg=buildSegs(k,day);
  if(!cfg){T={segs:null,state:'flow'};elName.textContent='Flow day';elNext.textContent='';elRound.textContent='';elClock.textContent='--:--';elClock.style.color=css('--muted');elPhase.textContent='Flow';elPhase.style.color=css('--restore');elGo.disabled=true;elSkip.disabled=true;elReset.disabled=true;elGo.textContent='Start';paintProg();paintFocus();return;}
  elGo.disabled=false;elSkip.disabled=false;elReset.disabled=false;
  T={segs:cfg.segs,rounds:cfg.rounds,i:0,left:cfg.segs[0].d,running:false,int:null,state:'ready',wk:wIdx,dk:k};
  elGo.textContent='Start';showSeg();
}
function finish(){T.state='done';try{paintUpdate();}catch(e){}stopTick();callerStop();setTimeout(()=>{try{if(!T||T.state==='done')mediaOff();}catch(e){}},8000);saySeq([vrand(VP.done),vrand(coachNamed()?VP.donetail:VP.donetailg)],true);bell('done');elGo.textContent='Start';elName.textContent='Session complete';elNext.textContent='';elClock.textContent='00:00';elPhase.textContent='Done';elPhase.style.color=css('--restore');elRound.textContent='';
  if(FOCUS&&fEl){
    fEl.classList.remove('fwork','frest','fprep');fEl.classList.add('fdone');
    const before=totDone(),after=before+(isDone(wIdx,dIdx)?0:1);
    const rankUp=rankOf(after)!==rankOf(before);
    const dn=campDayCount(),md=DAYMETA[DK[dIdx]];
    fName.textContent='Session complete';fClock.textContent='00:00';fClock.style.color='';
    fPhase.textContent='Done';fPhase.style.color=css('--restore');
    fRound.textContent='Week '+W[wIdx].n+' · '+md.title+' · complete';
    fCue.textContent='SESSION '+after+' · '+rankOf(after).toUpperCase()+(rankUp?' · RANK UP':'')+(campPhase()==='live'&&dn>=1&&dn<=70?' · DAY '+dn+' OF 70':'');
    if(fRing){fRing.style.strokeDashoffset='0';fRing.style.stroke=css('--restore');}
    fNext.textContent=isDone(wIdx,dIdx)?'LOGGED':(md.cool?'COOLDOWN NEXT, THEN LOG IT':'');
    if(fGo)fGo.textContent=isDone(wIdx,dIdx)?'Close':'Log it and close';
    if(fSparks)fSparks.innerHTML=sparksHTML();
  }}
function lbl(x){return String(x).replace(/^R(\d)\s*·\s*/,'Round $1, ').replace(/^R(\d)\s+/,'Round $1, ');}
function endp(x){x=String(x).trim();return /[.!?]$/.test(x)?x:x+'.';}
function announce(sg){
  if(sg.type==='prep'){
    callerStop();
    saySeq([coachNamed()?vrand(VP.open)+', '+NAME+'.':vrand(VP.open)+'.',endp(lbl(sg.next)),'Get set.'],true);
    return;
  }
  if(sg.type==='rest'){
    callerStop();
    saySeq([vrand(VP.rest)].concat(sg.cue?[endp(sg.cue)]:[]),true);
    return;
  }
  const prev=T.segs[T.i-1];
  const newRound=!prev||prev.type!=='work';
  let t;
  const det=(sg.detail&&sg.detail.length<150)?[endp(sg.detail)]:[];
  if(newRound&&sg.round===T.rounds&&T.rounds>1) t=[vrand(VP.lastwork),endp(lbl(sg.label))].concat(det);
  else if(newRound) t=[endp(lbl(sg.label))].concat(det,[vrand(VP.begin)]);
  else t=[endp(lbl(sg.label))].concat(Math.random()<0.22?[vrand(VP.push)]:[]);
  saySeq(t,true);
  setTimeout(()=>{if(T&&T.running&&T.segs&&T.segs[T.i]&&T.segs[T.i].type==='work')callerStart();},1800);
}
function advance(quiet){
  const prev=T.segs[T.i];
  T.i++;
  if(T.i>=T.segs.length){finish();return;}
  const cur=T.segs[T.i];
  const base=quiet&&T.endAt?T.endAt:Date.now();
  T.endAt=base+cur.d*1000;
  T.left=Math.max(1,Math.ceil((T.endAt-Date.now())/1000));
  T.warned={};
  if(!quiet){
    bell(cur.type==='rest'?'rest':(prev.type==='work'?'tick':'work'));
    announce(cur);
    showSeg();
  }
}
function acWake(){try{if(ac&&ac.state!=='running'){const p=ac.resume();if(p&&p.catch)p.catch(()=>{});}}catch(e){}}
function resync(){
  try{
    if(!T||!T.segs||T.state!=='run'||!T.running||!T.endAt)return;
    acWake();
    let hops=0;
    while(T.state==='run'&&Date.now()>=T.endAt&&hops<600){advance(true);hops++;}
    if(T.state!=='run')return;
    if(hops>0){
      const cur=T.segs[T.i];
      bell(cur.type==='rest'?'rest':'work');
      saySeq(['Back with you.',endp(lbl(cur.label)),Math.max(T.left,1)+' seconds left.'],true);
      if(cur.type==='work')setTimeout(()=>{if(T&&T.running&&T.segs&&T.segs[T.i]&&T.segs[T.i].type==='work')callerStart();},1800);
      else callerStop();
    }
    showSeg();
    if(T.running)mediaOn();
  }catch(e){}
}
function setEnd(sec){T.endAt=Date.now()+sec*1000;}
function tick(){
  if(!T||!T.running||!T.segs)return;
  const nl=Math.ceil((T.endAt-Date.now())/1000);
  /* a throttled tick that runs before visibilitychange must hand off to
     resync, which fast-forwards, instead of re-anchoring one segment */
  if(nl<=0){if(Date.now()-T.endAt>1500){resync();return;}advance();return;}
  if(nl===T.left)return;
  const prev=T.left;
  T.left=nl;
  const sg=T.segs[T.i];
  if(!T.warned)T.warned={};
  /* fire on crossing a threshold, so a stalled tick cannot skip a cue */
  const crossed=thr=>prev>thr&&nl<=thr&&nl>thr-3;
  if(sg.type==='work'){
    if(sg.d>=120&&crossed(Math.round(sg.d/2))&&!T.warned.mid){T.warned.mid=1;say(vrand(VP.mid),false);}
    if(sg.d>=120&&crossed(30)&&!T.warned[30]){T.warned[30]=1;say(vrand(VP.thirty),false);}
    /* 30 second stations get no countdown: the next station call is the cue */
    if(sg.d>=60&&crossed(10)&&!T.warned[10]){
      T.warned[10]=1;
      const line=vrand(T.i===T.segs.length-1?VP.tenlast:VP.ten);
      clack();setTimeout(()=>say(line,false),SND==='classic'?0:400);
    }
    if(sg.d<60&&T.i===T.segs.length-1&&crossed(10)&&!T.warned[10]){T.warned[10]=1;const line=vrand(VP.tenlast);clack();setTimeout(()=>say(line,false),SND==='classic'?0:400);}
  }else if((sg.type==='prep'||(sg.type==='rest'&&sg.d>=30))&&crossed(4)&&!T.warned[3]){T.warned[3]=1;say('Three. Two. One.',false);}
  elClock.textContent=fmt(T.left);paintProg();paintFocus();
}
elGo.addEventListener('click',()=>{
  if(!ac){try{ac=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}}
  acWake();
  vinit();
  if(!T||!T.segs||T.state==='done')return;
  const fresh=T.state==='ready';
  if(fresh){T.state='run';bell('work');T.warned={};try{paintUpdate();}catch(e){}}
  if(T.running){
    T.left=Math.max(0,Math.ceil((T.endAt-Date.now())/1000));
    stopTick();callerStop();vstop();mediaOff();elGo.textContent='Start';
  }else{
    T.running=true;elGo.textContent='Pause';
    setEnd(Math.max(T.left,1));
    T.int=setInterval(tick,500);
    mediaOn();
    if(fresh)announce(T.segs[T.i]);else callerStart();
  }
  showSeg();
});
elSkip.addEventListener('click',()=>{
  if(!T||!T.segs||T.state==='done')return;
  if(T.state==='ready')T.state='run';
  callerStop();
  advance(false);
  if(!T.running)showSeg();
});
/* mid-session, one stray tap must not wipe the round: first tap arms it */
let RESET_ARM=0;
function paintResetLabel(armed){[elReset,document.getElementById('freset')].forEach(b=>{if(b)b.textContent=armed?'Tap again':'Reset';});}
elReset.addEventListener('click',()=>{
  if(sessionRunning()&&!RESET_ARM){RESET_ARM=setTimeout(()=>{RESET_ARM=0;paintResetLabel(false);},3000);paintResetLabel(true);return;}
  if(RESET_ARM){clearTimeout(RESET_ARM);RESET_ARM=0;}
  paintResetLabel(false);
  callerStop();vstop();mediaOff();loadTimer(DK[dIdx],W[wIdx].d[DK[dIdx]]);
  try{paintUpdate();}catch(e){}
});

/* ---- focus mode ---- */
const fEl=document.getElementById('focus'),fName=document.getElementById('fname'),fClock=document.getElementById('fclock'),
      fPhase=document.getElementById('fphase'),fRound=document.getElementById('fround'),fNext=document.getElementById('fnext'),
      fCue=document.getElementById('fcue'),fRing=document.getElementById('rfg'),fGo=document.getElementById('fgo');
const RC=2*Math.PI*92;
/* one pip per round, so how far through the session you are never needs reading */
const fPips=document.getElementById('fpips'),fSparks=document.getElementById('fsparks');let PIPKEY='';
function paintPips(sg){
  if(!fPips||!T||!T.segs)return;
  const key=T.rounds+'|'+sg.round;
  if(key===PIPKEY)return;
  PIPKEY=key;
  let p='';
  for(let i=1;i<=T.rounds;i++)p+='<span class="pip'+(i<sg.round?' dn':'')+(i===sg.round?' cur':'')+'"></span>';
  fPips.innerHTML=p;
}
if(fRing){fRing.style.strokeDasharray=RC.toFixed(1);fRing.style.strokeDashoffset='0';}
let FOCUS=false;
function paintFocus(){
  if(!FOCUS||!fEl)return;
  if(T&&T.state==='done')return;
  if(!T||!T.segs){fName.textContent='Flow day';fClock.textContent='--:--';fPhase.textContent='Flow';fRound.textContent='';fNext.textContent='';fCue.textContent='';return;}
  const sg=T.segs[T.i];
  const col=segCol(sg.type);
  fEl.classList.toggle('fwork',sg.type==='work'&&T.state==='run');
  fEl.classList.toggle('frest',sg.type==='rest');
  fEl.classList.toggle('fprep',sg.type==='prep');
  fName.textContent=sg.label;
  fName.style.color=sg.type==='work'?css('--bone'):col;
  fClock.textContent=fmt(Math.max(T.left,0));
  fClock.style.color=sg.type==='work'&&T.state==='run'?css('--ember'):css('--bone');
  fPhase.textContent=T.state==='ready'?'Ready':(PHTXT[sg.type]||'Work');
  fPhase.style.color=col;
  fRound.textContent='Week '+W[wIdx].n+' · '+DAYMETA[DK[dIdx]].title+' · R'+sg.round+'/'+T.rounds;
  fCue.textContent=sg.cue||(sg.type==='work'&&sg.detail?sg.detail:(sg.type==='prep'&&T.state!=='ready'?(WHO||'Jackson').toUpperCase()+' · '+rankOf(totDone()).toUpperCase():''));
  paintPips(sg);
  fNext.textContent=sg.next?('NEXT  '+sg.next.toUpperCase()):'';
  fRing.style.stroke=col;
  fRing.style.strokeDashoffset=(RC*(1-Math.max(0,Math.min(1,T.left/sg.d)))).toFixed(1);
  fGo.textContent=T.running?'Pause':(T.state==='done'?'Done':'Start');
}
function setFocus(on){
  FOCUS=on;
  if(!fEl)return;
  fEl.classList.toggle('on',on);
  if(on){paintFocus();if(T&&T.running)mediaOn();}else{fEl.classList.remove('fwork','frest','fprep','fdone');if(fSparks)fSparks.innerHTML='';}
}
const tfocus=document.getElementById('tfocus');
if(tfocus)tfocus.addEventListener('click',()=>setFocus(true));
const fx=document.getElementById('fx');
if(fx)fx.addEventListener('click',()=>setFocus(false));
function focusBtn(i){
  /* at the end of a session the big button is the point: bank it and leave */
  if(i===0&&T&&T.state==='done'){if(!isDone(wIdx,dIdx))toggleDone(wIdx,dIdx);setFocus(false);return;}
  const t=[elGo,elSkip,elReset][i];if(t)t.click();paintFocus();
}
['fgo','fskip','freset'].forEach((id,i)=>{const b=document.getElementById(id);if(b)b.addEventListener('click',()=>focusBtn(i));});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(cardviewEl&&cardviewEl.classList&&cardviewEl.classList.contains('on'))closeFightCard();else if(FOCUS)setFocus(false);}});

/* ---- views ---- */
const weekView=document.getElementById('weekView'),movesView=document.getElementById('movesView'),gearView=document.getElementById('gearView'),logView=document.getElementById('logView'),iqView=document.getElementById('iqView'),timerbar=document.getElementById('timerbar'),vWeek=document.getElementById('vWeek'),vMoves=document.getElementById('vMoves'),vGear=document.getElementById('vGear'),vLog=document.getElementById('vLog'),vIQ=document.getElementById('vIQ');
function setView(v){weekView.style.display=v==='week'?'':'none';movesView.style.display=v==='moves'?'':'none';gearView.style.display=v==='gear'?'':'none';logView.style.display=v==='log'?'':'none';iqView.style.display=v==='iq'?'':'none';
 /* the timer bar follows you off the Week tab while a session is live, so
    checking a move or logging a weigh-in mid-round does not hide your clock */
 timerbar.style.display=(v==='week'||(T&&T.segs&&T.state==='run'))?'':'none';vWeek.classList.toggle('active',v==='week');vMoves.classList.toggle('active',v==='moves');vGear.classList.toggle('active',v==='gear');vLog.classList.toggle('active',v==='log');vIQ.classList.toggle('active',v==='iq');try{
  document.body.classList.toggle('nobar',timerbar.style.display==='none');
  [vWeek,vMoves,vGear,vLog,vIQ].forEach(b=>b.setAttribute('aria-selected',String(b.classList.contains('active'))));
 }catch(e){}
 if(v==='log')buildGrid();if(v==='iq')paintCard();if(v!=='week'&&!(T&&T.running)){callerStop();}else if(T&&T.running&&T.segs&&T.segs[T.i]&&T.segs[T.i].type==='work'){callerStart();}window.scrollTo(0,0);}
vWeek.addEventListener('click',()=>setView('week'));
vMoves.addEventListener('click',()=>setView('moves'));
vGear.addEventListener('click',()=>setView('gear'));
vLog.addEventListener('click',()=>setView('log'));
vIQ.addEventListener('click',()=>setView('iq'));

/* ---- storage ---- */
async function saveWeek(i){try{await storage.set('forge:week',String(i));;SAVEFAIL='';}catch(e){SAVEFAIL='Could not save to this browser. Your phone storage may be full or in private mode. Copy a backup now, before you lose anything.';try{paintTools();}catch(_){}}}
async function saveDone(){try{await storage.set('forge:done',JSON.stringify(DONE));;SAVEFAIL='';}catch(e){SAVEFAIL='Could not save to this browser. Your phone storage may be full or in private mode. Copy a backup now, before you lose anything.';try{paintTools();}catch(_){}}}
async function saveOpts(){try{await storage.set('forge:opts',JSON.stringify({v:VOICE_ON,c:CALLER_ON,bag:BAG_ON,p:PARTNER_ON,gl:GLOVES_ON,wr:WRAPS_ON,goals:GOALS,snd:SND}));;SAVEFAIL='';}catch(e){SAVEFAIL='Could not save to this browser. Your phone storage may be full or in private mode. Copy a backup now, before you lose anything.';try{paintTools();}catch(_){}}}
async function saveIQ(){try{await storage.set('forge:iq',JSON.stringify(IQ));;SAVEFAIL='';}catch(e){SAVEFAIL='Could not save to this browser. Your phone storage may be full or in private mode. Copy a backup now, before you lose anything.';try{paintTools();}catch(_){}}}
async function saveBW(){try{await storage.set('forge:bw',JSON.stringify(BW));;SAVEFAIL='';}catch(e){SAVEFAIL='Could not save to this browser. Your phone storage may be full or in private mode. Copy a backup now, before you lose anything.';try{paintTools();}catch(_){}}}
async function saveNotes(){try{await storage.set('forge:notes',JSON.stringify(NOTES));;SAVEFAIL='';}catch(e){SAVEFAIL='Could not save to this browser. Your phone storage may be full or in private mode. Copy a backup now, before you lose anything.';try{paintTools();}catch(_){}}}
async function saveStart(){try{await storage.set('forge:start',String(START||''));;SAVEFAIL='';}catch(e){SAVEFAIL='Could not save to this browser. Your phone storage may be full or in private mode. Copy a backup now, before you lose anything.';try{paintTools();}catch(_){}}}
async function saveKey(k,v){try{await storage.set(k,v);SAVEFAIL='';}catch(e){SAVEFAIL='Could not save to this browser. Your phone storage may be full or in private mode. Copy a backup now, before you lose anything.';try{paintTools();}catch(_){}}}
function saveSkip(){return saveKey('forge:skip',JSON.stringify(SKIP));}
function saveResume(){return saveKey('forge:resume',JSON.stringify(RESUME));}
function saveExtra(){return saveKey('forge:extra',JSON.stringify(EXTRA));}
function saveCamps(){return saveKey('forge:camps',JSON.stringify(CAMPS));}
function saveBk(){return saveKey('forge:bk',BK);}
function saveFinish(){return saveKey('forge:finish',JSON.stringify(FINISH));}
async function saveChecks(){try{await storage.set('forge:check',JSON.stringify(CHECKS));SAVEFAIL='';}catch(e){SAVEFAIL='Could not save to this browser. Your phone storage may be full or in private mode. Copy a backup now, before you lose anything.';try{paintTools();}catch(_){}}}
let NAMES=[],ONBOARD=false;
const cardviewEl=document.getElementById('cardview'),heroEl=document.getElementById('hero'),onboardEl=document.getElementById('onboard'),campbarEl=document.getElementById('campbar'),finaleEl=document.getElementById('finale');
/* First open on a fresh phone: who are you, what do you have, why are you
   here. Three questions, then the camp is theirs. */
function paintOnboard(){
  try{document.body.classList.toggle('ready',!ONBOARD);}catch(e){}
  if(!onboardEl)return;
  if(!ONBOARD){onboardEl.innerHTML='';return;}
  const chip=(id,label,on)=>`<button class="sw obchip${on?' on':''}" data-ob="${id}" type="button">${on?'&#9679;':'&#9675;'} ${label}</button>`;
  const st=OB_STATE;
  onboardEl.innerHTML=`<div class="card obcard"><div class="cardhead"><span class="cardtitle">Who is training?</span></div>
    <div class="bwnote">This camp is about to be yours: your own log, your own weigh-ins, your own coach. Nothing here is shared with anyone.</div>
    <div class="bwform"><input class="srch bwinput" id="obname" type="text" maxlength="20" placeholder="your first name" value="${esc(st.name)}"></div>
    <div class="bwnote">What do you have right now? Tap what applies, the program adapts around it.</div>
    <div class="bwchips">${chip('gloves','Boxing gloves',st.gloves)}${chip('wraps','Hand wraps',st.wraps)}${chip('bag','Heavy bag',st.bag)}${chip('partner','Training partner',st.partner)}</div>
    <div class="bwnote">Why are you here? Pick any that fit.</div>
    <div class="bwchips">${chip('g1','Learn to strike',st.g1)}${chip('g2','Get conditioned',st.g2)}${chip('g3','Be ready if it ever goes down',st.g3)}${chip('g4','Head for a real gym',st.g4)}</div>
    <div class="bwnote">Your 10 weeks start on the Monday below. Change it if you want.</div>
    <div class="bwform"><input class="srch bwinput" id="obstart" type="date" value="${st.start}"><button class="sw pri" id="obgo" type="button">Start the camp</button>${WHO?'<button class="sw" id="obcancel" type="button">Cancel</button>':''}</div>
    <div id="obmsg" class="bwnote"></div></div>`;
  const oc=document.getElementById('obcancel');
  if(oc)oc.addEventListener('click',()=>{ONBOARD=false;paintOnboard();paintCampBar();});
  onboardEl.querySelectorAll('.obchip').forEach(c=>c.addEventListener('click',()=>{
    const id=c.dataset.ob;OB_STATE[id]=!OB_STATE[id];
    const nm=document.getElementById('obname'),dt=document.getElementById('obstart');
    if(nm)OB_STATE.name=nm.value;if(dt&&parseISO(dt.value))OB_STATE.start=dt.value;
    paintOnboard();
  }));
  const go=document.getElementById('obgo');
  if(go)go.addEventListener('click',async()=>{
    const nm=document.getElementById('obname');
    const name=(nm&&nm.value||'').trim();
    const msg=document.getElementById('obmsg');
    if(!name){if(msg)msg.textContent='It needs a name. That is the whole login.';return;}
    const slug=slugOf(name);
    if(!slug){if(msg)msg.textContent='Use letters or numbers in the name.';return;}
    if(NAMES.some(n=>slugOf(n)===slug)){if(msg)msg.textContent='That name is already on this phone. Pick another, or switch to them under Fighter in the Log tab.';return;}
    const dt=document.getElementById('obstart');
    const startPick=(dt&&parseISO(dt.value))?isoOf(mondayOf(parseISO(dt.value))):defaultStart();
    WHO=name;
    NAMES.push(name);
    ONBOARD=false;
    await saveWho();
    /* write their choices into THEIR namespace, then boot into it */
    GLOVES_ON=OB_STATE.gloves;WRAPS_ON=OB_STATE.wraps;BAG_ON=OB_STATE.bag;PARTNER_ON=OB_STATE.partner;
    GOALS=[OB_STATE.g1&&'learn striking',OB_STATE.g2&&'get conditioned',OB_STATE.g3&&'be ready if it ever goes down',OB_STATE.g4&&'walk into a real gym'].filter(Boolean).join(', ');
    START=startPick;
    await saveOpts();await saveStart();
    try{await storage.set('forge:startv',START_MIGRATION);}catch(e){}
    boot();
  });
}
const OB_STATE={name:'',gloves:false,wraps:false,bag:false,partner:false,g1:true,g2:true,g3:false,g4:false,start:forwardMonday()};
/* the camp as a bar you can watch fill: day marker over 70, in phase color */
function paintHero(){
  if(!heroEl)return;
  const slot=todaySlot();
  if(ONBOARD||campPhase()!=='live'||!slot||lapsed()||wIdx!==slot.w||dIdx!==slot.d){heroEl.innerHTML='';return;}
  const w=W[slot.w],k=DK[slot.d],md=DAYMETA[k],day=w.d[k];
  const stamp=DONE[dkey(slot.w,slot.d)],doneToday=stamp===todayISO(),earlier=!!stamp&&!doneToday;
  const dn=Math.min(70,Math.max(1,campDayCount()));
  heroEl.innerHTML='<div class="hero" style="--ph:var('+(PCOL[slot.w]||'--ember')+')"><div class="hk">TODAY &middot; WEEK '+w.n+' &middot; DAY '+dn+' OF 70</div><div class="ht">'+md.title+'</div><div class="hm">'+LASTTOT+' MIN &middot; '+typeText[md.type].toUpperCase()+' &middot; INTENSITY '+md.intensity+'/5</div><div class="hq">CORNER &middot; '+esc(cornerOfDay())+'</div>'+
    (doneToday?'<div class="hdone">Logged. That is the day.</div>':(earlier?'<div class="hdone">Logged '+esc(shortDate(stamp))+', not today.</div>':'')+'<div class="hbtns">'+(day.tm?'<button class="hgo" data-act="herostart" type="button">Start</button>':'')+'<button class="hmark" data-act="'+(earlier?'trainnow':'marktoday')+'" type="button">'+(earlier?'Train today':'Mark done')+'</button></div>')+'</div>';
}
function paintCampBar(){
  if(!campbarEl)return;
  if(ONBOARD){campbarEl.innerHTML='';return;}
  const ph=campPhase(),slot=todaySlot(),tot=totDone();
  const camp=CAMPS.length?'CAMP '+(CAMPS.length+1)+' &middot; ':'';
  const who=WHO?' &middot; '+esc(WHO).toUpperCase():'';
  let bar='',label='';
  if(ph==='live'){
    const n=Math.max(1,Math.min(70,campDayCount()));
    bar='<div class="cbtrack"><div class="cbfill" style="width:'+Math.max(1,Math.round(100*n/70))+'%;background:var('+(PCOL[slot.w]||'--ember')+')"></div></div>';
    label=camp+'DAY '+n+' OF 70'+who;
  }else if(ph==='over'){
    bar='<div class="cbtrack"><div class="cbfill" style="width:'+Math.max(1,Math.round(100*tot/70))+'%;background:var(--p5)"></div></div>';
    label=camp+'CAMP ENDED &middot; '+tot+'/70'+who;
  }else if(ph==='pre'){
    bar='<div class="cbtrack"><div class="cbfill" style="width:1%"></div></div>';
    label=camp+'CAMP STARTS '+shortDate(START).toUpperCase()+who;
  }
  campbarEl.innerHTML=(bar?bar+'<div class="cblabel">'+label+'</div>':'')+lifeBannerHTML();
}
async function saveWho(){try{await rawstorage.set('forge:who',WHO);await rawstorage.set('forge:names',JSON.stringify(NAMES));}catch(e){}}
async function boot(){
  /* who is training on this device, before any namespaced key is read */
  try{
    const w=await rawstorage.get('forge:who');
    if(w&&typeof w.value==='string')WHO=w.value;
    const nm=await rawstorage.get('forge:names');
    if(nm&&nm.value){const a=JSON.parse(nm.value);if(Array.isArray(a))NAMES=a.filter(x=>typeof x==='string'&&x);}
  }catch(e){}
  if(WHO)ONBOARD=false;
  if(!WHO){
    /* legacy install: data exists but no profile was ever named. That is the
       original fighter; claim the un-prefixed keys silently, ask nothing. */
    let legacy=false;
    try{const r=await rawstorage.get('forge:done');legacy=!!(r&&r.value);}catch(e){}
    if(!legacy){try{const r=await rawstorage.get('forge:start');legacy=!!(r&&r.value);}catch(e){}}
    if(legacy){WHO='Jackson';if(NAMES.indexOf('Jackson')<0)NAMES.push('Jackson');saveWho();}
    else ONBOARD=true;
  }
  if(ONBOARD){
    /* nobody is named yet: run on in-memory defaults and persist NOTHING.
       Writing forge:start here would make the legacy check claim the next
       boot as the original fighter, so a buddy who opens the app and closes
       it before answering would wake up as someone else. */
    DONE={};IQ={r:0,w:0};BW=[];NOTES={};CHECKS={};SKIP={};EXTRA=[];CAMPS=[];FINISH=null;RESUME=null;PRECAMP=null;BK='';BENCH=[];
    VOICE_ON=true;CALLER_ON=true;BAG_ON=true;PARTNER_ON=false;GLOVES_ON=true;WRAPS_ON=true;GOALS='';SND='bell';
    START=forwardMonday();
    recomputeBagWeek();
    const slot0=todaySlot();
    if(slot0){wIdx=slot0.w;dIdx=slot0.d;}
    selectWeek(wIdx);selectDay(dIdx);paintDone();buildGrid();paintIQ();paintOnboard();
    return;
  }
  /* reset per-profile state so switching fighters never leaks a log across */
  DONE={};IQ={r:0,w:0};BW=[];NOTES={};CHECKS={};START=null;SKIP={};EXTRA=[];CAMPS=[];FINISH=null;RESUME=null;PRECAMP=null;BK='';BENCH=[];
  PRERESTORE=null;MAKEUP=null;qcur=null;SAVEFAIL='';CUT=0;RB.open=false;
  VOICE_ON=true;CALLER_ON=true;BAG_ON=true;PARTNER_ON=false;GLOVES_ON=true;WRAPS_ON=true;GOALS='';SND='bell';
  try{const r=await storage.get('forge:done');if(r&&r.value)DONE=JSON.parse(r.value)||{};}catch(e){}
  try{const r=await storage.get('forge:iq');if(r&&r.value){const q=JSON.parse(r.value);if(q&&typeof q.r==='number')IQ=q;}}catch(e){}
  try{const r=await storage.get('forge:opts');if(r&&r.value){const o=JSON.parse(r.value);if(o){VOICE_ON=o.v!==false;CALLER_ON=o.c!==false;BAG_ON=o.bag!==false;PARTNER_ON=o.p===true;GLOVES_ON=o.gl!==false;WRAPS_ON=o.wr!==false;GOALS=typeof o.goals==='string'?o.goals:'';SND=o.snd==='classic'?'classic':'bell';}}}catch(e){}
  try{const r=await storage.get('forge:bw');if(r&&r.value){const b=JSON.parse(r.value);if(Array.isArray(b))BW=b.filter(x=>x&&x.d&&isFinite(x.w));}}catch(e){}
  try{const r=await storage.get('forge:notes');if(r&&r.value){const n=JSON.parse(r.value);if(n&&typeof n==='object')NOTES=n;}}catch(e){}
  try{const r=await storage.get('forge:check');if(r&&r.value){const c=JSON.parse(r.value);if(c&&typeof c==='object')CHECKS=c;}}catch(e){}
  try{const r=await storage.get('forge:skip');if(r&&r.value){const s=JSON.parse(r.value);if(s&&typeof s==='object'&&!Array.isArray(s))SKIP=s;}}catch(e){}
  try{const r=await storage.get('forge:extra');if(r&&r.value){const x=JSON.parse(r.value);if(Array.isArray(x))EXTRA=x.filter(y=>y&&y.d&&isFinite(y.m));}}catch(e){}
  try{const r=await storage.get('forge:camps');if(r&&r.value){const x=JSON.parse(r.value);if(Array.isArray(x))CAMPS=x.filter(y=>y&&typeof y==='object');}}catch(e){}
  try{const r=await storage.get('forge:finish');if(r&&r.value){const x=JSON.parse(r.value);if(x&&typeof x==='object')FINISH=x;}}catch(e){}
  try{const r=await storage.get('forge:bench');if(r&&r.value){const x=JSON.parse(r.value);if(Array.isArray(x))BENCH=x.filter(y=>y&&y.d&&y.t&&isFinite(y.v));}}catch(e){}
  try{const r=await storage.get('forge:bk');if(r&&r.value&&parseISO(r.value))BK=r.value;}catch(e){}
  try{const r=await storage.get('forge:resume');if(r&&r.value){const x=JSON.parse(r.value);if(x&&typeof x==='object'&&x.start&&Array.isArray(x.added))RESUME=x;}}catch(e){}
  try{const r=await storage.get('forge:start');if(r&&r.value&&parseISO(r.value))START=r.value;}catch(e){}
  /* One-time correction for the ORIGINAL install only: earlier builds guessed
     a start date. New fighters pick their own start in onboarding, and it must
     never be overwritten by a migration meant for someone else's history. */
  if(coachNamed())try{
    const mv=await storage.get('forge:startv');
    if(!mv||mv.value!==START_MIGRATION){
      START=CAMP_START;saveStart();
      await storage.set('forge:startv',START_MIGRATION);
    }
  }catch(e){}
  if(!START){START=defaultStart();saveStart();}
  try{const r=await storage.get('forge:week');if(r&&r.value!=null){const i=parseInt(r.value,10);if(i>=0&&i<W.length){wIdx=i;}}}catch(e){}
  recomputeBagWeek();
  /* if today falls inside the camp, open on today rather than wherever you were */
  const slot=todaySlot();
  if(slot){wIdx=slot.w;dIdx=slot.d;}
  else if(campPhase()==='over'){
    /* past the end: open on the next session you have not done, not week 1 */
    const nx=Math.min(W.length*7-1,highestLogged()+1);
    wIdx=Math.floor(nx/7);dIdx=nx%7;
  }
  PAINTED_DAY=todayISO();
  selectWeek(wIdx);selectDay(dIdx);paintDone();buildGrid();paintIQ();paintOnboard();
}

/* ---- init ---- */
const dmap={1:0,2:1,3:2,4:3,5:4,6:5,0:6};
selectWeek(0);
selectDay(dmap[new Date().getDay()]);
setView('week');
buildGrid();
boot();

/* ---- build stamp ----
   So you can tell at a glance whether the phone actually picked up an update,
   instead of guessing why a fix does not seem to be there. */
(function(){try{
  const f=document.querySelector('#weekView footer');
  if(f)f.innerHTML='Tap any drill for the how-to and a video search.<br>Build '+BUILD+(CLIPS?' &middot; '+Object.keys(CLIPS.map).length+' coach clips':' &middot; coach clips not loaded');
  const c=document.getElementById('buildchip');
  if(c)c.textContent=BUILD;
}catch(e){}})();

/* ---- service worker ---- */
/* ---- updates ----
   A new build used to sit unseen until the app was killed twice. Now the page
   notices, says so, and applies it with one tap, never mid-session. */
let SWREG=null,WANT_RELOAD=false,RELOADING=false,SWAPPED=false,LASTCHECK=0;
const updbar=document.getElementById('updbar');
function updateReady(){return !!(SWAPPED||(SWREG&&SWREG.waiting&&navigator.serviceWorker&&navigator.serviceWorker.controller));}
function paintUpdate(){
  if(!updbar)return;
  const on=updateReady()&&!sessionRunning();
  updbar.style.display=on?'':'none';
  try{document.body.classList.toggle('hasupd',on);}catch(e){}
}
function applyUpdate(){
  if(sessionRunning())return;
  WANT_RELOAD=true;
  try{if(SWREG&&SWREG.waiting){SWREG.waiting.postMessage({type:'SKIP_WAITING'});setTimeout(()=>{if(!RELOADING){RELOADING=true;location.reload();}},2500);return;}}catch(e){}
  RELOADING=true;location.reload();
}
function checkUpdate(force){
  if(!SWREG)return Promise.resolve();
  const n=Date.now();
  if(!force&&n-LASTCHECK<30*60*1000)return Promise.resolve();
  LASTCHECK=n;
  return SWREG.update().then(paintUpdate).catch(()=>{});
}
/* the probe asks for a URL the service worker cannot answer from cache, so a
   phone with no connection is told so BEFORE anything is deleted */
async function repairApp(){
  const um=t=>{const e=document.getElementById('updmsg');if(e)e.textContent=t;};
  let ok=false;
  try{const r=await fetch('./index.html?repair='+Date.now(),{cache:'no-store'});ok=r.ok&&/forge/i.test(await r.text());}catch(e){}
  if(!ok){um('Repair needs internet. You are offline, so nothing was changed.');return false;}
  try{const rg=await navigator.serviceWorker.getRegistrations();for(const r of rg)await r.unregister();}catch(e){}
  try{const ks=await caches.keys();for(const k of ks)if(/^forge-v/.test(k))await caches.delete(k);}catch(e){}
  location.reload();
  return true;
}
const ugo=document.getElementById('updgo');
if(ugo)ugo.addEventListener('click',applyUpdate);
if('serviceWorker' in navigator){
  const hadController=!!navigator.serviceWorker.controller;
  /* tells an installing build that this page can show the Update bar, so it
     waits for the tap instead of swapping underneath a session */
  navigator.serviceWorker.onmessage=e=>{if(e.data&&e.data.type==='PING_UPDATE'&&e.source&&e.source.postMessage)e.source.postMessage({type:'CAN_PROMPT'});};
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>{
      SWREG=reg;
      reg.addEventListener('updatefound',()=>{const nw=reg.installing;if(nw)nw.addEventListener('statechange',()=>{if(nw.state==='installed')paintUpdate();});});
      paintUpdate();checkUpdate(true);
    }).catch(()=>{});
  });
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(WANT_RELOAD){if(!RELOADING){RELOADING=true;location.reload();}}
    else if(hadController){SWAPPED=true;paintUpdate();}
  });
}
