/**
 * @file ReplayReader.ts
 * @description Odczyt replaya z pliku/binarki
 */

import { Replay, ReplayHeader, ReplayEvent, ReplayEventType } from './ReplayRecorder';
import { BinaryReader, ByteOrder } from '@network-protocol/encoding/BinaryReader';
import { Vector2 } from '@shared-core/math/Vector2';
import { Logger, LogCategory } from '@shared-core/utils/Logger';

/**
 | Opcje odczytu
 */
export interface ReplayReaderOptions {
    validateChecksum: boolean;
    lazyLoad: boolean;           // Czy ładować leniwie
    maxEvents: number;            // Maksymalna liczba zdarzeń do załadowania
}

/**
 | Reader replayi
 */
export class ReplayReader {
    private options: ReplayReaderOptions;
    private logger: Logger;
    private replay: Replay | null = null;
    private currentIndex: number = 0;

    constructor(options?: Partial<ReplayReaderOptions>) {
        this.options = {
            validateChecksum: true,
            lazyLoad: false,
            maxEvents: 1000000,
            ...options
        };
        
        this.logger = Logger.getInstance();
    }

    /**
     | Odczytuje replay z bufora
     */
    async readFromBuffer(data: Uint8Array): Promise<Replay> {
        // Sprawdź czy to JSON
        if (data[0] === 0x7B) { // '{'
            return this.readJSON(data);
        }
        
        // Sprawdź czy kompresowany (gzip magic number)
        if (data[0] === 0x1F && data[1] === 0x8B) {
            data = await this.decompress(data);
        }
        
        // Próba odczytu binarnego
        try {
            return this.readBinary(data);
        } catch (e) {
            // Jeśli nie binarny, spróbuj JSON
            return this.readJSON(data);
        }
    }

    /**
     | Odczytuje replay z pliku
     */
    async readFromFile(file: File | string): Promise<Replay> {
        if (typeof file === 'string') {
            // W Node.js
            if (typeof process !== 'undefined') {
                const fs = require('fs');
                const data = fs.readFileSync(file);
                return this.readFromBuffer(data);
            }
            // W przeglądarce - fetch
            else {
                const response = await fetch(file);
                const data = new Uint8Array(await response.arrayBuffer());
                return this.readFromBuffer(data);
            }
        } else {
            // File API
            const data = new Uint8Array(await file.arrayBuffer());
            return this.readFromBuffer(data);
        }
    }

    /**
     | Odczytuje JSON
     */
    private readJSON(data: Uint8Array): Replay {
        const text = new TextDecoder().decode(data);
        const replay = JSON.parse(text);
        
        // Konwersja typów
        if (replay.header) {
            replay.header.startTime = Number(replay.header.startTime);
            if (replay.header.endTime) {
                replay.header.endTime = Number(replay.header.endTime);
            }
        }
        
        this.replay = replay;
        return replay;
    }

    /**
     | Odczytuje binarkę
     */
    private readBinary(data: Uint8Array): Replay {
        const reader = new BinaryReader(data, ByteOrder.LITTLE_ENDIAN);

        // Sprawdź sygnaturę
        const signature = reader.readUint32();
        if (signature !== 0x5245504C) {
            throw new Error('Invalid replay file format');
        }

        const formatVersion = reader.readByte();
        if (formatVersion !== 1) {
            throw new Error(`Unsupported format version: ${formatVersion}`);
        }

        // Nagłówek
        const header = this.readHeader(reader);

        // Zdarzenia
        const eventCount = reader.readUint32();
        const events: ReplayEvent[] = [];

        for (let i = 0; i < Math.min(eventCount, this.options.maxEvents); i++) {
            const event = this.readEvent(reader);
            if (event) {
                events.push(event);
            }
        }

        const replay: Replay = { header, events };
        this.replay = replay;
        
        return replay;
    }

    /**
     | Odczytuje nagłówek
     */
    private readHeader(reader: BinaryReader): ReplayHeader {
        const version = reader.readString();
        const gameVersion = reader.readString();
        
        const mapWidth = reader.readUint32();
        const mapHeight = reader.readUint32();
        
        const startTime = Number(reader.readUint64());
        
        let endTime: number | undefined;
        let duration: number | undefined;
        
        if (reader.readBoolean()) {
            endTime = Number(reader.readUint64());
            duration = reader.readUint32();
        }
        
        const tickRate = reader.readUint16();
        const compression = reader.readBoolean();
        
        const playerCount = reader.readUint16();
        const players = [];
        
        for (let i = 0; i < playerCount; i++) {
            players.push({
                id: reader.readString(),
                name: reader.readString(),
                color: reader.readString()
            });
        }

        return {
            version,
            gameVersion,
            mapSize: { width: mapWidth, height: mapHeight },
            startTime,
            endTime,
            duration,
            playerCount,
            players,
            tickRate,
            compression
        };
    }

    /**
     | Odczytuje zdarzenie
     */
    private readEvent(reader: BinaryReader): ReplayEvent | null {
        const typeCode = reader.readByte();
        const type = this.getEventTypeFromCode(typeCode);
        const frame = reader.readUint32();
        const timestamp = this.options.lazyLoad ? 0 : Number(reader.readUint64());

        switch (type) {
            case ReplayEventType.INPUT:
                return this.readInputEvent(reader, frame, timestamp);
            case ReplayEventType.SPLIT:
                return this.readSplitEvent(reader, frame, timestamp);
            case ReplayEventType.EAT:
                return this.readEatEvent(reader, frame, timestamp);
            case ReplayEventType.DEATH:
                return this.readDeathEvent(reader, frame, timestamp);
            default:
                this.logger.warn(LogCategory.SYSTEM, `Unknown event type: ${typeCode}`);
                return null;
        }
    }

    /**
     | Odczytuje input
     */
    private readInputEvent(reader: BinaryReader, frame: number, timestamp: number): InputEvent {
        const playerId = reader.readString();
        const inputFrame = reader.readUint32();
        const x = reader.readFloat32();
        const y = reader.readFloat32();
        const flags = reader.readByte();

        return {
            type: ReplayEventType.INPUT,
            frame,
            timestamp,
            playerId,
            input: {
                playerId,
                frame: inputFrame,
                targetPosition: new Vector2(x, y),
                isSplitting: (flags & 1) !== 0,
                isEjecting: (flags & 2) !== 0,
                isMerging: (flags & 4) !== 0,
                timestamp
            }
        };
    }

    /**
     | Odczytuje split
     */
    private readSplitEvent(reader: BinaryReader, frame: number, timestamp: number): SplitEvent {
        const playerId = reader.readString();
        const cellId = reader.readUint32();
        const newCellId = reader.readUint32();
        const dx = reader.readFloat32();
        const dy = reader.readFloat32();

        return {
            type: ReplayEventType.SPLIT,
            frame,
            timestamp,
            playerId,
            cellId,
            newCellId,
            direction: new Vector2(dx, dy)
        };
    }

    /**
     | Odczytuje zjedzenie
     */
    private readEatEvent(reader: BinaryReader, frame: number, timestamp: number): EatEvent {
        const predatorId = reader.readUint32();
        const preyId = reader.readUint32();
        const massTransferred = reader.readFloat32();

        return {
            type: ReplayEventType.EAT,
            frame,
            timestamp,
            predatorId,
            preyId,
            massTransferred
        };
    }

    /**
     | Odczytuje śmierć
     */
    private readDeathEvent(reader: BinaryReader, frame: number, timestamp: number): DeathEvent {
        const playerId = reader.readString();
        const hasKiller = reader.readBoolean();
        const killedBy = hasKiller ? reader.readString() : undefined;
        const x = reader.readFloat32();
        const y = reader.readFloat32();

        return {
            type: ReplayEventType.DEATH,
            frame,
            timestamp,
            playerId,
            killedBy,
            position: new Vector2(x, y)
        };
    }

    /**
     | Dekompresuje dane
     */
    private async decompress(data: Uint8Array): Promise<Uint8Array> {
        // W Node.js
        if (typeof process !== 'undefined') {
            const zlib = require('zlib');
            return zlib.gunzipSync(data);
        }
        // W przeglądarce
        else if (typeof DecompressionStream !== 'undefined') {
            const stream = new DecompressionStream('gzip');
            const writer = stream.writable.getWriter();
            writer.write(data);
            writer.close();
            
            const reader = stream.readable.getReader();
            const chunks: Uint8Array[] = [];
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
            }
            
            const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
            const result = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
                result.set(chunk, offset);
                offset += chunk.length;
            }
            
            return result;
        }
        
        return data;
    }

    /**
     | Pobiera typ z kodu
     */
    private getEventTypeFromCode(code: number): ReplayEventType {
        const types: ReplayEventType[] = [
            ReplayEventType.INPUT,
            ReplayEventType.STATE,
            ReplayEventType.SPLIT,
            ReplayEventType.MERGE,
            ReplayEventType.EAT,
            ReplayEventType.DEATH,
            ReplayEventType.JOIN,
            ReplayEventType.LEAVE,
            ReplayEventType.CHAT
        ];
        return types[code - 1] || ReplayEventType.INPUT;
    }

    /**
     | Iteruje po zdarzeniach
     */
    *[Symbol.iterator](): Iterator<ReplayEvent> {
        if (!this.replay) return;
        
        for (const event of this.replay.events) {
            yield event;
        }
    }

    /**
     | Pobiera następne zdarzenie
     */
    nextEvent(): ReplayEvent | null {
        if (!this.replay || this.currentIndex >= this.replay.events.length) {
            return null;
        }
        
        return this.replay.events[this.currentIndex++];
    }

    /**
     | Resetuje iterator
     */
    reset(): void {
        this.currentIndex = 0;
    }
}

// Import typów dla reader'a
import { InputEvent, SplitEvent, EatEvent, DeathEvent } from './ReplayRecorder';