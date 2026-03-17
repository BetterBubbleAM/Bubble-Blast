/**
 * @file PacketValidator.ts
 * @description Walidacja pakietów - wykrywanie manipulacji
 */

import { PlayerId } from '@shared-core/types/EntityTypes';
import { ClientPacketData, ClientPacketType } from '@network-protocol/schemas/ClientPackets';
import { createHash } from 'crypto';

/**
 | Wynik walidacji
 */
export interface ValidationResult {
    passed: boolean;
    confidence: number;
    reason?: string;
}

/**
 | Statystyki pakietów
 */
interface PacketStats {
    count: number;
    lastTimestamp: number;
    lastSequence: number;
    anomalies: number;
    averageInterval: number;
}

/**
 | Walidator pakietów
 */
export class PacketValidator {
    private playerStats: Map<PlayerId, Map<ClientPacketType, PacketStats>> = new Map();
    private playerSessions: Map<PlayerId, string> = new Map(); // Klucz sesji
    
    private maxPacketRate: number = 60;          // Maksymalna liczba pakietów na sekundę
    private maxInputRate: number = 30;            // Maksymalna liczba inputów na sekundę
    private maxSequenceGap: number = 10;          // Maksymalny skok sekwencji
    private timeWindow: number = 1000;            // Okno czasowe (1 sekunda)

    /**
     | Rozpoczyna sesję dla gracza
     */
    startSession(playerId: PlayerId): string {
        const sessionKey = this.generateSessionKey(playerId);
        this.playerSessions.set(playerId, sessionKey);
        this.playerStats.set(playerId, new Map());
        return sessionKey;
    }

    /**
     | Waliduje pakiet
     */
    validate(playerId: PlayerId, packet: ClientPacketData): ValidationResult {
        // Sprawdź klucz sesji (jeśli wymagany)
        if (!this.playerSessions.has(playerId)) {
            return {
                passed: false,
                confidence: 1.0,
                reason: 'No active session'
            };
        }

        // Pobierz statystyki dla tego typu pakietu
        const stats = this.getStats(playerId, packet.type);
        
        // Sprawdź timestamp
        const timeResult = this.validateTimestamp(playerId, packet, stats);
        if (!timeResult.passed) {
            return timeResult;
        }

        // Sprawdź sekwencję
        const seqResult = this.validateSequence(playerId, packet, stats);
        if (!seqResult.passed) {
            return seqResult;
        }

        // Sprawdź rate limiting
        const rateResult = this.validateRate(playerId, packet, stats);
        if (!rateResult.passed) {
            return rateResult;
        }

        // Sprawdź specyficzne dla typu
        const typeResult = this.validateByType(playerId, packet);
        if (!typeResult.passed) {
            return typeResult;
        }

        // Aktualizuj statystyki
        this.updateStats(playerId, packet, stats);

        return { passed: true, confidence: 0 };
    }

    /**
     | Sprawdza timestamp
     */
    private validateTimestamp(playerId: PlayerId, packet: ClientPacketData, stats: PacketStats): ValidationResult {
        const now = Date.now();
        
        // Sprawdź czy timestamp z przyszłości
        if (packet.timestamp > now + 1000) {
            return {
                passed: false,
                confidence: 1.0,
                reason: 'Packet from future'
            };
        }

        // Sprawdź czy timestamp zbyt stary
        if (packet.timestamp < now - 5000) {
            return {
                passed: false,
                confidence: 0.8,
                reason: 'Packet too old'
            };
        }

        // Sprawdź interwał (dla kolejnych pakietów tego samego typu)
        if (stats.lastTimestamp > 0) {
            const interval = packet.timestamp - stats.lastTimestamp;
            
            // Zbyt krótki interwał
            if (interval < 0) {
                return {
                    passed: false,
                    confidence: 0.9,
                    reason: 'Invalid timestamp order'
                };
            }

            // Zbyt długi interwał (może wskazywać na pauzę)
            if (interval > 10000) {
                return {
                    passed: false,
                    confidence: 0.3,
                    reason: 'Unusually long gap'
                };
            }
        }

        return { passed: true, confidence: 0 };
    }

    /**
     | Sprawdza sekwencję
     */
    private validateSequence(playerId: PlayerId, packet: ClientPacketData, stats: PacketStats): ValidationResult {
        if (stats.lastSequence > 0) {
            const gap = packet.sequence - stats.lastSequence;
            
            // Duplikat
            if (gap === 0) {
                return {
                    passed: false,
                    confidence: 0.7,
                    reason: 'Duplicate sequence'
                };
            }

            // Zbyt duży skok (utracone pakiety lub manipulacja)
            if (gap > this.maxSequenceGap) {
                return {
                    passed: false,
                    confidence: 0.5,
                    reason: `Sequence jump too large: ${gap}`
                };
            }

            // Sekwencja wstecz (chyba że to reset)
            if (gap < 0 && Math.abs(gap) < 1000) {
                return {
                    passed: false,
                    confidence: 0.9,
                    reason: 'Sequence went backwards'
                };
            }
        }

        return { passed: true, confidence: 0 };
    }

    /**
     | Sprawdza rate limiting
     */
    private validateRate(playerId: PlayerId, packet: ClientPacketData, stats: PacketStats): ValidationResult {
        const now = Date.now();
        const timeWindow = 1000; // 1 sekunda
        
        // Oblicz aktualną częstość
        stats.count++;
        
        if (stats.lastTimestamp > 0) {
            const timeSinceLast = packet.timestamp - stats.lastTimestamp;
            
            // Dla inputów - bardziej restrykcyjne
            if (packet.type === ClientPacketType.INPUT_STATE) {
                if (timeSinceLast < 1000 / this.maxInputRate) {
                    return {
                        passed: false,
                        confidence: 0.8,
                        reason: 'Input rate too high'
                    };
                }
            } else {
                // Dla innych pakietów
                if (timeSinceLast < 1000 / this.maxPacketRate) {
                    return {
                        passed: false,
                        confidence: 0.6,
                        reason: 'Packet rate too high'
                    };
                }
            }
        }

        return { passed: true, confidence: 0 };
    }

    /**
     | Sprawdza specyficzne dla typu
     */
    private validateByType(playerId: PlayerId, packet: ClientPacketData): ValidationResult {
        switch (packet.type) {
            case ClientPacketType.SPLIT:
                return this.validateSplit(playerId, packet);
                
            case ClientPacketType.MERGE:
                return this.validateMerge(playerId, packet);
                
            case ClientPacketType.CHAT_MESSAGE:
                return this.validateChat(playerId, packet);
                
            default:
                return { passed: true, confidence: 0 };
        }
    }

    /**
     | Waliduje split
     */
    private validateSplit(playerId: PlayerId, packet: any): ValidationResult {
        // Sprawdź czy kierunek jest znormalizowany
        const dir = packet.direction;
        const length = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
        
        if (length < 0.1 || length > 1.1) {
            return {
                passed: false,
                confidence: 0.7,
                reason: 'Invalid split direction'
            };
        }

        return { passed: true, confidence: 0 };
    }

    /**
     | Waliduje merge
     */
    private validateMerge(playerId: PlayerId, packet: any): ValidationResult {
        // Sprawdź czy komórki są różne
        if (packet.sourceCellId === packet.targetCellId) {
            return {
                passed: false,
                confidence: 1.0,
                reason: 'Cannot merge same cell'
            };
        }

        return { passed: true, confidence: 0 };
    }

    /**
     | Waliduje chat
     */
    private validateChat(playerId: PlayerId, packet: any): ValidationResult {
        // Sprawdź długość wiadomości
        if (packet.message.length > 200) {
            return {
                passed: false,
                confidence: 0.8,
                reason: 'Message too long'
            };
        }

        // Sprawdź czy nie ma niedozwolonych znaków
        if (/[^\w\s\.,!?\-ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/i.test(packet.message)) {
            return {
                passed: false,
                confidence: 0.6,
                reason: 'Invalid characters'
            };
        }

        return { passed: true, confidence: 0 };
    }

    /**
     | Pobiera statystyki dla gracza i typu
     */
    private getStats(playerId: PlayerId, type: ClientPacketType): PacketStats {
        const playerMap = this.playerStats.get(playerId)!;
        
        if (!playerMap.has(type)) {
            playerMap.set(type, {
                count: 0,
                lastTimestamp: 0,
                lastSequence: 0,
                anomalies: 0,
                averageInterval: 0
            });
        }

        return playerMap.get(type)!;
    }

    /**
     | Aktualizuje statystyki
     */
    private updateStats(playerId: PlayerId, packet: ClientPacketData, stats: PacketStats): void {
        const now = Date.now();

        if (stats.lastTimestamp > 0) {
            const interval = packet.timestamp - stats.lastTimestamp;
            
            // Aktualizuj średnią ruchomą
            stats.averageInterval = stats.averageInterval * 0.9 + interval * 0.1;
        }

        stats.lastTimestamp = packet.timestamp;
        stats.lastSequence = packet.sequence;
        stats.count++;

        // Okresowo resetuj licznik
        if (now - packet.timestamp > this.timeWindow) {
            stats.count = 1;
        }
    }

    /**
     | Generuje klucz sesji
     */
    private generateSessionKey(playerId: PlayerId): string {
        const data = `${playerId}-${Date.now()}-${Math.random()}`;
        return createHash('sha256').update(data).digest('hex').substr(0, 32);
    }

    /**
     | Resetuje stan gracza
     */
    resetPlayer(playerId: PlayerId): void {
        this.playerStats.delete(playerId);
        this.playerSessions.delete(playerId);
    }

    /**
     | Pobiera statystyki
     */
    getStats(playerId: PlayerId): PacketValidatorStats | undefined {
        const stats = this.playerStats.get(playerId);
        if (!stats) return undefined;

        let totalPackets = 0;
        let anomalies = 0;

        for (const s of stats.values()) {
            totalPackets += s.count;
            anomalies += s.anomalies;
        }

        return {
            totalPackets,
            anomalies,
            anomalyRate: totalPackets > 0 ? anomalies / totalPackets : 0
        };
    }
}

/**
 | Statystyki walidatora
 */
export interface PacketValidatorStats {
    totalPackets: number;
    anomalies: number;
    anomalyRate: number;
}