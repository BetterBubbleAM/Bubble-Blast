class Entity {
    constructor(x, y, mass, color, name, type = 'player') {
        this.pos = new Vector2(x, y);
        this.mass = mass;
        this.color = color;
        this.name = name || "";
        this.type = type;
        this.radius = 0;
        this.updateRadius();
    }

    updateRadius() {
        // Wzór z bubbleam.pl
        this.radius = Math.sqrt(this.mass * 100 / Math.PI);
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        this.drawCircle(ctx);
        ctx.restore();
    }

    drawCircle(ctx) {
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 2;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (this.mass > 10) {
            ctx.fillStyle = "white";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            let fontSize = Math.max(this.radius * 0.35, 12);
            ctx.font = `bold ${fontSize}px Ubuntu`;
            ctx.fillText(this.name, 0, 0);

            // Rysowanie masy jak w oryginale
            ctx.font = `${fontSize * 0.6}px Ubuntu`;
            ctx.fillText(Math.floor(this.mass), 0, this.radius * 0.5);
        }
    }
}
