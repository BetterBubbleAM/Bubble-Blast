/**
 * @file DeltaEncoder.ts
 * @description Kodowanie różnicowe dla snapshotów
 */

import { SnapshotEntity, DeltaEntityUpdate } from '../schemas/SnapshotPackets';
import { Vector2 } from '@shared-core/math/Vector2';

/**
 * Stan dla kodowania różnicowego
 */
export interface DeltaState {
    baseSnapshot: Map<number, SnapshotEntity>;
    lastSnapshot: Map<number, SnapshotEntity>;
    sequence: number;
}

/**
 * Kodowanie różnicowe dla encji
 */
export class DeltaEncoder {
    private states: Map<string, DeltaState> = new Map(); // Dla różnych klientów

    /**
     * Tworzy nowy stan dla klienta
     */
    createState(clientId: string): DeltaState {
        const state: DeltaState = {
            baseSnapshot: new Map(),
            lastSnapshot: new Map(),
            sequence: 0
        };
        this.states.set(clientId, state);
        return state;
    }

    /**
     * Usuwa stan klienta
     */
    removeState(clientId: string): void {
        this.states.delete(clientId);
    }

    /**
     * Enkoduje snapshot jako różnicowy
     */
    encodeDelta(clientId: string, currentSnapshot: SnapshotEntity[]): {
        added: SnapshotEntity[];
        removed: EntityId[];
        updated: DeltaEntityUpdate[];
        baseSequence: number;
    } | null {
        const state = this.states.get(clientId);
        if (!state) return null;

        const baseSnapshot = state.lastSnapshot;
        
        // Jeśli to pierwszy snapshot, wyślij pełny
        if (baseSnapshot.size === 0) {
            this.updateState(state, currentSnapshot);
            return null;
        }

        const added: SnapshotEntity[] = [];
        const removed: EntityId[] = [];
        const updated: DeltaEntityUpdate[] = [];

        // Znajdź dodane i zaktualizowane
        const currentMap = new Map(currentSnapshot.map(e => [e.id, e]));
        
        for (const [id, current] of currentMap) {
            const previous = baseSnapshot.get(id);
            
            if (!previous) {
                // Nowa encja
                added.push(current);
            } else {
                // Sprawdź zmiany
                const update = this.createDeltaUpdate(previous, current);
                if (update) {
                    updated.push(update);
                }
            }
        }

        // Znajdź usunięte
        for (const [id] of baseSnapshot) {
            if (!currentMap.has(id)) {
                removed.push(id);
            }
        }

        // Aktualizuj stan
        this.updateState(state, currentSnapshot);

        return {
            added,
            removed,
            updated,
            baseSequence: state.sequence - 1
        };
    }

    /**
     * Tworzy różnicową aktualizację dla pojedynczej encji
     */
    private createDeltaUpdate(previous: SnapshotEntity, current: SnapshotEntity): DeltaEntityUpdate | null {
        let changedMask = 0;
        const update: DeltaEntityUpdate = { id: current.id, changedMask: 0 };

        // Porównaj pola
        if (!this.vectorsEqual(previous.position, current.position)) {
            changedMask |= 1;
            update.position = current.position.clone();
        }

        if (previous.radius !== current.radius) {
            changedMask |= 2;
            update.radius = current.radius;
        }

        if (previous.mass !== current.mass) {
            changedMask |= 4;
            update.mass = current.mass;
        }

        if (previous.color !== current.color) {
            changedMask |= 8;
            update.color = current.color;
        }

        if (previous.velocity && current.velocity && 
            !this.vectorsEqual(previous.velocity, current.velocity)) {
            changedMask |= 16;
            update.velocity = current.velocity.clone();
        }

        if (previous.flags !== current.flags) {
            changedMask |= 32;
            update.flags = current.flags;
        }

        if (changedMask === 0) {
            return null;
        }

        update.changedMask = changedMask;
        return update;
    }

    /**
     * Porównuje dwa wektory
     */
    private vectorsEqual(a: Vector2, b: Vector2): boolean {
        return Math.abs(a.x - b.x) < 0.001 && Math.abs(a.y - b.y) < 0.001;
    }

    /**
     * Aktualizuje stan klienta
     */
    private updateState(state: DeltaState, snapshot: SnapshotEntity[]): void {
        state.lastSnapshot.clear();
        for (const entity of snapshot) {
            state.lastSnapshot.set(entity.id, this.cloneEntity(entity));
        }
        state.sequence++;
    }

    /**
     * Klonuje encję
     */
    private cloneEntity(entity: SnapshotEntity): SnapshotEntity {
        return {
            ...entity,
            position: entity.position.clone(),
            velocity: entity.velocity?.clone()
        };
    }

    /**
     * Resetuje stan klienta do pełnego snapshota
     */
    resetToFull(clientId: string, snapshot: SnapshotEntity[]): void {
        const state = this.states.get(clientId);
        if (state) {
            state.baseSnapshot.clear();
            for (const entity of snapshot) {
                state.baseSnapshot.set(entity.id, this.cloneEntity(entity));
            }
            state.sequence = 0;
        }
    }

    /**
     * Pobiera statystyki kompresji
     */
    getStats(clientId: string): DeltaStats {
        const state = this.states.get(clientId);
        if (!state) {
            return { entities: 0, baseSequence: 0, compressionRatio: 0 };
        }

        return {
            entities: state.lastSnapshot.size,
            baseSequence: state.sequence,
            compressionRatio: this.calculateCompressionRatio(state)
        };
    }

    /**
     * Oblicza współczynnik kompresji
     */
    private calculateCompressionRatio(state: DeltaState): number {
        if (state.baseSnapshot.size === 0) return 1;
        
        // Symulacja - w rzeczywistości trzeba by porównać rozmiary
        return 0.3; // Zakładamy 70% kompresji
    }
}

/**
 * Statystyki delta encoding
 */
export interface DeltaStats {
    entities: number;
    baseSequence: number;
    compressionRatio: number;
}

/**
 * Typ dla ID encji
 */
type EntityId = number;