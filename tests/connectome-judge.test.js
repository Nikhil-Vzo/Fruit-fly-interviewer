const test = require('node:test');
const assert = require('node:assert/strict');
const { ConnectomeJudge } = require('../lib/connectome-judge');

test('ConnectomeJudge - Expert answer activates dopamine reward circuit', async () => {
  const judge = new ConnectomeJudge();
  const result = judge.judge(
    'Design distributed locking',
    'Raft consensus with linearizable reads, WAL durability, fencing tokens, and bloom filters on lock namespace.',
    15.0
  );
  assert.ok(result.deltaLPA > 0, `Expected positive LPA delta, got ${result.deltaLPA}`);
  assert.ok(result.dopamineLevel > 0.3, `Expected dopamine > 0.3, got ${result.dopamineLevel}`);
  assert.ok(!result.giantFiberTriggered, 'Expert answer should NOT trigger Giant Fiber escape');
  assert.equal(result.isFlyBrain, true, 'Judge should report isFlyBrain=true');
  assert.equal(result.isLLM, false, 'Judge should report isLLM=false');
});

test('ConnectomeJudge - Fatal pattern triggers Giant Fiber escape reflex', async () => {
  const judge = new ConnectomeJudge();
  const result = judge.judge('Security', 'I store plaintext password in the database.', 15.0);
  assert.ok(result.giantFiberTriggered, 'Giant Fiber must fire on fatal pattern');
  assert.ok(result.deltaLPA <= -12.0, `Expected deltaLPA <= -12, got ${result.deltaLPA}`);
});

test('ConnectomeJudge - Non-technical crashes to Chai Intern (2.4 LPA)', async () => {
  const judge = new ConnectomeJudge();
  const result = judge.judge('Coding', 'I am from arts background, I do not know how to code.', 20.0);
  assert.ok(result.giantFiberTriggered, 'Non-tech must trigger Giant Fiber');
  assert.ok(result.newLPA <= 3.0, `Expected newLPA <= 3.0, got ${result.newLPA}`);
});

test('ConnectomeJudge - Begging penalized by octopamine, not dopamine', async () => {
  const judge = new ConnectomeJudge();
  const result = judge.judge('Salary', 'Please give me a higher package, I am poor and need money.', 15.0);
  assert.ok(result.deltaLPA < 0, `Begging should decrease LPA, got ${result.deltaLPA}`);
  assert.ok(result.octopamineLevel > result.dopamineLevel, 'Octopamine must exceed dopamine for begging');
});

test('ConnectomeJudge - Neural verdict is deterministic (same input = same output)', () => {
  const j1 = new ConnectomeJudge();
  const j2 = new ConnectomeJudge();
  const answer = 'I would use consistent hashing with virtual nodes and a token bucket rate limiter.';
  const r1 = j1.judge('Design system', answer, 15.0);
  const r2 = j2.judge('Design system', answer, 15.0);
  assert.equal(r1.deltaLPA, r2.deltaLPA, 'ConnectomeJudge must be deterministic');
  assert.equal(r1.dopamineLevel, r2.dopamineLevel, 'Dopamine levels must be deterministic');
});

test('ConnectomeJudge - getTier returns correct tier for LPA range', () => {
  const judge = new ConnectomeJudge();
  assert.equal(judge.getTier(2.0).tierName, 'Unpaid Chai Intern');
  assert.equal(judge.getTier(15.0).tierName, 'Mid Product Tier');
  assert.equal(judge.getTier(50.0).tierName, 'FAANG Staff Architect');
  assert.equal(judge.getTier(100.0).tierName, 'Connectome Overlord');
});
