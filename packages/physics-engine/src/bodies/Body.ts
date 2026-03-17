/**
 * @file Body.ts
 * @description Bazowa klasa dla wszystkich brył fizycznych
 */

import { Vector2 } from '@shared-core/math/Vector2';
import { EntityId } from '@shared-core/types/EntityTypes';

/**
 * Typ bryły fizycznej
 */
export enum BodyType {
    STATIC = 'static',      // Nieruchoma (ściany, przeszkody)
    DYNAMIC = 'dynamic',     // Ruchoma (komórki graczy)
    KINEMATIC = 'kinematic'  // Kinematyczna (kontrolowana przez kod)
}

/**
 * Kształt bryły
 */
export enum ShapeType {
    CIRCLE = 'circle',
    RECTANGLE = 'rectangle',
    POLYGON = 'polygon'
}

/**
 * Materiał bryły - właściwości fizyczne
 */
export interface Material {
    density: number;        // Gęstość (masa/objętość)
    friction: number;       // Tarcie (0-1)
    restitution: number;    // Sprężystość (0-1)
    mass?: number;          // Masa (opcjonalnie, jeśli density ustawione)
}

/**
 * Standardowe materiały
 */
export const Materials = {
    DEFAULT: {
        density: 1.0,
        friction: 0.3,
        restitution: 0.2
    },
    BOUNCY: {
        density: 1.0,
        friction: 0.1,
        restitution: 0.8
    },
    SLIPPERY: {
        density: 1.0,
        friction: 0.01,
        restitution: 0.1
    },
    HEAVY: {
        density: 2.0,
        friction: 0.5,
        restitution: 0.1
    },
    LIGHT: {
        density: 0.5,
        friction: 0.4,
        restitution: 0.3
    }
} as const;

/**
 * Bazowa klasa dla bryły fizycznej
 */
export abstract class Body {
    public readonly id: EntityId;
    public readonly type: BodyType;
    public readonly shape: ShapeType;
    
    // Pozycja i rotacja
    public position: Vector2;
    public rotation: number = 0;
    
    // Prędkości
    public velocity: Vector2 = Vector2.zero();
    public angularVelocity: number = 0;
    
    // Siły
    public force: Vector2 = Vector2.zero();
    public torque: number = 0;
    
    // Właściwości fizyczne
    public material: Material;
    public mass: number = 1;
    public invMass: number = 1;
    public inertia: number = 1;
    public invInertia: number = 1;
    
    // Ograniczenia
    public maxSpeed: number = Infinity;
    public maxAngularSpeed: number = Infinity;
    
    // Flagi
    public isAwake: boolean = true;
    public isBullet: boolean = false; // Dla szybkich obiektów (continuous collision)
    public isSensor: boolean = false; // Tylko detekcja kolizji, bez reakcji
    
    // Cache dla kolizji
    public aabb: AABB = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    
    // Dane użytkownika
    public userData: any = null;

    constructor(
        id: EntityId,
        type: BodyType,
        shape: ShapeType,
        position: Vector2,
        material: Material = Materials.DEFAULT
    ) {
        this.id = id;
        this.type = type;
        this.shape = shape;
        this.position = position.clone();
        this.material = { ...material };
        
        this.updateMass();
        this.updateAABB();
    }

    /**
     * Aktualizuje masę na podstawie materiału i kształtu
     */
    protected abstract updateMass(): void;

    /**
     * Aktualizuje AABB (Axis-Aligned Bounding Box)
     */
    abstract updateAABB(): void;

    /**
     * Sprawdza czy punkt znajduje się wewnątrz bryły
     */
    abstract containsPoint(point: Vector2): boolean;

    /**
     * Oblicza najmniejszą odległość od punktu do bryły
     */
    abstract distanceToPoint(point: Vector2): number;

    /**
     * Oblicza wektor normalny w punkcie na powierzchni
     */
    abstract getNormalAt(point: Vector2): Vector2;

    /**
     * Oblicza moment bezwładności
     */
    protected abstract calculateInertia(): number;

    /**
     * Aktualizuje masę i moment bezwładności
     */
    protected updateMassFromMaterial(area: number): void {
        if (this.type === BodyType.STATIC) {
            this.mass = Infinity;
            this.invMass = 0;
            this.inertia = Infinity;
            this.invInertia = 0;
            return;
        }

        if (this.material.mass !== undefined) {
            this.mass = this.material.mass;
        } else {
            this.mass = this.material.density * area;
        }

        this.invMass = this.mass > 0 ? 1 / this.mass : 0;
        this.inertia = this.calculateInertia();
        this.invInertia = this.inertia > 0 ? 1 / this.inertia : 0;
    }

    /**
     * Zastosuj siłę w punkcie (w globalnych koordynatach)
     */
    applyForce(force: Vector2, point: Vector2 = this.position): void {
        if (this.type !== BodyType.DYNAMIC || !this.isAwake) return;
        
        this.force.add(force);
        this.torque += (point.x - this.position.x) * force.y - (point.y - this.position.y) * force.x;
    }

    /**
     * Zastosuj impuls w punkcie
     */
    applyImpulse(impulse: Vector2, point: Vector2 = this.position): void {
        if (this.type !== BodyType.DYNAMIC || !this.isAwake) return;

        this.velocity.x += impulse.x * this.invMass;
        this.velocity.y += impulse.y * this.invMass;
        
        const r = point.subtracted(this.position);
        this.angularVelocity += this.invInertia * (r.x * impulse.y - r.y * impulse.x);
    }

    /**
     * Zastosuj impuls liniowy
     */
    applyLinearImpulse(impulse: Vector2): void {
        if (this.type !== BodyType.DYNAMIC || !this.isAwake) return;

        this.velocity.x += impulse.x * this.invMass;
        this.velocity.y += impulse.y * this.invMass;
    }

    /**
     * Zastosuj impuls kątowy
     */
    applyAngularImpulse(impulse: number): void {
        if (this.type !== BodyType.DYNAMIC || !this.isAwake) return;

        this.angularVelocity += impulse * this.invInertia;
    }

    /**
     * Zastosuj tłumienie prędkości
     */
    applyDamping(linearDamping: number, angularDamping: number, dt: number): void {
        if (this.type !== BodyType.DYNAMIC || !this.isAwake) return;

        this.velocity.multiply(1 - linearDamping * dt);
        this.angularVelocity *= 1 - angularDamping * dt;
        
        // Obudź jeśli prędkość przekracza próg
        if (this.velocity.lengthSquared() > 0.01 || Math.abs(this.angularVelocity) > 0.01) {
            this.isAwake = true;
        }
    }

    /**
     * Obudź bryłę
     */
    wakeUp(): void {
        this.isAwake = true;
    }

    /**
     * Uśpij bryłę (jeśli nieruchoma)
     */
    sleep(force: boolean = false): void {
        if (force || (this.velocity.lengthSquared() < 0.01 && Math.abs(this.angularVelocity) < 0.01)) {
            this.isAwake = false;
        }
    }

    /**
     * Przesuń bryłę
     */
    translate(delta: Vector2): void {
        this.position.add(delta);
        this.updateAABB();
    }

    /**
     * Obróć bryłę
     */
    rotate(angle: number): void {
        this.rotation += angle;
        this.updateAABB();
    }

    /**
     * Ustaw pozycję
     */
    setPosition(x: number, y: number): void {
        this.position.x = x;
        this.position.y = y;
        this.updateAABB();
    }

    /**
     * Ustaw prędkość
     */
    setVelocity(vx: number, vy: number): void {
        this.velocity.x = vx;
        this.velocity.y = vy;
    }

    /**
     * Ogranicz prędkość
     */
    clampVelocity(): void {
        if (this.maxSpeed < Infinity) {
            const speed = this.velocity.length();
            if (speed > this.maxSpeed) {
                this.velocity.multiply(this.maxSpeed / speed);
            }
        }

        if (this.maxAngularSpeed < Infinity) {
            this.angularVelocity = Math.sign(this.angularVelocity) * 
                Math.min(Math.abs(this.angularVelocity), this.maxAngularSpeed);
        }
    }

    /**
     * Pobierz prędkość w punkcie
     */
    getVelocityAtPoint(point: Vector2): Vector2 {
        const r = point.subtracted(this.position);
        const tangent = new Vector2(-r.y, r.x);
        return this.velocity.added(tangent.multiplied(this.angularVelocity));
    }

    /**
     * Serializacja
     */
    toJSON(): any {
        return {
            id: this.id,
            type: this.type,
            shape: this.shape,
            position: { x: this.position.x, y: this.position.y },
            rotation: this.rotation,
            velocity: { x: this.velocity.x, y: this.velocity.y },
            angularVelocity: this.angularVelocity,
            material: this.material,
            mass: this.mass,
            isAwake: this.isAwake,
            isSensor: this.isSensor
        };
    }

    /**
     * Deserializacja
     */
    fromJSON(json: any): void {
        this.position = new Vector2(json.position.x, json.position.y);
        this.rotation = json.rotation;
        this.velocity = new Vector2(json.velocity.x, json.velocity.y);
        this.angularVelocity = json.angularVelocity;
        this.material = json.material;
        this.mass = json.mass;
        this.isAwake = json.isAwake;
        this.isSensor = json.isSensor;
        
        this.invMass = this.mass > 0 ? 1 / this.mass : 0;
        this.inertia = this.calculateInertia();
        this.invInertia = this.inertia > 0 ? 1 / this.inertia : 0;
        
        this.updateAABB();
    }
}

/**
 * Axis-Aligned Bounding Box
 */
export interface AABB {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

/**
 * Sprawdza czy dwa AABB kolidują
 */
export function aabbOverlap(a: AABB, b: AABB): boolean {
    return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

/**
 * Łączy dwa AABB
 */
export function aabbUnion(a: AABB, b: AABB): AABB {
    return {
        minX: Math.min(a.minX, b.minX),
        minY: Math.min(a.minY, b.minY),
        maxX: Math.max(a.maxX, b.maxX),
        maxY: Math.max(a.maxY, b.maxY)
    };
}

/**
 * Sprawdza czy AABB zawiera punkt
 */
export function aabbContainsPoint(aabb: AABB, point: Vector2): boolean {
    return point.x >= aabb.minX && point.x <= aabb.maxX &&
           point.y >= aabb.minY && point.y <= aabb.maxY;
}

/**
 * Oblicza środek AABB
 */
export function aabbCenter(aabb: AABB): Vector2 {
    return new Vector2(
        (aabb.minX + aabb.maxX) * 0.5,
        (aabb.minY + aabb.maxY) * 0.5
    );
}

/**
 * Oblicza połowę wymiarów AABB
 */
export function aabbExtents(aabb: AABB): Vector2 {
    return new Vector2(
        (aabb.maxX - aabb.minX) * 0.5,
        (aabb.maxY - aabb.minY) * 0.5
    );
}