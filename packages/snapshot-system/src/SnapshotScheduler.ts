/**
 * @file SnapshotScheduler.ts
 * @description Harmonogram wysyłania snapshotów
 */

import { Snapshot } from './Snapshot';
import { SnapshotBuffer } from './SnapshotBuffer';
import { SnapshotDeltaEncoder, EncodedDelta } from './SnapshotDelta';
import { SnapshotCompressor, CompressionLevel } from './SnapshotCompressor';

/**
 | Priorytet snapshotu
 */
export enum SnapshotPriority {
    LOW = 0,
    NORMAL = 1,
    HIGH = 2,
    CRITICAL = 3
}

/**
 | Zadanie snapshotu
 */
export interface SnapshotTask {
    clientId: string;
    priority: SnapshotPriority;
    snapshot: Snapshot;
    deadline?: number;
    onComplete?: (data: Uint8Array) => void;
}

/**
 | Opcje schedulera
 */
export interface SchedulerOptions {
    maxSnapshotsPerSecond: number;   // Maksymalna liczba snapshotów na sekundę
    maxBytesPerSecond: number;       // Maksymalna liczba bajtów na sekundę
    enableDelta: boolean;            // Czy używać kompresji różnicowej
    enableCompression: boolean;      // Czy kompresować snapshoty
    compressionLevel: CompressionLevel;
    targetSnapshotRate: number;      // Docelowa liczba snapshotów/s
}

/**
 | Harmonogram snapshotów
 */
export class SnapshotScheduler {
    private options: SchedulerOptions;
    private buffer: SnapshotBuffer;
    private deltaEncoder: SnapshotDeltaEncoder;
    private compressor: SnapshotCompressor;
    
    private queue: SnapshotTask[] = [];
    private clientStates: Map<string, ClientSnapshotState> = new Map();
    
    private snapshotCount: number = 0;
    private byteCount: number = 0;
    private lastResetTime: number = Date.now();

    constructor(options?: Partial<SchedulerOptions>) {
        this.options = {
            maxSnapshotsPerSecond: 60,
            maxBytesPerSecond: 1024 * 1024, // 1 MB/s
            enableDelta: true,
            enableCompression: true,
            compressionLevel: CompressionLevel.NORMAL,
            targetSnapshotRate: 20,
            ...options
        };

        this.buffer = new SnapshotBuffer({ maxSize: 60 });
        this.deltaEncoder = new SnapshotDeltaEncoder();
        this.compressor = new SnapshotCompressor({
            level: this.options.compressionLevel
        });
    }

    /**
     | Dodaje snapshot do systemu
     */
    addSnapshot(snapshot: Snapshot): void {
        this.buffer.push(snapshot);
    }

    /**
     | Planuje wysłanie snapshotu do klienta
     */
    schedule(task: SnapshotTask): void {
        // Sprawdź limity
        if (!this.checkLimits(task)) {
            // Jeśli przekroczono limity, obniż priorytet
            task.priority = SnapshotPriority.LOW;
        }

        this.queue.push(task);
        this.sortQueue();
    }

    /**
     | Wykonuje zaplanowane zadania
     */
    execute(): SnapshotTask[] {
        this.resetCounters();
        
        const executed: SnapshotTask[] = [];
        const now = Date.now();

        while (this.queue.length > 0 && this.canExecuteMore()) {
            const task = this.queue.shift()!;
            
            // Sprawdź deadline
            if (task.deadline && task.deadline < now) {
                continue; // Pomiń przeterminowane
            }

            // Przygotuj snapshot dla klienta
            const data = this.prepareSnapshot(task.clientId, task.snapshot);
            
            if (data && task.onComplete) {
                task.onComplete(data);
                executed.push(task);
                
                this.snapshotCount++;
                this.byteCount += data.length;
            }
        }

        return executed;
    }

    /**
     | Przygotowuje snapshot dla konkretnego klienta
     */
    private prepareSnapshot(clientId: string, snapshot: Snapshot): Uint8Array | null {
        let state = this.clientStates.get(clientId);
        
        if (!state) {
            state = {
                lastSnapshot: null,
                lastSequence: 0,
                averageLatency: 0
            };
            this.clientStates.set(clientId, state);
        }

        let data: Uint8Array;

        if (this.options.enableDelta && state.lastSnapshot) {
            // Wyślij różnicowy
            const delta = this.deltaEncoder.encode(state.lastSnapshot, snapshot);
            data = this.encodeDelta(delta);
        } else {
            // Wyślij pełny snapshot
            data = this.encodeFull(snapshot);
        }

        // Aktualizuj stan klienta
        state.lastSnapshot = snapshot.clone();
        state.lastSequence = snapshot.sequence;

        return data;
    }

    /**
     | Enkoduje pełny snapshot
     */
    private encodeFull(snapshot: Snapshot): Uint8Array {
        let data = new TextEncoder().encode(JSON.stringify(snapshot.toJSON()));
        
        if (this.options.enableCompression) {
            data = this.compressor.compress(snapshot);
        }
        
        return data;
    }

    /**
     | Enkoduje różnicowy snapshot
     */
    private encodeDelta(delta: EncodedDelta): Uint8Array {
        const json = JSON.stringify(delta);
        let data = new TextEncoder().encode(json);
        
        if (this.options.enableCompression) {
            // TODO: kompresja delty
        }
        
        return data;
    }

    /**
     | Sprawdza limity przepustowości
     */
    private checkLimits(task: SnapshotTask): boolean {
        // Sprawdź limit snapshotów na sekundę
        if (this.snapshotCount >= this.options.maxSnapshotsPerSecond) {
            return false;
        }

        // Sprawdź limit bajtów na sekundę
        if (this.byteCount >= this.options.maxBytesPerSecond) {
            return false;
        }

        return true;
    }

    /**
     | Sprawdza czy można wykonać więcej zadań
     */
    private canExecuteMore(): boolean {
        return this.snapshotCount < this.options.maxSnapshotsPerSecond &&
               this.byteCount < this.options.maxBytesPerSecond;
    }

    /**
     | Resetuje liczniki
     */
    private resetCounters(): void {
        const now = Date.now();
        if (now - this.lastResetTime > 1000) {
            this.snapshotCount = 0;
            this.byteCount = 0;
            this.lastResetTime = now;
        }
    }

    /**
     | Sortuje kolejkę według priorytetu
     */
    private sortQueue(): void {
        this.queue.sort((a, b) => b.priority - a.priority);
    }

    /**
     | Aktualizuje latency klienta
     */
    updateClientLatency(clientId: string, latency: number): void {
        const state = this.clientStates.get(clientId);
        if (state) {
            // Wygładzona średnia
            state.averageLatency = state.averageLatency * 0.7 + latency * 0.3;
        }
    }

    /**
     | Usuwa stan klienta
     */
    removeClient(clientId: string): void {
        this.clientStates.delete(clientId);
    }

    /**
     | Pobiera statystyki
     */
    getStats(): SchedulerStats {
        return {
            queueLength: this.queue.length,
            clients: this.clientStates.size,
            snapshotsPerSecond: this.snapshotCount,
            bytesPerSecond: this.byteCount,
            averageLatency: this.averageLatency,
            compressionRatio: this.averageCompressionRatio
        };
    }

    /**
     | Średnie latency
     */
    private get averageLatency(): number {
        if (this.clientStates.size === 0) return 0;
        
        let sum = 0;
        for (const state of this.clientStates.values()) {
            sum += state.averageLatency;
        }
        return sum / this.clientStates.size;
    }

    /**
     | Średni współczynnik kompresji
     */
    private get averageCompressionRatio(): number {
        // TODO: obliczać rzeczywisty współczynnik
        return this.options.enableCompression ? 0.3 : 1.0;
    }

    /**
     | Resetuje scheduler
     */
    reset(): void {
        this.queue = [];
        this.clientStates.clear();
        this.snapshotCount = 0;
        this.byteCount = 0;
        this.lastResetTime = Date.now();
    }
}

/**
 | Stan klienta
 */
interface ClientSnapshotState {
    lastSnapshot: Snapshot | null;
    lastSequence: number;
    averageLatency: number;
}

/**
 | Statystyki schedulera
 */
export interface SchedulerStats {
    queueLength: number;
    clients: number;
    snapshotsPerSecond: number;
    bytesPerSecond: number;
    averageLatency: number;
    compressionRatio: number;
}