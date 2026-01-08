import { CONFIG, AudioEngine, SimpleBrightnessCheck } from './config.js';
import { SceneGraph } from './models.js';
import { GameLogic } from './logic.js';
import { GestureClassifier } from './ai.js';
import { InputSystem } from './input.js';

const Audio = new AudioEngine();

function updateCounterColor(level) {
    const el = document.getElementById('part-counter');
    if (!el) return;
    el.classList.remove('green', 'yellow', 'red');
    el.classList.add(level);
}

class Application {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(CONFIG.RENDER.FOV, window.innerWidth/window.innerHeight, 0.1, 100);
        this.camera.position.z = 5;
        this.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('webgl-canvas'), alpha: true, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const dir = new THREE.DirectionalLight(0xffffff, 1.2);
        dir.position.set(5, 10, 7);
        this.scene.add(dir);
        this.sg = new SceneGraph(this);
        this.game = new GameLogic(this.sg);
        this.game.app = this;
        this.ai = new GestureClassifier();
        this.input = new InputSystem(this.game, this.sg, this.ai);
    }
    render() { this.renderer.render(this.scene, this.camera); }
    
    async start(customModelFiles = null) { 
        await this.ai.load(customModelFiles);

        const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
        hands.setOptions({maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7});
        hands.onResults((results) => {
            this.input.update(results, this.camera);
        });
        const videoElement = document.getElementById('video-background');
        
        const brightnessChecker = new SimpleBrightnessCheck();

        const cam = new Camera(videoElement, {
            onFrame: async () => {
                await hands.send({image: videoElement}); 
                const level = brightnessChecker.update(videoElement);
                if (level) updateCounterColor(level);
            },
            width: 1280, height: 720
        });
        try { await cam.start(); } catch (e) { console.error(e); alert("Камера зайнята або недоступна."); }
        this.loop();
    }

    loop() {
        requestAnimationFrame(() => this.loop());
        try {
            const t = Date.now() * 0.001;
            this.game.parts.forEach((c, i) => {
                if (c.userData.inInventory && c.userData.basePos) {
                    const bobOffset = Math.sin(t * CONFIG.PHYSICS.BOB_SPEED + i) * CONFIG.PHYSICS.BOB_HEIGHT;
                    c.position.x += (c.userData.basePos.x - c.position.x) * CONFIG.PHYSICS.REARRANGE_SPEED;
                    c.position.y += (c.userData.basePos.y + bobOffset - c.position.y) * CONFIG.PHYSICS.REARRANGE_SPEED;
                    c.position.z += (c.userData.basePos.z - c.position.z) * CONFIG.PHYSICS.REARRANGE_SPEED;
                } 
            });
            this.render();
        } catch (e) {
            console.error("Main Loop Error (Recovering...):", e);
        }
    }
}

// BOOT SEQUENCE (IMMEDIATE MODE)
window.onload = () => {
    const btn = document.getElementById('btn-launch');
    
    btn.onclick = () => {
        Audio.init();
        
        // Збираємо файли моделі
        const jsonFile = document.getElementById('model-upload').files[0];
        const binFile = document.getElementById('weights-upload').files[0];
        const files = (jsonFile && binFile) ? [jsonFile, binFile] : null;

        document.getElementById('boot-layer').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('boot-layer').style.display = 'none';
            // Передаємо файли у start()
            new Application().start(files);
        }, 800);
    };
};
