export enum NetworkOpcodes {
    // Client -> Server
    C2S_INPUT = 1,
    C2S_SPAWN = 2,
    C2S_SPLIT = 3,
    C2S_EJECT = 4,
    C2S_PING = 5,

    // Server -> Client
    S2C_SNAPSHOT = 100,
    S2C_DELTA = 101,
    S2C_SPAWN = 102,
    S2C_DESPAWN = 103,
    S2C_EVENT = 104,
    S2C_PONG = 105
}