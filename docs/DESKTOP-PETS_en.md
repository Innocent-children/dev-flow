# Desktop pet appearance packs

[中文](DESKTOP-PETS.md) | [English](DESKTOP-PETS_en.md)

Import an appearance from a local folder. Users provide images and descriptions; Dev Flow owns task stages, bubbles, navigation, and playback.
Changing appearances requires neither Swift nor rebuilding or reinstalling the app.

## Import and selection

1. Open Choose appearance from the pet context menu or menu bar.
2. Select Import appearance and choose the folder containing `pet.json`.
3. A successful import selects the appearance immediately. Use the menu to select the bundled character or another imported appearance.

Import saves a copy, so the source folder can be moved away. Reimport an edited pack with the same ID to update it. Failed validation preserves
the installed appearance. Task and appearance choices are stored independently; switching preserves the watched task and does not replay old completion prompts.

User artwork lives in `productRoot/pet/appearances/<id>`; pet settings store `selected_appearance`. Upgrades and ordinary uninstall preserve packs
and selection. Confirmed factory-reset clears them with the pet directory. A missing or invalid saved pack is reported, and the bundled character
is used until the user imports or selects an appearance again.

## Dev Flow static appearance

A minimal pack contains two files:

```text
orange-square/
  pet.json
  pet.png
```

`pet.json`:

```json
{
  "id": "orange-square",
  "name": "Orange square",
  "image": "pet.png"
}
```

`id` contains 1–64 lowercase ASCII letters, digits, hyphens, or underscores, starting with a letter or digit. `name` contains 1–100 characters.
`image` names a PNG relative to this folder; a transparent background is recommended. One image serves all stages, which the bubble text distinguishes.
Copy the repository's [static example](../packages/desktop-pet/examples/orange-square/pet.json) and replace its image and name.

## Dev Flow animated appearance

An animated pack's `pet.json` contains only `id` and `name`. Provide sibling `animations.json` and `Assets/`:

```text
my-pet/
  pet.json
  animations.json
  Assets/
    idle/0.png
    idle/1.png
    working/0.png
    blocked/0.png
    complete/0.png
    complete/1.png
    disconnected/0.png
```

This catalog uses 128×128 images. Keep canvas geometry and character placement consistent across frames:

```json
{
  "canvas": { "width": 128, "height": 128 },
  "anchor": { "x": 64, "y": 128 },
  "clips": {
    "idle": { "frames": ["idle/0.png", "idle/1.png"], "fps": 8, "loop_range": [0, 1], "rest_frame": 0 },
    "working": { "frames": ["working/0.png"], "fps": 8, "loop_range": [0, 0], "rest_frame": 0 },
    "blocked": { "frames": ["blocked/0.png"], "fps": 8, "loop_range": [0, 0], "rest_frame": 0 },
    "complete": { "frames": ["complete/0.png", "complete/1.png"], "fps": 8, "loop_range": null, "rest_frame": 1 },
    "disconnected": { "frames": ["disconnected/0.png"], "fps": 8, "loop_range": [0, 0], "rest_frame": 0 }
  }
}
```

Provide all five clips; they may reuse one image. A single-frame clip is static. Multiple frames use `fps`, or an optional
`frame_durations_ms` array with one duration per frame that takes precedence over `fps`. `loop_range` includes both bounds. Completion
uses `null` and ends on `rest_frame`. Reduce Motion and the animation switch use static frames. The player scales the full canvas proportionally;
authors align artwork on a consistent canvas, with `anchor` retained as the shared artwork reference point.

## Codex pet packs

The same import entry accepts a local Codex pack without editing its files:

```json
{
  "id": "my-codex-pet",
  "displayName": "My Codex pet",
  "description": "My companion",
  "spriteVersionNumber": 2,
  "spritesheetPath": "spritesheet.webp"
}
```

Select the individual pet folder, such as `~/.codex/pets/my-codex-pet`, containing `pet.json` and its PNG/WebP atlas. Omitted
`spriteVersionNumber` means 1. Version 1 uses 1536×1872; version 2 uses 1536×2288. Both have eight columns and 192×208 cells.
These are artwork-format versions, not Dev Flow product versions.

| Dev Flow display | Codex animation row | Frames |
| --- | --- | --- |
| Idle | idle, row 0 | 6 |
| Ordinary stage | running, row 7 | 6 |
| Blocked | waiting, row 6 | 6 |
| Completion | jumping, row 4 | 5 |
| Disconnected | failed, row 5 | 8 |

Import crops PNG frames and preserves standard frame timings, then uses the common player. Only the required animation rows are read.
Codex gaze, walking, and task-activity behavior are outside appearance import. Dev Flow continues to own task meaning, completion conditions,
and navigation. Source files stay intact, and the installed directory ID is derived consistently from the Codex `id`.

## File requirements

- Each description file is at most 256 KiB. References must be relative paths to regular files; symlinks and references outside the folder are rejected.
- Dev Flow PNG dimensions are at most 1024 pixels per side. Animation frame dimensions must match `canvas`.
- Catalogs contain at most 512 frame references; PNG files total at most 64 MiB. A clip's estimated decoded RGBA data is at most 128 MiB.
- `fps` is 0.1–120; per-frame durations are 9–60000 milliseconds. Loop and rest indexes must be valid.
- Codex atlases are at most 64 MiB and must match their format's dimensions. Packs contain presentation data, not executable scripts.

The current entry imports local folders. See the [command reference](COMMANDS_en.md#desktop-pet-local-development-package) for building,
starting, and platform scope.
