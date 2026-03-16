import { Body } from '../../../packages/physics-engine/src/bodies/Body';
import { CollisionSystem } from '../../../packages/physics-engine/src/collision/CollisionSystem';
import { EntityType } from '../../../packages/shared-core/src/constants/NetworkOpcodes';

export class EatingSystem {
    /**
     * Sprawdza kolizje typu "zjadanie" między dwiema grupami encji
     */
    public static process(predators: Body[], prey: Body[], onEat: (predator: Body, eaten: Body) => void): void {
        for (const predator of predators) {
            for (const target of prey) {
                if (predator.id === target.id) continue;

                // Korzystamy z logiki promieni z CollisionSystem
                if (CollisionSystem.canEat(predator.radius, predator.position, target.radius, target.position)) {
                    onEat(predator, target);
                }
            }
        }
    }
}