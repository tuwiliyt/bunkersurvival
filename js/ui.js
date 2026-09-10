// UI Manager & Modal Controllers
class UIManager {
  constructor() {
    this.modalOverlay = document.getElementById('modal-overlay');
    this.modalContent = document.getElementById('modal-content');
    this.activeModal = null;
  }

  updateHUD() {
    const engine = window.gameEngine;
    if (!engine) return;

    // Day & Time
    const hours = Math.floor(engine.dayTime);
    const mins = Math.floor((engine.dayTime % 1) * 60);
    const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    const dayEl = document.getElementById('hud-day');
    if (dayEl) dayEl.textContent = `Day ${engine.dayNumber} - ${timeStr}`;

    // Resources
    const res = engine.resources;
    this.setVal('res-ammo', Math.floor(res.ammo), CONFIG.RESOURCE_CAPS.ammo);
    this.setVal('res-power', Math.floor(res.power), CONFIG.RESOURCE_CAPS.power);
    this.setVal('res-food', Math.floor(res.food), CONFIG.RESOURCE_CAPS.food);
    this.setVal('res-water', Math.floor(res.water), CONFIG.RESOURCE_CAPS.water);
    this.setVal('res-metal', Math.floor(res.metal), CONFIG.RESOURCE_CAPS.metal);
    this.setVal('res-gunpowder', Math.floor(res.gunpowder), CONFIG.RESOURCE_CAPS.gunpowder);
    this.setVal('res-fuel', Math.floor(res.fuel), CONFIG.RESOURCE_CAPS.fuel);

    // Population & Living Capacity
    const aliveCount = engine.survivors.filter(s => !s.isDead).length;
    const maxPop = engine.getMaxPopulation ? engine.getMaxPopulation() : 8;
    const popEl = document.getElementById('hud-pop');
    if (popEl) {
      popEl.textContent = `Pop: ${aliveCount}/${maxPop}`;
      popEl.title = `Bunker Inhabitants: ${aliveCount} / Maximum Bunk Capacity: ${maxPop} (Upgrade Living Quarters to expand)`;
      popEl.style.color = aliveCount >= maxPop ? '#f39c12' : '#55ffaa';
    }

    // Threat Radar
    const radarEl = document.getElementById('hud-radar');
    if (radarEl) {
      if (engine.waveManager.isHordeActive) {
        radarEl.className = 'radar-badge danger pulse';
        radarEl.innerHTML = `⚠️ HORDE ATTACKING! (Wave ${engine.waveManager.currentWave})`;
      } else {
        const secs = Math.ceil(engine.waveManager.timer);
        radarEl.className = secs <= 15 ? 'radar-badge warning pulse' : 'radar-badge normal';
        radarEl.innerHTML = `📡 Swarm in: ${secs}s (Wave ${engine.waveManager.currentWave + 1})`;
      }
    }

    // Turret quick HUD bars
    this.updateTurretWidget('left-turret-hud', engine.leftTurret);
    this.updateTurretWidget('right-turret-hud', engine.rightTurret);

    // Sniper Widget
    this.updateSniperWidget(engine);

    // Construction site widgets for Turrets 3 & 4
    this.updateConstructionWidgets(engine);
  }

  setVal(id, current, max) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = `${current}/${max}`;
      // Highlight low ammo
      if (id === 'res-ammo') {
        el.style.color = current < 50 ? '#ff4d4d' : current < 150 ? '#ffaa00' : '#ffeaa7';
      }
      // Highlight power level & grid telemetry tooltip
      if (id === 'res-power') {
        el.style.color = current < 40 ? '#ff4d4d' : current < 80 ? '#ffaa00' : '#00f3ff';
        const engine = window.gameEngine;
        if (engine && el.parentElement) {
          const solar = Math.round(engine.solarOutput || 0);
          const gen = Math.round(engine.generatorOutput || 0);
          const net = Math.round(engine.netPowerFlow || 0);
          el.parentElement.title = `Power Grid: ${current}/${max} kW (Solar: +${solar} kW, Gen: +${gen} kW, Net: ${(net >= 0 ? '+' : '') + net} kW/s)`;
        }
      }
    }
  }

  updateTurretWidget(containerId, turret) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const engine = window.gameEngine;
    if (!engine) return;

    const ammoRatio = turret.ammo / turret.stats.maxAmmo;
    const hpRatio = turret.health / turret.maxHealth;

    const ammoStatusClass = turret.ammo === 0 ? 'critical pulse' : ammoRatio < 0.25 ? 'warning pulse' : '';
    const alertBadge = turret.ammo === 0
      ? '<span class="hud-alert-badge danger">DEPLETED!</span>'
      : ammoRatio < 0.25
        ? '<span class="hud-alert-badge warn">LOW AMMO</span>'
        : '';

    const isCarrierEnRoute = engine.survivors.some(s => s.ammoDeliveryTask && s.ammoDeliveryTask.turret === turret);
    const carrierBadge = isCarrierEnRoute ? '<span class="badge-carrier">📦 RUNNER EN ROUTE</span>' : '';

    el.innerHTML = `
      <div class="turret-hud-header">
        <div class="turret-hud-title">🛡️ ${turret.side.toUpperCase()} SENTRY [T${turret.tierIndex + 1}]</div>
        ${carrierBadge || alertBadge}
      </div>
      <div class="hud-bar-row ${ammoStatusClass}">
        <span class="hud-label">📦 AMMO:</span>
        <div class="progress-bar">
          <div class="progress-fill ${ammoRatio < 0.15 ? 'bar-red' : ammoRatio < 0.4 ? 'bar-amber' : 'bar-green'}" style="width: ${ammoRatio * 100}%"></div>
        </div>
        <span class="val-text">${turret.ammo}/${turret.stats.maxAmmo}</span>
      </div>
      <div class="hud-bar-row">
        <span class="hud-label">❤️ HULL:</span>
        <div class="progress-bar">
          <div class="progress-fill ${hpRatio < 0.3 ? 'bar-red' : 'bar-blue'}" style="width: ${hpRatio * 100}%"></div>
        </div>
        <span class="val-text">${Math.round(turret.health)}/${turret.maxHealth}</span>
      </div>
      <div class="turret-btn-row">
        <button class="btn btn-sm btn-action" onclick="window.gameEngine.${turret.side}Turret.reload()">RELOAD (50)</button>
        <button class="btn btn-sm btn-secondary" onclick="window.gameEngine.${turret.side}Turret.repair()">REPAIR (10M)</button>
        <button class="btn btn-sm" title="Target Priority: ${turret.priorityMode}" onclick="window.gameEngine.${turret.side}Turret.cyclePriority(); window.uiManager.updateHUD();">🎯 ${turret.priorityMode.toUpperCase().slice(0, 4)}</button>
        <button class="btn btn-sm btn-accent" onclick="window.uiManager.openTurretModal(window.gameEngine.${turret.side}Turret)">SPECS</button>
      </div>
    `;
  }

  openRoomModal(room) {
    const engine = window.gameEngine;
    const workers = engine.survivors.filter(s => s.assignedRoom === room.id && !s.isDead);
    const unassigned = engine.survivors.filter(s => s.assignedRoom !== room.id && !s.isDead);

    const upgradeCost = room.level * 40;
    const canUpgrade = engine.resources.metal >= upgradeCost;

    let prodHtml = '';
    if (room.produces) {
      prodHtml = `
        <div class="modal-info-box">
          <strong>Production Yield:</strong> ${room.produces.toUpperCase()} (+${room.baseRate * room.level}/s with workers)
          ${room.cost ? `<br><span class="text-dim">Consumes: ${Object.entries(room.cost).map(([k, v]) => `${k}: ${v}/s`).join(', ')}</span>` : ''}
        </div>
      `;
    } else if (room.id === 'quarters_1' || room.id === 'quarters_2') {
      const roomCapacity = 4 + (room.level - 1) * (CONFIG.POPULATION_PER_QUARTERS_TIER || 2);
      prodHtml = `
        <div class="modal-info-box" style="border-left: 3px solid #00cec9;">
          <strong>🏠 Living Quarters Capacity:</strong> ${roomCapacity} Bunks
          <br><span class="text-dim">Total Bunker Capacity: ${engine.getMaxPopulation()} Inhabitants. Upgrading adds +${CONFIG.POPULATION_PER_QUARTERS_TIER || 2} bunks!</span>
        </div>
      `;
    }

    let workersListHtml = workers.map(w => `
      <div class="worker-card">
        <div>${w.avatar} <strong>${w.name}</strong> (${w.role}) - HP: ${Math.round(w.hp)}%</div>
        <button class="btn btn-sm btn-danger" onclick="window.uiManager.reassignWorker('${w.id}', 'quarters_1')">Unassign</button>
      </div>
    `).join('');

    if (workers.length === 0) {
      workersListHtml = `<p class="text-dim">No survivors currently working in this room. Room is idle!</p>`;
    }

    let assignOptionsHtml = unassigned.map(u => `
      <option value="${u.id}">${u.avatar} ${u.name} (${u.role})</option>
    `).join('');

    this.showModal(`
      <div class="modal-header">
        <h2>${room.icon} ${room.name} (Tier ${room.level})</h2>
        <button class="modal-close" onclick="window.uiManager.closeModal()">&times;</button>
      </div>
      <p class="modal-desc">${room.desc}</p>
      ${prodHtml}
      <div class="modal-section">
        <h3>Assigned Crew (${workers.length}/${room.maxWorkers})</h3>
        <div class="workers-container">${workersListHtml}</div>
        ${workers.length < room.maxWorkers && unassigned.length > 0 ? `
          <div class="assign-row">
            <select id="assign-select" class="form-select">${assignOptionsHtml}</select>
            <button class="btn btn-primary" onclick="window.uiManager.assignSelectedWorker('${room.id}')">Assign Worker</button>
          </div>
        ` : ''}
      </div>
      <div class="modal-footer">
        <button class="btn btn-accent" ${!canUpgrade ? 'disabled' : ''} onclick="window.uiManager.upgradeRoom('${room.id}')">
          Upgrade Room (Cost: ${upgradeCost} Metal)
        </button>
        <button class="btn btn-secondary" onclick="window.uiManager.closeModal()">Close</button>
      </div>
    `);
  }

  assignSelectedWorker(roomId) {
    const sel = document.getElementById('assign-select');
    if (!sel) return;
    const survivorId = sel.value;
    const survivor = window.gameEngine.survivors.find(s => s.id === survivorId);
    if (survivor) {
      survivor.assignTo(roomId);
      window.soundSystem.playBeep(true);
      const room = window.gameEngine.getRoom(roomId);
      this.openRoomModal(room);
    }
  }

  reassignWorker(survivorId, targetRoomId) {
    const survivor = window.gameEngine.survivors.find(s => s.id === survivorId);
    if (survivor) {
      const prevRoom = survivor.assignedRoom;
      survivor.assignTo(targetRoomId);
      window.soundSystem.playBeep(true);
      const room = window.gameEngine.getRoom(prevRoom);
      if (room) this.openRoomModal(room);
    }
  }

  upgradeRoom(roomId) {
    const room = window.gameEngine.getRoom(roomId);
    if (room && room.upgrade()) {
      this.openRoomModal(room);
    }
  }

  openTurretModal(turret) {
    const nextTier = CONFIG.TURRET_TIERS[turret.tierIndex + 1];
    const canUpgrade = nextTier && window.gameEngine.resources.metal >= nextTier.upgradeCost.metal;

    this.showModal(`
      <div class="modal-header">
        <h2>🛡️ ${turret.side.toUpperCase()} DEFENSE TURRET</h2>
        <button class="modal-close" onclick="window.uiManager.closeModal()">&times;</button>
      </div>
      <div class="modal-section">
        <div class="turret-spec-grid">
          <div><strong>Model:</strong> ${turret.stats.name}</div>
          <div><strong>Damage:</strong> ${turret.stats.damage}</div>
          <div><strong>Fire Rate:</strong> ${(1 / turret.stats.fireRate).toFixed(1)} shots/sec</div>
          <div><strong>Effective Range:</strong> ${turret.stats.range} px</div>
          <div><strong>Magazine:</strong> ${turret.ammo} / ${turret.stats.maxAmmo} rounds</div>
          <div><strong>Durability:</strong> ${Math.round(turret.health)} / ${turret.maxHealth} HP</div>
          <div><strong>Zombies Slain:</strong> ${turret.kills}</div>
          <div><strong>Priority:</strong> <span class="text-accent">${turret.priorityMode.toUpperCase()}</span></div>
        </div>
        <div style="margin-top: 10px;">
          <label style="font-size: 11px; font-weight: bold; color: #a0aec0;">🎯 TARGETING PRIORITIZATION:</label>
          <div class="priority-btn-group">
            <button class="priority-btn ${turret.priorityMode === 'nearest' ? 'active' : ''}" onclick="window.gameEngine.${turret.side}Turret.setPriority('nearest'); window.uiManager.openTurretModal(window.gameEngine.${turret.side}Turret)">Nearest</button>
            <button class="priority-btn ${turret.priorityMode === 'lowest_hp' ? 'active' : ''}" onclick="window.gameEngine.${turret.side}Turret.setPriority('lowest_hp'); window.uiManager.openTurretModal(window.gameEngine.${turret.side}Turret)">Lowest HP</button>
            <button class="priority-btn ${turret.priorityMode === 'strongest' ? 'active' : ''}" onclick="window.gameEngine.${turret.side}Turret.setPriority('strongest'); window.uiManager.openTurretModal(window.gameEngine.${turret.side}Turret)">Strongest</button>
            <button class="priority-btn ${turret.priorityMode === 'boss' ? 'active' : ''}" onclick="window.gameEngine.${turret.side}Turret.setPriority('boss'); window.uiManager.openTurretModal(window.gameEngine.${turret.side}Turret)">Boss/Brute</button>
          </div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn ${window.gameEngine.manualAim ? 'btn-action' : 'btn-secondary'}" onclick="window.gameEngine.toggleManualAim(); window.uiManager.openTurretModal(window.gameEngine.${turret.side}Turret)">
          🎯 Manual Mouse Aim Mode: ${window.gameEngine.manualAim ? 'ENGAGED (Click to Aim & Fire)' : 'DISABLED (Autonomous AI)'}
        </button>
        <button class="btn btn-action" onclick="window.gameEngine.${turret.side}Turret.reload(); window.uiManager.openTurretModal(window.gameEngine.${turret.side}Turret)">
          Reload Ammo from Bunker Stock (50 rounds)
        </button>
        <button class="btn btn-secondary" onclick="window.gameEngine.${turret.side}Turret.repair(); window.uiManager.openTurretModal(window.gameEngine.${turret.side}Turret)">
          Repair Turret (10 Metal)
        </button>
        ${nextTier ? `
          <button class="btn btn-accent" ${!canUpgrade ? 'disabled' : ''} onclick="window.gameEngine.${turret.side}Turret.upgrade(); window.uiManager.openTurretModal(window.gameEngine.${turret.side}Turret)">
            Upgrade to ${nextTier.name} (${nextTier.upgradeCost.metal} Metal${nextTier.upgradeCost.gunpowder ? `, ${nextTier.upgradeCost.gunpowder} Powder` : ''})
          </button>
        ` : `<div class="badge-max">MAX LEVEL REACHED</div>`}
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="window.uiManager.closeModal()">Close</button>
      </div>
    `);
  }

  openSurvivorsRoster() {
    const engine = window.gameEngine;
    const listHtml = engine.survivors.map(s => {
      if (s.isDead) {
        return `
          <div class="survivor-roster-row dead">
            <div>💀 <strong>${s.name}</strong> (${s.role}) - <span class="text-danger">DECEASED</span></div>
          </div>
        `;
      }
      const room = engine.getRoom(s.assignedRoom);
      const levelTitle = CONFIG.SURVIVOR_LEVEL_TITLES[s.level - 1] || 'Veteran';
      const effBonus = (s.level - 1) * 25;
      const xpRatio = Math.min(1.0, s.xp / s.xpToNext);

      let statusBadge = '<span style="color: #2ecc71; font-weight: bold;">⚙️ Working</span>';
      if (s.bossMode) {
        statusBadge = `<span style="color: #e74c3c; font-weight: bold; background: rgba(231,76,60,0.2); padding: 1px 4px; border-radius: 3px;">⚔️ BOSS DEFENSE</span>`;
      } else if (s.isSniperSupplyRunner) {
        statusBadge = `<span style="color: #00cec9; font-weight: bold;">📦 SNIPER SUPPLY RUN</span>`;
      } else if (s.ammoDeliveryTask) {
        statusBadge = `<span class="badge-carrier">📦 RUNNER: ${s.ammoDeliveryTask.turret.side.toUpperCase()} TURRET</span>`;
      } else if (s.builderRepairTask) {
        statusBadge = `<span style="color: #e67e22; font-weight: bold;">🔧 Repairing Defenses</span>`;
      } else if (s.status === 'emergency_power') {
        statusBadge = `<span style="color: #00cec9; font-weight: bold;">⚡ Generator Overclock</span>`;
      } else if (s.needState === 'seeking_medical') {
        statusBadge = `<span style="color: #ff7675; font-weight: bold;">🩹 In Medical Clinic</span>`;
      } else if (s.needState === 'seeking_food') {
        statusBadge = '<span style="color: #f39c12; font-weight: bold;">🍲 Eating at Mess Hall</span>';
      } else if (s.needState === 'seeking_water') {
        statusBadge = '<span style="color: #3498db; font-weight: bold;">💧 Drinking at Filtration</span>';
      } else if (s.needState === 'resting') {
        statusBadge = '<span style="color: #a29bfe; font-weight: bold;">💤 Resting in Quarters</span>';
      } else if (s.role && s.role.toLowerCase().includes('sniper')) {
        statusBadge = '<span style="color: #2ed573; font-weight: bold;">🎯 Watchtower Overwatch</span>';
      }

      const combatDmg = s.getCombatDamage ? Math.round(s.getCombatDamage()) : 20;

      return `
        <div class="survivor-roster-row">
          <div class="survivor-main-info">
            <span class="avatar-large">${s.avatar}</span>
            <div style="flex: 1;">
              <div>
                <strong>${s.name}</strong> - <span class="text-accent">${s.role}</span>
                <span style="background: rgba(241, 196, 15, 0.2); border: 1px solid #f1c40f; color: #f1c40f; padding: 1px 5px; border-radius: 3px; font-size: 10px; margin-left: 6px;">
                  ⭐ Lv.${s.level} ${levelTitle} (+${effBonus}% Spd)
                </span>
                <span style="background: rgba(231, 76, 60, 0.2); border: 1px solid #e74c3c; color: #ff7675; padding: 1px 5px; border-radius: 3px; font-size: 10px; margin-left: 4px;">
                  🎯 Combat Lv.${s.combatLevel || 1} (${combatDmg} Dmg)
                </span>
                <span style="margin-left: 8px; font-size: 10px;">${statusBadge}</span>
              </div>
              <div class="survivor-stats-mini">
                HP: ${Math.round(s.hp)}% | Hunger: ${Math.round(s.hunger)}% | Thirst: ${Math.round(s.thirst)}% | Stamina: ${Math.round(100 - s.fatigue)}%
              </div>
              <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                <div class="survivor-xp-bar">
                  <div class="survivor-xp-fill" style="width: ${xpRatio * 100}%;"></div>
                </div>
                <span style="font-size: 9px; color: #ffd166;">XP: ${Math.floor(s.xp)}/${s.xpToNext}</span>
              </div>
            </div>
          </div>
          <div class="survivor-assign-select">
            <label>Station:</label>
            <select class="form-select sm" onchange="window.uiManager.reassignWorker('${s.id}', this.value)">
              ${CONFIG.ROOM_TEMPLATES.map(rt => `<option value="${rt.id}" ${s.assignedRoom === rt.id ? 'selected' : ''}>${rt.icon} ${rt.name}</option>`).join('')}
            </select>
          </div>
        </div>
      `;
    }).join('');

    const aliveCount = engine.survivors.filter(s => !s.isDead).length;
    const maxPop = engine.getMaxPopulation ? engine.getMaxPopulation() : 8;

    this.showModal(`
      <div class="modal-header">
        <h2>👥 BUNKER INHABITANTS ROSTER (${aliveCount}/${maxPop} Bunks)</h2>
        <button class="modal-close" onclick="window.uiManager.closeModal()">&times;</button>
      </div>
      <p class="modal-desc">Monitor health, needs, and work stations of your survivors to keep the bunker thriving.</p>
      <div class="roster-container">${listHtml}</div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="window.uiManager.closeModal()">Close</button>
      </div>
    `);
  }

  openResearchModal() {
    const engine = window.gameEngine;
    const tt = engine.techTree;

    const techs = [
      { id: 'autoConduit', name: 'Automated Ammo Conduit', desc: 'Directly supplies ammo from the bunker to surface turrets automatically when below 30%.', cost: 120, researched: tt.autoConduit },
      { id: 'heavyCaliber', name: 'High-Velocity Ammo (+30% Damage)', desc: 'Manufactures AP rounds increasing all turret damage by 30%.', cost: 100, researched: tt.heavyCaliber },
      { id: 'ammoOptimization', name: 'Munitions Press Efficiency (+40% Ammo)', desc: 'Optimizes Armory powder press, yielding 40% more ammo per cycle.', cost: 80, researched: tt.ammoOptimization },
      { id: 'hydroBoost', name: 'Aeroponic Nutrient Misting (+50% Food)', desc: 'Advanced nutrient formulation boosting crop yields.', cost: 60, researched: tt.hydroBoost },
      { id: 'fortifiedWalls', name: 'Reinforced Cabin Barricade (1000 HP)', desc: 'Steel plating and concrete bracing for the surface cabin.', cost: 140, researched: tt.fortifiedWalls },
      { id: 'longRangeRadar', name: 'Long-Range Doppler Radar', desc: 'Gives 15 extra seconds of early warning before incoming hordes.', cost: 90, researched: tt.longRangeRadar }
    ];

    const techListHtml = techs.map(t => {
      const canAfford = engine.resources.metal >= t.cost;
      return `
        <div class="tech-card ${t.researched ? 'researched' : ''}">
          <div class="tech-header">
            <h4>${t.name}</h4>
            <span class="tech-status">${t.researched ? '✅ ACTIVE' : `Cost: ${t.cost} Metal`}</span>
          </div>
          <p>${t.desc}</p>
          ${!t.researched ? `
            <button class="btn btn-sm btn-primary" ${!canAfford ? 'disabled' : ''} onclick="window.uiManager.researchTech('${t.id}', ${t.cost})">
              Research Tech
            </button>
          ` : ''}
        </div>
      `;
    }).join('');

    this.showModal(`
      <div class="modal-header">
        <h2>🔬 TECH LAB RESEARCH TREE</h2>
        <button class="modal-close" onclick="window.uiManager.closeModal()">&times;</button>
      </div>
      <div class="tech-grid">${techListHtml}</div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="window.uiManager.closeModal()">Close</button>
      </div>
    `);
  }

  researchTech(techId, cost) {
    const engine = window.gameEngine;
    if (engine.resources.metal >= cost && !engine.techTree[techId]) {
      engine.resources.metal -= cost;
      engine.techTree[techId] = true;
      if (techId === 'fortifiedWalls') {
        engine.houseMaxHp = 1000;
        engine.houseHp = 1000;
      }
      window.soundSystem.playBeep(true);
      engine.particles.spawnSparks(640, 400, 30, '#00d2d3');
      engine.addNotification(`🔬 Technology Unlocked: ${techId}!`, 'success');
      this.openResearchModal();
    }
  }

  openExpeditionModal() {
    const engine = window.gameEngine;
    this.showModal(`
      <div class="modal-header">
        <h2>🌲 SURFACE FOREST EXPEDITION</h2>
        <button class="modal-close" onclick="window.uiManager.closeModal()">&times;</button>
      </div>
      <p class="modal-desc">Send a scout into the surrounding woods between hordes to scavenge for ammo crates, metal parts, or search for survivors.</p>
      <div class="expedition-options">
        <div class="expedition-card">
          <h4>🌲 Quick Forest Recon (Risk: Low)</h4>
          <p>Scout the perimeter trees for abandoned supplies.</p>
          <p><strong>Reward:</strong> 30-60 Ammo, 20 Metal, 10 Fuel</p>
          <button class="btn btn-action" onclick="window.uiManager.launchExpedition('recon')">Send Scout (Costs 20 Food, 20 Water)</button>
        </div>
        <div class="expedition-card">
          <h4>🏚️ Ransack Abandoned Outpost (Risk: Medium)</h4>
          <p>Scour a military bunker checkpoint deeper in the forest.</p>
          <p><strong>Reward:</strong> 120 Ammo, 60 Metal, 40 Powder, chance of finding a Survivor!</p>
          <button class="btn btn-accent" onclick="window.uiManager.launchExpedition('outpost')">Send Expedition (Costs 40 Food, 40 Water)</button>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="window.uiManager.closeModal()">Close</button>
      </div>
    `);
  }

  launchExpedition(type) {
    const engine = window.gameEngine;
    const foodCost = type === 'recon' ? 20 : 40;
    const waterCost = type === 'recon' ? 20 : 40;

    if (engine.resources.food < foodCost || engine.resources.water < waterCost) {
      alert("Not enough Food or Water supplies to prepare rations for this expedition!");
      return;
    }

    engine.resources.food -= foodCost;
    engine.resources.water -= waterCost;
    this.closeModal();

    engine.addNotification("Scout dispatched into the deep forest...", "info");
    window.soundSystem.playBeep(true);

    setTimeout(() => {
      if (type === 'recon') {
        const ammoFound = 40 + Math.floor(Math.random() * 30);
        const metalFound = 20 + Math.floor(Math.random() * 15);
        engine.resources.ammo = Math.min(CONFIG.RESOURCE_CAPS.ammo, engine.resources.ammo + ammoFound);
        engine.resources.metal = Math.min(CONFIG.RESOURCE_CAPS.metal, engine.resources.metal + metalFound);
        engine.addNotification(`Scout returned with ${ammoFound} Ammo and ${metalFound} Metal!`, "success");
      } else {
        const ammoFound = 100 + Math.floor(Math.random() * 50);
        const metalFound = 50 + Math.floor(Math.random() * 30);
        const powderFound = 30 + Math.floor(Math.random() * 20);
        engine.resources.ammo = Math.min(CONFIG.RESOURCE_CAPS.ammo, engine.resources.ammo + ammoFound);
        engine.resources.metal = Math.min(CONFIG.RESOURCE_CAPS.metal, engine.resources.metal + metalFound);
        engine.resources.gunpowder = Math.min(CONFIG.RESOURCE_CAPS.gunpowder, engine.resources.gunpowder + powderFound);
        
        // Chance to rescue survivor
        const maxPop = engine.getMaxPopulation ? engine.getMaxPopulation() : 8;
        const aliveSurvivors = engine.survivors.filter(s => !s.isDead).length;
        if (Math.random() < 0.6 && aliveSurvivors < maxPop) {
          const existingNames = engine.survivors.map(s => s.name.toLowerCase());
          let archetype = (CONFIG.UNIQUE_ARCHETYPES || []).find(a => !existingNames.includes(a.name.toLowerCase()));
          if (!archetype) {
            archetype = (CONFIG.EXTRA_ARCHETYPES || []).find(e => !existingNames.includes(e.name.toLowerCase()));
          }
          if (archetype) {
            const newSurvivor = new Survivor({
              id: 's_' + Date.now(),
              name: archetype.name,
              role: archetype.role,
              skill: archetype.skill,
              avatar: archetype.avatar,
              specialty: archetype.specialty,
              assignedRoom: archetype.assignedRoom || archetype.specialty,
              speed: archetype.speed || 52
            });
            engine.survivors.push(newSurvivor);
            engine.addNotification(`🎉 Expedition rescued ${archetype.name} (${archetype.role})! Joined the bunker crew!`, "success");
            if (window.soundSystem) window.soundSystem.playBeep(true);
          } else {
            engine.addNotification(`Expedition returned with ${ammoFound} Ammo, ${metalFound} Metal, and ${powderFound} Gunpowder!`, "success");
          }
        } else {
          engine.addNotification(`Expedition returned with ${ammoFound} Ammo, ${metalFound} Metal, and ${powderFound} Gunpowder!`, "success");
        }
      }
    }, 4000);
  }

  openHelpModal() {
    this.showModal(`
      <div class="modal-header">
        <h2>📖 SURVIVAL MANUAL & BUNKER GUIDE</h2>
        <button class="modal-close" onclick="window.uiManager.closeModal()">&times;</button>
      </div>
      <div class="help-body">
        <p><strong>Bunker Overview:</strong> Based on the cross-section blueprint, your base consists of a surface cabin fortified in the dark forest and a 4-level underground bunker connected by a central elevator.</p>
        <h4>🎯 Key Priorities:</h4>
        <ul>
          <li><strong>Ammunition Supply:</strong> Turrets auto-fire at zombies, but consume ammo rapidly! Assign survivors to the <strong>Munitions Armory</strong> to craft ammo from Metal and Gunpowder.</li>
          <li><strong>Turret Reloads:</strong> Click the RELOAD button on the Left/Right turrets or research the Automated Ammo Conduit in the Tech Lab.</li>
          <li><strong>Power Grid:</strong> Powered by the <strong>Cabin Roof Solar Array</strong> (+15 kW clean energy during daylight 06:00-18:00) and the <strong>Diesel Generator</strong> (high-efficiency backup with a 200 kW battery buffer). If power falls below 40%, the autonomous AI dispatches an engineer to fuel and service the generator!</li>
          <li><strong>Inhabitant Sustenance:</strong> Survivors need Food from Hydroponics and Water from Filtration. Resting them in Living Quarters restores stamina.</li>
          <li><strong>Zombie Hordes:</strong> The radar displays when the next horde approaches. Brace your defenses and ensure turrets are fully loaded!</li>
        </ul>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" onclick="window.uiManager.closeModal()">Got it!</button>
      </div>
    `);
  }

  showGameOver(reason) {
    const engine = window.gameEngine;
    this.showModal(`
      <div class="modal-header">
        <h2 class="text-danger">☠️ GAME OVER</h2>
      </div>
      <p class="modal-desc">${reason}</p>
      <div class="gameover-stats">
        <div><strong>Days Survived:</strong> ${engine.stats.daysSurvived}</div>
        <div><strong>Waves Repelled:</strong> ${engine.waveManager.currentWave}</div>
        <div><strong>Zombies Slain:</strong> ${engine.stats.zombiesKilled}</div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-action" onclick="location.reload()">Restart New Bunker</button>
      </div>
    `);
  }

  showModal(html) {
    if (this.modalOverlay && this.modalContent) {
      this.modalContent.innerHTML = html;
      this.modalOverlay.style.display = 'flex';
      this.activeModal = true;
    }
  }

  closeModal() {
    if (this.modalOverlay) {
      this.modalOverlay.style.display = 'none';
      this.activeModal = false;
    }
  }

  // Sniper status mini-widget (injected into DOM element 'sniper-hud' if exists)
  updateSniperWidget(engine) {
    const el = document.getElementById('sniper-hud');
    if (!el) return;
    const sniper = engine.survivors ? engine.survivors.find(s =>
      !s.isDead && (s.id === 'jackson' || (s.role && s.role.toLowerCase().includes('sniper')))
    ) : null;

    if (!sniper) {
      el.innerHTML = `<div class="sniper-hud-row dim">🎯 WATCHTOWER — <em>No Sniper</em></div>`;
      return;
    }

    const target = engine.sniperTarget;
    const targetLabel = target ? `${target.type || 'Zombie'} [HP:${Math.ceil(target.hp)}]` : 'Scanning...';
    const cooldownPct = Math.min(100, ((engine.sniperTimer || 0) / 1.8) * 100);

    el.innerHTML = `
      <div class="sniper-hud-header">🎯 WATCHTOWER — <strong>${sniper.name.split(' ')[0]}</strong> (Lvl ${sniper.level || 1})</div>
      <div class="sniper-hud-row">Target: <span class="${target ? 'text-danger' : 'text-muted'}">${targetLabel}</span></div>
      <div class="sniper-hud-row">
        <span class="hud-label">⏱ COOLDOWN:</span>
        <div class="progress-bar" style="width:80px;display:inline-block;vertical-align:middle;">
          <div class="progress-fill bar-amber" style="width:${cooldownPct}%"></div>
        </div>
      </div>
      <div class="sniper-hud-row">📦 Ammo: <span style="color:#ffd700">${Math.floor(engine.resources.ammo)}</span> | XP: ${sniper.xp || 0}</div>
    `;
  }

  // Construction progress widgets for Turrets 3 & 4
  updateConstructionWidgets(engine) {
    if (!engine.constructionSites) return;

    for (const site of engine.constructionSites) {
      const el = document.getElementById(`${site.id}-hud`);
      if (!el) continue;

      if (site.built) {
        el.innerHTML = `<div class="turret-hud-header" style="color:#00FF88">✅ ${site.label} — ONLINE</div>`;
        if (site.turret) {
          el.innerHTML += `<div class="sniper-hud-row">Tier: T${site.turret.tierIndex + 1} | Ammo: ${site.turret.ammo}/${site.turret.stats.maxAmmo}</div>`;
        }
        continue;
      }

      const hasMetal = engine.resources.metal >= site.requiredMetal;
      const hasGP = engine.resources.gunpowder >= site.requiredGunpowder;
      const canBuild = hasMetal && hasGP && !site.building;

      el.innerHTML = `
        <div class="turret-hud-header" style="color:${site.building ? '#F9CA24' : '#00D2FF'}">
          📐 ${site.label} — ${site.building ? `BUILDING ${Math.floor(site.progress)}%` : 'BLUEPRINT'}
        </div>
        <div class="sniper-hud-row" style="color:${hasMetal ? '#00FF88' : '#FF4444'}">⚙️ Metal: ${Math.floor(engine.resources.metal)}/${site.requiredMetal}</div>
        <div class="sniper-hud-row" style="color:${hasGP ? '#00FF88' : '#FF4444'}">💥 Powder: ${Math.floor(engine.resources.gunpowder)}/${site.requiredGunpowder}</div>
        ${site.building ? `
          <div class="sniper-hud-row">🔨 Builder: ${site.builder ? site.builder.name : 'Suspended'}</div>
          <div class="progress-bar"><div class="progress-fill bar-amber" style="width:${site.progress}%"></div></div>
        ` : canBuild ? `
          <div class="sniper-hud-row" style="color:#00FF88">✅ Resources Ready — Auto-building!</div>
        ` : `
          <div class="sniper-hud-row text-dim">Gather more resources...</div>
        `}
      `;
    }
  }
}

window.UIManager = UIManager;

