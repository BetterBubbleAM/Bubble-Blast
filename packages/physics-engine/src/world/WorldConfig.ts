/**
 * @file WorldConfig.ts
 * @description Konfiguracja świata fizycznego
 */

import { Vector2 } from '@shared-core/math/Vector2';
import { PHYSICS_CONSTANTS } from '@shared-core/constants/GameplayConstants';

/**
 * Typ integracji numerycznej
 */
export enum IntegrationType {
    EULER = 'euler',           // Prosta, szybka, mniej stabilna
    VERLET = 'verlet',         // Bardziej stabilna
    RK4 = 'rk4',               // Runge-Kutta 4, najdokładniejsza
    SEMI_IMPLICIT_EULER = 'semi_implicit' // Kompromis
}

/**
 * Typ solvera kolizji
 */
export enum SolverType {
    SEQUENTIAL_IMPULSE = 'sequential_impulse',  // Standardowy
    PROJECTED_GAUSS_SEIDEL = 'pgs',              // Dla constraintów
    NGS = 'ngs'                                   // Dla prostych kolizji
}

/**
 * Typ broad phase
 */
export enum BroadPhaseType {
    BRUTE_FORCE = 'brute_force',   // O(n²) - tylko dla debug
    SPATIAL_HASH = 'spatial_hash', // O(n) - dla dużej liczby obiektów
    QUAD_TREE = 'quad_tree',       // O(log n) - dla nierównomiernego rozkładu
    BVH = 'bvh'                     // Bounding Volume Hierarchy
}

/**
 * Konfiguracja świata fizycznego
 */
export interface WorldConfig {
    /** Granice świata */
    bounds: {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
        enableWalls: boolean;      // Czy ściany są aktywne
        wallRestitution: number;    // Sprężystość ścian
        wallFriction: number;       // Tarcie ścian
    };

    /** Grawitacja */
    gravity: Vector2;

    /** Skala czasu (1 = normalna) */
    timeScale: number;

    /** Fizyka */
    physics: {
        velocityIterations: number;     // Iteracje prędkości
        positionIterations: number;     // Iteracje pozycji
        baumgarte: number;              // Współczynnik korekcji penetracji
        maxLinearCorrection: number;    // Maksymalna korekcja liniowa
        maxAngularCorrection: number;   // Maksymalna korekcja kątowa
    };

    /** Tłumienie */
    damping: {
        linear: number;     // Tłumienie liniowe (0-1)
        angular: number;    // Tłumienie kątowe (0-1)
    };

    /** Detekcja kolizji */
    collision: {
        broadPhase: BroadPhaseType;
        enableCCD: boolean;             // Continuous Collision Detection
        ccdThreshold: number;            // Próg prędkości dla CCD
        enableSleep: boolean;            // Czy usypiać obiekty
        sleepThreshold: number;          // Próg prędkości do uśpienia
        timeToSleep: number;             // Czas bezruchu do uśpienia
    };

    /** Solver */
    solver: {
        type: SolverType;
        iterations: number;
        enableWarmStarting: boolean;    // Rozgrzewanie solvera
        enableContinuous: boolean;      // Ciągłe rozwiązywanie
    };

    /** Integracja */
    integration: {
        type: IntegrationType;
        fixedTimeStep: number;           // Stały krok czasowy (ms)
        maxSubSteps: number;             // Maksymalna liczba pod-kroków
    };

    /** Optymalizacje */
    optimizations: {
        enablePooling: boolean;          // Pool obiektów
        enableCaching: boolean;          // Cache wyników
        maxBodiesPerCell: number;        // Dla spatial hash
        cellSize: number;                // Rozmiar komórki
    };

    /** Debug */
    debug: {
        enableLogging: boolean;
        drawAABBs: boolean;
        drawContacts: boolean;
        drawBroadPhase: boolean;
        logCollisions: boolean;
    };
}

/**
 * Domyślna konfiguracja
 */
export const DEFAULT_WORLD_CONFIG: WorldConfig = {
    bounds: {
        minX: 0,
        minY: 0,
        maxX: 10000,
        maxY: 10000,
        enableWalls: true,
        wallRestitution: 0.2,
        wallFriction: 0.3
    },
    gravity: new Vector2(0, 0), // Brak grawitacji w Agar.io
    timeScale: 1.0,
    physics: {
        velocityIterations: PHYSICS_CONSTANTS.VELOCITY_ITERATIONS,
        positionIterations: PHYSICS_CONSTANTS.POSITION_ITERATIONS,
        baumgarte: 0.2,
        maxLinearCorrection: 0.2,
        maxAngularCorrection: 0.1
    },
    damping: {
        linear: 0.1,
        angular: 0.1
    },
    collision: {
        broadPhase: BroadPhaseType.SPATIAL_HASH,
        enableCCD: true,
        ccdThreshold: 100,
        enableSleep: true,
        sleepThreshold: 0.01,
        timeToSleep: 0.5
    },
    solver: {
        type: SolverType.SEQUENTIAL_IMPULSE,
        iterations: 10,
        enableWarmStarting: true,
        enableContinuous: false
    },
    integration: {
        type: IntegrationType.SEMI_IMPLICIT_EULER,
        fixedTimeStep: 1000 / 60, // 60 FPS
        maxSubSteps: 10
    },
    optimizations: {
        enablePooling: true,
        enableCaching: true,
        maxBodiesPerCell: 10,
        cellSize: PHYSICS_CONSTANTS.SPATIAL_HASH_CELL_SIZE
    },
    debug: {
        enableLogging: false,
        drawAABBs: false,
        drawContacts: false,
        drawBroadPhase: false,
        logCollisions: false
    }
};

/**
 * Konfiguracja dla różnych trybów
 */
export const WORLD_CONFIGS = {
    // Dla gry Agar.io
    AGAR: {
        ...DEFAULT_WORLD_CONFIG,
        bounds: {
            minX: 0,
            minY: 0,
            maxX: 10000,
            maxY: 10000,
            enableWalls: true,
            wallRestitution: 0.1,
            wallFriction: 0.5
        },
        damping: {
            linear: 0.15,
            angular: 0.1
        }
    },
    
    // Dla testów wydajności
    PERFORMANCE: {
        ...DEFAULT_WORLD_CONFIG,
        collision: {
            ...DEFAULT_WORLD_CONFIG.collision,
            enableCCD: false,
            enableSleep: true
        },
        solver: {
            ...DEFAULT_WORLD_CONFIG.solver,
            iterations: 5,
            enableWarmStarting: false
        }
    },
    
    // Dla debugowania
    DEBUG: {
        ...DEFAULT_WORLD_CONFIG,
        debug: {
            enableLogging: true,
            drawAABBs: true,
            drawContacts: true,
            drawBroadPhase: true,
            logCollisions: true
        }
    },
    
    // Dla fizyki precyzyjnej
    PRECISE: {
        ...DEFAULT_WORLD_CONFIG,
        integration: {
            type: IntegrationType.RK4,
            fixedTimeStep: 1000 / 120, // 120 FPS
            maxSubSteps: 20
        },
        solver: {
            ...DEFAULT_WORLD_CONFIG.solver,
            iterations: 20,
            enableContinuous: true
        }
    }
} as const;