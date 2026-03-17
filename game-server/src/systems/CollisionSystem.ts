/**
 * @file CollisionSystem.ts
 * @description System detekcji kolizji
 */

import { World } from '@physics-engine/world/World';
import { WorldState } from '../core/WorldState';
import { EventEmitter } from '@shared-core/events/EventEmitter';
import { Logger, LogCategory } from '@shared-core/utils/Logger';
import { CellBody } from '@physics-engine/bodies/CellBody';
import { VirusBody } from '@physics-engine/bodies/VirusBody';
import { PelletBody } from '@physics-engine/bodies/PelletBody';

/**
 | Wynik kolizji
 */
export interface CollisionResult {
    type: 'cell-cell' | 'cell-virus' | 'cell-pellet' | 'virus-virus';
    bodyA: any;
    bodyB: any;
    point: { x: number; y: number };
}

/**
 | System kolizji
 */
export class CollisionSystem {
    private physicsWorld: World;
    private worldState: WorldState;
    private eventEmitter: EventEmitter;
    private logger: Logger;
    
    private collisionCount: number = 0;
    private lastCollisions: Map<string, number> = new Map();

    constructor(
        physicsWorld: World,
        worldState: WorldState,
        eventEmitter: EventEmitter
    ) {
        this.physicsWorld = physicsWorld;
        this.worldState = worldState;
        this.eventEmitter = eventEmitter;
        this.logger = Logger.getInstance();
    }

    /**
     | Aktualizuje system kolizji
     */
    update(deltaTime: number): void {
        // Wykonaj krok fizyki
        this.physicsWorld.step(deltaTime);
        
        // Pobierz wszystkie kontakty
        const contacts = this.physicsWorld['contacts'] || [];
        
        this.collisionCount = contacts.length;
        
        // Przetwórz kolizje
        for (const contact of contacts) {
            this.processCollision(contact);
        }
    }

    /**
     | Przetwarza pojedynczą kolizję
     */
    private processCollision(contact: any): void {
        const bodyA = contact.bodyA;
        const bodyB = contact.bodyB;
        
        if (!bodyA || !bodyB) return;

        // Zapobiega duplikowaniu kolizji w krótkim czasie
        const collisionKey = this.getCollisionKey(bodyA.id, bodyB.id);
        const lastTime = this.lastCollisions.get(collisionKey) || 0;
        const now = Date.now();

        if (now - lastTime < 50) return; // Minimum 50ms między kolizjami
        this.lastCollisions.set(collisionKey, now);

        // Określ typ kolizji
        const type = this.determineCollisionType(bodyA, bodyB);

        // Emituj zdarzenie
        this.eventEmitter.emit({
            type: 'physics:collision',
            timestamp: Date.now(),
            bodyA: bodyA.id,
            bodyB: bodyB.id,
            point: contact.point,
            normal: contact.normal,
            impulse: contact.normal.dot(bodyA.velocity) * bodyA.mass
        });

        // Loguj w trybie debug
        if (this.logger['config'].level <= 0) {
            this.logger.debug(LogCategory.PHYSICS, 
                `Collision: ${type} between ${bodyA.id} and ${bodyB.id}`);
        }
    }

    /**
     | Określa typ kolizji
     */
    private determineCollisionType(bodyA: any, bodyB: any): string {
        const typeA = this.getBodyType(bodyA);
        const typeB = this.getBodyType(bodyB);
        
        return `${typeA}-${typeB}`;
    }

    /**
     | Pobiera typ bryły
     */
    private getBodyType(body: any): string {
        if (body instanceof CellBody) return 'cell';
        if (body instanceof VirusBody) return 'virus';
        if (body instanceof PelletBody) return 'pellet';
        return 'unknown';
    }

    /**
     | Generuje klucz dla pary kolizji
     */
    private getCollisionKey(idA: number, idB: number): string {
        return idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;
    }

    /**
     | Sprawdza czy dwa ciała kolidują
     */
    checkCollision(bodyA: any, bodyB: any): boolean {
        // Szybkie sprawdzenie AABB
        if (!this.aabbOverlap(bodyA.aabb, bodyB.aabb)) {
            return false;
        }

        // Dokładne sprawdzenie dla kół
        if (bodyA.shape === 'circle' && bodyB.shape === 'circle') {
            const dx = bodyB.position.x - bodyA.position.x;
            const dy = bodyB.position.y - bodyA.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const radiiSum = bodyA.radius + bodyB.radius;
            
            return distance < radiiSum;
        }

        return false;
    }

    /**
     | Sprawdza nakładanie AABB
     */
    private aabbOverlap(a: any, b: any): boolean {
        return !(a.maxX < b.minX || a.minX > b.maxX || 
                 a.maxY < b.minY || a.minY > b.maxY);
    }

    /**
     | Pobiera statystyki kolizji
     */
    getStats(): CollisionStats {
        return {
            currentCollisions: this.collisionCount,
            uniquePairs: this.lastCollisions.size
        };
    }

    /**
     | Resetuje system
     */
    reset(): void {
        this.collisionCount = 0;
        this.lastCollisions.clear();
    }
}

/**
 | Statystyki kolizji
 */
export interface CollisionStats {
    currentCollisions: number;
    uniquePairs: number;
}