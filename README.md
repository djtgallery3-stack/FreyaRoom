# Freya's Room — Interactive 3D

First-person virtual room exploration (Three.js + Vite + Tailwind CSS v4), deployed on Vercel.

## Features

- **First-person navigation** — `W A S D` / arrow keys, `Shift` to run, mouse look via the Pointer Lock API
  (click to enter, `Esc` to release). Smooth acceleration/friction, head-bob and simple collision against walls,
  bed, desk, chair and shelves.
- **6 Memory Boxes** — look at a box and press `E` / click: the lid opens (115°) and a thumbnail gallery of that era's photos
  appears; click a thumbnail for the full-size lightbox (←/→ to browse).
- **Wall photo board** — click any photo on the cardboard wall for a lightbox.
- **Freya dolls** — click a doll (bookshelf, bed, desk) to open a 3D orbit viewer (rotate 360°, zoom, pan).
- **Audio** — looping BGM ("Waiting Room") with mute (`M`) / volume control, footstep SFX while walking, box-open SFX.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173  (add ?debug to expose window.__freya)
npm run build      # outputs dist/
npm run preview
```

## Project layout

```
index.html            HUD + modal markup (Tailwind utility classes)
src/main.js           bootstrap, state machine (loading → start → playing ↔ modal)
src/world.js          GLB loading, lighting, colliders, interactable discovery
src/player.js         FPS controller + collision
src/interaction.js    centre-screen raycast, hover feedback, lid animation
src/ui.js             gallery / lightbox / orbit modals (focus trap, Esc, keyboard)
src/orbit.js          lazy 3D inspector (own renderer, reuses room geometry)
src/audio.js          BGM / SFX
src/data/memories.json  generated: photo titles/notes + board photo URLs
public/models/room.glb  generated: Draco-compressed room scene (~16 MB)
public/photos/**      generated: webp full (≤1600px) + thumbnails (360px)
public/audio/*.mp3
tools/                asset pipeline (see below)
```

## Asset pipeline (only needed when the source art changes)

The generated assets are committed so Vercel needs nothing but `npm run build`.

```bash
# 1. Room scene: Blender → GLB (Draco, 1024px textures, dolls decimated to ~40k verts)
blender -b /path/to/prepared_full_scene.blend --python tools/export_room.py -- public/models/room.glb

# 2. Photos + audio + src/data/memories.json
SRC=/path/to/freyaproject node tools/build_assets.mjs
```

`tools/cardboard_map.json` maps each `Cardboard_Photo_NN` node of the scene to its source photo.

## Deploy (Vercel)

Import the GitHub repo in Vercel — framework preset **Vite**, build command `npm run build`, output `dist`.
No environment variables are needed.

## Known limitations

- Desktop only (keyboard + mouse); touch devices see a notice.
- Procedural Blender shader details (wallpaper pattern, animated emission) are not carried over by glTF; lighting is
  re-created in Three.js (`src/world.js › setupLighting`).
