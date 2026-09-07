const { app } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = process.env.DEV_FLOW_PET_NATIVE_OUTPUT;
const request = JSON.parse(process.env.DEV_FLOW_PET_NATIVE_REQUEST);
app.setPath("userData", path.join(root, "electron-profile"));
app
  .whenReady()
  .then(async () => {
    const { createDesktop } = require(
      path.join(process.env.DEV_FLOW_PET_APP_ROOT, "main.cjs"),
    );
    const desktop = await createDesktop(request);
    desktop.win.webContents.on("console-message", (_event, level, message) => {
      if (level >= 2) process.stderr.write(message + "\n");
    });
    await new Promise((resolve) => setTimeout(resolve, 700));
    assert.equal(desktop.display.phase, "idle");
    assert.equal(
      await desktop.win.webContents.executeJavaScript(
        'document.querySelector("#character").naturalWidth',
      ),
      256,
    );
    for (const value of [0.5, 0.75, 1, 1.25, 1.5, 2]) {
      await desktop.scale(value);
      assert.equal(desktop.prefs.value.scale, value);
    }
    await desktop.scale(1);
    await desktop.visibility(false);
    assert.equal(desktop.win.isVisible(), false);
    await desktop.visibility(true);
    await desktop.showPicker(1);
    assert.equal(
      await desktop.win.webContents.executeJavaScript(
        'document.querySelector("#picker").hidden',
      ),
      false,
    );
    await desktop.showPicker(0);
    for (const [version, format, factor] of [
      [1, "png", 1],
      [2, "webp", 1],
      [2, "png", 2],
    ]) {
      const source = path.join(root, `atlas-${version}-${format}-${factor}`);
      await fs.mkdir(source, { recursive: true });
      const atlas = await desktop.decoder.webContents.executeJavaScript(
        `(()=>{const c=document.createElement('canvas');c.width=${1536 * factor};c.height=${1872 * factor};const x=c.getContext('2d');for(let row=0;row<9;row++)for(let col=0;col<8;col++){x.fillStyle='hsl('+((row*8+col)*5)+',70%,60%)';x.fillRect(col*${192 * factor},row*${208 * factor},${192 * factor},${208 * factor});}return c.toDataURL('image/${format}').split(',')[1]})()`,
      );
      await fs.writeFile(
        path.join(source, `sheet.${format}`),
        Buffer.from(atlas, "base64"),
      );
      await fs.writeFile(
        path.join(source, "pet.json"),
        JSON.stringify({
          id: `test-${version}-${format}-${factor}`,
          displayName: "Native atlas test",
          spriteVersionNumber: version,
          spritesheetPath: `sheet.${format}`,
        }),
      );
      const imported = await desktop.store.import(source);
      assert.equal(Object.keys(imported.catalog.clips).length, 9);
      assert.equal(
        Object.values(imported.catalog.clips).reduce(
          (n, c) => n + c.frames.length,
          0,
        ),
        57,
      );
      assert.equal(imported.catalog.canvas.width, 192 * factor);
      await desktop.switchAppearance(imported.id, imported);
    }
    await desktop.switchAppearance(null);
    for (const key of [
      "idle",
      "working",
      "blocked",
      "complete",
      "disconnected",
      "running-right",
      "running-left",
      "waving",
      "review",
    ]) {
      await desktop.win.webContents.executeJavaScript(
        `play(${JSON.stringify(key)},{intro:true});`,
      );
      await new Promise((resolve) => setTimeout(resolve, 40));
      assert.equal(
        await desktop.win.webContents.executeJavaScript("current.clip"),
        key,
      );
      assert.equal(
        await desktop.win.webContents.executeJavaScript(
          'document.querySelector("#character").naturalWidth',
        ),
        256,
      );
    }
    await desktop.poll();
    await desktop.win.webContents.executeJavaScript("base()");
    const screenshot = await desktop.win.webContents.capturePage();
    await fs.writeFile(path.join(root, "desktop.png"), screenshot.toPNG());
    await fs.writeFile(
      path.join(root, "native-result.json"),
      JSON.stringify(
        {
          native_window: true,
          default_frames: 312,
          scales: 6,
          hide_restore: true,
          task_picker: true,
          codex_atlases: ["v1-png", "v2-webp", "high-resolution-png"],
          fixture_clip_playback: 9,
          core_status: desktop.display.phase,
        },
        null,
        2,
      ),
    );
    console.log("Windows native desktop checks passed");
    app.quit();
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
