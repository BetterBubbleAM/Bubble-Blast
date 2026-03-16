import { Vector2 } from '@shared/math/Vector2';
import { Body } from '@physics-engine/bodies/Body';

export class SpatialHash {
    private grid: Map<string, Set<number>> = new Map();

    constructor(private cellSize: number = 400) {}

    /**
     * Zamienia pozycję X, Y na klucz string "kolumna,wiersz"
     */
    private getHash(pos: Vector2): string {
        const x = Math.floor(pos.x / this.cellSize);
        const y = Math.floor(pos.y / this.cellSize);
        return `${x},${y}`;
    }
    /**
     * Wstawia obiekt do odpowiedniej komórki siatki.
     */
    public insert(body: Body): void {
        const hash = this.getHash(body.position);
        if (!this.grid.has(hash)) {
            this.grid.set(hash, new Set());
        }
        this.grid.get(hash)!.add(body.id);
    }

    /**
     * Czyści siatkę (wywoływane co klatkę przed nowym przeliczeniem).
     */
    public clear(): void {
        this.grid.clear();
    }
    /**
     * Pobiera ID wszystkich obiektów w komórkach sąsiadujących z daną pozycją.
     */
    public getNearby(position: Vector2, radius: number): number[] {
        const nearbyIds: number[] = [];
        const startX = Math.floor((position.x - radius) / this.cellSize);
        const endX = Math.floor((position.x + radius) / this.cellSize);
        const startY = Math.floor((position.y - radius) / this.cellSize);
        const endY = Math.floor((position.y + radius) / this.cellSize);

        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                const hash = `${x},${y}`;
                const cell = this.grid.get(hash);
                if (cell) {
                    nearbyIds.push(...cell);
                }
            }
        }
        return nearbyIds;
    }
}