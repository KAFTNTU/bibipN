import { CONFIG, VectorFilter, AudioEngine } from './config.js';
const MODE = { IDLE: 0, GRAB: 1, ROTATE: 2, ZOOM: 3 };
const Audio = new AudioEngine(); Audio.init();

export class InputSystem {
    constructor(game, sceneGraph, classifier) {
        this.game = game;
        this.sg = sceneGraph;
        this.classifier = classifier;
        this.raycaster = new THREE.Raycaster();
        this.states = [this.createState(), this.createState()];
        this.filters = [new VectorFilter(), new VectorFilter()];
    }

    createState() { return { mode: MODE.IDLE, handPos: new THREE.Vector3(), lastPos: new THREE.Vector3(), grabbedObject: null, potentialSnap: null }; }

    update(results, camera) {
        const now = performance.now() / 1000;
        this.sg.hideCursors();
        if (!results.multiHandLandmarks) return;
        
        // Dispenser animation
        this.game.dispensers.forEach(d => {
            const timeLeft = CONFIG.PHYSICS.DISPENSER_COOLDOWN - (Date.now() - d.userData.lastDispenseTime);
            d.userData.baseMesh.material.color.setHex(timeLeft > 0 ? CONFIG.THEME.DISPENSER_COOLDOWN_COLOR : CONFIG.THEME.DISPENSER_BASE);
        });

        results.multiHandLandmarks.forEach((landmarks, index) => {
            if (index >= 2) return; 
            try { this.processHand(landmarks, index, camera, now); } catch (e) { this.states[index] = this.createState(); }
        });
    }

    processHand(landmarks, index, camera, now) {
        const state = this.states[index];
        const s = CONFIG.INPUT.SENSITIVITY;
        
        const midX = (landmarks[8].x + landmarks[4].x) / 2; const midY = (landmarks[8].y + landmarks[4].y) / 2;
        const x = ((1 - midX) * 2 - 1) * s; const y = (-midY * 2 + 1) * s;
        const rawVec = new THREE.Vector3(x, y, 0.5).unproject(camera);
        const dir = rawVec.sub(camera.position).normalize();
        const pos = this.filters[index].process(camera.position.clone().add(dir.multiplyScalar((-5 - camera.position.z) / dir.z)), now);
        
        // --- HYBRID LOGIC ---
        const dThumbIndex = Math.hypot((landmarks[8].x - landmarks[4].x) * (window.innerWidth/window.innerHeight), landmarks[8].y - landmarks[4].y);
        const isGeometricGrab = dThumbIndex < CONFIG.INPUT.PINCH_THRESHOLD;
        const gesture = this.classifier.predict(landmarks);
        
        let newMode = MODE.IDLE;
        if (isGeometricGrab || gesture === 'Grab') newMode = MODE.GRAB;
        else if (gesture === 'Rotate') newMode = MODE.ROTATE;
        else if (gesture === 'Zoom') newMode = MODE.ZOOM;

        const debugEl = document.getElementById('ai-debug');
        if (debugEl && index===0) {
            debugEl.innerText = `AI: ${gesture.toUpperCase()} | PINCH: ${isGeometricGrab ? 'ON' : 'OFF'}`;
            debugEl.style.color = newMode !== MODE.IDLE ? '#00ffcc' : '#ffaa00';
        }

        this.sg.updateCursorState(index, pos, newMode);

        if (newMode === MODE.ROTATE) {
            if (state.mode !== MODE.ROTATE) { state.lastPos.copy(pos); Audio.sfxHover(); } 
            else {
                this.sg.worldRoot.rotation.y += (pos.x - state.lastPos.x) * CONFIG.PHYSICS.ROTATION_SPEED;
                this.sg.worldRoot.rotation.x += (pos.y - state.lastPos.y) * CONFIG.PHYSICS.ROTATION_SPEED;
            }
            if (state.grabbedObject) this.endGrab(state);
        }
        else if (newMode === MODE.GRAB) {
            if (state.mode !== MODE.GRAB) this.tryStartGrab(state, pos, camera, index);
            else if (state.grabbedObject) {
                state.grabbedObject.position.lerp(pos, CONFIG.PHYSICS.LERP_FACTOR);
                const snap = this.game.checkSnap(state.grabbedObject, pos);
                state.potentialSnap = snap;
                this.game.updateHighlights(state.grabbedObject, snap);
            }
        }
        else if (newMode === MODE.ZOOM && state.mode === MODE.ZOOM) {
             const dz = (pos.y - state.lastPos.y) * 2.0;
             camera.position.z = Math.max(2, Math.min(8, camera.position.z + dz));
             if (state.grabbedObject) this.endGrab(state);
        }
        else if (state.mode === MODE.GRAB && state.grabbedObject) this.endGrab(state);

        state.mode = newMode;
        state.handPos.copy(pos);
        state.lastPos.copy(pos);
    }

    tryStartGrab(state, pos, camera, handIndex) {
        const sc = pos.clone().project(camera);
        this.raycaster.setFromCamera(new THREE.Vector2(sc.x, sc.y), camera);
        
        const dHits = this.raycaster.intersectObjects(this.sg.dispenserRoot.children, true);
        if (dHits.length > 0) {
            let dObj = dHits[0].object;
            while(dObj.parent && dObj.parent !== this.sg.dispenserRoot) dObj = dObj.parent;
            if (dObj.userData.isDispenser) {
                const part = this.game.tryDispense(dObj.userData.type, dObj); 
                if (part) { part.position.copy(dObj.position); part.position.z += 0.5; state.grabbedObject = part; part.userData.grabbedBy = handIndex; return true; }
            }
        }

        const pHits = this.raycaster.intersectObjects(this.sg.floatingRoot.children, true);
        let target = null;
        if (pHits.length > 0) target = pHits[0].object;
        else {
            let minD = CONFIG.PHYSICS.GRAB_RADIUS;
            this.sg.floatingRoot.children.forEach(obj => { if(obj.userData.type && pos.distanceTo(obj.position) < minD) target = obj; });
        }

        if (target) {
            while(target.parent && target.parent !== this.sg.floatingRoot) target = target.parent;
            if (target.userData.grabbedBy === -1 && !target.userData.isInstalled) {
                state.grabbedObject = target; target.userData.grabbedBy = handIndex; Audio.sfxGrab();
                if (target.userData.inInventory) { target.userData.inInventory = false; this.game.rearrangeParts(); }
                return true;
            }
        }
        return false;
    }

    endGrab(state) {
        if (state.grabbedObject) {
            this.game.updateHighlights(null, null);
            if (state.potentialSnap) this.game.installPart(state.grabbedObject, state.potentialSnap);
            else state.grabbedObject.userData.grabbedBy = -1;
            state.grabbedObject = null; state.potentialSnap = null;
        }
    }
}
