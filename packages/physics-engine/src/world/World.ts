/**
 * @file World.ts
 * @description Główna klasa świata fizycznego
 */

import { Vector2 } from '@shared-core/math/Vector2';
import { Body, BodyType } from '../bodies/Body';
import { CellBody } from '../bodies/CellBody';
import { VirusBody } from '../bodies/VirusBody';
import { PelletBody } from '../bodies/PelletBody';
import { WorldConfig, DEFAULT_WORLD_CONFIG, IntegrationType, SolverType } from './WorldConfig';
import { WorldBounds } from './WorldBounds';
import { CollisionSystem, Contact } from '../collision/CollisionSystem';
import { BroadPhase, BroadPhaseType } from '../collision/Broadphase';
import { NarrowPhase } from '../collision/Narrowphase';
import { Solver } from '../solver/Solver';
import { Integrator } from '../simulation/Integrator';
import { Logger, LogCategory } from '@shared-core/utils/Logger';
import { EventEmitter } from '@shared-core/events/EventEmitter';
import { PhysicsEvents } from '@shared-core/events/EventTypes';
import { EntityId } from '@shared-core/types/EntityTypes';

/**
 * Statystyki świata
 */
export interface WorldStats {
    bodyCount: number;
    dynamicCount: number;
    staticCount: number;
    contactCount: number;
    broadPhaseTime: number;
    narrowPhaseTime: number;
    solverTime: number;
    integrationTime: number;
    totalTime: number;
    iterations: number;
}

/**
 * Główny świat fizyczny
 */
export class World {
    public readonly config: WorldConfig;
    public bounds: WorldBounds;
    
    private bodies: Map<EntityId, Body> = new Map();
    private dynamicBodies: Set<Body> = new Set();
    private staticBodies: Set<Body> = new Set();
    
    private broadPhase: BroadPhase;
    private narrowPhase: NarrowPhase;
    private collisionSystem: CollisionSystem;
    private solver: Solver;
    private integrator: Integrator;
    
    private contacts: Contact[] = [];
    private logger: Logger;
    private eventEmitter?: EventEmitter;
    
    private time: number = 0;
    private accumulator: number = 0;
    private steps: number = 0;
    
    // Statystyki
    private stats: WorldStats = {
        bodyCount: 0,
        dynamicCount: 0,
        staticCount: 0,
        contactCount: 0,
        broadPhaseTime: 0,
        narrowPhaseTime: 0,
        solverTime: 0,
        integrationTime: 0,
        totalTime: 0,
        iterations: 0
    };

    constructor(config: Partial<WorldConfig> = {}, eventEmitter?: EventEmitter) {
        this.config = { ...DEFAULT_WORLD_CONFIG, ...config };
        this.eventEmitter = eventEmitter;
        this.logger = Logger.getInstance();
        
        // Inicjalizuj komponenty
        this.bounds = new WorldBounds({
            bounds: this.config.bounds,
            enableWalls: this.config.bounds.enableWalls,
            wallRestitution: this.config.bounds.wallRestitution,
            wallFriction: this.config.bounds.wallFriction
        });
        
        this.broadPhase = new BroadPhase(this.config.collision.broadPhase, {
            cellSize: this.config.optimizations.cellSize,
            maxBodiesPerCell: this.config.optimizations.maxBodiesPerCell
        });
        
        this.narrowPhase = new NarrowPhase();
        this.collisionSystem = new CollisionSystem();
        this.solver = new Solver(this.config.solver);
        this.integrator = new Integrator(this.config.integration.type);
        
        this.logger.info(LogCategory.PHYSICS, 'World initialized', this.config);
    }

    /**
     * Dodaje bryłę do świata
     */
    addBody(body: Body): void {
        this.bodies.set(body.id, body);
        
        if (body.type === BodyType.DYNAMIC) {
            this.dynamicBodies.add(body);
        } else {
            this.staticBodies.add(body);
        }
        
        this.broadPhase.insert(body);
        
        this.eventEmitter?.emit({
            type: 'physics:body:created',
            timestamp: Date.now(),
            entityId: body.id,
            type: body.type,
            mass: body.mass,
            radius: (body as any).radius || 0
        } as PhysicsEvents.BodyCreated);
        
        this.logger.debug(LogCategory.PHYSICS, `Body added: ${body.id}`);
    }

    /**
     * Usuwa bryłę ze świata
     */
    removeBody(bodyId: EntityId): boolean {
        const body = this.bodies.get(bodyId);
        if (!body) return false;
        
        this.bodies.delete(bodyId);
        this.dynamicBodies.delete(body);
        this.staticBodies.delete(body);
        this.broadPhase.remove(body);
        
        this.eventEmitter?.emit({
            type: 'physics:body:destroyed',
            timestamp: Date.now(),
            entityId: bodyId,
            reason: 'removed'
        } as PhysicsEvents.BodyDestroyed);
        
        return true;
    }

    /**
     * Pobiera bryłę po ID
     */
    getBody(bodyId: EntityId): Body | undefined {
        return this.bodies.get(bodyId);
    }

    /**
     * Aktualizuje świat fizyczny
     */
    step(dt: number): void {
        const startTime = performance.now();
        
        // Skaluj czas
        dt *= this.config.timeScale;
        
        // Fixed timestep
        this.accumulator += dt;
        
        while (this.accumulator >= this.config.integration.fixedTimeStep / 1000) {
            this.steps++;
            this.fixedStep(this.config.integration.fixedTimeStep / 1000);
            this.accumulator -= this.config.integration.fixedTimeStep / 1000;
            
            if (this.steps >= this.config.integration.maxSubSteps) {
                break;
            }
        }
        
        this.stats.totalTime = performance.now() - startTime;
    }

    /**
     * Pojedynczy krok fizyki
     */
    private fixedStep(dt: number): void {
        // 1. Broad phase - znajdź pary potencjalnie kolidujące
        const broadStart = performance.now();
        const potentialPairs = this.broadPhase.query();
        this.stats.broadPhaseTime = performance.now() - broadStart;
        
        // 2. Narrow phase - dokładna detekcja kolizji
        const narrowStart = performance.now();
        this.contacts = this.narrowPhase.checkCollisions(potentialPairs);
        this.stats.narrowPhaseTime = performance.now() - narrowStart;
        this.stats.contactCount = this.contacts.length;
        
        // Emituj zdarzenia kolizji
        this.emitCollisionEvents();
        
        // 3. Integracja sił i prędkości
        const integrationStart = performance.now();
        this.integrator.integrateVelocities(this.dynamicBodies, dt);
        this.stats.integrationTime = performance.now() - integrationStart;
        
        // 4. Inicjalizacja solvera
        this.solver.initialize(this.contacts);
        
        // 5. Rozwiązywanie kolizji (iteracje)
        const solverStart = performance.now();
        this.solver.solve(this.contacts, dt);
        this.stats.solverTime = performance.now() - solverStart;
        
        // 6. Integracja pozycji
        this.integrator.integratePositions(this.dynamicBodies, dt);
        
        // 7. Kolizje ze ścianami
        this.handleWallCollisions();
        
        // 8. Aktualizacja AABB i spatial hash
        this.updateSpatialData();
        
        // 9. Uśpienie obiektów
        if (this.config.collision.enableSleep) {
            this.sleepBodies(dt);
        }
        
        this.stats.iterations++;
        this.time += dt;
    }

    /**
     * Obsługuje kolizje ze ścianami
     */
    private handleWallCollisions(): void {
        for (const body of this.dynamicBodies) {
            const collisions = this.bounds.checkCollision(body);
            
            for (const collision of collisions) {
                this.bounds.resolveCollision(body, collision);
                
                this.eventEmitter?.emit({
                    type: 'physics:boundary:hit',
                    timestamp: Date.now(),
                    entityId: body.id,
                    boundary: collision.wall,
                    position: body.position
                } as PhysicsEvents.BoundaryHit);
            }
        }
    }

    /**
     * Aktualizuje dane przestrzenne
     */
    private updateSpatialData(): void {
        // Aktualizuj AABB
        for (const body of this.bodies.values()) {
            body.updateAABB();
        }
        
        // Aktualizuj spatial hash
        this.broadPhase.update();
    }

    /**
     * Usypia nieaktywne obiekty
     */
    private sleepBodies(dt: number): void {
        const threshold = this.config.collision.sleepThreshold;
        const timeToSleep = this.config.collision.timeToSleep;
        
        for (const body of this.dynamicBodies) {
            if (body.velocity.lengthSquared() < threshold * threshold &&
                Math.abs(body.angularVelocity) < threshold) {
                body.sleep();
            } else {
                body.wakeUp();
            }
        }
    }

    /**
     * Emituje zdarzenia kolizji
     */
    private emitCollisionEvents(): void {
        for (const contact of this.contacts) {
            this.eventEmitter?.emit({
                type: 'physics:collision',
                timestamp: Date.now(),
                bodyA: contact.bodyA.id,
                bodyB: contact.bodyB!.id,
                point: contact.point,
                normal: contact.normal,
                impulse: contact.normal.dot(contact.bodyA.velocity) * contact.bodyA.mass
            } as PhysicsEvents.Collision);
            
            if (this.config.debug.logCollisions) {
                this.logger.debug(LogCategory.PHYSICS, 
                    `Collision: ${contact.bodyA.id} - ${contact.bodyB!.id}`);
            }
        }
    }

    /**
     * Wykonuje raycast
     */
    raycast(origin: Vector2, direction: Vector2, maxDistance: number = Infinity): RaycastResult[] {
        const results: RaycastResult[] = [];
        const normalizedDir = direction.normalized();
        
        // Pobierz potencjalne obiekty z broad phase
        const rayAABB = this.calculateRayAABB(origin, normalizedDir, maxDistance);
        const candidates = this.broadPhase.queryAABB(rayAABB);
        
        for (const body of candidates) {
            const result = this.raycastBody(origin, normalizedDir, maxDistance, body);
            if (result) {
                results.push(result);
            }
        }
        
        // Sortuj według odległości
        results.sort((a, b) => a.distance - b.distance);
        
        return results;
    }

    /**
     * Raycast dla pojedynczej bryły
     */
    private raycastBody(
        origin: Vector2,
        direction: Vector2,
        maxDistance: number,
        body: Body
    ): RaycastResult | null {
        // Dla koła
        if (body.shape === 'circle') {
            const radius = (body as any).radius;
            const toCircle = body.position.subtracted(origin);
            
            const a = direction.dot(direction);
            const b = 2 * toCircle.dot(direction);
            const c = toCircle.dot(toCircle) - radius * radius;
            
            const discriminant = b * b - 4 * a * c;
            
            if (discriminant >= 0) {
                const t1 = (-b - Math.sqrt(discriminant)) / (2 * a);
                const t2 = (-b + Math.sqrt(discriminant)) / (2 * a);
                
                const t = t1 >= 0 ? t1 : t2;
                
                if (t >= 0 && t <= maxDistance) {
                    const point = origin.added(direction.multiplied(t));
                    const normal = point.subtracted(body.position).normalized();
                    
                    return {
                        body,
                        point,
                        normal,
                        distance: t,
                        fraction: t / maxDistance
                    };
                }
            }
        }
        
        return null;
    }

    /**
     * Oblicza AABB dla raycast
     */
    private calculateRayAABB(origin: Vector2, direction: Vector2, distance: number): AABB {
        const end = origin.added(direction.multiplied(distance));
        
        return {
            minX: Math.min(origin.x, end.x) - 1,
            minY: Math.min(origin.y, end.y) - 1,
            maxX: Math.max(origin.x, end.x) + 1,
            maxY: Math.max(origin.y, end.y) + 1
        };
    }

    /**
     * Zapisuje snapshot
     */
    snapshot(): WorldSnapshot {
        const bodies: any[] = [];
        
        for (const body of this.bodies.values()) {
            bodies.push(body.toJSON());
        }
        
        return {
            time: this.time,
            steps: this.steps,
            bodies,
            contacts: this.contacts.map(c => ({
                bodyAId: c.bodyA.id,
                bodyBId: c.bodyB!.id,
                point: c.point,
                normal: c.normal,
                penetration: c.penetration
            }))
        };
    }

    /**
     * Przywraca snapshot
     */
    restore(snapshot: WorldSnapshot): void {
        this.clear();
        
        for (const bodyData of snapshot.bodies) {
            let body: Body;
            
            switch (bodyData.shape) {
                case 'circle':
                    if (bodyData.type === 'virus') {
                        body = new VirusBody(
                            bodyData.id,
                            new Vector2(bodyData.position.x, bodyData.position.y),
                            bodyData.radius
                        );
                    } else if (bodyData.type === 'pellet') {
                        body = new PelletBody(
                            bodyData.id,
                            new Vector2(bodyData.position.x, bodyData.position.y),
                            bodyData.radius
                        );
                    } else {
                        body = new CellBody(
                            bodyData.id,
                            new Vector2(bodyData.position.x, bodyData.position.y),
                            bodyData.radius
                        );
                    }
                    break;
                default:
                    continue;
            }
            
            body.fromJSON(bodyData);
            this.addBody(body);
        }
        
        this.time = snapshot.time;
        this.steps = snapshot.steps;
    }

    /**
     * Czyści świat
     */
    clear(): void {
        this.bodies.clear();
        this.dynamicBodies.clear();
        this.staticBodies.clear();
        this.broadPhase.clear();
        this.contacts = [];
        this.time = 0;
        this.accumulator = 0;
        this.steps = 0;
    }

    /**
     * Pobiera statystyki
     */
    getStats(): WorldStats {
        this.stats.bodyCount = this.bodies.size;
        this.stats.dynamicCount = this.dynamicBodies.size;
        this.stats.staticCount = this.staticBodies.size;
        
        return { ...this.stats };
    }

    /**
     * Pobiera wszystkie bryły
     */
    getAllBodies(): Body[] {
        return Array.from(this.bodies.values());
    }

    /**
     * Pobiera bryły w obszarze
     */
    queryArea(aabb: AABB): Body[] {
        return this.broadPhase.queryAABB(aabb);
    }

    /**
     * Pobiera bryły w promieniu
     */
    queryRadius(center: Vector2, radius: number): Body[] {
        const aabb = {
            minX: center.x - radius,
            minY: center.y - radius,
            maxX: center.x + radius,
            maxY: center.y + radius
        };
        
        return this.broadPhase.queryAABB(aabb).filter(body => {
            const dx = body.position.x - center.x;
            const dy = body.position.y - center.y;
            return dx * dx + dy * dy <= radius * radius;
        });
    }
}

/**
 * Wynik raycast
 */
export interface RaycastResult {
    body: Body;
    point: Vector2;
    normal: Vector2;
    distance: number;
    fraction: number;
}

/**
 * Snapshot świata
 */
export interface WorldSnapshot {
    time: number;
    steps: number;
    bodies: any[];
    contacts: {
        bodyAId: EntityId;
        bodyBId: EntityId;
        point: Vector2;
        normal: Vector2;
        penetration: number;
    }[];
}

// Re-export AABB
export { AABB } from '../bodies/Body';