# Biophysics Reference — FlyWire HR

The neural simulation at the core of this project models authentic *Drosophila melanogaster*
electrophysiology and circuit dynamics. 24 coupled ODEs are integrated via Forward Euler
at `dt = 0.5 ms`.

---

## 1. Izhikevich Giant Fiber Interneuron

The Giant Fiber (GF) is a large, myelinated interneuron in the Drosophila escape circuit.
It receives mechanosensory input and drives the Tergotrochanteral Motor Neuron (TTMn)
for rapid leg extension (escape jump).

**Equations:**
```
dV/dt = 0.04·V² + 5·V + 140 − u + I_syn
du/dt = a·(b·V − u)

Spike condition: V ≥ V_peak (+30 mV)
  → V  = c  (reset to −60 mV)
  → u += d   (adaptation increment +8)
```

**Parameters (regular spiking, Izhikevich 2003):**
```
a = 0.02    # Adaptation recovery rate
b = 0.20    # Subthreshold resonance coupling
c = −60.0   # Post-spike reset (mV)
d = 8.0     # Adaptation increment
V_peak = +30.0 mV  # Canonical spike peak (NOT premature −38 mV cutoff)
V_rest = −65.0 mV  # Resting potential
```

**In the judge:** A forced GF spike (forceGiantFiber=true) occurs on fatal anti-patterns
and non-technical admissions, producing a −12.5 LPA penalty.

---

## 2. Conductance-Based Excitatory Synapse

```
I_syn = g_syn · y · (E_rev − V)   +   I_input
```

Where:
- `g_syn = 3.2 nS` — synaptic conductance
- `y` — active (cleft) vesicle fraction from Tsodyks-Markram model
- `E_rev = 0.0 mV` — excitatory reversal potential
- `V` — current membrane voltage

This ensures `I_syn > 0` (depolarising) whenever `V < E_rev`, which is always true
at resting potential (−65 mV). The synaptic drive is strictly inward.

`I_input` is the external stimulus current injected from `answerToStimulus()`.

---

## 3. Tsodyks-Markram Short-Term Facilitation (STF)

Three-pool vesicle model with strict mass conservation:

```
Pool states: x (available) + y (active cleft) + z (refractory) = 1.0

dx/dt = z/τ_rec
dy/dt = −y/τ_inact
dz/dt = y/τ_inact − z/τ_rec

On each spike:
  u_rel += U_baseline · (1 − u_rel)     # facilitation boost
  released = u_rel · x
  x -= released
  y += released
```

**Parameters:**
```
U_baseline = 0.20   # Baseline release probability
τ_facil    = 200 ms # Facilitation decay time constant
τ_rec      = 450 ms # Recovery time constant
τ_inact    =  3.5 ms # Inactivation time constant
```

**Mass conservation** is enforced by renormalising `x + y + z` after each step.
This was a specific correctness fix applied during code review.

**In the judge:** `y` (active cleft fraction) drives `I_syn`. Higher sustained firing
from a long, technically rich answer → more vesicle release → stronger synaptic drive
→ larger membrane deflection → higher dopamine response.

---

## 4. Michaelis-Menten Monoamine Kinetics

Dopamine (DA, reward) and Octopamine (Oct, stress/agitation) are modelled as
extracellular neuromodulator concentrations with Michaelis-Menten clearance:

```
d[Oct]/dt = S_stress · k_rel_oct − V_max·[Oct] / (K_m + [Oct])
d[DA]/dt  = S_reward · k_rel_da  − V_max·[DA]  / (K_m + [DA])
```

**Parameters:**
```
k_rel_oct = 14.0   # Oct release rate constant
k_rel_da  = 16.0   # DA release rate constant
V_max     =  8.5   # Transporter maximum velocity
K_m       =  2.1   # Transporter affinity constant
```

Both concentrations are clamped to [0.01, 1.0] μM.

**Octopamine** in Drosophila is the functional analogue of adrenaline (stress, arousal,
escape behaviour). High octopamine = bad answer detected → negative LPA.

**Dopamine** drives reward-learning in the Mushroom Body. High dopamine = strong
technical answer → positive LPA.

**Wingbeat modulation:** `dlmnFrequency = 120 + Oct × 130` Hz (normal 120 Hz,
agitated up to 250 Hz). This drives the audio synthesizer.

---

## 5. Central Complex 16-Column Ring Attractor

The Ellipsoid Body (EB) of the Drosophila Central Complex maintains a spatial heading
representation via a continuous attractor network. 16 angular columns are modelled
with Mexican-hat lateral inhibition (local excitation, global inhibition):

```
W_ij = cos(θ_i − θ_j) − 0.25      # connectivity kernel

For each column i:
  recurrentDrive_i = Σ_j W_ij · r_j
  sensoryDrive_i   = max(0, cos(headingAngle − θ_i))
  targetAct_i      = clamp(0.15 + 0.5·recurrentDrive/N + 0.45·sensoryDrive)
  dr_i/dt          = (targetAct_i − r_i) / τ_ring     [τ_ring = 25 ms]
```

**Heading angle** evolves as:
```
dθ/dt = S_reward × 0.08 − S_stress × 0.12
```
A rewarding answer rotates the fly's internal heading; a stressful answer perturbs it.

**Ring coherence** (bump sharpness) is:
```
coherence = max(r) − mean(r)
```
A sharp bump (high coherence) means the answer had clear, directed content.
A dispersed ring (low coherence) means the answer was scattered or incoherent.
Coherence contributes up to +3 LPA to the delta.

---

## Numerical Integration Details

- Method: Forward Euler (1st-order)
- Step size: `dt = 0.5 ms`
- Evaluation burst: 500 ms → 1000 steps
- NaN guards: all state variables are clamped after each step
  - V: clamped to [−90, +35] mV
  - u: clamped to [−30, +30]
  - Monoamines: clamped to [0.01, 1.0]
  - Ring state: clamped to [0.01, 1.0]

---

## References

1. Izhikevich, E.M. (2003). Simple model of spiking neurons. *IEEE Trans. Neural Networks*, 14(6), 1569-1572.
2. Tsodyks, M. & Markram, H. (1997). The neural code between neocortical pyramidal neurons depends on neurotransmitter release probability. *PNAS*, 94(2), 719-723.
3. Kim, S.S. et al. (2017). Ring attractor dynamics in the Drosophila central brain. *Science*, 356(6340), 849-853.
4. Jayaraman, V. & Laurent, G. (2007). Evaluating a genetically encoded optical sensor of neural activity using electrophysiology in intact adult fruit flies. *Front. Neural Circuits*, 1, 3.
5. Pfeiffer, B.D. et al. (2010). Tools for neuroanatomy and neurogenetics in Drosophila. *PNAS*, 107(25), 11374-11379.
