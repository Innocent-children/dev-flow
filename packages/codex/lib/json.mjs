export function assertNoDuplicateJSONMembers(text) {
  let offset = 0;
  const skip = () => { while (/\s/u.test(text[offset] ?? "")) offset += 1; };
  const string = () => {
    const start = offset;
    offset += 1;
    while (offset < text.length) {
      if (text[offset] === "\\") { offset += 2; continue; }
      if (text[offset] === '"') { offset += 1; return JSON.parse(text.slice(start, offset)); }
      offset += 1;
    }
    throw new Error("unterminated string");
  };
  const value = () => {
    skip();
    if (text[offset] === "{") return object();
    if (text[offset] === "[") return array();
    if (text[offset] === '"') { string(); return; }
    const match = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/u.exec(text.slice(offset));
    if (!match) throw new Error("invalid value");
    offset += match[0].length;
  };
  const object = () => {
    offset += 1; skip();
    const keys = new Set();
    if (text[offset] === "}") { offset += 1; return; }
    while (true) {
      skip();
      if (text[offset] !== '"') throw new Error("invalid object key");
      const key = string();
      if (keys.has(key)) throw new Error(`duplicate field ${key}`);
      keys.add(key); skip();
      if (text[offset] !== ":") throw new Error("missing colon");
      offset += 1; value(); skip();
      if (text[offset] === "}") { offset += 1; return; }
      if (text[offset] !== ",") throw new Error("missing comma");
      offset += 1;
    }
  };
  const array = () => {
    offset += 1; skip();
    if (text[offset] === "]") { offset += 1; return; }
    while (true) {
      value(); skip();
      if (text[offset] === "]") { offset += 1; return; }
      if (text[offset] !== ",") throw new Error("missing comma");
      offset += 1;
    }
  };
  value(); skip();
  if (offset !== text.length) throw new Error("trailing JSON");
}
