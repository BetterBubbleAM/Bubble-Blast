/**
 * @file Solver.ts
 * @description Główny solver fizyki - rozwiązywanie constraintów i kolizji
 */

import { Body, BodyType } from '../bodies/Body';
import { CollisionManifold } from '../collision/CollisionSystem';
import { Contact } from '../collision/CollisionSystem';
import { Vector2 } from '@shared-core/math/Vector2';
import { SolverType } from '../world/WorldConfig';

/**
 * Opcje solvera
 */
export interface SolverOptions {
    type: SolverType;
    iterations: number;
    enableWarmStarting: boolean;
    enableContinuous: boolean;
    velocityThreshold: number;
    positionThreshold: number;
}

/**
 * Bazowa klasa dla solvera
 */
export abstract class Solver {
    protected options: SolverOptions;
    protected bodies: Set<Body> = new Set();
    protected contacts: CollisionManifold[] = [];

    constructor(options: SolverOptions) {
        this.options = options;
    }

    /**
     * Inicjalizuje solver
     */
    initialize(contacts: CollisionManifold[]): void {
        this.contacts = contacts;
        
        // Warm starting - przywróć impulsy z poprzedniej klatki
        if (this.options.enableWarmStarting) {
            this.warmStart();
        }
    }

    /**
     * Rozwiązuje constrainty
     */
    abstract solve(dt: number): void;

    /**
     * Warm starting - zastosuj zapisane impulsy
     */
    protected warmStart(): void {
        for (const manifold of this.contacts) {
            for (const contact of manifold.contacts) {
                // Zastosuj zapisane impulsy
                const impulse = (contact as any).totalImpulse;
                if (impulse) {
                    this.applyImpulse(manifold, impulse);
                }
            }
        }
    }

    /**
     * Zastosuj impuls do ciał
     */
    protected applyImpulse(manifold: CollisionManifold, impulse: Vector2): void {
        const { bodyA, bodyB } = manifold;
        
        if (bodyA.type === BodyType.DYNAMIC) {
            bodyA.velocity.subtract(impulse.multiplied(bodyA.invMass));
        }
        if (bodyB.type === BodyType.DYNAMIC) {
            bodyB.velocity.add(impulse.multiplied(bodyB.invMass));
        }
    }

    /**
     * Tworzy instancję solvera
     */
    static create(type: SolverType, options: SolverOptions): Solver {
        switch (type) {
            case SolverType.SEQUENTIAL_IMPULSE:
                return new SequentialImpulseSolver(options);
            case SolverType.PROJECTED_GAUSS_SEIDEL:
                return new PGSolver(options);
            case SolverType.NGS:
                return new NGSSolver(options);
            default:
                return new SequentialImpulseSolver(options);
        }
    }
}

/**
 * Sequential Impulse Solver - najpopularniejszy w grach
 */
export class SequentialImpulseSolver extends Solver {
    private velocityIterations: number = 10;
    private positionIterations: number = 5;

    solve(dt: number): void {
        // Iteracje prędkości
        for (let i = 0; i < this.options.iterations; i++) {
            this.solveVelocityConstraints(dt);
        }

        // Korekcja pozycji
        for (let i = 0; i < this.positionIterations; i++) {
            this.solvePositionConstraints();
        }
    }

    private solveVelocityConstraints(dt: number): void {
        for (const manifold of this.contacts) {
            this.solveManifoldVelocity(manifold, dt);
        }
    }

    private solveManifoldVelocity(manifold: CollisionManifold, dt: number): void {
        const { bodyA, bodyB, normal, contacts, restitution, friction } = manifold;
        
        for (const contact of contacts) {
            // Oblicz prędkość względną w punkcie kontaktu
            const rA = contact.position.subtracted(bodyA.position);
            const rB = contact.position.subtracted(bodyB.position);

            const velA = bodyA.velocity.added(new Vector2(-bodyA.angularVelocity * rA.y, bodyA.angularVelocity * rA.x));
            const velB = bodyB.velocity.added(new Vector2(-bodyB.angularVelocity * rB.y, bodyB.angularVelocity * rB.x));
            
            const relativeVel = velB.subtracted(velA);
            const velAlongNormal = relativeVel.dot(normal);

            if (velAlongNormal > 0) continue;

            // Oblicz efektywną masę
            const invMassSum = bodyA.invMass + bodyB.invMass;
            
            const rACrossN = rA.cross(normal);
            const rBCrossN = rB.cross(normal);
            
            const invInertiaSum = rACrossN * rACrossN * bodyA.invInertia +
                                 rBCrossN * rBCrossN * bodyB.invInertia;

            const effectiveMass = 1.0 / (invMassSum + invInertiaSum);

            // Oblicz impuls
            let j = -(1 + restitution) * velAlongNormal * effectiveMass;
            
            // Zapisz impuls dla warm starting
            (contact as any).totalImpulse = normal.multiplied(j);

            // Zastosuj impuls
            const impulse = normal.multiplied(j);

            if (bodyA.type === BodyType.DYNAMIC) {
                bodyA.velocity.subtract(impulse.multiplied(bodyA.invMass));
                bodyA.angularVelocity -= rA.cross(impulse) * bodyA.invInertia;
            }

            if (bodyB.type === BodyType.DYNAMIC) {
                bodyB.velocity.add(impulse.multiplied(bodyB.invMass));
                bodyB.angularVelocity += rB.cross(impulse) * bodyB.invInertia;
            }

            // Tarcie
            this.solveFriction(manifold, contact, j, dt);
        }
    }

    private solveFriction(manifold: CollisionManifold, contact: any, normalImpulse: number, dt: number): void {
        const { bodyA, bodyB, normal, friction, tangent } = manifold;
        
        const rA = contact.position.subtracted(bodyA.position);
        const rB = contact.position.subtracted(bodyB.position);

        // Prędkość styczna
        const velA = bodyA.velocity.added(new Vector2(-bodyA.angularVelocity * rA.y, bodyA.angularVelocity * rA.x));
        const velB = bodyB.velocity.added(new Vector2(-bodyB.angularVelocity * rB.y, bodyB.angularVelocity * rB.x));
        
        const relativeVel = velB.subtracted(velA);
        const velAlongTangent = relativeVel.dot(tangent);

        // Oblicz efektywną masę dla tarcia
        const invMassSum = bodyA.invMass + bodyB.invMass;
        
        const rACrossT = rA.cross(tangent);
        const rBCrossT = rB.cross(tangent);
        
        const invInertiaSum = rACrossT * rACrossT * bodyA.invInertia +
                             rBCrossT * rBCrossT * bodyB.invInertia;

        const effectiveMass = 1.0 / (invMassSum + invInertiaSum);

        // Maksymalny impuls tarcia
        const maxFriction = Math.abs(normalImpulse) * friction;
        
        // Oblicz impuls tarcia
        let jt = -velAlongTangent * effectiveMass;
        jt = Math.max(-maxFriction, Math.min(maxFriction, jt));

        const frictionImpulse = tangent.multiplied(jt);

        // Zastosuj impuls tarcia
        if (bodyA.type === BodyType.DYNAMIC) {
            bodyA.velocity.subtract(frictionImpulse.multiplied(bodyA.invMass));
            bodyA.angularVelocity -= rA.cross(frictionImpulse) * bodyA.invInertia;
        }

        if (bodyB.type === BodyType.DYNAMIC) {
            bodyB.velocity.add(frictionImpulse.multiplied(bodyB.invMass));
            bodyB.angularVelocity += rB.cross(frictionImpulse) * bodyB.invInertia;
        }
    }

    private solvePositionConstraints(): void {
        for (const manifold of this.contacts) {
            this.solveManifoldPosition(manifold);
        }
    }

    private solveManifoldPosition(manifold: CollisionManifold): void {
        const { bodyA, bodyB, normal, contacts } = manifold;
        const contact = contacts[0];

        if (contact.penetration <= 0.01) return;

        const correction = Math.min(contact.penetration, 0.2) * 0.2;
        const correctionVec = normal.multiplied(correction);

        const totalInvMass = bodyA.invMass + bodyB.invMass;
        
        if (totalInvMass > 0) {
            const ratioA = bodyA.invMass / totalInvMass;
            const ratioB = bodyB.invMass / totalInvMass;

            if (bodyA.type === BodyType.DYNAMIC) {
                bodyA.position.subtract(correctionVec.multiplied(ratioA));
            }
            if (bodyB.type === BodyType.DYNAMIC) {
                bodyB.position.add(correctionVec.multiplied(ratioB));
            }
        }
    }
}

/**
 * Projected Gauss-Seidel Solver - dla constraintów
 */
export class PGSolver extends Solver {
    private constraints: Constraint[] = [];

    solve(dt: number): void {
        for (let i = 0; i < this.options.iterations; i++) {
            for (const constraint of this.constraints) {
                constraint.solve();
            }
        }
    }

    addConstraint(constraint: Constraint): void {
        this.constraints.push(constraint);
    }
}

/**
 * NGS Solver - prosty, dla małej liczby obiektów
 */
export class NGSSolver extends Solver {
    solve(dt: number): void {
        for (const manifold of this.contacts) {
            this.solveManifoldSimple(manifold);
        }
    }

    private solveManifoldSimple(manifold: CollisionManifold): void {
        const { bodyA, bodyB, normal, penetration } = manifold;

        // Proste odepchnięcie
        if (penetration > 0) {
            const correction = normal.multiplied(penetration * 0.5);
            
            if (bodyA.type === BodyType.DYNAMIC) {
                bodyA.position.subtract(correction);
            }
            if (bodyB.type === BodyType.DYNAMIC) {
                bodyB.position.add(correction);
            }
        }
    }
}

/**
 * Bazowa klasa dla constraintu
 */
export abstract class Constraint {
    abstract solve(): void;
}