/**
 * @file IdGenerator.ts
 * @description Generowanie unikalnych identyfikatorów
 */

/**
 * Generator ID dla encji
 */
export class IdGenerator {
    private static instance: IdGenerator;
    private currentId: number = 1;
    private freedIds: Set<number> = new Set();
    private readonly maxId: number;
    private readonly reuseIds: boolean;

    constructor(maxId: number = 1000000, reuseIds: boolean = true) {
        this.maxId = maxId;
        this.reuseIds = reuseIds;
    }

    /**
     * Zwraca instancję singletonu
     */
    static getInstance(): IdGenerator {
        if (!IdGenerator.instance) {
            IdGenerator.instance = new IdGenerator();
        }
        return IdGenerator.instance;
    }

    /**
     * Generuje następne wolne ID
     */
    next(): number {
        // Jeśli są zwolnione ID i mamy je reuse'ować
        if (this.reuseIds && this.freedIds.size > 0) {
            const [nextId] = this.freedIds;
            this.freedIds.delete(nextId);
            return nextId;
        }

        // Sprawdź czy nie przekroczono limitu
        if (this.currentId > this.maxId) {
            throw new Error(`IdGenerator: przekroczono limit ID (${this.maxId})`);
        }

        return this.currentId++;
    }

    /**
     * Generuje ID jako string
     */
    nextString(prefix: string = ''): string {
        return `${prefix}${this.next()}`;
    }

    /**
     * Generuje ID w formacie hex
     */
    nextHex(): string {
        return this.next().toString(16).padStart(8, '0');
    }

    /**
     * Generuje krótkie ID (dla sieci)
     */
    nextShort(): number {
        return this.next() & 0xFFFF; // 16-bit
    }

    /**
     * Zwraca ID do puli
     */
    free(id: number): void {
        if (id > 0 && id < this.currentId) {
            this.freedIds.add(id);
        }
    }

    /**
     * Czyści pulę zwolnionych ID
     */
    clearFreed(): void {
        this.freedIds.clear();
    }

    /**
     * Resetuje generator
     */
    reset(): void {
        this.currentId = 1;
        this.freedIds.clear();
    }

    /**
     * Sprawdza czy ID jest w użyciu
     */
    isUsed(id: number): boolean {
        return id < this.currentId && !this.freedIds.has(id);
    }

    /**
     * Liczba aktywnych ID
     */
    get activeCount(): number {
        return this.currentId - 1 - this.freedIds.size;
    }

    /**
     * Liczba zwolnionych ID
     */
    get freedCount(): number {
        return this.freedIds.size;
    }
}

/**
 * Generator UUID v4
 */
export class UuidGenerator {
    /**
     * Generuje UUID v4
     */
    static generate(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Generuje krótkie UUID (pierwsze 8 znaków)
     */
    static short(): string {
        return UuidGenerator.generate().split('-')[0];
    }

    /**
     * Generuje UUID bez myślników
     */
    static compact(): string {
        return UuidGenerator.generate().replace(/-/g, '');
    }
}

/**
 * Generator sekwencyjnych ID z prefiksem
 */
export class PrefixedIdGenerator {
    private generator: IdGenerator;
    private readonly prefix: string;

    constructor(prefix: string, maxId: number = 1000000) {
        this.prefix = prefix;
        this.generator = new IdGenerator(maxId);
    }

    next(): string {
        return `${this.prefix}_${this.generator.next()}`;
    }

    free(id: string): void {
        const match = id.match(new RegExp(`^${this.prefix}_(\\d+)$`));
        if (match) {
            this.generator.free(parseInt(match[1], 10));
        }
    }
}

/**
 * Generator ID dla sesji (losowe + czas)
 */
export class SessionIdGenerator {
    /**
     * Generuje ID sesji
     */
    static generate(): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 10);
        return `${timestamp}_${random}`;
    }

    /**
     * Generuje ID sesji z prefixem
     */
    static withPrefix(prefix: string): string {
        return `${prefix}_${SessionIdGenerator.generate()}`;
    }

    /**
     * Pobiera timestamp z ID sesji
     */
    static getTimestamp(sessionId: string): number | null {
        const match = sessionId.match(/^([a-z0-9]+)_/);
        if (match) {
            return parseInt(match[1], 36);
        }
        return null;
    }
}

/**
 * Generator ID dla graczy (z nazwą)
 */
export class PlayerIdGenerator {
    private static counter: number = 0;

    /**
     * Generuje ID gracza z nazwy
     */
    static fromName(name: string): string {
        const cleanName = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const timestamp = Date.now().toString(36).slice(-4);
        return `${cleanName}_${timestamp}`;
    }

    /**
     * Generuje anonimowe ID gracza
     */
    static anonymous(): string {
        PlayerIdGenerator.counter++;
        return `player_${PlayerIdGenerator.counter}_${Date.now().toString(36)}`;
    }

    /**
     * Sprawdza czy ID jest poprawne
     */
    static isValid(playerId: string): boolean {
        return /^[a-z0-9]+_[a-z0-9]+$/.test(playerId);
    }
}

/**
 * Generator ID dla pokojów
 */
export class RoomIdGenerator {
    /**
     * Generuje ID pokoju z regionem
     */
    static forRegion(region: string): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 6);
        return `${region}_${timestamp}_${random}`;
    }

    /**
     * Generuje ID pokoju dla trybu gry
     */
    static forGameMode(mode: string): string {
        const id = Math.random().toString(36).substring(2, 8);
        return `${mode}_${id}`;
    }

    /**
     * Pobiera region z ID pokoju
     */
    static getRegion(roomId: string): string | null {
        const match = roomId.match(/^([a-z]+)_/);
        return match ? match[1] : null;
    }
}

/**
 * Globalne instancje
 */
export const idGenerator = IdGenerator.getInstance();
export const uuid = UuidGenerator.generate;
export const shortUuid = UuidGenerator.short;