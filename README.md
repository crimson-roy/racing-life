# Racing Life

**Racing Life** is an open-source racing and life-simulation project currently in active development.

The project uses a **prototype-first workflow**: gameplay systems are first tested and refined in 2D, then progressively rebuilt and integrated into the full 3D game. This makes it possible to validate racing logic, progression systems, AI behavior and game flow before moving those systems into the more complex 3D environment.

## Current Development Status

Racing Life is still an early-stage project, but several core systems are already working as prototypes.

### 3D Systems

The current Three.js side of the project includes:

- a 3D Home / Lobby scene
- character and vehicle presentation
- orbit-camera controls
- lighting and environment setup
- an emote-wheel system
- early Free Roam gameplay
- player / vehicle interaction experiments
- 3D world, building and vehicle assets

The 3D side is being expanded continuously as tested gameplay systems are migrated from the 2D prototypes.

### 2D Gameplay Prototypes

The racing and career systems are currently prototyped in **2D with Phaser**.

These prototypes currently include:

- multiple race maps
- AI-controlled racers
- lap and finish logic
- acceleration, braking and steering systems
- race-state and finish-order tracking
- a garage with purchasable vehicles
- vehicle selection and basic performance stats
- career progression data including money, trust, reputation, season/week progression and race history

These systems are **not intended to remain 2D**. They are being used to test gameplay logic, balancing and progression before being rebuilt and integrated into the 3D game.

### What I am working on now

Development is currently focused on **moving the tested 2D gameplay logic into the 3D environment**.

The main migration goals are:

- bring racing logic into the 3D world
- move vehicle controls and race rules into the 3D implementation
- rebuild the garage as a 3D system
- connect career progression to the 3D experience
- expand Free Roam into a larger interactive world
- unify the currently separate prototype systems into one complete game flow

The long-term goal is to bring racing, career progression, garage systems, vehicles, characters and free-roam gameplay together into one fully 3D racing-life experience.

## Development Approach

Racing Life is intentionally being built in stages:

1. **Prototype the mechanic quickly in 2D.**
2. **Test whether the gameplay logic works.**
3. **Refine the system until the behavior is stable.**
4. **Rebuild and integrate the tested logic into the 3D game.**

This approach allows the project to focus on gameplay first while the 3D world and presentation continue to grow.

## Tech Stack

- **JavaScript / ES Modules**
- **Vite** for development and builds
- **Three.js** for the 3D Home, Free Roam and world systems
- **Phaser** for the current 2D racing and garage prototypes
- **Rapier 3D compatibility package** included for ongoing physics work and experimentation
- **Blender** for 3D asset work
- **GLTF / GLB** for runtime 3D models

## Project Structure

```text
racing-life/
├── src/
│   ├── characters/      # Character and animation logic
│   ├── scenes/          # Home, Free Roam, racing, garage and other scenes
│   ├── state/           # Career and progression state
│   ├── ui/              # Game UI components
│   ├── vehicles/        # Vehicle implementations and tests
│   └── main.js          # Active application entry point
├── public/
│   └── assets/world/    # Runtime 3D world assets
├── Blender/             # Project-owned Blender / model work
├── tools/               # Conversion utilities and bundled tool licenses
├── test*.html           # Focused development test pages
├── package.json
└── index.html
```

## Getting Started

### Requirements

- Node.js
- npm
- a modern browser with WebGL support

### Install

```bash
git clone https://github.com/crimson-roy/racing-life.git
cd racing-life
npm install
```

### Run the development server

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Preview a production build

```bash
npm run preview
```

## Current Architecture Notes

`src/main.js` is the active application entry point for the current 3D-facing experience.

The repository also contains Phaser-based racing and garage scenes. These are working gameplay prototypes used to define how the eventual 3D versions should behave.

Because the project is in migration, some systems currently exist in both prototype and 3D-oriented forms. This is intentional and will be consolidated as the 3D implementation progresses.

## Roadmap

Near-term development is focused on:

- migrating tested racing logic into 3D
- improving 3D vehicle movement and handling
- adding a full 3D garage flow
- integrating the career state with the 3D game
- expanding Free Roam and world interaction
- improving character animation and interaction systems
- connecting races, progression and free-roam into one continuous gameplay loop

Longer-term goals include a larger explorable world, deeper career progression, more vehicles, more race events and stronger life-simulation systems around the racing career.

## Contributing

Racing Life is still evolving quickly, but contributions, ideas and bug reports are welcome.

When contributing:

- keep changes focused and easy to review
- preserve the existing folder structure unless a change is necessary
- test vehicle changes through the dedicated test pages where possible
- avoid replacing working systems wholesale when a smaller change will do
- clearly separate experimental prototype work from production-ready changes

A dedicated `CONTRIBUTING.md` will be added as the contributor workflow becomes more formalized.

## Assets and Licensing

The project source code is released under the **MIT License**.

Some 3D models, conversion tools, reference material or other third-party assets may have their own licenses or redistribution terms. The MIT license for the source code should not be interpreted as automatically relicensing third-party assets.

Large raw animation/source asset collections are intentionally excluded from the repository where appropriate.

## License

See [`LICENSE`](LICENSE).

---

**Racing Life is a work in progress.** The current repository represents an active transition from tested 2D gameplay prototypes toward the full 3D implementation.
