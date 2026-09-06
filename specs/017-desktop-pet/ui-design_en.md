# Desktop Pet UI and Animation Specification

[中文](ui-design.md) | [English](ui-design_en.md)

The current user-requested delivery prioritizes functionality and reuses the existing artwork;
a simple static shape is acceptable. Art refinement, animation smoothness, and the visual checks
below are outside this checkpoint. Text, clicks, dragging, task selection, visibility, and the
animation switch remain functional requirements.

The pet presents Dev Flow task state through polished original character art. At desktop scale it
needs a clear silhouette, natural expressions, and complete motion, accompanied by restrained,
readable information and light interaction feedback. This retains the visual reference from the [plan](plan_en.md). Existing procedural assets serve
the local functional package; visual refinement is outside the current completion criteria.

## Character and visual direction

Use an original small sprite-like creature with soft dimensional shading: rounded forms, simple
facial features, recognizable head and limbs, and details that echo Dev Flow's flowing mark.
Give it its own silhouette rather than enlarging the product icon and adding eyes or adopting
another product's mascot. Finalize front and three-quarter views and key expressions first,
establishing proportions, facial placement, lighting, and material before animating.

Reference the existing [Dev Flow icon](../../packages/webui/src/assets/dev-flow-app-icon-light.svg):
blue `#387FFB` through violet `#7163F7`, with soft light highlights and neutral outlines.
Keep the character readable on light, dark, and busy desktops. Shadows follow the pose; avoid
heavy outer glows and large background plates.

Deliver original source art, five complete animation categories, and required static poses.
Placeholders, whole-image bobbing, or uniform scaling cannot replace character animation.
Face, body, limbs, and ornaments need plausible motion sequencing and weight shifts.

## Desktop layout

Default character viewport is `144 × 144 pt`; inspect clarity at `96 / 144 / 192 pt`.
These are production and inspection sizes, not a user-facing scale setting. Default bubble width
is approximately `220 pt`, with final layout constrained by content and system fonts. Place it
above the character and keep the entire display inside the screen's visible working area.

The persistent bubble has two lines:

| Area | Content and layout |
| --- | --- |
| First line | Single-line task short name with ellipsis; “Choose a task” without a selection |
| Second line | Stage or connection result, with brief read-only/archive markers when needed |
| Hover expansion | Wrapping task summary, “Task updated,” “Last synced,” and blocker reason; preserve line spacing and bound maximum height |
| Task picker | Summary, source Host, stage, and repository context; selected-row indicator and on-demand next page |

Use system fonts, initially `13 pt` for task name and `12 pt` for stage, with expanded body text
at least `12 pt`. Leave approximately `8 pt` between character and bubble. Test Chinese, English,
long summaries, and long paths rather than shrinking all text into a fixed box.

Initially place the pet in the main display's visible lower-right area. Remember dragged position.
When displays disappear or layout changes, constrain the complete view to a remaining visible
working area. Window bounds follow the character and actual bubble content, not a screen-sized
transparent surface.

## Interaction and window behavior

| Action | Result |
| --- | --- |
| Click character or persistent task bubble | Recheck the service under the technical design and open task details; open the list without an available task |
| Drag character | Move the pet; treat movement beyond `4 pt` as dragging and do not open a browser on release |
| Hover | Subtle expression feedback and expanded details; collapse after exit while allowing entry into the expanded area |
| Context click or menu bar entry | Open the same menu |
| Choose task | Accept keyboard focus only after the user opens the panel; close and immediately read the new selection after confirmation |
| Hide / Show | Hiding stops animation and polling; showing restores position and reads again |
| System sleep / wake | Suspend activity; read again after wake without replaying historical cues on the first result |

Passive updates, blocker cues, and celebrations neither activate the app nor steal focus or play
sound. Keep the grab point stable while dragging and pause motions that would move it. On release,
transition into the latest state without replaying animation events that expired during the drag.

Use normal AppKit floating-panel and menu bar behavior. Stay visible on ordinary desktops and
follow supported system behavior when switching Spaces. Fullscreen apps use the resulting system
behavior without per-app intrusive window elevation or Space switching. Record actual native
behavior; users must retain a menu bar route to restore or quit.

The menu contains only:

1. 选择任务 / Choose task
2. 选择形象 / Choose appearance（内置、已导入形象与导入入口 / bundled, imported, and import entry）
3. 打开任务列表 / Open task list
4. 重试连接 / Retry connection
5. 动画 / Animations
6. 隐藏或显示 / Hide or Show
7. 退出 / Quit

“Retry connection” is enabled only while disconnected and may explicitly ask existing Core to
start the local service. Language follows system preferences: preferred Chinese selects Simplified
Chinese; otherwise use English. Put the animation toggle in the menu, without a separate settings
window. When Reduce Motion is enabled, explain the system restriction in the menu.

## Complete animation inventory

The following retains visual reference goals for the bundled character. Imported appearances may use single frames; current functional delivery does not require this visual refinement.

All five categories are required. Categories may share rigs and construction, but a still image
cannot replace an entire animation category. Ordinary stages share work-themed motion; text
identifies the exact stage without assigning a separate business meaning to every Core node.

| Asset key | Motion design | Playback | Static pose |
| --- | --- | --- | --- |
| `idle` | Natural breathing, blinking, small weight shifts, and occasional observation, with deliberate pauses rather than mechanical swaying | Low-distraction loop without a selected task | Calm idle |
| `working` | Focused expression and rhythmic hand/body movement, with small follow-through in ornaments; suggests a work theme without asserting live Host execution | Loop during ordinary stages, with smooth stage changes | Focused |
| `blocked` | Brief upward glance or puzzled reaction, settling into gentle breathing and blinking while waiting; retain distinct motion layers | Attention cue once on entry or changed reason, then a quiet loop rather than repeated bouncing | Blocked |
| `complete` | Anticipation, a clear celebratory main action, landing, and settling, with coordinated expression and limbs; a few dissipating decorative particles are permitted | Once on a continuously observed move to `DONE`, then still | Satisfied completion |
| `disconnected` | A reaction distinct from task blocking, such as checking a connection mark and looking back, followed by a gentle waiting loop | Enter on connection failure and stop work/celebration; do not repeat attention cues throughout an outage | Disconnected |

An initial `DONE` read uses the completed still. `CANCELLED` uses a calm settled pose without
celebration. Archived and missing tasks use neutral poses with distinct wording. Every animation
requires a deliberately selected readable still for animation-off, Reduce Motion, and initial
terminal-state presentation.

### Timing and transitions

Start production at `24 fps`, increasing frame rate where motion needs it. Repeated frames must
not simulate smooth active motion; pauses should be deliberate acting choices. Suggested durations
are `2–4 s` for idle and ordinary loops, `0.6–1.2 s` for blocked/disconnected attention segments,
and `1.8–3 s` for completion. These are production guides; determine final timing by full-speed
playback quality and record it in the asset manifest.

Loop boundaries must join naturally in position, silhouette, lighting, shadow, and velocity.
Keep the ground/hover reference point fixed; per-frame cropping, canvas changes, or scaling must not
cause jitter. Use easing, appropriate anticipation, and follow-through instead of starting and
stopping every body part simultaneously.

Check idle-to-working, working-to-blocked, recovery from blocked, working-to-complete, disconnection
from any state, reconnection, and animation-toggle transitions. Update labels immediately.
Use brief pose transitions or blends without waiting for the old loop to end. Long full-character
fade-outs must not conceal inconsistent construction.

A new task, connection, or terminal state cancels old celebrations and cues immediately.
An initially blocked task starts its quiet loop; an initial `DONE` uses the completed still.
Do not play historical events the user did not observe continuously.

### Animation disabled and resource use

Animation-off or system Reduce Motion selects each state's still; text, selection, and navigation
continue normally. Re-enabling resumes only permitted current loops without replaying completion
or blocked cues. Hiding, sleep, and exit stop all animation timers.

Decode and retain only frames needed by the current motion and adjacent transition. Control resources
through suitable canvas size, cache release, and demand-based playback, without deleting required
motions, degrading final clarity, or replacing character animation with whole-image movement.

## Asset delivery

Source assets live in `packages/desktop-pet/macos/Assets/`; the app contains only runtime assets.
Keep previews, storyboards, editable sources, and inspection recordings as implementation deliverables
without placing all of them in the npm package.

| Deliverable | Requirement |
| --- | --- |
| Character source | High-resolution transparent original with editable sources or sufficiently detailed source layers; at least `1024 × 1024 px` is recommended |
| Frame sequences | `512 × 512 px` RGBA PNGs with identical transparent canvas, anchor, lighting, and proportions, numbered sequentially per motion |
| Five motions | Complete frames, playback preview, and designated still for `idle/working/blocked/complete/disconnected` |
| UI resources | Menu bar template icon, app icon, and bubble accents consistent with the character/brand and clear at small sizes |
| Inspection material | Checkerboard alpha previews, light/dark/busy background previews, keyframe contact sheets, and native-app recordings |
| Provenance | Original-art process, source files, and usable licenses; packaged fonts, images, and other resources must permit product distribution |

`Resources/animations.json` is shared by bundled and imported appearances. `pet.json` supplies appearance identity; see [appearance packs](appearance-packs_en.md):

| Field | Contents |
| --- | --- |
| `canvas` | Shared `width` and `height` in pixels |
| `anchor` | Shared reference `x` and `y` for aligning all motions |
| `clips` | Descriptions for the five fixed asset keys |
| Each clip's `frames` | Complete explicit list of package-relative PNG paths in playback order |
| `fps` | Actual playback frame rate |
| `loop_range` | Inclusive first/last loop frame indices; `null` for one-shot motion |
| `rest_frame` | Frame index for static mode |

Blocked and disconnected clips can place their attention segment before the loop. Play it on entry,
then repeat only `loop_range`. Initial sync or re-enabled animation enters the loop directly.
Completion has `loop_range` set to `null` and holds `rest_frame` after playback. Build checks ensure all
five categories, existing files, matching dimensions, and valid indices.

Codex local packs can be imported and converted into this format. Runtime playback uses the five Dev Flow states; Codex task activity and gaze/walking behavior remain outside this import.

## Visual acceptance

Run all checks with Chinese and English UI. V06/V07 procedures and result records are in the
[acceptance document](validation_en.md).

| Check | Passing result |
| --- | --- |
| Character consistency | Source art, five motions, and UI icons depict one character, without drifting proportions or ornaments |
| Small-size rendering | Facial features, state poses, and silhouette remain readable at `96 / 144 / 192 pt`, with legible body text |
| Alpha quality | Checkerboard, light, and dark backgrounds show no white/black halos, residual background, clipped ears, or clipped shadows |
| Loop quality | At least five continuous loops without seam jumps, reference-point drift, flash frames, or unjustified pauses |
| Motion completeness | Distinct acting per category; celebration has anticipation and settling; blocked and disconnected reactions are distinguishable |
| Transition quality | Continuous poses and timely labels; motions from an old task never spill into a new task |
| System behavior | No focus stealing or large input-blocking region; hiding and Reduce Motion take effect immediately |
| Final quality | Inspect the actual installed native app; asset previews or merely proving playback do not establish acceptance |

Finalize character construction and key motions before filling out frame sequences. Correct
construction drift or timing in the affected motion. Visual delivery is complete only after all
five animations, transitions, and native presentation pass.
