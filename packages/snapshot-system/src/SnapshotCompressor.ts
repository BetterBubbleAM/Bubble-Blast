/**
 * @file SnapshotCompressor.ts
 * @description Kompresja snapshotów
 */

import { Snapshot } from './Snapshot';
import { EncodedDelta } from './SnapshotDelta';

/**
 | Poziom kompresji
 */
export enum CompressionLevel {
    NONE = 0,       // Bez kompresji
    FAST = 1,       // Szybka, mniejsza kompresja
    NORMAL = 2,     // Normalna
    MAXIMUM = 3     // Maksymalna, wolniejsza
}

/**
 | Opcje kompresji
 */
export interface CompressionOptions {
    level: CompressionLevel;
    quantizePositions: boolean;     // Kwantyzacja pozycji (do integer)
    quantizeMass: boolean;          // Kwantyzacja masy
    removeRedundant: boolean;       // Usuwanie zbędnych danych
    useDictionary: boolean;         // Użyj słownika dla stringów
}

/**
 | Statystyki kompresji
 */
export interface CompressionStats {
    originalSize: number;
    compressedSize: number;
    ratio: number;
    time: number;
    level: CompressionLevel;
}

/**
 | Kompresor snapshotów
 */
export class SnapshotCompressor {
    private options: CompressionOptions;
    private stringDictionary: Map<string, number> = new Map();
    private reverseDictionary: Map<number, string> = new Map();
    private nextDictId: number = 0;

    constructor(options?: Partial<CompressionOptions>) {
        this.options = {
            level: CompressionLevel.NORMAL,
            quantizePositions: true,
            quantizeMass: true,
            removeRedundant: true,
            useDictionary: true,
            ...options
        };
    }

    /**
     | Kompresuje snapshot
     */
    compress(snapshot: Snapshot): Uint8Array {
        const startTime = performance.now();
        
        // Konwertuj do binarnego formatu
        let data = this.snapshotToBinary(snapshot);
        const originalSize = data.length;
        
        // Zastosuj kompresję w zależności od poziomu
        switch (this.options.level) {
            case CompressionLevel.FAST:
                data = this.compressFast(data);
                break;
            case CompressionLevel.NORMAL:
                data = this.compressNormal(data);
                break;
            case CompressionLevel.MAXIMUM:
                data = this.compressMaximum(data);
                break;
        }

        const compressedSize = data.length;
        const time = performance.now() - startTime;

        // Dodaj nagłówek
        return this.addHeader(data, {
            originalSize,
            compressedSize,
            ratio: compressedSize / originalSize,
            time,
            level: this.options.level
        });
    }

    /**
     | Dekompresuje snapshot
     */
    decompress(data: Uint8Array): Snapshot {
        const { stats, payload } = this.readHeader(data);
        
        // Dekompresuj w zależności od poziomu
        let decompressed: Uint8Array;
        
        switch (stats.level) {
            case CompressionLevel.FAST:
                decompressed = this.decompressFast(payload);
                break;
            case CompressionLevel.NORMAL:
                decompressed = this.decompressNormal(payload);
                break;
            case CompressionLevel.MAXIMUM:
                decompressed = this.decompressMaximum(payload);
                break;
            default:
                decompressed = payload;
        }

        return this.binaryToSnapshot(decompressed);
    }

    /**
     | Konwertuje snapshot do formatu binarnego
     */
    private snapshotToBinary(snapshot: Snapshot): Uint8Array {
        // TODO: implementacja konwersji do binarnego
        // Na razie zwracamy JSON
        const json = JSON.stringify(snapshot.toJSON());
        return new TextEncoder().encode(json);
    }

    /**
     | Konwertuje dane binarne do snapshotu
     */
    private binaryToSnapshot(data: Uint8Array): Snapshot {
        const json = new TextDecoder().decode(data);
        return Snapshot.fromJSON(JSON.parse(json));
    }

    /**
     | Szybka kompresja (np. prosty RLE)
     */
    private compressFast(data: Uint8Array): Uint8Array {
        // Proste kodowanie długości serii (RLE)
        const result: number[] = [];
        
        let i = 0;
        while (i < data.length) {
            let runLength = 1;
            while (i + runLength < data.length && 
                   data[i + runLength] === data[i] && 
                   runLength < 255) {
                runLength++;
            }
            
            if (runLength > 3) {
                // Znacznik RLE: 0xFF, długość, wartość
                result.push(0xFF);
                result.push(runLength);
                result.push(data[i]);
            } else {
                // Kopiuj bez zmian
                for (let j = 0; j < runLength; j++) {
                    result.push(data[i + j]);
                }
            }
            
            i += runLength;
        }
        
        return new Uint8Array(result);
    }

    /**
     | Normalna kompresja
     */
    private compressNormal(data: Uint8Array): Uint8Array {
        // TODO: LZ4 lub podobny
        return this.compressFast(data);
    }

    /**
     | Maksymalna kompresja
     */
    private compressMaximum(data: Uint8Array): Uint8Array {
        // TODO: Zlib lub LZMA
        return this.compressNormal(data);
    }

    /**
     | Dekompresja szybka
     */
    private decompressFast(data: Uint8Array): Uint8Array {
        const result: number[] = [];
        
        let i = 0;
        while (i < data.length) {
            if (data[i] === 0xFF && i + 2 < data.length) {
                // Znacznik RLE
                const length = data[i + 1];
                const value = data[i + 2];
                for (let j = 0; j < length; j++) {
                    result.push(value);
                }
                i += 3;
            } else {
                result.push(data[i]);
                i++;
            }
        }
        
        return new Uint8Array(result);
    }

    /**
     | Dekompresja normalna
     */
    private decompressNormal(data: Uint8Array): Uint8Array {
        return this.decompressFast(data);
    }

    /**
     | Dekompresja maksymalna
     */
    private decompressMaximum(data: Uint8Array): Uint8Array {
        return this.decompressNormal(data);
    }

    /**
     | Dodaje nagłówek z statystykami
     */
    private addHeader(data: Uint8Array, stats: CompressionStats): Uint8Array {
        const header = new Uint8Array(16); // 16 bajtów nagłówka
        const view = new DataView(header.buffer);
        
        view.setUint8(0, stats.level);
        view.setUint32(1, stats.originalSize, true);
        view.setUint32(5, stats.compressedSize, true);
        view.setFloat32(9, stats.ratio, true);
        view.setFloat32(13, stats.time, true);

        const result = new Uint8Array(header.length + data.length);
        result.set(header);
        result.set(data, header.length);
        
        return result;
    }

    /**
     | Odczytuje nagłówek
     */
    private readHeader(data: Uint8Array): { stats: CompressionStats; payload: Uint8Array } {
        const view = new DataView(data.buffer);
        
        const stats: CompressionStats = {
            level: view.getUint8(0),
            originalSize: view.getUint32(1, true),
            compressedSize: view.getUint32(5, true),
            ratio: view.getFloat32(9, true),
            time: view.getFloat32(13, true)
        };

        const payload = data.slice(16);

        return { stats, payload };
    }

    /**
     | Resetuje słownik (dla useDictionary)
     */
    resetDictionary(): void {
        this.stringDictionary.clear();
        this.reverseDictionary.clear();
        this.nextDictId = 0;
    }

    /**
     | Ustawia poziom kompresji
     */
    setLevel(level: CompressionLevel): void {
        this.options.level = level;
    }
}