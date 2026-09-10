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
    this.status = 'working'; // 'working', 'seeking_food', 'seeking_water', 'resting', 'seeking_medical', 'delivering_ammo', 'emergency_power', 'repairing_defenses'

    // Visual & kinematic position
    this.x = 640;
    this.y = 350;
    this.targetX = 640;
    this.targetY = 350;

    const nameLower = (this.name || '').toLowerCase();
    const roleLower = (this.role || '').toLowerCase();
    // Samantha (Logistics Porter) sprints 50% faster (78 px/s)
    this.speed = data.speed || (nameLower.includes('samantha') || roleLower.includes('porter') ? 78 : 52);
    this.walkCycle = Math.random() * 10;
    this.isDead = false;

    // Subsystem flags
    this.inElevator = false;
    this.carryingAmmo = false;
    this.ammoDeliveryTask = null; // Logistics runner state machine
    this.builderRepairTask = null; // Master builder autonomous repair state machine
    this.needState = null;        // 'seeking_food', 'seeking_water', 'resting', 'seeking_medical'
    this.needTimer = 0;

    // ── Combat System (all survivors can shoot) ───────────────────────────
    this.combatXP = 0;           // Combat experience (auto-upgrades damage)
    this.combatLevel = 1;        // 1-10: +8% damage per level
    this.shootTimer = Math.random() * 2; // Staggered initial fire
    this.bossMode = false;       // True when boss is active → go to surface & shoot
    this.surfaceX = 0;           // Assigned surface combat position
    this.surfaceY = CONFIG.SURFACE_Y || 240;
    this.isShooting = false;
    this.shootFlash = 0;         // Muzzle flash timer

    // ── Sniper Logistics (supply runner & rest rotation) ──────────────────
    this.isSniperSupplyRunner = false; // This survivor is bringing food/water to sniper
    this.sniperSupplyTimer = 0;
    this.isTakingSniperShift = false;  // This survivor is resting after sniper duty
    this.sniperShiftTimer = 0;

    // Autonomous action timers
    this.sniperTimer = Math.random() * 2;
    this.medicTriageTimer = 0;
    this.demoCraftTimer = 0;

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

  // ── Combat System ──────────────────────────────────────────────────────────
  // Combat damage scales with combatLevel (+8% per level) and role bonus
  getCombatDamage() {
    const base = 18 + this.combatLevel * 4; // 22–58 base damage
    const roleBonus = {
      'sniper': 3.2, 'marksman': 2.8, 'soldier': 2.0, 'demolitionist': 1.8,
      'security': 1.6, 'engineer': 1.2, 'builder': 1.1, 'medic': 1.0,
      'scientist': 0.9, 'farmer': 0.85, 'cook': 0.85, 'porter': 1.0
    };
    const rb = roleBonus[(this.role || '').toLowerCase()] || 1.0;
    return base * rb * (this.getEfficiency ? this.getEfficiency() : 1.0);
  }

  addCombatXP(amount) {
    if (this.isDead) return;
    this.combatXP = (this.combatXP || 0) + amount;
    const needed = 80 + this.combatLevel * 40;
    if (this.combatXP >= needed && this.combatLevel < 10) {
      this.combatXP -= needed;
      this.combatLevel++;
      this.say(`🎯 Combat Lvl ${this.combatLevel}!`, 2.5);
    }
  }

  // Fire at a target (zombie or boss) — all survivors can shoot
  shoot(target, engine, dt) {
    if (this.isDead || !target) return;
    const role = (this.role || '').toLowerCase();
    // Fire rate by role (seconds between shots)
    const isSniper = role.includes('sniper') || role.includes('marksman');
    const isMedic = role.includes('medic') || role.includes('cook') || role.includes('farm');
    const fireRate = isSniper ? 1.5 : isMedic ? 2.8 : 1.8;

    this.shootTimer = (this.shootTimer || 0) + dt;
    if (this.shootTimer < fireRate) return;
    if (engine.resources.ammo < 1) return;

    this.shootTimer = 0;
    engine.resources.ammo = Math.max(0, engine.resources.ammo - 1);

    const dmg = this.getCombatDamage();
    const headshot = isSniper && Math.random() < 0.4;
    const finalDmg = headshot ? dmg * 1.8 : dmg;

    if (target.takeDamage) target.takeDamage(finalDmg);
    this.addCombatXP(headshot ? 20 : 10);
    this.addXP && this.addXP(headshot ? 12 : 6);

    // Muzzle flash VFX
    this.shootFlash = 0.12;
    const tx = target.x, ty = target.y - (target.size || 14) * 0.7;
    if (engine.particles) {
      const a = Math.atan2(ty - this.y, tx - this.x);
      engine.particles.spawnSparks(this.x + Math.cos(a) * 8, this.y - 8, 4, '#FFE57F');
      // Tracer dot
      engine.particles.particles.push({
        x: this.x, y: this.y - 8,
        vx: Math.cos(a) * 180, vy: Math.sin(a) * 180,
        life: 0.08, maxLife: 0.08, size: 2,
        color: isSniper ? '#FFD700' : '#FFCC44',
        gravity: 0, type: 'tracer'
      });
      if (headshot && engine.particles.addFloatingText) {
        engine.particles.addFloatingText(tx, ty - 12, `HEADSHOT -${Math.floor(finalDmg)}`, '#FFD700');
      }
    }

    // Audio: staggered so not all fire simultaneously
    if (Math.random() < 0.4 && window.soundSystem) {
      isSniper ? window.soundSystem.playSniperShot() : window.soundSystem.playGunshot();
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

    const nameLower = (this.name || '').toLowerCase();
    const roleLower = (this.role || '').toLowerCase();

    // Elena / Carlos / Engineer: Sparks emitting when crafting / repairing in workshop
    const isEngineer = nameLower.includes('elena') || nameLower.includes('carlos') || this.specialty === 'workshop' || this.assignedRoom === 'workshop';
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

    // 2. High-Priority Autonomous Ammo Delivery Task Execution
    if (this.ammoDeliveryTask) {
      this.updateAmmoDelivery(dt);
      this.performMovement(dt);
      return;
    }

    // 3. Carlos: Autonomous Defense & Barricade Repair Task Execution
    if (this.builderRepairTask) {
      this.updateBuilderRepair(dt);
      this.performMovement(dt);
      return;
    }

    // 4. Maya: Autonomous Electrical Engineer Emergency Power Task
    const isMaya = nameLower.includes('maya') || roleLower.includes('electrical') || this.specialty === 'generator';
    if (isMaya && !this.inElevator && !this.needState) {
      if (engine.resources.power < 30 && engine.resources.fuel > 0) {
        if (this.status !== 'emergency_power') {
          this.status = 'emergency_power';
          this.say("⚡ Power critical! Rushing to generator!", 2.5);
        }
      }
      if (this.status === 'emergency_power') {
        const genRoom = engine.getRoom('generator');
        if (genRoom) {
          this.targetX = genRoom.x + 32;
          this.targetY = elevator.getFloorWalkY(genRoom.floor);
          if (Math.hypot(this.x - this.targetX, this.y - this.targetY) < 18) {
            // Overclock generator
            engine.resources.power = Math.min(CONFIG.RESOURCE_CAPS.power, engine.resources.power + 28 * dt);
            this.craftSparkTimer = (this.craftSparkTimer || 0) + dt;
            if (this.craftSparkTimer >= 0.25) {
              this.craftSparkTimer = 0;
              engine.particles.spawnSparks(this.x + 4, this.y - 12, 3, '#00f3ff');
            }
            this.addXP(CONFIG.SURVIVOR_XP_PER_SEC_WORKING * 1.5 * dt);
            if (engine.resources.power >= 78 || engine.resources.fuel <= 0) {
              this.status = 'working';
              this.say("⚡ Power grid stabilized! Back to duty.", 2.5);
              this.assignTo(this.assignedRoom);
            }
          }
        }
      }
    }

    // 5. Carlos: Check Damaged Cabin Barricade & Turrets
    const isCarlos = nameLower.includes('carlos') || roleLower.includes('builder') || roleLower.includes('architect');
    if (isCarlos && !this.builderRepairTask && this.status !== 'resting' && !this.inElevator && !this.needState) {
      const houseDamaged = engine.houseHp < engine.houseMaxHp - 50;
      const leftDamaged = engine.leftTurret.health < engine.leftTurret.maxHealth - 25;
      const rightDamaged = engine.rightTurret.health < engine.rightTurret.maxHealth - 25;
      if ((houseDamaged || leftDamaged || rightDamaged) && engine.resources.metal >= 10) {
        let repairTarget = 'house';
        if (leftDamaged && (!houseDamaged || engine.leftTurret.health < engine.houseHp * 0.4)) repairTarget = 'left';
        else if (rightDamaged && (!houseDamaged || engine.rightTurret.health < engine.houseHp * 0.4)) repairTarget = 'right';
        this.builderRepairTask = { target: repairTarget, phase: 'to_elevator' };
        this.status = 'repairing_defenses';
        this.say("🔧 Defenses damaged! Mobilizing repairs!", 2.5);
      }
    }

    // 6. Jackson: Watchtower Sniper Precision Overwatch
    const isJackson = nameLower.includes('jackson') || roleLower.includes('sniper') || roleLower.includes('marksman');
    if (isJackson && !this.inElevator && this.status !== 'resting') {
      this.sniperTimer = (this.sniperTimer || 0) + dt;
      if (this.sniperTimer >= 3.2) {
        this.sniperTimer = 0;
        const liveZombies = engine.zombies.filter(z => !z.isDead);
        if (liveZombies.length > 0) {
          let targetZ = null;
          if (engine.refugees && engine.refugees.length > 0) {
            const activeRef = engine.refugees.find(r => !r.isDead && !r.isRescued);
            if (activeRef) {
              targetZ = liveZombies.find(z => Math.abs(z.x - activeRef.x) < 140);
            }
          }
          if (!targetZ) {
            targetZ = liveZombies.find(z => z.typeKey === 'brute') || liveZombies.find(z => z.typeKey === 'spitter') || liveZombies[0];
          }
          if (targetZ) {
            targetZ.takeDamage(125);
            engine.particles.spawnSparks(targetZ.x, targetZ.y - targetZ.size * 0.6, 16, '#ff4757');
            engine.particles.addFloatingText("🎯 SNIPER HEADSHOT! (-125)", targetZ.x - 30, targetZ.y - 45, '#ffd700');
            if (window.soundSystem) {
              if (typeof window.soundSystem.playTurretFire === 'function') window.soundSystem.playTurretFire('left');
              else if (typeof window.soundSystem.playGunshot === 'function') window.soundSystem.playGunshot('heavy');
            }
            this.addXP(CONFIG.SURVIVOR_XP_AMMO_RUN * 0.4);
            if (Math.random() < 0.3) this.say("Target eliminated. Down in one.", 2);
          }
        }
      }
    }

    // 7. Lucas: Combat Medic Triage & Medkit Production
    const isLucas = nameLower.includes('lucas') || roleLower.includes('combat medic');
    if (isLucas && this.assignedRoom === 'clinic' && !this.isDead) {
      this.medicTriageTimer = (this.medicTriageTimer || 0) + dt;
      if (this.medicTriageTimer >= 12.0) {
        this.medicTriageTimer = 0;
        if (engine.resources.meds < CONFIG.RESOURCE_CAPS.meds) {
          engine.resources.meds = Math.min(CONFIG.RESOURCE_CAPS.meds, engine.resources.meds + 1);
          engine.particles.addFloatingText("+1 FIRST AID KIT!", this.x - 20, this.y - 30, '#00d2d3');
          this.addXP(20);
        }
      }
    }

    // 8. Boris: Heavy Demolitionist HE Munitions Crafting
    const isBoris = nameLower.includes('boris') || roleLower.includes('demolition');
    if (isBoris && (this.assignedRoom === 'armory' || this.assignedRoom === 'gunpowder_lab') && !this.isDead) {
      this.demoCraftTimer = (this.demoCraftTimer || 0) + dt;
      if (this.demoCraftTimer >= 22.0) {
        this.demoCraftTimer = 0;
        engine.particles.addFloatingText("💣 HE MUNITIONS READY!", this.x - 20, this.y - 30, '#ff9f43');
        if (Math.random() < 0.4) this.say("Ordnance packed and ready to boom!", 2.5);
        this.addXP(30);
      }
    }

    // 9. Autonomous Needs Routing
    this.updateAutonomousNeeds(dt);

    // 10. Movement towards target
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
      this.targetX = armory.x + armory.width / 2;
      this.targetY = armoryWalkY;

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
      this.targetX = CONFIG.ELEVATOR_X - 16;
      this.targetY = armoryWalkY;

      if (Math.abs(this.x - this.targetX) < 10) {
        if (elevator.isAtFloor(1)) {
          elevator.board(this);
          elevator.moveToFloor(0);
          task.phase = 'riding_to_surface';
          this.say("Taking lift to surface...", 2);
        } else {
          elevator.moveToFloor(1);
        }
      }
    } else if (task.phase === 'riding_to_surface') {
      if (elevator.isAtFloor(0)) {
        elevator.exit(this);
        this.x = CONFIG.ELEVATOR_X;
        this.y = CONFIG.SURFACE_Y;
        task.phase = 'running_to_turret';
        this.say("Surface breached! Running to turret!", 2);
      }
    } else if (task.phase === 'running_to_turret') {
      const turretStopX = turret.side === 'left' ? turret.x + 24 : turret.x - 24;
      this.targetX = turretStopX;
      this.targetY = CONFIG.SURFACE_Y;

      if (Math.abs(this.x - turretStopX) < 14) {
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

  // Carlos: Autonomous Builder Defense Repairs
  updateBuilderRepair(dt) {
    const engine = window.gameEngine;
    const elevator = engine.elevator;
    const task = this.builderRepairTask;
    if (!task) return;

    if (task.phase === 'to_elevator') {
      const room = engine.getRoom(this.assignedRoom);
      const floor = room ? room.floor : 3;
      const walkY = elevator.getFloorWalkY(floor);
      this.targetX = CONFIG.ELEVATOR_X - 16;
      this.targetY = walkY;

      if (Math.abs(this.x - this.targetX) < 12) {
        if (elevator.isAtFloor(floor)) {
          elevator.board(this);
          elevator.moveToFloor(0);
          task.phase = 'riding_to_surface';
          this.say("Taking lift to surface for emergency repairs!", 2);
        } else {
          elevator.moveToFloor(floor);
        }
      }
    } else if (task.phase === 'riding_to_surface') {
      if (elevator.isAtFloor(0)) {
        elevator.exit(this);
        this.x = CONFIG.ELEVATOR_X;
        this.y = CONFIG.SURFACE_Y;
        task.phase = 'running_to_defense';
      }
    } else if (task.phase === 'running_to_defense') {
      let destX = 640;
      if (task.target === 'left') destX = engine.leftTurret.x;
      else if (task.target === 'right') destX = engine.rightTurret.x;
      this.targetX = destX;
      this.targetY = CONFIG.SURFACE_Y;

      if (Math.abs(this.x - destX) < 18) {
        if (engine.resources.metal >= 10) {
          engine.resources.metal -= 10;
          if (task.target === 'house') {
            engine.houseHp = Math.min(engine.houseMaxHp, engine.houseHp + 70);
            engine.particles.addFloatingText("+70 HP REPAIRED", destX, CONFIG.SURFACE_Y - 30, '#55ffaa');
          } else if (task.target === 'left') {
            engine.leftTurret.health = Math.min(engine.leftTurret.maxHealth, engine.leftTurret.health + 45);
            engine.particles.addFloatingText("+45 HP REPAIRED", destX, CONFIG.SURFACE_Y - 30, '#55ffaa');
          } else {
            engine.rightTurret.health = Math.min(engine.rightTurret.maxHealth, engine.rightTurret.health + 45);
            engine.particles.addFloatingText("+45 HP REPAIRED", destX, CONFIG.SURFACE_Y - 30, '#55ffaa');
          }
          engine.particles.spawnSparks(destX, CONFIG.SURFACE_Y - 15, 20, '#ffd700');
          if (window.soundSystem) window.soundSystem.playBeep(true);
          this.addXP(CONFIG.SURVIVOR_XP_AMMO_RUN);
        }
        this.say("Repairs complete! Fortifications holding!", 2);
        task.phase = 'returning_to_cabin';
      }
    } else if (task.phase === 'returning_to_cabin') {
      this.targetX = CONFIG.ELEVATOR_X;
      this.targetY = CONFIG.SURFACE_Y;

      if (Math.abs(this.x - CONFIG.ELEVATOR_X) < 12) {
        if (elevator.isAtFloor(0)) {
          elevator.board(this);
          const room = engine.getRoom(this.assignedRoom);
          const destFloor = room ? room.floor : 3;
          elevator.moveToFloor(destFloor);
          task.destFloor = destFloor;
          task.phase = 'riding_to_workshop';
          this.say("Returning to bunker workshop...", 2);
        } else {
          elevator.moveToFloor(0);
        }
      }
    } else if (task.phase === 'riding_to_workshop') {
      if (elevator.isAtFloor(task.destFloor || 3)) {
        elevator.exit(this);
        this.x = CONFIG.ELEVATOR_X;
        this.y = elevator.getFloorWalkY(task.destFloor || 3);
        this.builderRepairTask = null;
        this.status = 'working';
        this.assignTo(this.assignedRoom);
        this.say("Safe inside! Back to construction bench.", 2);
      }
    }
  }

  updateAutonomousNeeds(dt) {
    const engine = window.gameEngine;
    const res = engine.resources;
    const elevator = engine.elevator;

    // Trigger needs if thresholds crossed
    if (!this.needState) {
      if (this.hp < 65 && res.meds >= 1) {
        this.needState = 'seeking_medical';
        this.status = 'seeking_medical';
        this.needTimer = 0;
        this.say("Wounded... heading to medical clinic.", 2);
      } else if (this.thirst < CONFIG.THIRST_THRESHOLD && res.water >= 1) {
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
    if (this.needState === 'seeking_medical') {
      const clinic = engine.getRoom('clinic');
      if (clinic) {
        const destY = elevator.getFloorWalkY(clinic.floor);
        this.targetX = clinic.x + 35;
        this.targetY = destY;

        if (Math.hypot(this.x - this.targetX, this.y - this.targetY) < 16) {
          this.needTimer += dt;
          this.hp = Math.min(this.maxHp, this.hp + dt * 25.0);
          if (engine.particles && Math.random() < 0.25) {
            engine.particles.spawnSparks(this.x, this.y - 15, 3, '#00d2d3');
          }
          if (this.hp >= this.maxHp) {
            this.hp = this.maxHp;
            this.needState = null;
            this.status = 'working';
            this.needTimer = 0;
            this.say("Fully patched up and ready!", 2);
            this.assignTo(this.assignedRoom);
          }
        }
      }
    } else if (this.needState === 'seeking_water') {
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
      const q = engine.getRoom('quarters_1') || engine.getRoom('quarters_2');
      if (q) {
        const destY = elevator.getFloorWalkY(q.floor);
        this.targetX = q.x + 35;
        this.targetY = destY;

        if (Math.hypot(this.x - this.targetX, this.y - this.targetY) < 16) {
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
    const isElena = (nameL.includes('elena') || roleL.includes('engineer') || roleL.includes('mechanic')) && !nameL.includes('maya') && !roleL.includes('electrical');
    const isSarah = nameL.includes('sarah') || roleL.includes('physician') || roleL.includes('doctor');
    const isToby = nameL.includes('toby') || roleL.includes('botanist') || roleL.includes('agri') || spec === 'hydroponics';
    const isAiden = (nameL.includes('aiden') || roleL.includes('guard') || roleL.includes('security')) && !nameL.includes('jackson') && !roleL.includes('sniper');

    const isJackson = nameL.includes('jackson') || roleL.includes('sniper') || roleL.includes('marksman');
    const isMaya = nameL.includes('maya') || roleL.includes('electrical');
    const isCarlos = nameL.includes('carlos') || roleL.includes('builder') || roleL.includes('architect');
    const isSamantha = nameL.includes('samantha') || roleL.includes('porter') || roleL.includes('courier');
    const isLucas = nameL.includes('lucas') || roleL.includes('combat medic');
    const isBoris = nameL.includes('boris') || roleL.includes('demolition');

    const arc = { isMarcus, isElena, isSarah, isToby, isAiden, isJackson, isMaya, isCarlos, isSamantha, isLucas, isBoris };

    // Resting sleep posture: when resting at living quarters
    const isResting = (this.status === 'resting' || this.needState === 'resting') &&
      ((this.assignedRoom && this.assignedRoom.startsWith('quarters')) || (!this.isMoving && Math.hypot(this.x - this.targetX, this.y - this.targetY) < 18));

    if (isResting) {
      this.drawSleeping(ctx, arc);
      return;
    }

    ctx.save();
    ctx.translate(this.x, this.y);

    const movingLeft = this.facing === -1 || (this.targetX < this.x - 2);
    if (movingLeft) ctx.scale(-1, 1);

    const breath = !this.isMoving ? Math.sin(this.idleTime * 2.5) * 0.85 : 0;
    const bob = this.isMoving ? Math.abs(Math.sin(this.walkCycle)) * 2.2 : breath;
    const legSwing = this.isMoving ? Math.cos(this.walkCycle) * 4.5 : 0;
    const armSwing = this.isMoving ? Math.sin(this.walkCycle) * 5.0 : Math.sin(this.idleTime * 1.5) * 1.2;

    if (this.carryingAmmo) {
      ctx.rotate(0.09);
    }

    // 1. LEGS & ARTICULATED BOOTS
    this.drawSurvivorLegs(ctx, legSwing, bob, arc);

    // 2. TORSO & ROLE-SPECIFIC COSTUMES
    this.drawSurvivorTorso(ctx, bob, arc);

    // 3. HEAD, HAIR, CAPS & EYE ACCENTS
    this.drawSurvivorHead(ctx, bob, arc);

    // 4. ARMS, HELD TOOLS & TASK ANIMATIONS
    this.drawSurvivorArmsAndItems(ctx, bob, armSwing, arc);

    // 5. STATUS OVERLAYS
    this.drawSurvivorOverlays(ctx, bob, movingLeft);

    ctx.restore();
  }

  // --- RESTING SLEEP POSTURE WITH FLOATING 'Zzz' ICONS ---
  drawSleeping(ctx, arc) {
    if (typeof arc !== 'object') {
      arc = { isMarcus: arguments[1], isElena: arguments[2], isSarah: arguments[3], isToby: arguments[4], isAiden: arguments[5] };
    }

    ctx.save();
    ctx.translate(this.x, this.y);

    const sleepBreath = Math.sin(this.idleTime * 1.5) * 0.9;

    // Bunk cot frame & mattress
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(-20, -6, 40, 5);
    ctx.fillStyle = '#1e272e';
    ctx.fillRect(-20, -1, 4, 3);
    ctx.fillRect(16, -1, 4, 3);

    // Soft mattress
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(-19, -10, 38, 4);

    // White fluffy pillow
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.ellipse(-13, -11, 5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head resting on pillow
    ctx.fillStyle = arc.isMarcus || arc.isToby ? '#f5cd79' : arc.isSarah ? '#ffeaa7' : '#ffdfba';
    ctx.beginPath();
    ctx.arc(-11, -12 + sleepBreath * 0.3, 4, 0, Math.PI * 2);
    ctx.fill();

    // Closed eyes
    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-12, -12 + sleepBreath * 0.3);
    ctx.lineTo(-9.5, -12 + sleepBreath * 0.3);
    ctx.stroke();

    // Resting headgear / accessory on bedpost
    if (arc.isMarcus) {
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 1;
      ctx.strokeRect(10, -11, 6, 3);
    } else if (arc.isElena) {
      ctx.fillStyle = '#f39c12';
      ctx.beginPath();
      ctx.arc(12, -10, 4, Math.PI, 0);
      ctx.fill();
    } else if (arc.isToby) {
      ctx.fillStyle = '#eccc68';
      ctx.beginPath();
      ctx.ellipse(12, -9, 6, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (arc.isAiden) {
      ctx.fillStyle = '#1b4332';
      ctx.beginPath();
      ctx.ellipse(12, -10, 4, 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (arc.isJackson) {
      ctx.fillStyle = '#2d4a22';
      ctx.beginPath();
      ctx.ellipse(12, -10, 4.5, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1e272e';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(15, -4); ctx.lineTo(19, -15);
      ctx.stroke();
    } else if (arc.isMaya) {
      ctx.fillStyle = '#f39c12';
      ctx.fillRect(10, -11, 6, 3);
    } else if (arc.isCarlos) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(12, -10, 4, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#2980b9';
      ctx.fillRect(14, -8, 5, 2);
    } else if (arc.isSamantha) {
      ctx.fillStyle = '#ff7675';
      ctx.fillRect(11, -6, 5, 2.5);
    } else if (arc.isLucas) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(10, -11, 5, 5);
      ctx.fillStyle = '#eb4d4b';
      ctx.fillRect(11.5, -9.5, 2, 2);
    } else if (arc.isBoris) {
      ctx.fillStyle = '#576574';
      ctx.fillRect(10, -11, 6, 3.5);
    }

    // Cozy bunker quilted blanket
    ctx.fillStyle = '#334155';
    ctx.fillRect(-6, -12 + sleepBreath * 0.7, 24, 7);
    ctx.fillStyle = '#475569';
    ctx.fillRect(-7, -13 + sleepBreath * 0.7, 25, 2);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-2, -11 + sleepBreath * 0.7); ctx.lineTo(6, -6);
    ctx.moveTo(6, -11 + sleepBreath * 0.7); ctx.lineTo(14, -6);
    ctx.stroke();

    // Floating animated 'Zzz' icons
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

    // Health pip and name tag
    const hpRatio = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = hpRatio > 0.5 ? '#2ecc71' : '#e74c3c';
    ctx.fillRect(-8, -20, 16 * hpRatio, 2);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    const shortName = this.name.split(' ')[0];
    ctx.fillText(`${shortName} (Sleeping)`, 0, -23);

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
  drawSurvivorLegs(ctx, legSwing, bob, arc) {
    if (typeof arc !== 'object') {
      arc = { isMarcus: arguments[3], isElena: arguments[4], isSarah: arguments[5], isToby: arguments[6], isAiden: arguments[7] };
    }

    let pantsColor = '#2980b9';
    let bootColor = '#1e272e';

    if (arc.isMarcus) {
      pantsColor = '#243342';
      bootColor = '#3a2618';
    } else if (arc.isElena) {
      pantsColor = '#ff5722';
      bootColor = '#1a1a1a';
    } else if (arc.isSarah) {
      pantsColor = '#16a085';
      bootColor = '#f8fafc';
    } else if (arc.isToby) {
      pantsColor = '#4a3728';
      bootColor = '#2f1f14';
    } else if (arc.isAiden) {
      pantsColor = '#2f3640';
      bootColor = '#111111';
    } else if (arc.isJackson) {
      pantsColor = '#2d4a22';
      bootColor = '#1b261b';
    } else if (arc.isMaya) {
      pantsColor = '#2c3e50';
      bootColor = '#111111';
    } else if (arc.isCarlos) {
      pantsColor = '#1f3a52';
      bootColor = '#4a2f18';
    } else if (arc.isSamantha) {
      pantsColor = '#0f172a';
      bootColor = '#ff7675';
    } else if (arc.isLucas) {
      pantsColor = '#4b6584';
      bootColor = '#f8fafc';
    } else if (arc.isBoris) {
      pantsColor = '#1e272e';
      bootColor = '#2f3640';
    }

    // Back leg
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

    // Front leg
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

    if (arc.isElena) {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-4.5 + legSwing, -4, 4, 1.2);
    }
  }

  // --- 2. TORSO & ROLE-SPECIFIC COSTUMES ---
  drawSurvivorTorso(ctx, bob, arc) {
    if (typeof arc !== 'object') {
      arc = { isMarcus: arguments[2], isElena: arguments[3], isSarah: arguments[4], isToby: arguments[5], isAiden: arguments[6] };
    }

    const torsoY = -17 + bob;
    const torsoW = 9;
    const torsoH = 10.5;

    if (arc.isMarcus) {
      ctx.fillStyle = '#47535e';
      ctx.fillRect(-torsoW / 2, torsoY, torsoW, torsoH);

      ctx.fillStyle = '#8b4513';
      ctx.fillRect(-torsoW / 2 + 0.5, torsoY + 1.5, torsoW - 1, torsoH - 1.5);
      ctx.fillStyle = '#6e340d';
      ctx.fillRect(-torsoW / 2 + 1, torsoY + 5, torsoW - 2, 4);

      ctx.strokeStyle = '#5a2507';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-torsoW / 2 + 1, torsoY); ctx.lineTo(-1, torsoY + 4);
      ctx.moveTo(torsoW / 2 - 1, torsoY); ctx.lineTo(1, torsoY + 4);
      ctx.stroke();

      ctx.fillStyle = '#ffd700';
      ctx.fillRect(-2, torsoY + 1, 1.2, 1.2);
      ctx.fillRect(1, torsoY + 1, 1.2, 1.2);

      ctx.fillStyle = '#3a1d0d';
      ctx.fillRect(-torsoW / 2, torsoY + torsoH - 2.5, torsoW, 2);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(-1, torsoY + torsoH - 2.5, 2, 2);
    } else if (arc.isElena) {
      ctx.fillStyle = '#ff5722';
      ctx.fillRect(-torsoW / 2, torsoY, torsoW, torsoH);

      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-torsoW / 2, torsoY + 2.5, torsoW, 1.8);
      ctx.fillRect(-torsoW / 2, torsoY + 6.5, torsoW, 1.8);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-1, torsoY + 2.5, 2, 1.8);

      ctx.fillStyle = '#2d3436';
      ctx.fillRect(-torsoW / 2, torsoY + torsoH - 2, torsoW, 2);
    } else if (arc.isSarah) {
      ctx.fillStyle = '#1abc9c';
      ctx.fillRect(-torsoW / 2, torsoY, torsoW, torsoH);

      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(-torsoW / 2 - 0.5, torsoY, 3, torsoH + 1.5);
      ctx.fillRect(torsoW / 2 - 2.5, torsoY, 3, torsoH + 1.5);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-torsoW / 2 + 1, torsoY + 3.5, 2, 3);

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-3, torsoY);
      ctx.lineTo(-1, torsoY + 4.5);
      ctx.lineTo(2, torsoY + 4.5);
      ctx.lineTo(3, torsoY);
      ctx.stroke();

      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(0.5, torsoY + 4.8, 1.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(torsoW / 2 - 2, torsoY + torsoH - 4, 4.5, 4.5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(torsoW / 2 - 0.5, torsoY + torsoH - 3.2, 1.5, 3);
      ctx.fillRect(torsoW / 2 - 1.2, torsoY + torsoH - 2.4, 3, 1.5);
    } else if (arc.isToby) {
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(-torsoW / 2, torsoY, torsoW, torsoH);

      ctx.fillStyle = '#2c0b0e';
      ctx.fillRect(-torsoW / 2, torsoY + 2.5, torsoW, 1.5);
      ctx.fillRect(-torsoW / 2, torsoY + 6.5, torsoW, 1.5);
      ctx.fillRect(-1.5, torsoY, 1.5, torsoH);
      ctx.fillRect(2, torsoY, 1.5, torsoH);

      ctx.fillStyle = '#2980b9';
      ctx.fillRect(-torsoW / 2 + 1, torsoY + 5.5, torsoW - 2, torsoH - 5.5);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(-2.5, torsoY + 6, 1.2, 1.2);
      ctx.fillRect(1.5, torsoY + 6, 1.2, 1.2);

      ctx.fillStyle = '#2ecc71';
      ctx.beginPath();
      ctx.arc(1.5, torsoY + 4.5, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (arc.isAiden) {
      ctx.fillStyle = '#353b48';
      ctx.fillRect(-torsoW / 2, torsoY, torsoW, torsoH);

      ctx.fillStyle = '#1e272e';
      ctx.fillRect(-torsoW / 2 - 0.5, torsoY + 0.5, torsoW + 1, torsoH - 1.5);

      ctx.fillStyle = '#2f3640';
      ctx.fillRect(-torsoW / 2 + 1, torsoY + 4.5, 3.2, 3.5);
      ctx.fillRect(0.5, torsoY + 4.5, 3.2, 3.5);

      ctx.fillStyle = '#18191a';
      ctx.fillRect(-torsoW / 2 - 1, torsoY - 2, 2.5, 4);
      ctx.strokeStyle = '#2f3640';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-torsoW / 2 + 0.2, torsoY - 2);
      ctx.lineTo(-torsoW / 2 + 0.2, torsoY - 6);
      ctx.stroke();

      const ledOn = Math.floor(this.idleTime * 2.8) % 2 === 0;
      ctx.fillStyle = ledOn ? '#00ff66' : '#0e4418';
      ctx.beginPath();
      ctx.arc(-torsoW / 2 + 0.2, torsoY - 0.5, 1.0, 0, Math.PI * 2);
      ctx.fill();
    } else if (arc.isJackson) {
      // Jackson (Master Sniper): Camo ghillie mantle & sniper chest rig
      ctx.fillStyle = '#1e2f18';
      ctx.fillRect(-torsoW / 2, torsoY, torsoW, torsoH);

      ctx.fillStyle = '#3b5e2b';
      ctx.beginPath();
      ctx.moveTo(-torsoW / 2 - 1, torsoY);
      ctx.lineTo(torsoW / 2 + 1, torsoY);
      ctx.lineTo(torsoW / 2, torsoY + 4.5);
      ctx.lineTo(-torsoW / 2, torsoY + 4.5);
      ctx.fill();

      ctx.fillStyle = '#243b1c';
      ctx.fillRect(-torsoW / 2 + 1, torsoY + 5, 3.2, 3.5);
      ctx.fillRect(0.5, torsoY + 5, 3.2, 3.5);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(-1, torsoY + 1.5, 2, 2);
    } else if (arc.isMaya) {
      // Maya (Electrical Engineer): High-voltage electrician suit with lightning badge
      ctx.fillStyle = '#1a252f';
      ctx.fillRect(-torsoW / 2, torsoY, torsoW, torsoH);

      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(-torsoW / 2, torsoY + 2, torsoW, 1.2);
      ctx.fillRect(-torsoW / 2, torsoY + 7, torsoW, 1.2);

      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.moveTo(1, torsoY + 3.5);
      ctx.lineTo(-1.5, torsoY + 6);
      ctx.lineTo(0.5, torsoY + 6);
      ctx.lineTo(-1, torsoY + 8.5);
      ctx.lineTo(2, torsoY + 5.5);
      ctx.lineTo(0, torsoY + 5.5);
      ctx.closePath();
      ctx.fill();
    } else if (arc.isCarlos) {
      // Carlos (Master Builder): Canvas vest & blueprint roll on back
      ctx.fillStyle = '#b33927';
      ctx.fillRect(-torsoW / 2, torsoY, torsoW, torsoH);

      ctx.fillStyle = '#d35400';
      ctx.fillRect(-torsoW / 2 - 0.5, torsoY, 2.5, torsoH);
      ctx.fillRect(torsoW / 2 - 2, torsoY, 2.5, torsoH);

      ctx.fillStyle = '#5c3a21';
      ctx.fillRect(-torsoW / 2, torsoY + torsoH - 2.5, torsoW, 2.5);
      ctx.fillStyle = '#7f8c8d';
      ctx.fillRect(-torsoW / 2 - 1.5, torsoY + torsoH - 1, 2, 3);

      ctx.fillStyle = '#ecf0f1';
      ctx.save();
      ctx.rotate(-0.35);
      ctx.fillRect(-torsoW / 2 - 3, torsoY - 1, 3.5, 12);
      ctx.fillStyle = '#2980b9';
      ctx.fillRect(-torsoW / 2 - 3, torsoY + 1, 3.5, 1.5);
      ctx.fillRect(-torsoW / 2 - 3, torsoY + 7, 3.5, 1.5);
      ctx.restore();
    } else if (arc.isSamantha) {
      // Samantha (Logistics Porter): Sleek speed courier jersey with orange chevron
      ctx.fillStyle = '#0984e3';
      ctx.fillRect(-torsoW / 2, torsoY, torsoW, torsoH);

      ctx.fillStyle = '#e17055';
      ctx.beginPath();
      ctx.moveTo(-torsoW / 2, torsoY + 3);
      ctx.lineTo(0, torsoY + 6);
      ctx.lineTo(torsoW / 2, torsoY + 3);
      ctx.lineTo(torsoW / 2, torsoY + 4.8);
      ctx.lineTo(0, torsoY + 7.8);
      ctx.lineTo(-torsoW / 2, torsoY + 4.8);
      ctx.fill();

      ctx.strokeStyle = '#2d3436';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-torsoW / 2 + 1, torsoY);
      ctx.lineTo(torsoW / 2, torsoY + torsoH);
      ctx.stroke();
    } else if (arc.isLucas) {
      // Lucas (Combat Medic): Tactical medical vest with Red Cross emblem
      ctx.fillStyle = '#f1f2f6';
      ctx.fillRect(-torsoW / 2, torsoY, torsoW, torsoH);

      ctx.fillStyle = '#eb4d4b';
      ctx.fillRect(-1.2, torsoY + 3, 2.4, 6);
      ctx.fillRect(-3, torsoY + 4.8, 6, 2.4);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-torsoW / 2 - 1, torsoY + 1, 2.5, 3.5);
      ctx.fillStyle = '#eb4d4b';
      ctx.fillRect(-torsoW / 2 - 0.5, torsoY + 1.8, 1.5, 2);
    } else if (arc.isBoris) {
      // Boris (Heavy Demolitionist): Heavy blast flak jacket with 40mm grenade bandolier sash
      ctx.fillStyle = '#2d3436';
      ctx.fillRect(-torsoW / 2 - 0.5, torsoY, torsoW + 1, torsoH);

      ctx.fillStyle = '#1e272e';
      ctx.fillRect(-torsoW / 2, torsoY - 1, torsoW, 2);

      ctx.strokeStyle = '#636e72';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(-torsoW / 2, torsoY + 1);
      ctx.lineTo(torsoW / 2, torsoY + torsoH - 1);
      ctx.stroke();

      ctx.fillStyle = '#d4af37';
      ctx.fillRect(-2.5, torsoY + 2.5, 2, 2.5);
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(0.5, torsoY + 5.5, 2, 2.5);
    } else {
      ctx.fillStyle = this.specialty === 'armory' ? '#d35400' :
                      this.specialty === 'clinic' ? '#27ae60' :
                      this.specialty === 'workshop' ? '#f39c12' : '#2980b9';
      ctx.fillRect(-torsoW / 2, torsoY, torsoW, torsoH);
    }
  }

  // --- 3. HEAD, HAIR, CAPS & ACCESSORIES ---
  drawSurvivorHead(ctx, bob, arc) {
    if (typeof arc !== 'object') {
      arc = { isMarcus: arguments[2], isElena: arguments[3], isSarah: arguments[4], isToby: arguments[5], isAiden: arguments[6] };
    }

    const headY = -21 + bob;
    const skinColor = arc.isMarcus || arc.isToby ? '#f5cd79' : arc.isSarah ? '#ffeaa7' : arc.isAiden ? '#f0c294' : '#ffdfba';

    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(0, headY, 4.4, 0, Math.PI * 2);
    ctx.fill();

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

    if (arc.isMarcus) {
      ctx.fillStyle = 'rgba(50, 30, 15, 0.35)';
      ctx.fillRect(0.5, headY + 1.2, 3, 2);

      ctx.fillStyle = '#3a2010';
      ctx.beginPath();
      ctx.arc(0, headY - 1.5, 4.5, Math.PI, 0);
      ctx.fill();

      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-4.2, headY - 1.8);
      ctx.lineTo(4.2, headY - 1.8);
      ctx.stroke();

      ctx.fillStyle = '#d4af37';
      ctx.fillRect(-1.8, headY - 3.8, 2.5, 2.5);
      ctx.fillRect(1.0, headY - 3.8, 2.5, 2.5);
      ctx.fillStyle = '#2e4a28';
      ctx.fillRect(-1.3, headY - 3.3, 1.5, 1.5);
      ctx.fillRect(1.5, headY - 3.3, 1.5, 1.5);
    } else if (arc.isElena) {
      ctx.fillStyle = '#2c1810';
      ctx.beginPath();
      ctx.arc(-4, headY + 1, 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f39c12';
      ctx.beginPath();
      ctx.arc(0, headY - 1.2, 4.8, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#d68910';
      ctx.fillRect(-2, headY - 1.5, 7, 1.5);

      ctx.fillStyle = '#1c2833';
      ctx.fillRect(1.5, headY - 3.5, 3.8, 2);
      ctx.strokeStyle = '#7f8c8d';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(1.5, headY - 3.5, 3.8, 2);
    } else if (arc.isSarah) {
      ctx.fillStyle = '#00d2d3';
      ctx.beginPath();
      ctx.arc(0, headY - 1.2, 4.6, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#01a3a4';
      ctx.fillRect(-4.2, headY - 1.5, 8.4, 1.5);
    } else if (arc.isToby) {
      ctx.fillStyle = '#eccc68';
      ctx.beginPath();
      ctx.ellipse(0, headY - 1.8, 8, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f5cd79';
      ctx.beginPath();
      ctx.arc(0, headY - 2.8, 3.8, Math.PI, 0);
      ctx.fill();

      ctx.fillStyle = '#27ae60';
      ctx.fillRect(-3.6, headY - 3.2, 7.2, 1.2);
    } else if (arc.isAiden) {
      ctx.fillStyle = '#1b4332';
      ctx.beginPath();
      ctx.ellipse(0.5, headY - 2.2, 4.8, 2.6, 0.25, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffd700';
      ctx.fillRect(1.5, headY - 3.2, 1.5, 1.5);
    } else if (arc.isJackson) {
      // Jackson: Camo tactical sniper cap & cyan optic
      ctx.fillStyle = '#2d4a22';
      ctx.beginPath();
      ctx.arc(0, headY - 1.5, 4.5, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(-3.5, headY - 1.8, 8, 1.4);

      ctx.fillStyle = '#00f3ff';
      ctx.fillRect(1.5, headY - 1.0, 2.0, 2.0);
    } else if (arc.isMaya) {
      // Maya: Amber electrical safety goggles & ponytail
      ctx.fillStyle = '#2c1810';
      ctx.beginPath();
      ctx.arc(-4, headY + 1, 2.0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f39c12';
      ctx.fillRect(-1.5, headY - 3.2, 5, 2);
      ctx.strokeStyle = '#2d3436';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(-1.5, headY - 3.2, 5, 2);
    } else if (arc.isCarlos) {
      // Carlos: White architect hardhat & carpenter pencil
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, headY - 1.5, 4.6, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#dcdde1';
      ctx.fillRect(-4.5, headY - 1.5, 9, 1.5);

      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(-3.5, headY - 1.2, 1.2, 3.5);
    } else if (arc.isSamantha) {
      // Samantha: Sporty running visor & high swept ponytail
      ctx.fillStyle = '#2d1508';
      ctx.beginPath();
      ctx.arc(-4.5, headY - 1.5, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e17055';
      ctx.beginPath();
      ctx.arc(0, headY - 1.2, 4.4, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(-1, headY - 1.5, 6, 1.5);
    } else if (arc.isLucas) {
      // Lucas: Field surgical headset
      ctx.fillStyle = '#2c1810';
      ctx.beginPath();
      ctx.arc(0, headY - 1.2, 4.4, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#00d2d3';
      ctx.beginPath();
      ctx.arc(1.5, headY - 2.5, 1.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (arc.isBoris) {
      // Boris: Rugged beard stubble & welded blast shield visor
      ctx.fillStyle = 'rgba(30, 20, 10, 0.45)';
      ctx.fillRect(0, headY + 1.2, 3.5, 2.5);
      ctx.fillStyle = '#576574';
      ctx.fillRect(-2, headY - 4.5, 6.5, 2.5);
      ctx.strokeStyle = '#2f3542';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(-2, headY - 4.5, 6.5, 2.5);
    } else {
      ctx.fillStyle = '#34495e';
      ctx.beginPath();
      ctx.arc(0, headY - 1.5, 4.4, Math.PI, 0);
      ctx.fill();
    }
  }

  // --- 4. ARMS, HELD TOOLS & TASK ANIMATIONS ---
  drawSurvivorArmsAndItems(ctx, bob, armSwing, arc) {
    if (typeof arc !== 'object') {
      arc = { isMarcus: arguments[3], isElena: arguments[4], isSarah: arguments[5], isToby: arguments[6], isAiden: arguments[7] };
    }

    const shoulderY = -15 + bob;

    // ── All-Hands Boss Combat: Holding Assault Rifle & Firing ───────────────
    if (this.bossMode) {
      const isShooting = (this.shootFlash || 0) > 0;
      const recoil = isShooting ? -2.5 : 0;

      // Arm holding rifle
      ctx.strokeStyle = '#2c3e50';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-1, shoulderY);
      ctx.lineTo(6 + recoil, shoulderY + 2);
      ctx.lineTo(12 + recoil, shoulderY + 1);
      ctx.stroke();

      // Tactical Rifle Body
      ctx.fillStyle = '#1e272e';
      ctx.fillRect(4 + recoil, shoulderY - 2, 13, 3.5);
      // Rifle Barrel
      ctx.fillStyle = '#485460';
      ctx.fillRect(17 + recoil, shoulderY - 1, 6, 1.8);
      // Rifle Stock
      ctx.fillStyle = '#3d3d3d';
      ctx.fillRect(1 + recoil, shoulderY - 1, 4, 3);
      // Curved Magazine
      ctx.fillStyle = '#2f3542';
      ctx.fillRect(9 + recoil, shoulderY + 1.5, 2.5, 4);

      // Muzzle Flash & Fire Sparks
      if (isShooting) {
        ctx.fillStyle = '#FFF275';
        ctx.beginPath();
        ctx.arc(24 + recoil, shoulderY - 0.2, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FF5722';
        ctx.beginPath();
        ctx.arc(26 + recoil, shoulderY - 0.2, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    // ── Sniper Supply Runner: Carrying Food & Water Canteen Satchel ─────────
    if (this.isSniperSupplyRunner) {
      ctx.strokeStyle = '#8B5A2B';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-1, shoulderY);
      ctx.lineTo(5, shoulderY + 3);
      ctx.lineTo(8, shoulderY + 5);
      ctx.stroke();

      // Supply satchel
      ctx.fillStyle = '#5c3818';
      ctx.fillRect(4, -13 + bob, 10, 8);
      ctx.strokeStyle = '#3d2510';
      ctx.lineWidth = 1;
      ctx.strokeRect(4, -13 + bob, 10, 8);

      // Supply icon on satchel
      ctx.fillStyle = '#2ecc71';
      ctx.font = 'bold 5px monospace';
      ctx.fillText('RATS', 5, -8 + bob);
      return;
    }

    // Carrying Ammo Crate
    if (this.carryingAmmo) {
      ctx.strokeStyle = arc.isMarcus ? '#8b4513' : '#34495e';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-1, shoulderY);
      ctx.lineTo(4, shoulderY + 4);
      ctx.lineTo(8, shoulderY + 4);
      ctx.stroke();

      ctx.fillStyle = '#2d4a22';
      ctx.fillRect(3, -17 + bob, 14, 9);
      ctx.strokeStyle = '#576574';
      ctx.lineWidth = 1;
      ctx.strokeRect(3, -17 + bob, 14, 9);

      ctx.fillStyle = '#ffd700';
      ctx.fillRect(3, -9 + bob, 14, 1.8);
      ctx.fillStyle = '#111111';
      ctx.fillRect(6, -9 + bob, 2.5, 1.8);
      ctx.fillRect(11, -9 + bob, 2.5, 1.8);

      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 5px monospace';
      ctx.fillText('AMMO', 4, -12 + bob);

      ctx.strokeStyle = '#1e272e';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(2, -14 + bob, 1.5, 3.5);
      return;
    }

    // Eating at Kitchen
    if (this.needState === 'seeking_food' && this.needTimer > 0) {
      ctx.fillStyle = '#8d5524';
      ctx.beginPath();
      ctx.arc(4, shoulderY + 4, 3.5, 0, Math.PI);
      ctx.fill();

      ctx.fillStyle = '#e67e22';
      ctx.fillRect(1, shoulderY + 2.5, 6, 1.5);

      const steamCycle = (this.idleTime * 4) % (Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(3, shoulderY + 2);
      ctx.lineTo(2.5 + Math.sin(steamCycle) * 1.5, shoulderY - 4);
      ctx.moveTo(5, shoulderY + 2);
      ctx.lineTo(5.5 + Math.cos(steamCycle) * 1.5, shoulderY - 5);
      ctx.stroke();

      const spoonBob = Math.sin(this.needTimer * 7) * 3.5;
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(3, shoulderY + 3);
      ctx.lineTo(2, shoulderY - 1 + spoonBob);
      ctx.stroke();
      return;
    }

    // Drinking at Water Filter
    if (this.needState === 'seeking_water' && this.needTimer > 0) {
      ctx.fillStyle = '#0ea5e9';
      ctx.fillRect(2, shoulderY - 3, 4, 6);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(2.5, shoulderY - 4.5, 3, 1.5);

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(3.5, shoulderY - 5, 0.8, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    // Standard arms & tools
    ctx.strokeStyle = arc.isSarah ? '#f8fafc' : arc.isElena ? '#ff5722' : '#34495e';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(1, shoulderY);
    ctx.lineTo(2 - armSwing * 0.7, shoulderY + 6);
    ctx.stroke();

    ctx.strokeStyle = arc.isSarah ? '#f8fafc' : arc.isElena ? '#ff5722' : '#34495e';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-1, shoulderY);

    if (arc.isMarcus) {
      ctx.lineTo(3, shoulderY + 5);
      ctx.stroke();
      ctx.strokeStyle = '#7f8c8d';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(3, shoulderY + 5);
      ctx.lineTo(7, shoulderY + 3);
      ctx.stroke();
      ctx.strokeRect(6.5, shoulderY + 1.5, 2.5, 2.5);
    } else if (arc.isElena) {
      ctx.lineTo(3, shoulderY + 4);
      ctx.stroke();
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(3, shoulderY + 4);
      ctx.lineTo(7, shoulderY + 2);
      ctx.stroke();
      ctx.strokeStyle = '#95a5a6';
      ctx.strokeRect(6.5, shoulderY + 0.5, 2.5, 2.5);
    } else if (arc.isToby) {
      ctx.lineTo(3, shoulderY + 5);
      ctx.stroke();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(3, shoulderY + 5);
      ctx.lineTo(6, shoulderY + 3);
      ctx.moveTo(3, shoulderY + 5);
      ctx.lineTo(6, shoulderY + 6);
      ctx.stroke();
    } else if (arc.isAiden) {
      ctx.lineTo(3, shoulderY + 5);
      ctx.stroke();
      ctx.fillStyle = '#111111';
      ctx.fillRect(2.5, shoulderY + 4.5, 2, 2);
    } else if (arc.isJackson) {
      ctx.lineTo(3, shoulderY + 4);
      ctx.stroke();
      ctx.fillStyle = '#1e272e';
      ctx.fillRect(2, shoulderY + 1.5, 11, 2.2);
      ctx.fillStyle = '#4a5568';
      ctx.fillRect(4, shoulderY - 0.5, 4.5, 1.8);
      ctx.fillStyle = '#5c3a21';
      ctx.fillRect(1, shoulderY + 3.0, 3, 2);
    } else if (arc.isMaya) {
      ctx.lineTo(3, shoulderY + 4);
      ctx.stroke();
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(2.5, shoulderY + 3.5, 2.2, 2.2);
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(4, shoulderY + 2, 4, 5);
      ctx.fillStyle = '#00f3ff';
      ctx.fillRect(5, shoulderY + 3, 2, 1.5);
    } else if (arc.isCarlos) {
      ctx.lineTo(3, shoulderY + 5);
      ctx.stroke();
      ctx.fillStyle = '#8b4513';
      ctx.fillRect(3, shoulderY + 2, 1.6, 6);
      ctx.fillStyle = '#7f8c8d';
      ctx.fillRect(2, shoulderY + 1, 4.5, 2);
    } else if (arc.isSamantha) {
      ctx.lineTo(3 + armSwing * 0.9, shoulderY + 5);
      ctx.stroke();
      ctx.fillStyle = '#ff7675';
      ctx.fillRect(2.5, shoulderY + 4, 2, 2);
    } else if (arc.isLucas) {
      ctx.lineTo(3, shoulderY + 4);
      ctx.stroke();
      ctx.fillStyle = '#00d2d3';
      ctx.fillRect(2.5, shoulderY + 3.5, 2, 2);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(4, shoulderY + 3, 4, 1.5);
      ctx.fillStyle = '#eb4d4b';
      ctx.fillRect(4.5, shoulderY + 3.2, 2.2, 1.1);
    } else if (arc.isBoris) {
      ctx.lineTo(3, shoulderY + 5);
      ctx.stroke();
      ctx.fillStyle = '#576574';
      ctx.fillRect(3, shoulderY + 2, 3.5, 6);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(2.5, shoulderY + 1.5, 4.5, 1.2);
      ctx.fillRect(2.5, shoulderY + 7.5, 4.5, 1.2);
    } else {
      ctx.lineTo(-2 + armSwing * 0.8, shoulderY + 6);
      ctx.stroke();
    }
  }

  // --- 5. STATUS OVERLAYS ---
  drawSurvivorOverlays(ctx, bob, movingLeft) {
    const hpRatio = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = '#1e272e';
    ctx.fillRect(-7, -27 + bob, 14, 2.5);
    ctx.fillStyle = hpRatio > 0.5 ? '#2ecc71' : hpRatio > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.fillRect(-7, -27 + bob, 14 * hpRatio, 2.5);

    ctx.fillStyle = '#ffffff';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    const shortName = this.name.split(' ')[0];
    const starPrefix = this.level > 1 ? '⭐' : '';
    ctx.fillText(`${starPrefix}${shortName} [L${this.level}]`, 0, -31 + bob);

    if (this.speechText) {
      ctx.save();
      if (movingLeft) ctx.scale(-1, 1);
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

// Fleeing Refugee Pursued by Horde on Surface
class Refugee {
  constructor(archetype, side = 'left') {
    this.archetype = archetype;
    this.name = archetype.name;
    this.role = archetype.role;
    this.skill = archetype.skill;
    this.avatar = archetype.avatar;
    this.specialty = archetype.specialty || 'armory';
    this.assignedRoom = archetype.assignedRoom || this.specialty;
    this.side = side;

    this.hp = archetype.hp || 100;
    this.maxHp = 100;
    this.speed = archetype.speed || 48; // Fleeing sprint speed
    this.isDead = false;
    this.isRescued = false;

    // Kinematics on surface
    this.x = side === 'left' ? -25 : 1305;
    this.y = CONFIG.SURFACE_Y;
    this.targetX = CONFIG.ELEVATOR_X; // 640 cabin entrance
    this.walkCycle = Math.random() * 10;
    this.facing = side === 'left' ? 1 : -1;

    // Speech & distress timers
    this.speechText = '';
    this.speechTimer = 0;
    this.panicTimer = 0.5;
    this.hitFlash = 0;
  }

  say(text, duration = 2.5) {
    this.speechText = text;
    this.speechTimer = duration;
  }

  takeDamage(amount) {
    if (this.isDead || this.isRescued) return;
    this.hp -= amount;
    this.hitFlash = 0.12;
    if (window.gameEngine && window.gameEngine.particles) {
      window.gameEngine.particles.spawnBlood(this.x, this.y - 12, 6, '#881111');
    }
    if (window.soundSystem) window.soundSystem.playZombieHit();

    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
      this.die();
    }
  }

  die() {
    const engine = window.gameEngine;
    if (engine) {
      engine.particles.spawnBlood(this.x, this.y - 10, 26, '#6b1111');
      engine.particles.spawnBloodDecal(this.x, CONFIG.SURFACE_Y, '#6b1111', 12, 6);
      engine.particles.addFloatingText("💀 REFUGEE OVERWHELMED!", this.x - 40, this.y - 35, '#ff3333');
      engine.addNotification(`💀 REFUGEE LOST: ${this.name} (${this.role}) was killed by the horde!`, 'danger');
    }
    if (window.soundSystem && window.soundSystem.playZombieShriek) {
      window.soundSystem.playZombieShriek();
    }
  }

  rescueSuccess() {
    if (this.isRescued || this.isDead) return;
    this.isRescued = true;
    const engine = window.gameEngine;
    if (!engine) return;

    // Floating fanfare and celebratory effects
    engine.particles.spawnSparks(CONFIG.ELEVATOR_X, CONFIG.SURFACE_Y - 20, 50, '#ffd700');
    engine.particles.spawnSparks(CONFIG.ELEVATOR_X, CONFIG.SURFACE_Y - 20, 35, '#55ffaa');
    engine.particles.addFloatingText("🎉 REFUGEE RESCUED!", CONFIG.ELEVATOR_X - 60, CONFIG.SURFACE_Y - 50, '#ffd700');
    engine.particles.addFloatingText(`🎉 ${this.name.toUpperCase()} JOINED THE CREW!`, CONFIG.ELEVATOR_X - 90, CONFIG.SURFACE_Y - 32, '#55ffaa');

    if (window.soundSystem) {
      window.soundSystem.playBeep(true);
    }

    engine.addNotification(`🎉 REFUGEE RESCUED! ${this.name} (${this.role}) joined the bunker crew!`, 'success');

    // Create full Survivor inhabitant
    const survivorData = {
      id: 's_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      name: this.name,
      role: this.role,
      skill: this.skill,
      avatar: this.avatar,
      specialty: this.specialty,
      assignedRoom: this.assignedRoom || this.specialty,
      hp: Math.max(45, Math.round(this.hp)),
      maxHp: 100,
      hunger: 80,
      thirst: 80,
      fatigue: 20,
      morale: 95
    };
    if (this.speed) survivorData.speed = this.speed;

    const newSurvivor = new Survivor(survivorData);
    newSurvivor.say("Safe inside! Thank you for the covering fire!", 4.0);
    newSurvivor.x = CONFIG.ELEVATOR_X;
    newSurvivor.y = CONFIG.SURFACE_Y;
    engine.survivors.push(newSurvivor);

    // Morale boost for all living bunker survivors
    for (const s of engine.survivors) {
      if (!s.isDead) s.morale = Math.min(100, s.morale + 15);
    }

    // Reset pursuers target
    for (const z of engine.zombies) {
      if (z.targetRefugee === this) {
        z.targetRefugee = null;
      }
    }
  }

  update(dt) {
    if (this.isDead || this.isRescued) return;

    if (this.hitFlash > 0) this.hitFlash -= dt;

    if (this.speechTimer > 0) {
      this.speechTimer -= dt;
      if (this.speechTimer <= 0) this.speechText = '';
    }

    // Panicked cries for help
    this.panicTimer -= dt;
    if (this.panicTimer <= 0) {
      this.panicTimer = 2.4 + Math.random() * 1.2;
      const shouts = [
        "HELP! THEY'RE RIGHT BEHIND ME!",
        "OPEN THE CABIN DOOR!",
        "KEEP SHOOTING!",
        "DON'T LET THEM CATCH ME!",
        "ALMOST TO SAFETY!"
      ];
      this.say(shouts[Math.floor(Math.random() * shouts.length)], 2.0);
    }

    // Run towards cabin door at 640
    const dir = this.targetX > this.x ? 1 : -1;
    this.facing = dir;
    this.x += dir * this.speed * dt;
    this.walkCycle += dt * 10;

    // Check if reached cabin entrance
    if (Math.abs(this.x - this.targetX) < 16) {
      this.rescueSuccess();
    }
  }

  draw(ctx) {
    if (this.isDead || this.isRescued) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.facing === -1) ctx.scale(-1, 1);

    if (this.hitFlash > 0) {
      ctx.filter = 'brightness(2.2)';
    }

    const bob = Math.abs(Math.sin(this.walkCycle)) * 3.0;
    const legSwing = Math.cos(this.walkCycle) * 7.5;
    const armSwing = Math.sin(this.walkCycle) * 8.0;

    ctx.rotate(0.18);

    // Legs & boots
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(0, -7 + bob);
    ctx.lineTo(-legSwing, -1);
    ctx.moveTo(0, -7 + bob);
    ctx.lineTo(legSwing, -1);
    ctx.stroke();

    // Torso (role colored shirt)
    const shirtColor = this.specialty === 'security' ? '#2d4a22' :
                        this.specialty === 'generator' ? '#f39c12' :
                        this.specialty === 'workshop' ? '#e67e22' :
                        this.specialty === 'clinic' ? '#16a085' : '#3498db';
    ctx.fillStyle = shirtColor;
    ctx.fillRect(-4, -18 + bob, 8, 11);

    // Head
    ctx.fillStyle = '#ffdfba';
    ctx.beginPath();
    ctx.arc(0, -22 + bob, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Terrified mouth & eye
    ctx.fillStyle = '#111111';
    ctx.fillRect(1, -21 + bob, 2.5, 2.5);
    ctx.beginPath();
    ctx.arc(1.5, -23.5 + bob, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Pumping running arms
    ctx.strokeStyle = '#ffdfba';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, -16 + bob);
    ctx.lineTo(-armSwing * 0.8, -10 + bob);
    ctx.moveTo(0, -16 + bob);
    ctx.lineTo(armSwing * 0.8, -12 + bob);
    ctx.stroke();

    // Health bar
    const hpRatio = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = '#1e272e';
    ctx.fillRect(-12, -33 + bob, 24, 3);
    ctx.fillStyle = hpRatio > 0.5 ? '#2ecc71' : hpRatio > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.fillRect(-12, -33 + bob, 24 * hpRatio, 3);

    // Overhead Tag
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    const shortName = this.name.split(' ')[0];
    ctx.fillText(`🏃 REFUGEE: ${shortName}`, 0, -38 + bob);

    // Speech bubble
    if (this.speechText) {
      ctx.save();
      if (this.facing === -1) ctx.scale(-1, 1);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
      ctx.font = 'bold 8px monospace';
      const tw = ctx.measureText(this.speechText).width + 8;
      ctx.fillRect(-tw / 2, -52 + bob, tw, 12);
      ctx.strokeStyle = '#ff4757';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(-tw / 2, -52 + bob, tw, 12);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(this.speechText, 0, -43 + bob);
      ctx.restore();
    }

    ctx.restore();
  }
}

window.Survivor = Survivor;
window.Refugee = Refugee;
