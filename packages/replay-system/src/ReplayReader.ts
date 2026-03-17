/**
 * @file ReplayRecorder.ts
 * @description Nagrywanie replayi - zapisuje inputy i stany
 */

import { Vector2 } from '@shared-core/math/Vector2';
import { EntityId, PlayerId } from '@shared-core/types/EntityTypes';
import { PlayerInput } from '@rollback-system/RollbackBuffer';
import { SavedState } from '@rollback-system/RollbackBuffer';
import { Logger, LogCategory } from '@shared-core/utils/Logger';

/**
 | Typ zdarzenia w replayu
 */
export enum ReplayEventType {
    INPUT = 'input',
    STATE = 'state',
    SPLIT = 'split',
    MERGE = 'merge',
    EAT = 'eat',
    DEATH = 'death',
    JOIN = 'join',
    LEAVE = 'leave',
    CHAT = 'chat'
}

/**
 | Bazowe zdarzenie replayu
 */
export interface ReplayEvent {
    type: ReplayEventType;
    frame: number;
    timestamp: number;
}

/**
 | Zdarzenie inputu
 */
export interface InputEvent extends ReplayEvent {
    type: ReplayEventType.INPUT;
    playerId: PlayerId;
    input: PlayerInput;
}

/**
 | Zdarzenie stanu
 */
export interface StateEvent extends ReplayEvent {
    type: ReplayEventType.STATE;
    state: SavedState;
}

/**
 | Zdarzenie podziału
 */
export interface SplitEvent extends ReplayEvent {
    type: ReplayEventType.SPLIT;
    playerId: PlayerId;
    cellId: EntityId;
    newCellId: EntityId;
    direction: Vector2;
}

/**
 | Zdarzenie zjedzenia
 */
export interface EatEvent extends ReplayEvent {
    type: ReplayEventType.EAT;
    predatorId: EntityId;
    preyId: EntityId;
    massTransferred: number;
}

/**
 | Zdarzenie śmierci
 */
export interface DeathEvent extends ReplayEvent {
    type: ReplayEventType.DEATH;
    playerId: PlayerId;
    killedBy?: PlayerId;
    position: Vector2;
}

/**
 | Nagłówek replaya
 */
export interface ReplayHeader {
    version: string;
    gameVersion: string;
    mapSize: { width: number; height: number };
    startTime: number;
    endTime?: number;
    duration?: number;
    playerCount: number;
    players: Array<{
        id: PlayerId;
        name: string;
        color: string;
    }>;
    tickRate: number;
    compression: boolean;
    checksum?: string;
}

/**
 | Opcje nagrywania
 */
export interface ReplayRecorderOptions {
    recordInputs: boolean;      // Czy nagrywać inputy
    recordStates: boolean;      // Czy nagrywać stany
    stateInterval: number;      // Co ile klatek zapisywać stan
    compression: boolean;       // Czy kompresować replay
    maxSize: number;            // Maksymalny rozmiar w bajtach
}

/**
 | Nagrywarka replayi
 */
export class ReplayRecorder {
    private events: ReplayEvent[] = [];
    private header: ReplayHeader;
    private options: ReplayRecorderOptions;
    private logger: Logger;
    private isRecording: boolean = false;
    private startFrame: number = 0;
    private lastStateFrame: number = 0;

    constructor(options?: Partial<ReplayRecorderOptions>) {
        this.options = {
            recordInputs: true,
            recordStates: false,      // Domyślnie nie nagrywamy stanów (za dużo danych)
            stateInterval: 60,        // Co 60 klatek (1 sekunda @ 60fps)
            compression: true,
            maxSize: 50 * 1024 * 1024, // 50 MB
            ...options
        };
        
        this.logger = Logger.getInstance();
        
        this.header = {
            version: '1.0.0',
            gameVersion: '1.0.0',
            mapSize: { width: 10000, height: 10000 },
            startTime: Date.now(),
            playerCount: 0,
            players: [],
            tickRate: 60,
            compression: this.options.compression
        };
    }

    /**
     | Rozpoczyna nagrywanie
     */
    startRecording(initialState: SavedState): void {
        this.isRecording = true;
        this.startFrame = initialState.frame;
        this.lastStateFrame = initialState.frame;
        this.header.startTime = Date.now();
        
        // Zapisz początkowy stan
        if (this.options.recordStates) {
            this.recordEvent({
                type: ReplayEventType.STATE,
                frame: initialState.frame,
                timestamp: Date.now(),
                state: initialState
            });
        }

        // Zapisz graczy
        for (const [id, player] of initialState.players) {
            this.header.players.push({
                id,
                name: player.name || `Player${id}`,
                color: player.color || '#FFFFFF'
            });
        }
        this.header.playerCount = this.header.players.length;

        this.logger.info(LogCategory.SYSTEM, `Started recording replay at frame ${initialState.frame}`);
    }

    /**
     | Zatrzymuje nagrywanie
     */
    stopRecording(): Replay | null {
        if (!this.isRecording) return null;

        this.isRecording = false;
        this.header.endTime = Date.now();
        this.header.duration = this.header.endTime - this.header.startTime;

        // Oblicz checksum
        if (this.options.compression) {
            this.header.checksum = this.calculateChecksum();
        }

        const replay: Replay = {
            header: this.header,
            events: this.events
        };

        this.logger.info(LogCategory.SYSTEM, 
            `Stopped recording replay. Events: ${this.events.length}, Duration: ${this.header.duration}ms`);

        return replay;
    }

    /**
     | Nagrywa input gracza
     */
    recordInput(playerId: PlayerId, input: PlayerInput): void {
        if (!this.isRecording || !this.options.recordInputs) return;

        const event: InputEvent = {
            type: ReplayEventType.INPUT,
            frame: input.frame,
            timestamp: Date.now(),
            playerId,
            input
        };

        this.recordEvent(event);
    }

    /**
     | Nagrywa stan
     */
    recordState(state: SavedState): void {
        if (!this.isRecording || !this.options.recordStates) return;

        // Nagrywaj tylko co stateInterval klatek
        if (state.frame - this.lastStateFrame < this.options.stateInterval) return;

        const event: StateEvent = {
            type: ReplayEventType.STATE,
            frame: state.frame,
            timestamp: Date.now(),
            state: this.compressState(state)
        };

        this.recordEvent(event);
        this.lastStateFrame = state.frame;
    }

    /**
     | Nagrywa podział
     */
    recordSplit(playerId: PlayerId, cellId: EntityId, newCellId: EntityId, direction: Vector2): void {
        if (!this.isRecording) return;

        const event: SplitEvent = {
            type: ReplayEventType.SPLIT,
            frame: this.getCurrentFrame(),
            timestamp: Date.now(),
            playerId,
            cellId,
            newCellId,
            direction: direction.clone()
        };

        this.recordEvent(event);
    }

    /**
     | Nagrywa zjedzenie
     */
    recordEat(predatorId: EntityId, preyId: EntityId, massTransferred: number): void {
        if (!this.isRecording) return;

        const event: EatEvent = {
            type: ReplayEventType.EAT,
            frame: this.getCurrentFrame(),
            timestamp: Date.now(),
            predatorId,
            preyId,
            massTransferred
        };

        this.recordEvent(event);
    }

    /**
     | Nagrywa śmierć
     */
    recordDeath(playerId: PlayerId, killedBy?: PlayerId, position?: Vector2): void {
        if (!this.isRecording) return;

        const event: DeathEvent = {
            type: ReplayEventType.DEATH,
            frame: this.getCurrentFrame(),
            timestamp: Date.now(),
            playerId,
            killedBy,
            position: position || new Vector2(0, 0)
        };

        this.recordEvent(event);
    }

    /**
     | Nagrywa zdarzenie
     */
    private recordEvent(event: ReplayEvent): void {
        this.events.push(event);

        // Sprawdź rozmiar
        if (this.estimateSize() > this.options.maxSize) {
            this.logger.warn(LogCategory.SYSTEM, 'Replay size limit reached, stopping recording');
            this.stopRecording();
        }
    }

    /**
     | Kompresuje stan
     */
    private compressState(state: SavedState): SavedState {
        // TODO: rzeczywista kompresja
        return state;
    }

    /**
     | Oblicza bieżącą klatkę
     */
    private getCurrentFrame(): number {
        // W rzeczywistości pobieramy z gry
        return 0;
    }

    /**
     | Szacuje rozmiar replaya
     */
    private estimateSize(): number {
        // Bardzo przybliżone
        return this.events.length * 100;
    }

    /**
     | Oblicza sumę kontrolną
     */
    private calculateChecksum(): string {
        // TODO: rzeczywista suma kontrolna
        return 'checksum';
    }

    /**
     | Sprawdza czy nagrywa
     */
    isActive(): boolean {
        return this.isRecording;
    }

    /**
     | Resetuje nagrywarkę
     */
    reset(): void {
        this.events = [];
        this.isRecording = false;
        this.startFrame = 0;
        this.lastStateFrame = 0;
        this.header = {
            ...this.header,
            startTime: Date.now(),
            endTime: undefined,
            duration: undefined,
            playerCount: 0,
            players: []
        };
    }
}

/**
 | Replay
 */
export interface Replay {
    header: ReplayHeader;
    events: ReplayEvent[];
}