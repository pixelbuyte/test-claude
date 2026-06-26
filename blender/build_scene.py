"""
build_scene.py  -  Procedural Blender scene builder
=====================================================
Theme: "A futuristic lone explorer discovers an ancient floating temple
hidden above the clouds at sunrise."

Builds the entire scene procedurally with bpy (Blender 4.5 LTS):
  - Sunrise sky (Nishita) + sun
  - Volumetric cloud sea, atmospheric fog, volumetric light rays
  - Procedural PBR stone temple (floating) with columns + floating rocks
  - Stylized humanoid explorer that walks in, pauses, looks up
  - Cloth cape driven by a wind force field
  - Glowing portal that activates near the end
  - Drifting dust particles + wind
  - Cinematic animated camera with depth of field
  - 1920x1080, 24fps, frames 1..576 (24s), Cycles

Run headless:  python3 blender/build_scene.py
Output:        blender/temple_scene.blend
"""

import bpy
import bmesh
import math
import os
from mathutils import Vector, Euler

# ----------------------------------------------------------------------------
# Global timeline constants
# ----------------------------------------------------------------------------
FPS = 24
DURATION_S = 24
FRAME_START = 1
FRAME_END = FPS * DURATION_S          # 576
RES_X, RES_Y = 1920, 1080

# Story beats (frames)
F_WALK_START = 1
F_WALK_END = 360        # explorer reaches viewpoint
F_PAUSE_END = 432       # stands and looks up
F_PORTAL_ON = 456       # portal begins to activate
F_END = FRAME_END       # 576

HERE = os.path.dirname(os.path.abspath(__file__))
BLEND_PATH = os.path.join(HERE, "temple_scene.blend")

LOG = []
def log(msg):
    print("[build]", msg)
    LOG.append(str(msg))


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
def reset_scene():
    """Start from a pristine empty file."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.frame_start = FRAME_START
    sc.frame_end = FRAME_END
    sc.frame_set(FRAME_START)
    sc.render.fps = FPS


def get_collection(name, parent=None):
    """Get-or-create a named collection linked under parent (scene root by default)."""
    if name in bpy.data.collections:
        return bpy.data.collections[name]
    col = bpy.data.collections.new(name)
    (parent or bpy.context.scene.collection).children.link(col)
    return col


def link_to(obj, col):
    """Unlink obj from all collections and link only to col."""
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    col.objects.link(obj)


def new_mesh_obj(name, mesh, col):
    obj = bpy.data.objects.new(name, mesh)
    col.objects.link(obj)
    return obj


def smooth_keyframes(obj, interp='BEZIER'):
    if not (obj.animation_data and obj.animation_data.action):
        return
    for fc in obj.animation_data.action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = interp
            kp.handle_left_type = 'AUTO_CLAMPED'
            kp.handle_right_type = 'AUTO_CLAMPED'


def set_smooth(obj):
    if obj.type == 'MESH':
        for p in obj.data.polygons:
            p.use_smooth = True


def recalc_normals(obj):
    if obj.type != 'MESH':
        return
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()


# ----------------------------------------------------------------------------
# Render / scene settings
# ----------------------------------------------------------------------------
def setup_render():
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 256
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.01
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception as e:
        log(f"denoiser set failed: {e}")
    # Light paths / volume quality
    sc.cycles.max_bounces = 8
    sc.cycles.volume_bounces = 2
    sc.cycles.volume_step_rate = 1.0
    sc.cycles.volume_max_steps = 1024
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False

    sc.render.resolution_x = RES_X
    sc.render.resolution_y = RES_Y
    sc.render.resolution_percentage = 100
    sc.render.fps = FPS
    sc.render.film_transparent = False

    # Color management - cinematic
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'
    sc.view_settings.exposure = 0.2

    # Output defaults (overridden by render scripts)
    sc.render.image_settings.file_format = 'FFMPEG'
    sc.render.ffmpeg.format = 'MPEG4'
    sc.render.ffmpeg.codec = 'H264'
    sc.render.ffmpeg.constant_rate_factor = 'HIGH'
    sc.render.ffmpeg.ffmpeg_preset = 'GOOD'
    sc.render.filepath = os.path.join(HERE, "output", "temple_cinematic_")
    log("render settings configured (Cycles CPU, 1080p, AgX)")


# ----------------------------------------------------------------------------
# World : sunrise sky + atmosphere
# ----------------------------------------------------------------------------
def build_world():
    world = bpy.data.worlds.new("Sunrise_World")
    bpy.context.scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    sky = nt.nodes.new("ShaderNodeTexSky")
    sky.sky_type = 'NISHITA'
    sky.sun_elevation = math.radians(4.0)     # low sunrise sun
    sky.sun_rotation = math.radians(-110.0)
    sky.sun_intensity = 0.7
    sky.altitude = 1500.0
    sky.air_density = 1.6
    sky.dust_density = 4.0                     # warm hazy horizon
    sky.ozone_density = 1.2

    bg.inputs["Strength"].default_value = 1.0
    nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])

    out.location = (300, 0)
    bg.location = (100, 0)
    sky.location = (-200, 0)
    log("world: Nishita sunrise sky")
    return world


# ----------------------------------------------------------------------------
# Procedural PBR materials
# ----------------------------------------------------------------------------
def mat_stone(name="M_AncientStone", base=(0.42, 0.36, 0.30)):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")

    coord = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 3.5
    noise.inputs["Detail"].default_value = 8.0
    noise.inputs["Roughness"].default_value = 0.6

    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.30
    ramp.color_ramp.elements[0].color = (base[0]*0.55, base[1]*0.55, base[2]*0.55, 1)
    ramp.color_ramp.elements[1].position = 0.75
    ramp.color_ramp.elements[1].color = (base[0], base[1], base[2], 1)

    # bump from a second high-freq noise
    noise2 = nt.nodes.new("ShaderNodeTexNoise")
    noise2.inputs["Scale"].default_value = 28.0
    noise2.inputs["Detail"].default_value = 10.0
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.25

    rough_ramp = nt.nodes.new("ShaderNodeValToRGB")
    rough_ramp.color_ramp.elements[0].color = (0.55, 0.55, 0.55, 1)
    rough_ramp.color_ramp.elements[1].color = (0.95, 0.95, 0.95, 1)

    nt.links.new(coord.outputs["Object"], noise.inputs["Vector"])
    nt.links.new(coord.outputs["Object"], noise2.inputs["Vector"])
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(noise.outputs["Fac"], rough_ramp.inputs["Fac"])
    nt.links.new(rough_ramp.outputs["Color"], bsdf.inputs["Roughness"])
    nt.links.new(noise2.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def mat_metal(name="M_FuturisticTrim", base=(0.30, 0.45, 0.55), emit=(0.0, 0.7, 1.0), emit_str=2.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*base, 1)
    bsdf.inputs["Metallic"].default_value = 1.0
    bsdf.inputs["Roughness"].default_value = 0.25
    if "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (*emit, 1)
        bsdf.inputs["Emission Strength"].default_value = emit_str
    return mat


def mat_emissive(name, color=(0.2, 0.7, 1.0), strength=8.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emis = nt.nodes.new("ShaderNodeEmission")
    emis.inputs["Color"].default_value = (*color, 1)
    emis.inputs["Strength"].default_value = strength
    nt.links.new(emis.outputs["Emission"], out.inputs["Surface"])
    return mat


def mat_suit(name="M_ExplorerSuit", base=(0.05, 0.06, 0.08)):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*base, 1)
    bsdf.inputs["Roughness"].default_value = 0.45
    bsdf.inputs["Metallic"].default_value = 0.1
    return mat


# ----------------------------------------------------------------------------
# Volumetric cloud sea + fog
# ----------------------------------------------------------------------------
def mat_clouds(name="M_VolumetricClouds", density=0.32):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = (1.0, 0.95, 0.92, 1)
    vol.inputs["Density"].default_value = 1.0
    if "Anisotropy" in vol.inputs:
        vol.inputs["Anisotropy"].default_value = 0.45

    coord = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")     # animated for drift
    mapping.name = "CloudDrift"
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 1.3
    noise.inputs["Detail"].default_value = 9.0
    noise.inputs["Roughness"].default_value = 0.65

    # flatten the cloud layer vertically using a gradient mask so it reads as a sea
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    grad_ramp = nt.nodes.new("ShaderNodeValToRGB")
    grad_ramp.color_ramp.interpolation = 'EASE'
    grad_ramp.color_ramp.elements[0].position = 0.40
    grad_ramp.color_ramp.elements[0].color = (1, 1, 1, 1)
    grad_ramp.color_ramp.elements[1].position = 0.62
    grad_ramp.color_ramp.elements[1].color = (0, 0, 0, 1)

    dens_ramp = nt.nodes.new("ShaderNodeValToRGB")
    dens_ramp.color_ramp.elements[0].position = 0.50
    dens_ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
    dens_ramp.color_ramp.elements[1].position = 0.72
    dens_ramp.color_ramp.elements[1].color = (1, 1, 1, 1)

    mult = nt.nodes.new("ShaderNodeMath")
    mult.operation = 'MULTIPLY'
    mult2 = nt.nodes.new("ShaderNodeMath")
    mult2.operation = 'MULTIPLY'
    mult2.inputs[1].default_value = density

    nt.links.new(coord.outputs["Generated"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
    nt.links.new(coord.outputs["Generated"], sep.inputs["Vector"])
    nt.links.new(sep.outputs["Z"], grad_ramp.inputs["Fac"])
    nt.links.new(noise.outputs["Fac"], dens_ramp.inputs["Fac"])
    nt.links.new(dens_ramp.outputs["Color"], mult.inputs[0])
    nt.links.new(grad_ramp.outputs["Color"], mult.inputs[1])
    nt.links.new(mult.outputs["Value"], mult2.inputs[0])
    nt.links.new(mult2.outputs["Value"], vol.inputs["Density"])
    nt.links.new(vol.outputs["Volume"], out.inputs["Volume"])
    return mat, mapping


def build_environment():
    col = get_collection("01_Environment")

    # --- Cloud sea (big flat volume domain) ---
    bpy.ops.mesh.primitive_cube_add(size=2.0, location=(0, 0, -4.0))
    clouds = bpy.context.active_object
    clouds.name = "CloudSea_Volume"
    clouds.scale = (150, 150, 7.5)
    link_to(clouds, col)
    cmat, drift = mat_clouds(density=0.5)
    clouds.data.materials.append(cmat)
    clouds.display.show_shadows = False

    # animate cloud drift via mapping location
    drift.inputs["Location"].default_value = (0, 0, 0)
    drift.inputs["Location"].keyframe_insert("default_value", frame=FRAME_START)
    drift.inputs["Location"].default_value = (0.55, 0.22, 0.0)
    drift.inputs["Location"].keyframe_insert("default_value", frame=FRAME_END)
    if cmat.node_tree.animation_data and cmat.node_tree.animation_data.action:
        for fc in cmat.node_tree.animation_data.action.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = 'LINEAR'

    # --- Thin atmospheric fog covering the whole scene ---
    bpy.ops.mesh.primitive_cube_add(size=2.0, location=(0, 0, 8))
    fog = bpy.context.active_object
    fog.name = "Atmosphere_Fog"
    fog.scale = (150, 150, 40)
    link_to(fog, col)
    fmat = bpy.data.materials.new("M_AtmosphereFog")
    fmat.use_nodes = True
    fnt = fmat.node_tree
    fnt.nodes.clear()
    fout = fnt.nodes.new("ShaderNodeOutputMaterial")
    scat = fnt.nodes.new("ShaderNodeVolumeScatter")
    scat.inputs["Color"].default_value = (1.0, 0.85, 0.7, 1)
    scat.inputs["Density"].default_value = 0.0016
    if "Anisotropy" in scat.inputs:
        scat.inputs["Anisotropy"].default_value = 0.3
    fnt.links.new(scat.outputs["Volume"], fout.inputs["Volume"])
    fog.data.materials.append(fmat)
    fog.display.show_shadows = False

    log("environment: cloud sea + atmospheric fog")
    return col


# ----------------------------------------------------------------------------
# Lighting : sun (key) + warm fill, drives light rays through fog
# ----------------------------------------------------------------------------
def build_lighting():
    col = get_collection("06_Lighting")

    sun_data = bpy.data.lights.new("KeySun", 'SUN')
    sun_data.energy = 4.5
    sun_data.angle = math.radians(1.5)
    sun_data.color = (1.0, 0.72, 0.45)         # warm sunrise
    sun = bpy.data.objects.new("Sun_Key", sun_data)
    col.objects.link(sun)
    sun.rotation_euler = Euler((math.radians(74), 0, math.radians(-110)), 'XYZ')

    # subtle cool rim/fill
    fill_data = bpy.data.lights.new("FillArea", 'AREA')
    fill_data.energy = 800.0
    fill_data.size = 30.0
    fill_data.color = (0.55, 0.7, 1.0)
    fill = bpy.data.objects.new("Light_Fill", fill_data)
    col.objects.link(fill)
    fill.location = (-30, 35, 18)
    fill.rotation_euler = Euler((math.radians(55), 0, math.radians(220)), 'XYZ')

    # volumetric "god ray" spot aimed through the temple
    spot_data = bpy.data.lights.new("GodRaySpot", 'SPOT')
    spot_data.energy = 6000.0
    spot_data.color = (1.0, 0.8, 0.55)
    spot_data.spot_size = math.radians(45)
    spot_data.spot_blend = 0.5
    spot_data.shadow_soft_size = 1.0
    spot = bpy.data.objects.new("Light_GodRays", spot_data)
    col.objects.link(spot)
    spot.location = (24, -28, 30)
    spot.rotation_euler = Euler((math.radians(38), 0, math.radians(35)), 'XYZ')

    log("lighting: warm sun key + cool fill + god-ray spot")
    return col


# ----------------------------------------------------------------------------
# Temple : procedural floating ancient structure
# ----------------------------------------------------------------------------
def build_temple():
    col = get_collection("02_Temple")
    stone = mat_stone()
    trim = mat_metal()

    parts = []

    # Floating base island (rock)
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=11, depth=3.0,
                                         location=(0, 0, 0.0))
    base = bpy.context.active_object
    base.name = "Temple_BaseIsland"
    # taper the bottom to look like a floating rock
    bm = bmesh.new(); bm.from_mesh(base.data)
    for v in bm.verts:
        if v.co.z < 0:
            v.co.x *= 0.35; v.co.y *= 0.35; v.co.z *= 2.6
    bm.to_mesh(base.data); bm.free()
    parts.append(base)

    # Main platform
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=8.5, depth=0.8,
                                         location=(0, 0, 1.9))
    plat = bpy.context.active_object
    plat.name = "Temple_Platform"
    parts.append(plat)

    # Steps
    for i, r in enumerate([7.2, 6.4, 5.6]):
        bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=r, depth=0.35,
                                            location=(0, 0, 2.4 + i*0.32))
        s = bpy.context.active_object
        s.name = f"Temple_Step_{i+1}"
        parts.append(s)

    # Ring of columns
    n_cols = 10
    for i in range(n_cols):
        a = (i / n_cols) * math.tau
        x, y = math.cos(a) * 6.2, math.sin(a) * 6.2
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.45, depth=5.5,
                                            location=(x, y, 6.0))
        c = bpy.context.active_object
        c.name = f"Temple_Column_{i+1:02d}"
        parts.append(c)
        # capital
        bpy.ops.mesh.primitive_cube_add(size=1.2, location=(x, y, 8.9))
        cap = bpy.context.active_object
        cap.name = f"Temple_Capital_{i+1:02d}"
        cap.scale = (1.0, 1.0, 0.3)
        parts.append(cap)

    # Architrave ring (torus reads as a ring beam)
    bpy.ops.mesh.primitive_torus_add(major_radius=6.2, minor_radius=0.35,
                                     location=(0, 0, 9.3))
    ring = bpy.context.active_object
    ring.name = "Temple_RingBeam"
    parts.append(ring)

    # Central shrine block
    bpy.ops.mesh.primitive_cube_add(size=2.6, location=(0, 0, 4.5))
    shrine = bpy.context.active_object
    shrine.name = "Temple_Shrine"
    shrine.scale = (1.0, 1.0, 1.4)
    parts.append(shrine)

    # Roof / apex
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=4.2, radius2=0.0, depth=3.2,
                                    location=(0, 0, 11.3))
    roof = bpy.context.active_object
    roof.name = "Temple_Roof"
    parts.append(roof)

    # Assign materials, smooth, normals
    for p in parts:
        link_to(p, col)
        if p.data.materials:
            p.data.materials.clear()
        if "Roof" in p.name or "RingBeam" in p.name or "Capital" in p.name:
            p.data.materials.append(trim)
        else:
            p.data.materials.append(stone)
        recalc_normals(p)
    # capitals/ring use trim metal
    set_smooth(base)

    # Small floating debris rocks around the island
    debris_col = get_collection("02_Temple")
    import random
    rng = random.Random(7)
    for i in range(14):
        a = rng.uniform(0, math.tau)
        rad = rng.uniform(9, 16)
        x, y = math.cos(a)*rad, math.sin(a)*rad
        z = rng.uniform(-3, 4)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,
                                              radius=rng.uniform(0.3, 1.1),
                                              location=(x, y, z))
        d = bpy.context.active_object
        d.name = f"Temple_Debris_{i+1:02d}"
        d.scale = (rng.uniform(0.7, 1.3), rng.uniform(0.7, 1.3), rng.uniform(0.5, 1.0))
        for v in d.data.vertices:
            v.co += Vector((rng.uniform(-0.1, 0.1), rng.uniform(-0.1, 0.1), rng.uniform(-0.1, 0.1)))
        d.data.materials.append(stone)
        recalc_normals(d)
        link_to(d, col)
        # gentle bobbing animation
        d.location.z = z
        d.keyframe_insert("location", index=2, frame=FRAME_START)
        d.location.z = z + rng.uniform(0.3, 0.7)
        d.keyframe_insert("location", index=2, frame=(FRAME_START+FRAME_END)//2)
        d.location.z = z
        d.keyframe_insert("location", index=2, frame=FRAME_END)
        smooth_keyframes(d)

    # Whole temple gently floats / breathes
    empty = bpy.data.objects.new("Temple_Anchor", None)
    col.objects.link(empty)
    empty.empty_display_type = 'PLAIN_AXES'
    for p in parts:
        p.parent = empty
    empty.location.z = 0
    empty.keyframe_insert("location", index=2, frame=FRAME_START)
    empty.location.z = 0.5
    empty.keyframe_insert("location", index=2, frame=288)
    empty.location.z = 0
    empty.keyframe_insert("location", index=2, frame=FRAME_END)
    smooth_keyframes(empty)

    log(f"temple: {len(parts)} structural parts + debris, floating")
    return col


# ----------------------------------------------------------------------------
# Floating approach path : grounds the explorer's walk toward the temple
# ----------------------------------------------------------------------------
def build_path():
    col = get_collection("02_Temple")
    stone = mat_stone("M_PathStone", base=(0.38, 0.33, 0.28))
    import random
    rng = random.Random(13)
    # slabs from the far approach down to the island edge
    start = Vector((5.0, 25.0))
    end = Vector((1.5, 11.5))
    n = 9
    slabs = []
    for i in range(n):
        t = i / (n - 1)
        x = start.x + (end.x - start.x) * t + rng.uniform(-0.3, 0.3)
        y = start.y + (end.y - start.y) * t
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(x, y, 0.0 + rng.uniform(-0.05, 0.05)))
        slab = bpy.context.active_object
        slab.name = f"Approach_Slab_{i+1:02d}"
        slab.scale = (rng.uniform(1.4, 2.0), rng.uniform(1.6, 2.2), 0.35)
        slab.rotation_euler = Euler((0, 0, rng.uniform(-0.12, 0.12)), 'XYZ')
        slab.data.materials.append(stone)
        recalc_normals(slab)
        link_to(slab, col)
        # subtle independent float
        z0 = slab.location.z
        slab.keyframe_insert("location", index=2, frame=FRAME_START)
        slab.location.z = z0 + rng.uniform(0.1, 0.25)
        slab.keyframe_insert("location", index=2, frame=200 + i*8)
        slab.location.z = z0
        slab.keyframe_insert("location", index=2, frame=FRAME_END)
        smooth_keyframes(slab)
        slabs.append(slab)
    log(f"path: {len(slabs)} floating approach slabs")
    return col


# ----------------------------------------------------------------------------
# Explorer : stylized humanoid that walks, pauses, looks up
# ----------------------------------------------------------------------------
def _limb(name, col, mat, size, location, pivot_top=True):
    """Create a box limb whose origin sits at its top (pivot) when pivot_top."""
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(scale=True)
    if pivot_top:
        # move mesh down so origin is at the top of the limb
        for v in o.data.vertices:
            v.co.z -= size[2]
    o.data.materials.append(mat)
    link_to(o, col)
    return o


def build_explorer():
    col = get_collection("03_Explorer")
    suit = mat_suit()
    visor = mat_emissive("M_Visor", color=(0.2, 0.9, 1.0), strength=4.0)
    trim = mat_metal("M_SuitTrim", base=(0.1, 0.5, 0.7), emit=(0.1, 0.8, 1.0), emit_str=3.0)

    # Root empty handles the walk path
    root = bpy.data.objects.new("Explorer_Root", None)
    root.empty_display_type = 'ARROWS'
    col.objects.link(root)

    # Hips (master of the body)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    hips = bpy.context.active_object
    hips.name = "Explorer_Hips"
    hips.scale = (0.55, 0.35, 0.45)
    bpy.context.view_layer.objects.active = hips
    bpy.ops.object.transform_apply(scale=True)
    hips.data.materials.append(suit)
    link_to(hips, col)
    hips.parent = root
    hips.location = (0, 0, 1.55)

    # Torso
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    torso = bpy.context.active_object
    torso.name = "Explorer_Torso"
    torso.scale = (0.6, 0.38, 0.7)
    bpy.context.view_layer.objects.active = torso
    bpy.ops.object.transform_apply(scale=True)
    torso.data.materials.append(suit)
    torso.data.materials.append(trim)
    link_to(torso, col)
    torso.parent = hips
    torso.location = (0, 0, 0.6)

    # Backpack (futuristic)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    pack = bpy.context.active_object
    pack.name = "Explorer_Backpack"
    pack.scale = (0.4, 0.22, 0.5)
    bpy.context.view_layer.objects.active = pack
    bpy.ops.object.transform_apply(scale=True)
    pack.data.materials.append(trim)
    link_to(pack, col)
    pack.parent = torso
    pack.location = (0, -0.32, 0.05)

    # Head (looks up at the end)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=0.32,
                                         location=(0, 0, 0))
    head = bpy.context.active_object
    head.name = "Explorer_Head"
    head.data.materials.append(suit)
    set_smooth(head)
    link_to(head, col)
    head.parent = torso
    head.location = (0, 0, 0.95)

    # Visor band
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    vis = bpy.context.active_object
    vis.name = "Explorer_Visor"
    vis.scale = (0.26, 0.18, 0.09)
    bpy.context.view_layer.objects.active = vis
    bpy.ops.object.transform_apply(scale=True)
    vis.data.materials.append(visor)
    link_to(vis, col)
    vis.parent = head
    vis.location = (0, 0.22, 0.02)

    # Arms (pivot at shoulder/top)
    armL = _limb("Explorer_ArmL", col, suit, (0.14, 0.14, 0.85), (0, 0, 0))
    armL.parent = torso; armL.location = (0.6, 0, 0.55)
    armR = _limb("Explorer_ArmR", col, suit, (0.14, 0.14, 0.85), (0, 0, 0))
    armR.parent = torso; armR.location = (-0.6, 0, 0.55)

    # Legs (pivot at hip/top)
    legL = _limb("Explorer_LegL", col, suit, (0.18, 0.18, 0.95), (0, 0, 0))
    legL.parent = hips; legL.location = (0.22, 0, -0.1)
    legR = _limb("Explorer_LegR", col, suit, (0.18, 0.18, 0.95), (0, 0, 0))
    legR.parent = hips; legR.location = (-0.22, 0, -0.1)

    # ---- Animation ----
    # Walk path: start far, approach the temple foreground, stop, look up.
    start = Vector((5.0, 25.0, -0.15))
    stop = Vector((1.8, 12.5, -0.15))
    root.location = start
    root.rotation_euler = Euler((0, 0, math.radians(190)), 'XYZ')
    root.keyframe_insert("location", frame=F_WALK_START)
    root.keyframe_insert("rotation_euler", frame=F_WALK_START)
    root.location = stop
    root.keyframe_insert("location", frame=F_WALK_END)
    root.keyframe_insert("rotation_euler", frame=F_WALK_END)
    root.keyframe_insert("location", frame=F_END)   # hold
    smooth_keyframes(root)

    # Walk cycle: swing legs/arms while moving (F_WALK_START..F_WALK_END), then settle.
    period = 24  # frames per stride
    swing = math.radians(28)
    f = F_WALK_START
    phase = 0
    while f <= F_WALK_END:
        s = math.sin(phase) * swing
        legL.rotation_euler = Euler((s, 0, 0), 'XYZ')
        legR.rotation_euler = Euler((-s, 0, 0), 'XYZ')
        armL.rotation_euler = Euler((-s*0.8, 0, 0), 'XYZ')
        armR.rotation_euler = Euler((s*0.8, 0, 0), 'XYZ')
        legL.keyframe_insert("rotation_euler", frame=f)
        legR.keyframe_insert("rotation_euler", frame=f)
        armL.keyframe_insert("rotation_euler", frame=f)
        armR.keyframe_insert("rotation_euler", frame=f)
        # body bob
        hips.location.z = 1.55 + abs(math.sin(phase)) * 0.06
        hips.keyframe_insert("location", index=2, frame=f)
        f += period // 2
        phase += math.pi
    # settle limbs to rest after walk
    for limb in (legL, legR, armL, armR):
        limb.rotation_euler = Euler((0, 0, 0), 'XYZ')
        limb.keyframe_insert("rotation_euler", frame=F_PAUSE_END)
        limb.keyframe_insert("rotation_euler", frame=F_END)
    hips.location.z = 1.55
    hips.keyframe_insert("location", index=2, frame=F_PAUSE_END)
    hips.keyframe_insert("location", index=2, frame=F_END)

    # Head looks up after the pause (toward the temple/portal)
    head.rotation_euler = Euler((0, 0, 0), 'XYZ')
    head.keyframe_insert("rotation_euler", frame=F_WALK_END)
    head.rotation_euler = Euler((math.radians(-34), 0, 0), 'XYZ')
    head.keyframe_insert("rotation_euler", frame=F_PAUSE_END)
    head.keyframe_insert("rotation_euler", frame=F_END)
    smooth_keyframes(head)
    for o in (legL, legR, armL, armR, hips):
        smooth_keyframes(o)

    log("explorer: stylized humanoid with walk cycle + look-up")
    return col, torso, root


# ----------------------------------------------------------------------------
# Cape : cloth simulation driven by wind
# ----------------------------------------------------------------------------
def build_cape(torso):
    col = get_collection("03_Explorer")
    # Cloth grid plane behind the shoulders
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=18, y_subdivisions=24, size=1.0,
                                    location=(0, 0, 0))
    cape = bpy.context.active_object
    cape.name = "Explorer_Cape"
    cape.rotation_euler = Euler((math.radians(90), 0, 0), 'XYZ')
    cape.scale = (1.45, 2.4, 1.0)
    bpy.context.view_layer.objects.active = cape
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    link_to(cape, col)

    cape_mat = bpy.data.materials.new("M_Cape")
    cape_mat.use_nodes = True
    cbsdf = cape_mat.node_tree.nodes["Principled BSDF"]
    cbsdf.inputs["Base Color"].default_value = (0.5, 0.06, 0.08, 1)
    cbsdf.inputs["Roughness"].default_value = 0.7
    if "Sheen Weight" in cbsdf.inputs:
        cbsdf.inputs["Sheen Weight"].default_value = 0.6
    cape.data.materials.append(cape_mat)

    # Pin group = top row of verts (near shoulders)
    vg = cape.vertex_groups.new(name="Pin")
    top_z = max(v.co.z for v in cape.data.vertices)
    pin_idx = [v.index for v in cape.data.vertices if v.co.z > top_z - 0.08]
    vg.add(pin_idx, 1.0, 'REPLACE')

    # Position cape behind shoulders, parent to torso so it follows the walk
    cape.parent = torso
    cape.location = (0, -0.45, 0.85)

    # Cloth modifier
    cloth = cape.modifiers.new("Cloth", 'CLOTH')
    cs = cloth.settings
    cs.quality = 7
    cs.mass = 0.25
    cs.tension_stiffness = 12
    cs.compression_stiffness = 12
    cs.shear_stiffness = 12
    cs.bending_stiffness = 0.4
    cs.use_pressure = False
    cs.vertex_group_mass = "Pin"
    cs.pin_stiffness = 1.0
    cloth.collision_settings.use_self_collision = False
    cloth.collision_settings.distance_min = 0.015
    cloth.point_cache.frame_start = FRAME_START
    cloth.point_cache.frame_end = FRAME_END

    # Subsurf for smoother cloth + smooth shading
    sub = cape.modifiers.new("Subsurf", 'SUBSURF')
    sub.levels = 1
    sub.render_levels = 2
    set_smooth(cape)

    log("cape: cloth sim with pinned shoulder row")
    return cape


# ----------------------------------------------------------------------------
# Wind force field (affects cape + dust)
# ----------------------------------------------------------------------------
def build_wind():
    col = get_collection("05_Effects")
    wind_data = bpy.data.objects.new("Wind_Field", None)
    col.objects.link(wind_data)
    wind_data.empty_display_type = 'SINGLE_ARROW'
    wind_data.location = (10, 30, 6)
    wind_data.rotation_euler = Euler((math.radians(80), 0, math.radians(20)), 'XYZ')
    bpy.context.view_layer.objects.active = wind_data
    bpy.ops.object.forcefield_toggle()
    fld = wind_data.field
    fld.type = 'WIND'
    fld.strength = 6.0
    fld.noise = 3.0
    fld.flow = 0.4
    # gusty wind over time
    fld.strength = 4.0
    wind_data.field.keyframe_insert("strength", frame=FRAME_START)
    fld.strength = 8.0
    wind_data.field.keyframe_insert("strength", frame=200)
    fld.strength = 5.0
    wind_data.field.keyframe_insert("strength", frame=400)
    fld.strength = 7.0
    wind_data.field.keyframe_insert("strength", frame=FRAME_END)
    log("wind: animated gusty wind force field")
    return wind_data


# ----------------------------------------------------------------------------
# Portal : glowing ring that activates near the end
# ----------------------------------------------------------------------------
def build_portal():
    col = get_collection("04_Portal")

    PZ = 8.0   # portal floats above the shrine, framed by the temple
    # Outer ring (vertical gateway facing the explorer's approach, +Y)
    bpy.ops.mesh.primitive_torus_add(major_radius=2.6, minor_radius=0.2,
                                     location=(0, 0, PZ))
    ring = bpy.context.active_object
    ring.name = "Portal_Ring"
    ring.rotation_euler = Euler((math.radians(90), 0, 0), 'XYZ')
    ring_mat = mat_metal("M_PortalRing", base=(0.2, 0.25, 0.3),
                         emit=(0.4, 0.7, 1.0), emit_str=0.0)
    ring.data.materials.append(ring_mat)
    set_smooth(ring)
    link_to(ring, col)

    # Energy disc (emissive, animated) - coplanar with the ring, facing +Y
    bpy.ops.mesh.primitive_circle_add(vertices=64, radius=2.45, fill_type='NGON',
                                     location=(0, 0, PZ))
    disc = bpy.context.active_object
    disc.name = "Portal_Surface"
    disc.rotation_euler = Euler((math.radians(90), 0, 0), 'XYZ')
    link_to(disc, col)

    # Animated swirling emissive material
    pmat = bpy.data.materials.new("M_PortalEnergy")
    pmat.use_nodes = True
    nt = pmat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emis = nt.nodes.new("ShaderNodeEmission")
    coord = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.name = "PortalSwirl"
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.wave_type = 'RINGS'
    wave.inputs["Scale"].default_value = 4.0
    wave.inputs["Distortion"].default_value = 8.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.02, 0.1, 0.45, 1)
    ramp.color_ramp.elements[1].color = (0.5, 0.95, 1.0, 1)
    nt.links.new(coord.outputs["Generated"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], wave.inputs["Vector"])
    nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], emis.inputs["Color"])
    nt.links.new(emis.outputs["Emission"], out.inputs["Surface"])
    disc.data.materials.append(pmat)

    # Activation: emission ramps up near the end + ring glow
    emis.inputs["Strength"].default_value = 0.0
    emis.inputs["Strength"].keyframe_insert("default_value", frame=FRAME_START)
    emis.inputs["Strength"].keyframe_insert("default_value", frame=F_PORTAL_ON)
    emis.inputs["Strength"].default_value = 14.0
    emis.inputs["Strength"].keyframe_insert("default_value", frame=F_END)
    rbsdf = ring_mat.node_tree.nodes["Principled BSDF"]
    rbsdf.inputs["Emission Strength"].default_value = 0.0
    rbsdf.inputs["Emission Strength"].keyframe_insert("default_value", frame=F_PORTAL_ON)
    rbsdf.inputs["Emission Strength"].default_value = 6.0
    rbsdf.inputs["Emission Strength"].keyframe_insert("default_value", frame=F_END)

    # Swirl animation (mapping rotation over the full clip)
    mapping.inputs["Rotation"].default_value = (0, 0, 0)
    mapping.inputs["Rotation"].keyframe_insert("default_value", frame=FRAME_START)
    mapping.inputs["Rotation"].default_value = (0, 0, math.radians(220))
    mapping.inputs["Rotation"].keyframe_insert("default_value", frame=FRAME_END)

    # Portal scales up as it activates
    disc.scale = (0.01, 0.01, 0.01)
    disc.keyframe_insert("scale", frame=F_PORTAL_ON)
    disc.scale = (1, 1, 1)
    disc.keyframe_insert("scale", frame=F_END)
    smooth_keyframes(disc)

    # A point light inside the portal that switches on
    pl_data = bpy.data.lights.new("PortalGlow", 'POINT')
    pl_data.color = (0.3, 0.7, 1.0)
    pl_data.shadow_soft_size = 1.5
    pl = bpy.data.objects.new("Portal_Light", pl_data)
    col.objects.link(pl)
    pl.location = (0, 0, PZ)
    pl_data.energy = 0.0
    pl_data.keyframe_insert("energy", frame=F_PORTAL_ON)
    pl_data.energy = 3000.0
    pl_data.keyframe_insert("energy", frame=F_END)

    log("portal: glowing swirl that activates near the end")
    return col


# ----------------------------------------------------------------------------
# Particles : drifting dust (geometry-node free, classic particle system)
# ----------------------------------------------------------------------------
def build_particles():
    col = get_collection("05_Effects")

    # Emitter volume (invisible) covering the foreground air
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(2, 16, 6))
    emit = bpy.context.active_object
    emit.name = "Dust_Emitter"
    emit.scale = (16, 16, 10)
    emit.display_type = 'WIRE'
    emit.hide_render = True
    link_to(emit, col)

    # Dust point cloud as render object
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.012, location=(0, 0, -50))
    mote = bpy.context.active_object
    mote.name = "Dust_Mote"
    mote_mat = mat_emissive("M_Dust", color=(1.0, 0.9, 0.75), strength=2.5)
    mote.data.materials.append(mote_mat)
    link_to(mote, col)

    ps_mod = emit.modifiers.new("DustSystem", 'PARTICLE_SYSTEM')
    psys = emit.particle_systems[0]
    ps = psys.settings
    ps.name = "PS_Dust"
    ps.count = 2500
    ps.frame_start = FRAME_START - 50
    ps.frame_end = FRAME_END
    ps.lifetime = FRAME_END + 100
    ps.emit_from = 'VOLUME'
    ps.physics_type = 'NEWTON'
    ps.mass = 0.0008
    ps.particle_size = 1.0
    ps.size_random = 0.6
    emit.show_instancer_for_render = False    # hide emitter mesh in render
    emit.show_instancer_for_viewport = False
    ps.render_type = 'OBJECT'
    ps.instance_object = mote
    ps.effector_weights.gravity = 0.02      # almost weightless drift
    ps.effector_weights.wind = 1.0
    ps.normal_factor = 0.0
    try:
        ps.factor_random = 0.4
        ps.use_rotations = True
        ps.rotation_factor_random = 1.0
    except Exception:
        pass

    log("particles: 2500 drifting dust motes (wind-affected)")
    return col


# ----------------------------------------------------------------------------
# Camera : cinematic move + depth of field
# ----------------------------------------------------------------------------
def build_camera(focus_target):
    col = get_collection("00_Cameras")

    cam_data = bpy.data.cameras.new("CinematicCam")
    cam_data.lens = 35.0
    cam_data.sensor_width = 36.0
    cam_data.dof.use_dof = True
    cam_data.dof.focus_object = focus_target
    cam_data.dof.aperture_fstop = 2.0
    cam_data.clip_start = 0.1
    cam_data.clip_end = 2000.0
    cam = bpy.data.objects.new("Camera_Cinematic", cam_data)
    col.objects.link(cam)
    bpy.context.scene.camera = cam

    # Aim target empty
    target = bpy.data.objects.new("Camera_Target", None)
    target.empty_display_type = 'SPHERE'
    col.objects.link(target)
    track = cam.constraints.new('TRACK_TO')
    track.target = target
    track.track_axis = 'TRACK_NEGATIVE_Z'
    track.up_axis = 'UP_Y'

    # Camera keyframes - a slow reveal that rises toward the temple
    cam_keys = [
        (F_WALK_START, Vector((14, 38, 3.5))),
        (160,          Vector((9, 30, 4.5))),
        (F_WALK_END,   Vector((4, 22, 6.0))),
        (F_PAUSE_END,  Vector((-2, 18, 8.0))),
        (510,          Vector((-7, 16, 9.0))),
        (F_END,        Vector((-5, 15, 8.8))),
    ]
    for f, loc in cam_keys:
        cam.location = loc
        cam.keyframe_insert("location", frame=f)
    smooth_keyframes(cam)

    # Target moves from the explorer to the temple/portal
    tgt_keys = [
        (F_WALK_START, Vector((4, 20, 2.0))),
        (F_WALK_END,   Vector((2, 12, 2.5))),
        (F_PAUSE_END,  Vector((0, 0, 7.0))),
        (F_END,        Vector((0, 0, 7.8))),
    ]
    for f, loc in tgt_keys:
        target.location = loc
        target.keyframe_insert("location", frame=f)
    smooth_keyframes(target)

    # Focus pull: aperture opens a touch as the portal lights up
    cam_data.dof.aperture_fstop = 2.2
    cam_data.dof.keyframe_insert("aperture_fstop", frame=F_WALK_START)
    cam_data.dof.aperture_fstop = 1.6
    cam_data.dof.keyframe_insert("aperture_fstop", frame=F_END)

    log("camera: cinematic dolly with track-to + depth of field")
    return col, cam


# ----------------------------------------------------------------------------
# Inspection / auto-fix pass
# ----------------------------------------------------------------------------
def inspect_and_fix():
    issues = []
    fixed = []
    scene = bpy.context.scene

    for obj in scene.objects:
        if obj.type != 'MESH':
            continue
        # Missing materials
        if len(obj.data.materials) == 0:
            issues.append(f"{obj.name}: no material")
        # Recalculate normals on all meshes (fix inverted)
        try:
            recalc_normals(obj)
            fixed.append(f"{obj.name}: normals recalculated")
        except Exception as e:
            issues.append(f"{obj.name}: normals failed {e}")
        # Broken modifiers (missing targets)
        for m in obj.modifiers:
            if m.type == 'PARTICLE_SYSTEM':
                continue
        # Apply auto smooth where missing handled per-build.

    # Camera clipping check
    cam = scene.camera
    if cam:
        if cam.data.clip_start <= 0:
            cam.data.clip_start = 0.01
            fixed.append("camera: clip_start fixed")
        if cam.data.clip_end < 100:
            cam.data.clip_end = 2000
            fixed.append("camera: clip_end raised")

    # Ensure every collection has objects (no empty stray collections)
    for c in bpy.data.collections:
        if len(c.objects) == 0 and len(c.children) == 0:
            issues.append(f"collection {c.name}: empty")

    # Noise control: make sure denoising is on
    if not scene.cycles.use_denoising:
        scene.cycles.use_denoising = True
        fixed.append("denoising enabled")

    log(f"inspection: {len(fixed)} auto-fixes, {len(issues)} remaining notes")
    for i in issues:
        log("  NOTE: " + i)
    return issues, fixed


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------
def main():
    log("=== building temple cinematic scene ===")
    reset_scene()
    setup_render()
    build_world()
    build_lighting()
    build_environment()
    build_temple()
    build_path()
    col_exp, torso, root = build_explorer()
    build_cape(torso)
    build_wind()
    build_portal()
    build_particles()
    build_camera(root)
    inspect_and_fix()

    # Make sure frame range/camera are correct, go to first frame
    bpy.context.scene.frame_set(FRAME_START)

    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    log(f"saved -> {BLEND_PATH}")
    log("=== done ===")


if __name__ == "__main__":
    main()
