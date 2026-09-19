# ConnectomeJudge — How the Fly Brain Decides Your LPA

`lib/connectome-judge.js`

---

## Overview

ConnectomeJudge is the primary evaluation engine. It converts a candidate's text
answer into neural stimulus parameters, runs a 500ms burst simulation of the
Drosophila neural circuit, reads the emergent state, and produces an LPA delta.

**No LLM is involved in scoring.**

---

## Step 1: `answerToStimulus(text)`

Pure pattern matching. No AI. Maps text → `{ I_input, S_stress, S_reward, forceGiantFiber }`.

### Priority order (checked top to bottom, first match wins):

**1. Fatal anti-patterns** → Giant Fiber escape + −12.5 LPA
```
- plaintext password storage
- DROP TABLE
- eval()
- global variable auth state
- disable security
- no need for indexing
- O(n!) factorial time complexity
- busy-wait / Thread.sleep inside mutex
- empty catch blocks
```

**2. Non-technical confession** → Giant Fiber + crash to 2.4 LPA
```
- "not a technical person"
- "don't know how to code"
- "from arts/commerce/humanities background"
- "never written code"
- "zero technical experience"
```

**3. Begging / pity appeal** → Octopamine spike, no reward, −4 to −8 LPA
```
- "give me a higher package"
- "I am poor / broke"
- "please hire me"
- "need the money"
- "bhai please"
```

**4. Normal evaluation** → Compute deepHits + midHits + lengthBonus:

Deep tech (each hit: strong dopamine drive):
```
Raft, Paxos, ZAB, linearizability, serializability,
idempotency, WAL, bloom filter, consistent hashing,
CAP theorem, LSM tree, B+ tree, MVCC, vector clock,
Lamport timestamp, circuit breaker, SSTable/MemTable,
write amplification, 2PC, saga pattern, backpressure,
quorum read/write, fencing token
```

Mid tech (each hit: modest dopamine drive):
```
Redis, Kafka, RabbitMQ, load balancing, caching,
microservices, Docker, Kubernetes, REST API, GraphQL,
SQL index, race condition, thread-safe, mutex, semaphore,
retry logic, exponential backoff
```

Stimulus formula:
```javascript
rewardScore = min(1.0, deepHits×0.22 + midHits×0.08 + lengthBonus×0.12)
stressScore = max(0.02, 0.55 − rewardScore×0.5)
I_input     = min(22.0, 2.0 + deepHits×3.5 + midHits×1.2 + lengthBonus×4.0)
```
Where `lengthBonus = min(1.0, wordCount / 200)`.

---

## Step 2: `runFlyBrainBurst(stimulus)`

```javascript
const engine = new BiophysicsEngine();
const dt = 0.5;       // ms
const duration = 500; // ms
const steps = 1000;

for (let s = 0; s < steps; s++) {
  const ramp = min(1.0, s / (steps × 0.1));  // 10% ramp-up
  const state = engine.step(dt, I_input × ramp, S_stress, S_reward);
  
  // Track peaks
  if (state.dopamineLevel > peakDopamine)     peakDopamine = state.dopamineLevel;
  if (state.octopamineLevel > peakOctopamine) peakOctopamine = state.octopamineLevel;
  if (state.giantFiberSpike && stressDominant) giantFiberFired = true;
  
  // Ring coherence
  coherenceSum += max(ringState) − mean(ringState);
}

ringCoherence = coherenceSum / steps;
firingRate    = totalSpikes / 0.5;  // spikes/sec
```

**Giant Fiber discrimination:** A GF spike is only counted as aversive if
`S_stress > 0.6 AND S_reward < 0.3`. A reward spike (dopamine surge causing
membrane to reach threshold) does NOT penalise the candidate.

---

## Step 3: LPA Delta Formula

```javascript
// Fatal / non-tech path:
if (giantFiberFired && forceGiantFiber) {
  if (nonTech) deltaLPA = -(currentLPA - 2.4);   // crash to 2.4
  else         deltaLPA = -12.5;                  // fatal pattern
}

// Begging path:
else if (isBegging) {
  deltaLPA = -(octContribution × 0.8) - 2.0;
}

// Normal path:
else {
  daContrib       = (peakDopamine - 0.05) × 16.0     // max +14.4
  octContrib      = (peakOctopamine - 0.05) × 7.0    // max  -6.65
  coherenceBonus  = ringCoherence × 6.0               // max  +3.0
  firingBonus     = min(2.0, firingRate × 0.08)       // max  +2.0

  deltaLPA = daContrib - octContrib + coherenceBonus + firingBonus
}

deltaLPA = clamp(deltaLPA, -20.0, +15.0)
```

---

## Step 4: Critique Generation

Critique strings are generated from the neural readout — no LLM.

| Circuit label | Dopamine | Octopamine | GF | Critique tone |
|---|---|---|---|---|
| `EXPERT` | High | Low | No | "PAM neurons surged to X% — elite concepts detected" |
| `COMPETENT` | Moderate | Moderate | No | "Moderate dopaminergic response, residual uncertainty" |
| `ADEQUATE` | Low | High | No | "Mid-tier buzzwords only, reward pathway not activated" |
| `WEAK` | Baseline | High | No | "No reward circuit activation, ring attractor dispersed" |
| `FATAL_PATTERN` | — | — | Yes | "Giant Fiber escape reflex triggered. LPA incinerated." |
| `NON_TECH` | — | — | Yes | "Background noise. Reassigned to Chai Intern protocol." |
| `BEGGING` | — | High | No | "Octopamine saturating. Pity appeals activate aversive pathway." |

---

## Determinism

`ConnectomeJudge` is **fully deterministic**. Same answer → same LPA delta every time.

This is guaranteed because:
1. `BiophysicsEngine` has no randomness (no Langevin noise term)
2. Pattern matching is deterministic
3. Euler integration is deterministic
4. No external API calls affect the score

The test `ConnectomeJudge - Neural verdict is deterministic` verifies this.

---

## Example Verdicts

```
Answer: "Raft consensus with linearizable reads, WAL durability,
         fencing tokens, bloom filters on lock namespace"
→ deepHits: 4, stimulus: { I:18, S_stress:0.08, S_reward:0.82 }
→ peakDA: 1.0, peakOct: 0.165, GF: false
→ deltaLPA: +15.0   (capped)   EXPERT

Answer: "I would store the plaintext password in Redis"
→ FATAL_PATTERN match
→ forceGiantFiber: true
→ deltaLPA: -12.5

Answer: "I am from arts background, I don't know how to code"
→ NON_TECH match
→ forceGiantFiber: true, nonTech: true
→ deltaLPA: -(currentLPA - 2.4)   → crash to 2.4 LPA

Answer: "I would just use MySQL, it works fine"
→ midHits: 0, deepHits: 0
→ peakDA: 0.05 (baseline), peakOct: 1.0
→ deltaLPA: -6.18   WEAK

Answer: "I use consistent hashing and Redis for caching"
→ deepHits: 1, midHits: 1
→ peakDA: 0.44, peakOct: 0.33
→ deltaLPA: +2.0   COMPETENT
```
