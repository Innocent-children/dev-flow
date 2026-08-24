const STABLE_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u;
const BETA_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)-beta\.(0|[1-9][0-9]*)$/u;

export const RELEASE_CHANNELS = Object.freeze(["stable", "beta"]);

export function releaseChannel(version) {
  if (STABLE_PATTERN.test(version ?? "")) return "stable";
  if (BETA_PATTERN.test(version ?? "")) return "beta";
  throw new Error("release version must be MAJOR.MINOR.PATCH or MAJOR.MINOR.PATCH-beta.N");
}

export function validateChannelVersion(channel, version) {
  if (!RELEASE_CHANNELS.includes(channel)) throw new Error("release channel must equal stable or beta");
  const actual = releaseChannel(version);
  if (actual !== channel) throw new Error(`${channel} channel requires a ${channel === "stable" ? "MAJOR.MINOR.PATCH" : "MAJOR.MINOR.PATCH-beta.N"} version`);
  return actual;
}

export function isReleaseVersion(version) {
  return STABLE_PATTERN.test(version ?? "") || BETA_PATTERN.test(version ?? "");
}

export function isStableVersion(version) {
  return STABLE_PATTERN.test(version ?? "");
}

export function isBetaVersion(version) {
  return BETA_PATTERN.test(version ?? "");
}

export function npmDistTag(version) {
  return isBetaVersion(version) ? "beta" : "latest";
}

export function isRemoteStateMissing(result) {
  return /E404|404 Not Found|ETARGET|No matching version|not found|release not found/iu.test(`${result?.stdout ?? ""}\n${result?.stderr ?? ""}`);
}

export function compareReleaseVersions(left, right) {
  const a = parseReleaseVersion(left);
  const b = parseReleaseVersion(right);
  for (const field of ["major", "minor", "patch"]) {
    if (a[field] !== b[field]) return a[field] - b[field];
  }
  if (a.beta === null || b.beta === null) {
    if (a.beta === b.beta) return 0;
    return a.beta === null ? 1 : -1;
  }
  return a.beta - b.beta;
}

function parseReleaseVersion(version) {
  const channel = releaseChannel(version);
  const match = (channel === "stable" ? STABLE_PATTERN : BETA_PATTERN).exec(version);
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    beta: channel === "beta" ? Number(match[4]) : null,
  };
}
