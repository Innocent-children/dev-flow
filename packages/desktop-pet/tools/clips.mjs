/// The five delivered action timelines and the `animations.json` they bake to.
///
/// Every clip is authored as a pose per frame over the rig in `character.mjs`.
/// A looping clip keeps an attention segment in front of its quiet loop so the
/// native hover reaction has something to play. Each loop is periodic in one
/// phase, and each intro is a blend from the shared neutral pose into exactly
/// the loop's first frame plus zero-at-both-ends reaction bumps, so no cut
/// inside a clip or across its seam ever jumps. Frame 0 of all five clips is
/// the same neutral pose, which is what lets the native side switch actions
/// without a blend pass.
import { ANCHOR, CANVAS_HEIGHT, CANVAS_WIDTH, neutralPose } from "./character.mjs";

const TAU = Math.PI * 2;

function clampUnit(t) {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export function easeInOut(t) {
  const u = clampUnit(t);
  return u * u * (3 - 2 * u);
}

export function easeInCubic(t) {
  const u = clampUnit(t);
  return u * u * u;
}

export function easeOut(t) {
  const u = clampUnit(t);
  return 1 - (1 - u) * (1 - u);
}

/// A smooth bump that is zero at both ends and one in the middle.
export function pulse(t) {
  const s = Math.sin(Math.PI * clampUnit(t));
  return s * s;
}

/// A bump peaking at `center` instead of the middle, still zero at both ends.
/// Reaction flourishes use it so an intro lands exactly on its loop's first
/// frame.
export function pulseAt(t, center) {
  const u = clampUnit(t);
  if (u <= 0 || u >= 1) return 0;
  return u < center ? easeInOut(u / center) : easeInOut((1 - u) / (1 - center));
}

/// Piecewise track sampled with ease-in-out between keys. `pairs` is a sorted
/// list of `[time, value]`; times outside the ends clamp.
export function sampleKeys(pairs, t) {
  if (t <= pairs[0][0]) return pairs[0][1];
  for (let index = 1; index < pairs.length; index += 1) {
    if (t <= pairs[index][0]) {
      const [from, valueFrom] = pairs[index - 1];
      const [to, valueTo] = pairs[index];
      return valueFrom + (valueTo - valueFrom) * easeInOut((t - from) / (to - from || 1));
    }
  }
  return pairs[pairs.length - 1][1];
}

const NEUTRAL = neutralPose();
const POSE_FIELDS = Object.keys(NEUTRAL);

function mixPose(from, to, t) {
  const out = neutralPose();
  for (const field of POSE_FIELDS) out[field] = from[field] + (to[field] - from[field]) * t;
  return out;
}

/// One shared blink window: a closed-eye bump inside a loop segment.
function blinkAt(frame, start, length) {
  const local = frame - start;
  if (local < 0 || local > length) return 0;
  return pulse(local / length);
}

// MARK: - idle

const IDLE_INTRO = 12;
const IDLE_LOOP = 36;

function idleLoop(k) {
  const p = (TAU * k) / IDLE_LOOP;
  const pose = neutralPose();
  pose.scaleY = 1 + 0.02 * Math.sin(p);
  pose.scaleX = 1 - 0.013 * Math.sin(p);
  pose.rootY = -1.2 * Math.sin(p);
  pose.tilt = 0.03 * Math.sin(p);
  pose.rootX = 2.5 * Math.sin(p);
  pose.headLift = -2.2 * Math.sin(p - 0.6);
  pose.headTilt = 0.02 * Math.sin(p + 0.8);
  pose.earLeft = 0.05 * Math.sin(p + 1.0);
  pose.earRight = 0.05 * Math.sin(p + 1.4);
  pose.earCurlLeft = 0.07 * Math.sin(p + 1.6);
  pose.earCurlRight = 0.07 * Math.sin(p + 2.0);
  pose.armLeft = 0.05 * Math.sin(p + 0.5);
  pose.armRight = 0.05 * Math.sin(p + 1.1);
  pose.tailPhase = p;
  pose.ribbonPhase = p;
  pose.gazeX = 2.2 * Math.sin(p + 1.8);
  pose.gazeY = 0.6 * Math.sin(2 * p);
  pose.mouthCurve = 0.42 + 0.05 * Math.sin(p + 0.7);
  pose.blink = blinkAt(k, 22, 5);
  pose.shadowSpread = 1 - 0.02 * Math.sin(p);
  pose.shadowAlpha = 0.3 + 0.02 * Math.sin(p);
  return pose;
}

const IDLE_LOOP_START = idleLoop(0);

function idlePose(index) {
  if (index >= IDLE_INTRO) return idleLoop(index - IDLE_INTRO);
  // A small notice: the pet perks and looks up once while the breath eases in,
  // then lands exactly on the loop's first frame.
  const u = index / IDLE_INTRO;
  const pose = mixPose(NEUTRAL, IDLE_LOOP_START, easeInOut(u));
  const bump = pulse(u);
  pose.headLift -= 5 * bump;
  pose.eyeWide += 0.3 * bump;
  pose.browLeft += 0.18 * bump;
  pose.browRight += 0.18 * bump;
  pose.earLeft += 0.14 * bump;
  pose.earRight += 0.14 * bump;
  pose.gazeY -= 2 * bump;
  pose.mouthCurve += 0.1 * bump;
  return pose;
}

// MARK: - working

const WORKING_INTRO = 12;
const WORKING_LOOP = 36;

/// The focused stance the working loop oscillates around and that the static
/// frame shows: both forearms folded in so the hands hover in front of the
/// belly, eyes down on the work.
const WORKING_STANCE = Object.freeze({
  lidLower: 0.22,
  browLeft: -0.15,
  browRight: -0.15,
  mouthCurve: 0.25,
  gazeY: 3,
  headLift: 2,
  armLeft: 0.46,
  armRight: -0.46,
  armLeftBend: -1.1,
  armRightBend: -1.0,
  blush: 0.4,
});

function workingLoop(k) {
  const p = (TAU * k) / WORKING_LOOP;
  const pose = neutralPose();
  for (const [field, value] of Object.entries(WORKING_STANCE)) pose[field] = value;
  // Alternating taps: the two forearms run half a cycle apart so the work
  // reads as a rhythm instead of one bob.
  pose.armLeftBend = -1.1 + 0.22 * Math.sin(p);
  pose.armRightBend = -1.0 + 0.22 * Math.sin(p + Math.PI);
  pose.armLeft = 0.46 + 0.04 * Math.sin(p + Math.PI);
  pose.armRight = -0.46 + 0.04 * Math.sin(p);
  pose.scaleY = 1 + 0.012 * Math.sin(2 * p);
  pose.rootY = -1.0 * Math.sin(2 * p);
  pose.headLift = 2 + 1.4 * Math.sin(2 * p + 0.7);
  pose.headTilt = 0.015 * Math.sin(p);
  pose.tilt = 0.012 * Math.sin(p + 1.0);
  pose.earLeft = 0.04 * Math.sin(2 * p + 0.4);
  pose.earRight = 0.04 * Math.sin(2 * p + 0.9);
  pose.tailPhase = 2 * p;
  pose.tailAmp = 0.8;
  pose.ribbonPhase = 2 * p;
  pose.ribbonAmp = 1.25;
  // A data pulse rides the streamer once per loop, fading in at the root and
  // out at the tip so the loop seam never pops.
  pose.ribbonDot = k / WORKING_LOOP;
  pose.ribbonDotFade = Math.sin((Math.PI * k) / WORKING_LOOP) ** 0.8;
  pose.gazeX = 1.2 * Math.sin(p);
  pose.blink = blinkAt(k, 26, 5);
  pose.shadowSpread = 1 - 0.015 * Math.sin(2 * p);
  return pose;
}

const WORKING_LOOP_START = workingLoop(0);

function workingPose(index) {
  if (index >= WORKING_INTRO) return workingLoop(index - WORKING_INTRO);
  const u = index / WORKING_INTRO;
  const pose = mixPose(NEUTRAL, WORKING_LOOP_START, easeInOut(u));
  const bump = pulseAt(u, 0.4);
  pose.eyeWide += 0.2 * bump;
  pose.headLift -= 2 * bump;
  pose.earLeft += 0.1 * bump;
  pose.earRight += 0.1 * bump;
  return pose;
}

// MARK: - blocked

const BLOCKED_INTRO = 18;
const BLOCKED_LOOP = 36;

/// The worried waiting stance: a lean, one drooped ear, a flat mouth.
const BLOCKED_STANCE = Object.freeze({
  tilt: 0.05,
  headTilt: 0.06,
  headLift: 3,
  lidLower: 0.3,
  browLeft: 0.25,
  browRight: -0.05,
  mouthCurve: 0.05,
  mouthWidth: 0.9,
  gazeX: -2,
  gazeY: 1.5,
  armLeft: 0.3,
  armRight: 0.35,
  earLeft: -0.12,
  earRight: 0.2,
  tailAmp: 0.5,
  ribbonAmp: 0.7,
  blush: 0.4,
});

function blockedLoop(k) {
  const p = (TAU * k) / BLOCKED_LOOP;
  const pose = neutralPose();
  for (const [field, value] of Object.entries(BLOCKED_STANCE)) pose[field] = value;
  pose.scaleY = 1 + 0.015 * Math.sin(p);
  pose.rootY = -0.8 * Math.sin(p);
  pose.headLift = 3 - 1.5 * Math.sin(p - 0.5);
  pose.gazeX = -2 + 1.0 * Math.sin(p + 2);
  pose.earCurlLeft = 0.05 * Math.sin(p + 1.2);
  pose.tailPhase = p;
  pose.ribbonPhase = p;
  pose.mouthCurve = 0.05 + 0.02 * Math.sin(p);
  pose.blink = blinkAt(k, 16, 5);
  return pose;
}

const BLOCKED_LOOP_START = blockedLoop(0);

function blockedPose(index) {
  if (index >= BLOCKED_INTRO) return blockedLoop(index - BLOCKED_INTRO);
  // Notice, look up in confusion, then sink into the waiting stance.
  const u = index / BLOCKED_INTRO;
  const pose = mixPose(NEUTRAL, BLOCKED_LOOP_START, easeInOut(u));
  const look = pulseAt(u, 0.4);
  pose.headLift -= 6 * look;
  pose.eyeWide += 0.35 * look;
  pose.browLeft += 0.3 * look;
  pose.browRight += 0.35 * look;
  pose.mouthOpen = 0.25 * look;
  pose.earLeft += 0.18 * look;
  pose.earRight -= 0.18 * look;
  return pose;
}

// MARK: - disconnected

const DISCONNECTED_INTRO = 18;
const DISCONNECTED_LOOP = 36;

/// The unconnected waiting stance: both ears down, eyes lowered, the broken
/// link mark held dim beside the head.
const DISCONNECTED_STANCE = Object.freeze({
  tilt: -0.03,
  headTilt: -0.05,
  headLift: 4,
  lidLower: 0.35,
  mouthCurve: 0.12,
  gazeY: 2.5,
  armLeft: 0.25,
  armRight: 0.3,
  earLeft: -0.15,
  earRight: -0.15,
  tailAmp: 0.35,
  ribbonAmp: 0.5,
  blush: 0.35,
  linkAlpha: 0.55,
  linkSeparation: 1,
});

function disconnectedLoop(k) {
  const p = (TAU * k) / DISCONNECTED_LOOP;
  const pose = neutralPose();
  for (const [field, value] of Object.entries(DISCONNECTED_STANCE)) pose[field] = value;
  pose.scaleY = 1 + 0.013 * Math.sin(p);
  pose.rootY = -0.7 * Math.sin(p);
  pose.headLift = 4 - 1.2 * Math.sin(p - 0.4);
  pose.linkTilt = 0.06 * Math.sin(p);
  pose.earCurlLeft = 0.04 * Math.sin(p + 1.0);
  pose.earCurlRight = 0.04 * Math.sin(p + 1.5);
  pose.tailPhase = p;
  pose.ribbonPhase = p;
  pose.blink = blinkAt(k, 20, 5);
  return pose;
}

const DISCONNECTED_LOOP_START = disconnectedLoop(0);

function disconnectedPose(index) {
  if (index >= DISCONNECTED_INTRO) return disconnectedLoop(index - DISCONNECTED_INTRO);
  // The mark fades in and breaks apart while the pet watches it, then the gaze
  // drops away and stays down for the quiet loop.
  const u = index / DISCONNECTED_INTRO;
  const pose = mixPose(NEUTRAL, DISCONNECTED_LOOP_START, easeInOut(u));
  const look = pulseAt(u, 0.42);
  pose.linkAlpha = DISCONNECTED_STANCE.linkAlpha * easeOut(u / 0.35) + 0.35 * look;
  pose.linkSeparation = easeInOut(u / 0.45);
  pose.linkTilt = 0.1 * Math.sin(Math.PI * u);
  pose.gazeX += (5 - pose.gazeX) * look;
  pose.gazeY += (-4 - pose.gazeY) * look;
  pose.headTilt += (0.08 - pose.headTilt) * look;
  pose.headLift -= 4 * look;
  pose.eyeWide += 0.3 * look;
  return pose;
}

// MARK: - complete

const COMPLETE_FRAMES = 60;

/// The satisfied settle the celebration ends on and the static done frame
/// shows.
const COMPLETE_STANCE = Object.freeze({
  mouthCurve: 0.7,
  lidLower: 0.12,
  eyeWide: 0.05,
  gazeY: 0.6,
  armLeft: 0.1,
  armRight: 0.1,
  earLeft: 0.05,
  earRight: 0.05,
  tailAmp: 0.6,
  ribbonAmp: 0.8,
  blush: 0.65,
});

function completePose(index) {
  const pose = neutralPose();
  const crouch = sampleKeys([[0, 0], [9, 1]], index);
  const launch = sampleKeys([[9, 0], [16, 1]], index);
  const apex = sampleKeys([[16, 0], [24, 1]], index);
  const fall = sampleKeys([[24, 0], [34, 1]], index);
  const land = sampleKeys([[34, 0], [41, 1]], index);
  const recover = sampleKeys([[41, 0], [52, 1]], index);
  const settle = sampleKeys([[52, 0], [59, 1]], index);

  // Anticipation: sink and gather before the jump.
  pose.scaleY = 1 - 0.06 * crouch + 0.14 * launch - 0.08 * launch * launch;
  pose.scaleX = 1 + 0.05 * crouch - 0.09 * launch;
  pose.rootY = 3 * crouch * (1 - launch);
  pose.headLift = 4 * crouch;
  pose.armLeft = 0.5 * crouch;
  pose.armRight = 0.5 * crouch;
  pose.gazeY = 2 * crouch;

  // Launch and apex: arms out and up, ears perked, mouth open, particles away.
  const up = launch * (1 - easeInCubic(fall));
  pose.rootY -= 46 * up;
  pose.armLeft += -2.1 * up + 2.4 * fall;
  pose.armRight += 2.1 * up - 2.0 * fall;
  pose.armLeftBend = -0.3 * up;
  pose.armRightBend = 0.3 * up;
  pose.earLeft += 0.2 * up;
  pose.earRight += 0.2 * up;
  pose.eyeWide += 0.3 * up;
  pose.mouthOpen = 0.5 * up * (1 - recover);
  pose.mouthCurve = 0.42 + 0.48 * up;
  pose.blush = 0.55 + 0.25 * up;
  pose.tilt = 0.03 * Math.sin(TAU * apex);
  pose.tailAmp = 1 + 0.6 * up;
  pose.ribbonAmp = 1 + 0.8 * up;
  const flow = (0.5 * launch + apex + fall) % 1;
  pose.ribbonPhase = TAU * flow;
  pose.tailPhase = TAU * flow;
  if (index >= 10) pose.particleBurst = clampUnit((index - 10) / 30);

  // Landing squash with the shadow, then the body recovers to full height.
  pose.scaleY -= 0.07 * land * (1 - recover);
  pose.scaleX += 0.06 * land * (1 - recover);
  pose.rootY += 2 * land * (1 - recover);
  pose.shadowSpread = 1 + 0.25 * land * (1 - recover) - 0.18 * up;
  pose.shadowAlpha = 0.3 + 0.12 * land * (1 - recover) - 0.16 * up;
  pose.headLift += 3 * land * (1 - recover);
  pose.scaleY += (1 - pose.scaleY) * recover;
  pose.scaleX += (1 - pose.scaleX) * recover;
  pose.rootY *= 1 - recover;
  pose.headLift *= 1 - recover;

  // Recover into the satisfied settle and hold it as the rest frame.
  for (const [field, value] of Object.entries(COMPLETE_STANCE)) {
    pose[field] += (value - pose[field]) * settle;
  }
  pose.mouthOpen *= 1 - settle;
  return pose;
}

// MARK: - catalog

export const CLIP_ORDER = Object.freeze(["idle", "working", "blocked", "complete", "disconnected"]);

export const CLIPS = Object.freeze({
  idle: Object.freeze({ fps: 24, frames: IDLE_INTRO + IDLE_LOOP, loopRange: Object.freeze([IDLE_INTRO, IDLE_INTRO + IDLE_LOOP - 1]), restFrame: IDLE_INTRO, pose: idlePose }),
  working: Object.freeze({ fps: 24, frames: WORKING_INTRO + WORKING_LOOP, loopRange: Object.freeze([WORKING_INTRO, WORKING_INTRO + WORKING_LOOP - 1]), restFrame: WORKING_INTRO, pose: workingPose }),
  blocked: Object.freeze({ fps: 24, frames: BLOCKED_INTRO + BLOCKED_LOOP, loopRange: Object.freeze([BLOCKED_INTRO, BLOCKED_INTRO + BLOCKED_LOOP - 1]), restFrame: BLOCKED_INTRO, pose: blockedPose }),
  complete: Object.freeze({ fps: 24, frames: COMPLETE_FRAMES, loopRange: null, restFrame: COMPLETE_FRAMES - 1, pose: completePose }),
  disconnected: Object.freeze({ fps: 24, frames: DISCONNECTED_INTRO + DISCONNECTED_LOOP, loopRange: Object.freeze([DISCONNECTED_INTRO, DISCONNECTED_INTRO + DISCONNECTED_LOOP - 1]), restFrame: DISCONNECTED_INTRO, pose: disconnectedPose }),
});

export function poseFor(clip, index) {
  const description = CLIPS[clip];
  if (!description) throw new Error(`unknown animation clip ${clip}`);
  if (!Number.isInteger(index) || index < 0 || index >= description.frames) {
    throw new Error(`frame ${index} is outside ${clip} 0..${description.frames - 1}`);
  }
  return description.pose(index);
}

/// The `Resources/animations.json` body for the delivered frame set.
/// `framePath(clip, index)` names each PNG relative to the asset root.
export function buildCatalog(framePath) {
  const clips = {};
  for (const name of CLIP_ORDER) {
    const description = CLIPS[name];
    const frames = [];
    for (let index = 0; index < description.frames; index += 1) frames.push(framePath(name, index));
    clips[name] = {
      frames,
      fps: description.fps,
      loop_range: description.loopRange === null ? null : [description.loopRange[0], description.loopRange[1]],
      rest_frame: description.restFrame,
    };
  }
  return {
    canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
    anchor: { x: ANCHOR.x, y: ANCHOR.y },
    clips,
  };
}
