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

  playTurretFire(type = 'normal') {
    this.playGunshot(type);
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

  // Heavy .50 Caliber AP Marksman Rifle Gunshot Crack & Resonant Tail
  playSniperRifle() {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;

    // 1. Supersonic ballistic shockwave crack (sharp high-frequency transient)
    const crackBufferSize = Math.floor(this.ctx.sampleRate * 0.12);
    const crackBuffer = this.ctx.createBuffer(1, crackBufferSize, this.ctx.sampleRate);
    const crackData = crackBuffer.getChannelData(0);
    for (let i = 0; i < crackBufferSize; i++) {
      crackData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.022));
    }
    const crackNoise = this.ctx.createBufferSource();
    crackNoise.buffer = crackBuffer;

    const crackFilter = this.ctx.createBiquadFilter();
    crackFilter.type = 'bandpass';
    crackFilter.frequency.setValueAtTime(2800, t);
    crackFilter.frequency.exponentialRampToValueAtTime(320, t + 0.1);
    crackFilter.Q.value = 3.2;

    const crackGain = this.ctx.createGain();
    crackGain.gain.setValueAtTime(0.9, t);
    crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    crackNoise.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(this.masterGain);
    crackNoise.start(t);

    // 2. Heavy .50 BMG explosive chamber pressure punch
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(125, t);
    subOsc.frequency.exponentialRampToValueAtTime(24, t + 0.28);

    subGain.gain.setValueAtTime(0.85, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.start(t);
    subOsc.stop(t + 0.32);

    // 3. Wide resonant forest echo & rolling atmospheric rumble
    const echoBufferSize = Math.floor(this.ctx.sampleRate * 0.55);
    const echoBuffer = this.ctx.createBuffer(1, echoBufferSize, this.ctx.sampleRate);
    const echoData = echoBuffer.getChannelData(0);
    for (let i = 0; i < echoBufferSize; i++) {
      echoData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.12));
    }
    const echoNoise = this.ctx.createBufferSource();
    echoNoise.buffer = echoBuffer;

    const echoFilter = this.ctx.createBiquadFilter();
    echoFilter.type = 'lowpass';
    echoFilter.frequency.setValueAtTime(420, t);
    echoFilter.frequency.exponentialRampToValueAtTime(65, t + 0.52);

    const echoGain = this.ctx.createGain();
    echoGain.gain.setValueAtTime(0.42, t + 0.03);
    echoGain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

    echoNoise.connect(echoFilter);
    echoFilter.connect(echoGain);
    echoGain.connect(this.masterGain);
    echoNoise.start(t + 0.02);
  }

  // Metallic Bolt-Action Cycle (Handle lift, slide back, casing eject, lock into battery)
  playBoltCycle() {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;

    // Stage 1: Bolt handle up & unlock (sharp metallic snap)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(1500, t);
    osc1.frequency.exponentialRampToValueAtTime(420, t + 0.05);
    gain1.gain.setValueAtTime(0.32, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc1.connect(gain1);
    gain1.connect(this.masterGain);
    osc1.start(t);
    osc1.stop(t + 0.07);

    // Stage 2: Heavy bolt slide rearward & brass ejection clink
    setTimeout(() => {
      if (this.muted || !this.ctx) return;
      const t2 = this.ctx.currentTime;
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(700, t2);
      osc2.frequency.exponentialRampToValueAtTime(240, t2 + 0.07);
      gain2.gain.setValueAtTime(0.25, t2);
      gain2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.08);
      osc2.connect(gain2);
      gain2.connect(this.masterGain);
      osc2.start(t2);
      osc2.stop(t2 + 0.09);

      // Casing bounce ring
      const ringOsc = this.ctx.createOscillator();
      const ringGain = this.ctx.createGain();
      ringOsc.type = 'sine';
      ringOsc.frequency.setValueAtTime(2800, t2);
      ringOsc.frequency.exponentialRampToValueAtTime(1100, t2 + 0.12);
      ringGain.gain.setValueAtTime(0.18, t2);
      ringGain.gain.exponentialRampToValueAtTime(0.001, t2 + 0.13);
      ringOsc.connect(ringGain);
      ringGain.connect(this.masterGain);
      ringOsc.start(t2);
      ringOsc.stop(t2 + 0.14);
    }, 75);

    // Stage 3: Steel bolt slide forward & chamber lock into battery
    setTimeout(() => {
      if (this.muted || !this.ctx) return;
      const t3 = this.ctx.currentTime;
      const osc3 = this.ctx.createOscillator();
      const gain3 = this.ctx.createGain();
      osc3.type = 'triangle';
      osc3.frequency.setValueAtTime(320, t3);
      osc3.frequency.exponentialRampToValueAtTime(1150, t3 + 0.07);
      gain3.gain.setValueAtTime(0.38, t3);
      gain3.gain.exponentialRampToValueAtTime(0.001, t3 + 0.08);
      osc3.connect(gain3);
      gain3.connect(this.masterGain);
      osc3.start(t3);
      osc3.stop(t3 + 0.09);
    }, 230);
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

  // Metallic hammer strike on steel mounting plate
  playHammer() {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const dur = 0.14;

    // 1. High metallic ring ping
    const ping = this.ctx.createOscillator();
    const pingGain = this.ctx.createGain();
    ping.type = 'triangle';
    ping.frequency.setValueAtTime(1650 + Math.random() * 200, t);
    ping.frequency.exponentialRampToValueAtTime(800, t + dur);
    pingGain.gain.setValueAtTime(0.25, t);
    pingGain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    ping.connect(pingGain);
    pingGain.connect(this.masterGain);
    ping.start(t);
    ping.stop(t + dur);

    // 2. Heavy anvil/steel thud impact
    const thud = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(220, t);
    thud.frequency.exponentialRampToValueAtTime(45, t + 0.1);
    thudGain.gain.setValueAtTime(0.4, t);
    thudGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    thud.connect(thudGain);
    thudGain.connect(this.masterGain);
    thud.start(t);
    thud.stop(t + 0.1);
  }

  // Electric welding arc sizzle & spark crackle
  playWeldSparks() {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const dur = 0.09;

    const bufferSize = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (Math.random() < 0.3 ? 1.0 : 0.4);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2400, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(t);
  }

  // Triumphant rising construction completion chime
  playConstructionChime() {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    // Ascending arpeggio: C5 (523.25), E5 (659.25), G5 (783.99), C6 (1046.50)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const startTime = t + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(startTime);
      osc.stop(startTime + 0.52);

      // Harmonic chime shimmer
      const harm = this.ctx.createOscillator();
      const harmGain = this.ctx.createGain();
      harm.type = 'triangle';
      harm.frequency.setValueAtTime(freq * 2, startTime);
      harmGain.gain.setValueAtTime(0.12, startTime);
      harmGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);
      harm.connect(harmGain);
      harmGain.connect(this.masterGain);
      harm.start(startTime);
      harm.stop(startTime + 0.37);
    });
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

  // High-caliber sniper rifle crack + supersonic tail
  playSniperShot() {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const bufSz = Math.floor(this.ctx.sampleRate * 0.12);
    const buf = this.ctx.createBuffer(1, bufSz, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSz; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.018));
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 900;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    noise.connect(filt); filt.connect(g); g.connect(this.masterGain);
    noise.start(t);
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(22, t + 0.18);
    og.gain.setValueAtTime(0.7, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(og); og.connect(this.masterGain);
    osc.start(t); osc.stop(t + 0.2);
    setTimeout(() => {
      if (!this.ctx) return;
      const t2 = this.ctx.currentTime;
      const osc2 = this.ctx.createOscillator();
      const og2 = this.ctx.createGain();
      osc2.type = 'sawtooth'; osc2.frequency.setValueAtTime(62, t2);
      osc2.frequency.exponentialRampToValueAtTime(28, t2 + 0.4);
      og2.gain.setValueAtTime(0.18, t2);
      og2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.45);
      osc2.connect(og2); og2.connect(this.masterGain);
      osc2.start(t2); osc2.stop(t2 + 0.5);
    }, 90);
  }

  // Construction: hammering + electric welding buzz
  playConstruction() {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1100, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.06);
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    osc.connect(g); g.connect(this.masterGain);
    osc.start(t); osc.stop(t + 0.08);
    setTimeout(() => {
      if (!this.ctx) return;
      const t2 = this.ctx.currentTime;
      const osc2 = this.ctx.createOscillator();
      const g2 = this.ctx.createGain();
      osc2.type = 'sawtooth'; osc2.frequency.value = 160;
      g2.gain.setValueAtTime(0.12, t2);
      g2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.15);
      osc2.connect(g2); g2.connect(this.masterGain);
      osc2.start(t2); osc2.stop(t2 + 0.16);
    }, 120);
  }

  // Triumphant fanfare when refugee is rescued
  playRefugeeFanfare() {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle'; osc.frequency.value = freq;
      const st = t + i * 0.08;
      g.gain.setValueAtTime(0.22, st);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.5);
      osc.connect(g); g.connect(this.masterGain);
      osc.start(st); osc.stop(st + 0.55);
    });
  }

  // Deep resonant boss roar
  playBossRoar() {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    // Sub-bass growl
    const osc1 = this.ctx.createOscillator();
    const g1 = this.ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(48, t);
    osc1.frequency.exponentialRampToValueAtTime(22, t + 1.2);
    g1.gain.setValueAtTime(0.55, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
    osc1.connect(g1); g1.connect(this.masterGain);
    osc1.start(t); osc1.stop(t + 1.4);
    // Mid growl
    const osc2 = this.ctx.createOscillator();
    const g2 = this.ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(90, t + 0.1);
    osc2.frequency.exponentialRampToValueAtTime(30, t + 0.9);
    g2.gain.setValueAtTime(0.3, t + 0.1);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    osc2.connect(g2); g2.connect(this.masterGain);
    osc2.start(t + 0.1); osc2.stop(t + 1.2);
    // Noise burst
    const bufSz = Math.floor(this.ctx.sampleRate * 0.3);
    const buf = this.ctx.createBuffer(1, bufSz, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSz; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.12));
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const gn = this.ctx.createGain();
    gn.gain.setValueAtTime(0.4, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    noise.connect(gn); gn.connect(this.masterGain);
    noise.start(t);
  }
}

window.soundSystem = new SoundSystem();

