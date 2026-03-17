/**
 * @file AssetRegistry.ts
 * @description Rejestr assetów - przechowuje metadane o wszystkich assetach
 */

import { Logger, LogCategory } from '@shared-core/utils/Logger';

/**
 * Typ asseta
 */
export enum AssetType {
    TEXTURE = 'texture',
    SPRITE = 'sprite',
    AUDIO = 'audio',
    FONT = 'font',
    JSON = 'json',
    SHADER = 'shader',
    ANIMATION = 'animation',
    PREFAB = 'prefab'
}

/**
 * Stan asseta
 */
export enum AssetState {
    PENDING = 'pending',      // Oczekuje na załadowanie
    LOADING = 'loading',       // Ładowanie w toku
    LOADED = 'loaded',         // Załadowany
    ERROR = 'error',           // Błąd ładowania
    UNLOADED = 'unloaded'      // Wyładowany z pamięci
}

/**
 * Metadane asseta
 */
export interface AssetMetadata {
    id: string;
    type: AssetType;
    path: string;
    size: number;
    version: string;
    dependencies: string[];
    tags: string[];
    createdAt: number;
    modifiedAt: number;
    checksum: string;
    priority: number;          // Priorytet ładowania (0-100)
    cacheable: boolean;        // Czy może być cachowany
    compressed: boolean;       // Czy skompresowany
}

/**
 * Wpis w rejestrze
 */
interface RegistryEntry {
    metadata: AssetMetadata;
    state: AssetState;
    refCount: number;
    lastAccessed: number;
    error?: Error;
}

/**
 | Opcje rejestru
 */
export interface AssetRegistryOptions {
    maxEntries: number;
    enableStats: boolean;
    autoCleanup: boolean;
    cleanupInterval: number;   // ms
}

/**
 | Rejestr assetów
 */
export class AssetRegistry {
    private assets: Map<string, RegistryEntry> = new Map();
    private typeIndex: Map<AssetType, Set<string>> = new Map();
    private tagIndex: Map<string, Set<string>> = new Map();
    private logger: Logger;
    private options: AssetRegistryOptions;
    private cleanupTimer: NodeJS.Timeout | null = null;

    constructor(options?: Partial<AssetRegistryOptions>) {
        this.options = {
            maxEntries: 1000,
            enableStats: true,
            autoCleanup: true,
            cleanupInterval: 60000, // 1 minuta
            ...options
        };
        
        this.logger = Logger.getInstance();

        if (this.options.autoCleanup) {
            this.startCleanupTimer();
        }
    }

    /**
     | Rejestruje asset
     */
    register(metadata: AssetMetadata): void {
        if (this.assets.has(metadata.id)) {
            this.logger.warn(LogCategory.SYSTEM, `Asset already registered: ${metadata.id}`);
            return;
        }

        const entry: RegistryEntry = {
            metadata,
            state: AssetState.PENDING,
            refCount: 0,
            lastAccessed: Date.now()
        };

        this.assets.set(metadata.id, entry);

        // Indeksuj według typu
        if (!this.typeIndex.has(metadata.type)) {
            this.typeIndex.set(metadata.type, new Set());
        }
        this.typeIndex.get(metadata.type)!.add(metadata.id);

        // Indeksuj według tagów
        for (const tag of metadata.tags) {
            if (!this.tagIndex.has(tag)) {
                this.tagIndex.set(tag, new Set());
            }
            this.tagIndex.get(tag)!.add(metadata.id);
        }

        this.logger.debug(LogCategory.SYSTEM, `Asset registered: ${metadata.id} (${metadata.type})`);
    }

    /**
     | Wyrejestrowuje asset
     */
    unregister(assetId: string): void {
        const entry = this.assets.get(assetId);
        if (!entry) return;

        // Sprawdź czy nie jest używany
        if (entry.refCount > 0) {
            this.logger.warn(LogCategory.SYSTEM, `Cannot unregister asset in use: ${assetId} (refs: ${entry.refCount})`);
            return;
        }

        // Usuń z indeksów
        this.typeIndex.get(entry.metadata.type)?.delete(assetId);
        
        for (const tag of entry.metadata.tags) {
            this.tagIndex.get(tag)?.delete(assetId);
        }

        this.assets.delete(assetId);
        
        this.logger.debug(LogCategory.SYSTEM, `Asset unregistered: ${assetId}`);
    }

    /**
     | Aktualizuje stan asseta
     */
    updateState(assetId: string, state: AssetState, error?: Error): void {
        const entry = this.assets.get(assetId);
        if (!entry) return;

        entry.state = state;
        entry.lastAccessed = Date.now();
        
        if (error) {
            entry.error = error;
        }

        this.logger.debug(LogCategory.SYSTEM, `Asset state changed: ${assetId} -> ${state}`);
    }

    /**
     | Zwiększa licznik referencji
     */
    retain(assetId: string): void {
        const entry = this.assets.get(assetId);
        if (!entry) return;

        entry.refCount++;
        entry.lastAccessed = Date.now();
    }

    /**
     | Zmniejsza licznik referencji
     */
    release(assetId: string): void {
        const entry = this.assets.get(assetId);
        if (!entry) return;

        entry.refCount = Math.max(0, entry.refCount - 1);
        entry.lastAccessed = Date.now();
    }

    /**
     | Pobiera metadane asseta
     */
    getMetadata(assetId: string): AssetMetadata | undefined {
        const entry = this.assets.get(assetId);
        if (entry) {
            entry.lastAccessed = Date.now();
            return entry.metadata;
        }
        return undefined;
    }

    /**
     | Pobiera stan asseta
     */
    getState(assetId: string): AssetState | undefined {
        return this.assets.get(assetId)?.state;
    }

    /**
     | Sprawdza czy asset istnieje
     */
    has(assetId: string): boolean {
        return this.assets.has(assetId);
    }

    /**
     | Znajduje assety według typu
     */
    findByType(type: AssetType): AssetMetadata[] {
        const ids = this.typeIndex.get(type);
        if (!ids) return [];

        return Array.from(ids)
            .map(id => this.assets.get(id)?.metadata)
            .filter((m): m is AssetMetadata => !!m);
    }

    /**
     | Znajduje assety według tagu
     */
    findByTag(tag: string): AssetMetadata[] {
        const ids = this.tagIndex.get(tag);
        if (!ids) return [];

        return Array.from(ids)
            .map(id => this.assets.get(id)?.metadata)
            .filter((m): m is AssetMetadata => !!m);
    }

    /**
     | Znajduje assety według zapytania
     */
    query(query: AssetQuery): AssetMetadata[] {
        let results = Array.from(this.assets.values()).map(e => e.metadata);

        if (query.type) {
            results = results.filter(m => m.type === query.type);
        }

        if (query.tags && query.tags.length > 0) {
            results = results.filter(m => 
                query.tags!.every(tag => m.tags.includes(tag))
            );
        }

        if (query.pattern) {
            const regex = new RegExp(query.pattern);
            results = results.filter(m => regex.test(m.id) || regex.test(m.path));
        }

        if (query.loaded !== undefined) {
            results = results.filter(m => 
                (this.assets.get(m.id)!.state === AssetState.LOADED) === query.loaded
            );
        }

        // Sortowanie
        if (query.sortBy) {
            results.sort((a, b) => {
                const aVal = (a as any)[query.sortBy!];
                const bVal = (b as any)[query.sortBy!];
                return query.sortDesc ? bVal - aVal : aVal - bVal;
            });
        }

        // Limit
        if (query.limit) {
            results = results.slice(0, query.limit);
        }

        return results;
    }

    /**
     | Czyści nieużywane assety
     */
    cleanup(maxAge: number = 300000): number { // domyślnie 5 minut
        const now = Date.now();
        const toRemove: string[] = [];

        for (const [id, entry] of this.assets) {
            if (entry.refCount === 0 && 
                entry.state === AssetState.LOADED &&
                now - entry.lastAccessed > maxAge) {
                toRemove.push(id);
            }
        }

        for (const id of toRemove) {
            this.unregister(id);
        }

        if (toRemove.length > 0) {
            this.logger.info(LogCategory.SYSTEM, `Cleaned up ${toRemove.length} unused assets`);
        }

        return toRemove.length;
    }

    /**
     | Rozpoczyna timer czyszczenia
     */
    private startCleanupTimer(): void {
        if (typeof setInterval !== 'undefined') {
            this.cleanupTimer = setInterval(() => {
                this.cleanup();
            }, this.options.cleanupInterval);
        }
    }

    /**
     | Zatrzymuje timer czyszczenia
     */
    stopCleanupTimer(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    /**
     | Pobiera statystyki
     */
    getStats(): RegistryStats {
        const byState = new Map<AssetState, number>();
        const byType = new Map<AssetType, number>();

        for (const entry of this.assets.values()) {
            byState.set(entry.state, (byState.get(entry.state) || 0) + 1);
            byType.set(entry.metadata.type, (byType.get(entry.metadata.type) || 0) + 1);
        }

        return {
            total: this.assets.size,
            byState: Object.fromEntries(byState),
            byType: Object.fromEntries(byType),
            loadedCount: byState.get(AssetState.LOADED) || 0,
            loadingCount: byState.get(AssetState.LOADING) || 0,
            errorCount: byState.get(AssetState.ERROR) || 0,
            totalRefs: Array.from(this.assets.values()).reduce((sum, e) => sum + e.refCount, 0)
        };
    }

    /**
     | Resetuje rejestr
     */
    reset(): void {
        this.assets.clear();
        this.typeIndex.clear();
        this.tagIndex.clear();
        
        this.logger.info(LogCategory.SYSTEM, 'Asset registry reset');
    }

    /**
     | Zwalnia zasoby
     */
    dispose(): void {
        this.stopCleanupTimer();
        this.reset();
    }
}

/**
 | Zapytanie o assety
 */
export interface AssetQuery {
    type?: AssetType;
    tags?: string[];
    pattern?: string;
    loaded?: boolean;
    sortBy?: keyof AssetMetadata;
    sortDesc?: boolean;
    limit?: number;
}

/**
 | Statystyki rejestru
 */
export interface RegistryStats {
    total: number;
    byState: Record<string, number>;
    byType: Record<string, number>;
    loadedCount: number;
    loadingCount: number;
    errorCount: number;
    totalRefs: number;
}