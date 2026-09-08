import { createInterface } from "node:readline";

// One session retains buffered input across menus and plan confirmations.
export function createTerminalSession(input, output) {
  const reader = createInterface({ input, output, terminal: Boolean(input.isTTY && output.isTTY), crlfDelay: Infinity });
  const lines = [];
  let waiting = null;
  let ended = false;
  reader.on("line", line => {
    if (waiting) { const resolve = waiting; waiting = null; resolve(line); }
    else lines.push(line);
  });
  reader.on("close", () => { ended = true; waiting?.(null); waiting = null; });
  reader.on("SIGINT", () => reader.close());
  return {
    async question(prompt) {
      output.write(prompt);
      if (lines.length) return lines.shift();
      if (ended) return null;
      return new Promise(resolve => { waiting = resolve; });
    },
    close() { reader.close(); },
  };
}
