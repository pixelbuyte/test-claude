"""
encode_to_mp4.py - Encode the preview PNG sequence into an H.264 MP4
====================================================================
Uses Blender's bundled FFmpeg (via the Video Sequence Editor) so no
system ffmpeg is required.

Usage:  python3 blender/encode_to_mp4.py [output_dir]
Output: <output_dir>/temple_cinematic_preview.mp4
"""
import bpy, os, sys, glob

HERE = os.path.dirname(os.path.abspath(__file__))
FRAME_DIR = os.path.join(HERE, "output", "preview_frames")
OUT_DIR = sys.argv[-1] if (len(sys.argv) > 1 and not sys.argv[-1].endswith(".py")) else os.path.join(HERE, "output")
os.makedirs(OUT_DIR, exist_ok=True)
OUT = os.path.join(OUT_DIR, "temple_cinematic_preview.mp4")

frames = sorted(glob.glob(os.path.join(FRAME_DIR, "preview_*.png")))
if not frames:
    raise SystemExit("no preview frames found - run render_preview.py first")
print(f"[encode] {len(frames)} frames found")

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = 24
# infer resolution from the first frame
img = bpy.data.images.load(frames[0])
sc.render.resolution_x, sc.render.resolution_y = img.size[0], img.size[1]

sc.frame_start = 1
sc.frame_end = len(frames)

if not sc.sequence_editor:
    sc.sequence_editor_create()
se = sc.sequence_editor
strip = se.sequences.new_image(
    name="preview", filepath=frames[0], channel=1, frame_start=1)
for fp in frames[1:]:
    strip.elements.append(os.path.basename(fp))

sc.render.image_settings.file_format = 'FFMPEG'
sc.render.ffmpeg.format = 'MPEG4'
sc.render.ffmpeg.codec = 'H264'
sc.render.ffmpeg.constant_rate_factor = 'HIGH'
sc.render.ffmpeg.ffmpeg_preset = 'GOOD'
sc.render.ffmpeg.audio_codec = 'NONE'
sc.render.filepath = OUT

print(f"[encode] -> {OUT}")
bpy.ops.render.render(animation=True)
print("[encode] done")
