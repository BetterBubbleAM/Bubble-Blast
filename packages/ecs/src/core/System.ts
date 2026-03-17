/**
 * @file System.ts
 * @description System - wykonuje logikę na encjach z określonymi komponentami
 */

import { World } from './World';
import { Entity } from './Entity';
import { ComponentTypeId } from './Component';

/**
 * Faza wykonania systemu
 */
export enum SystemPhase {
    PRE_UPDATE = 'pre_update',     // Przed główną aktualizacją
    UPDATE = 'update',              // Główna aktualizacja
    POST_UPDATE = 'post_update',    // Po głównej aktualizacji
    PHYSICS = 'physics',            // Fizyka
    RENDER = 'render',               // Renderowanie
    NETWORK = 'network',             // Sieć
    CLEANUP = 'cleanup'              // Sprzątanie
}

/**
 * Interfejs zapytania o encje
 */
export interface Query {
    with?: ComponentTypeId[];        // Musi mieć wszystkie te komponenty
    without?: ComponentTypeId[];     // Nie może mieć żadnego z tych komponentów
    any?: ComponentTypeId[];          // Musi mieć przynajmniej jeden z tych
}

/**
 * Bazowa klasa dla wszystkich systemów
 */
export abstract class System {
    /** Nazwa systemu (do debugowania) */
    public readonly name: string;
    
    /** Czy system jest aktywny */
    protected active: boolean = true;
    
    /** Zapytanie o encje */
    protected query: Query = {};
    
    /** Cached entities */
    private cachedEntities: Entity[] = [];
    private cacheValid: boolean = false;

    constructor(name?: string) {
        this.name = name || this.constructor.name;
    }

    /**
     * Inicjalizacja systemu
     */
    initialize(world: World): void {
        // Do override przez potomne klasy
    }

    /**
     * Wykonanie systemu
     */
    abstract execute(world: World, deltaTime: number, time?: number): void;

    /**
     * Aktualizacja przed wykonaniem (odświeżenie cache)
     */
    preExecute(world: World): void {
        if (!this.cacheValid) {
            this.updateCache(world);
        }
    }

    /**
     * Aktualizuje cache encji
     */
    protected updateCache(world: World): void {
        this.cachedEntities = this.queryEntities(world);
        this.cacheValid = true;
    }

    /**
     * Wykonuje zapytanie o encje
     */
    protected queryEntities(world: World): Entity[] {
        let entities = world.getAllEntities();

        // Filtruj aktywne
        entities = entities.filter(e => e.isActive() && !e.isMarkedForDeletion());

        // Filtruj z komponentami
        if (this.query.with && this.query.with.length > 0) {
            entities = entities.filter(e => e.hasAllComponents(this.query.with!));
        }

        // Filtruj bez komponentów
        if (this.query.without && this.query.without.length > 0) {
            entities = entities.filter(e => !e.hasAnyComponent(this.query.without!));
        }

        // Filtruj z dowolnymi komponentami
        if (this.query.any && this.query.any.length > 0) {
            entities = entities.filter(e => e.hasAnyComponent(this.query.any!));
        }

        return entities;
    }

    /**
     * Zwraca cache'owane encje
     */
    protected getEntities(): Entity[] {
        return this.cachedEntities;
    }

    /**
     * Unieważnia cache
     */
    protected invalidateCache(): void {
        this.cacheValid = false;
    }

    /**
     * Włącza system
     */
    enable(): void {
        this.active = true;
        this.invalidateCache();
    }

    /**
     * Wyłącza system
     */
    disable(): void {
        this.active = false;
    }

    /**
     * Sprawdza czy system jest aktywny
     */
    isActive(): boolean {
        return this.active;
    }

    /**
     * Czyści cache
     */
    clearCache(): void {
        this.cachedEntities = [];
        this.cacheValid = false;
    }

    /**
     * Zdarzenie - encja dodana
     */
    onEntityAdded(entity: Entity): void {
        this.invalidateCache();
    }

    /**
     * Zdarzenie - encja usunięta
     */
    onEntityRemoved(entity: Entity): void {
        this.invalidateCache();
    }

    /**
     * Zdarzenie - komponent dodany
     */
    onComponentAdded(entity: Entity, componentType: ComponentTypeId): void {
        this.invalidateCache();
    }

    /**
     * Zdarzenie - komponent usunięty
     */
    onComponentRemoved(entity: Entity, componentType: ComponentTypeId): void {
        this.invalidateCache();
    }

    /**
     * Serializuje stan systemu
     */
    toJSON(): any {
        return {
            name: this.name,
            active: this.active
        };
    }

    /**
     * Deserializuje stan systemu
     */
    fromJSON(json: any): void {
        this.active = json.active ?? true;
    }
}

/**
 * System iterujący po wszystkich encjach
 */
export abstract class IteratingSystem extends System {
    abstract processEntity(entity: Entity, deltaTime: number, time?: number): void;

    execute(world: World, deltaTime: number, time?: number): void {
        for (const entity of this.getEntities()) {
            this.processEntity(entity, deltaTime, time);
        }
    }
}

/**
 * System działający tylko na pojedynczej encji
 */
export abstract class SingleEntitySystem extends System {
    protected entityId?: number;

    setTargetEntity(entityId: number): void {
        this.entityId = entityId;
        this.invalidateCache();
    }

    protected getTargetEntity(world: World): Entity | undefined {
        if (this.entityId === undefined) return undefined;
        return world.getEntity(this.entityId);
    }

    abstract processEntity(entity: Entity, deltaTime: number, time?: number): void;

    execute(world: World, deltaTime: number, time?: number): void {
        const entity = this.getTargetEntity(world);
        if (entity) {
            this.processEntity(entity, deltaTime, time);
        }
    }
}

/**
 * System uruchamiany raz na klatkę
 */
export abstract class PeriodicSystem extends System {
    private accumulator: number = 0;
    private lastExecuteTime: number = 0;

    constructor(
        public readonly interval: number, // interwał w sekundach
        name?: string
    ) {
        super(name);
    }

    abstract executePeriodic(world: World, deltaTime: number, time: number): void;

    execute(world: World, deltaTime: number, time: number): void {
        this.accumulator += deltaTime;

        while (this.accumulator >= this.interval) {
            this.executePeriodic(world, deltaTime, time);
            this.accumulator -= this.interval;
            this.lastExecuteTime = time;
        }
    }

    get timeSinceLastExecute(): number {
        return this.lastExecuteTime;
    }
}

/**
 * System reagujący na zdarzenia
 */
export abstract class EventDrivenSystem<T> extends System {
    private eventQueue: T[] = [];

    abstract processEvent(event: T, world: World): void;

    queueEvent(event: T): void {
        this.eventQueue.push(event);
    }

    execute(world: World, deltaTime: number): void {
        while (this.eventQueue.length > 0) {
            const event = this.eventQueue.shift()!;
            this.processEvent(event, world);
        }
    }

    clearQueue(): void {
        this.eventQueue = [];
    }
}

/**
 * System czyszczący (sprzątający)
 */
export abstract class CleanupSystem extends System {
    abstract shouldRemove(entity: Entity): boolean;
    abstract cleanup(entity: Entity): void;

    execute(world: World): void {
        for (const entity of this.getEntities()) {
            if (this.shouldRemove(entity)) {
                this.cleanup(entity);
                world.markEntityForDeletion(entity.id);
            }
        }
    }
}

/**
 * System inicjalizujący
 */
export abstract class InitSystem extends System {
    private initialized: boolean = false;

    abstract initializeSystem(world: World): void;

    execute(world: World): void {
        if (!this.initialized) {
            this.initializeSystem(world);
            this.initialized = true;
        }
    }
}

/**
 * System monitorujący (tylko do odczytu)
 */
export abstract class MonitorSystem extends System {
    abstract monitor(world: World, deltaTime: number): void;

    execute(world: World, deltaTime: number): void {
        this.monitor(world, deltaTime);
    }
}