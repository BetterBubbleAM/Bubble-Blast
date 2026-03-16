import { Vector2 } from '@shared/math/Vector2';

export class CollisionSystem {
    /**
     * Sprawdza, czy dwa koła nachodzą na siebie.
     * Używamy distSq (kwadrat odległości), aby uniknąć ciężkiego Math.sqrt().
     */
    public static areCirclesOverlapping(pos1: Vector2, rad1: number, pos2: Vector2, rad2: number): boolean {
        const distanceSq = pos1.distSq(pos2);
        const radiusSum = rad1 + rad2;
        return distanceSq < radiusSum * radiusSum;
    }

    /**
     * Sprawdza, czy jedna kulka może zjeść drugą (Logika 1 do 1).
     * W Agar/Bubbleam kulka musi przykryć środek mniejszej kulki.
     */
    public static canEat(predatorRadius: number, predatorPos: Vector2, preyRadius: number, preyPos: Vector2): boolean {
        // Ofiara musi być co najmniej 10-20% mniejsza (zależnie od balansu)
        if (predatorRadius <= preyRadius * 1.15) return false;

        const distance = predatorPos.dist(preyPos);
        
        // Środek mniejszej kulki musi być wewnątrz większej kulki
        // Często dodaje się lekki margines, by zjadanie było "soczyste"
        return distance < predatorRadius - (preyRadius * 0.3);
    }
}
/**
     * Rozpycha dwie kulki, jeśli na siebie nachodzą (np. gdy są w jednej grupie).
     * Zapobiega "stakowaniu" się kulek w jednym punkcie.
     */
    public static resolveOverlap(pos1: Vector2, rad1: number, pos2: Vector2, rad2: number): Vector2 | null {
        const distance = pos1.dist(pos2);
        const minDistance = rad1 + rad2;

        if (distance < minDistance && distance > 0) {
            const overlap = minDistance - distance;
            const direction = new Vector2(
                (pos1.x - pos2.x) / distance,
                (pos1.y - pos2.y) / distance
            );
            
            // Zwracamy wektor przesunięcia
            return direction.mul(overlap * 0.5);
        }
        return null;
    }