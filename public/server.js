const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server }); // Podłączamy WebSocket do serwera HTTP

// 1. Serwowanie pliku gracza (HTTP)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Ustawienia z tekstu bazowego
const TICKRATE = 30;
const EAT_THRESHOLD = 1.25;
const MAX_CELLS = 16;
const MASS_DECAY = 0.002;
const START_MASS = 20;
const VIRUS_MASS = 100;

let players = {};
let viruses =[];
let food =[];
const MAP_SIZE = 3000;

// Inicjalizacja
for(let i=0; i<500; i++) food.push({ x: Math.random()*MAP_SIZE, y: Math.random()*MAP_SIZE, mass: 1, id: i });
for(let i=0; i<15; i++) viruses.push({ x: Math.random()*MAP_SIZE, y: Math.random()*MAP_SIZE, mass: VIRUS_MASS, fed: 0, id: i });

function getRadius(mass) { return Math.sqrt(mass) * 10; }

// 2. Połączenia WebSocket (Gra)
wss.on('connection', (ws) => {
    let id = Math.random().toString();
    players[id] = { 
        id: id, 
        cells:[{ x: Math.random()*MAP_SIZE, y: Math.random()*MAP_SIZE, mass: START_MASS, vx: 0, vy: 0 }],
        mouseX: 0, mouseY: 0, name: "Gracz"
    };

    ws.on('message', (data) => {
        let msg = JSON.parse(data);
        let p = players[id];
        if (!p) return;

        if (msg.type === 'move') {
            p.mouseX = msg.x; p.mouseY = msg.y;
        } else if (msg.type === 'split') {
            if (p.cells.length >= MAX_CELLS) return;
            let currentCells = [...p.cells];
            currentCells.forEach(cell => {
                if (cell.mass > 35 && p.cells.length < MAX_CELLS) {
                    cell.mass /= 2;
                    let angle = Math.atan2(p.mouseY - cell.y, p.mouseX - cell.x);
                    p.cells.push({ x: cell.x, y: cell.y, mass: cell.mass, vx: Math.cos(angle) * 30, vy: Math.sin(angle) * 30 });
                }
            });
        } else if (msg.type === 'shoot') {
            p.cells.forEach(cell => {
                if (cell.mass > 30) {
                    cell.mass -= 15;
                }
            });
        }
    });

    ws.on('close', () => delete players[id]);
});

// SILNIK GRY - TICKRATE
setInterval(() => {
    Object.values(players).forEach(p => {
        p.cells.forEach((cell, index) => {
            let speed = 20 / Math.sqrt(cell.mass);
            let angle = Math.atan2(p.mouseY - cell.y, p.mouseX - cell.x);
            cell.x += Math.cos(angle) * speed + cell.vx;
            cell.y += Math.sin(angle) * speed + cell.vy;
            cell.vx *= 0.9; cell.vy *= 0.9;

            if (cell.mass > 500) cell.mass -= cell.mass * MASS_DECAY / TICKRATE; 
            if (cell.mass < START_MASS) cell.mass = START_MASS;

            Object.values(players).forEach(p2 => {
                if (p.id === p2.id) return;
                p2.cells.forEach((cell2, i2) => {
                    let dist = Math.sqrt((cell.x-cell2.x)**2 + (cell.y-cell2.y)**2);
                    if (dist < getRadius(cell.mass) && cell.mass >= cell2.mass * EAT_THRESHOLD) {
                        cell.mass += cell2.mass; p2.cells.splice(i2, 1);
                    }
                });
            });

            viruses.forEach((v, vIndex) => {
                if (Math.sqrt((cell.x-v.x)**2 + (cell.y-v.y)**2) < getRadius(cell.mass) && cell.mass >= v.mass * EAT_THRESHOLD) {
                    if (p.cells.length >= MAX_CELLS) {
                        cell.mass += v.mass;
                        viruses.splice(vIndex, 1);
                        viruses.push({ x: Math.random()*MAP_SIZE, y: Math.random()*MAP_SIZE, mass: VIRUS_MASS, fed: 0, id: Math.random() });
                    } else {
                        let parts = Math.min(MAX_CELLS - p.cells.length, Math.floor(cell.mass / 20));
                        for(let i=0; i<parts; i++) p.cells.push({ x: cell.x, y: cell.y, mass: cell.mass/parts, vx: (Math.random()-0.5)*40, vy: (Math.random()-0.5)*40 });
                        cell.mass /= parts; viruses.splice(vIndex, 1);
                    }
                }
            });

            food.forEach((f, fIndex) => {
                if (Math.sqrt((cell.x-f.x)**2 + (cell.y-f.y)**2) < getRadius(cell.mass)) {
                    cell.mass += f.mass; food[fIndex] = { x: Math.random()*MAP_SIZE, y: Math.random()*MAP_SIZE, mass: 1, id: Math.random() };
                }
            });
        });

        if (p.cells.length === 0) p.cells.push({ x: Math.random()*MAP_SIZE, y: Math.random()*MAP_SIZE, mass: START_MASS, vx:0, vy:0 });
    });

    let state = JSON.stringify({ players, food, viruses });
    wss.clients.forEach(client => { if (client.readyState === WebSocket.OPEN) client.send(state); });
}, 1000 / TICKRATE);

// 3. Nasłuchiwanie na porcie przydzielonym przez Render (process.env.PORT)
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Serwer wystartował na porcie ${PORT}`);
});
