export const CONFIG = {
    RENDER: { FOV: 60, NEAR_CLIP: 0.01, FAR_CLIP: 1000 },
    PHYSICS: {
        ROTATION_SPEED: 0.9, 
        LERP_FACTOR: 0.4, 
        SNAP_DISTANCE: 0.8,
        GRAB_RADIUS: 1,
        BOB_SPEED: 1.5, 
        BOB_HEIGHT: 0.05, 
        REARRANGE_SPEED: 0.08,
        DISPENSER_COOLDOWN: 5000,
        ROTATION_SNAP_DEG: 15,
        MAGNET_RADIUS: 0.3 
    },
    INPUT: {
        CURSOR_SENSITIVITY: 1.45,
        FILTER_FREQUENCY: 60,
        FILTER_MIN_CUTOFF: 1.0,
        FILTER_BETA: 0.007,
        FILTER_DERIVATIVE_CUTOFF: 1.0,
        PINCH_THRESHOLD: 0.05 // ПОРІГ ДЛЯ МАТЕМАТИЧНОГО ЗАХОПЛЕННЯ
    },
    THEME: {
        PRIMARY: 0x00ffcc,
        CHASSIS_COLOR: 0x333333,
        GHOST_VALID: 0x00ff00,     
        GHOST_HIGHLIGHT: 0xff0000,
        CURSOR_OPEN: 0xff0000, 
        CURSOR_CLOSED: 0x00aaff,
        CURSOR_ROTATE: 0xffff00,
        CURSOR_SCALE: 0xe600ff,
        DISPENSER_BASE: 0x004466,
        DISPENSER_COOLDOWN_COLOR: 0x330000 
    }
};

export const TEXTURE_URLS = {
    TOP: 'photo/top.jpg',
    SIDE_LONG: 'photo/side_long.jpg',
    SIDE_SHORT: 'photo/side_short.jpg',
};

// --- AUDIO ---
export class AudioEngine {
    constructor() { this.context = null; this.masterGain = null; this.isInitialized = false; }
    init() {
        if (this.isInitialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.context = new AudioContext();
            this.masterGain = this.context.createGain();
            this.masterGain.gain.value = 0.4;
            this.masterGain.connect(this.context.destination);
            this.isInitialized = true;
        } catch (e) { console.error("Audio Init Failed"); }
    }
    playTone(type, frequency, duration, volume = 1.0, ramp = true) {
        if (!this.isInitialized) return;
        if (this.context.state === 'suspended') this.context.resume();
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        osc.type = type; osc.frequency.setValueAtTime(frequency, this.context.currentTime);
        gain.gain.setValueAtTime(volume, this.context.currentTime);
        if (ramp) gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + duration);
        osc.connect(gain); gain.connect(this.masterGain);
        osc.start(); osc.stop(this.context.currentTime + duration);
    }
    sfxHover() { this.playTone('triangle', 800, 0.05, 0.1); }
    sfxGrab() { this.playTone('sine', 200, 0.15, 0.3); this.playTone('square', 100, 0.1, 0.1); }
    sfxSnap() { this.playTone('square', 800, 0.1, 0.2); setTimeout(() => this.playTone('sine', 60, 0.3, 0.5), 50); }
    sfxDispense() { this.playTone('sawtooth', 400, 0.1, 0.2); this.playTone('sine', 800, 0.2, 0.2); }
    sfxError() { this.playTone('sawtooth', 150, 0.3, 0.3); }
    // ORIGINAL FREQUENCIES FROM INDEX 29
    sfxVictory() { [523.25, 659.25, 783.99, 1046.50].forEach((n, i) => setTimeout(() => this.playTone('square', n, 0.4, 0.3), i * 150)); }
}

// --- LIGHT CHECK ---
export class SimpleBrightnessCheck {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = 160;
        this.canvas.height = 120;
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.interval = 1500;
        this.lastCheck = 0;
        this.lastLevel = null;
    }

    update(video) {
        const now = performance.now();
        if (now - this.lastCheck < this.interval) return null;
        this.lastCheck = now;

        this.ctx.drawImage(video, 0, 0, 160, 120);
        const data = this.ctx.getImageData(0, 0, 160, 120).data;

        let sum = 0;
        for (let i = 0; i < data.length; i += 16) {
            sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
        }

        const avg = sum / (data.length / 16);
        let level;
        if (avg < 60) level = 'red';
        else if (avg < 110) level = 'yellow';
        else level = 'green';

        if (level === this.lastLevel) return null;
        this.lastLevel = level;
        return level;
    }
}

// --- FILTERS (OneEuro) ---
class LowPassFilter {
    constructor(alpha) { this.setAlpha(alpha); this.y = null; this.s = null; }
    setAlpha(alpha) { this.alpha = alpha; }
    filter(value) {
        if (this.y === null) this.s = value;
        else this.s = this.alpha * value + (1.0 - this.alpha) * this.s;
        this.y = this.s; return this.y;
    }
    lastValue() { return this.y; }
}

class OneEuroFilter {
    constructor(freq, mincutoff = 1.0, beta = 0.0, dcutoff = 1.0) {
        this.freq = freq; this.mincutoff = mincutoff; this.beta = beta; this.dcutoff = dcutoff;
        this.x = new LowPassFilter(this.alpha(mincutoff));
        this.dx = new LowPassFilter(this.alpha(dcutoff));
        this.lastTime = null;
    }
    alpha(cutoff) { return 1.0 / (1.0 + (1.0/this.freq) * 2 * Math.PI * cutoff); }
    filter(value, timestamp) {
        if (this.lastTime && timestamp) this.freq = 1.0 / (timestamp - this.lastTime);
        this.lastTime = timestamp;
        const prevX = this.x.lastValue();
        const dx = (prevX === null) ? 0 : (value - prevX) * this.freq;
        const edx = this.dx.filter(dx);
        const cutoff = this.mincutoff + this.beta * Math.abs(edx);
        return this.x.filter(value, this.alpha(cutoff));
    }
}

export class Vector3Filter {
    constructor() {
        const f = CONFIG.INPUT;
        this.xFilter = new OneEuroFilter(f.FILTER_FREQUENCY, f.FILTER_MIN_CUTOFF, f.FILTER_BETA, f.FILTER_DERIVATIVE_CUTOFF);
        this.yFilter = new OneEuroFilter(f.FILTER_FREQUENCY, f.FILTER_MIN_CUTOFF, f.FILTER_BETA, f.FILTER_DERIVATIVE_CUTOFF);
        this.zFilter = new OneEuroFilter(f.FILTER_FREQUENCY, f.FILTER_MIN_CUTOFF, f.FILTER_BETA, f.FILTER_DERIVATIVE_CUTOFF);
    }
    process(vector, timestamp) {
        return new THREE.Vector3(
            this.xFilter.filter(vector.x, timestamp),
            this.yFilter.filter(vector.y, timestamp),
            this.zFilter.filter(vector.z, timestamp)
        );
    }
}
