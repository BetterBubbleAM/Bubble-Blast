/**
 * @file GameRoom.ts
 * @description Pokój gry - zawiera instancję gry i graczy
 */

import { ServerConfig } from '../bootstrap/ServerConfig';
import { DependencyContainer } from '../bootstrap/DependencyContainer';
import { WorldState, WorldPlayer } from './WorldState';
import { EntityRegistry } from './EntityRegistry';
import { TickLoop } from './TickLoop';
import { SessionManager } from '../networking/SessionManager';
import { SnapshotSender } from '../networking/SnapshotSender';
import { PlayerController } from '../gameplay/PlayerController';
import { BotController } from '../ai/BotController';
import { PelletSpawner } from '../world/PelletSpawner';
import { VirusSpawner } from '../world/VirusSpawner';
import { CollisionSystem } from '../systems/CollisionSystem';
import { EatingSystem } from '../systems/EatingSystem';
import { MovementSystem } from '../systems/MovementSystem';
import { SplitSystem } from '../systems/SplitSystem';
import { MergeSystem } from '../systems/MergeSystem';
import { MassDecaySystem } from '../systems/MassDecaySystem';

import { World } from '@physics-engine/world/World';
import { Logger, LogCategory } from '@shared-core/utils/Logger';
import { EventEmitter } from '@shared-core/events/EventEmitter';
import { Vector2 } from '@shared-core/math/Vector2';
import { GAMEPLAY_CONSTANTS } from '@shared-core/constants/GameplayConstants';
import { PlayerId } from '@shared-core/types/EntityTypes';

/**
 | Stan pokoju
 */
export enum RoomState {
    CREATING = 'creating',
    WAITING = 'waiting',
    RUNNING = 'running',
    CLOSING = 'closing'
}

/**
 | Pokój gry
 */
export class GameRoom {
    public readonly id: string;
    public readonly config: ServerConfig;
    
    private state: RoomState = RoomState.CREATING;
    private container: DependencyContainer;
    private logger: Logger;
    private eventEmitter: EventEmitter;
    
    // Komponenty
    private physicsWorld: World;
    private worldState: WorldState;
    private tickLoop: TickLoop;
    private snapshotSender: SnapshotSender;
    
    // Systemy gry
    private playerController: PlayerController;
    private botController: BotController;
    private pelletSpawner: PelletSpawner;
    private virusSpawner: VirusSpawner;
    private collisionSystem: CollisionSystem;
    private eatingSystem: EatingSystem;
    private movementSystem: MovementSystem;
    private splitSystem: SplitSystem;
    private mergeSystem: MergeSystem;
    private massDecaySystem: MassDecaySystem;
    
    // Gracze
    private players: Map<PlayerId, WorldPlayer> = new Map();
    private playerSessions: Map<PlayerId, string> = new Map(); // playerId -> sessionId
    
    private startTime: number = 0;
    private playerCount: number = 0;
    private botCount: number = 0;

    constructor(
        id: string,
        config: ServerConfig,
        container: DependencyContainer,
        eventEmitter: EventEmitter
    ) {
        this.id = id;
        this.config = config;
        this.container = container;
        this.eventEmitter = eventEmitter;
        this.logger = Logger.getInstance();
        
        this.physicsWorld = container.get<World>('physicsWorld');
        this.tickLoop = new TickLoop(config.tickRate);
        this.snapshotSender = new SnapshotSender(config);
    }

    /**
     | Inicjalizuje pokój
     */
    async initialize(): Promise<void> {
        this.logger.info(LogCategory.SYSTEM, `Initializing room: ${this.id}`);

        // Inicjalizuj stan świata
        this.worldState = new WorldState(this.physicsWorld, {
            width: this.config.worldWidth,
            height: this.config.worldHeight,
            maxPlayers: this.config.playersPerRoom,
            maxCells: this.config.playersPerRoom * 16,
            maxPellets: GAMEPLAY_CONSTANTS.PELLET_MAX_COUNT,
            maxViruses: 100
        });

        // Inicjalizuj systemy
        this.initializeSystems();

        // Generuj świat
        await this.generateWorld();

        // Uruchom tick loop
        this.setupTickLoop();

        this.state = RoomState.WAITING;
        this.startTime = Date.now();
        
        this.logger.info(LogCategory.SYSTEM, `Room initialized: ${this.id}`);
    }

    /**
     | Inicjalizuje systemy gry
     */
    private initializeSystems(): void {
        this.playerController = new PlayerController(
            this.worldState,
            this.config,
            this.eventEmitter
        );

        this.botController = new BotController(
            this.worldState,
            this.config.botCount,
            this.config.botDifficulty
        );

        this.pelletSpawner = new PelletSpawner(
            this.worldState,
            GAMEPLAY_CONSTANTS.PELLET_MAX_COUNT
        );

        this.virusSpawner = new VirusSpawner(
            this.worldState,
            100
        );

        this.collisionSystem = new CollisionSystem(
            this.physicsWorld,
            this.worldState,
            this.eventEmitter
        );

        this.eatingSystem = new EatingSystem(
            this.worldState,
            this.eventEmitter
        );

        this.movementSystem = new MovementSystem(
            this.worldState,
            this.config
        );

        this.splitSystem = new SplitSystem(
            this.worldState,
            this.config,
            this.eventEmitter
        );

        this.mergeSystem = new MergeSystem(
            this.worldState,
            this.config,
            this.eventEmitter
        );

        this.massDecaySystem = new MassDecaySystem(
            this.worldState,
            this.config.decayRate
        );
    }

    /**
     | Konfiguruje tick loop
     */
    private setupTickLoop(): void {
        this.tickLoop.on('tick', ({ deltaTime }) => {
            this.update(deltaTime);
        });
    }

    /**
     | Generuje początkowy świat
     */
    private async generateWorld(): Promise<void> {
        // Generuj pellety
        this.pelletSpawner.generateInitial();
        
        // Generuj wirusy
        this.virusSpawner.generateInitial();
        
        // Generuj boty
        this.botController.spawnBots();
        this.botCount = this.config.botCount;

        this.logger.info(LogCategory.SYSTEM, 'World generated', {
            pellets: GAMEPLAY_CONSTANTS.PELLET_MAX_COUNT,
            viruses: 100,
            bots: this.config.botCount
        });
    }

    /**
     | Dodaje gracza do pokoju
     */
    addPlayer(sessionId: string, playerData: Partial<WorldPlayer>): WorldPlayer | null {
        if (this.players.size >= this.config.playersPerRoom) {
            this.logger.warn(LogCategory.GAMEPLAY, `Room ${this.id} is full`);
            return null;
        }

        const playerId = `player_${Date.now()}_${Math.random().toString(36)}`;
        
        const player: WorldPlayer = {
            id: playerId,
            name: playerData.name || `Player${this.players.size + 1}`,
            cells: [],
            totalMass: this.config.initialMass,
            score: 0,
            kills: 0,
            deaths: 0,
            color: this.generatePlayerColor(),
            isAlive: true,
            isBot: false,
            joinTime: Date.now(),
            lastAction: Date.now()
        };

        this.players.set(playerId, player);
        this.playerSessions.set(playerId, sessionId);
        this.playerCount++;

        // Stwórz początkową komórkę
        const spawnPos = this.getRandomSpawnPosition();
        this.worldState.createPlayerCell(
            playerId,
            spawnPos,
            Math.sqrt(this.config.initialMass / Math.PI) * 2,
            this.config.initialMass,
            player.color
        );

        this.logger.info(LogCategory.GAMEPLAY, `Player ${player.name} joined room ${this.id}`);

        // Emituj zdarzenie
        this.eventEmitter.emit({
            type: 'game:player:joined',
            timestamp: Date.now(),
            playerId,
            playerName: player.name
        });

        return player;
    }

    /**
     | Usuwa gracza z pokoju
     */
    removePlayer(playerId: PlayerId): void {
        const player = this.players.get(playerId);
        if (!player) return;

        // Usuń komórki gracza
        const cells = this.worldState.getPlayerCells(playerId);
        for (const cell of cells) {
            this.worldState.removeEntity(cell.id);
        }

        this.players.delete(playerId);
        this.playerSessions.delete(playerId);
        this.playerCount--;

        this.logger.info(LogCategory.GAMEPLAY, `Player ${player.name} left room ${this.id}`);

        // Emituj zdarzenie
        this.eventEmitter.emit({
            type: 'game:player:left',
            timestamp: Date.now(),
            playerId,
            reason: 'disconnect'
        });
    }

    /**
     | Aktualizacja pokoju
     */
    private update(deltaTime: number): void {
        if (this.state !== RoomState.RUNNING) return;

        // Aktualizuj systemy
        this.movementSystem.update(deltaTime);
        this.collisionSystem.update(deltaTime);
        this.eatingSystem.update(deltaTime);
        this.splitSystem.update(deltaTime);
        this.mergeSystem.update(deltaTime);
        this.massDecaySystem.update(deltaTime);
        
        // Aktualizuj świat
        this.worldState.update(deltaTime);
        
        // Aktualizuj boty
        this.botController.update(deltaTime);
        
        // Spawnuj nowe pellety
        this.pelletSpawner.update(deltaTime);
        
        // Wyślij snapshoty
        this.snapshotSender.sendToAll(this.players, this.worldState);
    }

    /**
     | Obsługuje pakiet od gracza
     */
    handlePacket(sessionId: string, packet: any): void {
        // Znajdź gracza po sessionId
        let playerId: PlayerId | undefined;
        for (const [pid, sid] of this.playerSessions) {
            if (sid === sessionId) {
                playerId = pid;
                break;
            }
        }

        if (!playerId) return;

        // Przekaż do kontrolera
        this.playerController.handlePacket(playerId, packet);
    }

    /**
     | Sprawdza czy gracz jest w pokoju
     */
    hasPlayer(playerId: PlayerId): boolean {
        return this.players.has(playerId);
    }

    /**
     | Sprawdza czy sesja jest w pokoju
     */
    hasSession(sessionId: string): boolean {
        return Array.from(this.playerSessions.values()).includes(sessionId);
    }

    /**
     | Pobiera liczbę graczy
     */
    getPlayerCount(): number {
        return this.players.size;
    }

    /**
     | Generuje losowy kolor dla gracza
     */
    private generatePlayerColor(): string {
        const colors = GAMEPLAY_CONSTANTS.DEFAULT_PLAYER_COLORS;
        return colors[Math.floor(Math.random() * colors.length)];
    }

    /**
     | Generuje losową pozycję spawnu
     */
    private getRandomSpawnPosition(): Vector2 {
        const margin = 100;
        return new Vector2(
            margin + Math.random() * (this.config.worldWidth - 2 * margin),
            margin + Math.random() * (this.config.worldHeight - 2 * margin)
        );
    }

    /**
     | Pobiera informacje o pokoju
     */
    getInfo(): RoomInfo {
        return {
            id: this.id,
            state: this.state,
            players: this.players.size,
            maxPlayers: this.config.playersPerRoom,
            bots: this.botCount,
            uptime: Date.now() - this.startTime,
            created: this.startTime
        };
    }

    /**
     | Zamyka pokój
     */
    async shutdown(): Promise<void> {
        this.state = RoomState.CLOSING;
        
        // Zatrzymaj tick loop
        this.tickLoop.stop();
        
        // Wyczyść dane
        this.players.clear();
        this.playerSessions.clear();
        this.worldState.reset();
        
        this.state = RoomState.CLOSING;
        
        this.logger.info(LogCategory.SYSTEM, `Room ${this.id} shut down`);
    }
}

/**
 | Informacje o pokoju
 */
export interface RoomInfo {
    id: string;
    state: RoomState;
    players: number;
    maxPlayers: number;
    bots: number;
    uptime: number;
    created: number;
}