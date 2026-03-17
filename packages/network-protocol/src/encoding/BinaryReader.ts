/**
 * @file BinaryReader.ts
 * @description Reader strumienia binarnego
 */

import { ByteOrder } from './BinaryWriter';

/**
 * Reader binarny
 */
export class BinaryReader {
    private buffer: Uint8Array;
    private view: DataView;
    private position: number = 0;
    private byteOrder: ByteOrder;

    constructor(data: Uint8Array, byteOrder: ByteOrder = ByteOrder.LITTLE_ENDIAN) {
        this.buffer = data;
        this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        this.byteOrder = byteOrder;
    }

    /**
     * Sprawdza czy można odczytać N bajtów
     */
    private canRead(bytes: number): boolean {
        return this.position + bytes <= this.buffer.length;
    }

    /**
     * Czyta pojedynczy bajt
     */
    readByte(): number {
        if (!this.canRead(1)) {
            throw new Error('End of stream');
        }
        const value = this.view.getUint8(this.position);
        this.position++;
        return value;
    }

    /**
     * Czyta tablicę bajtów
     */
    readBytes(length: number): Uint8Array {
        if (!this.canRead(length)) {
            throw new Error('End of stream');
        }
        const value = this.buffer.slice(this.position, this.position + length);
        this.position += length;
        return value;
    }

    /**
     * Czyta 16-bitową liczbę całkowitą
     */
    readUint16(): number {
        if (!this.canRead(2)) {
            throw new Error('End of stream');
        }
        const value = this.byteOrder === ByteOrder.LITTLE_ENDIAN
            ? this.view.getUint16(this.position, true)
            : this.view.getUint16(this.position, false);
        this.position += 2;
        return value;
    }

    /**
     * Czyta 32-bitową liczbę całkowitą
     */
    readUint32(): number {
        if (!this.canRead(4)) {
            throw new Error('End of stream');
        }
        const value = this.byteOrder === ByteOrder.LITTLE_ENDIAN
            ? this.view.getUint32(this.position, true)
            : this.view.getUint32(this.position, false);
        this.position += 4;
        return value;
    }

    /**
     * Czyta 64-bitową liczbę całkowitą (jako BigInt)
     */
    readUint64(): bigint {
        if (!this.canRead(8)) {
            throw new Error('End of stream');
        }
        const value = this.byteOrder === ByteOrder.LITTLE_ENDIAN
            ? this.view.getBigUint64(this.position, true)
            : this.view.getBigUint64(this.position, false);
        this.position += 8;
        return value;
    }

    /**
     * Czyta 32-bitową liczbę zmiennoprzecinkową
     */
    readFloat32(): number {
        if (!this.canRead(4)) {
            throw new Error('End of stream');
        }
        const value = this.byteOrder === ByteOrder.LITTLE_ENDIAN
            ? this.view.getFloat32(this.position, true)
            : this.view.getFloat32(this.position, false);
        this.position += 4;
        return value;
    }

    /**
     * Czyta 64-bitową liczbę zmiennoprzecinkową
     */
    readFloat64(): number {
        if (!this.canRead(8)) {
            throw new Error('End of stream');
        }
        const value = this.byteOrder === ByteOrder.LITTLE_ENDIAN
            ? this.view.getFloat64(this.position, true)
            : this.view.getFloat64(this.position, false);
        this.position += 8;
        return value;
    }

    /**
     * Czyta boolean
     */
    readBoolean(): boolean {
        return this.readByte() !== 0;
    }

    /**
     * Czyta string (długość + UTF-8)
     */
    readString(): string {
        const length = this.readUint16();
        const bytes = this.readBytes(length);
        const decoder = new TextDecoder();
        return decoder.decode(bytes);
    }

    /**
     * Czyta string z 32-bitową długością
     */
    readString32(): string {
        const length = this.readUint32();
        const bytes = this.readBytes(length);
        const decoder = new TextDecoder();
        return decoder.decode(bytes);
    }

    /**
     * Czyta liczbę ze zmienną długością (VarInt)
     */
    readVarInt(): number {
        let result = 0;
        let shift = 0;
        let byte: number;

        do {
            byte = this.readByte();
            result |= (byte & 0x7F) << shift;
            shift += 7;
            if (shift > 35) {
                throw new Error('VarInt too long');
            }
        } while ((byte & 0x80) !== 0);

        return result >>> 0;
    }

    /**
     * Czyta liczbę ze zmienną długością (ZigZag)
     */
    readZigZag(): number {
        const zigzag = this.readVarInt();
        return (zigzag >> 1) ^ (-(zigzag & 1));
    }

    /**
     * Czyta tablicę liczb
     */
    readIntArray<T>(readFn: () => T): T[] {
        const length = this.readVarInt();
        const result: T[] = [];
        for (let i = 0; i < length; i++) {
            result.push(readFn.call(this));
        }
        return result;
    }

    /**
     * Czyta tablicę stringów
     */
    readStringArray(): string[] {
        return this.readIntArray(() => this.readString());
    }

    /**
     * Czyta mapę
     */
    readMap<K, V>(
        readKey: () => K,
        readValue: () => V
    ): Map<K, V> {
        const size = this.readVarInt();
        const map = new Map<K, V>();
        for (let i = 0; i < size; i++) {
            const key = readKey.call(this);
            const value = readValue.call(this);
            map.set(key, value);
        }
        return map;
    }

    /**
     * Czyta datę
     */
    readDate(): Date {
        const timestamp = this.readUint64();
        return new Date(Number(timestamp));
    }

    /**
     * Czyta opcjonalną wartość
     */
    readOptional<T>(readFn: () => T): T | null {
        const present = this.readBoolean();
        return present ? readFn.call(this) : null;
    }

    /**
     * Czyta pole bitowe
     */
    readBitfield(bits: number): boolean[] {
        const result: boolean[] = [];
        const bytes = Math.ceil(bits / 8);
        
        for (let i = 0; i < bytes; i++) {
            const byte = this.readByte();
            for (let j = 0; j < 8 && result.length < bits; j++) {
                result.push(((byte >> j) & 1) === 1);
            }
        }
        
        return result;
    }

    /**
     * Pobiera aktualną pozycję
     */
    tell(): number {
        return this.position;
    }

    /**
     * Przesuwa pozycję
     */
    seek(position: number): this {
        if (position < 0 || position > this.buffer.length) {
            throw new Error('Invalid seek position');
        }
        this.position = position;
        return this;
    }

    /**
     * Pomija bajty
     */
    skip(bytes: number): this {
        return this.seek(this.position + bytes);
    }

    /**
     * Sprawdza czy osiągnięto koniec
     */
    get eof(): boolean {
        return this.position >= this.buffer.length;
    }

    /**
     * Pozostałe bajty do odczytu
     */
    get remaining(): number {
        return this.buffer.length - this.position;
    }

    /**
     * Rozmiar bufora
     */
    get length(): number {
        return this.buffer.length;
    }

    /**
     * Resetuje pozycję
     */
    reset(): this {
        this.position = 0;
        return this;
    }
}