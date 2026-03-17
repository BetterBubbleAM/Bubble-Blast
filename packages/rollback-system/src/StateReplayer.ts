/**
 * @file StateReplayer.ts
 * @description Odtwarzanie stanu - wykonywanie symulacji od punktu kontrolnego
 */

import { RollbackBuffer, SavedState, PlayerInput } from './RollbackBuffer';
import { Logger, LogCategory } from '@shared-core/utils/Logger';

/**
 | Funkcja symulująca krok gry
 */
export type SimulationFunction = (state: SavedState, inputs: Map<PlayerId, PlayerInput>, deltaTime: number) => SavedState;

/**
 | Odtwarzacz stanu
 */
export class StateReplayer {
    private buffer: RollbackBuffer;
    private simulate: SimulationFunction;
    private logger: Logger;
    private fixedDeltaTime: number = 1 / 60; // 60 FPS

    constructor(buffer: RollbackBuffer, simulate: SimulationFunction) {
        this.buffer = buffer;
        this.simulate = simulate;
        this.logger = Logger.getInstance();
    }

    /**
     | Wykonuje rollback i ponowną symulację
     */
    rollback(fromFrame: number, toFrame: number): boolean {
        const startTime = performance.now();

        // Załaduj stan bazowy
        const baseState = this.buffer.loadState(fromFrame);
        if (!baseState) {
            this.logger.error(LogCategory.NETWORK, `Cannot rollback: missing state for frame ${fromFrame}`);
            return false;
        }

        // Wykonaj symulację dla każdej klatki
        let currentState = baseState;
        let framesSimulated = 0;

        for (let frame = fromFrame + 1; frame <= toFrame; frame++) {
            // Pobierz inputy dla tej klatki
            const inputs = this.buffer.loadInputs(frame);
            
            // Wykonaj symulację
            currentState = this.simulate(currentState, inputs, this.fixedDeltaTime);
            
            // Zapisz nowy stan
            this.buffer.saveState(frame, currentState);
            framesSimulated++;
        }

        const duration = performance.now() - startTime;
        this.logger.debug(LogCategory.NETWORK, 
            `Rollback simulation: ${framesSimulated} frames in ${duration.toFixed(2)}ms`);

        return true;
    }

    /**
     | Odtwarza sekwencję klatek
     */
    replay(fromFrame: number, toFrame: number, onFrame?: (frame: number, state: SavedState) => void): SavedState | null {
        const baseState = this.buffer.loadState(fromFrame);
        if (!baseState) return null;

        let currentState = baseState;

        for (let frame = fromFrame + 1; frame <= toFrame; frame++) {
            const inputs = this.buffer.loadInputs(frame);
            currentState = this.simulate(currentState, inputs, this.fixedDeltaTime);
            
            if (onFrame) {
                onFrame(frame, currentState);
            }
        }

        return currentState;
    }

    /**
     | Wykonuje predykcję (tylko do przodu)
     */
    predict(fromFrame: number, frames: number): SavedState | null {
        const baseState = this.buffer.loadState(fromFrame);
        if (!baseState) return null;

        let currentState = baseState;
        const endFrame = fromFrame + frames;

        for (let frame = fromFrame + 1; frame <= endFrame; frame++) {
            // Dla predykcji używamy ostatnich znanych inputów
            const inputs = this.buffer.loadInputs(frame);
            currentState = this.simulate(currentState, inputs, this.fixedDeltaTime);
        }

        return currentState;
    }

    /**
     | Sprawdza spójność sekwencji
     */
    verifySequence(fromFrame: number, toFrame: number, expectedState: SavedState): boolean {
        const computedState = this.replay(fromFrame, toFrame);
        
        if (!computedState) return false;

        // Porównaj stany
        return this.compareStates(computedState, expectedState);
    }

    /**
     | Porównuje dwa stany
     */
    private compareStates(a: SavedState, b: SavedState): boolean {
        // Porównaj liczbę encji
        if (a.entities.size !== b.entities.size) return false;

        // Porównaj każdą encję
        for (const [id, entityA] of a.entities) {
            const entityB = b.entities.get(id);
            if (!entityB) return false;

            if (!this.compareEntities(entityA, entityB)) return false;
        }

        return true;
    }

    /**
     | Porównuje dwie encje
     */
    private compareEntities(a: any, b: any): boolean {
        const tolerance = 0.001;

        if (Math.abs(a.position.x - b.position.x) > tolerance) return false;
        if (Math.abs(a.position.y - b.position.y) > tolerance) return false;
        if (Math.abs(a.radius - b.radius) > tolerance) return false;
        if (Math.abs(a.mass - b.mass) > tolerance) return false;
        
        return true;
    }

    /**
     | Ustawia stały krok czasowy
     */
    setFixedDeltaTime(deltaTime: number): void {
        this.fixedDeltaTime = deltaTime;
    }

    /**
     | Pobiera statystyki odtwarzacza
     */
    getStats(): ReplayerStats {
        return {
            fixedDeltaTime: this.fixedDeltaTime,
            maxReplayFrames: this.buffer['frames'].length
        };
    }
}

/**
 | Statystyki odtwarzacza
 */
export interface ReplayerStats {
    fixedDeltaTime: number;
    maxReplayFrames: number;
}