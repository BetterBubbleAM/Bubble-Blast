/**
 * @file RollbackBuffer.ts
 * @description Bufor stanów dla rollback
 */

import { Vector2 } from '@shared-core/math/Vector2';
import { EntityId, PlayerId } from '@shared-core/types/EntityTypes';

/**
 * Stan zapisany w punkcie kontrolnym
 */
export interface SavedState {
    frame: number;
    timestamp: number;
    entities: Map<EntityId, SavedEntity>;
    players: Map<PlayerId, SavedPlayer>;
    input: Map<PlayerId, PlayerInput>;
}

/**
 * Zapisana encja
 */
export interface SavedEntity {
    id: EntityId;
    position: Vector2;
    velocity: Vector2;
    radius: number;
    mass: number;
    color: string;
    flags: number;
}

/**
 | Zapisany gracz
 */
export interface SavedPlayer {
    id: PlayerId;
    cells: EntityId[];
    totalMass: number;
    score: number;
    isAlive: boolean;
}

/**
 | Input gracza
 */
export interface PlayerInput {
    playerId: PlayerId;
    frame: number;
    targetPosition: Vector2;
    isSplitting: boolean;
    isEjecting: boolean;
    isMerging: boolean;
    timestamp: number;
}

/**
 | Opcje bufora
 */
export interface RollbackBufferOptions {
    maxSize: number;           // Maksymalna liczba zapisanych klatek
    saveInterval: number;      // Co ile klatek zapisujemy
    compressionEnabled: boolean;
}

/**
 | Bufor stanów dla rollback
 */
export class RollbackBuffer {
    private states: Map<number, SavedState> = new Map();
    private inputs: Map<PlayerId, PlayerInput[]> = new Map();
    private frames: number[] = [];
    private options: RollbackBufferOptions;

    constructor(options?: Partial<RollbackBufferOptions>) {
        this.options = {
            maxSize: 300,        // 5 sekund @ 60 FPS
            saveInterval: 1,     // Każda klatka
            compressionEnabled: false,
            ...options
        };
    }

    /**
     | Zapisuje stan
     */
    saveState(frame: number, state: SavedState): void {
        // Kompresja jeśli włączona
        if (this.options.compressionEnabled) {
            state = this.compressState(state);
        }

        this.states.set(frame, state);
        this.frames.push(frame);
        
        // Utrzymuj rozmiar
        while (this.frames.length > this.options.maxSize) {
            const oldestFrame = this.frames.shift();
            if (oldestFrame !== undefined) {
                this.states.delete(oldestFrame);
            }
        }
    }

    /**
     | Ładuje stan
     */
    loadState(frame: number): SavedState | undefined {
        const state = this.states.get(frame);
        if (!state) return undefined;

        // Dekompresja jeśli potrzebna
        if (this.options.compressionEnabled) {
            return this.decompressState(state);
        }

        return state;
    }

    /**
     | Zapisuje input gracza
     */
    saveInput(playerId: PlayerId, input: PlayerInput): void {
        if (!this.inputs.has(playerId)) {
            this.inputs.set(playerId, []);
        }

        const playerInputs = this.inputs.get(playerId)!;
        playerInputs.push(input);

        // Utrzymuj rozmiar
        while (playerInputs.length > this.options.maxSize) {
            playerInputs.shift();
        }
    }

    /**
     | Ładuje inputy dla klatki
     */
    loadInputs(frame: number): Map<PlayerId, PlayerInput> {
        const result = new Map<PlayerId, PlayerInput>();

        for (const [playerId, inputs] of this.inputs) {
            const input = inputs.find(i => i.frame === frame);
            if (input) {
                result.set(playerId, input);
            }
        }

        return result;
    }

    /**
     | Pobiera zakres dostępnych klatek
     */
    getAvailableRange(): { from: number; to: number } | null {
        if (this.frames.length === 0) return null;
        
        return {
            from: this.frames[0],
            to: this.frames[this.frames.length - 1]
        };
    }

    /**
     | Sprawdza czy klatka jest dostępna
     */
    hasFrame(frame: number): boolean {
        return this.states.has(frame);
    }

    /**
     | Usuwa stare stany
     */
    prune(keepFrom: number): void {
        const newFrames: number[] = [];
        
        for (const frame of this.frames) {
            if (frame >= keepFrom) {
                newFrames.push(frame);
            } else {
                this.states.delete(frame);
            }
        }
        
        this.frames = newFrames;
    }

    /**
     | Czyści bufor
     */
    clear(): void {
        this.states.clear();
        this.inputs.clear();
        this.frames = [];
    }

    /**
     | Kompresuje stan
     */
    private compressState(state: SavedState): SavedState {
        // TODO: rzeczywista kompresja
        return state;
    }

    /**
     | Dekompresuje stan
     */
    private decompressState(state: SavedState): SavedState {
        // TODO: rzeczywista dekompresja
        return state;
    }

    /**
     | Pobiera statystyki
     */
    getStats(): RollbackBufferStats {
        let totalEntities = 0;
        for (const state of this.states.values()) {
            totalEntities += state.entities.size;
        }

        return {
            framesStored: this.frames.length,
            totalStates: this.states.size,
            totalInputs: Array.from(this.inputs.values()).reduce((a, b) => a + b.length, 0),
            averageEntitiesPerFrame: this.frames.length ? totalEntities / this.frames.length : 0,
            oldestFrame: this.frames[0] || 0,
            newestFrame: this.frames[this.frames.length - 1] || 0
        };
    }
}

/**
 | Statystyki bufora
 */
export interface RollbackBufferStats {
    framesStored: number;
    totalStates: number;
    totalInputs: number;
    averageEntitiesPerFrame: number;
    oldestFrame: number;
    newestFrame: number;
}