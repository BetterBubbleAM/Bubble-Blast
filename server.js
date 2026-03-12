const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serwowanie plików z folderu 'public' (aby uniknąć Not Found na Render)
app.use(express.static(path.join(__dirname, 'public')));

const TICKRATE = 30;
const MAP_SIZE = 4000;
let players = {};
let viruses = [];
let food =[];

// Inicjalizacja mapy
for(let i=0; i<800; i++) food.push({ id: i, x: Math.random()*MAP_SIZE, y: Math.random()*MAP_SIZE, mass: 1 });
for(let i=0; i<20; i++) viruses.push({ id: i, x: Math.random()*MAP_SIZE, y: Math.random()*MAP_SIZE, mass: 100 });

function getRadius(mass) { return Math.sqrt(mass * 100 / Math.PI); }

wss.on('connection', (ws) => {
    let id = Math.random().toString();
    ws.on('message', (data) => {
        let msg = JSON.parse(data);
        
        if (msg.type === 'join') {
            players[id] = {
                id: id, name: msg.name, mouseX: MAP_SIZE/2, mouseY: MAP_SIZE/2,
                cells:[{ x: Math.random()*MAP_SIZE, y: Math.random()*MAP_SIZE, mass: 20, vx: 0, vy: 0 }]
            };
        } else if (!players[id]) return;

        let p = players[id];
        if (msg.type === 'move') {
            p.mouseX = msg.x; p.mouseY = msg.y;
        } else if (msg.type === 'split') {
            if (p.cells.length >= 16) return; // Limit 16
            let newCells =[];
            p.cells.forEach(c => {
                if (c.mass >= 35 && p.cells.length + newCells.length < 16) {
                    c.mass /= 2;
                    let angle = Math.atan2(p.mouseY - c.y, p.mouseX - c.x);
                    newCells.push({ x: c.x, y: c.y, mass: c.mass, vx: Math.cos(angle) * 40, vy: Math.sin(angle) * 40 });
                }
            });
            p.cells.push(...newCells);
        } else if (msg.type === 'eject') {
            p.cells.forEach(c => {
                if (c.mass >= 30) c.mass -= 15; // Prosty wyrzut
            });
        }
    });

    ws.on('close', () => delete players[id]);
});

// Pętla Gry
setInterval(() => {
    let pList = Object.values(players);
    pList.forEach(p => {
        p.cells.forEach((cell, i) => {
            // Fizyka i pęd (velocity)
            let speed = 2.2 * Math.pow(cell.mass, -0.44) * 45 / (TICKRATE/10);
            let angle = Math.atan2(p.mouseY - cell.y, p.mouseX - cell.x);
            cell.x += Math.cos(angle) * speed + cell.vx;
            cell.y += Math.sin(angle) * speed + cell.vy;
            cell.vx *= 0.90; cell.vy *= 0.90;

            // Granice
            cell.x = Math.max(0, Math.min(MAP_SIZE, cell.x));
            cell.y = Math.max(0, Math.min(MAP_SIZE, cell.y));

            // Mass Decay
            if (cell.mass > 500) cell.mass -= (cell.mass * 0.002) / TICKRATE;

            // Jedzenie
            let r1 = getRadius(cell.mass);
            food.forEach((f, fi) => {
                if (Math.hypot(cell.x - f.x, cell.y - f.y) < r1) {
                    cell.mass += f.mass;
                    food[fi] = { id: Math.random(), x: Math.random()*MAP_SIZE, y: Math.random()*MAP_SIZE, mass: 1 };
                }
            });

            // Zjadanie innych graczy (Próg 1.25x i Overlap)
            pList.forEach(p2 => {
                if (p.id === p2.id) return;
                p2.cells.forEach((c2, i2) => {
                    let dist = Math.hypot(cell.x - c2.x, cell.y - c2.y);
                    if (dist < r1 && cell.mass >= c2.mass * 1.25) {
                        cell.mass += c2.mass;
                        p2.cells.splice(i2, 1);
                    }
                });
            });

            // Wirusy
            viruses.forEach((v, vi) => {
                if (Math.hypot(cell.x - v.x, cell.y - v.y) < r1 && cell.mass >= v.mass * 1.25) {
                    if (p.cells.length >= 16) {
                        cell.mass += v.mass; // Przechodzenie przez wirusa przy 16 czesciach
                    } else {
                        // Pop-split eksplozja
                        let parts = Math.min(16 - p.cells.length, Math.floor(cell.mass / 20));
                        for(let i=0; i<parts; i++) {
                            p.cells.push({ x: cell.x, y: cell.y, mass: cell.mass/parts, vx: (Math.random()-0.5)*40, vy: (Math.random()-0.5)*40 });
                        }
                        cell.mass /= parts;
                    }
                    viruses[vi] = { id: Math.random(), x: Math.random()*MAP_SIZE, y: Math.random()*MAP_SIZE, mass: 100 };
                }
            });
        });
        // Śmierć gracza
        if(p.cells.length === 0) delete players[p.id];
    });

    let state = JSON.stringify({ players, food, viruses });
    wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(state); });
}, 1000 / TICKRATE);

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Gra startuje na porcie ${PORT}`));