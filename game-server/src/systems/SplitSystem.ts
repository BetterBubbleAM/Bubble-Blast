/**
 * @file SplitSystem.ts
 * @description System dzielenia komórek
 */

import { WorldState } from '../core/WorldState';
import { ServerConfig } from '../bootstrap/ServerConfig';
import { EventEmitter } from '@shared-core/events/EventEmitter';
import { Logger, LogCategory } from '@shared-core/utils/Logger';
import { CellBody } from '@physics-engine/bodies/CellBody';
import { Vector2 } from '@shared-core/math/Vector2';
import { GAMEPLAY_CONSTANTS } from '@shared-core/constants/GameplayConstants';

/**
 | Żądanie podziału
 */
export interface SplitRequest {
    playerId: string;
    cellId: number;
    direction: Vector2;
    timestamp: number;
}

/**
 | System dzielenia
 */
export class SplitSystem {
    private worldState: WorldState;
    private config: ServerConfig;
    private eventEmitter: EventEmitter;
    private logger: Logger;
    
    private cooldowns: Map<number, number> = new Map(); // cellId -> timestamp
    private splitCount: number = 0;

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
        // Czyść stare cooldowny
        const now = Date.now();
        for (const [cellId, cooldown] of this.cooldowns) {
            if (now > cooldown) {
                this.cooldowns.delete(cellId);
            }
        }
    }

    /**
     | Przetwarza żądanie podziału
     */
    processSplit(request: SplitRequest): boolean {
        const cell = this.worldState.getEntity(request.cellId);
        
        if (!cell || cell.type !== 'cell') {
            this.logger.warn(LogCategory.GAMEPLAY, 
                `Split failed: cell ${request.cellId} not found`);
            return false;
        }

        const cellBody = cell.body as CellBody;

        // Sprawdź cooldown
        if (!this.canSplit(cellBody)) {
            return false;
        }

        // Sprawdź minimalną masę
        if (cellBody.mass < GAMEPLAY_CONSTANTS.VIRUS_BASE_MASS) {
            return false;
        }

        // Sprawdź maksymalną liczbę komórek
        const playerCells = this.worldState.getPlayerCells(request.playerId);
        if (playerCells.length >= GAMEPLAY_CONSTANTS.MAX_CELLS_PER_PLAYER) {
            return false;
        }

        // Wykonaj podział
        return this.executeSplit(cell, cellBody, request);
    }

    /**
     | Sprawdza czy komórka może się podzielić
     */
    private canSplit(cell: CellBody): boolean {
        const cooldown = this.cooldowns.get(cell.id);
        if (cooldown && Date.now() < cooldown) {
            return false;
        }

        if (cell.isSplitting || cell.isMerging) {
            return false;
        }

        return true;
    }

    /**
     | Wykonuje podział
     */
    private executeSplit(
        cellEntity: any,
        cellBody: CellBody,
        request: SplitRequest
    ): boolean {
        // Normalizuj kierunek
        const direction = request.direction.normalized();
        
        // Oblicz nową masę (połowa)
        const newMass = cellBody.mass * GAMEPLAY_CONSTANTS.SPLIT_MASS_FACTOR;
        
        // Utwórz nową komórkę
        const offset = direction.multiplied(cellBody.radius * 1.5);
        const newPosition = cellBody.position.added(offset);
        
        const newCell = this.worldState.createPlayerCell(
            request.playerId,
            newPosition,
            Math.sqrt(newMass / Math.PI) * 2,
            newMass,
            cellEntity.metadata.get('color') || '#FFFFFF'
        );

        // Zmniejsz oryginalną komórkę
        cellBody.removeMass(newMass);
        
        // Dodaj prędkość rozdzielenia
        const splitSpeed = GAMEPLAY_CONSTANTS.SPLIT_VELOCITY_MULTIPLIER * 
                          GAMEPLAY_CONSTANTS.BASE_SPEED;
        
        cellBody.velocity.add(direction.multiplied(-splitSpeed));
        (newCell.body as CellBody).velocity.add(direction.multiplied(splitSpeed));

        // Ustaw cooldown
        this.cooldowns.set(
            cellBody.id,
            Date.now() + GAMEPLAY_CONSTANTS.SPLIT_COOLDOWN
        );
        
        this.cooldowns.set(
            newCell.id,
            Date.now() + GAMEPLAY_CONSTANTS.SPLIT_COOLDOWN
        );

        // Oznacz jako dzielące się (na krótki czas)
        cellBody.isSplitting = true;
        (newCell.body as CellBody).isSplitting = true;
        
        setTimeout(() => {
            cellBody.isSplitting = false;
            const nc = this.worldState.getEntity(newCell.id);
            if (nc) {
                (nc.body as CellBody).isSplitting = false;
            }
        }, 100);

        this.splitCount++;

        // Emituj zdarzenie
        this.eventEmitter.emit({
            type: 'game:player:split',
            timestamp: Date.now(),
            playerId: request.playerId,
            sourceCellId: cellBody.id,
            newCellId: newCell.id,
            direction,
            mass: newMass
        });

        this.logger.info(LogCategory.GAMEPLAY, 
            `Player ${request.playerId} split cell ${cellBody.id} -> ${newCell.id}`);

        return true;
    }

    /**
     | Sprawdza czy gracz może się podzielić
     */
    canPlayerSplit(playerId: string): boolean {
        const cells = this.worldState.getPlayerCells(playerId);
        
        if (cells.length >= GAMEPLAY_CONSTANTS.MAX_CELLS_PER_PLAYER) {
            return false;
        }

        // Sprawdź czy jakakolwiek komórka może się podzielić
        for (const cell of cells) {
            const cellBody = cell.body as CellBody;
            if (cellBody.mass >= GAMEPLAY_CONSTANTS.VIRUS_BASE_MASS) {
                return true;
            }
        }

        return false;
    }

    /**
     | Pobiera czas odnowienia dla komórki
     */
    getRemainingCooldown(cellId: number): number {
        const cooldown = this.cooldowns.get(cellId);
        if (!cooldown) return 0;
        
        return Math.max(0, cooldown - Date.now());
    }

    /**
     | Pobiera statystyki
     */
    getStats(): SplitStats {
        return {
            totalSplits: this.splitCount,
            activeCooldowns: this.cooldowns.size
        };
    }

    /**
     | Resetuje system
     */
    reset(): void {
        this.cooldowns.clear();
        this.splitCount = 0;
    }
}

/**
 | Statystyki dzielenia
 */
export interface SplitStats {
    totalSplits: number;
    activeCooldowns: number;
}