const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

// Native .env parser (zero external dependencies)
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  const envLines = fs.readFileSync(envFile, 'utf8').split('\n');
  for (const line of envLines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const k = trimmed.slice(0, eqIdx).trim();
        const v = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[k]) process.env[k] = v;
      }
    }
  }
  console.log('[FlyWire HR] Loaded environment from .env');
}

const { ConnectomeJudge } = require('./lib/connectome-judge');
const { GeminiJudge } = require('./lib/gemini-judge');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Technical interview question suite
const QUESTIONS = [
  {
    id: 1,
    topic: "Distributed Systems & Consistency",
    prompt: "Candidate, explain how you would design a distributed locking service to prevent race conditions across microservices without risking split-brain under network partitions."
  },
  {
    id: 2,
    topic: "Concurrency & Financial Transaction Safety",
    prompt: "How do you guarantee idempotency and prevent double-spending in a high-frequency payment gateway when downstream webhook timeouts occur?"
  },
  {
    id: 3,
    topic: "Database Internals & Storage Engines",
    prompt: "Compare B-Tree indexing versus Log-Structured Merge (LSM) trees for a write-heavy analytics workload. Explain write amplification and compaction trade-offs."
  },
  {
    id: 4,
    topic: "Fault Tolerance & Consensus",
    prompt: "Walk me through how Raft handles split votes and recovers log consistency after an uncommitted leader crashes midway through a replication cycle."
  }
];

/**
 * Ask Gemini ONLY for a follow-up question — NOT for scoring.
 * The fly brain already decided the LPA. Gemini just writes the next question.
 */
async function getGeminiFollowUp(apiKey, model, question, answer, verdict) {
  if (!apiKey || apiKey.length < 10) return null;
  try {
    const prompt = `You are Dr. Drosophila, an elite insect connectome interviewer. 
The candidate just answered this question: "${question}"
Their answer: "${answer.slice(0, 800)}"
The fly brain evaluated their response as: ${verdict.circuitLabel} (LPA delta: ${verdict.deltaLPA})
Neural critique: ${verdict.critique}

Write a sharp, targeted follow-up question (1-2 sentences) that drills into the specific weakness or assumption in their answer. Be snarky but technical. Do NOT evaluate or score — just ask the next question.
Return ONLY the question text, no JSON, no labels.`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 200 }
      })
    });
    clearTimeout(timeout);
    if (response.ok) {
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    }
  } catch (_) { /* silent */ }
  return null;
}

io.on('connection', (socket) => {
  console.log(`[Socket.io] Candidate connected: ${socket.id}`);

  // Per-candidate isolated sessions
  const connectomeJudge = new ConnectomeJudge();
  const geminiJudge = new GeminiJudge(process.env.GEMINI_API_KEY || null);
  let currentQuestion = QUESTIONS[0];
  let lastEvaluationTime = 0;

  socket.emit('init', {
    currentLPA: connectomeJudge.getCurrentLPA(),
    tier: connectomeJudge.getTier(),
    question: currentQuestion,
    questionIndex: 0,
    totalQuestions: QUESTIONS.length,
    llmActive: geminiJudge.hasApiKey(),
    flyBrainActive: true, // always true — the connectome is always the judge
  });

  socket.on('set_gemini_key', (data) => {
    const key = data && data.key ? String(data.key).trim() : null;
    geminiJudge.setApiKey(key);
    socket.emit('llm_status', {
      active: geminiJudge.hasApiKey(),
      model: geminiJudge.model,
      role: 'follow-up questions only — fly brain decides LPA'
    });
  });

  // Interim analysis: fast path, pure stimulus preview
  socket.on('candidate_interim', (data) => {
    const text = (data && data.text ? String(data.text).slice(0, 1000) : '');
    const stimulus = connectomeJudge.answerToStimulus(text);
    socket.emit('interim_feedback', {
      detectedFatal: stimulus.forceGiantFiber,
      stimulusLabel: stimulus.label || 'ANALYZING',
      interimReward: stimulus.S_reward,
      interimStress: stimulus.S_stress,
    });
  });

  // Final answer: connectome judges, Gemini only writes follow-up
  socket.on('candidate_response', async (data) => {
    const now = Date.now();
    if (now - lastEvaluationTime < 250) return; // debounce
    lastEvaluationTime = now;

    const text = (data && data.text ? String(data.text).slice(0, 4000) : '');
    const questionText = currentQuestion ? currentQuestion.prompt : QUESTIONS[0].prompt;
    const questionIndex = typeof data?.questionIndex === 'number' ? data.questionIndex : 0;

    // ── 1. FLY BRAIN DECIDES LPA ──────────────────────────────────────────
    const verdict = connectomeJudge.judge(questionText, text, connectomeJudge.currentLPA);

    const evalResult = {
      newLPA: verdict.newLPA,
      delta: verdict.deltaLPA,
      tier: verdict.tier,
      critique: verdict.critique,
      giantFiberTriggered: verdict.giantFiberTriggered,
      stressStimulus: verdict.stressStimulus,
      rewardStimulus: verdict.rewardStimulus,
      aversiveCurrent: verdict.aversiveCurrent,
      dopamineLevel: verdict.dopamineLevel,
      octopamineLevel: verdict.octopamineLevel,
      ringCoherence: verdict.ringCoherence,
      firingRate: verdict.firingRate,
      circuitLabel: verdict.circuitLabel,
      isFlyBrain: true,
      isLLM: false,
    };

    // ── 2. GEMINI WRITES FOLLOW-UP QUESTION (scoring irrelevant) ──────────
    let followUpPrompt = null;
    if (geminiJudge.hasApiKey()) {
      followUpPrompt = await getGeminiFollowUp(
        geminiJudge.apiKey, geminiJudge.model,
        questionText, text, verdict
      );
    }

    // Fallback: circuit-derived follow-up
    const nextIndex = (questionIndex + 1) % QUESTIONS.length;
    let nextQuestion;
    if (followUpPrompt) {
      nextQuestion = {
        id: Date.now(),
        topic: `${verdict.circuitLabel} — Circuit Follow-Up`,
        prompt: followUpPrompt
      };
    } else {
      nextQuestion = QUESTIONS[nextIndex];
    }
    currentQuestion = nextQuestion;

    socket.emit('evaluation_result', {
      evaluation: evalResult,
      nextQuestion,
      questionIndex: questionIndex + 1
    });
  });

  socket.on('reset_interview', () => {
    connectomeJudge.currentLPA = 15.0;
    currentQuestion = QUESTIONS[0];
    socket.emit('init', {
      currentLPA: connectomeJudge.getCurrentLPA(),
      tier: connectomeJudge.getTier(),
      question: QUESTIONS[0],
      questionIndex: 0,
      totalQuestions: QUESTIONS.length,
      llmActive: geminiJudge.hasApiKey(),
      flyBrainActive: true,
    });
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Candidate disconnected: ${socket.id}`);
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`[FlyWire HR] Server running at http://localhost:${PORT}`);
    console.log(`[FlyWire HR] Fly brain judge: ACTIVE (ConnectomeJudge)`);
    console.log(`[FlyWire HR] Gemini role: follow-up questions only`);
  });
}

module.exports = { app, server, io, QUESTIONS };
