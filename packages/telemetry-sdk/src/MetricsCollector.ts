/**
 * @file MetricsCollector.ts
 * @description Kolektor metryk - zbieranie i agregacja danych telemetrycznych
 */

import { Logger, LogCategory } from '@shared-core/utils/Logger';
import { EventEmitter } from '@shared-core/events/EventEmitter';

/**
 * Typ metryki
 */
export enum MetricType {
    COUNTER = 'counter',       // Licznik (np. liczba zdarzeń)
    GAUGE = 'gauge',           // Wskaźnik (np. aktualna liczba graczy)
    HISTOGRAM = 'histogram',   // Histogram (np. rozkład latency)
    TIMER = 'timer',           // Czas wykonania
    RATE = 'rate'              // Szybkość (np. zdarzeń na sekundę)
}

/**
 * Metryka
 */
export interface Metric {
    name: string;
    type: MetricType;
    value: number;
    tags: Record<string, string>;
    timestamp: number;
}

/**
 | Agregacja metryki
 */
export interface MetricAggregation {
    count: number;
    sum: number;
    min: number;
    max: number;
    avg: number;
    p50?: number;
    p90?: number;
    p95?: number;
    p99?: number;
    last: number;
}

/**
 | Opcje kolektora
 */
export interface MetricsCollectorOptions {
    flushInterval: number;      // Interwał wysyłki w ms
    bufferSize: number;          // Rozmiar bufora
    enableAggregation: boolean;  // Czy agregować metryki
    aggregationWindow: number;   // Okno agregacji w ms
    tags: Record<string, string>; // Globalne tagi
}

/**
 | Kolektor metryk
 */
export class MetricsCollector extends EventEmitter {
    private metrics: Metric[] = [];
    private counters: Map<string, number> = new Map();
    private gauges: Map<string, number> = new Map();
    private histograms: Map<string, number[]> = new Map();
    private timers: Map<string, number[]> = new Map();
    
    private options: MetricsCollectorOptions;
    private logger: Logger;
    private flushTimer: NodeJS.Timeout | null = null;
    private lastFlush: number = Date.now();

    constructor(options?: Partial<MetricsCollectorOptions>) {
        super();
        
        this.options = {
            flushInterval: 10000,     // 10 sekund
            bufferSize: 1000,
            enableAggregation: true,
            aggregationWindow: 60000,  // 1 minuta
            tags: {},
            ...options
        };
        
        this.logger = Logger.getInstance();
        this.startFlushTimer();
    }

    /**
     | Zwiększa licznik
     */
    increment(name: string, value: number = 1, tags: Record<string, string> = {}): void {
        const key = this.getKey(name, tags);
        const current = this.counters.get(key) || 0;
        this.counters.set(key, current + value);

        this.record({
            name,
            type: MetricType.COUNTER,
            value: current + value,
            tags: { ...this.options.tags, ...tags },
            timestamp: Date.now()
        });
    }

    /**
     | Ustawia wskaźnik
     */
    gauge(name: string, value: number, tags: Record<string, string> = {}): void {
        const key = this.getKey(name, tags);
        this.gauges.set(key, value);

        this.record({
            name,
            type: MetricType.GAUGE,
            value,
            tags: { ...this.options.tags, ...tags },
            timestamp: Date.now()
        });
    }

    /**
     | Rejestruje wartość w histogramie
     */
    histogram(name: string, value: number, tags: Record<string, string> = {}): void {
        const key = this.getKey(name, tags);
        
        if (!this.histograms.has(key)) {
            this.histograms.set(key, []);
        }
        
        this.histograms.get(key)!.push(value);

        // Ogranicz rozmiar
        const values = this.histograms.get(key)!;
        if (values.length > 1000) {
            values.shift();
        }

        this.record({
            name,
            type: MetricType.HISTOGRAM,
            value,
            tags: { ...this.options.tags, ...tags },
            timestamp: Date.now()
        });
    }

    /**
     | Mierzy czas wykonania funkcji
     */
    async timer<T>(name: string, fn: () => Promise<T>, tags: Record<string, string> = {}): Promise<T> {
        const start = performance.now();
        
        try {
            const result = await fn();
            return result;
        } finally {
            const duration = performance.now() - start;
            this.timing(name, duration, tags);
        }
    }

    /**
     | Rejestruje czas
     */
    timing(name: string, duration: number, tags: Record<string, string> = {}): void {
        const key = this.getKey(name, tags);
        
        if (!this.timers.has(key)) {
            this.timers.set(key, []);
        }
        
        this.timers.get(key)!.push(duration);

        // Ogranicz rozmiar
        const values = this.timers.get(key)!;
        if (values.length > 1000) {
            values.shift();
        }

        this.record({
            name,
            type: MetricType.TIMER,
            value: duration,
            tags: { ...this.options.tags, ...tags },
            timestamp: Date.now()
        });
    }

    /**
     | Rejestruje metrykę
     */
    private record(metric: Metric): void {
        this.metrics.push(metric);

        // Sprawdź rozmiar bufora
        if (this.metrics.length >= this.options.bufferSize) {
            this.flush();
        }

        this.emit('metric', metric);
    }

    /**
     | Wysyła metryki
     */
    flush(): void {
        if (this.metrics.length === 0) return;

        const metrics = [...this.metrics];
        this.metrics = [];

        // Agreguj jeśli włączone
        if (this.options.enableAggregation) {
            const aggregated = this.aggregateMetrics(metrics);
            this.emit('flush', { metrics: aggregated, timestamp: Date.now() });
        } else {
            this.emit('flush', { metrics, timestamp: Date.now() });
        }

        this.lastFlush = Date.now();
    }

    /**
     | Agreguje metryki
     */
    private aggregateMetrics(metrics: Metric[]): Metric[] {
        const groups: Map<string, Metric[]> = new Map();

        // Grupuj według nazwy i tagów
        for (const metric of metrics) {
            const key = this.getKey(metric.name, metric.tags);
            
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            
            groups.get(key)!.push(metric);
        }

        // Agreguj każdą grupę
        const aggregated: Metric[] = [];

        for (const [key, group] of groups) {
            const [name, tags] = this.parseKey(key);
            const values = group.map(m => m.value);
            
            const agg: MetricAggregation = {
                count: values.length,
                sum: values.reduce((a, b) => a + b, 0),
                min: Math.min(...values),
                max: Math.max(...values),
                avg: values.reduce((a, b) => a + b, 0) / values.length,
                last: values[values.length - 1]
            };

            // Oblicz percentyle dla histogramów i timerów
            if (group[0].type === MetricType.HISTOGRAM || group[0].type === MetricType.TIMER) {
                const sorted = [...values].sort((a, b) => a - b);
                agg.p50 = this.percentile(sorted, 0.5);
                agg.p90 = this.percentile(sorted, 0.9);
                agg.p95 = this.percentile(sorted, 0.95);
                agg.p99 = this.percentile(sorted, 0.99);
            }

            aggregated.push({
                name,
                type: group[0].type,
                value: agg.avg,
                tags: JSON.parse(tags),
                timestamp: Date.now()
            });
        }

        return aggregated;
    }

    /**
     | Oblicza percentyl
     */
    private percentile(sorted: number[], p: number): number {
        if (sorted.length === 0) return 0;
        
        const index = Math.floor(sorted.length * p);
        return sorted[Math.min(index, sorted.length - 1)];
    }

    /**
     | Generuje klucz dla metryki
     */
    private getKey(name: string, tags: Record<string, string>): string {
        return `${name}:${JSON.stringify(tags)}`;
    }

    /**
     | Parsuje klucz
     */
    private parseKey(key: string): [string, Record<string, string>] {
        const [name, tagsStr] = key.split(':');
        return [name, JSON.parse(tagsStr)];
    }

    /**
     | Rozpoczyna timer wysyłki
     */
    private startFlushTimer(): void {
        if (typeof setInterval !== 'undefined') {
            this.flushTimer = setInterval(() => {
                this.flush();
            }, this.options.flushInterval);
        }
    }

    /**
     | Zatrzymuje timer
     */
    stopFlushTimer(): void {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
    }

    /**
     | Pobiera bieżące wartości
     */
    getCurrentValues(): Record<string, any> {
        return {
            counters: Object.fromEntries(this.counters),
            gauges: Object.fromEntries(this.gauges),
            histogramCounts: Object.fromEntries(
                Array.from(this.histograms.entries()).map(([k, v]) => [k, v.length])
            ),
            timerCounts: Object.fromEntries(
                Array.from(this.timers.entries()).map(([k, v]) => [k, v.length])
            )
        };
    }

    /**
     | Resetuje kolektor
     */
    reset(): void {
        this.metrics = [];
        this.counters.clear();
        this.gauges.clear();
        this.histograms.clear();
        this.timers.clear();
    }

    /**
     | Zwalnia zasoby
     */
    dispose(): void {
        this.stopFlushTimer();
        this.flush();
        this.removeAllListeners();
    }
}