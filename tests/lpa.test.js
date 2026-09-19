const test = require('node:test');
const assert = require('node:assert/strict');
const { LPAEngine } = require('../lib/lpa-engine.js');

test('LPAEngine - Initial baseline starts at 15 LPA', () => {
  const lpa = new LPAEngine(15.0);
  assert.equal(lpa.getCurrentLPA(), 15.0);
  assert.equal(lpa.getTier().tierName, 'Mid Product Tier');
});

test('LPAEngine - Correct answer rewards LPA and generates dopamine perturbation', () => {
  const lpa = new LPAEngine(15.0);
  const text = "I would use Raft consensus with persistent write-ahead logs to ensure strong consistency.";
  const analysis = lpa.analyzeContent(text);
  const evaluation = lpa.evaluateResponse(analysis);
  assert.ok(lpa.getCurrentLPA() > 15.0, 'LPA should increase');
  assert.ok(evaluation.rewardStimulus > 0.5, 'Reward stimulus should trigger');
  assert.equal(evaluation.giantFiberTriggered, false);
});

test('LPAEngine - Fatal answer severely penalizes LPA and triggers Giant Fiber alarm', () => {
  const lpa = new LPAEngine(25.0);
  const text = "I will store user passwords in a plaintext global variable.";
  const analysis = lpa.analyzeContent(text);
  const evaluation = lpa.evaluateResponse(analysis);
  assert.ok(lpa.getCurrentLPA() < 15.0, 'LPA should crash');
  assert.equal(evaluation.giantFiberTriggered, true);
  assert.ok(evaluation.stressStimulus >= 0.9, 'Stress stimulus should max out');
});

test('LPAEngine - Begging / pity appeal is heavily penalized and never rewarded', () => {
  const lpa = new LPAEngine(15.0);
  const text = "please give me a higher package I am poor I really need this money";
  const analysis = lpa.analyzeContent(text);
  const evaluation = lpa.evaluateResponse(analysis);
  
  assert.ok(evaluation.delta < 0, 'Delta must be negative');
  assert.ok(lpa.getCurrentLPA() < 10.0, 'LPA should drop sharply under begging');
  assert.match(evaluation.critique, /EMOTIONAL MANIPULATION/i);
});

test('LPAEngine - Non-tech admission plummets candidate to Unpaid Chai Intern', () => {
  const lpa = new LPAEngine(15.0);
  const text = "I am not a tech candidate, I am from arts background";
  const analysis = lpa.analyzeContent(text);
  const evaluation = lpa.evaluateResponse(analysis);
  
  assert.ok(lpa.getCurrentLPA() <= 3.0, `LPA must drop to <= 3.0, got ${lpa.getCurrentLPA()}`);
  assert.equal(lpa.getTier().tierName, 'Unpaid Chai Intern');
  assert.match(evaluation.critique, /NON-TECHNICAL ADMISSION/i);
  assert.equal(evaluation.giantFiberTriggered, true);
});

test('LPAEngine - Long non-technical rambling is penalized, not rewarded', () => {
  const lpa = new LPAEngine(15.0);
  const text = "hello hello I think this is very nice today the weather is good and I would really like to do some great work together and have a meeting";
  const analysis = lpa.analyzeContent(text);
  const evaluation = lpa.evaluateResponse(analysis);
  
  assert.ok(evaluation.delta < 0, 'Long non-technical text must be penalized, not rewarded');
  assert.match(evaluation.critique, /VACUOUS RAMBLING/i);
});

test('LPAEngine - Real-time interim keyword analysis deflects membrane potential live', () => {
  const lpa = new LPAEngine(15.0);
  // Anti-pattern
  const live1 = lpa.analyzeInterim("I will use try catch block for the entire db");
  assert.ok(live1.interimStress > 0.5, 'Should detect anti-pattern keyword in interim');

  // Tech reward
  const live2 = lpa.analyzeInterim("We implement a distributed token bucket rate limiter");
  assert.ok(live2.interimReward > 0.5, 'Should detect high-tier engineering concept in interim');

  // Begging stress
  const live3 = lpa.analyzeInterim("please give me a higher package I am poor");
  assert.ok(live3.interimStress > 0.5, 'Should detect begging in interim');
  assert.equal(live3.interimReward, 0.0, 'Begging must have 0 reward in interim');
});
