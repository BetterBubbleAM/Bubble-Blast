/**
 * @file SpeedHackDetector.ts
 * @description Wykrywanie speed hack - niemożliwe prędkości
 */

import { PlayerId } from '@shared-core/types/EntityTypes';
import { Vector2 } from '@shared-core/math/Vector2';
import { GAMEPLAY_CONSTANTS } from '@shared-core/constants/GameplayConstants';

/**
 | Próbka ruchu gracza
 */
interface MovementSample {
    timestamp: number;
    position: Vector2;
    serverPosition?: Vector2;   // Pozycja po stronie serwera
}

/**
 | Wynik weryfikacji
 */
export interface VerificationResult {
    passed: boolean;
    confidence: number;
    details?: string;
}

/**
 | Detektor speed hack
 */
export class SpeedHackDetector {
    private playerHistory: Map<PlayerId, MovementSample[]> = new Map();
    private playerWarnings: Map<PlayerId, number> = new Map();
    
    private maxHistorySize: number = 60;        // 1 sekunda @ 60fps
    private maxSpeed: number = GAMEPLAY_CONSTANTS.MAX_SPEED;
    private speedThreshold: number = 1.5;       // 150% normalnej prędkości
    var accelerationThreshold: number = 1000;    // Maksymalne przyspieszenie (units/s²)
    var teleportThreshold: number = 100;          // Teleportacja jeśli > 100 units w 1 klatce

    /**
     | Rejestruje próbkę ruchu
     */
    recordSample(playerId: PlayerId, position: Vector2, serverPosition?: Vector2): void {
        if (!this.playerHistory.has(playerId)) {
            this.playerHistory.set(playerId, []);
        }

        const history = this.playerHistory.get(playerId)!;
        
        history.push({
            timestamp: Date.now(),
            position: position.clone(),
            serverPosition: serverPosition?.clone()
        });

        // Ogranicz rozmiar historii
        while (history.length > this.maxHistorySize) {
            history.shift();
        }
    }

    /**
     | Weryfikuje ruch gracza
     */
    verify(playerId: PlayerId, data?: any): VerificationResult {
        const history = this.playerHistory.get(playerId);
        if (!history || history.length < 2) {
            return { passed: true, confidence: 0 };
        }

        const latest = history[history.length - 1];
        const previous = history[history.length - 2];
        
        const timeDiff = (latest.timestamp - previous.timestamp) / 1000; // w sekundach
        if (timeDiff <= 0) return { passed: true, confidence: 0 };

        // Oblicz prędkość
        const distance = latest.position.distanceTo(previous.position);
        const speed = distance / timeDiff;

        // Oblicz przyspieszenie
        let acceleration = 0;
        if (history.length >= 3) {
            const older = history[history.length - 3];
            const prevSpeed = previous.position.distanceTo(older.position) / 
                ((previous.timestamp - older.timestamp) / 1000);
            acceleration = Math.abs(speed - prevSpeed) / timeDiff;
        }

        // Sprawdź czy to teleportacja
        if (distance > this.teleportThreshold && timeDiff < 0.1) {
            return {
                passed: false,
                confidence: 0.9,
                details: `Teleportation detected: ${distance.toFixed(2)} units`
            };
        }

        // Sprawdź prędkość
        if (speed > this.maxSpeed * this.speedThreshold) {
            const confidence = Math.min(1, (speed / this.maxSpeed - 1) / 2);
            return {
                passed: false,
                confidence,
                details: `Speed hack detected: ${speed.toFixed(2)} u/s (max: ${this.maxSpeed})`
            };
        }

        // Sprawdź przyspieszenie
        if (acceleration > this.accelerationThreshold) {
            return {
                passed: false,
                confidence: 0.7,
                details: `Impossible acceleration: ${acceleration.toFixed(2)} u/s²`
            };
        }

        // Porównaj z pozycją serwera (jeśli dostępna)
        if (latest.serverPosition && previous.serverPosition) {
            const serverDistance = latest.serverPosition.distanceTo(previous.serverPosition);
            const clientDistance = latest.position.distanceTo(previous.position);
            
            // Jeśli klient twierdzi że porusza się znacznie szybciej niż serwer
            if (clientDistance > serverDistance * 2 && clientDistance > 10) {
                return {
                    passed: false,
                    confidence: 0.6,
                    details: `Position mismatch with server`
                };
            }
        }

        return { passed: true, confidence: 0 };
    }

    /**
     | Sprawdza średnią prędkość w oknie czasowym
     */
    checkAverageSpeed(playerId: PlayerId, windowMs: number = 1000): VerificationResult {
        const history = this.playerHistory.get(playerId);
        if (!history || history.length < 2) {
            return { passed: true, confidence: 0 };
        }

        const now = Date.now();
        const relevant = history.filter(s => now - s.timestamp <= windowMs);
        
        if (relevant.length < 2) {
            return { passed: true, confidence: 0 };
        }

        const first = relevant[0];
        const last = relevant[relevant.length - 1];
        
        const timeDiff = (last.timestamp - first.timestamp) / 1000;
        if (timeDiff <= 0) return { passed: true, confidence: 0 };

        // Oblicz całkowitą przebytą drogę
        let totalDistance = 0;
        for (let i = 1; i < relevant.length; i++) {
            totalDistance += relevant[i].position.distanceTo(relevant[i - 1].position);
        }

        const avgSpeed = totalDistance / timeDiff;

        if (avgSpeed > this.maxSpeed * 1.2) {
            return {
                passed: false,
                confidence: Math.min(1, (avgSpeed / this.maxSpeed - 1) / 1.5),
                details: `Average speed too high: ${avgSpeed.toFixed(2)} u/s`
            };
        }

        return { passed: true, confidence: 0 };
    }

    /**
     | Sprawdza czy pozycje są deterministyczne
     */
    checkDeterministic(playerId: PlayerId): VerificationResult {
        const history = this.playerHistory.get(playerId);
        if (!history || history.length < 10) {
            return { passed: true, confidence: 0 };
        }

        // Sprawdź czy ruch jest zbyt idealny (boty)
        let directionChanges = 0;
        let lastDirection: Vector2 | null = null;

        for (let i = 1; i < history.length; i++) {
            const dir = history[i].position.subtracted(history[i - 1].position).normalized();
            
            if (lastDirection) {
                const dot = lastDirection.dot(dir);
                if (dot < -0.9) { // Nagła zmiana kierunku o 180°
                    directionChanges++;
                }
            }
            
            lastDirection = dir;
        }

        // Zbyt wiele nagłych zmian może wskazywać na aimbot
        if (directionChanges > history.length * 0.3) {
            return {
                passed: false,
                confidence: 0.5,
                details: `Erratic movement pattern`
            };
        }

        return { passed: true, confidence: 0 };
    }

    /**
     | Resetuje historię gracza
     */
    resetPlayer(playerId: PlayerId): void {
        this.playerHistory.delete(playerId);
        this.playerWarnings.delete(playerId);
    }

    /**
     | Ustawia maksymalną prędkość
     */
    setMaxSpeed(speed: number): void {
        this.maxSpeed = speed;
    }

    /**
     | Pobiera statystyki
     */
    getStats(playerId: PlayerId): SpeedHackStats | undefined {
        const history = this.playerHistory.get(playerId);
        if (!history) return undefined;

        return {
            samples: history.length,
            lastSpeed: this.calculateLastSpeed(history),
            averageSpeed: this.calculateAverageSpeed(history),
            maxSpeed: this.calculateMaxSpeed(history),
            warnings: this.playerWarnings.get(playerId) || 0
        };
    }

    private calculateLastSpeed(history: MovementSample[]): number {
        if (history.length < 2) return 0;
        
        const latest = history[history.length - 1];
        const prev = history[history.length - 2];
        const timeDiff = (latest.timestamp - prev.timestamp) / 1000;
        
        if (timeDiff <= 0) return 0;
        
        return latest.position.distanceTo(prev.position) / timeDiff;
    }

    private calculateAverageSpeed(history: MovementSample[]): number {
        if (history.length < 2) return 0;

        let totalSpeed = 0;
        let count = 0;

        for (let i = 1; i < history.length; i++) {
            const timeDiff = (history[i].timestamp - history[i - 1].timestamp) / 1000;
            if (timeDiff > 0) {
                const speed = history[i].position.distanceTo(history[i - 1].position) / timeDiff;
                totalSpeed += speed;
                count++;
            }
        }

        return count > 0 ? totalSpeed / count : 0;
    }

    private calculateMaxSpeed(history: MovementSample[]): number {
        let maxSpeed = 0;

        for (let i = 1; i < history.length; i++) {
            const timeDiff = (history[i].timestamp - history[i - 1].timestamp) / 1000;
            if (timeDiff > 0) {
                const speed = history[i].position.distanceTo(history[i - 1].position) / timeDiff;
                maxSpeed = Math.max(maxSpeed, speed);
            }
        }

        return maxSpeed;
    }
}

/**
 | Statystyki speed hack
 */
export interface SpeedHackStats {
    samples: number;
    lastSpeed: number;
    averageSpeed: number;
    maxSpeed: number;
    warnings: number;
}