// Visual FX and Particle System
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
    this.acidPuddles = [];

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

  // Create blood or flesh splatter
  spawnBlood(x, y, count = 7, color = '#a31818') {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.2 + Math.random() * 4.0;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2,
        life: 0.6 + Math.random() * 0.45,
        maxLife: 1.0,
        size: 1.5 + Math.random() * 2.5,
        color: color,
        gravity: 9.8
      });
    }
  }

  // Muzzle flash with dynamic light flare
  spawnMuzzleFlash(x, y, angle) {
    this.particles.push({
      x: x + Math.cos(angle) * 18,
      y: y + Math.sin(angle) * 18,
      vx: 0, vy: 0,
      life: 0.09,
      maxLife: 0.09,
      size: 14 + Math.random() * 8,
      color: '#ffea75',
      type: 'flash',
      angle: angle
    });
  }

  // Brass bullet shell casing with ground bounce
  spawnCasing(x, y, dir = -1) {
    this.particles.push({
      x, y,
      vx: dir * (1.8 + Math.random() * 2.2),
      vy: -2.8 - Math.random() * 2.0,
      life: 1.2,
      maxLife: 1.2,
      size: 3,
      color: '#d4af37',
      gravity: 14,
      isCasing: true,
      bounces: 0
    });
  }

  // Sparks / explosion debris
  spawnSparks(x, y, count = 12, color = '#ff9922') {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 5.5;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.2,
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8,
        size: 2.2,
        color: color,
        gravity: 8.5
      });
    }
  }

  // Chimney smoke puff
  spawnSmokePuff(x, y, radius = 6, color = 'rgba(210, 215, 220, 0.4)') {
    this.chimneySmoke.push({
      x, y,
      vx: -8 - Math.random() * 8,
      vy: -14 - Math.random() * 10,
      radius,
      color,
      life: 2.2,
      maxLife: 2.2
    });
  }

  // Bullet tracer
  addTracer(x1, y1, x2, y2, color = '#ffe57f') {
    this.tracers.push({
      x1, y1, x2, y2,
      life: 0.08,
      maxLife: 0.08,
      color
    });
  }

  // Floating text (e.g. +ammo, damage)
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

  // Acid projectile
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

  // Acid Puddle Hazard on the ground
  spawnAcidPuddle(x, y, damage = 3.5, duration = CONFIG.ACID_PUDDLE_DURATION || 8.0) {
    this.acidPuddles.push({
      x: Math.max(80, Math.min(1200, x)),
      y: CONFIG.SURFACE_Y - 2,
      radius: 26,
      damage: damage,
      life: duration,
      maxLife: duration,
      sizzleTimer: 0,
      bubbles: [
        { ox: -10, oy: -1, r: 2.5, phase: 0 },
        { ox: 5, oy: -2, r: 3.5, phase: 2 },
        { ox: 13, oy: 0, r: 2.0, phase: 4 }
      ]
    });
  }

  update(dt, dayTime = 12) {
    // Update generic particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += (p.vx || 0) * dt * 40;
      p.y += (p.vy || 0) * dt * 40;
      if (p.gravity) {
        p.vy += p.gravity * dt;
      }

      // Casing ground bounce
      if (p.isCasing && p.y >= CONFIG.SURFACE_Y - 2 && (p.bounces || 0) < 2) {
        p.y = CONFIG.SURFACE_Y - 2;
        p.vy = -p.vy * 0.42;
        p.vx *= 0.6;
        p.bounces = (p.bounces || 0) + 1;
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

    // Update ground fog wisps
    for (const f of this.fogPuffs) {
      f.x += f.speedX * dt;
      f.phase += dt * 0.8;
      if (f.x < -100) {
        f.x = 1380;
        f.y = CONFIG.SURFACE_Y - 30 + Math.random() * 35;
      }
    }

    // Update chimney smoke
    for (let i = this.chimneySmoke.length - 1; i >= 0; i--) {
      const s = this.chimneySmoke[i];
      s.life -= dt;
      if (s.life <= 0) {
        this.chimneySmoke.splice(i, 1);
        continue;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.radius += dt * 6.5;
    }

    // Update blood decals (slow fade over time)
    for (let i = this.bloodDecals.length - 1; i >= 0; i--) {
      const d = this.bloodDecals[i];
      d.life -= dt;
      if (d.life <= 0) {
        this.bloodDecals.splice(i, 1);
      }
    }

    // Update acid spit
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

    // Update acid puddles (toxic ground hazards)
    for (let i = this.acidPuddles.length - 1; i >= 0; i--) {
      const p = this.acidPuddles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.acidPuddles.splice(i, 1);
        continue;
      }

      // Sizzle steam and toxic bubble particles
      p.sizzleTimer -= dt;
      if (p.sizzleTimer <= 0) {
        p.sizzleTimer = 0.14;
        const ox = (Math.random() - 0.5) * p.radius * 1.5;
        this.particles.push({
          x: p.x + ox,
          y: p.y - 2,
          vx: (Math.random() - 0.5) * 6,
          vy: -12 - Math.random() * 10,
          life: 0.5,
          maxLife: 0.5,
          size: 2.0,
          color: '#7bed9f'
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

  // Draw atmospheric ground fog and mist
  drawFog(ctx, dayTime = 12) {
    const isNight = dayTime < 6.0 || dayTime >= 20.0;
    const isDuskDawn = (dayTime >= 6.0 && dayTime < 8.5) || (dayTime >= 17.5 && dayTime < 20.0);
    
    // Thicker fog at night & dusk/dawn
    let timeMultiplier = 0.4;
    let fogColorInner, fogColorOuter;

    if (isNight) {
      timeMultiplier = 1.25;
      fogColorInner = 'rgba(40, 58, 75, ';
      fogColorOuter = 'rgba(20, 32, 45, 0)';
    } else if (isDuskDawn) {
      timeMultiplier = 0.85;
      fogColorInner = 'rgba(120, 110, 105, ';
      fogColorOuter = 'rgba(70, 65, 60, 0)';
    } else {
      timeMultiplier = 0.45;
      fogColorInner = 'rgba(215, 230, 240, ';
      fogColorOuter = 'rgba(180, 200, 210, 0)';
    }

    ctx.save();
    for (const f of this.fogPuffs) {
      const wave = Math.sin(f.phase) * 0.25 + 0.75;
      const alpha = f.baseAlpha * timeMultiplier * wave;
      if (alpha <= 0.01) continue;

      const grad = ctx.createRadialGradient(f.x, f.y, f.radiusY * 0.3, f.x, f.y, f.radiusX);
      grad.addColorStop(0, fogColorInner + alpha.toFixed(3) + ')');
      grad.addColorStop(0.7, fogColorInner + (alpha * 0.45).toFixed(3) + ')');
      grad.addColorStop(1, fogColorOuter);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, f.radiusX, f.radiusY, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  draw(ctx) {
    // Draw chimney smoke
    for (const s of this.chimneySmoke) {
      const alpha = Math.max(0, (s.life / s.maxLife) * 0.38);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw leaves
    for (const leaf of this.leaves) {
      ctx.fillStyle = leaf.color;
      ctx.beginPath();
      ctx.arc(leaf.x, leaf.y, leaf.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw bullet tracers
    for (const t of this.tracers) {
      const alpha = Math.max(0, t.life / t.maxLife);
      ctx.save();
      ctx.strokeStyle = t.color;
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      ctx.lineTo(t.x2, t.y2);
      ctx.stroke();

      // Glow core
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    // Draw ground acid puddles
    for (const p of this.acidPuddles) {
      const alpha = Math.min(0.88, (p.life / p.maxLife) * 1.3);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = '#2ed573';
      ctx.shadowBlur = 12;

      // Outer acidic burn ring
      ctx.fillStyle = '#1e5e1b';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.radius * 1.25, p.radius * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();

      // Glowing toxic green core pool
      ctx.fillStyle = '#2ed573';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.radius * 0.95, p.radius * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();

      // Bubbles
      ctx.fillStyle = '#7bed9f';
      for (const b of p.bubbles) {
        b.phase += 0.05;
        const bScale = (Math.sin(b.phase) + 1) * 0.5;
        ctx.beginPath();
        ctx.arc(p.x + b.ox, p.y + b.oy, b.r * bScale, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Draw acid spit
    for (const s of this.spitProjectiles) {
      ctx.save();
      ctx.fillStyle = '#66ff22';
      ctx.shadowColor = '#66ff22';
      ctx.shadowBlur = 9;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw particles
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;

      if (p.type === 'flash') {
        ctx.fillStyle = p.color;
        ctx.shadowColor = '#ffea75';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.isCasing) {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 3, 1.5);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
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
