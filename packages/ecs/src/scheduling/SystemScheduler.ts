/**
 * @file SystemScheduler.ts
 * @description Harmonogram wykonania systemów w fazach
 */

import { System, SystemPhase } from '../core/System';
import { World } from '../core/World';
import { SystemStage } from './SystemStage';
import { Logger, LogCategory } from '@shared-core/utils/Logger';

/**
 * Kolejność faz wykonania
 */
const PHASE_ORDER: SystemPhase[] = [
    SystemPhase.PRE_UPDATE,
    SystemPhase.PHYSICS,
    SystemPhase.UPDATE,
    SystemPhase.NETWORK,
    SystemPhase.RENDER,
    SystemPhase.POST_UPDATE,
    SystemPhase.CLEANUP
];

/**
 * Statystyki schedulera
 */
export interface SchedulerStats {
    totalSystems: number;
    byPhase: Record<SystemPhase, number>;
    executionTimes: Record<string, number>;
    lastFrameTime: number;
    averageFrameTime: number;
}

/**
 * Harmonogram systemów ECS
 */
export class SystemScheduler {
    private stages: Map<SystemPhase, SystemStage> = new Map();
    private executionTimes: Map<string, number[]> = new Map(); // system name -> times
    private logger: Logger;
    private lastFrameTime: number = 0;
    private frameTimes: number[] = [];
    private maxFrameHistory: number = 60;

    constructor() {
        this.logger = Logger.getInstance();
        this.initializeStages();
    }

    /**
     * Inicjalizuje wszystkie etapy
     */
    private initializeStages(): void {
        for (const phase of PHASE_ORDER) {
            this.stages.set(phase, new SystemStage(phase));
        }
    }

    /**
     * Rejestruje system w harmonogramie
     */
    registerSystem(system: System, phase: SystemPhase, priority: number = 0): void {
        let stage = this.stages.get(phase);
        
        if (!stage) {
            stage = new SystemStage(phase);
            this.stages.set(phase, stage);
        }

        stage.addSystem(system, priority);
        system.initialize(this.getWorld()); // Uwaga: to może być problem
        
        this.logger.info(LogCategory.ECS, `System ${system.name} zarejestrowany w fazie ${phase} z priorytetem ${priority}`);
    }

    /**
     * Wyrejestrowuje system
     */
    unregisterSystem(system: System): void {
        for (const stage of this.stages.values()) {
            if (stage.removeSystem(system)) {
                this.executionTimes.delete(system.name);
                break;
            }
        }
    }

    /**
     * Wykonuje wszystkie systemy we właściwej kolejności
     */
    execute(world: World, deltaTime: number, time: number): void {
        const frameStartTime = performance.now();

        for (const phase of PHASE_ORDER) {
            const stage = this.stages.get(phase);
            if (stage) {
                this.executeStage(stage, world, deltaTime, time);
            }
        }

        this.lastFrameTime = performance.now() - frameStartTime;
        this.frameTimes.push(this.lastFrameTime);
        
        if (this.frameTimes.length > this.maxFrameHistory) {
            this.frameTimes.shift();
        }

        // Loguj jeśli frame time jest za długi
        if (this.lastFrameTime > 33) { // > 30 FPS
            this.logger.warn(LogCategory.PERFORMANCE, `Frame time: ${this.lastFrameTime.toFixed(2)}ms`);
        }
    }

    /**
     * Wykonuje pojedynczy etap
     */
    private executeStage(stage: SystemStage, world: World, deltaTime: number, time: number): void {
        const stageStartTime = performance.now();
        
        stage.execute(world, deltaTime, time);
        
        const stageTime = performance.now() - stageStartTime;
        
        // Loguj jeśli etap trwa zbyt długo
        if (stageTime > 16) { // > 60 FPS dla pojedynczego etapu
            this.logger.debug(LogCategory.PERFORMANCE, `Stage ${stage.phase} time: ${stageTime.toFixed(2)}ms`);
        }
    }

    /**
     * Wykonuje tylko jedną fazę
     */
    executePhase(phase: SystemPhase, world: World, deltaTime: number, time: number): void {
        const stage = this.stages.get(phase);
        if (stage) {
            this.executeStage(stage, world, deltaTime, time);
        }
    }

    /**
     * Rejestruje czas wykonania systemu
     */
    recordExecutionTime(systemName: string, timeMs: number): void {
        if (!this.executionTimes.has(systemName)) {
            this.executionTimes.set(systemName, []);
        }

        const times = this.executionTimes.get(systemName)!;
        times.push(timeMs);

        // Ogranicz historię
        if (times.length > 100) {
            times.shift();
        }
    }

    /**
     * Pobiera średni czas wykonania systemu
     */
    getAverageExecutionTime(systemName: string): number {
        const times = this.executionTimes.get(systemName);
        if (!times || times.length === 0) return 0;

        const sum = times.reduce((a, b) => a + b, 0);
        return sum / times.length;
    }

    /**
     * Pobiera wszystkie systemy
     */
    getAllSystems(): System[] {
        const all: System[] = [];
        for (const stage of this.stages.values()) {
            all.push(...stage.getAllSystems());
        }
        return all;
    }

    /**
     * Pobiera systemy w fazie
     */
    getSystemsInPhase(phase: SystemPhase): System[] {
        const stage = this.stages.get(phase);
        return stage ? stage.getAllSystems() : [];
    }

    /**
     * Sprawdza czy system jest zarejestrowany
     */
    hasSystem(system: System): boolean {
        for (const stage of this.stages.values()) {
            if (stage.hasSystem(system)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Zatrzymuje wszystkie systemy
     */
    stopAll(): void {
        for (const stage of this.stages.values()) {
            stage.stopAll();
        }
        this.logger.info(LogCategory.ECS, 'Wszystkie systemy zatrzymane');
    }

    /**
     * Wznawia wszystkie systemy
     */
    startAll(): void {
        for (const stage of this.stages.values()) {
            stage.startAll();
        }
        this.logger.info(LogCategory.ECS, 'Wszystkie systemy wznowione');
    }

    /**
     * Czyści wszystkie systemy
     */
    clear(): void {
        this.stages.clear();
        this.executionTimes.clear();
        this.frameTimes = [];
        this.initializeStages();
        this.logger.info(LogCategory.ECS, 'Scheduler wyczyszczony');
    }

    /**
     * Statystyki schedulera
     */
    getStats(): SchedulerStats {
        const byPhase: Record<string, number> = {} as Record<SystemPhase, number>;
        const executionTimes: Record<string, number> = {};

        for (const phase of PHASE_ORDER) {
            byPhase[phase] = this.getSystemsInPhase(phase).length;
        }

        for (const [name] of this.executionTimes) {
            executionTimes[name] = this.getAverageExecutionTime(name);
        }

        const avgFrameTime = this.frameTimes.length > 0
            ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
            : 0;

        return {
            totalSystems: this.getAllSystems().length,
            byPhase: byPhase as Record<SystemPhase, number>,
            executionTimes,
            lastFrameTime: this.lastFrameTime,
            averageFrameTime: avgFrameTime
        };
    }

    /**
     * Tymczasowe - do zastąpienia prawdziwym world
     */
    private getWorld(): World {
        return null as any;
    }
}

/**
 * Profiler systemów - do debugowania
 */
export class SystemProfiler {
    private scheduler: SystemScheduler;
    private enabled: boolean = false;
    private profiles: Map<string, SystemProfile> = new Map();

    constructor(scheduler: SystemScheduler) {
        this.scheduler = scheduler;
    }

    enable(): void {
        this.enabled = true;
    }

    disable(): void {
        this.enabled = false;
    }

    startProfile(systemName: string): void {
        if (!this.enabled) return;

        const profile: SystemProfile = {
            systemName,
            calls: 0,
            totalTime: 0,
            minTime: Infinity,
            maxTime: 0,
            lastTime: 0
        };

        this.profiles.set(systemName, profile);
    }

    endProfile(systemName: string, timeMs: number): void {
        if (!this.enabled) return;

        let profile = this.profiles.get(systemName);
        if (!profile) {
            profile = {
                systemName,
                calls: 0,
                totalTime: 0,
                minTime: Infinity,
                maxTime: 0,
                lastTime: 0
            };
            this.profiles.set(systemName, profile);
        }

        profile.calls++;
        profile.totalTime += timeMs;
        profile.minTime = Math.min(profile.minTime, timeMs);
        profile.maxTime = Math.max(profile.maxTime, timeMs);
        profile.lastTime = timeMs;
    }

    getProfile(systemName: string): SystemProfile | undefined {
        return this.profiles.get(systemName);
    }

    getAllProfiles(): SystemProfile[] {
        return Array.from(this.profiles.values());
    }

    reset(): void {
        this.profiles.clear();
    }

    generateReport(): string {
        const profiles = this.getAllProfiles();
        profiles.sort((a, b) => b.totalTime - a.totalTime);

        let report = '=== SYSTEM PROFILER REPORT ===\n\n';
        
        for (const p of profiles) {
            const avgTime = p.totalTime / p.calls;
            report += `${p.systemName}:\n`;
            report += `  Calls: ${p.calls}\n`;
            report += `  Total: ${p.totalTime.toFixed(2)}ms\n`;
            report += `  Avg:   ${avgTime.toFixed(2)}ms\n`;
            report += `  Min:   ${p.minTime.toFixed(2)}ms\n`;
            report += `  Max:   ${p.maxTime.toFixed(2)}ms\n`;
            report += `  Last:  ${p.lastTime.toFixed(2)}ms\n\n`;
        }

        return report;
    }
}

/**
 * Profil systemu
 */
export interface SystemProfile {
    systemName: string;
    calls: number;
    totalTime: number;
    minTime: number;
    maxTime: number;
    lastTime: number;
}