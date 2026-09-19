/**
 * Dynamic LPA Compensation & Real-Time Interview Rubric Engine
 * Calculates market salary (LPA in Lakhs Per Annum), maps candidate
 * answers to Indian Tech tiers, and feeds live perturbations into the biophysics engine.
 */

const TIERS = [
  { max: 3.0,  tierName: "Unpaid Chai Intern", description: "Prohibited from git commit; fetches ginger tea for senior staff" },
  { max: 5.5,  tierName: "Mass Recruiter Service Bench", description: "3-year bond trainee editing spreadsheet macros in darkness" },
  { max: 12.0, tierName: "Junior Startup Dev", description: "Fixing Jira CSS and webhook race conditions" },
  { max: 25.0, tierName: "Mid Product Tier", description: "Solid backend / distributed systems engineer at profitable unicorn" },
  { max: 48.0, tierName: "Tier-1 FinTech Lead", description: "High-throughput payment gateway & idempotency master" },
  { max: 95.0, tierName: "FAANG Staff Architect", description: "Attends meetings, rejects PRs, accumulates generational equity" },
  { max: 200.0, tierName: "HFT Quant / Connectome Overlord", description: "Sub-microsecond FPGA wizard transcending Indian tech compensation" }
];

// Anti-patterns that trigger Giant Fiber escape alarm
const FATAL_PATTERNS = [
  /plaintext password/i,
  /store.*password.*plain/i,
  /try.*catch.*whole/i,
  /try.*catch.*(db|database)/i,
  /(o\(n!\)|factorial time complexity|\bo\(n factorial\))/i,
  /(while\s*\(.*?\)\s*\{[^}]*sleep|for\s*\(.*?\)\s*\{[^}]*sleep|sleep\(\d+\).*instead of.*(await|wait|event|mutex|lock|polling|promise)|busy.*wait|thread\.sleep.*mutex)/i,
  /drop table/i,
  /global variable.*auth/i,
  /no need for indexing/i,
  /disable security/i,
  /eval\(/i
];

// Non-technical admissions (immediate disqualification to Unpaid Chai Intern)
const NON_TECH_PATTERNS = [
  /not (a|an)?\s*(tech|technical|engineer|developer|coder|programmer)/i,
  /don'?t know (how to )?code/i,
  /don'?t know (programming|coding|tech)/i,
  /no (idea|clue) (what|about)/i,
  /from (arts|commerce|humanities|sales|marketing|finance|hr)/i,
  /never done (coding|programming|tech)/i,
  /zero technical/i,
  /not my field/i
];

// Begging / Pity appeals / Emotional manipulation (heavy penalty)
const BEGGING_PATTERNS = [
  /give (me )?(a )?(higher|more|good|decent) (package|ctc|salary|lpa)/i,
  /i am (poor|broke|struggling|needy)/i,
  /please (hire|take|select) me/i,
  /need (the )?money/i,
  /increase (my )?(lpa|ctc|salary|package)/i,
  /bhai (please|plz)/i,
  /have mercy/i,
  /pity on me/i
];

// High-value distributed systems & architectural concepts
const HIGH_TECH_PATTERNS = [
  /raft/i,
  /paxos/i,
  /zab\b/i,
  /consensus/i,
  /linearizab/i,
  /serializab/i,
  /idempotent|idempotency/i,
  /write-ahead log|\bwal\b/i,
  /token bucket|leaky bucket/i,
  /bloom filter/i,
  /consistent hashing/i,
  /cap theorem/i,
  /eventual consistency/i,
  /lsm tree|b-tree|b\+ tree/i,
  /distributed lock/i,
  /backpressure/i,
  /deadlock prevention/i,
  /optimistic locking|\bmvcc\b/i,
  /vector clock|lamport timestamp/i,
  /circuit breaker/i,
  /sstable|memtable|compaction/i,
  /write amplification/i,
  /two-phase commit|\b2pc\b/i
];

// Mid-tier supporting technical keywords
const MID_TECH_PATTERNS = [
  /partition|sharding|shard/i,
  /replicat/i,
  /failover|quorum/i,
  /leader election/i,
  /cache|redis/i,
  /database|index/i,
  /latency|throughput/i,
  /heartbeat/i,
  /retry.*backoff|jitter/i,
  /dead letter queue|\bkafka\b/i,
  /acid\b/i,
  /concurrency|race condition/i
];

class LPAEngine {
  constructor(initialLPA = 15.0) {
    this.currentLPA = initialLPA;
    this.history = [];
  }

  getCurrentLPA() {
    return Number(this.currentLPA.toFixed(2));
  }

  getTier() {
    for (const t of TIERS) {
      if (this.currentLPA <= t.max) return t;
    }
    return TIERS[TIERS.length - 1];
  }

  /**
   * Fast real-time interim analysis while candidate is actively speaking.
   */
  analyzeInterim(interimText) {
    let interimStress = 0.0;
    let interimReward = 0.0;
    let detectedFatal = false;
    const lower = (interimText || '').toLowerCase();

    for (const pattern of NON_TECH_PATTERNS) {
      if (pattern.test(lower)) {
        return { interimStress: 1.0, interimReward: 0.0, detectedFatal: true };
      }
    }

    for (const pattern of BEGGING_PATTERNS) {
      if (pattern.test(lower)) {
        return { interimStress: 0.85, interimReward: 0.0, detectedFatal: false };
      }
    }

    for (const pattern of FATAL_PATTERNS) {
      if (pattern.test(lower)) {
        interimStress = 1.0;
        detectedFatal = true;
        break;
      }
    }

    if (!detectedFatal) {
      for (const pattern of HIGH_TECH_PATTERNS) {
        if (pattern.test(lower)) {
          interimReward += 0.6;
        }
      }
      for (const pattern of MID_TECH_PATTERNS) {
        if (pattern.test(lower)) {
          interimReward += 0.25;
        }
      }
      interimReward = Math.min(1.0, interimReward);
    }

    return {
      interimStress,
      interimReward,
      detectedFatal
    };
  }

  /**
   * Evaluates text content thoroughly for technical depth and disqualifying patterns.
   */
  analyzeContent(text) {
    const lower = (text || '').toLowerCase();

    let hasNonTech = false;
    for (const p of NON_TECH_PATTERNS) {
      if (p.test(lower)) { hasNonTech = true; break; }
    }

    let hasBegging = false;
    for (const p of BEGGING_PATTERNS) {
      if (p.test(lower)) { hasBegging = true; break; }
    }

    let hasFatalBug = false;
    for (const p of FATAL_PATTERNS) {
      if (p.test(lower)) { hasFatalBug = true; break; }
    }

    if (hasNonTech || hasBegging) {
      return {
        technicalDepth: 0.0,
        coherence: 0.1,
        hasFatalBug,
        hasBegging,
        hasNonTech,
        text
      };
    }

    // Calculate actual technical depth from architectural vocabulary
    let techScore = 0;
    for (const p of HIGH_TECH_PATTERNS) {
      if (p.test(lower)) techScore += 0.32;
    }
    for (const p of MID_TECH_PATTERNS) {
      if (p.test(lower)) techScore += 0.12;
    }

    // Coherence / architectural reasoning score
    let coherence = 0.25;
    if (lower.length > 25) coherence += 0.2;
    if (/because|in order to|prevents?|mitigates?|trade-?offs?|guarantees?|ensures?|under network partition/i.test(lower)) {
      coherence += 0.35;
    }
    coherence = Math.min(1.0, coherence);

    const technicalDepth = Math.min(1.0, techScore);

    return {
      technicalDepth,
      coherence,
      hasFatalBug,
      hasBegging: false,
      hasNonTech: false,
      text
    };
  }

  /**
   * Authoritative macro evaluation after candidate finishes speech or submits code.
   */
  evaluateResponse(responseAnalysis) {
    const { technicalDepth, coherence, hasFatalBug, hasBegging, hasNonTech, text } = responseAnalysis;
    let delta = 0;
    let stressStimulus = 0;
    let rewardStimulus = 0;
    let giantFiberTriggered = false;
    let critique = "";

    // 1. Non-technical admission (Immediate disqualification down to Unpaid Chai Intern)
    let nonTechDetected = hasNonTech;
    if (!nonTechDetected && text) {
      for (const p of NON_TECH_PATTERNS) {
        if (p.test(text)) { nonTechDetected = true; break; }
      }
    }

    if (nonTechDetected) {
      // Force drop down to 2.4 LPA (Unpaid Chai Intern)
      delta = -(Math.max(5.0, this.currentLPA - 2.4));
      stressStimulus = 1.0;
      giantFiberTriggered = true;
      critique = "🚨 NON-TECHNICAL ADMISSION: Candidate confessed lack of engineering background. Immediate demotion to Unpaid Chai Intern. Please vacate the connectome terminal.";
    }
    // 2. Begging / Pity appeals
    else if (hasBegging || (text && BEGGING_PATTERNS.some(p => p.test(text)))) {
      delta = -8.5; // Deterministic penalty
      stressStimulus = 0.9;
      critique = "⚠️ EMOTIONAL MANIPULATION: Pity appeals and begging detected ('I am poor / higher package'). Compensation is strictly a function of distributed systems mastery, not sympathy. Massive salary penalty.";
    }
    // 3. Fatal anti-patterns & bugs
    else if (hasFatalBug || (text && FATAL_PATTERNS.some(p => p.test(text)))) {
      delta = -12.5; // Deterministic penalty
      stressStimulus = 1.0;
      giantFiberTriggered = true;
      critique = "💥 CRITICAL BLUNDER: Candidate proposed an anti-pattern or security catastrophe. Giant Fiber escape reflex engaged!";
    }
    // 4. God-tier technical answer
    else if (technicalDepth >= 0.75 && coherence >= 0.65) {
      delta = +(4.0 + technicalDepth * 5.5);
      rewardStimulus = 0.95;
      critique = "🌟 GOD-TIER ANSWER: Flawless systems architecture and mathematical precision. Dopamine surge detected.";
    }
    // 5. Acceptable answer with genuine technical concepts
    else if (technicalDepth >= 0.35) {
      delta = +(1.5 + technicalDepth * 2.5);
      rewardStimulus = 0.45;
      stressStimulus = 0.2;
      critique = "🟡 ACCEPTABLE: Decent understanding, but missed edge-case handling.";
    }
    // 6. Vacuous non-technical rambling
    else {
      delta = -(4.5 + (1.0 - (coherence || 0.4)) * 3.5);
      stressStimulus = 0.75;
      critique = "⚠️ VACUOUS RAMBLING: Candidate lacks concrete technical substance. Salary penalized.";
    }

    this.currentLPA = Math.max(1.2, Math.min(180.0, this.currentLPA + delta));
    const tier = this.getTier();

    const record = {
      timestamp: Date.now(),
      inputSnippet: text ? text.slice(0, 60) + (text.length > 60 ? "..." : "") : "",
      delta: Number(delta.toFixed(2)),
      newLPA: this.getCurrentLPA(),
      tier: tier.tierName,
      critique,
      giantFiberTriggered
    };

    this.history.push(record);

    return {
      newLPA: this.getCurrentLPA(),
      delta: Number(delta.toFixed(2)),
      tier,
      critique,
      giantFiberTriggered,
      stressStimulus,
      rewardStimulus,
      aversiveCurrent: giantFiberTriggered ? 55.0 : (stressStimulus * 15.0)
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LPAEngine, TIERS, NON_TECH_PATTERNS, BEGGING_PATTERNS };
}
if (typeof window !== 'undefined') {
  window.LPAEngine = LPAEngine;
  window.TIERS = TIERS;
}
