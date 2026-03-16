import { Vector2 } from '../math/Vector2';
import { EntityType } from '../constants/NetworkOpcodes';

export interface IBaseEntity {
    id: number;           // Unikalne ID z serwera
    type: EntityType;     // Gracz, wirus, jedzenie itp.
    position: Vector2;    // Aktualna pozycja X, Y
    radius: number;       // Promień kulki (liczony z masy)
    mass: number;         // Masa kulki
    color: string;        // Kolor w formacie hex lub rgb
}
export interface IPlayerCell extends IBaseEntity {
    type: EntityType.PLAYER;
    playerId: string;     // ID właściciela kulki
    name: string;         // Nick gracza
    skin?: string;        // Nazwa skina (opcjonalnie)
    velocity: Vector2;    // Prędkość (potrzebna do przewidywania ruchu/prediction)
    isSpawning: boolean;  // Czy jest w trakcie animacji pojawiania się
}
export interface IWorldSnapshot {
    tick: number;             // Numer klatki serwera
    timestamp: number;        // Czas utworzenia
    entities: IBaseEntity[];  // Lista wszystkich obiektów w polu widzenia
    leaderboard: ILeaderboardEntry[];
}

export interface ILeaderboardEntry {
    name: string;
    score: number;
    isMe: boolean;
}