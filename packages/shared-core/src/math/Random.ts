/**
 * @file Random.ts
 * @description Zaawansowane generowanie liczb losowych
 */

import { Vector2 } from './Vector2';
import { clamp01 } from './Clamp';

/**
 * Główna klasa do generowania liczb losowych
 */
export class Random {
    private static instance: Random;
    private seed: number;

    constructor(seed?: number) {
        this.seed = seed ?? Date.now();
    }

    /**
     * Zwraca instancję singletonu
     */
    static getInstance(): Random {
        if (!Random.instance) {
            Random.instance = new Random();
        }
        return Random.instance;
    }

    /**
     * Ustawia ziarno
     */
    setSeed(seed: number): void {
        this.seed = seed;
    }

    /**
     * Generuje pseudolosową liczbę (algorytm xorshift)
     */
    next(): number {
        let x = this.seed;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        this.seed = x;
        return (x >>> 0) / 4294967296; // konwersja na [0,1)
    }

    /**
     * Losowa liczba w zakresie [min, max)
     */
    range(min: number, max: number): number {
        return min + this.next() * (max - min);
    }

    /**
     * Losowa liczba całkowita w zakresie [min, max]
     */
    rangeInt(min: number, max: number): number {
        return Math.floor(this.range(min, max + 1));
    }

    /**
     * Losowa liczba w zakresie [0, 1)
     */
    nextFloat(): number {
        return this.next();
    }

    /**
     * Losowa liczba całkowita
     */
    nextInt(max: number = 1000000): number {
        return Math.floor(this.next() * max);
    }

    /**
     * Losowa wartość boolowska
     */
    nextBoolean(probability: number = 0.5): boolean {
        return this.next() < clamp01(probability);
    }

    /**
     * Losowy znak (+1 lub -1)
     */
    nextSign(): number {
        return this.nextBoolean() ? 1 : -1;
    }

    /**
     * Losowy kąt w radianach [0, 2PI)
     */
    nextAngle(): number {
        return this.range(0, Math.PI * 2);
    }

    /**
     * Losowy kąt w stopniach [0, 360)
     */
    nextAngleDegrees(): number {
        return this.range(0, 360);
    }

    /**
     * Losowy wektor 2D
     */
    nextVector2(): Vector2 {
        return new Vector2(this.next(), this.next());
    }

    /**
     * Losowy wektor 2D w zakresie
     */
    nextVector2Range(minX: number, maxX: number, minY: number, maxY: number): Vector2 {
        return new Vector2(
            this.range(minX, maxX),
            this.range(minY, maxY)
        );
    }

    /**
     * Losowy wektor jednostkowy
     */
    nextUnitVector(): Vector2 {
        const angle = this.nextAngle();
        return new Vector2(Math.cos(angle), Math.sin(angle));
    }

    /**
     * Losowy punkt w kole
     */
    nextPointInCircle(radius: number): Vector2 {
        const r = Math.sqrt(this.next()) * radius; // równomierny rozkład
        const angle = this.nextAngle();
        return new Vector2(
            Math.cos(angle) * r,
            Math.sin(angle) * r
        );
    }

    /**
     * Losowy punkt w pierścieniu
     */
    nextPointInRing(minRadius: number, maxRadius: number): Vector2 {
        const r = this.range(minRadius, maxRadius);
        const angle = this.nextAngle();
        return new Vector2(
            Math.cos(angle) * r,
            Math.sin(angle) * r
        );
    }

    /**
     * Losowy punkt w prostokącie
     */
    nextPointInRect(width: number, height: number): Vector2 {
        return new Vector2(
            this.range(-width / 2, width / 2),
            this.range(-height / 2, height / 2)
        );
    }

    /**
     * Losowy kolor w formacie hex
     */
    nextColor(): string {
        const r = Math.floor(this.range(0, 256));
        const g = Math.floor(this.range(0, 256));
        const b = Math.floor(this.range(0, 256));
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }

    /**
     * Losowa nazwa gracza (z prefiksem)
     */
    nextPlayerName(prefix: string = 'Player'): string {
        const number = this.rangeInt(1, 9999);
        return `${prefix}${number}`;
    }

    /**
     * Losowa pozycja w świecie
     */
    nextWorldPosition(worldWidth: number, worldHeight: number): Vector2 {
        return new Vector2(
            this.range(0, worldWidth),
            this.range(0, worldHeight)
        );
    }

    /**
     * Losowa pozycja z marginesem od granic
     */
    nextWorldPositionSafe(worldWidth: number, worldHeight: number, margin: number): Vector2 {
        return new Vector2(
            this.range(margin, worldWidth - margin),
            this.range(margin, worldHeight - margin)
        );
    }

    /**
     * Losowy element z tablicy
     */
    nextFromArray<T>(array: T[]): T {
        return array[this.rangeInt(0, array.length - 1)];
    }

    /**
     * Losowe elementy z tablicy (bez powtórzeń)
     */
    nextMultipleFromArray<T>(array: T[], count: number): T[] {
        const shuffled = this.shuffleArray([...array]);
        return shuffled.slice(0, count);
    }

    /**
     * Miesza tablicę (Fisher-Yates)
     */
    shuffleArray<T>(array: T[]): T[] {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(this.next() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * Losowa wartość z rozkładem normalnym (Gauss)
     */
    nextGaussian(mean: number = 0, stdDev: number = 1): number {
        // Box-Muller transform
        const u1 = this.next();
        const u2 = this.next();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        return mean + z * stdDev;
    }

    /**
     * Losowa wartość z rozkładem wykładniczym
     */
    nextExponential(lambda: number = 1): number {
        return -Math.log(1 - this.next()) / lambda;
    }

    /**
     * Losowa wartość z rozkładem Poissona
     */
    nextPoisson(lambda: number): number {
        const L = Math.exp(-lambda);
        let k = 0;
        let p = 1;
        
        do {
            k++;
            p *= this.next();
        } while (p > L);
        
        return k - 1;
    }

    /**
     * Losowa wartość z ważoną tablicą
     */
    nextWeighted<T>(items: Array<{ item: T; weight: number }>): T {
        const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
        let random = this.range(0, totalWeight);
        
        for (const item of items) {
            if (random < item.weight) {
                return item.item;
            }
            random -= item.weight;
        }
        
        return items[0].item;
    }

    /**
     * Tworzy generator losowych liczb z określonym ziarnem
     */
    static withSeed(seed: number): Random {
        return new Random(seed);
    }

    /**
     * Zwraca losową liczbę (funkcja statyczna)
     */
    static value(): number {
        return Random.getInstance().next();
    }

    /**
     * Zwraca losową liczbę w zakresie (funkcja statyczna)
     */
    static range(min: number, max: number): number {
        return Random.getInstance().range(min, max);
    }

    /**
     * Zwraca losową liczbę całkowitą (funkcja statyczna)
     */
    static rangeInt(min: number, max: number): number {
        return Random.getInstance().rangeInt(min, max);
    }
}

/**
 * Globalny generator liczb losowych
 */
export const random = Random.getInstance();

/**
 * Funkcje pomocnicze (dla wygody)
 */
export const randomValue = () => random.next();
export const randomRange = (min: number, max: number) => random.range(min, max);
export const randomInt = (min: number, max: number) => random.rangeInt(min, max);
export const randomBoolean = (prob: number = 0.5) => random.nextBoolean(prob);
export const randomElement = <T>(array: T[]) => random.nextFromArray(array);
export const randomVector = () => random.nextUnitVector();
export const randomColor = () => random.nextColor();