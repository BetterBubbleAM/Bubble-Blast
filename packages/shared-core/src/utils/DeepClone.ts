/**
 * @file DeepClone.ts
 * @description Głębokie klonowanie obiektów z obsługą różnych typów
 */

import { Vector2 } from '../math/Vector2';

/**
 * Opcje klonowania
 */
export interface CloneOptions {
    preservePrototype?: boolean;
    preserveFunctions?: boolean;
    preserveSymbols?: boolean;
    maxDepth?: number;
    customHandlers?: Map<Function, (obj: any) => any>;
}

/**
 * Domyślne opcje
 */
const DEFAULT_OPTIONS: CloneOptions = {
    preservePrototype: true,
    preserveFunctions: false,
    preserveSymbols: true,
    maxDepth: 100
};

/**
 * Głębokie klonowanie obiektu
 */
export function deepClone<T>(obj: T, options: CloneOptions = {}): T {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const cache = new WeakMap();
    
    return cloneInternal(obj, opts, cache, 0);
}

/**
 * Wewnętrzna funkcja klonowania
 */
function cloneInternal(obj: any, options: CloneOptions, cache: WeakMap<any, any>, depth: number): any {
    // Sprawdź głębokość
    if (depth > (options.maxDepth || 100)) {
        throw new Error('deepClone: przekroczono maksymalną głębokość');
    }

    // Null lub undefined
    if (obj === null || obj === undefined) {
        return obj;
    }

    // Typy proste
    if (typeof obj !== 'object' && typeof obj !== 'function') {
        return obj;
    }

    // Sprawdź cache
    if (cache.has(obj)) {
        return cache.get(obj);
    }

    // Obsługa typów wbudowanych
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }

    if (obj instanceof RegExp) {
        return new RegExp(obj.source, obj.flags);
    }

    if (obj instanceof Map) {
        const clone = new Map();
        cache.set(obj, clone);
        obj.forEach((value, key) => {
            clone.set(
                cloneInternal(key, options, cache, depth + 1),
                cloneInternal(value, options, cache, depth + 1)
            );
        });
        return clone;
    }

    if (obj instanceof Set) {
        const clone = new Set();
        cache.set(obj, clone);
        obj.forEach(value => {
            clone.add(cloneInternal(value, options, cache, depth + 1));
        });
        return clone;
    }

    if (obj instanceof ArrayBuffer) {
        return obj.slice(0);
    }

    if (ArrayBuffer.isView(obj)) {
        // Typowane tablice
        return new (obj.constructor as any)(obj.slice());
    }

    if (obj instanceof Vector2) {
        return new Vector2(obj.x, obj.y);
    }

    if (obj instanceof Error) {
        const clone = new (obj.constructor as any)(obj.message);
        clone.stack = obj.stack;
        return clone;
    }

    if (obj instanceof Promise) {
        // Nie klonujemy Promise
        return obj;
    }

    // Obsługa funkcji
    if (typeof obj === 'function') {
        if (options.preserveFunctions) {
            // Zwracamy tę samą funkcję
            return obj;
        }
        return undefined;
    }

    // Obsługa symboli
    if (typeof obj === 'symbol') {
        if (options.preserveSymbols) {
            return Symbol(obj.description);
        }
        return undefined;
    }

    // Obsługa tablic
    if (Array.isArray(obj)) {
        const clone: any[] = [];
        cache.set(obj, clone);
        
        for (let i = 0; i < obj.length; i++) {
            clone[i] = cloneInternal(obj[i], options, cache, depth + 1);
        }
        
        // Klonuj właściwości tablicy
        if (options.preservePrototype) {
            Object.setPrototypeOf(clone, Object.getPrototypeOf(obj));
        }
        
        return clone;
    }

    // Obsługa obiektów
    const prototype = options.preservePrototype ? Object.getPrototypeOf(obj) : null;
    const clone = prototype ? Object.create(prototype) : {};
    cache.set(obj, clone);

    // Klonuj wszystkie właściwości
    const keys = [
        ...Object.keys(obj),
        ...(options.preserveSymbols ? Object.getOwnPropertySymbols(obj) : [])
    ];

    for (const key of keys) {
        const descriptor = Object.getOwnPropertyDescriptor(obj, key);
        
        if (descriptor) {
            if (descriptor.get || descriptor.set) {
                // Gettery/settery - kopiuj jako funkcje
                Object.defineProperty(clone, key, descriptor);
            } else {
                clone[key] = cloneInternal(obj[key], options, cache, depth + 1);
            }
        }
    }

    return clone;
}

/**
 * Płytkie klonowanie
 */
export function shallowClone<T>(obj: T): T {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return [...obj] as any;
    }

    if (obj instanceof Date) {
        return new Date(obj.getTime()) as any;
    }

    if (obj instanceof RegExp) {
        return new RegExp(obj.source, obj.flags) as any;
    }

    if (obj instanceof Map) {
        return new Map(obj) as any;
    }

    if (obj instanceof Set) {
        return new Set(obj) as any;
    }

    if (typeof obj === 'object') {
        return { ...obj };
    }

    return obj;
}

/**
 * Klonowanie z pominięciem cykli
 */
export function safeClone<T>(obj: T): T {
    const seen = new WeakSet();
    
    function safeInternal(value: any): any {
        if (value === null || typeof value !== 'object') {
            return value;
        }
        
        if (seen.has(value)) {
            return undefined; // pomiń cykle
        }
        
        seen.add(value);
        
        if (Array.isArray(value)) {
            return value.map(v => safeInternal(v));
        }
        
        if (value instanceof Date) {
            return new Date(value.getTime());
        }
        
        if (value instanceof RegExp) {
            return new RegExp(value.source, value.flags);
        }
        
        if (value instanceof Map) {
            const map = new Map();
            value.forEach((v, k) => {
                map.set(safeInternal(k), safeInternal(v));
            });
            return map;
        }
        
        if (value instanceof Set) {
            const set = new Set();
            value.forEach(v => {
                set.add(safeInternal(v));
            });
            return set;
        }
        
        const result: any = {};
        for (const key in value) {
            if (value.hasOwnProperty(key)) {
                result[key] = safeInternal(value[key]);
            }
        }
        
        return result;
    }
    
    return safeInternal(obj);
}

/**
 * Klonowanie JSON (szybkie, ale ograniczone)
 */
export function jsonClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Łączy obiekty (deep merge)
 */
export function deepMerge<T extends object, U extends object>(target: T, source: U): T & U {
    const result = deepClone(target) as any;
    
    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            const sourceValue = (source as any)[key];
            const targetValue = result[key];
            
            if (sourceValue === null || sourceValue === undefined) {
                continue;
            }
            
            if (typeof sourceValue !== 'object' || sourceValue instanceof Date || sourceValue instanceof RegExp) {
                result[key] = sourceValue;
            } else if (Array.isArray(sourceValue)) {
                result[key] = deepClone(sourceValue);
            } else if (typeof targetValue === 'object' && targetValue !== null && !Array.isArray(targetValue)) {
                result[key] = deepMerge(targetValue, sourceValue);
            } else {
                result[key] = deepClone(sourceValue);
            }
        }
    }
    
    return result;
}

/**
 * Sprawdza czy obiekty są równe (deep compare)
 */
export function deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    
    if (a === null || b === null || a === undefined || b === undefined) {
        return a === b;
    }
    
    if (typeof a !== typeof b) return false;
    
    if (typeof a !== 'object') return a === b;
    
    if (a instanceof Date && b instanceof Date) {
        return a.getTime() === b.getTime();
    }
    
    if (a instanceof RegExp && b instanceof RegExp) {
        return a.toString() === b.toString();
    }
    
    if (a instanceof Map && b instanceof Map) {
        if (a.size !== b.size) return false;
        for (const [key, value] of a) {
            if (!b.has(key) || !deepEqual(value, b.get(key))) return false;
        }
        return true;
    }
    
    if (a instanceof Set && b instanceof Set) {
        if (a.size !== b.size) return false;
        const aArray = Array.from(a);
        const bArray = Array.from(b);
        return deepEqual(aArray, bArray);
    }
    
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!deepEqual(a[i], b[i])) return false;
        }
        return true;
    }
    
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
        if (!b.hasOwnProperty(key)) return false;
        if (!deepEqual(a[key], b[key])) return false;
    }
    
    return true;
}

/**
 * Zamraża obiekt głęboko (deep freeze)
 */
export function deepFreeze<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    
    Object.freeze(obj);
    
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            deepFreeze((obj as any)[key]);
        }
    }
    
    return obj;
}

/**
 * Tworzy niemutowalną kopię
 */
export function immutable<T>(obj: T): T {
    return deepFreeze(deepClone(obj));
}

/**
 * Selektywne klonowanie (tylko wybrane właściwości)
 */
export function pickClone<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
    const result: any = {};
    
    for (const key of keys) {
        if (key in obj) {
            result[key] = deepClone(obj[key]);
        }
    }
    
    return result;
}

/**
 * Pomija wybrane właściwości przy klonowaniu
 */
export function omitClone<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
    const result: any = {};
    
    for (const key in obj) {
        if (obj.hasOwnProperty(key) && !keys.includes(key as any)) {
            result[key] = deepClone(obj[key]);
        }
    }
    
    return result;
}

/**
 * Tworzy kopię z aktualizacją (immutable update)
 */
export function updateClone<T extends object>(obj: T, updates: Partial<T>): T {
    const clone = deepClone(obj);
    return deepMerge(clone, updates);
}