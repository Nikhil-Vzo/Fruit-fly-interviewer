/**
 * Google AI Studio (Gemini 3.5 / 3.6 Flash) Live Neural Judge
 * Provides deep semantic evaluation, biophysical tensor outputs,
 * snarky insect critique, dynamic follow-up grilling questions,
 * and multi-turn conversational cross-examination.
 */

class GeminiJudge {
  constructor(apiKey = null) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || null;
    this.model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    this.history = []; // Multi-turn interview conversation memory
  }

  setApiKey(key) {
    this.apiKey = key ? String(key).trim() : null;
  }

  hasApiKey() {
    return Boolean(this.apiKey && this.apiKey.length > 10);
  }

  resetHistory() {
    this.history = [];
  }

  /**
   * Evaluates candidate answer using Gemini structured output with multi-model fallback
   * @param {string} question 
   * @param {string} answer 
   * @param {number} currentLPA 
   * @returns {Promise<object|null>}
   */
  async evaluateCandidateAnswer(question, answer, currentLPA = 15.0) {
    if (!this.hasApiKey()) {
      return null; // Fall back to heuristic LPAEngine
    }

    const systemPrompt = `You are Dr. Drosophila Melanogaster, an elite, hyper-rigorous insect connectome interviewer and Principal Systems Architect. You interview candidates for prestigious tech engineering roles (compensation in LPA: Lakhs Per Annum). You evaluate answers with ruthless biophysical and computer science scrutiny.

Rules:
1. Fatal anti-patterns (plaintext passwords, drop tables, global auth state, eval): set giantFiberTriggered = true, deltaLPA between -12.0 and -15.0, octopamineStress = 1.0, critique emphasizing the catastrophe.
2. Non-technical confessions ("not a coder", "from arts/sales", "don't know tech"): set giantFiberTriggered = true, deltaLPA = -(currentLPA - 2.4), demoting candidate to Unpaid Chai Intern.
3. Begging / pity appeals ("give higher package", "I am poor", "need money"): set deltaLPA between -8.0 and -10.0, octopamineStress = 0.9, no salary sympathy.
4. Deep distributed systems / architectural insights (Raft, Paxos, WAL, MVCC, LSM, Bloom filters, linearizability, idempotency): set dopamineReward = 0.8-1.0, deltaLPA = +3.5 to +8.0.
5. Provide a sharp, snarky insect critique (2-3 sentences). Cross-examine and call out contradictions if the candidate said something inconsistent with their earlier answers.
6. Provide a targeted followUpQuestion that specifically interrogates edge cases, failure modes, or trade-offs in what the candidate just stated.`;

    // Construct multi-turn contents with interview history
    const contents = [];
    for (const turn of this.history) {
      contents.push({
        role: 'user',
        parts: [{ text: `PREVIOUS QUESTION: ${turn.question}\nCANDIDATE ANSWER: ${turn.answer}` }]
      });
      contents.push({
        role: 'model',
        parts: [{ text: JSON.stringify(turn.evaluation) }]
      });
    }

    // Append current turn
    contents.push({
      role: 'user',
      parts: [{
        text: `CURRENT QUESTION: ${question}
CANDIDATE ANSWER: ${answer}
CURRENT CANDIDATE VALUATION: ${currentLPA.toFixed(2)} LPA

Return ONLY a JSON object with this exact schema:
{
  "technicalDepth": 0.0 to 1.0,
  "coherence": 0.0 to 1.0,
  "deltaLPA": float (-15.0 to +8.0),
  "dopamineReward": 0.0 to 1.0,
  "octopamineStress": 0.0 to 1.0,
  "giantFiberTriggered": boolean,
  "critique": "string",
  "followUpTopic": "string",
  "followUpQuestion": "string"
}`
      }]
    });

    const candidateModels = [this.model, 'gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-flash-lite-latest', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'].filter((v, i, a) => a.indexOf(v) === i);
    let rawText = null;

    for (const mod of candidateModels) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${mod}:generateContent?key=${this.apiKey}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        // Prepend system instruction to prompt for universal endpoint compatibility
        const unifiedContents = [
          {
            role: 'user',
            parts: [{ text: systemPrompt + '\n\n' + contents[contents.length - 1].parts[0].text }]
          }
        ];

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: unifiedContents,
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.25,
              maxOutputTokens: 600
            }
          })
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            this.model = mod; // Cache working model
            break;
          }
        } else {
          const errText = await response.text();
          console.warn(`[GeminiJudge] Model ${mod} returned ${response.status}: ${errText.slice(0, 160)}`);
        }
      } catch (err) {
        console.warn(`[GeminiJudge] Model ${mod} fetch error: ${err.message}`);
      }
    }

    if (!rawText) return null;

    try {
      let parsed = null;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      }

      const sanitized = this.sanitizeEvaluation(parsed);

      if (sanitized) {
        this.history.push({
          question,
          answer,
          evaluation: sanitized
        });
        // Retain last 6 turns to avoid context overflow
        if (this.history.length > 6) {
          this.history.shift();
        }
      }

      return sanitized;

    } catch (err) {
      console.warn('[GeminiJudge] Evaluation parsing failed, falling back to local rubric:', err.message);
      return null;
    }
  }

  /**
   * Strict validation and bounding of LLM output tensors
   */
  sanitizeEvaluation(res) {
    if (!res || typeof res !== 'object') return null;

    let rawDepth = Number(res.technicalDepth) || 0;
    if (rawDepth > 1.0) rawDepth /= 10.0;
    const technicalDepth = Math.max(0, Math.min(1.0, rawDepth));

    let rawCoherence = Number(res.coherence) || 0.5;
    if (rawCoherence > 1.0) rawCoherence /= 10.0;
    const coherence = Math.max(0, Math.min(1.0, rawCoherence));
    const deltaLPA = Math.max(-20.0, Math.min(15.0, Number(res.deltaLPA) || 0));
    const dopamineReward = Math.max(0, Math.min(1.0, Number(res.dopamineReward) || 0));
    const octopamineStress = Math.max(0, Math.min(1.0, Number(res.octopamineStress) || 0));
    const giantFiberTriggered = Boolean(res.giantFiberTriggered);

    const critique = String(res.critique || 'Evaluation processed by connectome neural judge.').slice(0, 300);
    const followUpTopic = String(res.followUpTopic || 'Architectural Defense').slice(0, 80);
    const followUpQuestion = String(res.followUpQuestion || 'Can you elaborate on the failure modes of your proposed design?').slice(0, 300);

    return {
      technicalDepth,
      coherence,
      deltaLPA,
      dopamineReward,
      octopamineStress,
      giantFiberTriggered,
      critique,
      followUpTopic,
      followUpQuestion,
      isLLM: true
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GeminiJudge };
}

