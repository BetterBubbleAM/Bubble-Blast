/**
 * @file WorldBounds.ts
 * @description Zarządzanie granicami świata i kolizjami ze ścianami
 */

import { Vector2 } from '@shared-core/math/Vector2';
import { Body, BodyType } from '../bodies/Body';
import { Contact, ContactPoint } from '../collision/CollisionSystem';

/**
 * Typ ściany
 */
export enum WallType {
    LEFT = 'left',
    RIGHT = 'right',
    TOP = 'top',
    BOTTOM = 'bottom'
}

/**
 * Granice świata
 */
export interface Bounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

/**
 * Wynik kolizji ze ścianą
 */
export interface WallCollisionResult {
    collides: boolean;
    wall: WallType;
    contact: Contact;
    penetration: number;
    normal: Vector2;
}

/**
 * Zarządca granic świata
 */
export class WorldBounds {
    private bounds: Bounds;
    private enableWalls: boolean;
    private wallRestitution: number;
    private wallFriction: number;
    
    // Cache dla ścian
    private walls: Map<WallType, {
        normal: Vector2;
        position: Vector2;
        length: number;
    }> = new Map();

    constructor(config: {
        bounds: Bounds;
        enableWalls?: boolean;
        wallRestitution?: number;
        wallFriction?: number;
    }) {
        this.bounds = { ...config.bounds };
        this.enableWalls = config.enableWalls ?? true;
        this.wallRestitution = config.wallRestitution ?? 0.2;
        this.wallFriction = config.wallFriction ?? 0.3;
        
        this.initializeWalls();
    }

    /**
     * Inicjalizuje ściany
     */
    private initializeWalls(): void {
        // Lewa ściana (normalna w prawo)
        this.walls.set(WallType.LEFT, {
            normal: new Vector2(1, 0),
            position: new Vector2(this.bounds.minX, 0),
            length: this.bounds.maxY - this.bounds.minY
        });
        
        // Prawa ściana (normalna w lewo)
        this.walls.set(WallType.RIGHT, {
            normal: new Vector2(-1, 0),
            position: new Vector2(this.bounds.maxX, 0),
            length: this.bounds.maxY - this.bounds.minY
        });
        
        // Górna ściana (normalna w dół)
        this.walls.set(WallType.TOP, {
            normal: new Vector2(0, -1),
            position: new Vector2(0, this.bounds.minY),
            length: this.bounds.maxX - this.bounds.minX
        });
        
        // Dolna ściana (normalna w górę)
        this.walls.set(WallType.BOTTOM, {
            normal: new Vector2(0, 1),
            position: new Vector2(0, this.bounds.maxY),
            length: this.bounds.maxX - this.bounds.minX
        });
    }

    /**
     * Sprawdza kolizję bryły ze ścianami
     */
    checkCollision(body: Body): WallCollisionResult[] {
        if (!this.enableWalls) return [];
        
        const results: WallCollisionResult[] = [];
        
        // Sprawdź każdą ścianę
        for (const [type, wall] of this.walls) {
            const collision = this.checkWallCollision(body, type, wall);
            if (collision) {
                results.push(collision);
            }
        }
        
        return results;
    }

    /**
     * Sprawdza kolizję z pojedynczą ścianą
     */
    private checkWallCollision(
        body: Body,
        wallType: WallType,
        wall: { normal: Vector2; position: Vector2; length: number }
    ): WallCollisionResult | null {
        
        // Dla koła (większość obiektów w Agar.io)
        if (body.shape === 'circle') {
            return this.checkCircleWallCollision(body, wallType, wall);
        }
        
        // Dla prostokąta
        if (body.shape === 'rectangle') {
            return this.checkRectangleWallCollision(body, wallType, wall);
        }
        
        return null;
    }

    /**
     * Sprawdza kolizję koła ze ścianą
     */
    private checkCircleWallCollision(
        body: Body,
        wallType: WallType,
        wall: { normal: Vector2; position: Vector2; length: number }
    ): WallCollisionResult | null {
        
        const radius = (body as any).radius || 0;
        let distance: number;
        let penetration: number;
        let contactPoint: Vector2;
        
        switch (wallType) {
            case WallType.LEFT:
                distance = body.position.x - this.bounds.minX;
                penetration = radius - distance;
                if (penetration <= 0) return null;
                contactPoint = new Vector2(this.bounds.minX, body.position.y);
                break;
                
            case WallType.RIGHT:
                distance = this.bounds.maxX - body.position.x;
                penetration = radius - distance;
                if (penetration <= 0) return null;
                contactPoint = new Vector2(this.bounds.maxX, body.position.y);
                break;
                
            case WallType.TOP:
                distance = body.position.y - this.bounds.minY;
                penetration = radius - distance;
                if (penetration <= 0) return null;
                contactPoint = new Vector2(body.position.x, this.bounds.minY);
                break;
                
            case WallType.BOTTOM:
                distance = this.bounds.maxY - body.position.y;
                penetration = radius - distance;
                if (penetration <= 0) return null;
                contactPoint = new Vector2(body.position.x, this.bounds.maxY);
                break;
                
            default:
                return null;
        }
        
        // Stwórz punkt kontaktu
        const contact: Contact = {
            bodyA: body,
            bodyB: null, // null dla ściany
            point: contactPoint,
            normal: wall.normal.clone(),
            penetration,
            restitution: this.wallRestitution,
            friction: this.wallFriction,
            tangent: new Vector2(-wall.normal.y, wall.normal.x)
        };
        
        return {
            collides: true,
            wall: wallType,
            contact,
            penetration,
            normal: wall.normal.clone()
        };
    }

    /**
     * Sprawdza kolizję prostokąta ze ścianą
     */
    private checkRectangleWallCollision(
        body: Body,
        wallType: WallType,
        wall: { normal: Vector2; position: Vector2; length: number }
    ): WallCollisionResult | null {
        
        // TODO: implementacja dla prostokąta
        return null;
    }

    /**
     * Rozwiązuje kolizję ze ścianą
     */
    resolveCollision(body: Body, collision: WallCollisionResult): void {
        if (body.type !== BodyType.DYNAMIC) return;
        
        const contact = collision.contact;
        
        // Korekcja pozycji
        body.position.add(contact.normal.multiplied(contact.penetration));
        
        // Oblicz prędkość względną
        const velocity = body.velocity;
        const normal = contact.normal;
        
        // Prędkość wzdłuż normalnej
        const vn = velocity.dot(normal);
        
        if (vn < 0) {
            // Oblicz impuls
            const restitution = Math.min(contact.restitution, this.wallRestitution);
            const j = -(1 + restitution) * vn;
            
            // Zastosuj impuls
            const impulse = normal.multiplied(j);
            body.applyLinearImpulse(impulse);
            
            // Tarcie
            const tangent = new Vector2(-normal.y, normal.x);
            const vt = velocity.dot(tangent);
            
            if (Math.abs(vt) > 0.001) {
                const friction = Math.min(contact.friction, this.wallFriction);
                const maxFriction = Math.abs(j) * friction;
                const frictionImpulse = Math.min(Math.abs(vt), maxFriction) * Math.sign(-vt);
                body.applyLinearImpulse(tangent.multiplied(frictionImpulse));
            }
        }
    }

    /**
     * Sprawdza czy punkt jest poza granicami
     */
    isPointOutOfBounds(point: Vector2): boolean {
        return point.x < this.bounds.minX ||
               point.x > this.bounds.maxX ||
               point.y < this.bounds.minY ||
               point.y > this.bounds.maxY;
    }

    /**
     * Sprawdza czy bryła jest poza granicami
     */
    isBodyOutOfBounds(body: Body): boolean {
        return body.aabb.maxX < this.bounds.minX ||
               body.aabb.minX > this.bounds.maxX ||
               body.aabb.maxY < this.bounds.minY ||
               body.aabb.minY > this.bounds.maxY;
    }

    /**
     * Przesuwa bryłę z powrotem do granic
     */
    clampToBounds(body: Body): void {
        const radius = (body as any).radius || 0;
        
        if (body.position.x - radius < this.bounds.minX) {
            body.position.x = this.bounds.minX + radius;
        }
        if (body.position.x + radius > this.bounds.maxX) {
            body.position.x = this.bounds.maxX - radius;
        }
        if (body.position.y - radius < this.bounds.minY) {
            body.position.y = this.bounds.minY + radius;
        }
        if (body.position.y + radius > this.bounds.maxY) {
            body.position.y = this.bounds.maxY - radius;
        }
        
        body.updateAABB();
    }

    /**
     * Znajduje najbliższy punkt wewnątrz granic
     */
    getClosestPointInside(point: Vector2): Vector2 {
        return new Vector2(
            Math.max(this.bounds.minX, Math.min(this.bounds.maxX, point.x)),
            Math.max(this.bounds.minY, Math.min(this.bounds.maxY, point.y))
        );
    }

    /**
     * Losowy punkt wewnątrz granic
     */
    getRandomPoint(margin: number = 0): Vector2 {
        return new Vector2(
            this.bounds.minX + margin + Math.random() * (this.bounds.maxX - this.bounds.minX - 2 * margin),
            this.bounds.minY + margin + Math.random() * (this.bounds.maxY - this.bounds.minY - 2 * margin)
        );
    }

    /**
     * Aktualizuje granice
     */
    setBounds(bounds: Bounds): void {
        this.bounds = { ...bounds };
        this.initializeWalls();
    }

    /**
     * Włącza/wyłącza ściany
     */
    setWallsEnabled(enabled: boolean): void {
        this.enableWalls = enabled;
    }

    /**
     * Pobiera granice
     */
    getBounds(): Bounds {
        return { ...this.bounds };
    }

    /**
     * Pobiera środek świata
     */
    getCenter(): Vector2 {
        return new Vector2(
            (this.bounds.minX + this.bounds.maxX) / 2,
            (this.bounds.minY + this.bounds.maxY) / 2
        );
    }

    /**
     * Pobiera wymiary świata
     */
    getDimensions(): Vector2 {
        return new Vector2(
            this.bounds.maxX - this.bounds.minX,
            this.bounds.maxY - this.bounds.minY
        );
    }

    /**
     * Sprawdza czy bryła jest w całości wewnątrz
     */
    isBodyFullyInside(body: Body): boolean {
        return body.aabb.minX >= this.bounds.minX &&
               body.aabb.maxX <= this.bounds.maxX &&
               body.aabb.minY >= this.bounds.minY &&
               body.aabb.maxY <= this.bounds.maxY;
    }
}