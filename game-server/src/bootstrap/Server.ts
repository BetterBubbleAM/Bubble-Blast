/**
 * @file Server.ts
 * @description Główna klasa serwera
 */

import http from 'http';
import WebSocket from 'ws';
import express from 'express';

import { ServerConfig, loadConfigFromEnv, DEFAULT_CONFIG } from './ServerConfig';
import { DependencyContainer } from './DependencyContainer';
import { GameRoom } from '../core/GameRoom';
import { SessionManager } from '../networking/SessionManager';
import { PacketRouter } from '../networking/PacketRouter';
import { SnapshotSender } from '../networking/SnapshotSender';
import { TickLoop } from '../core/TickLoop';
import { Logger, LogCategory } from '@shared-core/utils/Logger';
import { EventEmitter } from '@shared-core/events/EventEmitter';
import { WorldGenerator } from '../world/WorldGenerator';

/**
 | Stan serwera
 */
export enum ServerState {
    STARTING = 'starting',
    RUNNING = 'running',
    STOPPING = 'stopping',
    STOPPED = 'stopped'
}

/**
 | Główny serwer
 */
export class Server {
    private config: ServerConfig;
    private container: DependencyContainer;
    private logger: Logger;
    private eventEmitter: EventEmitter;
    
    private state: ServerState = ServerState.STOPPED;
    private httpServer: http.Server;
    private wsServer: WebSocket.Server;
    private app: express.Application;
    
    private rooms: Map<string, GameRoom> = new Map();
    private sessionManager: SessionManager;
    private packetRouter: PacketRouter;
    private snapshotSender: SnapshotSender;
    private tickLoop: TickLoop;
    
    private startTime: number = 0;
    private totalConnections: number = 0;
    private peakConnections: number = 0;

    constructor(config?: Partial<ServerConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...loadConfigFromEnv(), ...config };
        this.logger = Logger.getInstance();
        this.eventEmitter = new EventEmitter();
        
        // Konfiguruj logger
        this.logger.setLevel(this.getLogLevel(this.config.logLevel));
        
        // Inicjalizuj kontener DI
        this.container = new DependencyContainer(this.config);
        
        // Inicjalizuj serwer HTTP
        this.app = express();
        this.httpServer = http.createServer(this.app);
        this.wsServer = new WebSocket.Server({ server: this.httpServer });
        
        // Inicjalizuj komponenty
        this.sessionManager = new SessionManager(this.config, this.eventEmitter);
        this.packetRouter = new PacketRouter(this.eventEmitter, this.config);
        this.snapshotSender = new SnapshotSender(this.config);
        this.tickLoop = new TickLoop(this.config.tickRate);
        
        this.logger.info(LogCategory.SYSTEM, 'Server instance created', {
            serverId: this.config.serverId,
            region: this.config.region,
            maxPlayers: this.config.maxPlayers
        });
    }

    /**
     | Uruchamia serwer
     */
    async start(): Promise<void> {
        if (this.state !== ServerState.STOPPED) {
            throw new Error(`Cannot start server from state ${this.state}`);
        }

        this.state = ServerState.STARTING;
        this.startTime = Date.now();

        try {
            // Inicjalizuj komponenty
            await this.initialize();
            
            // Uruchom serwer HTTP
            await this.startHttpServer();
            
            // Uruchom WebSocket
            this.startWebSocket();
            
            // Uruchom tick loop
            this.tickLoop.start((deltaTime) => this.update(deltaTime));
            
            // Generuj początkowe pokoje
            await this.createInitialRooms();
            
            this.state = ServerState.RUNNING;
            
            this.logger.info(LogCategory.SYSTEM, `Server started on port ${this.config.port}`);
            
            // Emituj zdarzenie
            this.eventEmitter.emit({
                type: 'system:started',
                timestamp: Date.now(),
                version: process.env.npm_package_version || '1.0.0',
                environment: this.config.environment
            });

        } catch (error) {
            this.logger.error(LogCategory.SYSTEM, 'Failed to start server', error);
            this.state = ServerState.STOPPED;
            throw error;
        }
    }

    /**
     | Zatrzymuje serwer
     */
    async stop(): Promise<void> {
        if (this.state !== ServerState.RUNNING) return;

        this.state = ServerState.STOPPING;
        this.logger.info(LogCategory.SYSTEM, 'Stopping server...');

        // Zatrzymaj tick loop
        this.tickLoop.stop();

        // Zamknij wszystkie pokoje
        for (const room of this.rooms.values()) {
            await room.shutdown();
        }
        this.rooms.clear();

        // Zamknij połączenia WebSocket
        this.wsServer.close();
        
        // Zamknij serwer HTTP
        await new Promise<void>((resolve) => {
            this.httpServer.close(() => resolve());
        });

        // Zamknij kontener DI
        await this.container.shutdown();

        this.state = ServerState.STOPPED;
        
        this.logger.info(LogCategory.SYSTEM, 'Server stopped', {
            uptime: Date.now() - this.startTime,
            peakConnections: this.peakConnections
        });
    }

    /**
     | Inicjalizuje komponenty
     */
    private async initialize(): Promise<void> {
        // Rejestruj świat w kontenerze
        this.container.registerWorld();
        
        // Inicjalizuj menedżer sesji
        await this.sessionManager.initialize();
        
        // Konfiguruj routing pakietów
        this.setupPacketRouting();
        
        // Konfiguruj endpointy HTTP
        this.setupHttpEndpoints();
    }

    /**
     | Konfiguruje routing pakietów
     */
    private setupPacketRouting(): void {
        this.packetRouter.on('packet', (data) => {
            const { clientId, packet } = data;
            const room = this.findRoomByClient(clientId);
            
            if (room) {
                room.handlePacket(clientId, packet);
            } else {
                this.logger.warn(LogCategory.NETWORK, `Packet from unknown client: ${clientId}`);
            }
        });
    }

    /**
     | Konfiguruje endpointy HTTP
     */
    private setupHttpEndpoints(): void {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: this.state,
                uptime: Date.now() - this.startTime,
                connections: this.sessionManager.getConnectionCount(),
                rooms: this.rooms.size
            });
        });

        // Statystyki
        this.app.get('/stats', (req, res) => {
            res.json(this.getStats());
        });

        // Admin endpoint (jeśli włączone)
        if (this.config.debug) {
            this.app.get('/admin/rooms', (req, res) => {
                const roomsInfo = Array.from(this.rooms.values()).map(r => r.getInfo());
                res.json(roomsInfo);
            });
        }
    }

    /**
     | Uruchamia serwer HTTP
     */
    private async startHttpServer(): Promise<void> {
        return new Promise((resolve) => {
            this.httpServer.listen(this.config.port, () => {
                resolve();
            });
        });
    }

    /**
     | Uruchamia WebSocket
     */
    private startWebSocket(): void {
        this.wsServer.on('connection', (ws, req) => {
            this.handleConnection(ws, req);
        });

        this.logger.info(LogCategory.NETWORK, `WebSocket server started on port ${this.config.webSocketPort}`);
    }

    /**
     | Obsługuje nowe połączenie
     */
    private handleConnection(ws: WebSocket, req: http.IncomingMessage): void {
        const clientId = this.sessionManager.createSession(ws, req);
        
        if (!clientId) {
            ws.close(1008, 'Server full');
            return;
        }

        this.totalConnections++;
        this.peakConnections = Math.max(this.peakConnections, this.sessionManager.getConnectionCount());

        ws.on('message', (data: WebSocket.Data) => {
            this.packetRouter.route(clientId, data);
        });

        ws.on('close', () => {
            this.handleDisconnect(clientId);
        });

        ws.on('error', (error) => {
            this.logger.error(LogCategory.NETWORK, `WebSocket error for client ${clientId}`, error);
        });

        this.logger.info(LogCategory.NETWORK, `Client connected: ${clientId}`);
    }

    /**
     | Obsługuje rozłączenie
     */
    private handleDisconnect(clientId: string): void {
        const room = this.findRoomByClient(clientId);
        
        if (room) {
            room.removePlayer(clientId);
        }
        
        this.sessionManager.removeSession(clientId);
        
        this.logger.info(LogCategory.NETWORK, `Client disconnected: ${clientId}`);
    }

    /**
     | Tworzy początkowe pokoje
     */
    private async createInitialRooms(): Promise<void> {
        const roomCount = Math.ceil(this.config.maxPlayers / this.config.playersPerRoom);
        
        for (let i = 0; i < Math.min(roomCount, this.config.maxRooms); i++) {
            const room = new GameRoom(
                `room-${i + 1}`,
                this.config,
                this.container,
                this.eventEmitter
            );
            
            await room.initialize();
            this.rooms.set(room.id, room);
        }
        
        this.logger.info(LogCategory.SYSTEM, `Created ${this.rooms.size} initial rooms`);
    }

    /**
     | Znajduje pokój dla klienta
     */
    private findRoomByClient(clientId: string): GameRoom | undefined {
        for (const room of this.rooms.values()) {
            if (room.hasPlayer(clientId)) {
                return room;
            }
        }
        return undefined;
    }

    /**
     | Aktualizacja (tick)
     */
    private update(deltaTime: number): void {
        for (const room of this.rooms.values()) {
            room.update(deltaTime);
        }
    }

    /**
     | Pobiera statystyki
     */
    getStats(): ServerStats {
        return {
            state: this.state,
            uptime: Date.now() - this.startTime,
            connections: this.sessionManager.getConnectionCount(),
            peakConnections: this.peakConnections,
            totalConnections: this.totalConnections,
            rooms: this.rooms.size,
            playersInRooms: Array.from(this.rooms.values()).reduce((sum, r) => sum + r.getPlayerCount(), 0),
            tickRate: this.tickLoop.getActualTickRate(),
            memory: process.memoryUsage()
        };
    }

    /**
     | Konwertuje poziom logowania
     */
    private getLogLevel(level: string): any {
        const levels = {
            'debug': 0,
            'info': 1,
            'warn': 2,
            'error': 3
        };
        return levels[level] || 1;
    }
}

/**
 | Statystyki serwera
 */
export interface ServerStats {
    state: ServerState;
    uptime: number;
    connections: number;
    peakConnections: number;
    totalConnections: number;
    rooms: number;
    playersInRooms: number;
    tickRate: number;
    memory: NodeJS.MemoryUsage;
}