/* ============================================================
   Synthesized music engine (Web Audio API)
   No binary files needed — each "track" is generated procedurally
   with a distinct tempo / scale / waveform so they feel different.
   Drop real loops into assets/sounds/ later and swap playTrack().
   ============================================================ */

const TRACKS = {
  none:     { name: "No music",  genre: "The sound of silence", icon: "♪",  color: "#5a5a5e" },
  energize: { name: "Energize",  genre: "Funk pop",             icon: "⚡", color: "#e8821e",
              tempo: 124, wave: "sawtooth", root: 220, scale: [0, 3, 5, 7, 10], swing: 0 },
  focus:    { name: "Focus",     genre: "Minimal electronic",   icon: "🖼", color: "#7b5be0",
              tempo: 104, wave: "sine",     root: 174, scale: [0, 2, 5, 7, 9],  swing: 0 },
  imagine:  { name: "Imagine",   genre: "Lo-fi beats",          icon: "💡", color: "#b3a035",
              tempo: 82,  wave: "triangle", root: 196, scale: [0, 3, 5, 7, 10], swing: 0.18 },
  flow:     { name: "Flow",      genre: "Indie electronic",     icon: "〜", color: "#3b7de0",
              tempo: 112, wave: "triangle", root: 233, scale: [0, 2, 4, 7, 9],  swing: 0.05 },
  decide:   { name: "Decide",    genre: "Jazz grove",           icon: "✓",  color: "#e0635b",
              tempo: 96,  wave: "sine",     root: 207, scale: [0, 3, 5, 6, 10], swing: 0.22 },
  sprint:   { name: "Sprint",    genre: "Percussive house",     icon: "»",  color: "#b14de0",
              tempo: 128, wave: "square",   root: 261, scale: [0, 2, 3, 7, 10], swing: 0 },
};
const TRACK_ORDER = ["energize", "focus", "imagine", "flow", "decide", "sprint"];

class MusicEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.analyser = null;
    this.freqData = null;
    this.current = null;       // track key currently playing
    this.timerId = null;
    this.nextNoteTime = 0;
    this.step = 0;
    this.volume = 0.6;
    this.muted = false;
  }

  _ensure() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 64;
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.master.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  setVolume(v) {                         // v: 0..1
    this.volume = v;
    if (this.master) {
      const g = this.muted ? 0 : v;
      this.master.gain.setTargetAtTime(g, this.ctx.currentTime, 0.05);
    }
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.05);
  }

  play(trackKey) {
    if (!trackKey || trackKey === "none" || !TRACKS[trackKey].tempo) { this.stop(); return; }
    this._ensure();
    if (this.ctx.state === "suspended") this.ctx.resume();
    if (this.current === trackKey && this.timerId) return;
    this.stop();
    this.current = trackKey;
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.06;
    this._scheduler();
  }

  stop() {
    if (this.timerId) { clearInterval(this.timerId); this.timerId = null; }
    this.current = null;
  }

  isPlaying() { return !!this.timerId; }

  // amplitude 0..1 for visualizer
  level() {
    if (!this.analyser || !this.timerId) return 0;
    this.analyser.getByteFrequencyData(this.freqData);
    let sum = 0;
    for (let i = 0; i < this.freqData.length; i++) sum += this.freqData[i];
    return (sum / this.freqData.length) / 255;
  }

  _scheduler() {
    const lookahead = 0.1;
    const tick = () => {
      const t = TRACKS[this.current];
      const secPerStep = 60 / t.tempo / 2;          // 8th notes
      while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
        this._scheduleStep(t, this.step, this.nextNoteTime);
        const swung = (this.step % 2 === 1) ? t.swing * secPerStep : 0;
        this.nextNoteTime += secPerStep + swung;
        this.step = (this.step + 1) % 16;
      }
    };
    this.timerId = setInterval(tick, 25);
  }

  _noteFreq(t, scaleIdx, octave = 0) {
    const semis = t.scale[((scaleIdx % t.scale.length) + t.scale.length) % t.scale.length];
    return t.root * Math.pow(2, (semis + 12 * octave) / 12);
  }

  _scheduleStep(t, step, time) {
    // Bass on the beat
    if (step % 4 === 0) {
      this._voice(this._noteFreq(t, step / 4, -1), time, 0.28, t.wave, 0.22);
    }
    // Melody — pseudo-random but deterministic per step
    const melodyOn = [0, 3, 6, 8, 10, 14].includes(step);
    if (melodyOn) {
      const idx = (step * 3) % 7;
      this._voice(this._noteFreq(t, idx, 1), time, 0.18, t.wave, 0.12);
    }
    // Hi-hat-ish noise on off-beats
    if (step % 2 === 1) this._hat(time, 0.04);
    // Kick feel on house/funk
    if ((t.tempo >= 120) && step % 4 === 0) this._kick(time);
  }

  _voice(freq, time, dur, wave, gain) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = wave; o.frequency.value = freq;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0008, time + dur);
    o.connect(g); g.connect(this.master);
    o.start(time); o.stop(time + dur + 0.02);
  }

  _hat(time, dur) {
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const hp = this.ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 7000;
    const g = this.ctx.createGain(); g.gain.value = 0.06;
    s.connect(hp); hp.connect(g); g.connect(this.master);
    s.start(time);
  }

  _kick(time) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(140, time);
    o.frequency.exponentialRampToValueAtTime(45, time + 0.12);
    g.gain.setValueAtTime(0.5, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
    o.connect(g); g.connect(this.master);
    o.start(time); o.stop(time + 0.18);
  }

  // End-of-timer chime (independent of master volume so it's always audible-ish)
  chime() {
    this._ensure();
    if (this.ctx.state === "suspended") this.ctx.resume();
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C E G C
    notes.forEach((f, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const start = now + i * 0.14;
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.35, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0008, start + 0.6);
      o.connect(g); g.connect(this.ctx.destination); // bypass master/mute
      o.start(start); o.stop(start + 0.65);
    });
  }
}

window.MUSIC = new MusicEngine();
window.TRACKS = TRACKS;
window.TRACK_ORDER = TRACK_ORDER;
