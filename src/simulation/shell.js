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

export class ShellGame {
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
