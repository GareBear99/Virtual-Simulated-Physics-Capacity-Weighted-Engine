
ITERATION8 + ARC (NO SERVER) v4 — TRON GRID + FILESYSTEM TILES (file:// compatible)

Open:
- iteration8/index.html
(or OPEN_ME.html)

New:
- TRON GRID overlay (cube net heatmap) showing filesystem capacity mapped into tiles
- Import Folder → Tiles (works on file:// using <input webkitdirectory>)
- ARC receives filesystem signals:
    - entity: file:<relative_path>
    - entity: tile:<face>:<i>:<j>
- ARC decisions broadcast to overlay highlighting targets

Controls:
- H toggles ARC panel
- G toggles TRON GRID overlay

Usage:
1) Open index.html (file://)
2) Press G (if needed) to show TRON overlay
3) Click "Import Folder → Tiles" and select a folder
4) Watch heatmap + top tiles; ARC will begin seeing signals

Feed signals manually:
- ARC_FEED("file:some/path.txt","fs",12)
