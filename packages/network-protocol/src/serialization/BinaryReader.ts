export class BinaryReader {
    private view: DataView;
    private offset: number = 0;

    constructor(buffer: ArrayBuffer) {
        this.view = new DataView(buffer);
    }

    public readUint8(): number {
        const val = this.view.getUint8(this.offset);
        this.offset += 1;
        return val;
    }

    public readUint16(): number {
        const val = this.view.getUint16(this.offset, true);
        this.offset += 2;
        return val;
    }

    public readInt32(): number {
        const val = this.view.getInt32(this.offset, true);
        this.offset += 4;
        return val;
    }

    public readFloat32(): number {
        const val = this.view.getFloat32(this.offset, true);
        this.offset += 4;
        return val;
    }

    public readString(): string {
        let str = "";
        while (true) {
            const charCode = this.readUint16();
            if (charCode === 0) break;
            str += String.fromCharCode(charCode);
        }
        return str;
    }
}