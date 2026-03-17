/**
 * @file ConstraintSolver.ts
 * @description Rozwiązywanie więzów (constraintów) fizycznych
 */

import { Body, BodyType } from '../bodies/Body';
import { Vector2 } from '@shared-core/math/Vector2';

/**
 * Bazowa klasa dla więzu
 */
export abstract class Constraint {
    public bodyA: Body;
    public bodyB: Body;
    public stiffness: number = 1.0;
    public damping: number = 0.1;

    constructor(bodyA: Body, bodyB: Body) {
        this.bodyA = bodyA;
        this.bodyB = bodyB;
    }

    abstract solve(dt: number): void;
}

/**
 * Więz odległości (np. sprężyna)
 */
export class DistanceConstraint extends Constraint {
    private targetDistance: number;
    private currentDistance: number;

    constructor(bodyA: Body, bodyB: Body, targetDistance?: number) {
        super(bodyA, bodyB);
        
        const dx = bodyB.position.x - bodyA.position.x;
        const dy = bodyB.position.y - bodyA.position.y;
        this.currentDistance = Math.sqrt(dx * dx + dy * dy);
        this.targetDistance = targetDistance ?? this.currentDistance;
    }

    solve(dt: number): void {
        const dx = this.bodyB.position.x - this.bodyA.position.x;
        const dy = this.bodyB.position.y - this.bodyA.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance === 0) return;

        const normal = new Vector2(dx / distance, dy / distance);
        const delta = distance - this.targetDistance;

        // Siła sprężystości
        const force = normal.multiplied(-this.stiffness * delta);
        
        // Tłumienie
        const velA = this.bodyA.velocity;
        const velB = this.bodyB.velocity;
        const relativeVel = velB.subtracted(velA);
        const dampingForce = relativeVel.multiplied(-this.damping);
        
        const totalForce = force.added(dampingForce);

        // Zastosuj siły
        if (this.bodyA.type === BodyType.DYNAMIC) {
            this.bodyA.force.add(totalForce);
        }
        if (this.bodyB.type === BodyType.DYNAMIC) {
            this.bodyB.force.subtract(totalForce);
        }
    }
}

/**
 * Więz sztywny (ciała połączone na sztywno)
 */
export class RigidConstraint extends Constraint {
    private localPosA: Vector2;
    private localPosB: Vector2;

    constructor(bodyA: Body, bodyB: Body, localPosA?: Vector2, localPosB?: Vector2) {
        super(bodyA, bodyB);
        
        this.localPosA = localPosA ?? new Vector2(0, 0);
        this.localPosB = localPosB ?? new Vector2(0, 0);
    }

    solve(dt: number): void {
        // Oblicz pozycje punktów w globalnych koordynatach
        const worldPosA = this.bodyA.position.added(this.localPosA);
        const worldPosB = this.bodyB.position.added(this.localPosB);

        const delta = worldPosB.subtracted(worldPosA);
        
        if (delta.lengthSquared() < 0.0001) return;

        // Sztywna korekcja
        if (this.bodyA.type === BodyType.DYNAMIC && this.bodyB.type === BodyType.DYNAMIC) {
            const correction = delta.multiplied(0.5);
            this.bodyA.position.add(correction);
            this.bodyB.position.subtract(correction);
        } else if (this.bodyA.type === BodyType.DYNAMIC) {
            this.bodyA.position.add(delta);
        } else if (this.bodyB.type === BodyType.DYNAMIC) {
            this.bodyB.position.subtract(delta);
        }
    }
}

/**
 * Więz kąta (np. obrót względem punktu)
 */
export class AngleConstraint extends Constraint {
    private targetAngle: number;

    constructor(bodyA: Body, bodyB: Body, targetAngle?: number) {
        super(bodyA, bodyB);
        this.targetAngle = targetAngle ?? (bodyB.rotation - bodyA.rotation);
    }

    solve(dt: number): void {
        let angleDiff = (this.bodyB.rotation - this.bodyA.rotation) - this.targetAngle;
        
        // Normalizuj kąt
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        // Moment siły
        const torque = -this.stiffness * angleDiff - this.damping * (this.bodyB.angularVelocity - this.bodyA.angularVelocity);

        if (this.bodyA.type === BodyType.DYNAMIC) {
            this.bodyA.torque -= torque;
        }
        if (this.bodyB.type === BodyType.DYNAMIC) {
            this.bodyB.torque += torque;
        }
    }
}

/**
 * Więz punktu (ciało przywiązane do punktu)
 */
export class PointConstraint extends Constraint {
    private targetPoint: Vector2;

    constructor(body: Body, targetPoint: Vector2) {
        super(body, body); // bodyB to to samo co bodyA
        this.targetPoint = targetPoint;
    }

    solve(dt: number): void {
        const delta = this.targetPoint.subtracted(this.bodyA.position);
        
        if (delta.lengthSquared() < 0.0001) return;

        // Siła przyciągająca do punktu
        const force = delta.multiplied(this.stiffness);
        
        // Tłumienie
        const dampingForce = this.bodyA.velocity.multiplied(-this.damping);
        
        this.bodyA.force.add(force.added(dampingForce));
    }
}

/**
 * Główny solver constraintów
 */
export class ConstraintSolver {
    private constraints: Constraint[] = [];
    private iterations: number = 10;

    addConstraint(constraint: Constraint): void {
        this.constraints.push(constraint);
    }

    removeConstraint(constraint: Constraint): void {
        const index = this.constraints.indexOf(constraint);
        if (index !== -1) {
            this.constraints.splice(index, 1);
        }
    }

    solve(dt: number): void {
        for (let i = 0; i < this.iterations; i++) {
            for (const constraint of this.constraints) {
                constraint.solve(dt);
            }
        }
    }

    clear(): void {
        this.constraints = [];
    }

    setIterations(iterations: number): void {
        this.iterations = iterations;
    }

    getConstraints(): Constraint[] {
        return [...this.constraints];
    }
}