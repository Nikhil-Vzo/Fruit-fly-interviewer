# Drosophila Connectome Real-Time LPA Technical Interviewer ("FlyWire HR")
## Hardened Implementation Plan (Post Multi-LLM Peer Review Edition)

> **Peer Review Consensus Incorporated:** Qwen 3.8 Max, DeepSeek, Grok, Claude Sonnet  
> **Key Revisions:** Fixed Izhikevich spike reset (+30mV peak), added Tsodyks-Markram facilitation (STF), bounded circuit to 68-neuron Curated Functional Subcircuit (< 2% CPU load), audio ducking to eliminate acoustic feedback, Web Speech watchdog loop, and strict numerical NaN clamping.

**Goal:** Build a real-time, interactive technical interview web application where a candidate's voice/code answers are evaluated by an authentic 3D Fruit Fly (*Drosophila melanogaster*) driven by a pure biophysical neural circuit engine, dynamically calculating their market compensation (LPA) with emotional fly reactions.

**Target Hardware:** NVIDIA GeForce RTX 2050 (4 GB VRAM), 16 GB RAM, Windows 11.

---

## 1. Concrete Biophysical Model Specifications

### 1.1 Curated 68-Neuron Drosophila Functional Subcircuit
| Subcircuit | Neuron Types & IDs | State Variables | Function |
|---|---|---|---|
| **Giant Fiber System (Escape)** | 2x GF (L/R), 2x PSI, 2x TTMn (leg jump), 6x DLMn (wing flap) | 12 units (24 states) | Emergency escape jump & violent flapping on fatal blunder |
| **Central Complex (Attention)** | 16x E-PG (Ellipsoid Body wedges), 8x P-EN (Protocerebral bridge) | 24 units (24 states) | Ring attractor tracking conversational flow & coherence |
| **Mushroom Body (Jargon & Memory)** | 24x Kenyon Cells, 4x MBONs | 28 units (28 states) | Associative recognition of technical concepts |
| **Neuromodulatory Clusters** | 2x PAM cluster (Dopamine), 2x PPL cluster (Octopamine) | 4 biochemical pools | Global emotional tone (Reward vs Stress) |
| **Total Simulation Footprint** | **68 biophysical units** | **80 state floats** | Runs at $2,000\text{ steps/sec}$ ($\Delta t = 0.5\text{ ms}$) in $< 2\%$ CPU |

### 1.2 Mathematical Formulations
1. **Giant Fiber Electrophysiology (Corrected Izhikevich):**
   $$\frac{dV}{dt} = 0.04V^2 + 5V + 140 - u + I_{\text{syn}}(t) + I_{\text{aversive}}$$
   $$\frac{du}{dt} = a(bV - u)$$
   **Spike Condition (Fixed per Qwen/Claude/Grok):**
   $$\text{If } V \ge +30.0\text{ mV} \implies \begin{cases} V \leftarrow c = -60.0\text{ mV} \\ u \leftarrow u + d = u + 8.0 \\ \text{Emit Motor Spike to TTMn Jump Muscle} \end{cases}$$
   *Hard NaN Clamp:* $V \leftarrow \text{Clamp}(V, -90.0, +35.0)$, $u \leftarrow \text{Clamp}(u, -30.0, +30.0)$.

2. **Tsodyks-Markram with Short-Term Facilitation (Fixed per Reviewers):**
   $$\frac{du_{\text{rel}}}{dt} = -\frac{u_{\text{rel}}}{\tau_{\text{facil}}} + U \cdot (1 - u_{\text{rel}}) \cdot \delta(t - t_{\text{spike}})$$
   $$\frac{dx}{dt} = \frac{z}{\tau_{\text{rec}}} - u_{\text{rel}} \cdot x \cdot \delta(t - t_{\text{spike}})$$
   $$\frac{dy}{dt} = -\frac{y}{\tau_{\text{inact}}} + u_{\text{rel}} \cdot x \cdot \delta(t - t_{\text{spike}})$$
   $$\frac{dz}{dt} = \frac{y}{\tau_{\text{inact}}} - \frac{z}{\tau_{\text{rec}}}$$
   Parameters: $\tau_{\text{rec}} = 450\text{ ms}$, $\tau_{\text{facil}} = 200\text{ ms}$, $\tau_{\text{inact}} = 3.5\text{ ms}$, $U = 0.25$, $E_{\text{rev}} = 0\text{ mV}$.

3. **Central Complex Ring Attractor (Circulant Mexican Hat Matrix):**
   $$\tau \frac{dV_i}{dt} = -V_i + \sum_{j=1}^{16} W_{ij} \cdot \sigma(V_j) + I_{i,\text{audio}}$$
   $$W_{ij} = J_{\text{excite}} \cos\left(\frac{2\pi(i - j)}{16}\right) - J_{\text{inhibit}}$$

---

## 2. Hardened Implementation Tasks (Bite-Sized TDD)

### Task 1: Package Scaffolding & Setup
**Files:** `package.json`
- [ ] Initialize Express & Socket.io dependencies
- [ ] Verify `npm install` and Node v18+ environment

### Task 2: Biophysics Engine with STF & Peak Spike Reset
**Files:** `lib/biophysics-engine.js`, `tests/biophysics.test.js`
- [ ] Step 1: Write tests for $+30\text{ mV}$ peak action potential, Tsodyks-Markram facilitation ($du_{\text{rel}}/dt$), and NaN clamping.
- [ ] Step 2: Implement `BiophysicsEngine` with Euler sub-stepping and state conservation.
- [ ] Step 3: Verify with `npm test`.

### Task 3: LPA Salary Engine with Interim Feedback
**Files:** `lib/lpa-engine.js`, `tests/lpa.test.js`
- [ ] Step 1: Write tests for salary tiers (1.2 LPA to 180 LPA), blunder penalties, and reward deltas.
- [ ] Step 2: Implement dynamic scoring with real-time heuristic word evaluation.
- [ ] Step 3: Verify with `npm test`.

### Task 4: Speech Controller with Audio Ducking & Watchdog Loop
**Files:** `public/js/speech-audio.js`
- [ ] Implement `webkitSpeechRecognition` with continuous listening.
- [ ] Implement watchdog auto-restart timer on `onend` event.
- [ ] Implement **Audio Ducking**: mute mic input whenever fly TTS is speaking to prevent acoustic feedback loop.
- [ ] Provide Web Audio API formant-filtered insect buzzing speech.

### Task 5: Three.js 3D Drosophila Anatomy & Neuropil Shaders
**Files:** `public/js/connectome-scene.js`
- [ ] Single merged `BufferGeometry` for Janelia neuropils (Central Complex, Mushroom Bodies, Antennal Lobes, Optic Lobes).
- [ ] Anatomical fly body (compound eye facets, thorax, wings, legs).
- [ ] Skeletal animation states:
  - `IDLE`: subtle respiratory cycle.
  - `GROOMING`: forelegs rub antennae on high dopamine.
  - `AGITATED`: rapid wing shivering on octopamine surge.
  - `GIANT_FIBER_ESCAPE`: dramatic leg extension and backflip on fatal blunder.

### Task 6: Telemetry HUD & Multi-Channel Canvas Oscilloscope
**Files:** `public/js/telemetry-hud.js`
- [ ] Render 60 FPS CRT-style oscilloscope showing Giant Fiber membrane voltage trace and action potentials.
- [ ] Dial meters for vesicle release frequency (Hz), Octopamine (stress), and Dopamine (reward).
- [ ] Central Complex 16-channel ring attractor polar visualization.

### Task 7: Full Application Assembly & Server Integration
**Files:** `server.js`, `public/index.html`, `public/style.css`, `public/js/app.js`
- [ ] Express server + Socket.io gateway.
- [ ] Dual-panel UI: Left = Scientific Connectome Lab; Right = LPA Technical Interviewer.
- [ ] Pre-configured technical interview questions (Distributed Systems, Concurrency, Database Design).

### Task 8: End-to-End Verification & Interactive Launch
- [ ] Run all automated test suites (`npm test`).
- [ ] Launch application on `http://localhost:3000`.
- [ ] Verify 60 FPS rendering on RTX 2050.
- [ ] Verify speech recognition, audio ducking, fly panic animation, and live LPA ticker.
