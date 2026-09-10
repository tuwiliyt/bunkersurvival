// Automated Defensive Turrets System with Target Prioritization, Armor Penetration, and Manual Crosshair Control
class Turret {
  constructor(side, x, y) {
    this.side = side; // 'left' or 'right'
    this.x = x;
    this.y = y;
    this.tierIndex = 0;
    this.stats = { ...CONFIG.TURRET_TIERS[0] };
    this.ammo = this.stats.maxAmmo;
    this.health = 100;
    this.maxHealth = 100;
    this.angle = side === 'left' ? Math.PI : 0; // Default facing outward
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
      this.recoil = Math.max(0, this.recoil - dt * 25);
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
    this.recoil = 6;

    // Gunshot audio
    window.soundSystem.playGunshot(this.tierIndex >= 2 ? 'heavy' : 'normal');

    // Muzzle flash and shell casing
    const barrelLength = 22;
    const nozzleX = this.x + Math.cos(this.angle) * barrelLength;
    const nozzleY = this.y + Math.sin(this.angle) * barrelLength;
    window.gameEngine.particles.spawnMuzzleFlash(nozzleX, nozzleY, this.angle);
    window.gameEngine.particles.spawnCasing(this.x, this.y, this.side === 'left' ? 1 : -1);

    // Hit calculation
    if (this.target && this.target.hp > 0) {
      const hitX = this.target.x + (Math.random() * 8 - 4);
      const hitY = this.target.y - this.target.size * 0.7 + (Math.random() * 6 - 3);
      window.gameEngine.particles.addTracer(nozzleX, nozzleY, hitX, hitY);

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
      window.gameEngine.particles.addTracer(nozzleX, nozzleY, blindX, blindY);
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
    this.recoil = 7;

    window.soundSystem.playGunshot(this.tierIndex >= 2 ? 'heavy' : 'normal');

    const barrelLength = 24;
    const nozzleX = this.x + Math.cos(this.angle) * barrelLength;
    const nozzleY = this.y + Math.sin(this.angle) * barrelLength;
    window.gameEngine.particles.spawnMuzzleFlash(nozzleX, nozzleY, this.angle);
    window.gameEngine.particles.spawnCasing(this.x, this.y, this.side === 'left' ? 1 : -1);

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
      engine.particles.addTracer(nozzleX, nozzleY, hitX, hitY, '#ffd700');

      const { damage, isCrit } = this.calculateDamage(hitZombie);
      if (isCrit) {
        engine.particles.addFloatingText("CRIT!", hitX, hitY - 15, '#ffd700');
      }

      const dead = hitZombie.takeDamage(damage);
      if (dead) this.kills++;
    } else {
      const endX = nozzleX + dirX * this.stats.range;
      const endY = nozzleY + dirY * this.stats.range;
      engine.particles.addTracer(nozzleX, nozzleY, endX, endY);
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

    // Tripod / Mounting Base
    ctx.fillStyle = '#222629';
    ctx.beginPath();
    ctx.moveTo(-12, 12);
    ctx.lineTo(12, 12);
    ctx.lineTo(6, -2);
    ctx.lineTo(-6, -2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Health Bar underneath base
    const hpRatio = Math.max(0, this.health / this.maxHealth);
    ctx.fillStyle = '#441111';
    ctx.fillRect(-16, 15, 32, 4);
    ctx.fillStyle = hpRatio > 0.5 ? '#44cc44' : hpRatio > 0.25 ? '#ffaa22' : '#ff3333';
    ctx.fillRect(-16, 15, 32 * hpRatio, 4);

    // Ammo count badge
    ctx.fillStyle = this.ammo === 0 ? '#ff2222' : this.ammo < (this.stats.maxAmmo * 0.35) ? '#ff9900' : '#44ee77';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${this.ammo}/${this.stats.maxAmmo}`, 0, 27);

    // Priority badge
    ctx.fillStyle = '#a0aec0';
    ctx.font = '8px monospace';
    ctx.fillText(this.priorityMode.toUpperCase().slice(0, 4), 0, 36);

    // Rotating Gun Turret Pod
    ctx.rotate(this.angle);

    const recoilOffset = -this.recoil;

    // Dual or Quad Gun Barrels
    ctx.fillStyle = '#111417';
    if (this.tierIndex === 0) {
      // Sentry 9mm
      ctx.fillRect(recoilOffset, -3, 20, 3);
      ctx.fillRect(recoilOffset, 1, 20, 3);
    } else if (this.tierIndex === 1) {
      // Twin Autocannon (longer with muzzle brake)
      ctx.fillRect(recoilOffset, -4, 26, 3.5);
      ctx.fillRect(recoilOffset, 1.5, 26, 3.5);
      ctx.fillStyle = '#2f3542';
      ctx.fillRect(recoilOffset + 24, -6, 4, 13);
    } else if (this.tierIndex === 2) {
      // Minigun bundle
      ctx.fillStyle = '#1e272e';
      ctx.fillRect(recoilOffset, -5, 28, 10);
      ctx.fillStyle = '#d2dae2';
      ctx.fillRect(recoilOffset + 26, -6, 3, 12);
    } else {
      // Plasma Cannon
      ctx.fillStyle = '#0abde3';
      ctx.fillRect(recoilOffset, -5, 30, 10);
      ctx.fillStyle = '#48dbfb';
      ctx.shadowColor = '#00d2d3';
      ctx.shadowBlur = 8;
      ctx.fillRect(recoilOffset + 22, -3, 8, 6);
    }

    // Turret Pod Body / Dome
    ctx.fillStyle = this.tierIndex >= 3 ? '#222f3e' : '#353b48';
    ctx.beginPath();
    ctx.arc(recoilOffset * 0.5, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1e272e';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Center pivot light
    ctx.fillStyle = this.isReloading ? '#fbc531' : this.ammo === 0 ? '#e84118' : isManual ? '#00f3ff' : '#4cd137';
    ctx.beginPath();
    ctx.arc(recoilOffset * 0.5, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Low Ammo warning blinking indicator
    if (this.ammo <= 0) {
      const blink = Math.floor(Date.now() / 300) % 2 === 0;
      if (blink) {
        ctx.fillStyle = '#ff3838';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText("! RELOAD !", this.x, this.y - 18);
      }
    } else if (this.ammo < this.stats.maxAmmo * 0.35) {
      const blink = Math.floor(Date.now() / 400) % 2 === 0;
      if (blink) {
        ctx.fillStyle = '#e58e26';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText("LOW AMMO", this.x, this.y - 18);
      }
    }
  }

  drawLaserAimGuide(ctx) {
    const barrelLen = this.tierIndex === 0 ? 20 : this.tierIndex === 1 ? 26 : 28;
    const lx = this.x + Math.cos(this.angle) * barrelLen;
    const ly = this.y + Math.sin(this.angle) * barrelLen;
    const tx = this.target.x;
    const ty = this.target.y - this.target.size * 0.6;

    let laserColor = '#ff3333';
    if (this.tierIndex === 1) laserColor = '#f39c12';
    else if (this.tierIndex === 2) laserColor = '#00ff88';
    else if (this.tierIndex === 3) laserColor = '#00f3ff';

    const shimmer = 0.68 + Math.sin(Date.now() / 65) * 0.22;

    ctx.save();
    ctx.strokeStyle = laserColor;
    ctx.lineWidth = 1.0;
    ctx.globalAlpha = shimmer * 0.8;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(tx, ty);
    ctx.stroke();

    // Reticle on target
    ctx.fillStyle = laserColor;
    ctx.globalAlpha = shimmer;
    ctx.beginPath();
    ctx.arc(tx, ty, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawManualLaserGuide(ctx) {
    const engine = window.gameEngine;
    if (!engine) return;

    // Only draw guide for turret covering current mouse half
    if ((this.side === 'left' && engine.mouseX > 700) || (this.side === 'right' && engine.mouseX < 580)) {
      return;
    }

    const barrelLen = 25;
    const lx = this.x + Math.cos(this.angle) * barrelLen;
    const ly = this.y + Math.sin(this.angle) * barrelLen;
    const mx = engine.mouseX;
    const my = engine.mouseY;

    ctx.save();
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.75;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(mx, my);
    ctx.stroke();
    ctx.restore();
  }
}

window.Turret = Turret;
