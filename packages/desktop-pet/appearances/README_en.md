# Bundled appearance artwork

[中文](README.md) | [English](README_en.md)

Each subdirectory is named after its appearance ID and contains `pet.json`, `animations.json`, and `Assets/` in the
Dev Flow native animation pack format. `scripts/build-desktop-pet.mjs` copies these directories into the application's
`Contents/Resources/Appearances/` and compares each source file with its extracted copy. Runtime reads the bundled
resources directly, so manual import is unnecessary. A user-imported copy with the same ID takes precedence.

## Whale Girl

- The artwork comes from the user-provided `whale-girl 3` atlas, with the display name “鲸鱼娘（8× 极清动画修复版）”.
- Appearance ID: `codex-d82c29b37c8838a51739d5d20268e608`, matching the import ID of this Codex pack.
- The pack retains nine clips, 57 frames, a 1536×1664 canvas, and per-frame timing. PNG files total 98,342,476 bytes.
- The source atlas is 12288×14976 with SHA-256 `a3ed76daf3779c69181c797dda2eb08153943b313c4281c808f191f9200d41fa`.

The complete converted frames are stored here. Builds do not depend on the user's Downloads directory or re-encode
the images. Application updates replace bundled resources. A user-imported copy with the same ID remains selected
from the user library and must be reimported to update that copy. See the
[desktop pet guide](../../../docs/DESKTOP-PETS_en.md) for formats and animation rules.

## Acceptance checks

`PetAppearanceTests.testBundledWhaleGirlContainsNineHighResolutionActions` lists and loads all nine clips with an empty
user directory. Set `DEV_FLOW_PET_TEST_BUNDLED_ROOT` to the extracted `Contents/Resources/Appearances` to check the
final package. The same test class checks selection persistence, precedence after importing the same ID, and that
application resources remain unchanged.
