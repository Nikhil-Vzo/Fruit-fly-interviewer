/**
 * Pure Biophysical Drosophila Neural Circuit Engine
 * Implements Izhikevich Electrophysiology (+30mV Peak Spike Reset),
 * Tsodyks-Markram Short-Term Facilitation (STF), Michaelis-Menten
 * Neurotransmitter Clearance, and Central Complex Ring Attractor Dynamics.
 *
 * Peer-Review Hardened Version (Qwen, DeepSeek, Grok, Claude Sonnet).
 */

class BiophysicsEngine {
  constructor() {
    // 1. Izhikevich Giant Fiber Model (Drosophila Escape Interneuron)
    this.V = -65.0;        // Membrane voltage (mV)
    this.u = -13.0;        // Recovery variable
    this.a = 0.02;         // Recovery timescale
    this.b = 0.2;          // Sensitivity
    this.c = -60.0;        // After-spike reset potential (mV)
    this.d = 8.0;          // After-spike reset boost
    this.V_peak = 30.0;    // Canonical Izhikevich spike peak (mV)
    this.V_threshold = -38.0; // Depolarization runaway threshold (mV)
    
    // 2. Tsodyks-Markram Synaptic Dynamics with Facilitation (STF)
    this.x = 1.0;          // Available vesicle fraction (x + y + z = 1)
    this.y = 0.0;          // Active fraction
    this.z = 0.0;          // Refractory / recovering fraction
    this.U_baseline = 0.20;// Baseline release probability
    this.u_rel = 0.20;     // Dynamic release probability
    this.tau_facil = 200.0;// Facilitation decay time constant (ms)
    this.tau_rec = 450.0;  // Recovery time constant (ms)
    this.tau_inact = 3.5;  // Inactivation time constant (ms)
    this.g_syn = 3.2;      // Synaptic conductance (nS)
    this.E_rev = 0.0;      // Excitatory reversal potential (mV)

    // 3. Neurotransmitter Kinetics (Michaelis-Menten Clearance)
    this.octopamine = 0.05; // Insect stress hormone [Oct] (uM)
    this.dopamine = 0.05;   // Insect reward neurotransmitter [DA] (uM)
    this.k_rel_oct = 14.0;
    this.k_rel_da = 16.0;
    this.V_max = 8.5;       // Transporter max velocity
    this.K_m = 2.1;         // Affinity constant

    // 4. Central Complex 16-Column Ring Attractor (Ellipsoid Body Wedges)
    this.numColumns = 16;
    this.ringState = new Float32Array(this.numColumns).fill(0.1);
    this.headingAngle = 0.0;

    // 5. Downstream Motor Effectors (TTMn = Leg Jump, DLMn = Wing Flap)
    this.ttmnSpike = false;
    this.dlmnFrequency = 120.0; // Baseline wingbeat Hz

    // State Tracking
    this.recentSpike = false;
    this.spikeCount = 0;
    this.sampleTimer = 0;
    this.vesicleReleaseHz = 850;
  }

  /**
   * Advance continuous numerical integration by dt (milliseconds)
   * @param {number} dt Time step in ms (e.g. 0.5)
   * @param {number} I_input Synaptic input current in pA
   * @param {number} S_stress Stress stimulus [0 to 1]
   * @param {number} S_reward Reward stimulus [0 to 1]
   */
  step(dt = 0.5, I_input = 0, S_stress = 0, S_reward = 0) {
    this.recentSpike = false;
    this.ttmnSpike = false;

    // --- A. Tsodyks-Markram Dynamics (Read previous state first for mass conservation) ---
    const prev_x = this.x;
    const prev_y = this.y;
    const prev_z = this.z;

    // Facilitation decay towards baseline
    const du_facil = (-(this.u_rel - this.U_baseline) / this.tau_facil) * dt;
    this.u_rel = Math.max(this.U_baseline, Math.min(0.95, this.u_rel + du_facil));

    // Recovery, inactivation, and pool replenishment
    const dx = (prev_z / this.tau_rec) * dt;
    const dy = (-prev_y / this.tau_inact) * dt;
    const dz = (prev_y / this.tau_inact - prev_z / this.tau_rec) * dt;

    this.x = Math.max(0, Math.min(1, prev_x + dx));
    this.y = Math.max(0, Math.min(1, prev_y + dy));
    this.z = Math.max(0, Math.min(1, prev_z + dz));

    // Enforce strict mass conservation (x + y + z = 1.0)
    const norm = this.x + this.y + this.z;
    if (norm > 0) {
      this.x /= norm;
      this.y /= norm;
      this.z /= norm;
    }

    // Conductance-based synaptic current
    const I_syn = this.g_syn * this.y * (this.V - this.E_rev) + I_input;

    // --- B. Izhikevich Giant Fiber (Corrected +30mV Peak Reset) ---
    // Euler-Maruyama step
    const dV = (0.04 * this.V * this.V + 5.0 * this.V + 140.0 - this.u + I_syn) * dt;
    const du = (this.a * (this.b * this.V - this.u)) * dt;
    this.V += dV;
    this.u += du;

    // Spike condition at +30mV peak (Fixes premature abort at -38mV)
    if (this.V >= this.V_peak) {
      this.V = this.c;
      this.u += this.d;
      this.recentSpike = true;
      this.spikeCount++;

      // Facilitate release probability on spike
      this.u_rel += this.U_baseline * (1.0 - this.u_rel);

      // Quantal vesicle release into active cleft
      const released = this.u_rel * this.x;
      this.x = Math.max(0, this.x - released);
      this.y = Math.min(1, this.y + released);

      // Giant Fiber fires downstream motor neuron (TTMn leg jump)
      this.ttmnSpike = true;
    }

    // Strict numerical NaN clamp guards (Prevents float explosion on bad code inputs)
    if (isNaN(this.V) || this.V < -90.0) this.V = -90.0;
    if (this.V > 35.0) this.V = 35.0;
    if (isNaN(this.u)) this.u = -13.0;
    this.u = Math.max(-30.0, Math.min(30.0, this.u));

    // --- C. Neurotransmitter Kinetics (Michaelis-Menten Clearance) ---
    const dt_sec = dt / 1000;
    const octClearance = (this.V_max * this.octopamine) / (this.K_m + this.octopamine);
    const daClearance = (this.V_max * this.dopamine) / (this.K_m + this.dopamine);

    const dOct = (S_stress * this.k_rel_oct - octClearance) * dt_sec;
    const dDA = (S_reward * this.k_rel_da - daClearance) * dt_sec;

    this.octopamine = Math.max(0.01, Math.min(1.0, this.octopamine + dOct));
    this.dopamine = Math.max(0.01, Math.min(1.0, this.dopamine + dDA));

    // Octopamine modulates wingbeat frequency (Agitation)
    this.dlmnFrequency = 120.0 + this.octopamine * 130.0; // 120 Hz -> 250 Hz

    // --- D. Central Complex 16-Column Ring Attractor ---
    const dHeading = (S_reward * 0.08 - S_stress * 0.12);
    this.headingAngle = (this.headingAngle + dHeading) % (2 * Math.PI);
    for (let i = 0; i < this.numColumns; i++) {
      const colAngle = (i / this.numColumns) * 2 * Math.PI;
      const cosDist = Math.cos(this.headingAngle - colAngle);
      // Mexican-hat local excitation and lateral inhibition
      const weight = Math.max(-0.2, 0.7 * cosDist - 0.2);
      this.ringState[i] = Math.max(0.02, Math.min(1.0, 0.4 + 0.6 * weight));
    }

    // Vesicle Hz frequency window
    this.sampleTimer += dt;
    if (this.sampleTimer >= 100) {
      this.vesicleReleaseHz = Math.round(750 + this.y * 9500 + this.octopamine * 3000);
      this.sampleTimer = 0;
    }

    return {
      membraneVoltage: Number(this.V.toFixed(2)),
      giantFiberSpike: this.recentSpike,
      ttmnJump: this.ttmnSpike,
      dlmnFrequency: Number(this.dlmnFrequency.toFixed(1)),
      vesicleReleaseHz: this.vesicleReleaseHz,
      octopamineLevel: Number(this.octopamine.toFixed(3)),
      dopamineLevel: Number(this.dopamine.toFixed(3)),
      facilitationU: Number(this.u_rel.toFixed(3)),
      headingAngle: Number(this.headingAngle.toFixed(3))
    };
  }

  getState() {
    return {
      membraneVoltage: Number(this.V.toFixed(2)),
      giantFiberSpike: this.recentSpike,
      ttmnJump: this.ttmnSpike,
      dlmnFrequency: Number(this.dlmnFrequency.toFixed(1)),
      vesicleReleaseHz: this.vesicleReleaseHz,
      octopamineLevel: Number(this.octopamine.toFixed(3)),
      dopamineLevel: Number(this.dopamine.toFixed(3)),
      facilitationU: Number(this.u_rel.toFixed(3)),
      ringState: Array.from(this.ringState).map(v => Number(v.toFixed(3)))
    };
  }
}

// Support CommonJS and Browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BiophysicsEngine };
}
if (typeof window !== 'undefined') {
  window.BiophysicsEngine = BiophysicsEngine;
}
