/**
 * Google AI Studio (Gemini 1.5 Flash) Live Neural Judge
 * Provides deep semantic evaluation, biophysical tensor outputs,
 * snarky insect critique, and dynamic follow-up grilling questions.
 */

class GeminiJudge {
  constructor(apiKey = null) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || null;
    this.model = 'gemini-1.5-flash';
  }

  setApiKey(key) {
    this.apiKey = key ? String(key).trim() : null;
  }

  hasApiKey() {
    return Boolean(this.apiKey && this.apiKey.length > 10);
  }

  /**
   * Evaluates candidate answer using Gemini 1.5 Flash structured output
   * @param {string} question Current interview question
   * @param {string} answer Candidate's spoken/submitted text
   * @param {number} currentLPA Candidate's current salary in LPA
   * @returns {Promise<Object|null>} Structured evaluation or null on failure
   */
  async evaluateCandidateAnswer(question, answer, currentLPA = 15.0) {
    if (!this.hasApiKey()) {
      return null; // Fall back to heuristic LPAEngine
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const systemPrompt = `You are Dr. Drosophila Melanogaster, an elite, hyper-rigorous insect connectome interviewer and Principal Systems Architect. You interview candidates for prestigious tech engineering roles (compensation in LPA: Lakhs Per Annum). You evaluate answers with ruthless biophysical and computer science scrutiny.

Rules:
1. Fatal anti-patterns (plaintext passwords, drop tables, global auth state, eval): set giantFiberTriggered = true, deltaLPA between -12.0 and -15.0, octopamineStress = 1.0, critique emphasizing the catastrophe.
2. Non-technical confessions ("not a coder", "from arts/sales", "don't know tech"): set giantFiberTriggered = true, deltaLPA = -(currentLPA - 2.4), demoting candidate to Unpaid Chai Intern.
3. Begging / pity appeals ("give higher package", "I am poor", "need money"): set deltaLPA between -8.0 and -10.0, octopamineStress = 0.9, no salary sympathy.
4. Deep distributed systems / architectural insights (Raft, Paxos, WAL, MVCC, LSM, Bloom filters, linearizability, idempotency): set dopamineReward = 0.8-1.0, deltaLPA = +3.5 to +8.0.
5. Provide a sharp, snarky insect critique (2-3 sentences).
6. Provide a targeted followUpQuestion that specifically interrogates edge cases, failure modes, or trade-offs in what the candidate just stated.`;

    const userPrompt = `CURRENT QUESTION: ${question}
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
}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemPrompt }]
          },
          contents: [
            {
              parts: [{ text: userPrompt }]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.25,
            maxOutputTokens: 600
          }
        })
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[GeminiJudge] API returned ${response.status}: ${errText.slice(0, 200)}`);
        return null;
      }

      const data = await response.json();
      const textContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textContent) return null;

      const parsed = JSON.parse(textContent);
      return this.sanitizeEvaluation(parsed);

    } catch (err) {
      console.warn('[GeminiJudge] Evaluation failed, falling back to local rubric:', err.message);
      return null;
    }
  }

  /**
   * Strict validation and bounding of LLM output tensors
   */
  sanitizeEvaluation(res) {
    if (!res || typeof res !== 'object') return null;

    const technicalDepth = Math.max(0, Math.min(1.0, Number(res.technicalDepth) || 0));
    const coherence = Math.max(0, Math.min(1.0, Number(res.coherence) || 0.5));
    const deltaLPA = Math.max(-20.0, Math.min(15.0, Number(res.deltaLPA) || 0));
    const dopamineReward = Math.max(0, Math.min(1.0, Number(res.dopamineReward) || 0));
    const octopamineStress = Math.max(0, Math.min(1.0, Number(res.octopamineStress) || 0));
    const giantFiberTriggered = Boolean(res.giantFiberTriggered);

    const critique = String(res.critique || 'Evaluation processed by connectome neural judge.').slice(0, 300);
    const followUpTopic = String(res.followUpTopic || 'Distributed Architecture').slice(0, 60);
    const followUpQuestion = String(res.followUpQuestion || 'Explain the fault tolerance boundaries of your architecture.').slice(0, 350);

    return {
      technicalDepth: Number(technicalDepth.toFixed(2)),
      coherence: Number(coherence.toFixed(2)),
      deltaLPA: Number(deltaLPA.toFixed(2)),
      dopamineReward: Number(dopamineReward.toFixed(2)),
      octopamineStress: Number(octopamineStress.toFixed(2)),
      giantFiberTriggered,
      critique,
      followUpTopic,
      followUpQuestion,
      isLLM: true
    };
  }
}

module.exports = { GeminiJudge };
