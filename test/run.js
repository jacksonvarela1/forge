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

  // ---- round-aware caller spoke each vocabulary somewhere across the camp ----
  const allSpeech = m.speech.join('\n');
  assert(/Make him miss\. Make him pay\.|He is cutting you off|Where is your jab|Do not admire the first/.test(allSpeech),
    'free-round corner prompts were spoken');
  assert(/Slip right|Roll under|Check it|Parry and step in|He shoots/.test(allSpeech),
    'defense-round attack calls were spoken');

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
  assert(m2.g('wIdx') === 7, 'reload: week selection restored');
  assert(m2.errors.length === 0, 'no errors on reload');

  console.log((failures ? 'FAILED' : 'PASSED') + ': ' + (checks - failures) + '/' + checks + ' checks across 70 sessions');
  process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
