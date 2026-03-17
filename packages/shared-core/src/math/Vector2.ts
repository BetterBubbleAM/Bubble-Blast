/**
 * @file Vector2.ts
 * @description Dwuwymiarowy wektor z operacjami matematycznymi
 */

/**
 * Klasa wektora 2D z pełnymi operacjami matematycznymi
 */
export class Vector2 {
    public x: number;
    public y: number;

    constructor(x: number = 0, y: number = 0) {
        this.x = x;
        this.y = y;
    }

    /**
     * Tworzy wektor z obiektu
     */
    static from(obj: { x: number; y: number }): Vector2 {
        return new Vector2(obj.x, obj.y);
    }

    /**
     * Tworzy wektor zerowy
     */
    static zero(): Vector2 {
        return new Vector2(0, 0);
    }

    /**
     * Tworzy wektor jednostkowy (1,1)
     */
    static one(): Vector2 {
        return new Vector2(1, 1);
    }

    /**
     * Tworzy wektor jednostkowy w prawo (1,0)
     */
    static right(): Vector2 {
        return new Vector2(1, 0);
    }

    /**
     * Tworzy wektor jednostkowy w lewo (-1,0)
     */
    static left(): Vector2 {
        return new Vector2(-1, 0);
    }

    /**
     * Tworzy wektor jednostkowy w górę (0,1)
     */
    static up(): Vector2 {
        return new Vector2(0, 1);
    }

    /**
     * Tworzy wektor jednostkowy w dół (0,-1)
     */
    static down(): Vector2 {
        return new Vector2(0, -1);
    }

    /**
     * Tworzy wektor z kąta w radianach
     */
    static fromAngle(angle: number): Vector2 {
        return new Vector2(Math.cos(angle), Math.sin(angle));
    }

    /**
     * Losowy wektor jednostkowy
     */
    static random(): Vector2 {
        const angle = Math.random() * Math.PI * 2;
        return Vector2.fromAngle(angle);
    }

    /**
     * Losowy wektor w zakresie
     */
    static randomRange(minX: number, maxX: number, minY: number, maxY: number): Vector2 {
        return new Vector2(
            Math.random() * (maxX - minX) + minX,
            Math.random() * (maxY - minY) + minY
        );
    }

    /**
     * Kopiuje wektor
     */
    clone(): Vector2 {
        return new Vector2(this.x, this.y);
    }

    /**
     * Ustawia wartości wektora
     */
    set(x: number, y: number): this {
        this.x = x;
        this.y = y;
        return this;
    }

    /**
     * Kopiuje wartości z innego wektora
     */
    copy(other: Vector2): this {
        this.x = other.x;
        this.y = other.y;
        return this;
    }

    /**
     * Dodaje wektor
     */
    add(other: Vector2): this {
        this.x += other.x;
        this.y += other.y;
        return this;
    }

    /**
     * Dodaje wektor i zwraca nowy
     */
    added(other: Vector2): Vector2 {
        return new Vector2(this.x + other.x, this.y + other.y);
    }

    /**
     * Dodaje skalary
     */
    addScalar(x: number, y: number): this {
        this.x += x;
        this.y += y;
        return this;
    }

    /**
     * Odejmuje wektor
     */
    subtract(other: Vector2): this {
        this.x -= other.x;
        this.y -= other.y;
        return this;
    }

    /**
     * Odejmuje wektor i zwraca nowy
     */
    subtracted(other: Vector2): Vector2 {
        return new Vector2(this.x - other.x, this.y - other.y);
    }

    /**
     * Mnoży przez skalar
     */
    multiply(scalar: number): this {
        this.x *= scalar;
        this.y *= scalar;
        return this;
    }

    /**
     * Mnoży przez skalar i zwraca nowy
     */
    multiplied(scalar: number): Vector2 {
        return new Vector2(this.x * scalar, this.y * scalar);
    }

    /**
     * Mnoży składowo przez inny wektor
     */
    multiplyComponents(other: Vector2): this {
        this.x *= other.x;
        this.y *= other.y;
        return this;
    }

    /**
     * Dzieli przez skalar
     */
    divide(scalar: number): this {
        if (scalar !== 0) {
            this.x /= scalar;
            this.y /= scalar;
        }
        return this;
    }

    /**
     * Dzieli przez skalar i zwraca nowy
     */
    divided(scalar: number): Vector2 {
        if (scalar !== 0) {
            return new Vector2(this.x / scalar, this.y / scalar);
        }
        return new Vector2(0, 0);
    }

    /**
     * Długość wektora
     */
    length(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    /**
     * Kwadrat długości (szybszy do porównań)
     */
    lengthSquared(): number {
        return this.x * this.x + this.y * this.y;
    }

    /**
     * Normalizuje wektor (długość = 1)
     */
    normalize(): this {
        const len = this.length();
        if (len > 0) {
            this.x /= len;
            this.y /= len;
        }
        return this;
    }

    /**
     * Zwraca znormalizowaną kopię
     */
    normalized(): Vector2 {
        const vec = this.clone();
        return vec.normalize();
    }

    /**
     * Odwraca wektor
     */
    negate(): this {
        this.x = -this.x;
        this.y = -this.y;
        return this;
    }

    /**
     * Iloczyn skalarny
     */
    dot(other: Vector2): number {
        return this.x * other.x + this.y * other.y;
    }

    /**
     * Iloczyn wektorowy (w 2D zwraca skalar)
     */
    cross(other: Vector2): number {
        return this.x * other.y - this.y * other.x;
    }

    /**
     * Odległość do innego wektora
     */
    distanceTo(other: Vector2): number {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Kwadrat odległości (szybszy)
     */
    distanceToSquared(other: Vector2): number {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        return dx * dx + dy * dy;
    }

    /**
     * Kąt wektora w radianach
     */
    angle(): number {
        return Math.atan2(this.y, this.x);
    }

    /**
     * Kąt między dwoma wektorami
     */
    angleTo(other: Vector2): number {
        const dot = this.dot(other);
        const lenProduct = this.length() * other.length();
        return Math.acos(dot / lenProduct);
    }

    /**
     * Obraca wektor o kąt w radianach
     */
    rotate(angle: number): this {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const x = this.x * cos - this.y * sin;
        const y = this.x * sin + this.y * cos;
        this.x = x;
        this.y = y;
        return this;
    }

    /**
     * Obraca wektor wokół punktu
     */
    rotateAround(point: Vector2, angle: number): this {
        this.subtract(point);
        this.rotate(angle);
        this.add(point);
        return this;
    }

    /**
     * Rzutuje na inny wektor
     */
    projectOnto(other: Vector2): Vector2 {
        const dot = this.dot(other);
        const lenSq = other.lengthSquared();
        if (lenSq === 0) return Vector2.zero();
        const factor = dot / lenSq;
        return other.clone().multiply(factor);
    }

    /**
     * Sprawdza czy wektor jest zerowy
     */
    isZero(): boolean {
        return this.x === 0 && this.y === 0;
    }

    /**
     * Sprawdza czy wektor jest jednostkowy
     */
    isUnit(tolerance: number = 0.0001): boolean {
        return Math.abs(this.length() - 1) < tolerance;
    }

    /**
     * Sprawdza czy wektor jest skończony
     */
    isFinite(): boolean {
        return Number.isFinite(this.x) && Number.isFinite(this.y);
    }

    /**
     * Ogranicza długość wektora
     */
    clampLength(maxLength: number): this {
        const len = this.length();
        if (len > maxLength && len > 0) {
            this.multiply(maxLength / len);
        }
        return this;
    }

    /**
     * Interpolacja liniowa między wektorami
     */
    lerp(target: Vector2, t: number): this {
        this.x = this.x + (target.x - this.x) * t;
        this.y = this.y + (target.y - this.y) * t;
        return this;
    }

    /**
     * Zwraca wektor jako obiekt
     */
    toObject(): { x: number; y: number } {
        return { x: this.x, y: this.y };
    }

    /**
     * Zwraca wektor jako tablicę
     */
    toArray(): [number, number] {
        return [this.x, this.y];
    }

    /**
     * Zwraca string reprezentację
     */
    toString(): string {
        return `Vector2(${this.x}, ${this.y})`;
    }

    /**
     * Porównuje z innym wektorem
     */
    equals(other: Vector2, epsilon: number = 0.0001): boolean {
        return Math.abs(this.x - other.x) < epsilon && 
               Math.abs(this.y - other.y) < epsilon;
    }
}

/**
 * Dodaje dwa wektory
 */
export function addVectors(a: Vector2, b: Vector2): Vector2 {
    return a.clone().add(b);
}

/**
 * Odejmuje dwa wektory
 */
export function subtractVectors(a: Vector2, b: Vector2): Vector2 {
    return a.clone().subtract(b);
}

/**
 * Mnoży wektor przez skalar
 */
export function multiplyVector(v: Vector2, scalar: number): Vector2 {
    return v.clone().multiply(scalar);
}

/**
 * Dzieli wektor przez skalar
 */
export function divideVector(v: Vector2, scalar: number): Vector2 {
    return v.clone().divide(scalar);
}

/**
 * Oblicza środek masy dla zbioru punktów
 */
export function centerOfMass(points: Vector2[]): Vector2 {
    if (points.length === 0) return Vector2.zero();
    
    const sum = points.reduce((acc, p) => acc.add(p), Vector2.zero());
    return sum.divide(points.length);
}

/**
 * Oblicza bounding box dla zbioru punktów
 */
export function boundingBox(points: Vector2[]): { min: Vector2; max: Vector2 } {
    if (points.length === 0) {
        return { min: Vector2.zero(), max: Vector2.zero() };
    }
    
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const p of points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }
    
    return {
        min: new Vector2(minX, minY),
        max: new Vector2(maxX, maxY)
    };
}