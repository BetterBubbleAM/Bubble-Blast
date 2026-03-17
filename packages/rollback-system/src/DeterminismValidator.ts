/**
 * @file DeterminismValidator.ts
 * @description Walidacja determinizmu - czy stany są identyczne
 */

import { SavedState, SavedEntity } from './RollbackBuffer';
import { Logger, LogCategory } from '@shared-core/utils/Logger';
import { Vector2 } from '@shared-core/math/Vector2';
import { createHash } from 'crypto';

/**
 | Wynik walidacji
 */
export interface ValidationResult {
    isValid: boolean;
    discrepancies: Discrepancy[];
    hash: string;
    timestamp: number;
}

/**
 | Rozbieżność między stanami
 */
export interface Discrepancy {
    type: 'entity' | 'player' | 'world';
    id: string | number;
    field: string;
    expected: any;
    actual: any;
    diff: number;
}

/**
 | Opcje walidatora
 */
export interface ValidatorOptions {
    tolerance: number;           // Tolerancja dla liczb zmiennoprzecinkowych
    checkOrder: boolean;         // Czy sprawdzać kolejność encji
    useHashing: boolean;         // Czy używać hashowania do szybkiej walidacji
    logDiscrepancies: boolean;   // Czy logować rozbieżności
}

/**
 | Walidator determinizmu
 */
export class DeterminismValidator {
    private options: ValidatorOptions;
    private logger: Logger;
    private hashCache: Map<number, string> = new Map();

    constructor(options?: Partial<ValidatorOptions>) {
        this.options = {
            tolerance: 0.001,
            checkOrder: false,
            useHashing: true,
            logDiscrepancies: true,
            ...options
        };
        this.logger = Logger.getInstance();
    }

    /**
     | Waliduje dwa stany
     */
    validate(stateA: SavedState, stateB: SavedState): boolean {
        const result = this.validateDetailed(stateA, stateB);
        return result.isValid;
    }

    /**
     | Waliduje szczegółowo
     */
    validateDetailed(stateA: SavedState, stateB: SavedState): ValidationResult {
        const discrepancies: Discrepancy[] = [];

        // Szybkie porównanie przez hash
        if (this.options.useHashing) {
            const hashA = this.computeHash(stateA);
            const hashB = this.computeHash(stateB);
            
            if (hashA === hashB) {
                return {
                    isValid: true,
                    discrepancies: [],
                    hash: hashA,
                    timestamp: Date.now()
                };
            }
        }

        // Porównaj liczbę encji
        if (stateA.entities.size !== stateB.entities.size) {
            discrepancies.push({
                type: 'world',
                id: 'entityCount',
                field: 'size',
                expected: stateA.entities.size,
                actual: stateB.entities.size,
                diff: Math.abs(stateA.entities.size - stateB.entities.size)
            });
        }

        // Porównaj każdą encję
        const allIds = new Set([
            ...stateA.entities.keys(),
            ...stateB.entities.keys()
        ]);

        for (const id of allIds) {
            const entityA = stateA.entities.get(id);
            const entityB = stateB.entities.get(id);

            if (!entityA || !entityB) {
                discrepancies.push({
                    type: 'entity',
                    id,
                    field: 'existence',
                    expected: !!entityA,
                    actual: !!entityB,
                    diff: 1
                });
                continue;
            }

            this.compareEntities(entityA, entityB, id, discrepancies);
        }

        // Porównaj graczy
        this.comparePlayers(stateA, stateB, discrepancies);

        const isValid = discrepancies.length === 0;

        if (!isValid && this.options.logDiscrepancies) {
            this.logDiscrepancies(discrepancies);
        }

        return {
            isValid,
            discrepancies,
            hash: this.computeHash(stateA),
            timestamp: Date.now()
        };
    }

    /**
     | Porównuje dwie encje
     */
    private compareEntities(
        entityA: SavedEntity,
        entityB: SavedEntity,
        id: EntityId,
        discrepancies: Discrepancy[]
    ): void {
        // Pozycja
        this.compareFloat('position.x', entityA.position.x, entityB.position.x, id, discrepancies);
        this.compareFloat('position.y', entityA.position.y, entityB.position.y, id, discrepancies);

        // Prędkość
        this.compareFloat('velocity.x', entityA.velocity.x, entityB.velocity.x, id, discrepancies);
        this.compareFloat('velocity.y', entityA.velocity.y, entityB.velocity.y, id, discrepancies);

        // Skalary
        this.compareFloat('radius', entityA.radius, entityB.radius, id, discrepancies);
        this.compareFloat('mass', entityA.mass, entityB.mass, id, discrepancies);
        this.compareValue('color', entityA.color, entityB.color, id, discrepancies);
        this.compareValue('flags', entityA.flags, entityB.flags, id, discrepancies);
    }

    /**
     | Porównuje graczy
     */
    private comparePlayers(stateA: SavedState, stateB: SavedState, discrepancies: Discrepancy[]): void {
        const allPlayers = new Set([
            ...stateA.players.keys(),
            ...stateB.players.keys()
        ]);

        for (const id of allPlayers) {
            const playerA = stateA.players.get(id);
            const playerB = stateB.players.get(id);

            if (!playerA || !playerB) {
                discrepancies.push({
                    type: 'player',
                    id,
                    field: 'existence',
                    expected: !!playerA,
                    actual: !!playerB,
                    diff: 1
                });
                continue;
            }

            // Porównaj pola
            this.compareFloat('totalMass', playerA.totalMass, playerB.totalMass, id, discrepancies);
            this.compareFloat('score', playerA.score, playerB.score, id, discrepancies);
            this.compareValue('isAlive', playerA.isAlive, playerB.isAlive, id, discrepancies);

            // Porównaj komórki
            if (this.options.checkOrder) {
                for (let i = 0; i < Math.max(playerA.cells.length, playerB.cells.length); i++) {
                    if (playerA.cells[i] !== playerB.cells[i]) {
                        discrepancies.push({
                            type: 'player',
                            id,
                            field: `cells[${i}]`,
                            expected: playerA.cells[i],
                            actual: playerB.cells[i],
                            diff: 1
                        });
                    }
                }
            } else {
                // Porównaj jako sety
                const setA = new Set(playerA.cells);
                const setB = new Set(playerB.cells);
                
                for (const cellId of setA) {
                    if (!setB.has(cellId)) {
                        discrepancies.push({
                            type: 'player',
                            id,
                            field: 'cells',
                            expected: cellId,
                            actual: undefined,
                            diff: 1
                        });
                    }
                }
            }
        }
    }

    /**
     | Porównuje wartość zmiennoprzecinkową
     */
    private compareFloat(
        field: string,
        a: number,
        b: number,
        id: any,
        discrepancies: Discrepancy[]
    ): void {
        const diff = Math.abs(a - b);
        if (diff > this.options.tolerance) {
            discrepancies.push({
                type: 'entity',
                id,
                field,
                expected: a,
                actual: b,
                diff
            });
        }
    }

    /**
     | Porównuje wartość prostą
     */
    private compareValue(
        field: string,
        a: any,
        b: any,
        id: any,
        discrepancies: Discrepancy[]
    ): void {
        if (a !== b) {
            discrepancies.push({
                type: 'entity',
                id,
                field,
                expected: a,
                actual: b,
                diff: 1
            });
        }
    }

    /**
     | Oblicza hash stanu
     */
    private computeHash(state: SavedState): string {
        // Użyj cache jeśli dostępny
        const cached = this.hashCache.get(state.frame);
        if (cached) return cached;

        // Stwórz string reprezentację
        const strings: string[] = [];

        // Dodaj encje
        const entities = Array.from(state.entities.entries())
            .sort(([a], [b]) => a - b);
        
        for (const [id, entity] of entities) {
            strings.push(`${id}:${entity.position.x.toFixed(3)},${entity.position.y.toFixed(3)}`);
            strings.push(`${entity.velocity.x.toFixed(3)},${entity.velocity.y.toFixed(3)}`);
            strings.push(`${entity.radius.toFixed(3)}:${entity.mass.toFixed(3)}`);
            strings.push(`${entity.color}:${entity.flags}`);
        }

        // Dodaj graczy
        const players = Array.from(state.players.entries())
            .sort(([a], [b]) => a.localeCompare(b));

        for (const [id, player] of players) {
            strings.push(`${id}:${player.totalMass.toFixed(3)}:${player.score}`);
            strings.push(player.cells.sort().join(','));
        }

        // Oblicz hash
        const hash = createHash('sha256')
            .update(strings.join('|'))
            .digest('hex');

        // Zapisz w cache
        this.hashCache.set(state.frame, hash);

        // Ogranicz rozmiar cache
        if (this.hashCache.size > 1000) {
            const oldest = Math.min(...this.hashCache.keys());
            this.hashCache.delete(oldest);
        }

        return hash;
    }

    /**
     | Loguje rozbieżności
     */
    private logDiscrepancies(discrepancies: Discrepancy[]): void {
        this.logger.warn(LogCategory.NETWORK, `Found ${discrepancies.length} discrepancies:`);
        
        for (const d of discrepancies.slice(0, 10)) { // Limit 10
            this.logger.warn(LogCategory.NETWORK, 
                `  ${d.type}[${d.id}].${d.field}: expected ${d.expected}, got ${d.actual} (diff: ${d.diff})`);
        }
    }

    /**
     | Resetuje cache hash-y
     */
    resetCache(): void {
        this.hashCache.clear();
    }

    /**
     | Ustawia tolerancję
     */
    setTolerance(tolerance: number): void {
        this.options.tolerance = tolerance;
    }
}