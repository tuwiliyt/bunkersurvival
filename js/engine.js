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

    // Atmospheric cabin searchlights mounted on multi-story surface cabin & watchtower
    this.searchlights = {
      left: {
        x: 586,
        y: CONFIG.SURFACE_Y - 146,
        angle: Math.PI * 0.85,
        targetAngle: Math.PI * 0.85,
        target: null,
        sweepPhase: 0,
        range: 560
      },
      right: {
        x: 696,
        y: CONFIG.SURFACE_Y - 194,
        angle: Math.PI * 0.15,
        targetAngle: Math.PI * 0.15,
        target: null,
        sweepPhase: Math.PI,
        range: 580
      }
    };

    // Watchtower Sniper system
    this.sniperTimer = 0;
    this.sniperAimAngle = Math.PI * 0.15;
    this.sniperTarget = null;

    // ── Construction System ─────────────────────────────────────────────────
    // Two additional roof turrets built autonomously when resources allow
    this.constructionSites = [
      {
        id: 'turret3', label: 'Roof Turret L',
        x: 540, y: 104,
        requiredMetal: 80, requiredGunpowder: 40,
        progress: 0,       // 0-100%
        built: false,
        building: false,
        builder: null,     // assigned survivor reference
        buildTimer: 0,
        turret: null,      // Turret instance when built
        announced: false
      },
      {
        id: 'turret4', label: 'Roof Turret R',
        x: 740, y: 104,
        requiredMetal: 80, requiredGunpowder: 40,
        progress: 0,
        built: false,
        building: false,
        builder: null,
        buildTimer: 0,
        turret: null,
        announced: false
      }
    ];
    this.constructionTimer = 0; // Global hammering sound interval

    // Initialize Bunker Rooms
    this.rooms = CONFIG.ROOM_TEMPLATES.map(t => new Room(t));

    // Initialize Survivors
    this.survivors = CONFIG.INITIAL_SURVIVORS.map(s => new Survivor(s));

    // Zombies
    this.zombies = [];

    // Fleeing Surface Refugees Pursued by Horde
    this.refugees = [];

    // Notifications
    this.notifications = [];

    // Stats
    this.stats = {
      zombiesKilled: 0,
      ammoCrafted: 0,
      daysSurvived: 1
    };

    // Power Grid & Renewable Energy Subsystems
    this.solarOutput = 0;             // Current active solar array output (+15 kW daytime)
    this.generatorOutput = 0;         // Current diesel generator output (+30 kW active)
    this.bunkerPowerDemand = 0;       // Total connected bunker power demand (kW)
    this.netPowerFlow = 0;            // Net surplus/deficit (+/- kW/s)
    this.lastAutonomousPowerDispatch = -999; // Cooldown timer for AI dispatch

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

  getMaxPopulation() {
    const baseCap = CONFIG.BASE_POPULATION_CAP || 8;
    const q1 = this.getRoom('quarters_1');
    const q2 = this.getRoom('quarters_2');
    const perTier = CONFIG.POPULATION_PER_QUARTERS_TIER || 2;
    const bonus1 = q1 ? (q1.level - 1) * perTier : 0;
    const bonus2 = q2 ? (q2.level - 1) * perTier : 0;
    return baseCap + bonus1 + bonus2;
  }

  triggerRefugeeEvent() {
    if (this.isPaused) return;

    // Check if refugee is already active on surface
    if (this.refugees && this.refugees.some(r => !r.isDead && !r.isRescued)) {
      return;
    }

    // Check population capacity
    const aliveCount = this.survivors.filter(s => !s.isDead).length;
    const maxPop = this.getMaxPopulation();
    if (aliveCount >= maxPop) {
      this.addNotification("📻 Radio: Bunker bunks are FULL! Upgrade Living Quarters to house more refugees.", "warning");
      return;
    }

    // Pick next unique archetype or extra archetype
    const existingNames = this.survivors.map(s => s.name.toLowerCase());
    let archetype = (CONFIG.UNIQUE_ARCHETYPES || []).find(a => !existingNames.includes(a.name.toLowerCase()));
    if (!archetype) {
      const extraPool = CONFIG.EXTRA_ARCHETYPES || [];
      archetype = extraPool.find(e => !existingNames.includes(e.name.toLowerCase()));
      if (!archetype) {
        archetype = {
          name: 'Survivor ' + (aliveCount + 1),
          role: 'Outpost Veteran',
          skill: 'Generalist',
          avatar: '🧑‍🚀',
          specialty: 'armory',
          assignedRoom: 'armory'
        };
      }
    }

    const side = Math.random() > 0.5 ? 'left' : 'right';
    const refugee = new Refugee(archetype, side);
    this.refugees.push(refugee);

    if (window.soundSystem) {
      window.soundSystem.playBeep(true);
    }

    this.addNotification(`📻 DISTRESS SIGNAL: ${refugee.name} (${refugee.role}) fleeing from forest! DEFEND THEM!`, 'warning');
    this.particles.addFloatingText(`⚠️ REFUGEE INBOUND! PROTECT ${refugee.name.toUpperCase()}!`, 640, CONFIG.SURFACE_Y - 50, '#ff4757');

    // Spawn 2 to 3 pursuer zombies directly behind refugee
    const pursuerCount = 2 + (this.waveManager.currentWave >= 2 ? 1 : 0);
    for (let i = 0; i < pursuerCount; i++) {
      const pType = (i === 0 && Math.random() < 0.6) ? 'runner' : 'shambler';
      const pursuer = new Zombie(pType, side);
      pursuer.x = side === 'left' ? refugee.x - (30 + i * 28) : refugee.x + (30 + i * 28);
      pursuer.targetRefugee = refugee;
      this.zombies.push(pursuer);
    }
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

      // Check house click (repair) - multi-story surface cabin & watchtower
      if (
        this.mouseX >= 565 && this.mouseX <= 715 &&
        this.mouseY >= 18 && this.mouseY <= CONFIG.SURFACE_Y
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

    // Update Power Grid (Solar Array, Diesel Generator, Battery Buffer, and Autonomous Logistics)
    this.updatePowerGrid(effectiveDt);

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
    // Update additional roof turrets if built
    for (const site of this.constructionSites) {
      if (site.built && site.turret) {
        site.turret.update(effectiveDt, this.zombies);
      }
    }

    // Update Zombies & Wave Manager
    this.waveManager.update(effectiveDt, this.zombies);
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];
      z.update(effectiveDt);
      if (z.isDead) {
        this.zombies.splice(i, 1);
      }
    }

    // Update Surface Refugees Pursued by Horde
    if (this.refugees) {
      for (let i = this.refugees.length - 1; i >= 0; i--) {
        const ref = this.refugees[i];
        ref.update(effectiveDt);
        if (ref.isDead || ref.isRescued) {
          this.refugees.splice(i, 1);
        }
      }
    }

    // Update Cabin Searchlights
    this.updateSearchlights(effectiveDt);

    // Update Elevated Watchtower Sniper Autonomous Defense
    this.updateSniper(effectiveDt);

    // Update Autonomous Construction (Turrets 3 & 4 building)
    this.updateConstruction(effectiveDt);

    // Update FX
    this.particles.update(effectiveDt, this.dayTime);

    // Occasional chimney smoke puff from high masonry flue pipe
    if (Math.random() < 0.14 * effectiveDt * 25) {
      this.particles.spawnSmokePuff(707, 102, 5 + Math.random() * 3);
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

    // 10. Draw Survivors (Sniper stationed in elevated watchtower nest)
    for (const s of this.survivors) {
      if (s.id === 'jackson' || s.id === 's6' || (s.role && s.role.toLowerCase().includes('sniper')) || (s.skill && s.skill.toLowerCase().includes('marksman'))) {
        continue;
      }
      s.draw(ctx);
    }

    // 11. Draw Turrets (Left & Right flanking house with laser aim guides)
    this.leftTurret.draw(ctx);
    this.rightTurret.draw(ctx);

    // 11.5 Draw construction sites & built roof turrets
    this.drawConstructionSites(ctx);

    // 12. Draw Zombies
    for (const z of this.zombies) {
      z.draw(ctx);
    }

    // 12.5. Draw Surface Refugees Fleeing from Forest
    if (this.refugees) {
      for (const ref of this.refugees) {
        ref.draw(ctx);
      }
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

  // Draw construction blueprints, progress bars, and built roof turrets
  drawConstructionSites(ctx) {
    if (!this.constructionSites) return;

    for (const site of this.constructionSites) {
      if (site.built && site.turret) {
        // Draw the completed turret
        site.turret.draw(ctx);
        continue;
      }

      const { x, y, progress, building, announced } = site;
      if (!announced && progress <= 0) continue; // Not yet unlocked visually

      ctx.save();

      // ── Scaffolding blueprint (dashed outline) ────────────────────────────
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = building ? '#F9CA24' : '#00D2FF';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.6 + Math.sin(Date.now() / 400) * 0.15;
      ctx.strokeRect(x - 14, y - 14, 28, 28);

      // Blueprint label
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.85;
      ctx.font = 'bold 9px "Courier New"';
      ctx.fillStyle = building ? '#F9CA24' : '#00D2FF';
      ctx.textAlign = 'center';
      ctx.fillText(site.label, x, y - 18);

      // ── Progress bar ──────────────────────────────────────────────────────
      if (building) {
        const barW = 36, barH = 5;
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(x - barW / 2, y + 16, barW, barH);
        ctx.fillStyle = '#00FF88';
        ctx.fillRect(x - barW / 2, y + 16, barW * (progress / 100), barH);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x - barW / 2, y + 16, barW, barH);

        // Builder icon (hard-hat silhouette above site)
        ctx.fillStyle = '#F9CA24';
        ctx.beginPath();
        ctx.arc(x, y - 32, 4, 0, Math.PI * 2);
        ctx.fill();
        // Hard hat
        ctx.fillStyle = '#E67E22';
        ctx.beginPath();
        ctx.ellipse(x, y - 35, 5.5, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Hammering arm animation
        const hamAngle = Math.sin(Date.now() / 180) * 0.6;
        ctx.strokeStyle = '#DDD';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + 2, y - 29);
        ctx.lineTo(x + 7 + Math.cos(hamAngle) * 6, y - 24 + Math.sin(hamAngle) * 6);
        ctx.stroke();
        // Hammer head
        ctx.fillStyle = '#888';
        ctx.fillRect(x + 10 + Math.cos(hamAngle) * 5, y - 23 + Math.sin(hamAngle) * 5, 4, 3);

        // Progress % text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 8px "Courier New"';
        ctx.fillText(`${Math.floor(progress)}%`, x, y + 30);
      }

      ctx.restore();
    }
  }

  drawHouse(ctx) {
    const hx = 575;
    const hw = 130;
    const groundY = CONFIG.SURFACE_Y; // 240
    const f1_y = groundY - 70; // 170 (Floor 1: y 170 to 240, h: 70)
    const f2_y = f1_y - 66;    // 104 (Floor 2: y 104 to 170, h: 66)
    const towerW = 76;
    const towerX = 624;        // Watchtower: x 624 to 700 (w: 76)
    const towerDeckY = 66;     // Watchtower deck at y: 66
    const towerApexY = 18;     // Watchtower canopy apex at y: 18

    const isNightOrDusk = this.dayTime < 6.5 || this.dayTime >= 18.0 || this.waveManager.isHordeActive;

    // =========================================================================
    // 1. GROUND DROP SHADOW UNDER CABIN FOOTPRINT
    // =========================================================================
    ctx.fillStyle = 'rgba(10, 14, 18, 0.52)';
    ctx.beginPath();
    ctx.ellipse(hx + hw * 0.5, groundY + 1, hw * 0.58, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // =========================================================================
    // 2. FLOOR 1 (GROUND FLOOR) - FORTIFIED TIMBER CABIN & BARRICADED ENTRANCE
    // =========================================================================
    const f1_h = groundY - f1_y; // 70
    const f1_logCount = 6;
    const f1_logH = f1_h / f1_logCount; // ~11.66

    // Interlocking rough-hewn timber logs (Heartwood Cedar)
    for (let l = 0; l < f1_logCount; l++) {
      const ly = f1_y + l * f1_logH;
      const isOdd = l % 2 === 1;

      const logGrad = ctx.createLinearGradient(hx, ly, hx, ly + f1_logH);
      logGrad.addColorStop(0, '#6e4a2e');
      logGrad.addColorStop(0.28, '#54371f');
      logGrad.addColorStop(0.82, '#3e2614');
      logGrad.addColorStop(1, '#29180b');

      ctx.fillStyle = logGrad;
      // Protruding saddle-notch log ends
      ctx.fillRect(hx - 5, ly, hw + 10, f1_logH);

      // Top highlighted bevel
      ctx.fillStyle = 'rgba(255, 220, 170, 0.16)';
      ctx.fillRect(hx - 5, ly, hw + 10, 1.4);

      // Deep chinking groove between logs
      ctx.fillStyle = '#1c1006';
      ctx.fillRect(hx - 5, ly + f1_logH - 1.2, hw + 10, 1.2);

      // Concentric growth rings on saddle notches
      ctx.fillStyle = '#7a5433';
      ctx.beginPath();
      ctx.arc(hx - 5, ly + f1_logH * 0.5, f1_logH * 0.42, 0, Math.PI * 2);
      ctx.arc(hx + hw + 5, ly + f1_logH * 0.5, f1_logH * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#321d0d';
      ctx.lineWidth = 0.9;
      ctx.stroke();

      // Wood grain striations
      ctx.strokeStyle = 'rgba(25, 12, 6, 0.35)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(hx + 8, ly + f1_logH * 0.45);
      ctx.lineTo(hx + hw - 8, ly + f1_logH * 0.45);
      if (isOdd) {
        ctx.moveTo(hx + 30, ly + f1_logH * 0.72);
        ctx.lineTo(hx + 90, ly + f1_logH * 0.72);
      }
      ctx.stroke();
    }

    // Heavy wrought-iron corner brackets with carriage bolts
    ctx.fillStyle = '#1e242c';
    ctx.fillRect(hx - 4, f1_y, 7, f1_h);
    ctx.fillRect(hx + hw - 3, f1_y, 7, f1_h);
    ctx.fillStyle = '#718096';
    for (let b = f1_y + 6; b < groundY - 4; b += 14) {
      ctx.fillRect(hx - 3, b, 5, 3);
      ctx.fillRect(hx + hw - 2, b, 5, 3);
    }

    // Floor 1 Observation Window with Warm Radial Glow
    const f1WinX = hx + 16;
    const f1WinY = f1_y + 22;
    const f1WinW = 24;
    const f1WinH = 24;

    if (isNightOrDusk) {
      const winGlow = ctx.createRadialGradient(f1WinX + f1WinW * 0.5, f1WinY + f1WinH * 0.5, 4, f1WinX + f1WinW * 0.5, f1WinY + f1WinH * 0.5, 52);
      winGlow.addColorStop(0, 'rgba(243, 156, 18, 0.60)');
      winGlow.addColorStop(0.35, 'rgba(230, 126, 34, 0.26)');
      winGlow.addColorStop(0.7, 'rgba(211, 84, 0, 0.07)');
      winGlow.addColorStop(1, 'rgba(211, 84, 0, 0)');
      ctx.fillStyle = winGlow;
      ctx.beginPath();
      ctx.arc(f1WinX + f1WinW * 0.5, f1WinY + f1WinH * 0.5, 52, 0, Math.PI * 2);
      ctx.fill();
    }

    // Window frame & projecting sill
    ctx.fillStyle = '#2d180d';
    ctx.fillRect(f1WinX - 3, f1WinY - 3, f1WinW + 6, f1WinH + 8);
    ctx.fillStyle = '#4a2815';
    ctx.fillRect(f1WinX - 5, f1WinY + f1WinH, f1WinW + 10, 4);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(f1WinX - 4, f1WinY + f1WinH + 4, f1WinW + 8, 3);

    // Glowing window pane
    const f1GlassGrad = ctx.createLinearGradient(f1WinX, f1WinY, f1WinX, f1WinY + f1WinH);
    f1GlassGrad.addColorStop(0, '#f39c12');
    f1GlassGrad.addColorStop(0.6, '#f1c40f');
    f1GlassGrad.addColorStop(1, '#e67e22');
    ctx.fillStyle = f1GlassGrad;
    ctx.fillRect(f1WinX, f1WinY, f1WinW, f1WinH);

    // Silhouette inside at night
    if (isNightOrDusk) {
      ctx.fillStyle = 'rgba(28, 18, 12, 0.68)';
      ctx.beginPath();
      ctx.arc(f1WinX + f1WinW * 0.5, f1WinY + 8, 4, 0, Math.PI * 2);
      ctx.fillRect(f1WinX + f1WinW * 0.5 - 4.5, f1WinY + 12, 9, 10);
      ctx.fill();
    }

    // Security iron cross-muntins
    ctx.strokeStyle = '#2c1e14';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(f1WinX + f1WinW * 0.5, f1WinY); ctx.lineTo(f1WinX + f1WinW * 0.5, f1WinY + f1WinH);
    ctx.moveTo(f1WinX, f1WinY + f1WinH * 0.5); ctx.lineTo(f1WinX + f1WinW, f1WinY + f1WinH * 0.5);
    ctx.stroke();

    // Barricaded Bunker Shelter Vault Entrance (Floor 1 Door)
    const doorX = hx + 56;
    const doorY = f1_y + 18;
    const doorW = 30;
    const doorH = 52;

    ctx.fillStyle = '#22140b';
    ctx.fillRect(doorX - 3, doorY - 3, doorW + 6, doorH + 3);

    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(doorX, doorY, doorW, doorH);

    // Perimeter steel rivets & vault handle
    ctx.fillStyle = '#7f8c8d';
    for (let ry = doorY + 4; ry < doorY + doorH; ry += 8) {
      ctx.fillRect(doorX + 2, ry, 2, 2);
      ctx.fillRect(doorX + doorW - 4, ry, 2, 2);
    }
    ctx.fillStyle = '#95a5a6';
    ctx.fillRect(doorX + doorW - 7, doorY + doorH * 0.5 - 2, 5, 5);

    // Stenciled warning id text
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 6px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SHELTER 04', doorX + doorW * 0.5, doorY - 5);

    // Heavy wooden cross barricade planks ('X')
    ctx.strokeStyle = '#d35400';
    ctx.lineWidth = 4.0;
    ctx.beginPath();
    ctx.moveTo(doorX + 2, doorY + 6); ctx.lineTo(doorX + doorW - 2, doorY + doorH - 6);
    ctx.moveTo(doorX + doorW - 2, doorY + 6); ctx.lineTo(doorX + 2, doorY + doorH - 6);
    ctx.moveTo(doorX - 2, doorY + doorH * 0.5); ctx.lineTo(doorX + doorW + 2, doorY + doorH * 0.5);
    ctx.stroke();

    // Steel reinforcement plates & carriage bolts at plank center
    ctx.fillStyle = '#34495e';
    ctx.fillRect(doorX + doorW * 0.5 - 4, doorY + doorH * 0.5 - 4, 8, 8);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(doorX + doorW * 0.5 - 1.5, doorY + doorH * 0.5 - 1.5, 3, 3);

    // Cellar Bulkhead Hatch (Access shaft directly down to subterranean elevator at x: 640)
    const hatchX = doorX - 2;
    const hatchY = groundY - 4;
    const hatchW = doorW + 4;
    ctx.fillStyle = '#1e2024';
    ctx.fillRect(hatchX, hatchY, hatchW, 5);
    ctx.save();
    ctx.beginPath();
    ctx.rect(hatchX, hatchY, hatchW, 5);
    ctx.clip();
    ctx.fillStyle = '#f1c40f';
    for (let hx_s = hatchX - 10; hx_s < hatchX + hatchW + 10; hx_s += 8) {
      ctx.beginPath();
      ctx.moveTo(hx_s, hatchY);
      ctx.lineTo(hx_s + 4, hatchY);
      ctx.lineTo(hx_s + 1, hatchY + 5);
      ctx.lineTo(hx_s - 3, hatchY + 5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.strokeRect(hatchX, hatchY, hatchW, 5);

    // Interior Access Ladder (Floor 1 to Floor 2)
    const ladderX = hx + hw - 18;
    const ladderW = 11;
    ctx.fillStyle = '#3a200e';
    ctx.fillRect(ladderX, f1_y + 2, 2.5, f1_h - 4);
    ctx.fillRect(ladderX + ladderW - 2.5, f1_y + 2, 2.5, f1_h - 4);
    ctx.fillStyle = '#94a3b8';
    for (let ry = f1_y + 8; ry < groundY - 6; ry += 9) {
      ctx.fillRect(ladderX + 2.5, ry, ladderW - 5, 2.2);
    }
    ctx.fillStyle = '#1a1008';
    ctx.fillRect(ladderX - 2, f1_y - 1, ladderW + 4, 3);

    // =========================================================================
    // 3. FLOOR 2 (UPPER FLOOR) - FORTIFIED TIMBER STORY & OBSERVATION GALLERY
    // =========================================================================
    // Inter-Story Heavy Timber Tie Beam & Joists (Floor 1 / Floor 2 separator)
    const joistGrad = ctx.createLinearGradient(hx, f1_y - 4, hx, f1_y + 4);
    joistGrad.addColorStop(0, '#54371f');
    joistGrad.addColorStop(0.5, '#3a2212');
    joistGrad.addColorStop(1, '#201208');
    ctx.fillStyle = joistGrad;
    ctx.fillRect(hx - 6, f1_y - 4, hw + 12, 7);
    ctx.strokeStyle = '#1a0e06';
    ctx.lineWidth = 1.0;
    ctx.strokeRect(hx - 6, f1_y - 4, hw + 12, 7);

    ctx.fillStyle = '#1e242c';
    ctx.fillRect(hx + 28, f1_y - 4, 8, 7);
    ctx.fillRect(hx + 96, f1_y - 4, 8, 7);
    ctx.fillStyle = '#718096';
    ctx.fillRect(hx + 30, f1_y - 2, 4, 3);
    ctx.fillRect(hx + 98, f1_y - 2, 4, 3);

    // Floor 2 Wall Construction: 5 courses of reinforced timber siding
    const f2_h = f1_y - f2_y; // 66
    const f2_logCount = 5;
    const f2_logH = f2_h / f2_logCount; // ~13.2

    for (let l = 0; l < f2_logCount; l++) {
      const ly = f2_y + l * f2_logH;
      const isOdd = l % 2 === 1;

      const f2Grad = ctx.createLinearGradient(hx, ly, hx, ly + f2_logH);
      f2Grad.addColorStop(0, '#664327');
      f2Grad.addColorStop(0.3, '#4e3119');
      f2Grad.addColorStop(0.85, '#38200f');
      f2Grad.addColorStop(1, '#241408');

      ctx.fillStyle = f2Grad;
      ctx.fillRect(hx - 4, ly, hw + 8, f2_logH);

      ctx.fillStyle = 'rgba(255, 215, 160, 0.14)';
      ctx.fillRect(hx - 4, ly, hw + 8, 1.3);
      ctx.fillStyle = '#180d05';
      ctx.fillRect(hx - 4, ly + f2_logH - 1.2, hw + 8, 1.2);

      // Saddle notches on Floor 2 corners
      ctx.fillStyle = '#724b2b';
      ctx.beginPath();
      ctx.arc(hx - 4, ly + f2_logH * 0.5, f2_logH * 0.40, 0, Math.PI * 2);
      ctx.arc(hx + hw + 4, ly + f2_logH * 0.5, f2_logH * 0.40, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2b170a';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      ctx.strokeStyle = 'rgba(20, 10, 4, 0.32)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(hx + 10, ly + f2_logH * 0.5);
      ctx.lineTo(hx + hw - 10, ly + f2_logH * 0.5);
      if (isOdd) {
        ctx.moveTo(hx + 40, ly + f2_logH * 0.75);
        ctx.lineTo(hx + 85, ly + f2_logH * 0.75);
      }
      ctx.stroke();
    }

    // Floor 2 corner iron brackets & bolts
    ctx.fillStyle = '#1e242c';
    ctx.fillRect(hx - 3, f2_y, 6, f2_h);
    ctx.fillRect(hx + hw - 3, f2_y, 6, f2_h);
    ctx.fillStyle = '#718096';
    for (let b = f2_y + 8; b < f1_y - 4; b += 14) {
      ctx.fillRect(hx - 2, b, 4, 3);
      ctx.fillRect(hx + hw - 2, b, 4, 3);
    }

    // Floor 2 Fortified Observation Slit & Warm Ambient Interior Light
    const f2SlitX = hx + 18;
    const f2SlitY = f2_y + 20;
    const f2SlitW = 28;
    const f2SlitH = 16;

    if (isNightOrDusk) {
      const slitGlow = ctx.createRadialGradient(f2SlitX + f2SlitW * 0.5, f2SlitY + f2SlitH * 0.5, 3, f2SlitX + f2SlitW * 0.5, f2SlitY + f2SlitH * 0.5, 46);
      slitGlow.addColorStop(0, 'rgba(243, 156, 18, 0.55)');
      slitGlow.addColorStop(0.4, 'rgba(230, 126, 34, 0.22)');
      slitGlow.addColorStop(0.8, 'rgba(211, 84, 0, 0.05)');
      slitGlow.addColorStop(1, 'rgba(211, 84, 0, 0)');
      ctx.fillStyle = slitGlow;
      ctx.beginPath();
      ctx.arc(f2SlitX + f2SlitW * 0.5, f2SlitY + f2SlitH * 0.5, 46, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#1e242c';
    ctx.fillRect(f2SlitX - 3, f2SlitY - 3, f2SlitW + 6, f2SlitH + 6);
    ctx.fillStyle = '#718096';
    ctx.fillRect(f2SlitX - 2, f2SlitY - 2, 2, 2);
    ctx.fillRect(f2SlitX + f2SlitW, f2SlitY - 2, 2, 2);
    ctx.fillRect(f2SlitX - 2, f2SlitY + f2SlitH, 2, 2);
    ctx.fillRect(f2SlitX + f2SlitW, f2SlitY + f2SlitH, 2, 2);

    const slitGrad = ctx.createLinearGradient(f2SlitX, f2SlitY, f2SlitX, f2SlitY + f2SlitH);
    slitGrad.addColorStop(0, '#f39c12');
    slitGrad.addColorStop(0.6, '#f1c40f');
    slitGrad.addColorStop(1, '#d35400');
    ctx.fillStyle = slitGrad;
    ctx.fillRect(f2SlitX, f2SlitY, f2SlitW, f2SlitH);

    // Sliding ballistic shutter
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(f2SlitX + f2SlitW - 10, f2SlitY, 10, f2SlitH);
    ctx.strokeStyle = '#1a202c';
    ctx.lineWidth = 1;
    ctx.strokeRect(f2SlitX + f2SlitW - 10, f2SlitY, 10, f2SlitH);

    // Floor 2 Sandbag Breastwork Parapet (Fortified Defense Balcony)
    const sbStartX = hx + 58;
    const sbEndX = hx + hw - 14;
    const sbY = f1_y - 20;

    const sandbagColors = ['#8c7457', '#9b8062', '#7b6449', '#a68c6e'];
    const bagW = 14;
    const bagH = 8;
    for (let row = 0; row < 2; row++) {
      const by = sbY + row * (bagH - 2);
      const offset = row % 2 === 1 ? 5 : 0;
      for (let bx = sbStartX + offset; bx < sbEndX; bx += bagW - 2) {
        ctx.fillStyle = sandbagColors[(Math.floor(bx / bagW) + row) % sandbagColors.length];
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(bx, by, bagW, bagH, 3);
        } else {
          ctx.rect(bx, by, bagW, bagH);
        }
        ctx.fill();

        ctx.strokeStyle = 'rgba(50, 36, 20, 0.45)';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(bx + 2, by + bagH * 0.5);
        ctx.lineTo(bx + bagW - 2, by + bagH * 0.5);
        ctx.stroke();

        ctx.fillStyle = '#5a452d';
        ctx.fillRect(bx + 1, by + bagH * 0.35, 2, 3);
      }
    }

    // Floor 2 to Watchtower Access Ladder
    ctx.fillStyle = '#3a200e';
    ctx.fillRect(ladderX, f2_y + 2, 2.5, f2_h - 4);
    ctx.fillRect(ladderX + ladderW - 2.5, f2_y + 2, 2.5, f2_h - 4);
    ctx.fillStyle = '#94a3b8';
    for (let ry = f2_y + 8; ry < f1_y - 4; ry += 9) {
      ctx.fillRect(ladderX + 2.5, ry, ladderW - 5, 2.2);
    }

    // =========================================================================
    // 4. CABIN ROOF & HIGH-EFFICIENCY ROOFTOP SOLAR PANEL ARRAY
    // =========================================================================
    // Pitched timber roof slope over the left shoulder of Floor 2 (x: 566 to 628)
    const roofApexX = 628;
    const roofApexY = 82;
    const roofEavesX = hx - 10; // 565
    const roofEavesY = f2_y + 2; // 106

    // Gable triangular backing
    ctx.fillStyle = '#301b0e';
    ctx.beginPath();
    ctx.moveTo(roofEavesX, roofEavesY);
    ctx.lineTo(roofApexX, roofApexY);
    ctx.lineTo(roofApexX, roofEavesY);
    ctx.closePath();
    ctx.fill();

    // Cedar shingles on left roof slope (4 tiers)
    const roofTiers = 4;
    const shingleColors = ['#5c2e17', '#6e381c', '#4a2412', '#7a3e1f'];
    for (let t = 0; t < roofTiers; t++) {
      const frac1 = t / roofTiers;
      const frac2 = (t + 1) / roofTiers;
      const y1 = roofEavesY - frac1 * (roofEavesY - roofApexY);
      const y2 = roofEavesY - frac2 * (roofEavesY - roofApexY);
      const x1 = roofEavesX + frac1 * (roofApexX - roofEavesX);
      const x2 = roofEavesX + frac2 * (roofApexX - roofEavesX);

      ctx.fillStyle = shingleColors[t % shingleColors.length];
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(roofApexX, y2);
      ctx.lineTo(roofApexX, y1);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#271208';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(roofApexX, y1);
      ctx.stroke();
    }

    // Heavy roof rafter rake beam & overhang
    ctx.strokeStyle = '#251206';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(roofEavesX - 2, roofEavesY + 3);
    ctx.lineTo(roofApexX + 1, roofApexY - 1);
    ctx.stroke();

    // --- HIGH-EFFICIENCY ROOFTOP PHOTOVOLTAIC SOLAR PANEL ARRAY ---
    // Angled along the roof slope: x: 572 to 622, tilted from y: 104 up to y: 86
    const spX1 = 572;
    const spY1 = 104;
    const spX2 = 622;
    const spY2 = 86;

    // Extruded aluminum mounting racking rails & tilt struts
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(spX1, spY1 + 1); ctx.lineTo(spX2, spY2 + 1);
    ctx.moveTo(spX1 + 2, spY1 - 5); ctx.lineTo(spX2 - 2, spY2 - 5);
    ctx.stroke();

    ctx.fillStyle = '#334155';
    ctx.fillRect(spX1 + 4, spY1 - 2, 4, 6);
    ctx.fillRect(spX1 + 24, spY1 - 9, 4, 6);
    ctx.fillRect(spX2 - 8, spY2 - 2, 4, 6);

    // Dual High-Efficiency Photovoltaic Solar Modules (Angled Polygon)
    ctx.save();
    const polyLeft = spX1 + 2;
    const polyRight = spX2 - 2;
    const polyTopY1 = spY1 - 7;
    const polyTopY2 = spY2 - 7;
    const polyBotY1 = spY1 + 1;
    const polyBotY2 = spY2 + 1;

    const solarGrad = ctx.createLinearGradient(polyLeft, polyTopY1, polyRight, polyBotY2);
    solarGrad.addColorStop(0, '#0f172a');
    solarGrad.addColorStop(0.3, '#1e3a8a');
    solarGrad.addColorStop(0.7, '#1d4ed8');
    solarGrad.addColorStop(1, '#0f265c');

    ctx.fillStyle = solarGrad;
    ctx.beginPath();
    ctx.moveTo(polyLeft, polyBotY1);
    ctx.lineTo(polyLeft + 1, polyTopY1);
    ctx.lineTo(polyRight - 1, polyTopY2);
    ctx.lineTo(polyRight, polyBotY2);
    ctx.closePath();
    ctx.fill();

    // Anodized aluminum frame perimeter
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Central frame divider between dual modules
    const midSpX = (polyLeft + polyRight) * 0.5;
    const midSpYTop = (polyTopY1 + polyTopY2) * 0.5;
    const midSpYBot = (polyBotY1 + polyBotY2) * 0.5;
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(midSpX, midSpYTop); ctx.lineTo(midSpX, midSpYBot);
    ctx.stroke();

    // Ultra-fine silver conductive wafer grid lines & busbars
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.45)';
    ctx.lineWidth = 0.6;
    for (let gx = polyLeft + 5; gx < polyRight - 4; gx += 6) {
      if (Math.abs(gx - midSpX) < 3) continue;
      const t = (gx - polyLeft) / (polyRight - polyLeft);
      const gyTop = polyTopY1 + t * (polyTopY2 - polyTopY1);
      const gyBot = polyBotY1 + t * (polyBotY2 - polyBotY1);
      ctx.beginPath();
      ctx.moveTo(gx, gyTop); ctx.lineTo(gx, gyBot);
      ctx.stroke();
    }
    for (let r = 1; r <= 2; r++) {
      const rt = r / 3;
      const ryLeft = polyTopY1 + rt * (polyBotY1 - polyTopY1);
      const ryRight = polyTopY2 + rt * (polyBotY2 - polyTopY2);
      ctx.beginPath();
      ctx.moveTo(polyLeft + 1, ryLeft); ctx.lineTo(polyRight - 1, ryRight);
      ctx.stroke();
    }

    // Dynamic anti-reflective glare sheen
    if (this.dayTime >= 6.0 && this.dayTime < 18.0) {
      const sunFactor = Math.sin((this.dayTime - 6.0) / 12.0 * Math.PI);
      const sheenGrad = ctx.createLinearGradient(polyLeft, polyBotY1, polyRight, polyTopY2);
      sheenGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
      sheenGrad.addColorStop(0.5, `rgba(186, 230, 253, ${0.45 * sunFactor})`);
      sheenGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = sheenGrad;
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(147, 197, 253, 0.10)';
      ctx.fill();
    }
    ctx.restore();

    // Weatherproof junction box & conduit pipe feeding power down to bunker grid
    ctx.fillStyle = '#334155';
    ctx.fillRect(spX2 - 4, spY2 - 3, 5, 5);
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 5px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⚡', spX2 - 1.5, spY2 + 1);

    // Steel conduit pipe running into cabin wall
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(spX2 - 2, spY2 + 2);
    ctx.lineTo(spX2 - 2, f2_y + 12);
    ctx.lineTo(spX2 - 6, f2_y + 16);
    ctx.stroke();

    // =========================================================================
    // 5. STONE MASONRY CHIMNEY & HIGH IRON FLUE PIPE
    // =========================================================================
    const chimX = hx + hw - 32; // 673
    const chimY = 96;
    const chimW = 15;
    const chimH = 74;

    ctx.fillStyle = '#484d56';
    ctx.fillRect(chimX, chimY, chimW, chimH);

    ctx.strokeStyle = '#2a2e36';
    ctx.lineWidth = 1.1;
    for (let my = chimY + 7; my < chimY + chimH; my += 7) {
      ctx.beginPath();
      ctx.moveTo(chimX, my); ctx.lineTo(chimX + chimW, my);
      ctx.stroke();
      const isAlt = (my / 7) % 2 === 0;
      const mid = isAlt ? chimX + 8 : chimX + 4;
      ctx.beginPath();
      ctx.moveTo(mid, my - 7); ctx.lineTo(mid, my);
      ctx.stroke();
    }

    ctx.fillStyle = '#6b7280';
    ctx.fillRect(chimX - 2, chimY - 3, chimW + 4, 4);
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;
    ctx.strokeRect(chimX - 2, chimY - 3, chimW + 4, 4);

    ctx.fillStyle = '#1e2024';
    ctx.fillRect(chimX + 4, chimY - 8, 7, 5);

    // =========================================================================
    // 6. ELEVATED WATCHTOWER / SNIPER TOWER (MENARA)
    // =========================================================================
    const twLeftX = towerX + 2;   // 626
    const twRightX = towerX + towerW - 4; // 696
    const twPostW = 6;

    // Bolted structural steel base shoes anchored into Floor 2 header beam
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(twLeftX - 1, f2_y - 4, twPostW + 2, 5);
    ctx.fillRect(twRightX - 1, f2_y - 4, twPostW + 2, 5);
    ctx.fillStyle = '#718096';
    ctx.fillRect(twLeftX, f2_y - 3, 2, 2);
    ctx.fillRect(twLeftX + twPostW - 2, f2_y - 3, 2, 2);
    ctx.fillRect(twRightX, f2_y - 3, 2, 2);
    ctx.fillRect(twRightX + twPostW - 2, f2_y - 3, 2, 2);

    // Heavy vertical timber corner posts (y: 66 to 104)
    const postGrad = ctx.createLinearGradient(twLeftX, towerDeckY, twLeftX + twPostW, towerDeckY);
    postGrad.addColorStop(0, '#54371f');
    postGrad.addColorStop(0.5, '#3a2212');
    postGrad.addColorStop(1, '#25150a');

    ctx.fillStyle = postGrad;
    ctx.fillRect(twLeftX, towerDeckY, twPostW, f2_y - towerDeckY);
    ctx.fillRect(twRightX, towerDeckY, twPostW, f2_y - towerDeckY);
    ctx.strokeStyle = '#1a0e06';
    ctx.lineWidth = 1.0;
    ctx.strokeRect(twLeftX, towerDeckY, twPostW, f2_y - towerDeckY);
    ctx.strokeRect(twRightX, towerDeckY, twPostW, f2_y - towerDeckY);

    // Diagonal Cross-Bracing Timber Trusses ('X' Bracing)
    ctx.strokeStyle = '#4e2f17';
    ctx.lineWidth = 4.0;
    ctx.beginPath();
    ctx.moveTo(twLeftX + 3, towerDeckY + 4); ctx.lineTo(twRightX + 3, f2_y - 4);
    ctx.moveTo(twRightX + 3, towerDeckY + 4); ctx.lineTo(twLeftX + 3, f2_y - 4);
    ctx.stroke();
    ctx.strokeStyle = '#271408';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Central steel gusset connection plate & rivets
    const gussetMidX = (twLeftX + twRightX + twPostW) * 0.5;
    const gussetMidY = (towerDeckY + f2_y) * 0.5;
    ctx.fillStyle = '#1e242c';
    ctx.fillRect(gussetMidX - 5, gussetMidY - 5, 10, 10);
    ctx.fillStyle = '#718096';
    ctx.fillRect(gussetMidX - 3, gussetMidY - 3, 2, 2);
    ctx.fillRect(gussetMidX + 1, gussetMidY - 3, 2, 2);
    ctx.fillRect(gussetMidX - 3, gussetMidY + 1, 2, 2);
    ctx.fillRect(gussetMidX + 1, gussetMidY + 1, 2, 2);

    // Continuation of interior ladder up to watchtower platform deck hatch
    ctx.fillStyle = '#3a200e';
    ctx.fillRect(ladderX, towerDeckY + 2, 2.5, f2_y - towerDeckY - 4);
    ctx.fillRect(ladderX + ladderW - 2.5, towerDeckY + 2, 2.5, f2_y - towerDeckY - 4);
    ctx.fillStyle = '#94a3b8';
    for (let ry = towerDeckY + 6; ry < f2_y - 4; ry += 9) {
      ctx.fillRect(ladderX + 2.5, ry, ladderW - 5, 2.2);
    }
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(ladderX + ladderW * 0.5, towerDeckY, 6, Math.PI, 0);
    ctx.stroke();

    // --- WATCHTOWER CROW'S NEST / SNIPER PLATFORM (y: 28 to 66) ---
    const deckLeft = towerX - 2;   // 622
    const deckRight = towerX + towerW + 2; // 702
    const deckW = deckRight - deckLeft;

    // Structural corbel support brackets underneath deck
    ctx.fillStyle = '#3a2113';
    ctx.beginPath();
    ctx.moveTo(twLeftX, towerDeckY); ctx.lineTo(deckLeft + 4, towerDeckY); ctx.lineTo(twLeftX, towerDeckY + 8);
    ctx.moveTo(twRightX + twPostW, towerDeckY); ctx.lineTo(deckRight - 4, towerDeckY); ctx.lineTo(twRightX + twPostW, towerDeckY + 8);
    ctx.fill();

    // Platform deck beam
    const deckGrad = ctx.createLinearGradient(deckLeft, towerDeckY, deckLeft, towerDeckY + 5);
    deckGrad.addColorStop(0, '#5a381e');
    deckGrad.addColorStop(0.5, '#422814');
    deckGrad.addColorStop(1, '#231409');
    ctx.fillStyle = deckGrad;
    ctx.fillRect(deckLeft, towerDeckY, deckW, 5);
    ctx.strokeStyle = '#180d05';
    ctx.lineWidth = 1.0;
    ctx.strokeRect(deckLeft, towerDeckY, deckW, 5);

    // 4 Corner canopy posts supporting watchtower roof (y: 26 to 66)
    ctx.fillStyle = '#422814';
    ctx.fillRect(deckLeft + 3, 26, 4, 40);
    ctx.fillRect(deckRight - 7, 26, 4, 40);
    ctx.strokeStyle = '#1a0e06';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(deckLeft + 3, 26, 4, 40);
    ctx.strokeRect(deckRight - 7, 26, 4, 40);

    // --- CHARACTER STAGING IN WATCHTOWER (STATIONED SNIPER SURVIVOR) ---
    const sniperX = 662;
    const sniperY = 56;
    const sniperSurvivor = this.survivors.find(s => !s.isDead && (s.id === 'jackson' || s.id === 's6' || (s.role && s.role.toLowerCase().includes('sniper')) || (s.name && s.name.toLowerCase().includes('jackson'))));
    const sniperAlive = !!sniperSurvivor;

    if (sniperAlive) {
      ctx.save();
      const sniperBob = Math.sin(this.gameTime * 2.2) * 0.7;

      // Tactical survivor callsign badge above helmet
      const displayName = sniperSurvivor ? (sniperSurvivor.name.split(' ')[0] || 'Sniper') : 'Sniper';
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.fillRect(sniperX - 18, sniperY - 21 + sniperBob, 36, 8);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(sniperX - 18, sniperY - 21 + sniperBob, 36, 8);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 6px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`🎯 ${displayName.toUpperCase()}`, sniperX, sniperY - 15 + sniperBob);

      // Camo tactical uniform & chest harness
      ctx.fillStyle = '#2d4a2d';
      ctx.fillRect(sniperX - 7, sniperY - 5 + sniperBob, 14, 11);
      ctx.strokeStyle = '#1b2e1b';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(sniperX - 6, sniperY - 5 + sniperBob); ctx.lineTo(sniperX + 3, sniperY + 6 + sniperBob);
      ctx.stroke();
      ctx.fillStyle = '#1e242c';
      ctx.fillRect(sniperX - 5, sniperY + sniperBob, 4, 4);
      ctx.fillRect(sniperX + 1, sniperY + sniperBob, 4, 4);

      // Sniper Head with tactical boonie hat
      ctx.fillStyle = '#f5d0a9';
      ctx.beginPath();
      ctx.arc(sniperX, sniperY - 9 + sniperBob, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e331e';
      ctx.beginPath();
      ctx.ellipse(sniperX, sniperY - 11 + sniperBob, 6.5, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(sniperX - 4, sniperY - 14 + sniperBob, 8, 4);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(sniperX + 1, sniperY - 9 + sniperBob, 2, 1.2);

      // High-Precision Scoped Sniper Rifle (.50 Cal / DMR)
      ctx.save();
      ctx.translate(sniperX + 2, sniperY - 4 + sniperBob);
      const aimAngle = this.sniperAimAngle || (Math.PI * 0.15);
      ctx.rotate(aimAngle);

      ctx.fillStyle = '#1e242c';
      ctx.fillRect(0, -2, 22, 3.5);
      ctx.fillStyle = '#334155';
      ctx.fillRect(20, -3, 3.5, 5.5);
      ctx.fillStyle = '#3f352b';
      ctx.fillRect(-8, -1.5, 9, 3);
      ctx.fillStyle = '#1e242c';
      ctx.fillRect(-8, 0, 4, 4);

      // Telescopic Optical Scope
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(3, -5.5, 11, 3);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(4, -3, 2, 1.5);
      ctx.fillRect(10, -3, 2, 1.5);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(13, -5, 1.2, 2);

      // Bipod legs
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(15, 1); ctx.lineTo(13, 6);
      ctx.moveTo(15, 1); ctx.lineTo(17, 6);
      ctx.stroke();

      // Tactical Red Laser Targeting Sight (Night, dusk, or horde)
      if (isNightOrDusk) {
        ctx.strokeStyle = 'rgba(255, 35, 35, 0.55)';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(22, 0);
        ctx.lineTo(260, 0);
        ctx.stroke();
        ctx.fillStyle = '#ff2222';
        ctx.fillRect(12, -1, 1.5, 1.5);
      }

      ctx.restore();
      ctx.restore();
    }

    // --- FORTIFIED SANDBAG BREASTWORK PARAPET ---
    const twBagW = 13;
    const twBagH = 7.5;
    for (let row = 0; row < 2; row++) {
      const by = towerDeckY - 14 + row * (twBagH - 1.5);
      const offset = row % 2 === 1 ? 4 : 0;
      for (let bx = deckLeft + 2 + offset; bx < deckRight - 4; bx += twBagW - 2) {
        if (bx > 644 && bx < 676 && row === 0) continue;

        ctx.fillStyle = sandbagColors[(Math.floor(bx / twBagW) + row + 1) % sandbagColors.length];
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(bx, by, twBagW, twBagH, 2.5);
        } else {
          ctx.rect(bx, by, twBagW, twBagH);
        }
        ctx.fill();

        ctx.strokeStyle = 'rgba(40, 28, 16, 0.40)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(bx + 2, by + twBagH * 0.5); ctx.lineTo(bx + twBagW - 2, by + twBagH * 0.5);
        ctx.stroke();
      }
    }

    // Hardened Ballistic Armor Steel Shield with Horizontal Firing Embrasure Slot
    const shieldX = 646;
    const shieldY = 48;
    const shieldW = 32;
    const shieldH = 16;

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(shieldX, shieldY, shieldW, shieldH);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(shieldX, shieldY, shieldW, shieldH);

    // Ballistic shield armor rivets
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(shieldX + 2, shieldY + 2, 2, 2);
    ctx.fillRect(shieldX + shieldW - 4, shieldY + 2, 2, 2);
    ctx.fillRect(shieldX + 2, shieldY + shieldH - 4, 2, 2);
    ctx.fillRect(shieldX + shieldW - 4, shieldY + shieldH - 4, 2, 2);

    // Horizontal Sniper Firing Embrasure Slot
    const embrasureX = shieldX + 5;
    const embrasureY = shieldY + 4;
    const embrasureW = 22;
    const embrasureH = 6;
    ctx.fillStyle = '#0a0d12';
    ctx.fillRect(embrasureX, embrasureY, embrasureW, embrasureH);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(embrasureX, embrasureY, embrasureW, embrasureH);

    // --- WATCHTOWER HIP CANOPY ROOF (y: 18 to 28) ---
    const canopyLeft = deckLeft - 4; // 618
    const canopyRight = deckRight + 4; // 706
    const canopyApexX = (canopyLeft + canopyRight) * 0.5; // 662
    const canopyApexY = towerApexY; // 18
    const canopyEavesY = 28;

    ctx.fillStyle = '#3a200e';
    ctx.beginPath();
    ctx.moveTo(canopyLeft, canopyEavesY);
    ctx.lineTo(canopyApexX, canopyApexY);
    ctx.lineTo(canopyRight, canopyEavesY);
    ctx.closePath();
    ctx.fill();

    // Dark cedar shingles on canopy roof (3 tiers)
    for (let c = 0; c < 3; c++) {
      const t1 = c / 3;
      const t2 = (c + 1) / 3;
      const y1 = canopyEavesY - t1 * (canopyEavesY - canopyApexY);
      const y2 = canopyEavesY - t2 * (canopyEavesY - canopyApexY);
      const x1Left = canopyLeft + t1 * (canopyApexX - canopyLeft);
      const x2Left = canopyLeft + t2 * (canopyApexX - canopyLeft);
      const x1Right = canopyRight - t1 * (canopyRight - canopyApexX);
      const x2Right = canopyRight - t2 * (canopyRight - canopyApexX);

      ctx.fillStyle = shingleColors[c % shingleColors.length];
      ctx.beginPath();
      ctx.moveTo(x1Left, y1);
      ctx.lineTo(x2Left, y2);
      ctx.lineTo(x2Right, y2);
      ctx.lineTo(x1Right, y1);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#201006';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x1Left, y1); ctx.lineTo(x1Right, y1);
      ctx.stroke();
    }

    ctx.strokeStyle = '#201006';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(canopyLeft, canopyEavesY);
    ctx.lineTo(canopyApexX, canopyApexY);
    ctx.lineTo(canopyRight, canopyEavesY);
    ctx.stroke();

    // Steel Lightning Rod & High-Frequency Radio Antenna Mast
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(canopyApexX, canopyApexY);
    ctx.lineTo(canopyApexX, canopyApexY - 10);
    ctx.stroke();

    // Pulsing red nocturnal warning beacon light at antenna tip
    const beaconPulse = Math.sin(this.gameTime * 4.0) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(239, 68, 68, ${0.4 + 0.6 * beaconPulse})`;
    ctx.beginPath();
    ctx.arc(canopyApexX, canopyApexY - 10, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // =========================================================================
    // 7. ROOF SEARCHLIGHT MOUNTING PEDESTALS & GIMBAL HARDWARE
    // =========================================================================
    // Left Searchlight Mount (on 2nd-floor roofline pedestal)
    const slLeftX = this.searchlights.left.x; // 586
    const slLeftY = this.searchlights.left.y; // 94
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(slLeftX - 5, slLeftY + 1, 10, 6);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(slLeftX - 5, slLeftY + 1, 10, 6);

    // Right Searchlight Mount (on Watchtower gimbal mount bracket)
    const slRightX = this.searchlights.right.x; // 696
    const slRightY = this.searchlights.right.y; // 46
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(slRightX - 5, slRightY + 1, 10, 6);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(slRightX - 5, slRightY + 1, 10, 6);
    ctx.fillStyle = '#334155';
    ctx.fillRect(slRightX - 7, slRightY + 4, 3, 3);

    // =========================================================================
    // 8. ADAPTED CABIN HEALTH BAR (ABOVE WATCHTOWER ROOFLINE)
    // =========================================================================
    const hpRatio = Math.max(0, this.houseHp / this.houseMaxHp);
    const barW = 104;
    const barH = 6;
    const barX = hx + 13; // 588
    const barY = 14;      // Above roofline

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
    ctx.fillText(`CABIN: ${Math.round(this.houseHp)}/${this.houseMaxHp} HP`, hx + hw * 0.5, barY - 4);
  }

  // Update watchtower sniper targeting, tracking, and autonomous precision shots
  updateSniper(dt) {
    const sniper = this.survivors ? this.survivors.find(s => !s.isDead && (s.id === 'jackson' || s.id === 's6' || (s.role && s.role.toLowerCase().includes('sniper')) || (s.name && s.name.toLowerCase().includes('jackson')))) : null;
    if (!sniper) return;

    const sniperX = 662;
    const sniperY = 56;
    const range = 680; // Enhanced: 680px BMG effective range

    // ── Priority Target Selection ──────────────────────────────────────────
    // Priority 1: Goliath Brutes (archetypeIndex 4 / type 'brute')
    // Priority 2: Acid Spitters (archetypeIndex 3 / type 'spitter')
    // Priority 3: Any zombie within 140px of an active refugee
    // Priority 4: Nearest zombie in range
    let target = null;

    const inRange = (z) => z.hp > 0 && Math.hypot(z.x - sniperX, z.y - sniperY) <= range;

    // P1: Brute
    const brutes = this.zombies.filter(z => inRange(z) && (z.type === 'brute' || z.archetypeIndex === 4));
    if (brutes.length > 0) target = brutes.reduce((a, b) => a.hp < b.hp ? a : b); // lowest HP brute first

    // P2: Spitter
    if (!target) {
      const spitters = this.zombies.filter(z => inRange(z) && (z.type === 'spitter' || z.archetypeIndex === 3));
      if (spitters.length > 0) target = spitters[0];
    }

    // P3: Refugee chasers
    if (!target && this.refugees && this.refugees.length > 0) {
      for (const ref of this.refugees) {
        if (ref.isDead || ref.isRescued) continue;
        const chaser = this.zombies.find(z => inRange(z) && Math.hypot(z.x - ref.x, z.y - ref.y) < 160);
        if (chaser) { target = chaser; break; }
      }
    }

    // P4: Nearest in range
    if (!target) {
      let minD = range;
      for (const z of this.zombies) {
        if (!inRange(z)) continue;
        const d = Math.hypot(z.x - sniperX, z.y - sniperY);
        if (d < minD) { minD = d; target = z; }
      }
    }

    this.sniperTarget = target;

    // ── Aim tracking ────────────────────────────────────────────────────────
    if (target) {
      const headY = target.y - (target.size || 14) * 0.7;
      const desiredAngle = Math.atan2(headY - sniperY, target.x - sniperX);
      const diff = ((desiredAngle - this.sniperAimAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      this.sniperAimAngle += diff * Math.min(dt * 4.5, 1);
    } else {
      // Perimeter sweep when idle
      this.sniperAimAngle = Math.sin(this.gameTime * 0.75) * 0.28 + Math.PI * 0.15;
    }

    // ── Firing logic ────────────────────────────────────────────────────────
    this.sniperTimer = (this.sniperTimer || 0) + dt;
    const efficiency = sniper.getEfficiency ? sniper.getEfficiency() : 1.0;
    const fireInterval = Math.max(1.2, 1.8 / efficiency); // 1.8s base, faster at higher level

    if (target && this.sniperTimer >= fireInterval && this.resources.ammo >= 1) {
      this.sniperTimer = 0;
      this.resources.ammo = Math.max(0, this.resources.ammo - 1);

      // ── Headshot calculation ────────────────────────────────────────────
      const headshot = Math.random() < (0.35 + (sniper.level || 1) * 0.06); // 35-65% headshot chance
      let baseDmg = 180 + Math.random() * 120; // 180–300 base
      if (headshot) baseDmg *= 1.5 + Math.random() * 0.3; // 450+ crit
      const damage = baseDmg * efficiency;

      target.hp = Math.max(0, target.hp - damage);

      // ── Supersonic tracer VFX ────────────────────────────────────────────
      const muzzleX = sniperX + Math.cos(this.sniperAimAngle) * 26;
      const muzzleY = sniperY + Math.sin(this.sniperAimAngle) * 26;
      if (this.particles && this.particles.spawnSniperTracer) {
        this.particles.spawnSniperTracer(muzzleX, muzzleY, target.x, target.y, headshot);
      } else {
        // Fallback sparks
        if (this.particles) {
          this.particles.spawnSparks(muzzleX, muzzleY, 14, headshot ? '#FFD700' : '#ffeaa7');
          this.particles.spawnSmokePuff(muzzleX, muzzleY, 5, 'rgba(200,200,200,0.5)');
        }
      }

      // ── Audio ─────────────────────────────────────────────────────────────
      if (window.soundSystem && window.soundSystem.playSniperShot) {
        window.soundSystem.playSniperShot();
      } else if (window.soundSystem && window.soundSystem.playGunshot) {
        window.soundSystem.playGunshot();
      }

      // ── Kill handling ─────────────────────────────────────────────────────
      if (target.hp <= 0) {
        if (target.die) target.die();
        this.stats.zombiesKilled = (this.stats.zombiesKilled || 0) + 1;
        sniper.addXP && sniper.addXP(headshot ? 80 : 60);
      } else {
        sniper.addXP && sniper.addXP(15);
      }
    }
  }

  // ── Autonomous Construction System ─────────────────────────────────────────
  // Carlos (Builder) or any available engineer auto-builds Turrets 3 & 4
  updateConstruction(dt) {
    if (!this.constructionSites) return;
    this.constructionTimer = (this.constructionTimer || 0) + dt;

    for (const site of this.constructionSites) {
      if (site.built) continue;

      const hasMetal = this.resources.metal >= site.requiredMetal;
      const hasGunpowder = this.resources.gunpowder >= site.requiredGunpowder;

      // ── Announce blueprint when resources become available ────────────────
      if (hasMetal && hasGunpowder && !site.announced) {
        site.announced = true;
        this.addNotification(`📐 Blueprint ready: ${site.label}! Resources sufficient — assigning builder...`, '#00D2FF', 4);
      }

      // ── Assign a builder survivor ─────────────────────────────────────────
      if (hasMetal && hasGunpowder && !site.building) {
        // Prefer Carlos (builder specialty), then any idle engineer
        const builder = this.survivors.find(s =>
          !s.isDead && !s.isBusy &&
          (s.id === 'carlos' || s.specialty === 'builder' || s.role === 'engineer' || s.role === 'Engineer')
        ) || this.survivors.find(s => !s.isDead && !s.isBusy && s.role !== 'sniper');

        if (builder) {
          site.building = true;
          site.builder = builder;
          site.progress = 0;
          builder.isBusy = true;
          builder.constructionTarget = site;
          // Deduct resources
          this.resources.metal = Math.max(0, this.resources.metal - site.requiredMetal);
          this.resources.gunpowder = Math.max(0, this.resources.gunpowder - site.requiredGunpowder);
          this.addNotification(`🔨 ${builder.name} is building ${site.label}!`, '#F9CA24', 3.5);
        }
      }

      // ── Progress the build ───────────────────────────────────────────────
      if (site.building && site.builder && !site.builder.isDead) {
        const efficiency = site.builder.getEfficiency ? site.builder.getEfficiency() : 1.0;
        site.progress += dt * efficiency * 8; // ~12 seconds at base rate

        // Hammering sound & sparks at site while building
        if (this.constructionTimer > 0.55) {
          this.constructionTimer = 0;
          if (window.soundSystem && window.soundSystem.playConstruction) {
            window.soundSystem.playConstruction();
          }
          if (this.particles) {
            this.particles.spawnSparks(site.x, site.y, 6, '#FFD700');
            this.particles.spawnSparks(site.x, site.y, 4, '#FF8C00');
          }
        }

        // ── Completion ─────────────────────────────────────────────────────
        if (site.progress >= 100) {
          site.progress = 100;
          site.built = true;
          site.building = false;
          if (site.builder) {
            site.builder.isBusy = false;
            site.builder.constructionTarget = null;
            site.builder.addXP && site.builder.addXP(120);
          }
          site.builder = null;

          // Instantiate new Turret at roof position
          site.turret = new Turret({
            x: site.x, y: site.y,
            side: site.id === 'turret3' ? 'left' : 'right',
            label: site.label
          });

          // Completion VFX
          if (this.particles) {
            for (let i = 0; i < 20; i++) {
              const a = (i / 20) * Math.PI * 2;
              this.particles.particles.push({
                x: site.x + Math.cos(a) * 18,
                y: site.y + Math.sin(a) * 18,
                vx: Math.cos(a) * 2.5,
                vy: Math.sin(a) * 2.5 - 2,
                life: 0.9, maxLife: 0.9,
                size: 3,
                color: '#FFD700',
                gravity: 80,
                type: 'spark'
              });
            }
          }

          // Completion chime
          if (window.soundSystem) {
            if (window.soundSystem.playElevatorDing) window.soundSystem.playElevatorDing();
            setTimeout(() => {
              if (window.soundSystem && window.soundSystem.playElevatorDing) window.soundSystem.playElevatorDing();
            }, 220);
          }

          this.addNotification(`✅ ${site.label} ONLINE! +1 automated defense turret.`, '#00FF88', 5);
        }
      } else if (site.building && (!site.builder || site.builder.isDead)) {
        // Builder died — suspend build
        site.building = false;
        site.builder = null;
        this.addNotification(`⚠️ ${site.label} construction suspended — builder unavailable.`, '#FF4444', 3);
      }
    }
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

    // Priority: Samantha (Logistics Porter), then Armory worker, then Airlock, then Workshop, then any worker
    let runner = candidates.find(s => (s.name || '').toLowerCase().includes('samantha') || (s.role || '').toLowerCase().includes('porter'));
    if (!runner) runner = candidates.find(s => s.assignedRoom === 'armory');
    if (!runner) runner = candidates.find(s => s.assignedRoom === 'airlock');
    if (!runner) runner = candidates.find(s => s.assignedRoom === 'workshop');
    if (!runner) runner = candidates[0];

    if (runner) {
      runner.startAmmoDelivery(needyTurret);
      this.addNotification(`📦 Ammo low! ${runner.name} dispatched with crate for ${needyTurret.side.toUpperCase()} Turret!`, 'info');
    }
  }

  // Update Bunker Power Grid: Solar Roof Generation, Generator Mechanics, Battery Buffer, and Autonomous AI
  updatePowerGrid(dt) {
    // 1. Calculate Connected Bunker Load (all 16 rooms + sentry turrets)
    let totalConnectedLoad = 0;
    for (const room of this.rooms) {
      totalConnectedLoad += room.powerCost;
    }
    // Turrets active sensor grid and power draw
    totalConnectedLoad += 4;
    this.bunkerPowerDemand = totalConnectedLoad;

    // Converted to per-second consumption rate (scaled baseline bunker load)
    const baseConsumptionRate = totalConnectedLoad * 0.15; // ~6.45 kW/s

    // 2. Solar Photovoltaic Cabin Roof Array (+15 kW during daylight 06:00 to 18:00)
    const isDaylight = this.dayTime >= (CONFIG.SOLAR_DAY_START || 6.0) && this.dayTime < (CONFIG.SOLAR_DAY_END || 18.0);
    let solarKw = 0;
    if (isDaylight) {
      // Passive clean energy (+15 kW during daylight 06:00 to 18:00)
      const dayProgress = (this.dayTime - 6.0) / 12.0;
      const sunAngle = Math.sin(dayProgress * Math.PI); // 0 at dawn/dusk, 1.0 at noon
      // Nominal avg 15.0 kW (+/- 1.5 kW curve)
      solarKw = (CONFIG.SOLAR_POWER_OUTPUT || 15.0) * (0.90 + 0.20 * sunAngle);
    }
    this.solarOutput = solarKw;

    // 3. Diesel Generator Production & High-Efficiency Fuel Burn
    const genWorkers = this.survivors.filter(s => s.assignedRoom === 'generator' && !s.isDead);
    const hasFuel = this.resources.fuel > 0.001;
    let genKw = 0;

    if (hasFuel && genWorkers.length > 0) {
      let workerEffSum = 0;
      for (const w of genWorkers) {
        const eff = w.getEfficiency ? w.getEfficiency() : 1.0;
        const nameL = (w.name || '').toLowerCase();
        const roleL = (w.role || '').toLowerCase();
        const isMechanic = w.specialty === 'generator' || w.skill === 'Mechanic' || nameL.includes('elena') || roleL.includes('engineer');
        workerEffSum += eff * (isMechanic ? 1.30 : 1.0);
      }

      // Base generator yield: 30 kW nominal (up to 45 kW with skilled engineer)
      const baseYield = CONFIG.GENERATOR_BASE_OUTPUT || 30.0;
      genKw = baseYield * (0.75 + 0.25 * workerEffSum);

      // High fuel efficiency: 0.04 fuel/s (750 kW·s of clean power per fuel unit)
      const fuelCostRate = CONFIG.GENERATOR_FUEL_RATE || 0.04;
      this.resources.fuel = Math.max(0, this.resources.fuel - fuelCostRate * dt);
    }
    this.generatorOutput = genKw;

    // 4. Net Energy Balance & Battery Storage Buffer
    const totalGenRate = solarKw + genKw;
    const netFlow = totalGenRate - baseConsumptionRate;
    this.netPowerFlow = netFlow;

    if (netFlow >= 0) {
      // Recharging 200 kW battery storage buffer
      this.resources.power = Math.min(CONFIG.RESOURCE_CAPS.power, this.resources.power + netFlow * dt);
    } else {
      // Discharging battery buffer
      this.resources.power = Math.max(0, this.resources.power + netFlow * dt);
    }

    // 5. Smart Autonomous Power Grid & Fueling AI (<40% threshold)
    this.checkAutonomousPowerGrid(dt);
  }

  // Smart Autonomous Fueling & Generator Servicing AI
  checkAutonomousPowerGrid(dt) {
    const powerCap = CONFIG.RESOURCE_CAPS.power || 200;
    const powerThreshold = powerCap * (CONFIG.POWER_AUTONOMOUS_THRESHOLD || 0.40); // 80 kW (40%)
    const powerRestored = powerCap * (CONFIG.POWER_RESTORED_THRESHOLD || 0.85);   // 170 kW (85%)

    // Check if any survivor is currently on an autonomous generator maintenance task
    const activeMaintainer = this.survivors.find(s => s.generatorMaintenanceTask && !s.isDead);

    // When battery is charged back to safe buffer (>= 85%), return maintainer to their original duty
    if (activeMaintainer && this.resources.power >= powerRestored) {
      const originalRoom = activeMaintainer.generatorMaintenanceTask.originalRoom || 'workshop';
      activeMaintainer.generatorMaintenanceTask = null;
      activeMaintainer.assignTo(originalRoom, false);
      activeMaintainer.say(`⚡ Power grid secure (${Math.round(this.resources.power)} kW)! Returning to post.`, 2.5);
      this.addNotification(`⚡ Power Grid Restored: Battery charged to ${Math.round(this.resources.power)} kW. ${activeMaintainer.name} returned to ${originalRoom.toUpperCase()}.`, 'success');
      return;
    }

    // If power is healthy (>= 40%), no emergency dispatch needed
    if (this.resources.power >= powerThreshold) {
      return;
    }

    // Power is LOW (< 40%)!
    // If generator already has an active, working survivor assigned and fuel is available, let them work
    const workingGenCrew = this.survivors.filter(s => s.assignedRoom === 'generator' && !s.isDead && s.status === 'working');
    if (workingGenCrew.length > 0 && this.resources.fuel > 0.5) {
      return;
    }

    // Cooldown check (prevent repeated dispatch notifications)
    if (this.gameTime - (this.lastAutonomousPowerDispatch || 0) < 6.0) {
      return;
    }

    // Find best eligible candidate:
    // Exclude dead, resting, or those currently on critical ammo runs
    const candidates = this.survivors.filter(s => 
      !s.isDead && 
      !s.ammoDeliveryTask && 
      s.assignedRoom !== 'generator' && 
      s.fatigue < CONFIG.FATIGUE_REST_THRESHOLD
    );

    if (candidates.length === 0) return;

    // Priority 1: Combat Engineer Elena Vance or mechanic specialist
    let runner = candidates.find(s => {
      const n = (s.name || '').toLowerCase();
      const r = (s.role || '').toLowerCase();
      const sk = (s.skill || '').toLowerCase();
      return n.includes('elena') || r.includes('engineer') || r.includes('mechanic') || sk.includes('mechanic') || s.specialty === 'workshop';
    });

    // Priority 2: Non-vital station crew (Airlock, Quarters, Workshop)
    if (!runner) {
      runner = candidates.find(s => s.assignedRoom === 'airlock' || s.assignedRoom.startsWith('quarters') || s.assignedRoom === 'workshop');
    }

    // Priority 3: Any available survivor
    if (!runner) {
      runner = candidates[0];
    }

    if (runner) {
      this.lastAutonomousPowerDispatch = this.gameTime;
      runner.generatorMaintenanceTask = {
        originalRoom: runner.assignedRoom,
        dispatchedAt: this.gameTime
      };
      runner.assignTo('generator', true);
      runner.say(`⚡ Power critical (${Math.round(this.resources.power)} kW)! Autonomous fueling & servicing generator!`, 3.0);

      this.addNotification(`⚡ Autonomous Power Grid AI: Power < 40%! ${runner.name} dispatched to fuel & service Diesel Generator!`, 'warning');
      this.particles.spawnSparks(runner.x, runner.y - 10, 16, '#00f3ff');

      const genRoom = this.getRoom('generator');
      if (genRoom) {
        this.particles.addFloatingText("⚡ AUTONOMOUS POWER RESTORE", genRoom.x + genRoom.width / 2 - 40, genRoom.y + 25, '#f39c12');
      }
    }
  }

  // Render High-Efficiency Cabin Roof Photovoltaic Solar Array (+15 kW Daylight Clean Energy)
  drawSolarRoofArray(ctx, hx, hy, apexX, apexY) {
    const isDaylight = this.dayTime >= (CONFIG.SOLAR_DAY_START || 6.0) && this.dayTime < (CONFIG.SOLAR_DAY_END || 18.0);
    const now = performance.now();

    ctx.save();

    // 1. Structural Mounting Brackets on Left Roof Pitch
    // Left roof slope extends from (hx - 14, hy) [561, 160] to (apexX, apexY) [640, 112]
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    // Lower structural mounting rail
    ctx.moveTo(hx + 14, hy - 18);
    ctx.lineTo(hx + 56, hy - 43);
    // Upper structural mounting rail
    ctx.moveTo(hx + 17, hy - 25);
    ctx.lineTo(hx + 58, hy - 49);
    ctx.stroke();

    // Fastener stanchions connecting rails to rafters
    ctx.fillStyle = '#64748b';
    ctx.fillRect(hx + 18, hy - 20, 3, 5);
    ctx.fillRect(hx + 36, hy - 32, 3, 5);
    ctx.fillRect(hx + 52, hy - 44, 3, 5);

    // 2. Dual Angled Solar Photovoltaic Modules
    // Module 1 (Lower Left)
    const p1 = [
      { x: hx + 16, y: hy - 20 },
      { x: hx + 34, y: hy - 31 },
      { x: hx + 36, y: hy - 44 },
      { x: hx + 18, y: hy - 33 }
    ];

    // Module 2 (Upper Right towards apex)
    const p2 = [
      { x: hx + 37, y: hy - 33 },
      { x: hx + 55, y: hy - 44 },
      { x: hx + 57, y: hy - 57 },
      { x: hx + 39, y: hy - 46 }
    ];

    const panels = [p1, p2];

    for (let i = 0; i < panels.length; i++) {
      const p = panels[i];

      // Outer Aluminum Anodized Bevel Frame
      ctx.beginPath();
      ctx.moveTo(p[0].x, p[0].y);
      ctx.lineTo(p[1].x, p[1].y);
      ctx.lineTo(p[2].x, p[2].y);
      ctx.lineTo(p[3].x, p[3].y);
      ctx.closePath();
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Deep Monocrystalline Silicon Photovoltaic Wafer Cells
      ctx.beginPath();
      ctx.moveTo(p[0].x + 1.5, p[0].y - 1);
      ctx.lineTo(p[1].x - 1.5, p[1].y - 1);
      ctx.lineTo(p[2].x - 1.5, p[2].y + 1);
      ctx.lineTo(p[3].x + 1.5, p[3].y + 1);
      ctx.closePath();

      // Midnight Navy / Indigo Silicon Gradient
      const grad = ctx.createLinearGradient(p[0].x, p[0].y, p[2].x, p[2].y);
      if (isDaylight) {
        grad.addColorStop(0, '#0f274a');
        grad.addColorStop(0.5, '#163863');
        grad.addColorStop(1, '#0b1d38');
      } else {
        grad.addColorStop(0, '#091322');
        grad.addColorStop(1, '#050b14');
      }
      ctx.fillStyle = grad;
      ctx.fill();

      // Fine Silver Conductor Busbars & String Ribbons
      ctx.strokeStyle = isDaylight ? 'rgba(56, 189, 248, 0.45)' : 'rgba(56, 189, 248, 0.15)';
      ctx.lineWidth = 0.8;
      // Longitudinal string ribbon
      ctx.beginPath();
      ctx.moveTo((p[0].x + p[3].x) * 0.5, (p[0].y + p[3].y) * 0.5);
      ctx.lineTo((p[1].x + p[2].x) * 0.5, (p[1].y + p[2].y) * 0.5);
      ctx.stroke();

      // Transverse grid conductors
      for (let g = 1; g <= 2; g++) {
        const t = g / 3;
        const gx1 = p[0].x + t * (p[1].x - p[0].x);
        const gy1 = p[0].y + t * (p[1].y - p[0].y);
        const gx2 = p[3].x + t * (p[2].x - p[3].x);
        const gy2 = p[3].y + t * (p[2].y - p[3].y);
        ctx.beginPath();
        ctx.moveTo(gx1, gy1);
        ctx.lineTo(gx2, gy2);
        ctx.stroke();
      }

      // Specular Anti-Reflective Glass Sheen
      if (isDaylight) {
        const sheen = ctx.createLinearGradient(p[3].x, p[3].y, p[1].x, p[1].y);
        sheen.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
        sheen.addColorStop(0.35, 'rgba(125, 211, 252, 0.18)');
        sheen.addColorStop(0.7, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = sheen;
        ctx.beginPath();
        ctx.moveTo(p[0].x + 1.5, p[0].y - 1);
        ctx.lineTo(p[1].x - 1.5, p[1].y - 1);
        ctx.lineTo(p[2].x - 1.5, p[2].y + 1);
        ctx.lineTo(p[3].x + 1.5, p[3].y + 1);
        ctx.closePath();
        ctx.fill();
      }
    }

    // 3. Micro-Inverter Junction Box & High-Voltage DC Conduit
    const jBoxX = hx + 13;
    const jBoxY = hy - 17;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(jBoxX, jBoxY, 5, 5);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(jBoxX, jBoxY, 5, 5);

    // High-voltage flexible armored conduit running to cabin eaves
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(jBoxX + 2, jBoxY + 5);
    ctx.lineTo(jBoxX + 2, hy - 4);
    ctx.lineTo(hx + 8, hy);
    ctx.stroke();

    // 4. Micro-Inverter Status LED Indicator
    if (isDaylight) {
      // Pulsing bright emerald green LED when generating +15 kW
      const pulse = 0.75 + 0.25 * Math.sin(now / 150);
      ctx.fillStyle = '#10b981';
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(jBoxX + 2.5, jBoxY + 2.5, 1.6 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Sun glint sparkle on high noon
      if (this.dayTime >= 10.5 && this.dayTime <= 13.5) {
        const glintAlpha = 0.4 + 0.6 * Math.sin(now / 180);
        ctx.fillStyle = `rgba(255, 255, 255, ${glintAlpha})`;
        ctx.beginPath();
        ctx.arc(hx + 48, hy - 47, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Standby dark slate LED at night
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(jBoxX + 2.5, jBoxY + 2.5, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
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
