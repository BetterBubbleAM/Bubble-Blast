const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Stałe zgodne z bubbleam.pl
const WORLD_SIZE = 5000;
const START_MASS = 20;
const FOOD_COUNT = 300;

let players = {};
let food = [];

function spawnFood() {
    return {
        id: Math.random(),
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        color: `hsl(${Math.random() * 360}, 100%, 50%)`
    };
}

for (let i = 0; i < FOOD_COUNT; i++) food.push(spawnFood());

io.on('connection', (socket) => {
    socket.on('join', (name) => {
        players[socket.id] = {
            id: socket.id,
            name: name || "Player",
            x: Math.random() * WORLD_SIZE,
            y: Math.random() * WORLD_SIZE,
            mass: START_MASS,
            color: `hsl(${Math.random() * 360}, 100%, 60%)`,
            mouseX: 0, 
            mouseY: 0
        };
        socket.emit('init', socket.id);
    });

    socket.on('input', (data) => {
        if (players[socket.id]) {
            players[socket.id].mouseX = data.x;
            players[socket.id].mouseY = data.y;
        }
    });

    socket.on('disconnect', () => delete players[socket.id]);
});

// Pętla fizyki (60 FPS)
setInterval(() => {
    Object.values(players).forEach(p => {
        // DOKŁADNY WZÓR NA PRĘDKOŚĆ Z TWOICH PLIKÓW:
        // speedMultiplier = 2.2 * Math.pow(this.mass, -0.44) * 45;
        let speedMult = 2.2 * Math.pow(p.mass, -0.44) * 45;
        let speed = speedMult / 20; 

        // Obliczanie kierunku ruchu
        let dx = p.mouseX;
        let dy = p.mouseY;
        let angle = Math.atan2(dy, dx);
        
        // Ruch tylko jeśli myszka jest oddalona od środka
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
            p.x += Math.cos(angle) * speed;
            p.y += Math.sin(angle) * speed;
        }

        // Granice świata (z Twojego pliku: 0 do 5000)
        p.x = Math.max(0, Math.min(WORLD_SIZE, p.x));
        p.y = Math.max(0, Math.min(WORLD_SIZE, p.y));

        // Zjadanie jedzenia
        food.forEach((f, i) => {
            let dist = Math.hypot(p.x - f.x, p.y - f.y);
            let radius = Math.sqrt(p.mass * 100 / Math.PI); // Wzór promienia z Twojego pliku
            if (dist < radius) {
                p.mass += 1;
                food[i] = spawnFood();
            }
        });
    });

    io.emit('update', { players, food });
}, 16);

const PORT = process.env.PORT || 10000;
http.listen(PORT, () => console.log(`Gra ruszyła na porcie ${PORT}`));
