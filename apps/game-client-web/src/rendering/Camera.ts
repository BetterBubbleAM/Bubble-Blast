import { Vector2 } from '../../../../packages/shared-core/src/math/Vector2';

export class Camera {
    public position: Vector2 = new Vector2(0, 0);
    public zoom: number = 1;
    public targetZoom: number = 1;

    public update(targetPos: Vector2, lerpFactor: number) {
        // Płynne podążanie za graczem
        this.position.x += (targetPos.x - this.position.x) * lerpFactor;
        this.position.y += (targetPos.y - this.position.y) * lerpFactor;

        // Płynny zoom
        this.zoom += (this.targetZoom - this.zoom) * 0.1;
    }

    /**
     * Przelicza współrzędne gry na współrzędne ekranu (Canvas)
     */
    public worldToScreen(worldPos: Vector2, screenWidth: number, screenHeight: number): Vector2 {
        return new Vector2(
            (worldPos.x - this.position.x) * this.zoom + screenWidth / 2,
            (worldPos.y - this.position.y) * this.zoom + screenHeight / 2
        );
    }
}