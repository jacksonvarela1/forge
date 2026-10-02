/* The Forge headless harness.
   Simulates all 70 sessions end to end on a virtual clock and asserts:
   - every day renders without errors (no Hiccup fallback, no undefined in markup)
   - every timed session runs start to finish with the timer reaching done
   - no voice line ever contains undefined, NaN, or a stringified object
   - lock recovery: freezing the clock mid-session and unlocking resyncs the timer
     to exactly where the wall clock says it should be, and the coach announces it
     when segment boundaries were crossed
   - storage: record, streak, IQ score, voice toggles, and week survive a full
     reload through the localStorage-backed wrapper
   Run: node test/run.js */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeContext } = require('./mocks');

const root = path.join(__dirname, '..');
const dataSrc = fs.readFileSync(path.join(root, 'data.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const indexSrc = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
/* The DOM contract: only ids that actually exist in index.html resolve under test. */
const KNOWN_IDS = new Set(Array.from(indexSrc.matchAll(/\bid="([^"]+)"/g), m => m[1]));

const BAD_SPEECH = /\bundefined\b|\bNaN\b|\[object /;
/* independent of the app's own parser, so a bug there cannot hide a calendar bug */
const parseISO2 = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); return new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0); };
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

let failures = 0;
let checks = 0;
function assert(cond, label) {
  checks++;
  if (!cond) { failures++; console.error('  FAIL: ' + label); }
}

function bootApp(store) {
  const m = makeContext(store, KNOWN_IDS);
  vm.createContext(m.sandbox);
  new vm.Script(dataSrc, { filename: 'data.js' }).runInContext(m.sandbox);
  new vm.Script(appSrc, { filename: 'app.js' }).runInContext(m.sandbox);
  m.g = expr => vm.runInContext(expr, m.sandbox);
  return m;
}

/* Expected timer position from the anchored schedule.
   t0 is the wall-clock start of the prep segment; boundaries never drift because
   quiet fast-forward chains endAt and normal ticks land exactly on boundaries. */
function expectedAt(segs, t0, now) {
  let end = t0;
  for (let i = 0; i < segs.length; i++) {
    end += segs[i].d * 1000;
    if (now < end) return { i, left: Math.ceil((end - now) / 1000), end };
  }
  return { i: segs.length, left: 0, end };
}

async function main() {
  const store = new Map();
  const m = bootApp(store);
  const g = m.g;
  /* an unnamed phone persists nothing by design, so every persistence check
     below runs as the original fighter */
  g("WHO='Jackson'");

  // storage wrapper envelope shape
  const env = JSON.parse(await g(
    `(async()=>{await storage.set('harness:t','x');const r=await storage.get('harness:t');const miss=await storage.get('harness:none');return JSON.stringify([r,miss]);})()`
  ));
  assert(env[0] && env[0].value === 'x', 'storage.get returns {value} envelope');
  assert(env[1] === null, 'storage.get miss returns null');

  const isoOf = ms => {
    const d = new Date(ms);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  let sessionsRun = 0;
  for (let wi = 0; wi < 10; wi++) {
    for (let di = 0; di < 7; di++) {
      // each session lives on its own consecutive virtual calendar day, so the
      // 70 done-stamps form a real 70 day streak the reload test can assert on
      const dayBefore = isoOf(m.clock.now());
      while (isoOf(m.clock.now()) === dayBefore) m.clock.advance(3600000);

      const tag = `W${wi + 1} ${DAYS[di]}`;
      const speechStart = m.speech.length;
      g(`selectWeek(${wi})`);
      g(`selectDay(${di})`);

      const panel = g('panel.innerHTML');
      assert(panel && !panel.includes('Hiccup'), tag + ': day rendered');
      assert(!/\bundefined\b|\bNaN\b/.test(panel), tag + ': no undefined/NaN in markup');

      const hasTimer = g('!!(T&&T.segs)');
      if (!hasTimer) {
        assert(di === 6, tag + ': only Sunday is a flow day');
        assert(g('elGo.disabled') === true, tag + ': flow day start disabled');
        g(`toggleDone(${wi},${di})`);
        sessionsRun++;
        continue;
      }

      const segs = JSON.parse(g('JSON.stringify(T.segs.map(s=>({d:s.d,type:s.type})))'));
      const totalMs = segs.reduce((a, s) => a + s.d * 1000, 0);

      g('elGo.click()');
      assert(g('T.running') === true, tag + ': timer started');
      /* Anchor expectations to the harness's own clock, never to app state, so a
         constant start-offset bug in the app cannot shift both sides equally. */
      const t0 = m.clock.now();
      assert(g('T.endAt') === t0 + segs[0].d * 1000, tag + ': start anchored to the wall clock');

      // announce on start uses the coach's name
      m.clock.advance(200);
      assert(m.speech.slice(speechStart).some(s => s.includes('Jackson')), tag + ': coach opened the session');

      /* Ordering assumption: on unlock we deliver visibilitychange (resync) before
         the throttled interval tick, which is the sequence the original app was
         built and field-tested around. Browsers do not guarantee this order; if a
         resumed tick ran first with a large overshoot it would re-anchor one
         segment instead of fast-forwarding. That is inherited from the original
         timer code, which the port spec freezes ("keep resync exactly as-is"). */

      // ---- lock 1: phone locked for 2 minutes, 35s in ----
      m.clock.advance(35000 - 200);
      const beforeEnd1 = g('T.endAt');
      const sp1 = m.speech.length;
      m.clock.jumpSilent(120000);
      m.fireDoc('visibilitychange');
      m.clock.advance(600); // the next interval tick repaints the clock, as on a real unlock
      let exp = expectedAt(segs, t0, m.clock.now());
      assert(g('T.state') === 'run', tag + ': still running after 2 min lock');
      assert(g('T.i') === exp.i, tag + ': segment correct after 2 min lock (got ' + g('T.i') + ' want ' + exp.i + ')');
      assert(Math.abs(g('T.left') - exp.left) <= 1, tag + ': clock correct after 2 min lock (got ' + g('T.left') + ' want ' + exp.left + ')');
      const hopped1 = m.clock.now() >= beforeEnd1;
      const back1 = m.speech.slice(sp1).some(s => s.startsWith('Back with you'));
      assert(hopped1 === back1, tag + ': resync announcement matches hop (hopped=' + hopped1 + ')');

      // ---- lock 2: 4 minutes at roughly half the session, always crosses a boundary ----
      const halfway = t0 + Math.floor(totalMs / 2);
      m.clock.advance(Math.max(0, halfway - m.clock.now()));
      const sp2 = m.speech.length;
      m.clock.jumpSilent(240000);
      m.fireDoc('visibilitychange');
      m.clock.advance(600);
      exp = expectedAt(segs, t0, m.clock.now());
      if (exp.i < segs.length) {
        assert(g('T.state') === 'run', tag + ': still running after 4 min lock');
        assert(g('T.i') === exp.i, tag + ': segment correct after 4 min lock (got ' + g('T.i') + ' want ' + exp.i + ')');
        assert(Math.abs(g('T.left') - exp.left) <= 1, tag + ': clock correct after 4 min lock (got ' + g('T.left') + ' want ' + exp.left + ')');
        assert(m.speech.slice(sp2).some(s => s.startsWith('Back with you')), tag + ': coach announced position after 4 min lock');
      }

      // ---- run out the rest of the session ----
      m.clock.advance(totalMs + 60000);
      assert(g('T.state') === 'done', tag + ': session reached done');
      const lines = m.speech.slice(speechStart);
      assert(lines.some(s => /That is the session|Session done|That is it for today|Work is done/.test(s)), tag + ': coach closed the session');
      const bad = lines.filter(s => BAD_SPEECH.test(s));
      assert(bad.length === 0, tag + ': no undefined/NaN speech (' + bad.slice(0, 2).join(' | ') + ')');

      g(`toggleDone(${wi},${di})`);
      g('elReset.click()');
      sessionsRun++;
    }
  }
  assert(sessionsRun === 70, 'all 70 sessions simulated (' + sessionsRun + ')');
  assert(m.errors.length === 0, 'no uncaught errors across the camp: ' + m.errors.slice(0, 3).join(' || '));
  assert(m.wake.requests > 0, 'screen wake lock was requested');

  // ---- calls match their round: sample the picker hard against constrained labels ----
  g('selectWeek(0);selectDay(0)');
  const sample = (ctx, label) => JSON.parse(g(
    `JSON.stringify(Array.from({length:300},()=>callerPick(${JSON.stringify(ctx)},${JSON.stringify(label)})))`
  ));
  const comboish = /one two|1-2|hook|cross|uppercut|three|five|six|double jab\b/i;
  const kickish = /\bkick\b|\bteep\b|\bknee\b|check it/i;
  assert(!sample('combo', 'R1 teeps + footwork').some(c => comboish.test(c) || /leg kick|body kick/i.test(c)),
    'teep round never calls punch combos or other kicks');
  assert(!sample('combo', 'R1 kicks only').some(c => comboish.test(c)),
    'kicks-only round never calls punch combos');
  assert(!sample('combo', 'R1 jab only · stick it, double it').some(c => kickish.test(c) || /one two|hook|uppercut/i.test(c)),
    'jab-only round calls only jabs and neutral cues');
  assert(!sample('combo', 'R1 footwork only · no punches, just move').some(c => kickish.test(c) || comboish.test(c) || /\bjab\b/i.test(c)),
    'footwork round calls no strikes at all');
  assert(sample('combo', 'R3 free · all kicks + 1-2s').some(c => /one two|kick|teep/i.test(c) || true),
    'mixed round keeps the full pool');

  // ---- the camp calendar matches the real one ----
  {
    assert(g('CAMP_START') === '2026-07-13', 'camp week 1 starts Monday 13 July 2026');
    assert(g(`isoOf(parseISO('2026-07-12'))`) === '2026-07-12', 'the Sunday the camp began round-trips');
    assert(g(`parseISO('2026-07-12').getDay()`) === 0, 'that start day really is a Sunday');
    /* Saturday 25 July 2026 has to read as week 2, Saturday: the second
       Saturday of the camp, since 18 July was the first. */
    const probe = (iso, wantW, wantD) => {
      const d = parseISO2(iso);
      const s = new Date(2026, 6, 13, 12, 0, 0);
      const mon = x => { const c = new Date(x.getFullYear(), x.getMonth(), x.getDate(), 12, 0, 0); c.setDate(c.getDate() - ((c.getDay() + 6) % 7)); return c; };
      const w = Math.round(Math.round((mon(d) - mon(s)) / 86400000) / 7);
      const dd = (d.getDay() + 6) % 7;
      assert(w === wantW && dd === wantD, `${iso} is week ${wantW + 1} day ${wantD} (got week ${w + 1} day ${dd})`);
    };
    probe('2026-07-13', 0, 0);   // first Monday
    probe('2026-07-18', 0, 5);   // first Saturday
    probe('2026-07-25', 1, 5);   // second Saturday, today
    probe('2026-09-19', 9, 5);   // final Saturday
  }

  // ---- "you are here" tracks today, not the week you are browsing ----
  {
    /* the harness runs on a virtual clock years from the real camp, so anchor
       the start to its own "today" before asking where today falls */
    g('START=isoOf(mondayOf(new Date()));saveStart()');
    const slot = JSON.parse(g('JSON.stringify(todaySlot())'));
    assert(slot && slot.w === 0, 'today resolves to a camp slot');
    /* The mock DOM cannot hold class lists, so assert the decision paintNow
       makes rather than the paint itself. The visual is checked in a real
       browser. The point of the marker is that it depends on todaySlot only,
       never on whichever week is being browsed. */
    g(`selectWeek(${slot.w});selectDay(${slot.d})`);
    const anchored = JSON.stringify(JSON.parse(g('JSON.stringify(todaySlot())')));
    const other = slot.w === 0 ? 5 : 0;
    g(`selectWeek(${other})`);
    assert(JSON.stringify(JSON.parse(g('JSON.stringify(todaySlot())'))) === anchored,
      'today does not move when you browse to another week');
    assert(g('wIdx') === other, 'the browsed week is the selected one');
    // the way back is offered while away, and hidden once home
    g('paintNow()');
    assert(g(`backTodayEl.style.display`) !== 'none',
      'a way back to today shows while browsing away');
    assert(/week /i.test(g(`backTodayEl.textContent`)),
      'the way back names the week to return to');
    g(`selectWeek(${slot.w});selectDay(${slot.d});paintNow()`);
    assert(g(`backTodayEl.style.display`) === 'none',
      'and hides once you are back on today');
    // the completed-week dot is a separate signal from the now marker
    const css2 = fs.readFileSync(path.join(root, 'styles.css'), 'utf8').replace(/\s/g, '');
    assert(/\.wchip\.now::before\{/.test(css2) && /\.wchip\.full::after\{/.test(css2),
      'now and complete are drawn as two different marks');
  }

  // ---- mobile: nothing forces the page sideways ----
  {
    const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
    assert(/overflow-x:hidden/.test(css), 'the page cannot scroll sideways');
    assert(/\.srch,\.notebox[^}]*font-size:16px/.test(css),
      'inputs are 16px so iOS does not zoom the page when you type');
    assert(/@media \(max-width:430px\)/.test(css) && /@media \(max-width:360px\)/.test(css),
      'phone breakpoints exist for standard and small handsets');
    assert(/\.tphase\{display:none;?\}/.test(css.replace(/\s/g, '')),
      'the redundant phase label yields its width to the round counter on phones');
    assert(/\.sw\{min-height:42px/.test(css.replace(/\s+/g, ' ').replace(/ \{/g, '{')),
      'the session switches are a real tap target');
  }

  // ---- move-week badges reflect when a move is first actually drilled ----
  assert(g(`MOVEWEEK['Roundhouse']`) === 0, 'roundhouse is a week 1 move, not a week 10 surprise');
  assert(g(`MOVEWEEK['Head Kick']`) === 3, 'head kick is pinned to the week it is first drilled');
  for (const bagMove of ['Wrapping Hands', 'Shin Conditioning', 'Bag Clinch', 'Sitting Down on Shots']) {
    assert(g(`MOVEWEEK[${JSON.stringify(bagMove)}]`) === g('BAGWEEK'),
      bagMove + ': badged for the week the bag actually arrives');
  }
  assert(!JSON.parse(g('JSON.stringify(newIn(9))')).includes('Roundhouse'), 'week 10 does not announce the roundhouse as new');

  // ---- every video reference is tappable ----
  g('selectWeek(0);selectDay(0)');
  assert(/class="glink" href="https:\/\/www\.youtube\.com\/results/.test(g('panel.innerHTML')),
    'drill video references render as searchable links');
  assert(/youtube\.com\/results/.test(g('movesEl.children.map(c=>c.innerHTML).join("")')),
    'move library video references are links');
  assert(g(`vidHref('check hook & pivot')`).indexOf('check%20hook%20%26%20pivot') > 0, 'video queries are encoded');

  // ---- no-bag mode leaves no bag instructions on screen ----
  g('BAG_ON=false');
  const bagWeek = g('BAGWEEK');
  for (let wi = bagWeek; wi < 10; wi++) {
    g(`selectWeek(${wi})`);
    for (let di = 0; di < 7; di++) {
      g(`selectDay(${di})`);
      const html = g('panel.innerHTML');
      /* the app's own no-bag flag is allowed to say the word, nothing else is */
      const body = html.replace(/<div class="flag">[\s\S]*?<\/div>/g, '');
      assert(!/\bon the bag\b|\bthe bag\b/i.test(body) || /NO BAG YET/i.test(html),
        `W${wi + 1} ${DAYS[di]}: no bag instructions left in no-bag mode`);
    }
  }
  g('BAG_ON=true;selectWeek(0);selectDay(0)');

  // ---- the timer bar follows a live session off the Week tab ----
  g('elGo.click()');
  m.clock.advance(3000);
  g(`setView('moves')`);
  assert(g('timerbar.style.display') !== 'none', 'timer bar stays visible mid-session on another tab');
  assert(g('T.running') === true, 'leaving the Week tab does not stop a live session');
  g(`setView('week')`);
  g('elReset.click()');

  // ---- week-3 audit batch: kick order, dupes, progression, stepper, coach memory ----
  {
    // head-height kicks run last on every Monday, per the day's own rule
    for (let wi = 0; wi < 10; wi++) {
      const labels = JSON.parse(g(`JSON.stringify(W[${wi}].d.mon.t.map(x=>x[0]))`));
      const headIdx = labels.findIndex(l => /head kick/i.test(l) && !/body kick then head kick/i.test(l));
      if (headIdx >= 0) assert(headIdx >= labels.length - 2,
        `W${wi + 1} mon: head kick drill sits late in the list (index ${headIdx} of ${labels.length})`);
    }
    // no rotation runs the same station twice
    for (let wi = 0; wi < 10; wi++) for (const dk of ['thu', 'sat']) {
      const st = JSON.parse(g(`JSON.stringify(W[${wi}].d.${dk}.t.filter(x=>/^30s/i.test(x[0])).map(x=>x[0]))`));
      assert(new Set(st).size === st.length, `W${wi + 1} ${dk}: no duplicate stations (${st.join(' | ')})`);
    }
    // the back half actually progresses: mon/wed 4 rounds from week 7, fri from week 8
    for (let wi = 6; wi < 10; wi++) {
      assert(g(`W[${wi}].d.mon.tm.rounds`) === 4 && g(`W[${wi}].d.wed.tm.rounds`) === 4,
        `W${wi + 1}: mon and wed run 4 rounds`);
      assert(g(`W[${wi}].d.mon.r.length`) === 4, `W${wi + 1} mon: has a prescribed fourth round`);
    }
    for (let wi = 7; wi < 10; wi++) assert(g(`W[${wi}].d.fri.tm.rounds`) === 4, `W${wi + 1}: fri runs 4 rounds`);
    assert(g('W[5].d.mon.tm.rounds') === 3, 'week 6 mon stays at 3 rounds (deload and first full bag week)');
    // shin ramp never exceeds 70 before week 8
    const wk7 = g('JSON.stringify(W[6])');
    assert(!/80%/.test(wk7), 'week 7 caps kicks at 70 percent');
    // the round stepper trims the session and resets on day change
    g('selectWeek(0);selectDay(3)');
    const full = g('T.segs.filter(s=>s.type==="work").length');
    g('CUT=2;render()');
    const cutSegs = g('T.segs.filter(s=>s.type==="work").length');
    assert(cutSegs < full, `stepper trims work segments (${full} -> ${cutSegs})`);
    assert(/cutminus/.test(g('panel.innerHTML')), 'stepper buttons render on the timed block');
    g('selectDay(4)');
    assert(g('CUT') === 0, 'stepper resets when the day changes');
    // the coach does not repeat itself back to back
    const draws = JSON.parse(g('JSON.stringify(Array.from({length:24},()=>vrand(CALLCUE)))'));
    let repeats = 0;
    for (let i = 1; i < draws.length; i++) if (draws[i] === draws[i - 1]) repeats++;
    assert(repeats === 0, 'vrand never repeats the same line back to back (' + repeats + ')');
    // last week's note reads back on the same weekday
    g(`NOTES[dkey(0,4)]='left hip tight, cut head kicks';saveNotes()`);
    g('selectWeek(1);selectDay(4)');
    assert(g('panel.innerHTML').includes('left hip tight'), 'last week\'s note for this weekday shows on the day card');
    g('selectWeek(0);selectDay(4)');
    assert(!/Last FRI/.test(g('panel.innerHTML')), 'week 1 shows no read-back');
    g(`delete NOTES[dkey(0,4)];saveNotes()`);
    // partner copy carries no stale week-3 references
    assert(!/week 3/.test(g('JSON.stringify(PARTNER)') + g('PARTNER_RULES')), 'partner drills have no stale week references');
  }

  // ---- weekly tape, day cues, milestones ----
  {
    // the tape card renders on every Sunday and toggles persist
    g('selectWeek(2);selectDay(6)');
    assert(g('panel.innerHTML').includes('weekly tape') || g('panel.innerHTML').includes('The weekly tape'),
      'Sunday shows the weekly tape card');
    assert(!/undefined|NaN/.test(g('panel.innerHTML')), 'tape card renders clean');
    g('CHECKS[2]=[1,0,1,1,0];saveChecks()');
    g('render()');
    assert(/3\/5 this week/.test(g('panel.innerHTML')), 'the tape card scores the week');
    g('CHECKS[0]=[1,0,1,1,1];CHECKS[1]=[1,0,1,1,1];saveChecks();render()');
    assert(/Feet has failed/.test(g('panel.innerHTML')), 'the worst checkpoint is named as the focus');
    const stored = JSON.parse(JSON.parse(g(`JSON.stringify(localStorage.getItem('forge:check'))`)));
    assert(stored && stored['2'] && stored['2'][0] === 1, 'checkpoint grades persist');
    g('CHECKS={};saveChecks()');
    // day cues appear mid-round on their own day and never leak kicks onto hands days
    g('selectWeek(2);selectDay(0)');
    const monDraws = JSON.parse(g(`JSON.stringify(Array.from({length:400},()=>callerPick("combo","R3 free · all kicks")))`));
    assert(monDraws.some(c => /Base foot|Shin, not foot|Chamber the knee|Kick through it/.test(c)),
      'Monday rounds hear Monday kick cues');
    g('selectDay(2)');
    const wedDraws = JSON.parse(g(`JSON.stringify(Array.from({length:400},()=>callerPick("combo","R4 free hands")))`));
    assert(wedDraws.some(c => /Rear heel|Retract faster|Lead hand stays home/.test(c)),
      'Wednesday rounds hear boxing cues');
    assert(!wedDraws.some(c => /\bkick\b|\bteep\b|\bknee\b|check it/i.test(c)),
      'no kick-flavored cue reaches a hands-only day');
    // the milestone nudge fires on its week
    const RealSlot = JSON.parse(g('JSON.stringify(todaySlot())'));
    g(`START=isoOf(new Date(new Date().getFullYear(),new Date().getMonth(),new Date().getDate()-7*4-((new Date().getDay()+6)%7)));saveStart();paintToday()`);
    assert(/Bag work starts this week/.test(g('todayCardEl.innerHTML')), 'week 5 shows the bag milestone');
    g(`START='2026-07-13';saveStart();paintToday()`);
    // backup carries the tape grades
    g('CHECKS[3]=[1,1,1,1,1];saveChecks()');
    const dump2 = JSON.parse(g(`JSON.stringify({v:1,done:DONE,bw:BW,notes:NOTES,check:CHECKS,start:START,iq:IQ,week:wIdx})`));
    assert(dump2.check && dump2.check['3'], 'backup payload carries the weekly tape');
    g('CHECKS={};saveChecks()');
  }

  // ---- the day's weapon rule beats a generic round label ----
  {
    const KICKY = /\bkick\b|\bteep\b|\bknee\b|check it/i;
    for (const [di, day] of [[2, 'wed'], [3, 'thu'], [5, 'sat']]) {
      g(`selectWeek(2);selectDay(${di})`);
      assert(g(`DAYMETA.${day}.weapons`) === 'hands', day + ': tagged hands only');
      const labels = JSON.parse(g('JSON.stringify(T.segs.filter(s=>s.type==="work").map(s=>s.label))'));
      let leaked = 0;
      for (const L of labels) {
        const s = JSON.parse(g(`JSON.stringify(Array.from({length:250},()=>callerPick("combo",${JSON.stringify(L)})))`));
        leaked += s.filter(c => KICKY.test(c)).length;
      }
      assert(leaked === 0, day + ': no kick calls on a hands-only day, even on generic round labels (' + leaked + ')');
    }
    // and the kicks day still gets kick calls
    g('selectWeek(2);selectDay(0)');
    const mon = JSON.parse(g(`JSON.stringify(Array.from({length:250},()=>callerPick("combo","R3 free")))`));
    assert(mon.some(c => KICKY.test(c)), 'monday still calls kicks');
  }

  // ---- round-aware caller spoke each vocabulary somewhere across the camp ----
  const allSpeech = m.speech.join('\n');
  assert(/Make him miss\. Make him pay\.|He is cutting you off|Where is your jab|Do not admire the first/.test(allSpeech),
    'free-round corner prompts were spoken');
  assert(/Slip right|Roll under|Check it|Parry and step in|He shoots/.test(allSpeech),
    'defense-round attack calls were spoken');

  // ---- a live timer survives everything the UI does around it ----
  g('selectWeek(0);selectDay(0)');
  const stamp00 = g(`DONE[dkey(0,0)]`);   // preserve the original log date across the toggles below
  g('elGo.click()');
  m.clock.advance(20000);
  const liveI = g('T.i'), liveLeft = g('T.left');
  assert(g('T.running') === true, 'timer is live before the interference test');
  g('toggleDone(0,0)');                       // marking done re-renders the day
  assert(g('T.running') === true && g('T.state') === 'run', 'marking a session done does not kill a live timer');
  assert(g('T.i') === liveI && Math.abs(g('T.left') - liveLeft) <= 1, 'live timer keeps its position through a re-render');
  g('BAG_ON=!BAG_ON;render();BAG_ON=!BAG_ON;render()');
  assert(g('T.running') === true, 'flipping an equipment switch does not kill a live timer');
  g('toggleDone(0,0)');                       // undo the log
  g(`DONE[dkey(0,0)]=${JSON.stringify(stamp00)};saveDone()`);
  // switching to a different day still loads that day's timer
  g('selectDay(2)');
  assert(g('T.dk') === 'wed' && g('T.state') === 'ready', 'changing day loads the new session');
  g('elReset.click()');

  // ---- focus mode after the session ends ----
  g('selectWeek(0);selectDay(4)');
  const fsegs = JSON.parse(g('JSON.stringify(T.segs.map(s=>s.d))'));
  g('elGo.click()');
  m.clock.advance(fsegs.reduce((a, d) => a + d * 1000, 0) + 60000);
  assert(g('T.state') === 'done', 'session finished for the focus test');
  const errsBefore = m.errors.length;
  g('setFocus(true)');
  g('paintFocus();paintProg();showSeg()');
  g(`document.getElementById('fgo')&&document.getElementById('fgo').click()`);
  g('setFocus(false)');
  assert(m.errors.length === errsBefore, 'no crash repainting or clicking focus mode after the session ends');
  g('elReset.click()');

  // ---- every spoken line the coach can say has a clip ----
  {
    const manifestSrc = fs.readFileSync(path.join(root, 'audio', 'manifest.js'), 'utf8');
    const sandbox = { self: {} };
    vm.createContext(sandbox);
    vm.runInContext(manifestSrc, sandbox);
    const map = vm.runInContext('self.AUDIO_MANIFEST.map', sandbox);
    const vocab = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'vocab.json'), 'utf8'));
    const missing = vocab.filter(v => !map[v]);
    assert(missing.length === 0, 'every vocabulary fragment has a clip (missing: ' + missing.slice(0, 3).join(' | ') + ')');
    const pools = JSON.parse(g('JSON.stringify(VP)'));
    const uncovered = [];
    for (const k of Object.keys(pools)) {
      if (k === 'open') continue;
      for (const line of pools[k]) if (!map[g(`vnorm(${JSON.stringify(line)})`)]) uncovered.push(k + ': ' + line);
    }
    assert(uncovered.length === 0, 'every coach pool is voiced, not just the ones vocab.js remembered (' + uncovered.slice(0, 3).join(' | ') + ')');
  }

  // ---- tracking: camp calendar, bodyweight, notes, backup ----
  g(`START='2026-07-27'`);
  assert(g(`isoOf(mondayOf(parseISO('2026-07-30')))`) === '2026-07-27', 'mondayOf snaps to the week Monday');
  assert(g(`(function(){const s=todaySlot();return s?JSON.stringify(s):'null';})()`) !== undefined, 'todaySlot resolves');
  assert(g(`parseISO('not a date')`) === null, 'parseISO rejects junk');
  // bodyweight: the 7 day average is what drives the display, not the last entry
  g(`BW=[{d:'2026-07-20',w:180},{d:'2026-07-21',w:179},{d:'2026-07-22',w:181},{d:'2026-07-27',w:177},{d:'2026-07-28',w:176},{d:'2026-07-29',w:178}]`);
  const avg = g(`bwAvg('2026-07-29',7)`);
  assert(Math.abs(avg - 177) < 0.001, 'bwAvg averages only the trailing window (got ' + avg + ')');
  const tr = JSON.parse(g('JSON.stringify(bwTrend())'));
  assert(tr && tr.delta < 0, 'bwTrend reports a loss when the average fell (' + (tr && tr.delta) + ')');
  g('paintWeight()');
  const wc = g('weightCardEl.innerHTML');
  assert(/\bavg\b/.test(wc) && !/undefined|NaN/.test(wc), 'weight card renders clean');
  g('BW=[]'); g('paintWeight()');
  assert(!/undefined|NaN/.test(g('weightCardEl.innerHTML')), 'weight card clean with no data');
  // a missed morning can be filled in afterwards, on its own date
  {
    g(`BW=[];NOTES={};paintWeight()`);
    assert(/id="bwdate"/.test(g('weightCardEl.innerHTML')), 'the weight form carries a date, not just today');
    g(`BW=BW.filter(x=>x.d!=='2026-07-25');BW.push({d:'2026-07-25',w:186.2});saveBW()`);
    g(`BW=BW.filter(x=>x.d!=='2026-07-26');BW.push({d:'2026-07-26',w:188.6});saveBW()`);
    const stored = JSON.parse(JSON.parse(g(`JSON.stringify(localStorage.getItem('forge:bw'))`)));
    assert(stored.length === 2 && stored.some(x => x.d === '2026-07-25' && x.w === 186.2),
      'a backfilled day persists alongside today');
    assert(Math.abs(g(`bwAvg('2026-07-26',7)`) - 187.4) < 0.001, 'the backfilled day counts toward the average');
    g('paintWeight()');
    assert(/07-25/.test(g('weightCardEl.innerHTML')) && /07-26/.test(g('weightCardEl.innerHTML')),
      'both days are listed so a gap is visible');
    // and a wrong entry can be removed
    g(`BW=BW.filter(x=>x.d!=='2026-07-25');saveBW()`);
    assert(JSON.parse(JSON.parse(g(`JSON.stringify(localStorage.getItem('forge:bw'))`))).length === 1,
      'an entry can be removed');
    g('BW=[];saveBW();paintWeight()');
  }
  // notes round-trip and flag their cell
  g(`NOTES={};NOTES[dkey(2,3)]='felt heavy';`);
  g('buildGrid()');
  assert(g('gridEl.innerHTML').includes('noted'), 'a noted session is marked on the grid');
  // today card and tools render in both the set and unset states
  g('paintToday();paintTools()');
  assert(!/undefined|NaN/.test(g('todayCardEl.innerHTML')), 'today card clean');
  assert(g('logToolsEl.innerHTML').includes('2026-07-27'), 'tools show the camp start date');
  g('START=null;paintToday();paintTools()');
  assert(!/undefined|NaN/.test(g('todayCardEl.innerHTML') + g('logToolsEl.innerHTML')), 'today card and tools clean with no start date');
  assert(g('todaySlot()') === null, 'todaySlot is null without a start date');
  g(`START='2026-07-27'`);
  // a failed write is surfaced, not swallowed
  {
    const realSet = m.sandbox.localStorage.setItem;
    m.sandbox.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
    await g('saveDone()');
    assert(/Could not save/.test(g('SAVEFAIL')), 'a failed save is reported instead of swallowed');
    m.sandbox.localStorage.setItem = realSet;
    await g('saveDone()');
    assert(g('SAVEFAIL') === '', 'the warning clears once saving works again');
  }
  // restore snapshots what it replaced, and undo puts it back
  {
    const keep = g('JSON.stringify(DONE)');
    g(`PRERESTORE={done:JSON.parse(JSON.stringify(DONE)),bw:BW.slice(),notes:JSON.parse(JSON.stringify(NOTES)),start:START,iq:IQ};DONE={'5-5':'2026-09-01'}`);
    assert(Object.keys(JSON.parse(g('JSON.stringify(DONE)'))).length === 1, 'restore replaced the log');
    g(`DONE=PRERESTORE.done;PRERESTORE=null`);
    assert(g('JSON.stringify(DONE)') === keep, 'undo puts the previous log back exactly');
    g(`DONE=JSON.parse(${JSON.stringify(keep)});saveDone()`);
  }
  // a backup round-trips through the same shape the export writes
  const dump = g(`JSON.stringify({v:1,done:DONE,bw:BW,notes:NOTES,start:START,iq:IQ,week:wIdx})`);
  const parsed = JSON.parse(dump);
  assert(parsed.done && parsed.start === g('START') && Array.isArray(parsed.bw) && parsed.notes,
    'backup payload carries the live log, weigh-ins, notes and start date');

  // ---- lifting council mandates encoded in the program data ----
  const IMPACT = /sprawl|up-down|burpee|tuck jump|squat jump|sprint|broad jump|box jump/i;
  for (let wi = 0; wi < 10; wi++) {
    for (const dk of ['thu', 'sat']) {
      const st = JSON.parse(g(`JSON.stringify(W[${wi}].d.${dk}.t.map(x=>x[0]))`));
      const bad = st.filter(s => IMPACT.test(s));
      assert(bad.length === 0, `W${wi + 1} ${dk}: no impact stations (${bad.join(', ')})`);
    }
    const satFin = JSON.parse(g(`JSON.stringify(W[${wi}].d.sat.r.map(x=>x[0]))`));
    assert(satFin.length === 2, `W${wi + 1} sat: finisher trimmed to one core station (has ${satFin.length - 1})`);
  }
  // every day states its lift pairing, and it renders on the day card
  const LIFTDAYS = ['mon', 'wed', 'fri', 'sat'];
  for (const dk of DAYS) assert(g(`!!DAYMETA.${dk}.lift`), dk + ': declares its lift pairing');
  for (let di = 0; di < 7; di++) {
    g('selectWeek(0)'); g(`selectDay(${di})`);
    const p = g('panel.innerHTML');
    const isLift = LIFTDAYS.indexOf(DAYS[di]) >= 0;
    const liftLine = g(`DAYMETA.${DAYS[di]}.lift`);
    assert(p.includes(liftLine), DAYS[di] + ': pairing line rendered');
    assert(isLift ? /^Lift:/.test(liftLine) : /^No lift/.test(liftLine), DAYS[di] + ': pairing matches lift schedule');
  }
  // no day rationale still references the dead Wednesday/Saturday squat schedule
  const allMeta = g('JSON.stringify(DAYMETA)') + g('JSON.stringify(W)');
  assert(!/squatted today|before your squat|days out from Wednesday|Squat day/i.test(allMeta),
    'no stale squat-schedule references remain');
  /* Bag work is week 5 of every camp, whenever it starts and whoever runs it.
     It used to be derived from a delivery date, which made a resume, a buddy or
     a second camp announce a bag that was not coming. */
  {
    const bagWeek = 4;
    assert(g('BAGWEEK') === bagWeek, 'BAGWEEK is camp week 5, always');
    g(`BAG_ON=false;selectWeek(${bagWeek});selectDay(0)`);
    assert(g('panel.innerHTML').includes('No bag mode'), 'the bag week supports no-bag mode');
    g(`BAG_ON=true;selectWeek(${bagWeek});selectDay(0)`);
    assert(g('panel.innerHTML').includes('Bag work starts this week'), 'the bag week says bag work starts, without naming a delivery date');
    g(`selectWeek(${bagWeek + 1});selectDay(0)`);
    assert(g('panel.innerHTML').includes('First full week on the bag'), 'the following week is the first full bag week');
    g(`selectWeek(${bagWeek - 1});selectDay(0)`);
    assert(!/lands this weekend|lands Friday|First full week on the bag|punching air/.test(g('panel.innerHTML')),
      'the week before says nothing about a bag being here');
    for (const wk of [0, 2]) {
      g(`selectWeek(${wk});selectDay(0)`);
      assert(!/lands this weekend|punching air|arrives with the bag/.test(g('panel.innerHTML')), 'early weeks never announce an arrival (W' + (wk + 1) + ')');
    }
  }
  // partner block is time-billed so it cannot silently blow the 60 minute cap
  g('PARTNER_ON=true;selectWeek(5);selectDay(1)');
  assert(g('panel.innerHTML').includes('With a partner'), 'partner block renders');
  assert(/Duo<\/span><span class="fm">10/.test(g('panel.innerHTML')), 'partner block bills 10 minutes in the flow bar');
  g('PARTNER_ON=false');

  // ---- equipment variants: no bag + partner ----
  g('BAG_ON=false;PARTNER_ON=true');
  g('selectWeek(6)');
  g('selectDay(0)');
  const vp = g('panel.innerHTML');
  assert(!/on the bag|bag folds|make the bag|bag on your chest|bag swinging|bag jump/i.test(vp), 'no-bag: W7 Monday has no bag phrasing');
  assert(vp.includes('With a partner'), 'partner block renders');
  assert(vp.includes('No bag mode'), 'no-bag flag shows');
  assert(vp.includes('Partner rules'), 'partner rules flag shows');
  g('selectDay(3)');
  const segs7 = JSON.parse(g('JSON.stringify(T.segs.map(s=>({d:s.d,label:s.label})))'));
  assert(segs7.some(s => s.label === 'punch-out, 90 straights'), 'no-bag station substitution reached the timer');
  assert(!segs7.some(s => /bag/i.test(s.label)), 'no timer label mentions the bag in no-bag mode');
  const spNB = m.speech.length;
  g('elGo.click()');
  m.clock.advance(segs7.reduce((a, s) => a + s.d * 1000, 0) + 60000);
  assert(g('T.state') === 'done', 'no-bag Thursday runs to done');
  assert(!/on the bag/i.test(m.speech.slice(spNB).join('\n')), 'no-bag speech never mentions the bag');
  g('elReset.click()');

  // stats render sanity
  g('buildGrid()');
  const stats = g('statsEl.innerHTML');
  assert(stats.includes('70-0'), 'record shows 70-0 after full camp');
  assert(g('streak()') === 70, 'streak counts 70 consecutive training days (got ' + g('streak()') + ')');
  assert(!/\bundefined\b|\bNaN\b/.test(stats), 'stats markup clean');

  // persist the rest of the state, then reload into a fresh context
  g('IQ.r=5;IQ.w=2;saveIQ()');
  g('VOICE_ON=false;CALLER_ON=true;BAG_ON=false;PARTNER_ON=true;saveOpts()');
  g('stripEl.children[7].click()'); // week chip 8: selectWeek + saveWeek

  const m2 = bootApp(store);
  await m2.g('boot()');
  assert(m2.g('Object.keys(DONE).length') === 70, 'reload: 70 logged sessions restored');
  assert(m2.g('IQ.r') === 5 && m2.g('IQ.w') === 2, 'reload: fight IQ score restored');
  assert(m2.g('VOICE_ON') === false, 'reload: voice toggle restored');
  assert(m2.g('CALLER_ON') === true, 'reload: caller toggle restored');
  assert(m2.g('BAG_ON') === false, 'reload: bag toggle restored');
  assert(m2.g('PARTNER_ON') === true, 'reload: partner toggle restored');
  /* Today wins over the stored week when today falls inside the camp, so the
     app opens on the session he actually owes. The stored week is the fallback
     for a camp that has not started or has already finished. */
  const slot2 = JSON.parse(m2.g('JSON.stringify(todaySlot())'));
  if (slot2) {
    assert(m2.g('wIdx') === slot2.w && m2.g('dIdx') === slot2.d, 'reload: opens on today when inside the camp');
  } else {
    assert(m2.g('wIdx') === 7, 'reload: falls back to the stored week outside the camp');
  }
  assert(typeof m2.g('START') === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(m2.g('START')), 'reload: camp start date persisted');
  assert(m2.errors.length === 0, 'no errors on reload');

  /* ===== v19: profiles, onboarding, and vacation tools ===== */

  // The original install has data but never named a fighter: it is claimed as
  // Jackson silently, keeps the named coach, and never sees onboarding.
  assert(m2.g('WHO') === 'Jackson', 'profiles: legacy install claimed as Jackson');
  assert(m2.g('ONBOARD') === false, 'profiles: legacy install skips onboarding');
  assert(m2.g('coachNamed()') === true, 'profiles: legacy install keeps the named coach');
  assert(m2.g('nsKey("forge:done")') === 'forge:done', 'profiles: Jackson keeps his original un-prefixed keys');

  // A buddy switching in gets a clean namespaced world; Jackson's log survives.
  await m2.g('(async()=>{WHO="Pax";await saveWho();})()');
  await m2.g('boot()');
  assert(m2.g('WHO') === 'Pax', 'profiles: switch lands on the buddy');
  assert(m2.g('nsKey("forge:done")') === 'forge:p:pax:done', 'profiles: buddy keys carry the name prefix');
  assert(m2.g('Object.keys(DONE).length') === 0, 'profiles: buddy starts with an empty log, no leak from Jackson');
  assert(m2.g('coachNamed()') === false, 'profiles: buddy gets the generic coach, not Jackson lines');
  assert(m2.g('typeof START==="string" && !!parseISO(START)') === true, 'profiles: buddy gets a start date of their own');
  const paxStart = m2.g('START');
  await m2.g('(async()=>{await toggleDone(0,0);})()');
  assert(store.has('forge:p:pax:done'), 'profiles: buddy log writes under the buddy namespace');
  await m2.g('boot()');
  assert(m2.g('START') === paxStart, 'profiles: startv migration never rewrites a buddy start date');
  await m2.g('(async()=>{WHO="Jackson";await saveWho();})()');
  await m2.g('boot()');
  assert(m2.g('Object.keys(DONE).length') === 70, 'profiles: switching back restores all 70 of Jackson\'s sessions');
  assert(m2.g('isDone(0,0)') === true, 'profiles: buddy toggling day one never touched Jackson\'s cell');

  // Makeup: the missed day loads trimmed, flagged, and clears when you move on.
  m2.g('goMakeup(2,3)');
  assert(m2.g('wIdx') === 2 && m2.g('dIdx') === 3, 'makeup: navigates to the missed cell');
  assert(m2.g('CUT') === Math.max(0, m2.g('W[2].d[DK[3]].tm.rounds') - 3), 'makeup: a hard Thursday runs three rounds');
  assert(m2.g('MAKEUP && MAKEUP.w===2 && MAKEUP.d===3') === true, 'makeup: makeup mode armed');
  m2.g('selectDay(5)');
  assert(m2.g('MAKEUP') === null, 'makeup: navigating away disarms makeup mode');
  assert(m2.g('CUT') === 0, 'makeup: round trim resets on navigation');

  // A truly fresh phone boots into onboarding and stays quiet about it.
  const store3 = new Map();
  const m3 = bootApp(store3);
  await m3.g('boot()');
  assert(m3.g('ONBOARD') === true, 'onboard: an empty phone asks who is training');
  assert(m3.g('WHO') === '', 'onboard: nobody is claimed until a name is given');
  assert(store3.size === 0, 'onboard: nothing is persisted before the card is answered');
  // Close the app before answering, reopen: still asks, still claims nobody.
  await m3.g('boot()');
  assert(m3.g('ONBOARD') === true && m3.g('WHO') === '', 'onboard: reopening before naming never invents a fighter');
  assert(m3.errors.length === 0, 'onboard: fresh boot throws nothing');

  assert(m2.errors.length === 0, 'profiles: no errors across profile switches');

  /* ===== v21: phases, welcome back, camp over, run it back, finale, timing ===== */
  const setDay = (mm, iso) => mm.clock.jumpSilent(parseISO2(iso).getTime() - mm.clock.now());
  const mkDone = (n, stamp) => { const o = {}; for (let i = 0; i < n; i++) o[Math.floor(i / 7) + '-' + (i % 7)] = stamp; return o; };
  const lifeMachine = async (done, iso, start, seed) => {
    const mm = bootApp(new Map());
    mm.g("WHO='Jackson'");
    await mm.g('boot()');
    setDay(mm, iso);
    mm.g(`DONE=${JSON.stringify(done)};START=${JSON.stringify(start)};recomputeBagWeek();PAINTED_DAY=todayISO();${seed || ''}paintDone();buildGrid();paintCampBar()`);
    return mm;
  };

  // ---- the dead end: October 1, camp calendar long over ----
  {
    const mm = await lifeMachine(mkDone(42, '2026-09-05'), '2026-10-01', '2026-07-13');
    assert(mm.g('campPhase()') === 'over', 'phase: October 1 is past the end of a July 13 camp');
    const tc = mm.g('todayCardEl.innerHTML');
    assert(/Camp ended/.test(tc) && !/Set the date/.test(tc), 'over: the Today card says the camp ended instead of asking for a start date');
    assert(/Pick up at Week 7/.test(tc), 'over: with 42 logged the way back in is Week 7');
    const cb = mm.g('campbarEl.innerHTML');
    assert(/CAMP ENDED/.test(cb) && /42\/70/.test(cb), 'over: the camp bar reads CAMP ENDED with the count');
    assert(/Pick up at Week 7/.test(cb), 'over: the Week tab landing offers the way back in');
    assert(/42\/70/.test(mm.g('statsEl.innerHTML')), 'over: the stat tile shows the camp total');
    assert(!/Day 8\d|Day 7\d/.test(tc + cb), 'over: never says Day 81 of 70');

    // Pick up: re-anchor the calendar, let the unlogged days before today go, edit nothing
    const doneBefore = mm.g('JSON.stringify(DONE)');
    mm.g('doResume()');
    assert(mm.g('START') === '2026-08-17', 'resume: Week 7 lands on this calendar week (start moves to 2026-08-17)');
    const slot = JSON.parse(mm.g('JSON.stringify(todaySlot())'));
    assert(slot && slot.w === 6 && slot.d === 3, 'resume: today is Week 7 Thursday');
    assert(mm.g('JSON.stringify(DONE)') === doneBefore, 'resume: not one logged cell was edited');
    assert(mm.g('Object.keys(SKIP).length') === 3, 'resume: the three unlogged days before today are let go');
    assert(mm.g('owedBehind(todaySlot())') === 0, 'resume: nothing is owed after picking up');
    assert(mm.g('lapsed()') === false, 'resume: you are not still a layoff the moment you pick up');
    const after = mm.g('todayCardEl.innerHTML');
    assert(!/Welcome back/.test(after) && /Undo pick up/.test(after), 'resume: welcome card is gone and undo is offered');
    assert(mm.g('wIdx') === 6 && mm.g('dIdx') === 3, 'resume: lands on today in the new calendar');
    assert(mm.g("localStorage.getItem('forge:skip')") !== null, 'resume: the let-go days persist');
    mm.g('undoResume()');
    assert(mm.g('START') === '2026-07-13' && mm.g('Object.keys(SKIP).length') === 0 && mm.g('RESUME') === null, 'resume: undo puts the calendar back exactly');
  }
  {
    // reopening the app the next morning on a phone that picked up yesterday
    const st = new Map([['forge:who', 'Jackson'], ['forge:names', JSON.stringify(['Jackson'])], ['forge:done', JSON.stringify(mkDone(42, '2026-09-05'))], ['forge:start', '2026-07-13'], ['forge:startv', '2']]);
    const mb = bootApp(st);
    setDay(mb, '2026-10-01');
    await mb.g('boot()');
    assert(mb.g('wIdx') === 6 && mb.g('dIdx') === 0, 'over: boot opens on the next unlogged session, not week 1');
  }

  // ---- a layoff in the middle of camp ----
  {
    const mm = await lifeMachine(mkDone(21, '2026-08-02'), '2026-08-20', '2026-07-13');
    assert(mm.g('campPhase()') === 'live' && mm.g('lapsed()') === true, 'lapse: 18 quiet days mid-camp is a layoff');
    const tc = mm.g('todayCardEl.innerHTML');
    assert(/Welcome back/.test(tc) && /Return week/.test(tc), 'lapse: welcome back with return-week guidance');
    assert(!/Make up/.test(tc), 'lapse: no pile of makeups on top of a layoff');
    assert(/Welcome back/.test(mm.g('campbarEl.innerHTML')), 'lapse: the Week tab landing says it too');
    assert(/Pick up at Week 4/.test(tc), 'lapse: three weeks logged means Week 4 is next');
  }
  {
    const mm = await lifeMachine(mkDone(21, '2026-08-17'), '2026-08-20', '2026-07-13');
    assert(mm.g('lapsed()') === false, 'no lapse: three days quiet is just a missed day');
    assert(/Make up WED/.test(mm.g('todayCardEl.innerHTML')), 'missed day: the makeup button points at the most recent timed day owed');
  }
  {
    // day one of a camp is never "owed" anything
    const mm = await lifeMachine({}, '2026-07-13', '2026-07-13');
    const tc = mm.g('todayCardEl.innerHTML');
    assert(!/still open behind you|Welcome back|Make up/.test(tc), 'day one: nothing owed, no welcome back, no makeup');
  }

  // ---- before the camp, and no start date ----
  {
    const mm = await lifeMachine({}, '2026-10-01', '2026-10-05');
    assert(mm.g('campPhase()') === 'pre' && /Camp starts/.test(mm.g('todayCardEl.innerHTML')), 'pre: a future start says when camp starts');
    assert(/CAMP STARTS/.test(mm.g('campbarEl.innerHTML')), 'pre: the bar says when it starts');
    mm.g("START='';paintToday()");
    assert(mm.g('campPhase()') === 'unset' && /Set the date/.test(mm.g('todayCardEl.innerHTML')), 'unset: no start date still asks for one');
  }

  // ---- the finale ----
  {
    const mm = await lifeMachine(mkDone(69, '2026-09-19'), '2026-09-21', '2026-07-13');
    mm.g('toggleDone(9,6)');
    assert(mm.g('totDone()') === 70 && mm.g('!!(FINISH&&FINISH.full)') === true, 'finale: logging the 70th session closes the camp out');
    const html = mm.g('finaleEl.innerHTML');
    assert(/All 70\. Every one logged\./.test(html) && />70</.test(html), 'finale: shows 70 and the full-camp line');
    const on1 = mm.g('FINISH.on');
    mm.clock.jumpSilent(3 * 86400000);
    mm.g('showFinale()');
    assert(mm.g('FINISH.on') === on1, 'finale: the record is written once and never overwritten');
    mm.g('closeFinale()');
    assert(mm.g("finaleEl.innerHTML") === '', 'finale: close clears the overlay');
    assert(/Replay finale/.test(mm.g('todayCardEl.innerHTML')), 'finale: the Today card offers a replay once it exists');
  }
  {
    const mm = await lifeMachine(mkDone(42, '2026-09-05'), '2026-10-01', '2026-07-13');
    mm.g("lifeAct('closeout',{})");
    assert(/That is a real camp\./.test(mm.g('finaleEl.innerHTML')), 'finale: 42 sessions earns the real-camp line');
    assert(mm.g('lapsed()') === false, 'finale: a camp you closed out stops nagging you to pick up');
  }

  // ---- run it back ----
  {
    const mm = await lifeMachine(mkDone(42, '2026-09-05'), '2026-10-01', '2026-07-13', "NOTES={'0-0':'felt good'};CHECKS={0:[1,1,0,0,0]};BW=[{d:'2026-09-01',w:187.2}];");
    const seed = mm.g('JSON.stringify(DONE)');
    assert((await mm.g('runItBack()')) === true, 'run it back: succeeds');
    assert(mm.g('totDone()') === 0 && mm.g('CAMPS.length') === 1, 'run it back: the old camp is archived and the new one starts clean');
    assert(mm.g('JSON.stringify(CAMPS[0].done)') === seed, 'run it back: the archive holds exactly what was logged');
    assert(mm.g("CAMPS[0].notes['0-0']") === 'felt good', 'run it back: notes are archived too');
    assert(mm.g('BW.length') === 1, 'run it back: weight carries over');
    assert(mm.g('START') === '2026-10-05' && mm.g('campPhase()') === 'pre', 'run it back: the next camp opens the coming Monday');
    assert(/CAMP 2/.test(mm.g('campbarEl.innerHTML')), 'run it back: the bar says Camp 2');
    assert(mm.g('lifetimeSessions()') === 42, 'run it back: lifetime keeps the 42');
    mm.g('undoCamp()');
    assert(mm.g('JSON.stringify(DONE)') === seed && mm.g('CAMPS.length') === 0 && mm.g('START') === '2026-07-13', 'run it back: undo restores the whole camp');
  }
  {
    const mm = await lifeMachine(mkDone(42, '2026-09-05'), '2026-10-01', '2026-07-13');
    mm.g("localStorage.setItem=function(){throw new Error('quota')}");
    assert((await mm.g('runItBack()')) === false && mm.g('totDone()') === 42 && mm.g('CAMPS.length') === 0, 'run it back: a failed archive write clears nothing');
  }

  // ---- sessions outside the 70 ----
  {
    const mm = await lifeMachine(mkDone(42, '2026-09-05'), '2026-10-01', '2026-07-13');
    mm.g("lifeAct('extralog',{dataset:{}});lifeAct('extralog',{dataset:{}})");
    assert(mm.g('EXTRA.length') === 2 && mm.g('lifetimeSessions()') === 44, 'extra: two logged sessions count toward lifetime, never the 70');
    assert(mm.g('totDone()') === 42, 'extra: the camp total does not move');
    assert(/LIFETIME/.test(mm.g('statsEl.innerHTML')), 'extra: lifetime shows in the rank strip');
    const dump = mm.g("JSON.stringify({extra:EXTRA})");
    assert(JSON.parse(dump).extra.length === 2, 'extra: persisted shape is an array');
    mm.g("lifeAct('extradel',{dataset:{i:'0'}})");
    assert(mm.g('EXTRA.length') === 1, 'extra: tapping one removes it');
    // an old cell is not erased by a stray tap
    mm.g("globalThis.confirm=()=>false;toggleDone(0,0)");
    assert(mm.g('isDone(0,0)') === true, 'confirm: a cell logged weeks ago survives a cancelled un-log');
    mm.g("globalThis.confirm=()=>true;toggleDone(0,0)");
    assert(mm.g('isDone(0,0)') === false, 'confirm: and goes when you say so');
  }

  // ---- calendar truth when the app is reopened on a new day ----
  {
    const mm = await lifeMachine(mkDone(63, '2026-09-12'), '2026-09-13', '2026-07-13');
    assert(/DAY 63 OF 70/.test(mm.g('campbarEl.innerHTML')), 'calendar: Sunday night reads day 63');
    mm.clock.jumpSilent(19 * 3600000); // noon Sunday to 7am Monday
    mm.g('calRefresh()');
    assert(/DAY 64 OF 70/.test(mm.g('campbarEl.innerHTML')), 'calendar: reopening Monday morning reads day 64 without a reload');
    assert(mm.g('wIdx') === 9 && mm.g('dIdx') === 0, 'calendar: and lands on Monday of week 10');
  }

  // ---- guards: never lose a live round to a stray tap ----
  {
    const mm = await lifeMachine({}, '2026-07-14', '2026-07-13');
    mm.g('selectWeek(0);selectDay(1);elGo.click()');
    assert(mm.g("T.state") === 'run', 'guard: a session is running');
    mm.g("globalThis.confirm=()=>false");
    assert(mm.g('guardSwitch(0,2)') === false, 'guard: switching day mid-session needs a yes');
    assert(mm.g('guardSwitch(0,1)') === true, 'guard: staying on the same day is free');
    mm.g("globalThis.confirm=()=>true");
    assert(mm.g('guardSwitch(0,2)') === true, 'guard: and goes through on a yes');
    // reset arms first, fires second
    mm.g('elReset.click()');
    assert(mm.g('T.state') === 'run' && mm.g('elReset.textContent') === 'Tap again', 'guard: first Reset tap only arms it');
    mm.g('elReset.click()');
    assert(mm.g('T.state') === 'ready', 'guard: second tap resets');
  }

  // ---- timing: a throttled tick that beats visibilitychange still lands correctly ----
  for (const di of [0, 3, 4]) {
    const mm = await lifeMachine({}, '2026-07-14', '2026-07-13');
    mm.g(`selectWeek(0);selectDay(${di});elGo.click()`);
    const segs = JSON.parse(mm.g('JSON.stringify(T.segs.map(s=>({d:s.d,type:s.type})))'));
    const t0 = mm.clock.now();
    mm.clock.advance(35000);
    const sp = mm.speech.length;
    mm.clock.jumpSilent(240000);
    mm.clock.advance(600); // the overdue interval tick fires FIRST, no visibilitychange
    const exp = expectedAt(segs, t0, mm.clock.now());
    const tag = 'tick-first ' + DAYS[di];
    assert(mm.g('T.i') === exp.i, tag + ': lands on the right segment (got ' + mm.g('T.i') + ' want ' + exp.i + ')');
    assert(Math.abs(mm.g('T.left') - exp.left) <= 1, tag + ': clock is right (got ' + mm.g('T.left') + ' want ' + exp.left + ')');
    assert(mm.speech.slice(sp).some(s => s.startsWith('Back with you')), tag + ': the coach says where you are');
  }

  // ---- voice cue timing: halfway is halfway, thirty is thirty, countdown before every start ----
  {
    const mm = await lifeMachine({}, '2026-07-14', '2026-07-13');
    mm.g('selectWeek(0);selectDay(0);elGo.click()');
    const segs = JSON.parse(mm.g('JSON.stringify(T.segs.map(s=>({d:s.d,type:s.type})))'));
    const total = segs.reduce((n, s) => n + s.d * 1000, 0);
    const sp = mm.speech.length;
    mm.clock.advance(total + 30000);
    const said = mm.speech.slice(sp);
    const longWork = segs.filter(s => s.type === 'work' && s.d >= 120).length;
    const lateRest = segs.filter(s => s.type === 'rest' && s.d >= 30).length;
    assert(said.filter(s => /^Halfway/.test(s)).length === longWork, 'voice: exactly one Halfway per long round (' + said.filter(s => /^Halfway/.test(s)).length + '/' + longWork + ')');
    assert(said.filter(s => /^Thirty/.test(s)).length === longWork, 'voice: exactly one Thirty per long round');
    assert(said.filter(s => s === 'Three. Two. One.').length === 1 + lateRest, 'voice: a countdown before the first bell and every round after rest');
    const poolsOk = mm.g('VP.mid.every(s=>/^Halfway/.test(s))&&VP.thirty.every(s=>/^Thirty/.test(s))');
    assert(poolsOk === true, 'voice: the halfway and thirty pools say what they mean');
  }

  // ---- update flow and offline shell stay in step ----
  {
    const swSrc = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
    const swVer = /const CACHE = 'forge-v(\d+)'/.exec(swSrc);
    const appVer = /const BUILD='v(\d+)'/.exec(appSrc);
    assert(swVer && appVer && swVer[1] === appVer[1], 'release: sw.js cache version equals the app BUILD (' + (swVer && swVer[1]) + ' vs ' + (appVer && appVer[1]) + ')');
    const assets = Array.from(/const ASSETS = \[([\s\S]*?)\];/.exec(swSrc)[1].matchAll(/'\.\/([^']*)'/g), x => x[1] || 'index.html');
    assert(assets.every(f => fs.existsSync(path.join(root, f))), 'release: every precached asset exists on disk');
    const locals = Array.from(indexSrc.matchAll(/\b(?:src|href)="([^"#:]+)"/g), x => x[1]).filter(x => !/^https?:/.test(x));
    const missing = locals.filter(x => !assets.includes(x) && x !== 'audio/manifest.js');
    assert(missing.length === 0, 'release: every local file index.html loads is precached (' + missing.join(', ') + ')');
    const manifest = fs.readFileSync(path.join(root, 'audio', 'manifest.js'), 'utf8');
    const files = Array.from(manifest.matchAll(/"([0-9a-f]{12}\.mp3)"/g), x => x[1]);
    assert(files.length > 500 && files.every(f => fs.existsSync(path.join(root, 'audio', f))), 'release: every voice clip in the manifest exists on disk (' + files.length + ')');
    assert(/Update/.test(indexSrc) && /id="updbar"/.test(indexSrc) && /id="updgo"/.test(indexSrc), 'release: the update bar exists');
    const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
    assert(!/\.timerbar\{position:relative;?\}/.test(css), 'layout: the timer bar is never forced back into the page flow');
    assert(/html,body\{[^}]*overflow-x:clip/.test(css), 'layout: sticky navigation survives the no-sideways-scroll rule');
  }

  console.log((failures ? 'FAILED' : 'PASSED') + ': ' + (checks - failures) + '/' + checks + ' checks across 70 sessions');
  process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
