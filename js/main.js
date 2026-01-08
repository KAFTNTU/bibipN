import { CONFIG, AudioEngine, LightCheck } from './config.js';
import { SceneGraph } from './models.js';
import { GameLogic } from './logic.js';
import { GestureClassifier } from './ai.js';
import { InputSystem } from './input.js';

class Application {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(CONFIG.RENDER.FOV, window.innerWidth/window.innerHeight, CONFIG.RENDER.NEAR, CONFIG.RENDER.FAR);
        this.camera.position.z = 5;
        this.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('webgl-canvas'), alpha: true, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const dir = new THREE.DirectionalLight(0xffffff, 1.2); dir.position.set(5, 10, 7); this.scene.add(dir);
        
        this.sg = new SceneGraph(this);
        this.game = new GameLogic(this.sg);
        this.ai = new GestureClassifier();
        this.input = new InputSystem(this.game, this.sg, this.ai);
        this.brCheck = new LightCheck();
    }
    
    async start(files) {
        const log = document.getElementById('boot-log');
        log.innerText = "ІНІЦІАЛІЗАЦІЯ ШІ...";
        if(!await this.ai.load(files)) return;

        const hands = new Hands({locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`});
        hands.setOptions({maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.7});
        hands.onResults((res) => this.input.update(res, this.camera));
        
        const vid = document.getElementById('video-background');
        const cam = new Camera(vid, {
            onFrame: async () => { 
                await hands.send({image: vid});
                const lvl = this.brCheck.update(vid);
                if(lvl) {
                    const el = document.getElementById('part-counter');
                    if (el) { el.classList.remove('green', 'yellow', 'red'); el.classList.add(lvl); }
                }
            },
            width: 1280, height: 720
        });
        
        log.innerText = "ЗАПУСК КАМЕРИ...";
        try {
            await cam.start();
            document.getElementById('boot-layer').style.opacity = '0';
            setTimeout(() => document.getElementById('boot-layer').style.display = 'none', 800);
            this.loop();
        } catch(e) { log.innerText = "ПОМИЛКА КАМЕРИ"; console.error(e); }
    }

    loop() {
        requestAnimationFrame(() => this.loop());
        try {
            const t = Date.now() * 0.001;
            this.game.parts.forEach((c, i) => {
                if (c.userData.inInventory && c.userData.basePos) {
                    const bob = Math.sin(t * CONFIG.PHYSICS.BOB_SPEED + i) * CONFIG.PHYSICS.BOB_HEIGHT;
                    c.position.x += (c.userData.basePos.x - c.position.x) * CONFIG.PHYSICS.REARRANGE_SPEED;
                    c.position.y += (c.userData.basePos.y + bob - c.position.y) * CONFIG.PHYSICS.REARRANGE_SPEED;
                    c.position.z += (c.userData.basePos.z - c.position.z) * CONFIG.PHYSICS.REARRANGE_SPEED;
                } 
            });
            this.renderer.render(this.scene, this.camera);
        } catch (e) { console.error("Loop Error:", e); }
    }
}

const app = new Application();
const btn = document.getElementById('btn-launch');
btn.onclick = () => {
    const audio = new AudioEngine(); audio.init();
    const f1 = document.getElementById('model-upload').files[0];
    const f2 = document.getElementById('weights-upload').files[0];
    const files = (f1 && f2) ? [f1, f2] : null;
    btn.disabled = true;
    app.start(files);
};
