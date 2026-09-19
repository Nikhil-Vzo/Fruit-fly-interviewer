# Tests — FlyWire HR

32 tests, 0 failures. Run with:
```bash
npm test
```

---

## Test Suites

### `tests/biophysics.test.js` — 7 tests
Verifies the Izhikevich ODE simulation correctness.

| Test | What it checks |
|---|---|
| Resting membrane potential | V stays near −65mV without stimulus |
| +30mV spike peak | Action potential reaches +30mV before reset (not premature −38mV) |
| Excitatory synaptic current | I_syn > 0 when V < E_rev (depolarising) |
| Tsodyks-Markram STF | u_rel increases on repetitive spikes |
| Vesicle mass conservation | x + y + z = 1.0 at all times |
| Ring attractor integration | 16-column ODE produces smooth continuous dynamics |
| NaN guard | No float explosion on extreme inputs |

### `tests/connectome-judge.test.js` — 6 tests
Verifies the fly brain verdict system.

| Test | What it checks |
|---|---|
| Expert answer → dopamine reward | deltaLPA > 0, DA > 0.3, GF = false, isFlyBrain = true |
| Fatal pattern → Giant Fiber | GF = true, deltaLPA ≤ −12.0 |
| Non-tech → Chai Intern crash | GF = true, newLPA ≤ 3.0 |
| Begging → octopamine dominant | deltaLPA < 0, octopamine > dopamine |
| Determinism | Same answer produces identical deltaLPA in two separate instances |
| getTier | Correct tier labels for LPA 2, 15, 50, 100 |

### `tests/lpa.test.js` — 10 tests
Legacy heuristic engine tests (kept for regression).

| Test | What it checks |
|---|---|
| Initial baseline | Starts at 15 LPA |
| Correct answer rewards | Positive LPA delta + dopamine flag |
| Fatal answer penalises | Severe penalty + Giant Fiber flag |
| Deterministic penalties | Same input → same output |
| Begging penalised | Never rewarded |
| Non-tech admission | Crashes to Unpaid Chai Intern |
| Retry backoff not penalised | `sleep(1000)` with backoff is not a fatal bug |
| Factorial complexity caught | O(n!) detected |
| Long rambling penalised | Length without depth is penalised |
| Interim keyword analysis | Fast path returns live deflection |

### `tests/server.test.js` — 2 tests

| Test | What it checks |
|---|---|
| Multi-tenancy isolation | Two simultaneous sockets have fully independent LPA sessions |
| DoS hardening | 10,000-character payload handled without regex backtrack or memory leak |

### `tests/gemini.test.js` — 5 tests

| Test | What it checks |
|---|---|
| Null key by default | `hasApiKey()` = false without a key |
| Null return on missing key | Returns null → enables fallback |
| setApiKey works | Status updates correctly |
| sanitizeEvaluation clamps | Out-of-bounds LLM tensors are bounded |
| Multi-turn history | Clears correctly on resetHistory() |

### `tests/connectome.test.js` — 1 test

| Test | What it checks |
|---|---|
| Neuron JSON schema | All neurons have required fields, valid types, authentic IDs |
| Bio-acoustics | SpeechAudioController contains courtship and pulse synthesis |

---

## Running Individual Suites

```bash
node --test tests/biophysics.test.js
node --test tests/connectome-judge.test.js
node --test tests/lpa.test.js
node --test tests/server.test.js
node --test tests/gemini.test.js
node --test tests/connectome.test.js
```

## Adding a New Test

Tests use Node.js built-in `node:test` and `node:assert/strict` — no external test framework needed.

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const { ConnectomeJudge } = require('../lib/connectome-judge');

test('My test description', () => {
  const judge = new ConnectomeJudge();
  const result = judge.judge('Question', 'Answer', 15.0);
  assert.ok(result.isFlyBrain, 'Must be fly brain');
});
```
