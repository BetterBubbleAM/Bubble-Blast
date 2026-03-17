/**
 * @file Entity.ts
 * @description Encja - podstawowy obiekt w ECS, agreguje komponenty
 */

import { Component, ComponentTypeId } from './Component';
import { ComponentRegistry } from './Component';

/**
 * Unikalny identyfikator encji
 */
export type EntityId = number;

/**
 * Flagi encji
 */
export enum EntityFlags {
    NONE = 0,
    ACTIVE = 1 << 0,
    VISIBLE = 1 << 1,
    STATIC = 1 << 2,
    DYNAMIC = 1 << 3,
    PAUSED = 1 << 4,
    MARKED_FOR_DELETION = 1 << 5,
    MARKED_FOR_UPDATE = 1 << 6
}

/**
 * Główna klasa encji
 */
export class Entity {
    public readonly id: EntityId;
    private components: Map<ComponentTypeId, Component> = new Map();
    private componentMask: bigint = 0n;
    private flags: EntityFlags = EntityFlags.ACTIVE | EntityFlags.VISIBLE;
    private version: number = 0;
    private generation: number = 0;

    constructor(id: EntityId) {
        this.id = id;
    }

    /**
     * Dodaje komponent do encji
     */
    addComponent(component: Component): this {
        const ctor = component.constructor as typeof Component;
        const typeId = (ctor as any).typeId as ComponentTypeId;
        
        if (typeId === undefined) {
            throw new Error('Komponent nie ma zarejestrowanego typeId');
        }

        this.components.set(typeId, component);
        this.componentMask |= 1n << BigInt(typeId);
        this.version++;

        return this;
    }

    /**
     * Usuwa komponent z encji
     */
    removeComponent(typeId: ComponentTypeId): boolean {
        const removed = this.components.delete(typeId);
        if (removed) {
            this.componentMask &= ~(1n << BigInt(typeId));
            this.version++;
        }
        return removed;
    }

    /**
     * Usuwa komponent po nazwie typu
     */
    removeComponentByType(type: string): boolean {
        const typeId = ComponentRegistry.getTypeId(type);
        return this.removeComponent(typeId);
    }

    /**
     * Pobiera komponent
     */
    getComponent<T extends Component>(typeId: ComponentTypeId): T | undefined {
        return this.components.get(typeId) as T;
    }

    /**
     * Pobiera komponent po nazwie typu
     */
    getComponentByType<T extends Component>(type: string): T | undefined {
        const typeId = ComponentRegistry.getTypeId(type);
        return this.getComponent<T>(typeId);
    }

    /**
     * Sprawdza czy encja ma komponent
     */
    hasComponent(typeId: ComponentTypeId): boolean {
        return this.components.has(typeId);
    }

    /**
     * Sprawdza czy encja ma komponent po nazwie
     */
    hasComponentByType(type: string): boolean {
        const typeId = ComponentRegistry.getTypeId(type);
        return this.hasComponent(typeId);
    }

    /**
     * Sprawdza czy encja ma wszystkie wymagane komponenty
     */
    hasAllComponents(typeIds: ComponentTypeId[]): boolean {
        for (const typeId of typeIds) {
            if (!this.hasComponent(typeId)) return false;
        }
        return true;
    }

    /**
     * Sprawdza czy encja ma którykolwiek z komponentów
     */
    hasAnyComponent(typeIds: ComponentTypeId[]): boolean {
        for (const typeId of typeIds) {
            if (this.hasComponent(typeId)) return true;
        }
        return false;
    }

    /**
     * Zwraca maskę bitową komponentów
     */
    getComponentMask(): bigint {
        return this.componentMask;
    }

    /**
     * Zwraca wszystkie komponenty
     */
    getAllComponents(): Map<ComponentTypeId, Component> {
        return new Map(this.components);
    }

    /**
     * Zwraca tablicę wszystkich komponentów
     */
    getComponentsArray(): Component[] {
        return Array.from(this.components.values());
    }

    /**
     * Zwraca tablicę ID typów komponentów
     */
    getComponentTypes(): ComponentTypeId[] {
        return Array.from(this.components.keys());
    }

    /**
     * Aktualizuje komponent lub dodaje jeśli nie istnieje
     */
    upsertComponent<T extends Component>(typeId: ComponentTypeId, updater: (component: T) => void): void {
        let component = this.getComponent<T>(typeId);
        if (!component) {
            const typeName = ComponentRegistry.getTypeName(typeId);
            if (!typeName) throw new Error(`Nieznany typ komponentu: ${typeId}`);
            component = ComponentRegistry.create(typeName) as T;
            this.addComponent(component);
        }
        updater(component);
    }

    /**
     * Ustawia flagę encji
     */
    setFlag(flag: EntityFlags, value: boolean): void {
        if (value) {
            this.flags |= flag;
        } else {
            this.flags &= ~flag;
        }
    }

    /**
     * Sprawdza flagę
     */
    hasFlag(flag: EntityFlags): boolean {
        return (this.flags & flag) !== 0;
    }

    /**
     * Zwraca flagi
     */
    getFlags(): EntityFlags {
        return this.flags;
    }

    /**
     * Aktywuje encję
     */
    activate(): void {
        this.setFlag(EntityFlags.ACTIVE, true);
    }

    /**
     * Dezaktywuje encję
     */
    deactivate(): void {
        this.setFlag(EntityFlags.ACTIVE, false);
    }

    /**
     * Sprawdza czy encja jest aktywna
     */
    isActive(): boolean {
        return this.hasFlag(EntityFlags.ACTIVE);
    }

    /**
     * Zaznacza encję do usunięcia
     */
    markForDeletion(): void {
        this.setFlag(EntityFlags.MARKED_FOR_DELETION, true);
    }

    /**
     * Sprawdza czy encja jest oznaczona do usunięcia
     */
    isMarkedForDeletion(): boolean {
        return this.hasFlag(EntityFlags.MARKED_FOR_DELETION);
    }

    /**
     * Zwiększa generację (przy reuse)
     */
    incrementGeneration(): void {
        this.generation++;
    }

    /**
     * Zwraca generację
     */
    getGeneration(): number {
        return this.generation;
    }

    /**
     * Zwraca wersję (zmienia się przy modyfikacji komponentów)
     */
    getVersion(): number {
        return this.version;
    }

    /**
     * Czyści wszystkie komponenty
     */
    clearComponents(): void {
        this.components.clear();
        this.componentMask = 0n;
        this.version++;
    }

    /**
     * Resetuje encję do stanu początkowego
     */
    reset(): void {
        this.clearComponents();
        this.flags = EntityFlags.ACTIVE | EntityFlags.VISIBLE;
        this.version = 0;
    }

    /**
     * Tworzy kopię encji (bez ID)
     */
    clone(): Entity {
        const clone = new Entity(this.id);
        clone.flags = this.flags;
        clone.generation = this.generation;
        
        for (const [typeId, component] of this.components) {
            clone.addComponent(component.clone());
        }
        
        return clone;
    }

    /**
     * Porównuje z inną encją
     */
    equals(other: Entity): boolean {
        if (this.id !== other.id) return false;
        if (this.generation !== other.generation) return false;
        if (this.componentMask !== other.componentMask) return false;
        return true;
    }

    /**
     * Serializuje encję do JSON
     */
    toJSON(): any {
        const components: any = {};
        for (const [typeId, component] of this.components) {
            const typeName = ComponentRegistry.getTypeName(typeId);
            if (typeName) {
                components[typeName] = component.toJSON();
            }
        }

        return {
            id: this.id,
            generation: this.generation,
            flags: this.flags,
            components
        };
    }

    /**
     * Deserializuje encję z JSON
     */
    fromJSON(json: any): void {
        this.flags = json.flags || EntityFlags.ACTIVE | EntityFlags.VISIBLE;
        this.generation = json.generation || 0;

        if (json.components) {
            for (const [typeName, data] of Object.entries(json.components)) {
                if (ComponentRegistry.hasType(typeName)) {
                    const component = ComponentRegistry.create(typeName);
                    component.fromJSON(data);
                    this.addComponent(component);
                }
            }
        }
    }

    /**
     * Zwraca string reprezentację
     */
    toString(): string {
        const components = Array.from(this.components.keys())
            .map(id => ComponentRegistry.getTypeName(id))
            .filter(Boolean)
            .join(', ');
        
        return `Entity#${this.id}:${this.generation} [${components}]`;
    }
}

/**
 * Iterator po encjach
 */
export class EntityIterator implements Iterator<Entity> {
    private entities: Entity[];
    private index: number = 0;

    constructor(entities: Entity[]) {
        this.entities = entities;
    }

    next(): IteratorResult<Entity> {
        if (this.index < this.entities.length) {
            return {
                done: false,
                value: this.entities[this.index++]
            };
        }
        return {
            done: true,
            value: null as any
        };
    }

    [Symbol.iterator](): IterableIterator<Entity> {
        return this;
    }
}