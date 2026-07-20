/* ---- storage: same call shape as the artifact API, backed by localStorage outside artifacts ---- */
const storage = window.storage ?? {
  get: async k => { const v = localStorage.getItem(k); return v == null ? null : { value: v }; },
  set: async (k, v) => { localStorage.setItem(k, v); return {}; },
};

/* ---------------- RENDER ---------------- */
const DK=['mon','tue','wed','thu','fri','sat','sun'];
const typeColor={technical:'--steel',moderate:'--ember',hard:'--ember',recovery:'--restore'};
const typeText={technical:'Technical',moderate:'Skill + Work',hard:'Hard',recovery:'Restore'};
function css(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim();}
function fmt(s){const m=Math.floor(s/60),ss=s%60;return String(m).padStart(2,'0')+':'+String(ss).padStart(2,'0');}
/* ---- inline move lookup ---- */
const ALIAS={
 'Fighting Stance':['stance'],
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
 'Slip':['slip','slip the swing'],
 'Roll (Bob-and-Weave)':['roll'],
 'Parry':['parry'],
 'Catch':['catch'],
 'Shell (High Guard)':['shell'],
 'Long Guard':['long guard','frame'],
 'Pull':['pull'],
 'Shoulder Roll':['shoulder roll'],
 'Check Hook':['check hook'],
 'Pull Counter':['pull counter','pull, then'],
 'Cross Counter':['cross counter'],
 'Roll Counter':['roll counter','roll, then'],
 'Sprawl Counter':['sprawl into','sprawl counter'],
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
function liRich(arr){
  return arr.map(it=>{
    const label=it[0],cue=it.length>1?it[1]:'';
    const mv=matchMove(label);
    if(!mv)return `<li><b>${label}</b>${cue?`<span class="cue"> ${cue}</span>`:''}</li>`;
    const det=`<div class="ldet"><div class="ldtag">${mv.tag}</div><ul>${mv.steps.map(s=>`<li>${s}</li>`).join('')}</ul><div class="ldcue"><b>FIX:</b> ${mv.cue}</div><div class="ldvid"><b>VIDEO:</b> "${mv.vid}"</div></div>`;
    return `<li class="exp"><button class="lrow lbtn" type="button"><b>${label}</b>${cue?`<span class="cue"> ${cue}</span>`:''}<span class="chev">&#9656;</span></button>${det}</li>`;
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
    const FIX={'Rear Hook (4)':0,'Rear Uppercut (6)':0,'Roundhouse':0,'Head Kick':0,'Shell':2,'Pull':3,'Level Change':1,'The Rest':0,'T-Spine Opener':0};
    const CATFALL={'Bag Work':4};
    CATS.forEach(c=>c.moves.forEach(m=>{
      if(MOVEWEEK[m.name]===undefined)
        MOVEWEEK[m.name]=FIX[m.name]!==undefined?FIX[m.name]:(CATFALL[c.cat]!==undefined?CATFALL[c.cat]:0);
    }));
  }catch(e){}
})();
function newIn(wi){return Object.keys(MOVEWEEK).filter(n=>MOVEWEEK[n]===wi);}

let wIdx=0,dIdx=0;
let DONE={};
function todayISO(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function dkey(w,d){return w+'-'+d;}
function isDone(w,d){return !!DONE[dkey(w,d)];}
function toggleDone(w,d){const k=dkey(w,d);if(DONE[k])delete DONE[k];else DONE[k]=todayISO();saveDone();paintDone();render();buildGrid();}
function weekFull(i){for(let d=0;d<7;d++)if(!isDone(i,d))return false;return true;}
function paintDone(){
  document.querySelectorAll('.wchip').forEach((c,x)=>c.classList.toggle('full',weekFull(x)));
  document.querySelectorAll('.daytab .dot').forEach((dt,x)=>dt.classList.toggle('dn',isDone(wIdx,x)));
}
const RANKS=[[0,'Walk-on'],[1,'Debut'],[7,'Novice'],[14,'Amateur'],[28,'Prospect'],[42,'Contender'],[56,'Main Card'],[70,'Camp Done']];
function rankOf(n){let r=RANKS[0][1];RANKS.forEach(x=>{if(n>=x[0])r=x[1];});return r;}
function streak(){
  const days=new Set(Object.values(DONE));
  let n=0;const d=new Date();
  for(let i=0;i<400;i++){
    const iso=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    if(days.has(iso)){n++;}else if(i>0){break;}
    d.setDate(d.getDate()-1);
  }
  return n;
}

const stripEl=document.getElementById('weekstrip');
W.forEach((w,i)=>{const b=document.createElement('button');b.className='wchip';b.textContent=w.n;
 b.addEventListener('click',()=>{selectWeek(i);saveWeek(i);});stripEl.appendChild(b);});

const daysEl=document.getElementById('days');
DK.forEach((k,i)=>{const m=DAYMETA[k];const b=document.createElement('button');b.className='daytab';
 b.innerHTML=`<span class="abbr">${m.abbr}</span><span class="dot" style="background:var(${typeColor[m.type]})"></span>`;
 b.addEventListener('click',()=>selectDay(i));daysEl.appendChild(b);});

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
  const rl=day.tm?`${day.tm.rounds} x ${fmt(day.tm.work)}`:'';
  const B=[];
  const dt=adaptItems(day.t),dr=adaptItems(day.r);
  if(m.warm)B.push({n:'Warm-up',s:'Warm',du:'5 min',it:WARM[m.warm]});
  if(k==='thu'||k==='sat'){B.push({n:'Work',s:'Work',du:rl,it:dt});B.push({n:'Finisher',s:'Fin',du:'5 min',it:dr,sec:1});}
  else if(k==='sun'){B.push({n:'Session',s:'Flow',du:'40 min',it:dt});if(dr&&dr.length)B.push({n:'Checkpoint',s:'Chk',du:'',it:dr,sec:1});}
  else{B.push({n:'Technique',s:'Tech',du:'15 min',it:dt});B.push({n:'Rounds',s:'Rnds',du:rl,it:dr,sec:1});}
  if(PARTNER_ON&&PARTNER[k]&&PARTNER[k].length&&k!=='sun')B.push({n:'With a partner',s:'Duo',du:'',it:PARTNER[k],sec:1});
  if(m.cool)B.push({n:'Cooldown',s:'Cool',du:'5 min',it:COOL[m.cool]});
  let tot=0,flow='';
  B.forEach(b=>{const mn=durMin(b.du);tot+=mn;if(mn>0)flow+=`<div class="fseg" style="flex:${mn}"><span class="fl">${b.s}</span><span class="fm">${mn}'</span></div>`;});
  const flowbar=`<div class="flow">${flow}<div class="ftot">&#8776; ${tot} min</div></div>`;
  const blocks=B.map(b=>b.it&&b.it.length?`<div class="block${b.sec?' sec':''}"><div class="blabel"><span class="name">${b.n}</span><span class="dur">${b.du}</span></div><ul class="items">${liRich(b.it)}</ul></div>`:'').join('');
  panel.innerHTML=`
   <div class="phase" style="border-left-color:var(${PCOL[wIdx]})"><div class="ph" style="color:var(${PCOL[wIdx]})">Week ${w.n} of 10 · ${w.phase}</div><div class="th">${w.theme}</div><div class="nt">${adaptNote(w.note)}</div>${nw.length?`<div class="nlab">New this week</div><div class="newrow">${nw.slice(0,6).map(n=>`<span class="nchip">${n}</span>`).join('')}${nw.length>6?`<span class="nchip" style="color:var(--muted)">+${nw.length-6} more</span>`:''}</div>`:''}</div>
   <div class="dhead"><div><div class="dtitle">${m.title}</div><div class="dfocus">${m.focus}</div></div><span class="badge" style="color:${col};border-color:${col}">${typeText[m.type]}</span></div>
   <div class="meter">${segs}<span class="mlabel">Intensity ${m.intensity}/5</span></div>
   <div class="swrow"><button class="sw${VOICE_ON?' on':''}" id="swV" type="button">${VOICE_ON?'&#9679;':'&#9675;'} Voice coach</button><button class="sw${CALLER_ON?' on':''}" id="swC" type="button">${CALLER_ON?'&#9679;':'&#9675;'} Combo caller</button></div>
   <div class="swrow"><button class="sw${BAG_ON?' on':''}" id="swB" type="button">${BAG_ON?'&#9679;':'&#9675;'} Heavy bag</button><button class="sw${PARTNER_ON?' on':''}" id="swP" type="button">${PARTNER_ON?'&#9679;':'&#9675;'} Partner</button></div>
   ${flowbar}
   ${blocks}
   ${m.flag?`<div class="flag">${m.flag}</div>`:''}
   ${(!BAG_ON&&wIdx>=4)?`<div class="flag">No bag mode: bag drills above are swapped for their shadow versions. Chase snap and full retraction instead of impact.</div>`:''}
   ${(PARTNER_ON&&k!=='sun')?`<div class="flag">${PARTNER_RULES}</div>`:''}
   <div class="dbtnwrap"><button class="dbtn${isDone(wIdx,dIdx)?' on':''}" id="dbtn" type="button">${isDone(wIdx,dIdx)?'&#10003; Session logged':'Mark session done'}</button></div>`;
  const db=document.getElementById('dbtn');
  if(db)db.addEventListener('click',()=>toggleDone(wIdx,dIdx));
  const sv=document.getElementById('swV');
  if(sv)sv.addEventListener('click',()=>{VOICE_ON=!VOICE_ON;if(!VOICE_ON){vstop();callerStop();}saveOpts();render();});
  const sc=document.getElementById('swC');
  if(sc)sc.addEventListener('click',()=>{CALLER_ON=!CALLER_ON;if(!CALLER_ON)callerStop();else if(T&&T.running)callerStart();saveOpts();render();});
  const sb=document.getElementById('swB');
  if(sb)sb.addEventListener('click',()=>{BAG_ON=!BAG_ON;saveOpts();render();});
  const sp=document.getElementById('swP');
  if(sp)sp.addEventListener('click',()=>{PARTNER_ON=!PARTNER_ON;saveOpts();render();});
  paintDone();
  loadTimer(k,day);
 }catch(e){if(panel)panel.innerHTML='<div class="empty"><b>Hiccup</b>Could not draw that day. Tap another day, then come back.</div>';}
}
function selectWeek(i){
  wIdx=i;
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
function selectDay(i){dIdx=i;document.querySelectorAll('.daytab').forEach((t,x)=>t.classList.toggle('active',x===i));render();
 const t=document.querySelectorAll('.daytab')[i];if(t)t.scrollIntoView({inline:'center',block:'nearest',behavior:'smooth'});}

/* ---- log grid ---- */
const gridEl=document.getElementById('grid'),statsEl=document.getElementById('stats');
function buildGrid(){
  if(!gridEl)return;
  const tw=wIdx,td=dIdx;
  let h=`<div class="ghead"><span class="gwn"></span>${DK.map(k=>`<span class="ghd">${DAYMETA[k].abbr[0]}</span>`).join('')}</div>`;
  W.forEach((w,i)=>{
    h+=`<div class="grow"><span class="gwn">W${w.n}</span>`;
    for(let d=0;d<7;d++){
      const on=isDone(i,d)?' on':'';
      const tn=(i===tw&&d===td)?' today':'';
      h+=`<button class="gcell${on}${tn}" data-w="${i}" data-d="${d}" aria-label="Week ${w.n} ${DAYMETA[DK[d]].abbr}"></button>`;
    }
    h+='</div>';
  });
  gridEl.innerHTML=h;
  const tot=Object.keys(DONE).length;
  const eg=document.getElementById('logempty');
  if(eg)eg.style.display=tot?'none':'';
  statsEl.innerHTML=`<div class="stat"><div class="sv">${tot}-0</div><div class="sl">record</div></div>
   <div class="stat"><div class="sv">${streak()}</div><div class="sl">day streak</div></div>
   <div class="stat"><div class="sv" style="font-size:.95rem;padding:6px 0 5px">${rankOf(tot)}</div><div class="sl">rank</div></div>`;
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
      <div class="mvid"><b>VIDEO:</b> "${mv.vid}"</div></div>`;});
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
if(srch)srch.addEventListener('input',()=>{
  const q=srch.value.trim().toLowerCase();
  document.querySelectorAll('#moves .msection').forEach(sec=>{
    let vis=0;
    sec.querySelectorAll('.move').forEach(mv=>{
      const hit=!q||mv.textContent.toLowerCase().includes(q);
      mv.classList.toggle('hide',!hit);if(hit)vis++;
    });
    sec.classList.toggle('hide',q&&!vis);
  });
});

/* ---- voice engine ---- */
const NAME='Jackson';
const VP={
 open:['Alright','Here we go','Let us go','Time to work','Okay'],
 begin:['Let us go.','Here we go.','Time to work.','Get after it.','Go to work.'],
 push:['Go.','Up.','Now.','Move.','Let us go.','On it.'],
 praise:['That is it.','Nice.','Good.','Beautiful.','Yes.','Sharp.','There it is.','Clean.','Keep going.','Love that.'],
 half:['Halfway. Stay sharp.','Thirty seconds. Keep it clean.','Thirty left. Hands up.','Halfway there. Breathe.','Thirty. Stay long.'],
 ten:['Ten seconds. Finish strong.','Ten. Empty it out.','Last ten. Dig in.','Ten seconds. Do not coast.','Ten. Give me everything.'],
 tenlast:['Last ten of the session. Empty the tank.','Ten seconds left. Leave nothing.','Last ten. Finish it.'],
 rest:['Nice work. Breathe.','Good round. Breathe it down.','That is a round. Shake it out.','Good work. Reset.','Nice. Get your air back.','That is the way. Breathe.'],
 lastwork:['Last round. Leave nothing.','Final round. Everything you have.','Last one. Make it the best one.','This is the last one. Empty it.'],
 done:['That is the session.','Session done.','That is it for today.','Work is done.'],
 donetail:['Good work, '+NAME+'. Go log it.','Well done, '+NAME+'. Log it.','Nice work today, '+NAME+'. Log it.']
};
function vrand(a){return a&&a.length?a[Math.floor(Math.random()*a.length)]:'';}
let VOICE_ON=true,CALLER_ON=true,vvoice=null,vready=false;
let BAG_ON=true,PARTNER_ON=false;
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
function say(t,cut){
  if(!VOICE_ON||!t)return;
  const txt=vnorm(t);
  if(!txt)return;
  try{if(cut)speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(txt);u.rate=1.02;u.pitch=1.02;u.volume=1;if(vvoice)u.voice=vvoice;speechSynthesis.speak(u);}catch(e){}
}
function vstop(){try{speechSynthesis.cancel();}catch(e){}}

/* ---- combo caller ---- */
const CALLADD={
 1:['Jab','One two','One two three','Two three two','Leg kick','Teep','One two, leg kick','Body kick','Check it','Double jab'],
 2:['One one two','One two three two','One two five two','Calf kick','Switch kick','Kick, hands, kick','One six three','Body jab','Rear teep'],
 3:['One two three two three','Hand, kick, hand','Question mark kick','Three two three','Body, then head','Level fake, one two','Five strikes','Kick, hand, kick'],
 4:['Feint the jab, cross','Hand feint, low kick','Low, low, high','Body feint, uppercut','Teep feint, leg kick','Sell it first','Fake the shot, go high'],
 5:['Check hook','Pull counter','Cross counter','Slip and counter','Sprawl, uppercut','Check and return','Counter it','Make him miss'],
 6:['One two, pivot, hook','Angle, then kick','Switch stance, kick','Circle out','Off angle','In and out','Cut the angle'],
 7:['Sit down on it','Power one two','Kick through it','Heavy hands','Body kick, hard'],
 8:['Walk it down','Hit the return','Chase kick','Punch out','Pressure','Cut him off'],
 9:['Fast fast slow','Pause, then finish','Burst of six','Stutter step','Change the pace','Half beat'],
 10:['Free','Your call','Make it up','Whatever you see','Improvise']
};
const CALLCUE=['Hands up','Snap it back','Pivot','Breathe','Angle off','Chin down','Do not stand still','Land balanced','Turn the hip over','Elbows in','Move your head','Reset your stance','Loose arms, no locked elbows'];
/* free rounds get a cornerman, not a dictation machine: one short tactical
   prompt at a time, real silence between. Lines stay under 8 words. */
const FREECALL=['He is cutting you off. Angle out.','Doubling his jab. Answer it.','You are square. Fix your feet.','Change levels. Body, then head.','Circle off the power hand.','Second combo. Do not admire the first.','Make him miss. Make him pay.','Get in, do the work, get out.','Where is your jab?','He is timing your rhythm. Break it.'];
/* defense rounds: the voice plays the opponent. Weeks 1-4 call the attack and
   the answer, week 5 on calls the attack only so he chooses. */
const DEFPAIR=['Jab. Slip right.','Jab. Slip left.','One two. Catch, then counter.','Hook. Roll under.','Low kick. Check it.','Teep. Parry and step in.','He shoots. Sprawl.'];
const DEFATK=['Jab.','Double jab.','Right hand.','One two.','Lead hook.','Body shot.','Low kick.','Head kick.','Teep.','He shoots.'];
function poolFor(wi){let p=[];for(let i=1;i<=wi+1;i++)p=p.concat(CALLADD[i]||[]);p=p.concat(CALLADD[wi+1]||[]);return p;}
let callT=null;
function callerStop(){if(callT){clearTimeout(callT);callT=null;}}
/* A call must match the round it lands in: no punch combos in a teep round,
   no kick calls in a hands-only round, movement cues only in footwork rounds. */
const KICKCALL=/kick|teep|knee|check/i;
const HANDCALL=/jab|one|two|three|four|five|six|hook|cross|uppercut|body shot|punch|straight|hands|feint the|sell it|fake the shot/i;
function poolFilterFor(label){
  const L=String(label).toLowerCase();
  const teeps=/teep/.test(L),kicks=/kick/.test(L);
  const hands=/jab|hand|punch|box|combo|1-2|straight|counter|body/.test(L);
  if(/footwork only|no punches|feet only|move only|movement only/.test(L))return c=>!KICKCALL.test(c)&&!HANDCALL.test(c);
  if(/jab only|jabs only/.test(L))return c=>/jab/i.test(c)&&!KICKCALL.test(c);
  if(teeps&&!kicks&&!hands)return c=>/teep/i.test(c)&&!HANDCALL.test(c);
  if((teeps||kicks)&&!hands)return c=>KICKCALL.test(c)&&!HANDCALL.test(c);
  if(hands&&!teeps&&!kicks)return c=>!KICKCALL.test(c);
  return null;
}
function fromPool(pool,filter){
  const p=filter?pool.filter(filter):pool;
  return p.length?vrand(p):vrand(CALLCUE.filter(c=>!KICKCALL.test(c)&&!HANDCALL.test(c)));
}
function callerPick(ctx,label){
  const pool=poolFor(wIdx);
  const flavor=ctx==='station'?roundCall(label,DK[dIdx]):ctx;
  const filter=poolFilterFor(label);
  const r=Math.random();
  if(r<0.10)return vrand(VP.praise);
  if(flavor==='defense')return r<0.28?vrand(CALLCUE):vrand(wIdx>=4?DEFATK:DEFPAIR);
  if(flavor==='free')return r<0.32?vrand(CALLCUE):fromPool(FREECALL,filter);
  return r<0.30?vrand(CALLCUE):fromPool(pool,filter);
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
 wed:['Rear heel spins out on the cross.','Retract faster than you throw.','Lead hand stays home when the cross goes.','Light feet today. You squatted.','Do not lean past your front knee.'],
 thu:['Form holds when the arms burn. Slow down before you get ugly.','Breathe through your nose. Bring it down.','Hips heavy on the sprawl.','Output, not flailing.','Land in stance, not flat footed.'],
 fri:['Small slips. A big lean is just a slow miss.','Come up already throwing.','Defense and counter are one motion.','Do not freeze. React and fire.','Eyes up. Hands up.'],
 sat:['Hands up even when you are gassed.','Full extension, full retraction.','Turn the body on every hook.','Last round should look like the first.','Keep the pace honest.'],
 sun:[]
};
function cornerCue(){const a=CORNER[DK[dIdx]]||[];return a.length?a[Math.floor(Math.random()*a.length)]:'';}

/* ---- equipment adaptation ---- */
/* Exact-label swaps for weeks 5-10 when there is no bag yet. Derived from the
   program's own NO BAG YET notes: shadow versions chase snap and full
   retraction instead of impact. Filled per drill; unknown labels pass through. */
const NOBAG_MAP={
 'Range check 2 min':['Slow-motion roundhouse x8 each','five counts out, five counts back, the foot never touches down between reps'],
 'Leg kick x15 each':['Leg kick x15 each','snap and full retraction instead of impact, full pivot every rep'],
 'Body kick x15 each':['Body kick x15 each','hip all the way over, freeze a beat at extension, return on balance'],
 'Power teep x15 each':['Power teep x15 each','knee up a beat, then drive, standing foot pivoted'],
 'Switch kick x12 each':['Switch kick x12 each','kick and hold 3 seconds at extension, then return on balance'],
 'R1 kicks only':['R1 kicks only','full turn, land balanced, never at half hip'],
 '1-2 at 80% x20':['1-2 snap x20','arm loose like a towel snap, fist tight only at the end, never lock the elbow out'],
 '1-2-3 x15':['1-2-3 x15','picture him stepping in, the hook meets him mid-step'],
 'Uppercuts in close x12 each':['Uppercuts in close x12 each','imagine the clinch, dig up short from the legs'],
 'Rotate every 30 sec on the bag. 1:00 rest.':['Rotate every 30 sec. 1:00 rest. Count reps, the number is the standard.'],
 '30s max output':['30s punch-out, 90 straights'],
 '30s sprawl into 1-2 on the bag':['30s sprawl into 1-2'],
 'Touch, slip, counter x15 each':['Touch, slip, counter x15 each','flash the jab as his, slip it, cross back'],
 'R1|slip-counter on the bag only':['R1','slip-counter only, make every miss real'],
 'Rotate every 30 sec, hands on the bag. 1:00 rest.':['Rotate every 30 sec, hands only. 1:00 rest. Count the reps.'],
 '30s max straights':['30s max straights, count 90'],
 'Teep the advance x15':['Teep the advance x15','he steps in, the teep meets him mid-step'],
 'Chase kick x12 each':['Chase kick x12 each','he backs off, step with him, the body kick lands as he moves'],
 'Knees x15 each':['Knees x15 each','collar tie in the air, pull down as the knee drives up'],
 'Hit the return x12':['Hit the return x12','he comes back at you, you are already throwing'],
 'Elbows in close x12 each':['Elbows in close x12 each','chest to chest range, short and sharp'],
 'Hit the advance x15':['Hit the advance x15','1-2 as he steps in, that is timing'],
 'In-out on the swing x12':['In-out x12','in behind the jab, out before the answer'],
 'Rotate every 30 sec on the bag. 1:00 rest. Hardest session of the camp.':['Rotate every 30 sec. 1:00 rest. Hardest session of the camp. Count reps.'],
 'The swing is the attack':['He is always coming forward','every attack you imagine, make it miss'],
 'Slip the swing, 2-3 x15':['Slip the jab, 2-3 x15'],
 'Pivot off it, hook x12':['Pivot off him, hook x12']
};
function adaptItems(arr){
  if(!arr||BAG_ON||wIdx<4)return arr;
  return arr.map(it=>{
    const sub=NOBAG_MAP[it.length>1?it[0]+'|'+it[1]:'']||NOBAG_MAP[it[0]];
    return sub?sub.slice():it;
  });
}
function adaptNote(note){
  const parts=String(note).split(/\s*no bag yet[:.]?\s*/i);
  if(parts.length<2)return note;
  return BAG_ON?parts[0]:parts[0]+' No bag yet: '+parts[1];
}
/* Additive partner block per day, shown when the Partner switch is on.
   Everything choreographed or single-technique: two beginners, no pads. */
const PARTNER={
 mon:[['Teep distance game, 2 min each','he walks in slow, your light teep to the belt line resets him. Below the chest, never the knee'],
      ['Leg-catch balance, 60s each leg','he holds your extended roundhouse and walks, you hop and keep the hip turned']],
 tue:[['Caller rounds','he calls number combos, you throw them at range, zero contact. Swap caller each round'],
      ['1-for-1 flow','slow 2-3 punch combos to gloves and guard only, he answers with the same. Whoever punches wears the gloves']],
 wed:[['Jab tag','jabs only, score by touching glove or lead shoulder. Force scores nothing, head is off limits'],
      ['Parry and return, 1 min each','slow marked jabs at your guard, you parry and jab his glove back']],
 thu:[['Swap in one station: mirror footwork 30s','he leads, you keep exact range. Swap roles next round'],
      ['Or teep-back 30s','he marches forward, you stop him with light teeps to the hip']],
 fri:[['Defense reps x10 each','slow announced jabs and crosses that stop at your guard: slip, parry, block. Swap'],
      ['From week 3: add one counter','defend, then jab his glove. The one throwing wears the gloves']],
 sat:[['Gloves as mitts, 30s stations','he holds gloves palms out at chest height, you fire the called combo. Nothing off target'],
      ['Caller station','he calls random combos, you throw them in the air at range']],
 sun:[]
};
const PARTNER_RULES='Partner rules: no head contact before week 9, body is touch only, kicks stay light and land above the knee, no free sparring, any hard contact ends the round.';

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
  const R=day.tm.rounds,wk2=day.tm.work,rs=day.tm.rest,segs=[];
  const CQ=(CORNER[k]||[]).slice();
  let ci=Math.floor(Math.random()*Math.max(1,CQ.length));
  const nextCue=()=>{if(!CQ.length)return '';const c=CQ[ci%CQ.length];ci++;return c;};
  if(k==='thu'||k==='sat'){
    const st=adaptItems(day.t).filter(x=>/^30s/i.test(x[0])).map(x=>x[0].replace(/^30s\s*/i,''));
    for(let r=1;r<=R;r++){
      st.forEach((nm,i)=>segs.push({d:30,type:'work',label:nm,next:i<st.length-1?st[i+1]:'rest 1:00',round:r,call:stationCall(nm)}));
      if(r<R)segs.push({d:rs,type:'rest',label:'Rest',next:st[0],round:r,cue:nextCue()});
    }
  }else{
    const labels=adaptItems(day.r||[]).map(x=>x.length>1&&x[0].length<=4?(x[0]+' · '+x[1]):x[0]);
    for(let r=1;r<=R;r++){
      const L=labels[r-1]||('Round '+r);
      segs.push({d:wk2,type:'work',label:L,next:r<R?'rest 1:00':'',round:r,call:roundCall(L,k)});
      if(r<R)segs.push({d:rs,type:'rest',label:'Rest',next:labels[r]||('Round '+(r+1)),round:r,cue:nextCue()});
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
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')resync();});
window.addEventListener('focus',()=>resync());
window.addEventListener('pageshow',()=>resync());
function beep(f,d){if(!ac)return;const o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.value=f;o.connect(g);g.connect(ac.destination);const t=ac.currentTime;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.35,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.start(t);o.stop(t+d);}
function bell(k2){if(k2==='work'){beep(880,.14);setTimeout(()=>beep(880,.14),160);}else if(k2==='tick'){beep(720,.12);}else if(k2==='rest'){beep(440,.22);}else{beep(660,.15);setTimeout(()=>beep(830,.15),180);setTimeout(()=>beep(990,.28),360);}}
const elProg=document.getElementById('tprog');
function segCol(t){return css(t==='work'?'--ember':(t==='rest'?'--steel':'--muted'));}
function paintProg(){
  if(!elProg)return;
  if(!T||!T.segs){elProg.style.width='100%';elProg.style.background=css('--line');return;}
  const sg=T.segs[T.i];
  elProg.style.background=segCol(sg.type);
  elProg.style.width=Math.max(0,Math.min(100,100*T.left/sg.d))+'%';
}
const PHTXT={prep:'Prep',work:'Work',rest:'Rest'};
const PHCOL={prep:'--muted',work:'--ember',rest:'--steel'};
function showSeg(){
  if(!T||!T.segs)return;
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
  stopTick();callerStop();
  const cfg=buildSegs(k,day);
  if(!cfg){T={segs:null,state:'flow'};elName.textContent='Flow day';elNext.textContent='';elRound.textContent='';elClock.textContent='--:--';elClock.style.color=css('--muted');elPhase.textContent='Flow';elPhase.style.color=css('--restore');elGo.disabled=true;elSkip.disabled=true;elReset.disabled=true;elGo.textContent='Start';paintProg();paintFocus();return;}
  elGo.disabled=false;elSkip.disabled=false;elReset.disabled=false;
  T={segs:cfg.segs,rounds:cfg.rounds,i:0,left:cfg.segs[0].d,running:false,int:null,state:'ready'};
  elGo.textContent='Start';showSeg();
}
function finish(){T.state='done';stopTick();callerStop();setTimeout(()=>{try{if(!T||T.state==='done')mediaOff();}catch(e){}},8000);say(vrand(VP.done)+' '+vrand(VP.donetail),true);bell('done');elGo.textContent='Start';elName.textContent='Session complete';elNext.textContent='';elClock.textContent='00:00';elPhase.textContent='Done';elPhase.style.color=css('--restore');elRound.textContent='';if(FOCUS&&fEl){fEl.classList.remove('fwork','frest','fprep');fName.textContent='Session complete';fClock.textContent='00:00';fPhase.textContent='Done';fPhase.style.color=css('--restore');fNext.textContent='LOG IT';fCue.textContent='';if(fRing)fRing.style.strokeDashoffset='0';if(fGo)fGo.textContent='Done';}}
function lbl(x){return String(x).replace(/^R(\d)\s*·\s*/,'Round $1, ').replace(/^R(\d)\s+/,'Round $1, ');}
function endp(x){x=String(x).trim();return /[.!?]$/.test(x)?x:x+'.';}
function announce(sg){
  if(sg.type==='prep'){
    callerStop();
    say(vrand(VP.open)+', '+NAME+'. '+endp(lbl(sg.next))+' Get set.',true);
    return;
  }
  if(sg.type==='rest'){
    callerStop();
    say(vrand(VP.rest)+(sg.cue?' '+endp(sg.cue):''),true);
    return;
  }
  const prev=T.segs[T.i-1];
  const newRound=!prev||prev.type!=='work';
  let t;
  if(newRound&&sg.round===T.rounds&&T.rounds>1) t=vrand(VP.lastwork)+' '+endp(lbl(sg.label));
  else if(newRound) t=endp(lbl(sg.label))+' '+vrand(VP.begin);
  else t=endp(lbl(sg.label))+(Math.random()<0.22?' '+vrand(VP.push):'');
  say(t,true);
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
function resync(){
  try{
    if(!T||!T.segs||T.state!=='run'||!T.running||!T.endAt)return;
    let hops=0;
    while(T.state==='run'&&Date.now()>=T.endAt&&hops<600){advance(true);hops++;}
    if(T.state!=='run')return;
    if(hops>0){
      const cur=T.segs[T.i];
      bell(cur.type==='rest'?'rest':'work');
      say('Back with you. '+lbl(cur.label)+'. '+Math.max(T.left,1)+' seconds left.',true);
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
  if(nl<=0){advance();return;}
  if(nl===T.left)return;
  T.left=nl;
  const sg=T.segs[T.i];
  if(!T.warned)T.warned={};
  if(sg.type==='work'){
    if(sg.d>=120&&T.left===30&&!T.warned[30]){T.warned[30]=1;say(vrand(VP.half),false);}
    /* 30 second stations get no countdown: the next station call is the cue */
    if(sg.d>=60&&T.left===10&&!T.warned[10]){
      T.warned[10]=1;
      say(vrand(T.i===T.segs.length-1?VP.tenlast:VP.ten),false);
    }
    if(sg.d<60&&T.i===T.segs.length-1&&T.left===10&&!T.warned[10]){T.warned[10]=1;say(vrand(VP.tenlast),false);}
  }else if(sg.type==='prep'&&T.left===3&&!T.warned[3]){T.warned[3]=1;say('Three. Two. One.',false);}
  elClock.textContent=fmt(T.left);paintProg();paintFocus();
}
elGo.addEventListener('click',()=>{
  if(!ac){try{ac=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}}
  if(ac&&ac.state==='suspended')ac.resume();
  vinit();
  if(!T||!T.segs||T.state==='done')return;
  const fresh=T.state==='ready';
  if(fresh){T.state='run';bell('work');T.warned={};}
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
elReset.addEventListener('click',()=>{callerStop();vstop();mediaOff();loadTimer(DK[dIdx],W[wIdx].d[DK[dIdx]]);});

/* ---- focus mode ---- */
const fEl=document.getElementById('focus'),fName=document.getElementById('fname'),fClock=document.getElementById('fclock'),
      fPhase=document.getElementById('fphase'),fRound=document.getElementById('fround'),fNext=document.getElementById('fnext'),
      fCue=document.getElementById('fcue'),fRing=document.getElementById('rfg'),fGo=document.getElementById('fgo');
const RC=2*Math.PI*92;
if(fRing){fRing.style.strokeDasharray=RC.toFixed(1);fRing.style.strokeDashoffset='0';}
let FOCUS=false;
function paintFocus(){
  if(!FOCUS||!fEl)return;
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
  fCue.textContent=sg.cue||'';
  fNext.textContent=sg.next?('NEXT  '+sg.next.toUpperCase()):'';
  fRing.style.stroke=col;
  fRing.style.strokeDashoffset=(RC*(1-Math.max(0,Math.min(1,T.left/sg.d)))).toFixed(1);
  fGo.textContent=T.running?'Pause':(T.state==='done'?'Done':'Start');
}
function setFocus(on){
  FOCUS=on;
  if(!fEl)return;
  fEl.classList.toggle('on',on);
  if(on){paintFocus();if(T&&T.running)mediaOn();}else{fEl.classList.remove('fwork','frest','fprep');}
}
const tfocus=document.getElementById('tfocus');
if(tfocus)tfocus.addEventListener('click',()=>setFocus(true));
const fx=document.getElementById('fx');
if(fx)fx.addEventListener('click',()=>setFocus(false));
['fgo','fskip','freset'].forEach((id,i)=>{
  const b=document.getElementById(id);
  if(b)b.addEventListener('click',()=>{const t=[elGo,elSkip,elReset][i];if(t)t.click();paintFocus();});
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&FOCUS)setFocus(false);});

/* ---- views ---- */
const weekView=document.getElementById('weekView'),movesView=document.getElementById('movesView'),gearView=document.getElementById('gearView'),logView=document.getElementById('logView'),iqView=document.getElementById('iqView'),timerbar=document.getElementById('timerbar'),vWeek=document.getElementById('vWeek'),vMoves=document.getElementById('vMoves'),vGear=document.getElementById('vGear'),vLog=document.getElementById('vLog'),vIQ=document.getElementById('vIQ');
function setView(v){weekView.style.display=v==='week'?'':'none';movesView.style.display=v==='moves'?'':'none';gearView.style.display=v==='gear'?'':'none';logView.style.display=v==='log'?'':'none';iqView.style.display=v==='iq'?'':'none';timerbar.style.display=v==='week'?'':'none';vWeek.classList.toggle('active',v==='week');vMoves.classList.toggle('active',v==='moves');vGear.classList.toggle('active',v==='gear');vLog.classList.toggle('active',v==='log');vIQ.classList.toggle('active',v==='iq');if(v==='log')buildGrid();if(v==='iq')paintCard();if(v!=='week'){callerStop();}else if(T&&T.running&&T.segs&&T.segs[T.i]&&T.segs[T.i].type==='work'){callerStart();}window.scrollTo(0,0);}
vWeek.addEventListener('click',()=>setView('week'));
vMoves.addEventListener('click',()=>setView('moves'));
vGear.addEventListener('click',()=>setView('gear'));
vLog.addEventListener('click',()=>setView('log'));
vIQ.addEventListener('click',()=>setView('iq'));

/* ---- storage ---- */
async function saveWeek(i){try{await storage.set('forge:week',String(i));}catch(e){}}
async function saveDone(){try{await storage.set('forge:done',JSON.stringify(DONE));}catch(e){}}
async function saveOpts(){try{await storage.set('forge:opts',JSON.stringify({v:VOICE_ON,c:CALLER_ON,bag:BAG_ON,p:PARTNER_ON}));}catch(e){}}
async function saveIQ(){try{await storage.set('forge:iq',JSON.stringify(IQ));}catch(e){}}
async function boot(){
  try{const r=await storage.get('forge:done');if(r&&r.value)DONE=JSON.parse(r.value)||{};}catch(e){}
  try{const r=await storage.get('forge:iq');if(r&&r.value){const q=JSON.parse(r.value);if(q&&typeof q.r==='number')IQ=q;}}catch(e){}
  try{const r=await storage.get('forge:opts');if(r&&r.value){const o=JSON.parse(r.value);if(o){VOICE_ON=o.v!==false;CALLER_ON=o.c!==false;BAG_ON=o.bag!==false;PARTNER_ON=o.p===true;}}}catch(e){}
  try{const r=await storage.get('forge:week');if(r&&r.value!=null){const i=parseInt(r.value,10);if(i>=0&&i<W.length){wIdx=i;}}}catch(e){}
  selectWeek(wIdx);paintDone();buildGrid();paintIQ();
}

/* ---- init ---- */
const dmap={1:0,2:1,3:2,4:3,5:4,6:5,0:6};
selectWeek(0);
selectDay(dmap[new Date().getDay()]);
setView('week');
buildGrid();
boot();

/* ---- service worker ---- */
if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('./sw.js').catch(()=>{});});}
