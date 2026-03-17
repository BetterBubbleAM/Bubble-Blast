/**
 * @file VelocitySolver.ts
 * @description Rozwiązywanie prędkości po kolizjach
 */

import { Body, BodyType } from '../bodies/Body';
import { Vector2 } from '@shared-core/math/Vector2';

/**
 * Rozwiązuje prędkości po kolizjach
 */
export class VelocitySolver {
    private iterations: number = 10;

    /**
     * Rozwiązuje prędkości dla zestawu ciał
     */
    solve(bodies: Set<Body>, dt: number): void {
        for (let i = 0; i < this.iterations; i++) {
            for (const body of bodies) {
                if (body.type !== BodyType.DYNAMIC || !body.isAwake) continue;
                
                // Tłumienie
                this.applyDamping(body, dt);
                
                // Ograniczenia prędkości
                this.clampVelocity(body);
            }
        }
    }

    /**
     * Aplikuje tłumienie
     */
    private applyDamping(body: Body, dt: number): void {
        // Tłumienie liniowe
        body.velocity.multiply(1 - 0.1 * dt);
        
        // Tłumienie kątowe
        body.angularVelocity *= 1 - 0.1 * dt;
    }

    /**
     * Ogranicza prędkość
     */
    private clampVelocity(body: Body): void {
        // Maksymalna prędkość liniowa
        if (body.maxSpeed < Infinity) {
            const speed = body.velocity.length();
            if (speed > body.maxSpeed) {
                body.velocity.multiply(body.maxSpeed / speed);
            }
        }

        // Maksymalna prędkość kątowa
        if (body.maxAngularSpeed < Infinity) {
            body.angularVelocity = Math.sign(body.angularVelocity) *
                Math.min(Math.abs(body.angularVelocity), body.maxAngularSpeed);
        }

        // Minimalna prędkość do uśpienia
        if (body.velocity.lengthSquared() < 0.01 && Math.abs(body.angularVelocity) < 0.01) {
            body.sleep();
        }
    }

    /**
     * Ustawia liczbę iteracji
     */
    setIterations(iterations: number): void {
        this.iterations = iterations;
    }
}