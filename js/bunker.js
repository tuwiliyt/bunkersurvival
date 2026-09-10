// Underground Bunker Architecture & Room Management
class Room {
  constructor(data) {
    this.id = data.id;
    this.floor = data.floor;
    this.col = data.col;
    this.name = data.name;
    this.icon = data.icon;
    this.desc = data.desc;
    this.produces = data.produces;
    this.baseRate = data.rate || 0;
    this.cost = data.cost || null;
    this.maxWorkers = data.maxWorkers || 2;
    this.powerCost = data.powerCost || 2;
    this.level = 1;
    this.color = data.color;

    // Calculate screen bounding box
    const shaftW = CONFIG.ELEVATOR_WIDTH;
    const leftWidth = (CONFIG.ELEVATOR_X - shaftW / 2) - CONFIG.BUNKER_LEFT;
    const rightWidth = CONFIG.BUNKER_RIGHT - (CONFIG.ELEVATOR_X + shaftW / 2);

    const roomW = (this.col < 2) ? (leftWidth / 2) : (rightWidth / 2);
    let rx = 0;
    if (this.col === 0) rx = CONFIG.BUNKER_LEFT;
    else if (this.col === 1) rx = CONFIG.BUNKER_LEFT + roomW;
    else if (this.col === 2) rx = CONFIG.ELEVATOR_X + shaftW / 2;
    else if (this.col === 3) rx = CONFIG.ELEVATOR_X + shaftW / 2 + roomW;

    const ry = CONFIG.BUNKER_TOP + (this.floor - 1) * CONFIG.FLOOR_HEIGHT;

    this.x = rx;
    this.y = ry;
    this.width = roomW;
    this.height = CONFIG.FLOOR_HEIGHT;

    this.progress = 0; // Production progress cycle
    this.hovered = false;
  }

  upgrade() {
    const upgradeCost = this.level * 40;
    if (window.gameEngine.resources.metal >= upgradeCost) {
      window.gameEngine.resources.metal -= upgradeCost;
      this.level++;
      window.soundSystem.playBeep(true);
      window.gameEngine.particles.spawnSparks(this.x + this.width / 2, this.y + this.height / 2, 20, '#55ee88');
      window.gameEngine.particles.addFloatingText(`TIER ${this.level}!`, this.x + this.width / 2 - 25, this.y + 30, '#55ee88');
      return true;
    }
    window.soundSystem.playBeep(false);
    return false;
  }

  update(dt, workers, hasPower) {
    // Bio-Refinery passive emergency fuel generation (anaerobic biomass digestion occurs even with 0 workers)
    if (this.id === 'bio_refinery') {
      const passiveRate = (CONFIG.BIO_REFINERY_PASSIVE_RATE || 0.18) * (hasPower ? 1.0 : 0.65);
      const fuelCap = CONFIG.RESOURCE_CAPS.fuel || 150;
      window.gameEngine.resources.fuel = Math.min(fuelCap, window.gameEngine.resources.fuel + passiveRate * dt);
    }

    // Generator power grid output and fuel burn are centrally simulated in GameEngine.updatePowerGrid
    if (this.id === 'generator') {
      if (workers && workers.length > 0) {
        for (const w of workers) {
          if (w.isDead) continue;
          if (w.addXP) {
            const xpRate = CONFIG.SURVIVOR_XP_PER_SEC_WORKING * (w.specialty === this.id ? CONFIG.SURVIVOR_XP_SPECIALTY_MULT : 1.0);
            w.addXP(xpRate * dt);
          }
        }
      }
      return;
    }

    if (!workers || workers.length === 0 || !hasPower || !this.produces) return;

    // Production calculation & Tech modifiers
    let techMult = 1.0;
    if (this.produces === 'ammo' && window.gameEngine.techTree.ammoOptimization) techMult = 1.4;
    if (this.produces === 'food' && window.gameEngine.techTree.hydroBoost) techMult = 1.5;

    // Calculate sum of worker efficiencies & award work XP
    let workerEffSum = 0;
    for (const w of workers) {
      if (w.isDead) continue;
      const eff = w.getEfficiency ? w.getEfficiency() : 1.0;
      const specMult = (w.specialty === this.id) ? 1.25 : 1.0;
      workerEffSum += eff * specMult;
      if (w.addXP) {
        const xpRate = CONFIG.SURVIVOR_XP_PER_SEC_WORKING * (w.specialty === this.id ? CONFIG.SURVIVOR_XP_SPECIALTY_MULT : 1.0);
        w.addXP(xpRate * dt);
      }
    }

    const effectiveRate = this.baseRate * (1 + (this.level - 1) * 0.4) * (workerEffSum * 0.8) * techMult;

    // Check resource requirements
    let canProduce = true;
    if (this.cost) {
      for (const [resKey, amountPerSec] of Object.entries(this.cost)) {
        if (window.gameEngine.resources[resKey] < amountPerSec * dt) {
          canProduce = false;
          break;
        }
      }
    }

    if (canProduce) {
      // Consume cost
      if (this.cost) {
        for (const [resKey, amountPerSec] of Object.entries(this.cost)) {
          window.gameEngine.resources[resKey] = Math.max(0, window.gameEngine.resources[resKey] - amountPerSec * dt);
        }
      }

      // Add produced resource
      const gain = effectiveRate * dt;
      const current = window.gameEngine.resources[this.produces];
      const cap = CONFIG.RESOURCE_CAPS[this.produces] || 999;
      window.gameEngine.resources[this.produces] = Math.min(cap, current + gain);
    }
  }

  draw(ctx, isPowered, workers) {
    // Room background
    ctx.fillStyle = isPowered ? this.color : '#1f1e24';
    ctx.fillRect(this.x + 2, this.y + 2, this.width - 4, this.height - 4);

    // Wall grid patterns
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.x + 6, this.y + 6, this.width - 12, this.height - 12);

    // Hover outline
    if (this.hovered) {
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;
      ctx.strokeRect(this.x + 2, this.y + 2, this.width - 4, this.height - 4);
    } else {
      ctx.strokeStyle = '#2c3e50';
      ctx.lineWidth = 2;
      ctx.strokeRect(this.x, this.y, this.width, this.height);
    }

    // Interior specific illustrations
    this.drawRoomInterior(ctx, isPowered);

    // Room Label & Tier Badge
    ctx.fillStyle = isPowered ? '#ffffff' : '#7f8c8d';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${this.icon} ${this.name}`, this.x + 8, this.y + 18);

    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 9px monospace';
    ctx.fillText(`T${this.level}`, this.x + this.width - 24, this.y + 18);

    // Worker count indicator
    ctx.fillStyle = workers.length > 0 ? '#2ecc71' : '#e74c3c';
    ctx.font = '10px monospace';
    ctx.fillText(`👥 ${workers.length}/${this.maxWorkers}`, this.x + 8, this.y + this.height - 8);

    // Power icon
    if (!isPowered) {
      ctx.fillStyle = '#e74c3c';
      ctx.fillText('⚡ NO POWER', this.x + this.width - 75, this.y + this.height - 8);
    }
  }

  drawRoomInterior(ctx, isPowered) {
    const cx = this.x + this.width / 2;
    const by = this.y + this.height - 14;
    const now = Date.now();

    ctx.save();

    // Fluorescent flicker during severe power dips (< 20 PWR)
    const engine = window.gameEngine;
    if (engine && engine.resources.power < 20 && isPowered) {
      if (Math.random() < 0.12) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(this.x + 2, this.y + 2, this.width - 4, this.height - 4);
      }
    }

    // Unpowered emergency red bulkhead light fixture & pulsing warning glow
    if (!isPowered) {
      const redPulse = (Math.sin(now / 220) + 1) * 0.5;
      const lightX = this.x + this.width - 16;
      const lightY = this.y + 12;

      // Wall/ceiling mounted emergency light bracket
      ctx.fillStyle = '#1e242c';
      ctx.fillRect(lightX - 5, lightY - 4, 10, 4);

      // Red emergency beacon dome
      ctx.fillStyle = redPulse > 0.4 ? '#ff2222' : '#880000';
      ctx.beginPath();
      ctx.arc(lightX, lightY + 2, 4, 0, Math.PI);
      ctx.fill();

      // Pulsing red ambient hazard glow across dark unpowered room
      if (ctx.createRadialGradient) {
        const redGlow = ctx.createRadialGradient(lightX, lightY + 2, 2, lightX, lightY + 2, 38);
        redGlow.addColorStop(0, `rgba(255, 30, 30, ${0.35 * redPulse})`);
        redGlow.addColorStop(0.6, `rgba(180, 0, 0, ${0.12 * redPulse})`);
        redGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = redGlow;
        ctx.beginPath();
        ctx.arc(lightX, lightY + 2, 38, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // =========================================================================
    // 1. AIRLOCK DEPOT (Sub-level 1, Col 0)
    // =========================================================================
    if (this.id === 'airlock') {
      // Heavy hydraulic reinforced blast door on the left
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(cx - 42, by - 44, 26, 44);
      ctx.strokeStyle = '#1a252f';
      ctx.lineWidth = 1.8;
      ctx.strokeRect(cx - 42, by - 44, 26, 44);

      // Yellow & Black hazard chevrons on blast door edge
      for (let h = 0; h < 4; h++) {
        ctx.fillStyle = h % 2 === 0 ? '#f1c40f' : '#111111';
        ctx.fillRect(cx - 41, by - 42 + h * 10, 5, 9);
      }

      // Pressure locking wheel on blast door
      ctx.strokeStyle = '#bdc3c7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx - 29, by - 22, 6.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 29, by - 28.5); ctx.lineTo(cx - 29, by - 15.5);
      ctx.moveTo(cx - 35.5, by - 22); ctx.lineTo(cx - 22.5, by - 22);
      ctx.stroke();

      // Decontamination spray mist nozzles on ceiling track
      ctx.fillStyle = '#7f8c8d';
      ctx.fillRect(cx - 8, by - 46, 28, 4);
      for (const nx of [cx - 2, cx + 12]) {
        ctx.fillStyle = '#95a5a6';
        ctx.beginPath();
        ctx.moveTo(nx, by - 42); ctx.lineTo(nx - 3, by - 38); ctx.lineTo(nx + 3, by - 38);
        ctx.closePath();
        ctx.fill();

        if (isPowered) {
          // Spraying fine decontamination aerosol mist
          const mistPulse = (Math.sin(now / 110 + nx) + 1) * 0.5;
          ctx.fillStyle = `rgba(180, 245, 255, ${0.18 + mistPulse * 0.25})`;
          ctx.beginPath();
          ctx.moveTo(nx, by - 38);
          ctx.lineTo(nx - 7 - mistPulse * 3, by - 18);
          ctx.lineTo(nx + 7 + mistPulse * 3, by - 18);
          ctx.closePath();
          ctx.fill();
        }
      }

      // Floor drainage grating
      ctx.fillStyle = '#111';
      ctx.fillRect(cx - 8, by - 4, 30, 4);
      ctx.fillStyle = '#4a5568';
      for (let g = 0; g < 6; g++) {
        ctx.fillRect(cx - 6 + g * 5, by - 4, 2, 4);
      }

      // Wall-mounted Hazmat suit rack & oxygen breathing tank
      ctx.fillStyle = '#f39c12'; // Yellow protective suit
      ctx.fillRect(cx + 26, by - 36, 12, 22);
      ctx.fillStyle = '#2c3e50'; // Oxygen visor
      ctx.fillRect(cx + 28, by - 34, 8, 5);
      ctx.fillStyle = '#27ae60'; // Oxygen bottle
      ctx.fillRect(cx + 40, by - 32, 6, 18);

      // Airlock status panel LED
      ctx.fillStyle = isPowered ? '#2ecc71' : '#e74c3c';
      ctx.beginPath();
      ctx.arc(cx - 29, by - 38, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // =========================================================================
    // 2. MUNITIONS ARMORY (Sub-level 1, Col 1)
    // =========================================================================
    else if (this.id === 'armory') {
      // Sturdy heavy timber & steel workbench
      ctx.fillStyle = '#3d2612';
      ctx.fillRect(cx - 38, by - 14, 76, 14);
      ctx.fillStyle = '#2d3748';
      ctx.fillRect(cx - 38, by - 16, 76, 2);

      // Reciprocating Cartridge Loading Press
      const pressX = cx - 22;
      const pressCycle = isPowered ? (Math.sin(now / 140) + 1) * 0.5 : 0;
      const ramY = by - 28 + pressCycle * 7;

      // Heavy press vertical cast-iron frame
      ctx.fillStyle = '#1a202c';
      ctx.fillRect(pressX - 7, by - 42, 14, 28);
      ctx.strokeStyle = '#4a5568';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(pressX - 7, by - 42, 14, 28);

      // Moving ram & stamping die
      ctx.fillStyle = '#cbd5e0';
      ctx.fillRect(pressX - 3, ramY, 6, 10);
      ctx.fillStyle = '#a0aec0';
      ctx.fillRect(pressX - 5, ramY - 3, 10, 3);

      // Mechanical stamping sparks at bottom of stroke!
      if (isPowered && pressCycle > 0.88) {
        ctx.fillStyle = '#ffaa33';
        ctx.shadowColor = '#ffaa33';
        ctx.shadowBlur = 6;
        for (let s = 0; s < 4; s++) {
          const spX = pressX + (Math.random() - 0.5) * 8;
          const spY = by - 16 - Math.random() * 6;
          ctx.fillRect(spX, spY, 1.8, 1.8);
        }
        ctx.shadowBlur = 0;
      }

      // Machine Brass Bullet Trays on bench
      ctx.fillStyle = '#2d3748';
      ctx.fillRect(cx - 8, by - 19, 18, 5);
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = '#d4af37'; // Brass case
        ctx.fillRect(cx - 7 + i * 3.5, by - 24, 2.4, 6);
        ctx.fillStyle = '#c0392b'; // Copper bullet jacket
        ctx.fillRect(cx - 7 + i * 3.5, by - 26, 2.4, 2.2);
      }

      // Stacked Military Ammo Crates with yellow stencils
      // Bottom Crate
      ctx.fillStyle = '#2d4726';
      ctx.fillRect(cx + 14, by - 24, 26, 12);
      ctx.strokeStyle = '#1e3019';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx + 14, by - 24, 26, 12);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 6px monospace';
      ctx.fillText('7.62', cx + 18, by - 16);

      // Top Crate (slightly offset)
      ctx.fillStyle = '#35542d';
      ctx.fillRect(cx + 16, by - 36, 22, 11);
      ctx.strokeRect(cx + 16, by - 36, 22, 11);
      ctx.fillStyle = '#ffd700';
      ctx.fillText('AP', cx + 22, by - 29);

      // Hanging Linked Ammo Belt draped along the rear wall
      ctx.fillStyle = '#d4af37';
      for (let b = 0; b < 7; b++) {
        const drop = Math.sin(b / 6 * Math.PI) * 4;
        ctx.fillRect(cx - 36 + b * 4, by - 34 + drop, 2.4, 7);
        ctx.fillStyle = '#4a5568'; // Steel disintegrating link
        ctx.fillRect(cx - 37 + b * 4, by - 32 + drop, 4, 2.5);
        ctx.fillStyle = '#d4af37';
      }
    }

    // =========================================================================
    // 3. SECURITY & RADAR (Sub-level 1, Col 2)
    // =========================================================================
    else if (this.id === 'security') {
      // CRT Radar Monitor Housing
      const monW = 56, monH = 36;
      ctx.fillStyle = '#0f1419';
      ctx.fillRect(cx - monW / 2 - 12, by - monH - 2, monW, monH);
      ctx.strokeStyle = '#2d3748';
      ctx.lineWidth = 1.8;
      ctx.strokeRect(cx - monW / 2 - 12, by - monH - 2, monW, monH);

      if (isPowered) {
        const rx = cx - 12;
        const ry = by - monH / 2 - 2;
        const rr = 14;

        // Concentric range rings
        ctx.strokeStyle = 'rgba(0, 255, 120, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(rx, ry, 6, 0, Math.PI * 2);
        ctx.arc(rx, ry, rr, 0, Math.PI * 2);
        ctx.stroke();

        // Crosshairs
        ctx.beginPath();
        ctx.moveTo(rx - rr, ry); ctx.lineTo(rx + rr, ry);
        ctx.moveTo(rx, ry - rr); ctx.lineTo(rx, ry + rr);
        ctx.stroke();

        // Sweeping Phosphor Vector Beam
        const sweepAngle = (now / 420) % (Math.PI * 2);
        ctx.strokeStyle = '#00ff88';
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 6;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx + Math.cos(sweepAngle) * rr, ry + Math.sin(sweepAngle) * rr);
        ctx.stroke();

        // Trailing radar sweep phosphor wedge
        ctx.fillStyle = 'rgba(0, 255, 136, 0.16)';
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.arc(rx, ry, rr, sweepAngle - 0.6, sweepAngle);
        ctx.closePath();
        ctx.fill();

        // Blinking threat blips
        const blipBlink = Math.sin(now / 110) > 0;
        if (blipBlink) {
          ctx.fillStyle = (engine && engine.waveManager && engine.waveManager.isHordeActive) ? '#ff2222' : '#f1c40f';
          ctx.shadowColor = ctx.fillStyle;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(rx - 8, ry - 5, 2.0, 0, Math.PI * 2);
          ctx.arc(rx + 9, ry + 6, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
      }

      // CCTV Monitor Bank on the right (surface camera feeds)
      const cctvX = cx + 20;
      ctx.fillStyle = '#111';
      ctx.fillRect(cctvX, by - 38, 22, 16);
      ctx.fillRect(cctvX, by - 20, 22, 16);
      ctx.strokeStyle = '#333';
      ctx.strokeRect(cctvX, by - 38, 22, 16);
      ctx.strokeRect(cctvX, by - 20, 22, 16);

      if (isPowered) {
        // Feed 1: Surface Cabin outline
        ctx.fillStyle = '#1a3a2a';
        ctx.fillRect(cctvX + 1, by - 37, 20, 14);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(cctvX + 7, by - 28, 7, 5); // Cabin silhouette

        // Feed 2: Turret outpost feed with scanlines
        ctx.fillStyle = '#1e2b37';
        ctx.fillRect(cctvX + 1, by - 19, 20, 14);
        ctx.fillStyle = '#00d2d3';
        ctx.fillRect(cctvX + 5, by - 12, 5, 5);

        // Animated CCTV scanlines
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        const scanY1 = (now / 30) % 13;
        const scanY2 = (now / 25) % 13;
        ctx.fillRect(cctvX + 1, by - 37 + scanY1, 20, 1);
        ctx.fillRect(cctvX + 1, by - 19 + scanY2, 20, 1);
      }
    }

    // =========================================================================
    // 4. MEDICAL CLINIC (Sub-level 1, Col 3)
    // =========================================================================
    else if (this.id === 'clinic') {
      // Hospital / Operating Gurney
      ctx.fillStyle = '#bdc3c7';
      ctx.fillRect(cx - 30, by - 14, 46, 14); // Steel bed legs & base
      ctx.fillStyle = '#3498db';
      ctx.fillRect(cx - 28, by - 18, 42, 4);  // Blue mattress
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 28, by - 22, 10, 4); // Pillow

      // Red Cross emblem on back wall
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(cx - 3, this.y + 24, 6, 16);
      ctx.fillRect(cx - 8, this.y + 29, 16, 6);

      // Live Vital Signs ECG Heartbeat Oscilloscope
      ctx.fillStyle = '#111827';
      ctx.fillRect(cx + 8, by - 38, 26, 18);
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(cx + 8, by - 38, 26, 18);

      if (isPowered) {
        // Animated ECG waveform line with QRS spike
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.2;
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        const ecgProg = (now / 35) % 24;
        ctx.moveTo(cx + 9, by - 29);
        ctx.lineTo(cx + 9 + ecgProg * 0.4, by - 29);
        ctx.lineTo(cx + 9 + ecgProg * 0.5, by - 36); // peak
        ctx.lineTo(cx + 9 + ecgProg * 0.65, by - 24); // dip
        ctx.lineTo(cx + 9 + ecgProg * 0.75, by - 29);
        ctx.lineTo(cx + 33, by - 29);
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#34d399';
        ctx.font = '6px monospace';
        ctx.fillText('BPM 74', cx + 11, by - 22);
      }

      // IV Drip Stand with falling saline micro-droplets
      ctx.strokeStyle = '#cbd5e0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 33, by - 12);
      ctx.lineTo(cx - 33, by - 40);
      ctx.lineTo(cx - 30, by - 40);
      ctx.stroke();

      // Saline fluid bag
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillRect(cx - 35, by - 39, 6, 10);

      // Falling saline micro-droplets
      if (isPowered) {
        const dripDrop = (now / 55) % 8;
        ctx.fillStyle = '#67e8f9';
        ctx.fillRect(cx - 33, by - 27 + dripDrop, 1.2, 2);
      }
    }

    // =========================================================================
    // 5. LIVING QUARTERS A (Sub-level 2, Col 0)
    // =========================================================================
    else if (this.id === 'quarters_1') {
      // Double-deck steel bunk bed
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(cx - 34, by - 38, 48, 38);
      ctx.fillStyle = '#1a252f';
      ctx.strokeRect(cx - 34, by - 38, 48, 38);

      // Bunk beds & pillows
      ctx.fillStyle = '#7f8c8d'; // Blankets
      ctx.fillRect(cx - 32, by - 16, 44, 7);
      ctx.fillRect(cx - 32, by - 34, 44, 7);
      ctx.fillStyle = '#ecf0f1'; // Pillows
      ctx.fillRect(cx - 32, by - 19, 8, 4);
      ctx.fillRect(cx - 32, by - 37, 8, 4);

      // Bed ladder rungs
      ctx.strokeStyle = '#95a5a6';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + 10, by - 38); ctx.lineTo(cx + 10, by);
      ctx.moveTo(cx + 14, by - 38); ctx.lineTo(cx + 14, by);
      for (let r = 8; r <= 32; r += 8) {
        ctx.moveTo(cx + 10, by - r); ctx.lineTo(cx + 14, by - r);
      }
      ctx.stroke();

      // Retro Bedside Radio on timber nightstand
      ctx.fillStyle = '#5c4033';
      ctx.fillRect(cx + 18, by - 14, 18, 14);
      ctx.fillStyle = '#3a2512';
      ctx.fillRect(cx + 20, by - 24, 14, 10);
      if (isPowered) {
        // Glowing amber tuning dial
        ctx.fillStyle = '#f39c12';
        ctx.fillRect(cx + 22, by - 21, 10, 3);
        // Wire antenna
        ctx.strokeStyle = '#bdc3c7';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + 31, by - 24); ctx.lineTo(cx + 34, by - 34);
        ctx.stroke();
      }

      // Tactical map on back wall
      ctx.fillStyle = '#d2b48c';
      ctx.fillRect(cx - 18, this.y + 24, 16, 12);
      ctx.strokeStyle = '#8b4513';
      ctx.strokeRect(cx - 18, this.y + 24, 16, 12);
    }

    // =========================================================================
    // 6. HYDROPONICS BAY (Sub-level 2, Col 1)
    // =========================================================================
    else if (this.id === 'hydroponics') {
      // Violet Grow Lamps with ambient UV glow
      if (isPowered) {
        const glowGrad = ctx.createLinearGradient(cx, this.y + 18, cx, by);
        glowGrad.addColorStop(0, 'rgba(186, 85, 211, 0.45)');
        glowGrad.addColorStop(1, 'rgba(186, 85, 211, 0.05)');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(cx - 40, this.y + 18, 80, by - this.y - 18);

        // Overhead violet LED fixtures
        ctx.fillStyle = '#4a235a';
        ctx.fillRect(cx - 36, this.y + 20, 72, 4);
        ctx.fillStyle = '#e056fd';
        ctx.fillRect(cx - 34, this.y + 24, 68, 2);
      }

      // Multi-layer aluminum cultivation troughs
      ctx.fillStyle = '#34495e';
      ctx.fillRect(cx - 38, by - 10, 76, 10); // Lower trough
      ctx.fillRect(cx - 38, by - 28, 76, 8);  // Upper trough

      // Upper tier: Tall golden-green corn stalks with golden silk tassels
      for (let c = 0; c < 5; c++) {
        const px = cx - 32 + c * 15;
        ctx.strokeStyle = '#27ae60';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(px, by - 28);
        ctx.lineTo(px, by - 44);
        ctx.stroke();

        // Corn leaves
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(px - 4, by - 38, 4, 2);
        ctx.fillRect(px, by - 34, 4, 2);

        // Golden corn ear & silk
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(px - 1, by - 41, 3, 5);
        ctx.fillStyle = '#e67e22';
        ctx.fillRect(px - 0.5, by - 44, 2, 3);
      }

      // Lower tier: Bushy tomato vines with hanging clusters of ripe tomatoes
      for (let i = 0; i < 6; i++) {
        const px = cx - 30 + i * 11;
        ctx.fillStyle = '#227093';
        ctx.beginPath();
        ctx.arc(px, by - 12, 5.5, 0, Math.PI);
        ctx.fill();

        // Ripe red tomatoes
        ctx.fillStyle = '#ff5252';
        ctx.beginPath();
        ctx.arc(px - 2, by - 13, 2.2, 0, Math.PI * 2);
        ctx.arc(px + 2, by - 11, 2.0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Aeroponic Mist Dispensers spraying fine humid mist pulses
      if (isPowered) {
        const mistAlpha = (Math.sin(now / 90) + 1) * 0.5 * 0.35;
        ctx.fillStyle = `rgba(220, 160, 255, ${mistAlpha})`;
        ctx.beginPath();
        ctx.ellipse(cx, by - 20, 32, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Clear drip irrigation tubes with animated cyan water pulses
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.65)';
      ctx.lineWidth = 1.2;
      const pulseOff = (now / 50) % 10;
      ctx.beginPath();
      ctx.moveTo(cx - 36, by - 10); ctx.lineTo(cx + 36, by - 10);
      ctx.stroke();
    }

    // =========================================================================
    // 7. WATER FILTRATION (Sub-level 2, Col 2)
    // =========================================================================
    else if (this.id === 'water_filter') {
      // Twin cylindrical acrylic water reservoir tanks
      for (const tx of [cx - 24, cx + 8]) {
        // Acrylic tank body
        ctx.fillStyle = '#1e3799';
        ctx.fillRect(tx, by - 36, 20, 36);
        ctx.strokeStyle = '#4a69bd';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(tx, by - 36, 20, 36);

        // Water level inside tank
        ctx.fillStyle = '#00a8ff';
        ctx.fillRect(tx + 1, by - 30, 18, 30);

        if (isPowered) {
          // Effervescent rising micro-bubbles
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          const b1 = (now / 45 + tx) % 26;
          const b2 = (now / 60 + tx * 2) % 26;
          ctx.beginPath();
          ctx.arc(tx + 6, by - 6 - b1, 1.3, 0, Math.PI * 2);
          ctx.arc(tx + 14, by - 8 - b2, 1.0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Reverse-Osmosis filtration manifold between tanks
      ctx.fillStyle = '#718096';
      ctx.fillRect(cx - 4, by - 32, 12, 5);
      ctx.fillRect(cx - 4, by - 22, 12, 5);

      // Spinning 4-blade water flow impeller wheel
      const impX = cx + 2;
      const impY = by - 12;
      ctx.strokeStyle = '#dcdde1';
      ctx.strokeRect(impX - 5, impY - 5, 10, 10);
      if (isPowered) {
        const impAngle = (now / 40) % Math.PI;
        ctx.save();
        ctx.translate(impX, impY);
        ctx.rotate(impAngle);
        ctx.strokeStyle = '#00d2d3';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-4, 0); ctx.lineTo(4, 0);
        ctx.moveTo(0, -4); ctx.lineTo(0, 4);
        ctx.stroke();
        ctx.restore();
      }

      // Polished copper connecting pipes
      ctx.strokeStyle = '#d35400';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 32, by - 34); ctx.lineTo(cx - 24, by - 34);
      ctx.moveTo(cx + 28, by - 34); ctx.lineTo(cx + 36, by - 34);
      ctx.stroke();
    }

    // =========================================================================
    // 8. MESS HALL & KITCHEN (Sub-level 2, Col 3)
    // =========================================================================
    else if (this.id === 'kitchen') {
      // Stainless steel commercial stove range
      ctx.fillStyle = '#7f8c8d';
      ctx.fillRect(cx - 36, by - 22, 34, 22);
      ctx.strokeStyle = '#2c3e50';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - 36, by - 22, 34, 22);

      // Glowing gas burner flame
      if (isPowered) {
        ctx.fillStyle = '#e67e22';
        ctx.fillRect(cx - 30, by - 24, 18, 2);
        ctx.fillStyle = '#3498db';
        ctx.fillRect(cx - 28, by - 25, 14, 1.5);
      }

      // Large cast-iron soup cauldron simmering with stew
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(cx - 31, by - 34, 20, 10);
      ctx.beginPath();
      ctx.arc(cx - 21, by - 24, 10, 0, Math.PI);
      ctx.fill();

      // Rising wavy steam plumes from stew
      if (isPowered) {
        ctx.strokeStyle = 'rgba(236, 240, 241, 0.45)';
        ctx.lineWidth = 1.5;
        const steam1 = Math.sin(now / 120) * 3;
        const steam2 = Math.cos(now / 140) * 3;
        ctx.beginPath();
        ctx.moveTo(cx - 24 + steam1, by - 35);
        ctx.quadraticCurveTo(cx - 26, by - 42, cx - 22 + steam1, by - 48);
        ctx.moveTo(cx - 18 + steam2, by - 35);
        ctx.quadraticCurveTo(cx - 15, by - 43, cx - 19 + steam2, by - 49);
        ctx.stroke();
      }

      // Wooden Prep Butcher Block Table
      ctx.fillStyle = '#d35400';
      ctx.fillRect(cx + 4, by - 16, 32, 16);
      ctx.fillStyle = '#a04000';
      ctx.fillRect(cx + 4, by - 18, 32, 3);

      // Loaf of bread & sliced carrots
      ctx.fillStyle = '#f39c12';
      ctx.beginPath();
      ctx.ellipse(cx + 14, by - 20, 6, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e67e22';
      ctx.fillRect(cx + 24, by - 20, 2.5, 2.5);
      ctx.fillRect(cx + 28, by - 20, 2.5, 2.5);

      // Hanging culinary utensil rack on back wall
      ctx.fillStyle = '#34495e';
      ctx.fillRect(cx - 32, this.y + 24, 64, 2);
      for (let u = 0; u < 4; u++) {
        ctx.fillStyle = '#bdc3c7';
        ctx.fillRect(cx - 24 + u * 14, this.y + 26, 2, 7);
      }
    }

    // =========================================================================
    // 9. LIVING QUARTERS B (Sub-level 3, Col 0)
    // =========================================================================
    else if (this.id === 'quarters_2') {
      // Double bunk beds with military camouflage quilts
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(cx - 36, by - 38, 46, 38);
      ctx.strokeStyle = '#1a252f';
      ctx.strokeRect(cx - 36, by - 38, 46, 38);

      // Camouflage quilted sleeping rolls
      ctx.fillStyle = '#4a5d43';
      ctx.fillRect(cx - 34, by - 16, 42, 6);
      ctx.fillRect(cx - 34, by - 34, 42, 6);
      ctx.fillStyle = '#ecf0f1';
      ctx.fillRect(cx - 34, by - 19, 8, 4);
      ctx.fillRect(cx - 34, by - 37, 8, 4);

      // Personal Footlocker with padlock at bed foot
      ctx.fillStyle = '#556b2f';
      ctx.fillRect(cx + 14, by - 12, 18, 12);
      ctx.strokeStyle = '#2f3b1b';
      ctx.strokeRect(cx + 14, by - 12, 18, 12);
      ctx.fillStyle = '#f1c40f'; // Brass padlock
      ctx.fillRect(cx + 21, by - 8, 3, 4);

      // Bookshelf with technical manuals and tin can plant
      ctx.fillStyle = '#8b4513';
      ctx.fillRect(cx - 16, this.y + 24, 28, 3);
      // Books
      ctx.fillStyle = '#c0392b'; ctx.fillRect(cx - 14, this.y + 17, 3, 7);
      ctx.fillStyle = '#2980b9'; ctx.fillRect(cx - 10, this.y + 18, 4, 6);
      ctx.fillStyle = '#27ae60'; ctx.fillRect(cx - 5, this.y + 16, 3, 8);

      // Pinned polaroid teammate photos
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx + 24, this.y + 24, 8, 10);
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(cx + 25, this.y + 25, 6, 6);
    }

    // =========================================================================
    // 10. FABRICATION WORKSHOP (Sub-level 3, Col 1)
    // =========================================================================
    else if (this.id === 'workshop') {
      // Heavy Industrial Metal Lathe Machine
      ctx.fillStyle = '#34495e';
      ctx.fillRect(cx - 38, by - 18, 44, 18);
      ctx.fillStyle = '#1a252f';
      ctx.fillRect(cx - 36, by - 28, 14, 12); // Lathe headstock

      // Motorized spinning chuck & metal workpiece
      if (isPowered) {
        ctx.fillStyle = '#dcdde1';
        ctx.fillRect(cx - 20, by - 25, 22, 5); // Steel workpiece

        // Flying bright metal cutting chips / sparks
        ctx.fillStyle = '#f1c40f';
        const chipY = by - 24 + (Math.sin(now / 30) * 2);
        ctx.fillRect(cx - 10, chipY, 2, 2);
        ctx.fillRect(cx - 4, chipY - 2, 1.5, 1.5);
      }

      // Red Heavy-Gauge Rolling Tool Chest
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(cx + 12, by - 28, 22, 28);
      ctx.strokeStyle = '#962d22';
      ctx.strokeRect(cx + 12, by - 28, 22, 28);
      // Tool drawers & chrome handles
      ctx.fillStyle = '#bdc3c7';
      for (let d = 0; d < 4; d++) {
        ctx.fillRect(cx + 15, by - 25 + d * 6, 16, 1.5);
      }

      // Automated Welding Station with intermittent electric-blue arc flash!
      if (isPowered && (Math.floor(now / 180) % 5 === 0)) {
        ctx.fillStyle = '#00ffff';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(cx - 6, by - 24, 3, 0, Math.PI * 2);
        ctx.fill();

        // Welding shower sparks
        ctx.fillStyle = '#ffaa00';
        for (let w = 0; w < 4; w++) {
          ctx.fillRect(cx - 6 + (Math.random() - 0.5) * 10, by - 24 + Math.random() * 8, 1.5, 1.5);
        }
        ctx.shadowBlur = 0;
      }

      // Wall tool rack
      ctx.fillStyle = '#7f8c8d';
      ctx.fillRect(cx - 34, this.y + 24, 40, 2);
      ctx.fillRect(cx - 30, this.y + 26, 2, 6); // Screwdriver
      ctx.fillRect(cx - 20, this.y + 26, 4, 8); // Wrench
    }

    // =========================================================================
    // 11. CHEMICAL & GUNPOWDER LAB (Sub-level 3, Col 2)
    // =========================================================================
    else if (this.id === 'gunpowder_lab') {
      // Chemical-resistant slate lab bench
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(cx - 38, by - 12, 76, 12);
      ctx.fillStyle = '#1a252f';
      ctx.fillRect(cx - 38, by - 14, 76, 2);

      if (isPowered) {
        // Bunsen Burner with animated blue core flame
        ctx.fillStyle = '#718096';
        ctx.fillRect(cx - 24, by - 18, 6, 4);
        const flameH = 5 + Math.sin(now / 40) * 2;
        ctx.fillStyle = '#00d2d3';
        ctx.shadowColor = '#00d2d3';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(cx - 24, by - 18);
        ctx.lineTo(cx - 21, by - 18 - flameH);
        ctx.lineTo(cx - 18, by - 18);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;

        // Boiling Flask (Erlenmeyer) with boiling sulfur-yellow fluid
        ctx.strokeStyle = '#a0aec0';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - 26, by - 32, 10, 10);
        ctx.fillStyle = '#f39c12'; // Boiling fluid
        ctx.fillRect(cx - 25, by - 28, 8, 6);

        // Rising vapor bubbles in Flask 1
        const bub1 = (now / 60) % 6;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx - 21, by - 24 - bub1, 1.2, 0, Math.PI * 2);
        ctx.fill();

        // Spiral Glass Condensing Coil
        ctx.strokeStyle = 'rgba(200, 240, 255, 0.8)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(cx - 21, by - 32);
        ctx.lineTo(cx - 10, by - 36);
        ctx.lineTo(cx - 4, by - 32);
        ctx.lineTo(cx + 2, by - 36);
        ctx.lineTo(cx + 8, by - 30);
        ctx.stroke();

        // Receiving Flask with violet fluid
        ctx.strokeRect(cx + 4, by - 26, 9, 12);
        ctx.fillStyle = '#8e44ad';
        ctx.fillRect(cx + 5, by - 20, 7, 6);

        // Falling condensed drop
        const cDrop = (now / 70) % 6;
        ctx.fillStyle = '#dda0dd';
        ctx.beginPath();
        ctx.arc(cx + 8.5, by - 26 + cDrop, 1.0, 0, Math.PI * 2);
        ctx.fill();

        // Granite Mortar & Pestle with yellow sulfur powder
        ctx.fillStyle = '#4a5568';
        ctx.beginPath();
        ctx.arc(cx + 26, by - 14, 6, 0, Math.PI);
        ctx.fill();
        ctx.fillStyle = '#f1c40f'; // Sulfur powder
        ctx.fillRect(cx + 23, by - 16, 6, 2);
      }

      // Reagent shelf on wall with labeled bottles
      ctx.fillStyle = '#4a5568';
      ctx.fillRect(cx - 20, this.y + 24, 40, 2);
      ctx.fillStyle = '#e67e22'; ctx.fillRect(cx - 16, this.y + 17, 5, 7); // KNO3
      ctx.fillStyle = '#f1c40f'; ctx.fillRect(cx - 8, this.y + 16, 5, 8);  // Sulfur
      ctx.fillStyle = '#34495e'; ctx.fillRect(cx, this.y + 15, 6, 9);       // Charcoal
    }

    // =========================================================================
    // 12. TECH RESEARCH LAB (Sub-level 3, Col 3)
    // =========================================================================
    else if (this.id === 'research') {
      // Circular Hologram Projector Pedestal on floor
      const holoX = cx - 14;
      ctx.fillStyle = '#1a202c';
      ctx.beginPath();
      ctx.ellipse(holoX, by - 4, 16, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#00d2d3';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (isPowered) {
        // Holographic vertical cone beams
        const holoGrad = ctx.createLinearGradient(holoX, by - 4, holoX, by - 42);
        holoGrad.addColorStop(0, 'rgba(0, 210, 211, 0.4)');
        holoGrad.addColorStop(1, 'rgba(0, 210, 211, 0.02)');
        ctx.fillStyle = holoGrad;
        ctx.beginPath();
        ctx.moveTo(holoX - 12, by - 4);
        ctx.lineTo(holoX - 16, by - 42);
        ctx.lineTo(holoX + 16, by - 42);
        ctx.lineTo(holoX + 12, by - 4);
        ctx.closePath();
        ctx.fill();

        // Rotating 3D Wireframe DNA Double-Helix
        ctx.strokeStyle = '#00f3ff';
        ctx.shadowColor = '#00f3ff';
        ctx.shadowBlur = 6;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let y = by - 40; y <= by - 12; y += 3) {
          const xOff1 = Math.sin((y + now / 100) * 0.4) * 8;
          const xOff2 = -xOff1;
          ctx.moveTo(holoX + xOff1, y);
          ctx.lineTo(holoX + xOff1 + 1, y);
          ctx.moveTo(holoX + xOff2, y);
          ctx.lineTo(holoX + xOff2 + 1, y);
          // Rung connecting strands
          if (Math.floor(y) % 6 === 0) {
            ctx.moveTo(holoX + xOff1, y);
            ctx.lineTo(holoX + xOff2, y);
          }
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Supercomputer Server Tower with pulsing green/cyan LEDs
      const srvX = cx + 14;
      ctx.fillStyle = '#101721';
      ctx.fillRect(srvX, by - 42, 22, 42);
      ctx.strokeStyle = '#2d3748';
      ctx.strokeRect(srvX, by - 42, 22, 42);

      if (isPowered) {
        // Cascading LED matrix
        for (let r = 0; r < 5; r++) {
          for (let c = 0; c < 3; c++) {
            const ledOn = Math.sin(now / 90 + r * 2 + c) > 0.1;
            ctx.fillStyle = ledOn ? (c === 0 ? '#10b981' : '#06b6d4') : '#1f2937';
            ctx.fillRect(srvX + 4 + c * 5, by - 38 + r * 7, 3, 3);
          }
        }
      }
    }

    // =========================================================================
    // 13. DIESEL GENERATOR (Sub-level 4, Col 0)
    // =========================================================================
    else if (this.id === 'generator') {
      // Cast-iron engine block with rhythmic rumbling vibration shake
      const shake = (isPowered && engine && engine.resources.fuel > 0) ? Math.sin(now / 20) * 1.2 : 0;
      ctx.fillStyle = '#2d3748';
      ctx.fillRect(cx - 36 + shake, by - 32, 42, 32);
      ctx.strokeStyle = '#1a202c';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - 36 + shake, by - 32, 42, 32);

      // Spinning Flywheel with spokes
      const fWheelX = cx - 16 + shake;
      const fWheelY = by - 16;
      const fWheelR = 12;
      ctx.fillStyle = '#1a202c';
      ctx.beginPath();
      ctx.arc(fWheelX, fWheelY, fWheelR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#4a5568';
      ctx.stroke();

      if (isPowered) {
        const flyAngle = (now / 30) % (Math.PI * 2);
        ctx.save();
        ctx.translate(fWheelX, fWheelY);
        ctx.rotate(flyAngle);
        ctx.strokeStyle = '#e67e22';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-fWheelR + 2, 0); ctx.lineTo(fWheelR - 2, 0);
        ctx.moveTo(0, -fWheelR + 2); ctx.lineTo(0, fWheelR - 2);
        ctx.stroke();
        ctx.restore();
      }

      // Glowing hot exhaust manifold pipe with heat shimmer haze
      ctx.strokeStyle = isPowered ? '#ff4500' : '#4a5568';
      ctx.shadowColor = isPowered ? '#ff4500' : 'transparent';
      ctx.shadowBlur = isPowered ? 8 : 0;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(cx - 34 + shake, by - 24);
      ctx.quadraticCurveTo(cx - 42 + shake, by - 28, cx - 40 + shake, by - 42);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Heat shimmer distortion waves
      if (isPowered) {
        ctx.strokeStyle = 'rgba(255, 200, 100, 0.35)';
        ctx.lineWidth = 1;
        const shimOff = Math.sin(now / 60) * 2;
        ctx.beginPath();
        ctx.moveTo(cx - 40 + shake + shimOff, by - 42);
        ctx.lineTo(cx - 38 + shake - shimOff, by - 48);
        ctx.stroke();
      }

      // Analog Voltage & RPM dial gauges with vibrating needles
      const gaugeX = cx + 18;
      ctx.fillStyle = '#1a202c';
      ctx.fillRect(gaugeX - 4, by - 32, 22, 32);

      // Dial 1: Voltage
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(gaugeX + 7, by - 22, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 1.2;
      const needle1 = isPowered ? -Math.PI / 4 + (Math.sin(now / 80) * 0.2) : -Math.PI * 0.7;
      ctx.beginPath();
      ctx.moveTo(gaugeX + 7, by - 22);
      ctx.lineTo(gaugeX + 7 + Math.cos(needle1) * 5, by - 22 + Math.sin(needle1) * 5);
      ctx.stroke();

      // Fuel sight glass indicator column
      ctx.fillStyle = '#111';
      ctx.fillRect(gaugeX + 18, by - 30, 4, 28);
      const fuelPct = engine ? Math.min(1, engine.resources.fuel / CONFIG.RESOURCE_CAPS.fuel) : 0.5;
      ctx.fillStyle = '#f39c12';
      ctx.fillRect(gaugeX + 18, by - 2 - (24 * fuelPct), 4, 24 * fuelPct);
    }

    // =========================================================================
    // 14. BIO-FUEL REFINERY (Sub-level 4, Col 1)
    // =========================================================================
    else if (this.id === 'bio_refinery') {
      // Sealed Anaerobic Biomass Digester
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(cx - 36, by - 36, 28, 36);
      ctx.strokeStyle = '#1a252f';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - 36, by - 36, 28, 36);

      // Bolted Inspection Porthole with churning green biomass
      ctx.fillStyle = '#27ae60';
      ctx.beginPath();
      ctx.arc(cx - 22, by - 22, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#bdc3c7';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      if (isPowered) {
        // Churning organic mash
        const mashAngle = (now / 60) % (Math.PI * 2);
        ctx.fillStyle = '#2ecc71';
        ctx.beginPath();
        ctx.arc(cx - 22 + Math.cos(mashAngle) * 4, by - 22 + Math.sin(mashAngle) * 4, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Catalytic Fractionating Tower (brass/steel distillation column)
      ctx.fillStyle = '#7f8c8d';
      ctx.fillRect(cx - 2, by - 40, 16, 40);
      ctx.strokeStyle = '#34495e';
      ctx.strokeRect(cx - 2, by - 40, 16, 40);

      // Refined Diesel Fuel Sight Tube with glowing amber fluid
      ctx.fillStyle = '#f39c12';
      ctx.fillRect(cx + 20, by - 30, 8, 30);
      ctx.strokeStyle = '#d35400';
      ctx.strokeRect(cx + 20, by - 30, 8, 30);

      if (isPowered) {
        // Droplets flowing through sight tube
        const dropY = (now / 50) % 24;
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(cx + 24, by - 28 + dropY, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // =========================================================================
    // 15. DEEP EXCAVATION MINE (Sub-level 4, Col 2)
    // =========================================================================
    else if (this.id === 'mine') {
      // Rugged cavern rock face background
      ctx.fillStyle = '#171923';
      ctx.fillRect(cx - 40, by - 36, 80, 36);

      // Glittering Gold & Iron Ore veins in bedrock (sparkling highlights)
      const oreVeins = [
        { x: cx - 30, y: by - 30, color: '#f1c40f' },
        { x: cx - 18, y: by - 34, color: '#ffd700' },
        { x: cx - 5, y: by - 28, color: '#cbd5e0' },
        { x: cx + 18, y: by - 32, color: '#f1c40f' },
        { x: cx + 28, y: by - 26, color: '#e2e8f0' }
      ];

      for (let i = 0; i < oreVeins.length; i++) {
        const o = oreVeins[i];
        const spark = Math.sin(now / 120 + i * 2) > 0.2;
        ctx.fillStyle = o.color;
        ctx.fillRect(o.x, o.y, 4, 3);
        if (spark && isPowered) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(o.x + 1, o.y + 1, 2, 1);
        }
      }

      // Sturdy rough-hewn Timber Mine Shaft Supports
      ctx.fillStyle = '#5c4033';
      ctx.fillRect(cx - 36, by - 36, 6, 36); // Left timber post
      ctx.fillRect(cx + 30, by - 36, 6, 36); // Right timber post
      ctx.fillRect(cx - 36, by - 36, 72, 5);  // Top cross-beam

      // Steel Minecart Rails on timber ties
      ctx.fillStyle = '#3e2723';
      for (let t = 0; t < 6; t++) {
        ctx.fillRect(cx - 24 + t * 8, by - 3, 6, 3);
      }
      ctx.strokeStyle = '#718096';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 26, by - 4); ctx.lineTo(cx + 26, by - 4);
      ctx.stroke();

      // Heavy Riveted Iron Ore Cart filled with gold & iron chunks
      ctx.fillStyle = '#4a5568';
      ctx.fillRect(cx - 14, by - 14, 26, 11);
      ctx.strokeStyle = '#2d3748';
      ctx.strokeRect(cx - 14, by - 14, 26, 11);

      // Gold & Silver ore chunks in cart
      ctx.fillStyle = '#f1c40f'; ctx.fillRect(cx - 11, by - 18, 7, 5);
      ctx.fillStyle = '#cbd5e0'; ctx.fillRect(cx - 2, by - 19, 8, 6);
      ctx.fillStyle = '#ffd700'; ctx.fillRect(cx + 4, by - 17, 6, 4);

      // Glowing Carbide Miner's Lantern with warm radial illumination
      if (isPowered) {
        ctx.fillStyle = 'rgba(255, 180, 50, 0.35)';
        ctx.beginPath();
        ctx.arc(cx - 33, by - 24, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffb830';
        ctx.fillRect(cx - 35, by - 26, 4, 7);
      }
    }

    // =========================================================================
    // 16. AIR & LIFE SUPPORT (Sub-level 4, Col 3)
    // =========================================================================
    else if (this.id === 'life_support') {
      // Dual high-speed industrial ventilation turbine ducts
      const fan1X = cx - 18;
      const fan2X = cx + 18;
      const fanY = by - 22;
      const fanR = 12;

      for (const fx of [fan1X, fan2X]) {
        ctx.fillStyle = '#1a202c';
        ctx.beginPath();
        ctx.arc(fx, fanY, fanR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#4a5568';
        ctx.lineWidth = 2;
        ctx.stroke();

        if (isPowered) {
          // Spinning 4-blade impeller
          const bAngle = (now / 40) % Math.PI;
          ctx.save();
          ctx.translate(fx, fanY);
          ctx.rotate(bAngle);
          ctx.fillStyle = '#718096';
          ctx.fillRect(-fanR + 2, -2, (fanR - 2) * 2, 4);
          ctx.fillRect(-2, -fanR + 2, 4, (fanR - 2) * 2);
          ctx.fillStyle = '#f1c40f';
          ctx.beginPath();
          ctx.arc(0, 0, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Flowing cyan air current streamlines
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
          ctx.lineWidth = 1.2;
          const sOff = (now / 50) % 8;
          ctx.beginPath();
          ctx.moveTo(fx - 4, fanY + fanR + 2 + sOff);
          ctx.lineTo(fx - 4, fanY + fanR + 8 + sOff);
          ctx.moveTo(fx + 4, fanY + fanR + 4 + sOff);
          ctx.lineTo(fx + 4, fanY + fanR + 10 + sOff);
          ctx.stroke();
        }
      }

      // Pressurized Emerald Green O2 Storage Cylinder
      ctx.fillStyle = '#1b4d3e';
      ctx.fillRect(cx - 36, by - 36, 10, 28);
      ctx.beginPath();
      ctx.arc(cx - 31, by - 36, 5, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#ffffff'; // White medical gas shoulder band
      ctx.fillRect(cx - 36, by - 32, 10, 4);

      // Digital LED atmospheric readout
      if (isPowered) {
        ctx.fillStyle = '#00f3ff';
        ctx.font = '7px monospace';
        ctx.fillText('O2 99%', cx - 2, by - 38);
        ctx.fillText('CO2 0.03%', cx - 2, by - 30);
      }
    }

    ctx.restore();
  }
}

// Elevator Shaft & Lift Car
class Elevator {
  constructor() {
    this.x = CONFIG.ELEVATOR_X;
    this.width = CONFIG.ELEVATOR_WIDTH;
    this.cabinHeight = 44;
    this.topY = CONFIG.SURFACE_Y - this.cabinHeight;
    this.bottomY = CONFIG.BUNKER_TOP + CONFIG.FLOORS_COUNT * CONFIG.FLOOR_HEIGHT;
    this.targetFloor = 0;
    this.currentFloor = 0;
    this.carY = this.getFloorCarY(0);
    this.targetY = this.carY;
    this.speed = 135; // px/s
    this.passengers = [];
  }

  getFloorWalkY(floorIndex) {
    if (floorIndex === 0) return CONFIG.SURFACE_Y;
    return CONFIG.BUNKER_TOP + (floorIndex - 1) * CONFIG.FLOOR_HEIGHT + CONFIG.FLOOR_HEIGHT - 12;
  }

  getFloorCarY(floorIndex) {
    return this.getFloorWalkY(floorIndex) - (this.cabinHeight - 4);
  }

  moveToFloor(floorIndex) {
    this.targetFloor = Math.max(0, Math.min(CONFIG.FLOORS_COUNT, floorIndex));
    this.targetY = this.getFloorCarY(this.targetFloor);
  }

  isAtFloor(floorIndex) {
    return Math.abs(this.carY - this.getFloorCarY(floorIndex)) < 3.0;
  }

  board(survivor) {
    if (!this.passengers.includes(survivor)) {
      this.passengers.push(survivor);
      survivor.inElevator = true;
    }
  }

  exit(survivor) {
    const idx = this.passengers.indexOf(survivor);
    if (idx !== -1) {
      this.passengers.splice(idx, 1);
      survivor.inElevator = false;
    }
  }

  update(dt) {
    const diff = this.targetY - this.carY;
    const step = this.speed * dt;
    if (Math.abs(diff) <= Math.max(1.5, step)) {
      const arrivedAtNewFloor = this.currentFloor !== this.targetFloor;
      this.carY = this.targetY;
      this.currentFloor = this.targetFloor;
      if (arrivedAtNewFloor && window.soundSystem) window.soundSystem.playElevatorDing();
    } else {
      this.carY += Math.sign(diff) * step;
    }

    // Keep all passenger coordinates matched to elevator cabin
    const cabinFloorY = this.carY + this.cabinHeight - 4;
    for (let i = 0; i < this.passengers.length; i++) {
      const p = this.passengers[i];
      const offset = (i - (this.passengers.length - 1) / 2) * 10;
      p.x = this.x + offset;
      p.y = cabinFloorY;
      p.targetX = p.x;
      p.targetY = p.y;
    }
  }

  draw(ctx) {
    const shaftX = this.x - this.width / 2;
    const totalHeight = this.bottomY - this.topY;

    // 1. Shaft Concrete Background
    ctx.fillStyle = '#111419';
    ctx.fillRect(shaftX, this.topY, this.width, totalHeight);

    // 2. Heavy Structural Steel Lattice Cross-Bracing Trusses (X-girders)
    ctx.strokeStyle = '#1d232e';
    ctx.lineWidth = 1.8;
    for (let ty = this.topY + 40; ty < this.bottomY; ty += 34) {
      ctx.beginPath();
      ctx.moveTo(shaftX + 6, ty);
      ctx.lineTo(shaftX + this.width - 6, ty + 34);
      ctx.moveTo(shaftX + this.width - 6, ty);
      ctx.lineTo(shaftX + 6, ty + 34);
      ctx.stroke();

      // Steel gusset plate & rivet at intersection
      ctx.fillStyle = '#262f3d';
      ctx.fillRect(shaftX + this.width * 0.5 - 3, ty + 15, 6, 4);
    }

    // 3. Vertical Steel I-Beam Shaft Columns & Flanges
    ctx.fillStyle = '#1c222c';
    ctx.fillRect(shaftX, this.topY, 6, totalHeight);
    ctx.fillRect(shaftX + this.width - 6, this.topY, 6, totalHeight);

    // Vertical steel guide rails with industrial grease stains
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(shaftX + 5, this.topY);
    ctx.lineTo(shaftX + 5, this.bottomY);
    ctx.moveTo(shaftX + this.width - 5, this.topY);
    ctx.lineTo(shaftX + this.width - 5, this.bottomY);
    ctx.stroke();

    // Dark grease / lubricant streaks on guide rails
    ctx.fillStyle = 'rgba(8, 10, 14, 0.72)';
    ctx.fillRect(shaftX + 4, this.topY + 20, 2.5, totalHeight - 30);
    ctx.fillRect(shaftX + this.width - 6.5, this.topY + 20, 2.5, totalHeight - 30);

    // 4. Heavy Motorized Gear Winch & Pulley Machine (at surface cabin floor level)
    const winchY = this.topY + 4;
    const winchX = this.x + 8;
    const winchRot = (this.carY * 0.12) % (Math.PI * 2);

    // Electric motor housing with cooling fins
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(shaftX + 4, winchY + 2, 16, 18);
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 1;
    ctx.strokeRect(shaftX + 4, winchY + 2, 16, 18);
    // Cooling fins
    ctx.fillStyle = '#1a252f';
    for (let fin = winchY + 4; fin < winchY + 18; fin += 3) {
      ctx.fillRect(shaftX + 5, fin, 14, 1.2);
    }

    // High-voltage warning plate
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(shaftX + 8, winchY + 8, 8, 5);

    // Winch cable spool drum
    ctx.fillStyle = '#34495e';
    ctx.fillRect(winchX - 6, winchY + 3, 14, 16);
    // Spooled steel wire rope coils
    ctx.strokeStyle = '#95a5a6';
    ctx.lineWidth = 1.0;
    for (let c = winchY + 5; c < winchY + 17; c += 2) {
      ctx.beginPath();
      ctx.moveTo(winchX - 6, c);
      ctx.lineTo(winchX + 8, c);
      ctx.stroke();
    }

    // Rotating spur gear wheel with visible cog teeth
    ctx.save();
    ctx.translate(winchX + 10, winchY + 11);
    ctx.rotate(winchRot);
    ctx.fillStyle = '#7f8c8d';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    // Gear teeth
    ctx.fillStyle = '#95a5a6';
    for (let g = 0; g < 6; g++) {
      ctx.rotate(Math.PI / 3);
      ctx.fillRect(-1.5, -9, 3, 3);
    }
    ctx.restore();

    // Overhead Head Sheave Pulley at apex
    ctx.fillStyle = '#4a5568';
    ctx.beginPath();
    ctx.arc(this.x, this.topY + 12, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#718096';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 5. Functional Dynamic Counterweight System (moves opposite to elevator car!)
    const cwTravel = Math.max(1, this.bottomY - this.topY - this.cabinHeight);
    const carProgress = Math.max(0, Math.min(1, (this.carY - this.topY) / cwTravel));
    const cwHeight = 32;
    const cwY = this.topY + 34 + (1 - carProgress) * (cwTravel - 44);
    const cwX = shaftX + 8;
    const cwW = 8;

    // Counterweight hoist cable from overhead sheave down to counterweight
    ctx.strokeStyle = '#718096';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(this.x - 4, this.topY + 12);
    ctx.lineTo(cwX + cwW * 0.5, cwY);
    ctx.stroke();

    // Cast-iron counterweight stack with lead ballast slabs
    ctx.fillStyle = '#1e2530';
    ctx.fillRect(cwX, cwY, cwW, cwHeight);
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 1.0;
    ctx.strokeRect(cwX, cwY, cwW, cwHeight);

    // Individual ballast weight segment lines
    ctx.strokeStyle = '#2d3748';
    for (let wy = cwY + 6; wy < cwY + cwHeight; wy += 6) {
      ctx.beginPath();
      ctx.moveTo(cwX + 1, wy);
      ctx.lineTo(cwX + cwW - 1, wy);
      ctx.stroke();
    }
    // Counterweight guide shoes
    ctx.fillStyle = '#f39c12';
    ctx.fillRect(cwX - 1, cwY, 2, 4);
    ctx.fillRect(cwX - 1, cwY + cwHeight - 4, 2, 4);

    // 6. Braided Steel Hoist Cables from sheave down to Elevator Car
    ctx.strokeStyle = '#a0aec0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(this.x - 1.5, this.topY + 12);
    ctx.lineTo(this.x - 1.5, this.carY);
    ctx.moveTo(this.x + 1.5, this.topY + 12);
    ctx.lineTo(this.x + 1.5, this.carY);
    ctx.stroke();

    // 7. Hydraulic Pit Buffer Springs at Shaft Base
    const pitY = this.bottomY - 14;
    ctx.fillStyle = '#1e242c';
    ctx.fillRect(shaftX + 12, pitY, this.width - 24, 14);

    // Coiled heavy steel shock springs
    ctx.strokeStyle = '#e67e22';
    ctx.lineWidth = 2.0;
    for (const sx of [shaftX + 18, shaftX + this.width - 18]) {
      ctx.beginPath();
      ctx.moveTo(sx, pitY);
      ctx.lineTo(sx - 3, pitY + 4);
      ctx.lineTo(sx + 3, pitY + 8);
      ctx.lineTo(sx, pitY + 13);
      ctx.stroke();
      // Rubber impact bumper cap
      ctx.fillStyle = '#2d3436';
      ctx.fillRect(sx - 4, pitY - 2, 8, 3);
    }

    // 8. Elevator Cabin / Car Architecture
    const carX = shaftX + 3;
    const carW = this.width - 6;

    // Cabin structural frame
    ctx.fillStyle = '#222934';
    ctx.fillRect(carX, this.carY, carW, this.cabinHeight);

    // Cable hitch head socket assembly on car roof
    ctx.fillStyle = '#4a5568';
    ctx.fillRect(this.x - 5, this.carY - 4, 10, 4);
    ctx.fillStyle = '#718096';
    ctx.fillRect(this.x - 2, this.carY - 6, 4, 2);

    // Diamond plate floor plate with safety kick-plate
    ctx.fillStyle = '#1a202c';
    ctx.fillRect(carX + 1, this.carY + this.cabinHeight - 5, carW - 2, 4);
    ctx.fillStyle = '#f1c40f'; // Safety yellow kick-plate
    ctx.fillRect(carX + 2, this.carY + this.cabinHeight - 3, carW - 4, 2);

    // Industrial protective metal grille / mesh border
    const isOccupied = this.passengers.length > 0;
    ctx.strokeStyle = isOccupied ? '#00f3ff' : '#ecc94b';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(carX, this.carY, carW, this.cabinHeight);

    // Overhead fluorescent tube fixture casting illumination down into car
    const lampX = this.x;
    const lampY = this.carY + 4;
    ctx.fillStyle = isOccupied ? '#00d2d3' : '#fff3b0';
    ctx.fillRect(lampX - 7, lampY, 14, 2.5);

    // Downward illumination glow inside cabin
    const lightGlow = ctx.createRadialGradient(lampX, lampY + 3, 2, lampX, lampY + 16, 26);
    lightGlow.addColorStop(0, isOccupied ? 'rgba(0, 243, 255, 0.35)' : 'rgba(255, 243, 176, 0.28)');
    lightGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = lightGlow;
    ctx.beginPath();
    ctx.arc(lampX, lampY + 14, 26, 0, Math.PI * 2);
    ctx.fill();

    // Floor indicators & level callouts in shaft
    for (let f = 1; f <= CONFIG.FLOORS_COUNT; f++) {
      const fy = CONFIG.BUNKER_TOP + (f - 1) * CONFIG.FLOOR_HEIGHT;
      const isCurrentFloor = this.isAtFloor(f);

      ctx.fillStyle = isCurrentFloor ? '#00f3ff' : '#718096';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(`F${f}`, shaftX + 18, fy + 14);

      // Floor threshold hazard line
      ctx.fillStyle = isCurrentFloor ? '#00f3ff' : '#4a5568';
      ctx.fillRect(shaftX + 4, fy + CONFIG.FLOOR_HEIGHT - 3, this.width - 8, 2);
    }

    // Surface floor indicator
    const isSurface = this.isAtFloor(0);
    ctx.fillStyle = isSurface ? '#00f3ff' : '#718096';
    ctx.font = 'bold 9px monospace';
    ctx.fillText('SURF', shaftX + 14, CONFIG.SURFACE_Y - 26);
  }
}

window.Room = Room;
window.Elevator = Elevator;
