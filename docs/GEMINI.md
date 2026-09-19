# Gemini Integration — FlyWire HR

## Role

Gemini Flash is a **secondary, optional component**. It does exactly one thing:

> **Write the follow-up question text.**

It does NOT score answers. It does NOT decide LPA. It does NOT influence the neural simulation.

The fly brain has already decided the LPA before Gemini is even called.

---

## What Gemini Receives

After `ConnectomeJudge.judge()` returns a verdict, the server optionally calls:

```javascript
getGeminiFollowUp(apiKey, model, question, answer, verdict)
```

The prompt sent to Gemini:
```
You are Dr. Drosophila, an elite insect connectome interviewer.
The candidate just answered this question: "<question>"
Their answer: "<answer (max 800 chars)>"
The fly brain evaluated their response as: <circuitLabel> (LPA delta: <deltaLPA>)
Neural critique: <critique>

Write a sharp, targeted follow-up question (1-2 sentences) that drills into 
the specific weakness or assumption in their answer. Be snarky but technical. 
Do NOT evaluate or score — just ask the next question.
Return ONLY the question text, no JSON, no labels.
```

---

## What Happens Without a Gemini Key

The server falls back to the fixed question bank `QUESTIONS[]`:
```javascript
const QUESTIONS = [
  { topic: "Distributed Systems & Consistency",   prompt: "..." },
  { topic: "Concurrency & Financial Transaction",  prompt: "..." },
  { topic: "Database Internals & Storage Engines", prompt: "..." },
  { topic: "Fault Tolerance & Consensus",          prompt: "..." },
];
```

The interview still works exactly the same. The LPA is still decided by the fly.

---

## Configuration

```env
# .env
GEMINI_API_KEY=your_key_here    # Free key: https://aistudio.google.com/app/apikey
```

Get a free key from Google AI Studio. The `gemini-3.5-flash-lite` model is used
by default (fast, free tier). The server also attempts fallback models:

```
gemini-3.5-flash-lite → gemini-3.5-flash → gemini-3.6-flash → 
gemini-flash-lite-latest → gemini-3.1-flash-lite → gemini-2.5-flash-lite
```

---

## Runtime Key Setting

The UI exposes a modal (🔑 icon) to enter a Gemini key at runtime without restarting:

```javascript
socket.emit('set_gemini_key', { key: 'AIzaSy...' });
```

The server responds with `llm_status` event confirming active/inactive state.

---

## Timeout & Reliability

- Request timeout: **12 seconds** (hard abort via AbortController)
- On any error (network, 503, quota, timeout): **silent fallback** to question bank
- The interview never blocks on Gemini availability

---

## `lib/gemini-judge.js` vs `getGeminiFollowUp()`

`lib/gemini-judge.js` still exists and contains the `sanitizeEvaluation()` method
and multi-turn history management. These are tested in `tests/gemini.test.js`.

However, in the current server architecture, `evaluateCandidateAnswer()` from
`GeminiJudge` is **not called** for scoring. Only `getGeminiFollowUp()` (defined
inline in `server.js`) is used.

`lib/gemini-judge.js` is retained for backward compatibility with tests.
