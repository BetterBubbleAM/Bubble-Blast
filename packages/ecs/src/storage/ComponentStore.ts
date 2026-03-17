/**
 * @file ComponentStore.ts
 * @description Przechowuje komponenty w wydajnych strukturach danych
 */

import { Component, ComponentTypeId } from '../core/Component';
import { EntityId } from '../core/Entity';

/**
 * Statystyki sklepu komponentów
 */
export interface ComponentStoreStats {
    total: number;
    byType: Record<string, number>;
    memoryEstimate: number;
}

/**
 * Sklep komponentów - przechowuje komponenty w sparse sets
 */
export class ComponentStore {
    private stores: Map<ComponentTypeId, Map<EntityId, Component>> = new Map();
    private entityComponents: Map<EntityId, Set<ComponentTypeId>> = new Map();
    private maxEntities: number;

    constructor(maxEntities: number = 100000) {
        this.maxEntities = maxEntities;
    }

    /**
     * Ustawia komponent dla encji
     */
    setComponent(entityId: EntityId, typeId: ComponentTypeId, component: Component): void {
        // Pobierz lub utwórz store dla tego typu
        let typeStore = this.stores.get(typeId);
        if (!typeStore) {
            typeStore = new Map();
            this.stores.set(typeId, typeStore);
        }

        // Zapisz komponent
        typeStore.set(entityId, component);

        // Zapisz informację dla encji
        let entitySet = this.entityComponents.get(entityId);
        if (!entitySet) {
            entitySet = new Set();
            this.entityComponents.set(entityId, entitySet);
        }
        entitySet.add(typeId);
    }

    /**
     * Pobiera komponent dla encji
     */
    getComponent<T extends Component>(entityId: EntityId, typeId: ComponentTypeId): T | undefined {
        const typeStore = this.stores.get(typeId);
        if (!typeStore) return undefined;
        return typeStore.get(entityId) as T;
    }

    /**
     * Usuwa komponent z encji
     */
    removeComponent(entityId: EntityId, typeId: ComponentTypeId): boolean {
        const typeStore = this.stores.get(typeId);
        if (!typeStore) return false;

        const removed = typeStore.delete(entityId);
        
        if (removed) {
            const entitySet = this.entityComponents.get(entityId);
            if (entitySet) {
                entitySet.delete(typeId);
                if (entitySet.size === 0) {
                    this.entityComponents.delete(entityId);
                }
            }
        }

        // Jeśli store jest pusty, usuń go
        if (typeStore.size === 0) {
            this.stores.delete(typeId);
        }

        return removed;
    }

    /**
     * Sprawdza czy encja ma komponent
     */
    hasComponent(entityId: EntityId, typeId: ComponentTypeId): boolean {
        const typeStore = this.stores.get(typeId);
        return typeStore ? typeStore.has(entityId) : false;
    }

    /**
     * Pobiera wszystkie komponenty dla encji
     */
    getComponentsForEntity(entityId: EntityId): Map<ComponentTypeId, Component> {
        const result = new Map<ComponentTypeId, Component>();
        const entitySet = this.entityComponents.get(entityId);
        
        if (entitySet) {
            for (const typeId of entitySet) {
                const comp = this.getComponent(entityId, typeId);
                if (comp) {
                    result.set(typeId, comp);
                }
            }
        }
        
        return result;
    }

    /**
     * Pobiera wszystkie encje które mają dany komponent
     */
    getEntitiesWithComponent(typeId: ComponentTypeId): EntityId[] {
        const typeStore = this.stores.get(typeId);
        return typeStore ? Array.from(typeStore.keys()) : [];
    }

    /**
     * Pobiera wszystkie encje które mają wszystkie podane komponenty
     */
    getEntitiesWithAllComponents(typeIds: ComponentTypeId[]): EntityId[] {
        if (typeIds.length === 0) return [];
        
        // Zacznij od najmniejszego setu
        const sortedTypes = [...typeIds].sort((a, b) => {
            const sizeA = this.stores.get(a)?.size || 0;
            const sizeB = this.stores.get(b)?.size || 0;
            return sizeA - sizeB;
        });

        const firstType = sortedTypes[0];
        const candidates = this.getEntitiesWithComponent(firstType);

        // Filtruj
        return candidates.filter(entityId => {
            for (let i = 1; i < sortedTypes.length; i++) {
                if (!this.hasComponent(entityId, sortedTypes[i])) {
                    return false;
                }
            }
            return true;
        });
    }

    /**
     * Pobiera wszystkie encje które mają którykolwiek z podanych komponentów
     */
    getEntitiesWithAnyComponent(typeIds: ComponentTypeId[]): EntityId[] {
        const resultSet = new Set<EntityId>();
        
        for (const typeId of typeIds) {
            const entities = this.getEntitiesWithComponent(typeId);
            for (const id of entities) {
                resultSet.add(id);
            }
        }
        
        return Array.from(resultSet);
    }

    /**
     * Usuwa wszystkie komponenty dla encji
     */
    removeAllComponentsForEntity(entityId: EntityId): void {
        const entitySet = this.entityComponents.get(entityId);
        if (!entitySet) return;

        for (const typeId of entitySet) {
            const typeStore = this.stores.get(typeId);
            if (typeStore) {
                typeStore.delete(entityId);
            }
        }

        this.entityComponents.delete(entityId);
    }

    /**
     * Liczba wszystkich komponentów
     */
    getComponentCount(): number {
        let total = 0;
        for (const store of this.stores.values()) {
            total += store.size;
        }
        return total;
    }

    /**
     * Liczba komponentów danego typu
     */
    getComponentCountForType(typeId: ComponentTypeId): number {
        return this.stores.get(typeId)?.size || 0;
    }

    /**
     * Statystyki
     */
    getStats(): ComponentStoreStats {
        const byType: Record<string, number> = {};
        let total = 0;

        for (const [typeId, store] of this.stores.entries()) {
            byType[String(typeId)] = store.size;
            total += store.size;
        }

        // Oszacowanie pamięci (przybliżone)
        const memoryEstimate = total * 64; // zakładając ~64 bajty na komponent

        return {
            total,
            byType,
            memoryEstimate
        };
    }

    /**
     * Czyści wszystkie komponenty
     */
    clear(): void {
        this.stores.clear();
        this.entityComponents.clear();
    }

    /**
     * Tworzy snapshot wszystkich komponentów
     */
    snapshot(): Map<ComponentTypeId, Map<EntityId, any>> {
        const snapshot = new Map();
        
        for (const [typeId, store] of this.stores.entries()) {
            const typeSnapshot = new Map();
            for (const [entityId, component] of store) {
                typeSnapshot.set(entityId, component.toJSON());
            }
            snapshot.set(typeId, typeSnapshot);
        }
        
        return snapshot;
    }

    /**
     * Przywraca stan z snapshota
     */
    restore(snapshot: Map<ComponentTypeId, Map<EntityId, any>>): void {
        this.clear();
        
        for (const [typeId, typeSnapshot] of snapshot) {
            const store = new Map();
            for (const [entityId, data] of typeSnapshot) {
                // TODO: utwórz komponent z danych
                store.set(entityId, data);
                
                // Aktualizuj entityComponents
                let entitySet = this.entityComponents.get(entityId);
                if (!entitySet) {
                    entitySet = new Set();
                    this.entityComponents.set(entityId, entitySet);
                }
                entitySet.add(typeId);
            }
            this.stores.set(typeId, store);
        }
    }

    /**
     * Sprawdza czy store dla typu istnieje
     */
    hasType(typeId: ComponentTypeId): boolean {
        return this.stores.has(typeId);
    }

    /**
     * Zwraca wszystkie typy komponentów
     */
    getAllTypes(): ComponentTypeId[] {
        return Array.from(this.stores.keys());
    }
}