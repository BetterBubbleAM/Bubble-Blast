/**
 * @file AppContext.ts
 * @description Kontekst aplikacji - dostęp do globalnych instancji
 */

import { EventEmitter } from '@shared-core/events/EventEmitter';
import { World } from '@ecs/core/World';
import { Logger, LogCategory } from '@shared-core/utils/Logger';

/**
 | Kontekst aplikacji
 */
export class AppContext {
    public readonly eventEmitter: EventEmitter;
    public readonly logger: Logger;
    
    public ecsWorld: World | null = null;
    public playerId: string | null = null;
    public sessionId: string | null = null;
    
    public worldWidth: number = 0;
    public worldHeight: number = 0;
    public serverTickRate: number = 60;
    
    public isConnected: boolean = false;
    public isInGame: boolean = false;
    
    private data: Map<string, any> = new Map();

    constructor(eventEmitter: EventEmitter) {
        this.eventEmitter = eventEmitter;
        this.logger = Logger.getInstance();
    }

    /**
     | Ustawia wartość w kontekście
     */
    set<T>(key: string, value: T): void {
        this.data.set(key, value);
        this.eventEmitter.emit({
            type: 'context:changed',
            timestamp: Date.now(),
            key,
            value
        } as any);
    }

    /**
     | Pobiera wartość z kontekstu
     */
    get<T>(key: string): T | undefined {
        return this.data.get(key);
    }

    /**
     | Sprawdza czy klucz istnieje
     */
    has(key: string): boolean {
        return this.data.has(key);
    }

    /**
     | Usuwa wartość
     */
    delete(key: string): boolean {
        return this.data.delete(key);
    }

    /**
     | Czyści kontekst
     */
    clear(): void {
        this.data.clear();
        this.playerId = null;
        this.sessionId = null;
        this.isConnected = false;
        this.isInGame = false;
    }

    /**
     | Zapisuje informacje o świecie z serwera
     */
    setWorldInfo(width: number, height: number, tickRate: number): void {
        this.worldWidth = width;
        this.worldHeight = height;
        this.serverTickRate = tickRate;
        
        this.logger.info(LogCategory.SYSTEM, `World info received: ${width}x${height}, ${tickRate}Hz`);
    }

    /**
     | Aktualizuje stan połączenia
     */
    setConnectionStatus(connected: boolean, playerId?: string, sessionId?: string): void {
        this.isConnected = connected;
        
        if (playerId) {
            this.playerId = playerId;
        }
        
        if (sessionId) {
            this.sessionId = sessionId;
        }
        
        this.logger.info(LogCategory.NETWORK, 
            `Connection status: ${connected ? 'connected' : 'disconnected'}`);
    }

    /**
     | Aktualizuje stan gry
     */
    setGameStatus(inGame: boolean): void {
        this.isInGame = inGame;
        
        this.logger.info(LogCategory.GAMEPLAY, 
            `Game status: ${inGame ? 'in game' : 'not in game'}`);
    }
}