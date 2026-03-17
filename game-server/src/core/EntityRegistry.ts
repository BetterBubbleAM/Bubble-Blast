/**
 * @file EntityRegistry.ts
 * @description Rejestr encji po stronie serwera
 */

import { EntityId } from '@shared-core/types/EntityTypes';
import { Body } from '@physics-engine/bodies/Body';
import { CellBody } from '@physics-engine/bodies/CellBody';
import { VirusBody } from '@physics-engine/bodies/VirusBody';
import { PelletBody } from '@physics-engine/bodies/PelletBody';

/**
 | Typ encji
 */
export enum ServerEntityType {
    PLAYER = 'player',
    CELL = 'cell',
    VIRUS = 'virus',
    PELLET = 'pellet',
    BOT = 'bot'
}

/**
 | Właściciel encji
 */
export interface EntityOwner {
    type: 'player' | 'bot' | 'world';
    id?: string;  // PlayerId lub BotId
}

/**
 | Encja serwerowa
 */
export interface ServerEntity {
    id: EntityId;
    type: ServerEntityType;
    body: Body;
    owner: EntityOwner;
    createdAt: number;
    lastUpdated: number;
    metadata: Map<string, any>;
}

/**
 | Rejestr encji
 */
export class EntityRegistry {
    private entities: Map<EntityId, ServerEntity> = new Map();
    private entitiesByOwner: Map<string, Set<EntityId>> = new Map();
    private entitiesByType: Map<ServerEntityType, Set<EntityId>> = new Map();
    
    private nextId: EntityId = 1;
    private maxEntities: number;

    constructor(maxEntities: number = 10000) {
        this.maxEntities = maxEntities;
    }

    /**
     | Tworzy nową encję
     */
    createEntity(
        type: ServerEntityType,
        body: Body,
        owner: EntityOwner
    ): ServerEntity {
        if (this.entities.size >= this.maxEntities) {
            throw new Error(`Entity registry full: ${this.maxEntities}`);
        }

        const id = this.nextId++;
        
        const entity: ServerEntity = {
            id,
            type,
            body,
            owner,
            createdAt: Date.now(),
            lastUpdated: Date.now(),
            metadata: new Map()
        };

        this.entities.set(id, entity);

        // Indeksuj według właściciela
        const ownerKey = this.getOwnerKey(owner);
        if (!this.entitiesByOwner.has(ownerKey)) {
            this.entitiesByOwner.set(ownerKey, new Set());
        }
        this.entitiesByOwner.get(ownerKey)!.add(id);

        // Indeksuj według typu
        if (!this.entitiesByType.has(type)) {
            this.entitiesByType.set(type, new Set());
        }
        this.entitiesByType.get(type)!.add(id);

        return entity;
    }

    /**
     | Tworzy komórkę gracza
     */
    createCell(
        playerId: string,
        position: { x: number; y: number },
        radius: number,
        mass: number,
        color: string
    ): ServerEntity {
        const body = new CellBody(
            this.nextId, // tymczasowe ID
            position,
            radius
        );
        body.mass = mass;
        
        return this.createEntity(
            ServerEntityType.CELL,
            body,
            { type: 'player', id: playerId }
        );
    }

    /**
     | Tworzy wirusa
     */
    createVirus(
        position: { x: number; y: number },
        radius: number,
        mass: number
    ): ServerEntity {
        const body = new VirusBody(
            this.nextId,
            position,
            radius
        );
        body.mass = mass;
        
        return this.createEntity(
            ServerEntityType.VIRUS,
            body,
            { type: 'world' }
        );
    }

    /**
     | Tworzy pellet
     */
    createPellet(
        position: { x: number; y: number },
        radius: number,
        mass: number
    ): ServerEntity {
        const body = new PelletBody(
            this.nextId,
            position,
            radius
        );
        body.mass = mass;
        
        return this.createEntity(
            ServerEntityType.PELLET,
            body,
            { type: 'world' }
        );
    }

    /**
     | Pobiera encję
     */
    getEntity(id: EntityId): ServerEntity | undefined {
        return this.entities.get(id);
    }

    /**
     | Usuwa encję
     */
    removeEntity(id: EntityId): boolean {
        const entity = this.entities.get(id);
        if (!entity) return false;

        // Usuń z indeksów
        const ownerKey = this.getOwnerKey(entity.owner);
        this.entitiesByOwner.get(ownerKey)?.delete(id);
        this.entitiesByType.get(entity.type)?.delete(id);

        // Usuń z głównej mapy
        this.entities.delete(id);

        return true;
    }

    /**
     | Pobiera encje właściciela
     */
    getEntitiesByOwner(owner: EntityOwner): ServerEntity[] {
        const ownerKey = this.getOwnerKey(owner);
        const ids = this.entitiesByOwner.get(ownerKey);
        
        if (!ids) return [];
        
        return Array.from(ids)
            .map(id => this.entities.get(id))
            .filter((e): e is ServerEntity => !!e);
    }

    /**
     | Pobiera encje według typu
     */
    getEntitiesByType(type: ServerEntityType): ServerEntity[] {
        const ids = this.entitiesByType.get(type);
        
        if (!ids) return [];
        
        return Array.from(ids)
            .map(id => this.entities.get(id))
            .filter((e): e is ServerEntity => !!e);
    }

    /**
     | Pobiera wszystkie encje
     */
    getAllEntities(): ServerEntity[] {
        return Array.from(this.entities.values());
    }

    /**
     | Aktualizuje timestamp encji
     */
    touchEntity(id: EntityId): void {
        const entity = this.entities.get(id);
        if (entity) {
            entity.lastUpdated = Date.now();
        }
    }

    /**
     | Zapisuje metadane
     */
    setMetadata(id: EntityId, key: string, value: any): void {
        const entity = this.entities.get(id);
        if (entity) {
            entity.metadata.set(key, value);
        }
    }

    /**
     | Pobiera metadane
     */
    getMetadata(id: EntityId, key: string): any {
        return this.entities.get(id)?.metadata.get(key);
    }

    /**
     | Generuje klucz dla właściciela
     */
    private getOwnerKey(owner: EntityOwner): string {
        return `${owner.type}:${owner.id || 'world'}`;
    }

    /**
     | Liczba encji
     */
    get size(): number {
        return this.entities.size;
    }

    /**
     | Sprawdza czy encja istnieje
     */
    has(id: EntityId): boolean {
        return this.entities.has(id);
    }

    /**
     | Czyści rejestr
     */
    clear(): void {
        this.entities.clear();
        this.entitiesByOwner.clear();
        this.entitiesByType.clear();
        this.nextId = 1;
    }

    /**
     | Statystyki
     */
    getStats(): RegistryStats {
        const stats: RegistryStats = {
            total: this.entities.size,
            byType: {},
            byOwner: {},
            memoryEstimate: this.entities.size * 200 // przybliżenie
        };

        for (const [type, set] of this.entitiesByType) {
            stats.byType[type] = set.size;
        }

        for (const [owner, set] of this.entitiesByOwner) {
            stats.byOwner[owner] = set.size;
        }

        return stats;
    }
}

/**
 | Statystyki rejestru
 */
export interface RegistryStats {
    total: number;
    byType: Record<string, number>;
    byOwner: Record<string, number>;
    memoryEstimate: number;
}