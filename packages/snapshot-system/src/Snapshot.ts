/**
 * @file Snapshot.ts
 * @description Klasa reprezentująca snapshot stanu gry
 */

import { Vector2 } from '@shared-core/math/Vector2';
import { EntityId, PlayerId } from '@shared-core/types/EntityTypes';

/**
 * Typ encji w snapshotcie
 */
export enum SnapshotEntityType {
    PLAYER = 'player',
    CELL = 'cell',
    VIRUS = 'virus',
    PELLET = 'pellet'
}

/**
 * Pojedyncza encja w snapshotcie
 */
export interface SnapshotEntity {
    id: EntityId;
    type: SnapshotEntityType;
    
    // Podstawowe dane
    position: Vector2;
    radius: number;
    mass: number;
    color: string;
    
    // Opcjonalne dane
    velocity?: Vector2;
    playerId?: PlayerId;
    playerName?: string;
    
    // Flagi
    flags: number;
    
    // Metadane
    version: number;
}

/**
 * Snapshot gracza
 */
export interface SnapshotPlayer {
    id: PlayerId;
    name: string;
    cells: EntityId[];
    totalMass: number;
    score: number;
    rank: number;
    color: string;
    isAlive: boolean;
}

/**
 * Snapshot świata
 */
export interface SnapshotWorld {
    width: number;
    height: number;
    time: number;
    tick: number;
    playersAlive: number;
    totalPlayers: number;
}

/**
 * Główna klasa snapshotu
 */
export class Snapshot {
    public readonly sequence: number;
    public readonly timestamp: number;
    public readonly serverTime: number;
    
    public entities: Map<EntityId, SnapshotEntity> = new Map();
    public players: Map<PlayerId, SnapshotPlayer> = new Map();
    public world: SnapshotWorld;
    
    private entityVersion: Map<EntityId, number> = new Map();

    constructor(sequence: number, serverTime: number, world: SnapshotWorld) {
        this.sequence = sequence;
        this.timestamp = Date.now();
        this.serverTime = serverTime;
        this.world = world;
    }

    /**
     * Dodaje encję do snapshotu
     */
    addEntity(entity: SnapshotEntity): void {
        const version = (this.entityVersion.get(entity.id) || 0) + 1;
        entity.version = version;
        
        this.entities.set(entity.id, entity);
        this.entityVersion.set(entity.id, version);
    }

    /**
     * Dodaje gracza do snapshotu
     */
    addPlayer(player: SnapshotPlayer): void {
        this.players.set(player.id, player);
    }

    /**
     * Pobiera encję po ID
     */
    getEntity(id: EntityId): SnapshotEntity | undefined {
        return this.entities.get(id);
    }

    /**
     * Pobiera gracza po ID
     */
    getPlayer(id: PlayerId): SnapshotPlayer | undefined {
        return this.players.get(id);
    }

    /**
     * Sprawdza czy snapshot zawiera encję
     */
    hasEntity(id: EntityId): boolean {
        return this.entities.has(id);
    }

    /**
     * Sprawdza czy snapshot zawiera gracza
     */
    hasPlayer(id: PlayerId): boolean {
        return this.players.has(id);
    }

    /**
     * Liczba encji
     */
    get entityCount(): number {
        return this.entities.size;
    }

    /**
     * Liczba graczy
     */
    get playerCount(): number {
        return this.players.size;
    }

    /**
     * Klonuje snapshot
     */
    clone(): Snapshot {
        const clone = new Snapshot(this.sequence, this.serverTime, { ...this.world });
        
        // Klonuj encje
        for (const [id, entity] of this.entities) {
            clone.entities.set(id, {
                ...entity,
                position: entity.position.clone(),
                velocity: entity.velocity?.clone()
            });
        }
        
        // Klonuj graczy
        for (const [id, player] of this.players) {
            clone.players.set(id, { ...player, cells: [...player.cells] });
        }
        
        // Klonuj wersje
        for (const [id, version] of this.entityVersion) {
            clone.entityVersion.set(id, version);
        }
        
        return clone;
    }

    /**
     * Porównuje z innym snapshotem
     */
    compare(other: Snapshot): SnapshotDiff {
        const diff: SnapshotDiff = {
            added: [],
            removed: [],
            updated: [],
            playersChanged: []
        };

        // Znajdź dodane i zaktualizowane
        for (const [id, entity] of this.entities) {
            const otherEntity = other.entities.get(id);
            
            if (!otherEntity) {
                diff.added.push(entity);
            } else if (entity.version > otherEntity.version) {
                diff.updated.push(entity);
            }
        }

        // Znajdź usunięte
        for (const [id] of other.entities) {
            if (!this.entities.has(id)) {
                diff.removed.push(id);
            }
        }

        // Znajdź zmiany graczy
        for (const [id, player] of this.players) {
            const otherPlayer = other.players.get(id);
            if (!otherPlayer || player.score !== otherPlayer.score || player.rank !== otherPlayer.rank) {
                diff.playersChanged.push(player);
            }
        }

        return diff;
    }

    /**
     * Serializuje snapshot do JSON
     */
    toJSON(): any {
        return {
            sequence: this.sequence,
            timestamp: this.timestamp,
            serverTime: this.serverTime,
            world: this.world,
            entities: Array.from(this.entities.values()),
            players: Array.from(this.players.values())
        };
    }

    /**
     * Deserializuje snapshot z JSON
     */
    static fromJSON(json: any): Snapshot {
        const snapshot = new Snapshot(json.sequence, json.serverTime, json.world);
        snapshot.timestamp = json.timestamp;
        
        for (const entity of json.entities) {
            snapshot.addEntity({
                ...entity,
                position: new Vector2(entity.position.x, entity.position.y),
                velocity: entity.velocity ? new Vector2(entity.velocity.x, entity.velocity.y) : undefined
            });
        }
        
        for (const player of json.players) {
            snapshot.addPlayer(player);
        }
        
        return snapshot;
    }
}

/**
 | Różnica między snapshotami
 */
export interface SnapshotDiff {
    added: SnapshotEntity[];
    removed: EntityId[];
    updated: SnapshotEntity[];
    playersChanged: SnapshotPlayer[];
}