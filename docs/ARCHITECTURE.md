# Architecture — FlyWire HR

## Guiding Principle

> **The fruit fly brain decides your LPA. Not an LLM.**

The Gemini API is entirely optional. It only writes the wording of follow-up questions.
The actual scoring — every single LPA delta — comes from the emergent state of a live
Drosophila neural simulation run in response to the candidate's answer.

---

## System Diagram

```
Browser (public/)                    Server (server.js)
─────────────────────────────────    ──────────────────────────────────────
  index.html                              Socket.io
  │                                       │
  ├── app.js                  ◄──────────►│  candidate_response event
  │   ├── socket.io-client                │
  │   ├── BiophysicsEngine.js             │  ConnectomeJudge.judge()
  │   │   (visualization loop)            │  ┌────────────────────────────┐
  │   ├── ConnectomeScene.js              │  │  1. answerToStimulus()     │
  │   │   (Three.js 3D)                   │  │     pattern matching only  │
  │   ├── TelemetryHUD.js                 │  │                            │
  │   │   (canvas oscilloscope)           │  │  2. BiophysicsEngine       │
  │   └── SpeechAudio.js                  │  │     runFlyBrainBurst()     │
  │       (Web Speech API)                │  │     500ms ODE simulation   │
  │                                       │  │                            │
  └── style.css                           │  │  3. NeuralVerdict → LPA   │
                                          │  └────────────────────────────┘
                                          │
                                          │  (Optional) GeminiJudge
                                          │  getGeminiFollowUp()
                                          │  → follow-up question text only
                                          │
                                          └──► evaluation_result emit
```

---

## Module Responsibilities

### `lib/connectome-judge.js` — The Primary Judge
The only module that produces LPA deltas. Contains:

- `answerToStimulus(text)` — converts raw answer text to neural stimulus parameters.
  Uses regex pattern matching against `FATAL_PATTERNS`, `NON_TECH_PATTERNS`,
  `BEGGING_PATTERNS`, `DEEP_TECH_PATTERNS`, and `MID_TECH_PATTERNS`.
  Output: `{ I_input, S_stress, S_reward, forceGiantFiber, label }`

- `runFlyBrainBurst(stimulus)` — instantiates a fresh `BiophysicsEngine`,
  runs 1000 Euler steps (500ms at dt=0.5ms), records peak dopamine,
  peak octopamine, spike count, Giant Fiber events, and ring coherence.
  Applies the LPA delta formula and generates a critique string from neural state.

- `judge(question, answer, currentLPA)` — orchestrates the above two,
  clamps result to [1.2, 180.0], and returns a full `NeuralVerdict`.

### `lib/biophysics-engine.js` — The Neural Simulation
24 coupled ODEs, Forward Euler integration at dt=0.5ms:

1. **Izhikevich Giant Fiber** — membrane dynamics with +30mV peak reset
2. **Conductance-Based Synapse** — `I_syn = g_syn · y · (E_rev − V)`
3. **Tsodyks-Markram STF** — 3-pool vesicle dynamics, mass conserved
4. **Michaelis-Menten Monoamine Kinetics** — dopamine and octopamine
5. **16-Column Ring Attractor** — Central Complex heading integration

Used in two contexts:
- **Server**: `ConnectomeJudge` instantiates it fresh per evaluation burst
- **Browser**: `app.js` runs it continuously for the visualisation loop

### `lib/gemini-judge.js` — Follow-Up Question Writer
- Called by `server.js` AFTER `ConnectomeJudge` has already decided the LPA
- `getGeminiFollowUp()` sends a short prompt asking for ONE follow-up question
- If API unavailable / times out → server falls back to fixed question bank
- Never modifies LPA, never produces scores

### `lib/lpa-engine.js` — Legacy Heuristic Engine
Kept for backward compatibility with existing tests.
Not used in the live evaluation path. `ConnectomeJudge` replaced it.

### `server.js` — Socket.io Event Bus
Per-connection isolated sessions (fixes multi-tenancy singleton bug).
Event flow:
```
connect       → emit 'init'  (LPA=15, Q1, flyBrainActive=true)
candidate_response → ConnectomeJudge.judge() → [Gemini followUp] → emit 'evaluation_result'
candidate_interim  → answerToStimulus() only → emit 'interim_feedback'
set_gemini_key     → geminiJudge.setApiKey() → emit 'llm_status'
reset_interview    → reset LPA to 15 → emit 'init'
```

### `public/js/connectome-scene.js` — 3D Viewport
Three.js scene with:
- Janelia JRC2018 brain shell (neuropil mesh)
- FlyWire EM reconstructed neuron tracts
- Drosophila micro-CT anatomy (head, thorax, abdomen, legs, wings)
- OrbitControls for 360° rotation
- Raycaster neuron inspector (click to select + optogenetic stimulate)
- Action potential spark InstancedMesh animation

### `public/js/telemetry-hud.js` — Oscilloscope HUD
Three render modes switchable via tab:
- `TRACE` — CRT membrane voltage waveform with spike markers
- `MATRIX` — 16×1 ring attractor column heatmap
- `STF` — Tsodyks-Markram facilitation curve over time

---

## Data Flow for One Evaluation

```
1. User submits answer via textForm or Web Speech API

2. app.js emits socket 'candidate_response' { text, questionIndex }

3. server.js receives:
   a. Sanitizes text (max 4000 chars, debounce 250ms)
   b. Calls ConnectomeJudge.judge(question, answer, currentLPA)

4. ConnectomeJudge.judge():
   a. answerToStimulus(answer)
      → Checks FATAL → NONTECH → BEGGING → DEEP_TECH → MID_TECH
      → Returns { I_input, S_stress, S_reward, forceGiantFiber, label }
   b. runFlyBrainBurst(stimulus)
      → new BiophysicsEngine()
      → 1000 × engine.step(0.5, I, S_stress, S_reward)
      → Records: peakDopamine, peakOctopamine, giantFiberFired, ringCoherence
   c. Apply formula:
      deltaLPA = (DA−0.05)×16 − (Oct−0.05)×7 + coherence×6 + firingRate×0.08
   d. Generate critique from neural state
   e. Return NeuralVerdict

5. server.js optionally calls getGeminiFollowUp()
   → Short prompt: "write a follow-up question given this verdict"
   → 12s timeout, silent fallback to QUESTIONS bank

6. socket.emit('evaluation_result', { evaluation, nextQuestion, questionIndex })

7. app.js receives:
   a. Updates LPA display with crash/surge animation
   b. Triggers biophysics perturbation (stress/reward/aversive current)
   c. Plays Drosophila audio (courtship sine 155Hz or agitated pulse 280Hz)
   d. Appends history entry with 🪰 indicator
   e. Speaks critique via SpeechSynthesis (formant insect voice)
   f. Loads next question after 1.2s delay
```

---

## Neural Verdict Schema

```typescript
interface NeuralVerdict {
  deltaLPA: number;          // LPA change [-20, +15]
  newLPA: number;            // Updated total LPA
  tier: Tier;                // { tierName, description }
  dopamineLevel: number;     // Peak DA during burst [0..1]
  octopamineLevel: number;   // Peak Oct during burst [0..1]
  giantFiberTriggered: bool; // Escape reflex fired
  ringCoherence: number;     // Attractor bump sharpness [0..0.5]
  firingRate: number;        // Spikes/second during burst
  stressStimulus: number;    // S_stress input used
  rewardStimulus: number;    // S_reward input used
  aversiveCurrent: number;   // For biophysics vis loop
  circuitLabel: string;      // EXPERT | COMPETENT | ADEQUATE | WEAK | FATAL | BEGGING | NON_TECH
  critique: string;          // Generated from neural state
  isFlyBrain: true;          // Always true
  isLLM: false;              // Always false
}
```
