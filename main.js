// Scene setup
const scene = new THREE.Scene();
const container = document.getElementById('scene-container');
const windowWidth = window.innerWidth;
const windowHeight = window.innerHeight;

// Internal render resolution (480p)
const renderWidth = 800;  // 480p width (16:9 aspect)
const renderHeight = 480; // 480p height

// Camera - Top-down view with 45 degree downward tilt
const camera = new THREE.PerspectiveCamera(75, renderWidth / renderHeight, 0.1, 1000);
camera.position.set(0, 12, 12);
camera.lookAt(0, 0, 0);

// Renderer - full window size
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(windowWidth, windowHeight);
renderer.setPixelRatio(1); // Pixel perfect rendering
renderer.setClearColor(0x87ceeb); // Sky blue
container.appendChild(renderer.domElement);

// Create render target for 480p resolution
const renderTarget = new THREE.WebGLRenderTarget(renderWidth, renderHeight);
// Apply nearest neighbor filtering to render target texture
renderTarget.texture.magFilter = THREE.NearestFilter;
renderTarget.texture.minFilter = THREE.NearestFilter;

// Create display camera and scene for showing render target
const displayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const displayScene = new THREE.Scene();
const displayGeometry = new THREE.PlaneGeometry(2, 2);
const displayMaterial = new THREE.MeshBasicMaterial({ map: renderTarget.texture });
displayMaterial.magFilter = THREE.NearestFilter;
displayMaterial.minFilter = THREE.NearestFilter;
const displayQuad = new THREE.Mesh(displayGeometry, displayMaterial);
displayScene.add(displayQuad);

// Load environment model (includes lighting from Blender scene)
let environment = null;
const envGltfLoader = new THREE.GLTFLoader();
envGltfLoader.load('assets/models/env.glb', (gltf) => {
    environment = gltf.scene;
    console.log('Environment loaded:', environment);
    
    // Ensure all meshes in the GLB are visible
    environment.traverse((child) => {
        if (child.isMesh) {
            child.visible = true;
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    
    scene.add(environment);
    console.log('Environment added to scene');
}, undefined, (error) => {
    console.error('Error loading environment:', error);
});

// Create 8 spotlights for repositioning
const spotlights = [];
const spotlightPositions = [
    new THREE.Vector3(-6.90, 8.00, -6.40),
    new THREE.Vector3(6.60, 8.00, -5.40),
    new THREE.Vector3(-10.50, 8.00, 0.30),
    new THREE.Vector3(7.50, 8.00, -0.50),
    new THREE.Vector3(-8.30, 8.00, 3.40),
    new THREE.Vector3(6.50, 8.00, 3.70),
    new THREE.Vector3(-5.40, 8.00, 6.60),
    new THREE.Vector3(4.80, 8.00, 5.00)
];

for (let i = 0; i < 8; i++) {
    const spotlight = new THREE.SpotLight(0xffffff, 0.4, 25, Math.PI / 2, 0.5, 1);
    spotlight.position.copy(spotlightPositions[i]);
    spotlight.target.position.set(spotlight.position.x, 0, spotlight.position.z);
    spotlight.castShadow = true;
    scene.add(spotlight);
    scene.add(spotlight.target);
    spotlights.push(spotlight);
}

// Store world positions for creature pathfinding
let bedPosition = new THREE.Vector3(-12.10, 0.50, 8.90);
let dispenserPosition = new THREE.Vector3(-9.50, 0.50, -10.10);
let foodItem = null;
let foodAvailable = false;

// Debug mode for repositioning spotlights
let debugMode = false;
let selectedSpotlight = 0; // 0-7 for the 8 spotlights

// Debug menu UI
function createDebugMenu() {
    const debugPanel = document.createElement('div');
    debugPanel.id = 'debug-menu';
    debugPanel.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.8);
        color: #0f0;
        font-family: monospace;
        padding: 15px;
        border: 2px solid #0f0;
        font-size: 12px;
        line-height: 1.6;
        max-width: 280px;
        z-index: 1000;
        display: none;
    `;
    
    debugPanel.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px;">DEBUG MENU (D to toggle)</div>
        <div style="margin-bottom: 8px;">
            <div>Spotlight: <span id="spotlight-num">1</span>/8</div>
            <div style="font-size: 10px; color: #0a0;">Press T to switch spotlight</div>
        </div>
        <div style="margin-bottom: 8px;">
            <div>Position:</div>
            <div>X: <span id="spot-x">0.00</span></div>
            <div>Y: <span id="spot-y">8.00</span></div>
            <div>Z: <span id="spot-z">0.00</span></div>
        </div>
        <div style="font-size: 10px; color: #0a0; margin-top: 10px;">
            <div>Controls:</div>
            <div>Arrow Keys / WASD: Move X/Z</div>
            <div>Q/E: Move Y up/down</div>
            <div>1/2: Adjust speed</div>
            <div>C: Copy position to console</div>
        </div>
    `;
    
    document.body.appendChild(debugPanel);
    return debugPanel;
}

let debugPanel = createDebugMenu();
let debugMoveSpeed = 0.1;
let keysPressed = {}

document.getElementById('stats-panel').style.display = 'none';
// ─── UI Overlay ───────────────────────────────────────────────────────────────
const uiOverlay = document.createElement('img');
uiOverlay.src = 'assets/UI.png';
uiOverlay.id = 'ui-overlay';
uiOverlay.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: 50;
    top: 0; left: 0;
    width: 100%; height: 100%;
    object-fit: cover;
`;
document.body.appendChild(uiOverlay);

// ─── Bar position + size state ────────────────────────────────────────────────
const barConfigs = {
    hunger:     { el: null, fillEl: null, x: 0, y: 0, w: 20, h: 120, label: 'Hunger Bar' },
    energy:     { el: null, fillEl: null, x: 0, y: 0, w: 20, h: 120, label: 'Energy Bar' },
    excitement: { el: null, fillEl: null, x: 0, y: 0, w: 20, h: 120, label: 'Excitement Bar' },
};

function initBarDebug() {
    barConfigs.hunger.el        = document.getElementById('hunger-fill')?.closest('.stat-bar') || document.getElementById('hunger-fill')?.parentElement;
    barConfigs.energy.el        = document.getElementById('energy-fill')?.closest('.stat-bar')  || document.getElementById('energy-fill')?.parentElement;
    barConfigs.excitement.el    = document.getElementById('excitement-fill')?.closest('.stat-bar') || document.getElementById('excitement-fill')?.parentElement;
    barConfigs.hunger.fillEl    = document.getElementById('hunger-fill');
    barConfigs.energy.fillEl    = document.getElementById('energy-fill');
    barConfigs.excitement.fillEl= document.getElementById('excitement-fill');
}

function applyBarOffsets() {
    Object.values(barConfigs).forEach(cfg => {
        if (!cfg.el) return;
        cfg.el.style.position = 'relative';
        cfg.el.style.left     = cfg.x + 'px';
        cfg.el.style.top      = cfg.y + 'px';
        cfg.el.style.width    = cfg.w + 'px';
        cfg.el.style.height   = cfg.h + 'px';
    });
}

// ─── Bar debug panel ──────────────────────────────────────────────────────────
const barDebugPanel = document.createElement('div');
barDebugPanel.id = 'bar-debug-panel';
barDebugPanel.style.cssText = `
    position: fixed;
    bottom: 10px; right: 10px;
    background: rgba(0,0,0,0.85);
    color: #0ff;
    font-family: monospace;
    font-size: 11px;
    padding: 12px 16px;
    border: 1px solid #0ff;
    z-index: 2000;
    line-height: 1.8;
    display: none;
    min-width: 300px;
`;

barDebugPanel.innerHTML = `
    <div style="font-weight:bold;margin-bottom:8px;">BAR DEBUG (B to toggle)</div>
    ${['hunger','energy','excitement'].map(k => `
    <div style="margin-bottom:8px;border-top:1px solid #044;padding-top:6px;">
        <span style="color:#ff0;">${barConfigs[k].label}</span><br>
        <span style="color:#888;font-size:10px;">Position</span><br>
        X: <input id="bar-${k}-x" type="number" value="0" step="1"
            style="width:50px;background:#111;color:#0ff;border:1px solid #0ff;padding:1px 3px;">
        Y: <input id="bar-${k}-y" type="number" value="0" step="1"
            style="width:50px;background:#111;color:#0ff;border:1px solid #0ff;padding:1px 3px;"><br>
        <span style="color:#888;font-size:10px;">Size</span><br>
        W: <input id="bar-${k}-w" type="number" value="20" step="1" min="4"
            style="width:50px;background:#111;color:#0ff;border:1px solid #0ff;padding:1px 3px;">
        H: <input id="bar-${k}-h" type="number" value="120" step="1" min="10"
            style="width:50px;background:#111;color:#0ff;border:1px solid #0ff;padding:1px 3px;">
        <button onclick="resetBar('${k}')"
            style="background:#300;color:#f66;border:1px solid #f66;
                   padding:1px 5px;cursor:pointer;margin-left:4px;">↺</button>
    </div>`).join('')}
    <div style="color:#888;font-size:10px;margin-top:6px;">
        Arrow keys nudge selected bar position<br>
        Shift+Arrow nudges size (W/H)<br>
        Click any input to select that bar
    </div>
    <div style="margin-top:6px;">Selected: <span id="bar-selected-label" style="color:#ff0;">—</span></div>
`;
document.body.appendChild(barDebugPanel);

let selectedBar = null;

// Wire up all inputs
['hunger','energy','excitement'].forEach(k => {
    ['x','y','w','h'].forEach(prop => {
        const inp = document.getElementById(`bar-${k}-${prop}`);
        if (!inp) return;
        inp.addEventListener('input', () => {
            barConfigs[k][prop] = parseFloat(inp.value) || 0;
            applyBarOffsets();
        });
        inp.addEventListener('click', () => {
            selectedBar = k;
            document.getElementById('bar-selected-label').textContent = barConfigs[k].label;
        });
    });
});

window.resetBar = function(k) {
    barConfigs[k].x = 0; barConfigs[k].y = 0;
    barConfigs[k].w = 20; barConfigs[k].h = 120;
    document.getElementById(`bar-${k}-x`).value = 0;
    document.getElementById(`bar-${k}-y`).value = 0;
    document.getElementById(`bar-${k}-w`).value = 20;
    document.getElementById(`bar-${k}-h`).value = 120;
    applyBarOffsets();
};

// Arrow keys: plain = nudge position, Shift = nudge size
window.addEventListener('keydown', (e) => {
    if (barDebugPanel.style.display === 'none') return;
    if (!selectedBar) return;
    // Don't steal keys while typing in an input
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;

    const step = 1;
    const cfg = barConfigs[selectedBar];

    if (e.shiftKey) {
        // Shift+arrow = resize
        if (e.key === 'ArrowLeft')  { cfg.w = Math.max(4,  cfg.w - step); document.getElementById(`bar-${selectedBar}-w`).value = cfg.w; e.preventDefault(); }
        if (e.key === 'ArrowRight') { cfg.w += step;                       document.getElementById(`bar-${selectedBar}-w`).value = cfg.w; e.preventDefault(); }
        if (e.key === 'ArrowUp')    { cfg.h = Math.max(10, cfg.h - step);  document.getElementById(`bar-${selectedBar}-h`).value = cfg.h; e.preventDefault(); }
        if (e.key === 'ArrowDown')  { cfg.h += step;                       document.getElementById(`bar-${selectedBar}-h`).value = cfg.h; e.preventDefault(); }
    } else {
        // Plain arrow = reposition
        if (e.key === 'ArrowLeft')  { cfg.x -= step; document.getElementById(`bar-${selectedBar}-x`).value = cfg.x; e.preventDefault(); }
        if (e.key === 'ArrowRight') { cfg.x += step; document.getElementById(`bar-${selectedBar}-x`).value = cfg.x; e.preventDefault(); }
        if (e.key === 'ArrowUp')    { cfg.y -= step; document.getElementById(`bar-${selectedBar}-y`).value = cfg.y; e.preventDefault(); }
        if (e.key === 'ArrowDown')  { cfg.y += step; document.getElementById(`bar-${selectedBar}-y`).value = cfg.y; e.preventDefault(); }
    }
    applyBarOffsets();
});

// Toggle bar debug panel with B key
window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'b') {
        const showing = barDebugPanel.style.display === 'block';
        barDebugPanel.style.display = showing ? 'none' : 'block';
        if (!showing) { initBarDebug(); applyBarOffsets(); }
    }
});

// Debug menu toggle with D key
window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'd') {
        debugMode = !debugMode;
        debugPanel.style.display = debugMode ? 'block' : 'none';
    }
    if (debugMode) {
        keysPressed[event.key.toLowerCase()] = true;
        
        // Switch spotlight with T
        if (event.key.toLowerCase() === 't') {
            selectedSpotlight = (selectedSpotlight + 1) % 8;
            document.getElementById('spotlight-num').textContent = selectedSpotlight + 1;
        }
        
        // Copy position to console with C
        if (event.key.toLowerCase() === 'c') {
            const pos = spotlights[selectedSpotlight].position;
            console.log(`Spotlight ${selectedSpotlight + 1} Position: new THREE.Vector3(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
        }
        
        // Adjust speed
        if (event.key === '1') {
            debugMoveSpeed = Math.max(0.01, debugMoveSpeed - 0.05);
        }
        if (event.key === '2') {
            debugMoveSpeed = Math.min(1, debugMoveSpeed + 0.05);
        }
    }
});

window.addEventListener('keyup', (event) => {
    keysPressed[event.key.toLowerCase()] = false;
});

// Update debug positions every frame
function updateDebugPositions() {
    if (!debugMode) return;
    
    const spotlight = spotlights[selectedSpotlight];
    
    // Movement with arrow keys or WASD
    if (keysPressed['arrowup'] || keysPressed['w']) spotlight.position.z -= debugMoveSpeed;
    if (keysPressed['arrowdown'] || keysPressed['s']) spotlight.position.z += debugMoveSpeed;
    if (keysPressed['arrowleft'] || keysPressed['a']) spotlight.position.x -= debugMoveSpeed;
    if (keysPressed['arrowright'] || keysPressed['d']) spotlight.position.x += debugMoveSpeed;
    if (keysPressed['q']) spotlight.position.y -= debugMoveSpeed;
    if (keysPressed['e']) spotlight.position.y += debugMoveSpeed;
    
    // Update target position for spotlight
    spotlight.target.position.set(spotlight.position.x, 0, spotlight.position.z);
    
    // Update display
    document.getElementById('spot-x').textContent = spotlight.position.x.toFixed(2);
    document.getElementById('spot-y').textContent = spotlight.position.y.toFixed(2);
    document.getElementById('spot-z').textContent = spotlight.position.z.toFixed(2);
}

// Raycaster for mouse clicks
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function createSquareOutlineTexture(colorHex, labelText = null) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const color = `#${colorHex.toString(16).padStart(6, '0')}`;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

    if (labelText) {
        ctx.fillStyle = color;
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(labelText, canvas.width - 8, 8);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

// Create a camera-facing square overlay sprite
function createInteractionOverlay(size, color, labelText = null) {
    const texture = createSquareOutlineTexture(color, labelText);
    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.95,
        depthTest: false,
        depthWrite: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(size, size, 1);
    sprite.renderOrder = 998;
    sprite.visible = false;
    scene.add(sprite);
    return sprite;
}

const overlayColor = 0x33ff66;
const fetchInteractionOverlay = createInteractionOverlay(2.2, overlayColor, 'Play fetch');
const hideSeekInteractionOverlay = createInteractionOverlay(2.8, overlayColor, 'Start hide and seek');
const dispenserInteractionOverlay = createInteractionOverlay(2.2, overlayColor, 'Click for food');

// Play toy (draggable object)
let toy = null;
const toyStartPosition = new THREE.Vector3(0, 0.3, 5); // Original position - in front of creature

// Fallback toy mesh for safety while GLB loads
const toyGeom = new THREE.BoxGeometry(0.6, 0.4, 0.6);
const toyMat = new THREE.MeshStandardMaterial({ color: 0xFF1493 });
toy = new THREE.Mesh(toyGeom, toyMat);
toy.position.copy(toyStartPosition);
scene.add(toy);

// Replace fallback toy with fetchObject model
const fetchObjectLoader = new THREE.GLTFLoader();
fetchObjectLoader.load('assets/models/fetchObject.glb', (gltf) => {
    const fetchObject = gltf.scene;
    fetchObject.position.copy(toyStartPosition);
    fetchObject.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    scene.remove(toy);
    toy = fetchObject;
    scene.add(toy);
    console.log('Fetch object loaded');
}, undefined, (error) => {
    console.error('Error loading fetchObject.glb:', error);
});

// Track dragging
let isDraggingToy = false;
let toyDragOffset = new THREE.Vector3();

// Food model template (falls back to sphere if load fails)
let foodTemplate = null;
const foodLoader = new THREE.GLTFLoader();
foodLoader.load('assets/models/food.glb', (gltf) => {
    foodTemplate = gltf.scene;
    foodTemplate.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    console.log('Food model loaded');
}, undefined, (error) => {
    console.warn('Food model load failed, using sphere fallback:', error);
});

// Multiple hiding spots for hide-and-seek
const hideSpots = [
    new THREE.Vector3(8, 0.5, -7),
    new THREE.Vector3(-8, 0.5, -8),
    new THREE.Vector3(10, 0.5, 5),
    new THREE.Vector3(-12, 0.5, 2),
    new THREE.Vector3(5, 0.5, 8)
];

// Green highlight squares for all hide piles during hide-and-seek
const hidePileOverlays = hideSpots.map((spot) => {
    const overlay = createInteractionOverlay(2.4, overlayColor);
    overlay.position.set(spot.x, 0.06, spot.z);
    return overlay;
});

// Hide spot model instances (now visually rendered)
const hideSpotGroups = [];

// Load rubbish model and place one at each hide spot position
const rubbishLoader = new THREE.GLTFLoader();
rubbishLoader.load('assets/models/rubbish.glb', (gltf) => {
    const rubbishTemplate = gltf.scene;
    hideSpots.forEach((spot, index) => {
        const rubbish = rubbishTemplate.clone(true);
        rubbish.userData.hideSpotIndex = index;
        // Keep rubbish pivot at ground level (y = 0)
        rubbish.position.set(spot.x, 0, spot.z);
        rubbish.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                child.userData.hideSpotIndex = index;
            }
        });
        scene.add(rubbish);
        hideSpotGroups.push(rubbish);
    });
    console.log('Rubbish props loaded:', hideSpotGroups.length);
}, undefined, (error) => {
    console.error('Error loading rubbish.glb:', error);
});

let selectedHideSpot = null; // Will be set when hide-and-seek starts
let selectedHideSpotIndex = -1;

function startHideAndSeek() {
    creature.actionState = 'playing_hide_and_seek';
    creature.playSubstate = 'hide_and_seek';
    creature.isHiding = false;
    creature.isReturningFromHide = false;
    creature.atCenter = false;
    creature.removeTargetIndicator();
    selectedHideSpotIndex = Math.floor(Math.random() * hideSpots.length);
    selectedHideSpot = hideSpots[selectedHideSpotIndex];
}

// Handle mouse clicks and toy dragging
let mouseDown = false;
window.addEventListener('mousedown', (event) => {
    mouseDown = true;
    isDraggingToy = false; // Reset drag state at start
    
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    
    // Check if toy is clicked
    const toyIntersects = toy ? raycaster.intersectObject(toy, true) : [];
    if (toyIntersects.length > 0) {
        isDraggingToy = true;
        // Calculate offset for dragging
        toyDragOffset.copy(toy.position).sub(toyIntersects[0].point);
        return;
    }
    
    // Check if dispenser is clicked (click near dispenser position on environment)
    if (environment && !foodAvailable) {
        const dispenserIntersects = raycaster.intersectObject(environment, true);
        if (dispenserIntersects.length > 0) {
            // Check if click is near the dispenser position
            const clickPoint = dispenserIntersects[0].point;
            const distToDispenser = clickPoint.distanceTo(dispenserPosition);
            if (distToDispenser < 2) {  // Click within 2 units of dispenser
                // Dispense food
                foodAvailable = true;
                
                if (foodItem) {
                    scene.remove(foodItem);
                }
                
                // Create food item (use GLB if available, fallback to sphere)
                if (foodTemplate) {
                    foodItem = foodTemplate.clone(true);
                } else {
                    const foodGeom = new THREE.SphereGeometry(0.3, 8, 8);
                    const foodMat = new THREE.MeshStandardMaterial({ color: 0xFFD700 });
                    foodItem = new THREE.Mesh(foodGeom, foodMat);
                }
                foodItem.position.copy(dispenserPosition);
                foodItem.position.y = 1;
                scene.add(foodItem);
                return;
            }
        }
    }
    
    // Check if hide-and-seek start area is clicked while bored and waiting at center
    if (creature.actionState === 'bored' && creature.atCenter) {
        // Allow clicking anywhere inside the highlighted square area
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const clickOnGround = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(groundPlane, clickOnGround)) {
            const clickDist = clickOnGround.distanceTo(new THREE.Vector3(creature.mesh.position.x, 0, creature.mesh.position.z));
            if (clickDist <= 1.4) {
                startHideAndSeek();
                return;
            }
        }

        // Original creature click still works
        const creatureIntersects = raycaster.intersectObject(creature.mesh);
        if (creatureIntersects.length > 0) {
            startHideAndSeek();
            return;
        }
    }
    
    // Check if the correct rubbish pile is clicked while creature is hiding
    if (creature.actionState === 'playing_hide_and_seek' && creature.isHiding) {
        const rubbishIntersects = hideSpotGroups.length > 0 ? raycaster.intersectObjects(hideSpotGroups, true) : [];
        if (rubbishIntersects.length > 0) {
            const clickedIndex = rubbishIntersects[0].object.userData.hideSpotIndex;
            if (clickedIndex === selectedHideSpotIndex) {
                creature.foundByPlayer = true;
            }
        }
    }
});

window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    if (isDraggingToy && mouseDown) {
        raycaster.setFromCamera(mouse, camera);
        
        // Find intersection with ground plane for dragging
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const dragPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(groundPlane, dragPoint);
        
        toy.position.copy(dragPoint);
        toy.position.y = 0.3;
    }
});

window.addEventListener('mouseup', () => {
    // If toy was being dragged and creature is bored, trigger fetch
    if (isDraggingToy && creature.actionState === 'bored' && creature.atCenter) {
        creature.actionState = 'playing_fetch';
        creature.playSubstate = 'fetch';
        creature.removeTargetIndicator();
        creature.hasToy = false;
    }
    
    isDraggingToy = false;
    mouseDown = false;
});
// Load LittleGuy model
let modelMesh = null;
let animationMixer = null;
let idleAction = null;
let walkAction = null;
let currentAnimation = null;

const loader = new THREE.GLTFLoader();
loader.load('assets/models/Roach.glb', (gltf) => {
    modelMesh = gltf.scene;
    modelMesh.position.y = 0;
    scene.add(modelMesh);
    
    // Hide the cube fallback since model loaded
    cube.visible = false;
    
    // Find the SkinnedMesh in the hierarchy (animation target)
    let skinnedMesh = null;
    modelMesh.traverse((child) => {
        if (child.isSkinnedMesh) {
            skinnedMesh = child;
        }
    });
    
    // Set up animation mixer on the actual skeleton
    const mixerTarget = skinnedMesh || modelMesh;
    animationMixer = new THREE.AnimationMixer(mixerTarget);
    
    // Get animation clips
    const animations = gltf.animations;
    console.log('Loaded animations:', animations.map(a => a.name));
    console.log('Number of animations:', animations.length);
    console.log('Animation clip names:', animations.map(a => `"${a.name}"`).join(', '));
    
    idleAction = animationMixer.clipAction(THREE.AnimationClip.findByName(animations, 'IDLE'));
    walkAction = animationMixer.clipAction(THREE.AnimationClip.findByName(animations, 'WALK'));
    
    console.log('Idle action found:', idleAction !== null);
    console.log('Walk action found:', walkAction !== null);
    
    // Set up animations
    if (idleAction) {
        idleAction.loop = THREE.LoopRepeat;
        idleAction.clampWhenFinished = false;
        idleAction.play();
        currentAnimation = 'idle';
        console.log('Idle animation playing');
    } else {
        console.warn('Idle action not found!');
    }
    if (walkAction) {
        walkAction.loop = THREE.LoopRepeat;
        walkAction.clampWhenFinished = false;
        console.log('Walk action setup complete');
    } else {
        console.warn('Walk action not found!');
    }
}, undefined, (error) => {
    console.error('Error loading Roach.glb:', error);
});

// Fallback cube if model doesn't load
const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0xff6b6b });
const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
cube.position.y = 0.5;
scene.add(cube);

// Creature AI - Pathfinding, Stats, and State System
const creature = {
    mesh: modelMesh || cube,
    velocity: new THREE.Vector3(0, 0, 0),
    previousPosition: new THREE.Vector3(0, 0.5, 0),
    speed: 3, // units per second
    targetPosition: new THREE.Vector3(0, 0.5, 0),
    stoppingDistance: 1.5, // Increased so creature doesn't need exact spot
    bedCloseDistance: 1, // How close to bed before "at bed"
    dispenserCloseDistance: 1.2, // How close to dispenser before "at dispenser"
    foodCloseDistance: 1.6, // How close to food before eating
    
    // Animation tracking
    isMoving: false,
    lastAnimationState: null,
    
    // Rotation tracking
    currentRotationY: 0, // Track current rotation for smooth turning
    maxTurnRate: Math.PI * 0.5, // Radians per second (360 degrees/sec for smooth curves)
    
    // Target indicator (visual cube)
    targetIndicator: null,
    
    // Idle pause timing
    pauseTimer: 0,
    pauseDuration: 0,
    isPaused: false,
    
    // Current action state
    actionState: 'idle', // idle, bored, hungry, eating, sleeping, playing_fetch, playing_hide_and_seek
    stateTimer: 0, // Time spent in current state
    playingTimer: 0, // Time spent playing (for play duration limit)
    
    // Track positions
    atBed: false,
    atDispenser: false,
    atFood: false,
    atCenter: false,
    eatingTimer: 0, // Time spent eating
    
    // Play state tracking
    playSubstate: null, // 'fetch' or 'hide_and_seek'
    isHiding: false,
    foundByPlayer: false,
    hasToy: false, // For fetch - does creature have toy
    
    // Stats (0-100 range)
    stats: {
        hunger: 50,      // 0 = starving, 100 = full
        energy: 75,      // 0 = exhausted, 100 = energised
        excitement: 50   // 0 = bored, 100 = excited
    },
    
    // Stat decay rates (per second)
    decayRates: {
        hunger: 0.013,       // Loses 5 hunger per second
        energy: 0.01,       // Loses 8 energy per second when moving
        excitement: 0.75   // Loses 3 excitement per second
    },
    
    // Ground plane bounds (27 x 20)
    groundBounds: {
        minX: -13.5,
        maxX: 13.5,
        minZ: -10,
        maxZ: 10
    },
    
    // Clamp stat value between 0 and 100
    clampStat(value) {
        return Math.max(0, Math.min(100, value));
    },
    
    // Clamp creature position to ground bounds with margin
    clampPosition() {
        const margin = 0.5; // Keep creature 0.5 units away from edges
        this.mesh.position.x = Math.max(this.groundBounds.minX + margin, Math.min(this.groundBounds.maxX - margin, this.mesh.position.x));
        this.mesh.position.z = Math.max(this.groundBounds.minZ + margin, Math.min(this.groundBounds.maxZ - margin, this.mesh.position.z));
    },
    
    // Update animation based on actual velocity
    updateAnimation() {
        // Use actual velocity magnitude to determine animation
        const velocityMagnitude = this.velocity.length();
        const movementThreshold = 0.1; // Threshold for considering creature "moving"
        
        // Determine target animation based on actual movement
        const targetAnimation = velocityMagnitude > movementThreshold ? 'walk' : 'idle';
        
        // Only switch animation if the target is different from current
        if (targetAnimation !== currentAnimation && walkAction && idleAction) {
            if (targetAnimation === 'walk') {
                // Only switch if not already walking
                if (currentAnimation !== 'walk') {
                    idleAction.stop();
                    idleAction.fadeOut(0.15);
                    walkAction.reset();
                    walkAction.play();
                    walkAction.fadeIn(0.15);
                    currentAnimation = 'walk';
                }
            } else {
                // Only switch if not already idle
                if (currentAnimation !== 'idle') {
                    walkAction.stop();
                    walkAction.fadeOut(0.15);
                    idleAction.reset();
                    idleAction.play();
                    idleAction.fadeIn(0.15);
                    currentAnimation = 'idle';
                }
            }
        }
        
        this.isMoving = velocityMagnitude > movementThreshold;
    },
    
    // Update model rotation to face the target direction with turn rate limiting
    updateRotation(deltaTime) {
        if (!this.mesh) return;
        
        const direction = new THREE.Vector3().subVectors(this.targetPosition, this.mesh.position);
        const distance = direction.length();
        
        // Always face toward target direction if there's a target to face
        if (distance > 0.01) {
            direction.normalize();
            // Calculate desired angle to face target (ignore Y, only XZ plane)
            // Add Math.PI to flip the model so front faces forward instead of backwards
            const desiredAngle = Math.atan2(direction.x, direction.z) + Math.PI;
            
            // Limit turn rate for smooth curves instead of snapping
            let angleDifference = desiredAngle - this.currentRotationY;
            
            // Handle angle wrapping (shortest path around the circle)
            while (angleDifference > Math.PI) angleDifference -= Math.PI * 2;
            while (angleDifference < -Math.PI) angleDifference += Math.PI * 2;
            
            // Determine effective turn rate based on conditions
            let effectiveTurnRate = this.maxTurnRate;
            
            // If stationary, allow unlimited turning
            if (this.velocity.length() < 0.1) {
                effectiveTurnRate = Math.PI * 10; // Very high turn rate when stopped
            } else {
                // Check distance to edges - turn faster near edges to avoid getting stuck
                const edgeMargin = 2.0; // How close to edge before emergency turning
                const distToLeftEdge = this.mesh.position.x - this.groundBounds.minX;
                const distToRightEdge = this.groundBounds.maxX - this.mesh.position.x;
                const distToFrontEdge = this.mesh.position.z - this.groundBounds.minZ;
                const distToBackEdge = this.groundBounds.maxZ - this.mesh.position.z;
                
                // Find minimum distance to any edge
                const minEdgeDist = Math.min(distToLeftEdge, distToRightEdge, distToFrontEdge, distToBackEdge);
                
                // If near edge, increase turn rate proportionally
                if (minEdgeDist < edgeMargin) {
                    const edgeFactor = 1 + (1 - minEdgeDist / edgeMargin) * 3; // Up to 4x faster near edges
                    effectiveTurnRate = this.maxTurnRate * edgeFactor;
                }
            }
            
            // Clamp to effective turn rate
            const maxTurnThisFrame = effectiveTurnRate * deltaTime;
            angleDifference = Math.max(-maxTurnThisFrame, Math.min(maxTurnThisFrame, angleDifference));
            
            // Update current rotation
            this.currentRotationY += angleDifference;
            this.mesh.rotation.y = this.currentRotationY;
        }
    },
    
    // Reapply rotation after animation mixer updates to override animation keyframes
    finalizeRotation() {
        if (!this.mesh) return;
        this.mesh.rotation.y = this.currentRotationY;
    },
    
    // Move forward in the direction the model is currently facing
    moveForward(deltaTime) {
        // Model is rotated by an extra π, so negate the forward vector
        // In world space after rotation by rotation.y (with +π offset):
        // (-sin(rotation.y), 0, -cos(rotation.y)) is the forward direction
        const forwardX = -Math.sin(this.currentRotationY);
        const forwardZ = -Math.cos(this.currentRotationY);
        
        this.mesh.position.x += forwardX * this.speed * deltaTime;
        this.mesh.position.z += forwardZ * this.speed * deltaTime;
    },
    
    evaluateState() {
        // If currently sleeping, stay sleeping until fully rested
        if (this.actionState === 'sleeping') {
            return 'sleeping';
        }
        
        // If currently hungry, stay hungry until at dispenser
        if (this.actionState === 'hungry') {
            return 'hungry';
        }
        
        // If currently eating, stay eating until done
        if (this.actionState === 'eating') {
            return 'eating';
        }
        
        // If going to food, keep going
        if (this.actionState === 'going_to_food') {
            return 'going_to_food';
        }
        
        // If currently playing, stay playing
        if (this.actionState === 'playing_fetch' || this.actionState === 'playing_hide_and_seek') {
            return this.actionState;
        }
        
        // If currently bored, stay bored until play is initiated
        if (this.actionState === 'bored') {
            return 'bored';
        }
        
        // Priority 1: Go to bed if exhausted
        if (this.stats.energy <= 20) {
            return 'tired';
        }
        
        // Priority 2: Go to dispenser if starving
        if (this.stats.hunger <= 15) {
            return 'hungry';
        }
        
        // Priority 3: Go to center if bored (excitement very low)
        if (this.stats.excitement <= 10) {
            return 'bored';
        }
        
        // Default: Idle (wander)
        return 'idle';
    },
    
    // Apply state-specific effects on stats
    applyStateEffects(deltaTime) {
        switch (this.actionState) {
            case 'tired':
                // Transitioning to bed - minimal stat change
                this.stats.energy = this.clampStat(this.stats.energy - 1 * deltaTime);
                this.stats.hunger = this.clampStat(this.stats.hunger - 3 * deltaTime);
                break;
                
            case 'sleeping':
                // Sleeping recovers energy quickly, slight hunger increase, excitement low
                this.stats.energy = this.clampStat(this.stats.energy + 30 * deltaTime);
                this.stats.hunger = this.clampStat(this.stats.hunger - 8 * deltaTime);
                this.stats.excitement = this.clampStat(this.stats.excitement - 2 * deltaTime);
                break;
                
            case 'hungry':
                // Standing at dispenser waiting - minimal stat change
                this.stats.energy = this.clampStat(this.stats.energy - 1 * deltaTime);
                this.stats.hunger = this.clampStat(this.stats.hunger - 2 * deltaTime);
                break;
                
            case 'going_to_food':
                // Moving to food - minimal energy loss (less than playing, more than idle)
                this.stats.energy = this.clampStat(this.stats.energy - 4 * deltaTime);
                this.stats.hunger = this.clampStat(this.stats.hunger - 2 * deltaTime);
                break;
                
            case 'eating':
                // Eating recovers hunger, slight energy cost
                this.stats.hunger = this.clampStat(this.stats.hunger + 25 * deltaTime);
                this.stats.energy = this.clampStat(this.stats.energy - 2 * deltaTime);
                this.stats.excitement = this.clampStat(this.stats.excitement + 2 * deltaTime);
                break;
                
            case 'bored':
                // Transitioning to center to play - minimal stat change
                this.stats.energy = this.clampStat(this.stats.energy - 1 * deltaTime);
                break;
                
            case 'playing_fetch':
                // Actively playing fetch - high excitement, energy cost, hunger cost
                this.stats.excitement = this.clampStat(this.stats.excitement + 10 * deltaTime);
                this.stats.energy = this.clampStat(this.stats.energy - 12 * deltaTime);
                this.stats.hunger = this.clampStat(this.stats.hunger - 3 * deltaTime);
                break;
                
            case 'playing_hide_and_seek':
                // Playing hide-and-seek - moderate excitement, moderate energy cost
                this.stats.excitement = this.clampStat(this.stats.excitement + 8 * deltaTime);
                this.stats.energy = this.clampStat(this.stats.energy - 6 * deltaTime);
                this.stats.hunger = this.clampStat(this.stats.hunger - 2 * deltaTime);
                break;
                
            case 'idle':
            default:
                // Idle: natural decay (handled in main decay section)
                break;
        }
    },
    
    // Pick a new random target within the ground bounds
    pickNewTarget() {
        this.targetPosition.x = THREE.MathUtils.randFloat(this.groundBounds.minX + 1.5, this.groundBounds.maxX - 1.5);
        this.targetPosition.z = THREE.MathUtils.randFloat(this.groundBounds.minZ + 1.5, this.groundBounds.maxZ - 1.5);
        this.targetPosition.y = 0.5;
        // Clamp to ensure target is always within bounds
        this.targetPosition.x = Math.max(this.groundBounds.minX + 1, Math.min(this.groundBounds.maxX - 1, this.targetPosition.x));
        this.targetPosition.z = Math.max(this.groundBounds.minZ + 1, Math.min(this.groundBounds.maxZ - 1, this.targetPosition.z));
        
        // Spawn target indicator cube
        this.spawnTargetIndicator();
    },
    
    // Target indicator disabled to keep navigation markers hidden
    spawnTargetIndicator() {
        this.targetIndicator = null;
    },
    
    // Remove the target indicator cube
    removeTargetIndicator() {
        if (this.targetIndicator) {
            scene.remove(this.targetIndicator);
            this.targetIndicator = null;
        }
    },
    
    // Update movement toward target, stats, and state
    update(deltaTime) {
        // Calculate actual velocity based on position change
        this.velocity.copy(this.mesh.position).sub(this.previousPosition).divideScalar(Math.max(deltaTime, 0.001));
        this.previousPosition.copy(this.mesh.position);
        
        this.stateTimer += deltaTime;
        
        // Apply base stat decay
        this.stats.hunger = this.clampStat(this.stats.hunger - this.decayRates.hunger * deltaTime);
        this.stats.excitement = this.clampStat(this.stats.excitement - this.decayRates.excitement * deltaTime);
        
        // Energy decays based on state
        let energyDecay;
        if (this.actionState === 'sleeping') {
            energyDecay = 0; // No decay while sleeping (recovery handled in applyStateEffects)
        } else if (this.actionState === 'playing_fetch' || this.actionState === 'playing_hide_and_seek') {
            energyDecay = this.decayRates.energy * 1.5; // Extra cost for active play
        } else {
            const direction = new THREE.Vector3().subVectors(this.targetPosition, this.mesh.position);
            const distance = direction.length();
            const isMoving = distance > this.stoppingDistance;
            energyDecay = isMoving ? this.decayRates.energy * 1.5 : this.decayRates.energy * 0.5;
        }
        this.stats.energy = this.clampStat(this.stats.energy - energyDecay * deltaTime);
        
        // Apply state-specific effects
        this.applyStateEffects(deltaTime);
        
        // Check if creature should wake up from sleep BEFORE re-evaluating state
        if (this.actionState === 'sleeping' && this.stats.energy >= 100) {
            this.stats.energy = 100;
            this.actionState = 'idle';
            this.atBed = false;
            this.pickNewTarget();
        }
        
        // NOW evaluate and transition state (after sleep completion check)
        const desiredState = this.evaluateState();
        if (desiredState !== this.actionState) {
            this.actionState = desiredState;
            this.stateTimer = 0;
            this.atBed = false;
            this.atDispenser = false;
            this.atFood = false;
            
            // Update target position when transitioning to bored
            if (desiredState === 'bored') {
                this.targetPosition.set(0, 0.5, 0);
            }
            
            // Remove target indicator when transitioning away from idle
            if (desiredState !== 'idle' && desiredState !== 'bored') {
                this.removeTargetIndicator();
            }
        }
        
        // Handle movement based on state
        if (this.actionState === 'tired') {
            // Pathfind to bed
            if (!this.atBed) {
                this.targetPosition.copy(bedPosition);
                // Clamp to ensure target is within bounds
                this.targetPosition.x = Math.max(this.groundBounds.minX + 1, Math.min(this.groundBounds.maxX - 1, this.targetPosition.x));
                this.targetPosition.z = Math.max(this.groundBounds.minZ + 1, Math.min(this.groundBounds.maxZ - 1, this.targetPosition.z));
            }
            
            const distanceToBed = this.mesh.position.distanceTo(bedPosition);
            if (distanceToBed < this.bedCloseDistance) {
                this.atBed = true;
                // Automatically transition to sleeping when at bed
                this.actionState = 'sleeping';
                this.removeTargetIndicator();
            }
            
            // Move toward bed
            if (!this.atBed) {
                this.moveForward(deltaTime);
            }
        } else if (this.actionState === 'sleeping') {
            // Already at bed, just stay there and recover
            // Movement handled automatically by being at bedPosition
        } else if (this.actionState === 'hungry') {
            // Pathfind to dispenser
            if (!this.atDispenser) {
                this.targetPosition.copy(dispenserPosition);
                // Clamp to ensure target is within bounds
                this.targetPosition.x = Math.max(this.groundBounds.minX + 1, Math.min(this.groundBounds.maxX - 1, this.targetPosition.x));
                this.targetPosition.z = Math.max(this.groundBounds.minZ + 1, Math.min(this.groundBounds.maxZ - 1, this.targetPosition.z));
            }
            
            const distanceToDispenser = this.mesh.position.distanceTo(dispenserPosition);
            if (distanceToDispenser < this.dispenserCloseDistance) {
                this.atDispenser = true;
                // Stay at dispenser waiting for food to be dispensed
            }
            
            // Move toward dispenser
            if (!this.atDispenser) {
                this.moveForward(deltaTime);
            }
            
            // Once at dispenser and food is available, transition to going_to_food
            if (this.atDispenser && foodAvailable) {
                this.actionState = 'going_to_food';
                this.atDispenser = false;
            }
        } else if (this.actionState === 'going_to_food') {
            // Pathfind to food
            if (foodItem) {
                const foodPos = foodItem.position.clone();
                foodPos.y = 0.5; // Move position to creature height
                
                const distanceToFood = this.mesh.position.distanceTo(foodPos);
                if (distanceToFood < this.foodCloseDistance) {
                    this.atFood = true;
                    // Automatically transition to eating when at food
                    this.actionState = 'eating';
                    this.eatingTimer = 0;
                    this.removeTargetIndicator();
                } else {
                    // Move toward food
                    this.moveForward(deltaTime);
                }
            }
        } else if (this.actionState === 'eating') {
            // Stay at food and eat
            this.eatingTimer += deltaTime;
            
            // Finish eating when hunger is satisfied or 3 seconds pass
            if (this.stats.hunger >= 70 || this.eatingTimer >= 3) {
                this.stats.hunger = Math.min(100, this.stats.hunger); // Cap at 100
                this.atFood = false;
                
                // Remove food
                if (foodItem) {
                    scene.remove(foodItem);
                    foodItem = null;
                    foodAvailable = false;
                }
                
                // Go back to idle
                this.actionState = 'idle';
                this.pickNewTarget();
            }
        } else if (this.actionState === 'bored') {
            // Pathfind to center to wait for play
            const centerPos = new THREE.Vector3(0, 0.5, 0);
            this.targetPosition.copy(centerPos); // Update target position to center
            const distanceToCenter = this.mesh.position.distanceTo(centerPos);
            
            if (distanceToCenter < this.stoppingDistance) {
                this.atCenter = true;
                // Stop moving, wait for player to choose fetch or hide-and-seek
            } else {
                // Move toward center
                this.moveForward(deltaTime);
            }
        } else if (this.actionState === 'playing_fetch') {
            // Fetch gameplay - creature fetches toy from ANY distance
            // Gain excitement while actively fetching
            this.stats.excitement = this.clampStat(this.stats.excitement + 5 * deltaTime);
            
            if (this.hasToy) {
                // Carry toy back to original starting position
                const toyReturnPos = new THREE.Vector3().copy(toyStartPosition);
                toyReturnPos.y = 0.5; // Creature height
                this.targetPosition.copy(toyReturnPos); // Update target for rotation
                const distanceToReturn = this.mesh.position.distanceTo(toyReturnPos);
                
                if (distanceToReturn < this.stoppingDistance) {
                    // Reached return position, drop toy and get bonus
                    this.hasToy = false;
                    toy.position.copy(toyStartPosition);
                    this.stats.excitement = this.clampStat(this.stats.excitement + 20); // Bonus for returning
                } else {
                    // Move toward return position with toy
                    this.moveForward(deltaTime);
                }
            } else {
                // Chase toy no matter the distance
                const toyDist = this.mesh.position.distanceTo(toy.position);
                const toyPos = toy.position.clone();
                toyPos.y = 0.5;
                this.targetPosition.copy(toyPos); // Update target for rotation toward toy
                
                // Always chase toy
                this.moveForward(deltaTime);
                
                // If reached toy, pick it up
                if (toyDist < this.stoppingDistance) {
                    this.hasToy = true;
                }
            }
            
            // End play if energy gets too low or 40+ seconds have passed
            this.playingTimer += deltaTime;
            if (this.stats.energy <= 20 || this.playingTimer > 40) {
                this.hasToy = false;
                this.atCenter = false;
                this.playingTimer = 0;
                toy.position.copy(toyStartPosition); // Return toy to start if abandoned
                
                // End play and go to idle
                this.actionState = 'idle';
                this.pickNewTarget();
            }
        } else if (this.actionState === 'playing_hide_and_seek') {

    // Phase 1: Return to center after being found
    if (this.isReturningFromHide) {
        const centerPos = new THREE.Vector3(0, 0.5, 0);
        this.targetPosition.copy(centerPos);
        const distanceToCenter = this.mesh.position.distanceTo(centerPos);

        if (distanceToCenter < this.stoppingDistance) {
            this.isReturningFromHide = false;
            this.atCenter = true;

            // 50/50: play again or end
            if (Math.random() < 0.5) {
                selectedHideSpotIndex = Math.floor(Math.random() * hideSpots.length);
                selectedHideSpot = hideSpots[selectedHideSpotIndex];
                this.isHiding = false;
                this.playingTimer = 0;
            } else {
                this.atCenter = false;
                this.playingTimer = 0;
                if (Math.random() < 0.5) {
                    this.actionState = 'bored';
                    this.stats.excitement = Math.max(0, this.stats.excitement - 10);
                } else {
                    this.actionState = 'idle';
                    this.pickNewTarget();
                }
            }
        } else {
            this.moveForward(deltaTime);
        }

    // Phase 2: Walk to center first
    } else if (!this.atCenter) {
        const centerPos = new THREE.Vector3(0, 0.5, 0);
        this.targetPosition.copy(centerPos);
        const distanceToCenter = this.mesh.position.distanceTo(centerPos);

        if (distanceToCenter < this.stoppingDistance) {
            this.atCenter = true;
        } else {
            this.moveForward(deltaTime);
            return;
        }

    // Phase 3: Walk to hide spot
    } else if (!this.isHiding) {
        if (selectedHideSpot) {
            this.targetPosition.copy(selectedHideSpot);
            const distanceToHide = this.mesh.position.distanceTo(selectedHideSpot);

            if (distanceToHide < this.stoppingDistance + 1) {
                this.isHiding = true;
            } else {
                this.moveForward(deltaTime);
            }
        }

    // Phase 4: Hiding — wait to be found
    } else {
        this.stats.excitement = this.clampStat(this.stats.excitement + 3 * deltaTime);

        if (this.foundByPlayer) {
            this.stats.excitement = this.clampStat(this.stats.excitement + 30);
            this.isHiding = false;
            this.foundByPlayer = false;
            this.isReturningFromHide = true; // ← trigger return phase
            selectedHideSpot = null;         // ← clear so it can't re-trigger
            selectedHideSpotIndex = -1;
        }
    }

    // End play if exhausted or timed out
    this.playingTimer += deltaTime;
    if (this.stats.energy <= 20 || this.playingTimer > 40) {
        this.isHiding = false;
        this.foundByPlayer = false;
        this.isReturningFromHide = false;
        this.atCenter = false;
        this.playingTimer = 0;
        selectedHideSpot = null;
        selectedHideSpotIndex = -1;
        this.actionState = 'idle';
        this.pickNewTarget();
    }
            // Hide and seek gameplay
            if (!this.atCenter) {
                // First go to center if not there already
                const centerPos = new THREE.Vector3(0, 0.5, 0);
                this.targetPosition.copy(centerPos); // Update target for rotation
                const distanceToCenter = this.mesh.position.distanceTo(centerPos);
                
                if (distanceToCenter < this.stoppingDistance) {
                    this.atCenter = true;
                } else {
                    // Move toward center
                    this.moveForward(deltaTime);
                    return; // Don't proceed to hiding until at center
                }
            }
            
            if (!this.isHiding) {
                // Pathfind to selected hide spot
                if (selectedHideSpot) {
                    this.targetPosition.copy(selectedHideSpot); // Update target for rotation toward hide spot
                    const distanceToHide = this.mesh.position.distanceTo(selectedHideSpot);
                    
                    if (distanceToHide < this.stoppingDistance + 1) { // Slightly larger tolerance
                        // Reached hide spot, now hiding
                        this.isHiding = true;
                    } else {
                        // Move toward hide spot
                        this.moveForward(deltaTime);
                    }
                }
            } else {
                // Hiding - gain excitement while hiding
                this.stats.excitement = this.clampStat(this.stats.excitement + 3 * deltaTime);
                
                // Waiting to be found
                if (this.foundByPlayer) {
                    // Player found us! Large excitement bonus
                    this.stats.excitement = this.clampStat(this.stats.excitement + 30);
                    this.isHiding = false;
                    this.foundByPlayer = false;
                    
                    const centerPos = new THREE.Vector3(0, 0.5, 0);
                    this.targetPosition.copy(centerPos); // Update target for rotation back to center
                    const distanceToCenter = this.mesh.position.distanceTo(centerPos);
                    
                    if (distanceToCenter > this.stoppingDistance) {
                        // Move back to center
                        this.moveForward(deltaTime);
                    } else {
                        // Back at center after being found
                        this.isHiding = false;
                        this.foundByPlayer = false;
                        // Randomly choose to play again or end
                        if (Math.random() < 0.5) {
                            // Play again immediately - pick new hide spot
                            selectedHideSpotIndex = Math.floor(Math.random() * hideSpots.length);
                            selectedHideSpot = hideSpots[selectedHideSpotIndex];
                            this.isHiding = false;
                            this.playingTimer = 0;
                            this.atCenter = true; // Stay at center, ready to hide again
                        } else {
                            // End play - 50% to go to bored, 50% to go to idle
                            this.atCenter = false;
                            this.playingTimer = 0;
                            if (Math.random() < 0.5) {
                                this.actionState = 'bored';
                                this.stats.excitement = Math.max(0, this.stats.excitement - 10);
                            } else {
                                this.actionState = 'idle';
                                this.pickNewTarget();
                            }
                        }
                    }
                }
            }
            
            // End play if energy gets too low or 40+ seconds have passed
            this.playingTimer += deltaTime;
            if (this.stats.energy <= 20 || this.playingTimer > 40) {
                this.isHiding = false;
                this.foundByPlayer = false;
                this.atCenter = false;
                this.playingTimer = 0;
                selectedHideSpot = null;
                selectedHideSpotIndex = -1;
                
                // End play and go to idle
                this.actionState = 'idle';
                this.pickNewTarget();
            }
        } else if (this.actionState !== 'eating') {
            // Idle still moves around
            const distance = this.mesh.position.distanceTo(this.targetPosition);
            
            // Pick new target periodically or when reached current
            if (distance < this.stoppingDistance) {
                // Reached target - start a pause
                if (!this.isPaused) {
                    this.isPaused = true;
                    this.pauseTimer = 0;
                    this.pauseDuration = Math.random() * 3; // 0-3 seconds
                }
            }
            
            // Handle pause timing
            if (this.isPaused) {
                this.pauseTimer += deltaTime;
                if (this.pauseTimer >= this.pauseDuration) {
                    // Pause finished, pick new target
                    this.isPaused = false;
                    this.pauseTimer = 0;
                    this.pickNewTarget();
                }
            }
            
            // Move forward in current direction only if not paused
            if (!this.isPaused && distance > 0) {
                this.moveForward(deltaTime);
            }
        }
        
        // Always keep creature within bounds
        this.clampPosition();
        
        // Update animations based on movement
        this.updateAnimation();
        
        // Update rotation to face target direction with turn rate limiting
        this.updateRotation(deltaTime);
    }
};

// Initialize with first target
creature.pickNewTarget();
creature.previousPosition.copy(creature.mesh.position);
creature.currentRotationY = creature.mesh.rotation.y;

// Handle window resize
window.addEventListener('resize', () => {
    const newWindowWidth = window.innerWidth;
    const newWindowHeight = window.innerHeight;
    camera.aspect = renderWidth / renderHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(newWindowWidth, newWindowHeight);
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Calculate delta time
    const now = performance.now();
    if (!lastTime) lastTime = now;
    const deltaTime = (now - lastTime) / 1000; // Convert to seconds
    lastTime = now;
    
    // Update creature movement and stats
    creature.update(deltaTime);
    
    // Update debug positions if debug mode is active
    updateDebugPositions();
    
    // Update animation mixer
    if (animationMixer) {
        animationMixer.update(deltaTime);
    }

    // Show contextual interaction overlays
    const isBoredWaiting = creature.actionState === 'bored' && creature.atCenter;
    if (isBoredWaiting && toy) {
        fetchInteractionOverlay.visible = true;
        fetchInteractionOverlay.position.set(toy.position.x, 1.0, toy.position.z);

        hideSeekInteractionOverlay.visible = true;
        hideSeekInteractionOverlay.position.set(
            creature.mesh ? creature.mesh.position.x : 0,
            1.0,
            creature.mesh ? creature.mesh.position.z : 0
        );
    } else {
        fetchInteractionOverlay.visible = false;
        hideSeekInteractionOverlay.visible = false;
    }

    const isWaitingForFood = creature.actionState === 'hungry' && creature.atDispenser && !foodAvailable;
    if (isWaitingForFood) {
        dispenserInteractionOverlay.visible = true;
        dispenserInteractionOverlay.position.set(dispenserPosition.x, 1.0, dispenserPosition.z);
    } else {
        dispenserInteractionOverlay.visible = false;
    }

    const isHidingAndWaiting = creature.actionState === 'playing_hide_and_seek' && creature.isHiding;
    hidePileOverlays.forEach((overlay, index) => {
        const hideSpot = hideSpots[index];
        overlay.position.set(hideSpot.x, 1.0, hideSpot.z);
        overlay.visible = isHidingAndWaiting;
    });
    
    // Render debug markers if debug mode is active
    if (debugMode) {
        // Create temporary debug markers (wireframes to show positions)
        if (!window.debugMarkers) {
            window.debugMarkers = {};
            
            // Bed marker
            const bedGeom = new THREE.BoxGeometry(1, 1, 1);
            const bedMat = new THREE.MeshBasicMaterial({ color: 0x00FF00, wireframe: true });
            window.debugMarkers.bed = new THREE.Mesh(bedGeom, bedMat);
            scene.add(window.debugMarkers.bed);
            
            // Dispenser marker
            const dispGeom = new THREE.BoxGeometry(1, 1, 1);
            const dispMat = new THREE.MeshBasicMaterial({ color: 0xFF0000, wireframe: true });
            window.debugMarkers.dispenser = new THREE.Mesh(dispGeom, dispMat);
            scene.add(window.debugMarkers.dispenser);
        }
        
        // Update marker positions
        window.debugMarkers.bed.position.copy(bedPosition);
        window.debugMarkers.dispenser.position.copy(dispenserPosition);
        window.debugMarkers.bed.visible = true;
        window.debugMarkers.dispenser.visible = true;
    } else if (window.debugMarkers) {
        // Hide markers when not in debug mode
        window.debugMarkers.bed.visible = false;
        window.debugMarkers.dispenser.visible = false;
    }
    
    // Reapply rotation AFTER mixer to override any animation rotation keyframes
    creature.finalizeRotation();
    
    // Update mesh reference if model loaded
    if (modelMesh && creature.mesh === cube) {
        creature.mesh = modelMesh;
    }
    
    // Update state display
    const stateDisplay = document.getElementById('state-display');
    stateDisplay.textContent = creature.actionState;
    stateDisplay.className = 'state-badge ' + creature.actionState;
    
    // Update UI stats display
    document.getElementById('hunger-fill').style.height = creature.stats.hunger + '%';
    document.getElementById('hunger-value').textContent = Math.round(creature.stats.hunger);
    
    document.getElementById('energy-fill').style.height = creature.stats.energy + '%';
    document.getElementById('energy-value').textContent = Math.round(creature.stats.energy);
    
    document.getElementById('excitement-fill').style.height = creature.stats.excitement + '%';
    document.getElementById('excitement-value').textContent = Math.round(creature.stats.excitement);
    
    // Gentle rotation on the creature (skip if using animated model)
    if (!modelMesh) {
        creature.mesh.rotation.x += 0.01;
        creature.mesh.rotation.y += 0.01;
    }
    
    // Render scene to 480p render target
    renderer.setRenderTarget(renderTarget);
    renderer.render(scene, camera);
    
    // Render the 480p render target to the full window
    renderer.setRenderTarget(null);
    renderer.render(displayScene, displayCamera);
}

let lastTime = 0;
animate();
