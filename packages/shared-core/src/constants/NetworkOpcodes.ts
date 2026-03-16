export const CLIENT_OP = {
    SPAWN: 0,          // Prośba o wejście do gry (podanie nicku/skina)
    MOUSE_MOVE: 16,    // Przesłanie pozycji myszki (X, Y)
    SPLIT: 17,         // Spacja (Podział)
    EJECT: 21,         // W (Wyrzut masy)
    Q_STOP: 19,        // Twoje słynne Q-Stop z analizy main_out.js
    CHAT: 99,          // Wiadomość na czacie
    PING: 254          // Prośba o sprawdzenie opóźnienia
};
export const SERVER_OP = {
    UPDATE_NODES: 16,      // Najważniejszy: Aktualizacja wszystkich kulek na ekranie
    UPDATE_VIEWPORT: 17,   // Zmiana skali/pozycji kamery
    RESET_ALL: 18,         // Czyszczenie ekranu (np. po śmierci)
    OWN_ENTITY: 32,        // Informacja, która kulka należy do gracza
    LEADERBOARD: 49,       // Aktualizacja rankingu
    CHAT_MESSAGE: 99,      // Nowa wiadomość na czacie od kogoś
    MAP_RESIZE: 64,        // Informacja o zmianie granic mapy
    PONG: 255              // Odpowiedź na ping
};
export enum EntityType {
    PLAYER = 0,
    FOOD = 1,
    VIRUS = 2,
    EJECTED_MASS = 3,
    MOTHER_CELL = 4
}