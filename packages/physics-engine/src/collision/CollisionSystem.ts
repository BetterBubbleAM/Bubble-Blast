/**
 * @file CollisionSystem.ts
 * @description Główny system zarządzania kolizjami
 */

import { Body } from '../bodies/Body';
import { PotentialPair } from './Broadphase';
import { CollisionResult, ContactPoint } from './Narrowphase';
import { Vector2 } from '@shared-core/math/Vector2';
import { Logger, LogCategory } from '@shared-core/utils/Logger';

/**
 * Manifold kolizji - przechowuje wszystkie informacje o kolizji
 */
export interface CollisionManifold {
    bodyA: Body;
    bodyB: Body;
    contacts: ContactPoint[];
    normal: Vector2;
    penetration: number;
    restitution: number;
    friction: number;
    tangent: Vector2;
}

/**
 * System kolizji - łączy broad i narrow phase
 */
export class CollisionSystem {
    private manifolds: Map<string, CollisionManifold> = new Map();
    private contactGraph: Map<Body, Set<Body>> = new Map();
    private logger: Logger;
    
    private enableCaching: boolean = true;
    private maxManifolds: number = 1000;

    constructor(enableCaching: boolean = true) {
        this.enableCaching = enableCaching;
        this.logger = Logger.getInstance();
    }

    /**
     * Przetwarza potencjalne pary i generuje manifoldy kolizji
     */
    processPairs(pairs: PotentialPair[]): CollisionManifold[] {
        const newManifolds: CollisionManifold[] = [];

        for (const pair of pairs) {
            const manifold = this.processPair(pair.bodyA, pair.bodyB);
            if (manifold) {
                newManifolds.push(manifold);
            }
        }

        // Aktualizuj graf kolizji
        this.updateContactGraph(newManifolds);

        // Usuń stare manifoldy
        if (this.enableCaching) {
            this.pruneManifolds();
        }

        return newManifolds;
    }

    /**
     * Przetwarza pojedynczą parę
     */
    private processPair(bodyA: Body, bodyB: Body): CollisionManifold | null {
        // Sprawdź cache
        const cacheKey = this.getCacheKey(bodyA, bodyB);
        const cached = this.manifolds.get(cacheKey);
        
        if (cached && this.isManifoldValid(cached)) {
            return cached;
        }

        // Wykonaj narrow phase
        const result = this.detectCollision(bodyA, bodyB);
        
        if (!result.colliding || result.contacts.length === 0) {
            this.manifolds.delete(cacheKey);
            return null;
        }

        // Stwórz manifold
        const manifold = this.buildManifold(result);
        
        // Zapisz w cache
        if (this.enableCaching) {
            this.manifolds.set(cacheKey, manifold);
            
            // Ogranicz rozmiar cache
            if (this.manifolds.size > this.maxManifolds) {
                this.pruneOldestManifold();
            }
        }

        return manifold;
    }

    /**
     * Wykonuje detekcję kolizji
     */
    private detectCollision(bodyA: Body, bodyB: Body): CollisionResult {
        // Wywołaj odpowiednią funkcję w zależności od kształtów
        // To będzie zaimplementowane w NarrowPhase
        
        return {
            bodyA,
            bodyB,
            contacts: [],
            colliding: false
        };
    }

    /**
     * Buduje manifold z wyniku kolizji
     */
    private buildManifold(result: CollisionResult): CollisionManifold {
        const contact = result.contacts[0]; // Używamy pierwszego kontaktu
        
        // Oblicz współczynniki
        const restitution = Math.min(
            result.bodyA.material.restitution,
            result.bodyB.material.restitution
        );
        
        const friction = Math.min(
            result.bodyA.material.friction,
            result.bodyB.material.friction
        );

        // Wektor styczny
        const tangent = new Vector2(-contact.normal.y, contact.normal.x);

        return {
            bodyA: result.bodyA,
            bodyB: result.bodyB,
            contacts: result.contacts,
            normal: contact.normal.clone(),
            penetration: contact.penetration,
            restitution,
            friction,
            tangent
        };
    }

    /**
     * Aktualizuje graf kolizji
     */
    private updateContactGraph(manifolds: CollisionManifold[]): void {
        // Resetuj graf
        this.contactGraph.clear();

        for (const manifold of manifolds) {
            // Dodaj połączenie A -> B
            if (!this.contactGraph.has(manifold.bodyA)) {
                this.contactGraph.set(manifold.bodyA, new Set());
            }
            this.contactGraph.get(manifold.bodyA)!.add(manifold.bodyB);

            // Dodaj połączenie B -> A
            if (!this.contactGraph.has(manifold.bodyB)) {
                this.contactGraph.set(manifold.bodyB, new Set());
            }
            this.contactGraph.get(manifold.bodyB)!.add(manifold.bodyA);
        }
    }

    /**
     * Sprawdza czy manifold jest nadal ważny
     */
    private isManifoldValid(manifold: CollisionManifold): boolean {
        // Sprawdź czy ciała nadal istnieją
        if (!manifold.bodyA || !manifold.bodyB) return false;

        // Sprawdź czy nadal kolidują (szybki test AABB)
        const aabbOverlap = !(manifold.bodyA.aabb.maxX < manifold.bodyB.aabb.minX ||
                             manifold.bodyA.aabb.minX > manifold.bodyB.aabb.maxX ||
                             manifold.bodyA.aabb.maxY < manifold.bodyB.aabb.minY ||
                             manifold.bodyA.aabb.minY > manifold.bodyB.aabb.maxY);

        if (!aabbOverlap) return false;

        // Sprawdź orientację normalnej
        const centerDelta = manifold.bodyB.position.subtracted(manifold.bodyA.position);
        const dot = centerDelta.dot(manifold.normal);
        
        return dot > 0; // Normalna powinna wskazywać od A do B
    }

    /**
     * Usuwa najstarszy manifold
     */
    private pruneOldestManifold(): void {
        const iterator = this.manifolds.keys();
        const first = iterator.next();
        if (!first.done) {
            this.manifolds.delete(first.value);
        }
    }

    /**
     * Usuwa nieaktualne manifoldy
     */
    private pruneManifolds(): void {
        for (const [key, manifold] of this.manifolds) {
            if (!this.isManifoldValid(manifold)) {
                this.manifolds.delete(key);
            }
        }
    }

    /**
     * Generuje klucz cache dla pary ciał
     */
    private getCacheKey(bodyA: Body, bodyB: Body): string {
        return bodyA.id < bodyB.id 
            ? `${bodyA.id}:${bodyB.id}`
            : `${bodyB.id}:${bodyA.id}`;
    }

    /**
     * Sprawdza czy dwa ciała są w kontakcie
     */
    areInContact(bodyA: Body, bodyB: Body): boolean {
        const set = this.contactGraph.get(bodyA);
        return set ? set.has(bodyB) : false;
    }

    /**
     * Pobiera wszystkie ciała w kontakcie z danym ciałem
     */
    getContacts(body: Body): Body[] {
        const set = this.contactGraph.get(body);
        return set ? Array.from(set) : [];
    }

    /**
     * Czyści system
     */
    clear(): void {
        this.manifolds.clear();
        this.contactGraph.clear();
    }

    /**
     * Statystyki
     */
    getStats(): CollisionSystemStats {
        return {
            manifoldCount: this.manifolds.size,
            contactGraphSize: this.contactGraph.size,
            cacheHitRate: this.calculateCacheHitRate()
        };
    }

    private calculateCacheHitRate(): number {
        // TODO: implementacja
        return 0;
    }
}

/**
 * Statystyki systemu kolizji
 */
export interface CollisionSystemStats {
    manifoldCount: number;
    contactGraphSize: number;
    cacheHitRate: number;
}

/**
 * Kontakt - pojedynczy punkt kontaktu z dodatkowymi danymi
 */
export interface Contact extends ContactPoint {
    bodyA: Body;
    bodyB: Body;
    restitution: number;
    friction: number;
    tangent: Vector2;
}