/* Browser environment mocks for the headless harness.
   Builds a vm sandbox with a virtual clock so 70 sessions run in milliseconds. */
'use strict';

const CSSVARS = {
  '--bg': '#0F1319', '--surface': '#171C24', '--surface-2': '#1F262F', '--line': '#2A323D',
  '--bone': '#ECE6DA', '--muted': '#8A94A3', '--ember': '#EA8C3A', '--steel': '#6FA8C7',
  '--restore': '#7E9B8A', '--violet': '#9B8AC4', '--p1': '#6FA8C7', '--p2': '#8B9DC9',
  '--p3': '#9B8AC4', '--p4': '#EA8C3A', '--p5': '#D9A441', '--barh': '78px'
};

function makeClassList() {
  const s = new Set();
  return {
    add: (...c) => c.forEach(x => s.add(x)),
    remove: (...c) => c.forEach(x => s.delete(x)),
    toggle: (c, f) => { const on = f === undefined ? !s.has(c) : !!f; if (on) s.add(c); else s.delete(c); return on; },
    contains: c => s.has(c)
  };
}

function makeEl(tag) {
  const listeners = {};
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    style: {},
    classList: makeClassList(),
    children: [],
    dataset: {},
    disabled: false,
    textContent: '',
    innerHTML: '',
    className: '',
    src: '',
    value: '',
    id: '',
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
    removeEventListener() {},
    click() { (listeners.click || []).slice().forEach(fn => fn({ target: el, closest: () => null })); },
    scrollIntoView() {},
    focus() {},
    play() { return Promise.resolve(); },
    pause() {},
    _listeners: listeners
  };
  return el;
}

/* knownIds: the set of ids that statically exist in index.html. Lookups outside it
   return null, as a browser would, so a removed or typo'd id fails the suite. */
function makeContext(localStore, knownIds) {
  const speech = [];        // every non-muted utterance text, in order
  const errors = [];        // uncaught errors from timer callbacks
  const wake = { requests: 0, releases: 0 };
  const docListeners = {};
  const winListeners = {};

  // ---- virtual clock ----
  const clock = { now: 1700000000000 };
  let timerId = 1;
  const timers = new Map(); // id -> {at, ms, fn, interval}
  function schedule(fn, ms, interval) {
    const id = timerId++;
    timers.set(id, { at: clock.now + Math.max(0, ms || 0), ms: ms || 0, fn, interval: !!interval });
    return id;
  }
  function nextDue(limit) {
    let best = null, bestId = 0;
    for (const [id, t] of timers) {
      if (t.at <= limit && (!best || t.at < best.at || (t.at === best.at && id < bestId))) { best = t; bestId = id; }
    }
    return best ? { id: bestId, t: best } : null;
  }
  function advance(ms) {
    const end = clock.now + ms;
    for (;;) {
      const due = nextDue(end);
      if (!due) break;
      clock.now = Math.max(clock.now, due.t.at);
      if (due.t.interval) {
        due.t.at += due.t.ms;
        if (due.t.at <= clock.now) due.t.at = clock.now + due.t.ms; // coalesce missed fires like a browser
      } else {
        timers.delete(due.id);
      }
      try { due.t.fn(); } catch (e) { errors.push(String(e && e.stack || e)); }
    }
    clock.now = end;
  }
  // Phone locked: JS frozen, wall clock moves, no timers fire.
  function jumpSilent(ms) { clock.now += ms; }

  class MockDate extends Date {
    constructor(...args) { if (args.length === 0) super(clock.now); else super(...args); }
    static now() { return clock.now; }
  }

  class SSU {
    constructor(t) { this.text = String(t); this.volume = 1; this.rate = 1; this.pitch = 1; this.voice = null; }
  }

  const sandbox = {
    console,
    Date: MockDate,
    setTimeout: (fn, ms) => schedule(fn, ms, false),
    setInterval: (fn, ms) => schedule(fn, ms, true),
    clearTimeout: id => { timers.delete(id); },
    clearInterval: id => { timers.delete(id); },
    document: {
      getElementById: id => (knownIds && !knownIds.has(id)) ? null : makeEl('div'),
      createElement: t => makeEl(t),
      querySelectorAll: () => [],
      addEventListener(t, fn) { (docListeners[t] = docListeners[t] || []).push(fn); },
      visibilityState: 'visible',
      documentElement: {}
    },
    addEventListener(t, fn) { (winListeners[t] = winListeners[t] || []).push(fn); },
    removeEventListener() {},
    scrollTo() {},
    getComputedStyle: () => ({ getPropertyValue: v => CSSVARS[v] || '' }),
    navigator: {
      wakeLock: {
        request: async () => { wake.requests++; return { addEventListener() {}, release() { wake.releases++; } }; }
      },
      mediaSession: { metadata: null, setActionHandler() {} }
      // no serviceWorker on purpose: registration is skipped under test
    },
    MediaMetadata: class { constructor(m) { Object.assign(this, m); } },
    speechSynthesis: {
      /* fires onend on a rough speech-duration clock so fragment sequences advance */
      speak: u => {
        if (u.volume > 0) speech.push(u.text);
        if (typeof u.onend === 'function') schedule(u.onend, Math.max(400, u.text.length * 40), false);
      },
      cancel() {},
      getVoices: () => [],
      onvoiceschanged: null
    },
    SpeechSynthesisUtterance: SSU,
    localStorage: {
      getItem: k => (localStore.has(k) ? localStore.get(k) : null),
      setItem: (k, v) => { localStore.set(k, String(v)); },
      removeItem: k => { localStore.delete(k); }
    },
    URL: { createObjectURL: () => 'blob:mock' },
    Blob: class { constructor() {} },
    AudioContext: class {
      constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
      createOscillator() { return { type: '', frequency: { value: 0 }, connect() {}, start() {}, stop() {} }; }
      createGain() { return { connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } }; }
      resume() {}
    }
  };
  sandbox.window = sandbox;

  return {
    sandbox, speech, errors, wake,
    clock: { advance, jumpSilent, now: () => clock.now },
    fireDoc(type) { (docListeners[type] || []).slice().forEach(fn => { try { fn(); } catch (e) { errors.push(String(e && e.stack || e)); } }); },
    fireWin(type) { (winListeners[type] || []).slice().forEach(fn => { try { fn({}); } catch (e) { errors.push(String(e && e.stack || e)); } }); }
  };
}

module.exports = { makeContext };
