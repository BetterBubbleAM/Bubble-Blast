/**
 * @file PenetrationSolver.ts
 * @description Rozwiązywanie penetracji między ciałami
 */

import { Body, BodyType } from '../bodies/Body';
import { Vector2 } from '@shared-core/math/Vector2';

/**
 * Rozwiązuje penetrację między ciałami
 */
export class PenetrationSolver {
    private maxIterations: number = 10;
    private slop: number = 0.01;
    private baumgarte: number = 0.2;

    /**
     * Rozwiązuje penetrację dla pary ciał
     */
    solve(bodyA: Body, bodyB: Body, normal: Vector2, penetration: number): void {
        if (penetration <= this.slop) return;

        // Oblicz korekcję
        const correction = Math.min(penetration - this.slop, 0.2) * this.baumgarte;
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

    /**
     * Rozwiązuje penetrację dla wielu ciał (iteracyjnie)
     */
    solveAll(penetrations: Array<{ bodyA: Body; bodyB: Body; normal: Vector2; depth: number }>): void {
        for (let i = 0; i < this.maxIterations; i++) {
            let maxPenetration = 0;
            
            for (const p of penetrations) {
                this.solve(p.bodyA, p.bodyB, p.normal, p.depth);
                maxPenetration = Math.max(maxPenetration, p.depth);
            }
            
            if (maxPenetration <= this.slop) break;
        }
    }

    /**
     * Ustawia parametry
     */
    setParameters(maxIterations: number, slop: number, baumgarte: number): void {
        this.maxIterations = maxIterations;
        this.slop = slop;
        this.baumgarte = baumgarte;
    }
}