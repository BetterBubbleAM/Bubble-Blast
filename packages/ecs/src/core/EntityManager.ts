import { Body } from '@physics-engine/bodies/Body';
import { EntityType } from '@shared/constants/NetworkOpcodes';

export class EntityManager {
    /**
     * Filtruje jednostki po typie.
     */
    public static getByType(entities: Body[], type: EntityType): Body[] {
        return entities.filter(e => e.type === type);
    }

    /**
     * Znajduje najbliższą jednostkę danego typu.
     * Przydatne dla Botów AI, które będziemy pisać później.
     */
    public static findNearest(origin: Body, entities: Body[], type: EntityType): Body | null {
        let nearest: Body | null = null;
        let minDist = Infinity;

        for (const entity of entities) {
            if (entity.id === origin.id || entity.type !== type) continue;

            const dist = origin.getDistanceTo(entity);
            if (dist < minDist) {
                minDist = dist;
                nearest = entity;
            }
        }

        return nearest;
    }
}