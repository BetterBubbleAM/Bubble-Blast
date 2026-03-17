/**
 * @file MergeSystem.ts
 * @description System łączenia komórek tego samego gracza
 */

import { WorldState } from '../core/WorldState';
import { ServerConfig } from '../bootstrap/ServerConfig';
import { EventEmitter } from '@shared-core/events/EventEmitter';
import { Logger, LogCategory } from '@shared-core/utils/Logger';
import { CellBody } from '@physics-engine/bodies/CellBody';
import { Vector2 } from '@shared-core/math/Vector2';
import { GAMEPLAY_CONSTANTS } from '@shared-core/constants/GameplayConstants';

/**
 | Żądanie połączenia
 */
export interface MergeRequest {
    playerId: string;
    sourceCellId: number;
    targetCellId: number;
}

/**
 | System łączenia
 */
export class MergeSystem {
    private worldState: WorldState;
    private config: ServerConfig;
    private eventEmitter: EventEmitter;
    private logger: Logger;
    
    private cooldowns: Map<string, number> = new Map(); // playerId -> timestamp
    private mergeCount: number = 0;

    constructor(
        worldState: WorldState,
        config: ServerConfig,
        eventEmitter: EventEmitter
    ) {
        this.worldState = worldState;
        this.config = config;
        this.eventEmitter = eventEmitter;
        this.logger = Logger.getInstance();
    }

    /**
     | Aktualizuje system
     */
    update(deltaTime: number): void {
        // Automatyczne łączenie gdy komórki są blisko siebie
        this.checkAutoMerge();
        
        // Czyść stare cooldowny
        const now = Date.now();
        for (const [playerId, cooldown] of this.cooldowns) {
            if (now > cooldown) {
                this.cooldowns.delete(playerId);
            }
        }
    }

    /**
     | Przetwarza żądanie połączenia
     */
    processMerge(request: MergeRequest): boolean {
        // Sprawdź cooldown gracza
        if (!this.canMerge(request.playerId)) {
            return false;
        }

        const source = this.worldState.getEntity(request.sourceCellId);
        const target = this.worldState.getEntity(request.targetCellId);

        if (!source || !target) {
            this.logger.warn(LogCategory.GAMEPLAY, 'Merge failed: cells not found');
            return false;
        }

        if (source.type !== 'cell' || target.type !== 'cell') {
            return false;
        }

        const sourceBody = source.body as CellBody;
        const targetBody = target.body as CellBody;

        // Sprawdź czy należą do tego samego gracza
        if (source.owner.id !== target.owner.id) {
            return false;
        }

        // Sprawdź odległość
        const distance = sourceBody.position.distanceTo(targetBody.position);
        const maxDistance = (sourceBody.radius + targetBody.radius) * 
                           GAMEPLAY_CONSTANTS.MERGE_DISTANCE_FACTOR;

        if (distance > maxDistance) {
            return false;
        }

        // Wykonaj połączenie
        return this.executeMerge(source, target, sourceBody, targetBody);
    }

    /**
     | Sprawdza automatyczne łączenie
     */
    private checkAutoMerge(): void {
        const players = this.worldState['players']; // Dostęp do prywatnego pola
        
        for (const [playerId] of players) {
            if (!this.canMerge(playerId)) continue;

            const cells = this.worldState.getPlayerCells(playerId);
            
            // Szukaj par do połączenia
            for (let i = 0; i < cells.length; i++) {
                for (let j = i + 1; j < cells.length; j++) {
                    if (this.shouldAutoMerge(cells[i], cells[j])) {
                        this.processMerge({
                            playerId,
                            sourceCellId: cells[i].id,
                            targetCellId: cells[j].id
                        });
                        break;
                    }
                }
            }
        }
    }

    /**
     | Sprawdza czy komórki powinny się automatycznie połączyć
     */
    private shouldAutoMerge(cellA: any, cellB: any): boolean {
        const bodyA = cellA.body as CellBody;
        const bodyB = cellB.body as CellBody;

        // Nie łącz jeśli się dzielą
        if (bodyA.isSplitting || bodyB.isSplitting) return false;
        if (bodyA.isMerging || bodyB.isMerging) return false;

        // Sprawdź odległość
        const distance = bodyA.position.distanceTo(bodyB.position);
        const threshold = (bodyA.radius + bodyB.radius) * 1.1;

        return distance < threshold;
    }

    /**
     | Wykonuje połączenie
     */
    private executeMerge(
        sourceEntity: any,
        targetEntity: any,
        sourceBody: CellBody,
        targetBody: CellBody
    ): boolean {
        // Oblicz nową masę
        const totalMass = sourceBody.mass + targetBody.mass;
        
        // Oblicz nową pozycję (środek masy)
        const centerX = (sourceBody.position.x * sourceBody.mass + 
                        targetBody.position.x * targetBody.mass) / totalMass;
        const centerY = (sourceBody.position.y * sourceBody.mass + 
                        targetBody.position.y * targetBody.mass) / totalMass;

        // Oblicz nową prędkość (zachowanie pędu)
        const velX = (sourceBody.velocity.x * sourceBody.mass + 
                     targetBody.velocity.x * targetBody.mass) / totalMass;
        const velY = (sourceBody.velocity.y * sourceBody.mass + 
                     targetBody.velocity.y * targetBody.mass) / totalMass;

        // Zaktualizuj komórkę docelową
        targetBody.mass = totalMass;
        targetBody.radius = Math.sqrt(totalMass / Math.PI) * 2;
        targetBody.position.set(centerX, centerY);
        targetBody.velocity.set(velX, velY);
        
        // Oznacz jako łączącą się
        targetBody.isMerging = true;
        
        // Usuń źródłową komórkę
        this.worldState.removeEntity(sourceBody.id);

        // Ustaw cooldown
        this.cooldowns.set(
            sourceEntity.owner.id!,
            Date.now() + GAMEPLAY_CONSTANTS.MERGE_COOLDOWN
        );

        // Wyłącz flagę łączenia po czasie
        setTimeout(() => {
            const entity = this.worldState.getEntity(targetBody.id);
            if (entity) {
                (entity.body as CellBody).isMerging = false;
            }
        }, 1000);

        this.mergeCount++;

        // Emituj zdarzenie
        this.eventEmitter.emit({
            type: 'game:player:merged',
            timestamp: Date.now(),
            playerId: sourceEntity.owner.id,
            cells: [sourceBody.id, targetBody.id],
            resultCellId: targetBody.id,
            mass: totalMass
        });

        this.logger.info(LogCategory.GAMEPLAY, 
            `Player ${sourceEntity.owner.id} merged cells ${sourceBody.id} and ${targetBody.id}`);

        return true;
    }

    /**
     | Sprawdza czy gracz może łączyć komórki
     */
    private canMerge(playerId: string): boolean {
        const cooldown = this.cooldowns.get(playerId);
        return !cooldown || Date.now() > cooldown;
    }

    /**
     | Pobiera czas odnowienia dla gracza
     */
    getRemainingCooldown(playerId: string): number {
        const cooldown = this.cooldowns.get(playerId);
        if (!cooldown) return 0;
        
        return Math.max(0, cooldown - Date.now());
    }

    /**
     | Pobiera statystyki
     */
    getStats(): MergeStats {
        return {
            totalMerges: this.mergeCount,
            playersInCooldown: this.cooldowns.size
        };
    }

    /**
     | Resetuje system
     */
    reset(): void {
        this.cooldowns.clear();
        this.mergeCount = 0;
    }
}

/**
 | Statystyki łączenia
 */
export interface MergeStats {
    totalMerges: number;
    playersInCooldown: number;
}