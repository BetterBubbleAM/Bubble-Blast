export class TickLoop {
    private lastTick: number = 0;
    private tickRate: number;
    private timer: NodeJS.Timeout | null = null;

    constructor(tickRate: number, private onTick: (dt: number) => void) {
        this.tickRate = 1000 / tickRate;
    }

    public start() {
        this.lastTick = Date.now();
        this.timer = setInterval(() => {
            const now = Date.now();
            const dt = (now - this.lastTick) / 1000;
            this.lastTick = now;
            this.onTick(dt);
        }, this.tickRate);
    }

    public stop() {
        if (this.timer) clearInterval(this.timer);
    }
}