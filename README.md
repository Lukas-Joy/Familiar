# PSX Familiar – 3D Virtual Companion Website

A WebGL-based interactive virtual familiar creature with PSX/Sims 1 aesthetic, mood systems, AI behavior, and player interaction.

## Quick Start

1. **Open in VS Code**
   - Open the project folder: `c:\Users\lukas\Documents\Familiar`

2. **Install Live Server Extension** (if not already installed)
   - Open VS Code Extensions
   - Search for "Live Server" by Ritwick Dey
   - Install it

3. **Run Live Server**
   - Right-click on `index.html`
   - Select "Open with Live Server"
   - Your default browser will open to `http://127.0.0.1:5500`

4. **You should see:**
   - A green ground plane
   - A rotating red cube (placeholder for the creature)
   - Sky blue background

## Project Structure

```
Familiar/
├── index.html          # Main HTML entry point
├── main.js             # Core scene and animation loop
├── styles.css          # Styling
├── package.json        # Project metadata
├── src/
│   ├── systems/        # State, AI, weather, persistence
│   ├── creatures/      # Creature model, animation, behavior
│   └── world/          # Environment, objects, lighting
└── assets/
    ├── models/         # 3D model files
    └── textures/       # Texture files
```

## Camera View

Currently set to a ~45° top-down isometric-ish perspective, looking down at the scene from position (10, 8, 10).

## Next Steps

- [ ] Build the creature model (low-poly, PSX style)
- [ ] Implement state system (hunger, energy, excitement)
- [ ] Add creature AI and behavior
- [ ] Create world objects (heater, fan, food, bed, etc.)
- [ ] Implement player interaction
- [ ] Add weather integration
- [ ] Implement persistence (localStorage)
