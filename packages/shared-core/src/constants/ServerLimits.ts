export const ServerLimits = {
    MAX_PLAYERS_PER_ROOM: 100,
    MAX_ROOMS: 1000,

    MAX_ENTITIES: 20000,
    MAX_CELLS_GLOBAL: 50000,

    TICK_RATE: 60,
    MAX_TICK_TIME_MS: 50,

    NETWORK_RATE: 20,
    MAX_PACKET_SIZE: 64 * 1024,

    INPUT_BUFFER_SIZE: 256,
    SNAPSHOT_BUFFER_SIZE: 120,

    MAX_NAME_LENGTH: 16
} as const;

export type ServerLimitsType = typeof ServerLimits;