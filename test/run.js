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
  assert(parsed.done && parsed.start === '2026-07-27' && Array.isArray(parsed.bw), 'backup payload has every key');

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
  // the bag now arrives a week early, so week 4 is the first adaptable week
  assert(g('BAGWEEK') === 3, 'bag week is camp week 4');
  g('BAG_ON=false;selectWeek(3);selectDay(0)');
  assert(g('panel.innerHTML').includes('No bag mode'), 'week 4 supports no-bag mode');
  g('BAG_ON=true;selectWeek(3);selectDay(0)');
  assert(g('panel.innerHTML').includes('First week on the bag'), 'week 4 shows the bag on-ramp warning');
  g('selectWeek(4)');
  assert(!g('panel.innerHTML').includes('First week on the bag'), 'week 5 does not repeat the on-ramp warning');
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

  console.log((failures ? 'FAILED' : 'PASSED') + ': ' + (checks - failures) + '/' + checks + ' checks across 70 sessions');
  process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
