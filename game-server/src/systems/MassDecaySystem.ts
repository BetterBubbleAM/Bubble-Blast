/**
 * @file MassDecaySystem.ts
 * @description System utraty masy w czasie
 */

import { WorldState } from '../core/WorldState';
import { CellBody } from '@physics-engine/bodies/CellBody';
import { GAMEPLAY_CONSTANTS } from '@shared-core/constants/GameplayConstants';
import { Logger, LogCategory } from '@shared-core/utils/Logger';

/**
 | System utraty masy
 */
export class MassDecaySystem {
    private worldState: WorldState;
    private decayRate: number;
    private logger: Logger;
    
    private totalDecay: number = 0;
    private lastUpdate: number = Date.now();

    constructor(worldState: WorldState, decayRate: number = GAMEPLAY_CONSTANTS.DECAY_RATE) {
        this.worldState = worldState;
        this.decayRate = decayRate;
        this.logger = Logger.getInstance();
    }

    /**
     | Aktualizuje system
     */
    update(deltaTime: number): void {
        const now = Date.now();
        const timeDiff = (now - this.lastUpdate) / 1000; // w sekundach
        
        if (timeDiff < 1.0) return; // Aktualizuj maksymalnie raz na sekundę

        const entities = this.worldState.getAllEntities();
        let decayed = 0;

        for (const entity of entities) {
            if (entity.type !== 'cell') continue;
            
            const cell = entity.body as CellBody;
            
            // Tylko komórki graczy tracą masę
            if (entity.owner.type !== 'player') continue;

            const massLost = this.applyDecay(cell, timeDiff);
            if (massLost > 0) {
                decayed++;
                this.totalDecay += massLost;
            }
        }

        this.lastUpdate = now;

        if (decayed > 0 && this.logger['config'].level <= 1) {
            this.logger.debug(LogCategory.GAMEPLAY, 
                `Mass decay applied to ${decayed} cells`);
        }
    }

    /**
     | Aplikuje utratę masy do komórki
     */
    private applyDecay(cell: CellBody, timeDelta: number): number {
        // Nie trać masy poniżej minimum
        if (cell.mass <= GAMEPLAY_CONSTANTS.MIN_DECAY_MASS) {
            return 0;
        }

        // Oblicz stratę
        const decay = cell.mass * this.decayRate * timeDelta;
        const newMass = Math.max(GAMEPLAY_CONSTANTS.MIN_DECAY_MASS, cell.mass - decay);
        
        const actualLoss = cell.mass - newMass;
        
        if (actualLoss > 0) {
            cell.removeMass(actualLoss);
        }

        return actualLoss;
    }

    /**
     | Ustawia współczynnik utraty masy
     */
    setDecayRate(rate: number): void {
        this.decayRate = Math.max(0, Math.min(1, rate));
    }

    /**
     | Wymusza natychmiastową utratę masy
     */
    forceDecay(cell: CellBody, amount: number): number {
        const newMass = Math.max(GAMEPLAY_CONSTANTS.MIN_DECAY_MASS, cell.mass - amount);
        const actualLoss = cell.mass - newMass;
        
        if (actualLoss > 0) {
            cell.removeMass(actualLoss);
            this.totalDecay += actualLoss;
        }

        return actualLoss;
    }

    /**
     | Pobiera statystyki
     */
    getStats(): DecayStats {
        return {
            totalDecay: this.totalDecay,
            decayRate: this.decayRate,
            lastUpdate: this.lastUpdate
        };
    }

    /**
     | Resetuje system
     */
    reset(): void {
        this.totalDecay = 0;
        this.lastUpdate = Date.now();
    }
}

/**
 | Statystyki utraty masy
 */
export interface DecayStats {
    totalDecay: number;
    decayRate: number;
    lastUpdate: number;
}