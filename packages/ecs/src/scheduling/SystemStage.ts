/**
 * @file SystemStage.ts
 * @description Etap wykonania systemów z priorytetami
 */

import { System, SystemPhase } from '../core/System';
import { World } from '../core/World';
import { Logger, LogCategory } from '@shared-core/utils/Logger';

/**
 * Kolejka systemów do wykonania
 */
export class SystemStage {
    public readonly phase: SystemPhase;
    private systems: Map<number, Set<System>> = new Map(); // priority -> systems
    private sortedPriorities: number[] = [];
    private isDirty: boolean = true;
    private logger: Logger;

    constructor(phase: SystemPhase) {
        this.phase = phase;
        this.logger = Logger.getInstance();
    }

    /**
     * Dodaje system do etapu
     */
    addSystem(system: System, priority: number = 0): void {
        if (!this.systems.has(priority)) {
            this.systems.set(priority, new Set());
            this.isDirty = true;
        }

        this.systems.get(priority)!.add(system);
        this.logger.debug(LogCategory.ECS, `System ${system.name} dodany do etapu ${this.phase} z priorytetem ${priority}`);
    }

    /**
     * Usuwa system z etapu
     */
    removeSystem(system: System): boolean {
        let removed = false;

        for (const [priority, systemSet] of this.systems.entries()) {
            if (systemSet.delete(system)) {
                removed = true;
                if (systemSet.size === 0) {
                    this.systems.delete(priority);
                }
                this.isDirty = true;
                break;
            }
        }

        if (removed) {
            this.logger.debug(LogCategory.ECS, `System ${system.name} usunięty z etapu ${this.phase}`);
        }

        return removed;
    }

    /**
     * Wykonuje wszystkie systemy w etapie
     */
    execute(world: World, deltaTime: number, time: number): void {
        if (this.isDirty) {
            this.updatePriorities();
        }

        const startTime = performance.now();

        for (const priority of this.sortedPriorities) {
            const systemSet = this.systems.get(priority);
            if (!systemSet) continue;

            for (const system of systemSet) {
                if (!system.isActive()) continue;

                const systemStartTime = performance.now();
                
                try {
                    system.preExecute(world);
                    system.execute(world, deltaTime, time);
                } catch (error) {
                    this.logger.error(LogCategory.ECS, `Błąd w systemie ${system.name}: ${error}`);
                }

                const systemTime = performance.now() - systemStartTime;
                if (systemTime > 16) { // więcej niż 16ms
                    this.logger.warn(LogCategory.ECS, `System ${system.name} wykonuje się zbyt długo: ${systemTime.toFixed(2)}ms`);
                }
            }
        }

        const totalTime = performance.now() - startTime;
        if (totalTime > 33) { // więcej niż 33ms (30 FPS)
            this.logger.warn(LogCategory.ECS, `Etap ${this.phase} wykonuje się zbyt długo: ${totalTime.toFixed(2)}ms`);
        }
    }

    /**
     * Aktualizuje posortowane priorytety
     */
    private updatePriorities(): void {
        this.sortedPriorities = Array.from(this.systems.keys())
            .sort((a, b) => b - a); // malejąco (wyższy priorytet = wcześniej)
        this.isDirty = false;
    }

    /**
     * Sprawdza czy etap zawiera system
     */
    hasSystem(system: System): boolean {
        for (const systemSet of this.systems.values()) {
            if (systemSet.has(system)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Zwraca wszystkie systemy w etapie
     */
    getAllSystems(): System[] {
        const all: System[] = [];
        for (const systemSet of this.systems.values()) {
            all.push(...systemSet);
        }
        return all;
    }

    /**
     * Liczba systemów w etapie
     */
    getSystemCount(): number {
        let count = 0;
        for (const systemSet of this.systems.values()) {
            count += systemSet.size;
        }
        return count;
    }

    /**
     * Czyści wszystkie systemy
     */
    clear(): void {
        this.systems.clear();
        this.sortedPriorities = [];
        this.isDirty = true;
        this.logger.debug(LogCategory.ECS, `Etap ${this.phase} wyczyszczony`);
    }

    /**
     * Zatrzymuje wszystkie systemy
     */
    stopAll(): void {
        for (const systemSet of this.systems.values()) {
            for (const system of systemSet) {
                system.disable();
            }
        }
    }

    /**
     * Wznawia wszystkie systemy
     */
    startAll(): void {
        for (const systemSet of this.systems.values()) {
            for (const system of systemSet) {
                system.enable();
            }
        }
    }

    /**
     * Statystyki etapu
     */
    getStats(): SystemStageStats {
        return {
            phase: this.phase,
            systemCount: this.getSystemCount(),
            priorityLevels: this.systems.size
        };
    }
}

/**
 * Statystyki etapu systemów
 */
export interface SystemStageStats {
    phase: SystemPhase;
    systemCount: number;
    priorityLevels: number;
}