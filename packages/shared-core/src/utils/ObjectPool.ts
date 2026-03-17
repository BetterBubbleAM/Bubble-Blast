/**
 * @file ObjectPool.ts
 * @description Pool obiektów do optymalizacji pamięci
 */

/**
 * Opcje pool'a
 */
export interface PoolOptions<T> {
    size: number;
    factory: () => T;
    reset?: (obj: T) => void;
    validate?: (obj: T) => boolean;
    onAllocate?: (obj: T) => void;
    onRelease?: (obj: T) => void;
    onDestroy?: (obj: T) => void;
    expandSize?: number;
    maxSize?: number;
}

/**
 * Pool obiektów - zarządza reużywalnymi obiektami
 */
export class ObjectPool<T> {
    private pool: T[] = [];
    private active: Set<T> = new Set();
    private factory: () => T;
    private reset?: (obj: T) => void;
    private validate?: (obj: T) => boolean;
    private onAllocate?: (obj: T) => void;
    private onRelease?: (obj: T) => void;
    private onDestroy?: (obj: T) => void;
    private expandSize: number;
    private maxSize: number;
    private hits: number = 0;
    private misses: number = 0;
    private frees: number = 0;

    constructor(options: PoolOptions<T>) {
        this.factory = options.factory;
        this.reset = options.reset;
        this.validate = options.validate;
        this.onAllocate = options.onAllocate;
        this.onRelease = options.onRelease;
        this.onDestroy = options.onDestroy;
        this.expandSize = options.expandSize || Math.floor(options.size / 2);
        this.maxSize = options.maxSize || options.size * 2;

        // Inicjalizuj pool
        for (let i = 0; i < options.size; i++) {
            this.pool.push(this.create());
        }
    }

    /**
     * Tworzy nowy obiekt
     */
    private create(): T {
        const obj = this.factory();
        if (this.reset) {
            this.reset(obj);
        }
        return obj;
    }

    /**
     * Pobiera obiekt z pool'a
     */
    allocate(): T {
        let obj: T;

        if (this.pool.length > 0) {
            obj = this.pool.pop()!;
            this.hits++;
        } else {
            // Pool pusty - utwórz nowy jeśli nie przekroczono limitu
            if (this.active.size < this.maxSize) {
                obj = this.create();
                this.misses++;
            } else {
                throw new Error('ObjectPool: przekroczono maksymalny rozmiar');
            }
        }

        this.active.add(obj);
        
        if (this.onAllocate) {
            this.onAllocate(obj);
        }

        return obj;
    }

    /**
     * Zwraca obiekt do pool'a
     */
    release(obj: T): void {
        if (!this.active.has(obj)) {
            console.warn('ObjectPool: obiekt nie jest aktywny');
            return;
        }

        this.active.delete(obj);

        if (this.validate && !this.validate(obj)) {
            // Obiekt nieprawidłowy - zniszcz
            if (this.onDestroy) {
                this.onDestroy(obj);
            }
            return;
        }

        if (this.reset) {
            this.reset(obj);
        }

        if (this.onRelease) {
            this.onRelease(obj);
        }

        this.pool.push(obj);
        this.frees++;
    }

    /**
     * Zwalnia wszystkie obiekty
     */
    releaseAll(): void {
        for (const obj of this.active) {
            if (this.reset) {
                this.reset(obj);
            }
            this.pool.push(obj);
        }
        this.active.clear();
        this.frees += this.active.size;
    }

    /**
     * Rozszerza pool
     */
    expand(count: number = this.expandSize): void {
        const newSize = Math.min(this.pool.length + count, this.maxSize);
        const toAdd = newSize - this.pool.length;
        
        for (let i = 0; i < toAdd; i++) {
            this.pool.push(this.create());
        }
    }

    /**
     * Zmniejsza pool
     */
    shrink(count: number = this.expandSize): void {
        const toRemove = Math.min(count, this.pool.length);
        
        for (let i = 0; i < toRemove; i++) {
            const obj = this.pool.pop();
            if (this.onDestroy && obj) {
                this.onDestroy(obj);
            }
        }
    }

    /**
     * Liczba dostępnych obiektów
     */
    get available(): number {
        return this.pool.length;
    }

    /**
     * Liczba aktywnych obiektów
     */
    get activeCount(): number {
        return this.active.size;
    }

    /**
     * Całkowita liczba obiektów
     */
    get total(): number {
        return this.pool.length + this.active.size;
    }

    /**
     * Wskaźnik trafień (hit rate)
     */
    get hitRate(): number {
        const total = this.hits + this.misses;
        return total > 0 ? this.hits / total : 0;
    }

    /**
     * Statystyki pool'a
     */
    getStats(): PoolStats {
        return {
            available: this.available,
            active: this.activeCount,
            total: this.total,
            hits: this.hits,
            misses: this.misses,
            frees: this.frees,
            hitRate: this.hitRate
        };
    }

    /**
     * Resetuje statystyki
     */
    resetStats(): void {
        this.hits = 0;
        this.misses = 0;
        this.frees = 0;
    }

    /**
     * Czyści pool
     */
    clear(): void {
        if (this.onDestroy) {
            for (const obj of this.pool) {
                this.onDestroy(obj);
            }
            for (const obj of this.active) {
                this.onDestroy(obj);
            }
        }
        this.pool = [];
        this.active.clear();
        this.resetStats();
    }
}

/**
 * Statystyki pool'a
 */
export interface PoolStats {
    available: number;
    active: number;
    total: number;
    hits: number;
    misses: number;
    frees: number;
    hitRate: number;
}

/**
 * Pool dla typów prostych (number, string, boolean)
 */
export class PrimitivePool<T extends number | string | boolean> {
    private pool: T[] = [];

    constructor(private factory: () => T, initialSize: number = 100) {
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(factory());
        }
    }

    allocate(): T {
        if (this.pool.length > 0) {
            return this.pool.pop()!;
        }
        return this.factory();
    }

    release(value: T): void {
        this.pool.push(value);
    }
}

/**
 * Pool dla tablic
 */
export class ArrayPool<T> {
    private pool: T[][] = [];

    constructor(private initialCapacity: number = 10) {}

    allocate(capacity?: number): T[] {
        if (this.pool.length > 0) {
            const arr = this.pool.pop()!;
            // Wyczyść ale zachowaj pojemność
            arr.length = 0;
            if (capacity) {
                arr.length = capacity;
            }
            return arr;
        }
        return new Array(capacity || this.initialCapacity);
    }

    release(arr: T[]): void {
        arr.length = 0;
        this.pool.push(arr);
    }
}

/**
 * Pool dla map
 */
export class MapPool<K, V> {
    private pool: Map<K, V>[] = [];

    allocate(): Map<K, V> {
        if (this.pool.length > 0) {
            return this.pool.pop()!;
        }
        return new Map();
    }

    release(map: Map<K, V>): void {
        map.clear();
        this.pool.push(map);
    }
}

/**
 * Pool dla Set
 */
export class SetPool<T> {
    private pool: Set<T>[] = [];

    allocate(): Set<T> {
        if (this.pool.length > 0) {
            return this.pool.pop()!;
        }
        return new Set();
    }

    release(set: Set<T>): void {
        set.clear();
        this.pool.push(set);
    }
}

/**
 * Automatycznie zarządzany pool (wrapping)
 */
export class AutoPool<T> {
    private pool: ObjectPool<T>;

    constructor(options: PoolOptions<T>) {
        this.pool = new ObjectPool(options);
    }

    /**
     * Wykonuje operację z obiektem z pool'a
     */
    withObject<R>(fn: (obj: T) => R): R {
        const obj = this.pool.allocate();
        try {
            return fn(obj);
        } finally {
            this.pool.release(obj);
        }
    }

    /**
     * Wykonuje operację z wieloma obiektami
     */
    withObjects<R>(count: number, fn: (objects: T[]) => R): R {
        const objects: T[] = [];
        for (let i = 0; i < count; i++) {
            objects.push(this.pool.allocate());
        }
        try {
            return fn(objects);
        } finally {
            for (const obj of objects) {
                this.pool.release(obj);
            }
        }
    }
}

/**
 * Globalne pule dla typów często używanych
 */
export const vector2Pool = new ObjectPool({
    size: 1000,
    factory: () => ({ x: 0, y: 0 }),
    reset: (v) => { v.x = 0; v.y = 0; }
});

export const arrayPool = new ArrayPool();
export const mapPool = new MapPool();
export const setPool = new SetPool();