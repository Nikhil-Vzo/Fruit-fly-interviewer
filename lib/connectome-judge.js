/**
 * ConnectomeJudge — The Drosophila Brain IS the Interviewer
 * 
 * The candidate's answer is converted into neural stimulus parameters,
 * injected into the fruit fly biophysics simulation, and the EMERGENT
 * NEURAL STATE of the connectome determines LPA delta.
 *
 * The fly brain decides. Not an LLM. Not keyword matching.
 * The actual Izhikevich ODE system, Tsodyks-Markram synapses,
 * dopamine/octopamine kinetics, and ring attractor dynamics.
 *
 * Biology:
 *   dopamine (PAM neurons)       → reward circuit → +LPA
 *   octopamine (OA-VPM neurons)  → stress/escape → −LPA
 *   Giant Fiber spike (GF neuron)→ escape reflex → −12.5 LPA
 *   Ring Attractor (Ellipsoid Body) → heading coherence → clarity bonus
 *   Mushroom Body (KCs)          → memory/depth → scales magnitude
 */

const { BiophysicsEngine } = require('./biophysics-engine');

// ── Stimulus Classification Tables ─────────────────────────────────────────

// Fatal anti-patterns → force Giant Fiber escape reflex
const FATAL_PATTERNS = [
  /plaintext\s*password|password.{0,20}plain/i,
  /drop\s+table/i,
  /eval\s*\(/i,
  /global\s+variable.{0,30}auth/i,
  /disable\s+security/i,
  /no\s+need\s+for\s+index/i,
  /\bo\s*\(\s*n\s*!\s*\)|factorial\s+time/i,
  /busy\s*wait|thread\.sleep.{0,40}mutex/i,
  /try\s*\{[\s\S]{0,80}\}\s*catch\s*\([^)]*\)\s*\{\s*\}/i, // empty catch
];

// Non-technical confessions → Giant Fiber + crash to 2.4 LPA
const NON_TECH_PATTERNS = [
  /not\s+(a\s+)?(tech|technical|coder|programmer|developer|engineer)/i,
  /don'?t\s+know\s+(how\s+to\s+)?code/i,
  /from\s+(arts|commerce|humanities|sales|marketing|hr\b)/i,
  /never\s+(done|written|coded|programmed)/i,
  /zero\s+technical/i,
  /not\s+my\s+field/i,
];

// Pity/begging → octopamine spike, no reward
const BEGGING_PATTERNS = [
  /give\s+(me\s+)?(a\s+)?(higher|more|better)\s+(lpa|ctc|salary|package)/i,
  /i\s+am\s+(poor|broke|struggling)/i,
  /please\s+(hire|select|take)\s+me/i,
  /need\s+the?\s+money/i,
  /bhai\s+(please|plz)/i,
  /have\s+mercy/i,
  /increase\s+my\s+(lpa|salary|ctc)/i,
];

// Deep architectural insight → dopamine burst
const DEEP_TECH_PATTERNS = [
  /\braft\b|\bpaxos\b|\bzab\b/i,
  /\blinearizab|\bserializab/i,
  /\bidempoten/i,
  /write.ahead\s+log|\bwal\b/i,
  /bloom\s+filter/i,
  /consistent\s+hashing/i,
  /\bcap\s+theorem\b/i,
  /lsm\s+tree|b\+?\s*tree/i,
  /\bmvcc\b/i,
  /vector\s+clock|lamport/i,
  /circuit\s+breaker/i,
  /sstable|memtable|compaction/i,
  /write\s+amplification/i,
  /two.phase\s+commit|\b2pc\b/i,
  /saga\s+pattern/i,
  /backpressure/i,
  /quorum\s+(read|write)/i,
  /fencing\s+token/i,
];

// Mid-level tech → modest reward
const MID_TECH_PATTERNS = [
  /redis|kafka|rabbitmq/i,
  /load\s+balanc/i,
  /cach(e|ing)/i,
  /microservice/i,
  /docker|kubernetes/i,
  /\brest\s+api\b|\bgraphql\b/i,
  /sql\s+inde[x]/i,
  /race\s+condition/i,
  /thread.safe/i,
  /mutex|semaphore/i,
  /retry\s+logic|exponential\s+backoff/i,
];

class ConnectomeJudge {
  constructor() {
    this.tiers = [
      { max: 3.0,   tierName: 'Unpaid Chai Intern',           description: 'Prohibited from git commit; fetches ginger tea' },
      { max: 5.5,   tierName: 'Mass Recruiter Bench',         description: '3-year bond trainee editing spreadsheet macros' },
      { max: 12.0,  tierName: 'Junior Startup Dev',           description: 'Fixing Jira CSS and webhook race conditions' },
      { max: 25.0,  tierName: 'Mid Product Tier',             description: 'Solid backend engineer at profitable unicorn' },
      { max: 48.0,  tierName: 'Tier-1 FinTech Lead',         description: 'High-throughput payment gateway architect' },
      { max: 95.0,  tierName: 'FAANG Staff Architect',        description: 'Rejects PRs, accumulates RSUs, writes RFCs' },
      { max: 200.0, tierName: 'Connectome Overlord',          description: 'Sub-μs FPGA wizard transcending Indian compensation' },
    ];
    this.currentLPA = 15.0;
  }

  getTier(lpa = this.currentLPA) {
    for (const t of this.tiers) {
      if (lpa <= t.max) return t;
    }
    return this.tiers[this.tiers.length - 1];
  }

  getCurrentLPA() { return this.currentLPA; }

  /**
   * Convert answer text → neural stimulus parameters
   * This is the ONLY "intelligence" step — pure pattern matching.
   * All actual judgment comes from the ODE simulation.
   */
  answerToStimulus(text) {
    const t = String(text).slice(0, 4000);

    // Check fatal patterns first
    const isFatal = FATAL_PATTERNS.some(p => p.test(t));
    const isNonTech = NON_TECH_PATTERNS.some(p => p.test(t));
    const isBegging = BEGGING_PATTERNS.some(p => p.test(t));

    if (isFatal || isNonTech) {
      return {
        I_input: 0.0,
        S_stress: 1.0,
        S_reward: 0.0,
        forceGiantFiber: true,
        nonTech: isNonTech,
        isFatal,
        label: isFatal ? 'FATAL_PATTERN' : 'NON_TECH',
      };
    }

    if (isBegging) {
      return {
        I_input: 2.0,
        S_stress: 0.85,
        S_reward: 0.0,
        forceGiantFiber: false,
        isBegging: true,
        label: 'BEGGING',
      };
    }

    // Count pattern hits for scaling
    const deepHits  = DEEP_TECH_PATTERNS.filter(p => p.test(t)).length;
    const midHits   = MID_TECH_PATTERNS.filter(p => p.test(t)).length;
    const wordCount = t.trim().split(/\s+/).length;

    // Longer, richer answers get more stimulus drive (up to a ceiling)
    const lengthBonus = Math.min(1.0, wordCount / 200);

    // Compute reward (dopamine drive) and stress (octopamine drive)
    const rewardScore = Math.min(1.0, (deepHits * 0.22 + midHits * 0.08 + lengthBonus * 0.12));
    const stressScore = Math.max(0.02, 0.55 - rewardScore * 0.5); // inverse relationship

    // Input current proportional to technical depth
    const I_input = 2.0 + deepHits * 3.5 + midHits * 1.2 + lengthBonus * 4.0;

    return {
      I_input: Math.min(22.0, I_input),
      S_stress: stressScore,
      S_reward: rewardScore,
      forceGiantFiber: false,
      deepHits,
      midHits,
      wordCount,
      label: deepHits >= 2 ? 'EXPERT' : deepHits >= 1 ? 'COMPETENT' : midHits >= 2 ? 'ADEQUATE' : 'WEAK',
    };
  }

  /**
   * Run a 500ms burst simulation of the fruit fly brain.
   * The emergent neural dynamics determine the LPA verdict.
   * 
   * @param {object} stimulus - From answerToStimulus()
   * @returns {object} NeuralVerdict
   */
  runFlyBrainBurst(stimulus) {
    const engine = new BiophysicsEngine();
    const dt = 0.5;        // 0.5 ms Euler step
    const duration = 500;  // 500 ms evaluation burst
    const steps = Math.floor(duration / dt);

    let totalSpikes = 0;
    let peakDopamine = 0.05;
    let peakOctopamine = 0.05;
    let giantFiberFired = stimulus.forceGiantFiber || false;
    let ringCoherenceSum = 0;
    let finalState = null;

    // If forced GF, inject a single massive aversive current spike
    if (stimulus.forceGiantFiber) {
      engine.V = 28.0; // force near-threshold
      engine.octopamine = 0.85;
    }

    for (let s = 0; s < steps; s++) {
      // Ramp the input current in (avoid discontinuity artefact)
      const rampFactor = Math.min(1.0, s / (steps * 0.1));
      const I = stimulus.I_input * rampFactor;

      const state = engine.step(dt, I, stimulus.S_stress, stimulus.S_reward);

      if (state.giantFiberSpike) {
        totalSpikes++;
        // Only treat as aversive GF if stress dominates reward
        if (!stimulus.forceGiantFiber && stimulus.S_stress > 0.6 && stimulus.S_reward < 0.3) {
          giantFiberFired = true;
        }
      }
      if (state.dopamineLevel > peakDopamine)   peakDopamine = state.dopamineLevel;
      if (state.octopamineLevel > peakOctopamine) peakOctopamine = state.octopamineLevel;

      // Ring attractor coherence = max activation - mean activation (bump sharpness)
      const ringArr = engine.ringState;
      const ringMax = Math.max(...ringArr);
      const ringMean = ringArr.reduce((a, b) => a + b, 0) / ringArr.length;
      ringCoherenceSum += (ringMax - ringMean);

      if (s === steps - 1) finalState = state;
    }

    const ringCoherence = ringCoherenceSum / steps; // average bump sharpness [0..~0.5]
    const firingRate = totalSpikes / (duration / 1000); // spikes per second

    // ── LPA DELTA from Neural Readout ──────────────────────────────────────
    // This is the core. The fly's circuits decide compensation.
    
    let deltaLPA = 0;

    if (giantFiberFired && stimulus.forceGiantFiber) {
      // Giant Fiber escape reflex: catastrophic aversive signal
      if (stimulus.nonTech) {
        deltaLPA = -(this.currentLPA - 2.4); // crash to Chai Intern
      } else {
        deltaLPA = -12.5; // fatal pattern penalty
      }
    } else {
      // Normal evaluation pathway:
      // Dopamine (PAM) → positive LPA  |  Octopamine (OA) → negative LPA
      const daContribution  = (peakDopamine - 0.05) * 16.0;   // max ~+14 LPA at DA=0.95
      const octContribution = (peakOctopamine - 0.05) * 7.0;   // max ~-6.6 LPA at Oct=0.95
      
      // Ring attractor bump sharpness = answer coherence/clarity
      const coherenceBonus = ringCoherence * 6.0;              // up to +3 LPA

      // Firing rate bonus: fast, sustained spiking = deep engagement
      const firingBonus = Math.min(2.0, firingRate * 0.08);

      // Begging: octopamine dominates, no reward allowed
      if (stimulus.isBegging) {
        deltaLPA = -(octContribution * 0.8) - 2.0;
      } else {
        deltaLPA = daContribution - octContribution + coherenceBonus + firingBonus;
      }
    }

    // Clamp to biological range
    deltaLPA = Math.max(-20.0, Math.min(15.0, deltaLPA));
    deltaLPA = Number(deltaLPA.toFixed(2));

    // ── Generate critique from neural state ────────────────────────────────
    const critique = this._generateCritique(stimulus, {
      deltaLPA, peakDopamine, peakOctopamine,
      giantFiberFired, ringCoherence, firingRate
    });

    return {
      deltaLPA,
      dopamineLevel: Number(peakDopamine.toFixed(3)),
      octopamineLevel: Number(peakOctopamine.toFixed(3)),
      giantFiberTriggered: giantFiberFired,
      ringCoherence: Number(ringCoherence.toFixed(3)),
      firingRate: Number(firingRate.toFixed(1)),
      stressStimulus: stimulus.S_stress,
      rewardStimulus: stimulus.S_reward,
      aversiveCurrent: giantFiberFired ? 55.0 : (stimulus.S_stress * 18.0),
      circuitLabel: stimulus.label || 'EVALUATED',
      critique,
      isLLM: false,
      isFlyBrain: true,
      finalState
    };
  }

  /**
   * Full evaluation: text → stimulus → fly brain burst → LPA verdict
   */
  judge(question, answer, currentLPA) {
    this.currentLPA = currentLPA;
    const stimulus = this.answerToStimulus(answer);
    const verdict = this.runFlyBrainBurst(stimulus);

    // Update internal LPA
    this.currentLPA = Math.max(1.2, Math.min(180.0, currentLPA + verdict.deltaLPA));

    return {
      ...verdict,
      newLPA: this.currentLPA,
      tier: this.getTier(this.currentLPA),
      delta: verdict.deltaLPA,
    };
  }

  /**
   * Generate a biologically grounded critique string
   * from the neural readout — no LLM needed for this part.
   */
  _generateCritique(stimulus, neural) {
    const { deltaLPA, peakDopamine, peakOctopamine, giantFiberFired, ringCoherence } = neural;
    const label = stimulus.label;

    if (giantFiberFired && stimulus.nonTech) {
      return `Drosophila escape circuit activated. Non-technical profile detected — your connectome contribution is classified as background noise. Mushroom Body shows zero engram formation. Reassigned to Chai Intern protocol.`;
    }
    if (giantFiberFired && stimulus.isFatal) {
      return `Giant Fiber escape reflex triggered at full amplitude. Fatal anti-pattern recognized by olfactory circuit and routed directly to aversive valence neurons. Dr. Drosophila's thoracic ganglion recoils. ${deltaLPA.toFixed(1)} LPA incinerated.`;
    }
    if (stimulus.isBegging) {
      return `Octopamine neurons saturating at ${(peakOctopamine*100).toFixed(0)}%. Pity appeals activate the aversive learning pathway, not the reward pathway. Mushroom Body stores this as a negative associative memory. Compensation reflects circuit output.`;
    }

    if (label === 'EXPERT') {
      return `Dopamine PAM neurons surged to ${(peakDopamine*100).toFixed(0)}% activation — ${stimulus.deepHits} elite architectural concepts detected by antennal lobe glomeruli. Ring attractor coherence ${(ringCoherence*100).toFixed(0)}% indicates well-formed cognitive heading. Reward circuit approves.`;
    }
    if (label === 'COMPETENT') {
      return `Moderate dopaminergic response (${(peakDopamine*100).toFixed(0)}%) — ${stimulus.deepHits} advanced concept(s) detected. Octopamine at ${(peakOctopamine*100).toFixed(0)}% suggests residual uncertainty. Ring attractor maintained heading with ${(ringCoherence*100).toFixed(0)}% coherence. Compensation adjusted accordingly.`;
    }
    if (label === 'ADEQUATE') {
      return `Weak dopamine signal (${(peakDopamine*100).toFixed(0)}%). Antennal lobe detected ${stimulus.midHits} mid-tier technology buzzwords — sufficient to sustain membrane potential but insufficient for reward pathway activation. Octopamine dominates at ${(peakOctopamine*100).toFixed(0)}%.`;
    }
    // WEAK
    return `No reward circuit activation. Dopamine stayed at baseline (${(peakDopamine*100).toFixed(0)}%). Octopamine neurons at ${(peakOctopamine*100).toFixed(0)}% — the fly's stress response to content-free responses. Ring attractor dispersed. Valence: aversive.`;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ConnectomeJudge };
}
