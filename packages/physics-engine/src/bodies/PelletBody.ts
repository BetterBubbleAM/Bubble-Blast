/**
 * @file PelletBody.ts
 * @description Bryła fizyczna dla pelletu (jedzenia)
 */

import { Body, BodyType, ShapeType, Material, Materials, AABB } from './Body';
import { Vector2 } from '@shared-core/math/Vector2';
import { EntityId } from '@shared-core/types/EntityTypes';
import { GAMEPLAY_CONSTANTS } from '@shared-core/constants/GameplayConstants';

/**
 * Stan pelletu
 */
export enum PelletState {
    ACTIVE = 'active',       // Dostępny
    EATEN = 'eaten',          // Zjedzony
    SPAWNING = 'spawning',    // Pojawia się
    DESPAWNING = 'despawning' // Znika
}

/**
 * Bryła pelletu
 */
export class PelletBody extends Body {
    public radius: number;
    public state: PelletState = PelletState.ACTIVE;
    public value: number = 1; // Wartość odżywcza
    public respawnTime: number = GAMEPLAY_CONSTANTS.PELLET_RESPAWN_TIME;
    public spawnTimer: number = 0;
    
    // Dla efektów
    public scale: number = 1;
    public rotation: number = 0;
    public spinSpeed: number = 0;

    constructor(
        id: EntityId,
        position: Vector2,
        radius: number = GAMEPLAY_CONSTANTS.PELLET_RADIUS,
        material: Material = Materials.DEFAULT
    ) {
        super(id, BodyType.STATIC, ShapeType.CIRCLE, position, material);
        this.radius = radius;
        this.mass = GAMEPLAY_CONSTANTS.PELLET_MASS;
        this.invMass = 0; // Pellety są statyczne
        
        // Losowa rotacja dla efektów
        this.spinSpeed = (Math.random() - 0.5) * 2;
        
        this.updateAABB();
    }

    /**
     * Aktualizuje masę
     */
    protected updateMass(): void {
        // Pellety są statyczne
        this.mass = Infinity;
        this.invMass = 0;
        this.inertia = Infinity;
        this.invInertia = 0;
    }

    /**
     * Aktualizuje AABB
     */
    updateAABB(): void {
        const currentRadius = this.radius * this.scale;
        
        this.aabb = {
            minX: this.position.x - currentRadius,
            minY: this.position.y - currentRadius,
            maxX: this.position.x + currentRadius,
            maxY: this.position.y + currentRadius
        };
    }

    /**
     * Sprawdza czy punkt znajduje się wewnątrz
     */
    containsPoint(point: Vector2): boolean {
        const dx = point.x - this.position.x;
        const dy = point.y - this.position.y;
        const currentRadius = this.radius * this.scale;
        return dx * dx + dy * dy <= currentRadius * currentRadius;
    }

    /**
     * Oblicza odległość od punktu
     */
    distanceToPoint(point: Vector2): number {
        const dx = point.x - this.position.x;
        const dy = point.y - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const currentRadius = this.radius * this.scale;
        return Math.max(0, distance - currentRadius);
    }

    /**
     * Oblicza wektor normalny
     */
    getNormalAt(point: Vector2): Vector2 {
        const dx = point.x - this.position.x;
        const dy = point.y - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance === 0) {
            return new Vector2(1, 0);
        }
        
        return new Vector2(dx / distance, dy / distance);
    }

    /**
     * Oblicza moment bezwładności
     */
    protected calculateInertia(): number {
        return Infinity; // Statyczne
    }

    /**
     * Aktualizuje stan pelletu
     */
    update(dt: number): void {
        // Rotacja dla efektów
        this.rotation += this.spinSpeed * dt;
        
        switch (this.state) {
            case PelletState.SPAWNING:
                this.scale = Math.min(1, this.scale + dt * 2);
                if (this.scale >= 1) {
                    this.state = PelletState.ACTIVE;
                }
                break;
                
            case PelletState.DESPAWNING:
                this.scale = Math.max(0, this.scale - dt * 2);
                if (this.scale <= 0) {
                    this.state = PelletState.EATEN;
                }
                break;
                
            case PelletState.EATEN:
                this.spawnTimer += dt * 1000;
                if (this.spawnTimer >= this.respawnTime) {
                    this.respawn();
                }
                break;
        }
        
        this.updateAABB();
    }

    /**
     * Zjada pellet
     */
    eat(): void {
        if (this.state !== PelletState.ACTIVE) return;
        
        this.state = PelletState.EATEN;
        this.scale = 0;
        this.spawnTimer = 0;
    }

    /**
     * Respawn pelletu
     */
    respawn(): void {
        this.state = PelletState.SPAWNING;
        this.scale = 0;
        this.spawnTimer = 0;
        
        // Losowa nowa pozycja w okolicy
        const offset = new Vector2(
            (Math.random() - 0.5) * 100,
            (Math.random() - 0.5) * 100
        );
        this.position.add(offset);
    }

    /**
     * Aktywuje pellet
     */
    activate(): void {
        this.state = PelletState.SPAWNING;
        this.scale = 0;
    }

    /**
     * Dezaktywuje pellet
     */
    deactivate(): void {
        this.state = PelletState.DESPAWNING;
    }

    /**
     * Czy pellet jest aktywny (może być zjedzony)
     */
    isActive(): boolean {
        return this.state === PelletState.ACTIVE;
    }

    /**
     * Serializacja
     */
    toJSON(): any {
        return {
            ...super.toJSON(),
            radius: this.radius,
            state: this.state,
            value: this.value,
            respawnTime: this.respawnTime,
            scale: this.scale
        };
    }

    /**
     * Deserializacja
     */
    fromJSON(json: any): void {
        super.fromJSON(json);
        this.radius = json.radius;
        this.state = json.state;
        this.value = json.value;
        this.respawnTime = json.respawnTime;
        this.scale = json.scale;
    }
}