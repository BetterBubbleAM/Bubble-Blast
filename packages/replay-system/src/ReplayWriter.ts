/**
 * @file ReplayWriter.ts
 * @description Zapis replaya do pliku/binarki
 */

import { Replay, ReplayHeader, ReplayEvent, ReplayEventType } from './ReplayRecorder';
import { BinaryWriter, ByteOrder } from '@network-protocol/encoding/BinaryWriter';
import { Logger, LogCategory } from '@shared-core/utils/Logger';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';

/**
 | Format zapisu
 */
export enum ReplayFormat {
    JSON = 'json',
    BINARY = 'binary',
    COMPRESSED = 'compressed'
}

/**
 | Opcje zapisu
 */
export interface ReplayWriterOptions {
    format: ReplayFormat;
    prettyPrint: boolean;      // Dla JSON
    includeTimestamps: boolean;
    validateBeforeWrite: boolean;
}

/**
 | Writer replayi
 */
export class ReplayWriter {
    private options: ReplayWriterOptions;
    private logger: Logger;

    constructor(options?: Partial<ReplayWriterOptions>) {
        this.options = {
            format: ReplayFormat.COMPRESSED,
            prettyPrint: false,
            includeTimestamps: true,
            validateBeforeWrite: true,
            ...options
        };
        
        this.logger = Logger.getInstance();
    }

    /**
     | Zapisuje replay do bufora
     */
    async writeToBuffer(replay: Replay): Promise<Uint8Array> {
        if (this.options.validateBeforeWrite) {
            this.validateReplay(replay);
        }

        switch (this.options.format) {
            case ReplayFormat.JSON:
                return this.writeJSON(replay);
            case ReplayFormat.BINARY:
                return this.writeBinary(replay);
            case ReplayFormat.COMPRESSED:
                const binary = await this.writeBinary(replay);
                return this.compress(binary);
            default:
                return this.writeJSON(replay);
        }
    }

    /**
     | Zapisuje replay do pliku
     */
    async writeToFile(replay: Replay, filePath: string): Promise<void> {
        const data = await this.writeToBuffer(replay);
        
        // W Node.js
        if (typeof process !== 'undefined') {
            const fs = require('fs');
            fs.writeFileSync(filePath, data);
        } 
        // W przeglądarce
        else {
            const blob = new Blob([data], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filePath;
            a.click();
            URL.revokeObjectURL(url);
        }

        this.logger.info(LogCategory.SYSTEM, `Replay saved to ${filePath} (${data.length} bytes)`);
    }

    /**
     | Zapisuje jako JSON
     */
    private writeJSON(replay: Replay): Uint8Array {
        const json = this.options.prettyPrint
            ? JSON.stringify(replay, null, 2)
            : JSON.stringify(replay);
        
        return new TextEncoder().encode(json);
    }

    /**
     | Zapisuje jako binarkę
     */
    private writeBinary(replay: Replay): Uint8Array {
        const writer = new BinaryWriter(1024 * 1024, ByteOrder.LITTLE_ENDIAN);

        // Nagłówek
        this.writeHeader(writer, replay.header);

        // Zdarzenia
        writer.writeUint32(replay.events.length);
        for (const event of replay.events) {
            this.writeEvent(writer, event);
        }

        return writer.toBuffer();
    }

    /**
     | Zapisuje nagłówek
     */
    private writeHeader(writer: BinaryWriter, header: ReplayHeader): void {
        // Sygnatura "REPLAY"
        writer.writeUint32(0x5245504C);
        writer.writeByte(1); // wersja formatu
        
        writer.writeString(header.version);
        writer.writeString(header.gameVersion);
        
        writer.writeUint32(header.mapSize.width);
        writer.writeUint32(header.mapSize.height);
        
        writer.writeUint64(BigInt(header.startTime));
        if (header.endTime) {
            writer.writeBoolean(true);
            writer.writeUint64(BigInt(header.endTime));
            writer.writeUint32(header.duration || 0);
        } else {
            writer.writeBoolean(false);
        }
        
        writer.writeUint16(header.tickRate);
        writer.writeBoolean(header.compression);
        
        // Gracze
        writer.writeUint16(header.playerCount);
        for (const player of header.players) {
            writer.writeString(player.id);
            writer.writeString(player.name);
            writer.writeString(player.color);
        }
    }

    /**
     | Zapisuje zdarzenie
     */
    private writeEvent(writer: BinaryWriter, event: ReplayEvent): void {
        writer.writeByte(this.getEventTypeCode(event.type));
        writer.writeUint32(event.frame);
        
        if (this.options.includeTimestamps) {
            writer.writeUint64(BigInt(event.timestamp));
        }

        switch (event.type) {
            case ReplayEventType.INPUT:
                this.writeInputEvent(writer, event as InputEvent);
                break;
            case ReplayEventType.STATE:
                this.writeStateEvent(writer, event as StateEvent);
                break;
            case ReplayEventType.SPLIT:
                this.writeSplitEvent(writer, event as SplitEvent);
                break;
            case ReplayEventType.EAT:
                this.writeEatEvent(writer, event as EatEvent);
                break;
            case ReplayEventType.DEATH:
                this.writeDeathEvent(writer, event as DeathEvent);
                break;
        }
    }

    /**
     | Zapisuje input
     */
    private writeInputEvent(writer: BinaryWriter, event: InputEvent): void {
        writer.writeString(event.playerId);
        writer.writeUint32(event.input.frame);
        writer.writeFloat32(event.input.targetPosition.x);
        writer.writeFloat32(event.input.targetPosition.y);
        
        let flags = 0;
        if (event.input.isSplitting) flags |= 1;
        if (event.input.isEjecting) flags |= 2;
        if (event.input.isMerging) flags |= 4;
        writer.writeByte(flags);
    }

    /**
     | Zapisuje stan
     */
    private writeStateEvent(writer: BinaryWriter, event: StateEvent): void {
        // TODO: zapis stanu
        writer.writeUint16(event.state.entities.size);
    }

    /**
     | Zapisuje split
     */
    private writeSplitEvent(writer: BinaryWriter, event: SplitEvent): void {
        writer.writeString(event.playerId);
        writer.writeUint32(event.cellId);
        writer.writeUint32(event.newCellId);
        writer.writeFloat32(event.direction.x);
        writer.writeFloat32(event.direction.y);
    }

    /**
     | Zapisuje zjedzenie
     */
    private writeEatEvent(writer: BinaryWriter, event: EatEvent): void {
        writer.writeUint32(event.predatorId);
        writer.writeUint32(event.preyId);
        writer.writeFloat32(event.massTransferred);
    }

    /**
     | Zapisuje śmierć
     */
    private writeDeathEvent(writer: BinaryWriter, event: DeathEvent): void {
        writer.writeString(event.playerId);
        writer.writeBoolean(!!event.killedBy);
        if (event.killedBy) {
            writer.writeString(event.killedBy);
        }
        writer.writeFloat32(event.position.x);
        writer.writeFloat32(event.position.y);
    }

    /**
     | Kompresuje dane
     */
    private async compress(data: Uint8Array): Promise<Uint8Array> {
        // W Node.js
        if (typeof process !== 'undefined') {
            const zlib = require('zlib');
            return zlib.gzipSync(data);
        }
        // W przeglądarce
        else if (typeof CompressionStream !== 'undefined') {
            const stream = new CompressionStream('gzip');
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
     | Waliduje replay
     */
    private validateReplay(replay: Replay): void {
        if (!replay.header) {
            throw new Error('Replay missing header');
        }
        
        if (!replay.events) {
            throw new Error('Replay missing events');
        }
        
        // Sprawdź spójność czasową
        let lastFrame = -1;
        for (const event of replay.events) {
            if (event.frame < lastFrame) {
                this.logger.warn(LogCategory.SYSTEM, 
                    `Events out of order: frame ${event.frame} after ${lastFrame}`);
            }
            lastFrame = event.frame;
        }
    }

    /**
     | Kod typu zdarzenia
     */
    private getEventTypeCode(type: ReplayEventType): number {
        const codes: Record<ReplayEventType, number> = {
            [ReplayEventType.INPUT]: 0x01,
            [ReplayEventType.STATE]: 0x02,
            [ReplayEventType.SPLIT]: 0x03,
            [ReplayEventType.MERGE]: 0x04,
            [ReplayEventType.EAT]: 0x05,
            [ReplayEventType.DEATH]: 0x06,
            [ReplayEventType.JOIN]: 0x07,
            [ReplayEventType.LEAVE]: 0x08,
            [ReplayEventType.CHAT]: 0x09
        };
        return codes[type] || 0;
    }
}