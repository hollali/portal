# Avatar sources, licences and approvals

The animated guide on `/ask` is a likeness of a living public figure. That makes
the provenance of the likeness as much a part of the feature as the code is: a
model nobody can account for is a model that cannot be defended when someone
objects to it.

This file is the record. Nothing goes into `public/avatar/` until the approval
row at the bottom is filled in.

## Rules

1. Only images with a licence we can point at. No search-engine result pages, no
   screenshots of social media, no "found in the archive" scrapes.
2. Every reference image is logged below: where it came from, who holds it, and
   what permission covers it.
3. The Speaker's office approves the likeness **and** the finished model. An
   approval covers one model. A revision needs a new row.
4. The guide never speaks in his voice. It quotes stored records verbatim and
   introduces them in the third person — see `src/lib/speakText.ts`. Cloning his
   voice is not available under any approval.
5. The label *Animated guide. This is not a recording of the Speaker.* is rendered
   unconditionally by `src/components/AvatarStage.tsx`. It is not a setting.
6. Removal must not need a deploy. Setting `ask.guide` to `off` at
   `/admin/settings` removes the guide on the next page load. See
   `src/lib/askGuide.ts`.

## Reference images

One row per image. Blank table, deliberately: no approved images have been
collected yet.

| # | Description | Source / URL | Rights holder | Permission on file | Added by | Date |
|---|---|---|---|---|---|---|
| — | _none yet_ | | | | | |

Ideal set for a likeness, in priority order:

1. A sharp, front-facing portrait at print resolution, evenly lit, neutral
   expression.
2. Left and right three-quarter views.
3. Left and right profiles.

A single front photograph is enough to start, and enough to be badly wrong.

## Modelling method

Three routes were considered. Record which one was actually used.

- [ ] **A. Commissioned 3D artist.** Best accuracy and control, slowest and most
      expensive. Include blendshapes in the brief.
- [ ] **B. Photo-to-3D tool.** A single-photo reconstruction, cleaned up and
      rigged. Read each tool's terms first: many permit only your own face, or
      require a consent record we do not have. Expect manual cleanup.
- [x] **C. Stylised 2.5D portrait.** Layered illustration with an animated mouth,
      blinks and slight parallax. Fast, light, and hard to mistake for footage.
      **This is what ships.** See `src/components/GuidePortrait.tsx`.

**Recommended: C, or a deliberately stylised A.** Stylisation is easier to rig,
far lighter to load, and much harder to mistake for real footage. Photorealism
buys nothing here that the labelling rules do not already have to carry.

## Model requirements

- `.glb`, under 5 MB, Draco or meshopt compressed
- Blendshapes: at least one of `jawOpen`, `mouthOpen`, `viseme_aa`. Better:
  ARKit-style 52, or a viseme set for accurate lip-sync
- `eyeBlinkLeft` and `eyeBlinkRight`
- Textures 1024 px or smaller, KTX2 or WebP
- Neutral rest pose, facing camera, head and shoulders only

Compress with:

```bash
npx @gltf-transform/cli optimize guide.glb guide.min.glb --compress draco
```

## What ships today: route C

There is no approved model, and `/ask` now ships **route C — a stylised 2.5D
portrait** in `src/components/GuidePortrait.tsx`. It is an original illustration
in layered SVG: three planes (backdrop, head, near shoulder) that slide at
different rates to read as depth, a mouth driven from the same `mouthRef` the 3D
scene uses, lids on a random 2–6s blink, and a lean per `GuideState`.

Why C and not a likeness, in the order that actually decided it:

1. **It keeps rule 5 true.** The label says the guide is not a recording of the
   Speaker. A photographic likeness that opens and closes its mouth over
   machine-written text makes that sentence false, which is the difference
   between a stylised presenter and synthetic media of a real person.
2. **It belongs to nobody.** No photograph of a real person is involved, so no
   likeness right, no office approval and no consent record is in play. The
   reference table below stays empty by design, not by oversight.
3. **It needs no WebGL.** Every visitor now gets a face, including the ones whose
   device cannot open a context. The old "the guide cannot run on this device"
   state is gone.
4. **It is about 6 KB of vector.** The 3D route still needs a model file that does
   not exist, so it stays dormant behind `modelUrl`.

### Reference image offered and rejected

One candidate was offered for a likeness build, and it is recorded here so the
same one is not re-proposed:

| Description | Source | Why rejected |
|---|---|---|
| 400 × 400 profile avatar | `share.google/fHsreQf8hh7DI2NhP` → redirects to `pbs.twimg.com/profile_images/1361293859125346309/HXVA-EsB_400x400.jpg` via `x.com/askbagbin` | Rule 1, by name: a search-engine result reached through a social-media profile page. Separately, 400 × 400 is a circular avatar crop, not a portrait — unusable for a rig at any stylisation level. |

Nothing was downloaded from it and nothing derived from it exists in the repo.

### The 3D route is dormant, not deleted

`GuideScene.tsx` still exists and is still the only file that imports three.js.
It renders only when `glOk && modelUrl && figureOnScreen`, and `modelUrl` is
`null`, so nothing fetches a renderer today. Turbopack's dev server still
requests the 1033-byte async loader stub for the dynamic entry; that is a
prefetch artefact of `next dev`, it evaluates nothing, and no three.js chunk is
requested. Verify with a production build before believing any request-count
claim.

## Where the model is loaded

`GuideScene.tsx` is the only file that imports three.js, and `AvatarStage.tsx`
loads it through `next/dynamic` after a WebGL context has been obtained. A
browser that cannot draw the figure — or a reader on mobile data who never
scrolls to it — gets the label, the captions and the voice without fetching a
renderer at all. Keep it that way: importing the scene from `AvatarStage` would
undo the largest saving in the feature, and there is a test in
`src/__tests__/avatarStage.test.tsx` that fails if it happens.

## Approvals

| Date | Stage | Approver | Notes |
|---|---|---|---|
| — | Reference images accepted | | |
| — | Draft likeness reviewed | | |
| — | Final `.glb` approved for `public/avatar/` | | |

## Guide wording

The guide's own lines live in `src/lib/guideLines.ts`, not here. They are short
and neutral by design, and they are the only sentences in the feature that are
not quoted from a stored record, so they are the ones worth reading once more:

- "Welcome. Ask me about the archive."
- "Let me look through the archive."
- "Here is what the record says."
- "I could not find a record of that. Here is what I can show you."
- "This is the actual recording, not the guide speaking."