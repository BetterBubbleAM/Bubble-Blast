import { Vector2 } from '@shared/math/Vector2';
import { PHYSICS } from '@shared/constants/PhysicsConstants';

export class Integrator {
    /**
     * Aktualizuje pozycję obiektu na podstawie prędkości.
     * Nakłada tarcie 0.92 dla płynnego zatrzymywania się (np. po wystrzale masy).
     */
    public static update(position: Vector2, velocity: Vector2, deltaTime: number): void {
        // Dodaj prędkość do pozycji
        position.x += velocity.x * deltaTime;
        position.y += velocity.y * deltaTime;

        // Nałóż tarcie (Friction) - kulka zwalnia, gdy nie jest pchana
        // Wzór 1 do 1 z Bubble.am
        velocity.mul(Math.pow(PHYSICS.FRICTION, deltaTime * 25));

        // Zatrzymaj całkowicie, jeśli prędkość jest znikoma (optymalizacja)
        if (velocity.magSq() < 0.01) {
            velocity.set(0, 0);
        }
    }
}