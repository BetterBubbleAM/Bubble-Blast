/**
 * @file Lerp.ts
 * @description Funkcje interpolacji liniowej dla różnych typów
 */

import { Vector2 } from './Vector2';

/**
 * Interpolacja liniowa liczb
 */
export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

/**
 * Interpolacja liniowa wektorów
 */
export function lerpVector(a: Vector2, b: Vector2, t: number): Vector2 {
    return new Vector2(
        lerp(a.x, b.x, t),
        lerp(a.y, b.y, t)
    );
}

/**
 * Interpolacja liniowa obiektów z polami liczbowymi
 */
export function lerpObject<T extends Record<string, number>>(a: T, b: T, t: number): T {
    const result: any = {};
    for (const key in a) {
        if (typeof a[key] === 'number' && typeof b[key] === 'number') {
            result[key] = lerp(a[key], b[key], t);
        } else {
            result[key] = a[key];
        }
    }
    return result;
}

/**
 * Interpolacja sferyczna (dla kątów)
 */
export function slerp(a: number, b: number, t: number): number {
    // Normalizacja kątów do zakresu [0, 2PI)
    a = a % (2 * Math.PI);
    b = b % (2 * Math.PI);
    
    // Znajdź najkrótszą drogę
    let diff = b - a;
    if (diff > Math.PI) {
        diff -= 2 * Math.PI;
    } else if (diff < -Math.PI) {
        diff += 2 * Math.PI;
    }
    
    return a + diff * t;
}

/**
 * Interpolacja Catmull-Rom (gładka krzywa)
 */
export function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const t2 = t * t;
    const t3 = t2 * t;
    
    return 0.5 * (
        (2 * p1) +
        (-p0 + p2) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    );
}

/**
 * Interpolacja Hermite'a (z kontrolą prędkości)
 */
export function hermite(
    p0: number, v0: number, // pozycja i prędkość w punkcie startowym
    p1: number, v1: number, // pozycja i prędkość w punkcie końcowym
    t: number
): number {
    const t2 = t * t;
    const t3 = t2 * t;
    
    const h1 = 2 * t3 - 3 * t2 + 1;
    const h2 = -2 * t3 + 3 * t2;
    const h3 = t3 - 2 * t2 + t;
    const h4 = t3 - t2;
    
    return h1 * p0 + h2 * p1 + h3 * v0 + h4 * v1;
}

/**
 * Interpolacja wykładnicza
 */
export function expLerp(a: number, b: number, lambda: number, dt: number): number {
    return b + (a - b) * Math.exp(-lambda * dt);
}

/**
 * Interpolacja logarytmiczna
 */
export function logLerp(a: number, b: number, t: number): number {
    return Math.exp(lerp(Math.log(a), Math.log(b), t));
}

/**
 * Funkcja easing - łagodne wejście
 */
export function easeIn(t: number): number {
    return t * t;
}

/**
 * Funkcja easing - łagodne wyjście
 */
export function easeOut(t: number): number {
    return 1 - (1 - t) * (1 - t);
}

/**
 * Funkcja easing - łagodne wejście i wyjście
 */
export function easeInOut(t: number): number {
    return t < 0.5
        ? 2 * t * t
        : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Funkcja easing - sprężystość
 */
export function elastic(t: number): number {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
}

/**
 * Funkcja easing - odbicie
 */
export function bounce(t: number): number {
    if (t < 1 / 2.75) {
        return 7.5625 * t * t;
    } else if (t < 2 / 2.75) {
        return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    } else if (t < 2.5 / 2.75) {
        return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    } else {
        return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
    }
}

/**
 * Interpolacja z funkcją easing
 */
export function easeLerp(a: number, b: number, t: number, easing: (t: number) => number): number {
    return lerp(a, b, easing(t));
}

/**
 * Interpolacja koloru w formacie hex
 */
export function lerpColor(hex1: string, hex2: string, t: number): string {
    // Konwersja hex na RGB
    const r1 = parseInt(hex1.slice(1, 3), 16);
    const g1 = parseInt(hex1.slice(3, 5), 16);
    const b1 = parseInt(hex1.slice(5, 7), 16);
    
    const r2 = parseInt(hex2.slice(1, 3), 16);
    const g2 = parseInt(hex2.slice(3, 5), 16);
    const b2 = parseInt(hex2.slice(5, 7), 16);
    
    // Interpolacja
    const r = Math.round(lerp(r1, r2, t));
    const g = Math.round(lerp(g1, g2, t));
    const b = Math.round(lerp(b1, b2, t));
    
    // Konwersja z powrotem na hex
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Interpolacja tablicy liczb
 */
export function lerpArray(a: number[], b: number[], t: number): number[] {
    if (a.length !== b.length) {
        throw new Error('Arrays must have the same length');
    }
    
    return a.map((val, i) => lerp(val, b[i], t));
}

/**
 * Interpolacja macierzy 2D
 */
export function lerpMatrix<T extends number[][]>(a: T, b: T, t: number): T {
    if (a.length !== b.length) {
        throw new Error('Matrices must have the same dimensions');
    }
    
    return a.map((row, i) => {
        if (row.length !== b[i].length) {
            throw new Error('Matrices must have the same dimensions');
        }
        return row.map((val, j) => lerp(val, b[i][j], t));
    }) as T;
}

/**
 * Interpolacja z clamping
 */
export function clampedLerp(a: number, b: number, t: number): number {
    return lerp(a, b, Math.max(0, Math.min(1, t)));
}

/**
 * Interpolacja z ekstrapolacją
 */
export function extrapolate(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}