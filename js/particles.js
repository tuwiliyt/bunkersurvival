// Visual FX and Particle System for Bunker Survival
class ParticleSystem {
  constructor() {
    this.particles = [];
    this.tracers = [];
    this.floatingTexts = [];
    this.rainDrops = [];
    this.leaves = [];
    this.spitProjectiles = [];
    this.bloodDecals = [];
    this.fogPuffs = [];
    this.chimneySmoke = [];
    this.chimneyEmbers = [];
    this.acidPuddles = [];

    this.pineNeedles = [];
    this.ambientSpores = [];
    this.chimneyEmbers = [];

    // Init ambient forest leaves
    for (let i = 0; i < 24; i++) {
      this.leaves.push({
        x: Math.random() * 1280,
        y: Math.random() * 240,
        speedX: -0.9 - Math.random() * 1.4,
        speedY: 0.35 + Math.random() * 0.7,
        size: 2 + Math.random() * 3,
        color: Math.random() > 0.5 ? '#3b5e28' : '#735c24'
      });
    }

    // Init pine needles
    for (let i = 0; i < 20; i++) {
      this.pineNeedles.push({
        x: Math.random() * 1280,
        y: Math.random() * 200,
        speedX: -10 - Math.random() * 15,
        speedY: 18 + Math.random() * 25,
        swayPhase: Math.random() * Math.PI * 2,
        swayAmp: 12 + Math.random() * 10,
        angle: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 4
      });
    }

    // Init ambient atmospheric spores
    for (let i = 0; i < 16; i++) {
      this.ambientSpores.push({
        x: Math.random() * 1280,
        y: 40 + Math.random() * (CONFIG.SURFACE_Y - 50),
        vx: -5 - Math.random() * 10,
        vy: -1 - Math.random() * 2,
        phase: Math.random() * Math.PI * 2
      });
    }

    // Init drifting ground fog wisps across the surface
    for (let i = 0; i < 20; i++) {
      this.fogPuffs.push({
        x: (i / 20) * 1380 - 50 + (Math.random() * 40 - 20),
        y: CONFIG.SURFACE_Y - 30 + Math.random() * 35,
        radiusX: 55 + Math.random() * 45,
        radiusY: 18 + Math.random() * 16,
        speedX: -14 - Math.random() * 18,
        baseAlpha: 0.12 + Math.random() * 0.14,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  // Create persistent blood decal on the ground
  spawnBloodDecal(x, y, color = '#680c0c', baseRadius = 7, splatCount = 6) {
    const groundY = CONFIG.SURFACE_Y - 2 + Math.random() * 4;
    const splats = [];
    for (let i = 0; i < splatCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 3 + Math.random() * (baseRadius * 2.2);
      splats.push({
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist * 0.32, // Flattened along ground perspective
        r: 1.2 + Math.random() * (baseRadius * 0.55)
      });
    }

    this.bloodDecals.push({
      x,
      y: groundY,
      color,
      coreColor: '#360505',
      baseRadius,
      splats,
      alpha: 0.88,
      life: 240, // Decal lasts for 4 minutes
      maxLife: 240
    });

    // Cap decals to 140 max to keep performance buttery smooth
    if (this.bloodDecals.length > 140) {
      this.bloodDecals.shift();
    }
  }

  // Create blood or flesh splatter with visceral physics and optional dismemberment gibs
  spawnBlood(x, y, count = 7, color = '#a31818', isDismember = false) {
    // Fine arterial spray droplets
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 5.0;
      this.particles.push({
        x, y,
        prevX: x, prevY: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.8,
        life: 0.6 + Math.random() * 0.5,
        maxLife: 1.1,
        size: 1.6 + Math.random() * 2.4,
        color: color,
        gravity: 12.0,
        type: 'blood_drop'
      });
    }

    // Visceral blood mist puff
    this.particles.push({
      x: x + (Math.random() - 0.5) * 6,
      y: y + (Math.random() - 0.5) * 6,
      vx: (Math.random() - 0.5) * 1.5,
      vy: -0.8 - Math.random() * 1.2,
      life: 0.45,
      maxLife: 0.45,
      radius: 6 + Math.random() * 5,
      color: color === '#337719' ? 'rgba(51, 119, 25, 0.4)' : 'rgba(140, 20, 20, 0.45)',
      type: 'blood_mist'
    });

    // Chunkier flesh fragments on dismemberment or heavy hits
    if (isDismember) {
      const chunkCount = 3 + Math.floor(Math.random() * 3);
      for (let c = 0; c < chunkCount; c++) {
        const cAngle = (Math.random() - 0.5) * Math.PI * 1.5 - Math.PI / 2;
        const cSpeed = 2.5 + Math.random() * 4.5;
        this.particles.push({
          x, y,
          vx: Math.cos(cAngle) * cSpeed,
          vy: Math.sin(cAngle) * cSpeed,
          life: 0.8 + Math.random() * 0.4,
          maxLife: 1.2,
          size: 3.2 + Math.random() * 2.5,
          color: color === '#337719' ? '#204d11' : '#4a0808',
          gravity: 18.0,
          angle: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 12,
          type: 'flesh_chunk'
        });
      }
    }
  }

  // Calibrated high-impact muzzle flash with starbursts and dynamic light glow
  spawnMuzzleFlash(x, y, angle, tierIndex = 0) {
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const tipX = x + cosA * 4;
    const tipY = y + sinA * 4;

    if (tierIndex === 3) {
      // TIER 4: Heavy Plasma Cannon Flare & Arc Burst
      // High-intensity central plasma core
      this.particles.push({
        x: tipX, y: tipY,
        life: 0.12, maxLife: 0.12,
        size: 22,
        color: '#ffffff',
        type: 'plasma_flash',
        angle: angle
      });

      // Expanding cyan shockwave ring
      this.particles.push({
        x: tipX, y: tipY,
        life: 0.16, maxLife: 0.16,
        radius: 4, maxRadius: 36,
        color: '#00f3ff',
        type: 'plasma_ring'
      });

      // Crackling plasma electric arcs leaping out
      for (let a = 0; a < 5; a++) {
        const arcSpread = angle + (Math.random() - 0.5) * 1.6;
        const arcLen = 12 + Math.random() * 18;
        this.particles.push({
          x: tipX, y: tipY,
          tx: tipX + Math.cos(arcSpread) * arcLen,
          ty: tipY + Math.sin(arcSpread) * arcLen,
          life: 0.08 + Math.random() * 0.06,
          maxLife: 0.14,
          color: Math.random() > 0.4 ? '#00f3ff' : '#ffffff',
          type: 'electric_arc'
        });
      }
      return;
    }

    // Ballistic Muzzle Flashes (Tiers 0, 1, 2)
    let flashSize = 15;
    let spikeCount = 5;
    let spikeLen = 22;
    let coreColor = '#ffffff';
    let flareColor = '#ffea75';

    if (tierIndex === 1) {
      // Tier 2: Twin Autocannon (heavier, dual lateral brake vents)
      flashSize = 22;
      spikeCount = 6;
      spikeLen = 30;
      flareColor = '#ff9922';

      // Twin lateral muzzle brake exhaust jets at ±75 degrees
      const leftVentAngle = angle - 1.3;
      const rightVentAngle = angle + 1.3;
      for (const vAngle of [leftVentAngle, rightVentAngle]) {
        this.particles.push({
          x: tipX - cosA * 6,
          y: tipY - sinA * 6,
          vx: Math.cos(vAngle) * 5.5,
          vy: Math.sin(vAngle) * 5.5,
          life: 0.09, maxLife: 0.09,
          size: 9,
          color: '#ffaa33',
          type: 'flash_vent',
          angle: vAngle
        });
      }
    } else if (tierIndex === 2) {
      // Tier 3: Vulcan Minigun (high-cadence starburst flare with trailing heat haze)
      flashSize = 24;
      spikeCount = 8;
      spikeLen = 34;
      flareColor = '#ffd700';

      // Trailing barrel smoke wisp
      this.particles.push({
        x: tipX, y: tipY,
        vx: -cosA * 2 + (Math.random() - 0.5) * 1.5,
        vy: -sinA * 2 - 1.2,
        life: 0.35, maxLife: 0.35,
        radius: 4,
        color: 'rgba(180, 185, 190, 0.35)',
        type: 'smoke_puff'
      });
    }

    // Dynamic light starburst flash
    this.particles.push({
      x: tipX, y: tipY,
      life: 0.08, maxLife: 0.08,
      size: flashSize,
      spikeCount: spikeCount,
      spikeLen: spikeLen,
      coreColor: coreColor,
      flareColor: flareColor,
      type: 'starburst_flash',
      angle: angle
    });
  }

  // Tumbling brass bullet shell casing with realistic ground bouncing physics
  spawnCasing(x, y, dir = -1, tierIndex = 0) {
    if (tierIndex === 3) {
      // Plasma cannon has no brass casings; emits superheated coolant steam vent!
      this.spawnCoolantPuff(x, y, dir);
      return;
    }

    // Physical dimensions & weight by caliber
    let w = 4.2, h = 2.0, color = '#d4af37';
    if (tierIndex === 1) {
      // 20mm Autocannon casing (heavy brass, dark rim)
      w = 6.8; h = 3.2; color = '#cca028';
    } else if (tierIndex === 2) {
      // 7.62mm linked minigun brass
      w = 5.0; h = 2.4; color = '#e6c342';
    }

    this.particles.push({
      x, y,
      vx: dir * (2.2 + Math.random() * 2.8),
      vy: -3.2 - Math.random() * 2.4,
      angle: Math.random() * Math.PI * 2,
      vRot: (dir > 0 ? 1 : -1) * (18 + Math.random() * 22),
      width: w,
      height: h,
      color: color,
      bounces: 0,
      maxBounces: 3,
      settled: false,
      gravity: 16.5,
      life: 4.5, // Lingers on the ground as spent battlefield brass
      maxLife: 4.5,
      isCasing: true,
      type: 'brass_casing'
    });
  }

  // Coolant steam discharge for plasma weaponry
  spawnCoolantPuff(x, y, dir = -1) {
    for (let i = 0; i < 3; i++) {
      this.particles.push({
        x: x + dir * 6,
        y: y - 2 + (Math.random() - 0.5) * 4,
        vx: dir * (2.0 + Math.random() * 2.5),
        vy: -1.5 - Math.random() * 1.8,
        radius: 3.5,
        color: 'rgba(0, 240, 255, 0.45)',
        life: 0.4 + Math.random() * 0.25,
        maxLife: 0.65,
        type: 'coolant_puff'
      });
    }
  }

  // High-velocity incandescent sparks with drag and gravity streaks
  spawnSparks(x, y, count = 12, color = '#ff9922', isImpact = false, normalAngle = null) {
    for (let i = 0; i < count; i++) {
      let angle;
      let speed;

      if (normalAngle !== null) {
        // Directed ricochet spray cone
        angle = normalAngle + (Math.random() - 0.5) * 1.3;
        speed = 3.5 + Math.random() * 6.5;
      } else {
        angle = Math.random() * Math.PI * 2;
        speed = 2.5 + Math.random() * 5.8;
      }

      this.particles.push({
        x, y,
        prevX: x, prevY: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.6,
        life: 0.35 + Math.random() * 0.4,
        maxLife: 0.75,
        size: 1.8 + Math.random() * 1.5,
        color: color,
        gravity: 10.5,
        type: 'spark_streak'
      });
    }
  }

  // Specialized armor impact ricochet sparks
  spawnImpactSparks(x, y, normalAngle = 0, isArmor = true) {
    const sparkColor = isArmor ? '#fff2a8' : '#ff9933';
    this.spawnSparks(x, y, isArmor ? 18 : 10, sparkColor, true, normalAngle);

    // Dynamic bright impact flash dot
    this.particles.push({
      x, y,
      life: 0.06, maxLife: 0.06,
      size: 10,
      color: '#ffffff',
      type: 'impact_flash'
    });
  }

  // Plasma projectile detonation sparks & scorch aura
  spawnPlasmaImpact(x, y) {
    this.spawnSparks(x, y, 16, '#00f3ff');
    this.particles.push({
      x, y,
      life: 0.22, maxLife: 0.22,
      radius: 4, maxRadius: 28,
      color: '#00f3ff',
      type: 'plasma_ring'
    });
  }

  // Multi-particle volumetric chimney smoke puff with thermal buoyancy and embers
  spawnSmokePuff(x, y, radius = 6, color = null) {
    const tones = ['rgba(218, 222, 230, ', 'rgba(188, 195, 205, ', 'rgba(238, 241, 245, '];
    // Spawn 2 micro-puffs to form an organic volumetric cluster
    for (let i = 0; i < 2; i++) {
      const puffRadius = radius * (0.85 + Math.random() * 0.45);
      const tone = color || tones[Math.floor(Math.random() * tones.length)];
      this.chimneySmoke.push({
        x: x + (Math.random() - 0.5) * 4,
        y: y + (Math.random() - 0.5) * 3,
        vx: -12 - Math.random() * 10,
        vy: -24 - Math.random() * 12,
        initialRadius: puffRadius,
        radius: puffRadius,
        maxRadius: puffRadius * (4.0 + Math.random() * 1.5),
        tone: tone,
        life: 2.8 + Math.random() * 0.8,
        maxLife: 3.6,
        curlPhase: Math.random() * Math.PI * 2,
        curlSpeed: 2.0 + Math.random() * 2.2,
        curlAmp: 5 + Math.random() * 6
      });
    }

    // Occasional glowing ember spark drifting up from hearth fire
    if (Math.random() < 0.28) {
      this.chimneyEmbers.push({
        x: x + (Math.random() - 0.5) * 5,
        y: y,
        vx: -7 - Math.random() * 10,
        vy: -26 - Math.random() * 18,
        wobble: Math.random() * Math.PI * 2,
        size: 1.2 + Math.random() * 1.4,
        life: 0.9 + Math.random() * 0.7,
        maxLife: 1.6,
        color: Math.random() > 0.35 ? '#f39c12' : '#f1c40f'
      });
    }
  }

  // Bullet tracer line (ballistic or hyper-ionized plasma)
  addTracer(x1, y1, x2, y2, color = '#ffe57f', isPlasma = false) {
    this.tracers.push({
      x1, y1, x2, y2,
      life: isPlasma ? 0.12 : 0.08,
      maxLife: isPlasma ? 0.12 : 0.08,
      color,
      isPlasma
    });
  }

  // Floating notification text (e.g. +ammo, damage, CRIT)
  addFloatingText(text, x, y, color = '#ffffff') {
    this.floatingTexts.push({
      text,
      x, y,
      vy: -24,
      life: 1.3,
      maxLife: 1.3,
      color
    });
  }

  // Acid projectile fired by Spitters
  spawnAcidSpit(x, y, targetX, targetY, damage) {
    const angle = Math.atan2(targetY - y, targetX - x);
    const speed = 250;
    this.spitProjectiles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      targetX, targetY,
      damage,
      life: 2.0
    });
  }

  // Boiling Acid Puddle Hazard on the ground with toxic vapor steam
  spawnAcidPuddle(x, y, damage = 3.5, duration = CONFIG.ACID_PUDDLE_DURATION || 8.0) {
    this.acidPuddles.push({
      x: Math.max(80, Math.min(1200, x)),
      y: CONFIG.SURFACE_Y - 2,
      radius: 28,
      damage: damage,
      life: duration,
      maxLife: duration,
      sizzleTimer: 0,
      bubbles: [
        { ox: -12, oy: -1, r: 3.0, phase: Math.random() * 6 },
        { ox: 3, oy: -2, r: 4.0, phase: Math.random() * 6 },
        { ox: 14, oy: 0, r: 2.5, phase: Math.random() * 6 },
        { ox: -4, oy: 1, r: 3.2, phase: Math.random() * 6 }
      ]
    });
  }

  update(dt, dayTime = 12) {
    // Safety cap on active particles to guarantee strictly bounded memory
    if (this.particles.length > 400) {
      this.particles.splice(0, this.particles.length - 400);
    }
    if (this.tracers.length > 50) {
      this.tracers.splice(0, this.tracers.length - 50);
    }
    if (this.floatingTexts.length > 40) {
      this.floatingTexts.splice(0, this.floatingTexts.length - 40);
    }
    if (this.chimneySmoke.length > 40) {
      this.chimneySmoke.splice(0, this.chimneySmoke.length - 40);
    }
    if (this.acidPuddles.length > 25) {
      this.acidPuddles.splice(0, this.acidPuddles.length - 25);
    }

    // Update generic particles & spent brass physics
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      if (p.type === 'brass_casing') {
        // Tumbling Brass Physics
        if (!p.settled) {
          p.vy += p.gravity * dt;
          p.x += p.vx * dt * 40;
          p.y += p.vy * dt * 40;
          p.angle += p.vRot * dt;

          // Ground bounce collision
          if (p.y >= CONFIG.SURFACE_Y - 2) {
            p.y = CONFIG.SURFACE_Y - 2;
            if (p.bounces < p.maxBounces && Math.abs(p.vy) > 0.8) {
              p.vy = -Math.abs(p.vy) * (0.38 + Math.random() * 0.16);
              p.vx *= 0.62;
              p.vRot = (Math.random() - 0.5) * 16;
              p.bounces++;
            } else {
              // Settled flat on ground
              p.settled = true;
              p.vx = 0;
              p.vy = 0;
              p.vRot = 0;
              p.angle = (Math.random() - 0.5) * 0.35;
            }
          }
        }
        continue;
      }

      if (p.type === 'spark_streak') {
        p.prevX = p.x;
        p.prevY = p.y;
        p.x += p.vx * dt * 40;
        p.y += p.vy * dt * 40;
        p.vy += p.gravity * dt;
        p.vx *= Math.pow(0.93, dt * 40); // Air resistance drag
        continue;
      }

      if (p.type === 'blood_drop') {
        p.prevX = p.x;
        p.prevY = p.y;
        p.x += p.vx * dt * 40;
        p.y += p.vy * dt * 40;
        p.vy += p.gravity * dt;
        continue;
      }

      if (p.type === 'toxic_steam') {
        p.phase += dt * 3.2;
        p.x += (p.vx + Math.sin(p.phase) * 10) * dt;
        p.y += p.vy * dt;
        p.radius += dt * 7.5;
        continue;
      }

      if (p.type === 'coolant_puff' || p.type === 'smoke_puff') {
        p.x += p.vx * dt * 40;
        p.y += p.vy * dt * 40;
        p.radius += dt * 8.0;
        continue;
      }

      if (p.type === 'plasma_ring') {
        p.radius += (p.maxRadius - p.radius) * Math.min(1, dt * 18);
        continue;
      }

      // Standard particle motion
      p.x += (p.vx || 0) * dt * 40;
      p.y += (p.vy || 0) * dt * 40;
      if (p.gravity) {
        p.vy += p.gravity * dt;
      }
    }

    // Update tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.tracers.splice(i, 1);
      }
    }

    // Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.y += ft.vy * dt;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // Update leaves
    for (const leaf of this.leaves) {
      leaf.x += leaf.speedX;
      leaf.y += leaf.speedY;
      if (leaf.x < 0) leaf.x = 1280;
      if (leaf.y > CONFIG.SURFACE_Y) {
        leaf.y = 0;
        leaf.x = Math.random() * 1280;
      }
    }

    // Update falling pine needles with aerodynamic tumbling & wind sway
    for (const needle of this.pineNeedles) {
      needle.swayPhase += dt * 3.4;
      needle.x += (needle.speedX + Math.sin(needle.swayPhase) * needle.swayAmp) * dt;
      needle.y += needle.speedY * dt;
      needle.angle += needle.rotSpeed * dt;
      if (needle.y > CONFIG.SURFACE_Y - 2 || needle.x < -30 || needle.x > 1310) {
        needle.y = 10 + Math.random() * 80;
        const isLeft = Math.random() < 0.5;
        needle.x = isLeft ? Math.random() * 420 : 860 + Math.random() * 420;
      }
    }

    // Update ambient atmospheric forest spores / floating pollen
    for (const sp of this.ambientSpores) {
      sp.phase += dt * 1.6;
      sp.x += sp.vx * dt;
      sp.y += (sp.vy + Math.sin(sp.phase) * 5) * dt;
      if (sp.x < -10) {
        sp.x = 1290;
        sp.y = 30 + Math.random() * (CONFIG.SURFACE_Y - 40);
      }
    }

    // Update ground fog wisps
    for (const f of this.fogPuffs) {
      f.x += f.speedX * dt;
      f.phase += dt * 0.8;
      if (f.x < -100) {
        f.x = 1380;
        f.y = f.tier === 0 ? CONFIG.SURFACE_Y - 14 + Math.random() * 16 : CONFIG.SURFACE_Y - 38 + Math.random() * 26;
      }
    }

    // Update chimney smoke with thermal deceleration, buoyancy, and vortex curls
    for (let i = this.chimneySmoke.length - 1; i >= 0; i--) {
      const s = this.chimneySmoke[i];
      s.life -= dt;
      if (s.life <= 0) {
        this.chimneySmoke.splice(i, 1);
        continue;
      }
      s.curlPhase += (s.curlSpeed || 2.0) * dt;
      s.vy = (s.vy || -20) * Math.pow(0.92, dt * 25);
      s.x += ((s.vx || -10) + Math.sin(s.curlPhase) * (s.curlAmp || 5)) * dt;
      s.y += (s.vy - 6) * dt;
      const progress = 1 - (s.life / s.maxLife);
      s.radius = (s.initialRadius || 5) + ((s.maxRadius || 24) - (s.initialRadius || 5)) * Math.sin(progress * Math.PI * 0.5);
    }

    // Update chimney embers (glowing hearth fire sparks)
    if (this.chimneyEmbers) {
      for (let i = this.chimneyEmbers.length - 1; i >= 0; i--) {
        const e = this.chimneyEmbers[i];
        e.life -= dt;
        if (e.life <= 0) {
          this.chimneyEmbers.splice(i, 1);
          continue;
        }
        e.wobble += dt * 5.5;
        e.x += (e.vx + Math.sin(e.wobble) * 8) * dt;
        e.y += e.vy * dt;
        e.vy += 14 * dt; // gravity slows rising sparks
      }
    }

    // Update blood decals (slow fade over time)
    for (let i = this.bloodDecals.length - 1; i >= 0; i--) {
      const d = this.bloodDecals[i];
      d.life -= dt;
      if (d.life <= 0) {
        this.bloodDecals.splice(i, 1);
      }
    }

    // Update acid spit projectiles
    for (let i = this.spitProjectiles.length - 1; i >= 0; i--) {
      const s = this.spitProjectiles[i];
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      // Check impact with ground or house
      if (s.y >= CONFIG.SURFACE_Y - 10 || Math.abs(s.x - 640) < 60 || s.life <= 0) {
        this.spawnBlood(s.x, s.y, 10, '#55ff22');
        this.spawnBloodDecal(s.x, CONFIG.SURFACE_Y, '#2f7516', 8, 5);
        this.spawnAcidPuddle(s.x, CONFIG.SURFACE_Y, s.damage);
        if (window.gameEngine) {
          window.gameEngine.damageHouse(s.damage);
        }
        this.spitProjectiles.splice(i, 1);
      }
    }

    // Update boiling acid puddles (toxic ground hazards)
    for (let i = this.acidPuddles.length - 1; i >= 0; i--) {
      const p = this.acidPuddles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.acidPuddles.splice(i, 1);
        continue;
      }

      // Sizzle toxic vapor steam rising from boiling puddle
      p.sizzleTimer -= dt;
      if (p.sizzleTimer <= 0) {
        p.sizzleTimer = 0.12;
        const ox = (Math.random() - 0.5) * p.radius * 1.6;
        this.particles.push({
          x: p.x + ox,
          y: p.y - 3,
          vx: (Math.random() - 0.5) * 4,
          vy: -14 - Math.random() * 12,
          radius: 3.5,
          phase: Math.random() * Math.PI * 2,
          life: 0.65 + Math.random() * 0.35,
          maxLife: 1.0,
          color: 'rgba(123, 237, 159, 0.45)',
          type: 'toxic_steam'
        });
      }

      // Area of effect damage over time
      const engine = window.gameEngine;
      if (engine) {
        // Damage house barricade if puddle overlaps cabin (cabin x: 575 to 705)
        if (p.x >= 550 && p.x <= 730) {
          engine.damageHouse(CONFIG.ACID_PUDDLE_DPS * dt);
        }
        // Damage turrets if puddle near turret
        if (Math.abs(p.x - engine.leftTurret.x) < p.radius + 15) {
          engine.leftTurret.health = Math.max(0, engine.leftTurret.health - CONFIG.ACID_PUDDLE_DPS * dt * 0.5);
        }
        if (Math.abs(p.x - engine.rightTurret.x) < p.radius + 15) {
          engine.rightTurret.health = Math.max(0, engine.rightTurret.health - CONFIG.ACID_PUDDLE_DPS * dt * 0.5);
        }
        // Damage survivors walking across surface
        for (const s of engine.survivors) {
          if (!s.isDead && s.y <= CONFIG.SURFACE_Y + 5 && Math.abs(s.x - p.x) < p.radius + 10) {
            s.hp = Math.max(0, s.hp - CONFIG.ACID_PUDDLE_DPS * dt);
            if (Math.random() < 0.04 && !s.speechText) {
              s.say("Toxic acid burn!", 2);
            }
          }
        }
      }
    }
  }

  // Draw persistent ground blood decals
  drawDecals(ctx) {
    for (const d of this.bloodDecals) {
      const alpha = Math.min(0.85, (d.life / d.maxLife) * 1.2);
      ctx.save();
      ctx.globalAlpha = alpha;

      // Base pool
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, d.baseRadius * 1.3, d.baseRadius * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();

      // Core dried dark spot
      ctx.fillStyle = d.coreColor || '#360505';
      ctx.beginPath();
      ctx.ellipse(d.x + 1, d.y, d.baseRadius * 0.7, d.baseRadius * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();

      // Droplet splatters radiating outwards
      ctx.fillStyle = d.color;
      for (const sp of d.splats) {
        ctx.beginPath();
        ctx.arc(d.x + sp.dx, d.y + sp.dy, sp.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // Draw atmospheric ground fog and rolling mist across forest floor
  drawFog(ctx, dayTime = 12) {
    const isNight = dayTime < 5.0 || dayTime >= 21.0;
    const isDawn = dayTime >= 5.0 && dayTime < 8.5;
    const isDusk = dayTime >= 16.5 && dayTime < 19.5;
    const isTwilight = dayTime >= 19.5 && dayTime < 21.0;
    const isHorde = window.gameEngine && window.gameEngine.waveManager && window.gameEngine.waveManager.isHordeActive;

    let timeMultiplier = 0.45;
    let fogColorInner, fogColorOuter;

    if (isHorde) {
      timeMultiplier = 1.35;
      fogColorInner = 'rgba(85, 30, 30, ';
      fogColorOuter = 'rgba(45, 15, 15, 0)';
    } else if (isNight) {
      timeMultiplier = 1.25;
      fogColorInner = 'rgba(32, 46, 60, ';
      fogColorOuter = 'rgba(16, 24, 34, 0)';
    } else if (isTwilight) {
      timeMultiplier = 0.95;
      fogColorInner = 'rgba(65, 52, 75, ';
      fogColorOuter = 'rgba(38, 30, 45, 0)';
    } else if (isDusk) {
      timeMultiplier = 0.85;
      fogColorInner = 'rgba(125, 88, 85, ';
      fogColorOuter = 'rgba(70, 48, 50, 0)';
    } else if (isDawn) {
      timeMultiplier = 0.90;
      fogColorInner = 'rgba(170, 130, 105, ';
      fogColorOuter = 'rgba(95, 70, 55, 0)';
    } else {
      timeMultiplier = 0.45;
      fogColorInner = 'rgba(215, 230, 240, ';
      fogColorOuter = 'rgba(180, 200, 210, 0)';
    }

    ctx.save();
    for (const f of this.fogPuffs) {
      const wave = Math.sin(f.phase) * 0.28 + 0.72;
      const alpha = f.baseAlpha * timeMultiplier * wave;
      if (alpha <= 0.01) continue;

      const grad = ctx.createRadialGradient(f.x, f.y, f.radiusY * 0.25, f.x, f.y, f.radiusX);
      grad.addColorStop(0, fogColorInner + alpha.toFixed(3) + ')');
      grad.addColorStop(0.65, fogColorInner + (alpha * 0.45).toFixed(3) + ')');
      grad.addColorStop(1, fogColorOuter);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, f.radiusX, f.radiusY, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  draw(ctx) {
    // 1. Draw volumetric chimney smoke with soft radial diffusion
    for (const s of this.chimneySmoke) {
      const alpha = Math.max(0, (s.life / s.maxLife) * 0.42);
      if (alpha <= 0.01) continue;
      ctx.save();
      const grad = ctx.createRadialGradient(s.x, s.y, s.radius * 0.15, s.x, s.y, s.radius);
      const toneBase = s.tone || 'rgba(218, 222, 230, ';
      grad.addColorStop(0, toneBase + alpha.toFixed(3) + ')');
      grad.addColorStop(0.55, toneBase + (alpha * 0.52).toFixed(3) + ')');
      grad.addColorStop(1, toneBase + '0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. Draw glowing chimney embers drifting from hearth fire
    for (const e of this.chimneyEmbers) {
      const alpha = Math.max(0, e.life / e.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = e.color;
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3. Draw falling pine needles drifting through the canopy
    for (const needle of this.pineNeedles) {
      ctx.save();
      ctx.translate(needle.x, needle.y);
      ctx.rotate(needle.angle);
      ctx.strokeStyle = needle.color;
      ctx.lineWidth = needle.width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-needle.length * 0.5, 0);
      ctx.lineTo(needle.length * 0.5, 0);
      ctx.stroke();
      ctx.restore();
    }

    // 4. Draw ambient forest spores and pollen motes
    for (const sp of this.ambientSpores) {
      const alpha = sp.alpha * (0.6 + Math.sin(sp.phase) * 0.4);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#fffae6';
      ctx.shadowColor = '#fff3b0';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 5. Draw leaves
    for (const leaf of this.leaves) {
      ctx.fillStyle = leaf.color;
      ctx.beginPath();
      ctx.arc(leaf.x, leaf.y, leaf.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw bullet tracers & plasma ion beams
    for (const t of this.tracers) {
      const alpha = Math.max(0, t.life / t.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;

      if (t.isPlasma) {
        // High-energy Plasma Ion Beam: Wide cyan aura + bright white core + crackling filament
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.4)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(t.x1, t.y1);
        ctx.lineTo(t.x2, t.y2);
        ctx.stroke();

        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 3.5;
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        // Electric micro-filament deviation
        const midX = (t.x1 + t.x2) * 0.5 + (Math.random() - 0.5) * 8;
        const midY = (t.y1 + t.y2) * 0.5 + (Math.random() - 0.5) * 8;
        ctx.strokeStyle = '#e0ffff';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(t.x1, t.y1);
        ctx.lineTo(midX, midY);
        ctx.lineTo(t.x2, t.y2);
        ctx.stroke();
      } else {
        // Ballistic bullet tracer
        ctx.strokeStyle = t.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(t.x1, t.y1);
        ctx.lineTo(t.x2, t.y2);
        ctx.stroke();

        // White-hot core
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.0;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Draw boiling ground acid puddles with animated caustic bubbles
    for (const p of this.acidPuddles) {
      const alpha = Math.min(0.88, (p.life / p.maxLife) * 1.3);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = '#2ed573';
      ctx.shadowBlur = 14;

      // Outer scorched earth caustic border
      ctx.fillStyle = '#173d15';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.radius * 1.3, p.radius * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();

      // Glowing bubbling green chemical pool
      ctx.fillStyle = '#2ed573';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.radius * 0.98, p.radius * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();

      // Inner chartreuse core
      ctx.fillStyle = '#7bed9f';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.radius * 0.65, p.radius * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();

      // Boiling popping bubbles
      ctx.fillStyle = '#e8ffea';
      for (const b of p.bubbles) {
        b.phase += 0.06;
        const bScale = (Math.sin(b.phase) + 1) * 0.5;
        if (bScale > 0.05) {
          ctx.beginPath();
          ctx.arc(p.x + b.ox, p.y + b.oy, b.r * bScale, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // Draw acid spit projectiles
    for (const s of this.spitProjectiles) {
      ctx.save();
      ctx.fillStyle = '#66ff22';
      ctx.shadowColor = '#66ff22';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw all particle types
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;

      if (p.type === 'brass_casing') {
        // Tumbling Brass Shell Casing with metallic highlight and rim
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.width * 0.5, -p.height * 0.5, p.width, p.height);

        // Dark rim extractor groove
        ctx.fillStyle = '#7a5a10';
        ctx.fillRect(-p.width * 0.5, -p.height * 0.5, p.width * 0.2, p.height);

        // Specular brass shine
        ctx.fillStyle = '#fff4a3';
        ctx.fillRect(-p.width * 0.3, -p.height * 0.4, p.width * 0.6, p.height * 0.3);
      } else if (p.type === 'starburst_flash') {
        // Multi-point starburst muzzle flash
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);

        // Outer glow flare
        ctx.fillStyle = p.flareColor;
        ctx.shadowColor = p.flareColor;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.6, 0, Math.PI * 2);
        ctx.fill();

        // Radiating starburst spikes
        ctx.strokeStyle = p.flareColor;
        ctx.lineWidth = 2.2;
        const spikes = p.spikeCount || 5;
        const len = p.spikeLen || 24;
        ctx.beginPath();
        for (let s = 0; s < spikes; s++) {
          const sAngle = (s / spikes) * Math.PI * 1.5 - Math.PI * 0.75;
          const sLen = s === 0 ? len : len * (0.5 + Math.random() * 0.4);
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(sAngle) * sLen, Math.sin(sAngle) * sLen);
        }
        ctx.stroke();

        // White-hot inner core
        ctx.fillStyle = p.coreColor || '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.35, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'plasma_flash') {
        // Cyan plasma muzzle flare
        ctx.fillStyle = '#00f3ff';
        ctx.shadowColor = '#00f3ff';
        ctx.shadowBlur = 24;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.75, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'plasma_ring') {
        // Expanding plasma shockwave ring
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.0;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'electric_arc') {
        // Crackling electric arc filament
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.4;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        const midX = (p.x + p.tx) * 0.5 + (Math.random() - 0.5) * 6;
        const midY = (p.y + p.ty) * 0.5 + (Math.random() - 0.5) * 6;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(midX, midY);
        ctx.lineTo(p.tx, p.ty);
        ctx.stroke();
      } else if (p.type === 'flash_vent') {
        // Lateral muzzle brake gas vent jet
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'spark_streak') {
        // Incandescent motion streak spark
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.prevX, p.prevY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();

        // White-hot head
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'blood_drop') {
        // Arterial blood droplet streak
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.prevX, p.prevY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      } else if (p.type === 'flesh_chunk') {
        // Tumbling flesh/gib chunk
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size * 0.5, -p.size * 0.4, p.size, p.size * 0.8);
      } else if (p.type === 'toxic_steam' || p.type === 'blood_mist' || p.type === 'coolant_puff' || p.type === 'smoke_puff') {
        // Soft radial vapor cloud
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'impact_flash') {
        // Dynamic impact dot
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Fallback generic particle
        ctx.fillStyle = p.color || '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size || 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // Draw floating texts
    for (const ft of this.floatingTexts) {
      const alpha = Math.max(0, ft.life / ft.maxLife);
      ctx.save();
      ctx.font = 'bold 12px "Courier New", monospace';
      ctx.fillStyle = ft.color;
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 5;
      ctx.globalAlpha = alpha;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }
}

window.ParticleSystem = ParticleSystem;
