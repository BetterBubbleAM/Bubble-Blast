/**
 * @file EventEmitter.ts
 * @description Zaawansowany emiter zdarzeń z priorytetami i asynchronicznością
 */

import { EventType, GameEvent } from './EventTypes';

/**
 * Priorytet nasłuchiwacza
 */
export enum ListenerPriority {
    LOWEST = 0,
    LOW = 25,
    NORMAL = 50,
    HIGH = 75,
    HIGHEST = 100,
    MONITOR = 200 // zawsze ostatni, tylko do obserwacji
}

/**
 * Opcje nasłuchiwacza
 */
export interface ListenerOptions {
    priority?: ListenerPriority;
    once?: boolean;
    filter?: (event: any) => boolean;
    debounce?: number;
    throttle?: number;
}

/**
 * Wewnętrzna struktura nasłuchiwacza
 */
interface ListenerEntry<T = any> {
    callback: (event: T) => void;
    priority: ListenerPriority;
    once: boolean;
    filter?: (event: T) => boolean;
    debounce?: number;
    throttle?: number;
    lastCall?: number;
    timeoutId?: any;
}

/**
 * Statystyki zdarzenia
 */
export interface EventStats {
    eventType: string;
    listenerCount: number;
    emittedCount: number;
    lastEmitted?: number;
}

/**
 * Główna klasa emitera zdarzeń
 */
export class EventEmitter {
    private listeners: Map<EventType, ListenerEntry[]> = new Map();
    private wildcardListeners: ListenerEntry<GameEvent>[] = [];
    private stats: Map<EventType, { count: number; lastEmitted?: number }> = new Map();
    private maxListeners: number = 100;
    private debugMode: boolean = false;

    constructor(maxListeners: number = 100) {
        this.maxListeners = maxListeners;
    }

    /**
     * Dodaje nasłuchiwacz zdarzenia
     */
    on<T extends GameEvent>(
        eventType: T['type'],
        callback: (event: T) => void,
        options: ListenerOptions = {}
    ): () => void {
        const entry: ListenerEntry<T> = {
            callback: callback as any,
            priority: options.priority ?? ListenerPriority.NORMAL,
            once: options.once ?? false,
            filter: options.filter,
            debounce: options.debounce,
            throttle: options.throttle
        };

        const entries = this.listeners.get(eventType) || [];
        
        if (entries.length >= this.maxListeners && this.debugMode) {
            console.warn(`EventEmitter: przekroczono limit nasłuchiwaczy dla ${eventType} (${this.maxListeners})`);
        }

        entries.push(entry as ListenerEntry);
        entries.sort((a, b) => b.priority - a.priority);
        this.listeners.set(eventType, entries);

        // Zwraca funkcję do usunięcia
        return () => this.off(eventType, callback);
    }

    /**
     * Dodaje nasłuchiwacz na wszystkie zdarzenia
     */
    onAny(callback: (event: GameEvent) => void, options: ListenerOptions = {}): () => void {
        const entry: ListenerEntry<GameEvent> = {
            callback,
            priority: options.priority ?? ListenerPriority.NORMAL,
            once: options.once ?? false,
            filter: options.filter,
            debounce: options.debounce,
            throttle: options.throttle
        };

        this.wildcardListeners.push(entry);
        this.wildcardListeners.sort((a, b) => b.priority - a.priority);

        return () => this.offAny(callback);
    }

    /**
     * Dodaje nasłuchiwacz jednorazowy
     */
    once<T extends GameEvent>(
        eventType: T['type'],
        callback: (event: T) => void,
        options: Omit<ListenerOptions, 'once'> = {}
    ): () => void {
        return this.on(eventType, callback, { ...options, once: true });
    }

    /**
     * Usuwa nasłuchiwacz
     */
    off<T extends GameEvent>(
        eventType: T['type'],
        callback: (event: T) => void
    ): void {
        const entries = this.listeners.get(eventType);
        if (!entries) return;

        const index = entries.findIndex(e => e.callback === callback);
        if (index !== -1) {
            // Wyczyść timeout jeśli istnieje
            if (entries[index].timeoutId) {
                clearTimeout(entries[index].timeoutId);
            }
            entries.splice(index, 1);
        }

        if (entries.length === 0) {
            this.listeners.delete(eventType);
        }
    }

    /**
     * Usuwa nasłuchiwacz uniwersalny
     */
    offAny(callback: (event: GameEvent) => void): void {
        const index = this.wildcardListeners.findIndex(e => e.callback === callback);
        if (index !== -1) {
            if (this.wildcardListeners[index].timeoutId) {
                clearTimeout(this.wildcardListeners[index].timeoutId);
            }
            this.wildcardListeners.splice(index, 1);
        }
    }

    /**
     * Usuwa wszystkich nasłuchiwaczy dla zdarzenia
     */
    removeAllListeners(eventType?: EventType): void {
        if (eventType) {
            this.listeners.delete(eventType);
        } else {
            this.listeners.clear();
            this.wildcardListeners = [];
        }
    }

    /**
     * Emituje zdarzenie
     */
    emit<T extends GameEvent>(event: T): void {
        // Aktualizuj statystyki
        const stats = this.stats.get(event.type) || { count: 0 };
        stats.count++;
        stats.lastEmitted = Date.now();
        this.stats.set(event.type, stats);

        // Emituj do specyficznych nasłuchiwaczy
        const specificListeners = this.listeners.get(event.type) || [];
        this.executeListeners(specificListeners, event);

        // Emituj do uniwersalnych nasłuchiwaczy
        this.executeListeners(this.wildcardListeners, event);

        if (this.debugMode) {
            console.log(`[EventEmitter] Emitted: ${event.type}`, event);
        }
    }

    /**
     * Emituje zdarzenie asynchronicznie
     */
    emitAsync<T extends GameEvent>(event: T): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(() => {
                this.emit(event);
                resolve();
            }, 0);
        });
    }

    /**
     * Wykonuje nasłuchiwacze
     */
    private executeListeners<T>(listeners: ListenerEntry<T>[], event: T): void {
        for (const listener of listeners) {
            // Sprawdź filtr
            if (listener.filter && !listener.filter(event)) {
                continue;
            }

            // Debounce
            if (listener.debounce) {
                if (listener.timeoutId) {
                    clearTimeout(listener.timeoutId);
                }
                listener.timeoutId = setTimeout(() => {
                    this.executeListener(listener, event);
                    listener.timeoutId = undefined;
                }, listener.debounce);
                continue;
            }

            // Throttle
            if (listener.throttle) {
                const now = Date.now();
                if (listener.lastCall && now - listener.lastCall < listener.throttle) {
                    continue;
                }
                listener.lastCall = now;
            }

            this.executeListener(listener, event);

            // Once
            if (listener.once) {
                if (this.wildcardListeners.includes(listener)) {
                    this.offAny(listener.callback);
                } else {
                    // Znajdź event type
                    for (const [type, entries] of this.listeners.entries()) {
                        const index = entries.indexOf(listener);
                        if (index !== -1) {
                            entries.splice(index, 1);
                            if (entries.length === 0) {
                                this.listeners.delete(type);
                            }
                            break;
                        }
                    }
                }
            }
        }
    }

    /**
     * Wykonuje pojedynczy nasłuchiwacz z obsługą błędów
     */
    private executeListener<T>(listener: ListenerEntry<T>, event: T): void {
        try {
            listener.callback(event);
        } catch (error) {
            console.error(`EventEmitter: błąd w nasłuchiwaczu dla ${(event as any).type}:`, error);
            
            // Emituj błąd
            this.emit({
                type: 'system:error',
                timestamp: Date.now(),
                error: error as Error,
                fatal: false
            } as any);
        }
    }

    /**
     * Czeka na zdarzenie
     */
    waitFor<T extends GameEvent>(
        eventType: T['type'],
        timeout: number = 5000,
        filter?: (event: T) => boolean
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.off(eventType, handler);
                reject(new Error(`Timeout waiting for ${eventType}`));
            }, timeout);

            const handler = (event: T) => {
                if (!filter || filter(event)) {
                    clearTimeout(timeoutId);
                    this.off(eventType, handler);
                    resolve(event);
                }
            };

            this.on(eventType, handler);
        });
    }

    /**
     * Zwraca liczbę nasłuchiwaczy dla zdarzenia
     */
    listenerCount(eventType?: EventType): number {
        if (eventType) {
            return (this.listeners.get(eventType) || []).length;
        }
        return Array.from(this.listeners.values()).reduce((sum, l) => sum + l.length, 0) + this.wildcardListeners.length;
    }

    /**
     * Zwraca statystyki zdarzeń
     */
    getStats(): EventStats[] {
        const stats: EventStats[] = [];
        
        for (const [eventType, data] of this.stats.entries()) {
            stats.push({
                eventType,
                listenerCount: (this.listeners.get(eventType) || []).length,
                emittedCount: data.count,
                lastEmitted: data.lastEmitted
            });
        }

        return stats.sort((a, b) => b.emittedCount - a.emittedCount);
    }

    /**
     * Resetuje statystyki
     */
    resetStats(): void {
        this.stats.clear();
    }

    /**
     * Włącza/wyłącza tryb debugowania
     */
    setDebugMode(enabled: boolean): void {
        this.debugMode = enabled;
    }

    /**
     * Tworzy zwężkę (pipe) do innego emitera
     */
    pipe(otherEmitter: EventEmitter, eventTypes?: EventType[]): () => void {
        const handler = (event: GameEvent) => {
            if (!eventTypes || eventTypes.includes(event.type as EventType)) {
                otherEmitter.emit(event);
            }
        };

        this.onAny(handler);
        return () => this.offAny(handler);
    }

    /**
     * Tworzy odgałęzienie (fork) - nowy emiter z tymi samymi nasłuchiwaczami
     */
    fork(): EventEmitter {
        const fork = new EventEmitter(this.maxListeners);
        
        // Kopiuj specyficzne nasłuchiwacze
        for (const [type, entries] of this.listeners.entries()) {
            const forkEntries = entries.map(e => ({ ...e }));
            fork.listeners.set(type, forkEntries);
        }

        // Kopiuj uniwersalne nasłuchiwacze
        fork.wildcardListeners = this.wildcardListeners.map(e => ({ ...e }));

        return fork;
    }

    /**
     * Czyści wszystkie nasłuchiwacze i statystyki
     */
    destroy(): void {
        this.removeAllListeners();
        this.resetStats();
        this.wildcardListeners = [];
    }
}

/**
 * Globalny emiter zdarzeń
 */
export const globalEventEmitter = new EventEmitter();

/**
 * Dekorator do nasłuchiwania zdarzeń
 */
export function OnEvent(eventType: EventType, options: ListenerOptions = {}) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;
        
        if (!target.__eventListeners) {
            target.__eventListeners = [];
        }
        
        target.__eventListeners.push({
            eventType,
            method: propertyKey,
            options
        });
    };
}

/**
 * Klasa bazowa dla komponentów używających zdarzeń
 */
export abstract class EventAware {
    protected emitter: EventEmitter;
    protected subscriptions: (() => void)[] = [];

    constructor(emitter: EventEmitter = globalEventEmitter) {
        this.emitter = emitter;
    }

    protected subscribe<T extends GameEvent>(
        eventType: T['type'],
        callback: (event: T) => void,
        options: ListenerOptions = {}
    ): void {
        const unsubscribe = this.emitter.on(eventType, callback, options);
        this.subscriptions.push(unsubscribe);
    }

    protected unsubscribeAll(): void {
        for (const unsubscribe of this.subscriptions) {
            unsubscribe();
        }
        this.subscriptions = [];
    }

    protected emit<T extends GameEvent>(event: T): void {
        this.emitter.emit(event);
    }

    destroy(): void {
        this.unsubscribeAll();
    }
}