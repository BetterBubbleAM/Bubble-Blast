const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

const TICKRATE = 30;
const MAP_SIZE = 4000;
const START_MASS = 20; // Zasada 5: Zasada 0 masy (nie spada poniżej tej wartości)

let players = {};
let viruses =[];
let food = [];
let ejectedMass = []; // Nowa tablica na wyrzuconą masę ("W")

const colors =['#f44336', '#3f51b5', '#4caf50', '#ff9800', '#9c27b0', '#00bcd4', '#e91e63'];

// Inicjalizacja mapy
for(let i=0; i<800; i++) spawnFood(i);
for(let i=0; i<20; i++) spawnVirus(i);

function spawnFood(id) {
    food[id] = { id: id, x: Math.random()*MAP_SIZE, y: Math.random()*MAP_SIZE, mass: 1, color: colors[Math.floor(Math.random()*colors.length)] };
}
function spawnVirus(id, x, y, vx = 0, vy = 0) {
    viruses[id] = { 
        id: id, 
        x: x || Math.random()*MAP_SIZE, 
        y: y || Math.random()*MAP_SIZE, 
        mass: 100, // Zasada 3: Wartość odżywcza wirusa
        fed: 0,    // Licznik nakarmienia wirusa
        vx: vx, vy: vy 
    };
}

// Promień: R = sqrt(Mass * 100 / PI)
function getRadius(mass) { return Math.sqrt(mass * 100 / Math.PI); }

wss.on('connection', (ws) => {
    let id = Math.random().toString();
    ws.send(JSON.stringify({ type: 'init', id: id }));

    ws.on('message', (data) => {
        let msg = JSON.parse(data);
        
        if (msg.type === 'join') {
            players[id] = {
                id: id, name: msg.name, mouseX: MAP_SIZE/2, mouseY: MAP_SIZE/2,
                color: colors[Math.floor(Math.random()*colors.length)],
                cells:[{ x: Math.random()*MAP_SIZE, y: Math.random()*MAP_SIZE, mass: START_MASS, vx: 0, vy: 0 }]
            };
        } else if (!players[id]) return;

        let p = players[id];
        
        if (msg.type === 'move') {
            p.mouseX = msg.x; p.mouseY = msg.y;
        } 
        else if (msg.type === 'split') {
            // ZASADA 1 i 4: Line Split i twardy limit 16
            let currentCells = p.cells.length;
            if (currentCells >= 16) return; 

            let newCells =[];
            p.cells.forEach(c => {
                if (c.mass >= 35 && p.cells.length + newCells.length < 16) {
                    c.mass /= 2;
                    let angle = Math.atan2(p.mouseY - c.y, p.mouseX - c.x);
                    // Symulacja precyzyjnego Line Splita - wyrzut idealnie w stronę kursora
                    newCells.push({ 
                        x: c.x, y: c.y, mass: c.mass, 
                        vx: Math.cos(angle) * 70, vy: Math.sin(angle) * 70 
                    });
                }
            });
            p.cells.push(...newCells);
        } 
        else if (msg.type === 'eject') {
            // ZASADA 3 i 4: Macro Feed (E) i wyrzut masy (W)
            p.cells.forEach(c => {
                if (c.mass >= 35) {
                    c.mass -= 15;
                    let angle = Math.atan2(p.mouseY - c.y, p.mouseX - c.x);
                    let spawnRadius = getRadius(c.mass);
                    // Masa spawnuje się na krawędzi komórki i leci do przodu
                    ejectedMass.push({
                        id: Math.random(),
                        x: c.x + Math.cos(angle) * spawnRadius,
                        y: c.y + Math.sin(angle) * spawnRadius,
                        mass: 12, // Masa wyrzucona jest mniejsza niż koszt (15) - podatek silnika
                        color: p.color,
                        vx: Math.cos(angle) * 80,
                        vy: Math.sin(angle) * 80
                    });
                }
            });
        }
    });

    ws.on('close', () => delete players[id]);
});

// GŁÓWNA PĘTLA SILNIKA (TICKRATE 30)
setInterval(() => {
    let pIds = Object.keys(players);
    
    // 1. Aktualizacja wyrzuconej masy (Ejected Mass)
    for (let i = ejectedMass.length - 1; i >= 0; i--) {
        let em = ejectedMass[i];
        em.x += em.vx; em.y += em.vy;
        em.vx *= 0.90; em.vy *= 0.90; // Szybkie hamowanie
        em.x = Math.max(0, Math.min(MAP_SIZE, em.x));
        em.y = Math.max(0, Math.min(MAP_SIZE, em.y));
        
        // Zniknij, jeśli jest poza mapą (optymalizacja)
        if (em.vx < 0.5 && em.vy < 0.5 && (em.x <= 0 || em.x >= MAP_SIZE || em.y <= 0 || em.y >= MAP_SIZE)) {
            ejectedMass.splice(i, 1);
        }
    }

    // 2. Aktualizacja poruszających się wirusów (Zasada 3: Wektor wystrzału)
    viruses.forEach(v => {
        v.x += v.vx; v.y += v.vy;
        v.vx *= 0.95; v.vy *= 0.95;
        v.x = Math.max(0, Math.min(MAP_SIZE, v.x));
        v.y = Math.max(0, Math.min(MAP_SIZE, v.y));
    });

    // 3. Pętla Graczy
    pIds.forEach(id => {
        let p = players[id];
        
        for (let i = p.cells.length - 1; i >= 0; i--) {
            let cell = p.cells[i];

            // Prędkość i ruch
            let baseSpeed = 400; 
            let currentSpeed = (2.2 * Math.pow(cell.mass, -0.44) * baseSpeed) / TICKRATE;
            let angle = Math.atan2(p.mouseY - cell.y, p.mouseX - cell.x);
            
            cell.x += Math.cos(angle) * currentSpeed + cell.vx;
            cell.y += Math.sin(angle) * currentSpeed + cell.vy;
            cell.vx *= 0.85; cell.vy *= 0.85;

            cell.x = Math.max(0, Math.min(MAP_SIZE, cell.x));
            cell.y = Math.max(0, Math.min(MAP_SIZE, cell.y));

            // ZASADA 5: Ekonomia i Mass Decay
            if (cell.mass > 500) cell.mass -= (cell.mass * 0.002) / TICKRATE;
            if (cell.mass < START_MASS) cell.mass = START_MASS;

            let r1 = getRadius(cell.mass);

            // Jedzenie kulek
            food.forEach((f, fi) => {
                if (Math.hypot(cell.x - f.x, cell.y - f.y) < r1) {
                    cell.mass += f.mass;
                    spawnFood(fi);
                }
            });

            // Jedzenie wyrzuconej masy (W)
            for (let j = ejectedMass.length - 1; j >= 0; j--) {
                let em = ejectedMass[j];
                // Overlap: wyrzucona masa musi w całości wejść w komórkę
                if (Math.hypot(cell.x - em.x, cell.y - em.y) < r1 - getRadius(em.mass)/2) {
                    cell.mass += em.mass;
                    ejectedMass.splice(j, 1);
                }
            }

            // ZASADA 1: Matematyka Kolizji (Zjadanie graczy)
            pIds.forEach(id2 => {
                if (id === id2) return; // Self-feed tu pomijamy (wymagałby timera)
                let p2 = players[id2];
                
                for (let j = p2.cells.length - 1; j >= 0; j--) {
                    let c2 = p2.cells[j];
                    let r2 = getRadius(c2.mass);
                    let dist = Math.hypot(cell.x - c2.x, cell.y - c2.y);

                    // Pokrycie środka ciężkości i próg 1.25x
                    let maxR = Math.max(r1, r2);
                    if (dist < maxR) {
                        if (cell.mass >= c2.mass * 1.25) {
                            cell.mass += c2.mass;
                            p2.cells.splice(j, 1);
                        } else if (c2.mass >= cell.mass * 1.25) {
                            c2.mass += cell.mass;
                            p.cells.splice(i, 1);
                            break;
                        }
                    }
                }
            });
            if(!p.cells[i]) continue;

            // ZASADA 3: Wirusy (Kolizja Gracza z Wirusem)
            viruses.forEach((v, vi) => {
                if (Math.hypot(cell.x - v.x, cell.y - v.y) < r1 && cell.mass >= v.mass * 1.25) {
                    if (p.cells.length >= 16) {
                        // Twardy limit 16: bezpieczne jedzenie wirusów ("obijanie się")
                        cell.mass += v.mass;
                    } else {
                        // Eksplozja
                        let partsToCreate = Math.min(16 - p.cells.length, Math.floor(cell.mass / 20));
                        let newMass = cell.mass / partsToCreate;
                        cell.mass = newMass;
                        for(let k = 0; k < partsToCreate - 1; k++) {
                            p.cells.push({ 
                                x: cell.x, y: cell.y, mass: newMass, 
                                vx: (Math.random()-0.5)*90, vy: (Math.random()-0.5)*90 
                            });
                        }
                    }
                    // Po zjedzeniu wirus znika i odradza się w losowym miejscu
                    spawnVirus(vi);
                }
            });
        }
        
        // ZASADA 4: Auto-Respawn
        if (p.cells.length === 0) {
            // Zamiast kasować gracza, odradzamy go od razu
            p.cells.push({ x: Math.random()*MAP_SIZE, y: Math.random()*MAP_SIZE, mass: START_MASS, vx: 0, vy: 0 });
        }
    });

    // ZASADA 3: Wirusy (Kolizja Wyrzuconej Masy z Wirusem - Karmienie)
    for (let j = ejectedMass.length - 1; j >= 0; j--) {
        let em = ejectedMass[j];
        let hitVirus = false;

        viruses.forEach((v, vi) => {
            if (!hitVirus && Math.hypot(em.x - v.x, em.y - v.y) < getRadius(v.mass)) {
                v.mass += em.mass; // Wirus rośnie (na ekranie tego nie widać, ale nabiera mocy)
                v.fed++;
                hitVirus = true;

                // Jeśli nakarmiono 7 razy, wystrzel nowego
                if (v.fed >= 7) {
                    v.fed = 0;
                    v.mass = 100; // Reset masy wirusa-matki
                    let angle = Math.atan2(em.vy, em.vx); // Lot w kierunku ostatniej uderzającej kulki
                    let newVId = viruses.length;
                    // Tworzymy nowego wirusa lecącego jak pocisk (Virus War)
                    spawnVirus(newVId, v.x, v.y, Math.cos(angle) * 40, Math.sin(angle) * 40);
                }
            }
        });
        if (hitVirus) ejectedMass.splice(j, 1);
    }

    let state = JSON.stringify({ players, food, viruses, ejectedMass });
    wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(state); });
}, 1000 / TICKRATE);

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Bubble Silnik wystartował na porcie ${PORT}`));
