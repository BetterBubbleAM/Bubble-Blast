/**
 * @file SnapshotBuffer.ts
 * @description Bufor snapshotów z historią
 */

import { Snapshot, SnapshotDiff } from './Snapshot';

/**
 | Opcje bufora snapshotów
 */
export interface SnapshotBufferOptions {
    maxSize: number;           // Maksymalna liczba snapshotów w historii
    maxAge: number;            // Maksymalny wiek snapshotu (ms)
    enableCompression: boolean; // Czy kompresować starsze snapshoty
}

/**
 | Bufor snapshotów z historią
 */
export class SnapshotBuffer {
    private snapshots: Snapshot[] = [];
    private sequenceMap: Map<number, Snapshot> = new Map();
    private options: SnapshotBufferOptions;

    constructor(options?: Partial<SnapshotBufferOptions>) {
        this.options = {
            maxSize: 60,        // 60 snapshotów @ 20/s = 3 sekundy
            maxAge: 5000,       // 5 sekund
            enableCompression: true,
            ...options
        };
    }

    /**
     | Dodaje snapshot do bufora
     */
    push(snapshot: Snapshot): void {
        this.snapshots.push(snapshot);
        this.sequenceMap.set(snapshot.sequence, snapshot);

        // Usuń stare snapshoty
        this.prune();
    }

    /**
     | Pobiera snapshot po sekwencji
     */
    get(sequence: number): Snapshot | undefined {
        return this.sequenceMap.get(sequence);
    }

    /**
     | Pobiera najnowszy snapshot
     */
    getLatest(): Snapshot | undefined {
        return this.snapshots[this.snapshots.length - 1];
    }

    /**
     | Pobiera snapshot sprzed czasu
     */
    getAtTime(time: number): Snapshot | undefined {
        const targetTime = Date.now() - time;
        
        for (let i = this.snapshots.length - 1; i >= 0; i--) {
            if (this.snapshots[i].timestamp <= targetTime) {
                return this.snapshots[i];
            }
        }
        
        return this.snapshots[0];
    }

    /**
     | Pobiera snapshot przed daną sekwencją
     */
    getBeforeSequence(sequence: number): Snapshot | undefined {
        for (let i = this.snapshots.length - 1; i >= 0; i--) {
            if (this.snapshots[i].sequence < sequence) {
                return this.snapshots[i];
            }
        }
        return undefined;
    }

    /**
     | Pobiera zakres snapshotów
     */
    getRange(fromSequence: number, toSequence: number): Snapshot[] {
        return this.snapshots.filter(
            s => s.sequence >= fromSequence && s.sequence <= toSequence
        );
    }

    /**
     | Oblicza różnicę między snapshotami
     */
    getDiff(fromSequence: number, toSequence: number): SnapshotDiff | null {
        const from = this.get(fromSequence);
        const to = this.get(toSequence);

        if (!from || !to) return null;

        return to.compare(from);
    }

    /**
     | Sprawdza czy bufor zawiera sekwencję
     */
    has(sequence: number): boolean {
        return this.sequenceMap.has(sequence);
    }

    /**
     | Czyści bufor
     */
    clear(): void {
        this.snapshots = [];
        this.sequenceMap.clear();
    }

    /**
     | Usuwa stare snapshoty
     */
    private prune(): void {
        const now = Date.now();
        const maxAge = this.options.maxAge;
        const maxSize = this.options.maxSize;

        // Usuń po wieku
        while (this.snapshots.length > 0 && 
               now - this.snapshots[0].timestamp > maxAge) {
            const old = this.snapshots.shift();
            if (old) {
                this.sequenceMap.delete(old.sequence);
            }
        }

        // Usuń po rozmiarze
        while (this.snapshots.length > maxSize) {
            const old = this.snapshots.shift();
            if (old) {
                this.sequenceMap.delete(old.sequence);
            }
        }
    }

    /**
     | Kompresuje starsze snapshoty
     */
    private compress(): void {
        // TODO: implementacja kompresji starszych snapshotów
        // np. zmniejszenie dokładności pozycji
    }

    /**
     | Pobiera statystyki bufora
     */
    getStats(): SnapshotBufferStats {
        const now = Date.now();
        const ages = this.snapshots.map(s => now - s.timestamp);
        
        return {
            size: this.snapshots.length,
            oldestSequence: this.snapshots[0]?.sequence,
            newestSequence: this.snapshots[this.snapshots.length - 1]?.sequence,
            averageAge: ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : 0,
            memoryEstimate: this.estimateMemory()
        };
    }

    /**
     | Szacuje użycie pamięci
     */
    private estimateMemory(): number {
        let total = 0;
        for (const snapshot of this.snapshots) {
            // Przybliżenie: 100 bajtów na encję + overhead
            total += snapshot.entityCount * 100;
            total += snapshot.playerCount * 200;
            total += 1000; // overhead snapshotu
        }
        return total;
    }

    /**
     | Iteruje po snapshotach
     */
    *[Symbol.iterator](): Iterator<Snapshot> {
        for (const snapshot of this.snapshots) {
            yield snapshot;
        }
    }

    /**
     | Liczba snapshotów w buforze
     */
    get size(): number {
        return this.snapshots.length;
    }

    /**
     | Zakres sekwencji
     */
    get range(): { from: number; to: number } | null {
        if (this.snapshots.length === 0) return null;
        return {
            from: this.snapshots[0].sequence,
            to: this.snapshots[this.snapshots.length - 1].sequence
        };
    }
}

/**
 | Statystyki bufora snapshotów
 */
export interface SnapshotBufferStats {
    size: number;
    oldestSequence?: number;
    newestSequence?: number;
    averageAge: number;
    memoryEstimate: number;
}