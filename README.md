# Pathfinder Shell

A browser prototype for teaching Linux command-line navigation through a small game world. The filesystem is the map, and students complete missions by using shell-like commands carefully.

## Play

Open `index.html` in a browser. You can also serve this folder with any static web server, then open the local URL.

```bash
python3 -m http.server 5173
```

The first command sequence to try:

```bash
pwd
ls
cd notes
cat todo.txt
cd ../labs/raw
cp measurements.csv ../final/
ls ../final
```

## Current Commands

- `help`
- `pwd`
- `ls`
- `ls -a`
- `cd <path>`
- `cat <file>`
- `cp <source> <destination>`
- `clear`

## Teaching Focus

- Current working directory
- Relative and absolute paths
- Reading before acting
- Verifying destination paths after copy operations
- Hidden files with `ls -a`
