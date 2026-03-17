/**
 * @file registerSystems.ts
 * @description Rejestracja systemów ECS po stronie klienta
 */

import { AppContext } from './AppContext';
import { World } from '@ecs/core/World';
import { System, SystemPhase } from '@ecs/core/System';
import { IteratingSystem } from '@ecs/core/System';
import { PositionComponent } from '@ecs/core/Component';
import { VelocityComponent } from '@ecs/core/Component';
import { VisualComponent } from '@ecs/core/Component';
import { Vector2 } from '@shared-core/math/Vector2';

/**
 | System predykcji ruchu (klient)
 */
class PredictionSystem extends IteratingSystem {
    private context: AppContext;

    constructor(context: AppContext) {
        super('PredictionSystem');
        this.context = context;
        
        this.query = {
            with: [
                PositionComponent.typeId,
                VelocityComponent.typeId
            ]
        };
    }

    processEntity(entity: any, deltaTime: number): void {
        const position = entity.getComponent<PositionComponent>(PositionComponent.typeId);
        const velocity = entity.getComponent<VelocityComponent>(VelocityComponent.typeId);

        // Predykcja pozycji na podstawie prędkości
        position.x += velocity.vx * deltaTime;
        position.y += velocity.vy * deltaTime;
    }
}

/**
 | System interpolacji pozycji
 */
class InterpolationSystem extends IteratingSystem {
    private context: AppContext;
    private targetPositions: Map<number, Vector2> = new Map();

    constructor(context: AppContext) {
        super('InterpolationSystem');
        this.context = context;
        
        this.query = {
            with: [PositionComponent.typeId]
        };
    }

    setTargetPosition(entityId: number, target: Vector2): void {
        this.targetPositions.set(entityId, target.clone());
        this.invalidateCache();
    }

    processEntity(entity: any, deltaTime: number): void {
        const target = this.targetPositions.get(entity.id);
        if (!target) return;

        const position = entity.getComponent<PositionComponent>(PositionComponent.typeId);
        
        // Interpolacja liniowa
        const speed = 5.0; // jednostek na sekundę
        const dx = target.x - position.x;
        const dy = target.y - position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 1) {
            position.x = target.x;
            position.y = target.y;
            this.targetPositions.delete(entity.id);
        } else {
            const step = Math.min(speed * deltaTime, distance);
            const ratio = step / distance;
            position.x += dx * ratio;
            position.y += dy * ratio;
        }
    }
}

/**
 | System animacji
 */
class AnimationSystem extends IteratingSystem {
    private context: AppContext;

    constructor(context: AppContext) {
        super('AnimationSystem');
        this.context = context;
        
        this.query = {
            with: [VisualComponent.typeId]
        };
    }

    processEntity(entity: any, deltaTime: number): void {
        const visual = entity.getComponent<VisualComponent>(VisualComponent.typeId);
        
        // Animacje (np. pulsowanie)
        if (visual.spriteId === 'cell') {
            // Delikatne skalowanie
            visual.scale = 1.0 + Math.sin(Date.now() * 0.005) * 0.02;
        }
    }
}

/**
 | System renderowania (łącznik z SceneManager)
 */
class RenderSystem extends System {
    private context: AppContext;

    constructor(context: AppContext) {
        super('RenderSystem');
        this.context = context;
        
        this.query = {
            with: [
                PositionComponent.typeId,
                VisualComponent.typeId
            ]
        };
    }

    execute(world: World, deltaTime: number): void {
        // Renderowanie jest obsługiwane przez SceneManager
        // Ten system tylko aktualizuje dane dla renderera
        const entities = this.queryEntities(world);
        
        this.context.set('renderEntities', entities);
    }
}

/**
 | System czyszczący (usuwa encje oznaczone do usunięcia)
 */
class CleanupSystem extends IteratingSystem {
    constructor() {
        super('CleanupSystem');
    }

    processEntity(entity: any, deltaTime: number): void {
        if (entity.isMarkedForDeletion()) {
            // TODO: usuń z renderera
        }
    }
}

/**
 | Rejestruje wszystkie systemy klienckie
 */
export function registerSystems(context: AppContext): void {
    const world = context.ecsWorld;
    
    if (!world) {
        throw new Error('ECS World not initialized');
    }

    // Systemy predykcji (wykonywane jako pierwsze)
    world.registerSystem(
        new PredictionSystem(context),
        SystemPhase.PRE_UPDATE,
        100 // Wysoki priorytet
    );

    // System interpolacji
    world.registerSystem(
        new InterpolationSystem(context),
        SystemPhase.UPDATE,
        50
    );

    // System animacji
    world.registerSystem(
        new AnimationSystem(context),
        SystemPhase.UPDATE,
        25
    );

    // System renderowania (jako ostatni)
    world.registerSystem(
        new RenderSystem(context),
        SystemPhase.RENDER,
        0
    );

    // System czyszczący
    world.registerSystem(
        new CleanupSystem(),
        SystemPhase.CLEANUP,
        0
    );

    context.logger.info('Registered client systems');
}

// Eksportuj systemy dla debugowania
export {
    PredictionSystem,
    InterpolationSystem,
    AnimationSystem,
    RenderSystem,
    CleanupSystem
};