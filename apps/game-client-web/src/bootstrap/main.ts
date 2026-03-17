/**
 * @file main.ts
 * @description Główny punkt wejścia aplikacji klienckiej
 */

import { AppContext } from './AppContext';
import { registerSystems } from './registerSystems';
import { preloadAssets } from './preloadAssets';
import { GameLoop } from '../core/GameLoop';
import { StateManager } from '../core/StateManager';
import { InputManager } from '../input/InputManager';
import { SceneManager } from '../rendering/SceneManager';
import { SocketClient } from '../network/SocketClient';
import { SyncEngine } from '../network/SyncEngine';
import { AssetManager } from '../assets/AssetManager';
import { HUD } from '../ui/HUD/HUD';
import { MainMenu } from '../ui/Menus/MainMenu';
import { Logger, LogCategory } from '@shared-core/utils/Logger';
import { EventEmitter } from '@shared-core/events/EventEmitter';
import { GAMEPLAY_CONSTANTS } from '@shared-core/constants/GameplayConstants';

/**
 | Główna klasa aplikacji
 */
class BubbleAmGame {
    private context: AppContext;
    private gameLoop: GameLoop;
    private stateManager: StateManager;
    private inputManager: InputManager;
    private sceneManager: SceneManager;
    private socketClient: SocketClient;
    private syncEngine: SyncEngine;
    private assetManager: AssetManager;
    private hud: HUD;
    private mainMenu: MainMenu;
    
    private eventEmitter: EventEmitter;
    private logger: Logger;
    private isRunning: boolean = false;
    private startTime: number = 0;

    constructor() {
        this.eventEmitter = new EventEmitter();
        this.logger = Logger.getInstance();
        
        // Konfiguruj logger dla środowiska klienckiego
        this.logger.setLevel(process.env.NODE_ENV === 'development' ? 0 : 1);
        
        this.context = new AppContext(this.eventEmitter);
        this.assetManager = new AssetManager(this.context);
        this.stateManager = new StateManager(this.context);
        this.inputManager = new InputManager(this.context);
        this.sceneManager = new SceneManager(this.context);
        this.socketClient = new SocketClient(this.context);
        this.syncEngine = new SyncEngine(this.context, this.socketClient, this.stateManager);
        this.hud = new HUD(this.context);
        this.mainMenu = new MainMenu(this.context);
        
        this.gameLoop = new GameLoop(this.context, {
            targetFPS: 60,
            useFixedTimeStep: true,
            maxUpdatesPerFrame: 5
        });
    }

    /**
     | Inicjalizuje grę
     */
    async initialize(): Promise<void> {
        this.logger.info(LogCategory.SYSTEM, 'Initializing Bubble.am Client...');

        try {
            // Pokaż menu główne
            this.mainMenu.show();
            
            // Rejestruj systemy ECS
            registerSystems(this.context);
            
            // Preloaduj podstawowe assety
            await preloadAssets(this.assetManager);
            
            // Konfiguruj event listeners
            this.setupEventListeners();
            
            this.logger.info(LogCategory.SYSTEM, 'Client initialized successfully');
            
        } catch (error) {
            this.logger.error(LogCategory.SYSTEM, 'Failed to initialize client', error);
            this.showErrorScreen('Failed to initialize game. Please refresh the page.');
        }
    }

    /**
     | Uruchamia grę
     */
    async start(): Promise<void> {
        if (this.isRunning) return;

        this.isRunning = true;
        this.startTime = performance.now();

        // Ukryj menu
        this.mainMenu.hide();
        
        // Pokaż HUD
        this.hud.show();
        
        // Połącz z serwerem
        await this.connectToServer();
        
        // Uruchom pętlę gry
        this.gameLoop.start((deltaTime) => this.update(deltaTime));
        
        this.logger.info(LogCategory.SYSTEM, 'Game started');
    }

    /**
     | Zatrzymuje grę
     */
    stop(): void {
        if (!this.isRunning) return;

        this.isRunning = false;
        
        // Zatrzymaj pętlę
        this.gameLoop.stop();
        
        // Rozłącz z serwerem
        this.socketClient.disconnect();
        
        // Pokaż menu
        this.mainMenu.show();
        this.hud.hide();
        
        this.logger.info(LogCategory.SYSTEM, 'Game stopped');
    }

    /**
     | Łączy z serwerem
     */
    private async connectToServer(): Promise<void> {
        const serverUrl = this.getServerUrl();
        
        this.logger.info(LogCategory.NETWORK, `Connecting to ${serverUrl}...`);
        
        try {
            await this.socketClient.connect(serverUrl);
            
            // Wyślij handshake
            this.socketClient.sendHandshake({
                playerName: this.getPlayerName(),
                version: process.env.APP_VERSION || '1.0.0',
                screenWidth: window.innerWidth,
                screenHeight: window.innerHeight
            });
            
        } catch (error) {
            this.logger.error(LogCategory.NETWORK, 'Failed to connect to server', error);
            throw error;
        }
    }

    /**
     | Główna pętla aktualizacji
     */
    private update(deltaTime: number): void {
        // Aktualizuj input
        this.inputManager.update(deltaTime);
        
        // Aktualizuj stan (predykcja)
        this.stateManager.update(deltaTime);
        
        // Synchronizacja z serwerem
        this.syncEngine.update(deltaTime);
        
        // Renderuj
        this.sceneManager.render(deltaTime);
        
        // Aktualizuj HUD
        this.hud.update(deltaTime);
    }

    /**
     | Konfiguruje event listeners
     */
    private setupEventListeners(): void {
        // Obsługa play z menu
        this.eventEmitter.on('menu:play', () => {
            this.start();
        });

        // Obsługa disconnect
        this.eventEmitter.on('network:disconnected', () => {
            this.logger.warn(LogCategory.NETWORK, 'Disconnected from server');
            this.stop();
            this.showErrorScreen('Disconnected from server');
        });

        // Obsługa respawn
        this.eventEmitter.on('game:player:died', () => {
            setTimeout(() => {
                this.requestRespawn();
            }, 3000);
        });

        // Obsługa resize okna
        window.addEventListener('resize', () => {
            this.sceneManager.resize(window.innerWidth, window.innerHeight);
        });

        // Obsługa beforeunload
        window.addEventListener('beforeunload', () => {
            this.socketClient.disconnect();
        });
    }

    /**
     | Wysyła żądanie respawnu
     */
    private requestRespawn(): void {
        this.socketClient.send({
            type: 'respawn',
            timestamp: Date.now()
        });
    }

    /**
     | Pobiera URL serwera
     */
    private getServerUrl(): string {
        // W development używaj localhost
        if (process.env.NODE_ENV === 'development') {
            return 'ws://localhost:8081';
        }
        
        // W production użyj zmiennej środowiskowej lub domeny
        return process.env.SERVER_URL || 'wss://game.bubble.am';
    }

    /**
     | Pobiera nazwę gracza
     */
    private getPlayerName(): string {
        // Sprawdź localStorage
        const saved = localStorage.getItem('playerName');
        if (saved) return saved;
        
        // Generuj losową nazwę
        const names = ['Player', 'Guest', 'Explorer', 'Adventurer'];
        const randomName = names[Math.floor(Math.random() * names.length)] +
                          Math.floor(Math.random() * 1000);
        
        localStorage.setItem('playerName', randomName);
        return randomName;
    }

    /**
     | Pokazuje ekran błędu
     */
    private showErrorScreen(message: string): void {
        // TODO: implementacja
        console.error(message);
    }
}

/**
 | Uruchomienie gry po załadowaniu DOM
 */
window.addEventListener('DOMContentLoaded', async () => {
    const game = new BubbleAmGame();
    
    try {
        await game.initialize();
        
        // Dla development - auto-start
        if (process.env.NODE_ENV === 'development') {
            setTimeout(() => game.start(), 1000);
        }
        
    } catch (error) {
        console.error('Failed to start game:', error);
        document.body.innerHTML = `<div style="color: red; padding: 20px;">
            Failed to start game. Check console for details.
        </div>`;
    }
});

// Eksport dla debugowania
if (process.env.NODE_ENV === 'development') {
    (window as any).game = new BubbleAmGame();
}