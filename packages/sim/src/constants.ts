/** Fixed simulation rate. The renderer interpolates between steps. */
export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

/** Pixel size of one tile in the reference art. The simulation itself works in tile units. */
export const TILE_SIZE = 16;

/** 1 real second = 1 in-game minute, i.e. a 24-minute day. */
export const GAME_MINUTES_PER_SECOND = 1;
export const DEFAULT_START_MINUTES = 21 * 60 + 30;

export const PLAYER_HALF_EXTENT = 0.3;
export const NPC_HALF_EXTENT = 0.27;
export const PLAYER_WALK_SPEED = 3.4;
export const PLAYER_RUN_SPEED = 6.4;
export const PLAYER_ACCEL = 40;
export const TURN_RATE = 20;
export const NPC_RUN_SPEED = 4.6;

export const INTERACT_RANGE = 1.5;
export const ENTRANCE_RANGE = 1.1;

/** How long an NPC holds a grudge after being shoved (short-term memory; long-term memory arrives with M4). */
export const GRUDGE_TICKS = TICK_RATE * 180;
export const ALARM_RADIUS = 7;
/** Max A* searches per tick; NPCs that miss out simply wait one more tick. */
export const PATH_BUDGET_PER_TICK = 4;

/** What a Co-op shuttle run to another visited district costs. */
export const SHUTTLE_FARE = 30;
