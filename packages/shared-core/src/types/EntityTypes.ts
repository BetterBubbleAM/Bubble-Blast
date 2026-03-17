/**
 * @file EntityTypes.ts
 * @description Podstawowe typy encji używane we wszystkich pakietach
 */

/**
 * Unikalny identyfikator encji
 */
export type EntityId = number;

/**
 * Typ encji w grze
 */
export enum EntityType {
    PLAYER = 'player',
    CELL = 'cell',
    VIRUS = 'virus',
    PELLET = 'pellet',
    WALL = 'wall',
    BOT = 'bot'
}

/**
 * Podstawowe właściwości każdej encji
 */
export interface BaseEntity {
    id: EntityId;
    type: EntityType;
    createdAt: number;
    updatedAt: number;
}

/**
 * Stan komórki (część gracza lub bota)
 */
export interface CellState extends BaseEntity {
    type: EntityType.CELL;
    playerId: string;
    mass: number;
    radius: number;
    position: {
        x: number;
        y: number;
    };
    velocity: {
        x: number;
        y: number;
    };
    color: string;
    isMoving: boolean;
    isSplitting: boolean;
    isMerging: boolean;
    splitCooldown: number;
    mergeCooldown: number;
}

/**
 * Stan wirusa
 */
export interface VirusState extends BaseEntity {
    type: EntityType.VIRUS;
    mass: number;
    radius: number;
    position: {
        x: number;
        y: number;
    };
    splitCount: number;
    maxSplit: number;
    isPoisoned: boolean;
}

/**
 * Stan pelletu (jedzenia)
 */
export interface PelletState extends BaseEntity {
    type: EntityType.PELLET;
    mass: number;
    radius: number;
    position: {
        x: number;
        y: number;
    };
    isEaten: boolean;
    respawnTime: number;
}

/**
 * ID gracza
 */
export type PlayerId = string;

/**
 * Podstawowe dane gracza
 */
export interface PlayerData {
    id: PlayerId;
    name: string;
    skin: string;
    color: string;
    createdAt: number;
    lastActiveAt: number;
}

/**
 * Stan gracza w grze
 */
export interface PlayerState extends PlayerData {
    cells: CellState[];
    totalMass: number;
    isAlive: boolean;
    isSpectating: boolean;
    kills: number;
    deaths: number;
    score: number;
    rank: number;
}

/**
 * Kolor w formacie hex lub rgba
 */
export type Color = string;

/**
 * Wektor 2D
 */
export interface Vector2 {
    x: number;
    y: number;
}

/**
 * Prostokąt/world bounds
 */
export interface Rectangle {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Koło do kolizji
 */
export interface Circle {
    x: number;
    y: number;
    radius: number;
}

/**
 * Zakres/liczby
 */
export interface Range {
    min: number;
    max: number;
}

/**
 * Drużyna/grupa
 */
export interface Team {
    id: string;
    name: string;
    color: Color;
    players: PlayerId[];
}