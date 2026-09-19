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

const { LPAEngine } = require('./lib/lpa-engine');
const { GeminiJudge } = require('./lib/gemini-judge');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Standard technical interview question suite (used as baseline / fallback)
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

io.on('connection', (socket) => {
  console.log(`[Socket.io] Candidate connected: ${socket.id}`);

  // Isolated per-candidate interview session (Fixes multi-tenancy singleton bug)
  const lpaEngine = new LPAEngine(15.0);
  const geminiJudge = new GeminiJudge(process.env.GEMINI_API_KEY || null);
  let currentQuestion = QUESTIONS[0];
  let lastEvaluationTime = 0;

  // Send initial state & first question to this specific candidate
  socket.emit('init', {
    currentLPA: lpaEngine.getCurrentLPA(),
    tier: lpaEngine.getTier(),
    question: currentQuestion,
    questionIndex: 0,
    totalQuestions: QUESTIONS.length,
    llmActive: geminiJudge.hasApiKey()
  });

  // Client dynamically configures Google AI Studio API key
  socket.on('set_gemini_key', (data) => {
    const key = data && data.key ? String(data.key).trim() : null;
    geminiJudge.setApiKey(key);
    console.log(`[Socket.io] Gemini API key updated for ${socket.id}: ${geminiJudge.hasApiKey() ? 'ACTIVE' : 'INACTIVE'}`);
    socket.emit('llm_status', {
      active: geminiJudge.hasApiKey(),
      model: geminiJudge.model
    });
  });

  // Handle interim candidate speech (fast path with length guard)
  socket.on('candidate_interim', (data) => {
    const text = (data && data.text ? String(data.text).slice(0, 1000) : '');
    const interimAnalysis = lpaEngine.analyzeInterim(text);
    socket.emit('interim_feedback', interimAnalysis);
  });

  // Handle final candidate response (hybrid: Gemini 1.5 Flash -> fallback LPAEngine)
  socket.on('candidate_response', async (data) => {
    const now = Date.now();
    if (now - lastEvaluationTime < 250) {
      return; // Debounce rapid spam submissions
    }
    lastEvaluationTime = now;

    // Strict input length sanitization (max 4000 characters)
    const text = (data && data.text ? String(data.text).slice(0, 4000) : '');
    const questionText = currentQuestion ? currentQuestion.prompt : QUESTIONS[0].prompt;

    let evalResult = null;
    let nextQuestion = null;

    // 1. Try Live Gemini Neural Judge if configured
    if (geminiJudge.hasApiKey()) {
      const llmEval = await geminiJudge.evaluateCandidateAnswer(questionText, text, lpaEngine.getCurrentLPA());
      if (llmEval) {
        lpaEngine.currentLPA = Math.max(1.2, Math.min(180.0, lpaEngine.currentLPA + llmEval.deltaLPA));
        const tier = lpaEngine.getTier();

        evalResult = {
          newLPA: lpaEngine.getCurrentLPA(),
          delta: llmEval.deltaLPA,
          tier,
          critique: llmEval.critique,
          giantFiberTriggered: llmEval.giantFiberTriggered,
          stressStimulus: llmEval.octopamineStress,
          rewardStimulus: llmEval.dopamineReward,
          aversiveCurrent: llmEval.giantFiberTriggered ? 55.0 : (llmEval.octopamineStress * 15.0),
          isLLM: true
        };

        // Dynamic conversational follow-up question
        nextQuestion = {
          id: Date.now(),
          topic: llmEval.followUpTopic || "Architectural Defense",
          prompt: llmEval.followUpQuestion
        };
        currentQuestion = nextQuestion;
      }
    }

    // 2. Zero-break heuristic fallback if LLM is unconfigured or failed
    if (!evalResult) {
      const analysis = lpaEngine.analyzeContent(text);
      evalResult = lpaEngine.evaluateResponse(analysis);
      evalResult.isLLM = false;

      const questionIndex = typeof data?.questionIndex === 'number' ? data.questionIndex : 0;
      const nextIndex = (questionIndex + 1) % QUESTIONS.length;
      nextQuestion = QUESTIONS[nextIndex];
      currentQuestion = nextQuestion;
    }

    const questionIndex = typeof data?.questionIndex === 'number' ? data.questionIndex : 0;

    socket.emit('evaluation_result', {
      evaluation: evalResult,
      nextQuestion,
      questionIndex: questionIndex + 1
    });
  });

  socket.on('reset_interview', () => {
    lpaEngine.currentLPA = 15.0;
    lpaEngine.history = [];
    geminiJudge.resetHistory();
    currentQuestion = QUESTIONS[0];
    socket.emit('init', {
      currentLPA: lpaEngine.getCurrentLPA(),
      tier: lpaEngine.getTier(),
      question: QUESTIONS[0],
      questionIndex: 0,
      totalQuestions: QUESTIONS.length,
      llmActive: geminiJudge.hasApiKey()
    });
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Candidate disconnected: ${socket.id}`);
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`[FlyWire HR] Server running at http://localhost:${PORT}`);
  });
}

module.exports = { app, server, io, QUESTIONS };
