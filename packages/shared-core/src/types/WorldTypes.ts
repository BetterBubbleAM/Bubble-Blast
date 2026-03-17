export interface WorldBounds {
    width: number;
    height: number;
}

export interface WorldConfig {
    width: number;
    height: number;
    maxEntities: number;
    tickRate: number;
}

export interface WorldSnapshotMeta {
    tick: number;
    timestamp: number;
}

export interface WorldStateStats {
    totalEntities: number;
    totalPlayers: number;
    totalPellets: number;
    totalViruses: number;
}