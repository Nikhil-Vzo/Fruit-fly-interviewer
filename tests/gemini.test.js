const test = require('node:test');
const assert = require('node:assert/strict');
const { GeminiJudge } = require('../lib/gemini-judge');

test('GeminiJudge - Initializes with null key by default and detects missing key', () => {
  const judge = new GeminiJudge(null);
  assert.equal(judge.hasApiKey(), false);
  assert.equal(judge.apiKey, null);
});

test('GeminiJudge - Gracefully returns null when API key is missing (enabling fallback)', async () => {
  const judge = new GeminiJudge(null);
  const res = await judge.evaluateCandidateAnswer("Explain Raft", "I would use leader election", 15.0);
  assert.equal(res, null, 'Should return null when key is missing so server falls back to LPAEngine');
});

test('GeminiJudge - setApiKey updates active status cleanly', () => {
  const judge = new GeminiJudge();
  judge.setApiKey('AIzaSyDummyKeyForTestingPurposes123456');
  assert.equal(judge.hasApiKey(), true);
  
  judge.setApiKey('');
  assert.equal(judge.hasApiKey(), false);
});

test('GeminiJudge - sanitizeEvaluation clamps malformed or out-of-bounds LLM tensors', () => {
  const judge = new GeminiJudge();
  
  const rawBadLLMOutput = {
    technicalDepth: 99.9, // Out of bounds
    coherence: -5.0,      // Out of bounds
    deltaLPA: 500.0,      // Absurdly high delta
    dopamineReward: 2.5,  // Out of bounds
    octopamineStress: -1, // Out of bounds
    giantFiberTriggered: 1, // Non-boolean
    critique: "A".repeat(500), // Excessively long
    followUpTopic: "Distributed Systems Under Partitions",
    followUpQuestion: "How do you recover?"
  };

  const clean = judge.sanitizeEvaluation(rawBadLLMOutput);
  assert.ok(clean, 'Sanitizer must return sanitized object');
  assert.equal(clean.technicalDepth, 1.0, 'Technical depth clamped to 1.0');
  assert.equal(clean.coherence, 0.0, 'Coherence clamped to 0.0');
  assert.equal(clean.deltaLPA, 15.0, 'Delta LPA clamped to max 15.0');
  assert.equal(clean.dopamineReward, 1.0, 'Dopamine reward clamped to 1.0');
  assert.equal(clean.octopamineStress, 0.0, 'Octopamine stress clamped to 0.0');
  assert.equal(clean.giantFiberTriggered, true, 'Coerced to strict boolean');
  assert.ok(clean.critique.length <= 300, 'Critique truncated to 300 chars max');
  assert.equal(clean.isLLM, true);
});

test('GeminiJudge - Maintains multi-turn conversation memory and clears on resetHistory', () => {
  const judge = new GeminiJudge();
  assert.equal(judge.history.length, 0);

  // Manually push a simulated turn
  judge.history.push({
    question: "How do you handle split brain?",
    answer: "We use Raft with leader leases.",
    evaluation: { deltaLPA: 5.0, critique: "Good." }
  });
  assert.equal(judge.history.length, 1);

  judge.resetHistory();
  assert.equal(judge.history.length, 0, 'History should be empty after resetHistory()');
});
