const image = document.querySelector("#character");
const bubble = document.querySelector("#bubble");
let state,
  current,
  frame = 0,
  timer,
  cycle = 0,
  activity,
  lastWave = -Infinity,
  randomAt = 0,
  hoverAt = 0,
  hovered = false,
  dragging = false,
  pointer,
  lastChoice,
  terminalAt = 0,
  celebrating = false;
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const command = (name, value) =>
  window.pet.command(name, value).catch((error) => {
    document.querySelector("#detail").textContent = error.message;
  });
function stop() {
  clearTimeout(timer);
  timer = null;
}
function allowed() {
  return (
    state &&
    state.visible &&
    state.preferences.animations_enabled &&
    !reduced.matches &&
    state.preferences.idle_activities_enabled &&
    !state.display.stale &&
    ["idle", "done", "cancelled", "archived"].includes(state.display.phase) &&
    !dragging &&
    !state.picker &&
    !celebrating &&
    Date.now() >= terminalAt
  );
}
function play(clip, { intro = false, rest = false, repeats = null } = {}) {
  stop();
  const catalog = state.appearance.catalog;
  if (!catalog.clips[clip]) clip = clip === "review" ? "working" : "idle";
  const description = catalog.clips[clip];
  if (!description) return;
  current = { clip, description, rest, repeats };
  cycle = 0;
  frame =
    rest || !state.preferences.animations_enabled || reduced.matches
      ? description.rest_frame
      : intro || repeats
        ? 0
        : (description.loop_range?.[0] ?? 0);
  step();
}
function step() {
  if (!current || !state.visible) return;
  const c = current.description;
  image.src = state.appearance.frames[c.frames[frame]];
  if (
    current.rest ||
    !state.preferences.animations_enabled ||
    reduced.matches ||
    (c.frames.length === 1 && current.repeats === null)
  )
    return;
  timer = setTimeout(
    () => {
      frame++;
      const end = current.repeats
        ? c.frames.length - 1
        : (c.loop_range?.[1] ?? c.frames.length - 1);
      if (frame > end) {
        if (
          (current.repeats !== null && ++cycle >= current.repeats) ||
          c.loop_range === null
        ) {
          image.src = state.appearance.frames[c.frames[c.rest_frame]];
          stop();
          if (activity) {
            activity = null;
            command("walk", 0);
            base();
          } else if (state.display.phase === "done") {
            celebrating = false;
            terminalAt = Date.now() + 3000;
            current.rest = true;
          }
          return;
        }
        frame = current.repeats ? 0 : c.loop_range[0];
      }
      step();
    },
    c.frame_durations_ms?.[frame] ?? 1000 / c.fps,
  );
}
function base() {
  celebrating =
    state.display.phase === "done" &&
    state.display.prompt &&
    state.preferences.animations_enabled &&
    !reduced.matches;
  play(state.display.clip, {
    intro: state.display.prompt,
    rest: state.display.rest,
  });
}
function cancelActivity() {
  activity = null;
  randomAt = 0;
  hoverAt = 0;
  command("walk", 0);
}
function wave() {
  if (
    !allowed() ||
    Date.now() - lastWave < 20000 ||
    !state.appearance.catalog.clips.waving
  )
    return;
  lastWave = Date.now();
  activity = "waving";
  lastChoice = activity;
  play(activity, { repeats: Math.random() < 0.5 ? 1 : 2 });
}
setInterval(() => {
  if (!allowed()) {
    randomAt = 0;
    return;
  }
  if (hoverAt && Date.now() >= hoverAt) {
    hoverAt = 0;
    wave();
  }
  if (activity || hovered) return;
  if (!randomAt) {
    randomAt = Date.now() + 6000 + Math.random() * 6000;
    return;
  }
  if (Date.now() < randomAt) return;
  randomAt = 0;
  let choices = [
    ["running-right", 25],
    ["running-left", 25],
    ["waving", 20],
    ["review", 30],
  ].filter(
    ([k]) =>
      state.appearance.catalog.clips[k] &&
      (k !== "waving" || Date.now() - lastWave >= 20000),
  );
  if (choices.length > 1) choices = choices.filter(([k]) => k !== lastChoice);
  let n = Math.random() * choices.reduce((sum, [, w]) => sum + w, 0);
  const choice = choices.find(([, w]) => (n -= w) < 0)?.[0];
  if (!choice) return;
  if (choice === "waving") {
    wave();
    return;
  }
  activity = choice;
  lastChoice = choice;
  if (choice === "review") {
    const c = state.appearance.catalog.clips[choice],
      duration = c.frames.reduce(
        (total, _, i) => total + (c.frame_durations_ms?.[i] ?? 1000 / c.fps),
        0,
      );
    play(choice, {
      repeats: Math.max(1, Math.ceil((3000 + Math.random() * 2000) / duration)),
    });
  } else {
    play(choice);
    const direction = choice === "running-right" ? 1 : -1;
    command("walk", direction);
  }
}, 100);
window.pet.onState((next) => {
  next = { ...next, appearance: next.appearance ?? state?.appearance };
  const newlyVisible = !state || (!state.visible && next.visible);
  const changed =
    !state ||
    next.appearance.id !== state.appearance.id ||
    next.appearance.serial !== state.appearance.serial ||
    next.display.phase !== state.display.phase ||
    next.display.summary?.task_id !== state.display.summary?.task_id ||
    next.display.clip !== state.display.clip ||
    next.display.prompt ||
    next.visible !== state.visible ||
    next.preferences.animations_enabled !==
      state.preferences.animations_enabled ||
    next.preferences.idle_activities_enabled !==
      state.preferences.idle_activities_enabled ||
    Boolean(next.picker) !== Boolean(state.picker);
  state = next;
  const { canvas } = state.appearance.catalog;
  const factor =
    (144 * state.preferences.scale) / Math.max(canvas.width, canvas.height);
  image.style.width = canvas.width * factor + "px";
  image.style.height = canvas.height * factor + "px";
  image.style.top =
    110 + (144 * state.preferences.scale - canvas.height * factor) / 2 + "px";
  document.querySelector("#phase").textContent =
    state.display.summary?.request_summary ?? state.labels.selectTask;
  document.querySelector("#summary").textContent = [
    state.labels[state.display.phase] ?? state.display.phase,
    state.display.summary?.current_node,
    state.display.readiness === "read_only" ? state.labels.readOnly : null,
  ]
    .filter(Boolean)
    .join(" · ");
  document.querySelector("#detail").textContent =
    state.warning ||
    [
      state.display.stale
        ? state.labels.stale
        : state.display.summary?.origin_host,
      state.display.summary?.current_node,
      state.display.summary?.blocker,
      state.display.summary?.request_summary,
      state.display.summary?.updated_at
        ? state.labels.updated +
          ": " +
          new Date(state.display.summary.updated_at).toLocaleString()
        : null,
      state.lastSyncAt
        ? state.labels.lastSync +
          ": " +
          new Date(state.lastSyncAt).toLocaleString()
        : null,
    ]
      .filter(Boolean)
      .join("\n");
  if (changed) {
    cancelActivity();
    terminalAt = ["done", "cancelled", "archived"].includes(state.display.phase)
      ? Date.now() + 3000
      : 0;
    base();
  }
  if (!state.visible) stop();
  if (newlyVisible) {
    setTimeout(wave, ["done", "cancelled", "archived"].includes(state.display.phase) ? 3050 : 0);
  }
  const picker = document.querySelector("#picker");
  picker.hidden = !state.picker;
  if (state.picker) {
    document.querySelector("#pickerTitle").textContent =
      state.labels.selectTask;
    const items = document.querySelector("#items");
    items.replaceChildren();
    const none = document.createElement("button");
    none.textContent = state.labels.noSelection;
    none.onclick = () => command("select", null);
    items.append(none);
    for (const task of state.picker.items) {
      const button = document.createElement("button");
      button.textContent = task.request_summary;
      const detail = document.createElement("small");
      detail.textContent = [
        task.lifecycle,
        task.current_node,
        task.origin_host,
        task.worktree_path,
      ].join(" · ");
      button.append(detail);
      button.onclick = () => command("select", task.task_id);
      items.append(button);
    }
    document.querySelector("#page").textContent = state.picker.page;
    document.querySelector("#previous").disabled = state.picker.page <= 1;
    document.querySelector("#next").disabled = !state.picker.has_next;
  }
});
document.querySelector("#close").onclick = () => command("picker", 0);
document.querySelector("#previous").onclick = () =>
  command("picker", state.picker.page - 1);
document.querySelector("#next").onclick = () =>
  command("picker", state.picker.page + 1);
image.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  command("menu");
});
bubble.onclick = () => command("open");
document.body.onmouseenter = () => {
  hovered = true;
  document.body.classList.add("hover");
  if (activity && activity !== "waving") {
    cancelActivity();
    base();
  }
};
document.body.onmouseleave = () => {
  hovered = false;
  hoverAt = 0;
  document.body.classList.remove("hover");
};
image.onmouseenter = () => {
  hoverAt = Date.now() + 400;
};
image.onmouseleave = () => {
  hoverAt = 0;
};
image.onpointerdown = (e) => {
  if (e.button !== 0) return;
  pointer = { x: e.screenX, y: e.screenY };
  image.setPointerCapture(e.pointerId);
};
image.onpointermove = (e) => {
  if (!pointer) return;
  if (
    !dragging &&
    Math.hypot(e.screenX - pointer.x, e.screenY - pointer.y) > 4
  ) {
    dragging = true;
    cancelActivity();
    stop();
    command("drag", "start");
  }
  if (dragging) command("drag", "move");
};
image.onpointerup = () => {
  if (!pointer) return;
  pointer = null;
  if (dragging) {
    dragging = false;
    command("drag", "end");
    base();
  } else command("open");
};
reduced.onchange = () => {
  if (state) {
    cancelActivity();
    base();
  }
};
window.pet.onWalkComplete(() => {
  activity = null;
  command("walk", 0);
  base();
});
let hit = true;
document.addEventListener("mousemove", (event) => {
  const next = Boolean(event.target.closest("#character, #bubble, #picker"));
  if (next !== hit) {
    hit = next;
    command("hit", hit);
  }
});
window.pet.ready();
