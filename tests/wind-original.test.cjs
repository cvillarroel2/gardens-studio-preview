const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function build(width, seed) {
  const elements = [];
  const math = Object.create(Math);
  math.random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
  const context = { window: {}, Math: math, document: { createElementNS() {
    return { attrs: {}, style: {}, setAttribute(k, v) { this.attrs[k] = v; },
      getTotalLength() { return 500; },
      animate(frames, timing) { this.frames = frames; this.timing = timing; return {}; } };
  } } };
  vm.runInNewContext(fs.readFileSync('wind-original.js', 'utf8'), context);
  context.window.GardensOriginalWind.build({ appendChild(p) { elements.push(p); } }, width, 796, false);
  return elements;
}

test('Original keeps short single curls and its original pulse clock at every width', () => {
  for (const width of [375, 440, 796, 1440, 2560]) for (let seed = 1; seed <= 20; seed++) {
    for (const p of build(width, seed)) {
      assert.equal(p.attrs.d.match(/C/g).length, 2, 'no repeated screen-spanning waves');
      const coords = p.attrs.d.match(/-?\d+(?:\.\d+)?/g).map(Number);
      const span = coords.at(-2) - coords[0];
      assert.ok(span >= 219 && span <= 681, `original local span: ${span}`);
      assert.ok(p.timing.duration >= 900 && p.timing.duration <= 1650);
      assert.ok(p.timing.delay >= 0 && p.timing.delay <= 360);
      assert.equal(p.frames[0].strokeDashoffset, 500);
      assert.equal(p.frames[2].offset, .70);
      assert.ok(p.frames[3].strokeDashoffset >= -390 && p.frames[3].strokeDashoffset <= -250);
    }
  }
});

test('Original places only a minority of curls near the middle to continue rightward', () => {
  for (const width of [440, 1440]) for (let seed = 1; seed <= 20; seed++) {
    const elements = build(width, seed);
    const middle = elements.filter(p => Number(p.attrs.d.split(' ')[1]) >= width * .42 - 1);
    assert.ok(middle.length >= 2 && middle.length < elements.length / 2);
    assert.ok(middle.some(p => Number(p.attrs.d.split(' ').at(-2)) > width * .7));
  }
});
