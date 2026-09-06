# Custom pet appearances

[中文](appearance-packs.md) | [English](appearance-packs_en.md)

## Problem

The app always uses its bundled character. Users want their own artwork or an existing Codex pet without editing or rebuilding Dev Flow.

## Current approach

Developers replace build assets and repack. Task state and frame playback are already separate, but import and selection are missing.

## Available data

The app has five display states, a PNG player, and a preference directory. Codex local packs contain `pet.json` and a PNG/WebP atlas;
its current public interface accepts `spriteVersionNumber` 1 and 2. The user's additional request authorizes both local formats.

## Behavior rules

- Add a Choose appearance submenu with the bundled character, imported characters, and Import appearance. Import selects a local folder.
- Dev Flow `pet.json` contains `id`, `name`, and optional `image`. With `image`, one PNG serves every state. Otherwise load the sibling
  `animations.json` and `Assets/` using the existing five-clip catalog. Each clip may contain a single frame.
- Optional `frame_durations_ms` has one positive duration per frame; otherwise use `fps`. Preserve Codex frame timings during import.
- Read Codex `id`, `displayName`, and `spritesheetPath`; omitted version means 1. Accept standard eight-column atlases only:
  1536×1872 for version 1 and 1536×2288 for version 2, with 192×208 cells.
- Map Codex idle, running, waiting, jumping, and failed to Dev Flow idle, working, blocked, complete, and disconnected respectively.
  Import crops PNG frames into the common catalog. Dev Flow owns task meaning, bubble text, and navigation.
- Copy descriptions and referenced images to `productRoot/pet/appearances/<id>`. Reimporting an ID updates that appearance.
  A failed validation preserves the installed files, selection, and picture. Successful import selects it; the bundled character remains available.
- Persist `selected_appearance`, restore it on restart, and preserve packs across upgrades. Confirmed factory-reset uses the existing pet-directory cleanup.
  If a remembered pack is missing or invalid, report it and use the bundled character.
- Switching releases old frames and animation, shows the new character in the current state without replaying old prompts, and preserves task selection.
- Accept relative paths and regular image files only; reject symlinks, path escapes, and excessive resources. The default artwork remains bundled.

## Expected result

Import a folder from the menu, use it immediately, and switch later without Swift or reinstalling Dev Flow.

## Risks and impact

Invalid artwork can cause missing frames, excessive memory use, or reads outside the chosen directory. Validate references, image decoding,
dimensions, and counts before replacing an installed pack. External packs contain presentation data; Core retains task ownership.

## Acceptance checks

Run only targeted import/playback checks for static and animated packs, both Codex atlases, updates, invalid-pack preservation,
saved selection, and cancelling old animation. When available, check menu import, switching, and restart in the local installed artifact.
Report unrun native steps explicitly.

## Non-goals

Online stores, network downloads, art editors, script plugins, Codex task control, reproducing gaze or walking behavior, Core/MCP changes, and publication.
