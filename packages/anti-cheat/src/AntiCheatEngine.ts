/**
 * @file AntiCheatEngine.ts
 * @description Główny silnik anty-cheat - wykrywanie i zapobieganie oszustwom
 */

import { SpeedHackDetector } from './SpeedHackDetector';
import { PacketValidator } from './PacketValidator';
import { InputSanitizer } from './InputSanitizer';
import { Logger, LogCategory } from '@shared-core/utils/Logger';
import { EventEmitter } from '@shared-core/events/EventEmitter';
import { PlayerId } from '@shared-core/types/EntityTypes';

/**
 | Poziom podejrzenia oszustwa
 */
export enum SuspicionLevel {
    NONE = 0,           // Brak podejrzeń
    LOW = 1,            // Niskie podejrzenie
    MEDIUM = 2,         // Średnie podejrzenie
    HIGH = 3,           // Wysokie podejrzenie
    CRITICAL = 4        // Krytyczne - pewne oszustwo
}

/**
 | Typ wykrytego oszustwa
 */
export enum CheatType {
    SPEED_HACK = 'speed_hack',
    AIMBOT = 'aimbot',
    WALLHACK = 'wallhack',
    AUTO_SPLIT = 'auto_split',
    PACKET_EDIT = 'packet_edit',
    MEMORY_EDIT = 'memory_edit',
    BOT = 'bot',
    TEAMING = 'teaming',        // W trybie FFA
    RAPID_FIRE = 'rapid_fire',   // Zbyt szybkie akcje
    IMPOSSIBLE_MOVEMENT = 'impossible_movement'
}

/**
 | Zdarzenie wykrycia oszustwa
 */
export interface CheatDetection {
    playerId: PlayerId;
    cheatType: CheatType;
    suspicionLevel: SuspicionLevel;
    confidence: number;          // 0-1
    evidence: any;
    timestamp: number;
}

/**
 | Akcja podjęta wobec oszusta
 */
export enum AntiCheatAction {
    LOG_ONLY = 'log_only',           // Tylko loguj
    WARN = 'warn',                    // Ostrzeżenie
    KICK = 'kick',                     // Wyrzucenie
    BAN = 'ban',                       // Ban
    FLAG = 'flag',                     // Oznacz do weryfikacji
    SLOW_DOWN = 'slow_down'            // Spowolnienie (dla speed hack)
}

/**
 | Wynik weryfikacji
 */
export interface VerificationResult {
    passed: boolean;
    confidence: number;
    details: string[];
}

/**
 | Opcje silnika anty-cheat
 */
export interface AntiCheatOptions {
    enableSpeedHackDetection: boolean;
    enablePacketValidation: boolean;
    enableInputSanitization: boolean;
    enableAimbotDetection: boolean;
    enableTeamingDetection: boolean;
    
    suspicionThresholds: {
        [SuspicionLevel.LOW]: number;      // Próg dla niskiego podejrzenia
        [SuspicionLevel.MEDIUM]: number;    // Próg dla średniego
        [SuspicionLevel.HIGH]: number;      // Próg dla wysokiego
        [SuspicionLevel.CRITICAL]: number;  // Próg dla krytycznego
    };
    
    actions: {
        [CheatType.SPEED_HACK]: AntiCheatAction;
        [CheatType.AIMBOT]: AntiCheatAction;
        [CheatType.WALLHACK]: AntiCheatAction;
        [CheatType.AUTO_SPLIT]: AntiCheatAction;
        [CheatType.PACKET_EDIT]: AntiCheatAction;
        [CheatType.MEMORY_EDIT]: AntiCheatAction;
        [CheatType.BOT]: AntiCheatAction;
        [CheatType.TEAMING]: AntiCheatAction;
        [CheatType.RAPID_FIRE]: AntiCheatAction;
        [CheatType.IMPOSSIBLE_MOVEMENT]: AntiCheatAction;
    };
    
    autoBanThreshold: number;              // Próg automatycznego bana
    maxWarnings: number;                    // Maksymalna liczba ostrzeżeń
    evidenceRetentionDays: number;          // Dni przechowywania dowodów
}

/**
 | Główny silnik anty-cheat
 */
export class AntiCheatEngine extends EventEmitter {
    private options: AntiCheatOptions;
    private logger: Logger;
    
    // Detektory
    private speedHackDetector: SpeedHackDetector;
    private packetValidator: PacketValidator;
    private inputSanitizer: InputSanitizer;
    
    // Stan graczy
    private playerScores: Map<PlayerId, PlayerScore> = new Map();
    private playerWarnings: Map<PlayerId, number> = new Map();
    private playerDetections: Map<PlayerId, CheatDetection[]> = new Map();
    private playerActions: Map<PlayerId, AntiCheatAction[]> = new Map();
    
    // Dowody
    private evidence: CheatDetection[] = [];

    constructor(options?: Partial<AntiCheatOptions>) {
        super();
        
        this.options = {
            enableSpeedHackDetection: true,
            enablePacketValidation: true,
            enableInputSanitization: true,
            enableAimbotDetection: true,
            enableTeamingDetection: true,
            
            suspicionThresholds: {
                [SuspicionLevel.LOW]: 0.3,
                [SuspicionLevel.MEDIUM]: 0.5,
                [SuspicionLevel.HIGH]: 0.7,
                [SuspicionLevel.CRITICAL]: 0.9
            },
            
            actions: {
                [CheatType.SPEED_HACK]: AntiCheatAction.SLOW_DOWN,
                [CheatType.AIMBOT]: AntiCheatAction.KICK,
                [CheatType.WALLHACK]: AntiCheatAction.KICK,
                [CheatType.AUTO_SPLIT]: AntiCheatAction.WARN,
                [CheatType.PACKET_EDIT]: AntiCheatAction.KICK,
                [CheatType.MEMORY_EDIT]: AntiCheatAction.BAN,
                [CheatType.BOT]: AntiCheatAction.KICK,
                [CheatType.TEAMING]: AntiCheatAction.WARN,
                [CheatType.RAPID_FIRE]: AntiCheatAction.SLOW_DOWN,
                [CheatType.IMPOSSIBLE_MOVEMENT]: AntiCheatAction.KICK
            },
            
            autoBanThreshold: 0.95,
            maxWarnings: 3,
            evidenceRetentionDays: 30,
            
            ...options
        };
        
        this.logger = Logger.getInstance();
        
        // Inicjalizuj detektory
        this.speedHackDetector = new SpeedHackDetector();
        this.packetValidator = new PacketValidator();
        this.inputSanitizer = new InputSanitizer();
    }

    /**
     | Rejestruje gracza
     */
    registerPlayer(playerId: PlayerId): void {
        this.playerScores.set(playerId, {
            totalSuspicion: 0,
            detections: [],
            lastUpdate: Date.now()
        });
        
        this.playerWarnings.set(playerId, 0);
        this.playerDetections.set(playerId, []);
        this.playerActions.set(playerId, []);
        
        this.logger.debug(LogCategory.SECURITY, `Player registered: ${playerId}`);
    }

    /**
     | Wyrejestrowuje gracza
     */
    unregisterPlayer(playerId: PlayerId): void {
        this.playerScores.delete(playerId);
        this.playerWarnings.delete(playerId);
        this.playerDetections.delete(playerId);
        this.playerActions.delete(playerId);
    }

    /**
     | Weryfikuje gracza
     */
    verifyPlayer(playerId: PlayerId, data: any): VerificationResult {
        const details: string[] = [];
        let totalConfidence = 0;
        let checksPassed = 0;
        let totalChecks = 0;

        // Sprawdź speed hack
        if (this.options.enableSpeedHackDetection) {
            totalChecks++;
            const speedResult = this.speedHackDetector.verify(playerId, data);
            if (speedResult.passed) {
                checksPassed++;
            } else {
                details.push(`Speed hack: ${speedResult.confidence}`);
            }
            totalConfidence += speedResult.confidence;
        }

        // Sprawdź pakiety
        if (this.options.enablePacketValidation) {
            totalChecks++;
            const packetResult = this.packetValidator.verify(playerId, data);
            if (packetResult.passed) {
                checksPassed++;
            } else {
                details.push(`Packet manipulation: ${packetResult.confidence}`);
            }
            totalConfidence += packetResult.confidence;
        }

        // Sprawdź input
        if (this.options.enableInputSanitization) {
            totalChecks++;
            const inputResult = this.inputSanitizer.verify(playerId, data);
            if (inputResult.passed) {
                checksPassed++;
            } else {
                details.push(`Input anomaly: ${inputResult.confidence}`);
            }
            totalConfidence += inputResult.confidence;
        }

        const passed = checksPassed === totalChecks;
        const confidence = totalChecks > 0 ? totalConfidence / totalChecks : 0;

        // Aktualizuj wynik gracza
        this.updatePlayerScore(playerId, confidence, details);

        return {
            passed,
            confidence,
            details
        };
    }

    /**
     | Aktualizuje wynik podejrzenia gracza
     */
    private updatePlayerScore(playerId: PlayerId, confidence: number, details: string[]): void {
        const score = this.playerScores.get(playerId);
        if (!score) return;

        // Aktualizuj całkowity wynik (wygładzona średnia)
        score.totalSuspicion = score.totalSuspicion * 0.7 + confidence * 0.3;
        score.lastUpdate = Date.now();

        // Sprawdź czy przekroczono próg
        const suspicionLevel = this.getSuspicionLevel(score.totalSuspicion);
        
        if (suspicionLevel > SuspicionLevel.NONE) {
            this.handleSuspicion(playerId, suspicionLevel, score.totalSuspicion, details);
        }
    }

    /**
     | Obsługuje podejrzenie
     */
    private handleSuspicion(playerId: PlayerId, level: SuspicionLevel, confidence: number, details: string[]): void {
        // Utwórz detection
        const detection: CheatDetection = {
            playerId,
            cheatType: CheatType.SPEED_HACK, // TODO: określić typ
            suspicionLevel: level,
            confidence,
            evidence: { details, timestamp: Date.now() },
            timestamp: Date.now()
        };

        // Zapisz dowód
        this.evidence.push(detection);
        this.playerDetections.get(playerId)?.push(detection);

        // Emituj zdarzenie
        this.emit('cheat_detected', detection);

        // Podejmij akcję
        const action = this.determineAction(detection);
        this.takeAction(playerId, action, detection);

        this.logger.warn(LogCategory.SECURITY, 
            `Cheat detected - Player: ${playerId}, Level: ${level}, Confidence: ${confidence}`);
    }

    /**
     | Określa poziom podejrzenia
     */
    private getSuspicionLevel(confidence: number): SuspicionLevel {
        if (confidence >= this.options.suspicionThresholds[SuspicionLevel.CRITICAL]) {
            return SuspicionLevel.CRITICAL;
        }
        if (confidence >= this.options.suspicionThresholds[SuspicionLevel.HIGH]) {
            return SuspicionLevel.HIGH;
        }
        if (confidence >= this.options.suspicionThresholds[SuspicionLevel.MEDIUM]) {
            return SuspicionLevel.MEDIUM;
        }
        if (confidence >= this.options.suspicionThresholds[SuspicionLevel.LOW]) {
            return SuspicionLevel.LOW;
        }
        return SuspicionLevel.NONE;
    }

    /**
     | Określa akcję do podjęcia
     */
    private determineAction(detection: CheatDetection): AntiCheatAction {
        // Jeśli pewność bardzo wysoka, ban
        if (detection.confidence >= this.options.autoBanThreshold) {
            return AntiCheatAction.BAN;
        }

        // Sprawdź liczbę ostrzeżeń
        const warnings = this.playerWarnings.get(detection.playerId) || 0;
        if (warnings >= this.options.maxWarnings) {
            return AntiCheatAction.KICK;
        }

        // Domyślna akcja dla typu oszustwa
        return this.options.actions[detection.cheatType];
    }

    /**
     | Podejmuje akcję
     */
    private takeAction(playerId: PlayerId, action: AntiCheatAction, detection: CheatDetection): void {
        // Zapisz akcję
        this.playerActions.get(playerId)?.push(action);

        switch (action) {
            case AntiCheatAction.LOG_ONLY:
                // Tylko logowanie
                break;
                
            case AntiCheatAction.WARN:
                const warnings = this.playerWarnings.get(playerId) || 0;
                this.playerWarnings.set(playerId, warnings + 1);
                this.emit('player_warned', { playerId, detection, warningCount: warnings + 1 });
                break;
                
            case AntiCheatAction.SLOW_DOWN:
                this.emit('player_slowed', { playerId, detection });
                break;
                
            case AntiCheatAction.KICK:
                this.emit('player_kicked', { playerId, detection });
                break;
                
            case AntiCheatAction.BAN:
                this.emit('player_banned', { playerId, detection });
                break;
                
            case AntiCheatAction.FLAG:
                this.emit('player_flagged', { playerId, detection });
                break;
        }

        this.logger.info(LogCategory.SECURITY, 
            `Action taken - Player: ${playerId}, Action: ${action}, Cheat: ${detection.cheatType}`);
    }

    /**
     | Pobiera statystyki dla gracza
     */
    getPlayerStats(playerId: PlayerId): PlayerStats | undefined {
        const score = this.playerScores.get(playerId);
        if (!score) return undefined;

        const detections = this.playerDetections.get(playerId) || [];
        const actions = this.playerActions.get(playerId) || [];
        const warnings = this.playerWarnings.get(playerId) || 0;

        return {
            suspicionLevel: this.getSuspicionLevel(score.totalSuspicion),
            confidence: score.totalSuspicion,
            detectionCount: detections.length,
            warnings,
            actionsTaken: actions,
            lastDetection: detections[detections.length - 1]
        };
    }

    /**
     | Pobiera wszystkie dowody
     */
    getEvidence(cheatType?: CheatType): CheatDetection[] {
        if (cheatType) {
            return this.evidence.filter(e => e.cheatType === cheatType);
        }
        return [...this.evidence];
    }

    /**
     | Czyści stare dowody
     */
    cleanOldEvidence(): void {
        const cutoff = Date.now() - (this.options.evidenceRetentionDays * 24 * 60 * 60 * 1000);
        this.evidence = this.evidence.filter(e => e.timestamp > cutoff);
    }

    /**
     | Resetuje stan gracza
     */
    resetPlayer(playerId: PlayerId): void {
        this.playerScores.delete(playerId);
        this.playerWarnings.delete(playerId);
        this.playerDetections.delete(playerId);
        this.playerActions.delete(playerId);
        
        this.logger.debug(LogCategory.SECURITY, `Player reset: ${playerId}`);
    }

    /**
     | Resetuje wszystko
     */
    reset(): void {
        this.playerScores.clear();
        this.playerWarnings.clear();
        this.playerDetections.clear();
        this.playerActions.clear();
        this.evidence = [];
        
        this.logger.info(LogCategory.SECURITY, 'Anti-cheat engine reset');
    }
}

/**
 | Wynik gracza
 */
interface PlayerScore {
    totalSuspicion: number;
    detections: CheatDetection[];
    lastUpdate: number;
}

/**
 | Statystyki gracza
 */
export interface PlayerStats {
    suspicionLevel: SuspicionLevel;
    confidence: number;
    detectionCount: number;
    warnings: number;
    actionsTaken: AntiCheatAction[];
    lastDetection?: CheatDetection;
}