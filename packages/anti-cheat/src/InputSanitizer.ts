/**
 * @file InputSanitizer.ts
 * @description Sanityzacja inputu - wykrywanie niemożliwych/nienaturalnych ruchów
 */

import { PlayerId } from '@shared-core/types/EntityTypes';
import { Vector2 } from '@shared-core/math/Vector2';
import { ClientPacketData, ClientPacketType } from '@network-protocol/schemas/ClientPackets';

/**
 | Wynik sanityzacji
 */
export interface SanitizationResult {
    passed: boolean;
    confidence: number;
    sanitized?: ClientPacketData;  // Poprawiony pakiet
    reason?: string;
}

/**
 | Próbka inputu
 */
interface InputSample {
    timestamp: number;
    targetPosition: Vector2;
    isSplitting: boolean;
    isEjecting: boolean;
}

/**
 | Sanitizer inputu
 */
export class InputSanitizer {
    private playerHistory: Map<PlayerId, InputSample[]> = new Map();
    
    // Limity
    private maxMouseSpeed: number = 5000;        // Maksymalna prędkość myszy (piksele/s)
    private maxMouseAcceleration: number = 50000; // Maksymalne przyspieszenie myszy
    private minSampleInterval: number = 8;        // Minimalny odstęp między próbkami (ms)
    private maxJitter: number = 10;                // Maksymalny jitter pozycji

    /**
     | Sanityzuje input
     */
    sanitize(playerId: PlayerId, packet: ClientPacketData): SanitizationResult {
        if (packet.type !== ClientPacketType.INPUT_STATE) {
            return { passed: true, confidence: 0 };
        }

        const input = packet as any;
        
        // Pobierz historię
        if (!this.playerHistory.has(playerId)) {
            this.playerHistory.set(playerId, []);
        }

        const history = this.playerHistory.get(playerId)!;

        // Sprawdź czy to pierwszy input
        if (history.length === 0) {
            history.push(this.sampleFromInput(input));
            return { passed: true, confidence: 0 };
        }

        const lastSample = history[history.length - 1];
        const currentSample = this.sampleFromInput(input);
        
        // Sprawdź interwał czasowy
        const timeDiff = currentSample.timestamp - lastSample.timestamp;
        if (timeDiff < this.minSampleInterval) {
            return {
                passed: false,
                confidence: 0.8,
                reason: `Input too frequent: ${timeDiff}ms`
            };
        }

        // Sprawdź prędkość myszy
        const speedResult = this.checkMouseSpeed(lastSample, currentSample, timeDiff);
        if (!speedResult.passed) {
            return speedResult;
        }

        // Sprawdź przyspieszenie
        if (history.length >= 2) {
            const olderSample = history[history.length - 2];
            const accelResult = this.checkMouseAcceleration(olderSample, lastSample, currentSample);
            if (!accelResult.passed) {
                return accelResult;
            }
        }

        // Sprawdź nienaturalne wzorce (aimbot)
        const patternResult = this.checkAimbotPattern(history, currentSample);
        if (!patternResult.passed) {
            return patternResult;
        }

        // Sprawdź jitter (drżenie myszy)
        const jitterResult = this.checkJitter(history, currentSample);
        if (!jitterResult.passed) {
            return jitterResult;
        }

        // Sprawdź splitting/ejecting
        const actionResult = this.checkActions(lastSample, currentSample);
        if (!actionResult.passed) {
            return actionResult;
        }

        // Dodaj do historii
        history.push(currentSample);
        
        // Ogranicz rozmiar historii
        while (history.length > 60) {
            history.shift();
        }

        return { passed: true, confidence: 0 };
    }

    /**
     | Sprawdza prędkość myszy
     */
    private checkMouseSpeed(last: InputSample, current: InputSample, timeDiff: number): SanitizationResult {
        if (timeDiff <= 0) {
            return { passed: true, confidence: 0 };
        }

        const distance = current.targetPosition.distanceTo(last.targetPosition);
        const speed = distance / (timeDiff / 1000); // piksele na sekundę

        if (speed > this.maxMouseSpeed) {
            const confidence = Math.min(1, (speed - this.maxMouseSpeed) / this.maxMouseSpeed);
            return {
                passed: false,
                confidence,
                reason: `Mouse speed too high: ${speed.toFixed(2)} px/s`
            };
        }

        return { passed: true, confidence: 0 };
    }

    /**
     | Sprawdza przyspieszenie myszy
     */
    private checkMouseAcceleration(
        older: InputSample,
        last: InputSample,
        current: InputSample
    ): SanitizationResult {
        const timeDiff1 = (last.timestamp - older.timestamp) / 1000;
        const timeDiff2 = (current.timestamp - last.timestamp) / 1000;

        if (timeDiff1 <= 0 || timeDiff2 <= 0) {
            return { passed: true, confidence: 0 };
        }

        const speed1 = last.targetPosition.distanceTo(older.targetPosition) / timeDiff1;
        const speed2 = current.targetPosition.distanceTo(last.targetPosition) / timeDiff2;

        const acceleration = Math.abs(speed2 - speed1) / timeDiff2;

        if (acceleration > this.maxMouseAcceleration) {
            return {
                passed: false,
                confidence: 0.7,
                reason: `Mouse acceleration too high: ${acceleration.toFixed(2)} px/s²`
            };
        }

        return { passed: true, confidence: 0 };
    }

    /**
     | Sprawdza wzorce aimbota
     */
    private checkAimbotPattern(history: InputSample[], current: InputSample): SanitizationResult {
        if (history.length < 10) {
            return { passed: true, confidence: 0 };
        }

        // Sprawdź czy ruch jest zbyt idealny (proste linie)
        let straightLineCount = 0;
        const threshold = 0.99; // Cosinus kąta dla prawie prostej linii

        for (let i = 1; i < Math.min(5, history.length); i++) {
            const a = history[history.length - i].targetPosition;
            const b = history[history.length - i - 1].targetPosition;
            const c = current.targetPosition;

            const v1 = b.subtracted(a);
            const v2 = c.subtracted(b);

            if (v1.lengthSquared() === 0 || v2.lengthSquared() === 0) continue;

            const dot = v1.dot(v2);
            const cos = dot / (v1.length() * v2.length());

            if (Math.abs(cos) > threshold) {
                straightLineCount++;
            }
        }

        // Jeśli większość ruchów to idealne proste linie
        if (straightLineCount > 3) {
            return {
                passed: false,
                confidence: 0.6,
                reason: 'Suspiciously straight movement pattern'
            };
        }

        return { passed: true, confidence: 0 };
    }

    /**
     | Sprawdza jitter (naturalne drżenie myszy)
     */
    private checkJitter(history: InputSample[], current: InputSample): SanitizationResult {
        if (history.length < 5) {
            return { passed: true, confidence: 0 };
        }

        // Oblicz średni jitter
        let totalJitter = 0;
        let samples = 0;

        for (let i = 1; i < Math.min(5, history.length); i++) {
            const p1 = history[history.length - i].targetPosition;
            const p2 = history[history.length - i - 1].targetPosition;
            
            const jitter = Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
            totalJitter += jitter;
            samples++;
        }

        const avgJitter = samples > 0 ? totalJitter / samples : 0;

        // Zbyt mały jitter może wskazywać na aimbota
        if (avgJitter < 0.5 && samples > 3) {
            return {
                passed: false,
                confidence: 0.5,
                reason: 'Unnatural precision (no jitter)'
            };
        }

        return { passed: true, confidence: 0 };
    }

    /**
     | Sprawdza akcje (split/eject)
     */
    private checkActions(last: InputSample, current: InputSample): SanitizationResult {
        // Sprawdź czy split i eject nie są jednocześnie wciśnięte
        if (current.isSplitting && current.isEjecting) {
            return {
                passed: false,
                confidence: 0.9,
                reason: 'Cannot split and eject simultaneously'
            };
        }

        // Sprawdź zbyt szybkie przełączanie
        if (current.isSplitting !== last.isSplitting && 
            current.timestamp - last.timestamp < 50) {
            return {
                passed: false,
                confidence: 0.5,
                reason: 'Action toggle too fast'
            };
        }

        return { passed: true, confidence: 0 };
    }

    /**
     | Tworzy próbkę z inputu
     */
    private sampleFromInput(input: any): InputSample {
        return {
            timestamp: input.timestamp,
            targetPosition: input.targetPosition.clone(),
            isSplitting: input.isSplitting || false,
            isEjecting: input.isEjecting || false
        };
    }

    /**
     | Resetuje historię gracza
     */
    resetPlayer(playerId: PlayerId): void {
        this.playerHistory.delete(playerId);
    }

    /**
     | Ustawia limity
     */
    setLimits(maxSpeed: number, maxAccel: number, minInterval: number): void {
        this.maxMouseSpeed = maxSpeed;
        this.maxMouseAcceleration = maxAccel;
        this.minSampleInterval = minInterval;
    }
}