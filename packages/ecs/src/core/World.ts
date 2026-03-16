import { Body } from '@physics-engine/bodies/Body';

export class World {
    private entities: Map<number, Body> = new Map();
    private nextId: number = 1;

    constructor(public width: number, public height: number) {}

    /**
     * Tworzy i rejestruje nowe ciało w świecie gry.
     */
    public createEntity(body: Body): number {
        this.entities.set(body.id, body);
        return body.id;
    }

    /**
     * Usuwa ciało ze świata (np. po zjedzeniu).
     */
    public destroyEntity(id: number): boolean {
        return this.entities.delete(id);
    }

    public getEntity(id: number): Body | undefined {
        return this.entities.get(id);
    }

    public getAllEntities(): Body[] {
        return Array.from(this.entities.values());
    }
}
/**
     * Przelicza fizykę dla wszystkich obiektów w świecie.
     */
    public update(deltaTime: number): void {
        const entitiesArray = this.getAllEntities();
        
        // 1. Aktualizacja fizyki każdego ciała
        for (let i = 0; i < entitiesArray.length; i++) {
            entitiesArray[i].update(deltaTime, this.width);
        }

        // 2. Tutaj w przyszłości wejdzie CollisionSystem i SpatialHash
        // Aby optymalnie sprawdzać kto kogo zjadł.
    }

    public clear(): void {
        this.entities.clear();
        this.nextId = 1;
    }
}