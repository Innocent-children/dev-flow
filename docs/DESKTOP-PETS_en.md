# Desktop pet usage and appearance guide

[中文](DESKTOP-PETS.md) | [English](DESKTOP-PETS_en.md)

The desktop pet shows the saved state of one selected Dev Flow Task and opens its WebUI on click. Appearance packs supply artwork;
the local scheduler runs idle activities, while Core owns Task state. This guide covers obtaining and starting the app, selecting tasks,
updating the program and artwork, animation rules, pack creation, and troubleshooting.

## Environment and delivery

The desktop component targets macOS arm64 (Apple Silicon) and requires at least one installed and configured Codex or DeepSeek Adapter to provide Core.
The Swift Package and app metadata target macOS 14; actual minimum-system operation, Developer ID signing, and Apple notarization have not completed
formal distribution verification. See the [support matrix](SUPPORT-MATRIX_en.md#desktop-pet-functional-checks) for the verified scope.

Below, `productRoot` means the product directory, which defaults to `~/.dev-flow` on macOS; settings and appearances live in its `pet/` subdirectory.

The repository's regular npm package lists and release preparation do not include `DevFlowPet.app`. A dedicated local build script adds the native
app to an `@imotong/dev-flow` development package. Installing a regular Adapter package alone does not provide the pet application.
Running a built app requires neither Swift nor Xcode. Building requires Node.js >=24 and a Swift >=6.0 toolchain available through `xcrun swift`.

## Local build and installation

Configure at least one Adapter through the [unified installation entry](COMMANDS_en.md#recommended-entry-for-most-users); existing configurations can be reused.
Run the following from the repository root, with an absolute output directory outside the repository:

```bash
node scripts/build-desktop-pet.mjs --output "/absolute/pet-build"
```

The script compiles Swift, assembles artwork and language resources, signs ad hoc, and creates a `.tgz` plus `desktop-pet-build.json`.
It neither rebuilds Core nor publishes a package. If you obtain a local package produced by this script, proceed directly to installation.
Replace `<local-package>.tgz` below with the actual filename reported by the build result's `tarball` field:

```bash
npm install -g "/absolute/pet-build/<local-package>.tgz"
dev-flow pet start
```

The local unified-entry package provides `dev-flow`. Start the app through this command rather than double-clicking the bundle;
the launcher supplies Core and data-directory arguments. Startup first uses an existing `~/.dev-flow/pet/DevFlowPet.app`, then the current
unified-entry package's `runtime/darwin-arm64/DevFlowPet.app`. Installation helpers copy an app into the user directory only when the target is missing
and a candidate package actually contains it. Updating an existing app is covered next.

## Updating the program and artwork

The package, installed app copy, and user artwork are updated separately:

| Item | Update method |
| --- | --- |
| Local unified-entry package | Quit the pet, then install the newly built `.tgz`. This updates the package's CLI and bundled app. |
| User-directory `DevFlowPet.app` | npm package installation preserves an existing copy here. Quit the pet and replace it with the complete `.app` from the new package. |
| Imported appearance | Reimport the same source folder from the menu after changing or adding artwork. App upgrades do not reread the original source directory or create missing animations. |

While the pet is running, inspect `executable_path` in `~/.dev-flow/pet/runtime.json` to identify whether it uses the package's app or the user-directory copy.
Normal shutdown removes this record, so inspect it before quitting. Update in this order:

1. Quit through the menu or `dev-flow pet stop`. If the command fails, quit from the menu of the running pet first.
2. Install the new local `.tgz`. If the previous executable was in the user directory, choose a fresh empty directory and extract that same new package:

```bash
mkdir -p "/absolute/pet-unpack"
tar -xzf "/absolute/pet-build/<local-package>.tgz" -C "/absolute/pet-unpack"
```

3. When updating the user-directory copy, copy the complete `DevFlowPet.app` from `/absolute/pet-unpack/package/runtime/darwin-arm64/` into `~/.dev-flow/pet/`,
   replacing the app with the same name in Finder. Replace only the application bundle; preserve `settings.json` and `appearances/`.
4. Run `dev-flow pet start` again. To add artwork animations, also reimport the source folder as described under Import and selection.

## Default appearance and external artwork

The local pet package includes only the default appearance from `packages/desktop-pet/default-appearance/`, with nine clips and 312 SVG frames. The build copies the artwork and verifies each file against its source. Import Whale Girl or other custom appearances as
separate artwork packs: choose Import appearance and select a folder containing `pet.json`. Supported formats
are listed below under Appearance types and available animations.

Imported artwork lives in `productRoot/pet/appearances/<id>` and is preserved across application updates.
Reimport the same source folder to update a custom appearance. Switching appearances keeps the watched Task.

## Task selection and basic controls

The menu bar entry uses a monochrome Dev Flow mark, with a clear gap between the crossbar and main curve at small sizes. The 18 pt vector icon is tinted by macOS for the menu bar appearance and selection state.

Startup restores the saved task selection for the current data directory. Without a saved selection, it chooses the most recently updated blocked task,
then the most recently updated active task. If neither exists, it remains unselected. Use Choose task from the context menu or menu bar to change the watched task;
if no task existed at startup in the current run, choose a subsequently created task from the panel.

Ordinary Codex chats do not automatically become Dev Flow Tasks. A selected task that remains active keeps working or review artwork even when its Host has no new output.

| Operation | Result |
| --- | --- |
| Left-click the pet or bubble | Open the selected Task's WebUI, or the list when no task is selected. |
| Context menu / menu bar | Choose tasks and appearances, import packs, adjust pet size, control animations and idle activities, hide, or quit. |
| Hover | Expand the bubble; hovering over the character can also trigger a wave when idle conditions are met. |
| Drag and drop | Save the new placement, which becomes the center of subsequent walks. |
| Hide or system sleep | Stop animation, movement, and observation requests; show or wake to read the current state again. |
| Quit / `dev-flow pet stop` | End only the pet, preserving WebUI, Tasks, settings, and artwork. |

Only `dev-flow pet start` and `dev-flow pet stop` are supported pet commands. Output is plain text, with exit codes `0` for success, `1` for runtime failure,
and `2` for invalid arguments. There is no public `pet status` or `pet start --json`; use the error text and troubleshooting below.

## Pet size

Pet size offers 50%, 75%, 100%, 125%, 150%, and 200%, defaulting to 100% and saved as `scale` in `settings.json`. Scaling affects the character while bubble text and width stay unchanged.
Resizing preserves the artwork anchor position before constraining the window to the visible screen. The size and position apply after saving succeeds; a failed save shows a message and keeps the current size. Walking speed follows the scale.

## Appearance types and available animations

Rules use animation keys for every appearance, with no behavior tied to a particular name. The artwork actually supplied determines which effects an appearance can show.

| Appearance type | Saved and played content |
| --- | --- |
| Single PNG or SVG | All five task clips share one image, producing a static appearance. |
| Native Dev Flow PNG/SVG animation pack | Five task clips are required and four additional clips are optional; each clip's frame count comes from its own catalog, and SVG retains its vector representation. |
| Standard Codex atlas or a high-resolution extension with the same layout | Extract the fixed nine animation rows: nine clips, 57 frames. Format 2's extra gaze frames are outside the extraction scope. |

The five required clips are `idle`, `working`, `blocked`, `complete`, and `disconnected`, ensuring each task state has artwork.
The four additional clips are `running-right`, `running-left`, `waving`, and `review`, supporting walking, responses, and thinking.
Missing additional clips are removed from the idle candidate set; review nodes use working if review artwork is absent.
Inspect `clips` in `productRoot/pet/appearances/<id>/animations.json` to see the installed copy's animations.

## Import and selection

1. Open Choose appearance from the pet context menu or menu bar.
2. Select Import appearance and choose the folder containing `pet.json`.
3. A successful import selects the appearance immediately. Use the menu to select the bundled character or another imported appearance.

Import saves a copy, so the source folder can be moved away. Reimport an edited pack with the same ID to update it.
The complete converted pack must pass the same validation used when loading, inside a temporary directory, before it replaces the installed directory.
Failed validation preserves the installed appearance and selection. Task and appearance choices are stored independently; switching preserves the watched task and does not replay old completion prompts.

User artwork lives in `productRoot/pet/appearances/<id>`; pet settings store `selected_appearance`. Upgrades and ordinary uninstall preserve packs
and selection. Confirmed factory-reset clears them with the pet directory. A missing or invalid saved pack is reported, and the bundled character
is used until the user imports or selects an appearance again.

## Dev Flow static appearance

A minimal pack contains a manifest and one PNG or SVG. This example uses PNG:

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
`image` names a PNG or SVG relative to this folder; a transparent background is recommended. One image serves all stages, which the bubble text distinguishes.
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

Frames can use PNG or SVG. SVG files follow the file requirements below and preserve their original vector content on import. This example uses 128×128 PNG images. Keep canvas geometry and character placement consistent across frames:

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

Provide all five task clips; they may reuse one image. Catalogs may also include `running-right`, `running-left`, `waving`, and `review`.
Every supplied clip follows the same validation and loading rules. A single-frame clip is static. Multiple frames use `fps`, or an optional
`frame_durations_ms` array with one duration per entry in `frames` that takes precedence over `fps`. `loop_range` includes both bounds. Completion
uses `null` and ends on `rest_frame`. Reduce Motion and the animation switch use static frames. The player scales the full canvas proportionally;
authors align artwork on a consistent canvas, with `anchor` retained as the shared artwork reference point.

## Compatibility with standard Codex pet formats

Dev Flow supports Codex sprite formats 1 and 2. Compatibility covers the local pack's atlas layout, required animation frames, and per-frame timings;
Dev Flow owns task stages, prompts, and navigation. The importer accepts a PNG/WebP atlas and a `pet.json` with these fields:

```json
{
  "id": "my-codex-pet",
  "displayName": "My Codex pet",
  "description": "My companion",
  "spriteVersionNumber": 2,
  "spritesheetPath": "spritesheet.webp"
}
```

Select the individual pet folder, such as `~/.codex/pets/my-codex-pet`, containing `pet.json` and its PNG/WebP atlas.
This importer requires `id`, `displayName`, and `spritesheetPath`: `id` is nonempty with at most 256 characters, `displayName` contains
non-whitespace content with at most 100 characters, and `spritesheetPath` is a relative file path. `description` is optional and does not affect task presentation.
Omitted `spriteVersionNumber` means 1; an explicit value must be 1 or 2, matching the
[official Codex pet version parameter](https://developers.openai.com/codex/reference/commands#pets).

| Standard Codex format | Atlas size | Grid | Cell size |
| --- | --- | --- | --- |
| `spriteVersionNumber: 1` | 1536×1872 | 8 columns, 9 rows | 192×208 |
| `spriteVersionNumber: 2` | 1536×2288 | 8 columns, 11 rows | 192×208 |

Both standard formats share the nine animation rows below. Dev Flow imports all nine, totaling 57 frames.
Format 2 includes additional gaze frames; the current import covers the first nine animation rows.
Here, 1 and 2 identify Codex artwork formats, not Dev Flow product versions.

| Animation | Catalog key | Codex animation row | Frames |
| --- | --- | --- | --- |
| Idle | `idle` | idle, row 0 | 6 |
| Walk right | `running-right` | running-right, row 1 | 8 |
| Walk left | `running-left` | running-left, row 2 | 8 |
| Wave | `waving` | waving, row 3 | 4 |
| Completion | `complete` | jumping, row 4 | 5 |
| Disconnected | `disconnected` | failed, row 5 | 8 |
| Blocked | `blocked` | waiting, row 6 | 6 |
| Ordinary stage | `working` | running, row 7 | 6 |
| Review | `review` | review, row 8 | 6 |

Import crops PNG frames and preserves standard frame timings, then uses the common player. Walk right, walk left, wave, and review
participate in the idle activities and task animation selection below. Looping artwork can also finish after a specified number of full cycles.
Dev Flow owns task meaning, completion conditions, and navigation; `behavior-map.json` is not used for importing or scheduling animations.
Source files stay intact, and the installed directory ID is derived consistently from the Codex `id`.

## Dev Flow's own high-resolution extension

The same entry also supports Dev Flow's own high-resolution atlas extension. It uses the `pet.json` fields and animation row layout above,
preserving the original cell resolution when converting to common PNG frames. This extension is supported by Dev Flow and is outside the
standard Codex formats. A successful Dev Flow import does not imply that Codex can read the original atlas. To use the artwork in Codex as well,
provide a separate atlas with the standard dimensions matching its `spriteVersionNumber` in the table above.

Extension cropping rules:

- The atlas has eight columns and its width must be divisible by 8: `cell_width = width / 8`.
- Cells keep the 192:208 ratio: `cell_height = cell_width × 208 / 192` must be an integer.
- The height must cover the first nine complete animation rows: `height >= cell_height × 9`. All nine listed clips are extracted.
- `spriteVersionNumber` still accepts only 1 or 2 and defaults to 1. Extension cell dimensions come from the width;
  the field does not require an extension atlas to have a standard format's total height.

For example, an 8-bit 12288×14976 atlas has 1536×1664 cells and nine rows. Even if its field is 2, Dev Flow extracts all nine clips using
the extension rules. It is not a standard Codex format 2 atlas. Its estimated decoded RGBA data is 702 MiB and its largest eight-frame clip
is estimated at 78 MiB, both within the limits below. Import must also satisfy the total size limit for converted PNG files.

## Idle activities and animation triggers

The menu includes an enabled-by-default Idle activities switch, saved as `idle_activities_enabled`. Turning it off retains baseline idle
and task animations while stopping idle rotation, interaction waves, and automatic movement. The Animations switch and the system's
Reduce Motion setting take precedence; disabling animation uses still frames.

Idle activities begin when the service is connected, the window is visible, and no task is selected. Completed, cancelled, or archived tasks
retain their corresponding posture for three seconds before idling. An observed completion first plays its full celebration, then waits those
three seconds. A first read of an already-completed task uses its still completion frame without replaying a historical celebration.
Active, blocked, unavailable, or unknown tasks and disconnected services use their corresponding task presentation.

| Animation | Trigger rules |
| --- | --- |
| Baseline idle | Wait a random 6–12 seconds after each short activity before selecting the next one. Ordinary reads of the same state preserve the current animation and deadline. |
| Walk right, walk left | Initial weight: 25% each. With at least 40 pt available in the direction, move horizontally 40–80 pt at about `20 × scale` pt/second. Duration is distance divided by speed, or 2–4 seconds at 100% size. A finished walk has a 30% chance of continuing with one wave. |
| Wave | Random weight: 20%. Idle startup or showing the pet, hovering over the character for at least 0.4 seconds, and dropping it after a drag can also trigger a wave. Play 1–2 cycles with a shared 20-second cooldown. Continuous hover responds once; leaving for at least two seconds rearms it. |
| Review / thinking at the computer | Random weight: 30%. During idle, play enough complete cycles to meet a randomly selected 3–5-second target, then return to idle. During an actual task's `COMPREHENSION_REVIEW` node, loop continuously; leaving that node restores working artwork. |

Exclude unavailable artwork, cooling-down actions, and directions with insufficient room before sampling the remaining weights.
Avoid consecutive identical choices when alternatives exist. Appearances without review artwork use working during review nodes.
Idle thinking preserves the existing bubble text; Core state continues to determine task meaning and navigation.

Automatic walking stays within 120 pt horizontally of the last manual placement, with targets at least 16 pt from the current screen edge
and the full window inside the visible area. Temporary movement stays in memory; only manual dragging updates the saved position.
Screen layout changes cancel the current route and constrain the window again.

Entering the pet window stops movement and pauses random activities. Only hovering over the character triggers a wave; bubble hover still
expands information. Mouse presses, dragging, menus, and selection/import panels suspend idle activities. Left-click navigation and right-click
menus keep their existing behavior. Observed blocked, completed, or disconnected states immediately interrupt idle activities.
Hiding, sleeping, or turning off the relevant switches cancels idle deadlines and movement. Resuming schedules fresh activities without replaying
interrupted ones. The local scheduler, player, and window coordinate activity execution, completion, and idle waiting; ordinary polling does not
restart animations repeatedly.

## File requirements

- Each description file is at most 256 KiB. References must be relative paths to regular files; symlinks and references outside the folder are rejected.
- Dev Flow PNG/SVG animation frame dimensions must match `canvas`, whose width and height are positive integers. Static PNGs and individual PNG frames
  have an estimated decoding limit of 128 MiB each.
- Catalogs contain at most 512 frame references. Referenced PNG/SVG artwork files total at most 128 MiB to accommodate nine high-resolution clips. Each clip's RGBA data, estimated as
  `canvas.width × canvas.height × 4 × frame_count`, is at most 128 MiB; `frame_count` is the number of frames in the clip.
- Each SVG is UTF-8 and at most 1 MiB, with integer root dimensions from 1 to 4096. An optional `viewBox` must be `0 0 width height`. Accepted content is limited to static vector shapes, gradients, and internal references, with at most 4096 elements and 64 nesting levels. Scripts, embedded raster images, external references, document types, and entities are rejected. The current system must be able to render the artwork.
- `fps` is 0.1–120; per-frame durations are 9–60000 milliseconds. Loop and rest indexes must be valid.
- Standard Codex and extended Dev Flow source atlases are at most 512 MiB, with an estimated decoding limit of 1 GiB.
- Before allocating pixels, decoding estimates use image metadata: `width × height × 4 × ceil(bit_depth / 8)`, where `bit_depth` is the bit depth, with four channels
  and supported depths of 1–16 bits. This bounds image pixel data, not the process's peak memory.
- Converted results must also satisfy the PNG total size, clip memory, and catalog limits. Excessive dimensions, potential integer overflow,
  or an oversized converted result return an import error and preserve the installed appearance.

Packs contain presentation data, not executable scripts.

## Troubleshooting

| Symptom | Checks and action |
| --- | --- |
| Installing an Adapter did not provide the pet app | Regular package lists omit the native app. Obtain a local development package containing `DevFlowPet.app` and follow Local build and installation. |
| Updating the program did not change its behavior | Check the runtime record's `executable_path`. The user-directory app takes priority and is preserved during package installation. Program updates and artwork reimports are separate operations. |
| Another appearance cannot walk, wave, or think | Check whether its installed `clips` includes those additional animations. A five-clip appearance can show tasks normally but cannot play artwork it does not contain. |
| The source has nine clips but the installed copy has five | Confirm that the running app copy was updated too, then reimport the original folder containing the complete atlas. The app loads frames saved by the latest import; upgrades do not automatically add missing clips. |
| Must every pack contain nine clips and 57 frames? | This fixed count applies only to Codex-layout atlases. Single PNG/SVG images and native animation packs follow their own rules in the table above. |
| The pet stays idle or does not walk | Check task selection, connectivity, Animations, Idle activities, Reduce Motion, and walking artwork. Hovering inside the window or opening a menu/panel pauses idle activity; leave and wait 6–12 seconds. Directions with less than 40 pt of room are excluded. |
| Hovering does not trigger another wave | Idle conditions and the shared 20-second cooldown must allow it. Hover over the character for at least 0.4 seconds. Continuous hover responds once; leave for at least two seconds to rearm. |
| Chat activity does not match the pet's working animation | The pet reads the selected Dev Flow Task's saved state, not ordinary Codex chat activity or keyboard input. Check the watched Task. |
| Selecting a completed task does not trigger a jump | Celebrate once only when continuously observing the same task change from nonterminal to DONE. A first read of an already-completed task uses a still frame, then may enter idle activities. |
| The source atlas fits its limit, but PNG size or memory is rejected | Source atlases and converted frames have separate limits. WebP-to-PNG conversion can increase file size. Check the 512 MiB source limit, 1 GiB decoding estimate, 128 MiB total converted PNG limit, and 128 MiB per-clip limit. |
| Not connected or startup fails | Check the platform and Adapter configuration; a running pet offers Retry connection. Explicit `pet start` can start WebUI when needed; background observation is read-only. Do not use the nonexistent `pet status` command. |
| A sibling behavior-map.json has no effect | The importer reads `pet.json` with an atlas or `animations.json`. `behavior-map.json` controls neither timing nor behavior; use the supported catalog fields. |

## Acceptance checks

The current macOS arm64 targeted checks cover 30 native tests and two artwork-staging tests, including size menu selection, scaled anchor and bubble layout, saved settings, walking speed, PNG regressions, and SVG import and rejection rules.
Running `SVGArtworkTests` with the default appearance as `DEV_FLOW_PET_TEST_FIXTURE` verifies that all nine clips and 312 vector frames retain their contents after import. `node --test scripts/desktop-pet-artwork.test.mjs` verifies copied contents and rejects altered files. These are local component and artwork checks; full desktop sessions are verified separately.

On macOS arm64, run `swift test --package-path packages/desktop-pet/macos --filter PetAppearanceTests`:

- Importing standard format 1/2 PNG atlases preserves nine clips, 57 frames, and 192×208 cells; the four additional clips retain the correct rows, frame counts, and timings.
- Importing the 12288×14976 extended PNG atlas preserves nine clips and 1536×1664 cells. Atlases with fewer than nine complete animation rows are rejected, preserving the installed appearance.
- Native packs with the five task clips remain loadable, and invalid additional clips are rejected.
- Reimporting a pack whose converted PNG files exceed 128 MiB is rejected; the previous appearance remains loadable and its saved selection is preserved.
- Oversized image headers and canvas catalogs that could cause integer overflow return errors.

`PetActivityTests` separately covers controlled time, cooldowns, complete activity endings, alert preemption, walking bounds, and missing artwork.
`PresentationRulesTests` covers review-node selection; player and window tests cover actual completion callbacks and movement cancellation;
preference tests cover switch persistence. These checks cover native import, presentation rules, and AppKit components separately.
Actual desktop interaction checks and full Codex/DeepSeek task-session results are recorded separately.

See [architecture](ARCHITECTURE_en.md#desktop-pet-responsibilities) for implementation ownership and the [support matrix](SUPPORT-MATRIX_en.md#desktop-pet-functional-checks) for platform and distribution verification.
