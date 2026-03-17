/**
 * @file GameplayConstants.ts
 * @description Stałe gameplay'u - masa, prędkości, rozmiary
 */

/**
 * Główne stałe gameplay'u
 */
export const GAMEPLAY_CONSTANTS = {
    /**
     * Podstawowe rozmiary
     */
    BASE_CELL_RADIUS: 20,
    BASE_CELL_MASS: 10,
    MIN_CELL_RADIUS: 10,
    MAX_CELL_RADIUS: 500,
    
    /**
     * Masa i rozmiar
     */
    MASS_TO_RADIUS_FACTOR: 2,
    RADIUS_TO_MASS_FACTOR: 0.5,
    
    /**
     * Prędkości
     */
    BASE_SPEED: 100,
    MAX_SPEED: 300,
    SPEED_DECAY_FACTOR: 0.98,
    
    /**
     * Jedzenie (pellety)
     */
    PELLET_MASS: 1,
    PELLET_RADIUS: 5,
    PELLET_SPAWN_RATE: 50, // na sekundę
    PELLET_MAX_COUNT: 2000,
    PELLET_RESPAWN_TIME: 5000, // ms
    
    /**
     * Wirusy
     */
    VIRUS_BASE_MASS: 100,
    VIRUS_BASE_RADIUS: 40,
    VIRUS_SPLIT_MASS: 50,
    VIRUS_MAX_SPLITS: 3,
    VIRUS_SPAWN_RATE: 5, // na minutę
    
    /**
     * Dzielenie (split)
     */
    SPLIT_MASS_FACTOR: 0.5, // połowa masy
    SPLIT_VELOCITY_MULTIPLIER: 2,
    SPLIT_COOLDOWN: 1000, // ms
    MAX_SPLITS_PER_PLAYER: 16,
    
    /**
     * Łączenie (merge)
     */
    MERGE_COOLDOWN: 15000, // ms
    MERGE_SPEED_FACTOR: 1.5,
    MERGE_DISTANCE_FACTOR: 1.2,
    
    /**
     * Zjadanie
     */
    EAT_MASS_RATIO: 0.7, // zjadany traci 70% masy
    EAT_SIZE_RATIO: 1.2, // trzeba być 1.2x większym
    
    /**
     * Decay (utrata masy)
     */
    DECAY_RATE: 0.001, // % na sekundę
    DECAY_INTERVAL: 1000, // ms
    MIN_DECAY_MASS: 10,
    
    /**
     * Świat
     */
    WORLD_WIDTH: 10000,
    WORLD_HEIGHT: 10000,
    WORLD_BORDER_BUFFER: 100,
    
    /**
     * Granice
     */
    BORDER_DAMAGE: true,
    BORDER_DAMAGE_RATE: 1, // masa na sekundę
    BORDER_PUSH_FORCE: 500,
    
    /**
     * Respawn
     */
    RESPAWN_TIME: 3000, // ms
    RESPAWN_MASS: 20,
    RESPAWN_PROTECTION_TIME: 2000, // ms
    
    /**
     * Multiplayer
     */
    MAX_PLAYERS_PER_ROOM: 50,
    MAX_CELLS_PER_PLAYER: 16,
    
    /**
     * Boty
     */
    BOT_COUNT: 20,
    BOT_UPDATE_INTERVAL: 100, // ms
    BOT_VISION_RANGE: 500,
    
    /**
     * Czas
     */
    TICK_RATE: 60, // ticks per second
    TICK_INTERVAL_MS: 1000 / 60, // ~16.67ms
    SNAPSHOT_RATE: 20, // snapshotów na sekundę
    
    /**
     * Punkty i ranking
     */
    SCORE_PER_KILL: 100,
    SCORE_PER_PELLET: 1,
    SCORE_DECAY_RATE: 0.1, // % na minutę
    
    /**
     * Kolory
     */
    DEFAULT_PLAYER_COLORS: [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
        '#FFEEAD', '#D4A5A5', '#9B59B6', '#3498DB',
        '#E67E22', '#2ECC71', '#F1C40F', '#E74C3C'
    ],
    
    /**
     * Efekty
     */
    PARTICLE_COUNT: 100,
    TRAIL_LENGTH: 10
} as const;

/**
 * Stałe dla fizyki
 */
export const PHYSICS_CONSTANTS = {
    /**
     * Kolizje
     */
    COLLISION_ITERATIONS: 4,
    POSITION_ITERATIONS: 2,
    VELOCITY_ITERATIONS: 2,
    
    /**
     * Tarcie i opór
     */
    FRICTION: 0.1,
    AIR_RESISTANCE: 0.01,
    
    /**
     * Impulsy
     */
    BOUNCE_FACTOR: 0.5,
    MIN_BOUNCE_VELOCITY: 5,
    
    /**
     * Spatial hash
     */
    SPATIAL_HASH_CELL_SIZE: 100,
    
    /**
     * Detekcja kolizji
     */
    BROADPHASE_CELL_SIZE: 200,
    NARROWPHASE_EPSILON: 0.01
} as const;

/**
 * Stałe dla sieci
 */
export const NETWORK_CONSTANTS = {
    /**
     * Snapshot
     */
    SNAPSHOT_HISTORY_SIZE: 60,
    SNAPSHOT_COMPRESSION_LEVEL: 6,
    
    /**
     * Interpolacja
     */
    INTERPOLATION_DELAY_MS: 50,
    INTERPOLATION_MAX_DRIFT: 100,
    
    /**
     * Predykcja
     */
    PREDICTION_ENABLED: true,
    PREDICTION_HISTORY_SIZE: 10,
    
    /**
     * Timeouty
     */
    CONNECTION_TIMEOUT_MS: 10000,
    PING_INTERVAL_MS: 2000,
    PING_TIMEOUT_MS: 5000,
    
    /**
     * Rate limiting
     */
    MAX_PACKETS_PER_SECOND: 60,
    MAX_INPUTS_PER_SECOND: 30,
    
    /**
     * Kompresja
     */
    ENABLE_DELTA_COMPRESSION: true,
    ENABLE_ENTITY_MASKING: true
} as const;

/**
 * Stałe dla ECS
 */
export const ECS_CONSTANTS = {
    /**
     * Entity
     */
    MAX_ENTITIES: 10000,
    ENTITY_POOL_SIZE: 1000,
    
    /**
     * Component
     */
    MAX_COMPONENTS: 64,
    COMPONENT_POOL_SIZE: 5000,
    
    /**
     * System
     */
    SYSTEM_PRIORITY_HIGH: 100,
    SYSTEM_PRIORITY_MEDIUM: 500,
    SYSTEM_PRIORITY_LOW: 1000,
    
    /**
     * Storage
     */
    ARCHETYPE_CHUNK_SIZE: 64,
    SPARSE_SET_DENSITY: 0.1
} as const;