/**
     * Normalizuje wektor (długość staje się równa 1).
     * Kluczowe do określenia kierunku ruchu niezależnie od odległości myszki.
     */
    public normalize(): this {
        const m = this.mag();
        if (m > 0) this.div(m);
        return this;
    }

    /**
     * Ogranicza długość wektora. Przydatne, aby kulka nie przyspieszała w nieskończoność.
     */
    public limit(max: number): this {
        const mSq = this.magSq();
        if (mSq > max * max) {
            this.div(Math.sqrt(mSq)).mul(max);
        }
        return this;
    }
    /**
     * Liniowa interpolacja (Lerp). 
     * To sprawia, że ruch kulek na ekranie jest płynny, a nie "skaczący".
     */
    public lerp(target: Vector2, amount: number): this {
        this.x += (target.x - this.x) * amount;
        this.y += (target.y - this.y) * amount;
        return this;
    }

    /**
     * Zwraca kąt wektora w radianach.
     */
    public heading(): number {
        return Math.atan2(this.y, this.x);
    }

    /**
     * Obraca wektor o podany kąt (w radianach).
     */
    public rotate(angle: number): this {
        const newX = this.x * Math.cos(angle) - this.y * Math.sin(angle);
        const newY = this.x * Math.sin(angle) + this.y * Math.cos(angle);
        this.x = newX;
        this.y = newY;
        return this;
    }

    /**
     * Sprawdza, czy wektor jest zerowy.
     */
    public isZero(): boolean {
        return this.x === 0 && this.y === 0;
    }
} // Koniec klasy Vector2