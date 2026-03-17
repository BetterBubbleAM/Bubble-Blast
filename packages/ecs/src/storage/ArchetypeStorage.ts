/**
 * @file ArchetypeStorage.ts
 * @description Przechowuje encje w archtypach dla lepszej lokalności pamięci
 */

import { Entity, EntityId } from '../core/Entity';
import { Component, ComponentTypeId } from '../core/Component';

/**
 * Archtyp - unikalna kombinacja komponentów
 */
export class Archetype {
    public readonly id: number;
    public readonly mask: bigint;
    public readonly componentTypes: ComponentTypeId[];

    constructor(id: number, componentTypes: ComponentTypeId[]) {
        this.id = id;
        this.componentTypes = [...componentTypes].sort((a, b) => a - b);
        
        // Oblicz maskę
        let mask = 0n;
        for (const typeId of this.componentTypes) {
            mask |= 1n << BigInt(typeId);
        }
        this.mask = mask;
    }

    /**
     * Sprawdza czy archtyp pasuje do maski
     */
    matches(mask: bigint): boolean {
        return (this.mask & mask) === mask;
    }

    /**
     * Sprawdza czy archtyp jest równy innemu
     */
    equals(other: Archetype): boolean {
        if (this.id === other.id) return true;
        if (this.componentTypes.length !== other.componentTypes.length) return false;
        
        for (let i = 0; i < this.componentTypes.length; i++) {
            if (this.componentTypes[i] !== other.componentTypes[i]) return false;
        }
        
        return true;
    }

    /**
     * Hash code
     */
    hashCode(): string {
        return this.componentTypes.join('|');
    }
}

/**
 * Chunk danych - ciągły blok pamięci dla komponentów
 */
export class ComponentChunk<T extends Component> {
    public readonly capacity: number;
    public readonly typeId: ComponentTypeId;
    private data: T[] = [];
    private entities: EntityId[] = [];
    private size: number = 0;

    constructor(typeId: ComponentTypeId, capacity: number) {
        this.typeId = typeId;
        this.capacity = capacity;
        this.data = new Array(capacity);
        this.entities = new Array(capacity);
    }

    /**
     * Dodaje komponent do chunka
     */
    add(entityId: EntityId, component: T): number {
        if (this.size >= this.capacity) {
            throw new Error('Chunk pełny');
        }

        const index = this.size++;
        this.entities[index] = entityId;
        this.data[index] = component;
        
        return index;
    }

    /**
     * Usuwa komponent z chunka (swap z ostatnim)
     */
    remove(index: number): void {
        if (index < 0 || index >= this.size) return;

        this.size--;
        
        // Swap z ostatnim elementem
        if (index < this.size) {
            this.entities[index] = this.entities[this.size];
            this.data[index] = this.data[this.size];
        }
    }

    /**
     * Pobiera komponent
     */
    get(index: number): T | undefined {
        if (index < 0 || index >= this.size) return undefined;
        return this.data[index];
    }

    /**
     * Pobiera ID encji
     */
    getEntityId(index: number): EntityId | undefined {
        if (index < 0 || index >= this.size) return undefined;
        return this.entities[index];
    }

    /**
     * Znajduje indeks encji
     */
    findIndex(entityId: EntityId): number {
        for (let i = 0; i < this.size; i++) {
            if (this.entities[i] === entityId) {
                return i;
            }
        }
        return -1;
    }

    /**
     * Czy chunk jest pełny
     */
    isFull(): boolean {
        return this.size >= this.capacity;
    }

    /**
     * Czy chunk jest pusty
     */
    isEmpty(): boolean {
        return this.size === 0;
    }

    /**
     * Liczba elementów
     */
    getSize(): number {
        return this.size;
    }

    /**
     * Pojemność
     */
    getCapacity(): number {
        return this.capacity;
    }

    /**
     * Iteruje po elementach
     */
    *[Symbol.iterator](): Iterator<[EntityId, T]> {
        for (let i = 0; i < this.size; i++) {
            yield [this.entities[i], this.data[i]];
        }
    }
}

/**
 * Przechowuje encje w archtypach dla optymalnej wydajności
 */
export class ArchetypeStorage {
    private archetypes: Map<string, Archetype> = new Map();
    private entityArchetype: Map<EntityId, Archetype> = new Map();
    private chunks: Map<number, Map<ComponentTypeId, ComponentChunk<Component>[]>> = new Map();
    private entityIndices: Map<EntityId, Map<ComponentTypeId, { chunkIndex: number; elementIndex: number }>> = new Map();
    
    private nextArchetypeId: number = 0;
    private chunkSize: number = 64; // Rozmiar chunka - dostosowany do cache L1

    constructor(chunkSize: number = 64) {
        this.chunkSize = chunkSize;
    }

    /**
     * Tworzy nowy archtyp
     */
    private createArchetype(componentTypes: ComponentTypeId[]): Archetype {
        const id = this.nextArchetypeId++;
        const archetype = new Archetype(id, componentTypes);
        this.archetypes.set(archetype.hashCode(), archetype);
        
        // Inicjalizuj chunki dla tego archtypu
        const typeChunks = new Map();
        for (const typeId of componentTypes) {
            typeChunks.set(typeId, []);
        }
        this.chunks.set(id, typeChunks);
        
        return archetype;
    }

    /**
     * Znajduje lub tworzy archtyp
     */
    private getOrCreateArchetype(componentTypes: ComponentTypeId[]): Archetype {
        const sorted = [...componentTypes].sort((a, b) => a - b);
        const hashCode = sorted.join('|');
        
        let archetype = this.archetypes.get(hashCode);
        if (!archetype) {
            archetype = this.createArchetype(sorted);
        }
        
        return archetype;
    }

    /**
     * Dodaje encję do storage
     */
    addEntity(entity: Entity, components: Map<ComponentTypeId, Component>): void {
        const componentTypes = Array.from(components.keys());
        const archetype = this.getOrCreateArchetype(componentTypes);
        
        this.entityArchetype.set(entity.id, archetype);
        
        // Dla każdego typu komponentu znajdź lub utwórz chunk i dodaj
        const entityIndices = new Map();
        
        for (const [typeId, component] of components) {
            const chunks = this.chunks.get(archetype.id)!.get(typeId)!;
            
            // Znajdź chunk z wolnym miejscem
            let chunk: ComponentChunk<Component> | undefined;
            let chunkIndex = -1;
            
            for (let i = 0; i < chunks.length; i++) {
                if (!chunks[i].isFull()) {
                    chunk = chunks[i];
                    chunkIndex = i;
                    break;
                }
            }
            
            // Jeśli nie znaleziono, utwórz nowy chunk
            if (!chunk) {
                chunk = new ComponentChunk<Component>(typeId, this.chunkSize);
                chunkIndex = chunks.length;
                chunks.push(chunk);
            }
            
            // Dodaj komponent do chunka
            const elementIndex = chunk.add(entity.id, component);
            entityIndices.set(typeId, { chunkIndex, elementIndex });
        }
        
        this.entityIndices.set(entity.id, entityIndices);
    }

    /**
     * Aktualizuje encję (zmiana archtypu)
     */
    updateEntity(entity: Entity, oldComponents: ComponentTypeId[], newComponents: ComponentTypeId[]): void {
        // Usuń starą encję
        this.removeEntity(entity.id);
        
        // Pobierz wszystkie komponenty
        const components = new Map();
        for (const typeId of newComponents) {
            // TODO: pobierz komponent z entity
        }
        
        // Dodaj z nowym archtypem
        this.addEntity(entity, components);
    }

    /**
     * Usuwa encję ze storage
     */
    removeEntity(entityId: EntityId): void {
        const archetype = this.entityArchetype.get(entityId);
        if (!archetype) return;
        
        const indices = this.entityIndices.get(entityId);
        if (!indices) return;
        
        // Usuń z każdego chunka
        for (const [typeId, { chunkIndex, elementIndex }] of indices) {
            const chunks = this.chunks.get(archetype.id)!.get(typeId)!;
            if (chunks[chunkIndex]) {
                chunks[chunkIndex].remove(elementIndex);
                
                // Jeśli chunk pusty, usuń go
                if (chunks[chunkIndex].isEmpty()) {
                    chunks.splice(chunkIndex, 1);
                }
            }
        }
        
        this.entityArchetype.delete(entityId);
        this.entityIndices.delete(entityId);
    }

    /**
     * Pobiera komponent dla encji
     */
    getComponent<T extends Component>(entityId: EntityId, typeId: ComponentTypeId): T | undefined {
        const indices = this.entityIndices.get(entityId);
        if (!indices) return undefined;
        
        const location = indices.get(typeId);
        if (!location) return undefined;
        
        const archetype = this.entityArchetype.get(entityId)!;
        const chunks = this.chunks.get(archetype.id)!.get(typeId)!;
        const chunk = chunks[location.chunkIndex];
        
        return chunk?.get(location.elementIndex) as T;
    }

    /**
     * Iteruje po encjach w archtypie
     */
    query(componentTypes: ComponentTypeId[]): IterableIterator<[EntityId, Map<ComponentTypeId, Component>]> {
        const archetypes = this.findMatchingArchetypes(componentTypes);
        const results: [EntityId, Map<ComponentTypeId, Component>][] = [];
        
        for (const archetype of archetypes) {
            const chunks = this.chunks.get(archetype.id)!;
            
            // Zakładając że wszystkie komponenty są w tych samych chunkach
            const firstType = componentTypes[0];
            const firstChunks = chunks.get(firstType) || [];
            
            for (let chunkIndex = 0; chunkIndex < firstChunks.length; chunkIndex++) {
                const chunk = firstChunks[chunkIndex];
                
                for (let i = 0; i < chunk.getSize(); i++) {
                    const entityId = chunk.getEntityId(i);
                    if (!entityId) continue;
                    
                    // Pobierz wszystkie komponenty
                    const components = new Map();
                    for (const typeId of componentTypes) {
                        const comp = this.getComponent(entityId, typeId);
                        if (comp) {
                            components.set(typeId, comp);
                        }
                    }
                    
                    results.push([entityId, components]);
                }
            }
        }
        
        return results[Symbol.iterator]();
    }

    /**
     * Znajduje archtypy pasujące do zapytania
     */
    private findMatchingArchetypes(componentTypes: ComponentTypeId[]): Archetype[] {
        const mask = this.createMask(componentTypes);
        const matches: Archetype[] = [];
        
        for (const archetype of this.archetypes.values()) {
            if (archetype.matches(mask)) {
                matches.push(archetype);
            }
        }
        
        return matches;
    }

    /**
     * Tworzy maskę z listy typów
     */
    private createMask(componentTypes: ComponentTypeId[]): bigint {
        let mask = 0n;
        for (const typeId of componentTypes) {
            mask |= 1n << BigInt(typeId);
        }
        return mask;
    }

    /**
     * Statystyki
     */
    getStats(): any {
        let totalEntities = 0;
        let totalChunks = 0;
        
        for (const [archetypeId, typeChunks] of this.chunks) {
            for (const chunks of typeChunks.values()) {
                totalChunks += chunks.length;
                for (const chunk of chunks) {
                    totalEntities += chunk.getSize();
                }
            }
        }
        
        return {
            archetypes: this.archetypes.size,
            entities: totalEntities,
            chunks: totalChunks,
            chunkSize: this.chunkSize,
            memoryEstimate: totalChunks * this.chunkSize * 64 // przybliżenie
        };
    }

    /**
     * Czyści storage
     */
    clear(): void {
        this.archetypes.clear();
        this.entityArchetype.clear();
        this.chunks.clear();
        this.entityIndices.clear();
        this.nextArchetypeId = 0;
    }
}