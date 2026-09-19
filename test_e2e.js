const fs = require('fs'), path = require('path');
const envFile = path.join(__dirname, '.env');
const envLines = fs.readFileSync(envFile, 'utf8').split('\n');
for (const line of envLines) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const k = trimmed.slice(0, eqIdx).trim();
      const v = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$$/g, '');
      if (!process.env[k]) process.env[k] = v;
    }
  }
}
const { GeminiJudge } = require('./lib/gemini-judge');
const judge = new GeminiJudge(process.env.GEMINI_API_KEY);
console.log('API key active:', judge.hasApiKey());
const q = 'Explain distributed locking across microservices.';
const a = 'Redis SETNX with Lua atomic CAS + Raft quorum leader election, Redlock N/2+1 quorum for split-brain prevention, TTL-based lease expiry.';
judge.evaluateCandidateAnswer(q, a, 15.0).then(r => {
  if (r) {
    console.log('deltaLPA:', r.deltaLPA, '| depth:', r.technicalDepth, '| coherence:', r.coherence, '| isLLM:', r.isLLM);
    console.log('critique:', r.critique);
    console.log('followUp:', r.followUpQuestion);
  } else {
    console.log('FALLBACK MODE');
  }
}).catch(e => console.error('Error:', e.message));
