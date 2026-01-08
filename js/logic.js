import { CONFIG, AudioEngine } from './config.js';
import { ModelFactory } from './models.js';

const Audio = new AudioEngine();

export class GameLogic {
    constructor(sceneGraph) {
        this.sg = sceneGraph;
        this.parts = [];
        this.snaps = [];
        this.installedCount = 0;
        this.totalParts = 0;
        this.counts = { wheel: { current: 0, max: 0 }, gear: { current: 0, max: 0 } };
        this.dispensers = [];
        this.initLevel();
    }

    initLevel() {
        this.createSnap('wheel', new THREE.Vector3(-1.5, 0, -1.2), 'SIDE');
        this.createSnap('wheel', new THREE.Vector3(1.5, 0, -1.2), 'SIDE');
        this.createSnap('wheel', new THREE.Vector3(-1.5, 0, 1.2), 'SIDE');
        this.createSnap('wheel', new THREE.Vector3(1.5, 0, 1.2), 'SIDE');

        [-1.0, 0.0, 1.0].forEach(z => this.createSnap('gear', new THREE.Vector3(-1.25, 0, z), 'SIDE'));
        [-1.2, -0.4, 0.4, 1.2].forEach(z => this.createSnap('gear', new THREE.Vector3(1.25, 0, z), 'SIDE'));

        this.createSnap('board', new THREE.Vector3(0, 0.08, -1.0), 'TOP');
        this.createSnap('battery', new THREE.Vector3(0.2, -0.1, 0.8), 'BOT');
        this.createSnap('battery', new THREE.Vector3(-0.2, -0.1, 0.8), 'BOT');
        this.createSnap('cover_green', new THREE.Vector3(0, 0.50, 0), 'TOP');
        
        this.createSnap('motor', new THREE.Vector3(0.58, 0, -1.2), 'TOP'); 
        this.createSnap('motor', new THREE.Vector3(-0.58, 0, 1.2), 'TOP'); 
        
        this.createSnap('sensor', new THREE.Vector3(0, 0.95, 1.8), 'TOP');

        this.spawnLooseParts();
        this.setupDispensers();
    }

    createSnap(type, pos, face) {
        const snap = new THREE.Group();
        snap.position.copy(pos);
        
        if (type === 'motor' && pos.x < 0) {
            snap.rotation.y = Math.PI;
        }

        let ghostGeo;
        if(type === 'gear') ghostGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.05, 16); 
        else if(type === 'wheel') ghostGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.25, 16);
        else if(type === 'battery') ghostGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.6, 12);
        else if(type === 'cover_green') ghostGeo = new THREE.BoxGeometry(1.9, 0.8, 4.0);
        else if(type === 'sensor') ghostGeo = new THREE.BoxGeometry(0.8, 0.3, 0.2);
        else ghostGeo = new THREE.BoxGeometry(0.5, 0.1, 0.5);

        if(['gear', 'wheel'].includes(type)) snap.rotation.z = Math.PI/2;
        if(type === 'battery') { snap.rotation.x = Math.PI/2; snap.rotation.z = Math.PI/2; }

        const ghostMat = new THREE.MeshBasicMaterial({
            color: CONFIG.THEME.GHOST_VALID, wireframe: true, transparent: true, opacity: 0.3, depthTest: false, depthWrite: false
        });
        const ghost = new THREE.Mesh(ghostGeo, ghostMat);
        ghost.visible = false;
        snap.add(ghost);

        snap.userData = { isSnap: true, type: type, occupied: false, mesh: ghost };
        this.sg.worldRoot.add(snap);
        this.snaps.push(snap);
        this.totalParts++;

        if (this.counts[type]) this.counts[type].max++;
    }

    spawnLooseParts() {
        this.snaps.forEach((snap) => {
            const type = snap.userData.type;
            if (type === 'wheel' || type === 'gear') return;
            const part = ModelFactory.createPart(type);
            part.position.set(0, 5, 0);
            if (type === 'cover_green') part.scale.y = 0.2; 
            part.userData.type = type;
            part.userData.isInstalled = false;
            part.userData.inInventory = true; 
            part.userData.basePos = new THREE.Vector3();
            this.sg.floatingRoot.add(part);
            this.parts.push(part);
        });
        this.rearrangeParts();
        this.updateCounter();
    }

    setupDispensers() {
        this.dispensers.push(this.sg.createDispenser('wheel', new THREE.Vector3(-2.2, 2.0, -1.0)));
        this.dispensers.push(this.sg.createDispenser('gear', new THREE.Vector3(2.2, 2.0, -1.0)));
    }

    tryDispense(type, dispenserObj) {
        const now = Date.now();
        if (dispenserObj.userData.lastDispenseTime && (now - dispenserObj.userData.lastDispenseTime < CONFIG.PHYSICS.DISPENSER_COOLDOWN)) {
            Audio.sfxError(); return null;
        }
        if (!this.counts[type] || this.counts[type].current >= this.counts[type].max) {
            Audio.sfxError(); return null; 
        }

        const part = ModelFactory.createPart(type);
        part.userData.type = type;
        part.userData.isInstalled = false;
        part.userData.inInventory = false; 
        this.sg.floatingRoot.add(part);
        this.parts.push(part);
        
        this.counts[type].current++;
        dispenserObj.userData.lastDispenseTime = now; 
        Audio.sfxDispense();
        return part;
    }

    updateCounter() {
        document.getElementById('part-counter').innerText = `${this.installedCount} / ${this.totalParts}`;
        if(this.installedCount === this.totalParts) this.triggerWin();
    }

    checkSnap(part, partPos) {
        let bestSnap = null; let limit = 1.5; 
        if (part.userData.type === 'sensor') {
            const isCoverInstalled = this.parts.some(p => p.userData.type === 'cover_green' && p.userData.isInstalled);
            if (!isCoverInstalled) return null; 
        }
        for (const snap of this.snaps) {
            if (snap.userData.occupied) continue;
            if (snap.userData.type !== part.userData.type) continue;
            const snapWorldPos = new THREE.Vector3();
            snap.getWorldPosition(snapWorldPos);
            const dist = partPos.distanceTo(snapWorldPos);
            if (dist < limit) { limit = dist; bestSnap = snap; }
        }
        return bestSnap;
    }
    
    updateHighlights(activePart, bestSnap) {
        if (!activePart) {
            this.snaps.forEach(s => { if (!s.userData.occupied) s.userData.mesh.visible = false; });
            return;
        }
        const type = activePart.userData.type;
        if (type === 'sensor') {
            const isCoverInstalled = this.parts.some(p => p.userData.type === 'cover_green' && p.userData.isInstalled);
            if (!isCoverInstalled) {
                 this.snaps.forEach(s => { if(s.userData.type === 'sensor') s.userData.mesh.visible = false; });
                 return;
            }
        }
        this.snaps.forEach(snap => {
            if (snap.userData.occupied || snap.userData.type !== type) {
                 if (!snap.userData.occupied) snap.userData.mesh.visible = false;
                 return;
            }
            const mesh = snap.userData.mesh;
            if (snap === bestSnap) {
                mesh.visible = true;
                mesh.material.color.setHex(CONFIG.THEME.GHOST_HIGHLIGHT);
                mesh.material.opacity = 0.8;
                mesh.material.needsUpdate = true;
                mesh.material.depthTest = false;
                mesh.material.depthWrite = false;
                mesh.renderOrder = 999;
            } else {
                mesh.visible = false;
            }
        });
    }

    rearrangeParts() {
        const activeParts = this.parts.filter(p => p.userData.inInventory);
        const cols = 2; const spacingX = 1.0; const spacingY = 0.8;
        activeParts.forEach((part, index) => {
            const col = index % cols; const row = Math.floor(index / cols);
            const x = (col - 0.5) * spacingX;
            const y = 1.5 + (row * spacingY);
            const z = 1.0 + (row * 0.1); 
            if (part.userData.basePos) part.userData.basePos.set(x, y, z);
        });
    }

    installPart(part, snap, handIndex) {
        this.sg.floatingRoot.remove(part);
        this.sg.worldRoot.add(part);
        part.position.copy(snap.position);
        
        if (part.userData.type === 'gear') {
            part.rotation.set(0, Math.PI/2, 0);
        } else if (['wheel', 'sensor'].includes(part.userData.type)) {
            part.rotation.set(0, 0, 0); 
        } else {
            part.rotation.copy(snap.rotation);
        }

        if (part.userData.type === 'cover_green') part.scale.y = 1.0;

        part.traverse((child) => {
            if (child.isMesh) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(mat => {
                    if (part.userData.type === 'cover_green') {
                        mat.transparent = false; mat.opacity = 1.0;
                        mat.side = THREE.DoubleSide; mat.depthWrite = true; mat.depthTest = true;
                    } else {
                        mat.transparent = false; mat.opacity = 1.0; mat.depthWrite = true;
                    }
                    mat.needsUpdate = true;
                });
            }
        });
        
        part.userData.isInstalled = true;
        part.userData.grabbedBy = -1; 
        snap.userData.occupied = true;
        snap.visible = false;
        this.installedCount++;
        this.updateHighlights(null, null);
        this.updateCounter();
        Audio.sfxSnap();
    }

    triggerWin() {
        Audio.sfxVictory();
        document.getElementById('victory-screen').classList.add('active');
    }
}
