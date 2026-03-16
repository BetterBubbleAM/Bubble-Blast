export const PHYSICS = {
    // Ogólne ustawienia świata
    WORLD_SIZE: 14142.1356, // Standardowy rozmiar dla Bubble.am/Agar
    TICK_RATE: 25,          // Ile razy na sekundę serwer przelicza fizykę (40ms)
    
    // Ruch i tarcie (z Entity.js)
    FRICTION: 0.92,         // Opór powietrza/wody dla wyrzucanej masy
    PLAYER_SPEED_MULTIPLIER: 2.2,
    SPEED_POWER: -0.44,     // Wzór: speed = 2.2 * mass^(-0.44)
    
    // Mechanika masy
    MIN_MASS: 10,
    MAX_MASS: 22500,
    MASS_DECAY_RATE: 0.002, // Jak szybko kulka chudnie
    
    // Wielkość kulki na ekranie
    SIZE_MULTIPLIER: 100,
    SIZE_POWER: 0.5         // Math.sqrt(mass * 100 / Math.PI)
};
export const ACTIONS = {
    // Podział (Space)
    SPLIT_VELOCITY: 780,    // Siła wystrzału przy podziale
    SPLIT_MIN_MASS: 35,     // Minimalna masa, by móc się podzielić
    MAX_CELLS: 16,          // Maksymalna liczba kulek jednego gracza
    
    // Wyrzut masy (W)
    EJECT_VELOCITY: 700,
    EJECT_MASS: 16,         // Ile masy traci gracz
    EJECT_SIZE: 12,         // Rozmiar wyrzuconej kulki
    EJECT_COOLDOWN: 50,     // Przerwa między strzałami (ms)
};
export const VIRUS = {
    MIN_MASS: 100,
    EXPLOSION_CELLS: 16,    // Na ile części rozwala gracza
    SAFE_MASS_LIMIT: 130    // Powyżej tej masy wirus "pęka" po zjedzeniu jedzenia
};