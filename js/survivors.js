// Survivor Inhabitants Management System with Autonomous Needs, XP Progression, and Ammo Logistics
class Survivor {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.role = data.role;
    this.skill = data.skill;
    this.avatar = data.avatar;
    this.specialty = data.specialty || 'armory';

    this.hp = data.hp || 100;
    this.maxHp = data.maxHp || 100;
    this.hunger = data.hunger || 90;
    this.thirst = data.thirst || 90;
    this.fatigue = data.fatigue || 0;
    this.morale = data.morale || 90;

    // Progression & Skill Levels (1 to 5)
    this.level = data.level || 1;
    this.xp = data.xp || 0;
    this.xpToNext = this.getXpNeeded(this.level);

    this.assignedRoom = data.assignedRoom || 'armory';
    this.status = 'working'; // 'working', 'seeking_food', 'seeking_water', 'resting', 'delivering_ammo'

    // Visual & kinematic position
    this.x = 640;
    this.y = 350;
    this.targetX = 640;
    this.targetY = 350;
    this.speed = 52; // px/s
    this.walkCycle = Math.random() * 10;
    this.isDead = false;

    // Subsystem flags
    this.inElevator = false;
    this.carryingAmmo = false;
    this.ammoDeliveryTask = null; // Logistics runner state machine
    this.needState = null;        // 'seeking_food', 'seeking_water', 'resting'
    this.needTimer = 0;

    // Speech / status bubble
    this.speechText = '';
    this.speechTimer = 0;

    // Advanced visual and animation states
    this.facing = 1; // 1 = right, -1 = left
    this.isMoving = false;
    this.idleTime = Math.random() * 10;
    this.craftSparkTimer = 0;

    this.initPosition();
  }

  getXpNeeded(lvl) {
    const table = [100, 250, 450, 700, 1000];
    return table[Math.min(table.length - 1, lvl - 1)] || 1000;
  }

  getEfficiency() {
    // Level 1: 1.0x, Level 2: 1.25x, Level 3: 1.50x, Level 4: 1.75x, Level 5: 2.0x (+100%)
    return 1.0 + (this.level - 1) * 0.25;
  }

  addXP(amount) {
    if (this.isDead || this.level >= CONFIG.SURVIVOR_MAX_LEVEL) return;
    this.xp += amount;
    if (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = this.getXpNeeded(this.level);
      const title = CONFIG.SURVIVOR_LEVEL_TITLES[this.level - 1] || 'Veteran';
      this.say(`⭐ PROMOTED TO LVL ${this.level}!`, 3.5);
      if (window.gameEngine) {
        window.gameEngine.particles.spawnSparks(this.x, this.y - 20, 25, '#ffd700');
        window.gameEngine.particles.addFloatingText(`⭐ LEVEL ${this.level} ${title.toUpperCase()}!`, this.x - 30, this.y - 35, '#ffd700');
        window.gameEngine.addNotification(`⭐ ${this.name} reached Level ${this.level} ${title} ${this.role}! (+${(this.level - 1) * 25}% efficiency)`, 'success');
      }
      if (window.soundSystem) window.soundSystem.playBeep(true);
    }
  }

  initPosition() {
    const room = window.gameEngine ? window.gameEngine.getRoom(this.assignedRoom) : null;
    if (room) {
      this.x = room.x + 20 + Math.random() * (room.width - 40);
      this.y = room.y + room.height - 12;
      this.targetX = this.x;
      this.targetY = this.y;
    }
  }

  say(text, duration = 3) {
    this.speechText = text;
    this.speechTimer = duration;
  }

  assignTo(roomId) {
    this.assignedRoom = roomId;
    const room = window.gameEngine.getRoom(roomId);
    if (room) {
      this.targetX = room.x + 20 + Math.random() * (room.width - 40);
      this.targetY = room.y + room.height - 12;
      this.say(`Assigned to ${room.name}!`, 2);
    }
  }

  // Autonomous Ammo Logistics Runner Task
  startAmmoDelivery(turret) {
    if (this.ammoDeliveryTask || this.isDead) return false;
    this.ammoDeliveryTask = {
      turret: turret,
      phase: 'to_armory',
      targetFloor: 1
    };
    this.status = 'delivering_ammo';
    this.needState = null;
    this.say(`Turret low! Fetching ammo crate!`, 2.5);
    return true;
  }

  abortAmmoDelivery() {
    if (this.ammoDeliveryTask) {
      if (this.inElevator && window.gameEngine && window.gameEngine.elevator) {
        window.gameEngine.elevator.exit(this);
      }
      this.ammoDeliveryTask = null;
      this.carryingAmmo = false;
      this.status = 'working';
      this.assignTo(this.assignedRoom);
    }
  }

  update(dt) {
    if (this.isDead) return;

    this.idleTime = (this.idleTime || 0) + dt;

    if (this.speechTimer > 0) {
      this.speechTimer -= dt;
      if (this.speechTimer <= 0) this.speechText = '';
    }

    const engine = window.gameEngine;
    const res = engine.resources;
    const elevator = engine.elevator;

    // Elena (Engineer): Sparks emitting when crafting / repairing in workshop
    const nameLower = (this.name || '').toLowerCase();
    const isEngineer = nameLower.includes('elena') || this.specialty === 'workshop' || this.assignedRoom === 'workshop';
    if (isEngineer && this.status === 'working' && !this.inElevator) {
      this.craftSparkTimer = (this.craftSparkTimer || 0) + dt;
      if (this.craftSparkTimer >= 0.32) {
        this.craftSparkTimer = 0;
        if (engine && engine.particles && Math.random() < 0.65) {
          const sparkDir = this.facing === -1 ? -1 : 1;
          engine.particles.spawnSparks(this.x + sparkDir * 8, this.y - 12, 3, '#ffd700');
        }
      }
    }

    // 1. Natural Needs Depletion
    this.thirst -= CONFIG.SURVIVOR_THIRST_RATE * dt;
    this.hunger -= CONFIG.SURVIVOR_HUNGER_RATE * dt;

    if (this.status === 'resting' || (this.assignedRoom && this.assignedRoom.startsWith('quarters'))) {
      this.fatigue = Math.max(0, this.fatigue - dt * 12.0);
      if (this.hp < this.maxHp) {
        this.hp = Math.min(this.maxHp, this.hp + dt * 4.0);
      }
    } else {
      this.fatigue = Math.min(100, this.fatigue + CONFIG.SURVIVOR_FATIGUE_RATE * dt);
    }

    // Starvation / Dehydration penalties
    if (this.hunger <= 0 || this.thirst <= 0) {
      this.hp -= dt * 2.5;
      if (Math.random() < 0.03 && !this.speechText) {
        this.say(this.thirst <= 0 ? "Need water desperately!" : "Starving!", 2);
      }
    }

    // Death check
    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
      if (this.inElevator) elevator.exit(this);
      engine.addNotification(`💀 Survivor ${this.name} perished!`, 'danger');
      engine.particles.spawnBlood(this.x, this.y, 18, '#881111');
      return;
    }

    // 2. Ammo Delivery Task Execution (Highest priority autonomous job)
    if (this.ammoDeliveryTask) {
      this.updateAmmoDelivery(dt);
      this.performMovement(dt);
      return;
    }

    // 3. Autonomous Needs Routing
    this.updateAutonomousNeeds(dt);

    // 4. Movement towards target
    this.performMovement(dt);
  }

  updateAmmoDelivery(dt) {
    const engine = window.gameEngine;
    const elevator = engine.elevator;
    const task = this.ammoDeliveryTask;
    const turret = task.turret;
    const armory = engine.getRoom('armory');

    if (!armory) {
      this.abortAmmoDelivery();
      return;
    }

    const armoryWalkY = elevator.getFloorWalkY(1);

    if (task.phase === 'to_armory') {
      // Walk to armory crafting bench
      this.targetX = armory.x + armory.width / 2;
      this.targetY = armoryWalkY;

      // When arrived at armory
      if (Math.hypot(this.x - this.targetX, this.y - this.targetY) < 12) {
        if (engine.resources.ammo < 1) {
          this.say("No ammo in armory stock to deliver!", 2);
          this.abortAmmoDelivery();
          return;
        }
        this.carryingAmmo = true;
        task.phase = 'call_elevator_armory';
        this.say("Ammo crate ready! Calling elevator!", 2);
      }
    } else if (task.phase === 'call_elevator_armory') {
      // Walk to elevator shaft on Floor 1
      this.targetX = CONFIG.ELEVATOR_X - 16;
      this.targetY = armoryWalkY;

      if (Math.abs(this.x - this.targetX) < 10) {
        if (elevator.isAtFloor(1)) {
          elevator.board(this);
          elevator.moveToFloor(0); // Ride to surface
          task.phase = 'riding_to_surface';
          this.say("Taking lift to surface...", 2);
        } else {
          elevator.moveToFloor(1);
        }
      }
    } else if (task.phase === 'riding_to_surface') {
      // In elevator car moving up
      if (elevator.isAtFloor(0)) {
        elevator.exit(this);
        this.x = CONFIG.ELEVATOR_X;
        this.y = CONFIG.SURFACE_Y;
        task.phase = 'running_to_turret';
        this.say("Surface breached! Running to turret!", 2);
      }
    } else if (task.phase === 'running_to_turret') {
      // Walk across surface to turret
      const turretStopX = turret.side === 'left' ? turret.x + 24 : turret.x - 24;
      this.targetX = turretStopX;
      this.targetY = CONFIG.SURFACE_Y;

      if (Math.abs(this.x - turretStopX) < 14) {
        // Restock turret!
        const needed = turret.stats.maxAmmo - turret.ammo;
        const available = Math.floor(engine.resources.ammo);
        const deliverAmount = Math.min(needed, Math.min(CONFIG.AMMO_CRATE_DELIVERY_AMOUNT, available));

        if (deliverAmount > 0) {
          engine.resources.ammo -= deliverAmount;
          turret.ammo += deliverAmount;
          turret.isReloading = false;
          engine.particles.spawnSparks(turret.x, turret.y, 22, '#55ffaa');
          engine.particles.addFloatingText(`+${deliverAmount} AMMO RESTOCKED!`, turret.x - 25, turret.y - 30, '#55ffaa');
          if (window.soundSystem) window.soundSystem.playReload();
        }

        this.carryingAmmo = false;
        this.addXP(CONFIG.SURVIVOR_XP_AMMO_RUN);
        task.phase = 'returning_to_cabin';
        this.say("Restocked! Returning to bunker!", 2);
      }
    } else if (task.phase === 'returning_to_cabin') {
      // Run back into surface cabin
      this.targetX = CONFIG.ELEVATOR_X;
      this.targetY = CONFIG.SURFACE_Y;

      if (Math.abs(this.x - CONFIG.ELEVATOR_X) < 10) {
        if (elevator.isAtFloor(0)) {
          elevator.board(this);
          const assignedRoom = engine.getRoom(this.assignedRoom);
          const destFloor = assignedRoom ? assignedRoom.floor : 1;
          elevator.moveToFloor(destFloor);
          task.destFloor = destFloor;
          task.phase = 'riding_to_bunker';
          this.say("Descending back to bunker...", 2);
        } else {
          elevator.moveToFloor(0);
        }
      }
    } else if (task.phase === 'riding_to_bunker') {
      // In elevator car moving down
      if (elevator.isAtFloor(task.destFloor)) {
        elevator.exit(this);
        this.x = CONFIG.ELEVATOR_X;
        this.y = elevator.getFloorWalkY(task.destFloor);
        this.ammoDeliveryTask = null;
        this.status = 'working';
        this.assignTo(this.assignedRoom);
        this.say("Safe inside! Back to duty!", 2);
      }
    }
  }

  updateAutonomousNeeds(dt) {
    const engine = window.gameEngine;
    const res = engine.resources;
    const elevator = engine.elevator;

    // Trigger needs if thresholds crossed
    if (!this.needState) {
      if (this.thirst < CONFIG.THIRST_THRESHOLD && res.water >= 1) {
        this.needState = 'seeking_water';
        this.status = 'seeking_water';
        this.needTimer = 0;
        this.say("Thirsty... heading to filtration.", 2);
      } else if (this.hunger < CONFIG.HUNGER_THRESHOLD && res.food >= 1) {
        this.needState = 'seeking_food';
        this.status = 'seeking_food';
        this.needTimer = 0;
        this.say("Hungry... heading to Mess Hall.", 2);
      } else if (this.fatigue >= CONFIG.FATIGUE_REST_THRESHOLD) {
        this.needState = 'resting';
        this.status = 'resting';
        this.needTimer = 0;
        this.say("Exhausted... rotating to Quarters.", 2);
      }
    }

    // Process active need state
    if (this.needState === 'seeking_water') {
      const waterRoom = engine.getRoom('water_filter');
      if (waterRoom) {
        const destY = elevator.getFloorWalkY(waterRoom.floor);
        this.targetX = waterRoom.x + 30;
        this.targetY = destY;

        if (Math.hypot(this.x - this.targetX, this.y - this.targetY) < 14) {
          this.needTimer += dt;
          if (this.needTimer >= 1.5) {
            res.water = Math.max(0, res.water - 1);
            this.thirst = 100;
            this.needState = null;
            this.status = 'working';
            this.needTimer = 0;
            this.say("Refreshed with clean water!", 2);
            this.assignTo(this.assignedRoom);
          }
        }
      }
    } else if (this.needState === 'seeking_food') {
      const kitchen = engine.getRoom('kitchen');
      if (kitchen) {
        const destY = elevator.getFloorWalkY(kitchen.floor);
        this.targetX = kitchen.x + 30;
        this.targetY = destY;

        if (Math.hypot(this.x - this.targetX, this.y - this.targetY) < 14) {
          this.needTimer += dt;
          if (this.needTimer >= 1.8) {
            res.food = Math.max(0, res.food - 1);
            this.hunger = 100;
            this.needState = null;
            this.status = 'working';
            this.needTimer = 0;
            this.say("Good hot meal!", 2);
            this.assignTo(this.assignedRoom);
          }
        }
      }
    } else if (this.needState === 'resting') {
      // Find quarters
      const q = engine.getRoom('quarters_1') || engine.getRoom('quarters_2');
      if (q) {
        const destY = elevator.getFloorWalkY(q.floor);
        this.targetX = q.x + 35;
        this.targetY = destY;

        if (Math.hypot(this.x - this.targetX, this.y - this.targetY) < 16) {
          // Resting restores fatigue rapidly
          if (this.fatigue <= CONFIG.FATIGUE_WAKE_THRESHOLD) {
            this.needState = null;
            this.status = 'working';
            this.say("Fully rested and energized!", 2);
            this.assignTo(this.assignedRoom);
          }
        }
      }
    } else {
      // Normal idle pacing in assigned room
      const room = engine.getRoom(this.assignedRoom);
      if (room) {
        if (Math.random() < 0.015) {
          this.targetX = room.x + 18 + Math.random() * (room.width - 36);
          this.targetY = room.y + room.height - 12;
        }
      }
    }
  }

  performMovement(dt) {
    if (this.inElevator) {
      this.isMoving = false;
      return;
    }

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.hypot(dx, dy);
    const step = this.speed * dt;

    if (dist <= Math.max(1.5, step)) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.isMoving = false;
    } else {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
      // Strained, heavier stride when carrying heavy munitions crate
      this.walkCycle += dt * (this.carryingAmmo ? 6.2 : 8.5);
      this.isMoving = true;
      if (dx < -1.5) this.facing = -1;
      else if (dx > 1.5) this.facing = 1;
    }
  }

  draw(ctx) {
    if (this.isDead) return;

    // Determine character role and identity
    const nameL = (this.name || '').toLowerCase();
    const roleL = (this.role || '').toLowerCase();
    const spec = this.specialty || '';

    const isMarcus = nameL.includes('marcus') || roleL.includes('gunsmith') || spec === 'armory';
    const isElena = nameL.includes('elena') || roleL.includes('engineer') || roleL.includes('mechanic') || spec === 'workshop';
    const isSarah = nameL.includes('sarah') || roleL.includes('physician') || roleL.includes('doctor') || spec === 'clinic';
    const isToby = nameL.includes('toby') || roleL.includes('botanist') || roleL.includes('agri') || spec === 'hydroponics';
    const isAiden = nameL.includes('aiden') || roleL.includes('guard') || roleL.includes('security') || spec === 'security';

    // Resting sleep posture: when resting at living quarters
    const isResting = (this.status === 'resting' || this.needState === 'resting') &&
      ((this.assignedRoom && this.assignedRoom.startsWith('quarters')) || (!this.isMoving && Math.hypot(this.x - this.targetX, this.y - this.targetY) < 18));

    if (isResting) {
      this.drawSleeping(ctx, isMarcus, isElena, isSarah, isToby, isAiden);
      return;
    }

    ctx.save();
    ctx.translate(this.x, this.y);

    const movingLeft = this.facing === -1 || (this.targetX < this.x - 2);
    if (movingLeft) ctx.scale(-1, 1);

    // Dynamic animation parameters: Idle breathing, walk bounce, leg and arm articulation
    const breath = !this.isMoving ? Math.sin(this.idleTime * 2.5) * 0.85 : 0;
    const bob = this.isMoving ? Math.abs(Math.sin(this.walkCycle)) * 2.2 : breath;
    const legSwing = this.isMoving ? Math.cos(this.walkCycle) * 4.5 : 0;
    const armSwing = this.isMoving ? Math.sin(this.walkCycle) * 5.0 : Math.sin(this.idleTime * 1.5) * 1.2;

    // Hauling heavy ammo crate: realistic strained forward lean under weight
    if (this.carryingAmmo) {
      ctx.rotate(0.09); // Forward torso rake
    }

    // 1. LEGS & ARTICULATED BOOTS
    this.drawSurvivorLegs(ctx, legSwing, bob, isMarcus, isElena, isSarah, isToby, isAiden);

    // 2. TORSO & ROLE-SPECIFIC COSTUMES
    this.drawSurvivorTorso(ctx, bob, isMarcus, isElena, isSarah, isToby, isAiden);

    // 3. HEAD, HAIR, CAPS & EYE ACCENTS
    this.drawSurvivorHead(ctx, bob, isMarcus, isElena, isSarah, isToby, isAiden);

    // 4. ARMS, HELD TOOLS & TASK ANIMATIONS (Ammo crate, Eating, Drinking, Crafting)
    this.drawSurvivorArmsAndItems(ctx, bob, armSwing, isMarcus, isElena, isSarah, isToby, isAiden);

    // 5. STATUS OVERLAYS (Health pip, Name tag, Speech bubble)
    this.drawSurvivorOverlays(ctx, bob, movingLeft);

    ctx.restore();
  }

  // --- RESTING SLEEP POSTURE WITH FLOATING 'Zzz' ICONS ---
  drawSleeping(ctx, isMarcus, isElena, isSarah, isToby, isAiden) {
    ctx.save();
    ctx.translate(this.x, this.y);

    const sleepBreath = Math.sin(this.idleTime * 1.5) * 0.9;

    // Bunk cot frame & mattress
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(-20, -6, 40, 5); // Bed base
    ctx.fillStyle = '#1e272e';
    ctx.fillRect(-20, -1, 4, 3); // Left post
    ctx.fillRect(16, -1, 4, 3);  // Right post

    // Soft mattress
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(-19, -10, 38, 4);

    // White fluffy pillow
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.ellipse(-13, -11, 5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head resting on pillow with peaceful closed eyes
    ctx.fillStyle = isMarcus || isToby ? '#f5cd79' : isSarah ? '#ffeaa7' : '#ffdfba';
    ctx.beginPath();
    ctx.arc(-11, -12 + sleepBreath * 0.3, 4, 0, Math.PI * 2);
    ctx.fill();

    // Closed eyes (peaceful horizontal sleep arcs)
    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-12, -12 + sleepBreath * 0.3);
    ctx.lineTo(-9.5, -12 + sleepBreath * 0.3);
    ctx.stroke();

    // Resting headgear / accessory on bedpost or nightstand
    if (isMarcus) {
      // Marcus goggles on cot frame
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 1;
      ctx.strokeRect(10, -11, 6, 3);
    } else if (isElena) {
      // Elena yellow hardhat resting by cot
      ctx.fillStyle = '#f39c12';
      ctx.beginPath();
      ctx.arc(12, -10, 4, Math.PI, 0);
      ctx.fill();
    } else if (isToby) {
      // Toby straw hat by cot edge
      ctx.fillStyle = '#eccc68';
      ctx.beginPath();
      ctx.ellipse(12, -9, 6, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (isAiden) {
      // Aiden green beret folded on bedpost
      ctx.fillStyle = '#1b4332';
      ctx.beginPath();
      ctx.ellipse(12, -10, 4, 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cozy bunker quilted blanket covering body up to chest
    ctx.fillStyle = '#334155';
    ctx.fillRect(-6, -12 + sleepBreath * 0.7, 24, 7);
    ctx.fillStyle = '#475569';
    ctx.fillRect(-7, -13 + sleepBreath * 0.7, 25, 2); // Folded sheet top
    // Quilt stitch accents
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-2, -11 + sleepBreath * 0.7); ctx.lineTo(6, -6);
    ctx.moveTo(6, -11 + sleepBreath * 0.7); ctx.lineTo(14, -6);
    ctx.stroke();

    // Floating animated 'Zzz' icons ascending into the air
    for (let i = 0; i < 3; i++) {
      const t = ((this.idleTime * 0.65 + i * 0.33) % 1.0);
      const zY = -16 - t * 24;
      const zX = -11 + Math.sin(t * Math.PI * 2 + i * 2) * 5;
      const zAlpha = Math.sin(t * Math.PI);
      const zSize = 7 + t * 4;

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, zAlpha));
      ctx.fillStyle = '#70a1ff';
      ctx.font = `bold ${Math.round(zSize)}px monospace`;
      ctx.shadowColor = '#3867d6';
      ctx.shadowBlur = 4;
      ctx.fillText('Z', zX, zY);
      ctx.restore();
    }

    // Health pip and name tag while resting
    const hpRatio = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = hpRatio > 0.5 ? '#2ecc71' : '#e74c3c';
    ctx.fillRect(-8, -20, 16 * hpRatio, 2);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    const shortName = this.name.split(' ')[0];
    ctx.fillText(`${shortName} (Sleeping)`, 0, -23);

    // Speech bubble if speaking
    if (this.speechText) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
      ctx.font = 'bold 8px monospace';
      const textW = ctx.measureText(this.speechText).width + 8;
      ctx.fillRect(-textW / 2, -37, textW, 12);
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 1;
      ctx.strokeRect(-textW / 2, -37, textW, 12);
      ctx.fillStyle = '#ffd700';
      ctx.fillText(this.speechText, 0, -28);
      ctx.restore();
    }

    ctx.restore();
  }

  // --- 1. LEGS & ARTICULATED BOOTS ---
  drawSurvivorLegs(ctx, legSwing, bob, isMarcus, isElena, isSarah, isToby, isAiden) {
    let pantsColor = '#2980b9';
    let bootColor = '#1e272e';

    if (isMarcus) {
      pantsColor = '#243342'; // Sturdy gunsmith denim
      bootColor = '#3a2618';  // Steel-toed dark brown work boots
    } else if (isElena) {
      pantsColor = '#ff5722'; // High-vis orange jumpsuit legs
      bootColor = '#1a1a1a';  // Heat-resistant black boots
    } else if (isSarah) {
      pantsColor = '#16a085'; // Teal surgical scrub trousers
      bootColor = '#f8fafc';  // Clean white medical clinical shoes
    } else if (isToby) {
      pantsColor = '#4a3728'; // Earth-brown gardening dungarees
      bootColor = '#2f1f14';  // Mud-stained field boots
    } else if (isAiden) {
      pantsColor = '#2f3640'; // Tactical charcoal BDU cargo pants
      bootColor = '#111111';  // High-top tactical SWAT assault boots
    }

    // Back leg (stepping with -legSwing)
    ctx.strokeStyle = pantsColor;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(2, -7 + bob);
    ctx.lineTo(2 - legSwing * 0.7, -3.5 + bob);
    ctx.lineTo(3 - legSwing, -1);
    ctx.stroke();

    // Back boot sole
    ctx.fillStyle = bootColor;
    ctx.fillRect(1 - legSwing, -2, 4.5, 2.5);

    // Front leg (stepping with +legSwing)
    ctx.strokeStyle = pantsColor;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(-2, -7 + bob);
    ctx.lineTo(-2 + legSwing * 0.7, -3.5 + bob);
    ctx.lineTo(-3 + legSwing, -1);
    ctx.stroke();

    // Front boot sole
    ctx.fillStyle = bootColor;
    ctx.fillRect(-5 + legSwing, -2, 5, 2.5);

    // Elena: reflective silver hazard band on pants cuffs
    if (isElena) {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-4.5 + legSwing, -4, 4, 1.2);
    }
  }

  // --- 2. TORSO & ROLE-SPECIFIC COSTUMES ---
  drawSurvivorTorso(ctx, bob, isMarcus, isElena, isSarah, isToby, isAiden) {
    const torsoY = -17 + bob;
    const torsoW = 9;
    const torsoH = 10.5;

    if (isMarcus) {
      // Marcus (Gunsmith): Grey work shirt base with heavy leather protective apron
      ctx.fillStyle = '#47535e'; // Grey canvas shirt
      ctx.fillRect(-torsoW / 2, torsoY, torsoW, torsoH);

      // Heavy distressed leather apron
      ctx.fillStyle = '#8b4513';
      ctx.fillRect(-torsoW / 2 + 0.5, torsoY + 1.5, torsoW - 1, torsoH - 1.5);
      ctx.fillStyle = '#6e340d';
      ctx.fillRect(-torsoW / 2 + 1, torsoY + 5, torsoW - 2, 4); // Front pocket

      // Cross-shoulder leather harness straps with brass rivet studs
      ctx.strokeStyle = '#5a2507';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-torsoW / 2 + 1, torsoY); ctx.lineTo(-1, torsoY + 4);
      ctx.moveTo(torsoW / 2 - 1, torsoY); ctx.lineTo(1, torsoY + 4);
      ctx.stroke();

      // Brass rivet studs
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(-2, torsoY + 1, 1.2, 1.2);
      ctx.fillRect(1, torsoY + 1, 1.2, 1.2);

      // Dark brown tool belt with brass buckle
      ctx.fillStyle = '#3a1d0d';
      ctx.fillRect(-torsoW / 2, torsoY + torsoH - 2.5, torsoW, 2);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(-1, torsoY + torsoH - 2.5, 2, 2);
    } else if (isElena) {
      // Elena (Engineer): Fluorescent high-vis jumpsuit with dual reflective 3M stripes
      ctx.fillStyle = '#ff5722'; // High-vis neon orange
      ctx.fillRect(-torsoW / 2, torsoY, torsoW, torsoH);

      // Dual reflective silver stripes with white glint
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-torsoW / 2, torsoY + 2.5, torsoW, 1.8);
      ctx.fillRect(-torsoW / 2, torsoY + 6.5, torsoW, 1.8);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-1, torsoY + 2.5, 2, 1.8);

      // Utility belt with tool loop
      ctx.fillStyle = '#2d3436';
      ctx.fillRect(-torsoW / 2, torsoY + torsoH - 2, torsoW, 2);
    } else if (isSarah) {
      // Doc Sarah (Physician): Teal surgical scrubs beneath open white lab coat
      ctx.fillStyle = '#1abc9c'; // Teal scrubs
      ctx.fillRect(-torsoW / 2, torsoY, torsoW, torsoH);

      // Tailored white doctor's lab coat with lapels
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(-torsoW / 2 - 0.5, torsoY, 3, torsoH + 1.5); // Left coat panel
      ctx.fillRect(torsoW / 2 - 2.5, torsoY, 3, torsoH + 1.5);  // Right coat panel
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-torsoW / 2 + 1, torsoY + 3.5, 2, 3); // Breast pocket with pen clip

      // Stethoscope draped around neck with silver circular chestpiece
      ctx.strokeStyle = '#0f172a'; // Black rubber binaural tubing
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-3, torsoY);
      ctx.lineTo(-1, torsoY + 4.5);
      ctx.lineTo(2, torsoY + 4.5);
      ctx.lineTo(3, torsoY);
      ctx.stroke();

      // Silver acoustic bell disc
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(0.5, torsoY + 4.8, 1.4, 0, Math.PI * 2);
      ctx.fill();

      // Medical cross satchel slung on hip
      ctx.fillStyle = '#7f1d1d'; // Crimson leather pouch
      ctx.fillRect(torsoW / 2 - 2, torsoY + torsoH - 4, 4.5, 4.5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(torsoW / 2 - 0.5, torsoY + torsoH - 3.2, 1.5, 3);
      ctx.fillRect(torsoW / 2 - 1.2, torsoY + torsoH - 2.4, 3, 1.5);
    } else if (isToby) {
      // Toby (Botanist): Buffalo plaid checkered flannel shirt & dungarees
      ctx.fillStyle = '#c0392b'; // Crimson flannel base
      ctx.fillRect(-torsoW / 2, torsoY, torsoW, torsoH);

      // Plaid criss-cross black check pattern
      ctx.fillStyle = '#2c0b0e';
      ctx.fillRect(-torsoW / 2, torsoY + 2.5, torsoW, 1.5);
      ctx.fillRect(-torsoW / 2, torsoY + 6.5, torsoW, 1.5);
      ctx.fillRect(-1.5, torsoY, 1.5, torsoH);
      ctx.fillRect(2, torsoY, 1.5, torsoH);

      // Faded denim dungarees bib with brass buttons
      ctx.fillStyle = '#2980b9';
      ctx.fillRect(-torsoW / 2 + 1, torsoY + 5.5, torsoW - 2, torsoH - 5.5);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(-2.5, torsoY + 6, 1.2, 1.2);
      ctx.fillRect(1.5, torsoY + 6, 1.2, 1.2);

      // Fresh green herb sprout in bib pocket!
      ctx.fillStyle = '#2ecc71';
      ctx.beginPath();
      ctx.arc(1.5, torsoY + 4.5, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (isAiden) {
      // Aiden (Veteran Guard): Charcoal fatigues with heavy tactical Kevlar combat vest
      ctx.fillStyle = '#353b48'; // Combat uniform base
      ctx.fillRect(-torsoW / 2, torsoY, torsoW, torsoH);

      // Tactical MOLLE Kevlar vest
      ctx.fillStyle = '#1e272e';
      ctx.fillRect(-torsoW / 2 - 0.5, torsoY + 0.5, torsoW + 1, torsoH - 1.5);

      // Tactical armor plate seam & magazine pouches
      ctx.fillStyle = '#2f3640';
      ctx.fillRect(-torsoW / 2 + 1, torsoY + 4.5, 3.2, 3.5);
      ctx.fillRect(0.5, torsoY + 4.5, 3.2, 3.5);

      // Shoulder comms radio with mini antenna & blinking green LED
      ctx.fillStyle = '#18191a'; // Radio body on shoulder
      ctx.fillRect(-torsoW / 2 - 1, torsoY - 2, 2.5, 4);
      // Mini whip antenna
      ctx.strokeStyle = '#2f3640';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-torsoW / 2 + 0.2, torsoY - 2);
      ctx.lineTo(-torsoW / 2 + 0.2, torsoY - 6);
      ctx.stroke();

      // Blinking green comms LED indicator
      const ledOn = Math.floor(this.idleTime * 2.8) % 2 === 0;
      if (ledOn) {
        ctx.fillStyle = '#00ff66';
        ctx.shadowColor = '#00ff66';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(-torsoW / 2 + 0.2, torsoY - 0.5, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = '#0e4418';
        ctx.beginPath();
        ctx.arc(-torsoW / 2 + 0.2, torsoY - 0.5, 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Generic / Other Inhabitant: Jumpsuit matching specialty
      ctx.fillStyle = this.specialty === 'armory' ? '#d35400' :
                      this.specialty === 'clinic' ? '#27ae60' :
                      this.specialty === 'workshop' ? '#f39c12' : '#2980b9';
      ctx.fillRect(-torsoW / 2, torsoY, torsoW, torsoH);
    }
  }

  // --- 3. HEAD, HAIR, CAPS & ACCESSORIES ---
  drawSurvivorHead(ctx, bob, isMarcus, isElena, isSarah, isToby, isAiden) {
    const headY = -21 + bob;
    const skinColor = isMarcus || isToby ? '#f5cd79' : isSarah ? '#ffeaa7' : isAiden ? '#f0c294' : '#ffdfba';

    // Head base
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(0, headY, 4.4, 0, Math.PI * 2);
    ctx.fill();

    // Eye dot (subtle blink every few seconds)
    const isBlinking = (this.idleTime % 3.8) < 0.12;
    if (!isBlinking) {
      ctx.fillStyle = '#1e272e';
      ctx.beginPath();
      ctx.arc(1.8, headY - 0.2, 0.9, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#1e272e';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(1.0, headY - 0.2);
      ctx.lineTo(2.6, headY - 0.2);
      ctx.stroke();
    }

    if (isMarcus) {
      // Marcus: 5 o'clock beard stubble
      ctx.fillStyle = 'rgba(50, 30, 15, 0.35)';
      ctx.fillRect(0.5, headY + 1.2, 3, 2);

      // Messy brown hair
      ctx.fillStyle = '#3a2010';
      ctx.beginPath();
      ctx.arc(0, headY - 1.5, 4.5, Math.PI, 0);
      ctx.fill();

      // Protective brass ballistic goggles on forehead
      ctx.strokeStyle = '#111111'; // Elastic strap around head
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-4.2, headY - 1.8);
      ctx.lineTo(4.2, headY - 1.8);
      ctx.stroke();

      // Twin brass-rimmed lenses on forehead
      ctx.fillStyle = '#d4af37'; // Brass rim
      ctx.fillRect(-1.8, headY - 3.8, 2.5, 2.5);
      ctx.fillRect(1.0, headY - 3.8, 2.5, 2.5);
      ctx.fillStyle = '#2e4a28'; // Tinted green/olive glass
      ctx.fillRect(-1.3, headY - 3.3, 1.5, 1.5);
      ctx.fillRect(1.5, headY - 3.3, 1.5, 1.5);
    } else if (isElena) {
      // Elena: Brunette ponytail at back
      ctx.fillStyle = '#2c1810';
      ctx.beginPath();
      ctx.arc(-4, headY + 1, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Safety hardhat & welder visor
      ctx.fillStyle = '#f39c12'; // Bright yellow industrial hardhat
      ctx.beginPath();
      ctx.arc(0, headY - 1.2, 4.8, Math.PI, 0);
      ctx.fill();
      // Hardhat front brim
      ctx.fillStyle = '#d68910';
      ctx.fillRect(-2, headY - 1.5, 7, 1.5);

      // Flip-up dark welder visor above brow
      ctx.fillStyle = '#1c2833';
      ctx.fillRect(1.5, headY - 3.5, 3.8, 2);
      ctx.strokeStyle = '#7f8c8d';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(1.5, headY - 3.5, 3.8, 2);
    } else if (isSarah) {
      // Doc Sarah: Light seafoam/cyan surgical scrub cap
      ctx.fillStyle = '#00d2d3';
      ctx.beginPath();
      ctx.arc(0, headY - 1.2, 4.6, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#01a3a4';
      ctx.fillRect(-4.2, headY - 1.5, 8.4, 1.5); // Cap headband
    } else if (isToby) {
      // Toby: Broad-brimmed woven straw hat with green ribbon
      ctx.fillStyle = '#eccc68'; // Woven golden straw brim
      ctx.beginPath();
      ctx.ellipse(0, headY - 1.8, 8, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Rounded crown
      ctx.fillStyle = '#f5cd79';
      ctx.beginPath();
      ctx.arc(0, headY - 2.8, 3.8, Math.PI, 0);
      ctx.fill();

      // Forest green ribbon band
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(-3.6, headY - 3.2, 7.2, 1.2);
    } else if (isAiden) {
      // Aiden: Tactical military commando beret with golden crest badge
      ctx.fillStyle = '#1b4332'; // Forest-green beret pulled over right brow
      ctx.beginPath();
      ctx.ellipse(0.5, headY - 2.2, 4.8, 2.6, 0.25, 0, Math.PI * 2);
      ctx.fill();

      // Golden military crest insignia pin
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(1.5, headY - 3.2, 1.5, 1.5);
    } else {
      // Generic cap
      ctx.fillStyle = '#34495e';
      ctx.beginPath();
      ctx.arc(0, headY - 1.5, 4.4, Math.PI, 0);
      ctx.fill();
    }
  }

  // --- 4. ARMS, HELD TOOLS & TASK ANIMATIONS ---
  drawSurvivorArmsAndItems(ctx, bob, armSwing, isMarcus, isElena, isSarah, isToby, isAiden) {
    const shoulderY = -15 + bob;

    // --- SPECIAL ANIMATION: Carrying Ammo Crate ---
    if (this.carryingAmmo) {
      // Both arms wrapped forward holding heavy munitions box
      ctx.strokeStyle = isMarcus ? '#8b4513' : '#34495e';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-1, shoulderY);
      ctx.lineTo(4, shoulderY + 4);
      ctx.lineTo(8, shoulderY + 4);
      ctx.stroke();

      // Heavy olive green steel military munitions box with yellow stencils
      ctx.fillStyle = '#2d4a22'; // Olive drab
      ctx.fillRect(3, -17 + bob, 14, 9);
      ctx.strokeStyle = '#576574'; // Steel frame brackets
      ctx.lineWidth = 1;
      ctx.strokeRect(3, -17 + bob, 14, 9);

      // Yellow & black hazard diagonal stripes along bottom rim
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(3, -9 + bob, 14, 1.8);
      ctx.fillStyle = '#111111';
      ctx.fillRect(6, -9 + bob, 2.5, 1.8);
      ctx.fillRect(11, -9 + bob, 2.5, 1.8);

      // Munitions label stencil
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 5px monospace';
      ctx.fillText('AMMO', 4, -12 + bob);

      // Heavy carry side handle
      ctx.strokeStyle = '#1e272e';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(2, -14 + bob, 1.5, 3.5);
      return;
    }

    // --- SPECIAL ANIMATION: Eating at Kitchen ---
    if (this.needState === 'seeking_food' && this.needTimer > 0) {
      // Left arm holds warm earthenware bowl
      ctx.fillStyle = '#8d5524';
      ctx.beginPath();
      ctx.arc(4, shoulderY + 4, 3.5, 0, Math.PI);
      ctx.fill();

      // Food stew
      ctx.fillStyle = '#e67e22';
      ctx.fillRect(1, shoulderY + 2.5, 6, 1.5);

      // Soft steam wisps rising from bowl
      const steamCycle = (this.idleTime * 4) % (Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(3, shoulderY + 2);
      ctx.lineTo(2.5 + Math.sin(steamCycle) * 1.5, shoulderY - 4);
      ctx.moveTo(5, shoulderY + 2);
      ctx.lineTo(5.5 + Math.cos(steamCycle) * 1.5, shoulderY - 5);
      ctx.stroke();

      // Right arm lifts spoon to mouth rhythmically
      const spoonBob = Math.sin(this.needTimer * 7) * 3.5;
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(3, shoulderY + 3);
      ctx.lineTo(2, shoulderY - 1 + spoonBob);
      ctx.stroke();
      return;
    }

    // --- SPECIAL ANIMATION: Drinking at Water Filter ---
    if (this.needState === 'seeking_water' && this.needTimer > 0) {
      // Both hands lift water flask to lips
      ctx.fillStyle = '#0ea5e9'; // Blue thermos flask
      ctx.fillRect(2, shoulderY - 3, 4, 6);
      ctx.fillStyle = '#e2e8f0'; // Silver cap
      ctx.fillRect(2.5, shoulderY - 4.5, 3, 1.5);

      // Tiny refreshing water droplet glint
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(3.5, shoulderY - 5, 0.8, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    // --- STANDARD STATE: Role-specific arms & tools ---
    // Back arm (swings counter to front)
    ctx.strokeStyle = isSarah ? '#f8fafc' : isElena ? '#ff5722' : '#34495e';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(1, shoulderY);
    ctx.lineTo(2 - armSwing * 0.7, shoulderY + 6);
    ctx.stroke();

    // Front arm with tool or natural swing
    ctx.strokeStyle = isSarah ? '#f8fafc' : isElena ? '#ff5722' : '#34495e';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-1, shoulderY);

    if (isMarcus) {
      // Marcus: Heavy gunsmith wrench in hand
      ctx.lineTo(3, shoulderY + 5);
      ctx.stroke();
      ctx.strokeStyle = '#7f8c8d'; // Steel wrench
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(3, shoulderY + 5);
      ctx.lineTo(7, shoulderY + 3);
      ctx.stroke();
      ctx.strokeRect(6.5, shoulderY + 1.5, 2.5, 2.5);
    } else if (isElena) {
      // Elena: Adjustable repair pipe wrench / welding tool
      ctx.lineTo(3, shoulderY + 4);
      ctx.stroke();
      ctx.strokeStyle = '#e74c3c'; // Red handle wrench
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(3, shoulderY + 4);
      ctx.lineTo(7, shoulderY + 2);
      ctx.stroke();
      ctx.strokeStyle = '#95a5a6';
      ctx.strokeRect(6.5, shoulderY + 0.5, 2.5, 2.5);
    } else if (isToby) {
      // Toby: Steel garden pruning shears
      ctx.lineTo(3, shoulderY + 5);
      ctx.stroke();
      ctx.strokeStyle = '#cbd5e1'; // Stainless steel shear blades
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(3, shoulderY + 5);
      ctx.lineTo(6, shoulderY + 3);
      ctx.moveTo(3, shoulderY + 5);
      ctx.lineTo(6, shoulderY + 6);
      ctx.stroke();
    } else if (isAiden) {
      // Aiden: Tactical sidearm resting at combat ready
      ctx.lineTo(3, shoulderY + 5);
      ctx.stroke();
      ctx.fillStyle = '#111111'; // Tactical combat glove
      ctx.fillRect(2.5, shoulderY + 4.5, 2, 2);
    } else {
      // Standard arm swing
      ctx.lineTo(-2 + armSwing * 0.8, shoulderY + 6);
      ctx.stroke();
    }
  }

  // --- 5. STATUS OVERLAYS (Health pip, Name tag, Speech bubble) ---
  drawSurvivorOverlays(ctx, bob, movingLeft) {
    // Health pip
    const hpRatio = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = '#1e272e';
    ctx.fillRect(-7, -27 + bob, 14, 2.5);
    ctx.fillStyle = hpRatio > 0.5 ? '#2ecc71' : hpRatio > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.fillRect(-7, -27 + bob, 14 * hpRatio, 2.5);

    // Name tag & Level Badge
    ctx.fillStyle = '#ffffff';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    const shortName = this.name.split(' ')[0];
    const starPrefix = this.level > 1 ? '⭐' : '';
    ctx.fillText(`${starPrefix}${shortName} [L${this.level}]`, 0, -31 + bob);

    // Speech bubble if speaking
    if (this.speechText) {
      ctx.save();
      if (movingLeft) ctx.scale(-1, 1); // Un-flip text for readability
      ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
      ctx.font = 'bold 8px monospace';
      const textW = ctx.measureText(this.speechText).width + 8;
      ctx.fillRect(-textW / 2, -45 + bob, textW, 12);
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 1;
      ctx.strokeRect(-textW / 2, -45 + bob, textW, 12);
      ctx.fillStyle = '#ffd700';
      ctx.fillText(this.speechText, 0, -36 + bob);
      ctx.restore();
    }
  }
}

window.Survivor = Survivor;
