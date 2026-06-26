"""
render_full.py - High-quality final render (meant for a GPU machine)
====================================================================
Renders the full 24s / 576-frame cinematic at 1920x1080 with Cycles and
writes an H.264 MP4.  Designed for a workstation with a GPU.

Usage:
    blender -b blender/temple_scene.blend -P blender/render_full.py
    # or, with the bpy module:
    python3 blender/render_full.py [output_dir]

On a CUDA/OPTIX/HIP/METAL GPU this auto-enables GPU compute.  On CPU-only
machines it still works but will be slow (hours).
"""
import bpy, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
BLEND = os.path.join(HERE, "temple_scene.blend")
OUT_DIR = sys.argv[-1] if (len(sys.argv) > 1 and not sys.argv[-1].endswith(".py")) else os.path.join(HERE, "output")
os.makedirs(OUT_DIR, exist_ok=True)

# When launched via the bpy module the file isn't open yet.
if not bpy.data.filepath:
    bpy.ops.wm.open_mainfile(filepath=BLEND)

sc = bpy.context.scene
sc.render.engine = 'CYCLES'

# --- Try to enable the best available GPU backend ---
def enable_gpu():
    prefs = bpy.context.preferences.addons.get("cycles")
    if not prefs:
        return "CPU (no cycles prefs)"
    cprefs = prefs.preferences
    for backend in ('OPTIX', 'CUDA', 'HIP', 'METAL', 'ONEAPI'):
        try:
            cprefs.compute_device_type = backend
            cprefs.get_devices()
            gpus = [d for d in cprefs.devices if d.type == backend]
            if gpus:
                for d in cprefs.devices:
                    d.use = (d.type == backend)
                sc.cycles.device = 'GPU'
                return f"GPU/{backend}: " + ", ".join(d.name for d in gpus)
        except Exception:
            continue
    sc.cycles.device = 'CPU'
    return "CPU (no GPU found)"

print("[render_full] compute:", enable_gpu())

# High-quality settings
sc.cycles.samples = 512
sc.cycles.use_adaptive_sampling = True
sc.cycles.adaptive_threshold = 0.008
sc.cycles.use_denoising = True
try:
    sc.cycles.denoiser = 'OPTIX'
except Exception:
    sc.cycles.denoiser = 'OPENIMAGEDENOISE'
sc.cycles.volume_step_rate = 1.0
sc.cycles.volume_max_steps = 1024

sc.render.resolution_x = 1920
sc.render.resolution_y = 1080
sc.render.resolution_percentage = 100
sc.render.fps = 24
sc.frame_start = 1
sc.frame_end = 576

sc.render.image_settings.file_format = 'FFMPEG'
sc.render.ffmpeg.format = 'MPEG4'
sc.render.ffmpeg.codec = 'H264'
sc.render.ffmpeg.constant_rate_factor = 'HIGH'
sc.render.ffmpeg.ffmpeg_preset = 'GOOD'
sc.render.ffmpeg.gopsize = 18
sc.render.filepath = os.path.join(OUT_DIR, "temple_cinematic_1080p.mp4")

print(f"[render_full] -> {sc.render.filepath}")
bpy.ops.render.render(animation=True)
print("[render_full] done")
