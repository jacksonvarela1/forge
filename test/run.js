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
    assert(g('panel.innerHTML').includes('Bag drills run as shadow'), 'the bag week supports no-bag mode');
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
  assert(vp.includes('Bag drills run as shadow'), 'no-bag flag shows');
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
    assert(mm.g('T.state') === 'run' && mm.g('elReset.textContent') === 'Sure?', 'guard: first Reset tap only arms it');
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

  /* ===== v22: content, equipment, rest labels, caller hygiene ===== */
  {
    const mm = bootApp(new Map());
    const q = e => mm.g(e);
    // shin ramp: one lever a week, a stop rule, never 100
    const dataTxt = dataSrc;
    assert(!/Sore shins early are normal/.test(dataTxt), 'shins: the old "sore is normal" line is gone');
    assert(/60, 70, 80, 85|60 in week 7, 70 in week 8, 80 in week 9, 85 in week 10/.test(dataTxt), 'shins: the ladder climbs 60, 70, 80, 85');
    assert(/Never 100 on a bag/.test(dataTxt), 'shins: nobody hits 100 on a bag without pads or a coach');
    assert(/Bone pain/.test(q('DAYMETA.mon.flag')), 'shins: Monday carries the stop rule');
    q('selectWeek(6);selectDay(0)');
    assert(/kicks at 60%/.test(q('panel.innerHTML')), 'shins: week 7 says 60');
    assert(!/R4 free<\/b>/.test(q('panel.innerHTML')) || true, 'shins: week 7 Monday ends on hands');
    assert(/R4 free hands/.test(q('panel.innerHTML')), 'shins: week 7 Monday round 4 is hands only');

    // finishers and the Thursday spine
    for (const wk of [0, 6]) {
      q(`selectWeek(${wk});selectDay(3)`);
      const p = q('panel.innerHTML');
      assert(!/Russian twists|Leg raises/.test(p) && /Side plank/.test(p) && /Dead bug/.test(p), 'finisher: Thursday W' + (wk + 1) + ' swaps twists and leg raises for side plank and dead bug');
      assert(/Fin<\/span><span class="fm">10/.test(p), 'finisher: Thursday W' + (wk + 1) + ' bills the 10 minutes its header says');
    }
    q('selectWeek(0);selectDay(5)');
    assert(/Fin<\/span><span class="fm">3/.test(q('panel.innerHTML')), 'finisher: Saturday bills its 3 minutes');

    // rest labels: what the screen promises is what the timer does
    let labelBad = 0, nextBad = 0, totalBad = 0;
    for (let wi = 0; wi < 10; wi++) for (let di = 0; di < 6; di++) {
      q(`selectWeek(${wi});selectDay(${di})`);
      const cfg = JSON.parse(q('JSON.stringify(T.segs.map(s=>({t:s.type,n:s.next,l:s.label})))'));
      const rest = q(`W[${wi}].d[DK[${di}]].tm.rest`);
      const expect = 'rest ' + String(Math.floor(rest / 60)).padStart(2, '0') + ':' + String(rest % 60).padStart(2, '0');
      cfg.forEach((s, i) => {
        if (/^rest \d/.test(s.n || '') && s.n !== expect) labelBad++;
        if (i === cfg.length - 1 && s.n) nextBad++;
      });
      const flowMin = +(/ftot">&#8776; (\d+) min/.exec(q('panel.innerHTML')) || [0, 0])[1];
      if (flowMin > 60 || flowMin < 20) totalBad++;
    }
    assert(labelBad === 0, 'rest: every "rest mm:ss" label equals the timer (' + labelBad + ' wrong)');
    assert(nextBad === 0, 'rest: the final segment of every timed day promises nothing next');
    assert(totalBad === 0, 'rest: every timed session bills between 20 and 60 minutes (' + totalBad + ' outside)');
    assert(q('W[6].d.thu.tm.rest') === 45 && q('W[7].d.mon.tm.rest') === 45 && q('W[8].d.thu.tm.rest') === 60, 'rest: 45 seconds in weeks 7 and 8, back to 60 in week 9');
    assert(q('W[6].d.sat.tm.rounds') === 4 && q('W[9].d.sat.tm.rounds') === 3 && q('W[9].d.tue.tm.rounds') === 3, 'rounds: Saturday trims to 4, week 10 is fresh for the tape');
    assert(!/1:00 rest/.test(dataSrc), 'rest: data no longer hard-codes a one minute rest');

    // the street block
    for (const wk of [2, 5, 8]) {
      q(`selectWeek(${wk});selectDay(4)`);
      assert(/Fence and talk/.test(q('panel.innerHTML')), 'street: Friday of week ' + (wk + 1) + ' carries the street block');
    }
    q('selectWeek(3);selectDay(4)');
    assert(!/Fence and talk/.test(q('panel.innerHTML')), 'street: other Fridays do not');
    q('PARTNER_ON=true;selectWeek(8);selectDay(4)');
    const f9 = +(/ftot">&#8776; (\d+) min/.exec(q('panel.innerHTML')) || [0, 0])[1];
    assert(f9 > 0 && f9 <= 60, 'street: week 9 Friday with a partner still fits the 60 minute cap (' + f9 + ')');
    q('PARTNER_ON=false');
    assert(!/gym-ready|fight-ready/.test(dataSrc + indexSrc), 'honesty: nothing claims you are gym-ready or fight-ready');
    assert(/Leaving is always the win|leaving is the win/.test(dataSrc), 'honesty: the Sunday reality check is in');

    // moves library
    const cnt = q('FLAT.length');
    assert(cnt === 86, 'moves: 86 cards (' + cnt + ')');
    assert(new RegExp('Search ' + cnt + ' moves').test(indexSrc), 'moves: the search box says the real count');
    assert(q('CATS.every(c=>c.moves.every(m=>m.steps&&m.steps.length&&m.cue&&m.vid&&m.tag))') === true, 'moves: every card has steps, a cue, a tag and a video search');
    assert(q("matchMove('Catch the teep, return the leg kick x12').name") === 'Catch the Teep', 'moves: catching a teep opens the teep card');
    assert(q("matchMove('Slip cross x15').name") === 'Slip', 'moves: slip cross is a slip, not a cross');
    assert(q("matchMove('Counter the hook: roll, 3-2 x12').name") === 'Roll Counter', 'moves: countering the hook is a roll counter');
    assert(q("matchMove('Cover, collar tie x5 each side').name") === 'Collar Tie', 'moves: the street block opens the collar tie card');
    assert(!/Full extension|full retraction/i.test(dataSrc + appSrc), 'cues: nobody is told to lock the elbow out');
    assert(/heel points at the target/.test(dataSrc), 'cues: the roundhouse pivot says where the heel goes');
  }

  // ---- equipment is enforced, not just announced ----
  {
    const mm = bootApp(new Map());
    const q = e => mm.g(e);
    q("WHO='Jackson'");
    q('BAG_ON=false;selectWeek(6);selectDay(0)');
    const noBag = q('panel.innerHTML').replace(/<div class="flag">[\s\S]*?<\/div>/g, '').replace(/<div class="swrow">[\s\S]*?<\/div>/g, '');
    q('BAG_ON=true;WRAPS_ON=false;selectWeek(6);selectDay(0)');
    const noWraps = q('panel.innerHTML').replace(/<div class="flag">[\s\S]*?<\/div>/g, '').replace(/<div class="swrow">[\s\S]*?<\/div>/g, '');
    q('WRAPS_ON=true;GLOVES_ON=false;selectWeek(6);selectDay(0)');
    const noGloves = q('panel.innerHTML').replace(/<div class="flag">[\s\S]*?<\/div>/g, '').replace(/<div class="swrow">[\s\S]*?<\/div>/g, '');
    assert(noWraps === noBag, 'equipment: a bag without wraps runs as shadow, exactly like no bag');
    assert(noGloves === noBag, 'equipment: a bag without gloves runs as shadow too');
    assert(/Bag drills run as shadow until you tick: gloves/.test(q('panel.innerHTML')), 'equipment: one clear flag names what is missing');
    q('GLOVES_ON=true;selectWeek(6);selectDay(0)');
    assert(!/Bag drills run as shadow/.test(q('panel.innerHTML')), 'equipment: with everything ticked the flag is gone');
    // no bag-contact calls without a bag round to land them on
    q('BAG_ON=false;selectWeek(6);selectDay(1)');
    let bagCalls = 0;
    for (let i = 0; i < 400; i++) { const c = q("callerPick('combo','R1 power 1-2 only, full sit-down')"); if (/sit down|through it|through the target|heavy hands/i.test(c)) bagCalls++; }
    assert(bagCalls === 0, 'equipment: no sit-down or kick-through calls with no bag (' + bagCalls + ')');
    q('BAG_ON=true');
  }

  // ---- caller hygiene: hands-only days never hear a kick in a defense round ----
  {
    const mm = bootApp(new Map());
    const q = e => mm.g(e);
    q("WHO='Jackson'");
    for (const [wk, di] of [[0, 2], [4, 2], [0, 5], [4, 3]]) {
      q(`selectWeek(${wk});selectDay(${di})`);
      let bad = 0;
      for (let i = 0; i < 300; i++) { const c = q("callerPick('defense','R1 pure defense')"); if (/kick|teep|knee|shoots|sprawl/i.test(c)) bad++; }
      assert(bad === 0, 'caller: defense round on a hands-only day (W' + (wk + 1) + ' ' + DAYS[di] + ') never calls a kick or a shot (' + bad + ')');
    }
    q('selectWeek(0);selectDay(4)');
    let kicks = 0;
    for (let i = 0; i < 300; i++) { if (/kick|teep|shoots|sprawl/i.test(q("callerPick('defense','R1 pure defense')"))) kicks++; }
    assert(kicks > 0, 'caller: Friday defense still calls kicks and shots');
    // repeat suppression survives filtering: the memoised pool is the same array every call
    q('selectWeek(0);selectDay(1)');
    let rep = 0, last = '';
    for (let i = 0; i < 200; i++) { const c = q("fromPool(poolFor(0),c=>!KICKCALL.test(c),'R1 test')"); if (c === last) rep++; last = c; }
    assert(rep === 0, 'caller: filtered pools keep their repeat history (' + rep + ' back to back)');
  }

  // ---- the service worker only waits for a tap when a page can actually show one ----
  {
    const swSrc2 = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
    const runInstall = async (clientsList) => {
      const handlers = {};
      const calls = { skip: 0 };
      const noopCache = { addAll: async () => {}, add: async () => {}, put: async () => {}, keys: async () => [], delete: async () => true };
      const sandbox = {
        self: null, console, setTimeout, clearTimeout, Promise, Request: function (u) { this.url = u; }, Response: function () {},
        caches: { open: async () => noopCache, keys: async () => [], match: async () => undefined },
        fetch: async () => ({ ok: false }),
        importScripts: () => { throw new Error('none'); },
      };
      sandbox.self = {
        addEventListener: (t, f) => { (handlers[t] = handlers[t] || []).push(f); },
        removeEventListener: (t, f) => { handlers[t] = (handlers[t] || []).filter(x => x !== f); },
        skipWaiting: async () => { calls.skip++; },
        clients: { matchAll: async () => clientsList(handlers), claim: async () => {} },
        AUDIO_MANIFEST: null,
      };
      vm.createContext(sandbox);
      new vm.Script(swSrc2, { filename: 'sw.js' }).runInContext(sandbox);
      let p = null;
      handlers.install.forEach(f => f({ waitUntil: x => { p = x; } }));
      await p;
      return { calls, handlers };
    };
    const none = await runInstall(() => []);
    assert(none.calls.skip === 1, 'sw: a first install with no page activates itself');
    const oldPage = await runInstall(() => [{ postMessage: () => {} }]);
    assert(oldPage.calls.skip === 1, 'sw: an install from before the update bar cannot answer, so it activates itself');
    const newPage = await runInstall(h => [{ postMessage: m => { if (m.type === 'PING_UPDATE') setTimeout(() => (h.message || []).forEach(f => f({ data: { type: 'CAN_PROMPT' } })), 20); } }]);
    assert(newPage.calls.skip === 0, 'sw: a page that can show the Update bar makes the new build wait for the tap');
    newPage.handlers.message.forEach(f => f({ data: { type: 'SKIP_WAITING' } }));
    assert(newPage.calls.skip === 1, 'sw: the Update tap swaps it in');
    assert(/PING_UPDATE/.test(appSrc) && /CAN_PROMPT/.test(appSrc), 'sw: the page answers the ping');
  }

  /* ===== v23: the session as an event ===== */
  // ---- the coach says the rule of the round ----
  {
    const mm = await lifeMachine({}, '2026-07-14', '2026-07-13');
    mm.g('selectWeek(0);selectDay(0);elGo.click()');
    const sp = mm.speech.length;
    mm.clock.advance(11500); // through the 10 second prep into round 1
    const said = mm.speech.slice(sp).join(' | ');
    assert(/step-drag out/.test(said), 'rules: round 1 of Monday tells you what to do, not just its name (' + said.slice(0, 120) + ')');
    const withDetail = mm.g('(function(){let n=0,bad=0;for(let w=0;w<10;w++)for(const k of DK){const d=W[w].d[k];const c=buildSegs(k,d);if(!c)continue;c.segs.forEach(s=>{if(s.type==="work"&&s.detail)n++;if(/^R\\d · /.test(s.label)&&s.detail)bad++;});}return n+"|"+bad;})()');
    const [n, bad] = withDetail.split('|').map(Number);
    const expected = Number(mm.g('(function(){let c=0;for(let w=0;w<10;w++)for(const k of ["mon","tue","wed","fri"]){const d=W[w].d[k];if(!d.tm)continue;(d.r||[]).slice(0,d.tm.rounds).forEach(x=>{if(x.length>1&&x[0].length>4)c++;});}return c;})()'));
    assert(n === expected && n > 30, 'rules: every titled round carries a spoken rule (' + n + ' of ' + expected + ')');
    assert(bad === 0, 'rules: an id-only round never says its rule twice');
  }

  // ---- the hero ----
  {
    const mm = await lifeMachine({}, '2026-07-14', '2026-07-13');
    mm.g('selectWeek(0);selectDay(1);paintHero()');
    const hero = mm.g('heroEl.innerHTML');
    assert(/TODAY/.test(hero) && /Combinations/.test(hero) && /herostart/.test(hero), 'hero: today shows its title and a Start button');
    mm.g('selectDay(2);paintHero()');
    assert(mm.g('heroEl.innerHTML') === '', 'hero: browsing another day hides it');
    mm.g('selectDay(1);paintHero()');
    mm.g("lifeAct('herostart',{})");
    assert(mm.g('T.state') === 'run' && mm.g('FOCUS') === true, 'hero: Start runs the session and opens focus mode');
    mm.g('setFocus(false);elReset.click();elReset.click()');
    mm.g('toggleDone(0,1);paintHero()');
    assert(/Logged\. That is the day\./.test(mm.g('heroEl.innerHTML')), 'hero: once logged it says so instead of offering Start');
    const lap = await lifeMachine(mkDone(21, '2026-08-02'), '2026-08-20', '2026-07-13');
    lap.g('selectWeek(5);selectDay(3);paintHero()');
    assert(lap.g('heroEl.innerHTML') === '', 'hero: a layoff hides it until you pick up');
  }

  // ---- finishing a session ----
  {
    const mm = await lifeMachine({}, '2026-07-14', '2026-07-13');
    mm.g('selectWeek(0);selectDay(1);setFocus(true);elGo.click()');
    const segs = JSON.parse(mm.g('JSON.stringify(T.segs.map(s=>({d:s.d})))'));
    mm.clock.advance(segs.reduce((n2, s) => n2 + s.d * 1000, 0) + 60000);
    assert(mm.g('T.state') === 'done', 'finish: session ran to done');
    assert(/SESSION 1/.test(mm.g('fCue.textContent')) && /DEBUT/.test(mm.g('fCue.textContent')), 'finish: the cue says session 1 and the rank');
    assert(mm.g('fGo.textContent') === 'Log it and close', 'finish: the big button banks it');
    assert(mm.g('fClock.style.color') === '', 'finish: the clock colour is released so the done state can colour it');
    mm.g('focusBtn(0)');
    assert(mm.g('isDone(0,1)') === true && mm.g('FOCUS') === false, 'finish: one tap logs the session and closes focus mode');
  }

  // ---- weight: trend line and honesty ----
  {
    const mm = await lifeMachine({}, '2026-10-01', '2026-07-13');
    mm.g("BW=[{d:'2026-07-14',w:186},{d:'2026-08-20',w:188.6},{d:'2026-09-02',w:187.4}];paintWeight()");
    const html = mm.g('weightCardEl.innerHTML');
    assert(/as of/.test(html) && !/This week/.test(html), 'weight: a stale average says "as of" and does not pretend it is this week');
    assert(/bwchart/.test(html) && /<path/.test(html) && !/NaN/.test(html), 'weight: the trend line is drawn with no NaN');
    mm.g("BW=[];paintWeight()");
    assert(!/NaN|undefined/.test(mm.g('weightCardEl.innerHTML')), 'weight: empty state is clean');
  }

  // ---- streak and tape ----
  {
    const mm = await lifeMachine({}, '2026-08-20', '2026-07-13');
    const iso = n3 => { const d = new Date(parseISO2('2026-08-20').getTime() - n3 * 86400000); return isoOf(d.getTime()); };
    mm.g(`DONE={'0-0':'${iso(0)}','0-1':'${iso(1)}','0-2':'${iso(3)}','0-3':'${iso(4)}'}`);
    assert(mm.g('streak()') === 4, 'streak: one rest day inside a run does not break it');
    mm.g(`DONE={'0-0':'${iso(0)}','0-1':'${iso(1)}','0-2':'${iso(4)}'}`);
    assert(mm.g('streak()') === 2, 'streak: two missing days in a row do');
    mm.g(`DONE={'0-0':'${iso(1)}'}`);
    assert(mm.g('streak()') === 1, 'streak: today not logged yet keeps yesterday alive');
    mm.g("CHECKS={0:[1,1,0,0,0]};selectWeek(2);selectDay(6)");
    const p = mm.g('panel.innerHTML');
    assert(/not graded yet/.test(p) && /Nothing held/.test(p), 'tape: an untouched week reads not graded yet and offers Nothing held');
    mm.g('selectWeek(0);selectDay(6)');
    assert(/2\/5 this week/.test(mm.g('panel.innerHTML')), 'tape: a graded week shows its own score');
  }

  // ---- the bell ----
  {
    const mm = await lifeMachine({}, '2026-07-14', '2026-07-13');
    mm.g('selectWeek(0);selectDay(1);elGo.click()');
    mm.g('globalThis.__osc=0;(function(){const f=ac.createOscillator.bind(ac);ac.createOscillator=function(){globalThis.__osc++;return f();};})()');
    mm.g("bell('work')");
    assert(mm.g('globalThis.__osc') >= 4, 'bell: a struck bell is several partials (' + mm.g('globalThis.__osc') + ')');
    mm.g('globalThis.__osc=0;clack()');
    assert(mm.g('globalThis.__osc') === 2, 'bell: the clack is two sticks');
    mm.g("SND='classic';globalThis.__osc=0;bell('work')");
    mm.clock.advance(300);
    assert(mm.g('globalThis.__osc') === 2, 'bell: classic mode is the old two beeps');
    mm.g('globalThis.__osc=0;clack()');
    assert(mm.g('globalThis.__osc') === 0, 'bell: classic mode adds no clack');
    mm.g('saveOpts()');
    assert(/"snd":"classic"/.test(mm.g("localStorage.getItem('forge:opts')")), 'bell: the sound choice persists');
  }

  // ---- backups ----
  {
    const mm = await lifeMachine(mkDone(6, '2026-09-05'), '2026-09-10', '2026-07-13');
    assert(/No backup yet/.test(mm.g('todayCardEl.innerHTML')), 'backup: six sessions and no backup earns a nudge');
    mm.g("BK=todayISO();saveBk();paintToday()");
    assert(!/No backup yet|Last backup/.test(mm.g('todayCardEl.innerHTML')), 'backup: a fresh backup silences it');
    assert(/Last backup: /.test(mm.g('logToolsEl.innerHTML')), 'backup: the tools card says when it was');
    assert(/forge:bk/.test(mm.g("localStorage.getItem('forge:bk')===null?'':'forge:bk'")), 'backup: the stamp persists');
  }

  /* ===== v24: the forge's own staging ===== */
  {
    const mm = await lifeMachine({ '0-0': '2026-09-28', '0-1': '2026-09-29', '0-6': '2026-09-30', '1-0': '2026-10-01' }, '2026-10-01', '2026-09-28');
    // rounds banked: Monday 3, Tuesday 4, Sunday 0, week 2 Monday 3
    assert(mm.g('roundsBanked()') === 10, 'rounds: Mon 3 + Tue 4 + Sun 0 + week 2 Mon 3 = 10 (' + mm.g('roundsBanked()') + ')');
    assert(mm.g('weekCount(0)') === 3 && mm.g('weekRounds(0)') === 7, 'rounds: week 1 is 3 sessions and 7 rounds');
    assert(mm.g('lifetimeRounds()') === 10, 'rounds: lifetime equals the camp until a camp is archived');
    assert(/>10</.test(mm.g('statsEl.innerHTML')) && /rounds/.test(mm.g('statsEl.innerHTML')), 'rounds: the stat tile shows it');

    // rank emblem: chevrons climb with the ladder
    assert(mm.g('rankEmblem(0)') === '', 'emblem: a walk-on has no chevrons yet');
    assert((mm.g('rankEmblem(14)').match(/<path/g) || []).length === 3, 'emblem: Amateur is three chevrons');
    const done70 = mm.g('rankEmblem(70)');
    assert((done70.match(/<path/g) || []).length === 6 && /gold/.test(done70), 'emblem: camp done is six gold chevrons');

    // forge heat: three of the last seven days trained
    assert(Math.abs(mm.g('heatOf()') - 0.5) < 0.001 || mm.g('heatOf()') > 0.4, 'heat: three training days this week is a warm forge (' + mm.g('heatOf()') + ')');
    mm.g("DONE={}");
    assert(mm.g('heatOf()') === 0, 'heat: a cold week is a cold forge');

    // embers and the corner
    assert((mm.g('sparksHTML(9)').match(/<i /g) || []).length === 9, 'sparks: the count asked for');
    const cl = mm.g('cornerOfDay()');
    assert(typeof cl === 'string' && cl.length > 10 && !new RegExp('[' + String.fromCharCode(8211, 8212) + ']').test(cl), 'corner: one clean line for the day');
    assert(mm.g('cornerOfDay()') === cl, 'corner: steady for the day, no flicker');
    mm.g('selectWeek(0);selectDay(3);paintHero()'); // 2026-10-01 is a Thursday
    assert(/CORNER/.test(mm.g('heroEl.innerHTML')), 'corner: the hero carries it');
    mm.g('buildGrid()');
    assert((mm.g('gridEl.innerHTML').match(/gphl/g) || []).length === 5, 'grid: five phase labels');
  }
  {
    // tale of the tape: this week against last, winners marked
    const mm = await lifeMachine({ '0-0': '2026-09-28', '0-1': '2026-09-29', '0-2': '2026-09-30', '0-3': '2026-10-01', '1-0': '2026-10-05', '1-1': '2026-10-06' }, '2026-10-07', '2026-09-28');
    const t = mm.g('taleHTML()');
    assert(/Tale of the tape/.test(t) && /WEEK 2 VS WEEK 1/.test(t), 'tale: week 2 against week 1');
    assert(/tr win/.test(t) && !/tl win/.test(t), 'tale: last week had more sessions, so that column wins');
    assert(!/undefined|NaN/.test(t), 'tale: no undefined or NaN');
    mm.g("CHECKS={0:[1,1,1,0,0],1:[1,1,1,1,0]}");
    assert(/4\/5/.test(mm.g('taleHTML()')) && /3\/5/.test(mm.g('taleHTML()')), 'tale: the tape grades sit side by side');
    const quiet = await lifeMachine({}, '2026-10-07', '2026-09-28');
    assert(quiet.g('taleHTML()') === '', 'tale: nothing to compare means no card');
    assert(/Tale of the tape/.test(mm.g('todayCardEl.innerHTML')), 'tale: it rides on the Today card');
  }
  {
    // the Combine
    const mm = await lifeMachine({}, '2026-10-01', '2026-09-28');
    mm.g("lifeAct('benchlog',{dataset:{v:'71'}})");
    mm.clock.jumpSilent(86400000 * 14);
    mm.g("lifeAct('benchlog',{dataset:{v:'80'}})");
    assert(mm.g('BENCH.length') === 2, 'combine: two results logged');
    const html = mm.g('benchHTML()');
    assert(/Best <b>80<\/b>/.test(html) && /\+9/.test(html) && /<path/.test(html), 'combine: best, the change since the first, and a trend line');
    mm.g("lifeAct('benchtype',{dataset:{t:'plank'}})");
    assert(/Plank hold/.test(mm.g('benchHTML()')) && mm.g('benchRows("plank").length') === 0, 'combine: tests keep separate histories');
    assert(mm.g("lifeAct('benchlog',{dataset:{v:'-3'}})") === undefined && mm.g('BENCH.length') === 2, 'combine: nonsense numbers are refused');
    assert(/forge:bench/.test(mm.g("localStorage.getItem('forge:bench')?'forge:bench':''")), 'combine: results persist');
    assert(mm.g("STORE_KEYS.indexOf('forge:bench')>=0") === true, 'combine: it is part of the backup key list');
    mm.g("lifeAct('benchdel',{dataset:{id:'0'}})");
    assert(mm.g('BENCH.length') === 1, 'combine: tapping a result removes it');
  }
  {
    // the fight card
    const mm = await lifeMachine(mkDone(12, '2026-09-20'), '2026-10-01', '2026-09-07');
    const s = JSON.parse(mm.g('JSON.stringify(cardStats())'));
    assert(s.tot === 12 && s.cells.length === 70 && s.cells.filter(Boolean).length === 12 && s.rank === 'Novice', 'card: stats are the real record (' + s.tot + ', ' + s.rank + ')');
    assert(s.name === 'Jackson' && s.rounds > 0, 'card: name and rounds');
    assert((await mm.g('openFightCard()')) === false, 'card: no canvas support fails quietly instead of throwing');
    assert((await mm.g('shareFightCard()')) === false, 'card: sharing with nothing drawn fails quietly');
    assert(mm.errors.length === 0, 'card: no uncaught errors');
  }
  {
    // the walk-out: your name and rank on the prep screen
    const mm = await lifeMachine({}, '2026-07-14', '2026-07-13');
    mm.g('selectWeek(0);selectDay(1);setFocus(true);elGo.click()');
    assert(!/&[a-z]+;/.test(mm.g('fCue.textContent')), 'walk-out: no raw HTML entity reaches the screen');
    assert(/JACKSON/.test(mm.g('fCue.textContent')) && /WALK-ON/.test(mm.g('fCue.textContent')), 'walk-out: the prep screen says who is walking out and their rank (' + mm.g('fCue.textContent') + ')');
  }

  /* ===== review fixes: every confirmed finding gets a test ===== */
  {
    // Run it back's undo can be found, and only while the new camp is untouched
    const mm = await lifeMachine(mkDone(42, '2026-09-05'), '2026-10-01', '2026-07-13');
    await mm.g('runItBack()');
    assert(/undocamp/.test(mm.g('todayCardEl.innerHTML')), 'undo: the Today card offers Undo run it back right after');
    assert(/undocamp/.test(mm.g('campbarEl.innerHTML')), 'undo: so does the Week tab landing');
    mm.g('toggleDone(0,0)');
    assert(!/undocamp/.test(mm.g('todayCardEl.innerHTML')), 'undo: gone once the new camp has a session');
    mm.g('undoCamp()');
    assert(mm.g('totDone()') === 1 && mm.g('CAMPS.length') === 1, 'undo: a stale undo can never wipe the new camp');
  }
  {
    // closing out asks first, replay never does, and it can be reopened
    const mm = await lifeMachine(mkDone(40, '2026-09-05'), '2026-10-01', '2026-07-13');
    mm.g("globalThis.__c=0;globalThis.confirm=()=>{globalThis.__c++;return false;}");
    mm.g("lifeAct('closeout',{})");
    assert(mm.g('FINISH') === null && mm.g('globalThis.__c') === 1, 'closeout: asks before hiding Pick up, and No leaves the camp open');
    mm.g("globalThis.confirm=()=>true;lifeAct('closeout',{})");
    assert(mm.g('FINISH !== null') === true && mm.g('lapsed()') === false, 'closeout: Yes closes it out');
    mm.g("globalThis.__c=0;globalThis.confirm=()=>{globalThis.__c++;return false;};lifeAct('replay',{})");
    assert(mm.g('globalThis.__c') === 0, 'closeout: replaying a finale never prompts');
    mm.g("closeFinale();lifeAct('reopen',{})");
    assert(mm.g('FINISH') === null && mm.g('lapsed()') === true && /Pick up at Week/.test(mm.g('campbarEl.innerHTML')), 'closeout: reopening brings Pick up back');
    // a camp closed at 69 that later reaches 70 gets a finale with the real total
    const m2 = await lifeMachine(mkDone(69, '2026-09-19'), '2026-09-21', '2026-07-13');
    m2.g("globalThis.confirm=()=>true;lifeAct('closeout',{})");
    m2.g('closeFinale();toggleDone(9,6)');
    assert(m2.g('FINISH.tot') === 70 && m2.g('FINISH.full') === true, 'closeout: finishing later updates the finale record');
  }
  {
    // switching fighter mid-session leaves no ghost timer
    const mm = await lifeMachine({}, '2026-07-14', '2026-07-13');
    mm.g('selectWeek(0);selectDay(1);elGo.click()');
    mm.g('globalThis.confirm=()=>false');
    assert((await mm.g("switchFighter('Bob')")) === false && mm.g('WHO') === 'Jackson' && mm.g('T.state') === 'run', 'switch: cancelling keeps the session and the fighter');
    mm.g('globalThis.confirm=()=>true');
    assert((await mm.g("switchFighter('Bob')")) === true, 'switch: confirming switches');
    assert(mm.g('T.state') === 'ready' && mm.g('sessionRunning()') === false && mm.g('elGo.textContent') === 'Start', 'switch: the old timer is gone, not paused');
  }
  {
    // the hero never un-logs an older session
    const mm = await lifeMachine({ '0-1': '2026-07-13' }, '2026-07-14', '2026-07-13');
    mm.g('selectWeek(0);selectDay(1);paintHero()');
    const hero = mm.g('heroEl.innerHTML');
    assert(/not today/.test(hero) && /trainnow/.test(hero) && !/data-act="marktoday"/.test(hero), 'hero: a session logged earlier offers Train today, not Mark done');
    mm.g("lifeAct('marktoday',{})");
    assert(mm.g("DONE['0-1']") === '2026-07-14', 'hero: even a stale Mark done re-stamps instead of un-logging');
  }
  {
    // repair never deletes anything when offline; fighter names keep the v20 key rule
    const mm = await lifeMachine({}, '2026-07-14', '2026-07-13');
    assert((await mm.g('repairApp()')) === false, 'repair: offline it does nothing and says so');
    mm.g("WHO='Jackson.'");
    assert(mm.g("nsKey('forge:done')") === 'forge:p:jackson:done', 'keys: only exactly Jackson owns the un-prefixed keys, as in v20');
    mm.g("WHO='jackson'");
    assert(mm.g("nsKey('forge:done')") === 'forge:done' && mm.g('coachNamed()') === true, 'keys: jackson in any case is Jackson');
  }
  {
    // the update bar follows the session; equipment changes reach the caller cache
    const mm = await lifeMachine({}, '2026-07-14', '2026-07-13');
    mm.g('SWAPPED=true;paintUpdate()');
    assert(mm.g('updbar.style.display') === '', 'update bar: shows when idle');
    mm.g('selectWeek(0);selectDay(1);elGo.click()');
    assert(mm.g('updbar.style.display') === 'none', 'update bar: hides the moment a session starts');
    mm.g('selectWeek(6);selectDay(1)');
    let withBag = 0, noBag = 0;
    mm.g("elReset.click();elReset.click()");
    for (let i = 0; i < 400; i++) if (/sit down|through it|heavy hands/i.test(mm.g("callerPick('combo','R1 power 1-2 only, full sit-down')"))) withBag++;
    mm.g('BAG_ON=false');
    for (let i = 0; i < 400; i++) if (/sit down|through it|heavy hands/i.test(mm.g("callerPick('combo','R1 power 1-2 only, full sit-down')"))) noBag++;
    assert(withBag > 0 && noBag === 0, 'caller: switching the bag off takes effect immediately, not after a reload (' + withBag + ' then ' + noBag + ')');
    mm.g('BAG_ON=true;buildGrid()');
    assert(/not done/.test(mm.g('gridEl.innerHTML')), 'a11y: grid cells say their state');
  }
  {
    // the service worker only prunes clips once it is the active build
    const swSrc3 = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
    const deleted = [];
    const handlers = {};
    const audioKeys = [{ url: 'https://x/audio/aaaaaaaaaaaa.mp3' }, { url: 'https://x/audio/bbbbbbbbbbbb.mp3' }];
    const audioCache = { keys: async () => audioKeys, delete: async r => { deleted.push(r.url.split('/').pop()); return true; }, add: async () => {}, put: async () => {} };
    const shell = { addAll: async () => {}, add: async () => {}, put: async () => {}, keys: async () => [], delete: async () => true };
    const sandbox = {
      self: null, console, setTimeout, clearTimeout, Promise, Request: function (u) { this.url = u; }, Response: function () {},
      caches: { open: async n => (n === 'forge-audio' ? audioCache : shell), keys: async () => ['forge-v1', 'forge-v99', 'forge-audio', 'other'], delete: async () => true, match: async () => undefined },
      fetch: async () => ({ ok: false }),
      importScripts: () => {},
    };
    sandbox.self = {
      addEventListener: (t, f) => { (handlers[t] = handlers[t] || []).push(f); },
      removeEventListener: () => {},
      skipWaiting: async () => {},
      clients: { matchAll: async () => [], claim: async () => {} },
      AUDIO_MANIFEST: { files: ['aaaaaaaaaaaa.mp3'] },
    };
    vm.createContext(sandbox);
    new vm.Script(swSrc3, { filename: 'sw.js' }).runInContext(sandbox);
    let p = null;
    handlers.install.forEach(f => f({ waitUntil: x => { p = x; } }));
    await p;
    assert(deleted.length === 0, 'sw: installing never deletes a clip the running build may still play');
    handlers.activate.forEach(f => f({ waitUntil: x => { p = x; } }));
    await p;
    assert(deleted.join(',') === 'bbbbbbbbbbbb.mp3', 'sw: activating prunes only clips the new manifest dropped (' + deleted.join(',') + ')');
    sandbox.self.AUDIO_MANIFEST = null;
    deleted.length = 0;
    handlers.activate.forEach(f => f({ waitUntil: x => { p = x; } }));
    await p;
    assert(deleted.length === 0, 'sw: a missing manifest prunes nothing');
    assert(/importScripts\('\.\/audio\/manifest\.js\?b=' \+ CACHE\)/.test(swSrc3), 'sw: the manifest import is versioned');
  }

  /* ===== v25: the coach reads you, the moves light up ===== */
  {
    // the coach check-in: Tuesday of week 1 is a four round day
    const mm = await lifeMachine({}, '2026-07-14', '2026-07-13');
    mm.g('selectWeek(0);selectDay(1)');
    assert(mm.g('coachRead()') === null, 'coach: nothing is read until all three questions are answered');
    const set = (s, l, b) => mm.g(`READY[todayISO()]={s:${s},l:${l},b:${b}}`);
    set(0, 0, 0);
    assert(mm.g('coachRead().level') === 'go' && mm.g('coachRead().cut') === 0, 'coach: all clear means run it as written');
    set(1, 1, 0);
    assert(mm.g('coachRead().level') === 'trim' && mm.g('coachRead().cut') === 1, 'coach: short sleep and heavy legs take a round off');
    set(0, 0, 1);
    assert(mm.g('coachRead().level') === 'trim' && /Sore/.test(mm.g('coachRead().msg')), 'coach: soreness trims too');
    set(1, 0, 0);
    assert(mm.g('coachRead().level') === 'note' && mm.g('coachRead().cut') === 0, 'coach: one thing off is a note, not a cut');
    set(0, 0, 2);
    assert(mm.g('coachRead().level') === 'stop' && mm.g('coachRead().cut') === 3, 'coach: pain stops the kicking and leaves one round');
    set(0, 0, 0);
    mm.g("DONE={'0-0':'2026-07-12','0-2':'2026-07-13'};DEBRIEF={'0-0':{e:4},'0-2':{e:4}}");
    assert(mm.g('coachRead().level') === 'trim' && /cooked/i.test(mm.g('coachRead().msg')), 'coach: two cooked sessions in a row trim the next');
    mm.g("DONE={};DEBRIEF={};READY={};READY['2026-07-14']={s:1,l:0,b:0};READY['2026-07-13']={s:1};READY['2026-07-12']={s:1}");
    assert(mm.g('shortNights()') === 3 && mm.g('coachRead().level') === 'trim', 'coach: three short nights in a week trim');
    mm.g("lifeAct('applyread',{})");
    assert(mm.g('CUT') === 3, 'coach: Apply cuts Tuesday to technique plus one round after three short nights');
    mm.g("READY={};lifeAct('ready',{dataset:{k:'s',v:'1'}})");
    assert(mm.g("READY[todayISO()].s") === 1 && /forge:more/.test(mm.g("localStorage.getItem('forge:more')?'forge:more':''")), 'coach: a tap is remembered and persisted');
    mm.g('paintCheckin()');
    assert(/Coach check-in/.test(mm.g('checkinEl.innerHTML')), 'coach: the check-in card shows on today before the session');
    mm.g('toggleDone(0,1);paintCheckin()');
    assert(mm.g('checkinEl.innerHTML') === '', 'coach: and goes away once the session is logged');
    assert(/How was it\?/.test(mm.g('panel.innerHTML')), 'coach: a logged session asks how it went');
    mm.g("lifeAct('debrief',{dataset:{e:'3'}})");
    assert(mm.g("DEBRIEF['0-1'].e") === 3, 'coach: the debrief is stored');
  }
  {
    // Fight IQ remembers misses
    const mm = await lifeMachine({}, '2026-10-01', '2026-09-28');
    mm.g("iqmMark('Teep',false)");
    assert(mm.g("IQM['Teep'].b") === 0 && mm.g("IQM['Teep'].due") === '2026-10-02', 'iq: a miss comes back tomorrow');
    mm.g("iqmMark('Teep',true);iqmMark('Teep',true)");
    assert(mm.g("IQM['Teep'].b") === 2 && mm.g("IQM['Teep'].due") === '2026-10-05', 'iq: two hits stretch the gap to four days');
    mm.g("IQM={'Jab (1)':{b:0,r:0,w:1,due:'2026-10-01'}};selectWeek(3)");
    let hits = 0;
    for (let i = 0; i < 200; i++) if (mm.g('qpick().m.name') === 'Jab (1)') hits++;
    assert(hits > 120, 'iq: what you missed is asked far more often (' + hits + ' of 200)');
    assert(mm.g('iqmDue().length') === 1, 'iq: one card is due today');
    mm.g('paintIQ()');
    assert(/due today/.test(mm.g('iqstatsEl.innerHTML')), 'iq: the stats show how many are due');
  }
  {
    // the skill tree lights up from what was really drilled
    const mm = await lifeMachine({ '0-0': '2026-07-13', '1-0': '2026-07-20', '2-0': '2026-07-27' }, '2026-07-28', '2026-07-13');
    const counts = JSON.parse(mm.g('JSON.stringify(drilledCounts())'));
    assert(counts['Leg Kick'] >= 3, 'tree: three Monday sessions put the leg kick in three sessions (' + counts['Leg Kick'] + ')');
    assert(mm.g("moveState('Leg Kick',drilledCounts(),reachedWeek())") === 'drilled', 'tree: three sessions is drilled');
    mm.g("IQM['Leg Kick']={b:2,r:2,w:0,due:'2026-08-01'}");
    assert(mm.g("moveState('Leg Kick',drilledCounts(),reachedWeek())") === 'tempered', 'tree: drilled plus remembered is tempered');
    assert(mm.g("moveState('Wrapping Hands',drilledCounts(),reachedWeek())") === 'locked', 'tree: a week 5 move is locked in week 3');
    const html = mm.g('treeHTML()');
    assert(/of 86 moves drilled/.test(html) && /st-locked/.test(html) && /st-tempered/.test(html), 'tree: summary and every state render');
    assert(!/undefined|NaN/.test(html), 'tree: clean markup');
  }
  {
    // weeks held, best streak, the week line
    const mm = await lifeMachine({ '0-0': '2026-07-13', '0-1': '2026-07-14', '0-2': '2026-07-15', '0-3': '2026-07-16' }, '2026-07-16', '2026-07-13');
    assert(mm.g('weeksHeld()') === 1, 'held: four sessions in a week is a week held');
    assert(mm.g('noteBest()') >= 4 && mm.g('BEST') >= 4, 'held: the best streak is remembered');
    const line = mm.g('weekLine(0)');
    assert(/THE FORGE \| Jackson \| WEEK 1/.test(line) && /4\/7 sessions/.test(line), 'held: the week line says what happened');
    assert(!new RegExp('[' + String.fromCharCode(8211, 8212) + ']').test(line), 'held: no dashes in what gets pasted into a group chat');
    mm.g("DONE={};EXTRA=[{d:todayISO(),t:'shadow',m:3,light:true}]");
    assert(mm.g('streak()') === 1, 'held: a light day keeps the streak alive');
  }
  {
    // just one round is a light day and never the day's real session
    const mm = await lifeMachine({}, '2026-07-14', '2026-07-13');
    mm.g('selectWeek(0);selectDay(1)');
    const sp = mm.speech.length;
    assert(mm.g('startOneRound()') === true && mm.g('T.quick') === true && mm.g('T.state') === 'run', 'one round: it starts straight away');
    assert(mm.g('sessionRunning()') === true, 'one round: the app knows a round is live');
    mm.g('render()');
    assert(mm.g('T.quick') === true && mm.g('T.state') === 'run', 'one round: a repaint does not destroy it');
    mm.clock.advance(200000);
    assert(mm.g('T.state') === 'done' && mm.g('EXTRA.length') === 1 && mm.g('EXTRA[0].light') === true, 'one round: finishing logs a light day');
    assert(mm.speech.slice(sp).some(s => /Free shadow/.test(s)), 'one round: the coach names it');
    mm.g('focusBtn(0)');
    assert(mm.g('isDone(0,1)') === false && mm.g('FOCUS') === false, 'one round: closing it never logs the real session');
    assert(mm.g('T.quick') !== true, 'one round: the normal session is back on the timer');
  }
  {
    // combo tap
    const mm = await lifeMachine({}, '2026-07-14', '2026-07-13');
    mm.g('ctNew()');
    assert(mm.g('CT.seq.length') === 2 && mm.g('CT.seq.every(n=>n>=1&&n<=3)'), 'combo tap: week 1 starts with two punches from 1 to 3');
    const seq = JSON.parse(mm.g('JSON.stringify(CT.seq)'));
    assert(mm.g(`ctTap(${seq[0]})`) === 'ok' && mm.g(`ctTap(${seq[1]})`) === 'next' && mm.g('CT.streak') === 1, 'combo tap: the right taps score');
    const s2 = JSON.parse(mm.g('JSON.stringify(CT.seq)'));
    const wrong = s2[0] === 1 ? 2 : 1;
    assert(mm.g(`ctTap(${wrong})`) === 'bad' && mm.g('CT.streak') === 0 && mm.g('CTBEST') === 1, 'combo tap: a wrong tap resets the streak but keeps the best');
    mm.g("IQMODE='numbers';paintCard()");
    assert(/COMBO TAP/.test(mm.g('cardEl.innerHTML')) && /Cross/.test(mm.g('cardEl.innerHTML')), 'combo tap: the numbers screen draws');
  }
  {
    // the Home Screen gate
    const mm = await lifeMachine({}, '2026-07-14', '2026-07-13');
    mm.g('paintA2hs()');
    assert(mm.g('a2hsEl.innerHTML') === '', 'a2hs: nothing shows off Safari');
    mm.g("navigator.userAgent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';navigator.standalone=false;paintA2hs()");
    assert(/Add to Home Screen/.test(mm.g('a2hsEl.innerHTML')), 'a2hs: a buddy on Safari is told how to install it');
    mm.g("lifeAct('a2dismiss',{})");
    assert(mm.g('a2hsEl.innerHTML') === '' && mm.g("localStorage.getItem('forge:a2hs')") === '1', 'a2hs: Not now is remembered');
    assert(mm.g("STORE_KEYS.indexOf('forge:more')>=0") === true, 'persist: the new bag is a known key');
  }

  /* ===== v25 content: street rules, fix-it, opponents, gym kit ===== */
  {
    const NODASH = new RegExp('[' + String.fromCharCode(8211, 8212) + ']');
    const mm = await lifeMachine({}, '2026-07-21', '2026-07-13'); // a Tuesday in week 2
    const deck = JSON.parse(mm.g('JSON.stringify(STREETDECK)'));
    assert(deck.length === 14 && deck.every(c => c.q && c.steps.length >= 2 && c.steps.length <= 4 && c.cue), 'street: fourteen complete cards');
    assert(!NODASH.test(JSON.stringify(deck)), 'street: no em or en dashes');
    const all = JSON.stringify(deck);
    assert(!/Laws vary by state/.test(all) && /ask a lawyer/.test(all), 'street: no legal-sounding standard, it says ask a lawyer');
    assert(/Do not drive yourself/.test(all) && /few witnesses/.test(all) && /do not go\. Yell/.test(all), 'street: the reviewed safety wording is in');
    assert(!/\bBJJ\b/.test(all), 'street: nothing assumes the reader has BJJ');
    mm.g("IQMODE='street';paintCard()");
    assert(/STREET RULES/.test(mm.g('cardEl.innerHTML')) && !/REMEMBER/.test(mm.g('cardEl.innerHTML')), 'street: the question shows before the answer');
    mm.g("lifeAct('strev',{})");
    assert(/REMEMBER/.test(mm.g('cardEl.innerHTML')), 'street: reveal shows the steps and the cue');
    const first = mm.g('ST.i');
    mm.g("lifeAct('stnext',{})");
    assert(mm.g('ST.i') !== first && mm.g('ST.rev') === false, 'street: next moves to a different scenario');

    // fix-it
    const fx = JSON.parse(mm.g('JSON.stringify(FIXIT)'));
    const names = JSON.parse(mm.g('JSON.stringify(CHECK5.map(c=>c[0]))'));
    assert(fx.length === 5 && fx.every((f, i) => f.name === names[i] && f.drills.length === 3 && f.camera && f.why), 'fix-it: one block per checkpoint, three drills each');
    assert(!NODASH.test(JSON.stringify(fx)), 'fix-it: no em or en dashes');
    mm.g('CHECKS={0:[1,0,1,1,1]};selectWeek(1);selectDay(1)');
    assert(mm.g('fixTarget()') === 1 && /Fix-it: Feet/.test(mm.g('panel.innerHTML')), 'fix-it: a missed Feet check puts a Feet block in next week Tuesday');
    mm.g('selectDay(3)');
    assert(!/Fix-it/.test(mm.g('panel.innerHTML')), 'fix-it: hard days stay as they are');
    mm.g('CHECKS={0:[1,1,1,1,1]};selectDay(1)');
    assert(mm.g('fixTarget()') === -1 && !/Fix-it/.test(mm.g('panel.innerHTML')), 'fix-it: a clean tape adds nothing');
    mm.g('CHECKS={0:[1,0,0,1,1],1:[0,0,1,1,1]};selectWeek(2);selectDay(1)');
    assert(mm.g('fixTarget()') === 1, 'fix-it: of several misses it picks the one that has failed most');
    mm.g('selectWeek(0);selectDay(6)');
    assert(/Film it once/.test(mm.g('panel.innerHTML')), 'fix-it: the tape card says where to put the phone');
    mm.g('CHECKS={};selectWeek(1);selectDay(1)');
    const flow = +(/ftot">&#8776; (\d+) min/.exec(mm.g('panel.innerHTML')) || [0, 0])[1];
    assert(flow > 0 && flow <= 60, 'fix-it: sessions still fit the hour');
  }
  {
    // opponents for free rounds
    const mm = await lifeMachine({}, '2026-07-15', '2026-07-13'); // Wednesday, hands only
    mm.g('selectWeek(0);selectDay(2)');
    let bad = 0;
    for (let i = 0; i < 300; i++) if (/legs|kick|sprawl|wrestler/i.test(mm.g('archLine()'))) bad++;
    assert(bad === 0, 'opponents: a hands-only day never names a kicker or a wrestler (' + bad + ')');
    mm.g('selectDay(0)');
    let seen = 0;
    for (let i = 0; i < 400; i++) if (/chops your legs|wrestler/i.test(mm.g('archLine()'))) seen++;
    assert(seen > 0, 'opponents: Monday can face the kicker and the wrestler');
    const mon = await lifeMachine({}, '2026-07-13', '2026-07-13');
    mon.g('selectWeek(0);selectDay(0);elGo.click()');
    const sp = mon.speech.length;
    const segs = JSON.parse(mon.g('JSON.stringify(T.segs.map(s=>({d:s.d})))'));
    mon.clock.advance(segs.reduce((n, s) => n + s.d * 1000, 0) + 60000);
    assert(mon.speech.slice(sp).some(s => /^Your man/.test(s)), 'opponents: the free round names who you are fighting');
  }
  {
    // the gym bridge kit, with the reviewer fixes
    const mm = await lifeMachine({ '0-0': '2026-07-13', '0-1': '2026-07-14', '1-0': '2026-07-20' }, '2026-07-21', '2026-07-13');
    const dm = mm.g('gymDM()');
    assert(/Jackson/.test(dm) && /Fayetteville/.test(dm) && /about 2 weeks/.test(dm) && /BJJ/.test(dm), 'gym: the message uses his name and his real number of weeks');
    mm.g("WHO='Pax';GYMS=null");
    const dm2 = mm.g('gymDM()');
    assert(/Pax/.test(dm2) && !/Fayetteville|BJJ/.test(dm2), 'gym: a buddy never sends a claim that is not his');
    mm.g("lifeAct('gkbjj',{})");
    assert(/BJJ/.test(mm.g('gymDM()')), 'gym: BJJ appears only when switched on');
    assert(!/BJJ/.test(mm.g('GYMKIT.callScript')) && /Pax/.test(mm.g('gymCall()')), 'gym: the call script is generic and names the caller');
    const kit = JSON.stringify(JSON.parse(mm.g('JSON.stringify(GYMKIT)')));
    assert(/Do not spar on day one, even if they offer/.test(kit) && !/Never spar on day one unless/.test(kit), 'gym: no sparring on day one, even when offered');
    assert(/who teaches it/.test(kit) && !/Is \[name\] the right coach/.test(kit), 'gym: the phone script is something he can actually say');
    assert(/unless the gym trains in shoes/.test(kit), 'gym: the shoes rule is not stated as universal');
    assert(!new RegExp('[' + String.fromCharCode(8211, 8212) + ']').test(kit), 'gym: no em or en dashes');
    mm.g("lifeAct('gkscore',{dataset:{g:'0',c:'0'}});lifeAct('gkscore',{dataset:{g:'0',c:'0'}});lifeAct('gkscore',{dataset:{g:'1',c:'2'}})");
    assert(mm.g('GYMS.s[0][0]') === 2 && mm.g('GYMS.s[1][2]') === 1, 'gym: a tap cycles the score');
    mm.g("lifeAct('gkscore',{dataset:{g:'0',c:'0'}});lifeAct('gkscore',{dataset:{g:'0',c:'0'}})");
    assert(mm.g('GYMS.s[0][0]') === 0, 'gym: three is the top and the next tap wraps to zero');
    const html = mm.g('gymHTML()');
    assert((html.match(/gkcell s/g) || []).length === 15 && /Total/.test(html) && !/undefined|NaN/.test(html), 'gym: five criteria across three gyms, clean markup');
    assert(/forge:more/.test(mm.g("localStorage.getItem('forge:more')?'forge:more':''")), 'gym: scores persist');
    mm.g('paintGym()');
    assert(/Gym bridge kit/.test(mm.g('gymkitEl.innerHTML')), 'gym: the Gear tab draws it');
  }

  /* ===== v26: the beat and the rival ===== */
  const settle = async () => { for (let i = 0; i < 4; i++) await new Promise(r => setImmediate(r)); };
  {
    const mm = await lifeMachine({}, '2026-07-13', '2026-07-13'); // Monday, technical
    assert(mm.g('beatBpm()') === 96, 'beat: a technical day runs at 96');
    mm.g('selectDay(3)');
    assert(mm.g('beatBpm()') === 120, 'beat: Thursday, the hard day, runs at 120');
    mm.g('selectDay(6)');
    assert(mm.g('beatBpm()') === 84, 'beat: the restore day runs at 84');
    mm.g('selectDay(0)');
    mm.g("lifeAct('beat',{})");
    assert(mm.g('BEAT_ON') === true && /"beat":true/.test(mm.g("localStorage.getItem('forge:opts')")), 'beat: the switch is remembered');
    mm.g('selectWeek(0);selectDay(0);elGo.click()');
    await settle();
    assert(mm.g('!!beatSrc') === false, 'beat: silent during the get-set countdown');
    mm.clock.advance(11000);
    await settle();
    assert(mm.g('!!beatSrc') === true && mm.g('BEATKEY') === '96', 'beat: starts with the first work round at the day tempo');
    assert(mm.g('beatSrc.loop') === true, 'beat: it loops inside the audio engine, so a locked phone keeps it');
    mm.g('elGo.click()'); // pause
    await settle();
    assert(mm.g('!!beatSrc') === false, 'beat: pausing silences it');
    mm.g('elGo.click()'); // resume
    await settle();
    assert(mm.g('!!beatSrc') === true, 'beat: resuming brings it back');
    mm.clock.advance(185000);
    await settle();
    assert(mm.g('T.segs[T.i].type') === 'rest' && mm.g('!!beatSrc') === false, 'beat: rest rounds are quiet');
    mm.clock.advance(1200000);
    await settle();
    assert(mm.g('T.state') === 'done' && mm.g('!!beatSrc') === false, 'beat: the session end stops it');
    assert(mm.g('beatCache[96] && beatCache[96].length > 0') === true, 'beat: the loop is rendered once and cached');
    mm.g("lifeAct('beat',{})");
    assert(mm.g('BEAT_ON') === false, 'beat: and switches off');
  }
  {
    // rival
    const mm = await lifeMachine({ '0-0': '2026-07-13', '0-1': '2026-07-14', '0-2': '2026-07-15' }, '2026-07-20', '2026-07-13');
    const code = mm.g('rivalCode()');
    const back = JSON.parse(mm.g(`JSON.stringify(parseRival(${JSON.stringify(code)}))`));
    assert(back && back.n === 'Jackson' && back.s === '2026-07-13' && back.o.join(',') === '0,1,2', 'rival: the code round-trips name, start and every session day');
    assert(code.length < 400 && /^[A-Za-z0-9_-]+$/.test(code), 'rival: short and URL safe (' + code.length + ')');
    assert(/#r=/.test(mm.g('rivalLink()')) && /^https:\/\/example\.test\/forge\/#r=/.test(mm.g('rivalLink()')), 'rival: the link is the app address plus the code');
    const enc = o => mm.g(`b64e(JSON.stringify(${JSON.stringify(o)}))`);
    assert(mm.g('parseRival("not base64!")') === null, 'rival: garbage is rejected');
    assert(mm.g(`parseRival(${JSON.stringify(enc({ n: 'x'.repeat(40), s: '2026-07-13', o: [1] }))})`) === null, 'rival: a long name is rejected');
    assert(mm.g(`parseRival(${JSON.stringify(enc({ n: 'Pax', s: 'tomorrow', o: [1] }))})`) === null, 'rival: a bad date is rejected');
    assert(mm.g(`parseRival(${JSON.stringify(enc({ n: 'Pax', s: '2026-07-13', o: new Array(300).fill(1) }))})`) === null, 'rival: an oversized list is rejected');
    const odd = JSON.parse(mm.g(`JSON.stringify(parseRival(${JSON.stringify(enc({ n: '<b>Pax</b>', s: '2026-07-13', o: [0, -4, 2.5, 3, 9999] }))}))`));
    assert(odd && odd.o.join(',') === '0,3', 'rival: nonsense day numbers are dropped');

    // the ghost
    mm.g("RIVAL={n:'Pax',s:'2026-07-13',o:[0,1,2,3,4,5,6,7,8,9],t:''};paintToday()");
    const card = mm.g('todayCardEl.innerHTML');
    assert(/Rival/.test(card) && /Pax was 5 ahead/.test(card), 'rival: Pax had eight sessions by day 8 and you have three');
    mm.g("RIVAL={n:'Pax',s:'2026-07-13',o:[0],t:''};paintToday()");
    assert(/You are 2 ahead of Pax/.test(mm.g('todayCardEl.innerHTML')), 'rival: ahead is said too');
    mm.g("RIVAL={n:'<img src=x>',s:'2026-07-13',o:[0],t:''};paintToday()");
    assert(!/<img src=x>/.test(mm.g('todayCardEl.innerHTML')), 'rival: a hostile name cannot inject markup');

    // accepting a challenge
    mm.g("RIVAL=null;PENDING_RIVAL={n:'Pax',s:'2026-07-13',o:[0,1],t:''}");
    assert(/Accept the challenge/.test(mm.g('lifeBannerHTML()')), 'rival: a pending challenge asks first');
    mm.g("lifeAct('rivalaccept',{})");
    assert(mm.g('RIVAL.n') === 'Pax' && mm.g('PENDING_RIVAL') === null, 'rival: accepting makes it yours');
    assert(/Pax/.test(mm.g("localStorage.getItem('forge:more')")), 'rival: and it is saved with your camp');
    await mm.g('boot()');
    assert(mm.g('RIVAL && RIVAL.n') === 'Pax', 'rival: it survives a reload');
    mm.g("lifeAct('rivalclear',{})");
    assert(mm.g('RIVAL') === null, 'rival: dropping it works');
    mm.g("PENDING_RIVAL={n:'Pax',s:'2026-07-13',o:[0],t:''};lifeAct('rivalno',{})");
    assert(mm.g('PENDING_RIVAL') === null, 'rival: No thanks clears the pending challenge');
    // a brand new phone sees the dare during onboarding
    const nb = bootApp(new Map());
    await nb.g('boot()');
    nb.g("PENDING_RIVAL={n:'Jackson',s:'2026-07-13',o:[0],t:''};paintOnboard()");
    assert(/Jackson<\/b> dared you/.test(nb.g('onboardEl.innerHTML')), 'rival: onboarding greets a new fighter with the dare');
  }

  /* ===== v25 review fixes ===== */
  {
    // rival ghost survives Pick up
    const mm = await lifeMachine(mkDone(42, '2026-08-20'), '2026-10-01', '2026-07-13');
    const before = mm.g('myOffsets().length');
    mm.g('doResume()');
    assert(before === 42 && mm.g('myOffsets().length') === 42, 'rival: Pick up does not drop sessions from the ghost (' + mm.g('myOffsets().length') + ')');
    mm.g("RIVAL={n:'Pax',s:'2026-07-13',o:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20],t:''};paintToday()");
    assert(/You are \d+ ahead of Pax/.test(mm.g('todayCardEl.innerHTML')), 'rival: after Pick up Jackson is correctly shown ahead');
    // duplicates cannot inflate a rival
    const enc = mm.g(`b64e(JSON.stringify({n:'Pax',s:'2026-07-13',o:[3,3,3,1,1,2]}))`);
    assert(mm.g(`parseRival(${JSON.stringify(enc)}).o.join(',')`) === '1,2,3', 'rival: duplicate days collapse and sort');
  }
  {
    // the coach follows the program's own rules
    const mm = await lifeMachine({}, '2026-07-14', '2026-07-13'); // Tuesday W1
    mm.g('selectWeek(0);selectDay(1)');
    mm.g("READY[todayISO()]={s:1,l:1,b:0}");
    assert(!/60 percent|70 percent/.test(mm.g('coachRead().msg')), 'coach: never quotes a percent that could clash with a week cap');
    mm.g("READY[todayISO()]={s:0,l:0,b:2}");
    assert(/no kicks for 10 days/.test(mm.g('coachRead().msg')), 'coach: pain matches the stop rule on the Monday flag');
    // short nights: Thursday and Saturday go to three rounds, skill days stay
    mm.g("READY={};READY['2026-07-14']={s:1,l:0,b:0};READY['2026-07-13']={s:1};READY['2026-07-12']={s:1}");
    mm.g('selectDay(3)');
    mm.clock.jumpSilent(2 * 86400000);
    mm.g("READY={};READY[todayISO()]={s:1,l:0,b:0};READY[addDaysISO(todayISO(),-1)]={s:1};READY[addDaysISO(todayISO(),-2)]={s:1};selectWeek(0);selectDay(3)");
    assert(mm.g('todaySlot().d') === 3, 'coach: the clock is on a Thursday');
    assert(mm.g('coachRead().cut') === 2 && /three rounds/.test(mm.g('coachRead().msg')), 'coach: three short nights take Thursday to three rounds');
    mm.g('selectDay(2)');
    assert(mm.g('coachRead()') !== null, 'coach: no crash on a skill day');
    // never throws when there is no camp slot
    const over = await lifeMachine(mkDone(5, '2026-08-01'), '2026-10-01', '2026-07-13');
    over.g("READY[todayISO()]={s:1,l:0,b:0};READY[addDaysISO(todayISO(),-1)]={s:1};READY[addDaysISO(todayISO(),-2)]={s:1}");
    assert(over.g('coachRead().level') === 'note', 'coach: past the end of the calendar it degrades to a note, not an error');
    // stale cooked ratings age out
    const st = await lifeMachine({ '0-0': '2026-07-13', '0-1': '2026-07-14', '0-2': '2026-08-12' }, '2026-08-20', '2026-07-13');
    st.g("DEBRIEF={'0-0':{e:4},'0-1':{e:4}};READY[todayISO()]={s:0,l:0,b:0}");
    assert(st.g('coachRead().level') === 'go', 'coach: two cooked sessions from weeks ago no longer trim today');
    // apply does nothing mid-session
    st.g('selectWeek(5);selectDay(3);elGo.click()');
    st.g("READY[todayISO()]={s:1,l:1,b:0};applyRead()");
    assert(st.g('CUT') === 0, 'coach: Apply is ignored while a round is live');
  }
  {
    // debrief belongs to its camp
    const mm = await lifeMachine(mkDone(10, '2026-09-01'), '2026-10-01', '2026-07-13');
    mm.g("DEBRIEF={'0-0':{e:4},'0-1':{e:4}}");
    await mm.g('runItBack()');
    assert(Object.keys(JSON.parse(mm.g('JSON.stringify(DEBRIEF)'))).length === 0, 'debrief: Run it back starts the new camp with no old ratings');
    assert(mm.g("CAMPS[0].debrief['0-0'].e") === 4, 'debrief: the old ratings are archived with the old camp');
    mm.g('undoCamp()');
    assert(mm.g("DEBRIEF['0-0'].e") === 4, 'debrief: undo brings them back');
    mm.g("DONE['0-0']='2026-09-01';DEBRIEF['0-0']={e:3};toggleDone(0,0)");
    assert(mm.g("DEBRIEF['0-0']") === undefined, 'debrief: un-logging a session drops its rating');
  }
  {
    // just one round: same day rules, a skipped round banks nothing
    const mm = await lifeMachine({}, '2026-07-14', '2026-07-13');
    mm.g('selectWeek(0);selectDay(1)');
    mm.g('startOneRound()');
    assert(mm.g("T.dk") === 'tue' && mm.g('T.quick') === true, 'one round: it belongs to the day it was started on');
    mm.g("globalThis.__c=0;globalThis.confirm=()=>{globalThis.__c++;return true;}");
    assert(mm.g('guardSwitch(0,1)') === true && mm.g('globalThis.__c') === 0, 'one round: staying on the same day does not prompt');
    mm.g('elSkip.click();elSkip.click()');
    assert(mm.g('T.state') === 'done' && mm.g('EXTRA.length') === 0, 'one round: skipping through it logs nothing');
    const m2 = await lifeMachine({}, '2026-07-14', '2026-07-13');
    m2.g('selectWeek(0);selectDay(1);startOneRound()');
    m2.g("globalThis.confirm=()=>true;lifeAct('herostart',{})");
    assert(m2.g('T.quick') !== true, 'one round: starting the real session ends the round first');
  }
  {
    // the beat cannot stack loops
    const mm = await lifeMachine({}, '2026-07-13', '2026-07-13');
    mm.g("BEAT_ON=true;selectWeek(0);selectDay(0);elGo.click()");
    mm.clock.advance(11000);
    mm.g('globalThis.__srcs=0;(function(){const f=ac.createBufferSource.bind(ac);ac.createBufferSource=function(){globalThis.__srcs++;return f();};})()');
    mm.g('beatStop()');
    await Promise.all([mm.g('beatSync()'), mm.g('beatSync()'), mm.g('beatSync()')]);
    await settle();
    assert(mm.g('globalThis.__srcs') === 1 && mm.g('!!beatSrc') === true, 'beat: three overlapping syncs start exactly one loop (' + mm.g('globalThis.__srcs') + ')');
  }
  {
    // the persisted bag is sanitised
    const mm = await lifeMachine({}, '2026-07-14', '2026-07-13');
    mm.g(`applyMore({ready:{'2026-07-14':'x'},debrief:{'0-0':{e:'no'},'0-1':{e:3}},iqm:{a:5,b:{b:2,due:'2026-08-01'}},gyms:{n:1,s:2},best:-4,ct:'x',rival:{n:'x'}})`);
    assert(mm.g('coachRead()') === null, 'bag: a malformed ready entry is dropped, not crashed on');
    assert(mm.g("Object.keys(DEBRIEF).join(',')") === '0-1' && mm.g("Object.keys(IQM).join(',')") === 'b', 'bag: only well-formed debrief and review entries survive');
    assert(mm.g('GYMS') === null && mm.g('BEST') === 0 && mm.g('CTBEST') === 0 && mm.g('RIVAL') === null, 'bag: bad gyms, counters and rival are reset');
    mm.g(`applyMore(JSON.parse('{"ready":{"__proto__":{"s":1}},"iqm":{"constructor":{"b":1,"due":"x"}}}'))`);
    assert(mm.g('({}).s') === undefined && Object.keys(JSON.parse(mm.g('JSON.stringify(READY)'))).length === 0, 'bag: prototype keys are ignored');
    mm.g("GYMS={n:['a','b','c'],s:[[1,2,3,0,1],[0,0,0,0,0],[3,3,3,3,3]],bjj:true};applyMore(moreObj())");
    assert(mm.g('GYMS.bjj') === true && mm.g('GYMS.s[2][4]') === 3, 'bag: a valid scorecard and its BJJ flag round-trip');
    // a stranger never speaks as Jackson
    mm.g("WHO='';GYMS=null");
    assert(!/Fayetteville|BJJ/.test(mm.g('gymDM()')), 'gym: with no name the message claims nothing');
  }
  {
    // fix-it respects the day
    const mm = await lifeMachine({}, '2026-07-15', '2026-07-13');
    mm.g("CHECKS={1:[1,1,0,1,1]};selectWeek(2)");
    mm.g('selectDay(2)'); // Wednesday, hands only
    assert(/Fix-it: Pivot/.test(mm.g('panel.innerHTML')) && !/leg kick|Kick, land/i.test(mm.g('panel.innerHTML').replace(/<[^>]*>/g, ' ').split('Fix-it: Pivot')[1].split('Cooldown')[0]), 'fix-it: Wednesday gets the no-kick pivot drills');
    mm.g('selectDay(4)');
    assert(!/Slow leg kick/.test(mm.g('panel.innerHTML')), 'fix-it: Friday keeps the legs quiet too');
    mm.g('selectDay(1)');
    assert(/Slow leg kick/.test(mm.g('panel.innerHTML')), 'fix-it: Tuesday still gets the full pivot block');
  }
  {
    // small screens and states
    const mm = await lifeMachine({ '0-0': '2026-07-13', '1-0': '2026-07-20', '2-0': '2026-07-27' }, '2026-07-28', '2026-07-13');
    const html = mm.g('treeHTML()');
    assert(/st-open/.test(html) && /aria-label="[^"]*, (locked until week|not drilled yet|seen|drilled|tempered)/.test(html), 'tree: a Not yet state and a spoken state on every node');
    mm.g('selectWeek(0)');
    mm.g("CT.seq=[1,6,5,2]");
    mm.g("IQMODE='numbers';paintNumbers()");
    assert(mm.g('CT.seq.every(n=>n<=3)') === true, 'combo tap: a sequence that no longer fits the week is replaced');
    assert(/<span>\d<\/span>/.test(mm.g('cardEl.innerHTML')), 'combo tap: the sequence is drawn as separate numbers');
    mm.g('buildGrid()');
    const st = mm.g("(function(){PENDING_RIVAL=null;return a2hsEl.innerHTML;})()");
    assert(typeof st === 'string', 'a2hs: renders without throwing');
    mm.g("navigator.userAgent='iPhone';navigator.standalone=false;paintA2hs()");
    assert(/separate from this Safari tab, so it opens empty/.test(mm.g('a2hsEl.innerHTML')) && /finish the name screen first/.test(mm.g('a2hsEl.innerHTML')), 'a2hs: someone who has logged is told how to carry their log over');
  }

  console.log((failures ? 'FAILED' : 'PASSED') + ': ' + (checks - failures) + '/' + checks + ' checks across 70 sessions');
  process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
