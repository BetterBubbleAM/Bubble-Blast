import { HashFunction } from "./HashFunction";

export interface GridItem {
    id: number;
    x: number;
    y: number;
    radius: number;
}

export class Grid {
    private readonly cellSize: number;
    private readonly cells: Map<string, Set<number>> = new Map();
    private readonly items: Map<number, GridItem> = new Map();

    constructor(cellSize: number) {
        this.cellSize = cellSize;
    }

    public insert(item: GridItem): void {
        this.items.set(item.id, item);

        const keys = this.computeKeys(item);
        for (const key of keys) {
            let cell = this.cells.get(key);
            if (!cell) {
                cell = new Set();
                this.cells.set(key, cell);
            }
            cell.add(item.id);
        }
    }

    public update(item: GridItem): void {
        this.remove(item.id);
        this.insert(item);
    }

    public remove(id: number): void {
        const item = this.items.get(id);
        if (!item) return;

        const keys = this.computeKeys(item);
        for (const key of keys) {
            const cell = this.cells.get(key);
            if (!cell) continue;

            cell.delete(id);
            if (cell.size === 0) {
                this.cells.delete(key);
            }
        }

        this.items.delete(id);
    }

    public query(x: number, y: number, radius: number): number[] {
        const minX = Math.floor((x - radius) / this.cellSize);
        const maxX = Math.floor((x + radius) / this.cellSize);
        const minY = Math.floor((y - radius) / this.cellSize);
        const maxY = Math.floor((y + radius) / this.cellSize);

        const result: Set<number> = new Set();

        for (let gx = minX; gx <= maxX; gx++) {
            for (let gy = minY; gy <= maxY; gy++) {
                const key = HashFunction.hash(gx, gy);
                const cell = this.cells.get(key);
                if (!cell) continue;

                for (const id of cell) {
                    result.add(id);
                }
            }
        }

        return Array.from(result);
    }

    public clear(): void {
        this.cells.clear();
        this.items.clear();
    }

    private computeKeys(item: GridItem): string[] {
        const minX = Math.floor((item.x - item.radius) / this.cellSize);
        const maxX = Math.floor((item.x + item.radius) / this.cellSize);
        const minY = Math.floor((item.y - item.radius) / this.cellSize);
        const maxY = Math.floor((item.y + item.radius) / this.cellSize);

        const keys: string[] = [];

        for (let gx = minX; gx <= maxX; gx++) {
            for (let gy = minY; gy <= maxY; gy++) {
                keys.push(HashFunction.hash(gx, gy));
            }
        }

        return keys;
    }
}