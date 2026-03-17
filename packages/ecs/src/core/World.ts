/**
 * @file World.ts
 * @description Główne środowisko ECS - zarządza encjami, komponentami i systemami
 */

import { Entity, EntityId, EntityFlags } from './Entity';
import { Component, ComponentTypeId } from './Component';
import { System, SystemPhase } from './System';
import { EntityManager } from '../storage/EntityManager';
import { ComponentStore } from '../storage/ComponentStore';
import { SystemScheduler } from '../scheduling/SystemScheduler';
import { IdGenerator } from '@shared-core/utils/IdGenerator';
import { Logger, LogCategory } from '@shared-core/utils/Logger';
import { EventEmitter } from '@shared-core/events/EventEmitter';
import { EcsEvents } from '@shared-core/events/EventTypes';

/**
 * Konfiguracja świata ECS
 */
export interface WorldConfig {
    maxEntities: number;
    initialEntities: number;
    enableLogging: boolean;
    enableEventEmitter: boolean;
    autoClearMarked: boolean;
}

/**
 * Główna klasa świata ECS
 */
export class World {
    private static nextWorldId: number = 0;
    public readonly id: number;
    public readonly config: WorldConfig;

    private entityManager: EntityManager;
    private componentStore: ComponentStore;
    private scheduler: SystemScheduler;
    private logger: Logger;
    private eventEmitter?: EventEmitter;

    private isRunning: boolean = false;
    private currentTime: number = 0;
    private deltaTime: number = 0;
    private frameCount: number = 0;

    constructor(config: Partial<WorldConfig> = {}) {
        this.id = World.nextWorldId++;
        
        this.config = {
            maxEntities: 100000,
            initialEntities: 1000,
            enableLogging: true,
            enableEventEmitter: true,
            autoClearMarked: true,
            ...config
        };

        this.entityManager = new EntityManager(this.config.maxEntities, this.config.initialEntities);
        this.componentStore = new ComponentStore(this.config.maxEntities);
        this.scheduler = new SystemScheduler();
        this.logger = Logger.getInstance();

        if (this.config.enableEventEmitter) {
            this.eventEmitter = new EventEmitter();
        }

        this.logger.info(LogCategory.ECS, `World ${this.id} created`, this.config);
    }

    /**
     * Tworzy nową encję
     */
    createEntity(): Entity {
        const entity = this.entityManager.createEntity();
        
        this.eventEmitter?.emit({
            type: 'ecs:entity:created',
            timestamp: Date.now(),
            entityId: entity.id,
            archetype: []
        } as EcsEvents.EntityCreated);

        this.logger.debug(LogCategory.ECS, `Entity created: ${entity.id}`);
        
        return entity;
    }

    /**
     * Usuwa encję
     */
    destroyEntity(entityId: EntityId): boolean {
        const entity = this.entityManager.getEntity(entityId);
        if (!entity) return false;

        // Usuń wszystkie komponenty
        const components = entity.getAllComponents();
        for (const [typeId] of components) {
            this.componentStore.removeComponent(entityId, typeId);
        }

        const destroyed = this.entityManager.destroyEntity(entityId);

        if (destroyed) {
            this.eventEmitter?.emit({
                type: 'ecs:entity:destroyed',
                timestamp: Date.now(),
                entityId
            } as EcsEvents.EntityDestroyed);

            this.logger.debug(LogCategory.ECS, `Entity destroyed: ${entityId}`);
        }

        return destroyed;
    }

    /**
     * Oznacza encję do usunięcia
     */
    markEntityForDeletion(entityId: EntityId): void {
        const entity = this.entityManager.getEntity(entityId);
        if (entity) {
            entity.markForDeletion();
        }
    }

    /**
     * Usuwa wszystkie oznaczone encje
     */
    clearMarkedEntities(): void {
        const marked = this.entityManager.getMarkedForDeletion();
        for (const entityId of marked) {
            this.destroyEntity(entityId);
        }
    }

    /**
     * Pobiera encję po ID
     */
    getEntity(entityId: EntityId): Entity | undefined {
        return this.entityManager.getEntity(entityId);
    }

    /**
     * Sprawdza czy encja istnieje
     */
    hasEntity(entityId: EntityId): boolean {
        return this.entityManager.hasEntity(entityId);
    }

    /**
     * Dodaje komponent do encji
     */
    addComponent(entityId: EntityId, component: Component): boolean {
        const entity = this.entityManager.getEntity(entityId);
        if (!entity) return false;

        const typeId = (component.constructor as typeof Component).typeId;
        
        entity.addComponent(component);
        this.componentStore.setComponent(entityId, typeId, component);

        this.eventEmitter?.emit({
            type: 'ecs:component:added',
            timestamp: Date.now(),
            entityId,
            componentType: component.constructor.name
        } as EcsEvents.ComponentAdded);

        return true;
    }

    /**
     * Usuwa komponent z encji
     */
    removeComponent(entityId: EntityId, typeId: ComponentTypeId): boolean {
        const entity = this.entityManager.getEntity(entityId);
        if (!entity) return false;

        const removed = entity.removeComponent(typeId);
        if (removed) {
            this.componentStore.removeComponent(entityId, typeId);

            this.eventEmitter?.emit({
                type: 'ecs:component:removed',
                timestamp: Date.now(),
                entityId,
                componentType: String(typeId)
            } as EcsEvents.ComponentRemoved);
        }

        return removed;
    }

    /**
     * Pobiera komponent z encji
     */
    getComponent<T extends Component>(entityId: EntityId, typeId: ComponentTypeId): T | undefined {
        return this.componentStore.getComponent(entityId, typeId) as T;
    }

    /**
     * Sprawdza czy encja ma komponent
     */
    hasComponent(entityId: EntityId, typeId: ComponentTypeId): boolean {
        return this.componentStore.hasComponent(entityId, typeId);
    }

    /**
     * Znajduje encje z określonymi komponentami
     */
    findEntitiesWithComponents(typeIds: ComponentTypeId[]): Entity[] {
        const entities: Entity[] = [];
        const mask = this.createComponentMask(typeIds);

        for (const entity of this.entityManager.getAllEntities()) {
            if (!entity.isActive()) continue;
            if ((entity.getComponentMask() & mask) === mask) {
                entities.push(entity);
            }
        }

        return entities;
    }

    /**
     * Znajduje encje z dowolnymi z określonych komponentów
     */
    findEntitiesWithAnyComponent(typeIds: ComponentTypeId[]): Entity[] {
        const entities: Entity[] = [];
        const mask = this.createComponentMask(typeIds);

        for (const entity of this.entityManager.getAllEntities()) {
            if (!entity.isActive()) continue;
            if ((entity.getComponentMask() & mask) !== 0n) {
                entities.push(entity);
            }
        }

        return entities;
    }

    /**
     * Tworzy maskę bitową z listy typów
     */
    private createComponentMask(typeIds: ComponentTypeId[]): bigint {
        let mask = 0n;
        for (const typeId of typeIds) {
            mask |= 1n << BigInt(typeId);
        }
        return mask;
    }

    /**
     * Rejestruje system
     */
    registerSystem(system: System, phase: SystemPhase = SystemPhase.UPDATE, priority: number = 0): void {
        this.scheduler.registerSystem(system, phase, priority);
        this.logger.info(LogCategory.ECS, `System registered: ${system.constructor.name} in phase ${phase}`);
    }

    /**
     * Wyrejestrowuje system
     */
    unregisterSystem(system: System): void {
        this.scheduler.unregisterSystem(system);
    }

    /**
     * Uruchamia świat
     */
    start(): void {
        this.isRunning = true;
        this.currentTime = performance.now();
        this.logger.info(LogCategory.ECS, `World ${this.id} started`);
    }

    /**
     * Zatrzymuje świat
     */
    stop(): void {
        this.isRunning = false;
        this.logger.info(LogCategory.ECS, `World ${this.id} stopped`);
    }

    /**
     * Aktualizuje świat (wywoływane w każdej klatce)
     */
    update(deltaTime?: number): void {
        if (!this.isRunning) return;

        const now = performance.now();
        this.deltaTime = deltaTime ?? (now - this.currentTime) / 1000;
        this.currentTime = now;
        this.frameCount++;

        // Wykonaj systemy
        this.scheduler.execute(this, this.deltaTime, this.frameCount);

        // Automatycznie usuń oznaczone encje
        if (this.config.autoClearMarked) {
            this.clearMarkedEntities();
        }
    }

    /**
     * Wykonuje pojedyńczą fazę systemów
     */
    executePhase(phase: SystemPhase): void {
        this.scheduler.executePhase(phase, this, this.deltaTime, this.frameCount);
    }

    /**
     * Zwraca wszystkie encje
     */
    getAllEntities(): Entity[] {
        return this.entityManager.getAllEntities();
    }

    /**
     * Zwraca liczbę encji
     */
    getEntityCount(): number {
        return this.entityManager.getActiveCount();
    }

    /**
     * Zwraca liczbę komponentów
     */
    getComponentCount(): number {
        return this.componentStore.getComponentCount();
    }

    /**
     * Zwraca statystyki świata
     */
    getStats(): WorldStats {
        return {
            worldId: this.id,
            entities: {
                total: this.entityManager.getTotalCount(),
                active: this.entityManager.getActiveCount(),
                recycled: this.entityManager.getRecycledCount()
            },
            components: this.componentStore.getStats(),
            systems: this.scheduler.getStats(),
            performance: {
                fps: this.deltaTime > 0 ? 1000 / this.deltaTime : 0,
                deltaTime: this.deltaTime,
                frameCount: this.frameCount,
                uptime: this.currentTime
            }
        };
    }

    /**
     * Resetuje świat
     */
    reset(): void {
        this.stop();
        this.entityManager.clear();
        this.componentStore.clear();
        this.scheduler.clear();
        this.currentTime = 0;
        this.deltaTime = 0;
        this.frameCount = 0;
        this.logger.info(LogCategory.ECS, `World ${this.id} reset`);
    }

    /**
     * Zwraca event emitter
     */
    getEventEmitter(): EventEmitter | undefined {
        return this.eventEmitter;
    }

    /**
     * Zwraca logger
     */
    getLogger(): Logger {
        return this.logger;
    }

    /**
     * Zwraca scheduler
     */
    getScheduler(): SystemScheduler {
        return this.scheduler;
    }

    /**
     * Destruktor
     */
    destroy(): void {
        this.stop();
        this.reset();
        this.logger.info(LogCategory.ECS, `World ${this.id} destroyed`);
    }
}

/**
 * Statystyki świata
 */
export interface WorldStats {
    worldId: number;
    entities: {
        total: number;
        active: number;
        recycled: number;
    };
    components: {
        total: number;
        byType: Record<string, number>;
    };
    systems: {
        total: number;
        byPhase: Record<SystemPhase, number>;
    };
    performance: {
        fps: number;
        deltaTime: number;
        frameCount: number;
        uptime: number;
    };
}