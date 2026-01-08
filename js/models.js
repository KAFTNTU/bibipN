import { CONFIG, TEXTURE_URLS } from './config.js';

const textureLoader = new THREE.TextureLoader();
export const textures = { top: null, long: null, short: null, chassis: null };

function loadTex(url) {
    return textureLoader.load(url, (tex) => { tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 16; });
}

function loadChromaTex(url) {
    const tex = new THREE.Texture();
    const loader = new THREE.ImageLoader();
    loader.load(url, (image) => {
        const canvas = document.createElement('canvas');
        canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] < 40 && data[i+1] < 40 && data[i+2] < 40) {
                data[i]=57; data[i+1]=255; data[i+2]=20;
            }
        }
        ctx.putImageData(imgData, 0, 0);
        tex.image = canvas; tex.encoding = THREE.sRGBEncoding; tex.needsUpdate = true;
    });
    return tex;
}

if (TEXTURE_URLS.TOP) textures.top = loadChromaTex(TEXTURE_URLS.TOP);
if (TEXTURE_URLS.SIDE_LONG) textures.long = loadTex(TEXTURE_URLS.SIDE_LONG);
if (TEXTURE_URLS.SIDE_SHORT) textures.short = loadTex(TEXTURE_URLS.SIDE_SHORT);

// --- 3D PARTS FACTORY ---
export class ModelFactory {
    static getMaterial(type) {
        switch(type) {
            case 'metal': return new THREE.MeshStandardMaterial({color: 0xaaaaaa, metalness: 0.9, roughness: 0.1});
            case 'dark_metal': return new THREE.MeshStandardMaterial({color: 0x444444, metalness: 0.8, roughness: 0.4});
            case 'pcb': return new THREE.MeshStandardMaterial({color: 0x004400, roughness: 0.3});
            case 'chip': return new THREE.MeshStandardMaterial({color: 0x111111, roughness: 0.1});
            case 'plastic': return new THREE.MeshStandardMaterial({color: 0x222222, roughness: 0.5});
            // MISSING IN UPLOADED FILES, RESTORED FROM INDEX 29:
            case 'copper': return new THREE.MeshStandardMaterial({color: 0xb87333, metalness: 0.7, roughness: 0.2});
            case 'battery_body': return new THREE.MeshStandardMaterial({color: 0xffaa00, metalness: 0.3, roughness: 0.4});
            case 'rubber': return new THREE.MeshStandardMaterial({color: 0x111111, roughness: 0.9, flatShading: true});
            // MISSING IN UPLOADED FILES, RESTORED FROM INDEX 29:
            case 'screen': return new THREE.MeshStandardMaterial({color: 0x050505, roughness: 0.1, metalness: 0.8});
            case 'button_red': return new THREE.MeshStandardMaterial({color: 0xff3333});
            
            case 'sensor_body': return new THREE.MeshStandardMaterial({color: 0x0055ff, roughness: 0.5});
            case 'sensor_eye': return new THREE.MeshStandardMaterial({color: 0xeeeeee, metalness: 0.1, roughness: 0.1});
            case 'sensor_pupil': return new THREE.MeshBasicMaterial({color: 0x000000});
            // --- MOTOR MATERIALS ---
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
        hitBox.userData.isHitbox = true;
        group.add(hitBox);

        switch(type) {
            case 'gear':
                const numTeeth = 16;
                const radius = 0.48;
                const innerRad = 0.40;
                const thickness = 0.05;
                const holeRad = 0.15; 
                const gearShape = new THREE.Shape();
                const step = (Math.PI * 2) / numTeeth;
                for (let i = 0; i < numTeeth; i++) {
                    const a1 = i * step; const a2 = a1 + step * 0.25; const a3 = a1 + step * 0.5;
                    if (i === 0) gearShape.moveTo(Math.cos(a1) * innerRad, Math.sin(a1) * innerRad);
                    else gearShape.lineTo(Math.cos(a1) * innerRad, Math.sin(a1) * innerRad);
                    gearShape.lineTo(Math.cos(a1) * radius, Math.sin(a1) * radius);
                    gearShape.lineTo(Math.cos(a2) * radius, Math.sin(a2) * radius);
                    gearShape.lineTo(Math.cos(a3) * innerRad, Math.sin(a3) * innerRad);
                }
                const holePath = new THREE.Path();
                holePath.absarc(0, 0, holeRad, 0, Math.PI * 2, true);
                gearShape.holes.push(holePath);
                const extrudeSettings = { depth: thickness, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 };
                const gearGeom = new THREE.ExtrudeGeometry(gearShape, extrudeSettings);
                gearGeom.translate(0, 0, -thickness/2);
                const gearBody = new THREE.Mesh(gearGeom, this.getMaterial('plastic'));
                const innerRing = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, thickness + 0.02, 16), this.getMaterial('metal'));
                innerRing.rotation.x = Math.PI / 2;
                const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, thickness + 0.04, 8), new THREE.MeshBasicMaterial({color: 0x222222}));
                pin.rotation.x = Math.PI / 2;
                const gearVisGroup = new THREE.Group();
                gearVisGroup.add(gearBody, innerRing, pin);
                group.add(gearVisGroup);
                break;

            case 'wheel':
                const wGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.25, 24); 
                wGeo.rotateZ(Math.PI / 2);
                const wTire = new THREE.Mesh(wGeo, this.getMaterial('rubber'));
                const wRim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.26, 16), this.getMaterial('metal'));
                wRim.rotation.z = Math.PI / 2;
                for(let i=0; i<4; i++) {
                    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.28, 6), this.getMaterial('dark_metal'));
                    bolt.rotation.z = Math.PI / 2;
                    const a = (i/4)*Math.PI*2;
                    bolt.position.set(0, Math.cos(a)*0.15, Math.sin(a)*0.15);
                    group.add(bolt);
                }
                group.add(wTire, wRim);
                break;

            case 'board':
                const pcb = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.5), this.getMaterial('pcb'));
                const chip1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.2), this.getMaterial('chip'));
                chip1.position.set(0.2, 0, 0);
                const chip2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.3), this.getMaterial('chip'));
                chip2.position.set(-0.2, 0, 0);
                const pins = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.05), this.getMaterial('metal'));
                pins.position.set(0, 0, 0.2);
                group.add(pcb, chip1, chip2, pins);
                break;

            case 'battery':
                const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 16), this.getMaterial('battery_body'));
                bat.rotation.z = Math.PI / 2;
                const posTerm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 12), this.getMaterial('metal'));
                posTerm.rotation.z = Math.PI / 2;
                posTerm.position.x = 0.32;
                group.add(bat, posTerm);
                break;

            case 'cover_green':
                const w = 1.9; const h = 0.625; const d = 4.0;  
                const stepW = w * 0.75; const stepD = d * 0.75; const stepH = 0.25; 
                let materials;
                const fallbackMat = new THREE.MeshStandardMaterial({
                    color: 0x39ff14, roughness: 0.4, transparent: false, opacity: 1.0,
                    side: THREE.DoubleSide, depthWrite: true, depthTest: true
                });

                if (textures.top) {
                    const matTop = new THREE.MeshStandardMaterial({
                        map: textures.top, transparent: false, opacity: 1.0, side: THREE.DoubleSide, depthWrite: true, depthTest: true
                    });
                    const matLong = textures.long 
                        ? new THREE.MeshStandardMaterial({ map: textures.long, transparent: false, side: THREE.DoubleSide, depthWrite: true, depthTest: true }) 
                        : fallbackMat;
                    const matShort = textures.short 
                        ? new THREE.MeshStandardMaterial({ map: textures.short, transparent: false, side: THREE.DoubleSide, depthWrite: true, depthTest: true })
                        : fallbackMat;
                    const matBottom = fallbackMat;
                    materials = [matLong, matLong, matTop, matBottom, matShort, matShort];
                } else {
                    materials = fallbackMat;
                }

                const topCover = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials);
                topCover.position.y = stepH / 2; 
                const stepMat = new THREE.MeshStandardMaterial({color: 0x228822, roughness: 0.8});
                const stepCover = new THREE.Mesh(new THREE.BoxGeometry(stepW, stepH, stepD), stepMat);
                stepCover.position.y = -(h / 2); 
                group.add(stepCover, topCover);
                break;
                
            case 'motor': {
                const motLen = 0.8;
                const motRad = 0.35;
                const frontLen = motLen * 0.3;
                const rearLen = motLen * 0.7;

                // 1. ЗАДНЯ ЧАСТИНА (Frame Color)
                const cylRear = new THREE.Mesh(
                    new THREE.CylinderGeometry(motRad, motRad, rearLen, 32),
                    this.getMaterial('frame_plastic')
                );
                cylRear.rotation.z = Math.PI / 2;
                cylRear.position.x = - (frontLen / 2); 
                group.add(cylRear);

                // 2. ПЕРЕДНЯ ЧАСТИНА (Dark Gray)
                const cylFront = new THREE.Mesh(
                    new THREE.CylinderGeometry(motRad, motRad, frontLen, 32),
                    this.getMaterial('dark_plastic')
                );
                cylFront.rotation.z = Math.PI / 2;
                cylFront.position.x = (rearLen / 2);
                group.add(cylFront);

                // 3. ПРЯМОКУТНИК З ПЛАВНИМИ ПЕРЕХОДАМИ
                const rectHeight = (motRad * 2.2) * 0.85; 
                const rectDepth = motRad * 1.6;  
                const boxMainLen = motLen * 0.6; 
                const box = new THREE.Mesh(
                    new THREE.BoxGeometry(boxMainLen, rectHeight, rectDepth),
                    this.getMaterial('frame_plastic')
                );
                group.add(box);

                // Плавні переходи
                const slopeLen = 0.15;
                const transitionGeo = new THREE.CylinderGeometry(motRad, Math.max(rectHeight, rectDepth)/1.6, slopeLen, 4);

                const tRear = new THREE.Mesh(transitionGeo, this.getMaterial('frame_plastic'));
                tRear.rotation.z = Math.PI / 2; tRear.rotation.x = Math.PI / 4; 
                tRear.position.x = -boxMainLen/2 - slopeLen/2;
                tRear.scale.set(1, rectDepth/rectHeight, 1); 
                group.add(tRear);

                const tFront = new THREE.Mesh(transitionGeo, this.getMaterial('frame_plastic'));
                tFront.rotation.z = -Math.PI / 2; tFront.rotation.x = Math.PI / 4;
                tFront.position.x = boxMainLen/2 + slopeLen/2;
                tFront.scale.set(1, rectDepth/rectHeight, 1);
                group.add(tFront);

                // 4. ВАЛ (Shaft)
                const shaftLen = 0.4 * 0.2; 
                const shaft = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.045, 0.045, shaftLen, 16),
                    this.getMaterial('orange') 
                );
                shaft.rotation.z = Math.PI / 2;
                shaft.position.x = motLen / 2 + shaftLen / 2; 
                group.add(shaft);

                // 5. 4 ОТВОРИ
                const holeRad = 0.03;
                const holeDistance = 0.20; 
                const holesGroup = new THREE.Group();
                holesGroup.position.x = motLen / 2;
                for (let i = 0; i < 4; i++) {
                    const angle = i * Math.PI / 2; 
                    const hole = new THREE.Mesh(new THREE.CylinderGeometry(holeRad, holeRad, 0.05, 16), this.getMaterial('port_black'));
                    hole.rotation.z = Math.PI / 2;
                    hole.position.y = holeDistance * Math.cos(angle);
                    hole.position.z = holeDistance * Math.sin(angle);
                    hole.position.x = 0.01; 
                    holesGroup.add(hole);
                }
                group.add(holesGroup);

                // 6. ПОРТ ПІДКЛЮЧЕННЯ (RJ45)
                const portGroup = new THREE.Group();
                portGroup.position.set(-motLen/2, 0.2, 0); portGroup.rotation.y = Math.PI; 
                
                const pHeight = 0.1; const pWidth = 0.275; const pDepth = 0.2;
                const portBody = new THREE.Mesh(new THREE.BoxGeometry(pDepth, pHeight, pWidth), this.getMaterial('port_gray'));
                portBody.position.x = 0.05; portGroup.add(portBody);

                const portHole = new THREE.Mesh(new THREE.BoxGeometry(0.05, pHeight * 0.6, pWidth * 0.7), this.getMaterial('black_void'));
                portHole.position.x = 0.13; portGroup.add(portHole);

                const pinGeo = new THREE.BoxGeometry(0.01, 0.02, 0.015);
                const pinCount = 8; const pinSpacing = (pWidth * 0.5) / pinCount;
                for(let k=0; k<pinCount; k++) {
                    const pin = new THREE.Mesh(pinGeo, this.getMaterial('gold'));
                    pin.position.z = -((pinCount-1)*pinSpacing)/2 + k * pinSpacing;
                    pin.position.y = -pHeight * 0.25; pin.position.x = 0.13; 
                    portGroup.add(pin);
                }
                
                const latch = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.06), this.getMaterial('black_void'));
                latch.position.set(0.13, pHeight * 0.25, 0);
                portGroup.add(latch);

                group.add(portGroup);
                break;
            }

            case 'sensor':
                const sPlate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.1), this.getMaterial('sensor_body'));
                const eyeL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.2, 16), this.getMaterial('sensor_eye'));
                eyeL.rotation.x = Math.PI/2;
                eyeL.position.set(-0.25, 0, 0.1);
                const pupilL = new THREE.Mesh(new THREE.CircleGeometry(0.08, 16), this.getMaterial('sensor_pupil'));
                pupilL.position.set(0, 0.11, 0); 
                pupilL.rotation.x = -Math.PI/2;
                eyeL.add(pupilL);
                const eyeR = eyeL.clone();
                eyeR.position.set(0.25, 0, 0.1);
                group.add(sPlate, eyeL, eyeR);
                break;
        }

        group.userData = { isPart: true, parentGroup: group, grabbedBy: -1 };
        return group;
    }
}

export class SceneGraph {
    constructor(renderEngine) {
        this.re = renderEngine;
        this.worldRoot = new THREE.Group();
        this.worldRoot.position.set(0, -1, -6);
        this.re.scene.add(this.worldRoot);

        this.floatingRoot = new THREE.Group();
        this.floatingRoot.position.set(0, 0, -5);
        this.re.scene.add(this.floatingRoot);

        this.dispenserRoot = new THREE.Group();
        this.dispenserRoot.position.set(0, 0, -5);
        this.re.scene.add(this.dispenserRoot);

        this.cursors = [this.createCursor(), this.createCursor()];
        this.cursors.forEach(c => this.re.scene.add(c));

        this.initChassis();
    }

    createCursor() {
        const g = new THREE.Group();
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.04), new THREE.MeshBasicMaterial({color: CONFIG.THEME.CURSOR_OPEN, depthTest: false}));
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.09, 32), new THREE.MeshBasicMaterial({color: CONFIG.THEME.CURSOR_OPEN, side: THREE.DoubleSide, transparent:true, opacity:0.5, depthTest: false}));
        g.add(dot, ring);
        g.userData = { dot, ring };
        g.visible = false;
        return g;
    }

    initChassis() {
        const frameMat = new THREE.MeshStandardMaterial({ color: CONFIG.THEME.CHASSIS_COLOR, roughness: 0.7, metalness: 0.1 });
        const holeMat = new THREE.MeshBasicMaterial({color: 0x111111});
        const frameGroup = new THREE.Group();
        this.worldRoot.add(frameGroup);

        const sideGeo = new THREE.BoxGeometry(0.15, 0.3, 4.0);
        const leftBeam = new THREE.Mesh(sideGeo, frameMat); leftBeam.position.set(-0.85, 0, 0); frameGroup.add(leftBeam);
        const rightBeam = new THREE.Mesh(sideGeo, frameMat); rightBeam.position.set(0.85, 0, 0); frameGroup.add(rightBeam);

        const crossGeo = new THREE.BoxGeometry(1.55, 0.3, 0.15);
        const frontCross = new THREE.Mesh(crossGeo, frameMat); frontCross.position.set(0, 0, -0.8); frameGroup.add(frontCross);
        const backCross = new THREE.Mesh(crossGeo, frameMat); backCross.position.set(0, 0, 0.8); frameGroup.add(backCross);

        const centerBeamGeo = new THREE.BoxGeometry(0.3, 0.3, 1.6);
        const centerBeam = new THREE.Mesh(centerBeamGeo, frameMat); centerBeam.position.set(0, 0, 0); frameGroup.add(centerBeam);

        const sideHoleGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.16, 8); sideHoleGeo.rotateZ(Math.PI/2);
        const zPositionsSide = [-1.8, -0.5, 0, 0.5, 1.8]; 
        zPositionsSide.forEach(z => {
            const hl = new THREE.Mesh(sideHoleGeo, holeMat); hl.position.set(-0.85, 0, z); frameGroup.add(hl);
            const hr = new THREE.Mesh(sideHoleGeo, holeMat); hr.position.set(0.85, 0, z); frameGroup.add(hr);
        });

        const midHoleGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.31, 8); 
        const h1 = new THREE.Mesh(midHoleGeo, holeMat); h1.position.set(0, 0, -0.8); frameGroup.add(h1);
        const h2 = new THREE.Mesh(midHoleGeo, holeMat); h2.position.set(0, 0, 0.8); frameGroup.add(h2);
        
        const zPositionsCenter = [-0.6, -0.2, 0.2, 0.6];
        zPositionsCenter.forEach(z => {
            const hc = new THREE.Mesh(midHoleGeo, holeMat); hc.position.set(0, 0, z); frameGroup.add(hc);
        });

        const axMat = new THREE.MeshStandardMaterial({color:0x888888});
        const axGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.9, 12); 
        const fAxle = new THREE.Mesh(axGeo, axMat); fAxle.rotation.z = Math.PI/2; fAxle.position.set(0, 0, -1.2); this.worldRoot.add(fAxle);
        const bAxle = new THREE.Mesh(axGeo, axMat); bAxle.rotation.z = Math.PI/2; bAxle.position.set(0, 0, 1.2); this.worldRoot.add(bAxle);
        const stub = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8);
        [-1.0, 0.0, 1.0].forEach(z => { const m = new THREE.Mesh(stub, axMat); m.rotation.z = Math.PI/2; m.position.set(-1.05, 0, z); this.worldRoot.add(m); });
        [-1.2, -0.4, 0.4, 1.2].forEach(z => { const m = new THREE.Mesh(stub, axMat); m.rotation.z = Math.PI/2; m.position.set(1.05, 0, z); this.worldRoot.add(m); });
    }

    updateCursorState(index, pos, mode) {
        if (index >= this.cursors.length) return;
        const cursor = this.cursors[index];
        cursor.visible = true;
        cursor.position.copy(pos);
        let col = CONFIG.THEME.CURSOR_OPEN;
        let scale = 1.2;
        
        if (mode === 1) { // GRAB
            col = CONFIG.THEME.CURSOR_CLOSED; scale = 0.8; 
        } else if (mode === 2) { // ROTATE
            col = CONFIG.THEME.CURSOR_ROTATE; scale = 1.5; 
        } else if (mode === 3) { // SCALE/ZOOM
            col = CONFIG.THEME.CURSOR_SCALE; scale = 1.4;
        }

        cursor.userData.dot.material.color.setHex(col);
        cursor.userData.ring.material.color.setHex(col);
        cursor.userData.ring.scale.setScalar(scale);
    }

    hideCursors() { this.cursors.forEach(c => c.visible = false); }

    createDispenser(type, pos) {
        const group = new THREE.Group();
        group.position.copy(pos);
        const base = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 0.1, 1.2),
            new THREE.MeshStandardMaterial({color: CONFIG.THEME.DISPENSER_BASE, metalness: 0.5})
        );
        group.add(base);
        const preview = ModelFactory.createPart(type);
        preview.scale.setScalar(0.7);
        preview.position.set(0, 0.5, 0);
        preview.traverse(c => {
            if(c.isMesh) {
                c.material = c.material.clone();
                c.material.transparent = true;
                c.material.opacity = 0.8;
                c.material.emissive = new THREE.Color(0x004488);
                c.material.emissiveIntensity = 0.2;
            }
        });
        group.add(preview);
        const hitbox = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), new THREE.MeshBasicMaterial({visible: false}));
        group.add(hitbox);
        group.userData = { isDispenser: true, type: type, previewMesh: preview, baseMesh: base, lastDispenseTime: 0 };
        this.dispenserRoot.add(group);
        return group;
    }
}
