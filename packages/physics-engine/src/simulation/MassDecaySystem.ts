import { PHYSICS } from '@shared/constants/PhysicsConstants';

export class MassDecaySystem {
    /**
     * Oblicza promień na podstawie masy.
     * Wzór 1 do 1: sqrt(masa * 100 / PI)
     */
    public static calculateRadius(mass: number): number {
        return Math.sqrt(mass * PHYSICS.SIZE_MULTIPLIER / Math.PI);
    }

    /**
     * Oblicza nową masę po upływie czasu (Decay).
     * Zapobiega campowaniu dużych graczy.
     */
    public static calculateDecay(currentMass: number, deltaTime: number): number {
        if (currentMass <= PHYSICS.MIN_MASS) return PHYSICS.MIN_MASS;

        // deltaTime to czas w sekundach od ostatniego ticku
        const loss = currentMass * PHYSICS.MASS_DECAY_RATE * deltaTime;
        return Math.max(PHYSICS.MIN_MASS, currentMass - loss);
    }
}
/**
     * Oblicza prędkość poruszania się na podstawie masy.
     * Im większy jesteś, tym wolniej się poruszasz.
     * Wzór: 2.2 * mass ^ -0.44
     */
    public static getSpeedMultiplier(mass: number): number {
        if (mass <= 0) return PHYSICS.PLAYER_SPEED_MULTIPLIER;
        
        return PHYSICS.PLAYER_SPEED_MULTIPLIER * Math.pow(mass, PHYSICS.SPEED_POWER);
    }