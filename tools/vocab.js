/* Enumerates every fragment the voice coach can speak, normalized exactly the
   way say() normalizes at runtime, so generated clips key-match at playback.
   Run: node tools/vocab.js  -> writes tools/vocab.json */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeContext } = require('../test/mocks');

const root = path.join(__dirname, '..');
const m = makeContext(new Map());
vm.createContext(m.sandbox);
new vm.Script(fs.readFileSync(path.join(root, 'data.js'), 'utf8'), { filename: 'data.js' }).runInContext(m.sandbox);
new vm.Script(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), { filename: 'app.js' }).runInContext(m.sandbox);
const g = expr => vm.runInContext(expr, m.sandbox);

const keys = new Set();
const add = t => { const k = g(`vnorm(${JSON.stringify(String(t))})`); if (k) keys.add(k); };
const addEnd = t => add(g(`endp(lbl(${JSON.stringify(String(t))}))`));

// openers with the fighter's name, plus fixed phrases
for (const o of g('JSON.stringify(VP.open)') ? JSON.parse(g('JSON.stringify(VP.open)')) : []) add(o + ', ' + g('NAME') + '.');
for (const pool of ['begin', 'push', 'praise', 'half', 'ten', 'tenlast', 'rest', 'done', 'donetail']) {
  for (const t of JSON.parse(g(`JSON.stringify(VP.${pool})`))) add(t);
}
add('Get set.');
add('Back with you.');
add('Three. Two. One.');

// caller vocabularies
for (const name of ['CALLCUE', 'FREECALL', 'DEFPAIR', 'DEFATK']) {
  for (const t of JSON.parse(g(`JSON.stringify(${name})`))) add(t);
}
const CALLADD = JSON.parse(g('JSON.stringify(CALLADD)'));
for (const k of Object.keys(CALLADD)) for (const t of CALLADD[k]) add(t);

// corner cues spoken during rest
const CORNER = JSON.parse(g('JSON.stringify(CORNER)'));
for (const k of Object.keys(CORNER)) for (const t of CORNER[k]) addEnd(t);

// every timer label in every week, day, and both equipment modes
const DK = JSON.parse(g('JSON.stringify(DK)'));
for (const bag of [true, false]) {
  g(`BAG_ON=${bag}`);
  for (let wi = 0; wi < 10; wi++) {
    g(`wIdx=${wi}`);
    for (const k of DK) {
      const segs = JSON.parse(g(`(function(){const d=W[${wi}].d[${JSON.stringify(k)}];const c=buildSegs(${JSON.stringify(k)},d);return JSON.stringify(c?c.segs.map(s=>({label:s.label,next:s.next})):[]);})()`));
      for (const s of segs) { addEnd(s.label); if (s.next) addEnd(s.next); }
    }
  }
}
g('BAG_ON=true');

// resync countdown fragments
for (let n = 1; n <= 180; n++) add(n + ' seconds left.');

const list = Array.from(keys).sort();
fs.writeFileSync(path.join(__dirname, 'vocab.json'), JSON.stringify(list, null, 1));
console.log('fragments: ' + list.length);
