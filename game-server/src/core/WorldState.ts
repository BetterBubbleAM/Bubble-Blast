/**
 * @file WorldState.ts
 * @description Stan świata gry
 */

import { Vector2 } from '@shared-core/math/Vector2';
import { EntityId, PlayerId } from '@shared-core/types/EntityTypes';
import { EntityRegistry, ServerEntity, ServerEntityType } from './EntityRegistry';
import { World } from '@physics-engine/world/World';
import { CellBody } from '@physics-engine/bodies/CellBody';
import { VirusBody } from '@physics-engine/bodies/VirusBody';
import { PelletBody } from '@physics-engine/bodies/PelletBody';

/**
 | Gracz w świecie
 */
export interface WorldPlayer {
    id: PlayerId;
    name: string;
    cells: EntityId[];
    totalMass: number;
    score: number;
    kills: number;
    deaths: number;
    color: string;
    isAlive: boolean;
    isBot: boolean;
    joinTime: number;
    lastAction: number;
}

/**
 | Opcje świata
 */
export interface WorldStateOptions {
    width: number;
    height: number;
    maxPlayers: number;
    maxCells: number;
    maxPellets: number;
    maxViruses: number;
}

/**
 | Stan świata
 */
export class WorldState {
    private registry: EntityRegistry;
    private physicsWorld: World;
    private options: WorldStateOptions;
    
    private players: Map<PlayerId, WorldPlayer> = new Map();
    private playerCells: Map<PlayerId, Set<EntityId>> = new Map();
    
    private pelletCount: number = 0;
    private virusCount: number = 0;
    
    private time: number = 0;
    private tick: number = 0;

    constructor(physicsWorld: World, options: WorldStateOptions) {
        this.physicsWorld = physicsWorld;
        this.options = options;
        this.registry = new EntityRegistry(options.maxCells);
    }

    /**
     | Dodaje gracza
     */
    addPlayer(player: WorldPlayer): void {
        this.players.set(player.id, player);
        this.playerCells.set(player.id, new Set());
    }

    /**
     | Usuwa gracza
     */
    removePlayer(playerId: PlayerId): void {
        const cells = this.playerCells.get(playerId);
        
        if (cells) {
            // Usuń wszystkie komórki gracza
            for (const cellId of cells) {
                this.removeEntity(cellId);
            }
        }
        
        this.playerCells.delete(playerId);
        this.players.delete(playerId);
    }

    /**
     | Dodaje komórkę gracza
     */
    addPlayerCell(playerId: PlayerId, cell: ServerEntity): void {
        this.registry['entities'].set(cell.id, cell);
        
        const cells = this.playerCells.get(playerId);
        if (cells) {
            cells.add(cell.id);
        }
        
        this.updatePlayerMass(playerId);
    }

    /**
     | Tworzy nową komórkę dla gracza
     */
    createPlayerCell(
        playerId: PlayerId,
        position: Vector2,
        radius: number,
        mass: number,
        color: string
    ): ServerEntity {
        const body = new CellBody(
            this.registry['nextId']++,
            position,
            radius
        );
        body.mass = mass;

        const entity: ServerEntity = {
            id: body.id,
            type: ServerEntityType.CELL,
            body,
            owner: { type: 'player', id: playerId },
            createdAt: Date.now(),
            lastUpdated: Date.now(),
            metadata: new Map()
        };

        this.registry['entities'].set(entity.id, entity);
        this.physicsWorld.addBody(body);
        
        const cells = this.playerCells.get(playerId);
        if (cells) {
            cells.add(entity.id);
        }

        return entity;
    }

    /**
     | Tworzy wirusa
     */
    createVirus(position: Vector2, radius: number, mass: number): ServerEntity {
        if (this.virusCount >= this.options.maxViruses) {
            throw new Error('Max viruses reached');
        }

        const body = new VirusBody(
            this.registry['nextId']++,
            position,
            radius
        );
        body.mass = mass;

        const entity: ServerEntity = {
            id: body.id,
            type: ServerEntityType.VIRUS,
            body,
            owner: { type: 'world' },
            createdAt: Date.now(),
            lastUpdated: Date.now(),
            metadata: new Map()
        };

        this.registry['entities'].set(entity.id, entity);
        this.physicsWorld.addBody(body);
        this.virusCount++;

        return entity;
    }

    /**
     | Tworzy pellet
     */
    createPellet(position: Vector2, radius: number, mass: number): ServerEntity {
        if (this.pelletCount >= this.options.maxPellets) {
            throw new Error('Max pellets reached');
        }

        const body = new PelletBody(
            this.registry['nextId']++,
            position,
            radius
        );
        body.mass = mass;

        const entity: ServerEntity = {
            id: body.id,
            type: ServerEntityType.PELLET,
            body,
            owner: { type: 'world' },
            createdAt: Date.now(),
            lastUpdated: Date.now(),
            metadata: new Map()
        };

        this.registry['entities'].set(entity.id, entity);
        this.physicsWorld.addBody(body);
        this.pelletCount++;

        return entity;
    }

    /**
     | Usuwa encję
     */
    removeEntity(entityId: EntityId): boolean {
        const entity = this.registry.getEntity(entityId);
        if (!entity) return false;

        // Usuń z fizyki
        this.physicsWorld.removeBody(entityId);

        // Usuń z rejestru
        const removed = this.registry.removeEntity(entityId);

        if (removed) {
            if (entity.type === ServerEntityType.PELLET) {
                this.pelletCount--;
            } else if (entity.type === ServerEntityType.VIRUS) {
                this.virusCount--;
            } else if (entity.type === ServerEntityType.CELL && entity.owner.type === 'player') {
                const cells = this.playerCells.get(entity.owner.id!);
                if (cells) {
                    cells.delete(entityId);
                }
                this.updatePlayerMass(entity.owner.id!);
            }
        }

        return removed;
    }

    /**
     | Aktualizuje masę gracza
     */
    private updatePlayerMass(playerId: PlayerId): void {
        const player = this.players.get(playerId);
        if (!player) return;

        const cells = this.playerCells.get(playerId);
        if (!cells) return;

        let totalMass = 0;
        for (const cellId of cells) {
            const entity = this.registry.getEntity(cellId);
            if (entity) {
                totalMass += (entity.body as CellBody).mass;
            }
        }

        player.totalMass = totalMass;
    }

    /**
     | Pobiera gracza
     */
    getPlayer(playerId: PlayerId): WorldPlayer | undefined {
        return this.players.get(playerId);
    }

    /**
     | Pobiera komórki gracza
     */
    getPlayerCells(playerId: PlayerId): ServerEntity[] {
        const cells = this.playerCells.get(playerId);
        if (!cells) return [];

        return Array.from(cells)
            .map(id => this.registry.getEntity(id))
            .filter((e): e is ServerEntity => !!e);
    }

    /**
     | Pobiera encję
     */
    getEntity(entityId: EntityId): ServerEntity | undefined {
        return this.registry.getEntity(entityId);
    }

    /**
     | Pobiera wszystkie encje
     */
    getAllEntities(): ServerEntity[] {
        return this.registry.getAllEntities();
    }

    /**
     | Pobiera encje w obszarze
     */
    getEntitiesInArea(center: Vector2, radius: number): ServerEntity[] {
        const bodies = this.physicsWorld.queryRadius(center, radius);
        
        return bodies
            .map(body => this.registry.getEntity(body.id))
            .filter((e): e is ServerEntity => !!e);
    }

    /**
     | Aktualizuje stan
     */
    update(deltaTime: number): void {
        this.time += deltaTime;
        this.tick++;
    }

    /**
     | Pobiera statystyki
     */
    getStats(): WorldStateStats {
        return {
            players: this.players.size,
            pellets: this.pelletCount,
            viruses: this.virusCount,
            totalEntities: this.registry.size,
            time: this.time,
            tick: this.tick,
            registryStats: this.registry.getStats()
        };
    }

    /**
     | Resetuje świat
     */
    reset(): void {
        this.registry.clear();
        this.players.clear();
        this.playerCells.clear();
        this.pelletCount = 0;
        this.virusCount = 0;
        this.time = 0;
        this.tick = 0;
        this.physicsWorld.clear();
    }
}

/**
 | Statystyki świata
 */
export interface WorldStateStats {
    players: number;
    pellets: number;
    viruses: number;
    totalEntities: number;
    time: number;
    tick: number;
    registryStats: any;
}