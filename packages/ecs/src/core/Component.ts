/**
 * @file Component.ts
 * @description Bazowa klasa dla wszystkich komponentów ECS
 */

import { deepClone } from '@shared-core/utils/DeepClone';

/**
 * Unikalny identyfikator typu komponentu
 */
export type ComponentTypeId = number;

/**
 * Bazowa klasa dla wszystkich komponentów
 */
export abstract class Component {
    /** Unikalny typ komponentu */
    static readonly type: string;
    static typeId: ComponentTypeId = -1;

    /**
     * Tworzy kopię komponentu
     */
    abstract clone(): Component;

    /**
     * Resetuje komponent do stanu początkowego
     */
    abstract reset(): void;

    /**
     * Sprawdza czy komponent jest pusty (może być usunięty)
     */
    isEmpty(): boolean {
        return false;
    }

    /**
     * Serializuje komponent do obiektu
     */
    toJSON(): any {
        const obj: any = {};
        for (const key in this) {
            if (this.hasOwnProperty(key) && key[0] !== '_') {
                obj[key] = this[key];
            }
        }
        return obj;
    }

    /**
     * Deserializuje komponent z obiektu
     */
    fromJSON(json: any): void {
        for (const key in json) {
            if (this.hasOwnProperty(key)) {
                (this as any)[key] = json[key];
            }
        }
    }
}

/**
 * Komponent z automatycznym klonowaniem
 */
export class AutoComponent extends Component {
    clone(): Component {
        return deepClone(this);
    }

    reset(): void {
        // Do override przez potomne klasy
    }
}

/**
 * Komponent przechowujący pozycję
 */
export interface PositionComponentData {
    x: number;
    y: number;
    z?: number;
}

export class PositionComponent extends AutoComponent {
    static readonly type = 'position';
    
    x: number = 0;
    y: number = 0;
    z: number = 0;

    constructor(x: number = 0, y: number = 0, z: number = 0) {
        super();
        this.x = x;
        this.y = y;
        this.z = z;
    }

    set(x: number, y: number, z: number = 0): void {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    reset(): void {
        this.x = 0;
        this.y = 0;
        this.z = 0;
    }
}

/**
 * Komponent przechowujący prędkość
 */
export class VelocityComponent extends AutoComponent {
    static readonly type = 'velocity';
    
    vx: number = 0;
    vy: number = 0;
    maxSpeed: number = Infinity;

    constructor(vx: number = 0, vy: number = 0, maxSpeed: number = Infinity) {
        super();
        this.vx = vx;
        this.vy = vy;
        this.maxSpeed = maxSpeed;
    }

    set(vx: number, vy: number): void {
        this.vx = vx;
        this.vy = vy;
    }

    reset(): void {
        this.vx = 0;
        this.vy = 0;
        this.maxSpeed = Infinity;
    }
}

/**
 * Komponent przechowujący masę i rozmiar
 */
export class MassComponent extends AutoComponent {
    static readonly type = 'mass';
    
    mass: number = 10;
    radius: number = 20;
    density: number = 1;

    constructor(mass: number = 10, radius?: number) {
        super();
        this.mass = mass;
        if (radius !== undefined) {
            this.radius = radius;
        } else {
            this.updateRadius();
        }
    }

    updateRadius(): void {
        this.radius = Math.sqrt(this.mass / Math.PI) * 2;
    }

    reset(): void {
        this.mass = 10;
        this.radius = 20;
        this.density = 1;
    }
}

/**
 * Komponent przechowujący dane gracza
 */
export interface PlayerComponentData {
    playerId: string;
    name: string;
    skin?: string;
}

export class PlayerComponent extends AutoComponent {
    static readonly type = 'player';
    
    playerId: string = '';
    name: string = '';
    skin: string = 'default';
    isBot: boolean = false;

    constructor(playerId: string = '', name: string = '', isBot: boolean = false) {
        super();
        this.playerId = playerId;
        this.name = name;
        this.isBot = isBot;
    }

    reset(): void {
        this.playerId = '';
        this.name = '';
        this.skin = 'default';
        this.isBot = false;
    }
}

/**
 * Komponent przechowujący dane wizualne
 */
export class VisualComponent extends AutoComponent {
    static readonly type = 'visual';
    
    color: string = '#FFFFFF';
    spriteId?: string;
    scale: number = 1;
    opacity: number = 1;
    layer: number = 0;

    constructor(color: string = '#FFFFFF', spriteId?: string) {
        super();
        this.color = color;
        this.spriteId = spriteId;
    }

    reset(): void {
        this.color = '#FFFFFF';
        this.spriteId = undefined;
        this.scale = 1;
        this.opacity = 1;
        this.layer = 0;
    }
}

/**
 * Komponent przechowujący tagi
 */
export class TagComponent extends AutoComponent {
    static readonly type = 'tag';
    
    tags: Set<string> = new Set();

    constructor(tags: string[] = []) {
        super();
        for (const tag of tags) {
            this.tags.add(tag);
        }
    }

    add(tag: string): void {
        this.tags.add(tag);
    }

    remove(tag: string): boolean {
        return this.tags.delete(tag);
    }

    has(tag: string): boolean {
        return this.tags.has(tag);
    }

    reset(): void {
        this.tags.clear();
    }

    toJSON(): any {
        return {
            tags: Array.from(this.tags)
        };
    }

    fromJSON(json: any): void {
        this.tags = new Set(json.tags || []);
    }
}

/**
 * Komponent przechowujący timeouty/cooldowny
 */
export class CooldownComponent extends AutoComponent {
    static readonly type = 'cooldown';
    
    cooldowns: Map<string, number> = new Map();

    set(key: string, duration: number): void {
        this.cooldowns.set(key, Date.now() + duration);
    }

    isReady(key: string): boolean {
        const time = this.cooldowns.get(key);
        return !time || time <= Date.now();
    }

    remaining(key: string): number {
        const time = this.cooldowns.get(key);
        return time ? Math.max(0, time - Date.now()) : 0;
    }

    reset(): void {
        this.cooldowns.clear();
    }

    toJSON(): any {
        const obj: any = {};
        for (const [key, value] of this.cooldowns) {
            obj[key] = value;
        }
        return obj;
    }

    fromJSON(json: any): void {
        this.cooldowns = new Map(Object.entries(json));
    }
}

/**
 * Rejestr typów komponentów
 */
export class ComponentRegistry {
    private static types: Map<string, { new(): Component }> = new Map();
    private static typeIds: Map<string, ComponentTypeId> = new Map();
    private static nextTypeId: ComponentTypeId = 0;

    /**
     * Rejestruje typ komponentu
     */
    static register<T extends Component>(type: string, ctor: { new(): T }): ComponentTypeId {
        if (this.types.has(type)) {
            return this.typeIds.get(type)!;
        }

        this.types.set(type, ctor);
        const typeId = this.nextTypeId++;
        this.typeIds.set(type, typeId);
        
        // Ustaw statyczne pole typeId na klasie
        (ctor as any).typeId = typeId;
        (ctor as any).type = type;

        return typeId;
    }

    /**
     * Tworzy instancję komponentu
     */
    static create(type: string): Component {
        const ctor = this.types.get(type);
        if (!ctor) {
            throw new Error(`Nieznany typ komponentu: ${type}`);
        }
        return new ctor();
    }

    /**
     * Pobiera ID typu
     */
    static getTypeId(type: string): ComponentTypeId {
        const id = this.typeIds.get(type);
        if (id === undefined) {
            throw new Error(`Nieznany typ komponentu: ${type}`);
        }
        return id;
    }

    /**
     * Pobiera nazwę typu po ID
     */
    static getTypeName(typeId: ComponentTypeId): string | undefined {
        for (const [name, id] of this.typeIds.entries()) {
            if (id === typeId) return name;
        }
        return undefined;
    }

    /**
     * Sprawdza czy typ istnieje
     */
    static hasType(type: string): boolean {
        return this.types.has(type);
    }

    /**
     * Zwraca wszystkie zarejestrowane typy
     */
    static getAllTypes(): string[] {
        return Array.from(this.types.keys());
    }
}

// Rejestracja podstawowych komponentów
ComponentRegistry.register('position', PositionComponent);
ComponentRegistry.register('velocity', VelocityComponent);
ComponentRegistry.register('mass', MassComponent);
ComponentRegistry.register('player', PlayerComponent);
ComponentRegistry.register('visual', VisualComponent);
ComponentRegistry.register('tag', TagComponent);
ComponentRegistry.register('cooldown', CooldownComponent);