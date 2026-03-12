const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Klasa Renderowania wyciągnięta z Twojego pliku main_out.js
class Entity {
    constructor(x, y, mass, color, name, type = 'player') {
        this.pos = new Vector2(x, y);
        this.mass = mass;
        this.color = color;
        this.name = name || "";
        this.type = type;
        this.updateRadius();
    }
    updateRadius() {
        this.radius = Math.sqrt(this.mass * 100 / Math.PI);
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        if (this.type === 'virus') {
            this.drawVirus(ctx);
        } else if (this.type === 'food') {
            ctx.fillStyle = this.color;
            ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fill();
        } else {
            this.drawCircle(ctx);
        }
        ctx.restore();
    }
    drawCircle(ctx) {
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 3;
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        if (this.mass > 15 && this.name) {
            ctx.fillStyle = "white";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            let fontSize = Math.max(this.radius * 0.35, 12);
            ctx.font = `bold ${fontSize}px Ubuntu, sans-serif`;
            ctx.fillText(this.name, 0, 0);
            ctx.font = `${fontSize * 0.6}px Ubuntu`;
            ctx.fillText(Math.floor(this.mass), 0, this.radius * 0.5);
        }
    }
    drawVirus(ctx) {
        const spikes = 20;
        ctx.fillStyle = "#33ff33";
        ctx.strokeStyle = "#22aa22";
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
            let r = i % 2 === 0 ? this.radius : this.radius * 0.85;
            let a = (i * Math.PI) / spikes;
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
    }
}

// System sieciowy
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${window.location.host}`);

let gameState = { players: {}, food: [], viruses: