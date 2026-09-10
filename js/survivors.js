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

    if (this.speechTimer > 0) {
      this.speechTimer -= dt;
      if (this.speechTimer <= 0) this.speechText = '';
    }

    const engine = window.gameEngine;
    const res = engine.resources;
    const elevator = engine.elevator;

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
    if (this.inElevator) return;

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.hypot(dx, dy);
    const step = this.speed * dt;

    if (dist <= Math.max(1.5, step)) {
      this.x = this.targetX;
      this.y = this.targetY;
    } else {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
      this.walkCycle += dt * 8;
    }
  }

  draw(ctx) {
    if (this.isDead) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    const bob = Math.sin(this.walkCycle) * 1.5;
    const legSwing = Math.cos(this.walkCycle) * 3;

    // Direction flip
    const movingLeft = this.targetX < this.x - 2;
    if (movingLeft) ctx.scale(-1, 1);

    // Legs
    ctx.strokeStyle = '#1e272e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-2, -6);
    ctx.lineTo(-3 + legSwing, 0);
    ctx.moveTo(2, -6);
    ctx.lineTo(3 - legSwing, 0);
    ctx.stroke();

    // Body / Jumpsuit
    ctx.fillStyle = this.specialty === 'armory' ? '#d35400' :
                    this.specialty === 'clinic' ? '#27ae60' :
                    this.specialty === 'workshop' ? '#f39c12' : '#2980b9';
    ctx.fillRect(-4, -16 + bob, 8, 10);

    // Head
    ctx.fillStyle = '#ffdfba';
    ctx.beginPath();
    ctx.arc(0, -19 + bob, 4, 0, Math.PI * 2);
    ctx.fill();

    // Hair / Cap
    ctx.fillStyle = '#4a2810';
    ctx.beginPath();
    ctx.arc(0, -21 + bob, 4, Math.PI, 0);
    ctx.fill();

    // Carrying Ammo Crate in hands!
    if (this.carryingAmmo) {
      // Olive green heavy munitions box with yellow text
      ctx.fillStyle = '#2d4726';
      ctx.fillRect(4, -15 + bob, 11, 7);
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 1;
      ctx.strokeRect(4, -15 + bob, 11, 7);
      // Yellow ammo stencil
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 5px monospace';
      ctx.fillText('AMMO', 5, -10 + bob);
    }

    // Health pip
    const hpRatio = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = hpRatio > 0.5 ? '#2ecc71' : '#e74c3c';
    ctx.fillRect(-6, -26 + bob, 12 * hpRatio, 2);

    // Name tag & Level Star
    ctx.fillStyle = '#ffffff';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    const shortName = this.name.split(' ')[0];
    ctx.fillText(`${shortName} [L${this.level}]`, 0, -29 + bob);

    // Speech bubble if speaking
    if (this.speechText) {
      ctx.save();
      if (movingLeft) ctx.scale(-1, 1); // unflip text
      ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
      ctx.font = 'bold 8px monospace';
      const textW = ctx.measureText(this.speechText).width + 8;
      ctx.fillRect(-textW / 2, -44 + bob, textW, 12);
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 1;
      ctx.strokeRect(-textW / 2, -44 + bob, textW, 12);
      ctx.fillStyle = '#ffd700';
      ctx.fillText(this.speechText, 0, -35 + bob);
      ctx.restore();
    }

    ctx.restore();
  }
}

window.Survivor = Survivor;
