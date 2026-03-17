/**
 * @file AssetCache.ts
 * @description Cache assetów z politykami wygaszania
 */

import { Logger, LogCategory } from '@shared-core/utils/Logger';

/**
 | Wpis w cache
 */
interface CacheEntry<T = any> {
    data: T;
    size: number;
    timestamp: number;
    lastAccessed: number;
    accessCount: number;
    ttl: number;                // Time to live w ms (0 = bez ograniczenia)
    priority: number;           // Priorytet (0-100)
}

/**
 | Polityka wygaszania
 */
export enum EvictionPolicy {
    LRU = 'lru',                // Least Recently Used
    LFU = 'lfu',                // Least Frequently Used
    FIFO = 'fifo',              // First In First Out
    TTL = 'ttl',                // Time To Live
    PRIORITY = 'priority'       // Priorytet (najpierw usuwa najniższy)
}

/**
 | Opcje cache
 */
export interface AssetCacheOptions {
    maxSize: number;             // Maksymalny rozmiar w bajtach
    maxEntries: number;          // Maksymalna liczba wpisów
    defaultTtl: number;          // Domyślny TTL w ms (0 = bez ograniczenia)
    policy: EvictionPolicy;      // Polityka wygaszania
    enableStats: boolean;        // Czy zbierać statystyki
}

/**
 | Cache assetów
 */
export class AssetCache {
    private cache: Map<string, CacheEntry> = new Map();
    private currentSize: number = 0;
    private options: AssetCacheOptions;
    private logger: Logger;
    
    // Statystyki
    private hits: number = 0;
    private misses: number = 0;
    private evictions: number = 0;

    constructor(options?: Partial<AssetCacheOptions>) {
        this.options = {
            maxSize: 100 * 1024 * 1024, // 100 MB
            maxEntries: 1000,
            defaultTtl: 5 * 60 * 1000,  // 5 minut
            policy: EvictionPolicy.LRU,
            enableStats: true,
            ...options
        };
        
        this.logger = Logger.getInstance();
    }

    /**
     | Pobiera asset z cache
     */
    get<T = any>(key: string): T | undefined {
        const entry = this.cache.get(key);
        
        if (!entry) {
            this.misses++;
            return undefined;
        }

        // Sprawdź TTL
        if (entry.ttl > 0 && Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            this.currentSize -= entry.size;
            this.misses++;
            return undefined;
        }

        // Aktualizuj metadane
        entry.lastAccessed = Date.now();
        entry.accessCount++;
        this.hits++;

        return entry.data as T;
    }

    /**
     | Zapisuje asset w cache
     */
    set<T = any>(key: string, data: T, options?: Partial<{
        ttl: number;
        priority: number;
        size: number;
    }>): void {
        const size = options?.size ?? this.estimateSize(data);
        
        // Sprawdź czy asset zmieści się w cache
        if (size > this.options.maxSize) {
            this.logger.warn(LogCategory.SYSTEM, 
                `Asset too large for cache: ${key} (${size} bytes)`);
            return;
        }

        // Usuń stary wpis jeśli istnieje
        if (this.cache.has(key)) {
            this.currentSize -= this.cache.get(key)!.size;
        }

        // Zapewnij miejsce
        this.ensureSpace(size);

        const entry: CacheEntry = {
            data,
            size,
            timestamp: Date.now(),
            lastAccessed: Date.now(),
            accessCount: 0,
            ttl: options?.ttl ?? this.options.defaultTtl,
            priority: options?.priority ?? 50
        };

        this.cache.set(key, entry);
        this.currentSize += size;

        this.logger.debug(LogCategory.SYSTEM, `Cached asset: ${key} (${size} bytes)`);
    }

    /**
     | Sprawdza czy asset jest w cache
     */
    has(key: string): boolean {
        const entry = this.cache.get(key);
        
        if (!entry) return false;

        // Sprawdź TTL
        if (entry.ttl > 0 && Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            this.currentSize -= entry.size;
            return false;
        }

        return true;
    }

    /**
     | Usuwa asset z cache
     */
    delete(key: string): boolean {
        const entry = this.cache.get(key);
        if (entry) {
            this.currentSize -= entry.size;
            this.cache.delete(key);
            return true;
        }
        return false;
    }

    /**
     | Czyści cache
     */
    clear(): void {
        this.cache.clear();
        this.currentSize = 0;
        this.hits = 0;
        this.misses = 0;
        this.evictions = 0;
        
        this.logger.info(LogCategory.SYSTEM, 'Asset cache cleared');
    }

    /**
     | Zapewnia miejsce w cache
     */
    private ensureSpace(neededSize: number): void {
        while (this.currentSize + neededSize > this.options.maxSize ||
               this.cache.size >= this.options.maxEntries) {
            
            if (this.cache.size === 0) break;

            const keyToEvict = this.selectVictim();
            if (!keyToEvict) break;

            const entry = this.cache.get(keyToEvict)!;
            this.currentSize -= entry.size;
            this.cache.delete(keyToEvict);
            this.evictions++;

            this.logger.debug(LogCategory.SYSTEM, 
                `Evicted asset: ${keyToEvict} (policy: ${this.options.policy})`);
        }
    }

    /**
     | Wybiera ofiarę do usunięcia
     */
    private selectVictim(): string | null {
        if (this.cache.size === 0) return null;

        switch (this.options.policy) {
            case EvictionPolicy.LRU:
                return this.selectLRU();
                
            case EvictionPolicy.LFU:
                return this.selectLFU();
                
            case EvictionPolicy.FIFO:
                return this.selectFIFO();
                
            case EvictionPolicy.TTL:
                return this.selectTTL();
                
            case EvictionPolicy.PRIORITY:
                return this.selectPriority();
                
            default:
                return this.selectLRU();
        }
    }

    /**
     | LRU - najdawniej używany
     */
    private selectLRU(): string | null {
        let oldestKey: string | null = null;
        let oldestTime = Infinity;

        for (const [key, entry] of this.cache) {
            if (entry.lastAccessed < oldestTime) {
                oldestTime = entry.lastAccessed;
                oldestKey = key;
            }
        }

        return oldestKey;
    }

    /**
     | LFU - najrzadziej używany
     */
    private selectLFU(): string | null {
        let leastUsedKey: string | null = null;
        let minAccess = Infinity;

        for (const [key, entry] of this.cache) {
            if (entry.accessCount < minAccess) {
                minAccess = entry.accessCount;
                leastUsedKey = key;
            }
        }

        return leastUsedKey;
    }

    /**
     | FIFO - pierwszy przyszedł, pierwszy wyszedł
     */
    private selectFIFO(): string | null {
        let oldestKey: string | null = null;
        let oldestTime = Infinity;

        for (const [key, entry] of this.cache) {
            if (entry.timestamp < oldestTime) {
                oldestTime = entry.timestamp;
                oldestKey = key;
            }
        }

        return oldestKey;
    }

    /**
     | TTL - najbliższy wygaśnięcia
     */
    private selectTTL(): string | null {
        let oldestKey: string | null = null;
        let oldestTtl = Infinity;

        for (const [key, entry] of this.cache) {
            if (entry.ttl > 0) {
                const expiresIn = entry.timestamp + entry.ttl - Date.now();
                if (expiresIn < oldestTtl) {
                    oldestTtl = expiresIn;
                    oldestKey = key;
                }
            }
        }

        // Jeśli wszystkie mają nieskończony TTL, użyj LRU
        return oldestKey || this.selectLRU();
    }

    /**
     | Priorytet - najniższy priorytet
     */
    private selectPriority(): string | null {
        let lowestKey: string | null = null;
        let lowestPriority = Infinity;

        for (const [key, entry] of this.cache) {
            if (entry.priority < lowestPriority) {
                lowestPriority = entry.priority;
                lowestKey = key;
            }
        }

        return lowestKey;
    }

    /**
     | Szacuje rozmiar danych
     */
    private estimateSize(data: any): number {
        if (data instanceof HTMLImageElement) {
            return data.width * data.height * 4; // RGBA
        }
        
        if (data instanceof ArrayBuffer) {
            return data.byteLength;
        }
        
        if (typeof data === 'string') {
            return data.length * 2; // UTF-16
        }
        
        if (data instanceof Blob) {
            return data.size;
        }
        
        // Domyślnie - oszacuj JSON
        try {
            const json = JSON.stringify(data);
            return json.length * 2;
        } catch {
            return 1024; // 1 KB default
        }
    }

    /**
     | Pobiera statystyki
     */
    getStats(): CacheStats {
        const totalEntries = this.cache.size;
        const hitRate = this.hits + this.misses > 0
            ? this.hits / (this.hits + this.misses)
            : 0;

        // Oblicz wiek cache
        const now = Date.now();
        const ages = Array.from(this.cache.values()).map(e => now - e.timestamp);
        const averageAge = ages.length > 0
            ? ages.reduce((a, b) => a + b, 0) / ages.length
            : 0;

        return {
            size: this.currentSize,
            maxSize: this.options.maxSize,
            entries: totalEntries,
            maxEntries: this.options.maxEntries,
            hits: this.hits,
            misses: this.misses,
            evictions: this.evictions,
            hitRate,
            averageAge,
            utilization: this.currentSize / this.options.maxSize
        };
    }

    /**
     | Pobiera klucze cache
     */
    keys(): string[] {
        return Array.from(this.cache.keys());
    }

    /**
     | Resetuje statystyki
     */
    resetStats(): void {
        this.hits = 0;
        this.misses = 0;
        this.evictions = 0;
    }
}

/**
 | Statystyki cache
 */
export interface CacheStats {
    size: number;
    maxSize: number;
    entries: number;
    maxEntries: number;
    hits: number;
    misses: number;
    evictions: number;
    hitRate: number;
    averageAge: number;
    utilization: number;
}