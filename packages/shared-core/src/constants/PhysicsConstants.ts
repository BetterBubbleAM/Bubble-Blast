export const PhysicsConstants = {
    FIXED_TIME_STEP: 1 / 60,
    MAX_SUB_STEPS: 5,

    // Movement
    MAX_VELOCITY: 5000,
    MIN_VELOCITY: 0,
    FRICTION: 0.98,

    // Collision
    COLLISION_ITERATIONS: 2,
    PENETRATION_SLOP: 0.01,
    CORRECTION_PERCENT: 0.8,

    // Spatial Hash
    GRID_CELL_SIZE: 128,

    // Mass / Size
    MIN_RADIUS: 4,
    MAX_RADIUS: 1500,

    // Decay
    MASS_DECAY_RATE: 0.0005,

    // Split / Merge
    SPLIT_FORCE: 800,
    MERGE_DELAY_MS: 15000,
    MERGE_DISTANCE_FACTOR: 1.1
} as const;

export type PhysicsConstantsType = typeof PhysicsConstants;