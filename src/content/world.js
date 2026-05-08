export const fileSystem = {
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

export const missions = [
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
