#!/usr/bin/env python3
"""ARC / Iteration8 — System Snapshot Tool (offline, no server)

Usage:
  python3 snapshot.py "/path/to/root" -o system_snapshot.json
Then in the HTML build: click “Import Snapshot JSON”.
"""
from __future__ import annotations
import argparse, os, json, time, hashlib
from typing import List, Dict, Any

def stable_seed_from_files(files: List[Dict[str, Any]]) -> int:
    h = hashlib.sha256()
    for f in sorted(files, key=lambda x: x["path"]):
        h.update((f["path"] + "|" + str(int(f["size"])) + "\n").encode("utf-8"))
    return int.from_bytes(h.digest()[:4], "big", signed=False)

def walk(root: str, include_hidden: bool) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    root = os.path.abspath(root)
    for dirpath, dirnames, filenames in os.walk(root):
        if not include_hidden:
            dirnames[:] = [d for d in dirnames if not d.startswith('.')]
        rel_dir = os.path.relpath(dirpath, root)
        if rel_dir == '.': rel_dir = ''
        for fn in filenames:
            if not include_hidden and fn.startswith('.'): continue
            abs_path = os.path.join(dirpath, fn)
            rel_path = os.path.normpath(os.path.join(rel_dir, fn)).replace('\\','/')
            try:
                st = os.stat(abs_path)
            except OSError:
                continue
            out.append({"path": rel_path, "size": int(st.st_size), "mtime": int(st.st_mtime)})
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('root', help='Root directory to snapshot')
    ap.add_argument('-o','--out', default='system_snapshot.json', help='Output JSON path')
    ap.add_argument('--include-hidden', action='store_true', help='Include dotfiles/hidden dirs')
    args = ap.parse_args()

    files = walk(args.root, include_hidden=args.include_hidden)
    total = sum(f['size'] for f in files)
    seed32 = stable_seed_from_files(files)

    snap = {
        "type": "ARC_SYSTEM_SNAPSHOT",
        "version": 1,
        "generatedAt": int(time.time()),
        "root": os.path.abspath(args.root),
        "totalBytes": int(total),
        "seed32": int(seed32),
        "files": files,
    }
    with open(args.out, 'w', encoding='utf-8') as out:
        json.dump(snap, out, indent=2)
    print(f"Wrote {args.out}  files={len(files)}  totalBytes={total}  seed32={seed32}")

if __name__ == '__main__':
    main()
