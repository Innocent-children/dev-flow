export async function resolveCommandInvocation(executable) {
  return Object.freeze({ executable, prefixArguments: Object.freeze([]) });
}
