// Automated Defensive Turrets System with Target Prioritization, Armor Penetration, and Manual Crosshair Control
class Turret {
  constructor(sideOrOpts, x, y) {
    if (typeof sideOrOpts === 'object' && sideOrOpts !== null) {
      this.side = sideOrOpts.side || 'left';
      this.x = sideOrOpts.x;
      this.y = sideOrOpts.y;
      this.label = sideOrOpts.label || '';
    } else {
      this.side = sideOrOpts;
      this.x = x;
      this.y = y;
      this.label = '';
    }
    this.tierIndex = 0;
    this.stats = { ...CONFIG.TURRET_TIERS[0] };
    this.ammo = this.stats.maxAmmo;
    this.health = 100;
    this.maxHealth = 100;
    this.angle = this.side === 'left' ? Math.PI : 0; // Default facing outward
    this.targetAngle = this.angle;
    this.target = null;
    this.cooldown = 0;
    this.recoil = 0;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.autoFire = true;
    this.kills = 0;

    // Target Prioritization: 'nearest', 'lowest_hp', 'strongest', 'boss'
    this.priorityMode = 'nearest';
    this.wasTargeting = false;

    // Mechanical animation state variables
    this.barrelSpinAngle = 0; // For Tier 3 Minigun rotating cluster
    this.spinSpeed = 0;       // Rotation speed in rad/sec
    this.plasmaArcTimer = 0;  // For Tier 4 Plasma induction arcs
    this.plasmaArcs = [];     // Dynamic cyan micro-arcs leaping between rails
    this.activeBarrel = 0;    // Alternating barrel fire for Twin Autocannon
  }

  setPriority(mode) {
    const validModes = ['nearest', 'lowest_hp', 'strongest', 'boss'];
    if (validModes.includes(mode)) {
      this.priorityMode = mode;
      if (window.gameEngine) {
        window.gameEngine.particles.addFloatingText(`PRIORITY: ${mode.toUpperCase()}`, this.x - 30, this.y - 30, '#ffd700');
      }
    }
  }

  cyclePriority() {
    const modes = ['nearest', 'lowest_hp', 'strongest', 'boss'];
    const idx = modes.indexOf(this.priorityMode);
    this.priorityMode = modes[(idx + 1) % modes.length];
    if (window.soundSystem) window.soundSystem.playBeep(true);
    if (window.gameEngine) {
      window.gameEngine.particles.addFloatingText(`PRIORITY: ${this.priorityMode.toUpperCase()}`, this.x - 30, this.y - 30, '#ffd700');
    }
  }

  upgrade() {
    if (this.tierIndex < CONFIG.TURRET_TIERS.length - 1) {
      const nextTier = CONFIG.TURRET_TIERS[this.tierIndex + 1];
      const cost = nextTier.upgradeCost;
      const res = window.gameEngine.resources;

      // Check resource cost
      if (res.metal >= cost.metal && (!cost.gunpowder || res.gunpowder >= cost.gunpowder)) {
        res.metal -= cost.metal;
        if (cost.gunpowder) res.gunpowder -= cost.gunpowder;
        this.tierIndex++;
        this.stats = { ...CONFIG.TURRET_TIERS[this.tierIndex] };
        this.ammo = this.stats.maxAmmo;
        this.maxHealth += 50;
        this.health = this.maxHealth;
        window.soundSystem.playBeep(true);
        window.gameEngine.particles.spawnSparks(this.x, this.y, 25, '#44ffaa');
        window.gameEngine.particles.addFloatingText("UPGRADED!", this.x - 20, this.y - 30, '#44ffaa');
        return true;
      }
    }
    window.soundSystem.playBeep(false);
    return false;
  }

  repair() {
    const res = window.gameEngine.resources;
    if (this.health < this.maxHealth && res.metal >= 10) {
      res.metal -= 10;
      this.health = Math.min(this.maxHealth, this.health + 40);
      window.soundSystem.playBeep(true);
      window.gameEngine.particles.spawnSparks(this.x, this.y, 15, '#ffaa33');
      window.gameEngine.particles.addFloatingText("+40 HP REPAIRED", this.x - 30, this.y - 25, '#ffaa33');
      return true;
    }
    return false;
  }

  reload() {
    if (this.isReloading || this.ammo >= this.stats.maxAmmo) return false;
    const res = window.gameEngine.resources;
    const needed = this.stats.maxAmmo - this.ammo;
    const loadAmount = Math.min(needed, res.ammo);

    if (loadAmount > 0) {
      this.isReloading = true;
      this.reloadTimer = 1.0; // 1s reload delay
      res.ammo -= loadAmount;
      this.pendingAmmo = loadAmount;
      window.soundSystem.playReload();
      window.gameEngine.particles.addFloatingText("RELOADING...", this.x - 25, this.y - 25, '#ffe57f');
      return true;
    } else {
      window.soundSystem.playDryClick();
      window.gameEngine.particles.addFloatingText("OUT OF AMMO STOCK!", this.x - 40, this.y - 25, '#ff4444');
      return false;
    }
  }

  calculateDamage(target) {
    let rawDamage = this.stats.damage * (1 + (Math.random() * 0.2 - 0.1));
    const engine = window.gameEngine;
    if (engine && engine.techTree.heavyCaliber) {
      rawDamage *= 1.3;
    }

    // Critical Hit calculation (15% chance for +50% damage)
    const isCrit = Math.random() < 0.15;
    if (isCrit) {
      rawDamage *= 1.5;
    }

    // Armor Penetration calculation vs Riot Armored
    if (target && target.typeKey === 'armored') {
      let ap = 0.15; // Tier 0 base AP
      if (this.tierIndex === 1) ap = 0.50; // Autocannon
      else if (this.tierIndex === 2) ap = 0.75; // Vulcan Minigun
      else if (this.tierIndex === 3) ap = 1.00; // Plasma Cannon

      if (engine && engine.techTree.heavyCaliber) ap += 0.35;
      ap = Math.min(1.0, ap);

      // Armored zombies take reduced damage if low AP
      const armorReduction = 0.5 + 0.5 * ap;
      rawDamage *= armorReduction;
    }

    return { damage: rawDamage, isCrit };
  }

  update(dt, zombies) {
    // Handle reload timer
    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.ammo += this.pendingAmmo;
        this.pendingAmmo = 0;
        this.isReloading = false;
        window.gameEngine.particles.addFloatingText(`+${this.ammo} READY!`, this.x - 20, this.y - 25, '#55ff55');
      }
    }

    if (this.cooldown > 0) {
      this.cooldown -= dt;
    }
    if (this.recoil > 0) {
      this.recoil = Math.max(0, this.recoil - dt * 26);
    }

    // Minigun barrel cluster rotation physics
    if (this.tierIndex === 2) {
      const isTargeting = (this.target && this.target.hp > 0) || (window.gameEngine && window.gameEngine.manualAim);
      if (isTargeting && this.ammo > 0) {
        // Accelerate barrel spin
        this.spinSpeed = Math.min(48, this.spinSpeed + dt * 55);
      } else {
        // Decelerate smoothly
        this.spinSpeed = Math.max(0, this.spinSpeed - dt * 22);
      }
      this.barrelSpinAngle += this.spinSpeed * dt;
    }

    // Plasma Cannon induction coil electrical arc generator
    if (this.tierIndex === 3) {
      this.plasmaArcTimer -= dt;
      if (this.plasmaArcTimer <= 0) {
        this.plasmaArcTimer = 0.08 + Math.random() * 0.12;
        this.plasmaArcs = [];
        const count = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
          this.plasmaArcs.push({
            x1: 6 + Math.random() * 16,
            y1: -6 + Math.random() * 2,
            x2: 6 + Math.random() * 16,
            y2: 4 + Math.random() * 2,
            life: 0.1
          });
        }
      }
    }

    // Auto-reload from bunker if auto-conduit tech researched
    if (window.gameEngine.techTree.autoConduit && this.ammo < this.stats.maxAmmo * 0.3 && !this.isReloading) {
      this.reload();
    }

    const engine = window.gameEngine;
    const isManual = engine && engine.manualAim;

    if (isManual) {
      // Manual aiming mode: rotate towards mouse cursor
      this.targetAngle = Math.atan2(engine.mouseY - this.y, engine.mouseX - this.x);
      let diff = this.targetAngle - this.angle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.angle += diff * Math.min(1, dt * 18);
      this.target = null;
      return;
    }

    // Autonomous Mode: Find Target based on Priority
    this.findTarget(zombies);

    // Aim smoothly towards target
    if (this.target && this.target.hp > 0) {
      const targetCenterY = this.target.y - this.target.size;
      this.targetAngle = Math.atan2(targetCenterY - this.y, this.target.x - this.x);

      let diff = this.targetAngle - this.angle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.angle += diff * Math.min(1, dt * 14);

      // Minigun spinup audio hook
      if (!this.wasTargeting && this.tierIndex === 2 && window.soundSystem && window.soundSystem.playMinigunSpinup) {
        window.soundSystem.playMinigunSpinup();
      }
      this.wasTargeting = true;

      // Auto Fire if aligned and in range
      if (this.autoFire && Math.abs(diff) < 0.35 && this.cooldown <= 0 && !this.isReloading) {
        this.fire();
      }
    } else {
      this.wasTargeting = false;
      // Idle resting angle
      const defaultAngle = this.side === 'left' ? Math.PI : 0;
      let diff = defaultAngle - this.angle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.angle += diff * Math.min(1, dt * 4);
    }
  }

  findTarget(zombies) {
    const candidates = [];
    for (const z of zombies) {
      if (z.hp <= 0) continue;
      // Flank preference
      if (this.side === 'left' && z.x > 670) continue;
      if (this.side === 'right' && z.x < 610) continue;

      const dist = Math.hypot(z.x - this.x, z.y - this.y);
      if (dist <= this.stats.range) {
        candidates.push({ zombie: z, dist });
      }
    }

    if (candidates.length === 0) {
      this.target = null;
      return;
    }

    // Apply prioritization mode
    if (this.priorityMode === 'nearest') {
      candidates.sort((a, b) => a.dist - b.dist);
    } else if (this.priorityMode === 'lowest_hp') {
      candidates.sort((a, b) => a.zombie.hp - b.zombie.hp);
    } else if (this.priorityMode === 'strongest') {
      candidates.sort((a, b) => b.zombie.maxHp - a.zombie.maxHp);
    } else if (this.priorityMode === 'boss') {
      const typeRank = { brute: 4, spitter: 3, armored: 2, runner: 1, shambler: 0 };
      candidates.sort((a, b) => {
        const rankA = typeRank[a.zombie.typeKey] || 0;
        const rankB = typeRank[b.zombie.typeKey] || 0;
        if (rankB !== rankA) return rankB - rankA;
        return a.dist - b.dist;
      });
    }

    this.target = candidates[0].zombie;
  }

  fire() {
    if (this.ammo <= 0) {
      window.soundSystem.playDryClick();
      this.cooldown = 0.6;
      window.gameEngine.particles.addFloatingText("NO AMMO!", this.x - 20, this.y - 20, '#ff4444');
      return;
    }

    this.ammo--;
    this.cooldown = this.stats.fireRate;
    this.recoil = this.tierIndex === 3 ? 8 : this.tierIndex === 1 ? 7.5 : 5.5;
    this.activeBarrel = (this.activeBarrel + 1) % 2;

    // Gunshot audio
    if (this.tierIndex === 3) {
      window.soundSystem.playGunshot('plasma');
    } else if (this.tierIndex >= 1) {
      window.soundSystem.playGunshot('heavy');
    } else {
      window.soundSystem.playGunshot('normal');
    }

    // Muzzle flash and shell casing / coolant discharge
    const barrelLength = this.tierIndex === 0 ? 22 : this.tierIndex === 1 ? 28 : this.tierIndex === 2 ? 30 : 32;
    const nozzleX = this.x + Math.cos(this.angle) * barrelLength;
    const nozzleY = this.y + Math.sin(this.angle) * barrelLength;

    window.gameEngine.particles.spawnMuzzleFlash(nozzleX, nozzleY, this.angle, this.tierIndex);
    window.gameEngine.particles.spawnCasing(this.x, this.y, this.side === 'left' ? 1 : -1, this.tierIndex);

    // Hit calculation
    if (this.target && this.target.hp > 0) {
      const hitX = this.target.x + (Math.random() * 8 - 4);
      const hitY = this.target.y - this.target.size * 0.7 + (Math.random() * 6 - 3);

      if (this.tierIndex === 3) {
        // Plasma Ion Beam Tracer & Impact
        window.gameEngine.particles.addTracer(nozzleX, nozzleY, hitX, hitY, '#00f3ff', true);
        window.gameEngine.particles.spawnPlasmaImpact(hitX, hitY);
      } else {
        const tracerColor = this.tierIndex === 1 ? '#ffb347' : this.tierIndex === 2 ? '#ffea75' : '#ffe57f';
        window.gameEngine.particles.addTracer(nozzleX, nozzleY, hitX, hitY, tracerColor, false);

        // Armor impact ricochet sparks if target is armored
        if (this.target.typeKey === 'armored') {
          window.gameEngine.particles.spawnImpactSparks(hitX, hitY, this.angle + Math.PI, true);
        }
      }

      const { damage, isCrit } = this.calculateDamage(this.target);
      if (isCrit) {
        window.gameEngine.particles.addFloatingText("CRIT!", hitX, hitY - 15, '#ffd700');
      }

      const dead = this.target.takeDamage(damage);
      if (dead) {
        this.kills++;
        this.target = null;
      }
    } else {
      const blindX = this.x + Math.cos(this.angle) * this.stats.range;
      const blindY = this.y + Math.sin(this.angle) * this.stats.range;
      if (this.tierIndex === 3) {
        window.gameEngine.particles.addTracer(nozzleX, nozzleY, blindX, blindY, '#00f3ff', true);
      } else {
        window.gameEngine.particles.addTracer(nozzleX, nozzleY, blindX, blindY, '#ffe57f', false);
      }
    }
  }

  // Manual Trigger Fire along current crosshair angle
  fireManual(targetX, targetY) {
    if (this.cooldown > 0 || this.isReloading) return false;

    if (this.ammo <= 0) {
      window.soundSystem.playDryClick();
      this.cooldown = 0.5;
      window.gameEngine.particles.addFloatingText("OUT OF AMMO!", this.x - 20, this.y - 20, '#ff4444');
      return false;
    }

    this.ammo--;
    this.cooldown = this.stats.fireRate;
    this.recoil = this.tierIndex === 3 ? 9 : this.tierIndex === 1 ? 8 : 6;
    this.activeBarrel = (this.activeBarrel + 1) % 2;

    if (this.tierIndex === 3) {
      window.soundSystem.playGunshot('plasma');
    } else if (this.tierIndex >= 1) {
      window.soundSystem.playGunshot('heavy');
    } else {
      window.soundSystem.playGunshot('normal');
    }

    const barrelLength = this.tierIndex === 0 ? 22 : this.tierIndex === 1 ? 28 : this.tierIndex === 2 ? 30 : 32;
    const nozzleX = this.x + Math.cos(this.angle) * barrelLength;
    const nozzleY = this.y + Math.sin(this.angle) * barrelLength;

    window.gameEngine.particles.spawnMuzzleFlash(nozzleX, nozzleY, this.angle, this.tierIndex);
    window.gameEngine.particles.spawnCasing(this.x, this.y, this.side === 'left' ? 1 : -1, this.tierIndex);

    // Raycast hit detection against all active zombies
    const engine = window.gameEngine;
    let hitZombie = null;
    let minT = Infinity;

    const dirX = Math.cos(this.angle);
    const dirY = Math.sin(this.angle);

    for (const z of engine.zombies) {
      if (z.hp <= 0) continue;
      const toZx = z.x - nozzleX;
      const toZy = (z.y - z.size * 0.6) - nozzleY;
      const proj = toZx * dirX + toZy * dirY;

      if (proj > 0 && proj < this.stats.range) {
        const perpX = toZx - proj * dirX;
        const perpY = toZy - proj * dirY;
        const perpDist = Math.hypot(perpX, perpY);

        if (perpDist <= z.size * 1.3) {
          if (proj < minT) {
            minT = proj;
            hitZombie = z;
          }
        }
      }
    }

    if (hitZombie) {
      const hitX = hitZombie.x + (Math.random() * 6 - 3);
      const hitY = hitZombie.y - hitZombie.size * 0.6 + (Math.random() * 6 - 3);

      if (this.tierIndex === 3) {
        engine.particles.addTracer(nozzleX, nozzleY, hitX, hitY, '#00f3ff', true);
        engine.particles.spawnPlasmaImpact(hitX, hitY);
      } else {
        const tracerColor = this.tierIndex === 1 ? '#ffb347' : this.tierIndex === 2 ? '#ffea75' : '#ffd700';
        engine.particles.addTracer(nozzleX, nozzleY, hitX, hitY, tracerColor, false);
        if (hitZombie.typeKey === 'armored') {
          engine.particles.spawnImpactSparks(hitX, hitY, this.angle + Math.PI, true);
        }
      }

      const { damage, isCrit } = this.calculateDamage(hitZombie);
      if (isCrit) {
        engine.particles.addFloatingText("CRIT!", hitX, hitY - 15, '#ffd700');
      }

      const dead = hitZombie.takeDamage(damage);
      if (dead) this.kills++;
    } else {
      const endX = nozzleX + dirX * this.stats.range;
      const endY = nozzleY + dirY * this.stats.range;
      if (this.tierIndex === 3) {
        engine.particles.addTracer(nozzleX, nozzleY, endX, endY, '#00f3ff', true);
      } else {
        engine.particles.addTracer(nozzleX, nozzleY, endX, endY, '#ffd700', false);
      }
    }

    return true;
  }

  draw(ctx) {
    const engine = window.gameEngine;
    const isManual = engine && engine.manualAim;

    // Laser aim guide in autonomous or manual mode
    if (isManual) {
      this.drawManualLaserGuide(ctx);
    } else if (this.target && this.target.hp > 0 && this.ammo > 0) {
      this.drawLaserAimGuide(ctx);
    }

    ctx.save();
    ctx.translate(this.x, this.y);

    // ==========================================
    // 1. TRIPOD & MOUNTING BASE (Anchored to Ground)
    // ==========================================
    this.drawMountBase(ctx);

    // Health Bar underneath base
    const hpRatio = Math.max(0, this.health / this.maxHealth);
    ctx.fillStyle = '#1a0808';
    ctx.fillRect(-18, 17, 36, 4.5);
    ctx.fillStyle = hpRatio > 0.5 ? '#2ecc71' : hpRatio > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.fillRect(-18, 17, 36 * hpRatio, 4.5);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(-18, 17, 36, 4.5);

    // Ammo count badge
    ctx.fillStyle = this.ammo === 0 ? '#ff3838' : this.ammo < (this.stats.maxAmmo * 0.35) ? '#e58e26' : '#55efc4';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${this.ammo}/${this.stats.maxAmmo}`, 0, 31);

    // Priority badge
    ctx.fillStyle = '#a0aec0';
    ctx.font = '8px monospace';
    ctx.fillText(this.priorityMode.toUpperCase().slice(0, 4), 0, 40);

    // ==========================================
    // 2. ROTATING TURRET POD & WEAPON ASSEMBLY
    // ==========================================
    ctx.rotate(this.angle);

    const recoilOffset = -this.recoil;

    if (this.tierIndex === 0) {
      this.drawTier1Sentry(ctx, recoilOffset, isManual);
    } else if (this.tierIndex === 1) {
      this.drawTier2Autocannon(ctx, recoilOffset, isManual);
    } else if (this.tierIndex === 2) {
      this.drawTier3Minigun(ctx, recoilOffset, isManual);
    } else {
      this.drawTier4Plasma(ctx, recoilOffset, isManual);
    }

    ctx.restore();

    // Low Ammo warning blinking indicator
    if (this.ammo <= 0) {
      const blink = Math.floor(Date.now() / 300) % 2 === 0;
      if (blink) {
        ctx.fillStyle = '#ff3838';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText("! RELOAD !", this.x, this.y - 20);
      }
    } else if (this.ammo < this.stats.maxAmmo * 0.35) {
      const blink = Math.floor(Date.now() / 400) % 2 === 0;
      if (blink) {
        ctx.fillStyle = '#e58e26';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText("LOW AMMO", this.x, this.y - 20);
      }
    }
  }

  // Heavy Tripod & Mount Base per Tier
  drawMountBase(ctx) {
    if (this.tierIndex === 0) {
      // Tier 1: Heavy Steel Tripod with stabilizer feet
      ctx.strokeStyle = '#2d3748';
      ctx.lineWidth = 3;
      // Left leg
      ctx.beginPath();
      ctx.moveTo(-4, 4);
      ctx.lineTo(-15, 14);
      ctx.stroke();
      // Right leg
      ctx.beginPath();
      ctx.moveTo(4, 4);
      ctx.lineTo(15, 14);
      ctx.stroke();
      // Center rear strut
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.lineTo(0, 15);
      ctx.stroke();

      // Locking stabilizer footpads
      ctx.fillStyle = '#1a202c';
      ctx.fillRect(-18, 13, 6, 3);
      ctx.fillRect(12, 13, 6, 3);
      ctx.fillRect(-3, 14, 6, 2.5);

      // Central steel pivot pedestal
      ctx.fillStyle = '#4a5568';
      ctx.beginPath();
      ctx.arc(0, 4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1a202c';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (this.tierIndex === 1) {
      // Tier 2: Reinforced hydraulic swivel mount with dual chrome pistons
      ctx.fillStyle = '#2d3748';
      ctx.fillRect(-14, 6, 28, 9);
      ctx.strokeStyle = '#1a202c';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-14, 6, 28, 9);

      // Hydraulic pistons on flanks
      ctx.fillStyle = '#cbd5e0'; // Chrome piston rod
      ctx.fillRect(-11, 0, 3, 7);
      ctx.fillRect(8, 0, 3, 7);
      ctx.fillStyle = '#4a5568'; // Hydraulic cylinder
      ctx.fillRect(-12, 4, 5, 6);
      ctx.fillRect(7, 4, 5, 6);

      // Mounting plate with bolts
      ctx.fillStyle = '#718096';
      ctx.beginPath();
      ctx.arc(-10, 12, 1.5, 0, Math.PI * 2);
      ctx.arc(10, 12, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.tierIndex === 2) {
      // Tier 3: Conical heavy pedestal with recoil shocks & high-capacity chute
      ctx.fillStyle = '#1e272e';
      ctx.beginPath();
      ctx.moveTo(-16, 15);
      ctx.lineTo(16, 15);
      ctx.lineTo(9, 2);
      ctx.lineTo(-9, 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#2f3640';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Recoil shock absorbers
      ctx.fillStyle = '#e1b12c'; // Warning collar
      ctx.fillRect(-11, 6, 4, 7);
      ctx.fillRect(7, 6, 4, 7);
      ctx.fillStyle = '#dcdde1'; // Chrome damper shaft
      ctx.fillRect(-10, 2, 2, 5);
      ctx.fillRect(8, 2, 2, 5);
    } else {
      // Tier 4: Magnetic suspension pedestal with cyan power conduits
      ctx.fillStyle = '#101721';
      ctx.beginPath();
      ctx.moveTo(-18, 15);
      ctx.lineTo(18, 15);
      ctx.lineTo(11, 2);
      ctx.lineTo(-11, 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#0abde3';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Glowing power conduit cables
      ctx.strokeStyle = '#00d2d3';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00d2d3';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(-13, 14);
      ctx.quadraticCurveTo(-15, 6, -8, 3);
      ctx.moveTo(13, 14);
      ctx.quadraticCurveTo(15, 6, 8, 3);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  // Tier 1: Sentry 9mm (Dual rifled steel barrels, drum magazine, red laser sight)
  drawTier1Sentry(ctx, recoilOffset, isManual) {
    // Drum Ammo Magazine on right flank
    ctx.fillStyle = '#2f3542';
    ctx.beginPath();
    ctx.ellipse(recoilOffset - 2, 7, 6.5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1e272e';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Dual Rifled Barrels side-by-side with cooling vent slots
    ctx.fillStyle = '#1e272e';
    // Top barrel
    ctx.fillRect(recoilOffset, -4, 21, 3);
    // Bottom barrel
    ctx.fillRect(recoilOffset, 1, 21, 3);

    // Muzzle crowns
    ctx.fillStyle = '#57606f';
    ctx.fillRect(recoilOffset + 20, -4.5, 2, 4);
    ctx.fillRect(recoilOffset + 20, 0.5, 2, 4);

    // Cooling vent slots along barrel jackets
    ctx.fillStyle = '#111';
    for (let s = 6; s <= 16; s += 5) {
      ctx.fillRect(recoilOffset + s, -3.5, 2, 2);
      ctx.fillRect(recoilOffset + s, 1.5, 2, 2);
    }

    // Armored Receiver Box
    ctx.fillStyle = '#353b48';
    ctx.fillRect(recoilOffset - 9, -6, 12, 12);
    ctx.strokeStyle = '#1e272e';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(recoilOffset - 9, -6, 12, 12);

    // Turret Pod Dome
    ctx.fillStyle = '#4a5568';
    ctx.beginPath();
    ctx.arc(recoilOffset * 0.5, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2d3748';
    ctx.stroke();

    // Top Optical Sensor Pod & Red Laser Optic
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(recoilOffset - 4, -8, 8, 3);
    ctx.fillStyle = '#ff3838'; // Ruby red sensor diode
    ctx.fillRect(recoilOffset + 2, -7.5, 2, 2);

    // Center pivot indicator LED
    ctx.fillStyle = this.isReloading ? '#fbc531' : this.ammo === 0 ? '#e84118' : isManual ? '#00f3ff' : '#4cd137';
    ctx.beginPath();
    ctx.arc(recoilOffset * 0.5, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tier 2: Twin Autocannon (Fluted heavy barrels with vented muzzle brakes, linked ammo belt, amber sight)
  drawTier2Autocannon(ctx, recoilOffset, isManual) {
    // Armored Hopper Ammo Box on flank with hazard diagonal stripes
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(recoilOffset - 11, 5, 11, 9);
    ctx.strokeStyle = '#1a252f';
    ctx.strokeRect(recoilOffset - 11, 5, 11, 9);
    ctx.fillStyle = '#f1c40f'; // Hazard stripe
    ctx.fillRect(recoilOffset - 10, 7, 9, 2);

    // Linked Ammo Feed Belt feeding into receiver
    ctx.fillStyle = '#d4af37';
    for (let b = 0; b < 3; b++) {
      ctx.fillRect(recoilOffset - 8 + b * 3, 3, 2, 4);
    }

    // Dual Heavy Fluted Barrels with Recoil Dampeners
    // Independent recoil for active barrel
    const recL = this.activeBarrel === 0 ? recoilOffset : recoilOffset * 0.3;
    const recR = this.activeBarrel === 1 ? recoilOffset : recoilOffset * 0.3;

    // Barrel 1 (Upper)
    ctx.fillStyle = '#2d3436';
    ctx.fillRect(recL, -5.5, 27, 4);
    // Longitudinal fluting grooves
    ctx.fillStyle = '#1e272e';
    ctx.fillRect(recL + 4, -4.5, 18, 1);
    ctx.fillRect(recL + 4, -2.5, 18, 1);
    // Vented Muzzle Brake (vertical & lateral vents)
    ctx.fillStyle = '#636e72';
    ctx.fillRect(recL + 25, -7, 4, 7);
    ctx.fillStyle = '#111';
    ctx.fillRect(recL + 26, -6, 2, 1.5);
    ctx.fillRect(recL + 26, -3.5, 2, 1.5);

    // Barrel 2 (Lower)
    ctx.fillStyle = '#2d3436';
    ctx.fillRect(recR, 2, 27, 4);
    ctx.fillStyle = '#1e272e';
    ctx.fillRect(recR + 4, 3, 18, 1);
    ctx.fillRect(recR + 4, 5, 18, 1);
    // Vented Muzzle Brake
    ctx.fillStyle = '#636e72';
    ctx.fillRect(recR + 25, 0.5, 4, 7);
    ctx.fillStyle = '#111';
    ctx.fillRect(recR + 26, 1.5, 2, 1.5);
    ctx.fillRect(recR + 26, 4, 2, 1.5);

    // Angled Armored Gun Mantlet / Ballistic Shield
    ctx.fillStyle = '#4b6584';
    ctx.beginPath();
    ctx.moveTo(recoilOffset - 11, -11);
    ctx.lineTo(recoilOffset + 4, -7);
    ctx.lineTo(recoilOffset + 4, 7);
    ctx.lineTo(recoilOffset - 11, 11);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Rivet studs on mantlet
    ctx.fillStyle = '#cbd5e0';
    ctx.fillRect(recoilOffset - 9, -9, 2, 2);
    ctx.fillRect(recoilOffset - 9, 7, 2, 2);

    // Electro-optical Sensor Housing & Amber targeting lens
    ctx.fillStyle = '#1e272e';
    ctx.fillRect(recoilOffset - 2, -10, 7, 4);
    ctx.fillStyle = '#f39c12'; // Amber optic lens
    ctx.fillRect(recoilOffset + 3, -9.5, 2, 3);

    // Center LED
    ctx.fillStyle = this.isReloading ? '#fbc531' : this.ammo === 0 ? '#e84118' : isManual ? '#00f3ff' : '#4cd137';
    ctx.beginPath();
    ctx.arc(recoilOffset * 0.4, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tier 3: Vulcan Minigun (Rotating 6-barrel cluster with rotation blur, cooling shroud, emerald sight)
  drawTier3Minigun(ctx, recoilOffset, isManual) {
    // Massive receiver body & drive motor
    ctx.fillStyle = '#2f3640';
    ctx.fillRect(recoilOffset - 14, -8, 16, 16);
    ctx.strokeStyle = '#1e272e';
    ctx.lineWidth = 1.8;
    ctx.strokeRect(recoilOffset - 14, -8, 16, 16);

    // Perforated cylindrical cooling shroud wrapping the aft barrel assembly
    ctx.fillStyle = '#1e252b';
    ctx.fillRect(recoilOffset + 2, -7.5, 14, 15);
    ctx.strokeStyle = '#353b48';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(recoilOffset + 2, -7.5, 14, 15);

    // Shroud ventilation perforations
    ctx.fillStyle = '#111';
    for (let vx = 5; vx <= 13; vx += 4) {
      for (let vy = -5; vy <= 5; vy += 4) {
        ctx.fillRect(recoilOffset + vx, vy, 2, 2);
      }
    }

    // Rotating 6-Barrel Gatling Cluster with 3D cylindrical projection
    const barrelCount = 6;
    const clusterLen = 29;
    const clusterRadius = 5.2;

    // High-speed rotation blur disc when spinning fast
    if (this.spinSpeed > 14) {
      const blurAlpha = Math.min(0.5, (this.spinSpeed - 14) / 34 * 0.5);
      ctx.fillStyle = `rgba(180, 195, 205, ${blurAlpha})`;
      ctx.beginPath();
      ctx.ellipse(recoilOffset + clusterLen + 1, 0, 2.5, clusterRadius + 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Central driveshaft spline
    ctx.fillStyle = '#111';
    ctx.fillRect(recoilOffset + 14, -1.5, clusterLen - 12, 3);

    // Render 6 individual rotating barrels sorted by depth
    const barrelRenderList = [];
    for (let b = 0; b < barrelCount; b++) {
      const bAngle = this.barrelSpinAngle + (b * Math.PI * 2 / barrelCount);
      const bY = Math.sin(bAngle) * clusterRadius;
      const bDepth = Math.cos(bAngle); // -1 (far back) to +1 (near front)
      barrelRenderList.push({ bY, bDepth });
    }
    // Sort so rear barrels draw first
    barrelRenderList.sort((a, b) => a.bDepth - b.bDepth);

    for (const b of barrelRenderList) {
      // Shading based on depth
      const shade = b.bDepth > 0 ? '#4a5568' : '#1e272e';
      ctx.fillStyle = shade;
      ctx.fillRect(recoilOffset + 14, b.bY - 1.2, clusterLen - 13, 2.4);

      // Barrel tip bore
      ctx.fillStyle = '#111';
      ctx.fillRect(recoilOffset + clusterLen, b.bY - 1, 1.5, 2);
    }

    // Front barrel clamp disc & mid stabilizer ring
    ctx.fillStyle = '#718096';
    ctx.fillRect(recoilOffset + clusterLen - 1, -clusterRadius - 1, 2, (clusterRadius + 1) * 2);
    ctx.fillRect(recoilOffset + 21, -clusterRadius - 0.5, 2, (clusterRadius + 0.5) * 2);

    // Emerald Green Tactical Laser Sight Pod
    ctx.fillStyle = '#1a202c';
    ctx.fillRect(recoilOffset - 6, -11, 8, 3.5);
    ctx.fillStyle = '#00ff88'; // Emerald optic diode
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 5;
    ctx.fillRect(recoilOffset + 1, -10.5, 2.5, 2.5);
    ctx.shadowBlur = 0;

    // Turret Pod Center Hub
    ctx.fillStyle = '#353b48';
    ctx.beginPath();
    ctx.arc(recoilOffset * 0.4, 0, 7.5, 0, Math.PI * 2);
    ctx.fill();

    // Center LED
    ctx.fillStyle = this.isReloading ? '#fbc531' : this.ammo === 0 ? '#e84118' : isManual ? '#00f3ff' : '#00ff88';
    ctx.beginPath();
    ctx.arc(recoilOffset * 0.4, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tier 4: Heavy Plasma Cannon (Magnetic rails, twin charging induction coils, cyan arcs, plasma emitter)
  drawTier4Plasma(ctx, recoilOffset, isManual) {
    // Futuristic stealth composite armor chassis with heat sinks
    ctx.fillStyle = '#101721';
    ctx.fillRect(recoilOffset - 15, -9, 17, 18);
    ctx.strokeStyle = '#0abde3';
    ctx.lineWidth = 1.8;
    ctx.strokeRect(recoilOffset - 15, -9, 17, 18);

    // Rear cooling heat sink fins with cyan glow
    ctx.fillStyle = '#00d2d3';
    ctx.shadowColor = '#00d2d3';
    ctx.shadowBlur = 6;
    for (let f = -12; f <= -4; f += 4) {
      ctx.fillRect(recoilOffset + f, -11, 2, 2);
      ctx.fillRect(recoilOffset + f, 9, 2, 2);
    }
    ctx.shadowBlur = 0;

    // Dual Magnetic Accelerator Rails (Upper & Lower)
    const railLen = 32;
    // Upper rail
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(recoilOffset + 2, -8, railLen, 3.5);
    ctx.fillStyle = '#00f3ff'; // Hyper-conductive inner guide strip
    ctx.fillRect(recoilOffset + 2, -5.5, railLen, 1.2);

    // Lower rail
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(recoilOffset + 2, 4.5, railLen, 3.5);
    ctx.fillStyle = '#00f3ff';
    ctx.fillRect(recoilOffset + 2, 4.5, railLen, 1.2);

    // Twin Charging Induction Coils wrapped around the rails
    for (const cx of [8, 15]) {
      // Upper coil
      ctx.fillStyle = '#e67e22'; // Heavy copper winding
      ctx.fillRect(recoilOffset + cx, -9.5, 4.5, 6);
      ctx.fillStyle = '#00f3ff'; // Glowing superconductive ring
      ctx.fillRect(recoilOffset + cx + 1.5, -9.5, 1.5, 6);

      // Lower coil
      ctx.fillStyle = '#e67e22';
      ctx.fillRect(recoilOffset + cx, 3.5, 4.5, 6);
      ctx.fillStyle = '#00f3ff';
      ctx.fillRect(recoilOffset + cx + 1.5, 3.5, 1.5, 6);
    }

    // Pulsing Cyan Electrical Arc Particles leaping dynamically across the rails
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 1.3;
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 8;
    for (const arc of this.plasmaArcs) {
      ctx.beginPath();
      const midX = recoilOffset + (arc.x1 + arc.x2) * 0.5 + (Math.random() - 0.5) * 4;
      const midY = (arc.y1 + arc.y2) * 0.5 + (Math.random() - 0.5) * 4;
      ctx.moveTo(recoilOffset + arc.x1, arc.y1);
      ctx.lineTo(midX, midY);
      ctx.lineTo(recoilOffset + arc.x2, arc.y2);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Glowing Plasma Emitter Throat / Flare
    const ionPulse = 0.7 + Math.sin(Date.now() / 70) * 0.3;
    ctx.fillStyle = `rgba(0, 243, 255, ${0.4 * ionPulse})`;
    ctx.beginPath();
    ctx.arc(recoilOffset + 2, 0, 7 * ionPulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(recoilOffset + 2, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    // Muzzle Emitter Rail Tips
    ctx.fillStyle = '#00f3ff';
    ctx.fillRect(recoilOffset + railLen, -7, 2, 3);
    ctx.fillRect(recoilOffset + railLen, 4, 2, 3);

    // Center Core LED
    ctx.fillStyle = this.isReloading ? '#fbc531' : this.ammo === 0 ? '#e84118' : isManual ? '#ffffff' : '#00f3ff';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(recoilOffset * 0.4, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  drawLaserAimGuide(ctx) {
    const barrelLen = this.tierIndex === 0 ? 22 : this.tierIndex === 1 ? 28 : this.tierIndex === 2 ? 30 : 32;
    const lx = this.x + Math.cos(this.angle) * barrelLen;
    const ly = this.y + Math.sin(this.angle) * barrelLen;
    const tx = this.target.x;
    const ty = this.target.y - this.target.size * 0.6;

    let laserColor = '#ff3333';
    if (this.tierIndex === 1) laserColor = '#f39c12';
    else if (this.tierIndex === 2) laserColor = '#00ff88';
    else if (this.tierIndex === 3) laserColor = '#00f3ff';

    const shimmer = 0.72 + Math.sin(Date.now() / 60) * 0.24;

    ctx.save();
    ctx.strokeStyle = laserColor;
    ctx.lineWidth = this.tierIndex === 3 ? 1.8 : 1.2;
    ctx.shadowColor = laserColor;
    ctx.shadowBlur = this.tierIndex === 3 ? 8 : 4;
    ctx.globalAlpha = shimmer * 0.85;

    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(tx, ty);
    ctx.stroke();

    // Reticle on target
    ctx.fillStyle = laserColor;
    ctx.globalAlpha = shimmer;
    ctx.beginPath();
    ctx.arc(tx, ty, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Crosshair brackets on target
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.arc(tx, ty, 7.5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  drawManualLaserGuide(ctx) {
    const engine = window.gameEngine;
    if (!engine) return;

    // Only draw guide for turret covering current mouse half
    if ((this.side === 'left' && engine.mouseX > 700) || (this.side === 'right' && engine.mouseX < 580)) {
      return;
    }

    const barrelLen = 30;
    const lx = this.x + Math.cos(this.angle) * barrelLen;
    const ly = this.y + Math.sin(this.angle) * barrelLen;
    const mx = engine.mouseX;
    const my = engine.mouseY;

    ctx.save();
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 1.4;
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 6;
    ctx.globalAlpha = 0.8;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(mx, my);
    ctx.stroke();
    ctx.restore();
  }
}

window.Turret = Turret;
