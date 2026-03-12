const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Klasa renderująca wiernie wyciągnięta z Twojego oryginalnego pliku Bubble.am
class Entity {
    constructor(x, y, mass, color, name, type = 'player') {
        this.x = x;
        this.y = y;
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
        ctx.translate(this.x, this.y);
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
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 3;
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        
        if (this.mass > 10 && this.type === 'player') {
            ctx.fillStyle = "white";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            let fontSize = Math.max(this.radius * 0.35, 12);
            ctx.font = `bold ${fontSize}px Ubuntu, sans-serif`;
            
            // Nick
            if (this.name) ctx.fillText(this.name, 0, 0);
            
            // Masa
            ctx.font = `${fontSize * 0.6}px Ubuntu, sans-serif`;
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

// Logika łączenia WebSockets (działa na lokalnym i na Render)
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${window.location.host}`);

let gameState = { players: {}, food: [], viruses:[] };
let myId = null;
let camX = 2000, camY = 2000, fovScale = 1;
let mouseX = 2000, mouseY = 2000;
let isPlaying = false;

// ---------------------------------------------------------
// Akcja przycisku PLAY
// ---------------------------------------------------------
document.getElementById('playBtn').addEventListener('click', (e) => {
    e.preventDefault();
    const nick = document.getElementById('nick').value;
    
    if (ws.readyState === WebSocket.OPEN) {
        // Chowamy nakładki (Lobby)
        document.getElementById('overlays').style.display = 'none';
        
        // Wysyłamy prośbę o dołączenie do gry
        ws.send(JSON.stringify({ type: 'join', name: nick }));
        isPlaying = true;
    } else {
        alert("Poczekaj chwilę, serwer jeszcze się łączy...");
    }
});

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'init') {
        myId = data.id; // Zapisujemy ID z serwera, by przypiąć kamerę
    } else {
        gameState = data;
    }
};

// Śledzenie kursora myszy
window.addEventListener('mousemove', (e) => {
    if (!isPlaying) return;
    
    // Konwersja myszki z ekranu klienta na koordynaty serwera (mapy)
    mouseX = (e.clientX - canvas.width / 2) / fovScale + camX;
    mouseY = (e.clientY - canvas.height / 2) / fovScale + camY;
    
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'move', x: mouseX, y: mouseY }));
    }
});

// Klawiszologia i System MACRO Feed
let macroInterval;
window.addEventListener('keydown', (e) => {
    if (!isPlaying || ws.readyState !== WebSocket.OPEN) return;
    
    if (e.code === 'Space') {
        ws.send(JSON.stringify({ type: 'split' }));
    }
    if (e.code === 'KeyW') {
        ws.send(JSON.stringify({ type: 'eject' }));
    }
    if (e.code === 'KeyE' && !macroInterval) {
        macroInterval = setInterval(() => {
            ws.send(JSON.stringify({ type: 'eject' }));
        }, 50); // Ekstremalnie szybkie makro!
    }
});
window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyE') {
        clearInterval(macroInterval);
        macroInterval = null;
    }
});

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Render Loop (Siatka, Zoom, Rysowanie)
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(fovScale, fovScale);
    ctx.translate(-camX, -camY);

    // Renderowanie Siatki Mapy
    ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
    ctx.lineWidth = 2;
    for(let i = 0; i <= 4000; i += 50) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 4000); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(4000, i); ctx.stroke();
    }

    // Renderowanie Jedzenia
    gameState.food.forEach(f => {
        new Entity(f.x, f.y, f.mass, f.color, '', 'food').draw(ctx);
    });

    // Renderowanie Wirusów
    gameState.viruses.forEach(v => {
        new Entity(v.x, v.y, v.mass, '#33ff33', '', 'virus').draw(ctx);
    });

    // Renderowanie Graczy
    let myPlayer = gameState.players[myId];

    Object.values(gameState.players).forEach(p => {
        // Sortujemy rosnąco, żeby mniejsze części były z tyłu
        p.cells.sort((a,b) => a.mass - b.mass).forEach(c => {
            new Entity(c.x, c.y, c.mass, p.color, p.name, 'player').draw(ctx);
        });
    });

    // Dynamiczna kamera i zoom out (pole widzenia zależne od masy)
    if (myPlayer && myPlayer.cells.length > 0) {
        let cx = 0, cy = 0, tMass = 0;
        myPlayer.cells.forEach(c => { cx += c.x; cy += c.y; tMass += c.mass; });
        cx /= myPlayer.cells.length;
        cy /= myPlayer.cells.length;
        
        // Płynny ruch kamery
        camX += (cx - camX) * 0.1;
        camY += (cy - camY) * 0.1;
        
        // FOV maleje im jesteśmy więksi (widzimy więcej mapy)
        let targetFov = Math.max(0.15, 1.5 - Math.log(tMass) * 0.15);
        fovScale += (targetFov - fovScale) * 0.05;
    }

    ctx.restore();
    requestAnimationFrame(draw);
}
draw();
