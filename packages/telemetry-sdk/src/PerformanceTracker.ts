/**
 * @file PerformanceTracker.ts
 * @description Śledzenie wydajności - FPS, pamięć, czas wykonania
 */

import { Logger, LogCategory } from '@shared-core/utils/Logger';
import { EventEmitter } from '@shared-core/events/EventEmitter';

/**
 | Pomiar wydajności
 */
export interface PerformanceMeasurement {
    name: string;
    duration: number;
    startTime: number;
    endTime: number;
    metadata: Record<string, any>;
}

/**
 | Statystyki FPS
 */
export interface FPSStats {
    current: number;
    average: number;
    min: number;
    max: number;
    frames: number;
}

/**
 | Statystyki pamięci
 */
export interface MemoryStats {
    used: number;
    total: number;
    limit: number;
    percentage: number;
}

/**
 | Statystyki CPU
 */
export interface CPUStats {
    usage: number;
    cores: number;
    loadAverage?: number[];
}

/**
 | Opcje trackera
 */
export interface PerformanceTrackerOptions {
    sampleInterval: number;      // Interwał próbkowania w ms
    fpsSampleSize: number;        // Rozmiar próbki dla FPS
    enableMemoryTracking: boolean; // Czy śledzić pamięć
    enableCPUTracking: boolean;    // Czy śledzić CPU
    warningThreshold: number;      // Próg ostrzeżenia (ms)
}

/**
 | Tracker wydajności
 */
export class PerformanceTracker extends EventEmitter {
    private options: PerformanceTrackerOptions;
    private logger: Logger;
    
    // FPS
    private frameTimes: number[] = [];
    private lastFrameTime: number = performance.now();
    private frameCount: number = 0;
    
    // Memory
    private memorySamples: number[] = [];
    
    // CPU
    private cpuSamples: number[] = [];
    
    // Markery
    private marks: Map<string, number> = new Map();
    private measures: PerformanceMeasurement[] = [];
    
    // Timery
    private sampleTimer: NodeJS.Timeout | null = null;

    constructor(options?: Partial<PerformanceTrackerOptions>) {
        super();
        
        this.options = {
            sampleInterval: 1000,    // 1 sekunda
            fpsSampleSize: 60,
            enableMemoryTracking: true,
            enableCPUTracking: true,
            warningThreshold: 100,    // 100ms
            ...options
        };
        
        this.logger = Logger.getInstance();
        this.startSampling();
    }

    /**
     | Rejestruje klatkę (wywoływane w GameLoop)
     */
    tick(): void {
        const now = performance.now();
        const delta = now - this.lastFrameTime;
        
        this.frameTimes.push(delta);
        this.frameCount++;
        
        // Ogranicz rozmiar
        if (this.frameTimes.length > this.options.fpsSampleSize) {
            this.frameTimes.shift();
        }
        
        this.lastFrameTime = now;

        // Sprawdź długie klatki
        if (delta > this.options.warningThreshold) {
            this.emit('longFrame', { duration: delta, threshold: this.options.warningThreshold });
            this.logger.warn(LogCategory.PERFORMANCE, `Long frame: ${delta.toFixed(2)}ms`);
        }
    }

    /**
     | Rozpoczyna pomiar
     */
    startMeasure(name: string, metadata: Record<string, any> = {}): void {
        this.marks.set(name, performance.now());
    }

    /**
     | Kończy pomiar
     */
    endMeasure(name: string): PerformanceMeasurement | null {
        const startTime = this.marks.get(name);
        if (!startTime) return null;

        const endTime = performance.now();
        const duration = endTime - startTime;

        const measurement: PerformanceMeasurement = {
            name,
            duration,
            startTime,
            endTime,
            metadata: {}
        };

        this.measures.push(measurement);
        this.marks.delete(name);

        // Ogranicz rozmiar
        if (this.measures.length > 100) {
            this.measures.shift();
        }

        this.emit('measure', measurement);

        return measurement;
    }

    /**
     | Mierzy wykonanie funkcji
     */
    async measureAsync<T>(
        name: string,
        fn: () => Promise<T>,
        metadata: Record<string, any> = {}
    ): Promise<T> {
        this.startMeasure(name, metadata);
        try {
            return await fn();
        } finally {
            this.endMeasure(name);
        }
    }

    /**
     | Mierzy wykonanie funkcji synchronicznej
     */
    measureSync<T>(name: string, fn: () => T, metadata: Record<string, any> = {}): T {
        this.startMeasure(name, metadata);
        try {
            return fn();
        } finally {
            this.endMeasure(name);
        }
    }

    /**
     | Pobiera statystyki FPS
     */
    getFPSStats(): FPSStats {
        if (this.frameTimes.length === 0) {
            return {
                current: 0,
                average: 0,
                min: 0,
                max: 0,
                frames: 0
            };
        }

        const fpsValues = this.frameTimes.map(t => 1000 / t);
        
        return {
            current: 1000 / this.frameTimes[this.frameTimes.length - 1],
            average: fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length,
            min: Math.min(...fpsValues),
            max: Math.max(...fpsValues),
            frames: this.frameCount
        };
    }

    /**
     | Pobiera statystyki pamięci
     */
    getMemoryStats(): MemoryStats | null {
        if (!this.options.enableMemoryTracking) return null;

        // W Node.js
        if (typeof process !== 'undefined' && process.memoryUsage) {
            const mem = process.memoryUsage();
            return {
                used: mem.heapUsed,
                total: mem.heapTotal,
                limit: mem.heapTotal,
                percentage: (mem.heapUsed / mem.heapTotal) * 100
            };
        }

        // W przeglądarce
        if (typeof performance !== 'undefined' && (performance as any).memory) {
            const mem = (performance as any).memory;
            return {
                used: mem.usedJSHeapSize,
                total: mem.totalJSHeapSize,
                limit: mem.jsHeapSizeLimit,
                percentage: (mem.usedJSHeapSize / mem.totalJSHeapSize) * 100
            };
        }

        return null;
    }

    /**
     | Pobiera statystyki CPU
     */
    getCPUStats(): CPUStats | null {
        if (!this.options.enableCPUTracking) return null;

        // W Node.js
        if (typeof process !== 'undefined') {
            const cpus = require('os').cpus();
            return {
                usage: this.calculateCPUUsage(),
                cores: cpus.length,
                loadAverage: require('os').loadavg()
            };
        }

        // W przeglądarce - ograniczone możliwości
        return {
            usage: 0,
            cores: navigator.hardwareConcurrency || 1
        };
    }

    /**
     | Oblicza użycie CPU
     */
    private calculateCPUUsage(): number {
        // TODO: rzeczywiste obliczenie użycia CPU
        return 0;
    }

    /**
     | Próbkuje dane
     */
    private sample(): void {
        // Próbkuj FPS
        this.emit('fps', this.getFPSStats());

        // Próbkuj pamięć
        if (this.options.enableMemoryTracking) {
            const memStats = this.getMemoryStats();
            if (memStats) {
                this.memorySamples.push(memStats.percentage);
                this.emit('memory', memStats);
                
                // Ogranicz rozmiar
                if (this.memorySamples.length > 100) {
                    this.memorySamples.shift();
                }
            }
        }

        // Próbkuj CPU
        if (this.options.enableCPUTracking) {
            const cpuStats = this.getCPUStats();
            if (cpuStats) {
                this.cpuSamples.push(cpuStats.usage);
                this.emit('cpu', cpuStats);
                
                if (this.cpuSamples.length > 100) {
                    this.cpuSamples.shift();
                }
            }
        }
    }

    /**
     | Rozpoczyna próbkowanie
     */
    private startSampling(): void {
        if (typeof setInterval !== 'undefined') {
            this.sampleTimer = setInterval(() => {
                this.sample();
            }, this.options.sampleInterval);
        }
    }

    /**
     | Zatrzymuje próbkowanie
     */
    stopSampling(): void {
        if (this.sampleTimer) {
            clearInterval(this.sampleTimer);
            this.sampleTimer = null;
        }
    }

    /**
     | Pobiera raport wydajności
     */
    getReport(): PerformanceReport {
        return {
            fps: this.getFPSStats(),
            memory: this.getMemoryStats(),
            cpu: this.getCPUStats(),
            measures: [...this.measures],
            timestamp: Date.now()
        };
    }

    /**
     | Resetuje tracker
     */
    reset(): void {
        this.frameTimes = [];
        this.frameCount = 0;
        this.memorySamples = [];
        this.cpuSamples = [];
        this.marks.clear();
        this.measures = [];
        this.lastFrameTime = performance.now();
    }

    /**
     | Zwalnia zasoby
     */
    dispose(): void {
        this.stopSampling();
        this.reset();
        this.removeAllListeners();
    }
}

/**
 | Raport wydajności
 */
export interface PerformanceReport {
    fps: FPSStats;
    memory: MemoryStats | null;
    cpu: CPUStats | null;
    measures: PerformanceMeasurement[];
    timestamp: number;
}