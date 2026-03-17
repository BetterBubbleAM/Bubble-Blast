/**
 * @file PacketCompressor.ts
 * @description Kompresja pakietów sieciowych
 */

/**
 * Typ kompresji
 */
export enum CompressionType {
    NONE = 'none',
    LZ4 = 'lz4',
    ZLIB = 'zlib',
    GZIP = 'gzip'
}

/**
 * Poziom kompresji
 */
export enum CompressionLevel {
    FASTEST = 0,
    FAST = 1,
    DEFAULT = 2,
    MAXIMUM = 3
}

/**
 * Opcje kompresji
 */
export interface CompressionOptions {
    type: CompressionType;
    level: CompressionLevel;
    threshold: number;           // Minimalny rozmiar do kompresji
    useChecksum: boolean;
}

/**
 * Nagłówek skompresowanego pakietu
 */
export interface CompressedHeader {
    type: CompressionType;
    originalSize: number;
    compressedSize: number;
    checksum?: number;
}

/**
 * Kompresor pakietów
 */
export class PacketCompressor {
    private options: CompressionOptions;

    constructor(options?: Partial<CompressionOptions>) {
        this.options = {
            type: CompressionType.NONE,
            level: CompressionLevel.DEFAULT,
            threshold: 256,  // Kompresuj pakiety większe niż 256 bajtów
            useChecksum: true,
            ...options
        };
    }

    /**
     * Kompresuje dane
     */
    compress(data: Uint8Array): Uint8Array {
        // Nie kompresuj małych pakietów
        if (data.length < this.options.threshold) {
            return this.wrapCompressed(data, CompressionType.NONE);
        }

        switch (this.options.type) {
            case CompressionType.LZ4:
                return this.compressLZ4(data);
            case CompressionType.ZLIB:
                return this.compressZlib(data);
            case CompressionType.GZIP:
                return this.compressGzip(data);
            case CompressionType.NONE:
            default:
                return this.wrapCompressed(data, CompressionType.NONE);
        }
    }

    /**
     * Dekompresuje dane
     */
    decompress(data: Uint8Array): Uint8Array {
        const header = this.readHeader(data);
        const compressedData = data.slice(4); // Po nagłówku

        switch (header.type) {
            case CompressionType.LZ4:
                return this.decompressLZ4(compressedData, header.originalSize);
            case CompressionType.ZLIB:
                return this.decompressZlib(compressedData, header.originalSize);
            case CompressionType.GZIP:
                return this.decompressGzip(compressedData, header.originalSize);
            case CompressionType.NONE:
            default:
                return compressedData;
        }
    }

    /**
     * Zawija dane z nagłówkiem
     */
    private wrapCompressed(data: Uint8Array, type: CompressionType): Uint8Array {
        const header = new Uint8Array(4);
        const view = new DataView(header.buffer);
        
        // Format: [typ (1 bajt) | poziom (1 bajt) | rozmiar (2 bajty)]
        view.setUint8(0, this.getTypeCode(type));
        view.setUint8(1, this.options.level);
        view.setUint16(2, data.length, true);

        const result = new Uint8Array(header.length + data.length);
        result.set(header);
        result.set(data, header.length);
        
        return result;
    }

    /**
     * Czyta nagłówek
     */
    private readHeader(data: Uint8Array): CompressedHeader {
        if (data.length < 4) {
            throw new Error('Invalid compressed data');
        }

        const view = new DataView(data.buffer);
        const typeCode = view.getUint8(0);
        const originalSize = view.getUint16(2, true);

        return {
            type: this.getTypeFromCode(typeCode),
            originalSize,
            compressedSize: data.length - 4
        };
    }

    /**
     * Kompresja LZ4 (symulowana)
     */
    private compressLZ4(data: Uint8Array): Uint8Array {
        // TODO: Rzeczywista implementacja LZ4
        // Na razie symulacja
        console.log('LZ4 compression not implemented, using no compression');
        return this.wrapCompressed(data, CompressionType.NONE);
    }

    /**
     * Dekompresja LZ4
     */
    private decompressLZ4(data: Uint8Array, originalSize: number): Uint8Array {
        // TODO: Rzeczywista implementacja LZ4
        return data;
    }

    /**
     * Kompresja Zlib (przez Compression Streams API)
     */
    private compressZlib(data: Uint8Array): Uint8Array {
        // W przeglądarce można użyć Compression Streams API
        if (typeof CompressionStream !== 'undefined') {
            // Async - do implementacji
        }
        
        return this.wrapCompressed(data, CompressionType.NONE);
    }

    /**
     * Dekompresja Zlib
     */
    private decompressZlib(data: Uint8Array, originalSize: number): Uint8Array {
        if (typeof DecompressionStream !== 'undefined') {
            // Async - do implementacji
        }
        
        return data;
    }

    /**
     * Kompresja Gzip
     */
    private compressGzip(data: Uint8Array): Uint8Array {
        return this.compressZlib(data); // Gzip to Zlib + nagłówek
    }

    /**
     * Dekompresja Gzip
     */
    private decompressGzip(data: Uint8Array, originalSize: number): Uint8Array {
        return this.decompressZlib(data, originalSize);
    }

    /**
     * Pobiera kod typu
     */
    private getTypeCode(type: CompressionType): number {
        const codes: Record<CompressionType, number> = {
            [CompressionType.NONE]: 0,
            [CompressionType.LZ4]: 1,
            [CompressionType.ZLIB]: 2,
            [CompressionType.GZIP]: 3
        };
        return codes[type] || 0;
    }

    /**
     * Pobiera typ z kodu
     */
    private getTypeFromCode(code: number): CompressionType {
        const types: CompressionType[] = [
            CompressionType.NONE,
            CompressionType.LZ4,
            CompressionType.ZLIB,
            CompressionType.GZIP
        ];
        return types[code] || CompressionType.NONE;
    }

    /**
     * Oblicza sumę kontrolną (CRC32)
     */
    private calculateChecksum(data: Uint8Array): number {
        // Prosta suma kontrolna (dla przykładu)
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < data.length; i++) {
            crc ^= data[i];
            for (let j = 0; j < 8; j++) {
                crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
            }
        }
        return ~crc >>> 0;
    }

    /**
     * Ustawia opcje kompresji
     */
    setOptions(options: Partial<CompressionOptions>): void {
        this.options = { ...this.options, ...options };
    }

    /**
     * Statystyki kompresji
     */
    getStats(): CompressionStats {
        return {
            type: this.options.type,
            level: this.options.level,
            threshold: this.options.threshold,
            ratio: 0 // TODO: obliczać rzeczywisty współczynnik
        };
    }
}

/**
 * Statystyki kompresji
 */
export interface CompressionStats {
    type: CompressionType;
    level: CompressionLevel;
    threshold: number;
    ratio: number;
}