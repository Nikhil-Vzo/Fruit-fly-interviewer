/**
 * Speech Recognition & Formant Insect Audio Synthesizer
 *
 * Implements:
 * 1. Web Speech API with continuous listening and live interim transcript streaming.
 * 2. Audio Ducking (Qwen fix): Automatically mutes microphone stream during fly speech
 *    to prevent the catastrophic acoustic feedback loop.
 * 3. Watchdog Auto-Restart (Claude/Grok fix): Automatically recovers from Chrome silent drops.
 * 4. Buzzy Formant Insect Voice: Uses Web Audio API biquad filter and AM modulation.
 */

class SpeechAudioController {
  constructor(options = {}) {
    this.onInterimTranscript = options.onInterimTranscript || (() => {});
    this.onFinalTranscript = options.onFinalTranscript || (() => {});
    this.onSpeakingStateChange = options.onSpeakingStateChange || (() => {});

    this.isListening = false;
    this.isDucked = false; // Audio ducking flag
    this.recognition = null;
    this.restartTimer = null;
    this.audioCtx = null;

    this.initRecognition();
    this.initAudioContext();
  }

  initAudioContext() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    } catch (e) {
      console.warn('Web Audio API not supported:', e);
    }
  }

  initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition not supported in this browser. Falling back to text mode.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.isListening = true;
    };

    this.recognition.onresult = (event) => {
      // If fly is speaking (audio ducked), ignore input to prevent echo loop!
      if (this.isDucked) return;

      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      if (interim.trim()) {
        this.onInterimTranscript(interim.trim());
      }
      if (final.trim()) {
        this.onFinalTranscript(final.trim());
      }
    };

    this.recognition.onerror = (event) => {
      console.warn('SpeechRecognition error:', event.error);
      if (event.error === 'not-allowed') {
        this.isListening = false;
      }
    };

    // Watchdog auto-restart on silence / Chrome timeout
    this.recognition.onend = () => {
      if (this.isListening && !this.isDucked) {
        clearTimeout(this.restartTimer);
        this.restartTimer = setTimeout(() => {
          try {
            this.recognition.start();
          } catch (e) {
            // Already started
          }
        }, 300);
      }
    };
  }

  startListening() {
    if (!this.recognition) return false;
    this.isListening = true;
    try {
      this.recognition.start();
      return true;
    } catch (e) {
      return false;
    }
  }

  stopListening() {
    this.isListening = false;
    clearTimeout(this.restartTimer);
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
  }

  /**
   * Speak fly response with audio ducking and insect formant buzzing.
   */
  speak(text, onComplete = () => {}) {
    if (!('speechSynthesis' in window)) {
      onComplete();
      return;
    }

    // 1. DUCK MICROPHONE (Crucial Qwen Fix): Prevent fly voice from entering mic
    this.isDucked = true;
    this.onSpeakingStateChange(true);

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.15; // Slightly fast fly cadence
    utterance.pitch = 1.6; // High-pitched insect tone

    // Play synthesized wing-hum background in Web Audio if available
    this.playInsectBuzz(1.2);

    utterance.onend = () => {
      // 2. UNDUCK MICROPHONE after short tail silence
      setTimeout(() => {
        this.isDucked = false;
        this.onSpeakingStateChange(false);
        onComplete();
      }, 400);
    };

    utterance.onerror = () => {
      this.isDucked = false;
      this.onSpeakingStateChange(false);
      onComplete();
    };

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Generates a 200 Hz amplitude-modulated insect buzz tone via Web Audio API
   */
  playInsectBuzz(durationSec = 1.0) {
    if (!this.audioCtx) return;
    try {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      const filter = this.audioCtx.createBiquadFilter();

      // Insect formant: Bandpass at 420 Hz with resonance Q=6
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(420, now);
      filter.Q.setValueAtTime(6.0, now);

      // Carrier sawtooth wave
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(210, now); // ~210 Hz wingbeat harmonic

      // Amplitude envelope
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + durationSec);
    } catch (e) {
      console.warn('Audio buzz error:', e);
    }
  }

  /**
   * Drosophila Courtship Sine Song (Clemens Lab / Murthy Lab acoustics):
   * Pure ~155 Hz fundamental oscillation with subtle 6 Hz vibrato.
   * Triggered when candidate delivers exceptional answers and Dopamine surges.
   */
  playCourtshipSineSong(duration = 1.6) {
    if (!this.audioCtx) return;
    try {
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(155, now);

      // Subtle biological vibrato LFO
      const lfo = this.audioCtx.createOscillator();
      const lfoGain = this.audioCtx.createGain();
      lfo.frequency.setValueAtTime(6.0, now);
      lfoGain.gain.setValueAtTime(5.0, now);
      lfo.connect(osc.frequency);
      lfo.start(now);
      lfo.stop(now + duration);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {
      console.warn('Audio synthesis error:', e);
    }
  }

  /**
   * Drosophila Agitated Pulse Song:
   * Rapid train of click pulses (280 Hz carrier, 8 ms duration, 35 ms inter-pulse interval).
   * Triggered when Octopamine surges or Giant Fiber escape jump reflex fires.
   */
  playAgitatedPulseSong(numPulses = 9) {
    if (!this.audioCtx) return;
    try {
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      const now = this.audioCtx.currentTime;
      const ipi = 0.035; // 35 ms authentic Drosophila inter-pulse interval
      for (let i = 0; i < numPulses; i++) {
        const pTime = now + i * ipi;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(280, pTime);
        gain.gain.setValueAtTime(0.12, pTime);
        gain.gain.exponentialRampToValueAtTime(0.001, pTime + 0.009);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(pTime);
        osc.stop(pTime + 0.012);
      }
    } catch (e) {
      console.warn('Pulse song error:', e);
    }
  }

}

if (typeof window !== 'undefined') {
  window.SpeechAudioController = SpeechAudioController;
}
