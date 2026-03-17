/**
 * @file MovementSystem.ts
 * @description System odpowiedzialny za ruch komórek
 */

import { WorldState } from '../core/WorldState';
import { ServerConfig } from '../bootstrap/ServerConfig';
import { Vector2 } from '@shared-core/math/Vector2';
import { CellBody } from '@physics-engine/bodies/CellBody';
import { GAMEPLAY_CONSTANTS } from '@shared-core/constants/GameplayConstants';

/**
 | Kierunek ruchu
 */
export interface MovementDirection {
    x: number;
    y: number;
}

/**
 | System ruchu
 */
export class MovementSystem {
    private worldState: WorldState;
    private config: ServerConfig;
    
    // Cache dla prędkości
    private speedCache: Map<number, number> = new Map();

    constructor(worldState: WorldState, config: ServerConfig) {
        this.worldState = worldState;
        this.config = config;
    }

    /**
     | Aktualizuje ruch wszystkich komórek
     */
    update(deltaTime: number): void {
        const entities = this.worldState.getAllEntities();
        
        for (const entity of entities) {
            if (entity.type !== 'cell') continue;
            
            const cell = entity.body as CellBody;
            if (!cell.isAwake) continue;

            this.updateCellMovement(cell, deltaTime);
        }

        // Wyczyść cache po każdej klatce
        this.speedCache.clear();
    }

    /**
     | Aktualizuje ruch pojedynczej komórki
     */
    private updateCellMovement(cell: CellBody, deltaTime: number): void {
        // Zastosuj tłumienie
        cell.applyDamping(
            GAMEPLAY_CONSTANTS.SPEED_DECAY_FACTOR,
            0.1,
            deltaTime
        );

        // Ogranicz prędkość
        cell.clampVelocity();

        // Aktualizuj pozycję (już zrobione przez fizykę)
        // Ale potrzebujemy zaktualizować AABB
        cell.updateAABB();
    }

    /**
     | Ustawia cel ruchu dla komórki
     */
    setMovementTarget(cell: CellBody, target: Vector2): void {
        const direction = target.subtracted(cell.position);
        const distance = direction.length();

        if (distance < 1) {
            cell.setVelocity(0, 0);
            return;
        }

        // Oblicz prędkość bazując na masie (mniejsze = szybsze)
        const speed = this.calculateSpeed(cell.mass);
        const normalizedDir = direction.normalized();
        
        cell.setVelocity(
            normalizedDir.x * speed,
            normalizedDir.y * speed
        );
    }

    /**
     | Oblicza prędkość komórki na podstawie masy
     */
    private calculateSpeed(mass: number): number {
        // Sprawdź cache
        if (this.speedCache.has(mass)) {
            return this.speedCache.get(mass)!;
        }

        // Wzór: v = baseSpeed / (1 + mass/100)
        const baseSpeed = GAMEPLAY_CONSTANTS.BASE_SPEED;
        const speed = baseSpeed / (1 + mass / 100);
        
        // Ogranicz do MAX_SPEED
        const clampedSpeed = Math.min(speed, GAMEPLAY_CONSTANTS.MAX_SPEED);
        
        // Zapisz w cache
        this.speedCache.set(mass, clampedSpeed);
        
        return clampedSpeed;
    }

    /**
     | Zatrzymuje komórkę
     */
    stopCell(cell: CellBody): void {
        cell.setVelocity(0, 0);
    }

    /**
     | Sprawdza czy komórka może się poruszać
     */
    canMove(cell: CellBody): boolean {
        // Komórki w trakcie dzielenia nie mogą się poruszać?
        if (cell.isSplitting) return false;
        
        // Komórki w trakcie łączenia?
        if (cell.isMerging) return false;
        
        return true;
    }

    /**
     | Oblicza siłę odpychania od innych komórek
     */
    calculateRepulsionForce(cell: CellBody, others: CellBody[]): Vector2 {
        const force = Vector2.zero();
        const minDistance = 50;

        for (const other of others) {
            if (other.id === cell.id) continue;

            const delta = cell.position.subtracted(other.position);
            const distance = delta.length();

            if (distance < minDistance && distance > 0) {
                const strength = (minDistance - distance) / minDistance;
                const direction = delta.normalized();
                force.add(direction.multiplied(strength * 10));
            }
        }

        return force;
    }

    /**
     | Przewiduje pozycję po czasie
     */
    predictPosition(cell: CellBody, time: number): Vector2 {
        return cell.position.added(
            cell.velocity.multiplied(time)
        );
    }
}