export class BinaryWriter {
    private buffer: ArrayBuffer;
    private view: DataView;
    private offset: number;

    constructor(size: number = 2048) {
        this.buffer = new ArrayBuffer(size);
        this.view = new DataView(this.buffer);
        this.offset = 0;
    }

    /**
     * Zwraca gotowe dane do wysłania przez WebSocket.
     */
    public getBuffer(): Uint8Array {
        return new Uint8Array(this.buffer, 0, this.offset);
    }
    public writeUint8(value: number): void {
        this.view.setUint8(this.offset, value);
        this.offset += 1;
    }

    public writeUint16(value: number): void {
        this.view.setUint16(this.offset, value, true); // true = little-endian (standard w Bubble.am)
        this.offset += 2;
    }

    public writeUint32(value: number): void {
        this.view.setUint32(this.offset, value, true);
        this.offset += 4;
    }

    public writeInt32(value: number): void {
        this.view.setInt32(this.offset, value, true);
        this.offset += 4;
    }

    public writeFloat32(value: number): void {
        this.view.setFloat32(this.offset, value, true);
        this.offset += 4;
    }
    public writeString(value: string): void {
        for (let i = 0; i < value.length; i++) {
            this.writeUint16(value.charCodeAt(i)); // UTF-16 (standard w Agario)
        }
        this.writeUint16(0); // Znak końca stringa (null terminator)
    }
}