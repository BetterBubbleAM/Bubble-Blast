import { Vector2 } from '@shared/math/Vector2';
import { PHYSICS } from '@shared/constants/PhysicsConstants';

export class WorldBounds {
    /**
     * Utrzymuje kulkę wewnątrz granic mapy.
     */
    public static enforce(position: Vector2, radius: number, worldSize: number = PHYSICS.WORLD_SIZE): void {
        const halfSize = worldSize / 2;

        // Granica X
        if (position.x - radius < -halfSize) position.x = -halfSize + radius;
        if (position.x + radius > halfSize)  position.x = halfSize - radius;

        // Granica Y
        if (position.y - radius < -halfSize) position.y = -halfSize + radius;
        if (position.y + radius > halfSize)  position.y = halfSize - radius;
    }
}