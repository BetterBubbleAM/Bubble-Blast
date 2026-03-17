/**
 * @file BinaryWriter.ts
 * @description Writer strumienia binarnego z automatycznym zwiększaniem bufora
 */

/**
 * Kolejność bajtów
 */
export enum ByteOrder {
    LITTLE_ENDIAN,
    BIG_ENDIAN
}

/**
 * Writer binarny z automatycznym zwiększaniem bufora
 */
export class BinaryWriter {
    private buffer: Uint8Array;
    private view: DataView;
    private position: number = 0;
    private byteOrder: ByteOrder;
    private expandSize: number;

    constructor(initialSize: number = 1024, byteOrder: ByteOrder = ByteOrder.LITTLE_ENDIAN, expandSize: number = 1024) {
        this.buffer = new Uint8Array(initialSize);
        this.view = new DataView(this.buffer.buffer);
        this.byteOrder = byteOrder;
        this.expandSize = expandSize;
    }

    /**
     * Zapewnia wystarczającą pojemność
     */
    private ensureCapacity(bytes: number): void {
        if (this.position + bytes <= this.buffer.length) return;

        const newSize = Math.max(this.buffer.length + this.expandSize, this.position + bytes);
        const newBuffer = new Uint8Array(newSize);
        newBuffer.set(this.buffer);
        this.buffer = newBuffer;
        this.view = new DataView(this.buffer.buffer);
    }

    /**
     * Zapisuje pojedynczy bajt
     */
    writeByte(value: number): this {
        this.ensureCapacity(1);
        this.view.setUint8(this.position, value & 0xFF);
        this.position++;
        return this;
    }

    /**
     * Zapisuje tablicę bajtów
     */
    writeBytes(value: Uint8Array): this {
        this.ensureCapacity(value.length);
        this.buffer.set(value, this.position);
        this.position += value.length;
        return this;
    }

    /**
     * Zapisuje 16-bitową liczbę całkowitą
     */
    writeUint16(value: number): this {
        this.ensureCapacity(2);
        if (this.byteOrder === ByteOrder.LITTLE_ENDIAN) {
            this.view.setUint16(this.position, value, true);
        } else {
            this.view.setUint16(this.position, value, false);
        }
        this.position += 2;
        return this;
    }

    /**
     * Zapisuje 32-bitową liczbę całkowitą
     */
    writeUint32(value: number): this {
        this.ensureCapacity(4);
        if (this.byteOrder === ByteOrder.LITTLE_ENDIAN) {
            this.view.setUint32(this.position, value, true);
        } else {
            this.view.setUint32(this.position, value, false);
        }
        this.position += 4;
        return this;
    }

    /**
     * Zapisuje 64-bitową liczbę całkowitą (jako BigInt)
     */
    writeUint64(value: bigint): this {
        this.ensureCapacity(8);
        if (this.byteOrder === ByteOrder.LITTLE_ENDIAN) {
            this.view.setBigUint64(this.position, value, true);
        } else {
            this.view.setBigUint64(this.position, value, false);
        }
        this.position += 8;
        return this;
    }

    /**
     * Zapisuje 32-bitową liczbę zmiennoprzecinkową
     */
    writeFloat32(value: number): this {
        this.ensureCapacity(4);
        if (this.byteOrder === ByteOrder.LITTLE_ENDIAN) {
            this.view.setFloat32(this.position, value, true);
        } else {
            this.view.setFloat32(this.position, value, false);
        }
        this.position += 4;
        return this;
    }

    /**
     * Zapisuje 64-bitową liczbę zmiennoprzecinkową
     */
    writeFloat64(value: number): this {
        this.ensureCapacity(8);
        if (this.byteOrder === ByteOrder.LITTLE_ENDIAN) {
            this.view.setFloat64(this.position, value, true);
        } else {
            this.view.setFloat64(this.position, value, false);
        }
        this.position += 8;
        return this;
    }

    /**
     * Zapisuje boolean
     */
    writeBoolean(value: boolean): this {
        this.writeByte(value ? 1 : 0);
        return this;
    }

    /**
     * Zapisuje string (długość + UTF-8)
     */
    writeString(value: string, maxLength: number = 65535): this {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(value);
        
        if (bytes.length > maxLength) {
            throw new Error(`String too long: ${bytes.length} > ${maxLength}`);
        }

        this.writeUint16(bytes.length);
        this.writeBytes(bytes);
        return this;
    }

    /**
     * Zapisuje string z 32-bitową długością (dla długich stringów)
     */
    writeString32(value: string): this {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(value);
        
        this.writeUint32(bytes.length);
        this.writeBytes(bytes);
        return this;
    }

    /**
     * Zapisuje liczbę ze zmienną długością (VarInt)
     */
    writeVarInt(value: number): this {
        let v = value >>> 0;
        
        while (v >= 0x80) {
            this.writeByte((v & 0x7F) | 0x80);
            v >>>= 7;
        }
        
        this.writeByte(v & 0x7F);
        return this;
    }

    /**
     * Zapisuje liczbę ze zmienną długością (ZigZag dla liczb ujemnych)
     */
    writeZigZag(value: number): this {
        const zigzag = (value << 1) ^ (value >> 31);
        return this.writeVarInt(zigzag >>> 0);
    }

    /**
     * Zapisuje tablicę liczb
     */
    writeIntArray(values: number[], writeFn: (value: number) => void): this {
        this.writeVarInt(values.length);
        for (const value of values) {
            writeFn.call(this, value);
        }
        return this;
    }

    /**
     * Zapisuje tablicę stringów
     */
    writeStringArray(values: string[]): this {
        this.writeVarInt(values.length);
        for (const value of values) {
            this.writeString(value);
        }
        return this;
    }

    /**
     * Zapisuje mapę (klucz-warotść)
     */
    writeMap<K, V>(
        map: Map<K, V>,
        writeKey: (key: K) => void,
        writeValue: (value: V) => void
    ): this {
        this.writeVarInt(map.size);
        for (const [key, value] of map) {
            writeKey.call(this, key);
            writeValue.call(this, value);
        }
        return this;
    }

    /**
     * Zapisuje datę jako timestamp
     */
    writeDate(date: Date): this {
        return this.writeUint64(BigInt(date.getTime()));
    }

    /**
     * Zapisuje z opcjonalną flagą obecności
     */
    writeOptional<T>(value: T | null | undefined, writeFn: (value: T) => void): this {
        if (value === null || value === undefined) {
            this.writeBoolean(false);
        } else {
            this.writeBoolean(true);
            writeFn.call(this, value);
        }
        return this;
    }

    /**
     * Zapisuje z bitową flagą (dla wielu opcjonalnych pól)
     */
    writeBitfield(values: boolean[]): this {
        let byte = 0;
        for (let i = 0; i < Math.min(values.length, 8); i++) {
            if (values[i]) {
                byte |= (1 << i);
            }
        }
        this.writeByte(byte);
        
        // Jeśli więcej niż 8 wartości, zapisz kolejne bajty
        if (values.length > 8) {
            this.writeBitfield(values.slice(8));
        }
        
        return this;
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
     * Pobiera aktualną pozycję
     */
    tell(): number {
        return this.position;
    }

    /**
     * Pomija bajty
     */
    skip(bytes: number): this {
        return this.seek(this.position + bytes);
    }

    /**
     * Zapisuje do bufora
     */
    toBuffer(): Uint8Array {
        return this.buffer.slice(0, this.position);
    }

    /**
     * Resetuje writer
     */
    reset(): this {
        this.position = 0;
        return this;
    }

    /**
     * Rozmiar zapisanych danych
     */
    get length(): number {
        return this.position;
    }

    /**
     * Pojemność bufora
     */
    get capacity(): number {
        return this.buffer.length;
    }
}