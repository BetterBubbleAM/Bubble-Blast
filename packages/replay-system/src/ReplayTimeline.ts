/**
 * @file ReplayTimeline.ts
 * @description Oś czasu replaya - nawigacja i kontrola odtwarzania
 */

import { Replay, ReplayEvent, ReplayEventType } from './ReplayRecorder';
import { EventEmitter } from '@shared-core/events/EventEmitter';

/**
 | Stan odtwarzania
 */
export enum PlaybackState {
    STOPPED = 'stopped',
    PLAYING = 'playing',
    PAUSED = 'paused',
    SEEKING = 'seeking'
}

/**
 | Opcje odtwarzania
 */
export interface PlaybackOptions {
    speed: number;              // Prędkość odtwarzania (1 = normalna)
    loop: boolean;              // Czy zapętlać
    startFrame?: number;        // Początkowa klatka
    endFrame?: number;          // Końcowa klatka
    onFrame?: (frame: number, event: ReplayEvent) => void;
}

/**
 | Zdarzenia timeline'a
 */
export interface TimelineEvents {
    play: { frame: number };
    pause: { frame: number };
    seek: { fromFrame: number; toFrame: number };
    stop: { finalFrame: number };
    frame: { frame: number; event: ReplayEvent };
    complete: { totalFrames: number };
}

/**
 | Oś czasu replaya
 */
export class ReplayTimeline extends EventEmitter {
    private replay: Replay;
    private events: ReplayEvent[];
    private frameMap: Map<number, ReplayEvent[]> = new Map();
    private frameIndices: number[] = [];
    
    private state: PlaybackState = PlaybackState.STOPPED;
    private options: PlaybackOptions;
    private currentFrame: number = 0;
    private currentIndex: number = 0;
    private animationFrame: number | null = null;
    private lastTimestamp: number = 0;

    constructor(replay: Replay, options?: Partial<PlaybackOptions>) {
        super();
        
        this.replay = replay;
        this.events = replay.events;
        this.options = {
            speed: 1.0,
            loop: false,
            ...options
        };

        this.buildFrameIndex();
    }

    /**
     | Buduje indeks klatek
     */
    private buildFrameIndex(): void {
        // Grupuj zdarzenia po klatkach
        for (const event of this.events) {
            if (!this.frameMap.has(event.frame)) {
                this.frameMap.set(event.frame, []);
                this.frameIndices.push(event.frame);
            }
            this.frameMap.get(event.frame)!.push(event);
        }

        // Sortuj klatki
        this.frameIndices.sort((a, b) => a - b);

        // Ustaw zakres
        if (this.frameIndices.length > 0) {
            if (!this.options.startFrame) {
                this.options.startFrame = this.frameIndices[0];
            }
            if (!this.options.endFrame) {
                this.options.endFrame = this.frameIndices[this.frameIndices.length - 1];
            }
            this.currentFrame = this.options.startFrame;
        }
    }

    /**
     | Rozpoczyna odtwarzanie
     */
    play(): void {
        if (this.state === PlaybackState.PLAYING) return;
        
        this.state = PlaybackState.PLAYING;
        this.lastTimestamp = performance.now();
        
        this.emit('play', { frame: this.currentFrame });
        this.scheduleNextFrame();
    }

    /**
     | Pauzuje odtwarzanie
     */
    pause(): void {
        if (this.state !== PlaybackState.PLAYING) return;
        
        this.state = PlaybackState.PAUSED;
        if (this.animationFrame !== null) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        
        this.emit('pause', { frame: this.currentFrame });
    }

    /**
     | Zatrzymuje odtwarzanie
     */
    stop(): void {
        this.pause();
        this.state = PlaybackState.STOPPED;
        this.seekToFrame(this.options.startFrame || 0);
        
        this.emit('stop', { finalFrame: this.currentFrame });
    }

    /**
     | Przewija do klatki
     */
    seekToFrame(frame: number): void {
        const oldFrame = this.currentFrame;
        
        // Znajdź najbliższą dostępną klatkę
        let targetFrame = frame;
        if (!this.frameMap.has(frame)) {
            // Znajdź najbliższą mniejszą
            for (let i = this.frameIndices.length - 1; i >= 0; i--) {
                if (this.frameIndices[i] <= frame) {
                    targetFrame = this.frameIndices[i];
                    break;
                }
            }
        }

        if (targetFrame !== this.currentFrame) {
            this.currentFrame = targetFrame;
            this.currentIndex = this.frameIndices.indexOf(targetFrame);
            
            this.emit('seek', { fromFrame: oldFrame, toFrame: targetFrame });
            this.emitCurrentFrame();
        }
    }

    /**
     | Przewija do czasu (ms)
     */
    seekToTime(timeMs: number): void {
        const targetTime = this.replay.header.startTime + timeMs;
        const targetFrame = this.estimateFrameAtTime(targetTime);
        this.seekToFrame(targetFrame);
    }

    /**
     | Przewija o procent
     */
    seekToPercent(percent: number): void {
        const start = this.options.startFrame || 0;
        const end = this.options.endFrame || 0;
        const range = end - start;
        const targetFrame = start + Math.floor(range * percent / 100);
        this.seekToFrame(targetFrame);
    }

    /**
     | Następna klatka
     */
    nextFrame(): void {
        if (this.currentIndex < this.frameIndices.length - 1) {
            this.seekToFrame(this.frameIndices[this.currentIndex + 1]);
        }
    }

    /**
     | Poprzednia klatka
     */
    previousFrame(): void {
        if (this.currentIndex > 0) {
            this.seekToFrame(this.frameIndices[this.currentIndex - 1]);
        }
    }

    /**
     | Planuje następną klatkę
     */
    private scheduleNextFrame(): void {
        if (this.state !== PlaybackState.PLAYING) return;

        const now = performance.now();
        const delta = now - this.lastTimestamp;
        
        // Oblicz ile klatek do przeskoczenia
        const framesToAdvance = Math.floor(delta * this.options.speed / 16.667); // 60 FPS
        
        if (framesToAdvance > 0) {
            this.advanceFrames(framesToAdvance);
            this.lastTimestamp = now;
        }

        this.animationFrame = requestAnimationFrame(() => this.scheduleNextFrame());
    }

    /**
     | Przesuwa o N klatek
     */
    private advanceFrames(count: number): void {
        const targetIndex = Math.min(
            this.currentIndex + count,
            this.frameIndices.length - 1
        );
        
        const targetFrame = this.frameIndices[targetIndex];
        
        if (targetFrame !== this.currentFrame) {
            this.currentFrame = targetFrame;
            this.currentIndex = targetIndex;
            this.emitCurrentFrame();
        }

        // Sprawdź czy koniec
        if (this.currentIndex >= this.frameIndices.length - 1) {
            if (this.options.loop) {
                this.seekToFrame(this.options.startFrame || 0);
            } else {
                this.stop();
                this.emit('complete', { totalFrames: this.frameIndices.length });
            }
        }
    }

    /**
     | Emituje bieżącą klatkę
     */
    private emitCurrentFrame(): void {
        const events = this.frameMap.get(this.currentFrame) || [];
        
        for (const event of events) {
            this.emit('frame', { frame: this.currentFrame, event });
            
            if (this.options.onFrame) {
                this.options.onFrame(this.currentFrame, event);
            }
        }
    }

    /**
     | Szacuje klatkę na podstawie czasu
     */
    private estimateFrameAtTime(time: number): number {
        const startTime = this.replay.header.startTime;
        const endTime = this.replay.header.endTime || startTime;
        const duration = endTime - startTime;
        
        if (duration === 0) return 0;
        
        const progress = (time - startTime) / duration;
        const frameRange = (this.options.endFrame || 0) - (this.options.startFrame || 0);
        
        return (this.options.startFrame || 0) + Math.floor(frameRange * progress);
    }

    /**
     | Ustawia prędkość
     */
    setSpeed(speed: number): void {
        this.options.speed = Math.max(0.1, Math.min(10, speed));
    }

    /**
     | Pobiera statystyki
     */
    getStats(): TimelineStats {
        return {
            totalFrames: this.frameIndices.length,
            currentFrame: this.currentFrame,
            currentIndex: this.currentIndex,
            progress: this.currentIndex / (this.frameIndices.length - 1) * 100,
            state: this.state,
            speed: this.options.speed,
            startFrame: this.options.startFrame || 0,
            endFrame: this.options.endFrame || 0
        };
    }

    /**
     | Pobiera wszystkie zdarzenia dla klatki
     */
    getEventsAtFrame(frame: number): ReplayEvent[] {
        return this.frameMap.get(frame) || [];
    }

    /**
     | Zwalnia zasoby
     */
    destroy(): void {
        if (this.animationFrame !== null) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        this.removeAllListeners();
    }
}

/**
 | Statystyki timeline'a
 */
export interface TimelineStats {
    totalFrames: number;
    currentFrame: number;
    currentIndex: number;
    progress: number;
    state: PlaybackState;
    speed: number;
    startFrame: number;
    endFrame: number;
}