/**
 * @file BitBuffer.ts
 * @description Bufor do operacji bitowych - zapis/odczyt na poziomie bitów
 */

/**
 * Kolejność bajtów (endianness)
 */
export enum Endianness {
    LITTLE_ENDIAN,
    BIG_ENDIAN
}

/**
 * Bufor bitowy do efektywnej serializacji
 */
export class BitBuffer {
    private buffer: Uint8Array;
    private view: DataView;
    private bitPosition: number = 0;
    private bytePosition: number = 0;
    private endianness: Endianness;
    private growable: boolean;

    constructor(initialSize: number = 1024, endianness: Endianness = Endianness.LITTLE_ENDIAN, growable: boolean = true) {
        this.buffer = new Uint8Array(initialSize);
        this.view = new DataView(this.buffer.buffer);
        this.endianness = endianness;
        this.growable = growable;
    }

    /**
     * Zapewnia wystarczającą pojemność bufora
     */
    private ensureCapacity(neededBytes: number): void {
        if (this.bytePosition + neededBytes <= this.buffer.length) return;
        
        if (!this.growable) {
            throw new Error('BitBuffer: przekroczono pojemność bufora');
        }

        const newSize = Math.max(this.buffer.length * 2, this.bytePosition + neededBytes);
        const newBuffer = new Uint8Array(newSize);
        newBuffer.set(this.buffer);
        this.buffer = newBuffer;
        this.view = new DataView(this.buffer.buffer);
    }

    /**
     * Zapisuje bit (0 lub 1)
     */
    writeBit(value: boolean | number): void {
        this.ensureCapacity(Math.ceil((this.bitPosition + 1) / 8));

        const byteIndex = Math.floor(this.bitPosition / 8);
        const bitIndex = 7 - (this.bitPosition % 8); // MSB first

        const bit = value ? 1 : 0;
        this.buffer[byteIndex] = (this.buffer[byteIndex] & ~(1 << bitIndex)) | (bit << bitIndex);

        this.bitPosition++;
    }

    /**
     * Zapisuje wiele bitów
     */
    writeBits(value: number, bits: number): void {
        for (let i = bits - 1; i >= 0; i--) {
            this.writeBit((value >> i) & 1);
        }
    }

    /**
     * Zapisuje bajt
     */
    writeByte(value: number): void {
        this.ensureCapacity(1);
        this.view.setUint8(this.bytePosition, value & 0xFF);
        this.bytePosition += 1;
        this.bitPosition = this.bytePosition * 8;
    }

    /**
     * Zapisuje bajty
     */
    writeBytes(values: Uint8Array): void {
        this.ensureCapacity(values.length);
        this.buffer.set(values, this.bytePosition);
        this.bytePosition += values.length;
        this.bitPosition = this.bytePosition * 8;
    }

    /**
     * Zapisuje 16-bitową liczbę całkowitą
     */
    writeUint16(value: number): void {
        this.ensureCapacity(2);
        if (this.endianness === Endianness.LITTLE_ENDIAN) {
            this.view.setUint16(this.bytePosition, value, true);
        } else {
            this.view.setUint16(this.bytePosition, value, false);
        }
        this.bytePosition += 2;
        this.bitPosition = this.bytePosition * 8;
    }

    /**
     * Zapisuje 32-bitową liczbę całkowitą
     */
    writeUint32(value: number): void {
        this.ensureCapacity(4);
        if (this.endianness === Endianness.LITTLE_ENDIAN) {
            this.view.setUint32(this.bytePosition, value, true);
        } else {
            this.view.setUint32(this.bytePosition, value, false);
        }
        this.bytePosition += 4;
        this.bitPosition = this.bytePosition * 8;
    }

    /**
     * Zapisuje 32-bitową liczbę zmiennoprzecinkową
     */
    writeFloat32(value: number): void {
        this.ensureCapacity(4);
        if (this.endianness === Endianness.LITTLE_ENDIAN) {
            this.view.setFloat32(this.bytePosition, value, true);
        } else {
            this.view.setFloat32(this.bytePosition, value, false);
        }
        this.bytePosition += 4;
        this.bitPosition = this.bytePosition * 8;
    }

    /**
     * Zapisuje 64-bitową liczbę zmiennoprzecinkową
     */
    writeFloat64(value: number): void {
        this.ensureCapacity(8);
        if (this.endianness === Endianness.LITTLE_ENDIAN) {
            this.view.setFloat64(this.bytePosition, value, true);
        } else {
            this.view.setFloat64(this.bytePosition, value, false);
        }
        this.bytePosition += 8;
        this.bitPosition = this.bytePosition * 8;
    }

    /**
     * Zapisuje string (długość + dane)
     */
    writeString(value: string, maxLength: number = 255): void {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(value);
        
        if (bytes.length > maxLength) {
            throw new Error(`String too long: ${bytes.length} > ${maxLength}`);
        }

        this.writeByte(bytes.length); // długość jako 1 bajt
        this.writeBytes(bytes);
    }

    /**
     * Zapisuje string z 16-bitową długością
     */
    writeString16(value: string): void {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(value);
        
        if (bytes.length > 65535) {
            throw new Error(`String too long: ${bytes.length} > 65535`);
        }

        this.writeUint16(bytes.length);
        this.writeBytes(bytes);
    }

    /**
     * Zapisuje boolean
     */
    writeBoolean(value: boolean): void {
        this.writeBit(value);
    }

    /**
     * Zapisuje liczbę ze zmienną długością (zigzag)
     */
    writeVarInt(value: number): void {
        // Zigzag encoding dla liczb ujemnych
        let v = value < 0 ? (-value << 1) | 1 : value << 1;
        
        do {
            let byte = v & 0x7F;
            v >>>= 7;
            if (v !== 0) {
                byte |= 0x80;
            }
            this.writeByte(byte);
        } while (v !== 0);
    }

    /**
     * Zapisuje tablicę boolean
     */
    writeBooleanArray(values: boolean[]): void {
        this.writeUint16(values.length);
        for (const value of values) {
            this.writeBoolean(value);
        }
    }

    /**
     * Zapisuje tablicę liczb
     */
    writeNumberArray(values: number[], bitsPerValue: number = 16): void {
        this.writeUint16(values.length);
        for (const value of values) {
            this.writeBits(value, bitsPerValue);
        }
    }

    /**
     * Czyta bit
     */
    readBit(): boolean {
        const byteIndex = Math.floor(this.bitPosition / 8);
        const bitIndex = 7 - (this.bitPosition % 8);
        
        const value = (this.buffer[byteIndex] >> bitIndex) & 1;
        this.bitPosition++;
        
        return value === 1;
    }

    /**
     * Czyta wiele bitów
     */
    readBits(bits: number): number {
        let value = 0;
        for (let i = 0; i < bits; i++) {
            value = (value << 1) | (this.readBit() ? 1 : 0);
        }
        return value;
    }

    /**
     * Czyta bajt
     */
    readByte(): number {
        const value = this.view.getUint8(this.bytePosition);
        this.bytePosition += 1;
        this.bitPosition = this.bytePosition * 8;
        return value;
    }

    /**
     * Czyta wiele bajtów
     */
    readBytes(length: number): Uint8Array {
        const value = this.buffer.slice(this.bytePosition, this.bytePosition + length);
        this.bytePosition += length;
        this.bitPosition = this.bytePosition * 8;
        return value;
    }

    /**
     * Czyta 16-bitową liczbę
     */
    readUint16(): number {
        const value = this.endianness === Endianness.LITTLE_ENDIAN 
            ? this.view.getUint16(this.bytePosition, true)
            : this.view.getUint16(this.bytePosition, false);
        this.bytePosition += 2;
        this.bitPosition = this.bytePosition * 8;
        return value;
    }

    /**
     * Czyta 32-bitową liczbę
     */
    readUint32(): number {
        const value = this.endianness === Endianness.LITTLE_ENDIAN 
            ? this.view.getUint32(this.bytePosition, true)
            : this.view.getUint32(this.bytePosition, false);
        this.bytePosition += 4;
        this.bitPosition = this.bytePosition * 8;
        return value;
    }

    /**
     * Czyta 32-bitową liczbę zmiennoprzecinkową
     */
    readFloat32(): number {
        const value = this.endianness === Endianness.LITTLE_ENDIAN 
            ? this.view.getFloat32(this.bytePosition, true)
            : this.view.getFloat32(this.bytePosition, false);
        this.bytePosition += 4;
        this.bitPosition = this.bytePosition * 8;
        return value;
    }

    /**
     * Czyta 64-bitową liczbę zmiennoprzecinkową
     */
    readFloat64(): number {
        const value = this.endianness === Endianness.LITTLE_ENDIAN 
            ? this.view.getFloat64(this.bytePosition, true)
            : this.view.getFloat64(this.bytePosition, false);
        this.bytePosition += 8;
        this.bitPosition = this.bytePosition * 8;
        return value;
    }

    /**
     * Czyta string (długość + dane)
     */
    readString(): string {
        const length = this.readByte();
        const bytes = this.readBytes(length);
        const decoder = new TextDecoder();
        return decoder.decode(bytes);
    }

    /**
     * Czyta string z 16-bitową długością
     */
    readString16(): string {
        const length = this.readUint16();
        const bytes = this.readBytes(length);
        const decoder = new TextDecoder();
        return decoder.decode(bytes);
    }

    /**
     * Czyta boolean
     */
    readBoolean(): boolean {
        return this.readBit();
    }

    /**
     * Czyta liczbę ze zmienną długością
     */
    readVarInt(): number {
        let result = 0;
        let shift = 0;
        let byte: number;

        do {
            byte = this.readByte();
            result |= (byte & 0x7F) << shift;
            shift += 7;
        } while ((byte & 0x80) !== 0);

        // Zigzag decoding
        return (result >>> 1) ^ -(result & 1);
    }

    /**
     * Czyta tablicę boolean
     */
    readBooleanArray(): boolean[] {
        const length = this.readUint16();
        const result: boolean[] = [];
        for (let i = 0; i < length; i++) {
            result.push(this.readBoolean());
        }
        return result;
    }

    /**
     * Czyta tablicę liczb
     */
    readNumberArray(bitsPerValue: number = 16): number[] {
        const length = this.readUint16();
        const result: number[] = [];
        for (let i = 0; i < length; i++) {
            result.push(this.readBits(bitsPerValue));
        }
        return result;
    }

    /**
     * Skacze do pozycji
     */
    seek(position: number): void {
        if (position > this.buffer.length) {
            throw new Error('Position out of bounds');
        }
        this.bytePosition = position;
        this.bitPosition = position * 8;
    }

    /**
     * Skacze do pozycji bitowej
     */
    seekBit(bitPosition: number): void {
        if (Math.ceil(bitPosition / 8) > this.buffer.length) {
            throw new Error('Bit position out of bounds');
        }
        this.bitPosition = bitPosition;
        this.bytePosition = Math.floor(bitPosition / 8);
    }

    /**
     * Aktualna pozycja (w bajtach)
     */
    get position(): number {
        return this.bytePosition;
    }

    /**
     * Aktualna pozycja bitowa
     */
    get bitPos(): number {
        return this.bitPosition;
    }

    /**
     * Rozmiar bufora
     */
    get size(): number {
        return this.buffer.length;
    }

    /**
     * Zapisane dane (od początku do aktualnej pozycji)
     */
    get data(): Uint8Array {
        return this.buffer.slice(0, this.bytePosition);
    }

    /**
     * Cały bufor
     */
    get raw(): Uint8Array {
        return this.buffer.slice();
    }

    /**
     * Resetuje pozycję
     */
    reset(): void {
        this.bytePosition = 0;
        this.bitPosition = 0;
    }

    /**
     * Czyści bufor
     */
    clear(): void {
        this.buffer = new Uint8Array(1024);
        this.view = new DataView(this.buffer.buffer);
        this.reset();
    }

    /**
     * Tworzy kopię
     */
    clone(): BitBuffer {
        const clone = new BitBuffer(this.buffer.length, this.endianness, this.growable);
        clone.buffer.set(this.buffer);
        clone.bytePosition = this.bytePosition;
        clone.bitPosition = this.bitPosition;
        return clone;
    }

    /**
     * Sprawdza czy osiągnięto koniec
     */
    get eof(): boolean {
        return this.bytePosition >= this.buffer.length;
    }

    /**
     * Pozostałe bajty do odczytu
     */
    get remaining(): number {
        return this.buffer.length - this.bytePosition;
    }
}

/**
 * Writer dla bitów (uproszczony interfejs)
 */
export class BitWriter {
    private buffer: BitBuffer;

    constructor(initialSize: number = 1024) {
        this.buffer = new BitBuffer(initialSize);
    }

    writeBit(value: boolean | number): this {
        this.buffer.writeBit(value);
        return this;
    }

    writeBits(value: number, bits: number): this {
        this.buffer.writeBits(value, bits);
        return this;
    }

    writeByte(value: number): this {
        this.buffer.writeByte(value);
        return this;
    }

    writeUint16(value: number): this {
        this.buffer.writeUint16(value);
        return this;
    }

    writeUint32(value: number): this {
        this.buffer.writeUint32(value);
        return this;
    }

    writeFloat32(value: number): this {
        this.buffer.writeFloat32(value);
        return this;
    }

    writeFloat64(value: number): this {
        this.buffer.writeFloat64(value);
        return this;
    }

    writeString(value: string): this {
        this.buffer.writeString(value);
        return this;
    }

    writeBoolean(value: boolean): this {
        this.buffer.writeBoolean(value);
        return this;
    }

    writeVarInt(value: number): this {
        this.buffer.writeVarInt(value);
        return this;
    }

    toBuffer(): Uint8Array {
        return this.buffer.data;
    }
}

/**
 * Reader dla bitów (uproszczony interfejs)
 */
export class BitReader {
    private buffer: BitBuffer;

    constructor(data: Uint8Array) {
        this.buffer = new BitBuffer(data.length);
        this.buffer['buffer'].set(data); // hack na potrzeby przykładu
    }

    readBit(): boolean {
        return this.buffer.readBit();
    }

    readBits(bits: number): number {
        return this.buffer.readBits(bits);
    }

    readByte(): number {
        return this.buffer.readByte();
    }

    readUint16(): number {
        return this.buffer.readUint16();
    }

    readUint32(): number {
        return this.buffer.readUint32();
    }

    readFloat32(): number {
        return this.buffer.readFloat32();
    }

    readFloat64(): number {
        return this.buffer.readFloat64();
    }

    readString(): string {
        return this.buffer.readString();
    }

    readBoolean(): boolean {
        return this.buffer.readBoolean();
    }

    readVarInt(): number {
        return this.buffer.readVarInt();
    }

    get eof(): boolean {
        return this.buffer.eof;
    }
}