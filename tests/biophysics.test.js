const test = require('node:test');
const assert = require('node:assert/strict');
const { BiophysicsEngine } = require('../lib/biophysics-engine.js');

test('BiophysicsEngine - Resting membrane potential stays near -65mV without firing', () => {
  const engine = new BiophysicsEngine();
  for (let i = 0; i < 200; i++) {
    engine.step(0.5, 0, 0, 0); // dt=0.5ms
  }
  const state = engine.getState();
  // For Izhikevich with b=0.2, the stable fixed point is exactly at -70.0mV
  assert.ok(state.membraneVoltage <= -60 && state.membraneVoltage >= -75, `Expected Vm near -70mV, got ${state.membraneVoltage}`);
  assert.equal(state.giantFiberSpike, false);
});

test('BiophysicsEngine - Action potential reaches +30mV peak before resetting (Claude/Qwen fix)', () => {
  const engine = new BiophysicsEngine();
  let peakObserved = false;
  let spikeTriggered = false;

  // Inject a strong depolarization current
  for (let i = 0; i < 100; i++) {
    const res = engine.step(0.5, 55.0, 1.0, 0);
    if (res.membraneVoltage >= 25.0) {
      peakObserved = true;
    }
    if (res.giantFiberSpike) {
      spikeTriggered = true;
    }
  }

  assert.ok(peakObserved, 'Action potential must peak near +30mV before resetting');
  assert.ok(spikeTriggered, 'Giant Fiber action potential must fire under strong aversive current');
});

test('BiophysicsEngine - Tsodyks-Markram Short-Term Facilitation (STF) activates on repetitive spikes', () => {
  const engine = new BiophysicsEngine();
  const initialU = engine.u_rel;

  // Force multiple action potentials
  for (let i = 0; i < 60; i++) {
    engine.step(0.5, 60.0, 0, 1.0);
  }

  assert.ok(engine.u_rel > initialU, `u_rel should facilitate above baseline ${initialU}, got ${engine.u_rel}`);
  // Check conservation of mass: x + y + z approx 1.0
  const totalPool = engine.x + engine.y + engine.z;
  assert.ok(Math.abs(totalPool - 1.0) < 0.01, `Vesicle pool mass must be conserved (x+y+z=1), got ${totalPool}`);
});

test('BiophysicsEngine - NaN guard prevents numerical runaway on huge inputs', () => {
  const engine = new BiophysicsEngine();
  // Inject absurdly high current
  for (let i = 0; i < 50; i++) {
    engine.step(0.5, 9999.0, 1.0, 0);
  }
  const state = engine.getState();
  assert.ok(!isNaN(state.membraneVoltage), 'Voltage must not be NaN');
  assert.ok(state.membraneVoltage <= 35.0, 'Voltage must be clamped');
});
