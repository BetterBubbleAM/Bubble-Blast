/**
 * @file Narrowphase.ts
 * @description Dokładna detekcja kolizji między kształtami
 */

import { Body, ShapeType, AABB } from '../bodies/Body';
import { CellBody } from '../bodies/CellBody';
import { VirusBody } from '../bodies/VirusBody';
import { PelletBody } from '../bodies/PelletBody';
import { Vector2 } from '@shared-core/math/Vector2';
import { PotentialPair } from './Broadphase';

/**
 * Punkt kontaktu
 */
export interface ContactPoint {
    position: Vector2;
    normal: Vector2;
    penetration: number;
    id: number;
}

/**
 * Wynik detekcji kolizji
 */
export interface CollisionResult {
    bodyA: Body;
    bodyB: Body;
    contacts: ContactPoint[];
    colliding: boolean;
}

/**
 * Dokładna faza detekcji kolizji
 */
export class NarrowPhase {
    private contactIdCounter: number = 0;

    /**
     * Sprawdza kolizje dla listy potencjalnych par
     */
    checkCollisions(pairs: PotentialPair[]): CollisionResult[] {
        const results: CollisionResult[] = [];

        for (const pair of pairs) {
            const result = this.checkPair(pair.bodyA, pair.bodyB);
            if (result.colliding) {
                results.push(result);
            }
        }

        return results;
    }

    /**
     * Sprawdza kolizję między dwoma ciałami
     */
    checkPair(bodyA: Body, bodyB: Body): CollisionResult {
        // Filtruj według typu (optymalizacja)
        if (this.shouldIgnorePair(bodyA, bodyB)) {
            return { bodyA, bodyB, contacts: [], colliding: false };
        }

        // Wybierz odpowiednią funkcję kolizji
        if (bodyA.shape === ShapeType.CIRCLE && bodyB.shape === ShapeType.CIRCLE) {
            return this.circleCircle(bodyA as CellBody, bodyB as CellBody);
        }
        
        if (bodyA.shape === ShapeType.CIRCLE && bodyB.shape === ShapeType.RECTANGLE) {
            return this.circleRectangle(bodyA as CellBody, bodyB);
        }
        
        if (bodyA.shape === ShapeType.RECTANGLE && bodyB.shape === ShapeType.CIRCLE) {
            const result = this.circleRectangle(bodyB as CellBody, bodyA);
            // Odwróć normalne
            for (const contact of result.contacts) {
                contact.normal.negate();
            }
            return result;
        }

        // Domyślnie brak kolizji
        return { bodyA, bodyB, contacts: [], colliding: false };
    }

    /**
     * Sprawdza czy parę należy zignorować
     */
    private shouldIgnorePair(bodyA: Body, bodyB: Body): boolean {
        // Ignoruj jeśli oba są statyczne
        if (bodyA.type === 'static' && bodyB.type === 'static') {
            return true;
        }

        // Ignoruj jeśli oba są sensorami
        if (bodyA.isSensor && bodyB.isSensor) {
            return true;
        }

        return false;
    }

    /**
     * Kolizja koło-koło
     */
    private circleCircle(circleA: CellBody, circleB: CellBody): CollisionResult {
        const dx = circleB.position.x - circleA.position.x;
        const dy = circleB.position.y - circleA.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const radiiSum = circleA.radius + circleB.radius;

        if (distance >= radiiSum) {
            return { bodyA: circleA, bodyB: circleB, contacts: [], colliding: false };
        }

        // Oblicz punkt kontaktu
        const normal = new Vector2(dx / distance, dy / distance);
        const contactPoint = new Vector2(
            circleA.position.x + normal.x * circleA.radius,
            circleA.position.y + normal.y * circleA.radius
        );

        const penetration = radiiSum - distance;

        const contact: ContactPoint = {
            position: contactPoint,
            normal,
            penetration,
            id: this.generateContactId()
        };

        return {
            bodyA: circleA,
            bodyB: circleB,
            contacts: [contact],
            colliding: true
        };
    }

    /**
     * Kolizja koło-prostokąt
     */
    private circleRectangle(circle: CellBody, rect: Body): CollisionResult {
        // Znajdź najbliższy punkt na prostokącie
        const rectMinX = rect.aabb.minX;
        const rectMaxX = rect.aabb.maxX;
        const rectMinY = rect.aabb.minY;
        const rectMaxY = rect.aabb.maxY;

        const closestX = Math.max(rectMinX, Math.min(circle.position.x, rectMaxX));
        const closestY = Math.max(rectMinY, Math.min(circle.position.y, rectMaxY));

        const dx = circle.position.x - closestX;
        const dy = circle.position.y - closestY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance >= circle.radius) {
            return { bodyA: circle, bodyB: rect, contacts: [], colliding: false };
        }

        const penetration = circle.radius - distance;
        const normal = distance > 0 
            ? new Vector2(dx / distance, dy / distance)
            : new Vector2(1, 0); // W środku - domyślnie w prawo

        const contactPoint = new Vector2(closestX, closestY);

        const contact: ContactPoint = {
            position: contactPoint,
            normal,
            penetration,
            id: this.generateContactId()
        };

        return {
            bodyA: circle,
            bodyB: rect,
            contacts: [contact],
            colliding: true
        };
    }

    /**
     * Kolizja prostokąt-prostokąt (do implementacji jeśli potrzebne)
     */
    private rectangleRectanglergba(rectA: Body, rectB: Body): CollisionResult {
        // TODO: implementacja Separating Axis Theorem
        return { bodyA: rectA, bodyB: rectB, contacts: [], colliding: false };
    }

    /**
     * Generuje unikalne ID dla kontaktu
     */
    private generateContactId(): number {
        return this.contactIdCounter++;
    }

    /**
     * Resetuje licznik ID
     */
    resetContactIds(): void {
        this.contactIdCounter = 0;
    }
}