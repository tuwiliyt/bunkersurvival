// Core Game Engine & Surface/Bunker Canvas Renderer
class GameEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // Set internal resolution
    this.canvas.width = CONFIG.CANVAS_WIDTH;
    this.canvas.height = CONFIG.CANVAS_HEIGHT;

    // Game state
    this.timeScale = 1.0;
    this.isPaused = false;
    this.gameTime = 0; // seconds
    this.dayTime = 8.0; // Starts at 08:00 AM (Day 1)
    this.dayNumber = 1;

    // House Barricade
    this.houseHp = 500;
    this.houseMaxHp = 500;

    // Resources
    this.resources = { ...CONFIG.INITIAL_RESOURCES };

    // Tech Research Tree
    this.techTree = {
      autoConduit: false,       // Auto supplies ammo to turrets
      heavyCaliber: false,      // +30% turret damage
      ammoOptimization: false,  // +40% ammo output in Armory
      hydroBoost: false,        // +50% food output
      fortifiedWalls: false,    // Barricade max HP 1000
      longRangeRadar: false     // Extended horde warning
    };

    // Subsystems
    this.particles = new ParticleSystem();
    this.elevator = new Elevator();
    this.waveManager = new WaveManager();

    // Turrets flanking the house (Based on the diagram)
    this.leftTurret = new Turret('left', 435, CONFIG.SURFACE_Y - 10);
    this.rightTurret = new Turret('right', 845, CONFIG.SURFACE_Y - 10);

    // Atmospheric cabin searchlights mounted on surface house roof (track zombies & sweep forest)
    this.searchlights = {
      left: {
        x: 588,
        y: CONFIG.SURFACE_Y - 96,
        angle: Math.PI * 0.85,
        targetAngle: Math.PI * 0.85,
        target: null,
        sweepPhase: 0,
        range: 520
      },
      right: {
        x: 692,
        y: CONFIG.SURFACE_Y - 96,
        angle: Math.PI * 0.15,
        targetAngle: Math.PI * 0.15,
        target: null,
        sweepPhase: Math.PI,
        range: 520
      }
    };

    // Initialize Bunker Rooms
    this.rooms = CONFIG.ROOM_TEMPLATES.map(t => new Room(t));

    // Initialize Survivors
    this.survivors = CONFIG.INITIAL_SURVIVORS.map(s => new Survivor(s));

    // Zombies
    this.zombies = [];

    // Notifications
    this.notifications = [];

    // Stats
    this.stats = {
      zombiesKilled: 0,
      ammoCrafted: 0,
      daysSurvived: 1
    };

    // Input state
    this.mouseX = 0;
    this.mouseY = 0;
    this.selectedRoom = null;
    this.selectedTurret = null;
    this.manualAim = false;
    this.isMouseDown = false;

    // Bind event listeners
    this.initInputs();

    this.lastTimestamp = performance.now();
    this.running = true;
  }

  getRoom(roomId) {
    return this.rooms.find(r => r.id === roomId);
  }

  addNotification(text, type = 'info') {
    this.notifications.unshift({ text, type, life: 4.5 });
    if (this.notifications.length > 5) this.notifications.pop();
  }

  damageHouse(amount) {
    this.houseHp = Math.max(0, this.houseHp - amount);
    this.particles.spawnSparks(640, CONFIG.SURFACE_Y - 20, 10, '#ff4444');
    if (this.houseHp <= 0) {
      this.triggerGameOver("The surface house barricade was breached! Zombies overran the bunker.");
    }
  }

  repairHouse() {
    if (this.houseHp < this.houseMaxHp && this.resources.metal >= 15) {
      this.resources.metal -= 15;
      this.houseHp = Math.min(this.houseMaxHp, this.houseHp + 80);
      window.soundSystem.playBeep(true);
      this.particles.spawnSparks(640, CONFIG.SURFACE_Y - 25, 20, '#55ffaa');
      this.particles.addFloatingText("+80 HP REPAIRED", 640, CONFIG.SURFACE_Y - 40, '#55ffaa');
      return true;
    }
    return false;
  }

  triggerGameOver(reason) {
    this.isPaused = true;
    if (window.uiManager) {
      window.uiManager.showGameOver(reason);
    }
  }

  initInputs() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      this.mouseX = (e.clientX - rect.left) * scaleX;
      this.mouseY = (e.clientY - rect.top) * scaleY;

      // Check room hover
      for (const room of this.rooms) {
        room.hovered = (
          this.mouseX >= room.x && this.mouseX <= room.x + room.width &&
          this.mouseY >= room.y && this.mouseY <= room.y + room.height
        );
      }
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isMouseDown = true;
        window.soundSystem.ensureContext();
        if (this.manualAim && this.mouseY <= CONFIG.SURFACE_Y + 50) {
          const activeTurret = this.mouseX < 640 ? this.leftTurret : this.rightTurret;
          activeTurret.fireManual(this.mouseX, this.mouseY);
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isMouseDown = false;
      }
    });

    this.canvas.addEventListener('click', (e) => {
      window.soundSystem.ensureContext();

      // If manual aim is active and player clicked surface area, ignore menu clicks
      if (this.manualAim && this.mouseY <= CONFIG.SURFACE_Y + 50) {
        return;
      }

      // Check turret clicks
      const distL = Math.hypot(this.mouseX - this.leftTurret.x, this.mouseY - this.leftTurret.y);
      if (distL < 35) {
        if (window.uiManager) window.uiManager.openTurretModal(this.leftTurret);
        return;
      }

      const distR = Math.hypot(this.mouseX - this.rightTurret.x, this.mouseY - this.rightTurret.y);
      if (distR < 35) {
        if (window.uiManager) window.uiManager.openTurretModal(this.rightTurret);
        return;
      }

      // Check room clicks
      for (const room of this.rooms) {
        if (
          this.mouseX >= room.x && this.mouseX <= room.x + room.width &&
          this.mouseY >= room.y && this.mouseY <= room.y + room.height
        ) {
          window.soundSystem.playBeep(true);
          if (window.uiManager) window.uiManager.openRoomModal(room);
          return;
        }
      }

      // Check house click (repair)
      if (
        this.mouseX >= 580 && this.mouseX <= 700 &&
        this.mouseY >= 150 && this.mouseY <= CONFIG.SURFACE_Y
      ) {
        this.repairHouse();
      }
    });
  }

  update(dt) {
    if (this.isPaused) return;

    // Apply timescale
    const effectiveDt = dt * this.timeScale;
    this.gameTime += effectiveDt;

    // Update Day/Night clock (1 in-game day = 180 real seconds)
    this.dayTime += (effectiveDt / 180) * 24;
    if (this.dayTime >= 24) {
      this.dayTime -= 24;
      this.dayNumber++;
      this.stats.daysSurvived = this.dayNumber;
      this.addNotification(`☀️ Day ${this.dayNumber} has begun! Survivors held through the night.`, 'info');
    }

    // Update Power balance
    let totalPowerConsumption = 0;
    for (const room of this.rooms) {
      totalPowerConsumption += room.powerCost;
    }
    // Turret power draw
    totalPowerConsumption += 4;

    // Generator room check
    const genRoom = this.getRoom('generator');
    const genWorkers = this.survivors.filter(s => s.assignedRoom === 'generator' && !s.isDead).length;
    const hasFuel = this.resources.fuel > 0;
    
    if (hasFuel && genWorkers > 0) {
      const fuelCost = 0.12 * effectiveDt;
      this.resources.fuel = Math.max(0, this.resources.fuel - fuelCost);
      this.resources.power = Math.min(CONFIG.RESOURCE_CAPS.power, this.resources.power + 20 * effectiveDt);
    } else {
      this.resources.power = Math.max(0, this.resources.power - totalPowerConsumption * 0.15 * effectiveDt);
    }

    const isPowered = this.resources.power > 5;

    // Update Rooms production (passes full worker roster for level/XP calculation)
    for (const room of this.rooms) {
      const workers = this.survivors.filter(s => s.assignedRoom === room.id && !s.isDead);
      room.update(effectiveDt, workers, isPowered);
    }

    // Automated Ammo Logistics Dispatch
    this.checkAmmoLogistics();

    // Continuous manual firing if holding mouse
    if (this.manualAim && this.isMouseDown && this.mouseY <= CONFIG.SURFACE_Y + 50) {
      const activeTurret = this.mouseX < 640 ? this.leftTurret : this.rightTurret;
      activeTurret.fireManual(this.mouseX, this.mouseY);
    }

    // Update Survivors
    for (const s of this.survivors) {
      s.update(effectiveDt);
    }

    // Check game over if all survivors dead
    const aliveCount = this.survivors.filter(s => !s.isDead).length;
    if (aliveCount === 0) {
      this.triggerGameOver("All bunker inhabitants have died! The bunker has fallen silent.");
    }

    // Update Elevator
    this.elevator.update(effectiveDt);

    // Update Turrets
    this.leftTurret.update(effectiveDt, this.zombies);
    this.rightTurret.update(effectiveDt, this.zombies);

    // Update Zombies & Wave Manager
    this.waveManager.update(effectiveDt, this.zombies);
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];
      z.update(effectiveDt);
      if (z.isDead) {
        this.zombies.splice(i, 1);
      }
    }

    // Update Cabin Searchlights
    this.updateSearchlights(effectiveDt);

    // Update FX
    this.particles.update(effectiveDt, this.dayTime);

    // Occasional chimney smoke puff
    if (Math.random() < 0.14 * effectiveDt * 25) {
      this.particles.spawnSmokePuff(678, CONFIG.SURFACE_Y - 116, 5 + Math.random() * 3);
    }

    // Atmospheric night wind breeze audio
    const isNight = this.dayTime < 6.0 || this.dayTime >= 20.0;
    if (isNight && Math.random() < 0.006 * effectiveDt * 25) {
      if (window.soundSystem && window.soundSystem.playWindBreeze) {
        window.soundSystem.playWindBreeze();
      }
    }

    // Update notifications
    for (let i = this.notifications.length - 1; i >= 0; i--) {
      this.notifications[i].life -= effectiveDt;
      if (this.notifications[i].life <= 0) {
        this.notifications.splice(i, 1);
      }
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. Draw Surface Atmosphere (Sky, Sun/Moon, Stars)
    this.drawSky(ctx);

    // 2. Draw Surface Deep Forest with Parallax Depth (Left and Right)
    this.drawForest(ctx);

    // 3. Draw Ground Soil & Subterranean Strata
    this.drawSubterraneanEarth(ctx);

    // 4. Draw Persistent Blood Decals on Ground
    this.particles.drawDecals(ctx);

    // 5. Draw Surface House Cabin (Pitched roof, window, door, chimney)
    this.drawHouse(ctx);

    // 6. Draw Cabin Roof Searchlights (illuminating forest & tracking zombies)
    this.drawSearchlights(ctx);

    // 7. Draw Ground Fog / Mist Drift across surface
    this.particles.drawFog(ctx, this.dayTime);

    // 8. Draw Elevator Shaft & Lift Car
    this.elevator.draw(ctx);

    // 9. Draw Bunker Rooms Grid
    const isPowered = this.resources.power > 5;
    for (const room of this.rooms) {
      const workers = this.survivors.filter(s => s.assignedRoom === room.id && !s.isDead);
      room.draw(ctx, isPowered, workers);
    }

    // 10. Draw Survivors
    for (const s of this.survivors) {
      s.draw(ctx);
    }

    // 11. Draw Turrets (Left & Right flanking house with laser aim guides)
    this.leftTurret.draw(ctx);
    this.rightTurret.draw(ctx);

    // 12. Draw Zombies
    for (const z of this.zombies) {
      z.draw(ctx);
    }

    // 13. Draw Particle Effects, Tracers, Spits
    this.particles.draw(ctx);

    // 14. Red Emergency Flashing Alarm during Horde
    if (this.waveManager.isHordeActive) {
      const pulse = (Math.sin(Date.now() / 150) + 1) * 0.5;
      ctx.fillStyle = `rgba(231, 76, 60, ${0.14 * pulse})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // 15. Draw Tactical Crosshair if manual aim mode is active
    if (this.manualAim) {
      this.drawCrosshair(ctx);
    }

    // 16. Draw On-Screen Notifications
    this.drawNotifications(ctx);
  }

  drawSky(ctx) {
    const hour = this.dayTime;
    let topColor, botColor;

    if (hour >= 6 && hour < 11) {
      // Dawn / Sunrise
      topColor = '#2c3e50';
      botColor = '#e67e22';
    } else if (hour >= 11 && hour < 17) {
      // Midday Sky
      topColor = '#2980b9';
      botColor = '#85c1e9';
    } else if (hour >= 17 && hour < 20) {
      // Sunset
      topColor = '#2c3e50';
      botColor = '#d35400';
    } else {
      // Night Sky
      topColor = '#0b0e14';
      botColor = '#1a252f';
    }

    const grad = ctx.createLinearGradient(0, 0, 0, CONFIG.SURFACE_Y);
    grad.addColorStop(0, topColor);
    grad.addColorStop(1, botColor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.canvas.width, CONFIG.SURFACE_Y);

    // Stars at night
    if (hour < 6 || hour >= 20) {
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 30; i++) {
        const sx = (i * 47) % 1280;
        const sy = (i * 29) % (CONFIG.SURFACE_Y - 40);
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }
    }
  }

  drawForest(ctx) {
    // 1. Distant atmospheric silhouette pines (parallax layer 1)
    this.drawDistantPines(ctx, 0, 420, 22);
    this.drawDistantPines(ctx, 860, 1280, 22);

    // 2. Foreground detailed pines with wind sway (parallax layer 2)
    this.drawTreeGroup(ctx, 0, 390, 16);
    this.drawTreeGroup(ctx, 890, 1280, 16);
  }

  drawDistantPines(ctx, startX, endX, count) {
    const step = (endX - startX) / count;
    const isNight = this.dayTime < 6 || this.dayTime >= 20;
    ctx.fillStyle = isNight ? '#0b161f' : '#1b3834';

    for (let i = 0; i < count; i++) {
      const tx = startX + i * step + Math.sin(i * 4) * 6;
      const height = 75 + (i % 6) * 12;
      const ty = CONFIG.SURFACE_Y - 2;

      ctx.beginPath();
      ctx.moveTo(tx, ty - height);
      ctx.lineTo(tx + 18, ty);
      ctx.lineTo(tx - 18, ty);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawTreeGroup(ctx, startX, endX, count) {
    const step = (endX - startX) / count;
    const windSway = Math.sin(this.gameTime * 1.5) * 2.2;
    for (let i = 0; i < count; i++) {
      const tx = startX + i * step + Math.sin(i * 3) * 8;
      const height = 110 + (i % 5) * 16;
      const ty = CONFIG.SURFACE_Y;

      // Trunk
      ctx.fillStyle = '#2c1e14';
      ctx.fillRect(tx - 3, ty - height * 0.35, 6, height * 0.35);

      // Pine foliage layers with wind sway
      const colors = ['#1a331c', '#224726', '#142916'];
      for (let layer = 0; layer < 3; layer++) {
        const layerY = ty - height * 0.35 - layer * (height * 0.22);
        const w = 38 - layer * 9;
        const sway = windSway * (layer + 1) * 0.6;
        ctx.fillStyle = colors[layer % colors.length];
        ctx.beginPath();
        ctx.moveTo(tx + sway, layerY - 30);
        ctx.lineTo(tx + w, layerY);
        ctx.lineTo(tx - w, layerY);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  drawSubterraneanEarth(ctx) {
    // Ground line & grass
    ctx.fillStyle = '#27ae60';
    ctx.fillRect(0, CONFIG.SURFACE_Y - 4, this.canvas.width, 6);

    // Deep rocky soil
    ctx.fillStyle = '#2b2118';
    ctx.fillRect(0, CONFIG.SURFACE_Y + 2, this.canvas.width, this.canvas.height - CONFIG.SURFACE_Y);

    // Strata layers & stones
    ctx.fillStyle = '#3a2e22';
    for (let y = CONFIG.SURFACE_Y + 20; y < this.canvas.height; y += 45) {
      ctx.fillRect(0, y, this.canvas.width, 10);
    }

    // Outer bunker heavy reinforced concrete foundation
    ctx.strokeStyle = '#1e272e';
    ctx.lineWidth = 10;
    ctx.strokeRect(
      CONFIG.BUNKER_LEFT - 6,
      CONFIG.BUNKER_TOP - 6,
      (CONFIG.BUNKER_RIGHT - CONFIG.BUNKER_LEFT) + 12,
      CONFIG.FLOORS_COUNT * CONFIG.FLOOR_HEIGHT + 12
    );

    // Hazard yellow/black caution stripes above bunker top
    const hatchX = CONFIG.BUNKER_LEFT;
    const hatchW = CONFIG.BUNKER_RIGHT - CONFIG.BUNKER_LEFT;
    ctx.fillStyle = '#d4ac0d';
    ctx.fillRect(hatchX, CONFIG.BUNKER_TOP - 12, hatchW, 6);
  }

  drawHouse(ctx) {
    const hx = 575;
    const hy = CONFIG.SURFACE_Y - 80;
    const hw = 130;
    const hh = 80;

    // Wooden Cabin Walls
    ctx.fillStyle = '#4a3728';
    ctx.fillRect(hx, hy, hw, hh);

    // Wood plank horizontal lines
    ctx.strokeStyle = '#322316';
    ctx.lineWidth = 1.5;
    for (let p = hy + 12; p < hy + hh; p += 12) {
      ctx.beginPath();
      ctx.moveTo(hx, p);
      ctx.lineTo(hx + hw, p);
      ctx.stroke();
    }

    // Pitched Roof (as drawn in untitled (3).png)
    ctx.fillStyle = '#5c2c16';
    ctx.beginPath();
    ctx.moveTo(hx - 12, hy);
    ctx.lineTo(hx + hw / 2, hy - 45);
    ctx.lineTo(hx + hw + 12, hy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#2d150b';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Chimney with gentle smoke
    ctx.fillStyle = '#7f8c8d';
    ctx.fillRect(hx + hw - 32, hy - 40, 14, 25);
    // Smoke puff
    ctx.fillStyle = 'rgba(200, 200, 200, 0.35)';
    const smokeY = hy - 45 - ((Date.now() / 40) % 30);
    ctx.beginPath();
    ctx.arc(hx + hw - 25, smokeY, 8, 0, Math.PI * 2);
    ctx.fill();

    // Roof Searchlight Mounting Platforms on Pitched Roof
    ctx.fillStyle = '#2d3436';
    ctx.fillRect(hx + 10, hy - 18, 8, 6);
    ctx.fillRect(hx + hw - 18, hy - 18, 8, 6);

    // Illuminated Window with warm radial bloom at night
    if (this.dayTime < 6.5 || this.dayTime >= 18.0) {
      const winGlow = ctx.createRadialGradient(hx + 29, hy + 33, 4, hx + 29, hy + 33, 48);
      winGlow.addColorStop(0, 'rgba(243, 156, 18, 0.52)');
      winGlow.addColorStop(1, 'rgba(243, 156, 18, 0)');
      ctx.fillStyle = winGlow;
      ctx.beginPath();
      ctx.arc(hx + 29, hy + 33, 48, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#f39c12';
    ctx.fillRect(hx + 18, hy + 22, 22, 22);
    ctx.strokeStyle = '#2c1e14';
    ctx.lineWidth = 2;
    ctx.strokeRect(hx + 18, hy + 22, 22, 22);
    ctx.beginPath();
    ctx.moveTo(hx + 29, hy + 22);
    ctx.lineTo(hx + 29, hy + 44);
    ctx.moveTo(hx + 18, hy + 33);
    ctx.lineTo(hx + 40, hy + 33);
    ctx.stroke();

    // Fortified Door / Barricade (entrance to bunker hatch)
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(hx + 56, hy + 28, 28, 52);
    ctx.strokeStyle = '#7f8c8d';
    ctx.lineWidth = 2;
    ctx.strokeRect(hx + 56, hy + 28, 28, 52);

    // Barricade wooden cross planks
    ctx.strokeStyle = '#e67e22';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(hx + 57, hy + 35);
    ctx.lineTo(hx + 83, hy + 75);
    ctx.moveTo(hx + 83, hy + 35);
    ctx.lineTo(hx + 57, hy + 75);
    ctx.stroke();

    // House Barricade Health Bar
    const hpRatio = Math.max(0, this.houseHp / this.houseMaxHp);
    ctx.fillStyle = '#222';
    ctx.fillRect(hx + 15, hy - 58, 100, 6);
    ctx.fillStyle = hpRatio > 0.5 ? '#2ecc71' : hpRatio > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.fillRect(hx + 15, hy - 58, 100 * hpRatio, 6);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`CABIN: ${Math.round(this.houseHp)}/${this.houseMaxHp} HP`, hx + 65, hy - 63);
  }

  // Update roof searchlights tracking approaching zombies or sweeping dark forest
  updateSearchlights(dt) {
    const isNightOrDusk = this.dayTime < 6.5 || this.dayTime >= 18.0 || this.waveManager.isHordeActive;
    if (!isNightOrDusk) return;

    this.updateSingleSearchlight(this.searchlights.left, 'left', dt);
    this.updateSingleSearchlight(this.searchlights.right, 'right', dt);
  }

  updateSingleSearchlight(light, side, dt) {
    let closestZombie = null;
    let minDist = light.range;

    for (const z of this.zombies) {
      if (z.hp <= 0) continue;
      if (side === 'left' && z.x > 620) continue;
      if (side === 'right' && z.x < 660) continue;

      const dist = Math.hypot(z.x - light.x, z.y - light.y);
      if (dist < minDist) {
        minDist = dist;
        closestZombie = z;
      }
    }

    light.target = closestZombie;

    if (closestZombie) {
      // Actively track target zombie
      const targetY = closestZombie.y - closestZombie.size * 0.6;
      light.targetAngle = Math.atan2(targetY - light.y, closestZombie.x - light.x);
      let diff = light.targetAngle - light.angle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      light.angle += diff * Math.min(1, dt * 5.0);
    } else {
      // Idle rhythmic sweep of dark forest
      light.sweepPhase += dt * 0.75;
      if (side === 'left') {
        const centerAngle = Math.PI * 0.85;
        light.angle = centerAngle + Math.sin(light.sweepPhase) * 0.26;
      } else {
        const centerAngle = Math.PI * 0.15;
        light.angle = centerAngle + Math.sin(light.sweepPhase) * 0.26;
      }
    }
  }

  // Render atmospheric cabin searchlights and illuminated ground spotlights
  drawSearchlights(ctx) {
    const isNightOrDusk = this.dayTime < 6.5 || this.dayTime >= 18.0 || this.waveManager.isHordeActive;
    if (!isNightOrDusk) return;

    for (const side of ['left', 'right']) {
      const light = this.searchlights[side];

      ctx.save();
      const beamDist = light.range;
      const spread = 0.26; // half angle in radians

      const p1X = light.x + Math.cos(light.angle - spread) * beamDist;
      const p1Y = light.y + Math.sin(light.angle - spread) * beamDist;
      const p2X = light.x + Math.cos(light.angle + spread) * beamDist;
      const p2Y = light.y + Math.sin(light.angle + spread) * beamDist;
      const centerEndPx = light.x + Math.cos(light.angle) * beamDist;
      const centerEndPy = light.y + Math.sin(light.angle) * beamDist;

      // Volumetric light cone
      const grad = ctx.createRadialGradient(light.x, light.y, 4, centerEndPx, centerEndPy, beamDist);
      grad.addColorStop(0, 'rgba(255, 250, 210, 0.45)');
      grad.addColorStop(0.2, 'rgba(255, 240, 180, 0.24)');
      grad.addColorStop(0.7, 'rgba(240, 230, 170, 0.08)');
      grad.addColorStop(1, 'rgba(220, 210, 150, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(light.x, light.y);
      ctx.lineTo(p1X, p1Y);
      ctx.lineTo(p2X, p2Y);
      ctx.closePath();
      ctx.fill();

      // Ground spotlight puddle
      if (Math.sin(light.angle) > 0.08) {
        const groundDist = (CONFIG.SURFACE_Y - light.y) / Math.sin(light.angle);
        if (groundDist > 0 && groundDist < beamDist + 50) {
          const spotX = light.x + Math.cos(light.angle) * groundDist;
          ctx.fillStyle = 'rgba(255, 242, 185, 0.22)';
          ctx.beginPath();
          ctx.ellipse(spotX, CONFIG.SURFACE_Y, 44, 9, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Highlight targeted zombie when spotlight tracks them
      if (light.target && light.target.hp > 0) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 210, 0.25)';
        ctx.shadowColor = '#fff6aa';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(light.target.x, light.target.y - light.target.size * 0.6, light.target.size * 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Hardware base pedestal and swivel fixture
      ctx.fillStyle = '#2d3436';
      ctx.fillRect(light.x - 3, light.y - 2, 6, 8);

      ctx.save();
      ctx.translate(light.x, light.y);
      ctx.rotate(light.angle);

      // Metal reflector housing
      ctx.fillStyle = '#1e272e';
      ctx.beginPath();
      ctx.arc(0, 0, 7, -Math.PI / 2, Math.PI / 2, true);
      ctx.fill();
      ctx.strokeStyle = '#636e72';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Intense bulb & lens glare
      ctx.fillStyle = '#fff9d2';
      ctx.shadowColor = '#ffeaa7';
      ctx.shadowBlur = 14;
      ctx.fillRect(1, -5, 3.5, 10);

      ctx.restore();
      ctx.restore();
    }
  }

  drawNotifications(ctx) {
    let ny = 20;
    for (const notif of this.notifications) {
      const alpha = Math.min(1, notif.life);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 12px "Courier New", monospace';
      const textW = ctx.measureText(notif.text).width;
      
      // Banner box
      ctx.fillStyle = notif.type === 'danger' ? 'rgba(192, 57, 43, 0.9)' :
                      notif.type === 'success' ? 'rgba(39, 174, 96, 0.9)' : 'rgba(41, 128, 185, 0.9)';
      ctx.fillRect(640 - textW / 2 - 12, ny, textW + 24, 22);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(640 - textW / 2 - 12, ny, textW + 24, 22);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(notif.text, 640, ny + 15);
      ctx.restore();

      ny += 28;
    }
  }

  // Autonomous Ammo Logistics Runner Task Trigger
  checkAmmoLogistics() {
    if (this.resources.ammo < 1) return;

    const threshold = CONFIG.AMMO_DELIVERY_THRESHOLD || 0.35;
    const leftLow = this.leftTurret.ammo < (this.leftTurret.stats.maxAmmo * threshold);
    const rightLow = this.rightTurret.ammo < (this.rightTurret.stats.maxAmmo * threshold);

    if (!leftLow && !rightLow) return;

    // Check if a runner is already handling this turret
    const activeTasks = this.survivors.filter(s => s.ammoDeliveryTask);
    const deliveringLeft = activeTasks.some(s => s.ammoDeliveryTask.turret === this.leftTurret);
    const deliveringRight = activeTasks.some(s => s.ammoDeliveryTask.turret === this.rightTurret);

    let needyTurret = null;
    if (leftLow && !deliveringLeft) needyTurret = this.leftTurret;
    else if (rightLow && !deliveringRight) needyTurret = this.rightTurret;

    if (!needyTurret) return;

    // Find best eligible available survivor
    const candidates = this.survivors.filter(s => !s.isDead && !s.ammoDeliveryTask && s.status !== 'resting');
    if (candidates.length === 0) return;

    // Priority: Armory worker, then Airlock, then Workshop, then any worker
    let runner = candidates.find(s => s.assignedRoom === 'armory');
    if (!runner) runner = candidates.find(s => s.assignedRoom === 'airlock');
    if (!runner) runner = candidates.find(s => s.assignedRoom === 'workshop');
    if (!runner) runner = candidates[0];

    if (runner) {
      runner.startAmmoDelivery(needyTurret);
      this.addNotification(`📦 Ammo low! ${runner.name} dispatched with crate for ${needyTurret.side.toUpperCase()} Turret!`, 'info');
    }
  }

  // Toggle Manual Aim Mode
  toggleManualAim() {
    this.manualAim = !this.manualAim;
    if (window.soundSystem) window.soundSystem.playBeep(true);
    this.addNotification(`🎯 Manual Turret Aim: ${this.manualAim ? 'ENGAGED' : 'DISENGAGED'}`, this.manualAim ? 'warning' : 'info');
    if (this.manualAim) {
      this.particles.addFloatingText("MANUAL AIM ENGAGED", 640, 150, '#00f3ff');
    }
    const btn = document.getElementById('btn-manual-aim');
    if (btn) {
      btn.textContent = this.manualAim ? '🎯 Manual Aim: ON' : '🎯 Manual Aim: OFF';
      btn.classList.toggle('active', this.manualAim);
    }
  }

  // Draw Tactical HUD Crosshair
  drawCrosshair(ctx) {
    const mx = this.mouseX;
    const my = this.mouseY;

    ctx.save();
    const pulse = Math.sin(Date.now() / 110) * 2;
    const activeTurret = mx < 640 ? this.leftTurret : this.rightTurret;
    const color = activeTurret.ammo > 0 ? '#00f3ff' : '#ff4757';

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;

    // Outer reticle circle
    ctx.beginPath();
    ctx.arc(mx, my, 18 + pulse, 0, Math.PI * 2);
    ctx.stroke();

    // Corner crosshair brackets
    const b = 24;
    ctx.beginPath();
    ctx.moveTo(mx - b, my); ctx.lineTo(mx - b + 7, my);
    ctx.moveTo(mx + b, my); ctx.lineTo(mx + b - 7, my);
    ctx.moveTo(mx, my - b); ctx.lineTo(mx, my - b + 7);
    ctx.moveTo(mx, my + b); ctx.lineTo(mx, my + b - 7);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // HUD Text near reticle
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = color;
    ctx.fillText(`${activeTurret.side.toUpperCase()}: ${activeTurret.ammo}/${activeTurret.stats.maxAmmo}`, mx + 22, my - 6);
    ctx.fillText(activeTurret.ammo > 0 ? '[L-CLICK FIRE]' : '[OUT OF AMMO]', mx + 22, my + 8);

    ctx.restore();
  }

  gameLoop(now) {
    if (!this.running) return;
    const dt = Math.min(0.1, (now - this.lastTimestamp) / 1000);
    this.lastTimestamp = now;

    this.update(dt);
    this.draw();

    if (window.uiManager) {
      window.uiManager.updateHUD();
    }

    requestAnimationFrame((t) => this.gameLoop(t));
  }

  start() {
    this.lastTimestamp = performance.now();
    requestAnimationFrame((t) => this.gameLoop(t));
  }
}

window.GameEngine = GameEngine;
