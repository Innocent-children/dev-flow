/// Software rasteriser and PNG encoder for the delivered desktop pet artwork.
///
/// The baker is the editable source of every delivered frame: each pixel comes
/// from analytic signed-distance shapes and colour ramps evaluated here, so one
/// pose always produces byte-identical PNG bytes. Nothing in this module reads
/// a random number, a clock, the operating system, or a native image library,
/// which is what keeps the build reproducible on any machine that runs it.
///
/// Canvases hold premultiplied RGBA floats in `0..1`. Premultiplication keeps
/// blending free of per-pixel division; `encodePNG` un-premultiplies once when
/// it quantises to the 8-bit straight-alpha PNG the native asset library reads.
import { deflateSync } from "node:zlib";

export function clamp01(value) {
  return value <= 0 ? 0 : value >= 1 ? 1 : value;
}

export function clamp(value, low, high) {
  return value <= low ? low : value >= high ? high : value;
}

export function lerp(from, to, t) {
  return from + (to - from) * t;
}

export function smoothstep(t) {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

/// `#RRGGBB` to a float triple. Colours stay in sRGB space; the whole baker
/// composites there so the delivered frames match the values named in the
/// interface and animation specification.
export function hexColor(text) {
  const value = Number.parseInt(text.slice(1), 16);
  if (!Number.isFinite(value)) throw new Error(`invalid colour ${text}`);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

export function createCanvas(width, height) {
  if (!Number.isInteger(width) || width <= 0) throw new Error(`canvas width must be a positive integer, got ${width}`);
  if (!Number.isInteger(height) || height <= 0) throw new Error(`canvas height must be a positive integer, got ${height}`);
  return { width, height, pixels: new Float32Array(width * height * 4) };
}

/// The antialiasing ramp of a signed distance: fully covered half a pixel
/// inside the boundary, fully clear half a pixel outside it.
export function coverage(distance) {
  return clamp01(0.5 - distance);
}

/// Paints every pixel centre inside `box` through `shade`.
///
/// `shade(px, py, out)` returns `false` to skip the pixel, or writes
/// `out[0]` = signed distance, `out[1..3]` = straight RGB, `out[4]` = opacity
/// and returns `true`. Passing the output array in keeps a full frame free of
/// per-pixel allocation.
export function blend(canvas, box, shade) {
  const { width, height, pixels } = canvas;
  const out = new Float64Array(5);
  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(width - 1, Math.ceil(box.x + box.width));
  const y1 = Math.min(height - 1, Math.ceil(box.y + box.height));
  for (let y = y0; y <= y1; y += 1) {
    const py = y + 0.5;
    const row = y * width * 4;
    for (let x = x0; x <= x1; x += 1) {
      if (!shade(x + 0.5, py, out)) continue;
      const alpha = clamp01(coverage(out[0]) * out[4]);
      if (alpha <= 0) continue;
      const index = row + x * 4;
      const keep = 1 - alpha;
      pixels[index + 3] = alpha + pixels[index + 3] * keep;
      pixels[index] = out[1] * alpha + pixels[index] * keep;
      pixels[index + 1] = out[2] * alpha + pixels[index + 1] * keep;
      pixels[index + 2] = out[3] * alpha + pixels[index + 2] * keep;
    }
  }
  return canvas;
}

// MARK: - Signed distance primitives

export function sdCircle(px, py, cx, cy, radius) {
  return Math.hypot(px - cx, py - cy) - radius;
}

/// Distance to an axis-aligned ellipse, accurate next to the boundary where the
/// one-pixel antialiasing ramp lives.
export function sdEllipse(px, py, cx, cy, rx, ry) {
  const qx = (px - cx) / rx;
  const qy = (py - cy) / ry;
  const k0 = Math.hypot(qx, qy);
  if (k0 < 1e-9) return -Math.min(rx, ry);
  const k1 = Math.hypot(qx / rx, qy / ry);
  return (k0 * (k0 - 1)) / k1;
}

export function sdRotatedEllipse(px, py, cx, cy, rx, ry, angle) {
  const cosine = Math.cos(-angle);
  const sine = Math.sin(-angle);
  const dx = px - cx;
  const dy = py - cy;
  return sdEllipse(dx * cosine - dy * sine + cx, dx * sine + dy * cosine + cy, cx, cy, rx, ry);
}

export function sdCapsule(px, py, ax, ay, bx, by, radius) {
  const vx = bx - ax;
  const vy = by - ay;
  const length2 = vx * vx + vy * vy;
  const t = length2 < 1e-12 ? 0 : clamp01(((px - ax) * vx + (py - ay) * vy) / length2);
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t)) - radius;
}

export function sdRoundRect(px, py, cx, cy, halfWidth, halfHeight, radius) {
  const qx = Math.abs(px - cx) - halfWidth + radius;
  const qy = Math.abs(py - cy) - halfHeight + radius;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return outside + inside - radius;
}

/// Polynomial smooth minimum. Merging the body parts through it removes the
/// hard crease a plain `min` would leave where an ear, an arm, or a tail bead
/// meets the body, which is what gives the character its soft single silhouette.
export function sdSmoothUnion(left, right, k) {
  if (k <= 0) return Math.min(left, right);
  const h = clamp01(0.5 + (0.5 * (right - left)) / k);
  return right * (1 - h) + left * h - k * h * (1 - h);
}

/// A stroked arc of `sweep` radians around `(cx, cy)`, sampled as a capsule
/// chain. The mouth and the broken connection mark use it.
export function sdArc(px, py, cx, cy, radius, start, sweep, thickness) {
  const steps = Math.max(2, Math.ceil((Math.abs(sweep) * radius) / (thickness * 0.9)));
  let best = Number.POSITIVE_INFINITY;
  let previousX = cx + Math.cos(start) * radius;
  let previousY = cy + Math.sin(start) * radius;
  for (let i = 1; i <= steps; i += 1) {
    const angle = start + (sweep * i) / steps;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    const distance = sdCapsule(px, py, previousX, previousY, x, y, thickness);
    if (distance < best) best = distance;
    previousX = x;
    previousY = y;
  }
  return best;
}

// MARK: - Colour ramps

/// Bakes a `[[stop, colour], ...]` ramp into a lookup table so a gradient costs
/// one indexed read per pixel instead of walking the stop list.
export function rampTable(stops, size = 512) {
  const ordered = [...stops].sort((a, b) => a[0] - b[0]);
  const table = new Float32Array(size * 3);
  for (let i = 0; i < size; i += 1) {
    const t = i / (size - 1);
    let lower = ordered[0];
    let upper = ordered[ordered.length - 1];
    for (let s = 0; s < ordered.length - 1; s += 1) {
      if (t >= ordered[s][0] && t <= ordered[s + 1][0]) {
        lower = ordered[s];
        upper = ordered[s + 1];
        break;
      }
    }
    const span = upper[0] - lower[0];
    const mix = span <= 0 ? 0 : clamp01((t - lower[0]) / span);
    table[i * 3] = lerp(lower[1][0], upper[1][0], mix);
    table[i * 3 + 1] = lerp(lower[1][1], upper[1][1], mix);
    table[i * 3 + 2] = lerp(lower[1][2], upper[1][2], mix);
  }
  return table;
}

/// Writes the ramp colour for `t` into `out` starting at `offset`.
export function sampleTable(table, t, out, offset = 0) {
  const size = table.length / 3;
  const scaled = clamp01(t) * (size - 1);
  const index = Math.min(size - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = index * 3;
  const b = a + 3;
  out[offset] = table[a] + (table[b] - table[a]) * mix;
  out[offset + 1] = table[a + 1] + (table[b + 1] - table[a + 1]) * mix;
  out[offset + 2] = table[a + 2] + (table[b + 2] - table[a + 2]) * mix;
  return out;
}

// MARK: - 2D affine transform
//
// A transform is `[a, b, c, d, e, f]` with `x' = a*x + c*y + e` and
// `y' = b*x + d*y + f`. The character is posed by one affine that scales about
// the ground anchor, tilts about the hips, and translates, so every part can be
// evaluated in neutral body space through a single inverted matrix.

export function identityTransform() {
  return [1, 0, 0, 1, 0, 0];
}

export function multiplyTransform(outer, inner) {
  return [
    outer[0] * inner[0] + outer[2] * inner[1],
    outer[1] * inner[0] + outer[3] * inner[1],
    outer[0] * inner[2] + outer[2] * inner[3],
    outer[1] * inner[2] + outer[3] * inner[3],
    outer[0] * inner[4] + outer[2] * inner[5] + outer[4],
    outer[1] * inner[4] + outer[3] * inner[5] + outer[5],
  ];
}

export function translationTransform(x, y) {
  return [1, 0, 0, 1, x, y];
}

export function scaleAboutTransform(sx, sy, cx, cy) {
  return [sx, 0, 0, sy, cx - sx * cx, cy - sy * cy];
}

export function rotationAboutTransform(angle, cx, cy) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return [cosine, sine, -sine, cosine, cx - cosine * cx + sine * cy, cy - sine * cx - cosine * cy];
}

export function invertTransform(m) {
  const determinant = m[0] * m[3] - m[2] * m[1];
  if (Math.abs(determinant) < 1e-12) throw new Error("transform is not invertible");
  const a = m[3] / determinant;
  const b = -m[1] / determinant;
  const c = -m[2] / determinant;
  const d = m[0] / determinant;
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
}

export function applyTransform(m, x, y, out, offset = 0) {
  out[offset] = m[0] * x + m[2] * y + m[4];
  out[offset + 1] = m[1] * x + m[3] * y + m[5];
  return out;
}

// MARK: - Backgrounds used by the delivered inspection previews

export function checkerboard(width, height, cell, light, dark) {
  const canvas = createCanvas(width, height);
  const { pixels } = canvas;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const colour = ((x / cell) | 0) % 2 === ((y / cell) | 0) % 2 ? light : dark;
      const index = (y * width + x) * 4;
      pixels[index] = colour[0];
      pixels[index + 1] = colour[1];
      pixels[index + 2] = colour[2];
      pixels[index + 3] = 1;
    }
  }
  return canvas;
}

export function solidCanvas(width, height, colour) {
  const canvas = createCanvas(width, height);
  const { pixels } = canvas;
  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = colour[0];
    pixels[index + 1] = colour[1];
    pixels[index + 2] = colour[2];
    pixels[index + 3] = 1;
  }
  return canvas;
}

/// A deterministic soft desktop wallpaper. The readability check needs a
/// background with hue and value changes behind the character; this one is
/// built from fixed blobs so the delivered preview never changes between runs.
export function complexBackground(width, height) {
  const canvas = solidCanvas(width, height, hexColor("#20243A"));
  const blobs = [
    { x: 0.18, y: 0.22, r: 0.42, colour: hexColor("#3D6FD6"), alpha: 0.75 },
    { x: 0.82, y: 0.16, r: 0.34, colour: hexColor("#8A5BE0"), alpha: 0.62 },
    { x: 0.7, y: 0.86, r: 0.46, colour: hexColor("#1D8FA8"), alpha: 0.5 },
    { x: 0.26, y: 0.9, r: 0.3, colour: hexColor("#D9758F"), alpha: 0.4 },
    { x: 0.5, y: 0.5, r: 0.55, colour: hexColor("#F3F0E8"), alpha: 0.18 },
  ];
  for (const blob of blobs) {
    const cx = blob.x * width;
    const cy = blob.y * height;
    const radius = blob.r * Math.max(width, height);
    blend(canvas, { x: cx - radius, y: cy - radius, width: radius * 2, height: radius * 2 }, (px, py, out) => {
      const distance = Math.hypot(px - cx, py - cy) - radius;
      const falloff = clamp01(0.5 - distance / radius);
      out[0] = -1;
      out[1] = blob.colour[0];
      out[2] = blob.colour[1];
      out[3] = blob.colour[2];
      out[4] = falloff * falloff * blob.alpha;
      return true;
    });
  }
  return canvas;
}

/// Area-average resize. The contact sheets and the scaled clarity checks shrink
/// full frames, and averaging keeps the outline and the eye highlights legible
/// where nearest-neighbour sampling would drop them.
export function resized(source, width, height) {
  const target = createCanvas(width, height);
  const xStep = source.width / width;
  const yStep = source.height / height;
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.floor(y * yStep);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * yStep));
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.floor(x * xStep);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * xStep));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let sy = y0; sy < y1; sy += 1) {
        const row = sy * source.width * 4;
        for (let sx = x0; sx < x1; sx += 1) {
          const index = row + sx * 4;
          r += source.pixels[index];
          g += source.pixels[index + 1];
          b += source.pixels[index + 2];
          a += source.pixels[index + 3];
          count += 1;
        }
      }
      const index = (y * width + x) * 4;
      target.pixels[index] = r / count;
      target.pixels[index + 1] = g / count;
      target.pixels[index + 2] = b / count;
      target.pixels[index + 3] = a / count;
    }
  }
  return target;
}

/// The bounding box of every pixel carrying visible alpha, or `null` for a
/// fully transparent canvas. The bake checks use it to confirm the ground
/// contact and the horizontal centre stay put across a whole clip.
export function alphaBounds(canvas, threshold = 0.004) {
  const { width, height, pixels } = canvas;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    const row = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      if (pixels[row + x * 4 + 3] <= threshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY };
}

/// Composites `source` onto `target` at an offset. `target` must be opaque.
export function compositeOver(target, source, offsetX, offsetY) {
  for (let y = 0; y < source.height; y += 1) {
    const ty = y + offsetY;
    if (ty < 0 || ty >= target.height) continue;
    for (let x = 0; x < source.width; x += 1) {
      const tx = x + offsetX;
      if (tx < 0 || tx >= target.width) continue;
      const from = (y * source.width + x) * 4;
      const alpha = source.pixels[from + 3];
      if (alpha <= 0) continue;
      const to = (ty * target.width + tx) * 4;
      const keep = 1 - alpha;
      target.pixels[to] = source.pixels[from] + target.pixels[to] * keep;
      target.pixels[to + 1] = source.pixels[from + 1] + target.pixels[to + 1] * keep;
      target.pixels[to + 2] = source.pixels[from + 2] + target.pixels[to + 2] * keep;
      target.pixels[to + 3] = alpha + target.pixels[to + 3] * keep;
    }
  }
  return target;
}

/// Reads the IHDR of a PNG buffer. The bake check uses it to confirm every
/// delivered frame carries the catalog canvas size and a true alpha channel.
export function inspectPNG(buffer) {
  if (buffer.length < 33) throw new Error("png is too short to carry a header");
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.compare(signature, 0, 8, 0, 8) !== 0) throw new Error("png signature missing");
  if (buffer.toString("ascii", 12, 16) !== "IHDR") throw new Error("png IHDR chunk missing");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bitDepth: buffer.readUInt8(24),
    colorType: buffer.readUInt8(25),
  };
}

// MARK: - PNG encoding

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let entry = 0; entry < 256; entry += 1) {
    let value = entry;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xed_b8_83_20 ^ (value >>> 1) : value >>> 1;
    }
    table[entry] = value;
  }
  return table;
})();

function crc32(buffer) {
  let value = 0xff_ff_ff_ff;
  for (let i = 0; i < buffer.length; i += 1) {
    value = CRC_TABLE[(value ^ buffer[i]) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xff_ff_ff_ff) >>> 0;
}

function pngChunk(type, data) {
  const body = Buffer.allocUnsafe(4 + data.length);
  body.write(type, 0, "ascii");
  data.copy(body, 4);
  const header = Buffer.allocUnsafe(4);
  header.writeUInt32BE(data.length, 0);
  const trailer = Buffer.allocUnsafe(4);
  trailer.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([header, body, trailer]);
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

const PNG_FILTERS = [0, 1, 2, 3, 4];

function filteredByte(row, previous, filter, index) {
  const left = index >= 4 ? row[index - 4] : 0;
  const up = previous[index];
  const upperLeft = index >= 4 ? previous[index - 4] : 0;
  switch (filter) {
    case 0:
      return row[index];
    case 1:
      return row[index] - left;
    case 2:
      return row[index] - up;
    case 3:
      return row[index] - ((left + up) >> 1);
    default:
      return row[index] - paethPredictor(left, up, upperLeft);
  }
}

/// Encodes a canvas as an 8-bit RGBA PNG. Each scanline picks the filter with
/// the smallest absolute sum, stopping early once a candidate can no longer
/// win; on artwork that is mostly transparent this is what keeps 280 delivered
/// frames at a size the npm package can carry.
export function encodePNG(canvas, { level = 9 } = {}) {
  const { width, height, pixels } = canvas;
  const stride = width * 4;
  const row = Buffer.allocUnsafe(stride);
  const previous = Buffer.alloc(stride);
  const candidate = Buffer.allocUnsafe(stride);
  const best = Buffer.allocUnsafe(stride);
  const raw = Buffer.allocUnsafe((stride + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const base = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      const index = base + x * 4;
      const alpha = clamp01(pixels[index + 3]);
      const offset = x * 4;
      row[offset + 3] = Math.round(alpha * 255);
      if (row[offset + 3] === 0) {
        row[offset] = 0;
        row[offset + 1] = 0;
        row[offset + 2] = 0;
        continue;
      }
      // Straight alpha recovered from the premultiplied accumulator. Float32
      // keeps enough relative precision at low alpha that this reintroduces no
      // dark or white fringe on the transparent edge.
      const inverse = 1 / alpha;
      row[offset] = Math.round(clamp01(pixels[index] * inverse) * 255);
      row[offset + 1] = Math.round(clamp01(pixels[index + 1] * inverse) * 255);
      row[offset + 2] = Math.round(clamp01(pixels[index + 2] * inverse) * 255);
    }

    let bestFilter = 0;
    let bestSum = Number.POSITIVE_INFINITY;
    for (const filter of PNG_FILTERS) {
      let sum = 0;
      for (let i = 0; i < stride; i += 1) {
        const value = filteredByte(row, previous, filter, i) & 0xff;
        candidate[i] = value;
        sum += value < 128 ? value : 256 - value;
        if (sum >= bestSum) break;
      }
      if (sum < bestSum) {
        bestSum = sum;
        bestFilter = filter;
        candidate.copy(best, 0, 0, stride);
        if (sum === 0) break;
      }
    }

    const target = y * (stride + 1);
    raw[target] = bestFilter;
    best.copy(raw, target + 1, 0, stride);
    row.copy(previous, 0, 0, stride);
  }

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}
