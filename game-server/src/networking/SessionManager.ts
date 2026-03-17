/**
 * @file SessionManager.ts
 * @description Zarządzanie sesjami klientów
 */

import WebSocket from 'ws';
import http from 'http';
import { ServerConfig } from '../bootstrap/ServerConfig';
import { EventEmitter } from '@shared-core/events/EventEmitter';
import { Logger, LogCategory } from '@shared-core/utils/Logger';
import { Random } from '@shared-core/math/Random';

/**
 | Stan sesji
 */
export enum SessionState {
    CONNECTING = 'connecting',
    CONNECTED = 'connected',
    AUTHENTICATING = 'authenticating',
    AUTHENTICATED = 'authenticated',
    IN_GAME = 'in_game',
    DISCONNECTED = 'disconnected'
}

/**
 | Sesja klienta
 */
export interface ClientSession {
    id: string;
    socket: WebSocket;
    state: SessionState;
    playerId?: string;
    roomId?: string;
    connectTime: number;
    lastPing: number;
    lastPong: number;
    latency: number;
    address: string;
    userAgent: string;
    packetsSent: number;
    packetsReceived: number;
    bytesSent: number;
    bytesReceived: number;
}

/**
 | Manager sesji
 */
export class SessionManager {
    private sessions: Map<string, ClientSession> = new Map();
    private config: ServerConfig;
    private eventEmitter: EventEmitter;
    private logger: Logger;
    
    private pingInterval: NodeJS.Timeout | null = null;
    private totalConnections: number = 0;
    private peakConnections: number = 0;

    constructor(config: ServerConfig, eventEmitter: EventEmitter) {
        this.config = config;
        this.eventEmitter = eventEmitter;
        this.logger = Logger.getInstance();
        
        this.startPingInterval();
    }

    /**
     | Inicjalizuje manager
     */
    async initialize(): Promise<void> {
        this.logger.info(LogCategory.NETWORK, 'Session manager initialized');
    }

    /**
     | Tworzy nową sesję
     */
    createSession(socket: WebSocket, req: http.IncomingMessage): string | null {
        if (this.sessions.size >= this.config.maxPlayers) {
            this.logger.warn(LogCategory.NETWORK, 'Max players reached, connection rejected');
            return null;
        }

        const sessionId = this.generateSessionId();
        const address = req.socket.remoteAddress || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';

        const session: ClientSession = {
            id: sessionId,
            socket,
            state: SessionState.CONNECTING,
            connectTime: Date.now(),
            lastPing: Date.now(),
            lastPong: Date.now(),
            latency: 0,
            address,
            userAgent,
            packetsSent: 0,
            packetsReceived: 0,
            bytesSent: 0,
            bytesReceived: 0
        };

        this.sessions.set(sessionId, session);
        this.totalConnections++;
        this.peakConnections = Math.max(this.peakConnections, this.sessions.size);

        // Konfiguruj socket
        this.setupSocket(session);

        this.logger.info(LogCategory.NETWORK, `Session created: ${sessionId} from ${address}`);

        return sessionId;
    }

    /**
     | Konfiguruje socket
     */
    private setupSocket(session: ClientSession): void {
        const socket = session.socket;

        socket.on('message', (data: WebSocket.Data) => {
            this.handleMessage(session, data);
        });

        socket.on('pong', () => {
            this.handlePong(session);
        });

        socket.on('close', () => {
            this.removeSession(session.id);
        });

        socket.on('error', (error) => {
            this.logger.error(LogCategory.NETWORK, `Socket error for session ${session.id}`, error);
        });

        // Wyślij powitalny pakiet
        this.sendWelcome(session);
    }

    /**
     | Obsługuje wiadomość
     */
    private handleMessage(session: ClientSession, data: WebSocket.Data): void {
        session.packetsReceived++;
        session.bytesReceived += typeof data === 'string' ? data.length : (data as Buffer).length;

        try {
            // Parsuj wiadomość
            const message = JSON.parse(data.toString());
            
            // Aktualizuj stan sesji
            if (message.type === 'auth') {
                this.handleAuth(session, message);
            } else if (message.type === 'ping') {
                this.handlePing(session, message);
            }

            // Przekaż dalej
            this.eventEmitter.emit('session:message', {
                sessionId: session.id,
                message
            });

        } catch (error) {
            this.logger.error(LogCategory.NETWORK, `Failed to parse message from ${session.id}`, error);
        }
    }

    /**
     | Obsługuje autoryzację
     */
    private handleAuth(session: ClientSession, message: any): void {
        session.state = SessionState.AUTHENTICATING;
        
        // TODO: właściwa autoryzacja
        const playerId = message.playerId || `player_${Date.now()}`;
        
        session.playerId = playerId;
        session.state = SessionState.AUTHENTICATED;

        this.logger.info(LogCategory.NETWORK, `Session ${session.id} authenticated as ${playerId}`);

        this.send(session, {
            type: 'auth_success',
            playerId,
            timestamp: Date.now()
        });
    }

    /**
     | Obsługuje ping
     */
    private handlePing(session: ClientSession, message: any): void {
        this.send(session, {
            type: 'pong',
            timestamp: Date.now(),
            clientTime: message.timestamp
        });
    }

    /**
     | Obsługuje pong
     */
    private handlePong(session: ClientSession): void {
        const now = Date.now();
        session.lastPong = now;
        session.latency = now - session.lastPing;
    }

    /**
     | Wysyła powitalny pakiet
     */
    private sendWelcome(session: ClientSession): void {
        this.send(session, {
            type: 'welcome',
            serverId: this.config.serverId,
            serverName: this.config.serverName,
            timestamp: Date.now(),
            tickRate: this.config.tickRate,
            worldWidth: this.config.worldWidth,
            worldHeight: this.config.worldHeight
        });

        session.state = SessionState.CONNECTED;
    }

    /**
     | Wysyła wiadomość do sesji
     */
    send(session: ClientSession, data: any): void {
        if (session.socket.readyState !== WebSocket.OPEN) return;

        try {
            const message = JSON.stringify(data);
            session.socket.send(message);
            
            session.packetsSent++;
            session.bytesSent += message.length;
        } catch (error) {
            this.logger.error(LogCategory.NETWORK, `Failed to send to ${session.id}`, error);
        }
    }

    /**
     | Wysyła wiadomość do wszystkich sesji
     */
    broadcast(data: any, predicate?: (session: ClientSession) => boolean): void {
        const message = JSON.stringify(data);
        
        for (const session of this.sessions.values()) {
            if (predicate && !predicate(session)) continue;
            
            if (session.socket.readyState === WebSocket.OPEN) {
                try {
                    session.socket.send(message);
                    session.packetsSent++;
                    session.bytesSent += message.length;
                } catch (error) {
                    this.logger.error(LogCategory.NETWORK, `Failed to broadcast to ${session.id}`, error);
                }
            }
        }
    }

    /**
     | Usuwa sesję
     */
    removeSession(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        // Zamknij socket jeśli otwarty
        if (session.socket.readyState === WebSocket.OPEN) {
            session.socket.close();
        }

        this.sessions.delete(sessionId);

        this.logger.info(LogCategory.NETWORK, `Session removed: ${sessionId}`);

        this.eventEmitter.emit('session:closed', {
            sessionId,
            playerId: session.playerId
        });
    }

    /**
     | Rozpoczyna interwał pingowania
     */
    private startPingInterval(): void {
        this.pingInterval = setInterval(() => {
            this.sendPings();
        }, 5000); // Co 5 sekund
    }

    /**
     | Wysyła pingi do wszystkich sesji
     */
    private sendPings(): void {
        const now = Date.now();
        
        for (const session of this.sessions.values()) {
            if (session.socket.readyState !== WebSocket.OPEN) continue;

            // Sprawdź timeout
            if (now - session.lastPong > 15000) {
                this.logger.warn(LogCategory.NETWORK, `Session ${session.id} timed out`);
                session.socket.close();
                continue;
            }

            session.lastPing = now;
            
            this.send(session, {
                type: 'ping',
                timestamp: now
            });
        }
    }

    /**
     | Pobiera sesję po ID
     */
    getSession(sessionId: string): ClientSession | undefined {
        return this.sessions.get(sessionId);
    }

    /**
     | Pobiera sesję po ID gracza
     */
    getSessionByPlayer(playerId: string): ClientSession | undefined {
        for (const session of this.sessions.values()) {
            if (session.playerId === playerId) {
                return session;
            }
        }
        return undefined;
    }

    /**
     | Pobiera wszystkie sesje
     */
    getAllSessions(): ClientSession[] {
        return Array.from(this.sessions.values());
    }

    /**
     | Pobiera liczbę połączeń
     */
    getConnectionCount(): number {
        return this.sessions.size;
    }

    /**
     | Pobiera statystyki
     */
    getStats(): SessionStats {
        let totalPacketsSent = 0;
        let totalPacketsReceived = 0;
        let totalBytesSent = 0;
        let totalBytesReceived = 0;
        let avgLatency = 0;

        for (const session of this.sessions.values()) {
            totalPacketsSent += session.packetsSent;
            totalPacketsReceived += session.packetsReceived;
            totalBytesSent += session.bytesSent;
            totalBytesReceived += session.bytesReceived;
            avgLatency += session.latency;
        }

        if (this.sessions.size > 0) {
            avgLatency /= this.sessions.size;
        }

        return {
            activeConnections: this.sessions.size,
            totalConnections: this.totalConnections,
            peakConnections: this.peakConnections,
            totalPacketsSent,
            totalPacketsReceived,
            totalBytesSent,
            totalBytesReceived,
            averageLatency: avgLatency
        };
    }

    /**
     | Generuje ID sesji
     */
    private generateSessionId(): string {
        return `session_${Date.now()}_${Random.rangeInt(1000, 9999)}`;
    }

    /**
     | Zamyka manager
     */
    shutdown(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }

        // Zamknij wszystkie sesje
        for (const session of this.sessions.values()) {
            if (session.socket.readyState === WebSocket.OPEN) {
                session.socket.close();
            }
        }

        this.sessions.clear();
        
        this.logger.info(LogCategory.NETWORK, 'Session manager shut down');
    }
}

/**
 | Statystyki sesji
 */
export interface SessionStats {
    activeConnections: number;
    totalConnections: number;
    peakConnections: number;
    totalPacketsSent: number;
    totalPacketsReceived: number;
    totalBytesSent: number;
    totalBytesReceived: number;
    averageLatency: number;
}