/**
 * @file CellBody.ts
 * @description Bryła fizyczna dla komórki (koło)
 */

import { Body, BodyType, ShapeType, Material, Materials, AABB } from './Body';
import { Vector2 } from '@shared-core/math/Vector2';
import { EntityId } from '@shared-core/types/EntityTypes';

/**
 * Bryła komórki - kształt koła
 */
export class CellBody extends Body {
    public radius: number;
    
    // Specyficzne dla komórki
    public isSplitting: boolean = false;
    public isMerging: boolean = false;
    public splitVelocity: Vector2 = Vector2.zero();
    public mergeTarget: EntityId | null = null;

    constructor(
        id: EntityId,
        position: Vector2,
        radius: number,
        material: Material = Materials.DEFAULT,
        type: BodyType = BodyType.DYNAMIC
    ) {
        super(id, type, ShapeType.CIRCLE, position, material);
        this.radius = radius;
        this.updateMass();
        this.updateAABB();
    }

    /**
     * Aktualizuje masę na podstawie promienia
     */
    protected updateMass(): void {
        const area = Math.PI * this.radius * this.radius;
        this.updateMassFromMaterial(area);
    }

    /**
     * Aktualizuje AABB
     */
    updateAABB(): void {
        this.aabb = {
            minX: this.position.x - this.radius,
            minY: this.position.y - this.radius,
            maxX: this.position.x + this.radius,
            maxY: this.position.y + this.radius
        };
    }

    /**
     * Sprawdza czy punkt znajduje się wewnątrz koła
     */
    containsPoint(point: Vector2): boolean {
        const dx = point.x - this.position.x;
        const dy = point.y - this.position.y;
        return dx * dx + dy * dy <= this.radius * this.radius;
    }

    /**
     * Oblicza odległość od punktu do koła
     */
    distanceToPoint(point: Vector2): number {
        const dx = point.x - this.position.x;
        const dy = point.y - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return Math.max(0, distance - this.radius);
    }

    /**
     * Oblicza wektor normalny w punkcie na powierzchni
     */
    getNormalAt(point: Vector2): Vector2 {
        const dx = point.x - this.position.x;
        const dy = point.y - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance === 0) {
            return new Vector2(1, 0); // Wewnątrz - zwróć dowolny kierunek
        }
        
        return new Vector2(dx / distance, dy / distance);
    }

    /**
     * Oblicza moment bezwładności dla koła
     */
    protected calculateInertia(): number {
        // Dla koła: I = (1/2) * m * r^2
        return 0.5 * this.mass * this.radius * this.radius;
    }

    /**
     * Ustawia promień i aktualizuje masę
     */
    setRadius(radius: number): void {
        this.radius = radius;
        this.updateMass();
        this.updateAABB();
    }

    /**
     * Dodaje masę (po zjedzeniu)
     */
    addMass(mass: number): void {
        if (this.type !== BodyType.DYNAMIC) return;
        
        // Masa -> promień: r = sqrt(m / (pi * density))
        const newMass = this.mass + mass;
        const area = newMass / this.material.density;
        this.radius = Math.sqrt(area / Math.PI);
        
        this.mass = newMass;
        this.invMass = 1 / newMass;
        this.inertia = this.calculateInertia();
        this.invInertia = 1 / this.inertia;
        
        this.updateAABB();
    }

    /**
     * Usuwa masę (po stracie)
     */
    removeMass(mass: number): void {
        if (this.type !== BodyType.DYNAMIC) return;
        
        const newMass = Math.max(0.1, this.mass - mass);
        const area = newMass / this.material.density;
        this.radius = Math.sqrt(area / Math.PI);
        
        this.mass = newMass;
        this.invMass = 1 / newMass;
        this.inertia = this.calculateInertia();
        this.invInertia = 1 / this.inertia;
        
        this.updateAABB();
    }

    /**
     * Dzieli komórkę na dwie
     */
    split(direction: Vector2): { body1: CellBody; body2: CellBody } {
        const newRadius = this.radius * 0.7; // ~ połowa masy (r^2 ~ połowa pola)
        const newMass = this.mass * 0.5;
        
        const offset = direction.normalized().multiplied(this.radius * 0.8);
        
        // Utwórz dwie nowe komórki
        const body1 = new CellBody(
            this.id + 1, // Tymczasowe ID
            this.position.added(offset),
            newRadius,
            this.material,
            this.type
        );
        body1.mass = newMass;
        body1.velocity = this.velocity.clone();
        body1.velocity.add(direction.multiplied(200)); // Dodaj prędkość rozdzielenia
        
        const body2 = new CellBody(
            this.id + 2,
            this.position.subtracted(offset),
            newRadius,
            this.material,
            this.type
        );
        body2.mass = newMass;
        body2.velocity = this.velocity.clone();
        body2.velocity.subtract(direction.multiplied(200));
        
        return { body1, body2 };
    }

    /**
     * Łączy się z inną komórką
     */
    merge(other: CellBody): CellBody {
        // Nowa masa to suma mas
        const newMass = this.mass + other.mass;
        const area = newMass / this.material.density;
        const newRadius = Math.sqrt(area / Math.PI);
        
        // Środek masy
        const totalMass = this.mass + other.mass;
        const centerX = (this.position.x * this.mass + other.position.x * other.mass) / totalMass;
        const centerY = (this.position.y * this.mass + other.position.y * other.mass) / totalMass;
        
        // Nowa prędkość (zachowanie pędu)
        const newVelX = (this.velocity.x * this.mass + other.velocity.x * other.mass) / totalMass;
        const newVelY = (this.velocity.y * this.mass + other.velocity.y * other.mass) / totalMass;
        
        const result = new CellBody(
            this.id,
            new Vector2(centerX, centerY),
            newRadius,
            this.material,
            this.type
        );
        result.mass = newMass;
        result.velocity = new Vector2(newVelX, newVelY);
        
        return result;
    }

    /**
     * Serializacja
     */
    toJSON(): any {
        return {
            ...super.toJSON(),
            radius: this.radius,
            isSplitting: this.isSplitting,
            isMerging: this.isMerging
        };
    }

    /**
     * Deserializacja
     */
    fromJSON(json: any): void {
        super.fromJSON(json);
        this.radius = json.radius;
        this.isSplitting = json.isSplitting;
        this.isMerging = json.isMerging;
    }
}