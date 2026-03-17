/**
 * @file BotController.ts
 * @description Kontroler botów - AI dla przeciwników
 */

import { WorldState } from '../core/WorldState';
import { ServerEntity } from '../core/EntityRegistry';
import { CellBody } from '@physics-engine/bodies/CellBody';
import { Vector2 } from '@shared-core/math/Vector2';
import { Random } from '@shared-core/math/Random';
import { GAMEPLAY_CONSTANTS } from '@shared-core/constants/GameplayConstants';
import { Logger, LogCategory } from '@shared-core/utils/Logger';

/**
 | Poziom trudności bota
 */
export enum BotDifficulty {
    EASY = 'easy',
    MEDIUM = 'medium',
    HARD = 'hard'
}

/**
 | Stan bota
 */
interface BotState {
    id: string;
    entityId: number;
    difficulty: BotDifficulty;
    targetPosition: Vector2;
    targetEntity?: ServerEntity;
    lastAction: number;
    actionCooldown: number;
    personality: BotPersonality;
}

/**
 | Osobowość bota
 */
interface BotPersonality {
    aggressiveness: number;  // 0-1 (agresywny vs pasywny)
    greediness: number;      // 0-1 (łakomstwo)
    caution: number;         // 0-1 (ostrożność)
    grouping: number;        // 0-1 (skłonność do grupowania)
}

/**
 | Kontroler botów
 */
export class BotController {
    private worldState: WorldState;
    private bots: Map<string, BotState> = new Map();
    private difficulty: BotDifficulty;
    private targetCount: number;
    private logger: Logger;
    
    private updateInterval: number = 100; // ms
    private lastUpdate: number = 0;

    constructor(
        worldState: WorldState,
        targetCount: number = 20,
        difficulty: BotDifficulty = BotDifficulty.MEDIUM
    ) {
        this.worldState = worldState;
        this.targetCount = targetCount;
        this.difficulty = difficulty;
        this.logger = Logger.getInstance();
    }

    /**
     | Spawnuje boty
     */
    spawnBots(): void {
        const count = this.targetCount - this.bots.size;
        
        for (let i = 0; i < count; i++) {
            this.spawnBot();
        }

        this.logger.info(LogCategory.GAMEPLAY, `Spawned ${count} bots`);
    }

    /**
     | Spawnuje pojedynczego bota
     */
    private spawnBot(): void {
        const botId = `bot_${Date.now()}_${Random.rangeInt(1000, 9999)}`;
        
        // Generuj pozycję
        const position = new Vector2(
            Random.range(100, GAMEPLAY_CONSTANTS.WORLD_WIDTH - 100),
            Random.range(100, GAMEPLAY_CONSTANTS.WORLD_HEIGHT - 100)
        );

        // Generuj masę i kolor
        const mass = Random.range(
            GAMEPLAY_CONSTANTS.INITIAL_MASS * 2,
            GAMEPLAY_CONSTANTS.INITIAL_MASS * 10
        );
        
        const color = Random.nextFromArray(GAMEPLAY_CONSTANTS.DEFAULT_PLAYER_COLORS);

        // Stwórz komórkę
        const cell = this.worldState.createPlayerCell(
            botId,
            position,
            Math.sqrt(mass / Math.PI) * 2,
            mass,
            color
        );

        // Stwórz stan bota
        const botState: BotState = {
            id: botId,
            entityId: cell.id,
            difficulty: this.difficulty,
            targetPosition: this.getRandomTarget(),
            lastAction: Date.now(),
            actionCooldown: Random.range(1000, 3000),
            personality: this.generatePersonality()
        };

        this.bots.set(botId, botState);
    }

    /**
     | Generuje osobowość bota
     */
    private generatePersonality(): BotPersonality {
        switch (this.difficulty) {
            case BotDifficulty.EASY:
                return {
                    aggressiveness: Random.range(0.1, 0.4),
                    greediness: Random.range(0.3, 0.6),
                    caution: Random.range(0.5, 0.8),
                    grouping: Random.range(0.2, 0.5)
                };
                
            case BotDifficulty.MEDIUM:
                return {
                    aggressiveness: Random.range(0.3, 0.7),
                    greediness: Random.range(0.4, 0.7),
                    caution: Random.range(0.3, 0.6),
                    grouping: Random.range(0.3, 0.6)
                };
                
            case BotDifficulty.HARD:
                return {
                    aggressiveness: Random.range(0.5, 0.9),
                    greediness: Random.range(0.6, 0.9),
                    caution: Random.range(0.2, 0.4),
                    grouping: Random.range(0.1, 0.3)
                };
        }
    }

    /**
     | Aktualizuje boty
     */
    update(deltaTime: number): void {
        const now = Date.now();
        
        if (now - this.lastUpdate < this.updateInterval) return;
        this.lastUpdate = now;

        // Uzupełnij brakujące boty
        if (this.bots.size < this.targetCount) {
            this.spawnBots();
        }

        // Aktualizuj każdego bota
        for (const bot of this.bots.values()) {
            this.updateBot(bot, deltaTime);
        }
    }

    /**
     | Aktualizuje pojedynczego bota
     */
    private updateBot(bot: BotState, deltaTime: number): void {
        const entity = this.worldState.getEntity(bot.entityId);
        if (!entity) {
            // Bot został zjedzony - respawn
            this.bots.delete(bot.id);
            this.spawnBot();
            return;
        }

        const cell = entity.body as CellBody;

        // Znajdź cel
        this.findTarget(bot, cell);

        // Wykonaj akcję
        this.performAction(bot, cell);

        // Ruch w kierunku celu
        this.moveTowardsTarget(bot, cell);
    }

    /**
     | Znajduje cel dla bota
     */
    private findTarget(bot: BotState, cell: CellBody): void {
        const entities = this.worldState.getEntitiesInArea(
            cell.position,
            500 // Zasięg widzenia
        );

        let bestTarget: ServerEntity | null = null;
        let bestScore = -Infinity;

        for (const entity of entities) {
            if (entity.id === bot.entityId) continue;
            
            const score = this.evaluateTarget(bot, cell, entity);
            if (score > bestScore) {
                bestScore = score;
                bestTarget = entity;
            }
        }

        if (bestTarget) {
            bot.targetEntity = bestTarget;
            bot.targetPosition = bestTarget.body.position.clone();
        } else {
            // Brak celu - losowy ruch
            bot.targetEntity = undefined;
            bot.targetPosition = this.getRandomTarget();
        }
    }

    /**
     | Ocenia potencjalny cel
     */
    private evaluateTarget(bot: BotState, cell: CellBody, target: ServerEntity): number {
        let score = 0;

        if (target.type === 'pellet') {
            // Pellety - zawsze dobre
            score += 10 * bot.personality.greediness;
        } 
        else if (target.type === 'cell') {
            const targetCell = target.body as CellBody;
            const sizeRatio = cell.radius / targetCell.radius;

            // Może zjeść
            if (sizeRatio >= GAMEPLAY_CONSTANTS.EAT_SIZE_RATIO) {
                score += 20 * bot.personality.aggressiveness;
            }
            // Może być zjedzony
            else if (1 / sizeRatio >= GAMEPLAY_CONSTANTS.EAT_SIZE_RATIO) {
                score -= 30 * bot.personality.caution;
            }
            // Podobny rozmiar - unikaj
            else {
                score -= 10 * bot.personality.caution;
            }
        }
        else if (target.type === 'virus') {
            // Unikaj wirusów
            score -= 40 * bot.personality.caution;
        }

        // Odległość
        const distance = cell.position.distanceTo(target.body.position);
        score += (1000 - distance) / 100;

        return score;
    }

    /**
     | Wykonuje akcję (split/merge)
     */
    private performAction(bot: BotState, cell: CellBody): void {
        const now = Date.now();
        
        if (now - bot.lastAction < bot.actionCooldown) return;

        // Split gdy cel jest blisko i jest większy
        if (bot.targetEntity && bot.targetEntity.type === 'cell') {
            const targetCell = bot.targetEntity.body as CellBody;
            const distance = cell.position.distanceTo(targetCell.position);
            
            if (distance < 200 && cell.mass > targetCell.mass * 1.5) {
                // TODO: wykonaj split
                bot.lastAction = now;
                bot.actionCooldown = Random.range(2000, 5000);
            }
        }
    }

    /**
     | Ruch w kierunku celu
     */
    private moveTowardsTarget(bot: BotState, cell: CellBody): void {
        const direction = bot.targetPosition.subtracted(cell.position);
        const distance = direction.length();

        if (distance < 10) {
            bot.targetPosition = this.getRandomTarget();
            return;
        }

        // Oblicz prędkość
        const speed = this.calculateSpeed(cell.mass, bot.personality);
        const normalizedDir = direction.normalized();
        
        cell.setVelocity(
            normalizedDir.x * speed,
            normalizedDir.y * speed
        );
    }

    /**
     | Oblicza prędkość bota
     */
    private calculateSpeed(mass: number, personality: BotPersonality): number {
        const baseSpeed = GAMEPLAY_CONSTANTS.BASE_SPEED / (1 + mass / 200);
        
        // Bardziej agresywne boty są szybsze
        const speedMultiplier = 0.8 + personality.aggressiveness * 0.4;
        
        return Math.min(baseSpeed * speedMultiplier, GAMEPLAY_CONSTANTS.MAX_SPEED);
    }

    /**
     | Losowy cel
     */
    private getRandomTarget(): Vector2 {
        return new Vector2(
            Random.range(100, GAMEPLAY_CONSTANTS.WORLD_WIDTH - 100),
            Random.range(100, GAMEPLAY_CONSTANTS.WORLD_HEIGHT - 100)
        );
    }

    /**
     | Pobiera statystyki
     */
    getStats(): BotStats {
        return {
            count: this.bots.size,
            targetCount: this.targetCount,
            difficulty: this.difficulty,
            updateInterval: this.updateInterval
        };
    }

    /**
     | Resetuje boty
     */
    reset(): void {
        // Usuń wszystkich botów
        for (const bot of this.bots.values()) {
            this.worldState.removeEntity(bot.entityId);
        }
        
        this.bots.clear();
        this.spawnBots();
    }
}

/**
 | Statystyki botów
 */
export interface BotStats {
    count: number;
    targetCount: number;
    difficulty: BotDifficulty;
    updateInterval: number;
}