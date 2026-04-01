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

// Handle mouse clicks on dispenser
window.addEventListener('click', (event) => {
    // Get mouse position in normalized device coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Update raycaster
    raycaster.setFromCamera(mouse, camera);
    
    // Check if dispenser is clicked
    const intersects = raycaster.intersectObject(dispenserGroup, true);
    if (intersects.length > 0 && !foodAvailable) {
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
    }
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
    actionState: 'idle', // idle, hungry, eating, sleeping, playing, going_to_food
    stateTimer: 0, // Time spent in current state
    
    // Track positions
    atBed: false,
    atDispenser: false,
    atFood: false,
    eatingTimer: 0, // Time spent eating
    
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
        excitement: 1    // Loses 3 excitement per second
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
    
    // Determine which state the creature should be in (priority-based)
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
        
        // Priority 1: Go to bed if exhausted
        if (this.stats.energy <= 20) {
            return 'tired';
        }
        
        // Priority 2: Go to dispenser if starving
        if (this.stats.hunger <= 15) {
            return 'hungry';
        }
        
        // Priority 3: Play if excited and has energy
        if (this.stats.excitement >= 60 && this.stats.energy >= 40) {
            return 'playing';
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
                
            case 'playing':
                // Playing increases excitement, costs energy and hunger
                this.stats.excitement = this.clampStat(this.stats.excitement + 8 * deltaTime);
                this.stats.energy = this.clampStat(this.stats.energy - 12 * deltaTime);
                this.stats.hunger = this.clampStat(this.stats.hunger - 4 * deltaTime);
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
        } else if (this.actionState === 'playing') {
            energyDecay = this.decayRates.energy * 2; // Extra cost for playing
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
        } else if (this.actionState !== 'eating') {
            // Idle and playing still move around
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
