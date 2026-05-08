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

export class WorldCanvas {
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
