import assert from "node:assert/strict";
import test from "node:test";
import { runDesktopPetCommand, verifyMacDesktopToolchain } from "./build-desktop-pet.mjs";

function toolchain(xcode, sdk) {
  return async (_command, args) => ({ stdout: args[0] === "xcodebuild" ? xcode
    : args[0] === "swift" ? "Apple Swift version 6.4\n" : sdk });
}

test("desktop toolchain accepts Xcode 27 and reports the selected SDK and compiler", async () => {
  let output = "";
  await verifyMacDesktopToolchain({
    execute: toolchain("Xcode 27.0\nBuild version 27A5252f\n", "27.0\n"),
    write: text => { output += text; },
  });
  assert.match(output, /Xcode 27.0\nBuild version 27A5252f/u);
  assert.match(output, /Apple Swift version 6.4/u);
  assert.match(output, /macOS SDK 27.0/u);
});

test("desktop toolchain rejects old Xcode, old SDK and unrecognized version output before compilation", async () => {
  for (const [xcode, sdk] of [["Xcode 16.4", "15.5"], ["Xcode 26.6", "26.5"], ["Xcode 27.0", "26.5"], ["unknown", "27.0"], ["Xcode 27.0", "unknown"]]) {
    await assert.rejects(verifyMacDesktopToolchain({ execute: toolchain(xcode, sdk), write() {} }),
      /requires Xcode >=27 with macOS SDK >=27.*DEVELOPER_DIR/u);
  }
});

test("failed native commands retain stdout diagnostics, stderr and exit status for message-only callers", async () => {
  await assert.rejects(runDesktopPetCommand(process.execPath, ["-e",
    'process.stdout.write("source.swift:163: error: missing member\\n"); process.stderr.write("compiler stopped\\n"); process.exit(1);',
  ]), error => {
    assert.match(error.message, /code=1/u);
    assert.match(error.message, /\nsource.swift:163: error: missing member\n/u);
    assert.match(error.message, /\ncompiler stopped\n/u);
    assert.equal(error.cause.code, 1);
    return true;
  });
});

test("successful native command output stays capturable for binary path lookup", async () => {
  const result = await runDesktopPetCommand(process.execPath, ["-e", 'process.stdout.write("/tmp/build/arm64/release\\n");']);
  assert.equal(result.stdout, "/tmp/build/arm64/release\n");
  assert.equal(result.stderr, "");
});
