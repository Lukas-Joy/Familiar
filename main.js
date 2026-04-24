// Scene setup
const scene = new THREE.Scene();
const container = document.getElementById('scene-container');
const windowWidth = window.innerWidth;
const windowHeight = window.innerHeight;

// Internal render resolution (480p)
const renderWidth = 854;  // 480p width (16:9 aspect)
const renderHeight = 480; // 480p height

// Camera - Top-down view with 45 degree downward tilt
const camera = new THREE.PerspectiveCamera(75, renderWidth / renderHeight, 0.1, 1000);
camera.position.set(0, 12, 12);
camera.lookAt(0, 0, 0);

// Renderer - full window size
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(windowWidth, windowHeight);
renderer.setClearColor(0x87ceeb); // Sky blue
container.appendChild(renderer.domElement);

// Create render target for 480p resolution
const renderTarget = new THREE.WebGLRenderTarget(renderWidth, renderHeight);

// Create display camera and scene for showing render target
const displayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const displayScene = new THREE.Scene();
const displayGeometry = new THREE.PlaneGeometry(2, 2);
const displayMaterial = new THREE.MeshBasicMaterial({ map: renderTarget.texture });
const displayQuad = new THREE.Mesh(displayGeometry, displayMaterial);
displayScene.add(displayQuad);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 10, 5);
scene.add(directionalLight);

// Ground plane - hardcoded settings
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x90ee90 });
const groundGeometry = new THREE.PlaneGeometry(27, 20);
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.set(0, 0, 0);
scene.add(ground);

// Bed (world object)
const bedGroup = new THREE.Group();
bedGroup.position.set(-10, 0, 8);
scene.add(bedGroup);

// Bed base
const bedBaseGeom = new THREE.BoxGeometry(2, 0.2, 3);
const bedBaseMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
const bedBase = new THREE.Mesh(bedBaseGeom, bedBaseMat);
bedBase.position.y = 0.1;
bedGroup.add(bedBase);

// Bed pillow
const pillowGeom = new THREE.BoxGeometry(2, 0.3, 0.8);
const pillowMat = new THREE.MeshStandardMaterial({ color: 0xFFB6C1 });
const pillow = new THREE.Mesh(pillowGeom, pillowMat);
pillow.position.set(0, 0.4, -0.9);
bedGroup.add(pillow);

// Store bed position for creature pathfinding
const bedPosition = new THREE.Vector3(-10, 0.5, 8);

// Food Dispenser (world object)
const dispenserGroup = new THREE.Group();
dispenserGroup.position.set(10, 0, 8);
scene.add(dispenserGroup);

// Dispenser body
const dispenserBodyGeom = new THREE.BoxGeometry(1.2, 2, 1);
const dispenserMat = new THREE.MeshStandardMaterial({ color: 0xFF6347 });
const dispenserBody = new THREE.Mesh(dispenserBodyGeom, dispenserMat);
dispenserBody.position.y = 1;
dispenserGroup.add(dispenserBody);

// Dispenser top
const dispenserTopGeom = new THREE.ConeGeometry(0.8, 0.5, 8);
const dispenserTop = new THREE.Mesh(dispenserTopGeom, dispenserMat);
dispenserTop.position.y = 2.2;
dispenserGroup.add(dispenserTop);

// Store dispenser position and food state
const dispenserPosition = new THREE.Vector3(10, 0.5, 8);
let foodItem = null;
let foodAvailable = false;

// Raycaster for mouse clicks
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Play toy (draggable object)
const toyGeom = new THREE.BoxGeometry(0.6, 0.4, 0.6);
const toyMat = new THREE.MeshStandardMaterial({ color: 0xFF1493 });
const toy = new THREE.Mesh(toyGeom, toyMat);
const toyStartPosition = new THREE.Vector3(0, 0.3, 5); // Original position - in front of creature
toy.position.copy(toyStartPosition);
scene.add(toy);

// Track dragging
let isDraggingToy = false;
let toyDragOffset = new THREE.Vector3();

// Multiple hiding spots for hide-and-seek
const hideSpots = [
    new THREE.Vector3(8, 0.5, -7),
    new THREE.Vector3(-8, 0.5, -8),
    new THREE.Vector3(10, 0.5, 5),
    new THREE.Vector3(-12, 0.5, 2),
    new THREE.Vector3(5, 0.5, 8)
];

// Create visual hide spots
const hideSpotGroups = [];
hideSpots.forEach((spotPos, index) => {
    const hideSpotGroup = new THREE.Group();
    hideSpotGroup.position.copy(spotPos);
    hideSpotGroup.position.y = 0; // Position at ground level
    scene.add(hideSpotGroup);
    
    // Hide spot base - larger for easier clicking
    const hideBaseGeom = new THREE.SphereGeometry(2, 8, 8);
    const hideBaseMat = new THREE.MeshStandardMaterial({ color: 0x228B22 });
    const hideBase = new THREE.Mesh(hideBaseGeom, hideBaseMat);
    hideBase.scale.y = 0.6;
    hideBase.position.y = 1;
    hideSpotGroup.add(hideBase);
    
    hideSpotGroups.push(hideSpotGroup);
});

let selectedHideSpot = null; // Will be set when hide-and-seek starts

// Handle mouse clicks and toy dragging
let mouseDown = false;
window.addEventListener('mousedown', (event) => {
    mouseDown = true;
    isDraggingToy = false; // Reset drag state at start
    
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    
    // Check if toy is clicked
    const toyIntersects = raycaster.intersectObject(toy);
    if (toyIntersects.length > 0) {
        isDraggingToy = true;
        // Calculate offset for dragging
        toyDragOffset.copy(toy.position).sub(toyIntersects[0].point);
        return;
    }
    
    // Check if dispenser is clicked
    const dispenserIntersects = raycaster.intersectObject(dispenserGroup, true);
    if (dispenserIntersects.length > 0 && !foodAvailable) {
        // Dispense food
        foodAvailable = true;
        
        if (foodItem) {
            scene.remove(foodItem);
        }
        
        // Create food item mesh
        const foodGeom = new THREE.SphereGeometry(0.3, 8, 8);
        const foodMat = new THREE.MeshStandardMaterial({ color: 0xFFD700 });
        foodItem = new THREE.Mesh(foodGeom, foodMat);
        foodItem.position.copy(dispenserPosition);
        foodItem.position.y = 1;
        scene.add(foodItem);
        return;
    }
    
    // Check if any hide spot is clicked to trigger hide-and-seek
    let hideSpotClicked = false;
    for (let i = 0; i < hideSpotGroups.length; i++) {
        const hideSpotIntersects = raycaster.intersectObject(hideSpotGroups[i], true);
        if (hideSpotIntersects.length > 0) {
            hideSpotClicked = true;
            break;
        }
    }
    
    // Check if creature is clicked while bored and at center to trigger hide-and-seek
    if (creature.actionState === 'bored' && creature.atCenter) {
        const creatureIntersects = raycaster.intersectObject(creature.mesh);
        if (creatureIntersects.length > 0) {
            // Trigger hide-and-seek
            creature.actionState = 'playing_hide_and_seek';
            creature.playSubstate = 'hide_and_seek';
            creature.isHiding = false;
            creature.atCenter = false;
            creature.removeTargetIndicator();
            // Randomly select a hide spot
            selectedHideSpot = hideSpots[Math.floor(Math.random() * hideSpots.length)];
            return;
        }
    }
    
    // Check if hidden creature is clicked (finding him in hide and seek)
    if (creature.actionState === 'playing_hide_and_seek' && creature.isHiding) {
        const creatureIntersects = raycaster.intersectObject(creature.mesh);
        if (creatureIntersects.length > 0) {
            creature.foundByPlayer = true;
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
    
    // Set up animation mixer
    animationMixer = new THREE.AnimationMixer(modelMesh);
    
    // Get animation clips
    const animations = gltf.animations;
    idleAction = animationMixer.clipAction(THREE.AnimationClip.findByName(animations, 'IDLE'));
    walkAction = animationMixer.clipAction(THREE.AnimationClip.findByName(animations, 'WALK'));
    
    // Set up animations
    if (idleAction) {
        idleAction.loop = THREE.LoopRepeat;
        idleAction.clampWhenFinished = false;
        idleAction.play();
        currentAnimation = 'idle';
    }
    if (walkAction) {
        walkAction.loop = THREE.LoopRepeat;
        walkAction.clampWhenFinished = false;
    }
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
    foodCloseDistance: 0.8, // How close to food before eating
    
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
        hunger: 1,       // Loses 5 hunger per second
        energy: 1,       // Loses 8 energy per second when moving
        excitement: 5    // Loses 3 excitement per second
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
    
    // Spawn a visual cube at the target position
    spawnTargetIndicator() {
        // Remove old indicator if it exists
        if (this.targetIndicator) {
            scene.remove(this.targetIndicator);
        }
        
        // Create new indicator cube
        const indicatorGeom = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const indicatorMat = new THREE.MeshStandardMaterial({ color: 0x00FF00, emissive: 0x00AA00 });
        this.targetIndicator = new THREE.Mesh(indicatorGeom, indicatorMat);
        this.targetIndicator.position.copy(this.targetPosition);
        this.targetIndicator.position.y = 0.25; // Half height so bottom sits on ground
        scene.add(this.targetIndicator);
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
                            selectedHideSpot = hideSpots[Math.floor(Math.random() * hideSpots.length)];
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
    
    // Update animation mixer
    if (animationMixer) {
        animationMixer.update(deltaTime);
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
    document.getElementById('hunger-fill').style.width = creature.stats.hunger + '%';
    document.getElementById('hunger-value').textContent = Math.round(creature.stats.hunger);
    
    document.getElementById('energy-fill').style.width = creature.stats.energy + '%';
    document.getElementById('energy-value').textContent = Math.round(creature.stats.energy);
    
    document.getElementById('excitement-fill').style.width = creature.stats.excitement + '%';
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
