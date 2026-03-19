# ◈ VSP-CWE
### Virtual Simulated Physics · Capacity-Weighted Engine
#### *Wetware Communications Grid — TRON / Geometry Wars / Resogun lineage*

> **A simulated world where computation is geography, authority is mass, movement is cost, and intelligence is constrained by reality.**

---

```
geometry  =  data          mass     =  capacity
movement  =  computation   paths    =  allocated space
entities  =  executors     physics  =  truth enforcement
```

---

## What This Is

This is not a game engine with a theme. It is not a visualizer with gameplay bolted on.

It is a **living computational substrate** — a 2D simulation engine projected onto a sphere, where every physical rule directly mirrors a real constraint in distributed systems, filesystems, and AI resource management.

The world's shape is the filesystem. The physics enforces trust. The entities are autonomous executors. And nothing moves for free.

Inspired by the mathematical elegance of **Geometry Wars**, the surface topology of **Resogun**, and the digital-universe metaphor of **TRON** — but grounded in conservation laws, not fiction.

---

## Quick Start

> No server required. No build step. Open and run.

```bash
git clone https://github.com/GareBear99/Virtual-Simulated-Physics-Capacity-Weighted-Engine.git
cd Virtual-Simulated-Physics-Capacity-Weighted-Engine/iteration8_ARC_NoServer_v10_FixFolderImport
open index.html   # or just double-click it
```

**Requirements:** A modern browser. That's it.  
**Rendering:** Canvas 2D only — no WebGL, no dependencies, no install.

---

## Core Axioms

| World Rule | What It Means |
|---|---|
| **Mass = Capacity** | An entity's weight is its allocated KB — not its visual size |
| **Speed = Free Space** | Unused capacity is the only source of mobility |
| **Movement = Cost** | Every tick of travel deducts from your cache budget |
| **Authority = Mass Share** | Control emerges from accumulated space, not permission flags |
| **Growth = Earned** | Worker success +1KB · Worker failure −2KB · No free expansion |
| **Corruption = Entropy** | Unresolved tasks spread as tile-level decay, not a visual effect |

---

## Architecture

```
┌─────────────────────────────┐
│      Render Layer           │  Canvas 2D · Additive neon · Two-pass glow
│   (Projection + Neon FX)    │  Front-hemisphere culling only
└─────────────┬───────────────┘
              │ projects onto
┌─────────────▼───────────────┐
│    World Surface Grid       │  Cube-map quad topology → sphere projection
│  (face, i, j) tile space    │  No polar distortion · Square tiles · BFS-ready
└─────────────┬───────────────┘
              │ anchors
┌─────────────▼───────────────┐
│     Simulation Core         │  Pure 2D continuous space · Fixed 120Hz timestep
│  (2D movement + entities)   │  GW-style glide · friction · capped speed
└─────────────┬───────────────┘
              │ governed by
┌─────────────▼───────────────┐
│    Capacity / Physics       │  Mass · Cost · Resistance · Corruption spread
│  (Conservation Laws)        │  KB accounting · Half-life decay · 51% consensus
└─────────────────────────────┘
```

**Key constraint:** The 3D sphere is a **projection layer only**. The simulation lives in 2D. This keeps it deterministic, lightweight, and O(N) on entities.

---

## The Tile System

Every surface square is identified as `(face, i, j)` — one of 6 cube faces, N×N grid each.

Each tile stores real state:

| Field | Description |
|---|---|
| `capacity_total` | Maximum KB this tile can hold |
| `capacity_used` | Currently occupied space |
| `capacity_staked` | Locked by trails / light-cycle walls |
| `corruption` | Normalized `[0,1]` decay level |
| `support_value` | Structural reinforcement health |
| `lock_timers` | Cooldown on edges / interactions |

Tiles can **support entities**, **block movement**, **fracture under overload**, and **spread corruption to neighbors**. This turns filesystem fragmentation into terrain physics.

---

## Physics Formulas (Key Relationships)

**Effective speed** (the core equation):
```
v_P = v_max · (E_P / (m_P + ε))
```
Where `E_P` = sum of free capacity across all shards, `m_P` = committed capacity.

**Tile resistance** (corruption + load):
```
R_j = 1 + k_c·c_j + k_s·(1 - g_j) + k_p·pressure_j
```

**Movement cost per tick:**
```
ΔK_move = ⌈k_move · distance · mass⌉
```

**Corruption spread (cellular automaton):**
```
c_j(t+1) = clamp(c_j(t) + σ·avg(neighbors) - ρ·patch_j, 0, 1)
```

**Consensus threshold:**
```
Σ μ_i ≥ 0.51   (over coalition C)
μ_creator ≥ 0.01  [non-transferable]
μ_helper  ≥ 0.01  [non-transferable]
```

Full mathematical specification is in the spec section below.

---

## Current State — Iteration 8

| System | Status |
|---|---|
| 2D movement core (GW-feel) | ✅ Complete |
| Geometry Wars glide doctrine | ✅ Complete |
| Cube-map sphere surface grid | ✅ Complete |
| Resogun-style projection | ✅ Complete |
| Ultra-light Canvas 2D pipeline | ✅ Complete |
| No-server, folder-import clean | ✅ Complete |
| Tile-anchored entity logic | 🔲 Next |
| Capacity accounting per tile | 🔲 Next |
| Corruption propagation | 🔲 Planned |
| Worker polygon dispatch | 🔲 Planned |
| Lane allocation events | 🔲 Planned |
| Light-cycle trail mode | 🔲 Planned |
| LuciferAI polygon embodiment | 🔲 Future |

---

## Roadmap

### Phase 1 — Tile Physics *(active)*
- Bind entities to tile coordinates
- Implement capacity accounting (used / staked / free) per tile
- Speed and acceleration derived from tile-local free capacity
- Movement deducts from entity's KB budget

### Phase 2 — Corruption & Workers
- Cellular automaton corruption spread across adjacency graph
- Worker polygon dispatch on corruption detection
- +1KB / −2KB system capacity on task resolution
- Tile fracture when entity mass exceeds tile capacity

### Phase 3 — Light Cycles & Trails
- Trail = staked tile edges with half-life decay
- Movement cost includes wall-deposit spend
- Speed-locked interaction rejection during TTL window

### Phase 4 — LuciferAI Embodiment
- AI as a polygon body: distributed capacity graph
- Self-modification within available mass budget
- Writes structures into tiles — not via API, via physics
- Safety guaranteed structurally: cannot exceed world limits

---

## Design Constraints (Locked)

These are not preferences. They are architecture invariants:

- ✅ Canvas 2D only — no WebGL
- ✅ No physics engines (Matter.js, Box2D, etc.)
- ✅ No ECS frameworks
- ✅ No per-frame pathfinding — BFS on blocked-move events only
- ✅ No per-frame memory allocation
- ✅ Fixed timestep simulation (120Hz)
- ✅ All logic deterministic — identical input → identical output

**Reference standard:** Geometry Wars 2 + Resogun. Minimal math, maximal feel. Everything faked except what matters.

---

## Visual Language

```
Brightness  →  activity level
Thickness   →  capacity load
Color       →  tile state (healthy / corrupt / locked / staked)
Glow        →  not decoration — it encodes system truth
```

Neon wireframe. Additive blend. No textures. Motion conveys intelligence.

---

## Why This Matters

Most AI sandboxes enforce limits through **rules and permissions**.  
This system enforces limits through **physics and conservation**.

An AI agent inside this world:
- cannot move without paying for it
- cannot grow without earning capacity
- cannot take control without accumulating mass over time
- cannot escape the constraints of the space it inhabits

**Safety is structural, not moral.** The world simply does not support unbounded behavior.

That's the difference between a policy and a physics engine.

---

## Contributing

The architecture is locked at the invariant level (see constraints above). Extensions are welcome in:

- New tile topology modes
- Alternative projection surfaces
- Visualization layers
- Worker AI strategies
- LuciferAI behavior research

Before opening a PR, read the architecture section — especially the conservation laws. Breaking conservation is not a feature.

---

## License

MIT

---

*Iteration 8 · Canvas 2D · No dependencies · No server*  
*Built by [@GareBear99](https://github.com/GareBear99)*
