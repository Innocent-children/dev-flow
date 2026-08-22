const PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

export function versionAtLeast(candidate, minimum) {
  return compareVersions(candidate, minimum) >= 0;
}

export function compareVersions(left, right) {
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index += 1) {
    if (a.core[index] !== b.core[index]) return a.core[index] - b.core[index];
  }
  if (a.prerelease.length === 0 || b.prerelease.length === 0) {
    if (a.prerelease.length === b.prerelease.length) return 0;
    return a.prerelease.length === 0 ? 1 : -1;
  }
  const length = Math.max(a.prerelease.length, b.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    if (a.prerelease[index] === undefined) return -1;
    if (b.prerelease[index] === undefined) return 1;
    const order = compareIdentifier(a.prerelease[index], b.prerelease[index]);
    if (order !== 0) return order;
  }
  return 0;
}

function parse(value) {
  const match = PATTERN.exec(value ?? "");
  if (!match) throw new Error(`invalid semantic version ${JSON.stringify(value)}`);
  return {
    core: match.slice(1, 4).map(Number),
    prerelease: match[4] === undefined ? [] : match[4].split("."),
  };
}

function compareIdentifier(left, right) {
  const leftNumeric = /^(0|[1-9]\d*)$/u.test(left);
  const rightNumeric = /^(0|[1-9]\d*)$/u.test(right);
  if (leftNumeric && rightNumeric) return Number(left) - Number(right);
  if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
  return left < right ? -1 : left > right ? 1 : 0;
}
