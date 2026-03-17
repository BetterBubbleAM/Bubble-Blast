import { Grid, GridItem } from "./Grid";

export class SpatialHash {
    private readonly grid: Grid;

    constructor(cellSize: number) {
        this.grid = new Grid(cellSize);
    }

    public insert(id: number, x: number, y: number, radius: number): void {
        this.grid.insert({ id, x, y, radius });
    }

    public update(id: number, x: number, y: number, radius: number): void {
        this.grid.update({ id, x, y, radius });
    }

    public remove(id: number): void {
        this.grid.remove(id);
    }

    public query(x: number, y: number, radius: number): number[] {
        return this.grid.query(x, y, radius);
    }

    public clear(): void {
        this.grid.clear();
    }
}