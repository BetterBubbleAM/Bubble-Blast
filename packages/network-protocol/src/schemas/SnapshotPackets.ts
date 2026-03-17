/**
 * @file SnapshotPackets.ts
 * @description Pakiety snapshotów - pełny i różnicowy stan świata
 */

import { Vector2 } from '@shared-core/math/Vector2';
import { EntityId, PlayerId } from '@shared-core/types/EntityTypes';

/**
 * Typ snapshotu
 */
export enum SnapshotType {
    FULL = 'full',           // Pełny snapshot
    DELTA = 'delta',         // Różnicowy (tylko zmiany)
    COMPRESSED = 'compressed' // Skompresowany
}

/**
 * Meta-dane snapshotu
 */
export interface SnapshotMetadata {
    sequence: number;        // Numer sekwencyjny
    timestamp: number;       // Czas utworzenia
    baseSequence?: number;   // Dla delta - numer bazowego snapshota
    type: SnapshotType;
    entityCount: number;
    playerCount: number;
    compressedSize?: number;
    originalSize?: number;
}

/**
 * Pojedyncza encja w snapshotcie
 */
export interface SnapshotEntity {
    id: EntityId;
    
    // Podstawowe dane
    type: 'player' | 'cell' | 'virus' | 'pellet';
    position: Vector2;
    radius: number;
    mass: number;
    color: string;
    
    // Opcjonalne (dla graczy)
    playerId?: PlayerId;
    playerName?: string;
    
    // Opcjonalne (dla komórek)
    velocity?: Vector2;
    isSplitting?: boolean;
    isMerging?: boolean;
    
    // Opcjonalne (dla wirusów)
    virusState?: 'idle' | 'growing' | 'popping';
    splitCount?: number;
    
    // Flagi
    flags: number;
}

/**
 * Różnicowa aktualizacja encji
 */
export interface DeltaEntityUpdate {
    id: EntityId;
    
    // Które pola się zmieniły (bitmask)
    changedMask: number;
    
    // Nowe wartości (tylko zmienione)
    position?: Vector2;
    radius?: number;
    mass?: number;
    color?: string;
    velocity?: Vector2;
    flags?: number;
}

/**
 * Pełny snapshot świata
 */
export interface FullSnapshot {
    metadata: SnapshotMetadata;
    entities: SnapshotEntity[];
    players: PlayerSnapshot[];
    world: WorldSnapshot;
}

/**
 * Snapshot różnicowy
 */
export interface DeltaSnapshot {
    metadata: SnapshotMetadata;
    added: SnapshotEntity[];           // Nowe encje
    removed: EntityId[];               // Usunięte encje
    updated: DeltaEntityUpdate[];      // Zaktualizowane encje
    playerUpdates: PlayerDelta[];
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
    rank: number;
    color: string;
    isAlive: boolean;
}

/**
 | Różnicowa aktualizacja gracza
 */
export interface PlayerDelta {
    id: PlayerId;
    changedMask: number;
    cells?: EntityId[];
    totalMass?: number;
    score?: number;
    rank?: number;
    isAlive?: boolean;
}

/**
 | Snapshot świata
 */
export interface WorldSnapshot {
    width: number;
    height: number;
    gravity: Vector2;
    time: number;
    tick: number;
}

/**
 | Kompresja snapshotu
 */
export interface CompressedSnapshot {
    metadata: SnapshotMetadata;
    compression: 'lz4' | 'zlib' | 'none';
    data: Uint8Array;          // Skompresowane dane
    checksum: number;          // Dla weryfikacji
}

/**
 | Partia snapshotów (dla wielu klientów)
 */
export interface SnapshotBatch {
    snapshots: Map<PlayerId, FullSnapshot | DeltaSnapshot>;
    timestamp: number;
    serverLoad: number;
}