import { EntityType } from "@shared/types/EntityTypes";

export interface BasePacket {
    opcode: number;
}

export interface InputPacket extends BasePacket {
    opcode: number;
    seq: number;
    mouseX: number;
    mouseY: number;
    split: boolean;
    eject: boolean;
}

export interface SpawnPacket extends BasePacket {
    opcode: number;
    name: string;
}

export interface PingPacket extends BasePacket {
    opcode: number;
    timestamp: number;
}

export interface PongPacket extends BasePacket {
    opcode: number;
    timestamp: number;
}

export interface EntitySnapshot {
    id: number;
    type: EntityType;
    x: number;
    y: number;
    radius: number;
    vx?: number;
    vy?: number;
    playerId?: number;
}

export interface SnapshotPacket extends BasePacket {
    opcode: number;
    tick: number;
    entities: EntitySnapshot[];
}

export interface DeltaPacket extends BasePacket {
    opcode: number;
    tick: number;
    created: EntitySnapshot[];
    updated: EntitySnapshot[];
    removed: number[];
}

export interface DespawnPacket extends BasePacket {
    opcode: number;
    ids: number[];
}

export interface EventPacket extends BasePacket {
    opcode: number;
    event: string;
    payload: any;
}