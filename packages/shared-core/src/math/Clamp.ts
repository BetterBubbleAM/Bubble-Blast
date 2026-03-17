/**
 * @file Clamp.ts
 * @description Funkcje ograniczania wartości do zakresów
 */

/**
 * Ogranicza wartość do zakresu [min, max]
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * Ogranicza wartość do zakresu [0, 1]
 */
export function clamp01(value: number): number {
    return clamp(value, 0, 1);
}

/**
 * Ogranicza wartość do przedziału [-1, 1]
 */
export function clamp11(value: number): number {
    return clamp(value, -1, 1);
}

/**
 * Ogranicza wartość i zwraca również informację czy została zmieniona
 */
export function clampWithStatus(value: number, min: number, max: number): { value: number; clamped: boolean } {
    if (value < min) {
        return { value: min, clamped: true };
    }
    if (value > max) {
        return { value: max, clamped: true };
    }
    return { value, clamped: false };
}

/**
 * Ogranicza wartość do zakresu z możliwością odwrócenia min/max
 */
export function clampSafe(value: number, a: number, b: number): number {
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    return clamp(value, min, max);
}

/**
 * Ogranicza kąt w radianach do zakresu [0, 2PI)
 */
export function clampAngle(angle: number): number {
    angle = angle % (2 * Math.PI);
    if (angle < 0) {
        angle += 2 * Math.PI;
    }
    return angle;
}

/**
 * Ogranicza kąt w stopniach do zakresu [0, 360)
 */
export function clampAngleDegrees(angle: number): number {
    angle = angle % 360;
    if (angle < 0) {
        angle += 360;
    }
    return angle;
}

/**
 * Ogranicza wartość do najbliższej wartości w tablicy
 */
export function clampToArray(value: number, array: number[]): number {
    if (array.length === 0) return value;
    
    let closest = array[0];
    let minDiff = Math.abs(value - closest);
    
    for (let i = 1; i < array.length; i++) {
        const diff = Math.abs(value - array[i]);
        if (diff < minDiff) {
            minDiff = diff;
            closest = array[i];
        }
    }
    
    return closest;
}

/**
 * Ogranicza wartość do zakresu z cyklicznym zawijaniem
 */
export function wrap(value: number, min: number, max: number): number {
    const range = max - min;
    if (range === 0) return min;
    
    value = ((value - min) % range + range) % range + min;
    return value;
}

/**
 * Ogranicza wartość do zakresu [0, 1] z cyklicznym zawijaniem
 */
export function wrap01(value: number): number {
    return wrap(value, 0, 1);
}

/**
 * Ogranicza wartość do zakresu z odbiciem (jak piłka)
 */
export function reflect(value: number, min: number, max: number): number {
    const range = max - min;
    if (range === 0) return min;
    
    value = ((value - min) % (range * 2));
    if (value < 0) value += range * 2;
    
    if (value >= range) {
        return max - (value - range);
    }
    return min + value;
}

/**
 * Mapuje wartość z jednego zakresu na drugi
 */
export function mapRange(
    value: number,
    fromMin: number,
    fromMax: number,
    toMin: number,
    toMax: number,
    clamped: boolean = true
): number {
    let t = (value - fromMin) / (fromMax - fromMin);
    if (clamped) {
        t = clamp01(t);
    }
    return toMin + t * (toMax - toMin);
}

/**
 * Mapuje wartość z zakresu [0,1] na inny zakres
 */
export function map01(value: number, toMin: number, toMax: number, clamped: boolean = true): number {
    return mapRange(value, 0, 1, toMin, toMax, clamped);
}

/**
 * Mapuje wartość z zakresu na [0,1]
 */
export function inverseMap(value: number, fromMin: number, fromMax: number, clamped: boolean = true): number {
    return mapRange(value, fromMin, fromMax, 0, 1, clamped);
}

/**
 * Sprawdza czy wartość jest w zakresie (włącznie)
 */
export function inRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
}

/**
 * Sprawdza czy wartość jest w zakresie (wyłącznie)
 */
export function inRangeExclusive(value: number, min: number, max: number): boolean {
    return value > min && value < max;
}

/**
 * Sprawdza czy wartość jest w zakresie z tolerancją
 */
export function inRangeTolerance(value: number, target: number, tolerance: number): boolean {
    return Math.abs(value - target) <= tolerance;
}

/**
 * Zwraca wartość najbliższą podanej z zakresu
 */
export function nearest(value: number, min: number, max: number): number {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

/**
 * Zwraca wartość dalej od środka zakresu
 */
export function farthest(value: number, min: number, max: number): number {
    const mid = (min + max) / 2;
    if (value < mid) return max;
    if (value > mid) return min;
    return value; // w środku - zwraca to samo
}

/**
 * Liniowa interpolacja z clamping
 */
export function lerpClamped(a: number, b: number, t: number): number {
    return a + (b - a) * clamp01(t);
}

/**
 * Smoothstep - płynne przejście między wartościami
 */
export function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = clamp01((x - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
}

/**
 * Smootherstep - jeszcze gładsze przejście
 */
export function smootherstep(edge0: number, edge1: number, x: number): number {
    const t = clamp01((x - edge0) / (edge1 - edge0));
    return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Progowanie - zwraca wartość progową jeśli przekroczona
 */
export function threshold(value: number, threshold: number, passValue: number = 1, failValue: number = 0): number {
    return value >= threshold ? passValue : failValue;
}

/**
 * Ogranicza wartość do zakresu i zwraca różnicę
 */
export function clampWithDelta(value: number, min: number, max: number): { value: number; delta: number } {
    if (value < min) {
        return { value: min, delta: min - value };
    }
    if (value > max) {
        return { value: max, delta: max - value };
    }
    return { value, delta: 0 };
}

/**
 * Ogranicza wartość do zakresu i zwraca współczynnik nasycenia
 */
export function saturation(value: number, min: number, max: number): number {
    if (value < min) return 0;
    if (value > max) return 1;
    return (value - min) / (max - min);
}

/**
 * Dead zone - strefa martwa dla wartości
 */
export function deadZone(value: number, zone: number, max: number = 1): number {
    const abs = Math.abs(value);
    if (abs < zone) return 0;
    return Math.sign(value) * ((abs - zone) / (max - zone));
}

/**
 * Ekspansja kontrastu
 */
export function contrast(value: number, amount: number): number {
    return ((value - 0.5) * amount) + 0.5;
}

/**
 * Krzywa sigmoidalna
 */
export function sigmoid(value: number, gain: number = 1): number {
    return 1 / (1 + Math.exp(-gain * (value - 0.5) * 10));
}

/**
 * Funkcja schodkowa
 */
export function step(value: number, steps: number): number {
    return Math.floor(value * steps) / steps;
}