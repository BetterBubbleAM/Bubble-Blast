/**
 * @file SnapshotSender.ts
 * @description Wysyłanie snapshotów do klientów
 */

import { ServerConfig } from '../bootstrap/ServerConfig';
import { WorldState } from '../core/WorldState';
import { WorldPlayer } from '../core/WorldState';
import { Vector2 } from '@shared-core/math/Vector2';
import { Logger, LogCategory } from '@shared-core/utils/Logger';
import { EntityId, PlayerId } from '@shared-core/types/EntityTypes';
import { BinaryWriter } from '@network-protocol/encoding/BinaryWriter';

/**
 | Snapshot encji
 */
export interface EntitySnapshot {
    id: EntityId;
    type: string;
    x: number;
    y: number;
    radius: number;
    mass: number;
    color: string;
    playerId?: string;
    playerName?: string;
}

/**
 | Snapshot gracza
 */
export interface PlayerSnapshot {
    id: PlayerId;
    name: string;
    cells: EntityId[];
    totalMass: number;
    score: number;
    color: string;
}

/**
 | Wysyłacz snapshotów
 */
export class SnapshotSender {
    private config: ServerConfig;
    private logger: Logger;
    
    private lastSnapshotTime: number = 0;
    private snapshotInterval: number;
    private snapshotCount: number = 0;
    private totalBytes: number = 0;

    constructor(config: ServerConfig) {
        this.config = config;
        this.logger = Logger.getInstance();
        this.snapshotInterval = 1000 / config.snapshotRate;
    }

    /**
     | Wysyła snapshot do wszystkich graczy
     */
    sendToAll(players: Map<PlayerId, WorldPlayer>, worldState: WorldState): void {
        const now = Date.now();
        
        // Rate limiting
        if (now - this.lastSnapshotTime < this.snapshotInterval) {
            return;
        }

        this.lastSnapshotTime = now;

        // Pobierz wszystkich graczy (klientów)
        const clients = Array.from(players.values()).filter(p => !p.isBot);
        
        for (const player of clients) {
            this.sendToPlayer(player, worldState);
        }
    }

    /**
     | Wysyła snapshot do konkretnego gracza
     */
    sendToPlayer(player: WorldPlayer, worldState: WorldState): void {
        // Pobierz wszystkie encje w zasięgu gracza
        const playerCells = worldState.getPlayerCells(player.id);
        
        if (playerCells.length === 0) return;

        // Środek gracza (średnia pozycja komórek)
        const center = this.calculatePlayerCenter(playerCells);
        
        // Pobierz encje w zasięgu widzenia
        const viewRadius = this.calculateViewRadius(player.totalMass);
        const entities = worldState.getEntitiesInArea(center, viewRadius);

        // Stwórz snapshot
        const snapshot = {
            frame: worldState['tick'],
            timestamp: Date.now(),
            player: this.createPlayerSnapshot(player, playerCells),
            entities: this.createEntitySnapshots(entities, player.id),
            count: entities.length
        };

        // Serializuj i wyślij
        const data = this.serializeSnapshot(snapshot);
        
        // TODO: wysłanie przez SessionManager
        // sessionManager.sendToPlayer(player.id, data);

        this.snapshotCount++;
        this.totalBytes += data.length;
    }

    /**
     | Oblicza środek gracza
     */
    private calculatePlayerCenter(cells: any[]): Vector2 {
        if (cells.length === 0) return new Vector2(0, 0);
        
        let sumX = 0, sumY = 0;
        for (const cell of cells) {
            sumX += cell.body.position.x;
            sumY += cell.body.position.y;
        }
        
        return new Vector2(
            sumX / cells.length,
            sumY / cells.length
        );
    }

    /**
     | Oblicza promień widzenia
     */
    private calculateViewRadius(playerMass: number): number {
        // Im większy gracz, tym większy zasięg widzenia
        return 1000 + playerMass * 2;
    }

    /**
     | Tworzy snapshot gracza
     */
    private createPlayerSnapshot(player: WorldPlayer, cells: any[]): PlayerSnapshot {
        return {
            id: player.id,
            name: player.name,
            cells: cells.map(c => c.id),
            totalMass: player.totalMass,
            score: player.score,
            color: player.color
        };
    }

    /**
     | Tworzy snapshoty encji
     */
    private createEntitySnapshots(entities: any[], playerId: PlayerId): EntitySnapshot[] {
        return entities
            .filter(e => {
                // Filtruj własne komórki gracza (będą w osobnym polu)
                if (e.type === 'cell' && e.owner.id === playerId) {
                    return false;
                }
                return true;
            })
            .map(e => ({
                id: e.id,
                type: e.type,
                x: e.body.position.x,
                y: e.body.position.y,
                radius: e.body.radius,
                mass: e.body.mass,
                color: e.metadata.get('color') || '#FFFFFF',
                playerId: e.owner.type === 'player' ? e.owner.id : undefined,
                playerName: e.owner.type === 'player' ? this.getPlayerName(e.owner.id) : undefined
            }));
    }

    /**
     | Pobiera nazwę gracza
     */
    private getPlayerName(playerId: string): string | undefined {
        // TODO: dostęp do listy graczy
        return undefined;
    }

    /**
     | Serializuje snapshot do binarnego formatu
     */
    private serializeSnapshot(snapshot: any): Uint8Array {
        const writer = new BinaryWriter(1024);
        
        // Nagłówek
        writer.writeUint32(0x534E4150); // "SNAP"
        writer.writeUint32(snapshot.frame);
        writer.writeUint64(BigInt(snapshot.timestamp));
        
        // Gracz
        writer.writeString(snapshot.player.id);
        writer.writeString(snapshot.player.name);
        writer.writeFloat32(snapshot.player.totalMass);
        writer.writeUint16(snapshot.player.score);
        writer.writeString(snapshot.player.color);
        
        // Komórki gracza
        writer.writeUint16(snapshot.player.cells.length);
        for (const cellId of snapshot.player.cells) {
            writer.writeUint32(cellId);
        }

        // Inne encje
        writer.writeUint16(snapshot.entities.length);
        for (const entity of snapshot.entities) {
            writer.writeUint32(entity.id);
            writer.writeByte(this.getEntityTypeCode(entity.type));
            writer.writeFloat32(entity.x);
            writer.writeFloat32(entity.y);
            writer.writeUint16(Math.floor(entity.radius));
            writer.writeUint16(Math.floor(entity.mass));
            writer.writeString(entity.color);
            
            // Opcjonalne dane gracza
            if (entity.playerId) {
                writer.writeByte(1);
                writer.writeString(entity.playerId);
                writer.writeString(entity.playerName || '');
            } else {
                writer.writeByte(0);
            }
        }

        return writer.toBuffer();
    }

    /**
     | Kod typu encji
     */
    private getEntityTypeCode(type: string): number {
        const codes: Record<string, number> = {
            'cell': 1,
            'virus': 2,
            'pellet': 3,
            'player': 4
        };
        return codes[type] || 0;
    }

    /**
     | Pobiera statystyki
     */
    getStats(): SnapshotStats {
        return {
            snapshotCount: this.snapshotCount,
            totalBytes: this.totalBytes,
            averageSize: this.snapshotCount > 0 ? this.totalBytes / this.snapshotCount : 0,
            snapshotRate: this.config.snapshotRate
        };
    }

    /**
     | Resetuje statystyki
     */
    resetStats(): void {
        this.snapshotCount = 0;
        this.totalBytes = 0;
    }
}

/**
 | Statystyki snapshotów
 */
export interface SnapshotStats {
    snapshotCount: number;
    totalBytes: number;
    averageSize: number;
    snapshotRate: number;
}