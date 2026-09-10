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
    const totalBunkerWidth = CONFIG.BUNKER_RIGHT - CONFIG.BUNKER_LEFT;
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
    if (!workers || workers.length === 0 || !hasPower || !this.produces) return;

    // Production calculation
    // Tech modifiers
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

    if (this.id === 'security') {
      // Security & Radar: Pulsing holographic radar display with sweeping beam and blips
      const monW = 54, monH = 34;
      ctx.fillStyle = '#0f1419';
      ctx.fillRect(cx - monW / 2, by - monH - 2, monW, monH);
      ctx.strokeStyle = '#2d3748';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - monW / 2, by - monH - 2, monW, monH);

      if (isPowered) {
        const radarCenterX = cx;
        const radarCenterY = by - monH / 2 - 2;
        const radarR = 13;

        // Concentric range rings
        ctx.strokeStyle = 'rgba(0, 255, 120, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(radarCenterX, radarCenterY, 6, 0, Math.PI * 2);
        ctx.arc(radarCenterX, radarCenterY, radarR, 0, Math.PI * 2);
        ctx.stroke();

        // Crosshairs
        ctx.beginPath();
        ctx.moveTo(radarCenterX - radarR, radarCenterY);
        ctx.lineTo(radarCenterX + radarR, radarCenterY);
        ctx.moveTo(radarCenterX, radarCenterY - radarR);
        ctx.lineTo(radarCenterX, radarCenterY + radarR);
        ctx.stroke();

        // Rotating radar sweep arm
        const sweepAngle = (now / 450) % (Math.PI * 2);
        ctx.strokeStyle = '#00ff88';
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 5;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(radarCenterX, radarCenterY);
        ctx.lineTo(radarCenterX + Math.cos(sweepAngle) * radarR, radarCenterY + Math.sin(sweepAngle) * radarR);
        ctx.stroke();

        // Trailing radar sweep wedge
        ctx.fillStyle = 'rgba(0, 255, 136, 0.15)';
        ctx.beginPath();
        ctx.moveTo(radarCenterX, radarCenterY);
        ctx.arc(radarCenterX, radarCenterY, radarR, sweepAngle - 0.55, sweepAngle);
        ctx.closePath();
        ctx.fill();

        // Zombie threat blips (simulated or real from engine)
        const blipBlink = Math.sin(now / 120) > 0;
        if (blipBlink) {
          ctx.fillStyle = engine && engine.waveManager.isHordeActive ? '#ff2222' : '#f1c40f';
          ctx.shadowColor = ctx.fillStyle;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(radarCenterX - 7, radarCenterY - 4, 1.8, 0, Math.PI * 2);
          ctx.arc(radarCenterX + 8, radarCenterY + 5, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Telemetry readout at bottom of monitor
        ctx.fillStyle = '#00e5ff';
        ctx.font = '7px monospace';
        ctx.fillText('RADAR SCAN', cx - 20, by - monH + 7);
      }
    } else if (this.id === 'gunpowder_lab') {
      // Chemical & Gunpowder Lab: Bubbling glass flasks, Bunsen burner, and distillation tubes
      ctx.fillStyle = '#3a2512';
      ctx.fillRect(cx - 32, by - 10, 64, 10); // Lab wooden bench

      if (isPowered) {
        // Bunsen Burner
        ctx.fillStyle = '#718096';
        ctx.fillRect(cx - 18, by - 16, 6, 6);
        // Animated flickering blue flame
        const flameH = 4 + Math.sin(now / 40) * 1.5;
        ctx.fillStyle = '#00d2d3';
        ctx.shadowColor = '#00d2d3';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(cx - 18, by - 16);
        ctx.lineTo(cx - 15, by - 16 - flameH);
        ctx.lineTo(cx - 12, by - 16);
        ctx.closePath();
        ctx.fill();

        // Flask 1 (Erlenmeyer Flask with bubbling sulfur yellow liquid)
        ctx.strokeStyle = '#a0aec0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 20, by - 18);
        ctx.lineTo(cx - 22, by - 28);
        ctx.lineTo(cx - 17, by - 36);
        ctx.lineTo(cx - 13, by - 36);
        ctx.lineTo(cx - 8, by - 28);
        ctx.lineTo(cx - 10, by - 18);
        ctx.closePath();
        ctx.stroke();

        // Amber/Yellow bubbling liquid inside Flask 1
        ctx.fillStyle = '#f39c12';
        ctx.beginPath();
        ctx.moveTo(cx - 20, by - 19);
        ctx.lineTo(cx - 21, by - 26);
        ctx.lineTo(cx - 9, by - 26);
        ctx.lineTo(cx - 10, by - 19);
        ctx.closePath();
        ctx.fill();

        // Rising bubbles in Flask 1
        const b1 = (now / 70) % 7;
        const b2 = (now / 90 + 3) % 7;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx - 16, by - 20 - b1, 1.2, 0, Math.PI * 2);
        ctx.arc(cx - 13, by - 20 - b2, 1.0, 0, Math.PI * 2);
        ctx.fill();

        // Distillation glass tubing connecting to Flask 2
        ctx.strokeStyle = 'rgba(200, 230, 255, 0.75)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 15, by - 36);
        ctx.lineTo(cx - 15, by - 40);
        ctx.lineTo(cx + 10, by - 40);
        ctx.lineTo(cx + 10, by - 30);
        ctx.stroke();

        // Flask 2 (Spherical Flask with violet liquid)
        ctx.strokeStyle = '#a0aec0';
        ctx.beginPath();
        ctx.arc(cx + 10, by - 22, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#8e44ad';
        ctx.beginPath();
        ctx.arc(cx + 10, by - 22, 7, 0, Math.PI);
        ctx.fill();

        // Bubbles in Flask 2
        const b3 = (now / 80) % 6;
        ctx.fillStyle = '#dda0dd';
        ctx.beginPath();
        ctx.arc(cx + 8, by - 21 - b3, 1.2, 0, Math.PI * 2);
        ctx.arc(cx + 12, by - 19 - ((b3 + 3) % 6), 1.0, 0, Math.PI * 2);
        ctx.fill();

        // Mortar & Pestle with sulfur powder
        ctx.fillStyle = '#4a5568';
        ctx.beginPath();
        ctx.arc(cx + 24, by - 14, 5, 0, Math.PI);
        ctx.fill();
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(cx + 21, by - 14, 6, 2);
      }
    } else if (this.id === 'life_support') {
      // Air & Life Support: Spinning industrial ventilation fans, cyan streamlines, and oxygen tanks
      // Dual ventilation fan ducts
      const fan1X = cx - 18;
      const fan2X = cx + 18;
      const fanY = by - 22;
      const fanR = 12;

      for (const fx of [fan1X, fan2X]) {
        // Duct housing
        ctx.fillStyle = '#1a202c';
        ctx.beginPath();
        ctx.arc(fx, fanY, fanR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#4a5568';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Spinning 4-blade fan
        if (isPowered) {
          const bladeAngle = (now / 45) % Math.PI;
          ctx.save();
          ctx.translate(fx, fanY);
          ctx.rotate(bladeAngle);
          ctx.fillStyle = '#718096';
          // Blades
          ctx.fillRect(-fanR + 2, -2, (fanR - 2) * 2, 4);
          ctx.fillRect(-2, -fanR + 2, 4, (fanR - 2) * 2);
          // Center hub
          ctx.fillStyle = '#d4af37';
          ctx.beginPath();
          ctx.arc(0, 0, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Flowing cyan air current streamlines
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
          ctx.lineWidth = 1;
          const streamOff = (now / 60) % 8;
          ctx.beginPath();
          ctx.moveTo(fx - 4, fanY + fanR + 2 + streamOff);
          ctx.lineTo(fx - 4, fanY + fanR + 8 + streamOff);
          ctx.moveTo(fx + 4, fanY + fanR + 4 + streamOff);
          ctx.lineTo(fx + 4, fanY + fanR + 10 + streamOff);
          ctx.stroke();
        } else {
          // Stationary fan
          ctx.fillStyle = '#4a5568';
          ctx.fillRect(fx - fanR + 2, fanY - 1.5, (fanR - 2) * 2, 3);
        }
      }

      // Oxygen Cylinder Tank on side
      ctx.fillStyle = '#2d3748';
      ctx.fillRect(cx - 35, by - 36, 10, 28);
      ctx.beginPath();
      ctx.arc(cx - 30, by - 36, 5, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#38a169'; // Green medical gas band
      ctx.fillRect(cx - 35, by - 30, 10, 5);

      // Pressure Gauge with live needle
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx - 30, by - 20, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 1;
      const needleAngle = isPowered ? Math.sin(now / 200) * 0.4 - Math.PI / 2 : 0;
      ctx.beginPath();
      ctx.moveTo(cx - 30, by - 20);
      ctx.lineTo(cx - 30 + Math.cos(needleAngle) * 3, by - 20 + Math.sin(needleAngle) * 3);
      ctx.stroke();

      // Digital O2 LED display
      if (isPowered) {
        ctx.fillStyle = '#00ffcc';
        ctx.font = '7px monospace';
        ctx.fillText('O2 99%', cx + 7, by - 38);
      }
    } else if (this.id === 'armory') {
      // Munitions Armory: Reciprocating bullet stamping press, brass cases, stenciled ammo boxes
      ctx.fillStyle = '#3d2612';
      ctx.fillRect(cx - 32, by - 14, 64, 14); // Sturdy workbench

      // Reciprocating bullet loading press
      const pressX = cx - 18;
      const pressCycle = isPowered ? Math.sin(now / 160) * 3.5 : 0;
      ctx.fillStyle = '#2d3748';
      ctx.fillRect(pressX - 5, by - 36, 10, 22); // Press vertical frame
      ctx.fillStyle = '#cbd5e0';
      ctx.fillRect(pressX - 3, by - 24 + pressCycle, 6, 10); // Moving stamping ram

      // Piles of brass cartridges on table
      ctx.fillStyle = '#d4af37';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(pressX + 8 + i * 3, by - 19, 2.5, 5);
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(pressX + 8 + i * 3, by - 21, 2.5, 2); // Bullet tips
        ctx.fillStyle = '#d4af37';
      }

      // Stenciled military ammo crate
      ctx.fillStyle = '#2d4726';
      ctx.fillRect(cx + 6, by - 26, 22, 12);
      ctx.strokeStyle = '#1e3019';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx + 6, by - 26, 22, 12);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 6px monospace';
      ctx.fillText('AMMO', cx + 8, by - 17);

      // Hanging ammo belt
      ctx.fillStyle = '#d4af37';
      for (let i = 0; i < 6; i++) {
        ctx.fillRect(cx - 30 + i * 4, by - 28, 2.5, 6);
        ctx.fillStyle = '#4a5568';
        ctx.fillRect(cx - 31 + i * 4, by - 26, 4, 2); // link
        ctx.fillStyle = '#d4af37';
      }
    } else if (this.id === 'clinic') {
      // Hospital bed & live ECG heart-rate monitor
      ctx.fillStyle = '#edf2f7';
      ctx.fillRect(cx - 26, by - 12, 52, 12); // Bed frame
      ctx.fillStyle = '#3182ce';
      ctx.fillRect(cx - 24, by - 16, 48, 4); // Mattress & sheet
      ctx.fillStyle = '#fff';
      ctx.fillRect(cx - 24, by - 20, 10, 4); // Pillow

      // Red cross on back wall
      ctx.fillStyle = '#e53e3e';
      ctx.fillRect(cx - 3, this.y + 26, 6, 18);
      ctx.fillRect(cx - 9, this.y + 32, 18, 6);

      // ECG Heartbeat monitor
      if (isPowered) {
        ctx.fillStyle = '#1a202c';
        ctx.fillRect(cx + 10, by - 36, 22, 16);
        ctx.strokeStyle = '#2d3748';
        ctx.strokeRect(cx + 10, by - 36, 22, 16);

        // Animated ECG waveform line
        ctx.strokeStyle = '#48bb78';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const ecgX = (now / 40) % 20;
        ctx.moveTo(cx + 11, by - 28);
        ctx.lineTo(cx + 11 + ecgX * 0.4, by - 28);
        ctx.lineTo(cx + 11 + ecgX * 0.5, by - 34); // peak
        ctx.lineTo(cx + 11 + ecgX * 0.6, by - 24);
        ctx.lineTo(cx + 11 + ecgX * 0.7, by - 28);
        ctx.lineTo(cx + 31, by - 28);
        ctx.stroke();

        // IV Drip stand
        ctx.strokeStyle = '#cbd5e0';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 28, by - 12);
        ctx.lineTo(cx - 28, by - 38);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(cx - 31, by - 37, 6, 9);
      }
    } else if (this.id === 'generator') {
      // Diesel Generator: Heavy turbine with spinning rotor, exhaust pipe, and rumbling shake
      const shake = (isPowered && engine && engine.resources.fuel > 0) ? Math.sin(now / 25) * 0.8 : 0;
      ctx.fillStyle = '#2d3748';
      ctx.fillRect(cx - 32 + shake, by - 32, 64, 32);

      // Flywheel / Turbine Rotor
      const rotorAngle = isPowered ? (now / 35) % (Math.PI * 2) : 0;
      ctx.fillStyle = '#1a202c';
      ctx.beginPath();
      ctx.arc(cx + shake, by - 16, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#4a5568';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Spinning rotor spokes
      ctx.save();
      ctx.translate(cx + shake, by - 16);
      ctx.rotate(rotorAngle);
      ctx.strokeStyle = isPowered ? '#ed8936' : '#718096';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-11, 0); ctx.lineTo(11, 0);
      ctx.moveTo(0, -11); ctx.lineTo(0, 11);
      ctx.stroke();
      ctx.restore();

      // Exhaust pipe
      ctx.fillStyle = '#4a5568';
      ctx.fillRect(cx - 28, by - 38, 5, 8);

      // Amber Fuel / RPM Level meter
      ctx.fillStyle = '#111';
      ctx.fillRect(cx + 17, by - 28, 10, 18);
      const fuelH = engine ? Math.min(16, (engine.resources.fuel / CONFIG.RESOURCE_CAPS.fuel) * 16) : 10;
      ctx.fillStyle = '#ecc94b';
      ctx.fillRect(cx + 18, by - 11 - fuelH, 8, fuelH);
    } else if (this.id === 'hydroponics') {
      // Hydroponics: Violet grow lamps with ambient glow and vibrant foliage
      if (isPowered) {
        // Glowing purple overhead lamp
        const glowGrad = ctx.createLinearGradient(cx, this.y + 18, cx, by);
        glowGrad.addColorStop(0, 'rgba(180, 80, 240, 0.42)');
        glowGrad.addColorStop(1, 'rgba(180, 80, 240, 0.04)');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(cx - 38, this.y + 18, 76, by - this.y - 18);
      }

      // Cultivation troughs (two tiers)
      ctx.fillStyle = '#4a5568';
      ctx.fillRect(cx - 36, by - 8, 72, 8);
      ctx.fillRect(cx - 36, by - 24, 72, 6);

      // Growing plants / crops with leaves and tomatoes
      ctx.fillStyle = '#38a169';
      for (let i = 0; i < 6; i++) {
        const px = cx - 30 + i * 12;
        ctx.beginPath();
        ctx.arc(px, by - 10, 5, 0, Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px, by - 26, 4, 0, Math.PI);
        ctx.fill();

        // Red fruit
        ctx.fillStyle = '#e53e3e';
        ctx.fillRect(px - 1, by - 11, 2.5, 2.5);
        ctx.fillStyle = '#38a169';
      }
    } else if (this.id === 'workshop') {
      // Fabrication Workshop: Lathe machine, tools, welding sparks
      ctx.fillStyle = '#4a5568';
      ctx.fillRect(cx - 30, by - 18, 60, 18);
      ctx.fillStyle = '#2d3748';
      ctx.fillRect(cx - 24, by - 26, 16, 8); // Lathe headstock

      // Rotating metal bar on lathe
      if (isPowered) {
        ctx.fillStyle = '#cbd5e0';
        ctx.fillRect(cx - 8, by - 24, 28, 4);
      }

      // Red tool chest
      ctx.fillStyle = '#c53030';
      ctx.fillRect(cx + 16, by - 28, 12, 10);
    } else if (this.id === 'research') {
      // Tech Research Lab: Holographic schematic displays and terminal
      ctx.fillStyle = '#1a202c';
      ctx.fillRect(cx - 26, by - 28, 52, 26);
      if (isPowered) {
        ctx.strokeStyle = '#00d2d3';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - 24, by - 26, 48, 22);
        // DNA / Circuit helix lines
        ctx.strokeStyle = 'rgba(0, 210, 211, 0.7)';
        ctx.beginPath();
        for (let x = cx - 20; x <= cx + 20; x += 4) {
          const yOff = Math.sin((x + now / 100) * 0.4) * 4;
          ctx.lineTo(x, by - 15 + yOff);
        }
        ctx.stroke();
      }
    } else if (this.id === 'water_filter') {
      // Water Filtration: Blue water tank with rising bubbles
      ctx.fillStyle = '#2b6cb0';
      ctx.fillRect(cx - 26, by - 30, 22, 30);
      ctx.fillRect(cx + 4, by - 30, 22, 30);
      if (isPowered) {
        // Micro-bubbles
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        const b = (now / 60) % 24;
        ctx.beginPath();
        ctx.arc(cx - 15, by - 5 - b, 1.2, 0, Math.PI * 2);
        ctx.arc(cx + 15, by - 8 - ((b + 10) % 24), 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.id === 'bio_refinery') {
      // Bio-Fuel Refinery: Organic biomass tank & distillation column
      ctx.fillStyle = '#4a5568';
      ctx.fillRect(cx - 28, by - 30, 24, 30);
      // Sludge view window
      ctx.fillStyle = '#48bb78';
      ctx.fillRect(cx - 22, by - 24, 12, 16);
      // Fuel tube
      ctx.fillStyle = '#ecc94b';
      ctx.fillRect(cx + 4, by - 28, 20, 28);
    } else if (this.id === 'mine') {
      // Deep Excavation: Rough rock wall, timber supports, glowing lantern, ore cart
      ctx.fillStyle = '#171923';
      ctx.fillRect(cx - 35, by - 26, 70, 26);
      // Timber beams
      ctx.fillStyle = '#5c4033';
      ctx.fillRect(cx - 32, by - 26, 5, 26);
      ctx.fillRect(cx + 27, by - 26, 5, 26);
      ctx.fillRect(cx - 32, by - 26, 64, 4);

      // Glowing carbide lantern
      if (isPowered) {
        ctx.fillStyle = 'rgba(255, 180, 60, 0.35)';
        ctx.beginPath();
        ctx.arc(cx, by - 18, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffb830';
        ctx.fillRect(cx - 2, by - 20, 4, 6);
      }

      // Ore cart with glittering metal chunks
      ctx.fillStyle = '#4a5568';
      ctx.fillRect(cx - 14, by - 12, 28, 12);
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(cx - 10, by - 16, 7, 5); // gold chunk
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(cx + 1, by - 17, 8, 6); // silver/metal chunk
    } else if (this.id.startsWith('quarters')) {
      // Bunk beds
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(cx - 30, by - 30, 60, 30);
      ctx.fillStyle = '#bdc3c7';
      ctx.fillRect(cx - 26, by - 14, 52, 6);
      ctx.fillRect(cx - 26, by - 28, 52, 6);
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

    // Shaft background (dark concrete shaft)
    ctx.fillStyle = '#181b20';
    ctx.fillRect(shaftX, this.topY, this.width, totalHeight);

    // Vertical steel guide rails
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(shaftX + 4, this.topY);
    ctx.lineTo(shaftX + 4, this.bottomY);
    ctx.moveTo(shaftX + this.width - 4, this.topY);
    ctx.lineTo(shaftX + this.width - 4, this.bottomY);
    ctx.stroke();

    // Steel cables from top to elevator car
    ctx.strokeStyle = '#718096';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(this.x, this.topY);
    ctx.lineTo(this.x, this.carY);
    ctx.stroke();

    // Elevator Cabin / Car
    const carX = shaftX + 3;
    const carW = this.width - 6;
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(carX, this.carY, carW, this.cabinHeight);

    // Metal grille frame
    ctx.strokeStyle = this.passengers.length > 0 ? '#48dbfb' : '#ecc94b';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(carX, this.carY, carW, this.cabinHeight);

    // Interior cabin light
    ctx.fillStyle = this.passengers.length > 0 ? '#00d2d3' : '#faf089';
    ctx.beginPath();
    ctx.arc(this.x, this.carY + 6, 3, 0, Math.PI * 2);
    ctx.fill();

    // Floor indicators in shaft
    for (let f = 1; f <= CONFIG.FLOORS_COUNT; f++) {
      const fy = CONFIG.BUNKER_TOP + (f - 1) * CONFIG.FLOOR_HEIGHT;
      ctx.fillStyle = '#a0aec0';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(`F${f}`, shaftX + 8, fy + 14);
    }
  }
}

window.Room = Room;
window.Elevator = Elevator;
