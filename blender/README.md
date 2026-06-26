# Floating Temple — Cinematic Blender Scene

A fully procedural Blender scene + 24-second cinematic animation:

> *A futuristic lone explorer discovers an ancient floating temple hidden
> above the clouds at sunrise.*

Everything is generated in code (no external assets) with **Blender 4.5 LTS**
via the `bpy` Python module, so the whole project rebuilds from a single script.

---

## What's in the scene

| Collection | Contents |
|---|---|
| `00_Cameras` | Cinematic camera (35mm, depth of field) + aim target, animated dolly |
| `01_Environment` | Volumetric cloud sea, atmospheric fog volume |
| `02_Temple` | Floating island, stepped platform, 10 columns, ring beam, shrine, roof, floating debris, approach walkway |
| `03_Explorer` | Stylized humanoid (walk cycle + look-up) and a cloth cape |
| `04_Portal` | Glowing swirling gateway that activates near the end |
| `05_Effects` | 2 500 drifting dust motes + animated wind force field |
| `06_Lighting` | Warm sunrise sun, cool fill, volumetric god-ray spot |

### Requirements coverage
- **Procedural environment** — temple, island, columns, debris, path all built from primitives in code.
- **Volumetric clouds / fog / lighting** — Principled Volume cloud sea, Volume Scatter fog, Nishita sunrise sky, god-ray spot through the fog.
- **Physically based materials** — procedural PBR stone (noise-driven colour/roughness/bump), metal trim, emissive portal & visor.
- **Environmental animation** — clouds drift (animated mapping), dust drifts on wind, debris + temple gently float, light rays from the volumetric spot.
- **Cinematic camera** — smooth Bézier dolly with `Track To` and depth of field (animated f-stop focus pull).
- **Humanoid explorer** — walks the floating path, pauses, tilts head up toward the temple.
- **Cloth cape** — pinned-shoulder cloth simulation driven by the wind field.
- **Glowing portal** — emissive swirl + ring + point light, scales up and ignites from frame 456→576.
- **Particles + wind** — Newtonian dust particle system + animated gusty `WIND` force field.
- **Depth of field & composition** — f/1.6–2.2, rule-of-thirds reveal rising to the portal.
- **24 fps / 576 frames / 1920×1080 / Cycles** — set in `build_scene.py` / `render_full.py`.

---

## Files

| File | Purpose |
|---|---|
| `build_scene.py` | Builds the entire scene procedurally and saves `temple_scene.blend`. Includes an automatic inspect-and-fix pass (normals, materials, camera clipping, denoising). |
| `temple_scene.blend` | The generated project (open in Blender 4.5+). |
| `render_full.py` | **Final** render: 1920×1080, 512 spp, auto-enables GPU (OPTIX/CUDA/HIP/METAL) → `output/temple_cinematic_1080p.mp4`. |
| `render_preview.py` | **Preview** render: 480×270, 16 spp, CPU-friendly, resumable PNG sequence → `output/preview_frames/`. |
| `encode_to_mp4.py` | Encodes the preview PNG sequence to H.264 MP4 using Blender's bundled FFmpeg → `output/temple_cinematic_preview.mp4`. |
| `output/` | Rendered frames and videos. |

---

## How to (re)build & render

```bash
pip install "bpy==4.5.11"          # Blender as a Python module (Python 3.11)

# 1. Build the scene from scratch
python3 blender/build_scene.py

# 2a. Low-res preview (CPU, ~1 min/frame-batch on 4 cores → ~1h for 24s)
python3 blender/render_preview.py
python3 blender/encode_to_mp4.py   # -> output/temple_cinematic_preview.mp4

# 2b. Full-quality final (recommended on a GPU workstation)
python3 blender/render_full.py /path/to/output_folder
# or:  blender -b blender/temple_scene.blend -P blender/render_full.py -- /path/to/output_folder
```

> **Note on this environment.** The scene is authored to the full spec
> (1080p, 576 frames, Cycles, 512 spp). It was generated and previewed on a
> CPU-only container (no GPU), so the in-session video is the reduced-resolution
> **preview**. Run `render_full.py` on a machine with a GPU for the final
> high-quality 1080p MP4 — the `.blend` is identical either way.
