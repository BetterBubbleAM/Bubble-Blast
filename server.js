const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

// To polecenie mówi serwerowi, gdzie są pliki strony (obrazki, skrypty, html)
app.use(express.static(path.join(__dirname, 'public')));

// Dodatkowe zabezpieczenie: jeśli ktoś wejdzie na stronę główną, wyślij mu index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const CONFIG = {
    WORLD_SIZE: 3000,
    FOOD_COUNT: 150,
    START_MASS: 20
};

let players = {};
let food = [];

for (let i = 0; i < CONFIG.FOOD_COUNT; i++) {
    spawnFood();
}

function spawnFood() {
    food.push({
        id: Math.random(),
        x: Math.random() * CONFIG.WORLD_SIZE,
        y: Math.random() * CONFIG.WORLD_SIZE,
        color: `hsl(${Math.random() * 360}, 100%, 50%)`
    });
}

io.on('connection', (socket) => {
    socket.on('join', (name) => {
        players[socket.id] = {
            id: socket.id,
            name: name || "Player",
            x: CONFIG.WORLD_SIZE / 2,
            y: CONFIG.WORLD_SIZE / 2,
            mass: CONFIG.START_MASS,
            color: `hsl(${Math.random() * 360}, 100%, 60%)`,
            mouseX: 0, mouseY: 0
        };
    });

    socket.on('input', (data) => {
        if (players[socket.id]) {
            players[socket.id].mouseX = data.mouseX;
            players[socket.id].mouseY = data.mouseY;
        }
    });

    socket.on('disconnect', () => delete players[socket.id]);
});

setInterval(() => {
    Object.values(players).forEach(p => {
        let speed = 4 * Math.pow(p.mass, -0.44) * 20;
        let dx = p.mouseX;
        let dy = p.mouseY;
        let mag = Math.sqrt(dx*dx + dy*dy);
        if (mag > 1) {
            p.x += (dx / mag) * speed;
            p.y += (dy / mag) * speed;
        }
        p.x = Math.max(0, Math.min(CONFIG.WORLD_SIZE, p.x));
        p.y = Math.max(0, Math.min(CONFIG.WORLD_SIZE, p.y));

        food.forEach((f, index) => {
            let dist = Math.hypot(p.x - f.x, p.y - f.y);
            let radius = Math.sqrt(p.mass * 100 / Math.PI);
            if (dist < radius) {
                p.mass += 1;
                food.splice(index, 1);
                spawnFood();
            }
        });
    });
    io.emit('update', { players, food });
}, 16);

// Bardzo ważne dla Rendera: proces musi słuchać na porcie z proces.env.PORT
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT}`);
});
