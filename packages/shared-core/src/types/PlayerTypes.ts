export interface PlayerInput {
    seq: number;
    mouseX: number;
    mouseY: number;
    split: boolean;
    eject: boolean;
}

export interface PlayerState {
    id: number;
    name: string;
    score: number;
    alive: boolean;
}

export interface PlayerCellState {
    entityId: number;
    radius: number;
    x: number;
    y: number;
}

export interface PlayerSnapshot {
    id: number;
    cells: PlayerCellState[];
    score: number;
}