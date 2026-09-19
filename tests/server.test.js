const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { io: Client } = require('socket.io-client');
const { LPAEngine } = require('../lib/lpa-engine');

// Create test server instance with fresh isolated socket server
function setupTestServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);

  io.on('connection', (socket) => {
    const lpaEngine = new LPAEngine(15.0);
    let lastEvaluationTime = 0;

    socket.emit('init', {
      currentLPA: lpaEngine.getCurrentLPA(),
      tier: lpaEngine.getTier()
    });

    socket.on('candidate_response', (data) => {
      const now = Date.now();
      if (now - lastEvaluationTime < 100) return;
      lastEvaluationTime = now;

      const text = (data && data.text ? String(data.text).slice(0, 4000) : '');
      const analysis = lpaEngine.analyzeContent(text);
      const evalResult = lpaEngine.evaluateResponse(analysis);

      socket.emit('evaluation_result', {
        evaluation: evalResult
      });
    });

    socket.on('reset_interview', () => {
      lpaEngine.currentLPA = 15.0;
      lpaEngine.history = [];
      socket.emit('init', {
        currentLPA: lpaEngine.getCurrentLPA(),
        tier: lpaEngine.getTier()
      });
    });
  });

  return { server, io };
}

test('Server - Multi-tenancy isolation between two simultaneous client sockets', async () => {
  const { server, io } = setupTestServer();

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const clientA = Client(`http://localhost:${port}`);
  const clientB = Client(`http://localhost:${port}`);

  try {
    await Promise.all([
      new Promise((resolve) => clientA.on('connect', resolve)),
      new Promise((resolve) => clientB.on('connect', resolve))
    ]);

    // Candidate A sends a God-tier answer
    const evalAPromise = new Promise((resolve) => clientA.once('evaluation_result', resolve));
    clientA.emit('candidate_response', {
      text: "We implement Raft consensus with persistent write-ahead logs, monotonic terms, and leader heartbeats"
    });
    const resA = await evalAPromise;
    assert.ok(resA.evaluation.newLPA > 15.0, 'Candidate A LPA should increase');

    // Candidate B sends begging / pity appeal
    const evalBPromise = new Promise((resolve) => clientB.once('evaluation_result', resolve));
    clientB.emit('candidate_response', {
      text: "please give me a higher package I am poor"
    });
    const resB = await evalBPromise;
    assert.ok(resB.evaluation.newLPA < 15.0, 'Candidate B LPA should crash');

    // Verify state isolation: Candidate A's salary was NOT polluted by Candidate B
    assert.notEqual(resA.evaluation.newLPA, resB.evaluation.newLPA, 'Candidate A and Candidate B must have isolated states');
    assert.ok(resA.evaluation.newLPA >= 19.0, 'Candidate A should be at high LPA');
    assert.ok(resB.evaluation.newLPA <= 7.0, 'Candidate B should be penalized independently');

  } finally {
    clientA.close();
    clientB.close();
    io.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Server - Handles 10,000 character payload without regex DoS or memory runaway', async () => {
  const { server, io } = setupTestServer();

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const client = Client(`http://localhost:${port}`);

  try {
    await new Promise((resolve) => client.on('connect', resolve));

    const massivePayload = "a".repeat(10000);
    const evalPromise = new Promise((resolve) => client.once('evaluation_result', resolve));
    client.emit('candidate_response', { text: massivePayload });

    const res = await evalPromise;
    assert.ok(res.evaluation, 'Must respond without crashing or timing out');
    assert.ok(res.evaluation.delta < 0, 'Vacuous repetitive payload should be penalized');

  } finally {
    client.close();
    io.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
