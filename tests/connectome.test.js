const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('Connectome - Reconstructed neurons JSON has valid schema and authentic IDs', () => {
  const filePath = path.resolve(__dirname, '../public/assets/connectome_neurons.json');
  assert.ok(fs.existsSync(filePath), 'connectome_neurons.json must exist');

  const neurons = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.equal(neurons.length, 7, 'Should contain 7 authentic reconstructed neurons');

  neurons.forEach((neuron) => {
    assert.ok(neuron.name, 'Neuron must have name');
    assert.ok(neuron.flywireId, 'Neuron must have FlyWire/Hemibrain ID');
    assert.ok(neuron.neuropil, 'Neuron must specify neuropil region');
    assert.ok(neuron.neurotransmitter, 'Neuron must declare neurotransmitter');
    assert.ok(neuron.soma, 'Neuron must have soma coordinates');
    assert.equal(typeof neuron.soma.x, 'number', 'Soma x must be number');
    assert.equal(typeof neuron.soma.y, 'number', 'Soma y must be number');
    assert.equal(typeof neuron.soma.z, 'number', 'Soma z must be number');
    assert.ok(neuron.linePoints && neuron.linePoints.length > 0, 'Line points must be non-empty');
  });

  // Verify Giant Fiber specifically
  const giantFiber = neurons.find(n => n.name.includes('hemibrain_1536947502') || n.flywireId === '1536947502');
  assert.ok(giantFiber, 'Giant Fiber DNp01 must be present');
  assert.equal(giantFiber.flywireId, '1536947502');
  assert.ok(giantFiber.neurotransmitter.includes('Electrical') || giantFiber.neurotransmitter.includes('Acetylcholine'));
});

test('Bio-Acoustics - SpeechAudioController contains courtship sine and agitated pulse synthesis', () => {
  const filePath = path.resolve(__dirname, '../public/js/speech-audio.js');
  const code = fs.readFileSync(filePath, 'utf8');

  assert.ok(code.includes('playCourtshipSineSong'), 'Must define playCourtshipSineSong');
  assert.ok(code.includes('playAgitatedPulseSong'), 'Must define playAgitatedPulseSong');
  assert.ok(code.includes('155'), 'Sine song must oscillate at authentic ~155 Hz');
  assert.ok(code.includes('0.035'), 'Pulse song must use authentic 35ms inter-pulse interval');
});
