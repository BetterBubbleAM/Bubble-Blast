/**
 * @file SnapshotDelta.ts
 * @description Kompresja różnicowa snapshotów
 */

import { Snapshot, SnapshotEntity, SnapshotPlayer, SnapshotDiff } from './Snapshot';
import { Vector2 } from '@shared-core/math/Vector2';
import { EntityId, PlayerId } from '@shared-core/types/EntityTypes';

/**
 | Zakodowana różnica
 */
export interface EncodedDelta {
    baseSequence: number;
    targetSequence: number;
    added: SerializedEntity[];
    removed: EntityId[];
    updated: SerializedUpdate[];
    players: SerializedPlayerDelta[];
}

/**
 | Zserializowana encja
 */
export interface SerializedEntity {
    id: EntityId;
    type: string;
    x: number;
    y: number;
    r: number;      // radius
    m: number;      // mass
    c: string;      // color
    vx?: number;    // velocity x
    vy?: number;    // velocity y
    f: number;      // flags
    p?: string;     // playerId
    n?: string;     // playerName
}

/**
 | Zserializowana aktualizacja
 */
export interface SerializedUpdate {
    id: EntityId;
    mask: number;   // bit mask of changed fields
    x?: number;
    y?: number;
    r?: number;
    m?: number;
    c?: string;
    vx?: number;
    vy?: number;
    f?: number;
}

/**
 | Różnica gracza
 */
export interface SerializedPlayerDelta {
    id: PlayerId;
    mask: number;
    cells?: EntityId[];
    mass?: number;
    score?: number;
    rank?: number;
    alive?: boolean;
}

/**
 | Enkoder różnicowy snapshotów
 */
export class SnapshotDeltaEncoder {
    /**
     | Enkoduje różnicę między snapshotami
     */
    encode(base: Snapshot, target: Snapshot): EncodedDelta {
        const diff = target.compare(base);
        
        return {
            baseSequence: base.sequence,
            targetSequence: target.sequence,
            added: diff.added.map(e => this.serializeEntity(e)),
            removed: diff.removed,
            updated: diff.updated.map(e => this.serializeUpdate(e, base.getEntity(e.id))),
            players: this.encodePlayers(base, target)
        };
    }

    /**
     | Dekoduje różnicę do snapshotu
     */
    decode(base: Snapshot, delta: EncodedDelta): Snapshot {
        const target = base.clone();
        target.sequence = delta.targetSequence;
        target.timestamp = Date.now();

        // Usuń encje
        for (const id of delta.removed) {
            target.entities.delete(id);
        }

        // Zaktualizuj encje
        for (const update of delta.updated) {
            const entity = target.getEntity(update.id);
            if (entity) {
                this.applyUpdate(entity, update);
            }
        }

        // Dodaj nowe encje
        for (const serialized of delta.added) {
            const entity = this.deserializeEntity(serialized);
            target.addEntity(entity);
        }

        // Aktualizuj graczy
        this.decodePlayers(target, delta.players);

        return target;
    }

    /**
     | Serializuje encję do kompaktowej formy
     */
    private serializeEntity(entity: SnapshotEntity): SerializedEntity {
        return {
            id: entity.id,
            type: entity.type,
            x: entity.position.x,
            y: entity.position.y,
            r: entity.radius,
            m: entity.mass,
            c: entity.color,
            vx: entity.velocity?.x,
            vy: entity.velocity?.y,
            f: entity.flags,
            p: entity.playerId,
            n: entity.playerName
        };
    }

    /**
     | Deserializuje encję
     */
    private deserializeEntity(serialized: SerializedEntity): SnapshotEntity {
        return {
            id: serialized.id,
            type: serialized.type as any,
            position: new Vector2(serialized.x, serialized.y),
            radius: serialized.r,
            mass: serialized.m,
            color: serialized.c,
            velocity: serialized.vx !== undefined && serialized.vy !== undefined
                ? new Vector2(serialized.vx, serialized.vy)
                : undefined,
            flags: serialized.f,
            playerId: serialized.p,
            playerName: serialized.n,
            version: 0
        };
    }

    /**
     | Tworzy różnicową aktualizację
     */
    private serializeUpdate(current: SnapshotEntity, previous?: SnapshotEntity): SerializedUpdate {
        let mask = 0;
        const update: SerializedUpdate = { id: current.id, mask: 0 };

        if (!previous) {
            // Jeśli nie ma poprzedniej, to właściwie powinno być w added
            mask = 0xFFFF;
            update.x = current.position.x;
            update.y = current.position.y;
            update.r = current.radius;
            update.m = current.mass;
            update.c = current.color;
            update.f = current.flags;
        } else {
            // Porównaj z poprzednią
            if (!this.vectorsEqual(previous.position, current.position)) {
                mask |= 1 << 0;
                update.x = current.position.x;
                update.y = current.position.y;
            }
            
            if (previous.radius !== current.radius) {
                mask |= 1 << 1;
                update.r = current.radius;
            }
            
            if (previous.mass !== current.mass) {
                mask |= 1 << 2;
                update.m = current.mass;
            }
            
            if (previous.color !== current.color) {
                mask |= 1 << 3;
                update.c = current.color;
            }
            
            if (previous.velocity && current.velocity && 
                !this.vectorsEqual(previous.velocity, current.velocity)) {
                mask |= 1 << 4;
                update.vx = current.velocity.x;
                update.vy = current.velocity.y;
            }
            
            if (previous.flags !== current.flags) {
                mask |= 1 << 5;
                update.f = current.flags;
            }
        }

        update.mask = mask;
        return update;
    }

    /**
     | Aplikuje aktualizację do encji
     */
    private applyUpdate(entity: SnapshotEntity, update: SerializedUpdate): void {
        if (update.mask & (1 << 0)) {
            entity.position.x = update.x!;
            entity.position.y = update.y!;
        }
        if (update.mask & (1 << 1)) {
            entity.radius = update.r!;
        }
        if (update.mask & (1 << 2)) {
            entity.mass = update.m!;
        }
        if (update.mask & (1 << 3)) {
            entity.color = update.c!;
        }
        if (update.mask & (1 << 4)) {
            if (!entity.velocity) {
                entity.velocity = new Vector2(update.vx!, update.vy!);
            } else {
                entity.velocity.x = update.vx!;
                entity.velocity.y = update.vy!;
            }
        }
        if (update.mask & (1 << 5)) {
            entity.flags = update.f!;
        }
        
        entity.version++;
    }

    /**
     | Enkoduje różnice graczy
     */
    private encodePlayers(base: Snapshot, target: Snapshot): SerializedPlayerDelta[] {
        const deltas: SerializedPlayerDelta[] = [];

        for (const [id, player] of target.players) {
            const prevPlayer = base.players.get(id);
            
            if (!prevPlayer) {
                // Nowy gracz - wyślij wszystko
                deltas.push({
                    id,
                    mask: 0xFFFF,
                    cells: player.cells,
                    mass: player.totalMass,
                    score: player.score,
                    rank: player.rank,
                    alive: player.isAlive
                });
            } else {
                let mask = 0;
                const delta: SerializedPlayerDelta = { id, mask: 0 };

                if (!this.arraysEqual(prevPlayer.cells, player.cells)) {
                    mask |= 1 << 0;
                    delta.cells = player.cells;
                }
                if (prevPlayer.totalMass !== player.totalMass) {
                    mask |= 1 << 1;
                    delta.mass = player.totalMass;
                }
                if (prevPlayer.score !== player.score) {
                    mask |= 1 << 2;
                    delta.score = player.score;
                }
                if (prevPlayer.rank !== player.rank) {
                    mask |= 1 << 3;
                    delta.rank = player.rank;
                }
                if (prevPlayer.isAlive !== player.isAlive) {
                    mask |= 1 << 4;
                    delta.alive = player.isAlive;
                }

                if (mask !== 0) {
                    delta.mask = mask;
                    deltas.push(delta);
                }
            }
        }

        return deltas;
    }

    /**
     | Dekoduje różnice graczy
     */
    private decodePlayers(snapshot: Snapshot, deltas: SerializedPlayerDelta[]): void {
        for (const delta of deltas) {
            let player = snapshot.players.get(delta.id);
            
            if (!player) {
                // Nowy gracz - utwórz
                player = {
                    id: delta.id,
                    name: '',
                    cells: delta.cells || [],
                    totalMass: delta.mass || 0,
                    score: delta.score || 0,
                    rank: delta.rank || 0,
                    color: '',
                    isAlive: delta.alive ?? true
                };
                snapshot.players.set(delta.id, player);
            } else {
                // Aktualizuj istniejącego
                if (delta.mask & (1 << 0) && delta.cells) {
                    player.cells = delta.cells;
                }
                if (delta.mask & (1 << 1) && delta.mass !== undefined) {
                    player.totalMass = delta.mass;
                }
                if (delta.mask & (1 << 2) && delta.score !== undefined) {
                    player.score = delta.score;
                }
                if (delta.mask & (1 << 3) && delta.rank !== undefined) {
                    player.rank = delta.rank;
                }
                if (delta.mask & (1 << 4) && delta.alive !== undefined) {
                    player.isAlive = delta.alive;
                }
            }
        }
    }

    /**
     | Porównuje dwa wektory
     */
    private vectorsEqual(a: Vector2, b: Vector2): boolean {
        return Math.abs(a.x - b.x) < 0.001 && Math.abs(a.y - b.y) < 0.001;
    }

    /**
     | Porównuje dwie tablice
     */
    private arraysEqual(a: any[], b: any[]): boolean {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }
}