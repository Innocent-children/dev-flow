export async function resolveCommandInvocation(executable) {
  return Object.freeze({ executable, prefixArguments: Object.freeze([]) });
}

export function quoteArgument(value) {
  return /^[A-Za-z0-9_./:@=-]+$/u.test(value) ? value : "'" + value.replaceAll("'", "'\"'\"'") + "'";
}
