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
    this.animTime = Math.random() * 10;
    this.dripTimer = Math.random();
    this.targetRefugee = null;
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

    this.animTime = (this.animTime || 0) + dt;
    this.dripTimer = (this.dripTimer || 0) + dt;

    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
    }
    if (this.attackCooldown > 0) {
      this.attackCooldown -= dt;
    }
    this.walkCycle += dt * 5;

    // Goliath Brute ground-shaking footstep dust puffs
    if (this.typeKey === 'brute') {
      const prevStep = Math.sin(this.walkCycle - dt * 5);
      const curStep = Math.sin(this.walkCycle);
      if (prevStep < 0 && curStep >= 0) {
        if (window.gameEngine && window.gameEngine.particles) {
          if (window.gameEngine.particles.spawnDustPuff) {
            window.gameEngine.particles.spawnDustPuff(this.x, CONFIG.SURFACE_Y, 7, 'rgba(150, 135, 120, 0.6)');
          } else if (window.gameEngine.particles.spawnSmokePuff) {
            window.gameEngine.particles.spawnSmokePuff(this.x, CONFIG.SURFACE_Y, 7, 'rgba(150, 135, 120, 0.6)');
          }
        }
      }
    }

    // If assigned to pursue a fleeing refugee on surface
    if (this.targetRefugee) {
      if (this.targetRefugee.isDead || this.targetRefugee.isRescued) {
        this.targetRefugee = null;
      } else {
        const distToRefugee = Math.abs(this.x - this.targetRefugee.x);
        if (distToRefugee <= 20) {
          if (this.attackCooldown <= 0) {
            this.attackCooldown = this.attackRate;
            this.targetRefugee.takeDamage(this.damage);
            if (window.soundSystem && window.soundSystem.playZombieShriek) {
              window.soundSystem.playZombieShriek();
            }
          }
        } else {
          const dir = this.x < this.targetRefugee.x ? 1 : -1;
          this.x += dir * (this.speed * 1.05) * dt;
        }
        return;
      }
    }

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

    // Check if reached perimeter fence (Extra security!)
    const engine = window.gameEngine;
    if (engine && engine.fences) {
      if (this.side === 'left' && engine.fences.left && engine.fences.left.hp > 0 && this.x >= 420 && this.x <= 450) {
        if (this.attackCooldown <= 0) {
          this.attackCooldown = this.attackRate;
          engine.damageFence('left', this.damage);
          this.takeDamage(4); // Barbed wire counter-damage
          if (window.soundSystem && window.soundSystem.playZombieShriek) {
            window.soundSystem.playZombieShriek();
          }
        }
        return;
      }
      if (this.side === 'right' && engine.fences.right && engine.fences.right.hp > 0 && this.x <= 860 && this.x >= 830) {
        if (this.attackCooldown <= 0) {
          this.attackCooldown = this.attackRate;
          engine.damageFence('right', this.damage);
          this.takeDamage(4); // Barbed wire counter-damage
          if (window.soundSystem && window.soundSystem.playZombieShriek) {
            window.soundSystem.playZombieShriek();
          }
        }
        return;
      }
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

    // Direction flip: face toward base center
    const faceLeft = this.side === 'right';
    if (faceLeft) ctx.scale(-1, 1);

    // Flash bright white when hit by bullets
    if (this.hitFlash > 0) {
      ctx.filter = 'brightness(2.6)';
    }

    const bob = Math.sin(this.walkCycle) * 2.5;
    const legSwing = Math.cos(this.walkCycle) * (this.typeKey === 'runner' ? 7.5 : 5);

    // Dispatch specialized procedural archetype rendering
    if (this.typeKey === 'brute') {
      this.drawGoliathBrute(ctx, bob, legSwing);
    } else if (this.typeKey === 'spitter') {
      this.drawAcidSpitter(ctx, bob);
    } else if (this.typeKey === 'armored') {
      this.drawRiotArmored(ctx, bob, legSwing);
    } else if (this.typeKey === 'runner') {
      this.drawFeralRunner(ctx, bob, legSwing);
    } else {
      this.drawShambler(ctx, bob);
    }

    // Health bar above zombie
    if (this.hp < this.maxHp) {
      const barW = this.size * 1.35;
      const hpRatio = Math.max(0, this.hp / this.maxHp);
      const barY = this.typeKey === 'brute' ? -this.size * 1.6 + bob : -this.size * 1.48 + bob;
      ctx.fillStyle = '#220505';
      ctx.fillRect(-barW / 2, barY, barW, 3.2);
      ctx.fillStyle = hpRatio > 0.5 ? '#2ecc71' : hpRatio > 0.25 ? '#f39c12' : '#e74c3c';
      ctx.fillRect(-barW / 2, barY, barW * hpRatio, 3.2);
    }

    ctx.restore();
  }

  // --- 1. SHAMBLER (WALKER): Decaying flesh, torn bloody shirt, exposed ribcage, limp dragging leg, open jaw dripping blood ---
  drawShambler(ctx, bob) {
    // Asymmetrical Limp Dragging Walk Cycle:
    // Leading foot steps forward, trailing limp foot drags along the ground with friction mark
    const leadSwing = Math.cos(this.walkCycle) * 4.2;
    const limpDrag = -this.size * 0.38 - Math.abs(Math.sin(this.walkCycle * 0.5)) * 1.6;

    // Torso tilts heavily sideways into the limp
    ctx.rotate(Math.sin(this.walkCycle) * 0.08);

    // Dragging Limp Leg (back leg scraping ground)
    ctx.strokeStyle = '#222f21';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(-2, -this.size * 0.42);
    ctx.lineTo(limpDrag, 0);
    ctx.stroke();

    // Ground scrape friction streak
    ctx.strokeStyle = 'rgba(50, 30, 15, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(limpDrag - 2, 0);
    ctx.lineTo(limpDrag + 2.5, 0);
    ctx.stroke();

    // Leading Step Leg (front leg stepping naturally)
    ctx.strokeStyle = '#2d3b2c';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(2, -this.size * 0.42);
    ctx.lineTo(3 - leadSwing, 0);
    ctx.stroke();

    // Decaying Rotten Flesh Torso
    const torsoW = this.size * 0.72;
    const torsoH = this.size * 0.62;
    ctx.fillStyle = '#4a6744'; // Decaying greenish-grey flesh
    ctx.fillRect(-torsoW / 2, -this.size * 0.92 + bob, torsoW, torsoH);

    // Putrid necrotic dark flesh patches
    ctx.fillStyle = '#2f442b';
    ctx.fillRect(-torsoW * 0.35, -this.size * 0.82 + bob, 3, 4);

    // Torn Bloody Shirt shreds hanging over shoulders and hem
    ctx.fillStyle = '#612b2b';
    ctx.fillRect(-torsoW / 2, -this.size * 0.92 + bob, torsoW * 0.5, 4);
    ctx.fillStyle = '#3a0e0e';
    ctx.fillRect(-torsoW / 2, -this.size * 0.42 + bob, torsoW, 2.5); // Frayed bloody hem

    // Exposed Ribcage: Deep crimson wound cavity with calcified ivory rib bones
    ctx.fillStyle = '#2a0404'; // Clotted thoracic cavity
    ctx.fillRect(-1, -this.size * 0.82 + bob, torsoW * 0.5, 6);

    // Calcified rib bones curving across the cavity
    ctx.strokeStyle = '#eae3d2'; // Bone white
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-0.5, -this.size * 0.8 + bob); ctx.lineTo(torsoW * 0.45, -this.size * 0.81 + bob);
    ctx.moveTo(-0.5, -this.size * 0.75 + bob); ctx.lineTo(torsoW * 0.45, -this.size * 0.76 + bob);
    ctx.moveTo(-0.5, -this.size * 0.7 + bob); ctx.lineTo(torsoW * 0.45, -this.size * 0.71 + bob);
    ctx.moveTo(-0.5, -this.size * 0.65 + bob); ctx.lineTo(torsoW * 0.45, -this.size * 0.66 + bob);
    ctx.stroke();

    // Rotten reaching arm with clawing fingers
    ctx.strokeStyle = '#3e563b';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(0, -this.size * 0.75 + bob);
    ctx.lineTo(this.size * 0.75, -this.size * 0.62 + bob);
    ctx.lineTo(this.size * 0.88, -this.size * 0.66 + bob);
    ctx.stroke();

    // Decayed Skull
    ctx.fillStyle = '#4c6e51';
    ctx.beginPath();
    ctx.arc(0, -this.size * 1.12 + bob, this.size * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Sunken nasal cavity
    ctx.fillStyle = '#1c281e';
    ctx.fillRect(this.size * 0.1, -this.size * 1.1 + bob, 1.8, 1.8);

    // Slack Dislocated Jaw dangling open
    ctx.fillStyle = '#1a0505'; // Gaping dark mouth
    ctx.fillRect(this.size * 0.05, -this.size * 0.98 + bob, 4.5, 3.5);
    ctx.fillStyle = '#f1c40f'; // Broken tooth stump
    ctx.fillRect(this.size * 0.1, -this.size * 0.98 + bob, 1.2, 1.2);

    // Open jaw dripping blood droplets down onto chest & ground
    const dripProg = (this.walkCycle * 0.65) % 1.0;
    const dropY = -this.size * 0.88 + bob + dripProg * (this.size * 0.88);
    ctx.fillStyle = '#8b0000';
    ctx.beginPath();
    ctx.arc(this.size * 0.2, dropY, 1.3 * (1 - dripProg * 0.3), 0, Math.PI * 2);
    ctx.fill();

    // Left eye: hollow black void; Right eye: chilling bloodshot red pinprick
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(this.size * 0.05, -this.size * 1.16 + bob, 1.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff2222';
    ctx.beginPath();
    ctx.arc(this.size * 0.22, -this.size * 1.16 + bob, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- 2. FERAL RUNNER: Emaciated low predatory sprint, frantic clawing arms, ragged hoodie, glowing red eye-trails ---
  drawFeralRunner(ctx, bob, legSwing) {
    // Low predatory sprint rake forward
    ctx.rotate(0.28);

    // Emaciated sprint stride legs
    const sprintLegSwing = Math.cos(this.walkCycle * 1.6) * 9.0;
    ctx.strokeStyle = '#2d1414';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-3, -this.size * 0.38);
    ctx.lineTo(-4 + sprintLegSwing, 0);
    ctx.moveTo(3, -this.size * 0.38);
    ctx.lineTo(4 - sprintLegSwing, 0);
    ctx.stroke();

    // Gaunt emaciated torso with sharp vertebral ridges
    const torsoW = this.size * 0.64;
    const torsoH = this.size * 0.52;
    ctx.fillStyle = '#4a1212';
    ctx.fillRect(-torsoW / 2, -this.size * 0.82 + bob, torsoW, torsoH);

    // Protruding sharp bony spine ridges along hunched back
    ctx.fillStyle = '#260808';
    for (let s = 0; s < 4; s++) {
      ctx.fillRect(-torsoW / 2 + s * 3.5, -this.size * 0.86 + bob, 2, 2.5);
    }

    // Blood-soaked ragged hoodie: torn hood cowl fluttering behind in slipstream
    ctx.fillStyle = '#3a0c0c';
    ctx.beginPath();
    ctx.moveTo(-this.size * 0.05, -this.size * 1.1 + bob);
    ctx.lineTo(-this.size * 0.65, -this.size * 1.22 + bob + Math.sin(this.walkCycle * 2) * 2.5);
    ctx.lineTo(-this.size * 0.15, -this.size * 0.85 + bob);
    ctx.fill();

    // Frantic Clawing Arms with elongated obsidian razor talons
    const clawSwing = Math.cos(this.walkCycle * 1.6) * 8.5;
    ctx.strokeStyle = '#5a1d1d';
    ctx.lineWidth = 2.2;

    // Back claw arm
    ctx.beginPath();
    ctx.moveTo(-2, -this.size * 0.72 + bob);
    ctx.lineTo(this.size * 0.65, -this.size * 0.48 + bob - clawSwing);
    ctx.stroke();
    // Talons
    ctx.strokeStyle = '#0d0d0d';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(this.size * 0.65, -this.size * 0.48 + bob - clawSwing);
    ctx.lineTo(this.size * 0.85, -this.size * 0.52 + bob - clawSwing);
    ctx.stroke();

    // Front claw arm
    ctx.strokeStyle = '#5a1d1d';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(0, -this.size * 0.72 + bob);
    ctx.lineTo(this.size * 0.82, -this.size * 0.76 + bob + clawSwing);
    ctx.stroke();
    // Razor talons
    ctx.strokeStyle = '#0d0d0d';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(this.size * 0.82, -this.size * 0.76 + bob + clawSwing);
    ctx.lineTo(this.size * 1.05, -this.size * 0.82 + bob + clawSwing);
    ctx.moveTo(this.size * 0.82, -this.size * 0.76 + bob + clawSwing);
    ctx.lineTo(this.size * 1.02, -this.size * 0.72 + bob + clawSwing);
    ctx.stroke();

    // Head lunging forward inside ragged hood
    ctx.fillStyle = '#6d2121';
    ctx.beginPath();
    ctx.arc(this.size * 0.25, -this.size * 0.96 + bob, this.size * 0.32, 0, Math.PI * 2);
    ctx.fill();

    // Glowing Red Eye-Trails (Dynamic predator motion-blur streak)
    for (let i = 1; i <= 4; i++) {
      const trailAlpha = 0.85 / i;
      ctx.save();
      ctx.globalAlpha = trailAlpha;
      ctx.fillStyle = '#ff0033';
      ctx.shadowColor = '#ff0033';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(this.size * 0.38 - i * 4.2, -this.size * 0.98 + bob, 2.0 * (1 - i * 0.15), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Core blazing crimson eye with fiery white center
    ctx.fillStyle = '#ff0033';
    ctx.shadowColor = '#ff0033';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(this.size * 0.38, -this.size * 0.98 + bob, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.size * 0.4, -this.size * 0.98 + bob, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // --- 3. RIOT ARMORED: Full SWAT ballistic helmet with cracked visor, heavy Kevlar armor plates that reflect light, riot knee pads ---
  drawRiotArmored(ctx, bob, legSwing) {
    // Heavy Tactical Legs & High-Impact Riot Knee Pads
    ctx.strokeStyle = '#1e272e';
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.moveTo(-3, -this.size * 0.42);
    ctx.lineTo(-4 + legSwing, 0);
    ctx.moveTo(3, -this.size * 0.42);
    ctx.lineTo(4 - legSwing, 0);
    ctx.stroke();

    // Riot Knee Pads on both knees
    ctx.fillStyle = '#111417';
    ctx.fillRect(-5.5 + legSwing * 0.6, -this.size * 0.22, 4, 4);
    ctx.fillRect(1.5 - legSwing * 0.6, -this.size * 0.22, 4, 4);
    // Steel rivet studs on knee pads
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(-4.5 + legSwing * 0.6, -this.size * 0.2, 1.2, 1.2);
    ctx.fillRect(2.5 - legSwing * 0.6, -this.size * 0.2, 1.2, 1.2);

    // Heavy reinforced SWAT combat boots
    ctx.fillStyle = '#0e1114';
    ctx.fillRect(-6 + legSwing, -3, 6, 3);
    ctx.fillRect(2 - legSwing, -3, 6, 3);

    // Heavy Kevlar SWAT Torso Vest & Armor Plates
    const torsoW = this.size * 0.82;
    const torsoH = this.size * 0.66;
    ctx.fillStyle = '#222a32'; // Base tactical vest
    ctx.fillRect(-torsoW / 2, -this.size * 0.94 + bob, torsoW, torsoH);

    // Ceramic strike breastplate
    ctx.fillStyle = '#34414c';
    ctx.fillRect(-torsoW * 0.38, -this.size * 0.88 + bob, torsoW * 0.76, torsoH * 0.72);

    // Weathered SWAT tactical stencil
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = 'bold 5px monospace';
    ctx.fillText('SWAT', -torsoW * 0.28, -this.size * 0.68 + bob);

    // Dynamic Specular Light Reflection Sheen sweeping across Kevlar plate
    const sheenX = (((this.animTime * 1.8) % 3.0) - 1.5) * (torsoW * 0.5);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(sheenX - 4, -this.size * 0.88 + bob);
    ctx.lineTo(sheenX + 4, -this.size * 0.58 + bob);
    ctx.stroke();

    // Heavy tactical riot gauntlet arm
    ctx.strokeStyle = '#263038';
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.moveTo(0, -this.size * 0.76 + bob);
    ctx.lineTo(this.size * 0.7, -this.size * 0.6 + bob);
    ctx.stroke();
    // Armored vambrace
    ctx.fillStyle = '#1c2127';
    ctx.fillRect(this.size * 0.3, -this.size * 0.68 + bob, 5, 3.5);

    // Full SWAT Ballistic Helmet
    ctx.fillStyle = '#1c2127'; // Matte black Kevlar helmet shell
    ctx.beginPath();
    ctx.arc(0, -this.size * 1.16 + bob, this.size * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Polycarbonate riot face shield / visor
    ctx.fillStyle = 'rgba(52, 152, 219, 0.5)';
    ctx.fillRect(this.size * 0.04, -this.size * 1.25 + bob, 8.5, 5.5);
    ctx.strokeStyle = '#2980b9';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.size * 0.04, -this.size * 1.25 + bob, 8.5, 5.5);

    // Realistic spiderweb glass cracks radiating from bullet impact
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(this.size * 0.22, -this.size * 1.2 + bob); ctx.lineTo(this.size * 0.06, -this.size * 1.24 + bob);
    ctx.moveTo(this.size * 0.22, -this.size * 1.2 + bob); ctx.lineTo(this.size * 0.38, -this.size * 1.17 + bob);
    ctx.moveTo(this.size * 0.22, -this.size * 1.2 + bob); ctx.lineTo(this.size * 0.24, -this.size * 1.13 + bob);
    ctx.moveTo(this.size * 0.22, -this.size * 1.2 + bob); ctx.lineTo(this.size * 0.14, -this.size * 1.14 + bob);
    ctx.stroke();

    // Pale bloodshot infected eye glaring through the cracked glass
    ctx.fillStyle = '#ff2222';
    ctx.beginPath();
    ctx.arc(this.size * 0.22, -this.size * 1.2 + bob, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- 4. ACID SPITTER: Hunchbacked mutant, pulsating toxic green bile sac, dripping corrosive saliva, toxic green glowing eyes ---
  drawAcidSpitter(ctx, bob) {
    // Hunchbacked forward curvature
    ctx.rotate(0.12);

    // Mutated legs
    const legSwing = Math.cos(this.walkCycle) * 4.5;
    ctx.strokeStyle = '#324416';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-3, -this.size * 0.42);
    ctx.lineTo(-4 + legSwing, 0);
    ctx.moveTo(3, -this.size * 0.42);
    ctx.lineTo(4 - legSwing, 0);
    ctx.stroke();

    // Hunchbacked mutated torso
    const torsoW = this.size * 0.72;
    const torsoH = this.size * 0.6;
    ctx.fillStyle = '#5c7a29'; // Sickly toxic mottled yellow-green
    ctx.fillRect(-torsoW / 2, -this.size * 0.9 + bob, torsoW, torsoH);

    // Glowing toxic bile veins branching across chest and neck
    ctx.strokeStyle = '#39ff14';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-torsoW * 0.25, -this.size * 0.85 + bob);
    ctx.lineTo(0, -this.size * 0.72 + bob);
    ctx.lineTo(this.size * 0.28, -this.size * 0.78 + bob);
    ctx.moveTo(0, -this.size * 0.72 + bob);
    ctx.lineTo(-2, -this.size * 0.58 + bob);
    ctx.stroke();

    // Pulsating Translucent Green Acid Sac on Back (animated sine wave)
    const pulse = Math.sin(Date.now() / 140) * 3.2;
    const sacR = 8.5 + pulse;

    // Outer radiant toxic aura
    ctx.shadowColor = '#00ff44';
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(46, 213, 115, 0.78)';
    ctx.beginPath();
    ctx.arc(-torsoW * 0.38, -this.size * 0.86 + bob, sacR, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Inner bright chemical core
    ctx.fillStyle = '#7bed9f';
    ctx.beginPath();
    ctx.arc(-torsoW * 0.38, -this.size * 0.86 + bob, sacR * 0.65, 0, Math.PI * 2);
    ctx.fill();

    // Internal bubbling acid pustules
    ctx.fillStyle = '#a8ff24';
    ctx.beginPath();
    ctx.arc(-torsoW * 0.38 - 2, -this.size * 0.86 + bob - 1, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-torsoW * 0.38 + 2.5, -this.size * 0.86 + bob + 1.5, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // White glossy highlight arc on upper sac dome
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(-torsoW * 0.38, -this.size * 0.86 + bob, sacR * 0.78, -Math.PI * 0.75, -Math.PI * 0.25);
    ctx.stroke();

    // Mutated arm reaching
    ctx.strokeStyle = '#4e6d23';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(0, -this.size * 0.76 + bob);
    ctx.lineTo(this.size * 0.66, -this.size * 0.6 + bob);
    ctx.stroke();

    // Head lunging forward
    ctx.fillStyle = '#6f9630';
    ctx.beginPath();
    ctx.arc(this.size * 0.08, -this.size * 1.08 + bob, this.size * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Toxic green glowing compound eyes
    ctx.fillStyle = '#00ff55';
    ctx.shadowColor = '#00ff55';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(this.size * 0.22, -this.size * 1.12 + bob, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Mutated distended lower jaw dripping corrosive green saliva
    ctx.fillStyle = '#3f5519';
    ctx.fillRect(this.size * 0.15, -this.size * 0.98 + bob, 3.5, 3);

    // Corrosive green saliva droplet falling to ground
    const dripProgress = (this.walkCycle * 0.75) % 1.0;
    const acidY = -this.size * 0.92 + bob + dripProgress * (this.size * 0.92);
    ctx.fillStyle = '#55ff22';
    ctx.shadowColor = '#39ff14';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(this.size * 0.25, acidY, 1.4 * (1 - dripProgress * 0.2), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // --- 5. GOLIATH BRUTE: Hulking giant frame, calcified bone spikes on shoulders & forearms, bloody scars, ground-shaking footstep dust, rage eyes ---
  drawGoliathBrute(ctx, bob, legSwing) {
    const torsoW = this.size * 1.05;
    const torsoH = this.size * 0.75;

    // Massive Trunk Legs & Heavy Stomping Splayed Soles
    ctx.strokeStyle = '#220808';
    ctx.lineWidth = 5.6;
    ctx.beginPath();
    ctx.moveTo(-5, -this.size * 0.42);
    ctx.lineTo(-6 + legSwing, 0);
    ctx.moveTo(5, -this.size * 0.42);
    ctx.lineTo(6 - legSwing, 0);
    ctx.stroke();

    // Heavy splayed mutated foot soles
    ctx.fillStyle = '#110404';
    ctx.fillRect(-9 + legSwing, -3, 9, 3);
    ctx.fillRect(3 - legSwing, -3, 9, 3);

    // Massive Hulking Slab Torso
    ctx.fillStyle = '#451414'; // Dark charred crimson mutated flesh
    ctx.fillRect(-torsoW / 2, -this.size * 0.95 + bob, torsoW, torsoH);

    // Muscular chest contouring plates
    ctx.fillStyle = '#2c0b0b';
    ctx.fillRect(-torsoW * 0.4, -this.size * 0.9 + bob, torsoW * 0.8, 5);
    ctx.fillRect(-torsoW * 0.25, -this.size * 0.7 + bob, torsoW * 0.5, 9);

    // Bloody War Scars & Combat Lacerations
    ctx.strokeStyle = '#881111';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-torsoW * 0.3, -this.size * 0.85 + bob); ctx.lineTo(torsoW * 0.25, -this.size * 0.65 + bob);
    ctx.moveTo(-torsoW * 0.15, -this.size * 0.62 + bob); ctx.lineTo(torsoW * 0.2, -this.size * 0.82 + bob);
    ctx.stroke();

    // Suture tick marks
    ctx.strokeStyle = '#220000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-torsoW * 0.1, -this.size * 0.82 + bob); ctx.lineTo(-torsoW * 0.05, -this.size * 0.76 + bob);
    ctx.moveTo(torsoW * 0.05, -this.size * 0.75 + bob); ctx.lineTo(torsoW * 0.1, -this.size * 0.69 + bob);
    ctx.stroke();

    // Calcified Bone Spikes Bursting from Shoulders
    ctx.fillStyle = '#f1f2f6'; // Ivory calcified bone
    // Left shoulder spike cluster (main towering horn & secondary spur)
    ctx.beginPath();
    ctx.moveTo(-torsoW * 0.52, -this.size * 0.95 + bob);
    ctx.lineTo(-torsoW * 0.85, -this.size * 1.35 + bob);
    ctx.lineTo(-torsoW * 0.35, -this.size * 0.88 + bob);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-torsoW * 0.58, -this.size * 0.85 + bob);
    ctx.lineTo(-torsoW * 0.92, -this.size * 1.05 + bob);
    ctx.lineTo(-torsoW * 0.48, -this.size * 0.75 + bob);
    ctx.fill();

    // Right shoulder spike cluster (main horn & outward spur)
    ctx.beginPath();
    ctx.moveTo(torsoW * 0.35, -this.size * 0.95 + bob);
    ctx.lineTo(torsoW * 0.75, -this.size * 1.35 + bob);
    ctx.lineTo(torsoW * 0.55, -this.size * 0.88 + bob);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(torsoW * 0.45, -this.size * 0.85 + bob);
    ctx.lineTo(torsoW * 0.85, -this.size * 1.05 + bob);
    ctx.lineTo(torsoW * 0.55, -this.size * 0.75 + bob);
    ctx.fill();

    // Bloody crimson root tissue around bone spike bases
    ctx.fillStyle = '#660000';
    ctx.beginPath();
    ctx.arc(-torsoW * 0.45, -this.size * 0.92 + bob, 3.2, 0, Math.PI * 2);
    ctx.arc(torsoW * 0.45, -this.size * 0.92 + bob, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Heavy Muscular Arms with Calcified Bone Spikes on Forearms
    ctx.strokeStyle = '#5a1d1d';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-2, -this.size * 0.8 + bob);
    ctx.lineTo(this.size * 0.9, -this.size * 0.55 + bob);
    ctx.stroke();

    // Bone knuckle spurs on heavy fist
    ctx.fillStyle = '#f1f2f6';
    ctx.fillRect(this.size * 0.85, -this.size * 0.62 + bob, 3.5, 3.5);
    ctx.fillRect(this.size * 0.92, -this.size * 0.55 + bob, 3, 2.5);

    // Intimidating Skull with Protruding Bony Brow Ridge
    ctx.fillStyle = '#421616';
    ctx.beginPath();
    ctx.arc(this.size * 0.12, -this.size * 1.15 + bob, this.size * 0.38, 0, Math.PI * 2);
    ctx.fill();

    // Heavy bony brow ridge
    ctx.fillStyle = '#2b0b0b';
    ctx.fillRect(this.size * 0.1, -this.size * 1.25 + bob, 8, 3);

    // Gaping snarling maw with mutated fangs
    ctx.fillStyle = '#1a0505';
    ctx.fillRect(this.size * 0.18, -this.size * 1.05 + bob, 6, 4);
    ctx.fillStyle = '#f1f2f6';
    ctx.fillRect(this.size * 0.22, -this.size * 1.05 + bob, 1.5, 2);
    ctx.fillRect(this.size * 0.32, -this.size * 1.03 + bob, 1.5, 2);

    // Burning Crimson Rage Eyes with fiery hot core
    ctx.fillStyle = '#ff0011';
    ctx.shadowColor = '#ff0011';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(this.size * 0.25, -this.size * 1.2 + bob, 2.5, 0, Math.PI * 2);
    ctx.arc(this.size * 0.4, -this.size * 1.22 + bob, 2.0, 0, Math.PI * 2);
    ctx.fill();

    // Fiery orange-yellow hot core
    ctx.fillStyle = '#ffea75';
    ctx.beginPath();
    ctx.arc(this.size * 0.25, -this.size * 1.2 + bob, 1.0, 0, Math.PI * 2);
    ctx.arc(this.size * 0.4, -this.size * 1.22 + bob, 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
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
    this.refugeeDistressTriggered = false;
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

      // Occasional mid-intermission refugee distress event
      if (!this.refugeeDistressTriggered && this.timer <= 45 && this.currentWave >= 1) {
        this.refugeeDistressTriggered = true;
        if (window.gameEngine && window.gameEngine.triggerRefugeeEvent) {
          window.gameEngine.triggerRefugeeEvent();
        }
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
    this.refugeeDistressTriggered = false;
    if (window.soundSystem) window.soundSystem.playSiren();
    window.gameEngine.addNotification(`🚨 WAVE ${this.currentWave} ATTACKING! ALL DEFENSES READY!`, "danger");

    // Build tactical wave composition
    this.hordeSpawnQueue = [];
    const count = 4 + this.currentWave * 3;

    // Vanguard: armored tanks soak initial fire (from wave 3+)
    if (this.currentWave >= 3) {
      this.hordeSpawnQueue.push({ type: 'armored', side: 'left' });
      this.hordeSpawnQueue.push({ type: 'armored', side: 'right' });
    }

    for (let i = 0; i < count; i++) {
      const side = Math.random() > 0.5 ? 'left' : 'right';
      let type = 'shambler';
      const roll = Math.random();

      if (this.currentWave >= 1 && roll < 0.25) {
        type = 'runner'; // Fast flanking runners (25%)
      } else if (this.currentWave >= 2 && roll > 0.82) {
        type = 'armored';
      } else if (this.currentWave >= 3 && roll > 0.88) {
        type = 'spitter'; // Acid artillery
      } else if (this.currentWave >= 4 && roll > 0.94) {
        type = 'brute';
      }

      this.hordeSpawnQueue.push({ type, side });
    }

    // Guaranteed Brute on every 4th wave
    if (this.currentWave >= 4 && this.currentWave % 4 === 0) {
      this.hordeSpawnQueue.push({ type: 'brute', side: Math.random() > 0.5 ? 'left' : 'right' });
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

    // Trigger Horde Refugee Rescue distress event right after wave is repelled!
    if (engine && engine.triggerRefugeeEvent) {
      setTimeout(() => {
        if (window.gameEngine && !window.gameEngine.isPaused) {
          window.gameEngine.triggerRefugeeEvent();
        }
      }, 1200);
    }

    // Every 5 waves: spawn a Zombie Boss!
    if (this.currentWave > 0 && this.currentWave % 5 === 0) {
      setTimeout(() => {
        if (window.gameEngine) window.gameEngine.spawnBoss();
      }, 3500);
    }
  }
}

// ══════════════════════════════════════════════════════════
// ZOMBIE BOSS — Apex predator, triggers all-hands defense
// ══════════════════════════════════════════════════════════
class ZombieBoss {
  constructor(side) {
    this.side = side || (Math.random() < 0.5 ? 'left' : 'right');
    this.maxHp = 2200 + (window.gameEngine ? window.gameEngine.waveManager.currentWave * 100 : 0);
    this.hp = this.maxHp;
    this.speed = 18;
    this.damage = 20;
    this.size = 38;
    this.x = this.side === 'left' ? -60 : 1340;
    this.y = CONFIG.SURFACE_Y;
    this.isDead = false;
    this.hitFlash = 0;
    this.animTime = 0;
    this.walkCycle = 0;

    // Special attacks
    this.slamCooldown = 0;
    this.slamRadius = 90;
    this.chargeCooldown = 0;
    this.isCharging = false;
    this.chargeSpeed = 0;
    this.chargeDir = 0;
    this.minionTimer = 0;
    this.roarTimer = 0;

    // Rage mode (below 30% HP)
    this.isEnraged = false;
    this.enrageFlash = 0;

    // Reward
    this.reward = { ammo: 250, metal: 120, gunpowder: 80 };
  }

  update(dt, engine) {
    if (this.isDead) return;
    this.animTime += dt;
    this.walkCycle += dt * 2.5;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 5);
    this.slamCooldown = Math.max(0, this.slamCooldown - dt);
    this.chargeCooldown = Math.max(0, this.chargeCooldown - dt);
    this.minionTimer += dt;
    this.roarTimer += dt;

    // Rage: below 30% HP → speed+damage surge
    if (!this.isEnraged && this.hp < this.maxHp * 0.3) {
      this.isEnraged = true;
      this.speed = 32;
      this.damage = 32;
      engine.addNotification('💀 BOSS ENRAGED! Speed & fury surging!', '#FF0000', 4);
    }
    this.enrageFlash = this.isEnraged ? (Math.sin(this.animTime * 8) * 0.5 + 0.5) : 0;

    const centerX = 640;

    // ── Charge attack ──────────────────────────────────────────────────────
    if (this.isCharging) {
      this.x += this.chargeDir * this.chargeSpeed * dt;
      this.chargeSpeed *= (1 - dt * 2.5);
      if (this.chargeSpeed < 5) { this.isCharging = false; this.chargeCooldown = 8; }
      if (engine.particles) {
        engine.particles.spawnSparks(this.x, this.y - 10, 3, '#FF8C00');
      }
    } else {
      // Move toward center
      const dx = centerX - this.x;
      const moveX = Math.sign(dx) * Math.min(Math.abs(dx), this.speed * dt);
      this.x += moveX;

      // Ground Slam when close to center
      if (Math.abs(dx) < 120 && this.slamCooldown <= 0) {
        this._groundSlam(engine);
      }

      // Charge at defenders
      if (this.chargeCooldown <= 0 && Math.abs(dx) > 200) {
        this.isCharging = true;
        this.chargeDir = Math.sign(dx);
        this.chargeSpeed = 130;
        engine.addNotification('💨 BOSS CHARGING!', '#FF6600', 2);
        if (engine.particles) engine.particles.spawnSparks(this.x, this.y - 20, 20, '#FF4400');
      }
    }

    // Spawn minions periodically (2 minions every 18s)
    if (this.minionTimer > 18) {
      this.minionTimer = 0;
      const side = this.x < 640 ? 'right' : 'left';
      for (let i = 0; i < 2; i++) {
        const minion = new Zombie(Math.random() < 0.3 ? 'runner' : 'shambler', side);
        engine.zombies.push(minion);
      }
      engine.addNotification('🧟 Boss summons reinforcements!', '#8B0000', 2.5);
    }

    // Boss roar every 8s
    if (this.roarTimer > 8) {
      this.roarTimer = 0;
      if (window.soundSystem && window.soundSystem.playBossRoar) window.soundSystem.playBossRoar();
      if (engine.particles) engine.particles.spawnSparks(this.x, this.y - 30, 15, '#8B0000');
    }

    // Damage turrets on contact (moderate damage rate)
    const turrets = [engine.leftTurret, engine.rightTurret, ...(engine.constructionSites || []).filter(s => s.built && s.turret).map(s => s.turret)];
    for (const t of turrets) {
      if (t && Math.hypot(this.x - t.x, this.y - (t.y || CONFIG.SURFACE_Y)) < 55) {
        t.health = Math.max(0, (t.health || 100) - this.damage * dt * 0.35);
      }
    }
  }

  _groundSlam(engine) {
    this.slamCooldown = 10;
    // Shake / AOE VFX
    if (engine.particles) {
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        engine.particles.particles.push({
          x: this.x + Math.cos(a) * (Math.random() * this.slamRadius),
          y: this.y + Math.sin(a) * (Math.random() * 20) - 8,
          vx: Math.cos(a) * 4, vy: Math.sin(a) * 4 - 3,
          life: 0.7, maxLife: 0.7,
          size: 4 + Math.random() * 5,
          color: '#6b1111', gravity: 60, type: 'blood'
        });
      }
      engine.particles.spawnSparks(this.x, this.y - 5, 30, '#FF4400');
    }
    if (window.soundSystem && window.soundSystem.playExplosion) window.soundSystem.playExplosion();
    // Damage survivors in range (moderate)
    for (const s of engine.survivors) {
      if (s.isDead) continue;
      if (Math.hypot(s.x - this.x, s.y - this.y) < this.slamRadius) {
        s.hp = Math.max(1, s.hp - 12);
      }
    }
    engine.addNotification('💥 BOSS GROUND SLAM!', '#FF4400', 2);
  }

  takeDamage(amount) {
    if (this.isDead) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.hitFlash = 0.15;
    if (window.gameEngine && window.gameEngine.particles) {
      window.gameEngine.particles.spawnBlood(this.x, this.y - this.size * 0.7, 8, '#8B0000');
    }
    if (this.hp <= 0) { this.die(); return true; }
    return false;
  }

  die() {
    this.isDead = true;
    const engine = window.gameEngine;
    if (!engine) return;

    // Massive death VFX
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = Math.random() * 8 + 2;
      engine.particles.particles.push({
        x: this.x, y: this.y - 20,
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 4,
        life: 1.2, maxLife: 1.2,
        size: 5 + Math.random() * 8,
        color: Math.random() < 0.5 ? '#8B0000' : '#FF4400',
        gravity: 50, type: 'blood'
      });
    }
    engine.particles.spawnSparks(this.x, this.y - 30, 50, '#FFD700');
    if (window.soundSystem && window.soundSystem.playExplosion) {
      window.soundSystem.playExplosion();
      setTimeout(() => window.soundSystem && window.soundSystem.playExplosion(), 300);
    }

    // Reward
    engine.resources.ammo = Math.min(CONFIG.RESOURCE_CAPS.ammo, engine.resources.ammo + this.reward.ammo);
    engine.resources.metal = Math.min(CONFIG.RESOURCE_CAPS.metal, engine.resources.metal + this.reward.metal);
    engine.resources.gunpowder = Math.min(CONFIG.RESOURCE_CAPS.gunpowder, engine.resources.gunpowder + this.reward.gunpowder);
    engine.stats.zombiesKilled = (engine.stats.zombiesKilled || 0) + 1;

    // XP to all survivors
    for (const s of engine.survivors) { if (!s.isDead) { s.addXP && s.addXP(200); } }

    engine.addNotification('🏆 BOSS DEFEATED! +250 Ammo, +120 Metal, +80 Powder! All survivors +200 XP!', '#FFD700', 8);

    // Return survivors to normal duties
    engine.bossActive = false;
    engine.boss = null;
    for (const s of engine.survivors) { s.bossMode = false; }
    if (window.uiManager && window.uiManager.hideBossBar) window.uiManager.hideBossBar();
  }

  draw(ctx) {
    if (this.isDead) return;
    const x = this.x, y = this.y;
    const bob = Math.sin(this.walkCycle) * 3.5;
    const rage = this.enrageFlash;

    ctx.save();
    if (this.hitFlash > 0) {
      ctx.filter = `brightness(${3 + this.hitFlash * 6})`;
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, this.size * 1.1, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body — massive hulking frame
    const bodyColor = this.isEnraged
      ? `rgba(${Math.floor(180 + rage * 75)},20,20,1)`
      : '#3d0000';
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.roundRect(x - this.size * 0.72, y - this.size * 1.6 + bob, this.size * 1.44, this.size * 1.6, 6);
    ctx.fill();

    // Torn clothing / exposed rotting flesh patches
    ctx.fillStyle = '#5a1a00';
    ctx.fillRect(x - 14, y - this.size + bob, 8, 16);
    ctx.fillRect(x + 6, y - this.size * 1.3 + bob, 10, 12);

    // Arms — dragging knuckles
    const armSwing = Math.sin(this.walkCycle) * 18;
    ctx.strokeStyle = bodyColor; ctx.lineWidth = 10;
    // Left arm
    ctx.beginPath();
    ctx.moveTo(x - this.size * 0.72, y - this.size * 1.1 + bob);
    ctx.lineTo(x - this.size * 1.3, y - this.size * 0.4 + bob + armSwing * 0.4);
    ctx.stroke();
    // Right arm
    ctx.beginPath();
    ctx.moveTo(x + this.size * 0.72, y - this.size * 1.1 + bob);
    ctx.lineTo(x + this.size * 1.3, y - this.size * 0.4 + bob - armSwing * 0.4);
    ctx.stroke();

    // Clawed hands
    ctx.fillStyle = '#2a0000';
    ctx.beginPath(); ctx.arc(x - this.size * 1.3, y - this.size * 0.35 + bob + armSwing * 0.4, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + this.size * 1.3, y - this.size * 0.35 + bob - armSwing * 0.4, 7, 0, Math.PI * 2); ctx.fill();

    // Neck
    ctx.fillStyle = '#2d0000';
    ctx.fillRect(x - 9, y - this.size * 1.65 + bob, 18, 12);

    // Head — massive deformed skull
    ctx.fillStyle = '#4a0a0a';
    ctx.beginPath();
    ctx.ellipse(x, y - this.size * 1.95 + bob, this.size * 0.72, this.size * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();

    // Skull damage cracks
    ctx.strokeStyle = '#1a0000'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x - 8, y - this.size * 2.3 + bob); ctx.lineTo(x - 4, y - this.size * 1.8 + bob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 5, y - this.size * 2.2 + bob); ctx.lineTo(x + 2, y - this.size * 1.75 + bob); ctx.stroke();

    // Glowing red eyes
    const eyeGlow = 0.7 + rage * 0.3 + Math.sin(this.animTime * 4) * 0.15;
    ctx.fillStyle = `rgba(255,0,0,${eyeGlow})`;
    ctx.shadowColor = '#FF0000'; ctx.shadowBlur = 12 + rage * 10;
    ctx.beginPath(); ctx.ellipse(x - 11, y - this.size * 2.0 + bob, 7, 5, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 11, y - this.size * 2.0 + bob, 7, 5, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // Exposed teeth / jaw
    ctx.fillStyle = '#ede0c8';
    for (let i = -3; i <= 3; i++) {
      ctx.fillRect(x + i * 5 - 2, y - this.size * 1.7 + bob, 3, 6 - Math.abs(i));
    }

    // Spikes / bone protrusions on shoulders
    ctx.fillStyle = '#1a0000';
    for (let i = 0; i < 4; i++) {
      const sx = x - this.size * 0.72 + i * 8 - 4;
      ctx.beginPath();
      ctx.moveTo(sx, y - this.size * 1.6 + bob);
      ctx.lineTo(sx - 4, y - this.size * 1.85 + bob);
      ctx.lineTo(sx + 4, y - this.size * 1.85 + bob);
      ctx.fill();
    }
    // Right shoulder spikes
    for (let i = 0; i < 4; i++) {
      const sx = x + this.size * 0.72 - i * 8 + 4;
      ctx.beginPath();
      ctx.moveTo(sx, y - this.size * 1.6 + bob);
      ctx.lineTo(sx - 4, y - this.size * 1.85 + bob);
      ctx.lineTo(sx + 4, y - this.size * 1.85 + bob);
      ctx.fill();
    }

    // Charge dust trail
    if (this.isCharging) {
      ctx.fillStyle = 'rgba(180,100,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(x - this.chargeDir * 30, y - 10, 40, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // ── Boss HP Bar ─────────────────────────────────────────────────────────
    const barW = 100, barH = 8;
    const bx = x - barW / 2, by = y - this.size * 2.4 + bob - 14;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
    const hpRatio = this.hp / this.maxHp;
    ctx.fillStyle = hpRatio > 0.6 ? '#27ae60' : hpRatio > 0.3 ? '#f39c12' : '#e74c3c';
    ctx.fillRect(bx, by, barW * hpRatio, barH);
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 0.8;
    ctx.strokeRect(bx, by, barW, barH);
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 9px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText(`💀 BOSS ${Math.ceil(this.hp)}/${this.maxHp}`, x, by - 3);
  }
}

window.Zombie = Zombie;
window.ZombieBoss = ZombieBoss;
window.WaveManager = WaveManager;

