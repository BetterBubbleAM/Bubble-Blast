/**
 * @file EatingSystem.ts
 * @description System zjadania - mniejsze komórki są zjadane przez większe
 */

import { WorldState } from '../core/WorldState';
import { EventEmitter } from '@shared-core/events/EventEmitter';
import { Logger, LogCategory } from '@shared-core/utils/Logger';
import { CellBody } from '@physics-engine/bodies/CellBody';
import { VirusBody } from '@physics-engine/bodies/VirusBody';
import { PelletBody } from '@physics-engine/bodies/PelletBody';
import { GAMEPLAY_CONSTANTS } from '@shared-core/constants/GameplayConstants';

/**
 | System zjadania
 */
export class EatingSystem {
    private worldState: WorldState;
    private eventEmitter: EventEmitter;
    private logger: Logger;
    
    private eatCount: number = 0;
    private massTransferred: number = 0;

    constructor(worldState: WorldState, eventEmitter: EventEmitter) {
        this.worldState = worldState;
        this.eventEmitter = eventEmitter;
        this.logger = Logger.getInstance();
    }

    /**
     | Aktualizuje system zjadania
     */
    update(deltaTime: number): void {
        const entities = this.worldState.getAllEntities();
        const cells = entities.filter(e => e.type === 'cell');
        const pellets = entities.filter(e => e.type === 'pellet');
        const viruses = entities.filter(e => e.type === 'virus');

        // Komórki zjadają pellety
        this.processPelletEating(cells, pellets);

        // Komórki zjadają inne komórki
        this.processCellEating(cells);

        // Komórki zjadają wirusy (specjalny przypadek)
        this.processVirusInteraction(cells, viruses);
    }

    /**
     | Przetwarza zjadanie pelletów
     */
    private processPelletEating(cells: any[], pellets: any[]): void {
        for (const cell of cells) {
            const cellBody = cell.body as CellBody;
            
            for (const pellet of pellets) {
                const pelletBody = pellet.body as PelletBody;
                
                // Sprawdź kolizję
                if (this.checkCollision(cellBody, pelletBody)) {
                    this.eatPellet(cell, pellet);
                }
            }
        }
    }

    /**
     | Przetwarza zjadanie komórek
     */
    private processCellEating(cells: any[]): void {
        for (let i = 0; i < cells.length; i++) {
            for (let j = i + 1; j < cells.length; j++) {
                const cellA = cells[i].body as CellBody;
                const cellB = cells[j].body as CellBody;
                
                // Sprawdź czy mogą się zjeść
                if (this.canEat(cellA, cellB)) {
                    this.eatCell(cells[i], cells[j]);
                } else if (this.canEat(cellB, cellA)) {
                    this.eatCell(cells[j], cells[i]);
                }
            }
        }
    }

    /**
     | Przetwarza interakcje z wirusami
     */
    private processVirusInteraction(cells: any[], viruses: any[]): void {
        for (const cell of cells) {
            const cellBody = cell.body as CellBody;
            
            for (const virus of viruses) {
                const virusBody = virus.body as VirusBody;
                
                if (this.checkCollision(cellBody, virusBody)) {
                    this.handleVirusCollision(cell, virus);
                }
            }
        }
    }

    /**
     | Sprawdza czy komórka może zjeść drugą
     */
    private canEat(predator: CellBody, prey: CellBody): boolean {
        // Sprawdź czy to ten sam gracz
        if (this.samePlayer(predator, prey)) {
            return false;
        }

        // Sprawdź rozmiar (musi być większy o określony współczynnik)
        const sizeRatio = predator.radius / prey.radius;
        return sizeRatio >= GAMEPLAY_CONSTANTS.EAT_SIZE_RATIO;
    }

    /**
     | Sprawdza czy dwie komórki należą do tego samego gracza
     */
    private samePlayer(cellA: CellBody, cellB: CellBody): boolean {
        const entityA = this.worldState.getEntity(cellA.id);
        const entityB = this.worldState.getEntity(cellB.id);
        
        if (!entityA || !entityB) return false;
        
        return entityA.owner.id === entityB.owner.id;
    }

    /**
     | Komórka zjada pellet
     */
    private eatPellet(cellEntity: any, pelletEntity: any): void {
        const cell = cellEntity.body as CellBody;
        const pellet = pelletEntity.body as PelletBody;

        // Dodaj masę
        cell.addMass(pellet.mass);
        
        // Usuń pellet
        this.worldState.removeEntity(pellet.id);
        
        this.eatCount++;
        this.massTransferred += pellet.mass;

        // Emituj zdarzenie
        this.eventEmitter.emit({
            type: 'game:cell:eaten',
            timestamp: Date.now(),
            predatorId: cell.id,
            preyId: pellet.id,
            preyType: 'pellet',
            massTransferred: pellet.mass
        });

        if (this.logger['config'].level <= 1) {
            this.logger.debug(LogCategory.GAMEPLAY, 
                `Pellet eaten by cell ${cell.id}`);
        }
    }

    /**
     | Komórka zjada inną komórkę
     */
    private eatCell(predatorEntity: any, preyEntity: any): void {
        const predator = predatorEntity.body as CellBody;
        const prey = preyEntity.body as CellBody;

        // Oblicz masę do przekazania
        const massToTransfer = prey.mass * GAMEPLAY_CONSTANTS.EAT_MASS_RATIO;
        
        // Dodaj masę drapieżnikowi
        predator.addMass(massToTransfer);
        
        // Usuń ofiarę
        this.worldState.removeEntity(prey.id);
        
        this.eatCount++;
        this.massTransferred += massToTransfer;

        // Emituj zdarzenie
        this.eventEmitter.emit({
            type: 'game:cell:eaten',
            timestamp: Date.now(),
            predatorId: predator.id,
            preyId: prey.id,
            preyType: 'player',
            massTransferred: massToTransfer
        });

        this.logger.info(LogCategory.GAMEPLAY, 
            `Cell ${predator.id} ate cell ${prey.id}`);
    }

    /**
     | Obsługuje kolizję z wirusem
     */
    private handleVirusCollision(cellEntity: any, virusEntity: any): void {
        const cell = cellEntity.body as CellBody;
        const virus = virusEntity.body as VirusBody;

        // Sprawdź czy komórka może zjeść wirusa
        if (cell.mass > virus.mass * 1.2) {
            // Komórka zjada wirusa - wirus eksploduje
            this.virusEaten(cellEntity, virusEntity);
        } else {
            // Wirus zabija komórkę (jeśli jest większy)
            this.cellEatenByVirus(cellEntity, virusEntity);
        }
    }

    /**
     | Wirus zjedzony przez komórkę
     */
    private virusEaten(cellEntity: any, virusEntity: any): void {
        const cell = cellEntity.body as CellBody;
        const virus = virusEntity.body as VirusBody;

        // Dodaj masę
        cell.addMass(virus.mass);
        
        // Wirus eksploduje (tworzy nowe wirusy)
        const newViruses = virus.pop();
        
        // Usuń starego wirusa
        this.worldState.removeEntity(virus.id);
        
        // Dodaj nowe wirusy
        for (const newVirus of newViruses) {
            this.worldState.createVirus(
                newVirus.position,
                newVirus.radius,
                newVirus.mass
            );
        }

        this.eventEmitter.emit({
            type: 'game:virus:popped',
            timestamp: Date.now(),
            virusId: virus.id,
            position: virus.position,
            newViruses: newViruses.map(v => v.id)
        });
    }

    /**
     | Komórka zjedzona przez wirusa
     */
    private cellEatenByVirus(cellEntity: any, virusEntity: any): void {
        const cell = cellEntity.body as CellBody;
        const virus = virusEntity.body as VirusBody;

        // Usuń komórkę
        this.worldState.removeEntity(cell.id);
        
        // Wirus rośnie
        virus.startGrowing();

        this.logger.info(LogCategory.GAMEPLAY, 
            `Cell ${cell.id} killed by virus ${virus.id}`);
    }

    /**
     | Sprawdza kolizję między dwoma ciałami
     */
    private checkCollision(bodyA: any, bodyB: any): boolean {
        const dx = bodyB.position.x - bodyA.position.x;
        const dy = bodyB.position.y - bodyA.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const radiiSum = bodyA.radius + bodyB.radius;
        
        return distance < radiiSum;
    }

    /**
     | Pobiera statystyki
     */
    getStats(): EatingStats {
        return {
            eatCount: this.eatCount,
            massTransferred: this.massTransferred
        };
    }

    /**
     | Resetuje system
     */
    reset(): void {
        this.eatCount = 0;
        this.massTransferred = 0;
    }
}

/**
 | Statystyki zjadania
 */
export interface EatingStats {
    eatCount: number;
    massTransferred: number;
}