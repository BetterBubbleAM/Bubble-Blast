import { Grid } from "./Grid";

export class Query {
    private readonly grid: Grid;

    constructor(grid: Grid) {
        this.grid = grid;
    }

    public radius(x: number, y: number, r: number): number[] {
        return this.grid.query(x, y, r);
    }
}