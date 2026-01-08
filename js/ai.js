export class GestureClassifier {
    constructor() {
        this.model = null;
        this.classes = ['Idle', 'Grab', 'Rotate', 'Zoom'];
        this.history = [];
        this.historySize = 5; 
        this.isReady = false;
    }

    async load(customFiles = null) {
        try {
            if (customFiles) {
                console.log("Loading custom model...");
                this.model = await tf.loadLayersModel(tf.io.browserFiles(customFiles));
                console.log("✅ Custom Model Loaded");
            } else {
                console.log("Loading default model from ./AI/...");
                this.model = await tf.loadLayersModel('./AI/gesture-model.json');
                console.log("✅ Default Model Loaded");
            }
            this.isReady = true;
            const dummy = tf.zeros([1, 63]);
            this.model.predict(dummy).dispose();
            dummy.dispose();
            return true;
        } catch (e) {
            console.error("AI Load Error:", e);
            return false;
        }
    }

    preprocess(landmarks) {
        const wrist = landmarks[0];
        const flat = [];
        let max = 0;
        for (let lm of landmarks) {
            let x = lm.x - wrist.x;
            let y = lm.y - wrist.y;
            let z = lm.z - wrist.z;
            flat.push(x, y, z);
            max = Math.max(max, Math.abs(x), Math.abs(y), Math.abs(z));
        }
        return flat.map(v => v / (max + 0.000001));
    }

    predict(landmarks) {
        if (!this.isReady || !this.model) return 'Idle';
        return tf.tidy(() => {
            const input = tf.tensor2d([this.preprocess(landmarks)]);
            const pred = this.model.predict(input);
            const idx = pred.argMax(1).dataSync()[0];
            const conf = pred.dataSync()[idx];
            
            this.history.push({ idx, conf });
            if (this.history.length > this.historySize) this.history.shift();
            
            const counts = {};
            this.history.forEach(h => counts[h.idx] = (counts[h.idx] || 0) + 1);
            const stableIdx = parseInt(Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b));
            return this.classes[stableIdx];
        });
    }
}
