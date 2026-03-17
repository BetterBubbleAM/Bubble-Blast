/**
 * @file RollbackManager.ts
 * @description Zarządzanie rollbackiem - przywracanie stanu i ponowne symulacje
 */

import { RollbackBuffer, SavedState, PlayerInput } from './RollbackBuffer';
import { StateReplayer } from './StateReplayer';
import { DeterminismValidator } from './DeterminismValidator';
import { Logger, LogCategory } from '@shared-core/utils/Logger';
import { EventEmitter } from '@shared-core/events/EventEmitter';
import { EntityId, PlayerId } from '@shared-core/types/EntityTypes';

/**
 | Typ rollbacku
 */
export enum RollbackType {
    LOCAL = 'local',           // Tylko lokalny (predykcja)
    NETWORK = 'network',       // Sieciowy (synchronizacja)
    CONFIRMED = 'confirmed'    // Potwierdzony stan
}

/**
 | Zdarzenie rollbacku
 */
export interface RollbackEvent {
    type: RollbackType;
    fromFrame: number;
    toFrame: number;
    reason: string;
    affectedPlayers: PlayerId[];
    duration: number;
}

/**
 | Opcje managera
 */
export interface RollbackManagerOptions {
    maxRollbackFrames: number;      // Maksymalna liczba klatek do cofnięcia
    enablePrediction: boolean;      // Czy włączyć predykcję
    enableValidation: boolean;      // Czy walidować determinizm
    validationInterval: number;     // Co ile klatek walidować
    logRollbacks: boolean;          // Czy logować rollbacki
}

/**
 | Główny manager rollbacku
 */
export class RollbackManager {
    private buffer: RollbackBuffer;
    private replayer: StateReplayer;
    private validator: DeterminismValidator;
    private logger: Logger;
    private eventEmitter?: EventEmitter;

    private options: RollbackManagerOptions;
    private currentFrame: number = 0;
    private confirmedFrame: number = 0;
    private pendingRollbacks: RollbackEvent[] = [];
    
    private stats: RollbackStats = {
        totalRollbacks: 0,
        totalFramesRolledBack: 0,
        averageRollbackFrames: 0,
        lastRollbackFrame: 0,
        predictionHitRate: 1.0
    };

    constructor(
        buffer: RollbackBuffer,
        replayer: StateReplayer,
        validator: DeterminismValidator,
        eventEmitter?: EventEmitter,
        options?: Partial<RollbackManagerOptions>
    ) {
        this.buffer = buffer;
        this.replayer = replayer;
        this.validator = validator;
        this.eventEmitter = eventEmitter;
        this.logger = Logger.getInstance();

        this.options = {
            maxRollbackFrames: 60,
            enablePrediction: true,
            enableValidation: true,
            validationInterval: 30,
            logRollbacks: true,
            ...options
        };
    }

    /**
     | Zapisuje bieżący stan
     */
    saveState(frame: number, getState: () => SavedState): void {
        const state = getState();
        this.buffer.saveState(frame, state);
        this.currentFrame = frame;
    }

    /**
     | Zapisuje input gracza
     */
    saveInput(playerId: PlayerId, input: PlayerInput): void {
        this.buffer.saveInput(playerId, input);
    }

    /**
     | Odbiera potwierdzenie od serwera
     */
    receiveConfirmation(confirmedFrame: number, confirmedState: SavedState): void {
        if (confirmedFrame > this.confirmedFrame) {
            this.confirmedFrame = confirmedFrame;
            
            // Sprawdź czy potrzebny rollback
            if (this.options.enableValidation) {
                this.validateAgainstConfirmed(confirmedFrame, confirmedState);
            }
            
            // Wyczyść stare stany
            this.buffer.prune(confirmedFrame - this.options.maxRollbackFrames);
        }
    }

    /**
     | Wykonuje rollback
     */
    rollback(targetFrame: number, reason: string): boolean {
        const startTime = performance.now();
        
        // Sprawdź czy mamy stan docelowy
        if (!this.buffer.hasFrame(targetFrame)) {
            this.logger.warn(LogCategory.NETWORK, `Cannot rollback: frame ${targetFrame} not found`);
            return false;
        }

        // Sprawdź limit
        const framesToRollback = this.currentFrame - targetFrame;
        if (framesToRollback > this.options.maxRollbackFrames) {
            this.logger.warn(LogCategory.NETWORK, 
                `Rollback of ${framesToRollback} frames exceeds limit of ${this.options.maxRollbackFrames}`);
            return false;
        }

        // Wykonaj rollback
        const success = this.replayer.rollback(targetFrame, this.currentFrame);
        
        if (success) {
            const duration = performance.now() - startTime;
            
            // Zapisz zdarzenie
            const event: RollbackEvent = {
                type: RollbackType.NETWORK,
                fromFrame: this.currentFrame,
                toFrame: targetFrame,
                reason,
                affectedPlayers: this.getAffectedPlayers(targetFrame, this.currentFrame),
                duration
            };
            
            this.pendingRollbacks.push(event);
            this.stats.totalRollbacks++;
            this.stats.totalFramesRolledBack += framesToRollback;
            this.stats.averageRollbackFrames = 
                (this.stats.averageRollbackFrames * (this.stats.totalRollbacks - 1) + framesToRollback) 
                / this.stats.totalRollbacks;
            this.stats.lastRollbackFrame = this.currentFrame;

            if (this.options.logRollbacks) {
                this.logger.info(LogCategory.NETWORK, 
                    `Rollback: ${framesToRollback} frames, reason: ${reason}, time: ${duration.toFixed(2)}ms`);
            }

            // Emituj zdarzenie
            this.eventEmitter?.emit({
                type: 'network:rollback',
                timestamp: Date.now(),
                ...event
            } as any);
        }

        return success;
    }

    /**
     | Waliduje stan względem potwierdzonego
     */
    private validateAgainstConfirmed(confirmedFrame: number, confirmedState: SavedState): void {
        const localState = this.buffer.loadState(confirmedFrame);
        
        if (!localState) {
            this.logger.warn(LogCategory.NETWORK, `No local state for frame ${confirmedFrame} during validation`);
            return;
        }

        const isValid = this.validator.validate(localState, confirmedState);
        
        if (!isValid) {
            // Desynchronizacja - potrzebny rollback
            this.rollback(confirmedFrame, 'validation failed');
            
            this.stats.predictionHitRate *= 0.9; // Spadek trafności
        } else {
            // Synchronizacja OK
            this.stats.predictionHitRate = this.stats.predictionHitRate * 0.95 + 0.05;
        }
    }

    /**
     | Pobiera graczy dotkniętych rollbackiem
     */
    private getAffectedPlayers(fromFrame: number, toFrame: number): PlayerId[] {
        const players = new Set<PlayerId>();
        
        for (let frame = fromFrame; frame <= toFrame; frame++) {
            const state = this.buffer.loadState(frame);
            if (state) {
                for (const playerId of state.players.keys()) {
                    players.add(playerId);
                }
            }
        }
        
        return Array.from(players);
    }

    /**
     | Pobiera bieżącą klatkę
     */
    getCurrentFrame(): number {
        return this.currentFrame;
    }

    /**
     | Pobiera potwierdzoną klatkę
     */
    getConfirmedFrame(): number {
        return this.confirmedFrame;
    }

    /**
     | Pobiera zaległe rollbacki
     */
    getPendingRollbacks(): RollbackEvent[] {
        return [...this.pendingRollbacks];
    }

    /**
     | Czyści zaległe rollbacki
     */
    clearPendingRollbacks(): void {
        this.pendingRollbacks = [];
    }

    /**
     | Pobiera statystyki
     */
    getStats(): RollbackStats {
        return { ...this.stats };
    }

    /**
     | Resetuje manager
     */
    reset(): void {
        this.buffer.clear();
        this.currentFrame = 0;
        this.confirmedFrame = 0;
        this.pendingRollbacks = [];
        this.stats = {
            totalRollbacks: 0,
            totalFramesRolledBack: 0,
            averageRollbackFrames: 0,
            lastRollbackFrame: 0,
            predictionHitRate: 1.0
        };
    }
}

/**
 | Statystyki rollbacku
 */
export interface RollbackStats {
    totalRollbacks: number;
    totalFramesRolledBack: number;
    averageRollbackFrames: number;
    lastRollbackFrame: number;
    predictionHitRate: number;
}