import { fileSystem, missions } from "./content/world.js";
import { ShellGame } from "./simulation/shell.js";
import { WorldCanvas } from "./rendering/worldCanvas.js";

const game = new ShellGame(fileSystem, missions);
const world = new WorldCanvas(document.querySelector("#world"));

const output = document.querySelector("#terminalOutput");
const form = document.querySelector("#commandForm");
const input = document.querySelector("#commandInput");
const promptPath = document.querySelector("#promptPath");
const pathStatus = document.querySelector("#pathStatus");
const missionCount = document.querySelector("#missionCount");
const missionTitle = document.querySelector("#missionTitle");
const missionBrief = document.querySelector("#missionBrief");
const objectives = document.querySelector("#objectives");
const score = document.querySelector("#score");

let historyIndex = 0;

write("hint", "Welcome. Type help if you want the command list.");
sync();
requestAnimationFrame(tick);

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const command = input.value;
  if (!command.trim()) {
    return;
  }

  write("command", `${game.prompt} $ ${command}`);
  const result = game.execute(command);
  input.value = "";
  historyIndex = game.history.length;

  if (result.kind === "clear") {
    output.innerHTML = "";
  } else {
    for (const line of result.lines) {
      write(result.kind, line);
    }
  }

  sync();
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Tab") {
    event.preventDefault();
    const completion = game.completeInput(input.value, input.selectionStart ?? input.value.length);
    input.value = completion.value;
    input.setSelectionRange(completion.cursor, completion.cursor);

    if (!completion.changed && completion.matches.length > 1) {
      write("hint", completion.matches.join("  "));
    }
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    historyIndex = Math.max(0, historyIndex - 1);
    input.value = game.history[historyIndex] ?? "";
    input.setSelectionRange(input.value.length, input.value.length);
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    historyIndex = Math.min(game.history.length, historyIndex + 1);
    input.value = game.history[historyIndex] ?? "";
    input.setSelectionRange(input.value.length, input.value.length);
  }
});

document.addEventListener("click", () => input.focus());

function sync() {
  const snapshot = game.snapshot();
  promptPath.textContent = snapshot.cwd;
  pathStatus.textContent = snapshot.cwd;
  missionCount.textContent = `Mission ${snapshot.missionIndex + 1} of ${missions.length}`;
  missionTitle.textContent = snapshot.mission.title;
  missionBrief.textContent = snapshot.mission.brief;
  score.textContent = `${snapshot.score} pts`;
  objectives.innerHTML = "";

  for (const objective of snapshot.mission.objectives) {
    const item = document.createElement("div");
    item.className = `objective ${snapshot.completed.has(objective.id) ? "done" : ""}`;
    item.textContent = objective.text;
    objectives.append(item);
  }

  world.render(snapshot);
}

function write(kind, line) {
  const row = document.createElement("div");
  row.className = `terminal-row ${kind}`;
  row.textContent = line;
  output.append(row);
  output.scrollTop = output.scrollHeight;
}

function tick() {
  world.render(game.snapshot());
  requestAnimationFrame(tick);
}
