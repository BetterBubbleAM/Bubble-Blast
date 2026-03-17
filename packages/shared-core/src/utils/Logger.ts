/**
 * @file Logger.ts
 * @description System logowania z poziomami i kolorami
 */

/**
 * Poziomy logowania
 */
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 4
}

/**
 * Kategorie logów
 */
export enum LogCategory {
    SYSTEM = 'SYSTEM',
    NETWORK = 'NETWORK',
    PHYSICS = 'PHYSICS',
    ECS = 'ECS',
    GAMEPLAY = 'GAMEPLAY',
    RENDERING = 'RENDERING',
    INPUT = 'INPUT',
    AUDIO = 'AUDIO',
    AI = 'AI',
    DATABASE = 'DATABASE',
    PERFORMANCE = 'PERFORMANCE',
    SECURITY = 'SECURITY'
}

/**
 * Konfiguracja loggera
 */
export interface LoggerConfig {
    level: LogLevel;
    enableColors: boolean;
    enableTimestamp: boolean;
    enableCategory: boolean;
    outputToConsole: boolean;
    outputToFile: boolean;
    logFilePath?: string;
}

/**
 * Wpis loga
 */
export interface LogEntry {
    timestamp: number;
    level: LogLevel;
    category: LogCategory;
    message: string;
    data?: any;
}

/**
 * Główna klasa loggera
 */
export class Logger {
    private static instance: Logger;
    private config: LoggerConfig;
    private entries: LogEntry[] = [];
    private maxEntries: number = 10000;
    private listeners: ((entry: LogEntry) => void)[] = [];

    private constructor(config?: Partial<LoggerConfig>) {
        this.config = {
            level: LogLevel.INFO,
            enableColors: true,
            enableTimestamp: true,
            enableCategory: true,
            outputToConsole: true,
            outputToFile: false,
            ...config
        };
    }

    /**
     * Zwraca instancję loggera
     */
    static getInstance(config?: Partial<LoggerConfig>): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger(config);
        }
        return Logger.instance;
    }

    /**
     * Ustawia poziom logowania
     */
    setLevel(level: LogLevel): void {
        this.config.level = level;
    }

    /**
     * Log debug
     */
    debug(category: LogCategory, message: string, data?: any): void {
        this.log(LogLevel.DEBUG, category, message, data);
    }

    /**
     * Log info
     */
    info(category: LogCategory, message: string, data?: any): void {
        this.log(LogLevel.INFO, category, message, data);
    }

    /**
     * Log warning
     */
    warn(category: LogCategory, message: string, data?: any): void {
        this.log(LogLevel.WARN, category, message, data);
    }

    /**
     * Log error
     */
    error(category: LogCategory, message: string, data?: any): void {
        this.log(LogLevel.ERROR, category, message, data);
    }

    /**
     * Główna metoda logowania
     */
    private log(level: LogLevel, category: LogCategory, message: string, data?: any): void {
        if (level < this.config.level) return;

        const entry: LogEntry = {
            timestamp: Date.now(),
            level,
            category,
            message,
            data
        };

        this.entries.push(entry);
        if (this.entries.length > this.maxEntries) {
            this.entries.shift();
        }

        if (this.config.outputToConsole) {
            this.writeToConsole(entry);
        }

        if (this.config.outputToFile && this.config.logFilePath) {
            this.writeToFile(entry);
        }

        this.notifyListeners(entry);
    }

    /**
     * Wypisuje do konsoli
     */
    private writeToConsole(entry: LogEntry): void {
        const parts: string[] = [];

        if (this.config.enableTimestamp) {
            parts.push(`[${new Date(entry.timestamp).toISOString()}]`);
        }

        if (this.config.enableCategory) {
            parts.push(`[${entry.category}]`);
        }

        parts.push(this.formatMessage(entry.level, entry.message));

        const consoleMethod = this.getConsoleMethod(entry.level);
        const fullMessage = parts.join(' ');

        if (entry.data && this.config.level <= LogLevel.DEBUG) {
            consoleMethod(fullMessage, entry.data);
        } else {
            consoleMethod(fullMessage);
        }
    }

    /**
     * Formatuje wiadomość z kolorem
     */
    private formatMessage(level: LogLevel, message: string): string {
        if (!this.config.enableColors) return message;

        const colors = {
            [LogLevel.DEBUG]: '\x1b[36m', // cyan
            [LogLevel.INFO]: '\x1b[32m',  // green
            [LogLevel.WARN]: '\x1b[33m',  // yellow
            [LogLevel.ERROR]: '\x1b[31m'  // red
        };

        const reset = '\x1b[0m';
        return `${colors[level]}${message}${reset}`;
    }

    /**
     * Zwraca metodę konsoli dla poziomu
     */
    private getConsoleMethod(level: LogLevel): (...args: any[]) => void {
        switch (level) {
            case LogLevel.DEBUG:
                return console.debug;
            case LogLevel.INFO:
                return console.log;
            case LogLevel.WARN:
                return console.warn;
            case LogLevel.ERROR:
                return console.error;
            default:
                return console.log;
        }
    }

    /**
     * Zapisuje do pliku
     */
    private writeToFile(entry: LogEntry): void {
        // W przeglądarce - ignoruj
        if (typeof window !== 'undefined') return;

        // W Node - zapisz do pliku
        try {
            const fs = require('fs');
            const line = JSON.stringify(entry) + '\n';
            fs.appendFileSync(this.config.logFilePath!, line);
        } catch (e) {
            console.error('Nie można zapisać do pliku logu:', e);
        }
    }

    /**
     * Dodaje nasłuchiwacz na nowe logi
     */
    addListener(listener: (entry: LogEntry) => void): void {
        this.listeners.push(listener);
    }

    /**
     * Usuwa nasłuchiwacz
     */
    removeListener(listener: (entry: LogEntry) => void): void {
        const index = this.listeners.indexOf(listener);
        if (index !== -1) {
            this.listeners.splice(index, 1);
        }
    }

    /**
     * Powiadamia nasłuchiwaczy
     */
    private notifyListeners(entry: LogEntry): void {
        for (const listener of this.listeners) {
            try {
                listener(entry);
            } catch (e) {
                console.error('Błąd w listenerze logów:', e);
            }
        }
    }

    /**
     * Pobiera wszystkie logi
     */
    getEntries(): LogEntry[] {
        return [...this.entries];
    }

    /**
     * Pobiera logi dla kategorii
     */
    getEntriesByCategory(category: LogCategory): LogEntry[] {
        return this.entries.filter(e => e.category === category);
    }

    /**
     * Pobiera logy dla poziomu
     */
    getEntriesByLevel(level: LogLevel): LogEntry[] {
        return this.entries.filter(e => e.level === level);
    }

    /**
     * Czyści logi
     */
    clear(): void {
        this.entries = [];
    }

    /**
     * Tworzy logger dla kategorii
     */
    static forCategory(category: LogCategory): CategoryLogger {
        return new CategoryLogger(Logger.getInstance(), category);
    }
}

/**
 * Logger dla konkretnej kategorii
 */
export class CategoryLogger {
    private logger: Logger;
    private category: LogCategory;

    constructor(logger: Logger, category: LogCategory) {
        this.logger = logger;
        this.category = category;
    }

    debug(message: string, data?: any): void {
        this.logger.debug(this.category, message, data);
    }

    info(message: string, data?: any): void {
        this.logger.info(this.category, message, data);
    }

    warn(message: string, data?: any): void {
        this.logger.warn(this.category, message, data);
    }

    error(message: string, data?: any): void {
        this.logger.error(this.category, message, data);
    }
}

/**
 * Logger do pomiaru czasu
 */
export class TimerLogger {
    private logger: CategoryLogger;
    private label: string;
    private startTime: number;

    constructor(logger: CategoryLogger, label: string) {
        this.logger = logger;
        this.label = label;
        this.startTime = performance.now();
    }

    stop(): number {
        const duration = performance.now() - this.startTime;
        this.logger.debug(`${this.label} zakończone w ${duration.toFixed(2)}ms`);
        return duration;
    }

    stopAndWarn(threshold: number): number {
        const duration = performance.now() - this.startTime;
        if (duration > threshold) {
            this.logger.warn(`${this.label} trwało ${duration.toFixed(2)}ms (próg: ${threshold}ms)`);
        } else {
            this.logger.debug(`${this.label} zakończone w ${duration.toFixed(2)}ms`);
        }
        return duration;
    }
}

/**
 * Globalny logger
 */
export const logger = Logger.getInstance();
export const systemLogger = Logger.forCategory(LogCategory.SYSTEM);
export const networkLogger = Logger.forCategory(LogCategory.NETWORK);
export const physicsLogger = Logger.forCategory(LogCategory.PHYSICS);
export const gameplayLogger = Logger.forCategory(LogCategory.GAMEPLAY);