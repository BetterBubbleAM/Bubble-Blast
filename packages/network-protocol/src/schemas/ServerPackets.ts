/**
 * @file ServerPackets.ts
 * @description Pakiety wysyłane przez serwer do klienta
 */

import { Vector2 } from '@shared-core/math/Vector2';
import { EntityId, PlayerId } from '@shared-core/types/EntityTypes';

/**
 * Typy pakietów serwera
 */
export enum ServerPacketType {
    // Połączenie
    HANDSHAKE_ACCEPT = 0x81,
    HANDSHAKE_REJECT = 0x82,
    PONG = 0x83,
    CONNECTION_CLOSED = 0x84,

    // Stan gry
    WORLD_SNAPSHOT = 0x90,
    ENTITY_UPDATE = 0x91,
    ENTITY_REMOVE = 0x92,
    
    // Gracz
    PLAYER_JOINED = 0xA0,
    PLAYER_LEFT = 0xA1,
    PLAYER_UPDATE = 0xA2,
    PLAYER_DIED = 0xA3,
    PLAYER_RESPAWN = 0xA4,

    // Gameplay
    CELL_SPLIT = 0xB0,
    CELL_MERGE = 0xB1,
    CELL_EATEN = 0xB2,
    VIRUS_POP = 0xB3,
    SCORE_UPDATE = 0xB4,
    LEADERBOARD_UPDATE = 0xB5,

    // System
    SERVER_INFO = 0xC0,
    SERVER_TIME = 0xC1,
    SERVER_EVENT = 0xC2,

    // Chat
    CHAT_MESSAGE = 0xD0,

    // Błędy
    ERROR = 0xE0,

    // Debug
    DEBUG_INFO = 0xF0
}

/**
 * Bazowa struktura pakietu serwera
 */
export interface ServerPacket {
    type: ServerPacketType;
    timestamp: number;
    sequence: number;
    serverTime: number;
}

/**
 * Akceptacja handshake
 */
export interface HandshakeAcceptPacket extends ServerPacket {
    type: ServerPacketType.HANDSHAKE_ACCEPT;
    playerId: PlayerId;
    serverVersion: string;
    worldWidth: number;
    worldHeight: number;
    serverTickRate: number;
    snapshotRate: number;
    compression: boolean;
}

/**
 * Odrzucenie handshake
 */
export interface HandshakeRejectPacket extends ServerPacket {
    type: ServerPacketType.HANDSHAKE_REJECT;
    reason: 'version_mismatch' | 'server_full' | 'banned' | 'maintenance';
    message: string;
    retryAfter?: number;
}

/**
 * Pong (odpowiedź na ping)
 */
export interface PongPacket extends ServerPacket {
    type: ServerPacketType.PONG;
    clientTime: number;
    serverTime: number;
}

/**
 * Połączenie zamknięte
 */
export interface ConnectionClosedPacket extends ServerPacket {
    type: ServerPacketType.CONNECTION_CLOSED;
    reason: 'timeout' | 'kick' | 'shutdown';
    message: string;
}

/**
 * Snapshot świata (główny pakiet stanu)
 */
export interface WorldSnapshotPacket extends ServerPacket {
    type: ServerPacketType.WORLD_SNAPSHOT;
    frame: number;
    entities: EntitySnapshot[];
    playerEntities: EntityId[];
    timestamp: number;
    delta?: boolean;           // Czy to snapshot różnicowy
    baseSequence?: number;     // Dla snapshotów różnicowych
}

/**
 * Pojedyncza encja w snapshotcie
 */
export interface EntitySnapshot {
    id: EntityId;
    type: string;
    position: Vector2;
    velocity?: Vector2;
    radius: number;
    mass: number;
    color: string;
    playerId?: PlayerId;
    name?: string;
    flags?: number;
}

/**
 * Aktualizacja encji (zmiany)
 */
export interface EntityUpdatePacket extends ServerPacket {
    type: ServerPacketType.ENTITY_UPDATE;
    updates: Array<{
        id: EntityId;
        position?: Vector2;
        velocity?: Vector2;
        radius?: number;
        mass?: number;
        color?: string;
        flags?: number;
    }>;
}

/**
 * Usunięcie encji
 */
export interface EntityRemovePacket extends ServerPacket {
    type: ServerPacketType.ENTITY_REMOVE;
    entityIds: EntityId[];
    reason?: 'eaten' | 'despawn' | 'left';
}

/**
 * Gracz dołączył
 */
export interface PlayerJoinedPacket extends ServerPacket {
    type: ServerPacketType.PLAYER_JOINED;
    player: {
        id: PlayerId;
        name: string;
        skin?: string;
        color: string;
    };
}

/**
 * Gracz opuścił
 */
export interface PlayerLeftPacket extends ServerPacket {
    type: ServerPacketType.PLAYER_LEFT;
    playerId: PlayerId;
    reason: 'disconnect' | 'timeout';
}

/**
 * Aktualizacja gracza
 */
export interface PlayerUpdatePacket extends ServerPacket {
    type: ServerPacketType.PLAYER_UPDATE;
    playerId: PlayerId;
    mass: number;
    cellCount: number;
    position: Vector2;
}

/**
 * Gracz zginął
 */
export interface PlayerDiedPacket extends ServerPacket {
    type: ServerPacketType.PLAYER_DIED;
    playerId: PlayerId;
    killedBy?: PlayerId;
    position: Vector2;
    finalMass: number;
}

/**
 * Respawn gracza
 */
export interface PlayerRespawnPacket extends ServerPacket {
    type: ServerPacketType.PLAYER_RESPAWN;
    playerId: PlayerId;
    position: Vector2;
    mass: number;
}

/**
 * Komórka się podzieliła
 */
export interface CellSplitPacket extends ServerPacket {
    type: ServerPacketType.CELL_SPLIT;
    playerId: PlayerId;
    sourceCellId: EntityId;
    newCellId: EntityId;
    position: Vector2;
    direction: Vector2;
}

/**
 * Komórki się połączyły
 */
export interface CellMergePacket extends ServerPacket {
    type: ServerPacketType.CELL_MERGE;
    playerId: PlayerId;
    cells: EntityId[];
    resultCellId: EntityId;
    position: Vector2;
}

/**
 * Ktoś kogoś zjadł
 */
export interface CellEatenPacket extends ServerPacket {
    type: ServerPacketType.CELL_EATEN;
    predatorId: EntityId;
    preyId: EntityId;
    predatorPlayerId?: PlayerId;
    preyPlayerId?: PlayerId;
    massTransferred: number;
}

/**
 * Wirus eksplodował
 */
export interface VirusPopPacket extends ServerPacket {
    type: ServerPacketType.VIRUS_POP;
    virusId: EntityId;
    position: Vector2;
    newVirusIds: EntityId[];
}

/**
 * Aktualizacja wyniku
 */
export interface ScoreUpdatePacket extends ServerPacket {
    type: ServerPacketType.SCORE_UPDATE;
    playerId: PlayerId;
    score: number;
    totalMass: number;
    kills: number;
}

/**
 * Aktualizacja leaderboardu
 */
export interface LeaderboardUpdatePacket extends ServerPacket {
    type: ServerPacketType.LEADERBOARD_UPDATE;
    entries: Array<{
        rank: number;
        playerId: PlayerId;
        name: string;
        score: number;
        color: string;
    }>;
    totalPlayers: number;
}

/**
 * Informacje o serwerze
 */
export interface ServerInfoPacket extends ServerPacket {
    type: ServerPacketType.SERVER_INFO;
    name: string;
    region: string;
    players: number;
    maxPlayers: number;
    uptime: number;
    mode: 'ffa' | 'teams' | 'experimental';
}

/**
 | Czas serwera (synchronizacja)
 */
export interface ServerTimePacket extends ServerPacket {
    type: ServerPacketType.SERVER_TIME;
    serverTime: number;
    tick: number;
}

/**
 | Zdarzenie serwera
 */
export interface ServerEventPacket extends ServerPacket {
    type: ServerPacketType.SERVER_EVENT;
    event: 'announcement' | 'warning' | 'maintenance';
    message: string;
    duration?: number;
}

/**
 | Wiadomość czatu
 */
export interface ChatMessageServerPacket extends ServerPacket {
    type: ServerPacketType.CHAT_MESSAGE;
    from: PlayerId;
    fromName: string;
    message: string;
    target: 'all' | 'team' | 'private';
    timestamp: number;
}

/**
 | Błąd
 */
export interface ErrorPacket extends ServerPacket {
    type: ServerPacketType.ERROR;
    code: number;
    message: string;
    fatal: boolean;
}

/**
 | Debug info
 */
export interface DebugInfoPacket extends ServerPacket {
    type: ServerPacketType.DEBUG_INFO;
    fps: number;
    ping: number;
    entities: number;
    players: number;
    memory: number;
    physicsTime: number;
    networkTime: number;
    totalTime: number;
}

/**
 * Unia wszystkich pakietów serwera
 */
export type ServerPacketData = 
    | HandshakeAcceptPacket
    | HandshakeRejectPacket
    | PongPacket
    | ConnectionClosedPacket
    | WorldSnapshotPacket
    | EntityUpdatePacket
    | EntityRemovePacket
    | PlayerJoinedPacket
    | PlayerLeftPacket
    | PlayerUpdatePacket
    | PlayerDiedPacket
    | PlayerRespawnPacket
    | CellSplitPacket
    | CellMergePacket
    | CellEatenPacket
    | VirusPopPacket
    | ScoreUpdatePacket
    | LeaderboardUpdatePacket
    | ServerInfoPacket
    | ServerTimePacket
    | ServerEventPacket
    | ChatMessageServerPacket
    | ErrorPacket
    | DebugInfoPacket;