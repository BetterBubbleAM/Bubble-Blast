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
let players = {};
let viruses = [];
let food = [];
const colors =['#f44336', '#3f51b5', '#4caf50', '#ff9800', '#9c27b0'];

// Inicjalizacja mapy
for(let i=0; i<800; i++) spawnFood(i);
for(let i=0; i<20; i++) spawnVirus(i);

function spawnFood(id) {
    food[id] = { id: id, x: Math.random()*MAP_SIZE, y: Math.random()*MAP_SIZE, mass: 1, color: colors[Math.floor(Math.random()*colors.length)] };
}
function spawnVirus(id) {
    viruses[id] = { id: id, x: Math.random()*MAP_SIZE, y: Math.random()*MAP_SIZE, mass: 100 };
}

// 2. Anatomia Komórki: Promień (R = sqrt(Mass * 100 / PI))
function getRadius(mass) { 
    return Math.sqrt(mass * 100 / Math.PI); 
}

wss.on('connection', (ws) => {
    let id = Math.random().toString();
    ws.send(JSON.stringify({ type: 'init', id: id }));

    ws.on('message', (data) => {
        let msg = JSON.parse(data);
        if (msg.type === 'join') {
            players[id] = {
                id: id, name: msg.name, mouseX: MAP_SIZE/2, mouseY: MAP_SIZE/2,
                color: colors[Math.floor(Math.random()*colors.length)],
                cells:[{ x: Math.random()*MAP_SIZE, y: Math.random()*MAP_SIZE, mass: 20, vx: 0, vy: 0 }]
            };
        } else if (!players[id]) return;

        let p = players[id];
        if (msg.type === 'move') {
            p.mouseX = msg.x; p.mouseY = msg.y;
        } else if (msg.type === 'split') {
            // 1. Zasada 16 części: To twardy limit silnika.
            let cellsCount = p.cells.length;
            if (cellsCount >= 16) return; 

            let newCells =[];
            p.cells.forEach(c => {
                if (c.mass >= 35 && cellsCount + newCells.length < 16) {
                    c.mass /= 2;
                    let angle = Math.atan2(p.mouseY - c.y, p.mouseX - c.x);
                    // Wyrzut komórki z początkowym pędem
                    newCells.push({ x: c.x, y: c.y, mass: c.mass, vx: Math.cos(angle) * 60, vy: Math.sin(angle) * 60 });
                }
            });
            p.cells.push(...newCells);
        } else if (msg.type === 'eject') {
            p.cells.forEach(c => {
                if (c.mass >= 35) c.mass -= 15; // Podstawa systemu wyrzucania masy
            });
        }
    });

    ws.on('close', () => delete players[id]);
});

// Pętla Tickrate
setInterval(() => {
    let pIds = Object.keys(players);
    
    pIds.forEach(id => {
        let p = players[id];
        
        // Pętla od tyłu, by bezpiecznie usuwać zjedzone komórki w locie
        for (let i = p.cells.length - 1; i >= 0; i--) {
            let cell = p.cells[i];

            // 2. Anatomia Komórki: Prędkość
            // Wzór: Speed maleje wraz ze wzrostem masy (v = 2.2 * m^-0.44)
            let baseSpeed = 400; // Mnożnik bazowy dopasowany do rozmiaru mapy
            let currentSpeed = (2.2 * Math.pow(cell.mass, -0.44) * baseSpeed) / TICKRATE;
            
            let angle = Math.atan2(p.mouseY - cell.y, p.mouseX - cell.x);
            cell.x += Math.cos(angle) * currentSpeed + cell.vx;
            cell.y += Math.sin(angle) * currentSpeed + cell.vy;
            cell.vx *= 0.85; // Tarcie pędu po podziale
            cell.vy *= 0.85;

            // Ograniczenia mapy
            cell.x = Math.max(0, Math.min(MAP_SIZE, cell.x));
            cell.y = Math.max(0, Math.min(MAP_SIZE, cell.y));

            // 2. Anatomia Komórki: Utrata masy (Mass Decay)
            // Utrata zaczyna się od progu 150 masy.
            if (cell.mass > 150) {
                cell.mass -= (cell.mass * 0.002) / TICKRATE;
            }

            let r1 = getRadius(cell.mass);

            // Kolizje z pożywieniem (Pokrycie środka ciężkości)
            food.forEach((f, fi) => {
                if (Math.hypot(cell.x - f.x, cell.y - f.y) < r1) {
                    cell.mass += f.mass;
                    spawnFood(fi); // Odradzamy zjedzone jedzenie
                }
            });

            // 1. Matematyka Kolizji i Konsumpcji
            pIds.forEach(id2 => {
                if (id === id2) return; // Ignoruj swoje komórki w tej fazie (zrobimy self-feed później)
                let p2 = players[id2];
                
                for (let j = p2.cells.length - 1; j >= 0; j--) {
                    let c2 = p2.cells[j];
                    let r2 = getRadius(c2.mass);
                    let dist = Math.hypot(cell.x - c2.x, cell.y - c2.y);

                    // Punkt krytyczny: Jeśli odległość środków < promień większego
                    // Próg pożarcia: Masa musi być 1.25x większa
                    if (cell.mass >= c2.mass * 1.25 && dist < r1) {
                        cell.mass += c2.mass;
                        p2.cells.splice(j, 1);
                    } else if (c2.mass >= cell.mass * 1.25 && dist < r2) {
                        c2.mass += cell.mass;
                        p.cells.splice(i, 1);
                        break; // Ta komórka nie istnieje, przerywamy sprawdzanie dla niej
                    }
                }
            });
            
            // Jeśli komórka została przed chwilą zjedzona, nie sprawdzaj wirusów
            if(!p.cells[i]) continue; 

            // 3. Anatomia Wirusa i Zasada 16 części
            viruses.forEach((v, vi) => {
                if (Math.hypot(cell.x - v.x, cell.y - v.y) < r1 && cell.mass >= v.mass * 1.25) {
                    if (p.cells.length >= 16) {
                        // Jeśli masz 16 części, po prostu zjadasz wirusa, nie wybuchasz
                        cell.mass += v.mass;
                    } else {
                        // Wybuch na wirusie
                        let partsToCreate = Math.min(16 - p.cells.length, Math.floor(cell.mass / 20));
                        let newMass = cell.mass / partsToCreate;
                        cell.mass = newMass;
                        
                        for(let k = 0; k < partsToCreate - 1; k++) {
                            p.cells.push({ 
                                x: cell.x, y: cell.y, mass: newMass, 
                                vx: (Math.random()-0.5)*100, vy: (Math.random()-0.5)*100 
                            });
                        }
                    }
                    spawnVirus(vi); // Odrodzenie wirusa na mapie
                }
            });
        }
        
        // Zabezpieczenie przed graczem z 0 komórkami (śmierć)
        if (p.cells.length === 0) {
            delete players[p.id];
        }
    });

    let state = JSON.stringify({ players, food, viruses });
    wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(state); });
}, 1000 / TICKRATE);

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Serwer z nowa fizyka dziala na porcie ${PORT}`));
