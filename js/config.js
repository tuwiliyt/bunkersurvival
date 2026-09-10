// Game Configuration & Constants
const CONFIG = {
  CANVAS_WIDTH: 1280,
  CANVAS_HEIGHT: 820,
  SURFACE_Y: 240,
  ELEVATOR_X: 640,
  ELEVATOR_WIDTH: 56,
  
  BUNKER_LEFT: 180,
  BUNKER_RIGHT: 1100,
  BUNKER_TOP: 280,
  FLOOR_HEIGHT: 130,
  FLOORS_COUNT: 4,
  ROOMS_PER_FLOOR: 4,

  // Initial Resources
  INITIAL_RESOURCES: {
    ammo: 250,       // Crucial focus
    power: 200,      // Max 200 (Emergency Battery Storage Buffer)
    food: 80,
    water: 80,
    metal: 60,
    gunpowder: 40,
    meds: 5,
    fuel: 50
  },

  // Max Resource Capacities
  RESOURCE_CAPS: {
    ammo: 1000,
    power: 200,      // Expanded Emergency Battery Storage Buffer (was 100)
    food: 200,
    water: 200,
    metal: 300,
    gunpowder: 200,
    meds: 20,
    fuel: 150
  },

  // Consumption rates (per survivor per second at 1x)
  SURVIVOR_HUNGER_RATE: 0.07,
  SURVIVOR_THIRST_RATE: 0.10,
  SURVIVOR_FATIGUE_RATE: 0.05,
  HUNGER_THRESHOLD: 40,
  THIRST_THRESHOLD: 40,
  FATIGUE_REST_THRESHOLD: 80,
  FATIGUE_WAKE_THRESHOLD: 15,

  // Solar Power & Renewable Energy System (Cabin Roof Array)
  SOLAR_POWER_OUTPUT: 15.0, // +15 kW passive clean energy during daylight hours
  SOLAR_DAY_START: 6.0,     // 06:00
  SOLAR_DAY_END: 18.0,      // 18:00

  // Generator & Power Grid Logistics
  GENERATOR_BASE_OUTPUT: 30.0, // Base output kW when generator is active (was 15-20 kW)
  GENERATOR_FUEL_RATE: 0.04,   // 0.04 fuel/sec (increased efficiency: 750 kW·s per unit of fuel)
  POWER_AUTONOMOUS_THRESHOLD: 0.40, // 40% battery threshold (80 kW) triggers autonomous fueling & maintenance
  POWER_RESTORED_THRESHOLD: 0.85,   // 85% battery threshold (170 kW) restores survivor to original post

  // Bio-Refinery Passive Emergency Production
  BIO_REFINERY_PASSIVE_RATE: 0.18, // 0.18 fuel/sec passive generation even with 0 workers

  // Ammo Supply Logistics
  AMMO_DELIVERY_THRESHOLD: 0.35, // Restock turret when ammo < 35%
  AMMO_CRATE_DELIVERY_AMOUNT: 60, // Rounds delivered per crate

  // Survivor Progression & Mastery
  SURVIVOR_MAX_LEVEL: 5,
  SURVIVOR_LEVEL_TITLES: ['Apprentice', 'Journeyman', 'Specialist', 'Expert', 'Master'],
  SURVIVOR_XP_PER_SEC_WORKING: 1.5,
  SURVIVOR_XP_SPECIALTY_MULT: 1.8,
  SURVIVOR_XP_AMMO_RUN: 40,
  SURVIVOR_XP_WAVE_SURVIVED: 50,

  // Wave & Threat Timing
  AMBIENT_SPAWN_INTERVAL_MIN: 15,
  AMBIENT_SPAWN_INTERVAL_MAX: 30,
  HORDE_INTERVAL: 95,
  HORDE_WARNING_TIME: 14,
  ACID_PUDDLE_DURATION: 8.0,
  ACID_PUDDLE_DPS: 3.5,

  // Room Definitions (4 floors x 4 columns = 16 rooms)
  ROOM_TEMPLATES: [
    // Floor 1: Sub-level 1 (Command & Defense)
    { id: 'airlock', floor: 1, col: 0, name: 'Airlock Depot', icon: '🚪', color: '#3d4f5d', 
      desc: 'Dispatches surface scavengers & controls entry.', 
      produces: null, maxWorkers: 2, powerCost: 1 },
    { id: 'armory', floor: 1, col: 1, name: 'Munitions Armory', icon: '📦', color: '#684a28', 
      desc: 'Manufactures turret ammunition from metal & gunpowder.', 
      produces: 'ammo', rate: 4.0, cost: { metal: 0.4, gunpowder: 0.4 }, maxWorkers: 3, powerCost: 4 },
    { id: 'security', floor: 1, col: 2, name: 'Security & Radar', icon: '📡', color: '#274b5e', 
      desc: 'Tracks incoming swarms, increases turret accuracy by 25%.', 
      produces: null, maxWorkers: 2, powerCost: 3 },
    { id: 'clinic', floor: 1, col: 3, name: 'Medical Clinic', icon: '🩹', color: '#66222b', 
      desc: 'Heals injured survivors and manufactures first-aid kits.', 
      produces: 'meds', rate: 0.08, maxWorkers: 2, powerCost: 2 },

    // Floor 2: Sub-level 2 (Life & Sustenance)
    { id: 'quarters_1', floor: 2, col: 0, name: 'Living Quarters A', icon: '🛏️', color: '#383b48', 
      desc: 'Survivors rest here to restore stamina & morale.', 
      produces: null, maxWorkers: 4, powerCost: 1 },
    { id: 'hydroponics', floor: 2, col: 1, name: 'Hydroponics Bay', icon: '🌱', color: '#2d5a36', 
      desc: 'Cultivates fresh crops using nutrient-rich water.', 
      produces: 'food', rate: 1.2, cost: { water: 0.3 }, maxWorkers: 3, powerCost: 3 },
    { id: 'water_filter', floor: 2, col: 2, name: 'Water Filtration', icon: '💧', color: '#1f4863', 
      desc: 'Purifies subterranean well water into drinking water.', 
      produces: 'water', rate: 1.5, maxWorkers: 2, powerCost: 2 },
    { id: 'kitchen', floor: 2, col: 3, name: 'Mess Hall & Kitchen', icon: '🍲', color: '#574229', 
      desc: 'Prepares nutritious meals, boosting survivor morale.', 
      produces: null, maxWorkers: 2, powerCost: 2 },

    // Floor 3: Sub-level 3 (Industry & Tech)
    { id: 'quarters_2', floor: 3, col: 0, name: 'Living Quarters B', icon: '🛏️', color: '#383b48', 
      desc: 'Additional living space for expanded survivor population.', 
      produces: null, maxWorkers: 4, powerCost: 1 },
    { id: 'workshop', floor: 3, col: 1, name: 'Fabrication Workshop', icon: '🔧', color: '#504439', 
      desc: 'Fabricates spare parts, scrap metal, and turret repairs.', 
      produces: 'metal', rate: 1.0, maxWorkers: 3, powerCost: 4 },
    { id: 'gunpowder_lab', floor: 3, col: 2, name: 'Chemical & Powder Lab', icon: '⚗️', color: '#4a3356', 
      desc: 'Synthesizes saltpeter and sulfur into gunpowder for ammo.', 
      produces: 'gunpowder', rate: 1.2, maxWorkers: 3, powerCost: 3 },
    { id: 'research', floor: 3, col: 3, name: 'Research Lab', icon: '🔬', color: '#2b445e', 
      desc: 'Researches defensive technologies and efficiency upgrades.', 
      produces: 'tech', rate: 0.5, maxWorkers: 2, powerCost: 4 },

    // Floor 4: Sub-level 4 (Deep Infrastructure)
    { id: 'generator', floor: 4, col: 0, name: 'Diesel Generator', icon: '⚡', color: '#68451f', 
      desc: 'Heavy industrial backup power plant providing high-yield electricity to bunker & turrets.', 
      produces: 'power', rate: 30.0, cost: { fuel: 0.04 }, maxWorkers: 2, powerCost: 0 },
    { id: 'bio_refinery', floor: 4, col: 1, name: 'Bio-Fuel Refinery', icon: '🛢️', color: '#494420', 
      desc: 'Refines organic biomass into diesel fuel (passive compost fermentation + active distillation).', 
      produces: 'fuel', rate: 0.75, maxWorkers: 2, powerCost: 3 },
    { id: 'mine', floor: 4, col: 2, name: 'Deep Excavation', icon: '⛏️', color: '#3a3532', 
      desc: 'Mines subterranean rock for raw metals and sulfur.', 
      produces: 'metal', rate: 1.4, maxWorkers: 3, powerCost: 3 },
    { id: 'life_support', floor: 4, col: 3, name: 'Air & Life Support', icon: '🌀', color: '#274b4e', 
      desc: 'Circulates clean oxygen, preventing bunker suffocation.', 
      produces: null, maxWorkers: 2, powerCost: 3 }
  ],

  // Turret Level Stats
  TURRET_TIERS: [
    { level: 1, name: 'Sentry Gun 9mm', damage: 28, fireRate: 0.20, range: 390, maxAmmo: 120, upgradeCost: { metal: 50 } },
    { level: 2, name: 'Twin Autocannon', damage: 46, fireRate: 0.14, range: 440, maxAmmo: 220, upgradeCost: { metal: 120, gunpowder: 40 } },
    { level: 3, name: 'Vulcan Minigun', damage: 68, fireRate: 0.07, range: 500, maxAmmo: 450, upgradeCost: { metal: 220, gunpowder: 80 } },
    { level: 4, name: 'Heavy Plasma Cannon', damage: 195, fireRate: 0.32, range: 580, maxAmmo: 650, upgradeCost: null }
  ],

  // Zombie Types (Balanced for engaging survival experience)
  ZOMBIE_TYPES: {
    shambler: { name: 'Walker', hp: 38, speed: 20, damage: 6, color: '#4a754e', size: 16, reward: { metal: 3, gunpowder: 2 } },
    runner: { name: 'Feral Runner', hp: 24, speed: 44, damage: 8, color: '#883b3b', size: 14, reward: { metal: 2, gunpowder: 3 } },
    armored: { name: 'Riot Armored', hp: 80, speed: 16, damage: 10, color: '#3f4e56', size: 18, reward: { metal: 8, gunpowder: 4 } },
    spitter: { name: 'Acid Spitter', hp: 34, speed: 20, range: 210, damage: 8, color: '#68882d', size: 15, reward: { metal: 4, gunpowder: 6 } },
    brute: { name: 'Goliath Brute', hp: 240, speed: 12, damage: 18, color: '#7a2d2d', size: 24, reward: { metal: 18, gunpowder: 15 } }
  },

  // Population & Living Quarters
  BASE_POPULATION_CAP: 8,
  POPULATION_PER_QUARTERS_TIER: 2,

  // Initial Survivors
  INITIAL_SURVIVORS: [
    { id: 's1', name: 'Marcus Cole', role: 'Chief Gunsmith', skill: 'Munitions', avatar: '👨‍🔧', hp: 100, maxHp: 100, hunger: 90, thirst: 90, fatigue: 0, morale: 95, assignedRoom: 'armory', specialty: 'armory' },
    { id: 's2', name: 'Elena Vance', role: 'Combat Engineer', skill: 'Mechanic', avatar: '👩‍🏭', hp: 100, maxHp: 100, hunger: 85, thirst: 90, fatigue: 0, morale: 90, assignedRoom: 'workshop', specialty: 'workshop' },
    { id: 's3', name: 'Doc Sarah Chen', role: 'Field Physician', skill: 'Medicine', avatar: '👩‍⚕️', hp: 100, maxHp: 100, hunger: 95, thirst: 95, fatigue: 0, morale: 88, assignedRoom: 'clinic', specialty: 'clinic' },
    { id: 's4', name: 'Toby Miller', role: 'Agri-Specialist', skill: 'Botany', avatar: '👨‍🌾', hp: 100, maxHp: 100, hunger: 90, thirst: 90, fatigue: 0, morale: 92, assignedRoom: 'hydroponics', specialty: 'hydroponics' },
    { id: 's5', name: 'Aiden Brooks', role: 'Security Guard', skill: 'Ballistics', avatar: '👮‍♂️', hp: 100, maxHp: 100, hunger: 88, thirst: 85, fatigue: 0, morale: 90, assignedRoom: 'security', specialty: 'security' }
  ],

  // 6 New Unique Survivor Archetypes (Rescued from Horde Waves)
  UNIQUE_ARCHETYPES: [
    {
      id: 'jackson',
      name: 'Jackson Cross',
      role: 'Master Sniper',
      skill: 'Marksman',
      avatar: '🎯',
      specialty: 'security',
      assignedRoom: 'security',
      hp: 100,
      maxHp: 100,
      desc: 'Expert marksman with lethal rifle skills. Provides surface watchtower sniper overwatch.',
      quote: 'Target acquired. Down in one.'
    },
    {
      id: 'maya',
      name: 'Maya Lin',
      role: 'Electrical Engineer',
      skill: 'Power Grid',
      avatar: '⚡',
      specialty: 'generator',
      assignedRoom: 'generator',
      hp: 100,
      maxHp: 100,
      desc: 'Maintains generator, solar grid, and electrical systems. Autonomously prevents power blackouts.',
      quote: 'Keep the turbines humming, keep the lights burning.'
    },
    {
      id: 'carlos',
      name: 'Carlos Ortiz',
      role: 'Master Builder',
      skill: 'Architecture',
      avatar: '👷‍♂️',
      specialty: 'workshop',
      assignedRoom: 'workshop',
      hp: 100,
      maxHp: 100,
      desc: 'Architect and builder. Autonomously repairs damaged defenses and speeds up construction.',
      quote: 'Measure twice, fortify once.'
    },
    {
      id: 'samantha',
      name: 'Samantha Bell',
      role: 'Logistics Porter',
      skill: 'Speed Courier',
      avatar: '🏃‍♀️',
      specialty: 'armory',
      assignedRoom: 'armory',
      hp: 100,
      maxHp: 100,
      speed: 78,
      desc: 'Dedicated rapid ammo carrier (+50% sprint speed). Ensures turrets never run dry.',
      quote: 'Ammo delivery inbound, moving fast!'
    },
    {
      id: 'lucas',
      name: 'Lucas Reed',
      role: 'Combat Medic',
      skill: 'Trauma Surgery',
      avatar: '💉',
      specialty: 'clinic',
      assignedRoom: 'clinic',
      hp: 100,
      maxHp: 100,
      desc: 'Battle-hardened physician. Administers rapid triage and medical care in the clinic.',
      quote: 'Hold on, I will get you patched up.'
    },
    {
      id: 'boris',
      name: 'Boris Volkov',
      role: 'Heavy Demolitionist',
      skill: 'High Explosives',
      avatar: '💣',
      specialty: 'armory',
      assignedRoom: 'armory',
      hp: 100,
      maxHp: 100,
      desc: 'Heavy ordnance specialist. Vastly accelerates munitions production and crafts explosive rounds.',
      quote: 'More gunpowder, bigger boom!'
    }
  ],

  // Extra Veteran Survivors for population expansion up to 16+
  EXTRA_ARCHETYPES: [
    { name: 'Harper Vance', role: 'Field Scout', skill: 'Tracking', avatar: '🏹', specialty: 'airlock', assignedRoom: 'airlock' },
    { name: 'Viktor Kozlov', role: 'Chief Blacksmith', skill: 'Metallurgy', avatar: '⚒️', specialty: 'mine', assignedRoom: 'mine' },
    { name: 'Chloe Bennett', role: 'Bio-Chemist', skill: 'Synthetics', avatar: '🧪', specialty: 'gunpowder_lab', assignedRoom: 'gunpowder_lab' },
    { name: 'Derek Stone', role: 'Veteran Marine', skill: 'Tactics', avatar: '🎖️', specialty: 'security', assignedRoom: 'security' },
    { name: 'Zoe Gallagher', role: 'Hydroponics Botanist', skill: 'Agriculture', avatar: '🌿', specialty: 'hydroponics', assignedRoom: 'hydroponics' },
    { name: 'Mason Wright', role: 'Tunnel Excavator', skill: 'Mining', avatar: '⛏️', specialty: 'mine', assignedRoom: 'mine' }
  ]
};

window.CONFIG = CONFIG;
