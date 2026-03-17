/**
 * @file Integrator.ts
 * @description Całkowanie numeryczne ruchu ciał
 */

import { Body, BodyType } from '../bodies/Body';
import { IntegrationType } from '../world/WorldConfig';
import { Vector2 } from '@shared-core/math/Vector2';

/**
 * Całkownik - aktualizuje pozycje i prędkości
 */
export class Integrator {
    private type: IntegrationType;

    constructor(type: IntegrationType = IntegrationType.SEMI_IMPLICIT_EULER) {
        this.type = type;
    }

    /**
     * Całkuje prędkości (aplikuje siły)
     */
    integrateVelocities(bodies: Set<Body>, dt: number): void {
        for (const body of bodies) {
            if (body.type !== BodyType.DYNAMIC || !body.isAwake) continue;

            // a = F / m
            const acceleration = body.force.multiplied(body.invMass);
            
            // v += a * dt
            body.velocity.add(acceleration.multiplied(dt));
            
            // Ogranicz prędkość
            body.clampVelocity();

            // Wyczyść siły
            body.force = Vector2.zero();
            body.torque = 0;
        }
    }

    /**
     * Całkuje pozycje (aktualizuje pozycje na podstawie prędkości)
     */
    integratePositions(bodies: Set<Body>, dt: number): void {
        for (const body of bodies) {
            if (body.type !== BodyType.DYNAMIC || !body.isAwake) continue;

            // Wybierz metodę całkowania
            switch (this.type) {
                case IntegrationType.EULER:
                    this.integrateEuler(body, dt);
                    break;
                case IntegrationType.SEMI_IMPLICIT_EULER:
                    this.integrateSemiImplicitEuler(body, dt);
                    break;
                case IntegrationType.VERLET:
                    this.integrateVerlet(body, dt);
                    break;
                case IntegrationType.RK4:
                    this.integrateRK4(body, dt);
                    break;
            }

            // Aktualizuj AABB
            body.updateAABB();
        }
    }

    /**
     * Euler: x += v * dt
     */
    private integrateEuler(body: Body, dt: number): void {
        // Pozycja
        body.position.add(body.velocity.multiplied(dt));
        
        // Rotacja
        body.rotation += body.angularVelocity * dt;
    }

    /**
     * Semi-implicit Euler (symplectic): x += v * dt (po aktualizacji v)
     */
    private integrateSemiImplicitEuler(body: Body, dt: number): void {
        // Pozycja (używając nowej prędkości)
        body.position.add(body.velocity.multiplied(dt));
        
        // Rotacja
        body.rotation += body.angularVelocity * dt;
    }

    /**
     * Verlet: bardziej stabilny, wymaga pamiętania poprzedniej pozycji
     */
    private integrateVerlet(body: Body, dt: number): void {
        // Potrzebuje poprzedniej pozycji - uproszczona wersja
        const velocity = body.velocity;
        body.position.add(velocity.multiplied(dt));
        body.rotation += body.angularVelocity * dt;
    }

    /**
     * Runge-Kutta 4 - najdokładniejszy
     */
    private integrateRK4(body: Body, dt: number): void {
        const originalPos = body.position.clone();
        const originalVel = body.velocity.clone();
        const originalRot = body.rotation;
        const originalAngVel = body.angularVelocity;

        // k1
        const k1v = originalVel;
        const k1x = originalVel;
        const k1w = originalAngVel;

        // k2
        const v2 = originalVel.added(k1v.multiplied(dt * 0.5));
        const k2v = v2;
        const k2x = v2;
        const k2w = originalAngVel;

        // k3
        const v3 = originalVel.added(k2v.multiplied(dt * 0.5));
        const k3v = v3;
        const k3x = v3;
        const k3w = originalAngVel;

        // k4
        const v4 = originalVel.added(k3v.multiplied(dt));
        const k4v = v4;
        const k4x = v4;
        const k4w = originalAngVel;

        // Kombinacja
        body.position = originalPos.added(
            k1x.added(k2x.multiplied(2))
               .added(k3x.multiplied(2))
               .added(k4x)
               .multiplied(dt / 6)
        );

        body.velocity = originalVel.added(
            k1v.added(k2v.multiplied(2))
               .added(k3v.multiplied(2))
               .added(k4v)
               .multiplied(dt / 6)
        );

        body.rotation = originalRot + (originalAngVel * dt);
        body.angularVelocity = originalAngVel;
    }

    /**
     * Zmienia typ całkowania
     */
    setType(type: IntegrationType): void {
        this.type = type;
    }

    /**
     * Resetuje integrator
     */
    reset(): void {
        // Nic do resetowania
    }
}