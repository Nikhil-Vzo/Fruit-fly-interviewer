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

test('BiophysicsEngine - Excitatory synaptic current is depolarizing (I_syn > 0) when V < E_rev', () => {
  const engine = new BiophysicsEngine();
  // Pre-load active synaptic transmitter y > 0
  engine.y = 0.5;
  engine.V = -65.0; // Resting potential
  engine.E_rev = 0.0; // Excitatory reversal potential
  
  const res = engine.step(0.5, 0, 0, 0);
  // With E_rev = 0.0, V = -65.0, inward current must be positive (depolarizing)
  assert.ok(res.synapticCurrent > 0, `Excitatory synaptic current must be positive/inward, got ${res.synapticCurrent}`);
  assert.ok(engine.V > -65.0, 'Inward synaptic current must depolarize the resting membrane potential');
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

test('BiophysicsEngine - Vesicle mass conservation holds across quantal spike release events', () => {
  const engine = new BiophysicsEngine();
  let spikeOccurred = false;
  
  // Deliver single high-intensity impulse to trigger exactly one spike
  for (let i = 0; i < 30; i++) {
    const res = engine.step(0.5, 70.0, 1.0, 0);
    const sum = engine.x + engine.y + engine.z;
    assert.ok(Math.abs(sum - 1.0) < 0.001, `Vesicle conservation violated at step ${i}: sum=${sum}`);
    if (res.giantFiberSpike) {
      spikeOccurred = true;
      // Immediately verify that active pool y received transmitter from available pool x
      assert.ok(engine.y > 0, 'Spike must release vesicles into cleft pool y');
    }
  }
  assert.ok(spikeOccurred, 'A spike must have occurred during stimulation');
});

test('BiophysicsEngine - Central Complex 16-column ring attractor smoothly integrates continuous dynamics', () => {
  const engine = new BiophysicsEngine();
  const initialRing = Array.from(engine.ringState);
  
  // Advance 10 steps (5 ms total) with heading perturbation
  engine.step(0.5, 0, 0, 1.0);
  const step1Ring = Array.from(engine.ringState);
  
  // Columns must change smoothly due to tau_ring=25ms leaky integration, not jump discontinuously
  let maxDiff = 0;
  for (let i = 0; i < engine.numColumns; i++) {
    maxDiff = Math.max(maxDiff, Math.abs(step1Ring[i] - initialRing[i]));
    assert.ok(step1Ring[i] >= 0.01 && step1Ring[i] <= 1.0, `Ring column ${i} must be bounded in [0.01, 1.0]`);
  }
  assert.ok(maxDiff > 0.0001, 'Ring attractor columns must dynamically update over time');
  assert.ok(maxDiff < 0.2, 'Ring dynamics must be continuous and bounded by time constant tau_ring');
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
