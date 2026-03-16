import { Body } from '../../../packages/physics-engine/src/bodies/Body';
import { Integrator } from '../../../packages/physics-engine/src/simulation/Integrator';

export class MovementSystem {
    /**
     * Przetwarza ruch dla wszystkich aktywnych jednostek
     */
    public static update(entities: Body[], dt: number, worldSize: number): void {
        for (const entity of entities) {
            // Używamy integratora, który napisaliśmy wcześniej w physics-engine
            Integrator.update(entity.position, entity.velocity, dt);
        }
    }
}