/**
 * Top loading bar utility (NProgress-style)
 */
export class LoadingBar {
    constructor() {
        this.element = null;
        this.progress = 0;
        this.interval = null;
    }

    init() {
        if (this.element) return;

        this.element = document.createElement('div');
        this.element.id = 'loading-bar';
        this.element.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 0%;
            height: 3px;
            background: var(--clr-accent-primary, #4ecdb4);
            z-index: 99999;
            transition: width 0.2s ease, opacity 0.4s ease;
            box-shadow: 0 0 10px var(--clr-accent-primary, #4ecdb4);
            pointer-events: none;
        `;
        document.body.appendChild(this.element);
    }

    start() {
        this.init();
        this.progress = 0;
        this.element.style.width = '0%';
        this.element.style.opacity = '1';
        this.element.style.display = 'block';

        // Fake progress
        clearInterval(this.interval);
        this.interval = setInterval(() => {
            if (this.progress < 90) {
                // Slow down as it gets higher
                const increment = Math.max(0.5, (90 - this.progress) / 20);
                this.progress += increment * Math.random();
                this.element.style.width = `${this.progress}%`;
            }
        }, 200);
    }

    set(percent) {
        this.init();
        this.progress = percent;
        this.element.style.width = `${percent}%`;
    }

    finish() {
        if (!this.element) return;
        clearInterval(this.interval);
        this.progress = 100;
        this.element.style.width = '100%';

        setTimeout(() => {
            this.element.style.opacity = '0';
            setTimeout(() => {
                if (this.element) {
                    this.element.style.width = '0%';
                    this.progress = 0;
                }
            }, 400);
        }, 500);
    }
}

export const loadingBar = new LoadingBar();
