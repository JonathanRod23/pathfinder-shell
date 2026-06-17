// Bundled browser build for opening index.html directly.

// src/content/world.js
const fileSystem = {
  type: "dir",
  name: "",
  children: {
    home: {
      type: "dir",
      children: {
        student: {
          type: "dir",
          children: {
            labs: {
              type: "dir",
              children: {
                raw: {
                  type: "dir",
                  children: {
                    "measurements.csv": {
                      type: "file",
                      content: "sample,reading\nA,14.2\nB,15.1\nC,13.8",
                    },
                  },
                },
                final: {
                  type: "dir",
                  children: {},
                },
              },
            },
            notes: {
              type: "dir",
              children: {
                "todo.txt": {
                  type: "file",
                  content:
                    "1. Check where you are with pwd.\n2. Use ls before cd.\n3. Copy measurements.csv into labs/final.",
                },
                ".hint": {
                  type: "file",
                  content: "Hidden files appear with ls -a.",
                },
              },
            },
            scripts: {
              type: "dir",
              children: {
                "analyze.sh": {
                  type: "file",
                  content: "#!/bin/bash\ncat ../labs/final/measurements.csv",
                },
              },
            },
          },
        },
      },
    },
    tmp: {
      type: "dir",
      children: {
        "scratch.txt": {
          type: "file",
          content: "Temporary work belongs here, but final answers do not.",
        },
      },
    },
    etc: {
      type: "dir",
      children: {
        "motd": {
          type: "file",
          content: "Welcome to Pathfinder Shell.",
        },
      },
    },
    var: {
      type: "dir",
      children: {
        log: {
          type: "dir",
          children: {
            "system.log": {
              type: "file",
              content: "path error: expected /home/student/labs/final/measurements.csv",
            },
          },
        },
      },
    },
  },
};

const missions = [
  {
    title: "Get Your Bearings",
    brief: "Find the lab instructions without guessing. Use pwd, ls, cd, and cat to inspect the notes directory.",
    objectives: [
      { id: "pwd", text: "Run pwd to confirm your current directory." },
      { id: "ls-home", text: "Run ls in /home/student." },
      { id: "read-todo", text: "Read /home/student/notes/todo.txt." },
    ],
  },
  {
    title: "Deliver the Dataset",
    brief:
      "The analysis script expects measurements.csv inside labs/final. Copy it there using a correct path.",
    objectives: [
      { id: "visit-raw", text: "Navigate to /home/student/labs/raw." },
      { id: "copy-data", text: "Copy measurements.csv into /home/student/labs/final/." },
      { id: "verify-copy", text: "List /home/student/labs/final and verify the file arrived." },
    ],
  },
  {
    title: "Trust, Then Verify",
    brief:
      "A log file names the path the script expects. Inspect it, then read the copied dataset from its final location.",
    objectives: [
      { id: "read-log", text: "Read /var/log/system.log." },
      { id: "read-final", text: "Read /home/student/labs/final/measurements.csv." },
      { id: "hidden", text: "Use ls -a in /home/student/notes to reveal the hidden hint." },
    ],
  },
];


// src/simulation/shell.js
const cloneNode = (node) => {
  if (node.type === "file") {
    return { ...node };
  }

  return {
    type: "dir",
    children: Object.fromEntries(
      Object.entries(node.children).map(([name, child]) => [name, cloneNode(child)]),
    ),
  };
};

const basename = (path) => path.split("/").filter(Boolean).at(-1) ?? "";
const commands = ["cat", "cd", "clear", "cp", "help", "ls", "pwd"];

class ShellGame {
  constructor(fileSystem, missions) {
    this.root = cloneNode(fileSystem);
    this.cwd = ["home", "student"];
    this.missions = missions;
    this.missionIndex = 0;
    this.completed = new Set();
    this.score = 0;
    this.history = [];
  }

  get currentMission() {
    return this.missions[this.missionIndex];
  }

  get prompt() {
    return this.pathToString(this.cwd);
  }

  pathToString(parts) {
    return `/${parts.join("/")}`;
  }

  execute(rawInput) {
    const input = rawInput.trim();
    if (!input) {
      return { kind: "info", lines: [] };
    }

    this.history.push(input);
    const args = tokenize(input);
    const command = args[0];

    switch (command) {
      case "help":
        return this.help();
      case "pwd":
        this.complete("pwd");
        return { kind: "info", lines: [this.prompt] };
      case "ls":
        return this.ls(args.slice(1));
      case "cd":
        return this.cd(args[1]);
      case "cat":
        return this.cat(args[1]);
      case "cp":
        return this.cp(args[1], args[2]);
      case "clear":
        return { kind: "clear", lines: [] };
      default:
        return {
          kind: "error",
          lines: [`${command}: command not found. Try help.`],
        };
    }
  }

  help() {
    return {
      kind: "hint",
      lines: [
        "Commands: pwd, ls, ls -a, cd <path>, cat <file>, cp <source> <destination>, clear",
        "Paths can be absolute (/home/student/labs) or relative (../notes).",
        "Press Tab to autocomplete commands and paths.",
      ],
    };
  }

  completeInput(rawInput, cursorIndex = rawInput.length) {
    const bounds = findTokenBounds(rawInput, cursorIndex);
    const token = rawInput.slice(bounds.start, cursorIndex);
    const command = tokenize(rawInput)[0] ?? "";
    const isCommandToken = bounds.start === 0 && !rawInput.slice(0, bounds.start).trim();
    const matches = isCommandToken
      ? completeCommand(token)
      : this.completePath(token, command, rawInput, bounds.start);

    if (matches.length === 0) {
      return { value: rawInput, cursor: cursorIndex, matches: [], changed: false };
    }

    const common = commonPrefix(matches);
    const completion = matches.length === 1 ? matches[0] : common;

    if (!completion || completion === token) {
      return { value: rawInput, cursor: cursorIndex, matches, changed: false };
    }

    const suffix = matches.length === 1 && !completion.endsWith("/") ? " " : "";
    const value =
      rawInput.slice(0, bounds.start) + completion + suffix + rawInput.slice(bounds.end);
    const cursor = bounds.start + completion.length + suffix.length;
    return { value, cursor, matches, changed: true };
  }

  completePath(token, command, rawInput, tokenStart) {
    const slashIndex = token.lastIndexOf("/");
    const directoryPart = slashIndex >= 0 ? token.slice(0, slashIndex + 1) : "";
    const partial = slashIndex >= 0 ? token.slice(slashIndex + 1) : token;
    const parentExpression = directoryPart || ".";
    const parent = this.resolve(parentExpression);

    if (!parent.node || parent.node.type !== "dir") {
      return [];
    }

    const argsBeforeToken = tokenize(rawInput.slice(0, tokenStart));
    const commandName = argsBeforeToken[0] ?? command;
    const wantsDirectory = commandName === "cd";
    const includeHidden = partial.startsWith(".");

    return Object.entries(parent.node.children)
      .filter(([name]) => includeHidden || !name.startsWith("."))
      .filter(([, node]) => !wantsDirectory || node.type === "dir")
      .filter(([name]) => name.startsWith(partial))
      .map(([name, node]) => `${directoryPart}${name}${node.type === "dir" ? "/" : ""}`)
      .sort((a, b) => a.localeCompare(b));
  }

  ls(args) {
    const showHidden = args.includes("-a");
    const pathArg = args.find((arg) => arg !== "-a");
    const target = this.resolve(pathArg ?? ".");

    if (!target.node) {
      return { kind: "error", lines: [`ls: cannot access '${pathArg}': No such file or directory`] };
    }

    if (target.node.type === "file") {
      return { kind: "info", lines: [basename(this.pathToString(target.parts))] };
    }

    const entries = Object.entries(target.node.children)
      .filter(([name]) => showHidden || !name.startsWith("."))
      .map(([name, node]) => (node.type === "dir" ? `${name}/` : name))
      .sort((a, b) => a.localeCompare(b));

    if (this.prompt === "/home/student" && !pathArg) {
      this.complete("ls-home");
    }

    if (this.pathToString(target.parts) === "/home/student/labs/final") {
      this.complete("verify-copy");
    }

    if (this.pathToString(target.parts) === "/home/student/notes" && showHidden) {
      this.complete("hidden");
    }

    return { kind: "info", lines: [entries.join("  ") || "(empty)"] };
  }

  cd(pathArg) {
    if (!pathArg) {
      this.cwd = ["home", "student"];
      return { kind: "success", lines: [this.prompt] };
    }

    const target = this.resolve(pathArg);
    if (!target.node) {
      return { kind: "error", lines: [`cd: ${pathArg}: No such file or directory`] };
    }

    if (target.node.type !== "dir") {
      return { kind: "error", lines: [`cd: ${pathArg}: Not a directory`] };
    }

    this.cwd = target.parts;
    if (this.prompt === "/home/student/labs/raw") {
      this.complete("visit-raw");
    }

    return { kind: "success", lines: [this.prompt] };
  }

  cat(pathArg) {
    if (!pathArg) {
      return { kind: "error", lines: ["cat: missing file operand"] };
    }

    const target = this.resolve(pathArg);
    if (!target.node) {
      return { kind: "error", lines: [`cat: ${pathArg}: No such file or directory`] };
    }

    if (target.node.type !== "file") {
      return { kind: "error", lines: [`cat: ${pathArg}: Is a directory`] };
    }

    const path = this.pathToString(target.parts);
    if (path === "/home/student/notes/todo.txt") {
      this.complete("read-todo");
    }
    if (path === "/var/log/system.log") {
      this.complete("read-log");
    }
    if (path === "/home/student/labs/final/measurements.csv") {
      this.complete("read-final");
    }

    return { kind: "info", lines: target.node.content.split("\n") };
  }

  cp(sourceArg, destinationArg) {
    if (!sourceArg || !destinationArg) {
      return { kind: "error", lines: ["cp: missing source or destination"] };
    }

    const source = this.resolve(sourceArg);
    if (!source.node) {
      return { kind: "error", lines: [`cp: cannot stat '${sourceArg}': No such file or directory`] };
    }

    if (source.node.type !== "file") {
      return { kind: "error", lines: ["cp: prototype only supports copying files"] };
    }

    const destination = this.resolveForWrite(destinationArg, basename(sourceArg));
    if (!destination.parent) {
      return { kind: "error", lines: [`cp: cannot create '${destinationArg}': Bad path`] };
    }

    destination.parent.children[destination.name] = cloneNode(source.node);
    const finalPath = this.pathToString([...destination.parentParts, destination.name]);
    if (finalPath === "/home/student/labs/final/measurements.csv") {
      this.complete("copy-data");
    }

    return {
      kind: "success",
      lines: [`copied ${this.pathToString(source.parts)} -> ${finalPath}`],
    };
  }

  resolve(pathArg) {
    const parts = this.normalize(pathArg);
    let node = this.root;

    for (const part of parts) {
      if (node.type !== "dir" || !node.children[part]) {
        return { node: null, parts };
      }
      node = node.children[part];
    }

    return { node, parts };
  }

  resolveForWrite(pathArg, fallbackName) {
    const target = this.resolve(pathArg);
    if (target.node?.type === "dir") {
      return {
        parent: target.node,
        parentParts: target.parts,
        name: fallbackName,
      };
    }

    const parts = this.normalize(pathArg);
    const name = parts.at(-1) ?? fallbackName;
    const parentParts = parts.slice(0, -1);
    const parent = this.getNode(parentParts);

    if (!parent || parent.type !== "dir") {
      return { parent: null, parentParts, name };
    }

    return { parent, parentParts, name };
  }

  getNode(parts) {
    let node = this.root;
    for (const part of parts) {
      if (node.type !== "dir") {
        return null;
      }
      node = node.children[part];
      if (!node) {
        return null;
      }
    }
    return node;
  }

  normalize(pathArg = ".") {
    const base = pathArg.startsWith("/") ? [] : [...this.cwd];
    for (const part of pathArg.split("/")) {
      if (!part || part === ".") {
        continue;
      }
      if (part === "..") {
        base.pop();
      } else {
        base.push(part);
      }
    }
    return base;
  }

  complete(id) {
    if (this.completed.has(id)) {
      return;
    }

    this.completed.add(id);
    this.score += 10;

    const missionDone = this.currentMission.objectives.every((objective) =>
      this.completed.has(objective.id),
    );

    if (missionDone && this.missionIndex < this.missions.length - 1) {
      this.missionIndex += 1;
    }
  }

  snapshot() {
    return {
      cwd: this.prompt,
      missionIndex: this.missionIndex,
      mission: this.currentMission,
      completed: new Set(this.completed),
      score: this.score,
      tree: this.root,
    };
  }
}

function tokenize(input) {
  const matches = input.match(/"[^"]+"|'[^']+'|\S+/g) ?? [];
  return matches.map((part) => part.replace(/^['"]|['"]$/g, ""));
}

function completeCommand(token) {
  return commands.filter((command) => command.startsWith(token));
}

function commonPrefix(values) {
  if (values.length === 0) {
    return "";
  }

  let prefix = values[0];
  for (const value of values.slice(1)) {
    while (!value.startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
    }
  }
  return prefix;
}

function findTokenBounds(input, cursorIndex) {
  let start = cursorIndex;
  while (start > 0 && !/\s/.test(input[start - 1])) {
    start -= 1;
  }

  let end = cursorIndex;
  while (end < input.length && !/\s/.test(input[end])) {
    end += 1;
  }

  return { start, end };
}


// src/rendering/worldCanvas.js
const positions = {
  "/": [0.5, 0.12],
  "/home": [0.25, 0.28],
  "/tmp": [0.5, 0.28],
  "/etc": [0.68, 0.28],
  "/var": [0.84, 0.28],
  "/home/student": [0.25, 0.45],
  "/home/student/labs": [0.12, 0.62],
  "/home/student/notes": [0.25, 0.62],
  "/home/student/scripts": [0.38, 0.62],
  "/home/student/labs/raw": [0.09, 0.8],
  "/home/student/labs/final": [0.22, 0.8],
  "/var/log": [0.84, 0.45],
};

const labels = {
  "/": "/",
  "/home": "home",
  "/tmp": "tmp",
  "/etc": "etc",
  "/var": "var",
  "/home/student": "student",
  "/home/student/labs": "labs",
  "/home/student/notes": "notes",
  "/home/student/scripts": "scripts",
  "/home/student/labs/raw": "raw",
  "/home/student/labs/final": "final",
  "/var/log": "log",
};

const edges = [
  ["/", "/home"],
  ["/", "/tmp"],
  ["/", "/etc"],
  ["/", "/var"],
  ["/home", "/home/student"],
  ["/home/student", "/home/student/labs"],
  ["/home/student", "/home/student/notes"],
  ["/home/student", "/home/student/scripts"],
  ["/home/student/labs", "/home/student/labs/raw"],
  ["/home/student/labs", "/home/student/labs/final"],
  ["/var", "/var/log"],
];

class WorldCanvas {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.time = 0;
    this.snapshot = null;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(640, Math.floor(rect.width * scale));
    this.canvas.height = Math.max(420, Math.floor(rect.height * scale));
  }

  render(snapshot) {
    this.snapshot = snapshot;
    this.time += 0.03;
    const ctx = this.ctx;
    const { width, height } = this.canvas;
    ctx.clearRect(0, 0, width, height);

    this.drawGrid(ctx, width, height);

    for (const [from, to] of edges) {
      this.drawEdge(ctx, from, to, width, height);
    }

    for (const path of Object.keys(positions)) {
      this.drawNode(ctx, path, width, height, snapshot);
    }

    this.drawLegend(ctx, width, height);
  }

  drawGrid(ctx, width, height) {
    ctx.fillStyle = "#151b20";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(115, 210, 222, 0.08)";
    ctx.lineWidth = 1;
    const step = 42 * (window.devicePixelRatio || 1);
    for (let x = 0; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  drawEdge(ctx, from, to, width, height) {
    const [x1, y1] = this.point(from, width, height);
    const [x2, y2] = this.point(to, width, height);
    ctx.strokeStyle = "rgba(174, 184, 176, 0.32)";
    ctx.lineWidth = 3 * (window.devicePixelRatio || 1);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  drawNode(ctx, path, width, height, snapshot) {
    const [x, y] = this.point(path, width, height);
    const scale = window.devicePixelRatio || 1;
    const isCurrent = snapshot.cwd === path;
    const hasCopiedFile =
      path === "/home/student/labs/final" &&
      Boolean(snapshot.tree.children.home.children.student.children.labs.children.final.children[
        "measurements.csv"
      ]);
    const radius = (isCurrent ? 28 : 22) * scale;

    ctx.fillStyle = hasCopiedFile ? "#2f6f4e" : "#20282e";
    ctx.strokeStyle = isCurrent ? "#7de08f" : hasCopiedFile ? "#7de08f" : "#73d2de";
    ctx.lineWidth = (isCurrent ? 4 : 2) * scale;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (isCurrent) {
      ctx.strokeStyle = `rgba(125, 224, 143, ${0.38 + Math.sin(this.time * 2) * 0.12})`;
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.arc(x, y, radius + 11 * scale, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = "#f1f5f0";
    ctx.font = `${14 * scale}px SFMono-Regular, Consolas, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(labels[path], x, y + radius + 8 * scale);
  }

  drawLegend(ctx, width, height) {
    const scale = window.devicePixelRatio || 1;
    const x = 22 * scale;
    const y = height - 78 * scale;
    ctx.fillStyle = "rgba(17, 23, 27, 0.86)";
    ctx.fillRect(x - 10 * scale, y - 12 * scale, 330 * scale, 60 * scale);
    ctx.fillStyle = "#aeb8b0";
    ctx.font = `${13 * scale}px SFMono-Regular, Consolas, monospace`;
    ctx.textAlign = "left";
    ctx.fillText("Type commands in the terminal to move through the map.", x, y);
    ctx.fillStyle = "#ffd166";
    ctx.fillText("Start with: pwd, ls, cd notes, cat todo.txt", x, y + 24 * scale);
  }

  point(path, width, height) {
    const [x, y] = positions[path];
    return [x * width, y * height];
  }
}


// src/app.js

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

