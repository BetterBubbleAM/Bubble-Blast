export class StateManager {
    public entities: Map<number, any> = new Map();

    public updateEntity(id: number, x: number, y: number, radius: number) {
        const entity = this.entities.get(id) || { id };
        entity.position = { x, y };
        entity.radius = radius;
        this.entities.set(id, entity);
    }

    public removeEntity(id: number) {
        this.entities.delete(id);
    }

    public getEntitiesArray() {
        return Array.from(this.entities.values());
    }
}