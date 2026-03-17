/**
 * @file ServerConfig.ts
 * @description Konfiguracja serwera gry
 */

/**
 | Środowisko uruchomieniowe
 */
export enum ServerEnvironment {
    DEVELOPMENT = 'development',
    STAGING = 'staging',
    PRODUCTION = 'production'
}

/**
 | Konfiguracja serwera
 */
export interface ServerConfig {
    // Podstawowe
    environment: ServerEnvironment;
    serverId: string;
    serverName: string;
    region: string;
    
    // Porty
    port: number;
    webSocketPort: number;
    adminPort: number;
    
    // Limity
    maxPlayers: number;
    maxRooms: number;
    playersPerRoom: number;
    
    // Sieć
    tickRate: number;              // Ticks per second
    snapshotRate: number;           // Snapshots per second
    inputBufferSize: number;        // Rozmiar bufora inputów
    maxPacketSize: number;           // Maksymalny rozmiar pakietu (bajty)
    compression: boolean;            // Czy kompresować pakiety
    
    // Fizyka
    physicsTickRate: number;         // Ticks per second dla fizyki
    physicsSubSteps: number;          // Pod-kroki fizyki
    
    // Świat
    worldWidth: number;
    worldHeight: number;
    worldBorderDamage: boolean;
    
    // Gameplay
    initialMass: number;
    maxCellMass: number;
    splitCooldown: number;
    mergeCooldown: number;
    decayRate: number;
    
    // Respawn
    respawnTime: number;
    respawnProtectionTime: number;
    respawnMass: number;
    
    // Boty
    botCount: number;
    botDifficulty: 'easy' | 'medium' | 'hard';
    
    // Baza danych
    redisHost: string;
    redisPort: number;
    redisPassword?: string;
    
    // Monitoring
    metricsEnabled: boolean;
    metricsInterval: number;
    
    // Bezpieczeństwo
    rateLimit: number;               // Pakiety na sekundę na klienta
    rateLimitBurst: number;          // Dozwolony burst
    maxMessageLength: number;         // Maksymalna długość wiadomości
    
    // Debug
    debug: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    logPackets: boolean;
}

/**
 | Domyślna konfiguracja
 */
export const DEFAULT_CONFIG: ServerConfig = {
    environment: ServerEnvironment.DEVELOPMENT,
    serverId: 'server-1',
    serverName: 'Bubble.am Server',
    region: 'EU',
    
    port: 8080,
    webSocketPort: 8081,
    adminPort: 8082,
    
    maxPlayers: 1000,
    maxRooms: 10,
    playersPerRoom: 50,
    
    tickRate: 60,
    snapshotRate: 20,
    inputBufferSize: 10,
    maxPacketSize: 512,
    compression: true,
    
    physicsTickRate: 60,
    physicsSubSteps: 2,
    
    worldWidth: 10000,
    worldHeight: 10000,
    worldBorderDamage: true,
    
    initialMass: 10,
    maxCellMass: 10000,
    splitCooldown: 1000,
    mergeCooldown: 15000,
    decayRate: 0.001,
    
    respawnTime: 3000,
    respawnProtectionTime: 2000,
    respawnMass: 10,
    
    botCount: 20,
    botDifficulty: 'medium',
    
    redisHost: 'localhost',
    redisPort: 6379,
    redisPassword: undefined,
    
    metricsEnabled: true,
    metricsInterval: 5000,
    
    rateLimit: 60,
    rateLimitBurst: 10,
    maxMessageLength: 200,
    
    debug: false,
    logLevel: 'info',
    logPackets: false
};

/**
 | Ładuje konfigurację z zmiennych środowiskowych
 */
export function loadConfigFromEnv(): ServerConfig {
    return {
        environment: (process.env.NODE_ENV as ServerEnvironment) || DEFAULT_CONFIG.environment,
        serverId: process.env.SERVER_ID || DEFAULT_CONFIG.serverId,
        serverName: process.env.SERVER_NAME || DEFAULT_CONFIG.serverName,
        region: process.env.REGION || DEFAULT_CONFIG.region,
        
        port: parseInt(process.env.PORT || String(DEFAULT_CONFIG.port)),
        webSocketPort: parseInt(process.env.WS_PORT || String(DEFAULT_CONFIG.webSocketPort)),
        adminPort: parseInt(process.env.ADMIN_PORT || String(DEFAULT_CONFIG.adminPort)),
        
        maxPlayers: parseInt(process.env.MAX_PLAYERS || String(DEFAULT_CONFIG.maxPlayers)),
        maxRooms: parseInt(process.env.MAX_ROOMS || String(DEFAULT_CONFIG.maxRooms)),
        playersPerRoom: parseInt(process.env.PLAYERS_PER_ROOM || String(DEFAULT_CONFIG.playersPerRoom)),
        
        tickRate: parseInt(process.env.TICK_RATE || String(DEFAULT_CONFIG.tickRate)),
        snapshotRate: parseInt(process.env.SNAPSHOT_RATE || String(DEFAULT_CONFIG.snapshotRate)),
        inputBufferSize: parseInt(process.env.INPUT_BUFFER_SIZE || String(DEFAULT_CONFIG.inputBufferSize)),
        maxPacketSize: parseInt(process.env.MAX_PACKET_SIZE || String(DEFAULT_CONFIG.maxPacketSize)),
        compression: process.env.COMPRESSION === 'true' || DEFAULT_CONFIG.compression,
        
        physicsTickRate: parseInt(process.env.PHYSICS_TICK_RATE || String(DEFAULT_CONFIG.physicsTickRate)),
        physicsSubSteps: parseInt(process.env.PHYSICS_SUB_STEPS || String(DEFAULT_CONFIG.physicsSubSteps)),
        
        worldWidth: parseInt(process.env.WORLD_WIDTH || String(DEFAULT_CONFIG.worldWidth)),
        worldHeight: parseInt(process.env.WORLD_HEIGHT || String(DEFAULT_CONFIG.worldHeight)),
        worldBorderDamage: process.env.WORLD_BORDER_DAMAGE === 'true' || DEFAULT_CONFIG.worldBorderDamage,
        
        initialMass: parseFloat(process.env.INITIAL_MASS || String(DEFAULT_CONFIG.initialMass)),
        maxCellMass: parseFloat(process.env.MAX_CELL_MASS || String(DEFAULT_CONFIG.maxCellMass)),
        splitCooldown: parseInt(process.env.SPLIT_COOLDOWN || String(DEFAULT_CONFIG.splitCooldown)),
        mergeCooldown: parseInt(process.env.MERGE_COOLDOWN || String(DEFAULT_CONFIG.mergeCooldown)),
        decayRate: parseFloat(process.env.DECAY_RATE || String(DEFAULT_CONFIG.decayRate)),
        
        respawnTime: parseInt(process.env.RESPAWN_TIME || String(DEFAULT_CONFIG.respawnTime)),
        respawnProtectionTime: parseInt(process.env.RESPAWN_PROTECTION || String(DEFAULT_CONFIG.respawnProtectionTime)),
        respawnMass: parseFloat(process.env.RESPAWN_MASS || String(DEFAULT_CONFIG.respawnMass)),
        
        botCount: parseInt(process.env.BOT_COUNT || String(DEFAULT_CONFIG.botCount)),
        botDifficulty: (process.env.BOT_DIFFICULTY as any) || DEFAULT_CONFIG.botDifficulty,
        
        redisHost: process.env.REDIS_HOST || DEFAULT_CONFIG.redisHost,
        redisPort: parseInt(process.env.REDIS_PORT || String(DEFAULT_CONFIG.redisPort)),
        redisPassword: process.env.REDIS_PASSWORD,
        
        metricsEnabled: process.env.METRICS_ENABLED === 'true' || DEFAULT_CONFIG.metricsEnabled,
        metricsInterval: parseInt(process.env.METRICS_INTERVAL || String(DEFAULT_CONFIG.metricsInterval)),
        
        rateLimit: parseInt(process.env.RATE_LIMIT || String(DEFAULT_CONFIG.rateLimit)),
        rateLimitBurst: parseInt(process.env.RATE_LIMIT_BURST || String(DEFAULT_CONFIG.rateLimitBurst)),
        maxMessageLength: parseInt(process.env.MAX_MESSAGE_LENGTH || String(DEFAULT_CONFIG.maxMessageLength)),
        
        debug: process.env.DEBUG === 'true' || DEFAULT_CONFIG.debug,
        logLevel: (process.env.LOG_LEVEL as any) || DEFAULT_CONFIG.logLevel,
        logPackets: process.env.LOG_PACKETS === 'true' || DEFAULT_CONFIG.logPackets
    };
}