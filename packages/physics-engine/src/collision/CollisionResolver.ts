/**
 * @file CollisionResolver.ts
 * @description Rozwiązywanie kolizji - impulsy i korekcja pozycji
 */

import { Body, BodyType } from '../bodies/Body';
import { CollisionManifold, Contact } from './CollisionSystem';
import { Vector2 } from '@shared-core/math/Vector2';
import { clamp } from '@shared-core/math/Clamp';

/**
 * Opcje resolwera
 */
export interface ResolverOptions {
    positionCorrection: boolean;      // Czy korygować pozycje
    velocityCorrection: boolean;      // Czy korygować prędkości
    baumgarte: number;                // Współczynnik korekcji pozycji
    maxLinearCorrection: number;      // Maksymalna korekcja liniowa
    maxAngularCorrection: number;     // Maksymalna korekcja kątowa
    slop: number;                     // Tolerancja penetracji
}

/**
 * Domyślne opcje
 */
const DEFAULT_OPTIONS: ResolverOptions = {
    positionCorrection: true,
    velocityCorrection: true,
    baumgarte: 0.2,
    maxLinearCorrection: 0.2,
    maxAngularCorrection: 0.1,
    slop: 0.01
};

/**
 * Rozwiązuje kolizje za pomocą impulsów
 */
export class CollisionResolver {
    private options: ResolverOptions;

    constructor(options: Partial<ResolverOptions> = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }

    /**
     * Rozwiązuje manifold kolizji
     */
    resolve(manifold: CollisionManifold, dt: number): void {
        const { bodyA, bodyB } = manifold;

        // Sprawdź czy któreś ciało jest statyczne
        const isStaticA = bodyA.type === BodyType.STATIC;
        const isStaticB = bodyB.type === BodyType.STATIC;

        if (isStaticA && isStaticB) return;

        // Korekcja prędkości (impulsy)
        if (this.options.velocityCorrection) {
            this.applyImpulse(manifold, dt);
        }

        // Korekcja pozycji (baumgarte)
        if (this.options.positionCorrection) {
            this.correctPositions(manifold);
        }
    }

    /**
     * Zastosuj impuls dla pojedynczego kontaktu
     */
    private applyImpulse(manifold: CollisionManifold, dt: number): void {
        const { bodyA, bodyB, normal, contacts, restitution, friction } = manifold;
        const contact = contacts[0]; // Używamy pierwszego kontaktu

        // Oblicz prędkość względną w punkcie kontaktu
        const rA = contact.position.subtracted(bodyA.position);
        const rB = contact.position.subtracted(bodyB.position);

        const velA = bodyA.velocity.added(new Vector2(-bodyA.angularVelocity * rA.y, bodyA.angularVelocity * rA.x));
        const velB = bodyB.velocity.added(new Vector2(-bodyB.angularVelocity * rB.y, bodyB.angularVelocity * rB.x));
        
        const relativeVel = velB.subtracted(velA);

        // Prędkość wzdłuż normalnej
        const velAlongNormal = relativeVel.dot(normal);

        if (velAlongNormal > 0) return; // Oddalają się

        // Oblicz efektywną masę
        const invMassSum = bodyA.invMass + bodyB.invMass;
        
        const rACrossN = rA.cross(normal);
        const rBCrossN = rB.cross(normal);
        
        const invInertiaSum = rACrossN * rACrossN * bodyA.invInertia +
                             rBCrossN * rBCrossN * bodyB.invInertia;

        const effectiveMass = 1.0 / (invMassSum + invInertiaSum);

        // Oblicz impuls normalny
        let j = -(1 + restitution) * velAlongNormal * effectiveMass;

        // Zastosuj impuls normalny
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
        this.applyFriction(manifold, j, dt);
    }

    /**
     * Zastosuj tarcie
     */
    private applyFriction(manifold: CollisionManifold, normalImpulse: number, dt: number): void {
        const { bodyA, bodyB, contacts, normal, friction, tangent } = manifold;
        const contact = contacts[0];

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
        jt = clamp(jt, -maxFriction, maxFriction);

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

    /**
     * Korekcja pozycji (baumgarte)
     */
    private correctPositions(manifold: CollisionManifold): void {
        const { bodyA, bodyB, normal, contacts } = manifold;
        const contact = contacts[0];

        // Tylko jeśli penetracja przekracza tolerancję
        if (contact.penetration <= this.options.slop) return;

        // Oblicz współczynnik korekcji
        const correction = Math.max(
            contact.penetration - this.options.slop,
            0
        ) * this.options.baumgarte;

        // Ogranicz korekcję
        const limitedCorrection = Math.min(correction, this.options.maxLinearCorrection);

        // Oblicz wektor korekcji
        const correctionVec = normal.multiplied(limitedCorrection);

        // Rozdziel proporcjonalnie do mas
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
     * Rozwiązuje wiele manifoldów (iteracyjnie)
     */
    resolveAll(manifolds: CollisionManifold[], dt: number, iterations: number = 10): void {
        for (let i = 0; i < iterations; i++) {
            for (const manifold of manifolds) {
                this.resolve(manifold, dt);
            }
        }
    }

    /**
     * Aktualizuje opcje
     */
    setOptions(options: Partial<ResolverOptions>): void {
        this.options = { ...this.options, ...options };
    }

    /**
     * Resetuje resolver
     */
    reset(): void {
        // Nic do resetowania
    }
}

/**
 * Rozwiązuje kolizje dla pojedynczego ciała (wielokrotne kontakty)
 */
export class ContactResolver {
    private contacts: Map<Body, Contact[]> = new Map();

    /**
     * Dodaje kontakt
     */
    addContact(contact: Contact): void {
        if (!this.contacts.has(contact.bodyA)) {
            this.contacts.set(contact.bodyA, []);
        }
        if (!this.contacts.has(contact.bodyB)) {
            this.contacts.set(contact.bodyB, []);
        }

        this.contacts.get(contact.bodyA)!.push(contact);
        this.contacts.get(contact.bodyB)!.push(contact);
    }

    /**
     * Rozwiązuje wszystkie kontakty dla ciała
     */
    resolveBody(body: Body, dt: number): void {
        const contacts = this.contacts.get(body);
        if (!contacts) return;

        // TODO: implementacja rozwiązywania dla wielu kontaktów
    }

    /**
     * Czyści kontakty
     */
    clear(): void {
        this.contacts.clear();
    }
}