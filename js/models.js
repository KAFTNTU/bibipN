import { CONFIG, TEXTURES_URLS } from './config.js';

// --- TEXTURES ---
const tl = new THREE.TextureLoader();
export const textures = { top: null, long: null, short: null };

function loadChroma(url) {
    const t = new THREE.Texture(); const l = new THREE.ImageLoader();
    l.load(url, (img) => {
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d'); ctx.drawImage(img,0,0);
        const d = ctx.getImageData(0,0,c.width,c.height); const p = d.data;
        for(let i=0; i<p.length; i+=4) if(p[i]<40 && p[i+1]<40 && p[i+2]<40) { p[i]=57; p[i+1]=255; p[i+2]=20; }
        ctx.putImageData(d,0,0); t.image = c; t.encoding = THREE.sRGBEncoding; t.needsUpdate = true;
    }); return t;
}
if(TEXTURES_URLS.TOP) textures.top = loadChroma(TEXTURES_URLS.TOP);
if(TEXTURES_URLS.LONG) textures.long = tl.load(TEXTURES_URLS.LONG);
if(TEXTURES_URLS.SHORT) textures.short = tl.load(TEXTURES_URLS.SHORT);

export class ModelFactory {
    static getMaterial(type) {
        switch(type) {
            case 'metal': return new THREE.MeshStandardMaterial({color: 0xaaaaaa, metalness: 0.9, roughness: 0.1});
            case 'dark_metal': return new THREE.MeshStandardMaterial({color: 0x444444, metalness: 0.8, roughness: 0.4});
            case 'pcb': return new THREE.MeshStandardMaterial({color: 0x004400, roughness: 0.3});
            case 'chip': return new THREE.MeshStandardMaterial({color: 0x111111, roughness: 0.1});
            case 'plastic': return new THREE.MeshStandardMaterial({color: 0x222222, roughness: 0.5});
            case 'battery_body': return new THREE.MeshStandardMaterial({color: 0xffaa00, metalness: 0.3, roughness: 0.4});
            case 'rubber': return new THREE.MeshStandardMaterial({color: 0x111111, roughness: 0.9, flatShading: true});
            case 'sensor_body': return new THREE.MeshStandardMaterial({color: 0x0055ff, roughness: 0.5});
            case 'sensor_eye': return new THREE.MeshStandardMaterial({color: 0xeeeeee, metalness: 0.1, roughness: 0.1});
            case 'sensor_pupil': return new THREE.MeshBasicMaterial({color: 0x000000});
            case 'frame_plastic': return new THREE.MeshStandardMaterial({color: 0x333333, roughness: 0.7, metalness: 0.1});
            case 'dark_plastic': return new THREE.MeshStandardMaterial({color: 0x222222, roughness: 0.7, metalness: 0.1});
            case 'port_gray': return new THREE.MeshStandardMaterial({color: 0x666666, roughness: 0.5});
            case 'gold': return new THREE.MeshStandardMaterial({color: 0xffd700, metalness: 0.9, roughness: 0.2});
            case 'black_void': return new THREE.MeshBasicMaterial({color: 0x000000});
            case 'port_black': return new THREE.MeshStandardMaterial({color: 0x050505, roughness: 0.4});
            case 'orange': return new THREE.MeshStandardMaterial({color: 0xff6600, roughness: 0.6});
            default: return new THREE.MeshBasicMaterial({color: 0xffffff});
        }
    }

    static createPart(type) {
        const group = new THREE.Group();
        const hitBox = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), new THREE.MeshBasicMaterial({visible:false}));
        hitBox.userData.isHitbox = true; group.add(hitBox);

        if(type === 'gear') {
            const numTeeth = 16; const radius = 0.48; const innerRad = 0.40; const thickness = 0.05; const holeRad = 0.15; 
            const gearShape = new THREE.Shape(); const step = (Math.PI * 2) / numTeeth;
            for (let i = 0; i < numTeeth; i++) {
                const a1 = i * step; const a2 = a1 + step * 0.25; const a3 = a1 + step * 0.5;
                if (i === 0) gearShape.moveTo(Math.cos(a1) * innerRad, Math.sin(a1) * innerRad);
                else gearShape.lineTo(Math.cos(a1) * innerRad, Math.sin(a1) * innerRad);
                gearShape.lineTo(Math.cos(a1) * radius, Math.sin(a1) * radius);
                gearShape.lineTo(Math.cos(a2) * radius, Math.sin(a2) * radius);
                gearShape.lineTo(Math.cos(a3) * innerRad, Math.sin(a3) * innerRad);
            }
            const holePath = new THREE.Path(); holePath.absarc(0, 0, holeRad, 0, Math.PI * 2, true); gearShape.holes.push(holePath);
            const extrudeSettings = { depth: thickness, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 };
            const gearGeom = new THREE.ExtrudeGeometry(gearShape, extrudeSettings); gearGeom.translate(0, 0, -thickness/2);
            const gearBody = new THREE.Mesh(gearGeom, this.getMaterial('plastic'));
            const innerRing = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, thickness + 0.02, 16), this.getMaterial('metal'));
            innerRing.rotation.x = Math.PI / 2;
            const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, thickness + 0.04, 8), new THREE.MeshBasicMaterial({color: 0x222222}));
            pin.rotation.x = Math.PI / 2;
            const gearVisGroup = new THREE.Group(); gearVisGroup.add(gearBody, innerRing, pin);
            group.add(gearVisGroup);
        }
        else if(type === 'wheel') {
            const wGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.25, 24); wGeo.rotateZ(Math.PI / 2);
            const wTire = new THREE.Mesh(wGeo, this.getMaterial('rubber'));
            const wRim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.26, 16), this.getMaterial('metal')); wRim.rotation.z = Math.PI / 2;
            for(let i=0; i<4; i++) {
                const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.28, 6), this.getMaterial('dark_metal'));
                bolt.rotation.z = Math.PI / 2; const a = (i/4)*Math.PI*2;
                bolt.position.set(0, Math.cos(a)*0.15, Math.sin(a)*0.15); group.add(bolt);
            }
            group.add(wTire, wRim);
        }
        else if(type === 'board') {
            const pcb = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.5), this.getMaterial('pcb'));
            const chip1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.2), this.getMaterial('chip')); chip1.position.set(0.2, 0, 0);
            const chip2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.3), this.getMaterial('chip')); chip2.position.set(-0.2, 0, 0);
            const pins = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.05), this.getMaterial('metal')); pins.position.set(0, 0, 0.2);
            group.add(pcb, chip1, chip2, pins);
        }
        else if(type === 'battery') {
            const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 16), this.getMaterial('battery_body')); bat.rotation.z = Math.PI / 2;
            const posTerm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 12), this.getMaterial('metal'));
            posTerm.rotation.z = Math.PI / 2; posTerm.position.x = 0.32;
            group.add(bat, posTerm);
        }
        else if(type === 'cover_green') {
            const w = 1.9; const h = 0.625; const d = 4.0; const stepW = w * 0.75; const stepD = d * 0.75; const stepH = 0.25; 
            let materials; const fallbackMat = new THREE.MeshStandardMaterial({color: 0x39ff14, roughness: 0.4});
            if (textures.top) {
                const matTop = new THREE.MeshStandardMaterial({map: textures.top, transparent: false, opacity: 1.0});
                const matLong = textures.long ? new THREE.MeshStandardMaterial({ map: textures.long }) : fallbackMat;
                const matShort = textures.short ? new THREE.MeshStandardMaterial({ map: textures.short }) : fallbackMat;
                materials = [matLong, matLong, matTop, fallbackMat, matShort, matShort];
            } else { materials = fallbackMat; }
            const topCover = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials); topCover.position.y = stepH / 2; 
            const stepCover = new THREE.Mesh(new THREE.BoxGeometry(stepW, stepH, stepD), new THREE.MeshStandardMaterial({color: 0x228822})); stepCover.position.y = -(h / 2); 
            group.add(stepCover, topCover);
        }
        else if(type === 'motor') {
            const motLen = 0.8; const motRad = 0.35; const frontLen = motLen * 0.3; const rearLen = motLen * 0.7;
            const cylRear = new THREE.Mesh(new THREE.CylinderGeometry(motRad, motRad, rearLen, 32), this.getMaterial('frame_plastic'));
            cylRear.rotation.z = Math.PI / 2; cylRear.position.x = - (frontLen / 2); group.add(cylRear);
            const cylFront = new THREE.Mesh(new THREE.CylinderGeometry(motRad, motRad, frontLen, 32), this.getMaterial('dark_plastic'));
            cylFront.rotation.z = Math.PI / 2; cylFront.position.x = (rearLen / 2); group.add(cylFront);
            const box = new THREE.Mesh(new THREE.BoxGeometry(motLen * 0.6, (motRad * 2.2) * 0.85, motRad * 1.6), this.getMaterial('frame_plastic')); group.add(box);
            const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.08, 16), this.getMaterial('orange'));
            shaft.rotation.z = Math.PI / 2; shaft.position.x = motLen / 2 + 0.04; group.add(shaft);
            
            // PORTS
            const portGroup = new THREE.Group();
            portGroup.position.set(-motLen/2, 0.2, 0); portGroup.rotation.y = Math.PI; 
            const portBody = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.275), this.getMaterial('port_gray')); portBody.position.x = 0.05; portGroup.add(portBody);
            const portHole = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.19), this.getMaterial('black_void')); portHole.position.x = 0.13; portGroup.add(portHole);
            const pinGeo = new THREE.BoxGeometry(0.01, 0.02, 0.015);
            for(let k=0; k<8; k++) {
                const pin = new THREE.Mesh(pinGeo, this.getMaterial('gold'));
                pin.position.z = -((7)*0.017)/2 + k * 0.017; pin.position.y = -0.025; pin.position.x = 0.13; portGroup.add(pin);
            }
            group.add(portGroup);
        }
        else if(type === 'sensor') {
            const sPlate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.1), this.getMaterial('sensor_body'));
            const eyeL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.2, 16), this.getMaterial('sensor_eye'));
            eyeL.rotation.x = Math.PI/2; eyeL.position.set(-0.25, 0, 0.1);
            const pupilL = new THREE.Mesh(new THREE.CircleGeometry(0.08, 16), this.getMaterial('sensor_pupil'));
            pupilL.position.set(0, 0.11, 0); pupilL.rotation.x = -Math.PI/2; eyeL.add(pupilL);
            const eyeR = eyeL.clone(); eyeR.position.set(0.25, 0, 0.1);
            group.add(sPlate, eyeL, eyeR);
        }

        group.userData = { isPart: true, parentGroup: group, grabbedBy: -1 };
        return group;
    }
}

export class SceneGraph {
    constructor(re) {
        this.re = re;
        this.worldRoot = new THREE.Group(); this.worldRoot.position.set(0, -1, -6); this.re.scene.add(this.worldRoot);
        this.floatingRoot = new THREE.Group(); this.floatingRoot.position.set(0, 0, -5); this.re.scene.add(this.floatingRoot);
        this.dispenserRoot = new THREE.Group(); this.dispenserRoot.position.set(0, 0, -5); this.re.scene.add(this.dispenserRoot);
        this.cursors = [this.createCursor(), this.createCursor()]; this.cursors.forEach(c => this.re.scene.add(c));
        this.initChassis();
    }

    createCursor() {
        const g = new THREE.Group();
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.04), new THREE.MeshBasicMaterial({color: CONFIG.THEME.CURSOR_OPEN, depthTest: false}));
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.09, 32), new THREE.MeshBasicMaterial({color: CONFIG.THEME.CURSOR_OPEN, side: THREE.DoubleSide, transparent:true, opacity:0.5, depthTest: false}));
        g.add(dot, ring); g.userData = { dot, ring }; g.visible = false; return g;
    }

    initChassis() {
        const frameMat = new THREE.MeshStandardMaterial({ color: CONFIG.THEME.CHASSIS_COLOR, roughness: 0.7, metalness: 0.1 });
        const holeMat = new THREE.MeshBasicMaterial({color: 0x111111});
        const frameGroup = new THREE.Group(); this.worldRoot.add(frameGroup);
        const sideGeo = new THREE.BoxGeometry(0.15, 0.3, 4.0);
        const l = new THREE.Mesh(sideGeo, frameMat); l.position.set(-0.85, 0, 0); frameGroup.add(l);
        const r = new THREE.Mesh(sideGeo, frameMat); r.position.set(0.85, 0, 0); frameGroup.add(r);
        const crossGeo = new THREE.BoxGeometry(1.55, 0.3, 0.15);
        const fC = new THREE.Mesh(crossGeo, frameMat); fC.position.set(0, 0, -0.8); frameGroup.add(fC);
        const bC = new THREE.Mesh(crossGeo, frameMat); bC.position.set(0, 0, 0.8); frameGroup.add(bC);
        const cBeam = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 1.6), frameMat); frameGroup.add(cBeam);
        
        // Axles
        const axGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.9, 12); const axMat = new THREE.MeshStandardMaterial({color:0x888888});
        const fAx = new THREE.Mesh(axGeo, axMat); fAx.rotation.z=Math.PI/2; fAx.position.z=-1.2; this.worldRoot.add(fAx);
        const bAx = new THREE.Mesh(axGeo, axMat); bAx.rotation.z=Math.PI/2; bAx.position.z=1.2; this.worldRoot.add(bAx);
    }

    updateCursorState(index, pos, mode) {
        if (index >= 2) return; const c = this.cursors[index]; c.visible = true; c.position.copy(pos);
        let col = CONFIG.THEME.CURSOR_OPEN; let s = 1.2;
        if (mode === 1) { col = CONFIG.THEME.CURSOR_CLOSED; s = 0.8; }
        else if (mode === 2) { col = CONFIG.THEME.CURSOR_ROTATE; s = 1.5; }
        else if (mode === 3) { col = CONFIG.THEME.CURSOR_SCALE; s = 1.4; }
        c.userData.dot.material.color.setHex(col); c.userData.ring.material.color.setHex(col); c.userData.ring.scale.setScalar(s);
    }
    hideCursors() { this.cursors.forEach(c => c.visible = false); }

    createDispenser(type, pos) {
        const g = new THREE.Group(); g.position.copy(pos);
        const b = new THREE.Mesh(new THREE.BoxGeometry(1.2,0.1,1.2), new THREE.MeshStandardMaterial({color: CONFIG.THEME.DISPENSER_BASE})); g.add(b);
        const p = ModelFactory.createPart(type); p.scale.setScalar(0.7); p.position.y=0.5; 
        p.traverse(c => { if(c.isMesh) { c.material = c.material.clone(); c.material.transparent = true; c.material.opacity = 0.8; } });
        g.add(p);
        g.userData = { isDispenser: true, type: type, baseMesh: b, lastDispenseTime: 0 };
        this.dispenserRoot.add(g); return g;
    }
}
