/**
 * @file MassDecaySystem.ts
 * @description System utraty masy w czasie (dla komórek)
 */

import { Body, BodyType } from '../bodies/Body';
import { CellBody } from '../bodies/CellBody';
import { GAMEPLAY_CONSTANTS } from '@shared-core/constants/GameplayConstants';

/**
 * System utraty masy
 */
export class MassDecaySystem {
    private decayRate: number = GAMEPLAY_CONSTANTS.DECAY_RATE;
    private minMass: number = GAMEPLAY_CONSTANTS.MIN_DECAY_MASS;
    private enabled: boolean = true;

    /**
     * Aktualizuje masę wszystkich komórek
     */
    update(bodies: Set<Body>, dt: number): void {
        if (!this.enabled) return;

        for (const body of bodies) {
            if (body.type !== BodyType.DYNAMIC) continue;
            if (!(body instanceof CellBody)) continue;

            this.updateCellMass(body, dt);
        }
    }

    /**
     * Aktualizuje masę pojedynczej komórki
     */
    private updateCellMass(cell: CellBody, dt: number): void {
        if (cell.mass <= this.minMass) return;

        // Oblicz utratę masy
        const decay = cell.mass * this.decayRate * dt;
        const newMass = Math.max(this.minMass, cell.mass - decay);

        if (newMass !== cell.mass) {
            cell.removeMass(cell.mass - newMass);
        }
    }

    /**
     * Włącza/wyłącza system
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    /**
     * Ustawia współczynnik utraty masy
     */
    setDecayRate(rate: number): void {
        this.decayRate = Math.max(0, Math.min(1, rate));
    }

    /**
     * Ustawia minimalną masę
     */
    setMinMass(minMass: number): void {
        this.minMass = minMass;
    }

    /**
     * Resetuje system
     */
    reset(): void {
        this.decayRate = GAMEPLAY_CONSTANTS.DECAY_RATE;
        this.minMass = GAMEPLAY_CONSTANTS.MIN_DECAY_MASS;
        this.enabled = true;
    }
}