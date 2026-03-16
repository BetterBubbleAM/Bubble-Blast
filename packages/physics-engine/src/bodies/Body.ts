import { Vector2 } from '@shared/math/Vector2';
import { EntityType } from '@shared/constants/NetworkOpcodes';
import { MassDecaySystem } from '../simulation/MassDecaySystem';
import { Integrator } from '../simulation/Integrator';
import { WorldBounds } from '../world/WorldBounds';

export class Body {
    public id: number;
    public type: EntityType;
    public position: Vector2;
    public velocity: Vector2;
    public mass: number;
    public radius: number;
    public isDirty: boolean = true; // Flaga informująca, czy dane się zmieniły (optymalizacja sieci)

    constructor(id: number, type: EntityType, x: number, y: number, mass: number) {
        this.id = id;
        this.type = type;
        this.position = new Vector2(x, y);
        this.velocity = new Vector2(0, 0);
        this.mass = mass;
        this.radius = MassDecaySystem.calculateRadius(mass);
    }

    /**
     * Główna pętla fizyki dla pojedynczego ciała.
     */
    public update(deltaTime: number, worldSize: number): void {
        // 1. Zastosuj ruch i tarcie
        Integrator.update(this.position, this.velocity, deltaTime);

        // 2. Pilnuj granic świata
        WorldBounds.enforce(this.position, this.radius, worldSize);

        // 3. Jeśli to gracz, aplikuj spadek masy (decay)
        if (this.type === EntityType.PLAYER) {
            this.updateMass(MassDecaySystem.calculateDecay(this.mass, deltaTime));
        }
    }
    /**
     * Aktualizuje masę i automatycznie przelicza promień.
     */
    public updateMass(newMass: number): void {
        if (this.mass !== newMass) {
            this.mass = newMass;
            this.radius = MassDecaySystem.calculateRadius(this.mass);
            this.isDirty = true;
        }
    }

    /**
     * Nadaje impuls (np. przy wystrzale masy lub podziale).
     */
    public applyImpulse(force: Vector2): void {
        this.velocity.add(force);
        this.isDirty = true;
    }

    /**
     * Sprawdza dystans do innego ciała (używane w CollisionSystem).
     */
    public getDistanceTo(other: Body): number {
        return this.position.dist(other.position);
    }
}