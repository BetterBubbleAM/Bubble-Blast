import { WebSocketServer } from 'ws';
import { TickLoop } from '../core/TickLoop';
import { SessionManager } from '../networking/SessionManager';
import { PHYSICS } from '../../../packages/shared-core/src/constants/PhysicsConstants';

// --- NOWE IMPORTY ---
import { MovementSystem } from '../systems/MovementSystem';
import { EatingSystem } from '../systems/EatingSystem';
import { EntityType } from '../../../packages/shared-core/src/constants/NetworkOpcodes';
import { Body } from '../../../packages/physics-engine/src/bodies/Body';

export class Server {
    private wss: WebSocketServer;
    private loop: TickLoop;
    private sessions: SessionManager;
    
    // Lista wszystkich kulek na serwerze (tymczasowo tutaj, docelowo w core/WorldState)
    private entities: Body[] = [];

    constructor(port: number) {
        this.wss = new WebSocketServer({ port });
        this.sessions = new SessionManager();
        this.loop = new TickLoop(PHYSICS.TICK_RATE, (dt) => this.tick(dt));
    }

    public init() {
        // Generujemy trochę jedzenia na start
        this.spawnInitialFood();

        this.wss.on('connection', (ws) => {
            const id = Math.random().toString(36).substr(2, 9);
            this.sessions.addSession(id, ws);
            
            ws.on('close', () => this.sessions.removeSession(id));
            console.log(`[Server] Nowy gracz: ${id}`);
        });

        this.loop.start();
        console.log(`[Server] Bubble.am żyje na porcie ${this.wss.options.port}`);
    }

    private spawnInitialFood() {
        for (let i = 0; i < 200; i++) {
            const x = (Math.random() - 0.5) * PHYSICS.WORLD_SIZE;
            const y = (Math.random() - 0.5) * PHYSICS.WORLD_SIZE;
            this.entities.push(new Body(i, EntityType.FOOD, x, y, 10));
        }
    }

    private tick(dt: number) {
        // 1. Wykonaj ruch wszystkich kulek
        MovementSystem.update(this.entities, dt, PHYSICS.WORLD_SIZE);

        // 2. Podziel encje na grupy do systemu zjadania
        const players = this.entities.filter(e => e.type === EntityType.PLAYER);
        const food = this.entities.filter(e => e.type === EntityType.FOOD);

        // 3. Sprawdź kto kogo zjadł
        EatingSystem.process(players, food, (predator, eaten) => {
            predator.updateMass(predator.mass + eaten.mass);
            // Usuwamy zjedzoną kropkę z głównej listy
            this.entities = this.entities.filter(e => e.id !== eaten.id);
        });

        // 4. Tutaj w przyszłości wyślemy paczkę binarną do graczy przez SessionManager
    }
}