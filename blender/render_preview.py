"""
render_preview.py - Fast, resumable, low-res preview render (CPU friendly)
==========================================================================
Renders the full 576-frame timeline as a PNG sequence at a reduced
resolution so it completes on a CPU-only box, and survives interruption
(already-rendered frames are skipped on restart).  Sims (cloth/particles)
are evaluated sequentially so they stay valid.

Usage:  python3 blender/render_preview.py
Frames: blender/output/preview_frames/preview_####.png
"""
import bpy, os

HERE = os.path.dirname(os.path.abspath(__file__))
BLEND = os.path.join(HERE, "temple_scene.blend")
FRAME_DIR = os.path.join(HERE, "output", "preview_frames")
os.makedirs(FRAME_DIR, exist_ok=True)

# Preview quality knobs
RES_X, RES_Y = 480, 270
SAMPLES = 16
STEP_RATE = 2.5

bpy.ops.wm.open_mainfile(filepath=BLEND)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = SAMPLES
sc.cycles.use_adaptive_sampling = True
sc.cycles.adaptive_threshold = 0.02
sc.cycles.use_denoising = True
try:
    sc.cycles.denoiser = 'OPENIMAGEDENOISE'
except Exception:
    pass
sc.cycles.volume_step_rate = STEP_RATE
sc.cycles.volume_max_steps = 256
sc.cycles.max_bounces = 6
sc.cycles.volume_bounces = 1

sc.render.resolution_x = RES_X
sc.render.resolution_y = RES_Y
sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGB'

f0, f1 = sc.frame_start, sc.frame_end
print(f"[preview] rendering frames {f0}..{f1} at {RES_X}x{RES_Y}, {SAMPLES} spp")

for f in range(f0, f1 + 1):
    out_path = os.path.join(FRAME_DIR, f"preview_{f:04d}.png")
    # Always step through frames so cloth/particle caches advance in order,
    # but skip the expensive render if this frame already exists.
    sc.frame_set(f)
    if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
        continue
    sc.render.filepath = out_path
    bpy.ops.render.render(write_still=True)
    if f % 12 == 0:
        print(f"[preview] frame {f}/{f1}")

print("[preview] all frames rendered")
