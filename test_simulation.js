// Automated Headless Simulation & Deep Audit for BUNKER PROTOCOL
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log("===============================================================================");
console.log("🛡️ BUNKER PROTOCOL: AUTOMATED VERIFICATION & HEADLESS SIMULATION AUDIT");
console.log("===============================================================================\n");

let passedTests = 0;
let totalTests = 0;
function assert(desc, condition, details = "") {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${desc}`);
  } else {
    console.error(`  ❌ [FAIL] ${desc} - ${details}`);
    throw new Error(`Assertion failed: ${desc} | ${details}`);
  }
}

// -------------------------------------------------------------
// STEP 1: Verify Static File Structure & HTML Validation
// -------------------------------------------------------------
console.log("--- 1. AUDITING HTML STRUCTURE & STANDALONE INTEGRITY ---");
const indexPath = '/content/bunker_survival/index.html';
const standalonePath = '/content/bunker_survival_standalone.html';
assert("index.html exists", fs.existsSync(indexPath));
assert("bunker_survival_standalone.html exists", fs.existsSync(standalonePath));

const indexHtml = fs.readFileSync(indexPath, 'utf-8');
const standaloneHtml = fs.readFileSync(standalonePath, 'utf-8');

const requiredIds = [
  'game-canvas', 'hud-day', 'hud-pop', 'res-ammo', 'res-power', 'res-food', 'res-water',
  'res-metal', 'res-gunpowder', 'res-fuel', 'hud-radar', 'btn-speed-pause', 'btn-speed-1x',
  'btn-speed-2x', 'btn-speed-5x', 'btn-manual-aim', 'btn-open-roster', 'btn-open-research',
  'btn-open-expedition', 'btn-audio-toggle', 'btn-crt-toggle', 'btn-open-help', 'crt-overlay',
  'left-turret-hud', 'right-turret-hud', 'modal-overlay', 'modal-content'
];

for (const id of requiredIds) {
  assert(`index.html contains ID #${id}`, indexHtml.includes(`id="${id}"`));
  assert(`standalone.html contains ID #${id}`, standaloneHtml.includes(`id="${id}"`));
}

assert("Standalone file contains inlined CSS", standaloneHtml.includes("<style>"));
assert("Standalone file contains bundled JS", standaloneHtml.includes("<script>") && standaloneHtml.includes("class GameEngine"));

// -------------------------------------------------------------
// STEP 2: Setup Headless DOM Sandbox & Load Game Scripts
// -------------------------------------------------------------
console.log("\n--- 2. INITIALIZING HEADLESS DOM SANDBOX ---");

const domElements = {};
function createMockElement(id) {
  return {
    id: id,
    style: {},
    classList: {
      toggle: () => {},
      add: () => {},
      remove: () => {},
      contains: () => false
    },
    textContent: '',
    innerHTML: '',
    className: '',
    addEventListener: () => {},
    click: () => {}
  };
}

for (const id of requiredIds) {
  domElements[id] = createMockElement(id);
}

const mockCtx = {
  canvas: { width: 1280, height: 820 },
  clearRect: () => {},
  fillRect: () => {},
  strokeRect: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  arc: () => {},
  ellipse: () => {},
  closePath: () => {},
  fill: () => {},
  stroke: () => {},
  save: () => {},
  restore: () => {},
  translate: () => {},
  rotate: () => {},
  scale: () => {},
  measureText: (txt) => ({ width: (txt || '').length * 8 }),
  fillText: () => {},
  createLinearGradient: () => ({ addColorStop: () => {} }),
  createRadialGradient: () => ({ addColorStop: () => {} }),
  setLineDash: () => {},
  fillStyle: '#000',
  strokeStyle: '#000',
  lineWidth: 1,
  font: '10px sans-serif',
  textAlign: 'left',
  globalAlpha: 1.0,
  shadowColor: '#000',
  shadowBlur: 0,
  filter: 'none'
};

const mockCanvas = {
  width: 1280,
  height: 820,
  getContext: (type) => mockCtx,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 820 }),
  addEventListener: () => {}
};
domElements['game-canvas'] = mockCanvas;

const sandbox = {
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
  Math: Math,
  Date: Date,
  performance: { now: () => Date.now() },
  requestAnimationFrame: (cb) => {},
  document: {
    getElementById: (id) => domElements[id] || null,
    createElement: (tag) => createMockElement(tag),
    addEventListener: () => {},
    body: { classList: { toggle: () => {}, add: () => {}, remove: () => {} } }
  },
  window: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  Image: function() { this.src = ''; }
};
sandbox.window = sandbox;

// AudioContext mock
sandbox.AudioContext = function() {
  this.currentTime = 0;
  this.sampleRate = 44100;
  this.state = 'running';
  this.destination = {};
  this.createGain = () => ({
    gain: { value: 1, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
    connect: () => {}
  });
  this.createOscillator = () => ({
    type: 'sine',
    frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
    connect: () => {},
    start: () => {},
    stop: () => {}
  });
  this.createBuffer = () => ({ getChannelData: () => new Float32Array(100) });
  this.createBufferSource = () => ({ buffer: null, connect: () => {}, start: () => {} });
  this.createBiquadFilter = () => ({
    type: 'lowpass',
    frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
    connect: () => {}
  });
  this.resume = () => {};
};

const context = vm.createContext(sandbox);

const jsFiles = [
  'audio.js',
  'config.js',
  'particles.js',
  'turrets.js',
  'zombies.js',
  'bunker.js',
  'survivors.js',
  'engine.js',
  'ui.js'
];

for (const f of jsFiles) {
  const code = fs.readFileSync(path.join('/content/bunker_survival/js', f), 'utf-8');
  vm.runInContext(code, context, { filename: f });
}

assert("CONFIG is loaded and valid", sandbox.CONFIG && sandbox.CONFIG.INITIAL_RESOURCES.ammo === 250);
assert("Room templates defined (16 rooms)", sandbox.CONFIG.ROOM_TEMPLATES.length === 16);
assert("Survivor templates defined (5 initial crew)", sandbox.CONFIG.INITIAL_SURVIVORS.length === 5);
assert("Turret tiers defined (4 upgrade tiers)", sandbox.CONFIG.TURRET_TIERS.length === 4);
assert("All 5 zombie types defined", Object.keys(sandbox.CONFIG.ZOMBIE_TYPES).length === 5);

// -------------------------------------------------------------
// STEP 3: Initialize Game Engine & Systems
// -------------------------------------------------------------
console.log("\n--- 3. INITIALIZING ENGINE SUBSYSTEMS ---");

const engine = new sandbox.GameEngine(mockCanvas);
sandbox.gameEngine = engine;
sandbox.engine = engine;
const uiManager = new sandbox.UIManager();
sandbox.uiManager = uiManager;

assert("Game engine instantiated successfully", engine !== null);
assert("Left turret created at x=435", engine.leftTurret && engine.leftTurret.x === 435);
assert("Right turret created at x=845", engine.rightTurret && engine.rightTurret.x === 845);
assert("Elevator created at x=640", engine.elevator && engine.elevator.x === 640);
assert("16 Bunker rooms created", engine.rooms.length === 16);
assert("5 Survivors initialized", engine.survivors.length === 5);

// -------------------------------------------------------------
// STEP 4: Resource Flow & Room Production Audit
// -------------------------------------------------------------
console.log("\n--- 4. AUDITING PRODUCTION & RESOURCE CONSUMPTION ---");

const initialRes = { ...engine.resources };
assert("Initial resources valid without NaNs", Object.values(initialRes).every(v => !isNaN(v) && v >= 0));

// Step 50 ticks of production
for (let t = 0; t < 50; t++) {
  engine.update(0.1);
  for (const [k, v] of Object.entries(engine.resources)) {
    if (isNaN(v) || v < 0) {
      assert(`Resource ${k} valid after tick ${t}`, false, `Value: ${v}`);
    }
  }
}
assert("Resources remain positive and non-NaN through 50 ticks of production", true);

// Verify Armory manufactures ammo when metal and gunpowder are available
const armory = engine.getRoom('armory');
assert("Armory exists on floor 1", armory && armory.floor === 1 && armory.produces === 'ammo');
const ammoBefore = engine.resources.ammo;
engine.resources.metal = 50;
engine.resources.gunpowder = 50;
const worker = engine.survivors[0]; // Marcus Cole
armory.update(2.0, [worker], true);
assert("Armory produces ammo when worker and components present", engine.resources.ammo > ammoBefore);

// -------------------------------------------------------------
// STEP 5: Turret Targeting, Auto-Fire, Recoil, and Ammo Logistics
// -------------------------------------------------------------
console.log("\n--- 5. AUDITING TURRETS & COMBAT SIMULATION ---");

// Spawn shambler on left
const zLeft = new sandbox.Zombie('shambler', 'left');
zLeft.x = 300; // Within range 340 of left turret (x=435)
engine.zombies.push(zLeft);

const initialTurretAmmo = engine.leftTurret.ammo;
engine.leftTurret.update(0.1, engine.zombies);
assert("Left turret aims and locks onto approaching zombie", engine.leftTurret.target === zLeft);

// Let left turret fire
const ammoBeforeShot = engine.leftTurret.ammo;
engine.leftTurret.cooldown = 0;
engine.leftTurret.fire();
assert("Turret consumes ammo on fire", engine.leftTurret.ammo === ammoBeforeShot - 1);
assert("Zombie takes damage from turret", zLeft.hp < zLeft.maxHp);
assert("Tracer generated by turret shot", engine.particles.tracers.length > 0);
assert("Shell casing ejected", engine.particles.particles.some(p => p.isCasing));

// Test target prioritization switching
engine.leftTurret.setPriority('lowest_hp');
assert("Turret priority set to lowest_hp", engine.leftTurret.priorityMode === 'lowest_hp');
engine.leftTurret.cyclePriority();
assert("Turret priority cycles properly", engine.leftTurret.priorityMode === 'strongest');

// Test Turret Upgrade
engine.resources.metal = 200;
engine.resources.gunpowder = 100;
const upgraded = engine.leftTurret.upgrade();
assert("Left turret upgrade to Tier 2 (Twin Autocannon) succeeds", upgraded && engine.leftTurret.tierIndex === 1);
assert("Turret maxAmmo scales with tier", engine.leftTurret.stats.maxAmmo === 200);

// Test Manual Crosshair Aim Mode
engine.toggleManualAim();
assert("Manual aim mode toggles on", engine.manualAim === true);
engine.mouseX = 250;
engine.mouseY = 230;
engine.leftTurret.cooldown = 0;
const manualFired = engine.leftTurret.fireManual(250, 230);
assert("Manual aim raycast shot executes cleanly", manualFired === true);
engine.toggleManualAim();
assert("Manual aim mode toggles off cleanly", engine.manualAim === false);

// -------------------------------------------------------------
// STEP 6: Autonomous Ammo Runner Logistics (Bunker -> Elevator -> Surface -> Turret)
// -------------------------------------------------------------
console.log("\n--- 6. AUDITING AUTONOMOUS AMMO RUNNER LOGISTICS ---");

// Force right turret low ammo to trigger autonomous runner dispatch
engine.rightTurret.ammo = 10;
engine.resources.ammo = 150;

// Cancel any active tasks
for (const s of engine.survivors) {
  s.ammoDeliveryTask = null;
  s.carryingAmmo = false;
}

engine.checkAmmoLogistics();
const dispatchedRunner = engine.survivors.find(s => s.ammoDeliveryTask && s.ammoDeliveryTask.turret === engine.rightTurret);
assert("Autonomous ammo runner dispatched when turret ammo < 35%", dispatchedRunner !== undefined);

console.log(`    Runner ${dispatchedRunner.name} initiated task. Simulating transit loop...`);
assert("Runner initial phase is 'to_armory'", dispatchedRunner.ammoDeliveryTask.phase === 'to_armory');

// Simulate runner loop until restock completed
let steps = 0;
let restocked = false;
while (steps < 350) {
  steps++;
  dispatchedRunner.update(0.1);
  engine.elevator.update(0.1);
  if (engine.rightTurret.ammo > 50) {
    restocked = true;
    break;
  }
}
assert(`Runner reaches surface and restocks right turret (took ${steps} ticks)`, restocked && engine.rightTurret.ammo >= 60);
assert("Dispatched runner earned XP for completing ammo delivery run", dispatchedRunner.xp >= sandbox.CONFIG.SURVIVOR_XP_AMMO_RUN);

// -------------------------------------------------------------
// STEP 7: Autonomous Survivor Needs & XP Progression
// -------------------------------------------------------------
console.log("\n--- 7. AUDITING SURVIVOR AUTONOMOUS NEEDS & LEVEL UPS ---");

const testSurvivor = engine.survivors[1]; // Elena Vance
testSurvivor.thirst = 30; // Below 40 threshold
testSurvivor.needState = null;
testSurvivor.ammoDeliveryTask = null;
engine.resources.water = 50;

testSurvivor.update(0.1);
assert("Survivor autonomously enters 'seeking_water' when thirst < 40", testSurvivor.needState === 'seeking_water');

// Simulate drinking
for (let s = 0; s < 100; s++) {
  testSurvivor.update(0.1);
  if (testSurvivor.thirst === 100) break;
}
assert("Survivor satisfied thirst autonomously at water filtration", testSurvivor.thirst === 100);

// Survivor XP promotion audit
const currentLvl = testSurvivor.level;
testSurvivor.addXP(400);
assert("Survivor promoted to higher level upon reaching XP threshold", testSurvivor.level > currentLvl);
assert("Survivor efficiency increased after promotion", testSurvivor.getEfficiency() > 1.0);

// -------------------------------------------------------------
// STEP 8: Threat System, All Zombie Archetypes, and Acid Puddles
// -------------------------------------------------------------
console.log("\n--- 8. AUDITING THREAT SYSTEM & ZOMBIE ARCHETYPES ---");

const archetypes = ['shambler', 'runner', 'armored', 'spitter', 'brute'];
for (const type of archetypes) {
  const z = new sandbox.Zombie(type, 'right');
  assert(`Zombie archetype '${type}' instantiates with proper stats`, z.hp > 0 && z.maxHp > 0 && z.size > 0);
}

// Acid spitter mechanics
const spitter = new sandbox.Zombie('spitter', 'left');
spitter.x = 435 - 150; // In spit range
spitter.spitCooldown = 0;
spitter.update(0.1);

assert("Acid spitter fires toxic acid projectile towards turret", engine.particles.spitProjectiles.length > 0);

// Advance projectile to impact and form acid puddle
for (let i = 0; i < 20; i++) {
  engine.particles.update(0.1);
}
assert("Acid spit creates hazard acid puddle on the ground upon impact", engine.particles.acidPuddles.length > 0);

const acidPuddle = engine.particles.acidPuddles[0];
assert("Acid puddle has duration and DPS defined", acidPuddle.life > 0 && acidPuddle.damage > 0);

// Blood decals and memory cap
const initialDecalsCount = engine.particles.bloodDecals.length;
for (let i = 0; i < 160; i++) {
  engine.particles.spawnBloodDecal(200 + i, 240);
}
assert("Blood decals are capped at 140 max to prevent memory leaks", engine.particles.bloodDecals.length <= 140);

// Wave Manager
assert("Wave manager initialized with wave 0", engine.waveManager.currentWave === 0);
engine.waveManager.timer = 10;
engine.waveManager.sirenPlayed = false;
engine.waveManager.update(0.1, engine.zombies);
assert("Siren triggers warning before wave arrival", engine.waveManager.sirenPlayed === true);

engine.waveManager.timer = 0;
engine.waveManager.update(0.1, engine.zombies);
assert("Horde triggers wave 1 with spawn queue", engine.waveManager.isHordeActive && engine.waveManager.currentWave === 1);

// -------------------------------------------------------------
// STEP 9: 500-Tick Full Headless Engine Simulation
// -------------------------------------------------------------
console.log("\n--- 9. RUNNING 500-TICK CONTINUOUS FULL SIMULATION ---");

let simulationErrors = 0;
for (let tick = 0; tick < 500; tick++) {
  try {
    engine.update(0.05); // 0.05s per tick = 25 seconds of simulated real-time gameplay
    engine.draw();       // Full render pass
    uiManager.updateHUD(); // Full HUD sync
  } catch (err) {
    simulationErrors++;
    console.error(`Simulation error at tick ${tick}:`, err);
    break;
  }
}
assert("500 simulation ticks and render passes completed with ZERO exceptions", simulationErrors === 0);

// Check final state sanity
assert("Days survived tracked", engine.stats.daysSurvived >= 1);
assert("No resources corrupted into NaN", Object.values(engine.resources).every(v => !isNaN(v)));
assert("Cabin HP intact or damaged without NaN", !isNaN(engine.houseHp) && engine.houseHp > 0);

// -------------------------------------------------------------
// STEP 10: Modals & Interactive UI Controllers
// -------------------------------------------------------------
console.log("\n--- 10. AUDITING MODALS & UI INTERACTION ---");

uiManager.openRoomModal(armory);
assert("Room modal renders without error", domElements['modal-content'].innerHTML.includes("Munitions Armory"));

uiManager.openTurretModal(engine.leftTurret);
assert("Turret modal renders specs and upgrades", domElements['modal-content'].innerHTML.includes("DEFENSE TURRET"));

uiManager.openSurvivorsRoster();
assert("Survivors roster modal renders all crew", domElements['modal-content'].innerHTML.includes("Marcus Cole"));

uiManager.openResearchModal();
assert("Research tech tree modal renders technologies", domElements['modal-content'].innerHTML.includes("autoConduit") || domElements['modal-content'].innerHTML.includes("Automated"));

uiManager.openExpeditionModal();
assert("Expedition modal renders options", domElements['modal-content'].innerHTML.includes("Expedition"));

uiManager.openHelpModal();
assert("Help / Guide modal renders complete instructions", domElements['modal-content'].innerHTML.toLowerCase().includes("guide"));

uiManager.closeModal();
assert("Modal closes cleanly", domElements['modal-overlay'].style.display === 'none');

console.log("\n===============================================================================");
console.log(`🎉 ALL ${passedTests}/${totalTests} AUDIT TESTS & SIMULATION CHECKS PASSED PERFECTLY!`);
console.log("===============================================================================");
