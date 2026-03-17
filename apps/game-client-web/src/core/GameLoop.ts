/**
 * @file GameLoop.ts
 * @description Główna pętla gry po stronie klienta
 */

import { AppContext } from '../bootstrap/AppContext';
import { Logger, LogCategory } from '@shared-core/utils/Logger';
import { EventEmitter } from '@shared-core/events/EventEmitter';

/**
 | Opcje pętli gry
 */
export interface GameLoopOptions {
    targetFPS: number;
    useFixedTimeStep: boolean;
    maxUpdatesPerFrame: number;
}

/**
 | Pętla gry
 */
export class GameLoop {
    private context: AppContext;
    private options: GameLoopOptions;
    private logger: Logger;
    private eventEmitter: EventEmitter;
    
    private isRunning: boolean = false;
    private lastFrameTime: number = 0;
    private accumulatedTime: number = 0;
    private frameCount: number = 0;
    private fps: number = 0;
    private fpsUpdateTime: number = 0;
    
    private animationFrame: number | null = null;
    private onUpdate: ((deltaTime: number) => void) | null = null;

    constructor(context: AppContext, options?: Partial<GameLoopOptions>) {
        this.context = context;
        this.logger = context.logger;
        this.eventEmitter = context.eventEmitter;
        
        this.options = {
            targetFPS: 60,
            useFixedTimeStep: true,
            maxUpdatesPerFrame: 5,
            ...options
        };
    }

    /**
     | Uruchamia pętlę
     */
    start(onUpdate: (deltaTime: number) => void): void {
        if (this.isRunning) return;

        this.isRunning = true;
        this.onUpdate = onUpdate;
        this.lastFrameTime = performance.now();
        this.accumulatedTime = 0;
        
        this.logger.info(LogCategory.SYSTEM, `Game loop started (target: ${this.options.targetFPS} FPS)`);
        
        this.loop();
    }

    /**
     | Zatrzymuje pętlę
     */
    stop(): void {
        if (!this.isRunning) return;

        this.isRunning = false;
        
        if (this.animationFrame !== null) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        
        this.logger.info(LogCategory.SYSTEM, 'Game loop stopped');
    }

    /**
     | Główna pętla
     */
    private loop(): void {
        if (!this.isRunning) return;

        const now = performance.now();
        let deltaTime = (now - this.lastFrameTime) / 1000; // w sekundach
        
        // Ogranicz maksymalne delta (po powrocie z background)
        deltaTime = Math.min(deltaTime, 0.1); // max 100ms
        
        this.lastFrameTime = now;
        this.frameCount++;

        // Oblicz FPS co sekundę
        if (now - this.fpsUpdateTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.fpsUpdateTime = now;
            
            this.eventEmitter.emit({
                type: 'performance:fps:updated',
                timestamp: Date.now(),
                fps: this.fps,
                min: this.fps,
                max: this.fps
            } as any);
        }

        // Fixed timestep
        if (this.options.useFixedTimeStep) {
            const fixedDelta = 1 / this.options.targetFPS;
            this.accumulatedTime += deltaTime;
            
            let updates = 0;
            while (this.accumulatedTime >= fixedDelta && updates < this.options.maxUpdatesPerFrame) {
                if (this.onUpdate) {
                    this.onUpdate(fixedDelta);
                }
                this.accumulatedTime -= fixedDelta;
                updates++;
            }
        } else {
            // Variable timestep
            if (this.onUpdate) {
                this.onUpdate(deltaTime);
            }
        }

        // Request next frame
        this.animationFrame = requestAnimationFrame(() => this.loop());
    }

    /**
     | Zmienia docelowe FPS
     */
    setTargetFPS(fps: number): void {
        this.options.targetFPS = Math.max(30, Math.min(240, fps));
        this.logger.debug(LogCategory.SYSTEM, `Target FPS changed to ${fps}`);
    }

    /**
     | Pobiera aktualne FPS
     */
    getFPS(): number {
        return this.fps;
    }

    /**
     | Pobiera statystyki
     */
    getStats(): GameLoopStats {
        return {
            targetFPS: this.options.targetFPS,
            actualFPS: this.fps,
            deltaTime: this.lastFrameTime ? (performance.now() - this.lastFrameTime) / 1000 : 0,
            accumulatedTime: this.accumulatedTime,
            isRunning: this.isRunning,
            frameCount: this.frameCount
        };
    }
}

/**
 | Statystyki pętli gry
 */
export interface GameLoopStats {
    targetFPS: number;
    actualFPS: number;
    deltaTime: number;
    accumulatedTime: number;
    isRunning: boolean;
    frameCount: number;
}