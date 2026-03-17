/**
 * @file TelemetryClient.ts
 * @description Główny klient telemetrii - łączy kolektor i tracker
 */

import { MetricsCollector, MetricsCollectorOptions } from './MetricsCollector';
import { PerformanceTracker, PerformanceTrackerOptions } from './PerformanceTracker';
import { Logger, LogCategory } from '@shared-core/utils/Logger';
import { EventEmitter } from '@shared-core/events/EventEmitter';

/**
 | Konfiguracja telemetrii
 */
export interface TelemetryConfig {
    enabled: boolean;
    endpoint: string;
    apiKey: string;
    environment: 'development' | 'staging' | 'production';
    sampleRate: number;          // Próbkowanie (0-1)
    batchSize: number;
    flushInterval: number;
    retryAttempts: number;
}

/**
 | Zdarzenie telemetryczne
 */
export interface TelemetryEvent {
    type: string;
    timestamp: number;
    userId?: string;
    sessionId?: string;
    data: Record<string, any>;
    tags: Record<string, string>;
}

/**
 | Główny klient telemetrii
 */
export class TelemetryClient extends EventEmitter {
    private config: TelemetryConfig;
    private metrics: MetricsCollector;
    private performance: PerformanceTracker;
    private logger: Logger;
    
    private sessionId: string;
    private userId?: string;
    private eventQueue: TelemetryEvent[] = [];
    private flushTimer: NodeJS.Timeout | null = null;
    private isInitialized: boolean = false;

    constructor(config: Partial<TelemetryConfig> = {}) {
        super();
        
        this.config = {
            enabled: true,
            endpoint: '/api/telemetry',
            apiKey: '',
            environment: 'development',
            sampleRate: 1.0,
            batchSize: 100,
            flushInterval: 5000,
            retryAttempts: 3,
            ...config
        };
        
        this.logger = Logger.getInstance();
        this.sessionId = this.generateSessionId();
        
        // Inicjalizuj komponenty
        this.metrics = new MetricsCollector({
            flushInterval: this.config.flushInterval,
            bufferSize: this.config.batchSize,
            tags: {
                environment: this.config.environment,
                session: this.sessionId
            }
        });
        
        this.performance = new PerformanceTracker();
        
        this.setupListeners();
    }

    /**
     | Inicjalizuje klienta
     */
    initialize(userId?: string): void {
        this.userId = userId;
        this.isInitialized = true;
        
        // Rejestruj zdarzenie startu
        this.trackEvent('session_start', {
            sessionId: this.sessionId,
            userId,
            environment: this.config.environment,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'node'
        });

        this.startFlushTimer();
        
        this.logger.info(LogCategory.SYSTEM, 'Telemetry client initialized', {
            sessionId: this.sessionId,
            environment: this.config.environment
        });
    }

    /**
     | Śledzi zdarzenie
     */
    trackEvent(type: string, data: Record<string, any> = {}, tags: Record<string, string> = {}): void {
        if (!this.config.enabled) return;
        if (Math.random() > this.config.sampleRate) return;

        const event: TelemetryEvent = {
            type,
            timestamp: Date.now(),
            userId: this.userId,
            sessionId: this.sessionId,
            data: this.sanitizeData(data),
            tags: { ...tags, environment: this.config.environment }
        };

        this.eventQueue.push(event);
        this.emit('event', event);

        // Sprawdź rozmiar kolejki
        if (this.eventQueue.length >= this.config.batchSize) {
            this.flush();
        }
    }

    /**
     | Śledzi błąd
     */
    trackError(error: Error, context: Record<string, any> = {}): void {
        this.trackEvent('error', {
            name: error.name,
            message: error.message,
            stack: error.stack,
            ...context
        }, { severity: 'error' });
    }

    /**
     | Śledzi metrykę
     */
    trackMetric(name: string, value: number, tags: Record<string, string> = {}): void {
        this.metrics.gauge(name, value, tags);
    }

    /**
     | Zwiększa licznik
     */
    incrementMetric(name: string, value: number = 1, tags: Record<string, string> = {}): void {
        this.metrics.increment(name, value, tags);
    }

    /**
     | Mierzy czas wykonania
     */
    async measureTime<T>(name: string, fn: () => Promise<T>, tags: Record<string, string> = {}): Promise<T> {
        return this.metrics.timer(name, fn, tags);
    }

    /**
     | Rejestruje klatkę (dla FPS)
     */
    tick(): void {
        this.performance.tick();
    }

    /**
     | Rozpoczyna pomiar
     */
    startMeasure(name: string): void {
        this.performance.startMeasure(name);
    }

    /**
     | Kończy pomiar
     */
    endMeasure(name: string): void {
        const measurement = this.performance.endMeasure(name);
        if (measurement) {
            this.metrics.histogram(`measure.${name}`, measurement.duration);
        }
    }

    /**
     | Wysyła dane
     */
    async flush(): Promise<void> {
        if (!this.config.enabled) return;
        if (this.eventQueue.length === 0) return;

        const events = [...this.eventQueue];
        this.eventQueue = [];

        // Wymuś flush metryk
        this.metrics.flush();

        try {
            await this.sendToServer(events);
            this.emit('flushed', { count: events.length });
        } catch (error) {
            this.logger.error(LogCategory.SYSTEM, 'Failed to send telemetry', error);
            
            // Przywróć do kolejki (z limitem)
            this.eventQueue = [...events, ...this.eventQueue].slice(0, this.config.batchSize * 2);
            
            this.emit('flushFailed', { error, events });
        }
    }

    /**
     | Wysyła dane do serwera
     */
    private async sendToServer(events: TelemetryEvent[]): Promise<void> {
        // Symulacja wysyłki
        if (this.config.endpoint === 'console') {
            console.log('Telemetry:', events);
            return;
        }

        // Rzeczywista wysyłka
        try {
            const response = await fetch(this.config.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this.config.apiKey
                },
                body: JSON.stringify({
                    events,
                    timestamp: Date.now(),
                    sessionId: this.sessionId
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            // Ponieś błąd dla mechanizmu retry
            throw error;
        }
    }

    /**
     | Sanityzuje dane (usuwa poufne informacje)
     */
    private sanitizeData(data: Record<string, any>): Record<string, any> {
        const sensitiveKeys = ['password', 'token', 'secret', 'authorization'];
        const sanitized: Record<string, any> = {};

        for (const [key, value] of Object.entries(data)) {
            if (sensitiveKeys.includes(key.toLowerCase())) {
                sanitized[key] = '[REDACTED]';
            } else if (value && typeof value === 'object') {
                sanitized[key] = this.sanitizeData(value);
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }

    /**
     | Generuje ID sesji
     */
    private generateSessionId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     | Ustawia nasłuchiwacze
     */
    private setupListeners(): void {
        // Nasłuchuj metryk
        this.metrics.on('metric', (metric) => {
            this.emit('metric', metric);
        });

        // Nasłuchuj wydajności
        this.performance.on('longFrame', (data) => {
            this.trackEvent('performance_long_frame', data);
        });

        this.performance.on('fps', (stats) => {
            this.metrics.gauge('fps.current', stats.current);
        });

        this.performance.on('memory', (stats) => {
            this.metrics.gauge('memory.used', stats.used);
            this.metrics.gauge('memory.percentage', stats.percentage);
        });

        // Nasłuchuj błędów globalnych
        if (typeof window !== 'undefined') {
            window.addEventListener('error', (event) => {
                this.trackError(event.error, {
                    message: event.message,
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno
                });
            });

            window.addEventListener('unhandledrejection', (event) => {
                this.trackError(event.reason, {
                    type: 'unhandledrejection'
                });
            });
        }
    }

    /**
     | Rozpoczyna timer wysyłki
     */
    private startFlushTimer(): void {
        if (typeof setInterval !== 'undefined') {
            this.flushTimer = setInterval(() => {
                this.flush();
            }, this.config.flushInterval);
        }
    }

    /**
     | Zatrzymuje timer
     */
    private stopFlushTimer(): void {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
    }

    /**
     | Pobiera statystyki
     */
    getStats(): TelemetryStats {
        return {
            enabled: this.config.enabled,
            sessionId: this.sessionId,
            userId: this.userId,
            eventsInQueue: this.eventQueue.length,
            metrics: this.metrics.getCurrentValues(),
            performance: this.performance.getReport()
        };
    }

    /**
     | Wyłącza telemetrię
     */
    disable(): void {
        this.config.enabled = false;
        this.stopFlushTimer();
    }

    /**
     | Włącza telemetrię
     */
    enable(): void {
        this.config.enabled = true;
        this.startFlushTimer();
    }

    /**
     | Zamyka klienta
     */
    async shutdown(): Promise<void> {
        this.stopFlushTimer();
        await this.flush();
        this.metrics.dispose();
        this.performance.dispose();
        this.removeAllListeners();
        
        this.logger.info(LogCategory.SYSTEM, 'Telemetry client shut down');
    }
}

/**
 | Statystyki telemetrii
 */
export interface TelemetryStats {
    enabled: boolean;
    sessionId: string;
    userId?: string;
    eventsInQueue: number;
    metrics: Record<string, any>;
    performance: PerformanceReport;
}