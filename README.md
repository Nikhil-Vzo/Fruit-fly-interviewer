# FlyWire HR — Drosophila Connectome Real-Time LPA Interviewer 🪰

A real-time technical mock interviewer where the **actual fruit fly brain decides your salary**.

The *Drosophila melanogaster* connectome — modelled as a live biophysical ODE system — evaluates your systems architecture answers, runs a 500 ms neural simulation burst, and emits dopamine or octopamine based on what it detects. The emergent neural state determines your LPA (Lakhs Per Annum). **No LLM scores you. The fly does.**

---

## Architecture Overview

```
Candidate Answer Text
        │
        ▼
┌─────────────────────────────┐
│   ConnectomeJudge           │  lib/connectome-judge.js
│   answerToStimulus()        │  ← pure pattern matching
│   I_input, S_stress,        │    no LLM involved
│   S_reward, forceGF         │
└────────────┬────────────────┘
             │  stimulus params
             ▼
┌─────────────────────────────┐
│   BiophysicsEngine          │  lib/biophysics-engine.js
│   runFlyBrainBurst(500ms)   │  ← 1000× Izhikevich Euler steps
│                             │
│   Izhikevich ODE (GF neuron)│
│   Tsodyks-Markram synapses  │
│   Dopamine/Octopamine kinetics
│   Ring Attractor (16 ODEs)  │
└────────────┬────────────────┘
             │  NeuralVerdict
             ▼
┌─────────────────────────────┐
│   LPA Delta Readout         │
│   dopamine  → +LPA          │
│   octopamine → −LPA         │
│   giantFiber → −12.5 LPA   │
│   ringCoherence → bonus     │
└────────────┬────────────────┘
             │
             ├──────────────────────────────────────────────┐
             ▼                                              ▼
┌───────────────────┐                          ┌────────────────────────┐
│  Socket.io emit   │                          │  Gemini Flash (opt.)   │
│  evaluation_result│                          │  Role: write follow-up │
│  to browser       │                          │  question text ONLY    │
└───────────────────┘                          │  Does NOT score.       │
                                               └────────────────────────┘
```

---

## The Biology → LPA Mapping

| Drosophila Circuit | What Triggers It | LPA Effect |
|---|---|---|
| **PAM dopamine neurons** | Deep technical insight (Raft, WAL, MVCC...) | `+3` to `+15 LPA` |
| **OA-VPM octopamine neurons** | Vague, surface-level, or evasive answer | `−1` to `−7 LPA` |
| **Giant Fiber interneuron** | Fatal anti-pattern (plaintext pw, eval(), DROP TABLE) | `−12.5 LPA` |
| **Giant Fiber + non-tech** | "I'm from arts background / don't know how to code" | Crash to `2.4 LPA` |
| **Ellipsoid Body ring attractor** | Answer coherence / logical structure | `±2 LPA` |
| **Tsodyks-Markram STF** | Sustained, detailed explanation | Scales magnitude |

---

## Quickstart

### Prerequisites
- Node.js 18+
- Chrome / Edge (Web Speech API for voice input)

### Setup
```bash
git clone https://github.com/Nikhil-Vzo/Fruit-fly-interviewer.git
cd Fruit-fly-interviewer

npm install

# Copy and fill in your Gemini key (optional — only needed for follow-up questions)
cp .env.example .env
# Edit .env: GEMINI_API_KEY=your_key_here

npm test    # 32 tests, all pass
npm start   # http://localhost:3000
```

> **Note**: Gemini is optional. The fly brain judges even without it.
> With a key: Gemini writes the follow-up question text.
> Without a key: follow-up comes from the fixed question bank.

---

## Project Structure

```
fruit-fly-interview/
│
├── lib/
│   ├── biophysics-engine.js     # 24-ODE Drosophila neural simulation
│   ├── connectome-judge.js      # THE JUDGE — fly brain → LPA delta
│   ├── gemini-judge.js          # Secondary: follow-up question wording only
│   └── lpa-engine.js            # Legacy heuristic engine (kept for tests)
│
├── public/
│   ├── assets/
│   │   ├── connectome_neurons.json   # FlyWire/Hemibrain EM neuron schemas
│   │   ├── fafb_57311.swc            # Reconstructed FAFB neuron (5553 nodes)
│   │   └── *.swc / *.obj            # Janelia JRC2018 brain meshes
│   ├── js/
│   │   ├── app.js                   # Main orchestrator (Socket.io + UI)
│   │   ├── biophysics-engine.js     # Browser-side copy of engine
│   │   ├── connectome-scene.js      # Three.js 3D viewport + OrbitControls
│   │   ├── speech-audio.js          # Web Speech API + audio ducking
│   │   └── telemetry-hud.js         # CRT oscilloscope canvas renderer
│   ├── index.html
│   └── style.css
│
├── tests/
│   ├── biophysics.test.js           # Izhikevich ODE, STF, mass conservation
│   ├── connectome.test.js           # Neuron JSON schema validation
│   ├── connectome-judge.test.js     # Fly brain verdict tests (6 tests)
│   ├── gemini.test.js               # Gemini fallback and sanitize tests
│   ├── lpa.test.js                  # Legacy rubric tests (kept)
│   └── server.test.js               # Multi-tenancy + DoS hardening
│
├── server.js                        # Express + Socket.io server
├── .env.example                     # API key template
└── package.json
```

---

## The Neural Simulation (`biophysics-engine.js`)

**24 coupled ODEs** solved at `dt = 0.5 ms` via Forward Euler:

### 1. Izhikevich Giant Fiber Neuron
```
dV/dt = 0.04V² + 5V + 140 − u + I_syn
du/dt = a(bV − u)
Spike at V ≥ +30 mV → reset V = c = −60 mV, u += d = 8
```
Parameters: `a=0.02, b=0.2, c=−60, d=8` (regular spiking)

### 2. Conductance-Based Synapse
```
I_syn = g_syn · y · (E_rev − V)     E_rev = 0 mV (excitatory)
```
Strictly depolarizing: inward current when `V < E_rev`

### 3. Tsodyks-Markram Short-Term Facilitation
3-pool vesicle dynamics with strict mass conservation `x + y + z = 1.0`:
```
dx/dt = z/τ_rec
dy/dt = −y/τ_inact
dz/dt = y/τ_inact − z/τ_rec
On spike: u_rel += U_baseline·(1−u_rel); release = u_rel·x
```
`τ_facil = 200 ms`, `τ_rec = 450 ms`, `τ_inact = 3.5 ms`

### 4. Michaelis-Menten Monoamine Kinetics
```
d[Oct]/dt = S_stress · k_rel_oct − V_max·[Oct]/(K_m + [Oct])
d[DA]/dt  = S_reward · k_rel_da  − V_max·[DA]/(K_m + [DA])
```
`V_max = 8.5`, `K_m = 2.1`, `k_rel_oct = 14`, `k_rel_da = 16`

### 5. Central Complex 16-Column Ring Attractor
```
τ_ring · dr_i/dt = −r_i + f(Σ_j W_ij·r_j + I_ext_i)
W_ij = cos(θ_i − θ_j) − 0.25     (Mexican-hat lateral inhibition)
τ_ring = 25 ms
```
Ring bump coherence = `max(r) − mean(r)` → answer clarity score

---

## The Judge (`connectome-judge.js`)

### Answer → Stimulus Mapping

```javascript
// Expert answer (Raft, WAL, Bloom Filter, etc.)
{ I_input: 18.0, S_stress: 0.05, S_reward: 0.85 }
// → fly runs dopamine burst → +6 to +15 LPA

// Fatal: "store passwords in plaintext"
{ I_input: 0, S_stress: 1.0, S_reward: 0.0, forceGiantFiber: true }
// → Giant Fiber fires → −12.5 LPA

// Non-technical: "I'm from arts background"
{ I_input: 0, S_stress: 1.0, S_reward: 0.0, forceGiantFiber: true, nonTech: true }
// → escape reflex + demotion → crash to 2.4 LPA

// Mediocre: "just use Redis"
{ I_input: 5.0, S_stress: 0.45, S_reward: 0.12 }
// → mild octopamine response → −1 to −3 LPA
```

### LPA Delta Formula
```javascript
deltaLPA = (peakDopamine − 0.05) × 16.0     // reward pathway
         − (peakOctopamine − 0.05) × 7.0    // stress pathway
         + ringCoherence × 6.0               // clarity bonus
         + firingRate × 0.08                 // depth bonus
         (clamped to [−20, +15])
```

---

## LPA Tiers

| Range | Tier | Description |
|---|---|---|
| 0–3 LPA | Unpaid Chai Intern | Prohibited from git commit |
| 3–5.5 LPA | Mass Recruiter Bench | 3-year bond, editing macros |
| 5.5–12 LPA | Junior Startup Dev | Fixing Jira CSS |
| 12–25 LPA | Mid Product Tier | Solid backend engineer |
| 25–48 LPA | Tier-1 FinTech Lead | Payment gateway architect |
| 48–95 LPA | FAANG Staff Architect | Rejects PRs, writes RFCs |
| 95–200 LPA | Connectome Overlord | Sub-μs FPGA wizard |

---

## Tests

```bash
npm test
# 32 tests, 0 failures

# Individual suites:
node --test tests/biophysics.test.js        # 7 ODE tests
node --test tests/connectome-judge.test.js  # 6 fly brain verdict tests
node --test tests/lpa.test.js               # 10 legacy rubric tests
node --test tests/server.test.js            # 2 multi-tenancy tests
node --test tests/gemini.test.js            # 5 Gemini fallback tests
node --test tests/connectome.test.js        # 1 neuron JSON schema test
node --test tests/connectome.test.js        # 1 audio synthesis test
```

---

## Data Sources

| Asset | Source |
|---|---|
| `fafb_57311.swc` | Full Adult Fly Brain (FAFB), reconstructed via PyMaid |
| `connectome_neurons.json` | FlyWire + Hemibrain EM consortium data |
| JRC2018 brain template | Janelia Research Campus `nat.flybrains` |
| Micro-CT anatomy meshes | TuragaLab `flybody` adult Drosophila model |
| Izhikevich model | Izhikevich (2003), *Simple Model of Spiking Neurons* |
| Tsodyks-Markram | Tsodyks & Markram (1997), *The neural code between neocortical pyramidal neurons* |
| Ring attractor | Kim et al. (2017), *Ring attractor dynamics in the Drosophila central brain* |

---

## License

MIT. Brain templates and connectome data credit: Janelia Research Campus, FlyWire consortium, TuragaLab.
