// Scene setup
const scene = new THREE.Scene();
const container = document.getElementById('scene-container');
const width = window.innerWidth;
const height = window.innerHeight;

// Camera - Top-down view with 45 degree downward tilt
const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
camera.position.set(0, 12, 12);
camera.lookAt(0, 0, 0);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(width, height);
renderer.setClearColor(0x87ceeb); // Sky blue
container.appendChild(renderer.domElement);

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
const toyStartPosition = new THREE.Vector3(0, 0.3, -5); // Original position
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
        creature.hasToy = false;
    }
    
    isDraggingToy = false;
    mouseDown = false;
});
const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0xff6b6b });
const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
cube.position.y = 0.5;
scene.add(cube);

// Creature AI - Pathfinding, Stats, and State System
const creature = {
    mesh: cube,
    velocity: new THREE.Vector3(0, 0, 0),
    speed: 3, // units per second
    targetPosition: new THREE.Vector3(0, 0.5, 0),
    stoppingDistance: 0.5,
    bedCloseDistance: 1, // How close to bed before "at bed"
    dispenserCloseDistance: 1.2, // How close to dispenser before "at dispenser"
    foodCloseDistance: 0.8, // How close to food before eating
    
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
        this.targetPosition.x = THREE.MathUtils.randFloat(this.groundBounds.minX + 1, this.groundBounds.maxX - 1);
        this.targetPosition.z = THREE.MathUtils.randFloat(this.groundBounds.minZ + 1, this.groundBounds.maxZ - 1);
        this.targetPosition.y = 0.5;
    },
    
    // Update movement toward target, stats, and state
    update(deltaTime) {
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
        }
        
        // Handle movement based on state
        if (this.actionState === 'tired') {
            // Pathfind to bed
            if (!this.atBed) {
                this.targetPosition.copy(bedPosition);
            }
            
            const distanceToBed = this.mesh.position.distanceTo(bedPosition);
            if (distanceToBed < this.bedCloseDistance) {
                this.atBed = true;
                // Automatically transition to sleeping when at bed
                this.actionState = 'sleeping';
            }
            
            // Move toward bed
            if (!this.atBed) {
                const direction = new THREE.Vector3().subVectors(bedPosition, this.mesh.position);
                if (direction.length() > 0) {
                    direction.normalize();
                    this.mesh.position.addScaledVector(direction, this.speed * deltaTime);
                }
            }
        } else if (this.actionState === 'sleeping') {
            // Already at bed, just stay there and recover
            // Movement handled automatically by being at bedPosition
        } else if (this.actionState === 'hungry') {
            // Pathfind to dispenser
            if (!this.atDispenser) {
                this.targetPosition.copy(dispenserPosition);
            }
            
            const distanceToDispenser = this.mesh.position.distanceTo(dispenserPosition);
            if (distanceToDispenser < this.dispenserCloseDistance) {
                this.atDispenser = true;
                // Stay at dispenser waiting for food to be dispensed
            }
            
            // Move toward dispenser
            if (!this.atDispenser) {
                const direction = new THREE.Vector3().subVectors(dispenserPosition, this.mesh.position);
                if (direction.length() > 0) {
                    direction.normalize();
                    this.mesh.position.addScaledVector(direction, this.speed * deltaTime);
                }
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
                } else {
                    // Move toward food
                    const direction = new THREE.Vector3().subVectors(foodPos, this.mesh.position);
                    if (direction.length() > 0) {
                        direction.normalize();
                        this.mesh.position.addScaledVector(direction, this.speed * deltaTime);
                    }
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
            const distanceToCenter = this.mesh.position.distanceTo(centerPos);
            
            if (distanceToCenter < this.stoppingDistance) {
                this.atCenter = true;
                // Stop moving, wait for player to choose fetch or hide-and-seek
            } else {
                // Move toward center
                const direction = new THREE.Vector3().subVectors(centerPos, this.mesh.position);
                if (direction.length() > 0) {
                    direction.normalize();
                    this.mesh.position.addScaledVector(direction, this.speed * deltaTime);
                }
            }
        } else if (this.actionState === 'playing_fetch') {
            // Fetch gameplay
            if (this.hasToy) {
                // Carry toy back to original starting position
                const toyReturnPos = new THREE.Vector3().copy(toyStartPosition);
                toyReturnPos.y = 0.5; // Creature height
                const distanceToReturn = this.mesh.position.distanceTo(toyReturnPos);
                
                if (distanceToReturn < this.stoppingDistance) {
                    // Reached return position, drop toy
                    this.hasToy = false;
                    toy.position.copy(toyStartPosition);
                    // Continue playing or check if play should end
                } else {
                    // Move toward return position with toy
                    const direction = new THREE.Vector3().subVectors(toyReturnPos, this.mesh.position);
                    if (direction.length() > 0) {
                        direction.normalize();
                        this.mesh.position.addScaledVector(direction, this.speed * deltaTime);
                    }
                }
            } else {
                // Chase toy if it exists and is within ground bounds
                const toyDist = this.mesh.position.distanceTo(toy.position);
                const toyPos = toy.position.clone();
                toyPos.y = 0.5;
                
                // Always chase toy if nearby (within 15 units)
                if (toyDist < 15) {
                    // Chase toy
                    const direction = new THREE.Vector3().subVectors(toyPos, this.mesh.position);
                    if (direction.length() > 0) {
                        direction.normalize();
                        this.mesh.position.addScaledVector(direction, this.speed * deltaTime);
                    }
                    
                    // If reached toy, pick it up
                    if (toyDist < this.stoppingDistance) {
                        this.hasToy = true;
                    }
                }
            }
            
            // End play if energy gets too low or 30+ seconds have passed
            this.playingTimer += deltaTime;
            if (this.stats.energy <= 30 || this.playingTimer > 30) {
                this.hasToy = false;
                this.atCenter = false;
                this.playingTimer = 0;
                toy.position.copy(toyStartPosition); // Return toy to start if abandoned
                
                // 50% chance to go to bored state, 50% to go to idle
                if (Math.random() < 0.5) {
                    this.actionState = 'bored';
                    this.stats.excitement = Math.max(0, this.stats.excitement - 15);
                } else {
                    this.actionState = 'idle';
                    this.pickNewTarget();
                }
            }
        } else if (this.actionState === 'playing_hide_and_seek') {
            // Hide and seek gameplay
            if (!this.atCenter) {
                // First go to center if not there already
                const centerPos = new THREE.Vector3(0, 0.5, 0);
                const distanceToCenter = this.mesh.position.distanceTo(centerPos);
                
                if (distanceToCenter < this.stoppingDistance) {
                    this.atCenter = true;
                } else {
                    // Move toward center
                    const direction = new THREE.Vector3().subVectors(centerPos, this.mesh.position);
                    if (direction.length() > 0) {
                        direction.normalize();
                        this.mesh.position.addScaledVector(direction, this.speed * deltaTime);
                    }
                    return; // Don't proceed to hiding until at center
                }
            }
            
            if (!this.isHiding) {
                // Pathfind to selected hide spot
                if (selectedHideSpot) {
                    const distanceToHide = this.mesh.position.distanceTo(selectedHideSpot);
                    
                    if (distanceToHide < this.stoppingDistance + 1) { // Slightly larger tolerance
                        // Reached hide spot, now hiding
                        this.isHiding = true;
                    } else {
                        // Move toward hide spot
                        const direction = new THREE.Vector3().subVectors(selectedHideSpot, this.mesh.position);
                        if (direction.length() > 0) {
                            direction.normalize();
                            this.mesh.position.addScaledVector(direction, this.speed * deltaTime);
                        }
                    }
                }
            } else {
                // Hiding and waiting to be found
                if (this.foundByPlayer) {
                    // Player found us! Boost excitement and return to center
                    this.stats.excitement = this.clampStat(this.stats.excitement + 25);
                    this.isHiding = false;
                    this.foundByPlayer = false;
                    
                    const centerPos = new THREE.Vector3(0, 0.5, 0);
                    const distanceToCenter = this.mesh.position.distanceTo(centerPos);
                    
                    if (distanceToCenter > this.stoppingDistance) {
                        // Move back to center
                        const direction = new THREE.Vector3().subVectors(centerPos, this.mesh.position);
                        if (direction.length() > 0) {
                            direction.normalize();
                            this.mesh.position.addScaledVector(direction, this.speed * deltaTime);
                        }
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
            if (this.stats.energy <= 30 || this.playingTimer > 40) {
                this.isHiding = false;
                this.foundByPlayer = false;
                this.atCenter = false;
                this.playingTimer = 0;
                selectedHideSpot = null;
                
                // 50% chance to go to bored state, 50% to go to idle
                if (Math.random() < 0.5) {
                    this.actionState = 'bored';
                    this.stats.excitement = Math.max(0, this.stats.excitement - 15);
                } else {
                    this.actionState = 'idle';
                    this.pickNewTarget();
                }
            }
        } else if (this.actionState !== 'eating') {
            // Idle still moves around
            const direction = new THREE.Vector3().subVectors(this.targetPosition, this.mesh.position);
            const distance = direction.length();
            
            // Pick new target periodically or when reached current
            if (distance < this.stoppingDistance || (this.actionState === 'playing' && Math.random() < 0.02)) {
                this.pickNewTarget();
            }
            
            // Move toward target
            if (distance > 0) {
                direction.normalize();
                this.mesh.position.addScaledVector(direction, this.speed * deltaTime);
            }
        }
        
        // Always keep creature within bounds
        this.clampPosition();
    }
};

// Initialize with first target
creature.pickNewTarget();

// Handle window resize
window.addEventListener('resize', () => {
    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight;
    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(newWidth, newHeight);
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
    
    // Gentle rotation on the creature
    creature.mesh.rotation.x += 0.01;
    creature.mesh.rotation.y += 0.01;
    
    renderer.render(scene, camera);
}

let lastTime = 0;
animate();
