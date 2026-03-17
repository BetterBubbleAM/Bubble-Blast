/**
 * @file PacketRouter.ts
 * @description Routing pakietów do odpowiednich handlerów
 */

import { EventEmitter } from '@shared-core/events/EventEmitter';
import { ServerConfig } from '../bootstrap/ServerConfig';
import { Logger, LogCategory } from '@shared-core/utils/Logger';

/**
 | Typ pakietu
 */
export enum PacketType {
    AUTH = 'auth',
    PING = 'ping',
    INPUT = 'input',
    SPLIT = 'split',
    MERGE = 'merge',
    EJECT = 'eject',
    CHAT = 'chat',
    SPECTATE = 'spectate',
    RESPAWN = 'respawn'
}

/**
 | Handler pakietu
 */
export type PacketHandler = (clientId: string, packet: any) => void;

/**
 | Router pakietów
 */
export class PacketRouter {
    private handlers: Map<PacketType, Set<PacketHandler>> = new Map();
    private eventEmitter: EventEmitter;
    private config: ServerConfig;
    private logger: Logger;
    
    private packetCount: Map<PacketType, number> = new Map();
    private clientRateLimit: Map<string, { count: number; resetTime: number }> = new Map();

    constructor(eventEmitter: EventEmitter, config: ServerConfig) {
        this.eventEmitter = eventEmitter;
        this.config = config;
        this.logger = Logger.getInstance();
        
        this.setupDefaultHandlers();
    }

    /**
     | Konfiguruje domyślne handlery
     */
    private setupDefaultHandlers(): void {
        this.on(PacketType.PING, (clientId, packet) => {
            this.eventEmitter.emit('packet:ping', { clientId, packet });
        });

        this.on(PacketType.INPUT, (clientId, packet) => {
            this.eventEmitter.emit('packet:input', { clientId, packet });
        });

        this.on(PacketType.SPLIT, (clientId, packet) => {
            this.eventEmitter.emit('packet:split', { clientId, packet });
        });

        this.on(PacketType.MERGE, (clientId, packet) => {
            this.eventEmitter.emit('packet:merge', { clientId, packet });
        });

        this.on(PacketType.CHAT, (clientId, packet) => {
            this.eventEmitter.emit('packet:chat', { clientId, packet });
        });
    }

    /**
     | Rejestruje handler dla typu pakietu
     */
    on(type: PacketType, handler: PacketHandler): void {
        if (!this.handlers.has(type)) {
            this.handlers.set(type, new Set());
        }
        
        this.handlers.get(type)!.add(handler);
        
        this.logger.debug(LogCategory.NETWORK, `Handler registered for packet type: ${type}`);
    }

    /**
     | Usuwa handler
     */
    off(type: PacketType, handler: PacketHandler): void {
        const handlers = this.handlers.get(type);
        if (handlers) {
            handlers.delete(handler);
        }
    }

    /**
     | Kieruje pakiet do odpowiednich handlerów
     */
    route(clientId: string, data: WebSocket.Data): void {
        try {
            // Parsuj pakiet
            const packet = JSON.parse(data.toString());
            
            // Walidacja
            if (!this.validatePacket(packet)) {
                this.logger.warn(LogCategory.NETWORK, `Invalid packet from ${clientId}`);
                return;
            }

            // Rate limiting
            if (!this.checkRateLimit(clientId, packet.type)) {
                this.logger.warn(LogCategory.NETWORK, `Rate limit exceeded for ${clientId}`);
                return;
            }

            // Aktualizuj statystyki
            this.updateStats(packet.type);

            // Znajdź handlery
            const handlers = this.handlers.get(packet.type);
            if (!handlers || handlers.size === 0) {
                this.logger.debug(LogCategory.NETWORK, `No handlers for packet type: ${packet.type}`);
                return;
            }

            // Wywołaj handlery
            for (const handler of handlers) {
                try {
                    handler(clientId, packet);
                } catch (error) {
                    this.logger.error(LogCategory.NETWORK, 
                        `Handler error for packet type ${packet.type}`, error);
                }
            }

            // Emituj ogólne zdarzenie
            this.eventEmitter.emit('packet', { clientId, packet });

        } catch (error) {
            this.logger.error(LogCategory.NETWORK, 'Failed to route packet', error);
        }
    }

    /**
     | Waliduje pakiet
     */
    private validatePacket(packet: any): boolean {
        // Sprawdź wymagane pola
        if (!packet.type || !packet.timestamp) {
            return false;
        }

        // Sprawdź typ
        if (!Object.values(PacketType).includes(packet.type)) {
            return false;
        }

        // Sprawdź timestamp (nie z przyszłości, nie za stary)
        const now = Date.now();
        if (packet.timestamp > now + 1000 || packet.timestamp < now - 5000) {
            return false;
        }

        // Sprawdź sekwencję (opcjonalnie)
        if (packet.sequence && typeof packet.sequence !== 'number') {
            return false;
        }

        return true;
    }

    /**
     | Sprawdza rate limiting
     */
    private checkRateLimit(clientId: string, packetType: string): boolean {
        const now = Date.now();
        const limit = this.config.rateLimit;
        const burst = this.config.rateLimitBurst;

        let clientLimit = this.clientRateLimit.get(clientId);
        
        if (!clientLimit) {
            clientLimit = { count: 0, resetTime: now + 1000 };
            this.clientRateLimit.set(clientId, clientLimit);
        }

        // Resetuj licznik po sekundzie
        if (now > clientLimit.resetTime) {
            clientLimit.count = 0;
            clientLimit.resetTime = now + 1000;
        }

        clientLimit.count++;

        // Sprawdź limit z burstem
        return clientLimit.count <= limit + burst;
    }

    /**
     | Aktualizuje statystyki
     */
    private updateStats(type: PacketType): void {
        const count = this.packetCount.get(type) || 0;
        this.packetCount.set(type, count + 1);
    }

    /**
     | Pobiera statystyki
     */
    getStats(): PacketStats {
        const stats: PacketStats = {
            totalPackets: 0,
            byType: {},
            activeClients: this.clientRateLimit.size
        };

        for (const [type, count] of this.packetCount) {
            stats.byType[type] = count;
            stats.totalPackets += count;
        }

        return stats;
    }

    /**
     | Resetuje statystyki
     */
    resetStats(): void {
        this.packetCount.clear();
        this.clientRateLimit.clear();
    }
}

/**
 | Statystyki pakietów
 */
export interface PacketStats {
    totalPackets: number;
    byType: Record<string, number>;
    activeClients: number;
}