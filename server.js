const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { LPAEngine } = require('./lib/lpa-engine');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Standard technical interview question suite
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

const lpaEngine = new LPAEngine(15.0);

io.on('connection', (socket) => {
  console.log(`[Socket.io] Candidate connected: ${socket.id}`);

  // Send initial state & first question
  socket.emit('init', {
    currentLPA: lpaEngine.getCurrentLPA(),
    tier: lpaEngine.getTier(),
    question: QUESTIONS[0],
    questionIndex: 0,
    totalQuestions: QUESTIONS.length
  });

  // Handle interim candidate speech (fast path)
  socket.on('candidate_interim', (data) => {
    const text = data.text || '';
    const interimAnalysis = lpaEngine.analyzeInterim(text);
    socket.emit('interim_feedback', interimAnalysis);
  });

  // Handle final candidate response (authoritative evaluation)
  socket.on('candidate_response', (data) => {
    const text = data.text || '';
    const questionIndex = data.questionIndex || 0;

    // Use intelligent concept & rubric analysis (no naive length checks)
    const analysis = lpaEngine.analyzeContent(text);
    const evalResult = lpaEngine.evaluateResponse(analysis);

    const nextIndex = (questionIndex + 1) % QUESTIONS.length;

    socket.emit('evaluation_result', {
      evaluation: evalResult,
      nextQuestion: QUESTIONS[nextIndex],
      questionIndex: nextIndex
    });
  });

  socket.on('reset_interview', () => {
    lpaEngine.currentLPA = 15.0;
    lpaEngine.history = [];
    socket.emit('init', {
      currentLPA: lpaEngine.getCurrentLPA(),
      tier: lpaEngine.getTier(),
      question: QUESTIONS[0],
      questionIndex: 0,
      totalQuestions: QUESTIONS.length
    });
  });
});

server.listen(PORT, () => {
  console.log(`[FlyWire HR] Server running at http://localhost:${PORT}`);
});
