## The Roach Show Simulator

MDDN242 2026 - Lukas Joy

This project is a digital familiar pet made to mirror the style of the games I make. It does this through emulation of the retro aesthetic.

The project was created using AI coding assistance and is made using a combination of Javascript, HTML, and css with 3D assets being made in Blender.

---

## Design Intent

### The goal

My original intent was roughly the same as the outcome but with a more complex state machine system, but with more factors affecting the familiar's behaviour; such as a live weather API requiring the player to interact with objects like heaters or fans to offset the effects. The final version retains the core stat-driven state machine (hunger, energy, excitement) and interactive play behaviours like fetch and hide-and-seek, but the weather layer was cut to focus on getting the core concept feeling right first.

### Why this direction

Originally I wanted this to be hosted on my portfolio website from project one, I make games with a specific retro visual identity and I wanted this project to feel like a natural extension of that world. The PSX aesthetic is central to how I think about visuals; the low-res rendering, pixelated filtering, and chunky geometry. Making it mine meant the art assets, the creature design, and the feel of the interactions all had to match the wider universe of things I make rather than pull from a generic template.

### Who is this for

The primary audience is people visiting my portfolio; other game developers, designers, and people with an interest in indie and retro aesthetics.

---

## Inspiration & References

### Visual references

- [Mike Klubnika](https://mikeklubnika.com/) - Overall grungy, oppressive environment aesthetic.
- The Sims (2000) - Early 3D domestic spaces, stat-driven needs.
- Mason Lindroth / Hylics - Grotesque, handcrafted designs.

### Movements or aesthetics

- PlayStation 1 aesthetics - Vertex wobble, low poly models, pixelated textures.
- Dreamcore / Lucid Blocks - Uncanny domestic spaces.

---

## Design Decisions

The key choices you made and why.

### Colour

Muted greens, browns, and greys; nothing clean or saturated. Chosen to match the grungy PSX aesthetic and Mike Klubnika's influence. Bright colour would have killed the atmosphere.

### Layout & structure

The camera angle keeps the bed, dispenser, and rubbish piles all visible at once so the creature navigating between them is always readable. Internal render is fixed at 480p and upscaled; keeping everything pixel-stable and deliberately lo-res regardless of window size.

### Interaction & motion

Everything that moves does so for a behavioural reason. Animation blends between idle and walk based on velocity. Turn rate is limited so the creature rotates smoothly rather than snapping. The environment doesn't animate independently; all motion belongs to the creature.

### Other decisions

Any other notable choices: naming, tone of voice, imagery style, etc.
The creature is unnamed and there's no onboarding text. You arrive and it's already there. No instructions, no reward feedback, no explanation. You figure out the interactions or you don't; this is consistent with how the games this references treated the player.

---

## AI & Prompting Process

### Tools used

- ChatGPT
- Claude
- Github Co-Pilot

### How you used them

ChatGPT was used via Github Co-Pilot.

Claude was used via Github Co-Pilot.

Github Co-Pilot was used via the Github Co-Pilot plugin for VS Code.

### What you used AI for

Claude was used to build the base overall structure of the code base using the prompts engineered with assistance from ChatGPT.

Github Co-Pilot was used to assist in making smaller changes to various parts of the code.

### What worked

Prompts that specified specific coding principles, structures or functions for the AI to follow allowing little to no room for interpretation worked best as they gave the AI no room to decide to do other things or get confused with exactly what I was asking.

### What didn't work

Prompts that were vague or used little or no technical language didn't work well as they gave the AI too much more to interpret the prompt causing the AI to change, edit, add or remove parts of the code/project that the AI was not intended to be working on.

---

## What I Tried That Didn't Work

Weather API integration

**What I tried:** Connecting a live weather API to the state machine so the creature's needs and environment would shift based on real-world temperature and conditions, with heaters and fans as interactive objects to offset the effects.

**Why it didn't work:** The core behaviour loop wasn't stable enough early on to build something that complex on top of it. By the time the state machine was working, fitting the weather layer would have meant significant rework to systems that were already fragile.

**What I learned:** Features that depend on stability need to be scoped in from the beginning, not treated as add-ons.

---

## Technical Notes

### Tools & libraries
| Tool | Purpose |
|------|---------|
| Three.js | 3D scene, rendering, animation |
| GLTFLoader | Loading creature and environment models |
| Blender | Creating all 3D assets and baking |
| VS Code + GitHub Copilot | Development environment and AI assistance |
| Claude / ChatGPT | Prompt engineering and code generation |

### Browser & mobile testing
- Tested on: Chrome
- Mobile tested on: Not tested — the project is not designed for mobile.

---

## Accessibility

- **Colour contrast:** not checkable as no text.
- **Alt text on images:** no images.
- **Keyboard navigation:** no keyboard navigation present.

---

## Reflection

### What I learned

I didn't learn much on the coding side from this project however I did learn a lot on the Blender side with this being the first project that I have ever 3D rigged and animated a model. I also spent a lot of time texturing in Blender becoming more familiar and confident with the workflow and different methods.

### What I'd do differently

I'd define the full state machine and interaction model on paper before touching any code. A lot of iteration time was spent untangling systems that had been built incrementally and had quietly started depending on each other in ways that made changes annoying. A clearer idea to begin with would have made the AI prompting more reliable also.

### What I'm most proud of

The alive look of the Cockroach moving around in the environment is quite convincing and I am proud of how smooth the animation looks in the scene. I am also happy with how the overall 3D scene looks.

### Where this sits in my practice

This project sits between game design and web work for me. I make games with a specific retro visual identity and this was another experiment in whether that could carry into a browser context. It can, and that opens up possibilities for how I present and distribute work.

---

## The Familiar — Concept

### Name & identity

My familiar is an unnamed digital pet cockroach modelled after Hal from Wall-E.

### Personality

It behaves mostly as a cockroach would, avoiding bright light, eating when needed and wandering idly. The specific movement with the pausing and slow turning really helps make the cockroach feel alive.

### Why this concept

I chose this specific familiar because it was the creature that fit the retro grungy style I was going for.

---

## Needs & Wants

### What it wants

The familiar has three needs running simultaneously: hunger, energy, and excitement; each a stat that decays over time on its own. Hunger wants food from the dispenser. Energy wants to rest in the bed. Excitement wants attention and play; either fetch, hide-and-seek, or simply being looked at.

### What happens when the need goes unmet

Each stat has a threshold below which the creature's behaviour changes visibly. Let hunger drop far enough and it stops doing anything else and pathfinds to the food dispenser on its own. Let energy bottom out and it puts itself to bed regardless of what else is happening. Let excitement fall to zero and it enters a bored state; it stops wandering aimlessly, and waits for you to entertain it. The cockroach can not die as they don't really do that.

### What satisfies it

Clicking the food dispenser drops one food which can be eaten to fill the hunger. The bed restores energy when the creature sleeps. Excitement is fed by interaction; initiating fetch or hide-and-seek, bringing the browser tab to focus. When a need is met the creature transitions out of its driven state back to idle.

### The attention economy angle

The familiar asks for regular, returning attention. Not a single interaction but ongoing presence; you have to come back, check in. In that sense it's a small simplified mirror of the attention economy logic baked into social apps and live-service games: the thing on the screen has manufactured needs timed to bring you back. This is not a critique, just merely an outcome of the project.

---

## States & Behaviours

### States

| State | Appearance / behaviour |
|-------|----------------------|
| Idle | Wanders around the space, pausing and plays idle animation; the default state when all stats are in a healthy range |
| Bored | Triggered when excitement bottoms out; stands still in the centre |
| Hungry | Overrides other behaviour; the creature pathfinds to the food dispenser and waits |
| Eating | Stationary at the dispenser, hunger stat climbs back up, transitions back to idle when full |
| Tired | Energy has dropped low; the creature pathfinds toward the bed |
| Sleeping | Stationary on the bed, energy recovers over time, won't be interrupted until energy full |
| Playing (Fetch) | Chases the thrown toy, picks it up, returns it |
| Playing (Hide and Seek) | Navigates to a rubbish pile, and waits to be found |
| Excited | Triggered by window focus or recent positive interaction |

### Transitions

All transitions are threshold-based, driven by the three stat values. Hunger below 25 forces the hungry/eating cycle. Energy below 25 forces tired/sleeping. Excitement below 25 drops the creature into boredom. These stat-driven transitions take priority over player-initiated play states. Play states (fetch, hide-and-seek) are triggered by direct player input; clicking the toy or initiating hide-and-seek and end when the session timer runs out, when energy drops too low to continue, or when the interaction reaches its end. After play, the creature transitions back to idle or, if a stat has crossed a threshold in the meantime, directly into the need state.

### Autonomous behaviour

Left alone, the familiar runs entirely on its own. Stats decay on timers  (hunger fastest, excitement moderately, energy slowly) so the creature will cycle through need states without any input. It will feed itself if food is available, put itself to bed, and wander back to idle all without prompting. What it can't do is keep its excitement stat; that requires the tab to be in focus or direct interaction, so if neglected the familiar will eventually fall into a low-excitement bored loop.

### Persistence across visits

Currently the familiar only uses localStorage to keep the stat the same as last time the user interacted with it

---

## Inputs & Responses

### Input 1
**Type:** Mouse interaction (click)

**Why this input:** The familiar is a pet, and pets respond to direct physical attention. Click interaction is the most immediate way a browser can simulate that.

**How the familiar responds:** Clicks drive the core loop. Clicking the food dispenser triggers the hungry/eating state transition and starts refilling the hunger stat. Clicking the toy initiates fetch. Clicking on the Cockroach to initiate hide-and-seek.

### Input 2
**Type:** Window / tab focus

**Why this input:** The familiar doesn't just exist for you to interact with occasionally; it actively knows whether you're looking at it. Tab focus is one of the few inputs a browser page has access to that says something true about the viewer's attention.

**How the familiar responds:** When the tab gains focus the creature's excitement stat receives a boost.

### Input 3
**Type:** Webcam

**Why this input:** This input helps bridge the separation between the users and the familiar with the environmental brightness making the environments closer to each other.

**How the familiar responds:** When the user's environment is bright so is the cockroach's environment and if it is too bright the cockroach sleeps to avoid the brightness.

### Any additional inputs

**Type:** Time / internal timers

The stat decay system is itself a continuous time-based input; hunger, energy, and excitement all tick down on independent intervals regardless of player action.

### Inputs you considered but didn't use

**Weather API** 
The original concept had live weather data pulled into the state machine, with temperature and conditions affecting the creature's needs and introducing objects like heaters and fans as interactive offsets. This would have been interesting input since it would have tied the familiar's mood to something external and uncontrollable. It was cut because getting the core behaviour loop working cleanly took priority.

**Time of day**
A natural extension of the time-based input would have been using the system clock to influence the creature's energy cycle, making it more likely to be tired at night and active during the day.

