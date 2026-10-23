"""
Export the master Blender scene (prepared_full_scene.blend) to a web-optimised GLB.

Usage:
  blender -b <scene.blend> --python tools/export_room.py -- <out.glb>

What it does
  * jumps to frame 1 (door closed, box lids closed, stickers on the lids)
  * removes everything the web viewer doesn't need (lights, camera, fonts, hidden
    objects, per-box hero photo planes, which are streamed as normal images)
  * decimates the ~1M vertex Freya dolls/plushies down to ~40k vertices
  * downsizes textures to max 1024px
  * exports a Draco compressed GLB (no animation, node names preserved)
"""
import sys
import bpy

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "/tmp/room.glb"
MAX_TEX = 1024
DOLL_TARGET_VERTS = 40000
DOLLS = [
    "Doll_Freya_Slot1_Trainee",
    "Doll_Freya_Slot2_TimT",
    "Doll_Freya_Slot3_SeifukuMerah",
    "Doll_Freya_Slot4_Ratu",
    "Plushie_Freya",
    "Plushie_Freya_Seifuku",
]

sc = bpy.context.scene
sc.frame_set(1)
bpy.context.view_layer.update()

# ---------------------------------------------------------------- clean up
to_remove = []
for o in bpy.data.objects:
    if o.type in {"LIGHT", "CAMERA", "FONT", "CURVE"}:
        to_remove.append(o)
    elif o.name.startswith("CamTarget") or o.name.endswith("_Target"):
        to_remove.append(o)
    elif "_Hero_" in o.name:
        to_remove.append(o)
    elif o.type == "MESH" and (o.hide_render or o.hide_viewport):
        to_remove.append(o)
for o in to_remove:
    bpy.data.objects.remove(o, do_unlink=True)

# ---------------------------------------------------------------- decimate dolls
for name in DOLLS:
    o = bpy.data.objects.get(name)
    if not o:
        print("WARN missing", name)
        continue
    for m in list(o.modifiers):
        o.modifiers.remove(m)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    faces = len(o.data.polygons)
    target_faces = 240000
    if faces > target_faces:
        mod = o.modifiers.new("WebDecimate", "DECIMATE")
        mod.ratio = target_faces / faces
        mod.delimit = {'UV'}
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for poly in o.data.polygons:
        poly.use_smooth = True
    o.select_set(False)
    print("DOLL", name, len(o.data.vertices), "verts")

    # Clean doll materials: disconnect harsh normal maps & fix metallic/roughness for porcelain/plush finish
    for slot in o.material_slots:
        mat = slot.material
        if not mat or not mat.use_nodes:
            continue
        for node in mat.node_tree.nodes:
            if node.type == 'BSDF_PRINCIPLED':
                normal_inp = node.inputs.get('Normal')
                if normal_inp and normal_inp.is_linked:
                    mat.node_tree.links.remove(normal_inp.links[0])
                metallic_inp = node.inputs.get('Metallic')
                if metallic_inp and metallic_inp.is_linked:
                    mat.node_tree.links.remove(metallic_inp.links[0])
                metallic_inp.default_value = 0.0
                roughness_inp = node.inputs.get('Roughness')
                if roughness_inp and roughness_inp.is_linked:
                    mat.node_tree.links.remove(roughness_inp.links[0])
                roughness_inp.default_value = 0.65

# ---------------------------------------------------------------- procedural materials
# glTF can't carry Blender's procedural shader trees (wallpaper, wood floor): the exporter
# would fall back to flat 0.8 grey. Replace them with warm, charming movie-reel tones.
FLAT = {
    "Mat_FloralWallpaper": (0.91, 0.84, 0.83, 1.0),
    "Mat_LightOakFloor": (0.58, 0.44, 0.32, 1.0),
}


def has_image_in_chain(socket, depth=0):
    if not socket.is_linked or depth > 6:
        return False
    node = socket.links[0].from_node
    if node.type == "TEX_IMAGE":
        return True
    return any(has_image_in_chain(i, depth + 1) for i in node.inputs)


for mat in bpy.data.materials:
    if not mat.use_nodes:
        continue
    for node in mat.node_tree.nodes:
        if node.type != "BSDF_PRINCIPLED":
            continue
        base = node.inputs["Base Color"]
        if base.is_linked and not has_image_in_chain(base):
            mat.node_tree.links.remove(base.links[0])
            base.default_value = FLAT.get(mat.name, (0.8, 0.8, 0.8, 1.0))
            print("FLATTENED", mat.name)

# ---------------------------------------------------------------- textures
for img in bpy.data.images:
    if img.size[0] == 0:
        continue
    w, h = img.size
    m = max(w, h)
    if m > MAX_TEX:
        k = MAX_TEX / m
        img.scale(max(1, int(w * k)), max(1, int(h * k)))

# drop unused data so the exporter has less to chew on
bpy.ops.outliner.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)

bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    export_apply=True,
    export_cameras=False,
    export_lights=False,
    export_animations=False,
    export_yup=True,
    export_image_format="AUTO",
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    export_extras=False,
)
print("EXPORTED", OUT)
