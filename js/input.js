import { CONFIG, Vector3Filter, AudioEngine } from './config.js';

const MODE = {
    IDLE: 0,
    GRAB: 1,
    ROTATE: 2,
    ZOOM: 3
};

const Audio = new AudioEngine();

export class InputSystem {
    constructor(game, sceneGraph, classifier) {
        this.game = game;
        this.sg = sceneGraph;
        this.classifier = classifier;
        this.raycaster = new THREE.Raycaster();
        
        this.states = [
            this.createInitialState(),
            this.createInitialState()
        ];
        this.filters = [new Vector3Filter(), new Vector3Filter()];
    }

    createInitialState() {
        return {
            mode: MODE.IDLE,
            handPos: new THREE.Vector3(),
            lastPos: new THREE.Vector3(),
            grabbedObject: null,
            potentialSnap: null
        };
    }

    update(results, camera) {
        const now = performance.now() / 1000;
        this.sg.hideCursors();
        if (!results.multiHandLandmarks) return;
        
        // Dispenser animation
        const nowMs = Date.now();
        this.game.dispensers.forEach(d => {
            if (d.userData.baseMesh) {
                const timeLeft = CONFIG.PHYSICS.DISPENSER_COOLDOWN - (nowMs - d.userData.lastDispenseTime);
                d.userData.baseMesh.material.color.setHex(timeLeft > 0 ? CONFIG.THEME.DISPENSER_COOLDOWN_COLOR : CONFIG.THEME.DISPENSER_BASE);
            }
        });

        results.multiHandLandmarks.forEach((landmarks, index) => {
            if (index >= 2) return; 
            try {
                this.processHand(landmarks, index, camera, now);
            } catch (e) {
                console.error("Gesture processing error, resetting hand state:", e);
                this.states[index] = this.createInitialState();
            }
        });
    }

    processHand(landmarks, index, camera, now) {
        const state = this.states[index];
        const s = CONFIG.INPUT.CURSOR_SENSITIVITY;
        
        const midX = (landmarks[8].x + landmarks[4].x) / 2;
        const midY = (landmarks[8].y + landmarks[4].y) / 2;
        const x = ((1 - midX) * 2 - 1) * s;
        const y = (-midY * 2 + 1) * s;
        const rawVec = new THREE.Vector3(x, y, 0.5);
        rawVec.unproject(camera);
        const dir = rawVec.sub(camera.position).normalize();
        const dist = (-5 - camera.position.z) / dir.z; 
        const rawPos = camera.position.clone().add(dir.multiplyScalar(dist));
        const pos = this.filters[index].process(rawPos, now);
        
        // --- HYBRID AI LOGIC START ---
        
        // 1. Геометричний щипок (Original Logic)
        const asp = window.innerWidth / window.innerHeight;
        const dThumbIndex = Math.sqrt(Math.pow((landmarks[8].x - landmarks[4].x) * asp, 2) + Math.pow(landmarks[8].y - landmarks[4].y, 2));
        const isGeometricGrab = dThumbIndex < CONFIG.INPUT.PINCH_THRESHOLD;

        // 2. Отримання жесту від AI
        const gesture = this.classifier.predict(landmarks);
        
        // 3. Визначення режиму (Гібридний підхід)
        let newMode = MODE.IDLE;

        if (isGeometricGrab) {
            // Пріоритет #1: Якщо пальці зімкнуті фізично -> це точно GRAB
            newMode = MODE.GRAB;
        } else {
            // Якщо пальці не зімкнуті, слухаємо AI
            if (gesture === 'Rotate') newMode = MODE.ROTATE;
            else if (gesture === 'Zoom') newMode = MODE.ZOOM;
            // Ігноруємо 'Grab' від AI, якщо фізично пальці далеко
        }

        // 4. Візуалізація для дебагу
        const debugEl = document.getElementById('ai-debug');
        if (debugEl && index === 0) {
            debugEl.innerText = `AI: ${gesture.toUpperCase()} | GRAB: ${isGeometricGrab ? 'YES' : 'NO'}`;
            debugEl.style.color = newMode !== MODE.IDLE ? '#00ffcc' : '#ffaa00';
        }

        // 5. Оновлення курсора
        this.sg.updateCursorState(index, pos, newMode);

        // 6. Виконання дій
        if (newMode === MODE.ROTATE) {
            if (state.mode !== MODE.ROTATE) {
                state.lastPos.copy(pos);
                Audio.sfxHover();
            } else {
                this.handleRotation(state, pos);
            }
            if (state.grabbedObject) this.endGrab(state);
        }
        else if (newMode === MODE.GRAB) {
            if (state.mode !== MODE.GRAB) {
                this.tryStartGrab(state, pos, camera, index);
            } else if (state.grabbedObject) {
                this.handleDrag(state, pos);
            }
        }
        else if (newMode === MODE.ZOOM) {
             if (state.mode === MODE.ZOOM) {
                 const dz = (pos.y - state.lastPos.y) * 2.0;
                 camera.position.z = Math.max(2, Math.min(8, camera.position.z + dz));
             }
             if (state.grabbedObject) this.endGrab(state);
        }
        else {
            if (state.mode === MODE.GRAB && state.grabbedObject) {
                this.endGrab(state);
            }
        }

        state.mode = newMode;
        state.handPos.copy(pos);
        state.lastPos.copy(pos);
    }

    tryStartGrab(state, pos, camera, handIndex) {
        const screen = pos.clone().project(camera);
        this.raycaster.setFromCamera(new THREE.Vector2(screen.x, screen.y), camera);
        
        const dispenserHits = this.raycaster.intersectObjects(this.sg.dispenserRoot.children, true);
        if (dispenserHits.length > 0) {
            let dObj = dispenserHits[0].object;
            while(dObj.parent && dObj.parent !== this.sg.dispenserRoot) dObj = dObj.parent;
            
            if (dObj.userData.isDispenser) {
                const newPart = this.game.tryDispense(dObj.userData.type, dObj); 
                if (newPart) {
                    newPart.position.copy(dObj.position); 
                    newPart.position.z += 0.5; 
                    state.grabbedObject = newPart;
                    newPart.userData.grabbedBy = handIndex;
                    return true; 
                }
            }
        }

        const partHits = this.raycaster.intersectObjects(this.sg.floatingRoot.children, true);
        let target = null;
        if (partHits.length > 0) {
            target = partHits[0].object;
        } else {
            let minD = CONFIG.PHYSICS.GRAB_RADIUS;
            this.sg.floatingRoot.children.forEach(obj => {
                if(obj.userData.type) {
                    const d = pos.distanceTo(obj.position);
                    if(d < minD) { minD = d; target = obj; }
                }
            });
        }

        if (target) {
            let obj = target;
            while(obj.parent && obj.parent !== this.sg.floatingRoot) obj = obj.parent;
            
            if (obj.userData.grabbedBy !== -1 && obj.userData.grabbedBy !== handIndex) return false;

            if (obj.userData.type && !obj.userData.isInstalled) {
                state.grabbedObject = obj;
                obj.userData.grabbedBy = handIndex; 
                Audio.sfxGrab();
                if (obj.userData.inInventory) {
                    obj.userData.inInventory = false; 
                    obj.userData.basePos = null;
                    this.game.rearrangeParts(); 
                }
                return true;
            }
        }
        return false;
    }

    endGrab(state) {
        if (state.grabbedObject) {
            this.game.updateHighlights(null, null);
            if (state.potentialSnap) {
                this.game.installPart(state.grabbedObject, state.potentialSnap, state.grabbedObject.userData.grabbedBy);
            } else {
                state.grabbedObject.userData.grabbedBy = -1; 
            }
            state.grabbedObject = null;
            state.potentialSnap = null;
        }
    }

    handleRotation(state, pos) {
        const dx = (pos.x - state.lastPos.x) * CONFIG.PHYSICS.ROTATION_SPEED;
        const dy = (pos.y - state.lastPos.y) * CONFIG.PHYSICS.ROTATION_SPEED;
        this.sg.worldRoot.rotation.y += dx;
        this.sg.worldRoot.rotation.x += dy;
        state.lastPos.copy(pos);
    }

    handleDrag(state, pos) {
        if (!state.grabbedObject) {
            state.mode = MODE.IDLE;
            return;
        }
        state.grabbedObject.position.lerp(pos, CONFIG.PHYSICS.LERP_FACTOR);
        const bestSnap = this.game.checkSnap(state.grabbedObject, pos);
        state.potentialSnap = bestSnap;
        this.game.updateHighlights(state.grabbedObject, bestSnap);
    }
}
