// Automated Verification of BUNKER PROTOCOL Power Systems
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log("⚡ TESTING BUNKER PROTOCOL OVERHAULED POWER SYSTEMS ⚡\n");

function assert(desc, condition, details = "") {
  if (condition) {
    console.log(`  ✅ [PASS] ${desc}`);
  } else {
    console.error(`  ❌ [FAIL] ${desc} - ${details}`);
    process.exit(1);
  }
}

// Setup sandbox
const domElements = {
  'game-canvas': { width: 1280, height: 820, getContext: () => mockCtx, addEventListener: () => {} },
  'hud-day': { textContent: '' },
  'hud-pop': { textContent: '' },
  'res-ammo': { textContent: '', style: {} },
  'res-power': { textContent: '', style: {}, parentElement: { title: '' } },
  'res-food': { textContent: '', style: {} },
  'res-water': { textContent: '', style: {} },
  'res-metal': { textContent: '', style: {} },
  'res-gunpowder': { textContent: '', style: {} },
  'res-fuel': { textContent: '', style: {} },
  'hud-radar': { className: '', innerHTML: '' },
  'left-turret-hud': { innerHTML: '', querySelector: () => null },
  'right-turret-hud': { innerHTML: '', querySelector: () => null },
  'modal-overlay': { style: {} },
  'modal-content': { innerHTML: '' }
};

const mockCtx = {
  canvas: { width: 1280, height: 820 },
  clearRect: () => {},
  fillRect: () => {},
  strokeRect: () => {},
  rect: () => {},
  roundRect: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  arc: () => {},
  ellipse: () => {},
  quadraticCurveTo: () => {},
  bezierCurveTo: () => {},
  closePath: () => {},
  fill: () => {},
  stroke: () => {},
  save: () => {},
  restore: () => {},
  translate: () => {},
  rotate: () => {},
  scale: () => {},
  measureText: (t) => ({ width: (t || '').length * 8 }),
  fillText: () => {},
  createLinearGradient: () => ({ addColorStop: () => {} }),
  createRadialGradient: () => ({ addColorStop: () => {} })
};

const sandbox = {
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
  Math: Math,
  Date: Date,
  performance: { now: () => Date.now() },
  requestAnimationFrame: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  document: {
    getElementById: (id) => domElements[id] || null,
    createElement: () => ({ style: {}, classList: { add: () => {}, remove: () => {} } }),
    addEventListener: () => {}
  },
  AudioContext: function() {
    this.createGain = () => ({ gain: { setValueAtTime: () => {} }, connect: () => {} });
    this.createOscillator = () => ({ connect: () => {}, start: () => {}, stop: () => {}, frequency: { setValueAtTime: () => {} } });
  }
};
sandbox.window = sandbox;

const vmContext = vm.createContext(sandbox);
const jsFiles = ['audio.js', 'config.js', 'particles.js', 'turrets.js', 'zombies.js', 'bunker.js', 'survivors.js', 'engine.js', 'ui.js'];
for (const f of jsFiles) {
  const code = fs.readFileSync(path.join('/content/bunker_survival/js', f), 'utf-8');
  vm.runInContext(code, vmContext, { filename: f });
}

const engine = new sandbox.GameEngine(domElements['game-canvas']);
sandbox.gameEngine = engine;
const ui = new sandbox.UIManager();

// TEST 1: Battery Buffer Configuration
assert("Battery capacity buffer is 200 kW", sandbox.CONFIG.RESOURCE_CAPS.power === 200);
assert("Initial battery begins at 200 kW buffer", sandbox.CONFIG.INITIAL_RESOURCES.power === 200);

// TEST 2: Solar Power Generation during daylight
console.log("\n--- Testing Solar Roof Array ---");
engine.dayTime = 12.0; // High Noon
engine.resources.power = 100;
engine.updatePowerGrid(1.0);
assert("Solar output is active and positive at noon", engine.solarOutput >= 14.5);
assert("Net power flow is positive during daytime with solar", engine.netPowerFlow > 0);

engine.dayTime = 0.0; // Midnight
engine.updatePowerGrid(1.0);
assert("Solar output is 0 kW at midnight", engine.solarOutput === 0);

// TEST 3: Diesel Generator and Fuel Efficiency
console.log("\n--- Testing Diesel Generator & Fuel Efficiency ---");
engine.dayTime = 0.0; // Night
engine.resources.fuel = 50;
engine.resources.power = 100;
const engineer = engine.survivors.find(s => s.specialty === 'workshop' || s.name.includes('Elena'));
engineer.assignedRoom = 'generator';
engineer.status = 'working';

const fuelBefore = engine.resources.fuel;
engine.updatePowerGrid(1.0);
assert("Diesel generator produces power when staffed and fueled", engine.generatorOutput >= 30.0);
assert("Generator fuel consumption is highly efficient (~0.04/s)", engine.resources.fuel < fuelBefore && engine.resources.fuel >= fuelBefore - 0.05);
assert("Net power flow at night with generator is positive (charges battery)", engine.netPowerFlow > 0);

// TEST 4: Bio-Refinery Passive Emergency Generation
console.log("\n--- Testing Bio-Refinery Passive Emergency Generation ---");
engine.resources.fuel = 20;
const bioRefinery = engine.getRoom('bio_refinery');
// Update bio-refinery with 0 workers
const fuelBeforePassive = engine.resources.fuel;
bioRefinery.update(2.0, [], true);
assert("Bio-refinery produces fuel passively even with 0 workers", engine.resources.fuel > fuelBeforePassive);

// TEST 5: Smart Autonomous Fueling AI
console.log("\n--- Testing Smart Autonomous Fueling AI (<40% threshold) ---");
// Reset all workers away from generator
for (const s of engine.survivors) {
  s.assignedRoom = s.specialty || 'workshop';
  s.generatorMaintenanceTask = null;
  s.status = 'working';
}
engine.dayTime = 0.0; // Midnight (solar off)
engine.resources.power = 70; // 35% (< 40% of 200 = 80)
engine.resources.fuel = 40;
engine.lastAutonomousPowerDispatch = -999;

engine.checkAutonomousPowerGrid(1.0);
const dispatched = engine.survivors.find(s => s.generatorMaintenanceTask);
assert("Survivor autonomously dispatched to generator when power < 40%", dispatched !== undefined);
assert("Dispatched survivor assigned to generator room", dispatched.assignedRoom === 'generator');
assert("Dispatched survivor remembers original post", dispatched.generatorMaintenanceTask.originalRoom !== undefined);

// Simulate battery recharging to >= 85% (170 kW)
engine.resources.power = 175;
engine.checkAutonomousPowerGrid(1.0);
assert("Survivor restored to original post once battery reaches >= 85%", dispatched.generatorMaintenanceTask === null);

console.log("\n============================================================");
console.log("🎉 ALL POWER SYSTEM VALIDATION TESTS COMPLETED SUCCESSFULLY!");
console.log("============================================================\n");
