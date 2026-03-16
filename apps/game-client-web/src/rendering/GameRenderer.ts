import { Camera } from './Camera';
import { Body } from '../../../../packages/physics-engine/src/bodies/Body';

export class GameRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    public camera: Camera;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.camera = new Camera();
    }

    public render(entities: Body[]) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. Rysowanie tła / siatki (GridRenderer zrobimy później)
        this.drawBackground();

        // 2. Rysowanie wszystkich kulek
        for (const entity of entities) {
            this.drawEntity(entity);
        }
    }

    private drawEntity(entity: Body) {
        const screenPos = this.camera.worldToScreen(
            entity.position, 
            this.canvas.width, 
            this.canvas.height
        );

        const scaledRadius = entity.radius * this.camera.zoom;

        // Pomijamy rysowanie, jeśli kulka jest poza ekranem (optymalizacja)
        if (screenPos.x + scaledRadius < 0 || screenPos.x - scaledRadius > this.canvas.width ||
            screenPos.y + scaledRadius < 0 || screenPos.y - scaledRadius > this.canvas.height) {
            return;
        }

        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, scaledRadius, 0, Math.PI * 2);
        this.ctx.fillStyle = '#ff0000'; // Tymczasowy kolor, potem weźmiemy z entity.color
        this.ctx.fill();
        this.ctx.closePath();
    }

    private drawBackground() {
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
}