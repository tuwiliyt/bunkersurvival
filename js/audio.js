// Procedural Web Audio Synthesizer for Bunker Survival
class SoundSystem {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.masterGain = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.35;
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : 0.35;
    }
    return this.muted;
  }

  ensureContext() {
    if (!this.initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Turret gunshot
  playGunshot(type = 'normal') {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;

    if (type === 'plasma') {
      // Futuristic electromagnetic capacitor discharge & ion beam sizzle
      const osc1 = this.ctx.createOscillator();
      const oscGain1 = this.ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(880, t);
      osc1.frequency.exponentialRampToValueAtTime(70, t + 0.18);
      oscGain1.gain.setValueAtTime(0.55, t);
      oscGain1.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
      osc1.connect(oscGain1);
      oscGain1.connect(this.masterGain);
      osc1.start(t);
      osc1.stop(t + 0.19);

      // Resonant bass punch
      const osc2 = this.ctx.createOscillator();
      const oscGain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(160, t);
      osc2.frequency.exponentialRampToValueAtTime(35, t + 0.22);
      oscGain2.gain.setValueAtTime(0.7, t);
      oscGain2.gain.exponentialRampToValueAtTime(0.01, t + 0.22);
      osc2.connect(oscGain2);
      oscGain2.connect(this.masterGain);
      osc2.start(t);
      osc2.stop(t + 0.23);
      return;
    }

    // Noise buffer for the crack
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.08);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = type === 'heavy' ? 'lowpass' : 'bandpass';
    filter.frequency.setValueAtTime(type === 'heavy' ? 800 : 1800, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + 0.07);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(type === 'heavy' ? 0.6 : 0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.07);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(t);

    // Punch osc
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(type === 'heavy' ? 140 : 220, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.09);

    oscGain.gain.setValueAtTime(0.5, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.09);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.1);
  }

  // Empty turret click
  playDryClick() {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.03);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.04);
  }

  // Reload sound
  playReload() {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    // Click 1 (mag out)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(600, t);
    osc1.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    gain1.gain.setValueAtTime(0.25, t);
    gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
    osc1.connect(gain1);
    gain1.connect(this.masterGain);
    osc1.start(t);
    osc1.stop(t + 0.09);

    // Click 2 (mag lock)
    setTimeout(() => {
      if (this.muted || !this.ctx) return;
      const t2 = this.ctx.currentTime;
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(250, t2);
      osc2.frequency.exponentialRampToValueAtTime(900, t2 + 0.06);
      gain2.gain.setValueAtTime(0.35, t2);
      gain2.gain.exponentialRampToValueAtTime(0.01, t2 + 0.07);
      osc2.connect(gain2);
      gain2.connect(this.masterGain);
      osc2.start(t2);
      osc2.stop(t2 + 0.08);
    }, 120);
  }

  // Zombie hit / death groan
  playZombieHit() {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120 + Math.random() * 40, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.15);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  // Alarm siren for incoming horde
  playSiren() {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(450, t);
    osc.frequency.linearRampToValueAtTime(750, t + 0.4);
    osc.frequency.linearRampToValueAtTime(450, t + 0.8);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.7);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.85);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.9);
  }

  // Craft / UI click
  playBeep(success = true) {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(success ? 880 : 330, t);
    if (success) {
      osc.frequency.setValueAtTime(1174, t + 0.06);
    }
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  // Elevator ding
  playElevatorDing() {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.5, t);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.65);
  }

  // Explosion sound (grenade / brute death / heavy impact)
  playExplosion() {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.4);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.1));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(250, t);
    filter.frequency.exponentialRampToValueAtTime(40, t + 0.35);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(t);
  }

  // Minigun electric motor spinup whirr & barrel gear chatter
  playMinigunSpinup() {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    const now = performance.now();
    if (this._lastSpinup && now - this._lastSpinup < 1200) return;
    this._lastSpinup = now;

    const t = this.ctx.currentTime;
    const dur = 0.55;

    // Motor 1: Sawtooth rotor
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(65, t);
    osc1.frequency.exponentialRampToValueAtTime(360, t + dur);

    // Motor 2: Gear teeth harmonic
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(130, t);
    osc2.frequency.exponentialRampToValueAtTime(720, t + dur);

    // Filter to sweep from dull to sharp metallic buzz
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(250, t);
    filter.frequency.exponentialRampToValueAtTime(2200, t + dur);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.28, t + dur * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.01, t + dur);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + dur);
    osc2.stop(t + dur);
  }

  // Atmospheric dark forest night wind breeze
  playWindBreeze() {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    const now = performance.now();
    if (this._lastWind && now - this._lastWind < 6000) return;
    this._lastWind = now;

    const t = this.ctx.currentTime;
    const dur = 3.2;

    // Filtered noise swoosh
    const bufferSize = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Simple pinking filter
      lastOut = (lastOut + 0.025 * white) / 1.025;
      data[i] = lastOut * 3.5;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    // Resonant bandpass filter mimicking wind through trees
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2.8;
    filter.frequency.setValueAtTime(220, t);
    filter.frequency.linearRampToValueAtTime(540, t + dur * 0.45);
    filter.frequency.linearRampToValueAtTime(180, t + dur);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.18, t + dur * 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(t);
  }

  // Undead feral attack shriek & guttural vocalization
  playZombieShriek() {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    const now = performance.now();
    if (this._lastShriek && now - this._lastShriek < 800) return;
    this._lastShriek = now;

    const t = this.ctx.currentTime;
    const dur = 0.4;

    // Dual detuned screech oscillators
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';

    osc1.frequency.setValueAtTime(360, t);
    osc1.frequency.linearRampToValueAtTime(460, t + 0.08);
    osc1.frequency.exponentialRampToValueAtTime(130, t + dur);

    osc2.frequency.setValueAtTime(385, t);
    osc2.frequency.linearRampToValueAtTime(495, t + 0.08);
    osc2.frequency.exponentialRampToValueAtTime(145, t + dur);

    // Formant throat filter
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 3.5;
    filter.frequency.setValueAtTime(1600, t);
    filter.frequency.exponentialRampToValueAtTime(450, t + dur);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.24, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, t + dur);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + dur);
    osc2.stop(t + dur);
  }

  // Acid spitter spit projectile sound (wet resonant squirt)
  playAcidSpit() {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const dur = 0.25;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(480, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + dur);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, t);
    filter.frequency.exponentialRampToValueAtTime(300, t + dur);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.32, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + dur);
  }

  // Retro CRT switch click
  playCRTClick(on = true) {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(on ? 1200 : 800, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.04);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.04);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }
}

window.soundSystem = new SoundSystem();
