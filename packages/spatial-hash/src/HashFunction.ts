export class HashFunction {
    public static hash(x: number, y: number): string {
        return `${x},${y}`;
    }

    public static hashInt(x: number, y: number): number {
        // 32-bit mix
        let h = x * 73856093 ^ y * 19349663;
        h = (h ^ (h >>> 13)) >>> 0;
        return h;
    }
}