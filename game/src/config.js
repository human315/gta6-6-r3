// Sunhaven shared constants: world size, tuning numbers and palette.
// One job: every number the rest of the game agrees on lives here.

export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_W = 96;
export const BLOCK = 400;
export const STEP = 1 / 60;

export const SAVE_KEY = 'sunhaven-save-v1';

// Player tuning.
export const WALK_SPEED = 215;
export const RUN_SPEED = 300;
export const PLAYER_RADIUS = 14;
export const PLAYER_HEALTH = 100;
export const START_AMMO = 36;
export const MAX_AMMO = 120;

// Car tuning.
export const CAR_LENGTH = 52;
export const CAR_WIDTH = 26;
export const CAR_ACCEL = 620;
export const CAR_BRAKE = 900;
export const CAR_MAX_SPEED = 560;
export const CAR_REVERSE_MAX = 190;
export const CAR_STEER = 2.6;
export const CAR_DRAG = 0.55;

// Wanted / police tuning.
export const MAX_WANTED = 5;
export const COP_FOOT_SPEED = 235;
export const COP_CAR_SPEED = 540;
export const WANTED_DECAY_SECONDS = 9;
export const BUST_HOLD_SECONDS = 1.4;

// Combat tuning.
export const BULLET_SPEED = 980;
export const BULLET_RANGE = 640;
export const GUN_DAMAGE = 34;
export const ENEMY_HEALTH = 70;
export const SHOOT_COOLDOWN = 0.22;

// Traffic / pedestrians.
export const TRAFFIC_COUNT = 26;
export const PED_COUNT = 34;
export const TRAFFIC_SPEED_MIN = 120;
export const TRAFFIC_SPEED_MAX = 210;

// Mission rewards.
export const MISSION_REWARDS = [400, 900, 1200, 5000];

// Sun-soaked coastal palette.
export const PALETTE = {
  grass: '#7fae5a',
  grassDry: '#93bd68',
  sand: '#e8d29a',
  water: '#2e7fa8',
  waterDeep: '#1f5f86',
  road: '#3a3f46',
  roadEdge: '#2c3036',
  lane: '#e8d44d',
  sidewalk: '#b9b3a4',
  buildingRoof: ['#c96f4a', '#d9a05b', '#7d8ba0', '#a8576b', '#5b8a72', '#b08954', '#6e7f9e'],
  buildingWall: ['#e8dcc8', '#f2e6d0', '#dfe6ea', '#f0d9c0', '#e2d3b8'],
  tree: '#3f7d3a',
  treeDark: '#2f6130',
  park: '#6da34e',
  player: '#2f6fd0',
  playerShirt: '#f2c14e',
  cop: '#1d3f8f',
  copCar: '#22356e',
  hudBg: 'rgba(8, 14, 20, 0.62)',
  hudText: '#f4f1e6',
  accent: '#ffb02e',
  danger: '#ff4d3d',
};
