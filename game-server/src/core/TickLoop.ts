/**
 * @file TickLoop.ts
 * @description Główna pętla ticków serwera
 */

import { Logger, LogCategory } from '@shared-core/utils/Logger';
import { EventEmitter } from '@shared-core/events/EventEmitter';

/**
 | Opcje pętli ticków
 */
export interface TickLoopOptions {
    targetTickRate: number;
    maxCatchUp: number;
    useFixedTimeStep: boolean;
}

/**
 | Pętla ticków
 */
export class TickLoop extends EventEmitter {
    private targetTickRate: number;
    private tickInterval: number;
    private maxCatchUp: number;
    private useFixedTimeStep: boolean;
    
    private isRunning: boolean = false;
    private lastTickTime: number = 0;
    private tickCount: number = 0;
    private accumulatedTime: number = 0;
    private tickTimes: number[] = [];
    
    private timer: NodeJS.Timeout | null = null;
    private logger: Logger;

    constructor(targetTickRate: number = 60, options?: Partial<TickLoopOptions>) {
        super();
        
        this.targetTickRate = targetTickRate;
        this.tickInterval = 1000 / targetTickRate;
        this.maxCatchUp = options?.maxCatchUp || 10;
        this.useFixedTimeStep = options?.useFixedTimeStep ?? true;
        
        this.logger = Logger.getInstance();
    }

    /**
     | Rozpoczyna pętlę
     */
    start(onTick: (deltaTime: number) => void): void {
        if (this.isRunning) return;

        this.isRunning = true;
        this.lastTickTime = performance.now();
        this.accumulatedTime = 0;
        
        this.logger.info(LogCategory.SYSTEM, `Tick loop started at ${this.targetTickRate} Hz`);

        const tick = () => {
            if (!this.isRunning) return;

            const currentTime = performance.now();
            let deltaTime = (currentTime - this.lastTickTime) / 1000; // w sekundach
            
            // Ogranicz maksymalne delta (zapobiega "catch-up" po pauzie)
            deltaTime = Math.min(deltaTime, this.maxCatchUp / this.targetTickRate);
            
            this.lastTickTime = currentTime;

            if (this.useFixedTimeStep) {
                // Fixed timestep
                this.accumulatedTime += deltaTime;
                
                while (this.accumulatedTime >= this.tickInterval / 1000) {
                    const fixedDelta = this.tickInterval / 1000;
                    this.executeTick(fixedDelta, onTick);
                    this.accumulatedTime -= this.tickInterval / 1000;
                }
            } else {
                // Variable timestep
                this.executeTick(deltaTime, onTick);
            }

            // Planuj następny tick
            this.timer = setTimeout(tick, 0);
        };

        // Użyj setImmediate jeśli dostępne (Node.js), inaczej setTimeout
        if (typeof setImmediate !== 'undefined') {
            this.timer = setImmediate(tick);
        } else {
            this.timer = setTimeout(tick, 0);
        }
    }

    /**
     | Wykonuje pojedynczy tick
     */
    private executeTick(deltaTime: number, onTick: (deltaTime: number) => void): void {
        const tickStart = performance.now();
        
        try {
            onTick(deltaTime);
        } catch (error) {
            this.logger.error(LogCategory.SYSTEM, 'Error in tick callback', error);
        }
        
        const tickDuration = performance.now() - tickStart;
        
        // Rejestruj czas ticka
        this.tickTimes.push(tickDuration);
        if (this.tickTimes.length > 60) {
            this.tickTimes.shift();
        }
        
        this.tickCount++;
        
        // Emituj zdarzenie tick
        this.emit('tick', {
            count: this.tickCount,
            deltaTime,
            duration: tickDuration
        });

        // Ostrzeżenie o długim ticku
        if (tickDuration > this.tickInterval) {
            this.logger.warn(LogCategory.PERFORMANCE, 
                `Long tick: ${tickDuration.toFixed(2)}ms (target: ${this.tickInterval.toFixed(2)}ms)`);
        }
    }

    /**
     | Zatrzymuje pętlę
     */
    stop(): void {
        this.isRunning = false;
        
        if (this.timer) {
            if (typeof clearImmediate !== 'undefined') {
                clearImmediate(this.timer);
            } else {
                clearTimeout(this.timer);
            }
            this.timer = null;
        }
        
        this.logger.info(LogCategory.SYSTEM, 'Tick loop stopped');
    }

    /**
     | Zmienia docelową częstość ticków
     */
    setTargetTickRate(rate: number): void {
        this.targetTickRate = rate;
        this.tickInterval = 1000 / rate;
        
        this.logger.debug(LogCategory.SYSTEM, `Tick rate changed to ${rate} Hz`);
    }

    /**
     | Pobiera aktualną częstość ticków
     */
    getActualTickRate(): number {
        if (this.tickTimes.length === 0) return 0;
        
        const avgDuration = this.tickTimes.reduce((a, b) => a + b, 0) / this.tickTimes.length;
        return avgDuration > 0 ? 1000 / avgDuration : 0;
    }

    /**
     | Pobiera statystyki
     */
    getStats(): TickLoopStats {
        const avgDuration = this.tickTimes.length > 0
            ? this.tickTimes.reduce((a, b) => a + b, 0) / this.tickTimes.length
            : 0;
            
        const maxDuration = this.tickTimes.length > 0
            ? Math.max(...this.tickTimes)
            : 0;
            
        const minDuration = this.tickTimes.length > 0
            ? Math.min(...this.tickTimes)
            : 0;

        return {
            targetTickRate: this.targetTickRate,
            actualTickRate: this.getActualTickRate(),
            tickCount: this.tickCount,
            avgTickDuration: avgDuration,
            minTickDuration: minDuration,
            maxTickDuration: maxDuration,
            tickInterval: this.tickInterval,
            uptime: this.tickCount / this.targetTickRate
        };
    }

    /**
     | Resetuje liczniki
     */
    reset(): void {
        this.tickCount = 0;
        this.tickTimes = [];
        this.accumulatedTime = 0;
    }
}

/**
 | Statystyki pętli ticków
 */
export interface TickLoopStats {
    targetTickRate: number;
    actualTickRate: number;
    tickCount: number;
    avgTickDuration: number;
    minTickDuration: number;
    maxTickDuration: number;
    tickInterval: number;
    uptime: number;
}