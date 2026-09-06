/// The Dev Flow desktop pet character: palette, rig, and layered renderer.
///
/// This module is the editable source of the delivered artwork. One `pose`
/// drives every part, and each part carries its own phase in the clip
/// timelines, so the face, body, limbs, tail, and streamer move with the
/// sequencing and weight shift the interface and animation specification asks
/// for instead of the whole image translating or scaling as one.
///
/// Geometry is authored in a neutral 512 x 512 body space. A pose produces one
/// affine transform that scales about the ground anchor, tilts about the hips,
/// and translates; the renderer inverts it once per frame and evaluates every
/// signed-distance shape in neutral body space, which is what keeps the anchor,
/// light source, and character proportions identical across all five actions.
import {
  alphaBounds,
  applyTransform,
  blend,
  clamp,
  clamp01,
  compositeOver,
  coverage,
  createCanvas,
  hexColor,
  invertTransform,
  lerp,
  multiplyTransform,
  rampTable,
  rotationAboutTransform,
  sampleTable,
  scaleAboutTransform,
  sdCapsule,
  sdCircle,
  sdEllipse,
  sdRotatedEllipse,
  sdRoundRect,
  sdSmoothUnion,
  translationTransform,
} from "./raster.mjs";

export const CANVAS_WIDTH = 512;
export const CANVAS_HEIGHT = 512;

/// The fixed ground contact line. Every action keeps the feet here; only the
/// celebration lifts the root, and it lands back on the same line.
export const GROUND_Y = 452;

/// The tilt and head pivot, low on the body so a lean reads as a weight shift.
export const HIP_X = 256;
export const HIP_Y = 372;

/// The alignment reference recorded in `animations.json`.
export const ANCHOR = Object.freeze({ x: 256, y: 456 });

const HEAD = Object.freeze({ cx: 256, cy: 296, rx: 92, ry: 98 });
const HIPS = Object.freeze({ cx: 256, cy: 386, rx: 79, ry: 55 });

const EAR = Object.freeze({
  offsetX: 40,
  baseY: 228,
  upperLength: 44,
  lowerLength: 34,
  baseRadius: 18,
  upperRadius: 14.5,
  tipRadius: 11.5,
  spread: 0.40,
  innerRadius: 8.5,
});

const EYE = Object.freeze({ offsetX: 34, cy: 300, rx: 21, ry: 24.5, irisRadius: 12.5, gazeRange: 6.5 });
const BROW = Object.freeze({ offsetX: 35, cy: 265, halfWidth: 13, thickness: 4.2 });
const BLUSH = Object.freeze({ offsetX: 61, cy: 333, rx: 15.5, ry: 8.5 });
const MOUTH = Object.freeze({ cx: 256, cy: 347, halfWidth: 21, depth: 11, thickness: 3.4 });
const BELLY = Object.freeze({ cx: 256, cy: 381, rx: 55, ry: 47 });

const ARM = Object.freeze({
  offsetX: 66,
  shoulderY: 344,
  upperLength: 28,
  foreLength: 24,
  upperRadius: 14,
  foreRadius: 12.5,
  handRadius: 16.5,
  padRadius: 10,
  restAngle: 0.46,
  restBend: 0.3,
});

const FOOT = Object.freeze({ offsetX: 34, cy: 440, rx: 26, ry: 13, padRx: 14, padRy: 6.5 });

const TAIL = Object.freeze({
  baseX: 326,
  baseY: 398,
  heading: -0.5,
  curl: -0.13,
  lengths: Object.freeze([28, 25, 21, 17]),
  radii: Object.freeze([15, 12.5, 10, 7.5]),
  amp: Object.freeze([0.05, 0.11, 0.17, 0.24]),
  lag: Object.freeze([0, 0.42, 0.84, 1.26]),
});

/// The streamer echoing the Dev Flow stream-line marker. It is authored behind
/// the body and emerges from the character's left side.
const RIBBON = Object.freeze({
  samples: 28,
  startRadius: 15,
  endRadius: 3.2,
  waves: 1.55,
  control: Object.freeze([
    Object.freeze({ x: 214, y: 344 }),
    Object.freeze({ x: 148, y: 374 }),
    Object.freeze({ x: 100, y: 312 }),
    Object.freeze({ x: 112, y: 238 }),
  ]),
});

const OUTLINE_WIDTH = 3.6;

const OUTLINE_COLOUR = hexColor("#2E2A55");
const SHADOW_COLOUR = hexColor("#151031");
const BELLY_COLOUR = hexColor("#BBD6FF");
const EAR_INNER_COLOUR = hexColor("#FFA9C8");
const PAD_COLOUR = hexColor("#CBDEFF");
const BLUSH_COLOUR = hexColor("#FF8FBB");
const SCLERA_COLOUR = hexColor("#FBFDFF");
const IRIS_COLOUR = hexColor("#2C2854");
const BROW_COLOUR = hexColor("#2C2854");
const MOUTH_COLOUR = hexColor("#3B2F5E");
const TONGUE_COLOUR = hexColor("#FF8FA8");
const SPECULAR_COLOUR = [1, 1, 1];
const RIM_COLOUR = hexColor("#C9B8FF");
const LINK_COLOUR = hexColor("#A6B0DC");

const BODY_RAMP = rampTable([
  [0.0, hexColor("#9CC4FF")],
  [0.2, hexColor("#4C8BFD")],
  [0.5, hexColor("#387FFB")],
  [0.76, hexColor("#6A62F6")],
  [1.0, hexColor("#4B3ACB")],
]);

const RIBBON_RAMP = rampTable([
  [0.0, hexColor("#4C8BFD")],
  [0.45, hexColor("#57C8F5")],
  [0.8, hexColor("#8FF0FF")],
  [1.0, hexColor("#D6FBFF")],
]);

const PARTICLE_RAMP = rampTable([
  [0.0, hexColor("#FFF6D8")],
  [0.4, hexColor("#9BE7FF")],
  [1.0, hexColor("#B9A6FF")],
]);

/// The body gradient axis, the specular, and the rim light are fixed in body
/// space so the light never moves between frames or between actions.
const GRAD = Object.freeze({ x0: 186, y0: 206, x1: 338, y1: 444 });
const GRAD_DX = GRAD.x1 - GRAD.x0;
const GRAD_DY = GRAD.y1 - GRAD.y0;
const GRAD_LENGTH2 = GRAD_DX * GRAD_DX + GRAD_DY * GRAD_DY;
const SPECULAR = Object.freeze({ cx: 212, cy: 252, radius: 86, strength: 0.34 });
const RIM = Object.freeze({ cx: 332, cy: 426, radius: 74, strength: 0.2 });

const PARTICLES = Object.freeze([
  Object.freeze({ angle: -1.9, speed: 118, size: 8.5, birth: 0.3, life: 0.46 }),
  Object.freeze({ angle: -1.35, speed: 142, size: 6.5, birth: 0.32, life: 0.44 }),
  Object.freeze({ angle: -0.72, speed: 126, size: 9, birth: 0.29, life: 0.48 }),
  Object.freeze({ angle: -0.2, speed: 150, size: 5.5, birth: 0.34, life: 0.42 }),
  Object.freeze({ angle: 0.35, speed: 112, size: 7.5, birth: 0.31, life: 0.45 }),
  Object.freeze({ angle: 0.95, speed: 138, size: 6, birth: 0.33, life: 0.43 }),
  Object.freeze({ angle: 1.6, speed: 120, size: 8, birth: 0.3, life: 0.47 }),
  Object.freeze({ angle: 2.35, speed: 146, size: 5.5, birth: 0.35, life: 0.41 }),
  Object.freeze({ angle: 2.9, speed: 104, size: 7, birth: 0.32, life: 0.46 }),
  Object.freeze({ angle: -2.6, speed: 132, size: 6.5, birth: 0.36, life: 0.4 }),
  Object.freeze({ angle: -0.05, speed: 96, size: 4.5, birth: 0.4, life: 0.38 }),
  Object.freeze({ angle: 1.25, speed: 100, size: 4.5, birth: 0.42, life: 0.36 }),
]);

/// Four-point sparkles that spin slowly while the celebration particles fly.
const SPARKLES = Object.freeze([
  Object.freeze({ angle: -1.05, speed: 156, size: 12, birth: 0.36, life: 0.42 }),
  Object.freeze({ angle: 0.55, speed: 168, size: 9.5, birth: 0.4, life: 0.4 }),
  Object.freeze({ angle: 2.05, speed: 150, size: 11, birth: 0.38, life: 0.44 }),
]);

const LINK = Object.freeze({ cx: 366, cy: 210, halfWidth: 13, halfHeight: 9, radius: 7, thickness: 3 });

/// Every numeric field the clip timelines author. A clip only states the fields
/// it changes; the rest stay at this calm standing pose, which is what makes
/// frame 0 of all five actions a shared transition point.
export function neutralPose() {
  return {
    rootX: 0,
    rootY: 0,
    scaleX: 1,
    scaleY: 1,
    tilt: 0,
    headX: 0,
    headLift: 0,
    headTilt: 0,
    earLeft: 0,
    earRight: 0,
    earCurlLeft: 0,
    earCurlRight: 0,
    armLeft: 0,
    armRight: 0,
    armLeftBend: 0,
    armRightBend: 0,
    legSpread: 0,
    footLift: 0,
    blink: 0,
    lidLower: 0,
    gazeX: 0,
    gazeY: 0,
    eyeWide: 0,
    browLeft: 0,
    browRight: 0,
    mouthCurve: 0.42,
    mouthOpen: 0,
    mouthWidth: 1,
    blush: 0.55,
    tailPhase: 0,
    tailAmp: 1,
    ribbonPhase: 0,
    ribbonAmp: 1,
    ribbonDot: -1,
    ribbonDotFade: 0,
    shadowSpread: 1,
    shadowAlpha: 0.3,
    particleBurst: -1,
    linkSeparation: 0,
    linkAlpha: 0,
    linkTilt: 0,
  };
}

/// Reusable per-frame buffers. Baking 280 frames allocates one scratch instead
/// of two megabytes per frame.
export function createScratch(size = CANVAS_WIDTH) {
  return {
    distance: new Float32Array(size * size),
    mask: new Float32Array(size * size),
    point: new Float64Array(2),
  };
}

/// The mapping between the authored 512 x 512 artwork space and the delivered
/// canvas. Every authored length lives in artwork space; distances are
/// multiplied by `scale` so the antialiasing ramp stays one device pixel wide
/// at any output size, and world-space effects divide their sample by `scale`.
function createView(size) {
  const scale = size / CANVAS_WIDTH;
  return Object.freeze({ size, scale, inverse: CANVAS_WIDTH / size });
}

function artBox(box, view) {
  return {
    x: box.x * view.scale,
    y: box.y * view.scale,
    width: box.width * view.scale,
    height: box.height * view.scale,
  };
}

/// Forward body-space to world transform of one pose.
export function bodyTransform(pose) {
  return multiplyTransform(
    translationTransform(pose.rootX, pose.rootY),
    multiplyTransform(
      rotationAboutTransform(pose.tilt, HIP_X, HIP_Y),
      scaleAboutTransform(pose.scaleX, pose.scaleY, HIP_X, GROUND_Y),
    ),
  );
}

function headTransform(pose) {
  return multiplyTransform(
    translationTransform(pose.headX, pose.headLift),
    rotationAboutTransform(pose.headTilt, HIP_X, HIP_Y),
  );
}

function cubicBezier(control, t, out) {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  out[0] = a * control[0].x + b * control[1].x + c * control[2].x + d * control[3].x;
  out[1] = a * control[0].y + b * control[1].y + c * control[2].y + d * control[3].y;
  return out;
}

/// Resolves every part of the rig into body-space geometry for one pose.
export function rigGeometry(pose) {
  const point = new Float64Array(2);
  const head = headTransform(pose);

  const headCenter = applyTransform(head, HEAD.cx, HEAD.cy, new Float64Array(2));

  const ears = [];
  for (const side of [-1, 1]) {
    const spread = side * EAR.spread + (side < 0 ? pose.earLeft : pose.earRight);
    const curl = side < 0 ? pose.earCurlLeft : pose.earCurlRight;
    const base = applyTransform(head, HIP_X + side * EAR.offsetX, EAR.baseY, new Float64Array(2));
    const midAngle = spread;
    const mid = [base[0] + Math.sin(midAngle) * EAR.upperLength, base[1] - Math.cos(midAngle) * EAR.upperLength];
    const tipAngle = spread + curl;
    const tip = [mid[0] + Math.sin(tipAngle) * EAR.lowerLength, mid[1] - Math.cos(tipAngle) * EAR.lowerLength];
    ears.push({ side, base, mid, tip, spread, tilt: tipAngle });
  }

  const arms = [];
  for (const side of [-1, 1]) {
    const upperAngle = side * ARM.restAngle + (side < 0 ? pose.armLeft : pose.armRight);
    const bend = side < 0 ? pose.armLeftBend : pose.armRightBend;
    const shoulder = [HIP_X + side * ARM.offsetX, ARM.shoulderY];
    const elbow = [
      shoulder[0] + Math.sin(upperAngle) * ARM.upperLength,
      shoulder[1] + Math.cos(upperAngle) * ARM.upperLength,
    ];
    const foreAngle = upperAngle + side * bend;
    const hand = [
      elbow[0] + Math.sin(foreAngle) * ARM.foreLength,
      elbow[1] + Math.cos(foreAngle) * ARM.foreLength,
    ];
    arms.push({ side, shoulder, elbow, hand, foreAngle });
  }

  const feet = [-1, 1].map((side) => ({
    side,
    cx: HIP_X + side * (FOOT.offsetX + pose.legSpread),
    cy: FOOT.cy - pose.footLift * (side < 0 ? 1 : 0.55),
  }));

  const tail = [];
  let tailX = TAIL.baseX;
  let tailY = TAIL.baseY;
  let heading = TAIL.heading;
  let previous = [tailX, tailY];
  for (let index = 0; index < TAIL.lengths.length; index += 1) {
    heading += TAIL.curl + pose.tailAmp * TAIL.amp[index] * Math.sin(pose.tailPhase - TAIL.lag[index]);
    tailX += Math.cos(heading) * TAIL.lengths[index];
    tailY += Math.sin(heading) * TAIL.lengths[index];
    tail.push({ from: previous, to: [tailX, tailY], radius: TAIL.radii[index] });
    previous = [tailX, tailY];
  }

  const ribbon = [];
  const wave = new Float64Array(2);
  let previousRibbon = null;
  for (let index = 0; index < RIBBON.samples; index += 1) {
    const t = index / (RIBBON.samples - 1);
    cubicBezier(RIBBON.control, t, point);
    cubicBezier(RIBBON.control, Math.min(1, t + 0.02), wave);
    const tangentX = wave[0] - point[0];
    const tangentY = wave[1] - point[1];
    const length = Math.hypot(tangentX, tangentY) || 1;
    const normalX = -tangentY / length;
    const normalY = tangentX / length;
    // The travelling wave is damped at the root and grows towards the tip, so
    // the streamer follows the body with a visible delay instead of swinging as
    // one stiff piece.
    const offset = pose.ribbonAmp * 13 * t * t * Math.sin(2 * Math.PI * (RIBBON.waves * t - pose.ribbonPhase));
    const x = point[0] + normalX * offset;
    const y = point[1] + normalY * offset;
    const radius = lerp(RIBBON.startRadius, RIBBON.endRadius, t * t * 0.72 + t * 0.28);
    ribbon.push({ from: previousRibbon, to: [x, y], radius, t });
    previousRibbon = [x, y];
  }

  let ribbonDot = null;
  if (pose.ribbonDot >= 0 && pose.ribbonDotFade > 0) {
    cubicBezier(RIBBON.control, clamp01(pose.ribbonDot), point);
    const ahead = Math.min(1, clamp01(pose.ribbonDot) + 0.02);
    cubicBezier(RIBBON.control, ahead, wave);
    const tangentX = wave[0] - point[0];
    const tangentY = wave[1] - point[1];
    const length = Math.hypot(tangentX, tangentY) || 1;
    const offset = pose.ribbonAmp * 13 * pose.ribbonDot * pose.ribbonDot
      * Math.sin(2 * Math.PI * (RIBBON.waves * pose.ribbonDot - pose.ribbonPhase));
    ribbonDot = [
      point[0] + (-tangentY / length) * offset,
      point[1] + (tangentX / length) * offset,
    ];
  }

  const eyeScale = 1 + 0.13 * pose.eyeWide;
  const eyes = [-1, 1].map((side) => {
    const center = applyTransform(head, HIP_X + side * EYE.offsetX, EYE.cy, new Float64Array(2));
    return {
      side,
      cx: center[0],
      cy: center[1],
      rx: EYE.rx * (side < 0 ? eyeScale : eyeScale),
      ry: EYE.ry * eyeScale,
      irisX: center[0] + clamp(pose.gazeX, -EYE.gazeRange, EYE.gazeRange),
      irisY: center[1] + clamp(pose.gazeY, -EYE.gazeRange, EYE.gazeRange),
      tilt: pose.headTilt,
    };
  });

  const brows = [-1, 1].map((side) => {
    const lift = (side < 0 ? pose.browLeft : pose.browRight) * 6;
    const center = applyTransform(head, HIP_X + side * BROW.offsetX, BROW.cy - lift, new Float64Array(2));
    return { side, cx: center[0], cy: center[1], tilt: pose.headTilt + side * (side < 0 ? pose.browLeft : pose.browRight) * -0.16 };
  });

  const mouthCenter = applyTransform(head, MOUTH.cx, MOUTH.cy, new Float64Array(2));
  const blushes = [-1, 1].map((side) => {
    const center = applyTransform(head, HIP_X + side * BLUSH.offsetX, BLUSH.cy, new Float64Array(2));
    return { cx: center[0], cy: center[1] };
  });

  return {
    head,
    headCenter: { cx: headCenter[0], cy: headCenter[1], tilt: pose.headTilt },
    ears,
    arms,
    feet,
    tail,
    ribbon,
    ribbonDot,
    ribbonDotFade: pose.ribbonDotFade,
    eyes,
    brows,
    mouth: { cx: mouthCenter[0], cy: mouthCenter[1] },
    blushes,
    belly: { cx: BELLY.cx, cy: BELLY.cy },
  };
}

/// The unified silhouette distance in artwork space. Every part merges through
/// a smooth minimum sized for how softly it should join the body, which is what
/// gives one continuous outline around the ears, arms, feet, and tail.
///
/// `withTail` is off for the menu bar mark, where the tail would blur the
/// silhouette at 18 pt.
function silhouetteDistance(bx, by, rig, withTail = true) {
  let d = sdRotatedEllipse(bx, by, rig.headCenter.cx, rig.headCenter.cy, HEAD.rx, HEAD.ry, rig.headCenter.tilt);
  d = sdSmoothUnion(d, sdEllipse(bx, by, HIPS.cx, HIPS.cy, HIPS.rx, HIPS.ry), 34);

  for (const ear of rig.ears) {
    let earDistance = sdCircle(bx, by, ear.base[0], ear.base[1], EAR.baseRadius);
    earDistance = sdSmoothUnion(
      earDistance,
      sdCapsule(bx, by, ear.base[0], ear.base[1], ear.mid[0], ear.mid[1], EAR.upperRadius),
      10,
    );
    earDistance = sdSmoothUnion(
      earDistance,
      sdCapsule(bx, by, ear.mid[0], ear.mid[1], ear.tip[0], ear.tip[1], EAR.tipRadius),
      8,
    );
    d = sdSmoothUnion(d, earDistance, 16);
  }

  for (const arm of rig.arms) {
    let armDistance = sdCapsule(bx, by, arm.shoulder[0], arm.shoulder[1], arm.elbow[0], arm.elbow[1], ARM.upperRadius);
    armDistance = sdSmoothUnion(
      armDistance,
      sdCapsule(bx, by, arm.elbow[0], arm.elbow[1], arm.hand[0], arm.hand[1], ARM.foreRadius),
      8,
    );
    armDistance = sdSmoothUnion(armDistance, sdCircle(bx, by, arm.hand[0], arm.hand[1], ARM.handRadius), 9);
    d = sdSmoothUnion(d, armDistance, 15);
  }

  for (const foot of rig.feet) {
    d = sdSmoothUnion(d, sdEllipse(bx, by, foot.cx, foot.cy, FOOT.rx, FOOT.ry), 12);
  }

  if (withTail) {
    let tailDistance = Number.POSITIVE_INFINITY;
    for (const segment of rig.tail) {
      const capsule = sdCapsule(bx, by, segment.from[0], segment.from[1], segment.to[0], segment.to[1], segment.radius);
      tailDistance = tailDistance === Number.POSITIVE_INFINITY ? capsule : Math.min(tailDistance, capsule);
    }
    d = sdSmoothUnion(d, tailDistance, 11);
  }
  return d;
}

function ribbonDistance(bx, by, rig) {
  let d = Number.POSITIVE_INFINITY;
  for (const segment of rig.ribbon) {
    const distance = segment.from === null
      ? sdCircle(bx, by, segment.to[0], segment.to[1], segment.radius)
      : sdCapsule(bx, by, segment.from[0], segment.from[1], segment.to[0], segment.to[1], segment.radius);
    if (distance < d) d = distance;
  }
  return d;
}

function bodyColor(bx, by, out, offset) {
  const t = ((bx - GRAD.x0) * GRAD_DX + (by - GRAD.y0) * GRAD_DY) / GRAD_LENGTH2;
  sampleTable(BODY_RAMP, t, out, offset);
  const specularDistance = Math.hypot(bx - SPECULAR.cx, by - SPECULAR.cy);
  const specularFalloff = clamp01(0.5 - specularDistance / SPECULAR.radius);
  const specular = SPECULAR.strength * specularFalloff * specularFalloff;
  out[offset] = lerp(out[offset], SPECULAR_COLOUR[0], specular);
  out[offset + 1] = lerp(out[offset + 1], SPECULAR_COLOUR[1], specular);
  out[offset + 2] = lerp(out[offset + 2], SPECULAR_COLOUR[2], specular);
  const rimDistance = Math.hypot(bx - RIM.cx, by - RIM.cy);
  const rimFalloff = clamp01(0.5 - rimDistance / RIM.radius);
  const rim = RIM.strength * rimFalloff * rimFalloff;
  out[offset] = lerp(out[offset], RIM_COLOUR[0], rim);
  out[offset + 1] = lerp(out[offset + 1], RIM_COLOUR[1], rim);
  out[offset + 2] = lerp(out[offset + 2], RIM_COLOUR[2], rim);
  return out;
}

/// Maps a world-space box through the pose transform so each pass only visits
/// the pixels it can actually touch.
function worldBox(transform, box, pad) {
  const corner = new Float64Array(2);
  const xs = [];
  const ys = [];
  for (const cx of [box.x, box.x + box.width]) {
    for (const cy of [box.y, box.y + box.height]) {
      applyTransform(transform, cx, cy, corner);
      xs.push(corner[0]);
      ys.push(corner[1]);
    }
  }
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) + pad - minX,
    height: Math.max(...ys) + pad - minY,
  };
}

const BODY_BOX = Object.freeze({ x: 76, y: 118, width: 368, height: 362 });

function maskAt(mask, width, px, py) {
  const x = px | 0;
  const y = py | 0;
  if (x < 0 || y < 0 || x >= width || y >= width) return 0;
  return mask[y * width + x];
}

/// A soft interior patch clipped to the body: `softness` spreads the falloff
/// well beyond one pixel so belly, blush, and ear interiors read as shading
/// rather than as pasted shapes. Both the distance and the softness are
/// authored lengths, so their ratio is resolution independent.
function softPatchOnBody(canvas, scratch, view, geometry, colour, strength, softness, distance) {
  const { mask } = scratch;
  blend(canvas, geometry, (px, py, out) => {
    const clip = maskAt(mask, view.size, px, py);
    if (clip <= 0) return false;
    const alpha = strength * clamp01(0.5 - distance(px * view.inverse, py * view.inverse) / softness);
    if (alpha <= 0) return false;
    out[0] = -1;
    out[1] = colour[0];
    out[2] = colour[1];
    out[3] = colour[2];
    out[4] = alpha * clip;
    return true;
  });
}

function paintContactShadow(canvas, pose, view) {
  const cx = HIP_X + pose.rootX * 0.7;
  const cy = GROUND_Y + 5;
  const rx = 92 * pose.shadowSpread;
  const ry = 17 * pose.shadowSpread;
  const box = artBox({ x: cx - rx - 34, y: cy - ry - 34, width: (rx + 34) * 2, height: (ry + 34) * 2 }, view);
  blend(canvas, box, (px, py, out) => {
    const falloff = clamp01(0.5 - sdEllipse(px * view.inverse, py * view.inverse, cx, cy, rx, ry) / 30);
    const shaped = falloff * falloff * (3 - 2 * falloff);
    out[0] = -1;
    out[1] = SHADOW_COLOUR[0];
    out[2] = SHADOW_COLOUR[1];
    out[3] = SHADOW_COLOUR[2];
    out[4] = pose.shadowAlpha * shaped;
    return true;
  });
}

function paintRibbon(canvas, rig, inverse, transform, view) {
  const box = worldBox(transform, { x: 74, y: 208, width: 176, height: 190 }, (OUTLINE_WIDTH + 3) * view.scale);
  const body = new Float64Array(2);
  blend(canvas, box, (px, py, out) => {
    applyTransform(inverse, px, py, body);
    const d = ribbonDistance(body[0], body[1], rig);
    const inside = coverage(d * view.scale);
    if (inside <= 0) return false;
    sampleTable(RIBBON_RAMP, (body[1] - 214) / 168, out, 1);
    out[0] = -1;
    out[4] = inside;
    return true;
  });

  if (rig.ribbonDot !== null) {
    const dot = applyTransform(transform, rig.ribbonDot[0], rig.ribbonDot[1], new Float64Array(2));
    const fade = clamp01(rig.ribbonDotFade);
    const glow = 26 * view.scale;
    blend(canvas, { x: dot[0] - glow, y: dot[1] - glow, width: glow * 2, height: glow * 2 }, (px, py, out) => {
      const distance = Math.hypot(px - dot[0], py - dot[1]);
      const falloff = clamp01(0.5 - distance / glow);
      out[0] = -1;
      out[1] = 0.72;
      out[2] = 0.96;
      out[3] = 1;
      out[4] = 0.42 * falloff * falloff * fade;
      return true;
    });
    const core = 5.4 * view.scale;
    blend(canvas, { x: dot[0] - core - 2, y: dot[1] - core - 2, width: (core + 2) * 2, height: (core + 2) * 2 }, (px, py, out) => {
      out[0] = Math.hypot(px - dot[0], py - dot[1]) - core;
      out[1] = 0.93;
      out[2] = 0.99;
      out[3] = 1;
      out[4] = fade;
      return true;
    });
  }

  blend(canvas, box, (px, py, out) => {
    applyTransform(inverse, px, py, body);
    const d = ribbonDistance(body[0], body[1], rig) * view.scale;
    const outline = coverage(d) - coverage(d + OUTLINE_WIDTH * 0.82 * view.scale);
    if (outline <= 0) return false;
    out[0] = -1;
    out[1] = OUTLINE_COLOUR[0];
    out[2] = OUTLINE_COLOUR[1];
    out[3] = OUTLINE_COLOUR[2];
    out[4] = outline * 0.9;
    return true;
  });
}

/// Resolves the silhouette once per pixel, caches the distance, and paints the
/// body fill and the outline from that single evaluation.
function paintBody(canvas, scratch, rig, inverse, transform, view) {
  const { distance, mask } = scratch;
  const size = view.size;
  const box = worldBox(transform, BODY_BOX, (OUTLINE_WIDTH + 3) * view.scale);
  const local = new Float64Array(2);

  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(size - 1, Math.ceil(box.x + box.width));
  const y1 = Math.min(size - 1, Math.ceil(box.y + box.height));

  for (let y = y0; y <= y1; y += 1) {
    const py = y + 0.5;
    const row = y * size;
    for (let x = x0; x <= x1; x += 1) {
      applyTransform(inverse, x + 0.5, py, local);
      const d = silhouetteDistance(local[0], local[1], rig) * view.scale;
      const index = row + x;
      distance[index] = d;
      mask[index] = coverage(d);
    }
  }

  blend(canvas, box, (px, py, out) => {
    const alpha = maskAt(mask, size, px, py);
    if (alpha <= 0) return false;
    applyTransform(inverse, px, py, local);
    bodyColor(local[0], local[1], out, 1);
    out[0] = -1;
    out[4] = alpha;
    return true;
  });

  softPatchOnBody(canvas, scratch, view, box, BELLY_COLOUR, 0.24, 13, (bx, by) => {
    applyTransform(inverse, bx, by, local);
    return sdEllipse(local[0], local[1], rig.belly.cx, rig.belly.cy, BELLY.rx, BELLY.ry);
  });

  blend(canvas, box, (px, py, out) => {
    const index = (py | 0) * size + (px | 0);
    const d = distance[index];
    const outline = coverage(d) - coverage(d + OUTLINE_WIDTH * view.scale);
    if (outline <= 0) return false;
    out[0] = -1;
    out[1] = OUTLINE_COLOUR[0];
    out[2] = OUTLINE_COLOUR[1];
    out[3] = OUTLINE_COLOUR[2];
    out[4] = outline * 0.94;
    return true;
  });
}

function paintEarInteriors(canvas, scratch, view, rig, inverse, transform) {
  for (const ear of rig.ears) {
    const box = worldBox(transform, {
      x: Math.min(ear.mid[0], ear.tip[0]) - EAR.innerRadius - 4,
      y: Math.min(ear.mid[1], ear.tip[1]) - EAR.innerRadius - 4,
      width: Math.abs(ear.tip[0] - ear.mid[0]) + (EAR.innerRadius + 4) * 2,
      height: Math.abs(ear.tip[1] - ear.mid[1]) + (EAR.innerRadius + 4) * 2,
    }, 0);
    softPatchOnBody(canvas, scratch, view, box, EAR_INNER_COLOUR, 0.42, 6, (bx, by) => {
      applyTransform(inverse, bx, by, scratch.point);
      return sdCapsule(
        scratch.point[0],
        scratch.point[1],
        lerp(ear.mid[0], ear.base[0], 0.18),
        lerp(ear.mid[1], ear.base[1], 0.18),
        lerp(ear.tip[0], ear.mid[0], 0.22),
        lerp(ear.tip[1], ear.mid[1], 0.22),
        EAR.innerRadius,
      );
    });
  }
}

function paintPads(canvas, scratch, view, rig, inverse, transform) {
  for (const arm of rig.arms) {
    const box = worldBox(transform, {
      x: arm.hand[0] - ARM.padRadius - 3,
      y: arm.hand[1] - ARM.padRadius - 3,
      width: (ARM.padRadius + 3) * 2,
      height: (ARM.padRadius + 3) * 2,
    }, 0);
    softPatchOnBody(canvas, scratch, view, box, PAD_COLOUR, 0.3, 4.5, (bx, by) => {
      applyTransform(inverse, bx, by, scratch.point);
      return sdCircle(scratch.point[0], scratch.point[1], arm.hand[0], arm.hand[1], ARM.padRadius);
    });
  }
  for (const foot of rig.feet) {
    const box = worldBox(transform, {
      x: foot.cx - FOOT.padRx - 3,
      y: foot.cy - FOOT.padRy - 3,
      width: (FOOT.padRx + 3) * 2,
      height: (FOOT.padRy + 3) * 2,
    }, 0);
    softPatchOnBody(canvas, scratch, view, box, PAD_COLOUR, 0.26, 4, (bx, by) => {
      applyTransform(inverse, bx, by, scratch.point);
      return sdEllipse(scratch.point[0], scratch.point[1], foot.cx, foot.cy + 2.5, FOOT.padRx, FOOT.padRy);
    });
  }
}

function strokeChain(points, thickness) {
  return (px, py) => {
    let best = Number.POSITIVE_INFINITY;
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index];
      const distance = index === 0
        ? sdCircle(px, py, current[0], current[1], thickness)
        : sdCapsule(px, py, points[index - 1][0], points[index - 1][1], current[0], current[1], thickness);
      if (distance < best) best = distance;
    }
    return best;
  };
}

function paintFace(canvas, scratch, pose, rig, inverse, transform, view) {
  const size = view.size;
  const lid = clamp01(Math.max(pose.blink, pose.lidLower));

  for (const eye of rig.eyes) {
    const box = worldBox(transform, {
      x: eye.cx - eye.rx - 3,
      y: eye.cy - eye.ry - 3,
      width: (eye.rx + 3) * 2,
      height: (eye.ry + 3) * 2,
    }, 0);

    // Sclera, iris, and the two highlights.
    blend(canvas, box, (px, py, out) => {
      applyTransform(inverse, px, py, scratch.point);
      out[0] = sdEllipse(scratch.point[0], scratch.point[1], eye.cx, eye.cy, eye.rx, eye.ry) * view.scale;
      out[1] = SCLERA_COLOUR[0];
      out[2] = SCLERA_COLOUR[1];
      out[3] = SCLERA_COLOUR[2];
      out[4] = maskAt(scratch.mask, size, px, py);
      return true;
    });

    const irisBox = worldBox(transform, {
      x: eye.irisX - EYE.irisRadius - 2,
      y: eye.irisY - EYE.irisRadius - 2,
      width: (EYE.irisRadius + 2) * 2,
      height: (EYE.irisRadius + 2) * 2,
    }, 0);
    blend(canvas, irisBox, (px, py, out) => {
      applyTransform(inverse, px, py, scratch.point);
      const inEye = coverage(sdEllipse(scratch.point[0], scratch.point[1], eye.cx, eye.cy, eye.rx, eye.ry) * view.scale);
      if (inEye <= 0) return false;
      out[0] = sdCircle(scratch.point[0], scratch.point[1], eye.irisX, eye.irisY, EYE.irisRadius) * view.scale;
      out[1] = IRIS_COLOUR[0];
      out[2] = IRIS_COLOUR[1];
      out[3] = IRIS_COLOUR[2];
      out[4] = inEye * maskAt(scratch.mask, size, px, py);
      return true;
    });

    for (const highlight of [
      { dx: -4.8, dy: -5.6, radius: 4.9, alpha: 0.95 },
      { dx: 4.4, dy: 4.8, radius: 2.2, alpha: 0.5 },
    ]) {
      const hx = eye.irisX + highlight.dx;
      const hy = eye.irisY + highlight.dy;
      const highlightBox = worldBox(transform, {
        x: hx - highlight.radius - 2,
        y: hy - highlight.radius - 2,
        width: (highlight.radius + 2) * 2,
        height: (highlight.radius + 2) * 2,
      }, 0);
      blend(canvas, highlightBox, (px, py, out) => {
        applyTransform(inverse, px, py, scratch.point);
        const inEye = coverage(sdEllipse(scratch.point[0], scratch.point[1], eye.cx, eye.cy, eye.rx, eye.ry) * view.scale);
        if (inEye <= 0) return false;
        out[0] = sdCircle(scratch.point[0], scratch.point[1], hx, hy, highlight.radius) * view.scale;
        out[1] = 1;
        out[2] = 1;
        out[3] = 1;
        out[4] = highlight.alpha * inEye * maskAt(scratch.mask, size, px, py);
        return true;
      });
    }

    // The upper lid covers the eye from the top down and carries the body
    // shading with it, so a blink reads as a lid closing over the face rather
    // than as a bar crossing it.
    if (lid > 0.005) {
      const lidEdge = eye.cy - eye.ry + lid * eye.ry * 2;
      blend(canvas, box, (px, py, out) => {
        applyTransform(inverse, px, py, scratch.point);
        const inEye = coverage(sdEllipse(scratch.point[0], scratch.point[1], eye.cx, eye.cy, eye.rx, eye.ry) * view.scale);
        if (inEye <= 0) return false;
        const closed = clamp01(lidEdge - scratch.point[1]);
        if (closed <= 0) return false;
        bodyColor(scratch.point[0], scratch.point[1], out, 1);
        out[0] = -1;
        out[4] = closed * inEye * maskAt(scratch.mask, size, px, py);
        return true;
      });
      blend(canvas, box, (px, py, out) => {
        applyTransform(inverse, px, py, scratch.point);
        const inEye = coverage(sdEllipse(scratch.point[0], scratch.point[1], eye.cx, eye.cy, eye.rx, eye.ry) * view.scale);
        if (inEye <= 0) return false;
        const edge = scratch.point[1] - lidEdge;
        const lash = coverage((edge + 1.6) * view.scale) * coverage((1.6 - edge) * view.scale);
        if (lash <= 0) return false;
        out[0] = -1;
        out[1] = OUTLINE_COLOUR[0];
        out[2] = OUTLINE_COLOUR[1];
        out[3] = OUTLINE_COLOUR[2];
        out[4] = lash * inEye * 0.9 * maskAt(scratch.mask, size, px, py);
        return true;
      });
    }
  }

  for (const brow of rig.brows) {
    const points = [-1, -0.35, 0.35, 1].map((s) => [
      brow.cx + s * BROW.halfWidth,
      brow.cy + Math.abs(s) * 2.4 - s * brow.tilt * 26,
    ]);
    const box = worldBox(transform, {
      x: brow.cx - BROW.halfWidth - 6,
      y: brow.cy - 12,
      width: BROW.halfWidth * 2 + 12,
      height: 24,
    }, 0);
    const stroke = strokeChain(points, BROW.thickness);
    blend(canvas, box, (px, py, out) => {
      applyTransform(inverse, px, py, scratch.point);
      out[0] = stroke(scratch.point[0], scratch.point[1]) * view.scale;
      out[1] = BROW_COLOUR[0];
      out[2] = BROW_COLOUR[1];
      out[3] = BROW_COLOUR[2];
      out[4] = 0.58 * maskAt(scratch.mask, size, px, py);
      return true;
    });
  }

  const halfWidth = MOUTH.halfWidth * pose.mouthWidth;
  const curveDepth = MOUTH.depth * pose.mouthCurve;
  const lipPoints = [];
  for (let index = 0; index <= 14; index += 1) {
    const s = (index / 14) * 2 - 1;
    lipPoints.push([rig.mouth.cx + s * halfWidth, rig.mouth.cy + curveDepth * (1 - s * s)]);
  }
  const mouthBox = worldBox(transform, {
    x: rig.mouth.cx - halfWidth - 8,
    y: rig.mouth.cy - 16,
    width: halfWidth * 2 + 16,
    height: 40 + Math.abs(curveDepth),
  }, 0);
  const lipStroke = strokeChain(lipPoints, lerp(MOUTH.thickness, 2.6, clamp01(pose.mouthOpen)));

  const openDepth = pose.mouthOpen * 11.5;
  if (openDepth > 0.05) {
    const interiorRx = halfWidth * 0.76;
    const interiorCy = rig.mouth.cy + curveDepth * 0.55 + openDepth * 0.5;
    blend(canvas, mouthBox, (px, py, out) => {
      applyTransform(inverse, px, py, scratch.point);
      const d = sdEllipse(scratch.point[0], scratch.point[1], rig.mouth.cx, interiorCy, interiorRx, openDepth) * view.scale;
      if (coverage(d) <= 0) return false;
      out[0] = d;
      out[1] = MOUTH_COLOUR[0];
      out[2] = MOUTH_COLOUR[1];
      out[3] = MOUTH_COLOUR[2];
      out[4] = maskAt(scratch.mask, size, px, py);
      return true;
    });
    const tongueAlpha = clamp01((pose.mouthOpen - 0.34) / 0.4);
    if (tongueAlpha > 0) {
      blend(canvas, mouthBox, (px, py, out) => {
        applyTransform(inverse, px, py, scratch.point);
        const inside = coverage(
          sdEllipse(scratch.point[0], scratch.point[1], rig.mouth.cx, interiorCy, interiorRx, openDepth) * view.scale,
        );
        if (inside <= 0) return false;
        const d = sdEllipse(
          scratch.point[0],
          scratch.point[1],
          rig.mouth.cx,
          interiorCy + openDepth * 0.52,
          interiorRx * 0.54,
          openDepth * 0.44,
        ) * view.scale;
        out[0] = d;
        out[1] = TONGUE_COLOUR[0];
        out[2] = TONGUE_COLOUR[1];
        out[3] = TONGUE_COLOUR[2];
        out[4] = tongueAlpha * inside * maskAt(scratch.mask, size, px, py);
        return true;
      });
    }
  }

  blend(canvas, mouthBox, (px, py, out) => {
    applyTransform(inverse, px, py, scratch.point);
    out[0] = lipStroke(scratch.point[0], scratch.point[1]) * view.scale;
    out[1] = MOUTH_COLOUR[0];
    out[2] = MOUTH_COLOUR[1];
    out[3] = MOUTH_COLOUR[2];
    out[4] = 0.92 * maskAt(scratch.mask, size, px, py);
    return true;
  });

  for (const blush of rig.blushes) {
    const box = worldBox(transform, {
      x: blush.cx - BLUSH.rx - 10,
      y: blush.cy - BLUSH.ry - 10,
      width: (BLUSH.rx + 10) * 2,
      height: (BLUSH.ry + 10) * 2,
    }, 0);
    softPatchOnBody(canvas, scratch, view, box, BLUSH_COLOUR, 0.42 * pose.blush, 7, (bx, by) => {
      applyTransform(inverse, bx, by, scratch.point);
      return sdEllipse(scratch.point[0], scratch.point[1], blush.cx, blush.cy, BLUSH.rx, BLUSH.ry);
    });
  }
}

function paintCelebration(canvas, pose, view) {
  if (pose.particleBurst < 0) return;
  const burst = clamp01(pose.particleBurst);
  const cx = HIP_X + pose.rootX;
  const cy = 372 + pose.rootY;
  for (const particle of PARTICLES) {
    const local = (burst - particle.birth) / particle.life;
    if (local <= 0 || local >= 1) continue;
    const eased = 1 - (1 - local) * (1 - local);
    const radius = particle.speed * eased;
    const x = cx + Math.cos(particle.angle) * radius;
    const y = cy + Math.sin(particle.angle) * radius * 0.86 + 64 * local * local;
    const size = particle.size * 1.25 * (1 - 0.55 * local);
    const alpha = Math.pow(1 - local, 1.2);
    const box = artBox({ x: x - size - 2, y: y - size - 2, width: (size + 2) * 2, height: (size + 2) * 2 }, view);
    blend(canvas, box, (px, py, out) => {
      sampleTable(PARTICLE_RAMP, local, out, 1);
      out[0] = sdCircle(px * view.inverse, py * view.inverse, x, y, size) * view.scale;
      out[4] = alpha;
      return true;
    });
  }
  for (const sparkle of SPARKLES) {
    const local = (burst - sparkle.birth) / sparkle.life;
    if (local <= 0 || local >= 1) continue;
    const eased = 1 - (1 - local) * (1 - local);
    const radius = sparkle.speed * eased;
    const x = cx + Math.cos(sparkle.angle) * radius;
    const y = cy + Math.sin(sparkle.angle) * radius * 0.8 + 52 * local * local;
    const size = sparkle.size * 1.15 * Math.sin(Math.PI * clamp01(local * 1.15));
    const alpha = Math.pow(1 - local, 1.0);
    const spin = local * 1.5 + sparkle.angle;
    const arms = [
      [[x - Math.cos(spin) * size, y - Math.sin(spin) * size], [x + Math.cos(spin) * size, y + Math.sin(spin) * size]],
      [
        [x - Math.cos(spin + Math.PI / 2) * size * 0.72, y - Math.sin(spin + Math.PI / 2) * size * 0.72],
        [x + Math.cos(spin + Math.PI / 2) * size * 0.72, y + Math.sin(spin + Math.PI / 2) * size * 0.72],
      ],
    ];
    const box = artBox({ x: x - size - 4, y: y - size - 4, width: (size + 4) * 2, height: (size + 4) * 2 }, view);
    blend(canvas, box, (px, py, out) => {
      const ax = px * view.inverse;
      const ay = py * view.inverse;
      let best = Number.POSITIVE_INFINITY;
      for (const arm of arms) {
        const d = sdCapsule(ax, ay, arm[0][0], arm[0][1], arm[1][0], arm[1][1], 2.1);
        if (d < best) best = d;
      }
      out[0] = best * view.scale;
      out[1] = 1;
      out[2] = 0.98;
      out[3] = 0.88;
      out[4] = alpha;
      return true;
    });
  }
}

/// The broken connection mark of the disconnected action. Two links drift apart
/// and dim; the task-blocked action carries no mark, which is what keeps the
/// two states visually distinguishable at a glance.
function paintConnectionMark(canvas, pose, view) {
  if (pose.linkAlpha <= 0.004) return;
  const separation = pose.linkSeparation;
  for (const side of [-1, 1]) {
    const cx = LINK.cx + side * (11 + separation);
    const cy = LINK.cy + side * separation * 0.22;
    const tilt = pose.linkTilt * side;
    const box = artBox({ x: cx - 26, y: cy - 26, width: 52, height: 52 }, view);
    blend(canvas, box, (px, py, out) => {
      const ring = Math.abs(
        sdRotatedEllipse(px * view.inverse, py * view.inverse, cx, cy, LINK.halfWidth, LINK.halfHeight, tilt),
      ) - LINK.thickness;
      out[0] = ring * view.scale;
      out[1] = LINK_COLOUR[0];
      out[2] = LINK_COLOUR[1];
      out[3] = LINK_COLOUR[2];
      out[4] = pose.linkAlpha;
      return true;
    });
  }
}

/// Renders one frame. The result is a square RGBA canvas with a fully
/// transparent background and the character standing on `GROUND_Y`.
///
/// `size` is 512 for every delivered animation frame. The character sheet and
/// the app icon request 1024, which the same analytic shapes render directly
/// instead of upscaling an already baked frame.
export function renderCharacter(pose, scratch = createScratch(), size = CANVAS_WIDTH) {
  const view = createView(size);
  const canvas = createCanvas(size, size);
  const poseTransform = bodyTransform(pose);
  const transform = view.scale === 1
    ? poseTransform
    : multiplyTransform(scaleAboutTransform(view.scale, view.scale, 0, 0), poseTransform);
  const inverse = invertTransform(transform);
  const rig = rigGeometry(pose);

  paintContactShadow(canvas, pose, view);
  // The celebration sits behind the ribbon and the body so the particles read
  // as bursting out from the character instead of lying over its face.
  paintCelebration(canvas, pose, view);
  paintRibbon(canvas, rig, inverse, transform, view);
  paintBody(canvas, scratch, rig, inverse, transform, view);
  paintEarInteriors(canvas, scratch, view, rig, inverse, transform);
  paintPads(canvas, scratch, view, rig, inverse, transform);
  paintFace(canvas, scratch, pose, rig, inverse, transform, view);
  paintConnectionMark(canvas, pose, view);
  return canvas;
}

/// The menu bar template icon. macOS recolours a template image, so the
/// delivered bytes carry alpha only: the character silhouette with the eyes cut
/// out and no tail, which stays legible at the 18 pt the menu bar uses.
export function renderMenuBarIcon(size = 44) {
  const rig = rigGeometry(neutralPose());
  const canvas = createCanvas(size, size);
  const source = { x: 94, y: 136, width: 324, height: 324 };
  const factor = size / source.width;
  blend(canvas, { x: 0, y: 0, width: size, height: size }, (px, py, out) => {
    const bx = source.x + px / factor;
    const by = source.y + py / factor;
    let d = silhouetteDistance(bx, by, rig, false) * factor;
    for (const eye of rig.eyes) {
      const cut = sdEllipse(bx, by, eye.cx, eye.cy, eye.rx * 0.78, eye.ry * 0.78) * factor;
      if (-cut > d) d = -cut;
    }
    out[0] = d;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 1;
    return true;
  });
  return canvas;
}

/// The app icon: the delivered character on a light brand plate with the
/// rounded corner macOS expects, rendered from the same shapes at 1024.
export function renderAppIcon(size = 1024) {
  const canvas = createCanvas(size, size);
  const radius = size * 0.2237;
  const plate = rampTable([
    [0, hexColor("#EFF5FF")],
    [0.55, hexColor("#DDE7FB")],
    [1, hexColor("#C7D3F4")],
  ]);
  blend(canvas, { x: 0, y: 0, width: size, height: size }, (px, py, out) => {
    out[0] = sdRoundRect(px, py, size / 2, size / 2, size / 2, size / 2, radius);
    sampleTable(plate, (px + py) / (2 * size), out, 1);
    out[4] = 1;
    return true;
  });
  // The character is rendered at the plate resolution and placed from its own
  // alpha bounds, so the icon grid keeps the same silhouette and proportion as
  // the delivered frame instead of an upscaled bake.
  const renderSize = Math.round(size * 1.16);
  const character = renderCharacter(neutralPose(), createScratch(renderSize), renderSize);
  const bounds = alphaBounds(character);
  const offsetX = Math.round(size / 2 - (bounds.minX + bounds.maxX) / 2);
  const offsetY = Math.round(size * 0.86 - bounds.maxY);
  compositeOver(canvas, character, offsetX, offsetY);
  return canvas;
}
