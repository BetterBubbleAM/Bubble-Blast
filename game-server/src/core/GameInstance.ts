import { World } from '@ecs/core/World';
import { MovementSystem } from '../systems/MovementSystem';
import { CollisionSystem } from '../systems/CollisionSystem';

export class GameInstance {
    private world: World;

    constructor() {
        this.world = new World();
        this.initSystems();
    }

    private initSystems(): void {
        this.world.addSystem(new MovementSystem());
        this.world.addSystem(new CollisionSystem());
    }

    public update(dt: number): void {
        this.world.update(dt);
    }

    public getWorld(): World {
        return this.world;
    }
}