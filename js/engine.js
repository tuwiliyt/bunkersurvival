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

    // Initialize atmospheric celestial starfield and geological strata assets
    this.initAtmosphere();

    this.lastTimestamp = performance.now();
    this.running = true;
  }

  // Initialize atmospheric celestial starfield, undergrowth, and geological strata details
  initAtmosphere() {
    // 1. Deterministic Multi-Spectral Starfield
    this.stars = [];
    const spectralColors = ['#c8d6e5', '#ffffff', '#fff3b0', '#feca57', '#ffccd5'];
    for (let i = 0; i < 90; i++) {
      this.stars.push({
        x: (i * 79 + 37) % CONFIG.CANVAS_WIDTH,
        y: 8 + ((i * 43 + 19) % (CONFIG.SURFACE_Y - 28)),
        radius: 0.6 + ((i * 17) % 5) * 0.28,
        color: spectralColors[i % spectralColors.length],
        twinkleSpeed: 1.2 + ((i * 13) % 7) * 0.45,
        phase: (i * 2.3) % (Math.PI * 2)
      });
    }

    // 2. Subterranean Taproots reaching down from surface pines into topsoil
    this.subterraneanRoots = [];
    for (let i = 0; i < 14; i++) {
      const isLeft = i < 7;
      const baseX = isLeft ? 30 + i * 20 : 1110 + (i - 7) * 20;
      this.subterraneanRoots.push({
        x: baseX,
        y: CONFIG.SURFACE_Y + 2,
        length: 22 + (i % 5) * 9,
        curve: (i % 2 === 0 ? 1 : -1) * (6 + (i % 4) * 3),
        width: 2.2 - (i % 3) * 0.4
      });
    }

    // 3. Subterranean Sandstone & Gravel Embedded River Stones
    this.subterraneanStones = [];
    const stoneColors = ['#5e5448', '#736758', '#8c7d6b', '#483f34', '#9e8f7d'];
    for (let i = 0; i < 34; i++) {
      const isLeft = i < 17;
      const sx = isLeft ? 18 + (i * 23) % 150 : 1112 + (i * 23) % 155;
      const sy = 405 + (i * 31) % 115;
      this.subterraneanStones.push({
        x: sx,
        y: sy,
        rx: 3.5 + (i % 4) * 1.8,
        ry: 2.2 + (i % 3) * 1.2,
        rot: (i * 0.8) % Math.PI,
        color: stoneColors[i % stoneColors.length]
      });
    }

    // 4. Subterranean Carboniferous Shale Ancient Fossils (ammonites & prehistoric ferns)
    this.subterraneanFossils = [
      { x: 45, y: 565, type: 'ammonite', radius: 10, rot: 0.4 },
      { x: 135, y: 610, type: 'fern', length: 22, rot: -0.5 },
      { x: 75, y: 655, type: 'ammonite', radius: 8, rot: 1.8 },
      { x: 1135, y: 555, type: 'fern', length: 20, rot: 0.6 },
      { x: 1225, y: 595, type: 'ammonite', radius: 11, rot: -0.9 },
      { x: 1160, y: 650, type: 'ammonite', radius: 9, rot: 2.3 }
    ];

    // 5. Surface Edge Undergrowth Shrubbery & Wild Ferns
    this.surfaceShrubs = [];
    for (let i = 0; i < 22; i++) {
      const isLeft = i < 11;
      const sx = isLeft ? 15 + i * 36 : 870 + (i - 11) * 36;
      this.surfaceShrubs.push({
        x: sx,
        y: CONFIG.SURFACE_Y - 2,
        scale: 0.75 + (i % 4) * 0.22,
        type: i % 3 === 0 ? 'fern' : i % 3 === 1 ? 'bush' : 'grass',
        swayOffset: (i * 1.4) % Math.PI
      });
    }
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

    // Multi-stop Sky Gradient Transitions across 5 diurnal phases
    const grad = ctx.createLinearGradient(0, 0, 0, CONFIG.SURFACE_Y);

    if (hour >= 5.0 && hour < 8.5) {
      // 1. Dawn / Sunrise: Deep starry indigo -> mulberry -> rose -> amber gold -> peach horizon
      grad.addColorStop(0, '#0c1024');
      grad.addColorStop(0.25, '#271b3e');
      grad.addColorStop(0.55, '#7a2b4b');
      grad.addColorStop(0.8, '#d35400');
      grad.addColorStop(1, '#f39c12');
    } else if (hour >= 8.5 && hour < 16.5) {
      // 2. Midday: Crisp alpine azure -> cerulean -> sky blue -> pale horizon haze
      grad.addColorStop(0, '#1a4f8b');
      grad.addColorStop(0.35, '#2980b9');
      grad.addColorStop(0.7, '#5dade2');
      grad.addColorStop(1, '#aed6f1');
    } else if (hour >= 16.5 && hour < 19.5) {
      // 3. Golden Hour / Sunset: Twilight navy -> royal plum -> fiery crimson -> blazing orange -> golden horizon
      grad.addColorStop(0, '#171836');
      grad.addColorStop(0.28, '#4a1c4a');
      grad.addColorStop(0.58, '#962d2d');
      grad.addColorStop(0.82, '#d35400');
      grad.addColorStop(1, '#f1c40f');
    } else if (hour >= 19.5 && hour < 21.0) {
      // 4. Twilight / Dusk: Velvet obsidian -> slate navy -> twilight purple -> dim mauve horizon
      grad.addColorStop(0, '#0a0e18');
      grad.addColorStop(0.35, '#141d2e');
      grad.addColorStop(0.7, '#25253e');
      grad.addColorStop(1, '#3f354d');
    } else {
      // 5. Night: Deep cosmic obsidian -> midnight abyss -> navy airglow horizon
      grad.addColorStop(0, '#04060a');
      grad.addColorStop(0.4, '#080d16');
      grad.addColorStop(0.75, '#0f1826');
      grad.addColorStop(1, '#152234');
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.canvas.width, CONFIG.SURFACE_Y);

    // Twinkling Parallax Starfield at night / dawn / dusk
    const starAlpha = hour < 5.0 || hour >= 21.0 ? 1.0 :
                      hour >= 19.5 ? (hour - 19.5) / 1.5 :
                      hour < 6.5 ? 1.0 - ((hour - 5.0) / 1.5) : 0;

    if (starAlpha > 0.05 && this.stars) {
      ctx.save();
      for (const st of this.stars) {
        const twinkle = 0.35 + 0.65 * Math.sin(this.gameTime * st.twinkleSpeed + st.phase);
        const a = starAlpha * twinkle;
        if (a <= 0.02) continue;
        ctx.globalAlpha = a;
        ctx.fillStyle = st.color;
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Occasional shooting star / meteor streak
      const meteorTime = (this.gameTime * 0.06) % 1.0;
      if (meteorTime < 0.035 && (hour < 5.0 || hour >= 21.0)) {
        const mProgress = meteorTime / 0.035;
        const mx1 = 260 + mProgress * 220;
        const my1 = 20 + mProgress * 65;
        const mx2 = mx1 - 44;
        const my2 = my1 - 16;
        ctx.strokeStyle = `rgba(255, 255, 255, ${(1 - mProgress) * 0.85})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(mx2, my2);
        ctx.lineTo(mx1, my1);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Celestial Sun with Radiant Corona (traversing daytime celestial arc)
    if (hour >= 5.0 && hour <= 19.5) {
      const sunT = (hour - 5.0) / 14.5;
      const sunX = 1140 - sunT * 1000;
      const sunY = (CONFIG.SURFACE_Y - 24) - Math.sin(sunT * Math.PI) * 168;

      ctx.save();
      // Outer solar atmospheric corona
      const corona = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 72);
      corona.addColorStop(0, 'rgba(255, 245, 180, 0.45)');
      corona.addColorStop(0.35, 'rgba(255, 220, 110, 0.22)');
      corona.addColorStop(0.7, 'rgba(255, 180, 70, 0.08)');
      corona.addColorStop(1, 'rgba(255, 160, 50, 0)');
      ctx.fillStyle = corona;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 72, 0, Math.PI * 2);
      ctx.fill();

      // Middle solar brilliance halo
      const halo = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 28);
      halo.addColorStop(0, '#ffffff');
      halo.addColorStop(0.4, 'rgba(255, 245, 160, 0.85)');
      halo.addColorStop(1, 'rgba(255, 215, 90, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 28, 0, Math.PI * 2);
      ctx.fill();

      // Pulsing solar flare spikes
      const flarePulse = Math.sin(this.gameTime * 2.2) * 4;
      ctx.strokeStyle = 'rgba(255, 240, 160, 0.35)';
      ctx.lineWidth = 1.2;
      for (let f = 0; f < 8; f++) {
        const fAngle = (f * Math.PI / 4) + this.gameTime * 0.08;
        ctx.beginPath();
        ctx.moveTo(sunX + Math.cos(fAngle) * 15, sunY + Math.sin(fAngle) * 15);
        ctx.lineTo(sunX + Math.cos(fAngle) * (26 + flarePulse), sunY + Math.sin(fAngle) * (26 + flarePulse));
        ctx.stroke();
      }

      // White-hot solar core disc
      ctx.fillStyle = '#fffdf0';
      ctx.shadowColor = '#ffeaa7';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Celestial Moon with Craters, Maria, and Lunar Glow (traversing night sky)
    if (hour < 6.5 || hour > 18.0) {
      let moonT;
      if (hour >= 18.0) moonT = (hour - 18.0) / 12.5;
      else moonT = (hour + 6.0) / 12.5;
      const moonX = 140 + moonT * 1000;
      const moonY = (CONFIG.SURFACE_Y - 24) - Math.sin(moonT * Math.PI) * 162;

      ctx.save();
      // Silvery-blue celestial lunar halo
      const moonHalo = ctx.createRadialGradient(moonX, moonY, 6, moonX, moonY, 64);
      moonHalo.addColorStop(0, 'rgba(195, 225, 255, 0.28)');
      moonHalo.addColorStop(0.45, 'rgba(150, 195, 245, 0.12)');
      moonHalo.addColorStop(1, 'rgba(110, 160, 220, 0)');
      ctx.fillStyle = moonHalo;
      ctx.beginPath();
      ctx.arc(moonX, moonY, 64, 0, Math.PI * 2);
      ctx.fill();

      // Soft lunar pearl base disc
      ctx.fillStyle = '#edf2f7';
      ctx.shadowColor = '#c7ecee';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(moonX, moonY, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Detailed Lunar Maria (dark basaltic plains) and Impact Craters
      ctx.save();
      ctx.beginPath();
      ctx.arc(moonX, moonY, 16, 0, Math.PI * 2);
      ctx.clip();

      // Mare basalt patches (textured lunar geography)
      ctx.fillStyle = 'rgba(113, 128, 150, 0.42)';
      ctx.beginPath();
      ctx.arc(moonX - 4, moonY - 4, 6.5, 0, Math.PI * 2); // Mare Serenitatis
      ctx.arc(moonX + 3, moonY - 2, 5.5, 0, Math.PI * 2); // Mare Tranquillitatis
      ctx.arc(moonX - 2, moonY + 5, 5.0, 0, Math.PI * 2); // Oceanus Procellarum
      ctx.fill();

      // Tycho and Copernicus crater impact rims
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(moonX + 4, moonY + 7, 2.0, 0, Math.PI * 2); // Tycho core
      ctx.arc(moonX - 5, moonY + 1, 1.8, 0, Math.PI * 2); // Copernicus core
      ctx.fill();

      // Tycho crater radiating ray filaments
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(moonX + 4, moonY + 7); ctx.lineTo(moonX + 11, moonY + 12);
      ctx.moveTo(moonX + 4, moonY + 7); ctx.lineTo(moonX - 4, moonY + 10);
      ctx.moveTo(moonX + 4, moonY + 7); ctx.lineTo(moonX + 6, moonY - 2);
      ctx.stroke();

      // Subtle shadow crescent curve on trailing limb
      ctx.fillStyle = 'rgba(10, 15, 25, 0.22)';
      ctx.beginPath();
      ctx.arc(moonX + 6, moonY, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawForest(ctx) {
    // 1. Distant atmospheric mountain ridge & spruce silhouettes (Parallax Layer 1)
    this.drawDistantPines(ctx, 0, 440, 24);
    this.drawDistantPines(ctx, 840, 1280, 24);

    // 2. Midground dense pine stand with staggered foliage (Parallax Layer 2)
    this.drawMidgroundPines(ctx, 0, 420, 18);
    this.drawMidgroundPines(ctx, 860, 1280, 18);

    // 3. Foreground hero old-growth pines with bark textures, needle tufts & wind sway (Parallax Layer 3)
    this.drawTreeGroup(ctx, 0, 400, 15);
    this.drawTreeGroup(ctx, 880, 1280, 15);

    // 4. Ground forest edge undergrowth: wild ferns, bushes, roots & moss
    this.drawUndergrowth(ctx);
  }

  drawDistantPines(ctx, startX, endX, count) {
    const step = (endX - startX) / count;
    const hour = this.dayTime;
    const isNight = hour < 5.5 || hour >= 20.5;
    const isDuskDawn = (hour >= 5.5 && hour < 8.5) || (hour >= 17.5 && hour < 20.5);

    // Atmospheric silhouette tone blending into horizon
    ctx.fillStyle = isNight ? '#081219' : isDuskDawn ? '#1e242a' : '#1d3f38';

    for (let i = 0; i < count; i++) {
      const tx = startX + i * step + Math.sin(i * 3.7) * 7;
      const height = 80 + (i % 6) * 14;
      const ty = CONFIG.SURFACE_Y - 2;

      ctx.beginPath();
      ctx.moveTo(tx, ty - height);
      ctx.lineTo(tx + 17, ty);
      ctx.lineTo(tx - 17, ty);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawMidgroundPines(ctx, startX, endX, count) {
    const step = (endX - startX) / count;
    const midSway = Math.sin(this.gameTime * 1.3) * 1.8;
    const colors = ['#0e2216', '#153221', '#10271a'];

    for (let i = 0; i < count; i++) {
      const tx = startX + i * step + Math.sin(i * 2.8) * 8;
      const height = 100 + (i % 5) * 16;
      const ty = CONFIG.SURFACE_Y - 1;

      // Slender trunk
      ctx.fillStyle = '#1c130c';
      ctx.fillRect(tx - 2.5, ty - height * 0.32, 5, height * 0.32);

      // 4 tiered boughs
      for (let layer = 0; layer < 4; layer++) {
        const layerY = ty - height * 0.3 - layer * (height * 0.18);
        const w = 34 - layer * 7;
        const sway = midSway * (layer + 1) * 0.5;
        ctx.fillStyle = colors[(i + layer) % colors.length];
        ctx.beginPath();
        ctx.moveTo(tx + sway, layerY - 24);
        ctx.lineTo(tx + w, layerY);
        ctx.lineTo(tx - w, layerY);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  drawTreeGroup(ctx, startX, endX, count) {
    const step = (endX - startX) / count;
    const windGust = Math.sin(this.gameTime * 0.8) > 0.4 ? Math.sin(this.gameTime * 2.8) * 1.6 : 0;
    const colors = ['#1a3c26', '#224e32', '#14301e', '#2c5e3d'];

    for (let i = 0; i < count; i++) {
      const tx = startX + i * step + Math.sin(i * 3.1) * 10;
      const height = 125 + (i % 5) * 18;
      const ty = CONFIG.SURFACE_Y;
      const trunkW = 8 + (i % 3) * 2;

      // Hero trunk with vertical furrow bark texture
      ctx.fillStyle = '#2d1c11';
      ctx.fillRect(tx - trunkW * 0.5, ty - height * 0.38, trunkW, height * 0.38);

      // Root flare at base anchoring into soil
      ctx.fillStyle = '#1e120a';
      ctx.beginPath();
      ctx.moveTo(tx - trunkW * 0.5, ty - 12);
      ctx.lineTo(tx - trunkW * 0.9, ty);
      ctx.lineTo(tx + trunkW * 0.9, ty);
      ctx.lineTo(tx + trunkW * 0.5, ty - 12);
      ctx.closePath();
      ctx.fill();

      // Bark furrow striations & knot
      ctx.strokeStyle = '#1a1009';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(tx - 1, ty - height * 0.35);
      ctx.lineTo(tx - 1, ty - 2);
      ctx.moveTo(tx + 2, ty - height * 0.28);
      ctx.lineTo(tx + 2, ty - 5);
      ctx.stroke();

      // Tiered evergreen pine foliage with dynamic harmonic wind sway
      for (let layer = 0; layer < 4; layer++) {
        const layerY = ty - height * 0.35 - layer * (height * 0.18);
        const w = 46 - layer * 9;
        const sway = (Math.sin(this.gameTime * 1.6 + i * 0.4) * 2.0 + windGust) * (layer + 1) * 0.65;
        const color = colors[(i + layer) % colors.length];

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(tx + sway, layerY - 32);
        ctx.lineTo(tx + w + sway * 0.3, layerY);
        // Scalloped bough bottom for realistic pine needle contour
        ctx.lineTo(tx + w * 0.5, layerY - 4);
        ctx.lineTo(tx, layerY);
        ctx.lineTo(tx - w * 0.5, layerY - 4);
        ctx.lineTo(tx - w + sway * 0.3, layerY);
        ctx.closePath();
        ctx.fill();

        // Subtle needle highlight rim on top
        ctx.strokeStyle = 'rgba(76, 175, 80, 0.22)';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(tx - w + sway * 0.3, layerY);
        ctx.lineTo(tx + sway, layerY - 32);
        ctx.lineTo(tx + w + sway * 0.3, layerY);
        ctx.stroke();
      }
    }
  }

  drawUndergrowth(ctx) {
    if (!this.surfaceShrubs) return;
    const sway = Math.sin(this.gameTime * 2.0) * 2.4;

    for (const sh of this.surfaceShrubs) {
      ctx.save();
      ctx.translate(sh.x, sh.y);

      if (sh.type === 'fern') {
        // Wild forest fern with arching fronds
        ctx.strokeStyle = '#27ae60';
        ctx.lineWidth = 1.5;
        for (let a = -2; a <= 2; a++) {
          const fx = a * 6 + sway * 0.5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(fx * 0.5, -12 * sh.scale, fx * 1.4, -18 * sh.scale);
          ctx.stroke();
        }
      } else if (sh.type === 'bush') {
        // Forest berry shrub
        ctx.fillStyle = '#1e4d2b';
        ctx.beginPath();
        ctx.arc(-5 * sh.scale, -6 * sh.scale, 7 * sh.scale, 0, Math.PI * 2);
        ctx.arc(4 * sh.scale, -8 * sh.scale, 8 * sh.scale, 0, Math.PI * 2);
        ctx.arc(0, -11 * sh.scale, 7 * sh.scale, 0, Math.PI * 2);
        ctx.fill();
        // Wild red winterberries
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(-2 * sh.scale, -7 * sh.scale, 1.6, 0, Math.PI * 2);
        ctx.arc(3 * sh.scale, -10 * sh.scale, 1.6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Tufted forest grass blades
        ctx.strokeStyle = '#2ecc71';
        ctx.lineWidth = 1.2;
        for (let g = -3; g <= 3; g++) {
          ctx.beginPath();
          ctx.moveTo(g * 2.5, 0);
          ctx.lineTo(g * 3.5 + sway * (g * 0.2 + 0.5), -14 * sh.scale);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  drawSubterraneanEarth(ctx) {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const SY = CONFIG.SURFACE_Y;

    // 1. Organic Surface Embankment & Forest Topsoil Turf (Y: 236 - 244)
    ctx.fillStyle = '#27ae60';
    ctx.fillRect(0, SY - 4, W, 5);

    // Forest moss clumps & organic grass blade rim
    ctx.fillStyle = '#1e824c';
    for (let x = 0; x < W; x += 18) {
      const h = 2 + (x % 5);
      ctx.fillRect(x, SY - 4 - h, 10, h);
    }

    // 2. Geological Strata Layers (Topsoil, Clay, Sandstone/Gravel, Dark Shale, Ancient Bedrock)
    // Layer 1: Topsoil & Organic Humus (Y: 240 - 295)
    ctx.fillStyle = '#2e1e12';
    ctx.fillRect(0, SY + 1, W, 54);

    // Layer 2: Ferruginous Reddish Clay & Silt (Y: 295 - 400)
    ctx.fillStyle = '#58321d';
    ctx.fillRect(0, 295, W, 105);

    // Layer 3: Coarse Sandstone & Pebble Gravel Aggregate (Y: 400 - 530)
    ctx.fillStyle = '#3f3328';
    ctx.fillRect(0, 400, W, 130);

    // Layer 4: Carboniferous Dark Slate Shale with Coal Seams (Y: 530 - 680)
    ctx.fillStyle = '#21252c';
    ctx.fillRect(0, 530, W, 150);

    // Layer 5: Deep Ancient Basalt Bedrock (Y: 680 - 820)
    ctx.fillStyle = '#131519';
    ctx.fillRect(0, 680, W, H - 680);

    // Wavy Strata Geological Seam Dividers (matching wavy lines in original sketch)
    const drawWavySeam = (baseY, color, amp = 3.5) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(0, baseY);
      for (let x = 0; x <= W; x += 25) {
        const wy = baseY + Math.sin(x * 0.022) * amp + Math.cos(x * 0.055) * (amp * 0.5);
        ctx.lineTo(x, wy);
      }
      ctx.stroke();
    };

    drawWavySeam(295, '#422515', 3.0);
    drawWavySeam(400, '#2e241c', 4.0);
    drawWavySeam(530, '#171a20', 3.5);
    drawWavySeam(680, '#0c0d10', 4.5);

    // 3. Subterranean Tree Roots penetrating from Surface Pines into Topsoil
    if (this.subterraneanRoots) {
      ctx.strokeStyle = '#3e2718';
      ctx.lineCap = 'round';
      for (const r of this.subterraneanRoots) {
        ctx.lineWidth = r.width;
        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.quadraticCurveTo(r.x + r.curve, r.y + r.length * 0.5, r.x + r.curve * 0.8, r.y + r.length);
        ctx.stroke();
      }
    }

    // 4. Sandstone & Gravel Embedded Rounded River Stones
    if (this.subterraneanStones) {
      for (const st of this.subterraneanStones) {
        ctx.save();
        ctx.translate(st.x, st.y);
        ctx.rotate(st.rot);
        ctx.fillStyle = st.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, st.rx, st.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#28211a';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.restore();
      }
    }

    // 5. Carboniferous Dark Shale Ancient Fossils (Spiral Ammonites & Prehistoric Fern Imprints)
    if (this.subterraneanFossils) {
      ctx.save();
      for (const fos of this.subterraneanFossils) {
        ctx.translate(fos.x, fos.y);
        ctx.rotate(fos.rot);

        if (fos.type === 'ammonite') {
          // Ancient spiral ammonite shell imprint
          ctx.strokeStyle = 'rgba(160, 175, 195, 0.35)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          for (let a = 0; a < Math.PI * 5; a += 0.25) {
            const rad = (a / (Math.PI * 5)) * fos.radius;
            const ax = Math.cos(a) * rad;
            const ay = Math.sin(a) * rad;
            if (a === 0) ctx.moveTo(ax, ay);
            else ctx.lineTo(ax, ay);
          }
          ctx.stroke();
        } else {
          // Prehistoric fern leaf rock fossil
          ctx.strokeStyle = 'rgba(145, 160, 180, 0.32)';
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.moveTo(0, -fos.length * 0.5);
          ctx.lineTo(0, fos.length * 0.5);
          for (let p = -fos.length * 0.35; p <= fos.length * 0.35; p += 4.5) {
            ctx.moveTo(-5, p - 2);
            ctx.lineTo(0, p);
            ctx.lineTo(5, p - 2);
          }
          ctx.stroke();
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
      ctx.restore();
    }

    // 6. Basalt Bedrock Quartz Mineral Seams & Seismic Cleavage Cracks
    ctx.strokeStyle = '#383e4a';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(40, 715); ctx.lineTo(85, 730); ctx.lineTo(130, 725);
    ctx.moveTo(1120, 740); ctx.lineTo(1180, 735); ctx.lineTo(1240, 755);
    ctx.moveTo(60, 780); ctx.lineTo(120, 795);
    ctx.moveTo(1140, 790); ctx.lineTo(1220, 785);
    ctx.stroke();

    // 7. Outer Bunker Heavy Reinforced Concrete Foundation Girders
    const bL = CONFIG.BUNKER_LEFT - 8;
    const bT = CONFIG.BUNKER_TOP - 8;
    const bW = (CONFIG.BUNKER_RIGHT - CONFIG.BUNKER_LEFT) + 16;
    const bH = CONFIG.FLOORS_COUNT * CONFIG.FLOOR_HEIGHT + 16;

    // Heavy concrete perimeter foundation frame
    ctx.strokeStyle = '#181d24';
    ctx.lineWidth = 14;
    ctx.strokeRect(bL, bT, bW, bH);

    ctx.strokeStyle = '#2c3542';
    ctx.lineWidth = 2;
    ctx.strokeRect(bL - 7, bT - 7, bW + 14, bH + 14);
    ctx.strokeRect(bL + 7, bT + 7, bW - 14, bH - 14);

    // Foundation anchor bolt plates & expansion joints
    ctx.fillStyle = '#3a4454';
    for (let by = bT + 65; by < bT + bH; by += 130) {
      ctx.fillRect(bL - 10, by - 4, 6, 8);
      ctx.fillRect(bL + bW + 4, by - 4, 6, 8);
    }

    // 8. Industrial Hazard Yellow/Black Caution Stripes along upper retaining girder
    const hatchX = CONFIG.BUNKER_LEFT - 2;
    const hatchW = (CONFIG.BUNKER_RIGHT - CONFIG.BUNKER_LEFT) + 4;
    const stripeY = CONFIG.BUNKER_TOP - 14;
    const stripeH = 8;

    ctx.save();
    ctx.beginPath();
    if (ctx.rect) ctx.rect(hatchX, stripeY, hatchW, stripeH);
    if (ctx.clip) ctx.clip();

    ctx.fillStyle = '#1e2024';
    ctx.fillRect(hatchX, stripeY, hatchW, stripeH);

    ctx.fillStyle = '#f1c40f';
    for (let sx = hatchX - 20; sx < hatchX + hatchW + 20; sx += 18) {
      ctx.beginPath();
      ctx.moveTo(sx, stripeY);
      ctx.lineTo(sx + 9, stripeY);
      ctx.lineTo(sx - 2, stripeY + stripeH);
      ctx.lineTo(sx - 11, stripeY + stripeH);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Weathering grime & metal rim on hazard bar
    ctx.strokeStyle = '#2f3542';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(hatchX, stripeY, hatchW, stripeH);
  }

  drawHouse(ctx) {
    const hx = 575;
    const hy = CONFIG.SURFACE_Y - 80;
    const hw = 130;
    const hh = 80;

    // 1. Drop Shadow underneath cabin footprint
    ctx.fillStyle = 'rgba(12, 16, 20, 0.48)';
    ctx.beginPath();
    ctx.ellipse(hx + hw * 0.5, CONFIG.SURFACE_Y + 1, hw * 0.56, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Interlocking Rough-Hewn Timber Logs (7 stacked courses)
    const logH = hh / 7;
    for (let l = 0; l < 7; l++) {
      const ly = hy + l * logH;
      const isOdd = l % 2 === 1;

      // Base heartwood cedar gradient
      const logGrad = ctx.createLinearGradient(hx, ly, hx, ly + logH);
      logGrad.addColorStop(0, '#6e4a2e');
      logGrad.addColorStop(0.3, '#54371f');
      logGrad.addColorStop(0.85, '#422a16');
      logGrad.addColorStop(1, '#2b1a0d');

      ctx.fillStyle = logGrad;
      // Log extends 5px beyond corner on left/right for saddle-notch cabin look
      ctx.fillRect(hx - 4, ly, hw + 8, logH);

      // Top highlighted bevel edge
      ctx.fillStyle = 'rgba(255, 220, 170, 0.16)';
      ctx.fillRect(hx - 4, ly, hw + 8, 1.4);

      // Deep groove between logs
      ctx.fillStyle = '#1e1107';
      ctx.fillRect(hx - 4, ly + logH - 1.2, hw + 8, 1.2);

      // Log end concentric growth rings on protruding notches
      ctx.fillStyle = '#7a5433';
      ctx.beginPath();
      ctx.arc(hx - 4, ly + logH * 0.5, logH * 0.42, 0, Math.PI * 2);
      ctx.arc(hx + hw + 4, ly + logH * 0.5, logH * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#321d0d';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Wood grain striations & knots
      ctx.strokeStyle = 'rgba(30, 16, 8, 0.35)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(hx + 10, ly + logH * 0.45);
      ctx.lineTo(hx + hw - 10, ly + logH * 0.45);
      if (isOdd) {
        ctx.moveTo(hx + 35, ly + logH * 0.7);
        ctx.lineTo(hx + 95, ly + logH * 0.7);
      }
      ctx.stroke();
    }

    // Heavy wrought-iron corner brackets pinning the cabin timbers
    ctx.fillStyle = '#1e242c';
    ctx.fillRect(hx - 3, hy, 6, hh);
    ctx.fillRect(hx + hw - 3, hy, 6, hh);
    // Bolt heads on corner brackets
    ctx.fillStyle = '#718096';
    for (let b = hy + 6; b < hy + hh; b += 14) {
      ctx.fillRect(hx - 2, b, 4, 3);
      ctx.fillRect(hx + hw - 2, b, 4, 3);
    }

    // 3. Pitched Roof with Detailed Overlapping Shingles & Crossed Ridge Timber (as in sketch)
    const apexX = hx + hw * 0.5;
    const apexY = hy - 48;
    const overhang = 14;

    // Roof Gable Triangle Base
    ctx.fillStyle = '#3a2113';
    ctx.beginPath();
    ctx.moveTo(hx - overhang, hy);
    ctx.lineTo(apexX, apexY);
    ctx.lineTo(hx + hw + overhang, hy);
    ctx.closePath();
    ctx.fill();

    // Overlapping Slate / Cedar Roof Shingles (5 distinct tiered courses)
    const shingleTiers = 5;
    const shingleColors = ['#5c2e17', '#6e381c', '#4a2412', '#7a3e1f'];
    for (let s = 0; s < shingleTiers; s++) {
      const t1 = s / shingleTiers;
      const t2 = (s + 1) / shingleTiers;
      const y1 = hy - t1 * (hy - apexY);
      const y2 = hy - t2 * (hy - apexY);
      const leftX1 = (hx - overhang) + t1 * (apexX - (hx - overhang));
      const leftX2 = (hx - overhang) + t2 * (apexX - (hx - overhang));
      const rightX1 = (hx + hw + overhang) - t1 * ((hx + hw + overhang) - apexX);
      const rightX2 = (hx + hw + overhang) - t2 * ((hx + hw + overhang) - apexX);

      // Shingle course polygon
      ctx.fillStyle = shingleColors[s % shingleColors.length];
      ctx.beginPath();
      ctx.moveTo(leftX1, y1);
      ctx.lineTo(leftX2, y2);
      ctx.lineTo(rightX2, y2);
      ctx.lineTo(rightX1, y1);
      ctx.closePath();
      ctx.fill();

      // Shingle drop shadow and bottom lip
      ctx.strokeStyle = '#271208';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(leftX1, y1); ctx.lineTo(rightX1, y1);
      ctx.stroke();

      // Vertical relief slits between individual shingle tiles
      ctx.strokeStyle = 'rgba(25, 12, 6, 0.45)';
      ctx.lineWidth = 1.0;
      const shingleCount = 10 - s;
      const step = (rightX1 - leftX1) / shingleCount;
      for (let sc = 1; sc < shingleCount; sc++) {
        const sx = leftX1 + sc * step;
        ctx.beginPath();
        ctx.moveTo(sx, y1);
        ctx.lineTo(sx + (sc % 2 === 0 ? 2 : -2), y2);
        ctx.stroke();
      }
    }

    // Heavy Roof Ridge Rafter Rim & Cross Beams ('X' at peak matching original sketch)
    ctx.strokeStyle = '#271208';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(hx - overhang, hy);
    ctx.lineTo(apexX, apexY);
    ctx.lineTo(hx + hw + overhang, hy);
    ctx.stroke();

    // Hand-drawn sketch feature: Crossed timber ridge rafters at peak (X)
    ctx.strokeStyle = '#6e3f22';
    ctx.lineWidth = 4.0;
    ctx.beginPath();
    ctx.moveTo(apexX - 12, apexY + 8);
    ctx.lineTo(apexX + 12, apexY - 14);
    ctx.moveTo(apexX + 12, apexY + 8);
    ctx.lineTo(apexX - 12, apexY - 14);
    ctx.stroke();
    ctx.strokeStyle = '#2b170a';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 4. Heavy Masonry Stone Chimney & Iron Flue Pipe
    const chimX = hx + hw - 34;
    const chimY = hy - 46;
    const chimW = 16;
    const chimH = 46;

    // Fieldstone masonry base
    ctx.fillStyle = '#484d56';
    ctx.fillRect(chimX, chimY, chimW, chimH);

    // Stone courses & mortar lines
    ctx.strokeStyle = '#2a2e36';
    ctx.lineWidth = 1.2;
    for (let my = chimY + 8; my < chimY + chimH; my += 8) {
      ctx.beginPath();
      ctx.moveTo(chimX, my); ctx.lineTo(chimX + chimW, my);
      ctx.stroke();
      // Alternating vertical mortar joints
      const isAlt = (my / 8) % 2 === 0;
      const mid = isAlt ? chimX + 8 : chimX + 4;
      ctx.beginPath();
      ctx.moveTo(mid, my - 8); ctx.lineTo(mid, my);
      ctx.stroke();
    }

    // Concrete Chimney Cap with drip overhang
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(chimX - 2, chimY - 3, chimW + 4, 4);
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;
    ctx.strokeRect(chimX - 2, chimY - 3, chimW + 4, 4);

    // Dark Iron Flue Pipe Collar protruding on top
    ctx.fillStyle = '#1e2024';
    ctx.fillRect(chimX + 4, chimY - 8, 8, 5);

    // 5. Roof Searchlight Mounting Fortified Pedestals on Slopes
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(hx + 10, hy - 19, 10, 7);
    ctx.fillRect(hx + hw - 20, hy - 19, 10, 7);
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(hx + 10, hy - 19, 10, 7);
    ctx.strokeRect(hx + hw - 20, hy - 19, 10, 7);

    // 6. Fortified Watchtower Window with Sill, Shadow, and Warm Ambient Light
    const winX = hx + 18;
    const winY = hy + 22;
    const winW = 24;
    const winH = 24;

    // Warm radial bloom spilling from window into dark forest during night / dusk
    if (this.dayTime < 6.5 || this.dayTime >= 18.0) {
      const winGlow = ctx.createRadialGradient(winX + winW * 0.5, winY + winH * 0.5, 4, winX + winW * 0.5, winY + winH * 0.5, 54);
      winGlow.addColorStop(0, 'rgba(243, 156, 18, 0.62)');
      winGlow.addColorStop(0.35, 'rgba(230, 126, 34, 0.28)');
      winGlow.addColorStop(0.7, 'rgba(211, 84, 0, 0.08)');
      winGlow.addColorStop(1, 'rgba(211, 84, 0, 0)');
      ctx.fillStyle = winGlow;
      ctx.beginPath();
      ctx.arc(winX + winW * 0.5, winY + winH * 0.5, 54, 0, Math.PI * 2);
      ctx.fill();
    }

    // Heavy Timber Window Frame & Sill
    ctx.fillStyle = '#2d180d';
    ctx.fillRect(winX - 3, winY - 3, winW + 6, winH + 8);
    // Projecting window sill
    ctx.fillStyle = '#4a2815';
    ctx.fillRect(winX - 5, winY + winH, winW + 10, 4);
    // Sill drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(winX - 4, winY + winH + 4, winW + 8, 3);

    // Glowing window pane glass
    const glassGrad = ctx.createLinearGradient(winX, winY, winX, winY + winH);
    glassGrad.addColorStop(0, '#f39c12');
    glassGrad.addColorStop(0.6, '#f1c40f');
    glassGrad.addColorStop(1, '#e67e22');
    ctx.fillStyle = glassGrad;
    ctx.fillRect(winX, winY, winW, winH);

    // Subtle survivor lookout silhouette visible through window at night
    if (this.dayTime < 6.5 || this.dayTime >= 18.0) {
      ctx.fillStyle = 'rgba(28, 18, 12, 0.68)';
      ctx.beginPath();
      ctx.arc(winX + winW * 0.5, winY + 8, 4, 0, Math.PI * 2);
      ctx.fillRect(winX + winW * 0.5 - 4.5, winY + 12, 9, 10);
      ctx.fill();
    }

    // Security Iron Cross-Muntins dividing the glass into four panes
    ctx.strokeStyle = '#2c1e14';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(winX + winW * 0.5, winY);
    ctx.lineTo(winX + winW * 0.5, winY + winH);
    ctx.moveTo(winX, winY + winH * 0.5);
    ctx.lineTo(winX + winW, winY + winH * 0.5);
    ctx.stroke();

    // 7. Fortified Entry Doorway & Barricades (Entrance to Bunker Hatch)
    const doorX = hx + 58;
    const doorY = hy + 26;
    const doorW = 28;
    const doorH = 54;

    // Recessed heavy door timber architrave
    ctx.fillStyle = '#22140b';
    ctx.fillRect(doorX - 3, doorY - 3, doorW + 6, doorH + 3);

    // Heavy reinforced steel shelter door panel
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(doorX, doorY, doorW, doorH);

    // Steel door perimeter rivets
    ctx.fillStyle = '#7f8c8d';
    for (let ry = doorY + 4; ry < doorY + doorH; ry += 8) {
      ctx.fillRect(doorX + 2, ry, 2, 2);
      ctx.fillRect(doorX + doorW - 4, ry, 2, 2);
    }

    // Heavy mechanical vault handle
    ctx.fillStyle = '#95a5a6';
    ctx.fillRect(doorX + doorW - 7, doorY + doorH * 0.5 - 2, 5, 5);

    // Stenciled warning text above door
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 6px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SHELTER 04', doorX + doorW * 0.5, doorY - 5);

    // Heavy Wooden Cross Barricade Planks (matching X barricade in sketch)
    const plankW = 4.0;
    ctx.strokeStyle = '#d35400';
    ctx.lineWidth = plankW;
    ctx.beginPath();
    // Diagonal 1
    ctx.moveTo(doorX + 2, doorY + 6);
    ctx.lineTo(doorX + doorW - 2, doorY + doorH - 6);
    // Diagonal 2
    ctx.moveTo(doorX + doorW - 2, doorY + 6);
    ctx.lineTo(doorX + 2, doorY + doorH - 6);
    // Horizontal reinforcing plank
    ctx.moveTo(doorX - 2, doorY + doorH * 0.5);
    ctx.lineTo(doorX + doorW + 2, doorY + doorH * 0.5);
    ctx.stroke();

    // Metallic reinforcement plates & carriage bolts at intersections
    ctx.fillStyle = '#34495e';
    ctx.fillRect(doorX + doorW * 0.5 - 4, doorY + doorH * 0.5 - 4, 8, 8);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(doorX + doorW * 0.5 - 1.5, doorY + doorH * 0.5 - 1.5, 3, 3);

    // 8. House Barricade Health Bar with Armor Bracket Frame
    const hpRatio = Math.max(0, this.houseHp / this.houseMaxHp);
    const barW = 104;
    const barH = 7;
    const barX = hx + 13;
    const barY = hy - 60;

    ctx.fillStyle = 'rgba(10, 14, 20, 0.88)';
    ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(barX - 2, barY - 2, barW + 4, barH + 4);

    const hpColor = hpRatio > 0.5 ? '#2ecc71' : hpRatio > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.fillStyle = hpColor;
    ctx.fillRect(barX, barY, barW * hpRatio, barH);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`CABIN: ${Math.round(this.houseHp)}/${this.houseMaxHp} HP`, hx + hw * 0.5, barY - 5);
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
      const spread = 0.28; // half angle in radians

      const p1X = light.x + Math.cos(light.angle - spread) * beamDist;
      const p1Y = light.y + Math.sin(light.angle - spread) * beamDist;
      const p2X = light.x + Math.cos(light.angle + spread) * beamDist;
      const p2Y = light.y + Math.sin(light.angle + spread) * beamDist;
      const centerEndPx = light.x + Math.cos(light.angle) * beamDist;
      const centerEndPy = light.y + Math.sin(light.angle) * beamDist;

      // Volumetric Light Cone with atmospheric scattering
      const grad = ctx.createRadialGradient(light.x, light.y, 4, centerEndPx, centerEndPy, beamDist);
      grad.addColorStop(0, 'rgba(255, 250, 215, 0.48)');
      grad.addColorStop(0.18, 'rgba(255, 240, 185, 0.26)');
      grad.addColorStop(0.65, 'rgba(240, 230, 175, 0.08)');
      grad.addColorStop(1, 'rgba(220, 210, 150, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(light.x, light.y);
      ctx.lineTo(p1X, p1Y);
      ctx.lineTo(p2X, p2Y);
      ctx.closePath();
      ctx.fill();

      // Atmospheric dust/mist motes dancing in the illuminated light cone
      ctx.fillStyle = 'rgba(255, 255, 220, 0.55)';
      for (let m = 1; m <= 6; m++) {
        const mDist = (m * 48 + ((this.gameTime * 35) % 48));
        if (mDist < beamDist * 0.7) {
          const mAngle = light.angle + (Math.sin(this.gameTime * 2.5 + m) * spread * 0.6);
          const mx = light.x + Math.cos(mAngle) * mDist;
          const my = light.y + Math.sin(mAngle) * mDist;
          ctx.beginPath();
          ctx.arc(mx, my, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Ground spotlight puddle with perspective-flattened ellipse
      if (Math.sin(light.angle) > 0.08) {
        const groundDist = (CONFIG.SURFACE_Y - light.y) / Math.sin(light.angle);
        if (groundDist > 0 && groundDist < beamDist + 60) {
          const spotX = light.x + Math.cos(light.angle) * groundDist;
          ctx.fillStyle = 'rgba(255, 242, 190, 0.24)';
          ctx.beginPath();
          ctx.ellipse(spotX, CONFIG.SURFACE_Y, 48, 10, 0, 0, Math.PI * 2);
          ctx.fill();

          // Intense core spot
          ctx.fillStyle = 'rgba(255, 250, 220, 0.18)';
          ctx.beginPath();
          ctx.ellipse(spotX, CONFIG.SURFACE_Y, 24, 5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Tactical reticle highlighting targeted zombie when tracked
      if (light.target && light.target.hp > 0) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 210, 0.25)';
        ctx.shadowColor = '#fff6aa';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(light.target.x, light.target.y - light.target.size * 0.6, light.target.size * 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Hardware base pedestal and swivel yoke mount
      ctx.fillStyle = '#2d3436';
      ctx.fillRect(light.x - 4, light.y - 2, 8, 8);

      ctx.save();
      ctx.translate(light.x, light.y);
      ctx.rotate(light.angle);

      // Heavy industrial metal reflector housing
      ctx.fillStyle = '#1e272e';
      ctx.beginPath();
      ctx.arc(0, 0, 8, -Math.PI / 2, Math.PI / 2, true);
      ctx.fill();
      ctx.strokeStyle = '#636e72';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Intense high-output bulb & parabolic lens flare
      ctx.fillStyle = '#fff9d2';
      ctx.shadowColor = '#ffeaa7';
      ctx.shadowBlur = 16;
      ctx.fillRect(1, -6, 4, 12);

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
