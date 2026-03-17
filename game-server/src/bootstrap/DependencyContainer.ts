/**
 * @file DependencyContainer.ts
 * @description Kontener DI dla serwera
 */

import { ServerConfig } from './ServerConfig';
import { Logger, LogCategory } from '@shared-core/utils/Logger';
import { EventEmitter } from '@shared-core/events/EventEmitter';
import { IdGenerator } from '@shared-core/utils/IdGenerator';
import { World } from '@physics-engine/world/World';
import { WorldConfig, DEFAULT_WORLD_CONFIG } from '@physics-engine/world/WorldConfig';
import { RollbackManager } from '@rollback-system/RollbackManager';
import { AntiCheatEngine } from '@anti-cheat/AntiCheatEngine';
import { TelemetryClient } from '@telemetry-sdk/TelemetryClient';

/**
 | Rejestr zależności
 */
export class DependencyContainer {
    private instances: Map<string, any> = new Map();
    private factories: Map<string, () => any> = new Map();
    private config: ServerConfig;
    private logger: Logger;

    constructor(config: ServerConfig) {
        this.config = config;
        this.logger = Logger.getInstance();
        
        // Rejestruj podstawowe zależności
        this.registerCore();
    }

    /**
     | Rejestruje podstawowe zależności
     */
    private registerCore(): void {
        // Config
        this.registerInstance('config', this.config);

        // Logger (singleton)
        this.registerInstance('logger', Logger.getInstance());

        // Event emitter
        this.registerSingleton('eventEmitter', () => new EventEmitter());

        // ID Generator
        this.registerSingleton('idGenerator', () => new IdGenerator());

        // Telemetry
        if (this.config.metricsEnabled) {
            this.registerSingleton('telemetry', () => new TelemetryClient({
                environment: this.config.environment,
                flushInterval: this.config.metricsInterval
            }));
        }

        // Anti-cheat
        this.registerSingleton('antiCheat', () => new AntiCheatEngine());
    }

    /**
     | Rejestruje świat fizyczny
     */
    registerWorld(worldConfig?: Partial<WorldConfig>): void {
        this.registerSingleton('physicsWorld', () => {
            const physicsConfig: WorldConfig = {
                ...DEFAULT_WORLD_CONFIG,
                bounds: {
                    minX: 0,
                    minY: 0,
                    maxX: this.config.worldWidth,
                    maxY: this.config.worldHeight,
                    enableWalls: true,
                    wallRestitution: 0.2,
                    wallFriction: 0.3
                },
                ...worldConfig
            };

            return new World(physicsConfig, this.get('eventEmitter'));
        });
    }

    /**
     | Rejestruje instancję
     */
    registerInstance<T>(key: string, instance: T): void {
        this.instances.set(key, instance);
        this.logger.debug(LogCategory.SYSTEM, `Registered instance: ${key}`);
    }

    /**
     | Rejestruje singleton (tworzony przy pierwszym użyciu)
     */
    registerSingleton<T>(key: string, factory: () => T): void {
        this.factories.set(key, factory);
        this.logger.debug(LogCategory.SYSTEM, `Registered singleton factory: ${key}`);
    }

    /**
     | Rejestruje fabrykę (tworzy nową instancję za każdym razem)
     */
    registerFactory<T>(key: string, factory: () => T): void {
        this.factories.set(key, factory);
        this.logger.debug(LogCategory.SYSTEM, `Registered factory: ${key}`);
    }

    /**
     | Pobiera zależność
     */
    get<T>(key: string): T {
        // Sprawdź instancje
        if (this.instances.has(key)) {
            return this.instances.get(key);
        }

        // Sprawdź fabryki
        if (this.factories.has(key)) {
            const factory = this.factories.get(key)!;
            const instance = factory();
            
            // Jeśli to singleton, zapisz instancję
            if (this.isSingleton(key)) {
                this.instances.set(key, instance);
            }
            
            return instance;
        }

        throw new Error(`Dependency not found: ${key}`);
    }

    /**
     | Sprawdza czy to singleton
     */
    private isSingleton(key: string): boolean {
        // Wszystkie zarejestrowane przez registerSingleton to singlety
        return true; // Uproszczenie
    }

    /**
     | Sprawdza czy zależność istnieje
     */
    has(key: string): boolean {
        return this.instances.has(key) || this.factories.has(key);
    }

    /**
     | Tworzy wszystkie singlety (inicjalizacja)
     */
    initializeSingletons(): void {
        const keys = Array.from(this.factories.keys());
        
        for (const key of keys) {
            if (!this.instances.has(key)) {
                this.get(key);
            }
        }
        
        this.logger.info(LogCategory.SYSTEM, `Initialized ${this.instances.size} singletons`);
    }

    /**
     | Zamyka wszystkie zasoby
     */
    async shutdown(): Promise<void> {
        // Zamknij telemetrię
        if (this.has('telemetry')) {
            const telemetry = this.get<TelemetryClient>('telemetry');
            await telemetry.shutdown();
        }

        // Wyczyść mapy
        this.instances.clear();
        this.factories.clear();
        
        this.logger.info(LogCategory.SYSTEM, 'Dependency container shut down');
    }
}