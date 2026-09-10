// Zombie AI, Waves, and Spawning System
class Zombie {
  constructor(typeKey, side = 'left') {
    this.typeKey = typeKey;
    const base = CONFIG.ZOMBIE_TYPES[typeKey] || CONFIG.ZOMBIE_TYPES.shambler;
    this.name = base.name;
    this.maxHp = base.hp;
    this.hp = base.hp;
    this.speed = base.speed * (0.85 + Math.random() * 0.3);
    this.damage = base.damage;
    this.color = base.color;
    this.size = base.size;
    this.reward = base.reward;
    this.side = side;
    
    // Spawn at outer forest edge
    this.x = side === 'left' ? -15 - Math.random() * 40 : 1295 + Math.random() * 40;
    this.y = CONFIG.SURFACE_Y;

    this.walkCycle = Math.random() * Math.PI * 2;
    this.attackCooldown = 0;
    this.attackRate = 1.2;
    this.range = base.range || 25;
    this.spitCooldown = 2.0;

    this.hitFlash = 0;
    this.isDead = false;
  }

  takeDamage(amount) {
    if (this.isDead) return true;
    this.hp -= amount;
    this.hitFlash = 0.08;
    window.gameEngine.particles.spawnBlood(this.x, this.y - this.size * 0.6, 5);
    window.soundSystem.playZombieHit();

    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
      this.die();
      return true;
    }
    return false;
  }

  die() {
    const bloodColor = this.typeKey === 'spitter' ? '#337719' : '#6b1111';
    window.gameEngine.particles.spawnBlood(this.x, this.y - this.size * 0.5, 14, bloodColor);

    // Persistent ground blood decal
    const decalRadius = this.typeKey === 'brute' ? 14 : this.size * 0.45;
    const splatCount = this.typeKey === 'brute' ? 8 : 5;
    window.gameEngine.particles.spawnBloodDecal(this.x, CONFIG.SURFACE_Y, bloodColor, decalRadius, splatCount);

    if (this.typeKey === 'brute') {
      window.soundSystem.playExplosion();
      window.gameEngine.particles.spawnSparks(this.x, this.y - 15, 30, '#ff4422');
    }

    // Award resources
    if (this.reward) {
      if (this.reward.metal) {
        window.gameEngine.resources.metal = Math.min(
          CONFIG.RESOURCE_CAPS.metal,
          window.gameEngine.resources.metal + this.reward.metal
        );
        window.gameEngine.particles.addFloatingText(`+${this.reward.metal} Metal`, this.x - 15, this.y - 30, '#9cdcfe');
      }
      if (this.reward.gunpowder) {
        window.gameEngine.resources.gunpowder = Math.min(
          CONFIG.RESOURCE_CAPS.gunpowder,
          window.gameEngine.resources.gunpowder + this.reward.gunpowder
        );
        window.gameEngine.particles.addFloatingText(`+${this.reward.gunpowder} Powder`, this.x + 10, this.y - 45, '#e0aaff');
      }
    }

    // Chance to drop bonus ammo crate
    if (Math.random() < 0.25) {
      const dropAmmo = 10 + Math.floor(Math.random() * 15);
      window.gameEngine.resources.ammo = Math.min(
        CONFIG.RESOURCE_CAPS.ammo,
        window.gameEngine.resources.ammo + dropAmmo
      );
      window.gameEngine.particles.addFloatingText(`+${dropAmmo} AMMO!`, this.x, this.y - 55, '#f1c40f');
    }

    window.gameEngine.stats.zombiesKilled++;
  }

  update(dt) {
    if (this.isDead) return;

    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
    }
    if (this.attackCooldown > 0) {
      this.attackCooldown -= dt;
    }
    this.walkCycle += dt * 5;

    // Target is house center (x: 640) or flanking turrets (x: 430 or 850)
    const targetX = this.side === 'left' ? 440 : 840;
    const houseX = 640;

    // Distance to turret
    const distToTurret = Math.abs(this.x - targetX);
    const distToHouse = Math.abs(this.x - houseX);

    // Spitter logic: stops at range and spits acid
    if (this.typeKey === 'spitter' && distToTurret <= this.range) {
      this.spitCooldown -= dt;
      if (this.spitCooldown <= 0) {
        this.spitCooldown = 2.5;
        const targetTurret = this.side === 'left' ? window.gameEngine.leftTurret : window.gameEngine.rightTurret;
        if (window.soundSystem && window.soundSystem.playAcidSpit) {
          window.soundSystem.playAcidSpit();
        }
        window.gameEngine.particles.spawnAcidSpit(this.x, this.y - this.size * 0.8, targetTurret.x, targetTurret.y, this.damage);
      }
      return;
    }

    // Check if reached turret or barricade
    const inMeleeRange = distToTurret <= 18 || distToHouse <= 45;
    if (inMeleeRange) {
      if (this.attackCooldown <= 0) {
        this.attackCooldown = this.attackRate;
        const targetTurret = this.side === 'left' ? window.gameEngine.leftTurret : window.gameEngine.rightTurret;
        
        if (window.soundSystem && window.soundSystem.playZombieShriek) {
          window.soundSystem.playZombieShriek();
        }

        // Attack turret if alive, otherwise attack house
        if (targetTurret.health > 0 && distToTurret <= 25) {
          targetTurret.health = Math.max(0, targetTurret.health - this.damage);
          window.gameEngine.particles.spawnSparks(targetTurret.x, targetTurret.y, 8, '#ff5533');
          window.gameEngine.particles.addFloatingText(`-${this.damage}`, targetTurret.x - 10, targetTurret.y - 20, '#ff3333');
        } else {
          window.gameEngine.damageHouse(this.damage);
          window.gameEngine.particles.spawnBlood(this.x, this.y - 10, 4, '#552222');
        }
      }
    } else {
      // Move towards center
      const dir = this.side === 'left' ? 1 : -1;
      this.x += dir * this.speed * dt;
    }
  }

  draw(ctx) {
    if (this.isDead) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    // Direction flip
    const faceLeft = this.side === 'right';
    if (faceLeft) ctx.scale(-1, 1);

    // Flash white when hit
    if (this.hitFlash > 0) {
      ctx.filter = 'brightness(2.6)';
    }

    const bob = Math.sin(this.walkCycle) * 2.5;
    const legSwing = Math.cos(this.walkCycle) * (this.typeKey === 'runner' ? 7.5 : 5);

    // Legs
    ctx.strokeStyle = '#18191c';
    ctx.lineWidth = this.size > 20 ? 4.5 : 2.8;
    ctx.beginPath();
    ctx.moveTo(-3, -this.size * 0.42);
    ctx.lineTo(-4 + legSwing, 0);
    ctx.moveTo(3, -this.size * 0.42);
    ctx.lineTo(4 - legSwing, 0);
    ctx.stroke();

    // Specific Zombie variations
    if (this.typeKey === 'brute') {
      // Goliath Brute: Massive hulking silhouette with bone spikes
      const torsoW = this.size * 0.95;
      const torsoH = this.size * 0.7;
      ctx.fillStyle = this.color;
      ctx.fillRect(-torsoW / 2, -this.size * 0.95 + bob, torsoW, torsoH);

      // Muscular chest plates & scars
      ctx.fillStyle = '#4f1a1a';
      ctx.fillRect(-torsoW * 0.38, -this.size * 0.88 + bob, torsoW * 0.76, 5);
      ctx.fillStyle = '#220808';
      ctx.fillRect(-torsoW * 0.2, -this.size * 0.7 + bob, torsoW * 0.4, 8);

      // Spiked shoulder pads
      ctx.fillStyle = '#2a1a1a';
      ctx.beginPath();
      ctx.moveTo(-torsoW * 0.55, -this.size * 0.95 + bob);
      ctx.lineTo(-torsoW * 0.75, -this.size * 1.15 + bob);
      ctx.lineTo(-torsoW * 0.4, -this.size * 0.85 + bob);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(torsoW * 0.4, -this.size * 0.95 + bob);
      ctx.lineTo(torsoW * 0.65, -this.size * 1.15 + bob);
      ctx.lineTo(torsoW * 0.55, -this.size * 0.85 + bob);
      ctx.fill();

      // Heavy arms with spiked fists
      ctx.strokeStyle = '#5a1d1d';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-2, -this.size * 0.8 + bob);
      ctx.lineTo(this.size * 0.85, -this.size * 0.6 + bob);
      ctx.stroke();

      // Head
      ctx.fillStyle = '#421616';
      ctx.beginPath();
      ctx.arc(this.size * 0.1, -this.size * 1.15 + bob, this.size * 0.36, 0, Math.PI * 2);
      ctx.fill();

      // Glowing crimson dual eyes
      ctx.fillStyle = '#ff1111';
      ctx.shadowColor = '#ff1111';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(this.size * 0.25, -this.size * 1.2 + bob, 2.2, 0, Math.PI * 2);
      ctx.arc(this.size * 0.38, -this.size * 1.22 + bob, 1.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.typeKey === 'spitter') {
      // Acid Spitter: Pulsing pustule sac and toxic maw
      const torsoW = this.size * 0.7;
      const torsoH = this.size * 0.58;
      ctx.fillStyle = this.color;
      ctx.fillRect(-torsoW / 2, -this.size * 0.88 + bob, torsoW, torsoH);

      // Pulsing toxic acid gland on back
      const pulse = Math.sin(Date.now() / 150) * 2;
      ctx.fillStyle = '#55ee11';
      ctx.shadowColor = '#44dd00';
      ctx.shadowBlur = 7;
      ctx.beginPath();
      ctx.arc(-torsoW * 0.3, -this.size * 0.82 + bob, 6 + pulse, 0, Math.PI * 2);
      ctx.fill();

      // Arm reaching forward
      ctx.strokeStyle = '#4e6d23';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, -this.size * 0.75 + bob);
      ctx.lineTo(this.size * 0.65, -this.size * 0.6 + bob);
      ctx.stroke();

      // Head
      ctx.fillStyle = '#6f9630';
      ctx.beginPath();
      ctx.arc(this.size * 0.05, -this.size * 1.08 + bob, this.size * 0.34, 0, Math.PI * 2);
      ctx.fill();

      // Glowing green eye
      ctx.fillStyle = '#39ff14';
      ctx.shadowColor = '#39ff14';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(this.size * 0.2, -this.size * 1.12 + bob, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Acid dripping from jaw
      ctx.fillStyle = '#55ff22';
      ctx.fillRect(this.size * 0.24, -this.size * 0.95 + bob, 2.5, 4);
    } else if (this.typeKey === 'armored') {
      // Riot Armored: Ballistic helmet, visor, Kevlar vest
      const torsoW = this.size * 0.78;
      const torsoH = this.size * 0.62;
      ctx.fillStyle = '#2d3436';
      ctx.fillRect(-torsoW / 2, -this.size * 0.92 + bob, torsoW, torsoH);

      // Steel breastplate
      ctx.fillStyle = '#636e72';
      ctx.fillRect(-torsoW * 0.35, -this.size * 0.85 + bob, torsoW * 0.7, torsoH * 0.7);

      // Arm reaching
      ctx.strokeStyle = '#2d3436';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(0, -this.size * 0.75 + bob);
      ctx.lineTo(this.size * 0.68, -this.size * 0.6 + bob);
      ctx.stroke();

      // Head with Riot Helmet
      ctx.fillStyle = '#1e272e';
      ctx.beginPath();
      ctx.arc(0, -this.size * 1.15 + bob, this.size * 0.38, 0, Math.PI * 2);
      ctx.fill();

      // Visor slit with pale eye reflection
      ctx.fillStyle = '#3498db';
      ctx.fillRect(this.size * 0.05, -this.size * 1.22 + bob, 7, 3);
      ctx.fillStyle = '#ff3333';
      ctx.beginPath();
      ctx.arc(this.size * 0.22, -this.size * 1.2 + bob, 1.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.typeKey === 'runner') {
      // Feral Runner: Low forward sprint hunch
      const torsoW = this.size * 0.62;
      const torsoH = this.size * 0.52;
      ctx.fillStyle = this.color;
      ctx.fillRect(-torsoW / 2, -this.size * 0.78 + bob, torsoW, torsoH);

      // Dual frenzied claw arms
      ctx.strokeStyle = '#5a1d1d';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(0, -this.size * 0.72 + bob);
      ctx.lineTo(this.size * 0.8, -this.size * 0.75 + bob + legSwing);
      ctx.moveTo(-2, -this.size * 0.72 + bob);
      ctx.lineTo(this.size * 0.65, -this.size * 0.52 + bob - legSwing);
      ctx.stroke();

      // Head lunging forward
      ctx.fillStyle = '#6d2121';
      ctx.beginPath();
      ctx.arc(this.size * 0.22, -this.size * 0.95 + bob, this.size * 0.32, 0, Math.PI * 2);
      ctx.fill();

      // Wild red eye
      ctx.fillStyle = '#ff2222';
      ctx.shadowColor = '#ff2222';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(this.size * 0.38, -this.size * 0.98 + bob, 2.0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Standard Walker Shambler
      const torsoW = this.size * 0.68;
      const torsoH = this.size * 0.58;
      ctx.fillStyle = this.color;
      ctx.fillRect(-torsoW / 2, -this.size * 0.9 + bob, torsoW, torsoH);

      // Tattered hem
      ctx.fillStyle = '#223824';
      ctx.fillRect(-torsoW / 2, -this.size * 0.42 + bob, torsoW, 3);

      // Arm reaching forward
      ctx.strokeStyle = '#39533c';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, -this.size * 0.75 + bob);
      ctx.lineTo(this.size * 0.72, -this.size * 0.65 + bob);
      ctx.stroke();

      // Head
      ctx.fillStyle = '#4c6e51';
      ctx.beginPath();
      ctx.arc(0, -this.size * 1.1 + bob, this.size * 0.34, 0, Math.PI * 2);
      ctx.fill();

      // Glowing red eye
      ctx.fillStyle = '#ff2222';
      ctx.beginPath();
      ctx.arc(this.size * 0.16, -this.size * 1.14 + bob, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Health bar above zombie
    if (this.hp < this.maxHp) {
      const barW = this.size * 1.25;
      const hpRatio = Math.max(0, this.hp / this.maxHp);
      ctx.fillStyle = '#220505';
      ctx.fillRect(-barW / 2, -this.size * 1.48 + bob, barW, 3);
      ctx.fillStyle = hpRatio > 0.5 ? '#2ecc71' : hpRatio > 0.25 ? '#f39c12' : '#e74c3c';
      ctx.fillRect(-barW / 2, -this.size * 1.48 + bob, barW * hpRatio, 3);
    }

    ctx.restore();
  }
}

// Wave and Horde Management
class WaveManager {
  constructor() {
    this.currentWave = 0;
    this.waveInterval = 100; // seconds between hordes
    this.timer = 75; // Initial peaceful prep period (75s)
    this.isHordeActive = false;
    this.hordeZombiesRemaining = 0;
    this.hordeSpawnQueue = [];
    this.ambientSpawnTimer = 18; // Occasional straggler
    this.sirenPlayed = false;
  }

  update(dt, zombiesList) {
    // Ambient stragglers between hordes ("meski zombienya jarang yang datang, terkadang ada beberapa...")
    if (!this.isHordeActive) {
      this.timer -= dt;

      // Warning siren 14s before wave
      if (this.timer <= CONFIG.HORDE_WARNING_TIME && !this.sirenPlayed) {
        this.sirenPlayed = true;
        if (window.soundSystem) window.soundSystem.playSiren();
        window.gameEngine.addNotification("⚠️ WARNING: INCOMING HORDE DETECTED ON RADAR!", "danger");
      }

      // Time to trigger horde!
      if (this.timer <= 0) {
        this.startHorde();
      }

      // Ambient wandering zombies (rare stragglers or small group)
      this.ambientSpawnTimer -= dt;
      if (this.ambientSpawnTimer <= 0) {
        this.ambientSpawnTimer = CONFIG.AMBIENT_SPAWN_INTERVAL_MIN + Math.random() * (CONFIG.AMBIENT_SPAWN_INTERVAL_MAX - CONFIG.AMBIENT_SPAWN_INTERVAL_MIN);
        
        // 35% chance of a small roaming group (2-3 zombies) arriving together
        const isGroup = Math.random() < 0.35;
        const groupCount = isGroup ? 2 + Math.floor(Math.random() * 2) : 1;
        const side = Math.random() > 0.5 ? 'left' : 'right';

        for (let g = 0; g < groupCount; g++) {
          const typeRoll = Math.random();
          let type = 'shambler';
          if (typeRoll < 0.35) type = 'runner';
          else if (this.currentWave >= 2 && typeRoll > 0.85) type = 'armored';
          
          setTimeout(() => {
            if (!this.isHordeActive) {
              zombiesList.push(new Zombie(type, side));
            }
          }, g * 700);
        }

        if (isGroup && window.gameEngine) {
          window.gameEngine.addNotification("📡 Radar: Small zombie cluster approaching perimeter...", "warning");
        }
      }
    } else {
      // Horde is active: spawn queued zombies with staggered intervals
      if (this.hordeSpawnQueue.length > 0) {
        this.hordeSpawnDelay = (this.hordeSpawnDelay || 0) - dt;
        if (this.hordeSpawnDelay <= 0) {
          this.hordeSpawnDelay = 0.45 + Math.random() * 0.8;
          const nextZ = this.hordeSpawnQueue.shift();
          zombiesList.push(new Zombie(nextZ.type, nextZ.side));
        }
      } else {
        // Check if all zombies in wave are dead
        const aliveZombies = zombiesList.filter(z => !z.isDead);
        if (aliveZombies.length === 0) {
          this.completeHorde();
        }
      }
    }
  }

  startHorde() {
    this.isHordeActive = true;
    this.currentWave++;
    this.sirenPlayed = false;
    if (window.soundSystem) window.soundSystem.playSiren();
    window.gameEngine.addNotification(`🚨 WAVE ${this.currentWave} ATTACKING! ALL DEFENSES READY!`, "danger");

    // Build tactical wave composition
    this.hordeSpawnQueue = [];
    const count = 7 + this.currentWave * 4;

    // Vanguard: armored tanks soak initial fire
    if (this.currentWave >= 2) {
      this.hordeSpawnQueue.push({ type: 'armored', side: 'left' });
      this.hordeSpawnQueue.push({ type: 'armored', side: 'right' });
    }

    for (let i = 0; i < count; i++) {
      const side = Math.random() > 0.5 ? 'left' : 'right';
      let type = 'shambler';
      const roll = Math.random();

      if (this.currentWave >= 1 && roll < 0.40) {
        type = 'runner'; // Fast flanking runners
      } else if (this.currentWave >= 2 && roll > 0.80) {
        type = 'armored';
      } else if (this.currentWave >= 3 && roll > 0.88) {
        type = 'spitter'; // Acid artillery
      } else if (this.currentWave >= 4 && roll > 0.95) {
        type = 'brute';
      }

      this.hordeSpawnQueue.push({ type, side });
    }

    // Guaranteed Brutes on every 3rd wave
    if (this.currentWave % 3 === 0) {
      this.hordeSpawnQueue.push({ type: 'brute', side: 'left' });
      this.hordeSpawnQueue.push({ type: 'brute', side: 'right' });
    }
  }

  completeHorde() {
    this.isHordeActive = false;
    this.timer = CONFIG.HORDE_INTERVAL || 95;
    this.sirenPlayed = false;
    if (window.soundSystem) window.soundSystem.playBeep(true);
    window.gameEngine.addNotification(`🎉 WAVE ${this.currentWave} REPELLED! SURVIVORS SECURE!`, "success");

    // Award all surviving bunker crew wave XP!
    const engine = window.gameEngine;
    for (const s of engine.survivors) {
      if (!s.isDead) {
        s.addXP(CONFIG.SURVIVOR_XP_WAVE_SURVIVED);
      }
    }

    // Wave victory bonus resources
    const bonusMetal = 35 + this.currentWave * 15;
    const bonusAmmo = 50 + this.currentWave * 25;
    const bonusPowder = 25 + this.currentWave * 12;
    engine.resources.metal = Math.min(CONFIG.RESOURCE_CAPS.metal, engine.resources.metal + bonusMetal);
    engine.resources.ammo = Math.min(CONFIG.RESOURCE_CAPS.ammo, engine.resources.ammo + bonusAmmo);
    engine.resources.gunpowder = Math.min(CONFIG.RESOURCE_CAPS.gunpowder, engine.resources.gunpowder + bonusPowder);

    engine.particles.addFloatingText(`+${bonusAmmo} BONUS AMMO!`, 640, 200, '#ffe57f');
    engine.particles.addFloatingText(`+${bonusMetal} BONUS METAL!`, 640, 180, '#9cdcfe');
  }
}

window.Zombie = Zombie;
window.WaveManager = WaveManager;
