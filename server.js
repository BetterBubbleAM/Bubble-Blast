const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

// Ustawienia z tekstu bazowego
const TICKRATE = 30;
const EAT_THRESHOLD = 1.25; // pkt 1: 25% przewagi
const MAX_CELLS = 16;       // pkt 1: limit 16 części
const MASS_DECAY = 0.002;   // pkt 5: utrata 0.002 na sekundę
const START_MASS = 20;      // pkt 5: zasada 0 masy (minimum 20)
const VIRUS_MASS = 100;     // pkt 3: wartość odżywcza wirusa

let players = {};
let viruses = [];
let food =[];
const MAP_SIZE = 3000;

// Inicjalizacja jedzenia i wirusów
for(let i=0; i<500; i++) food.push({ x: Math.random()*MAP_SIZE, y: Math.random()*MAP_SIZE, mass: 1, id: i });
for(let i=0; i<15; i++) viruses.push({ x: Math.random()*MAP_SIZE, y: Math.random()*MAP_SIZE, mass: VIRUS_MASS, fed: 0, id: i });

function getRadius(mass) { return Math.sqrt(mass) * 10; }

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
        } else if (msg.type === 'split') { // pkt 4 i 7: mechanika podziału i pop-split
            if (p.cells.length >= MAX_CELLS) return; // pkt 1: Twardy limit silnika
            let currentCells = [...p.cells];
            currentCells.forEach(cell => {
                if (cell.mass > 35 && p.cells.length < MAX_CELLS) {
                    cell.mass /= 2;
                    // Wyrzut w kierunku myszki
                    let angle = Math.atan2(p.mouseY - cell.y, p.mouseX - cell.x);
                    p.cells.push({
                        x: cell.x, y: cell.y, mass: cell.mass,
                        vx: Math.cos(angle) * 30, vy: Math.sin(angle) * 30
                    });
                }
            });
        } else if (msg.type === 'shoot') { // pkt 3 i 4: Wyrzut masy / Macro Feed
            p.cells.forEach(cell => {
                if (cell.mass > 30) {
                    cell.mass -= 15;
                    let angle = Math.atan2(p.mouseY - cell.y, p.mouseX - cell.x);
                    // W grze zaimplementowano by tu obiekt "wystrzelonej masy", dla uproszczenia
                    // pomijamy kod poruszania się masy, skupiając się na mechanice wirusa.
                }
            });
        }
    });

    ws.on('close', () => delete players[id]);
});

// SILNIK GRY - TICKRATE (pkt 2)
setInterval(() => {
    Object.values(players).forEach(p => {
        let totalMass = 0;

        p.cells.forEach((cell, index) => {
            totalMass += cell.mass;

            // Ruch do myszki
            let speed = 20 / Math.sqrt(cell.mass);
            let angle = Math.atan2(p.mouseY - cell.y, p.mouseX - cell.x);
            cell.x += Math.cos(angle) * speed + cell.vx;
            cell.y += Math.sin(angle) * speed + cell.vy;
            
            // Wygaszanie pędu (po splicie)
            cell.vx *= 0.9; cell.vy *= 0.9;

            // pkt 5: Ekonomia i Mass Decay
            if (cell.mass > 500) {
                // (0.002 na sekundę / TICKRATE)
                cell.mass -= cell.mass * MASS_DECAY / TICKRATE; 
            }
            if (cell.mass < START_MASS) cell.mass = START_MASS;

            // pkt 1: Matematyka Kolizji i Konsumpcji
            Object.values(players).forEach(p2 => {
                if (p.id === p2.id) return; // Tymczasowo ignorujemy łączenie się własnych komórek
                p2.cells.forEach((cell2, i2) => {
                    let dx = cell.x - cell2.x; let dy = cell.y - cell2.y;
                    let dist = Math.sqrt(dx*dx + dy*dy);
                    let r1 = getRadius(cell.mass); let r2 = getRadius(cell2.mass);

                    // Próg pożarcia 1.25x i odległość środków < promień większego
                    if (dist < r1 && cell.mass >= cell2.mass * EAT_THRESHOLD) {
                        cell.mass += cell2.mass; // Konsumpcja
                        p2.cells.splice(i2, 1);
                    }
                });
            });

            // Kolizja z Wirusami (pkt 3: Anatomia Wirusa)
            viruses.forEach((v, vIndex) => {
                let dx = cell.x - v.x; let dy = cell.y - v.y;
                let dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < getRadius(cell.mass) && cell.mass >= v.mass * EAT_THRESHOLD) {
                    if (p.cells.length >= MAX_CELLS) {
                        // Zjedzenie wirusa, gdy mamy już 16 części
                        cell.mass += v.mass;
                        viruses.splice(vIndex, 1);
                        viruses.push({ x: Math.random()*MAP_SIZE, y: Math.random()*MAP_SIZE, mass: VIRUS_MASS, fed: 0, id: Math.random() });
                    } else {
                        // Eksplozja na wirusie
                        let parts = Math.min(MAX_CELLS - p.cells.length, Math.floor(cell.mass / 20));
                        for(let i=0; i<parts; i++) {
                            p.cells.push({
                                x: cell.x, y: cell.y, mass: cell.mass/parts,
                                vx: (Math.random()-0.5)*40, vy: (Math.random()-0.5)*40
                            });
                        }
                        cell.mass /= parts;
                        viruses.splice(vIndex, 1);
                    }
                }
            });

            // Kolizja z jedzeniem
            food.forEach((f, fIndex) => {
                let dx = cell.x - f.x; let dy = cell.y - f.y;
                if (Math.sqrt(dx*dx + dy*dy) < getRadius(cell.mass)) {
                    cell.mass += f.mass;
                    food[fIndex] = { x: Math.random()*MAP_SIZE, y: Math.random()*MAP_SIZE, mass: 1, id: Math.random() };
                }
            });
        });

        // Śmierć i Auto-Respawn (pkt 4)
        if (p.cells.length === 0) {
            p.cells.push({ x: Math.random()*MAP_SIZE, y: Math.random()*MAP_SIZE, mass: START_MASS, vx:0, vy:0 });
        }
    });

    // Rozsyłanie danych (Tickrate)
    let state = JSON.stringify({ players, food, viruses });
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(state);
    });
}, 1000 / TICKRATE);

console.log(`Serwer wystartował na porcie 8080 z tickrate ${TICKRATE}Hz`);
