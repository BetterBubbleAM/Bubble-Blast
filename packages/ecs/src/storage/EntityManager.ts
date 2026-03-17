/**
 * @file EntityManager.ts
 * @description Zarządza encjami - tworzenie, usuwanie, przechowywanie
 */

import { Entity, EntityId, EntityFlags } from '../core/Entity';
import { IdGenerator } from '@shared-core/utils/IdGenerator';
import { ObjectPool } from '@shared-core/utils/ObjectPool';

/**
 * Statystyki EntityManagera
 */
export interface EntityManagerStats {
    total: number;
    active: number;
    recycled: number;
    maxEntities: number;
    utilization: number;
}

/**
 * Zarządca encji - odpowiedzialny za alokację i dealokację encji
 */
export class EntityManager {
    private entities: Map<EntityId, Entity> = new Map();
    private recycled: Set<EntityId> = new Set();
    private idGenerator: IdGenerator;
    private entityPool: ObjectPool<Entity>;
    private maxEntities: number;
    private nextId: number = 1;

    constructor(maxEntities: number = 100000, initialPoolSize: number = 1000) {
        this.maxEntities = maxEntities;
        this.idGenerator = new IdGenerator(maxEntities);
        
        // Pool encji do reuse'u
        this.entityPool = new ObjectPool({
            size: initialPoolSize,
            factory: () => new Entity(0),
            reset: (entity) => entity.reset(),
            onAllocate: (entity) => {
                const id = this.idGenerator.next();
                (entity as any).id = id;
            }
        });
    }

    /**
     * Tworzy nową encję
     */
    createEntity(): Entity {
        if (this.entities.size >= this.maxEntities) {
            throw new Error(`EntityManager: przekroczono limit encji (${this.maxEntities})`);
        }

        // Użyj encji z pool'a lub utwórz nową
        let entity: Entity;
        
        if (this.recycled.size > 0) {
            // Użyj ID z recycled
            const [id] = this.recycled;
            this.recycled.delete(id);
            entity = this.entityPool.allocate();
            (entity as any).id = id;
            entity.incrementGeneration();
        } else {
            // Nowe ID
            entity = this.entityPool.allocate();
        }

        this.entities.set(entity.id, entity);
        return entity;
    }

    /**
     * Tworzy wiele encji naraz
     */
    createEntities(count: number): Entity[] {
        const entities: Entity[] = [];
        for (let i = 0; i < count; i++) {
            entities.push(this.createEntity());
        }
        return entities;
    }

    /**
     * Usuwa encję
     */
    destroyEntity(entityId: EntityId): boolean {
        const entity = this.entities.get(entityId);
        if (!entity) return false;

        // Wyczyść i zwróć do pool'a
        entity.reset();
        this.entities.delete(entityId);
        this.recycled.add(entityId);
        this.entityPool.release(entity);

        return true;
    }

    /**
     * Usuwa wiele encji
     */
    destroyEntities(entityIds: EntityId[]): number {
        let count = 0;
        for (const id of entityIds) {
            if (this.destroyEntity(id)) count++;
        }
        return count;
    }

    /**
     * Usuwa wszystkie encje
     */
    clear(): void {
        for (const entity of this.entities.values()) {
            entity.reset();
            this.entityPool.release(entity);
        }
        this.entities.clear();
        this.recycled.clear();
        this.idGenerator.reset();
        this.nextId = 1;
    }

    /**
     * Pobiera encję po ID
     */
    getEntity(entityId: EntityId): Entity | undefined {
        return this.entities.get(entityId);
    }

    /**
     * Sprawdza czy encja istnieje
     */
    hasEntity(entityId: EntityId): boolean {
        return this.entities.has(entityId);
    }

    /**
     * Zwraca wszystkie aktywne encje
     */
    getAllEntities(): Entity[] {
        return Array.from(this.entities.values());
    }

    /**
     * Zwraca aktywne encje spełniające warunek
     */
    findEntities(predicate: (entity: Entity) => boolean): Entity[] {
        const result: Entity[] = [];
        for (const entity of this.entities.values()) {
            if (predicate(entity)) {
                result.push(entity);
            }
        }
        return result;
    }

    /**
     * Zwraca encje oznaczone do usunięcia
     */
    getMarkedForDeletion(): EntityId[] {
        const marked: EntityId[] = [];
        for (const entity of this.entities.values()) {
            if (entity.isMarkedForDeletion()) {
                marked.push(entity.id);
            }
        }
        return marked;
    }

    /**
     * Liczba aktywnych encji
     */
    getActiveCount(): number {
        return this.entities.size;
    }

    /**
     * Liczba zrecyklowanych ID
     */
    getRecycledCount(): number {
        return this.recycled.size;
    }

    /**
     * Maksymalna liczba encji
     */
    getMaxEntities(): number {
        return this.maxEntities;
    }

    /**
     * Łączna liczba encji (włączając zrecyklowane)
     */
    getTotalCount(): number {
        return this.idGenerator.activeCount;
    }

    /**
     * Statystyki
     */
    getStats(): EntityManagerStats {
        return {
            total: this.getTotalCount(),
            active: this.getActiveCount(),
            recycled: this.getRecycledCount(),
            maxEntities: this.maxEntities,
            utilization: this.getActiveCount() / this.maxEntities
        };
    }

    /**
     * Iteruje po encjach
     */
    *[Symbol.iterator](): Iterator<Entity> {
        for (const entity of this.entities.values()) {
            yield entity;
        }
    }

    /**
     * Tworzy snapshot wszystkich encji
     */
    snapshot(): Map<EntityId, any> {
        const snapshot = new Map();
        for (const [id, entity] of this.entities) {
            snapshot.set(id, entity.toJSON());
        }
        return snapshot;
    }

    /**
     * Przywraca stan z snapshota
     */
    restore(snapshot: Map<EntityId, any>): void {
        this.clear();
        
        for (const [id, data] of snapshot) {
            const entity = this.entityPool.allocate();
            (entity as any).id = id;
            entity.fromJSON(data);
            this.entities.set(id, entity);
        }
    }
}