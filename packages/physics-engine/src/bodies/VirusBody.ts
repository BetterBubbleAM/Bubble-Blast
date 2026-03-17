/**
 * @file VirusBody.ts
 * @description Bryła fizyczna dla wirusa
 */

import { Body, BodyType, ShapeType, Material, Materials, AABB } from './Body';
import { Vector2 } from '@shared-core/math/Vector2';
import { EntityId } from '@shared-core/types/EntityTypes';
import { GAMEPLAY_CONSTANTS } from '@shared-core/constants/GameplayConstants';

/**
 * Stan wirusa
 */
export enum VirusState {
    IDLE = 'idle',           // Spokojny
    GROWING = 'growing',      // Rośnie
    POPPING = 'popping',      // Eksploduje
    POISONED = 'poisoned'     // Zatruty
}

/**
 * Bryła wirusa
 */
export class VirusBody extends Body {
    public radius: number;
    public state: VirusState = VirusState.IDLE;
    public splitCount: number = 0;
    public maxSplits: number = 3;
    public poisonTimer: number = 0;
    public growthTimer: number = 0;
    
    // Dla efektów wizualnych
    public pulsePhase: number = 0;
    public pulseSpeed: number = 2;

    constructor(
        id: EntityId,
        position: Vector2,
        radius: number = GAMEPLAY_CONSTANTS.VIRUS_BASE_RADIUS,
        material: Material = { ...Materials.DEFAULT, restitution: 0.1 }
    ) {
        super(id, BodyType.STATIC, ShapeType.CIRCLE, position, material);
        this.radius = radius;
        this.mass = GAMEPLAY_CONSTANTS.VIRUS_BASE_MASS;
        this.invMass = 0; // Wirusy są statyczne
        this.updateAABB();
    }

    /**
     * Aktualizuje masę (wirusy mają stałą masę)
     */
    protected updateMass(): void {
        // Wirusy są statyczne - masa nieskończona
        this.mass = Infinity;
        this.invMass = 0;
        this.inertia = Infinity;
        this.invInertia = 0;
    }

    /**
     * Aktualizuje AABB
     */
    updateAABB(): void {
        const pulseOffset = this.state === VirusState.GROWING ? Math.sin(this.pulsePhase) * 2 : 0;
        const currentRadius = this.radius + pulseOffset;
        
        this.aabb = {
            minX: this.position.x - currentRadius,
            minY: this.position.y - currentRadius,
            maxX: this.position.x + currentRadius,
            maxY: this.position.y + currentRadius
        };
    }

    /**
     * Sprawdza czy punkt znajduje się wewnątrz wirusa
     */
    containsPoint(point: Vector2): boolean {
        const dx = point.x - this.position.x;
        const dy = point.y - this.position.y;
        return dx * dx + dy * dy <= this.radius * this.radius;
    }

    /**
     * Oblicza odległość od punktu
     */
    distanceToPoint(point: Vector2): number {
        const dx = point.x - this.position.x;
        const dy = point.y - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return Math.max(0, distance - this.radius);
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
     * Aktualizuje stan wirusa
     */
    update(dt: number): void {
        // Aktualizuj pulsację
        this.pulsePhase += this.pulseSpeed * dt;
        
        switch (this.state) {
            case VirusState.GROWING:
                this.growthTimer -= dt;
                if (this.growthTimer <= 0) {
                    this.state = VirusState.IDLE;
                }
                break;
                
            case VirusState.POISONED:
                this.poisonTimer -= dt;
                if (this.poisonTimer <= 0) {
                    this.state = VirusState.IDLE;
                }
                break;
        }
        
        this.updateAABB();
    }

    /**
     * Rozpoczyna wzrost
     */
    startGrowing(duration: number = 1): void {
        this.state = VirusState.GROWING;
        this.growthTimer = duration;
    }

    /**
     * Zatruwa wirusa
     */
    poison(duration: number = 3): void {
        this.state = VirusState.POISONED;
        this.poisonTimer = duration;
    }

    /**
     * Eksploduje wirusa na mniejsze
     */
    pop(): VirusBody[] {
        this.state = VirusState.POPPING;
        
        if (this.splitCount >= this.maxSplits) {
            return []; // Nie może się już dzielić
        }
        
        const newRadius = this.radius * 0.6;
        const count = 3 + this.splitCount; // 3,4,5...
        const result: VirusBody[] = [];
        
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const offset = new Vector2(
                Math.cos(angle) * this.radius * 1.2,
                Math.sin(angle) * this.radius * 1.2
            );
            
            const virus = new VirusBody(
                this.id + i + 1, // Tymczasowe ID
                this.position.added(offset),
                newRadius,
                this.material
            );
            virus.splitCount = this.splitCount + 1;
            virus.maxSplits = this.maxSplits;
            virus.state = VirusState.GROWING;
            virus.growthTimer = 0.5;
            
            result.push(virus);
        }
        
        return result;
    }

    /**
     * Czy wirus może być zjedzony
     */
    canBeEaten(attackerMass: number): boolean {
        // Wirus może być zjedzony tylko jeśli atakujący ma odpowiednią masę
        // i wirus nie jest w stanie spoczynku
        return attackerMass > this.mass * 1.2 && this.state !== VirusState.POPPING;
    }

    /**
     * Serializacja
     */
    toJSON(): any {
        return {
            ...super.toJSON(),
            radius: this.radius,
            state: this.state,
            splitCount: this.splitCount,
            maxSplits: this.maxSplits,
            poisonTimer: this.poisonTimer
        };
    }

    /**
     * Deserializacja
     */
    fromJSON(json: any): void {
        super.fromJSON(json);
        this.radius = json.radius;
        this.state = json.state;
        this.splitCount = json.splitCount;
        this.maxSplits = json.maxSplits;
        this.poisonTimer = json.poisonTimer;
    }
}