/**
 * FlyWire HR � Main Client Application Orchestrator
 * Integrates Biophysics ODE Loop, Three.js Connectome Viewport,
 * Oscilloscope HUD, Speech/Audio Controller, and Socket.io Gateway.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Components
  const socket = io();
  const biophysics = new BiophysicsEngine();
  
  const oscCanvas = document.getElementById('oscCanvas');
  const telemetryHUD = new TelemetryHUD(oscCanvas);

  const threeContainer = document.getElementById('threeContainer');
  const connectomeScene = new ConnectomeScene(threeContainer);

  // Active Simulation Inputs
  let currentInputCurrent = 0.0;
  let currentStress = 0.05;
  let currentReward = 0.05;
  let currentQuestionIndex = 0;

  // DOM Elements
  const vesicleHzEl = document.getElementById('vesicleHz');
  const membraneVmEl = document.getElementById('membraneVm');
  const octLevelEl = document.getElementById('octLevel');
  const octBarEl = document.getElementById('octBar');
  const daLevelEl = document.getElementById('daLevel');
  const daBarEl = document.getElementById('daBar');
  const apBadgeEl = document.getElementById('apBadge');
  const flyMoodTagEl = document.getElementById('flyMoodTag');
  const dlmnHzTagEl = document.getElementById('dlmnHzTag');

  const lpaValueEl = document.getElementById('lpaValue');
  const lpaDeltaTagEl = document.getElementById('lpaDeltaTag');
  const tierBadgeEl = document.getElementById('tierBadge');
  const tierDescEl = document.getElementById('tierDesc');
  const questionProgressEl = document.getElementById('questionProgress');
  const questionTopicEl = document.getElementById('questionTopic');
  const questionPromptEl = document.getElementById('questionPrompt');

  const micBtn = document.getElementById('micBtn');
  const micText = document.getElementById('micText');
  const duckingBadge = document.getElementById('duckingBadge');
  const transcriptBox = document.getElementById('transcriptBox');
  const textForm = document.getElementById('textForm');
  const textInput = document.getElementById('textInput');
  const historyList = document.getElementById('historyList');
  const resetBtn = document.getElementById('resetBtn');

  // 2. Speech & Audio Synthesizer Controller with Audio Ducking
  const speechAudio = new SpeechAudioController({
    onInterimTranscript: (interim) => {
      transcriptBox.innerHTML = `<span style="color: #38bdf8;">[Speaking]:</span> ${interim}`;
      // Fast path: emit interim to socket
      socket.emit('candidate_interim', { text: interim });
      // Minor acoustic deflection
      currentInputCurrent = 8.0;
    },
    onFinalTranscript: (final) => {
      transcriptBox.innerHTML = `<span style="color: #10b981;">[Answer]:</span> ${final}`;
      submitAnswer(final);
    },
    onSpeakingStateChange: (isSpeaking) => {
      if (isSpeaking) {
        duckingBadge.textContent = '?? DUCKED (FLY TALKING)';
        duckingBadge.classList.add('ducked');
      } else {
        duckingBadge.textContent = '?? MIC ACTIVE';
        duckingBadge.classList.remove('ducked');
      }
    }
  });

  // Mic Button Toggle
  micBtn.addEventListener('click', () => {
    if (speechAudio.isListening) {
      speechAudio.stopListening();
      micBtn.classList.remove('recording');
      micText.textContent = 'START SPEAKING';
    } else {
      const ok = speechAudio.startListening();
      if (ok) {
        micBtn.classList.add('recording');
        micText.textContent = 'LISTENING...';
        transcriptBox.innerHTML = '<span style="color: #94a3b8;">Listening to candidate speech...</span>';
      }
    }
  });

  // Text Form Submission
  textForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = textInput.value.trim();
    if (!text) return;
    transcriptBox.innerHTML = `<span style="color: #10b981;">[Submitted]:</span> ${text}`;
    textInput.value = '';
    submitAnswer(text);
  });

  function submitAnswer(text) {
    socket.emit('candidate_response', {
      text,
      questionIndex: currentQuestionIndex
    });
  }

  // Reset Interview
  
  // Bio-Acoustic Demo Buttons
  const btnPlaySineSong = document.getElementById('btnPlaySineSong');
  const btnPlayPulseSong = document.getElementById('btnPlayPulseSong');
  if (btnPlaySineSong) {
    btnPlaySineSong.addEventListener('click', () => speechAudio.playCourtshipSineSong(2.0));
  }
  if (btnPlayPulseSong) {
    btnPlayPulseSong.addEventListener('click', () => speechAudio.playAgitatedPulseSong(10));
  }

  resetBtn.addEventListener('click', () => {
    socket.emit('reset_interview');
    historyList.innerHTML = '';
  });

  // 3. Socket.io Event Handling
  socket.on('init', (data) => {
    updateLPAUI(data.currentLPA, 0, data.tier, 'STARTING BASELINE');
    loadQuestion(data.question, data.questionIndex, data.totalQuestions);
  });

  socket.on('interim_feedback', (data) => {
    if (data.detectedFatal) {
      currentStress = 0.95;
      currentInputCurrent = 45.0;
      speechAudio.playAgitatedPulseSong(4);
    } else if (data.interimReward > 0.4) {
      currentReward = 0.85;
      currentInputCurrent = 12.0;
    }
  });

  socket.on('evaluation_result', (data) => {
    const { evaluation, nextQuestion, questionIndex } = data;

    // Trigger authentic Drosophila acoustic synthesis
    if (evaluation.giantFiberTriggered || evaluation.stressStimulus > 0.65) {
      speechAudio.playAgitatedPulseSong(9);
    } else if (evaluation.rewardStimulus >= 0.60 || evaluation.delta >= 2.0) {
      speechAudio.playCourtshipSineSong(1.8);
    }

    // Apply biophysical perturbations
    currentStress = evaluation.stressStimulus;
    currentReward = evaluation.rewardStimulus;
    currentInputCurrent = evaluation.aversiveCurrent;

    // Update LPA Display
    const deltaStr = (evaluation.delta >= 0 ? `+${evaluation.delta}` : `${evaluation.delta}`) + ' LPA';
    updateLPAUI(evaluation.newLPA, evaluation.delta, evaluation.tier, deltaStr);


    // NEURAL VERDICT PANEL: make fly brain output visible
    (function showVerdictPanel() {
      var panel = document.getElementById('neuralVerdictPanel');
      if (!panel) return;
      panel.classList.remove('hidden', 'fly-active', 'gf-active');
      var label = evaluation.circuitLabel || 'EVALUATED';
      var cb = document.getElementById('verdictCircuitBadge');
      if (cb) { cb.textContent = label; cb.className = 'verdict-circuit-badge ' + label; }
      var daPct  = Math.round((evaluation.dopamineLevel   || 0) * 100);
      var octPct = Math.round((evaluation.octopamineLevel || 0) * 100);
      var ringPct = Math.min(100, Math.round((evaluation.ringCoherence || 0) * 200));
      var db = document.getElementById('verdictDaBar');   if (db)  db.style.width  = daPct  + '%';
      var dv = document.getElementById('verdictDaVal');   if (dv)  dv.textContent  = daPct  + '%';
      var ob = document.getElementById('verdictOctBar');  if (ob)  ob.style.width  = octPct + '%';
      var ov = document.getElementById('verdictOctVal');  if (ov)  ov.textContent  = octPct + '%';
      var rb = document.getElementById('verdictRingBar'); if (rb)  rb.style.width  = ringPct + '%';
      var rv = document.getElementById('verdictRingVal'); if (rv)  rv.textContent  = ringPct + '%';
      var fv = document.getElementById('verdictFiringVal'); if (fv) fv.textContent = (evaluation.firingRate||0).toFixed(0) + ' Hz';
      var gfa = document.getElementById('verdictGfAlert');
      if (gfa) {
        if (evaluation.giantFiberTriggered) { gfa.classList.remove('hidden'); panel.classList.add('gf-active'); }
        else { gfa.classList.add('hidden'); panel.classList.add('fly-active'); }
      }
      var vc = document.getElementById('verdictCritique');
      if (vc) vc.textContent = evaluation.critique || '';
    })();
    // Append to Audit Log
    addHistoryEntry(deltaStr, evaluation.delta, evaluation.critique, evaluation.isLLM, evaluation.isFlyBrain);

    // Speak critique with Formant Insect Voice (Audio Ducking protected)
    speechAudio.speak(evaluation.critique, () => {
      // Once critique finishes speaking, advance question
      setTimeout(() => {
        loadQuestion(nextQuestion, questionIndex, 4);
        currentStress = 0.05;
        currentReward = 0.05;
        currentInputCurrent = 0.0;
      }, 1200);
    });
  });

  function updateLPAUI(lpa, delta, tier, tagText) {
    lpaValueEl.textContent = Number(lpa).toFixed(2);
    tierBadgeEl.textContent = tier.tierName;
    tierDescEl.textContent = tier.description;

    lpaDeltaTagEl.textContent = tagText;
    lpaDeltaTagEl.className = 'lpa-delta-tag';
    lpaValueEl.className = 'lpa-digits';

    if (delta < 0) {
      lpaDeltaTagEl.classList.add('negative');
      lpaValueEl.classList.add('crash');
    } else if (delta > 0) {
      lpaDeltaTagEl.classList.add('positive');
      lpaValueEl.classList.add('surge');
    } else {
      lpaDeltaTagEl.classList.add('neutral');
    }

    setTimeout(() => {
      lpaValueEl.classList.remove('crash', 'surge');
    }, 1500);
  }

  function loadQuestion(q, idx, total) {
    if (!q) return;
    currentQuestionIndex = idx;
    questionProgressEl.textContent = `Q ${idx + 1} OF ${total}`;
    questionTopicEl.textContent = q.topic;
    questionPromptEl.textContent = q.prompt;
  }

  function addHistoryEntry(deltaText, deltaVal, critique, isLLM = false, isFlyBrain = false) {
    const now = new Date();
    const timeStr = `${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const div = document.createElement('div');
    div.className = 'history-item';
    const isNeg = deltaVal < 0;
    div.innerHTML = `
      <span class="hist-time">${timeStr}</span>
      <span class="hist-delta ${isNeg ? 'negative' : ''}${isLLM ? ' llm' : (isFlyBrain ? ' fly' : '')}">${isLLM ? '? ' : isFlyBrain ? '?? ' : ''}${deltaText}</span>
      <span class="hist-text">${critique}</span>
    `;
    historyList.insertBefore(div, historyList.firstChild);
  }

  // 4. High-Performance Decoupled Biophysics Simulation Loop
  // Sub-stepped Euler integration running smoothly
  const dt = 0.5; // 0.5 ms step
  let lastTime = performance.now();

  function biophysicsLoop() {
    const now = performance.now();
    const elapsed = Math.min(now - lastTime, 50); // Cap elapsed time
    lastTime = now;

    // Run sub-steps for physical accuracy
    const steps = Math.floor(elapsed / dt) || 1;
    let lastState = null;

    for (let s = 0; s < steps; s++) {
      lastState = biophysics.step(dt, currentInputCurrent, currentStress, currentReward);
      telemetryHUD.pushVoltage(lastState.membraneVoltage, lastState.giantFiberSpike, lastState.facilitationU, lastState.vesiclePoolR);
      // Decay input current
      currentInputCurrent = Math.max(0, currentInputCurrent - 0.1);
    }

    if (lastState) {
      // Update Canvas Oscilloscope
      telemetryHUD.updateRingState(biophysics.ringState);
      telemetryHUD.render(lastState);

      // Update 3D Connectome Scene
      connectomeScene.updateBiophysics(lastState);

      // Update Quantitative Metric Dials
      vesicleHzEl.innerHTML = `${lastState.vesicleReleaseHz} <span class="unit">Hz</span>`;
      membraneVmEl.innerHTML = `${lastState.membraneVoltage} <span class="unit">mV</span>`;
      
      const octPct = (lastState.octopamineLevel * 100).toFixed(1);
      octLevelEl.textContent = `${octPct}%`;
      octBarEl.style.width = `${octPct}%`;

      const daPct = (lastState.dopamineLevel * 100).toFixed(1);
      daLevelEl.textContent = `${daPct}%`;
      daBarEl.style.width = `${daPct}%`;

      dlmnHzTagEl.textContent = `WINGBEAT: ${lastState.dlmnFrequency} Hz`;

      if (lastState.giantFiberSpike) {
        apBadgeEl.textContent = 'ðŸš¨ AP SPIKE: FIRING!';
        apBadgeEl.className = 'ap-badge firing';
      } else {
        apBadgeEl.textContent = 'AP SPIKE: QUIET';
        apBadgeEl.className = 'ap-badge';
      }

      flyMoodTagEl.textContent = `MOOD: ${connectomeScene.animationState}`;
    }

    requestAnimationFrame(biophysicsLoop);
  }

  
  // Connectome Inspector & Circuit Chips
  
  // Oscilloscope Mode Tabs (Trace vs Matrix vs STF)
  const oscTabs = document.getElementById('oscTabs');
  if (oscTabs) {
    oscTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.osc-tab');
      if (!tab) return;
      document.querySelectorAll('.osc-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      telemetryHUD.setMode(tab.dataset.mode);
    });
  }

  const circuitSelectorBar = document.getElementById('circuitSelectorBar');
  const neuronInspectorCard = document.getElementById('neuronInspectorCard');
  const inspectorTitle = document.getElementById('inspectorTitle');
  const inspectorCloseBtn = document.getElementById('inspectorCloseBtn');
  const inspectorFlywireId = document.getElementById('inspectorFlywireId');
  const inspectorTransmitter = document.getElementById('inspectorTransmitter');
  const inspectorRole = document.getElementById('inspectorRole');
  const inspectorNeuropil = document.getElementById('inspectorNeuropil');
  const inspectorSynapses = document.getElementById('inspectorSynapses');
  const btnStimulateNeuron = document.getElementById('btnStimulateNeuron');

  if (circuitSelectorBar) {
    circuitSelectorBar.addEventListener('click', (e) => {
      const chip = e.target.closest('.circuit-chip');
      if (!chip) return;
      document.querySelectorAll('.circuit-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const circuitId = chip.dataset.id;
      connectomeScene.selectNeuron(circuitId);
    });
  }

  connectomeScene.onNeuronSelectCallback = (neuron) => {
    if (!neuronInspectorCard) return;
    if (neuron) {
      neuronInspectorCard.classList.remove('hidden');
      if (inspectorTitle) inspectorTitle.textContent = neuron.displayName || neuron.name;
      if (inspectorFlywireId) inspectorFlywireId.textContent = `${neuron.system || 'FlyWire'}: ${neuron.flywireId || 'N/A'}`;
      if (inspectorTransmitter) inspectorTransmitter.textContent = neuron.neurotransmitter || 'Acetylcholine';
      if (inspectorRole) inspectorRole.textContent = neuron.role || 'Connectome neural pathway.';
      if (inspectorNeuropil) inspectorNeuropil.textContent = neuron.neuropil || 'Central Brain';
      if (inspectorSynapses) inspectorSynapses.textContent = neuron.synapses || '350 Pre / 1.2k Post';

      // Synchronize active chip if present
      document.querySelectorAll('.circuit-chip').forEach(c => {
        if (c.dataset.id === neuron.name || c.dataset.id === neuron.flywireId) {
          c.classList.add('active');
        } else {
          c.classList.remove('active');
        }
      });
    } else {
      neuronInspectorCard.classList.add('hidden');
      document.querySelectorAll('.circuit-chip').forEach(c => {
        if (c.dataset.id === 'all') c.classList.add('active');
        else c.classList.remove('active');
      });
    }
  };

  if (inspectorCloseBtn) {
    inspectorCloseBtn.addEventListener('click', () => {
      connectomeScene.selectNeuron('all');
    });
  }

  if (btnStimulateNeuron) {
    btnStimulateNeuron.addEventListener('click', () => {
      currentInputCurrent += 30.0;
      currentStress = Math.min(1.0, currentStress + 0.35);
      connectomeScene.injectOptogeneticCurrent(15.0);
      speechAudio.playAgitatedPulseSong(3);
    });
  }

  requestAnimationFrame(biophysicsLoop);
});

