#!/usr/bin/env python3
"""Assemble the course submission folder from one commit.

    python3 -I scripts/midterm/package_submission.py --dest <course repo root> [--rev HEAD] [--replace]
    python3 -I scripts/midterm/package_submission.py --list [--rev HEAD]

Writes exactly two things under --dest:
  midterms/saadsatter/                         the project, per midterms/saadsatter/MANIFEST.txt
  .github/workflows/midterm-saadsatter.yml     from midterms/saadsatter/ci/

Content comes from the commit (git objects), never from the working tree, so
other sessions' uncommitted edits are never packaged. The staging files in
midterms/saadsatter/ are laid over the copy: README.md replaces the
repository README, which is kept as GAME_README.md.
"""
import argparse, fnmatch, os, subprocess, sys

LOGIN = "saadsatter"
STAGE = f"midterms/{LOGIN}/"
WORKFLOW_SRC = f"{STAGE}ci/midterm-{LOGIN}.yml"
WORKFLOW_DST = f".github/workflows/midterm-{LOGIN}.yml"
LARGE = 5 * 1024 * 1024


def git(*args, inp=None):
    return subprocess.run(["git", *args], input=inp, capture_output=True, check=True).stdout


def tree(rev):
    out = git("ls-tree", "-r", "-z", "--full-tree", rev)
    files = {}
    for rec in out.split(b"\0"):
        if not rec:
            continue
        meta, path = rec.split(b"\t", 1)
        mode, kind, sha = meta.decode().split()
        if kind == "blob":
            files[path.decode()] = (mode, sha)
    return files


def rules(text):
    out = []
    for line in text.splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            out.append((not line.startswith("!"), line.lstrip("!")))
    return out


def selected(path, rs):
    keep = False
    for include, pattern in rs:
        if fnmatch.fnmatchcase(path, pattern):
            keep = include
    return keep


def plan(rev):
    files = tree(rev)
    if f"{STAGE}MANIFEST.txt" not in files:
        sys.exit(f"{STAGE}MANIFEST.txt is not in {rev}: commit the staging folder first.")
    rs = rules(git("show", f"{rev}:{STAGE}MANIFEST.txt").decode())
    out = {}  # destination (relative to --dest) -> (mode, sha, source)
    for path, (mode, sha) in files.items():
        if path.startswith("midterms/") or not selected(path, rs):
            continue
        name = "GAME_README.md" if path == "README.md" else path
        out[STAGE + name] = (mode, sha, path)
    for path, (mode, sha) in files.items():
        if not path.startswith(STAGE) or path == f"{STAGE}MANIFEST.txt":
            continue
        if path == WORKFLOW_SRC:
            out[WORKFLOW_DST] = (mode, sha, path)
        elif not path.startswith(f"{STAGE}ci/"):
            out[path] = (mode, sha, path)
    out[f"{STAGE}MANIFEST.txt"] = (*files[f"{STAGE}MANIFEST.txt"], f"{STAGE}MANIFEST.txt")
    if WORKFLOW_DST not in out:
        sys.exit(f"{WORKFLOW_SRC} is not in {rev}.")
    return out


def boundary_ok(paths):
    bad = [p for p in paths if not (p.startswith(STAGE) or p == WORKFLOW_DST)]
    return bad


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rev", default="HEAD")
    ap.add_argument("--dest")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--replace", action="store_true", help="remove an existing midterms/saadsatter/ first")
    a = ap.parse_args()
    rev = git("rev-parse", a.rev).decode().strip()
    files = plan(rev)
    bad = boundary_ok(files)
    if bad:
        sys.exit(f"Outside the course boundary: {bad[:5]}")
    sizes = {}
    for dst, (_, sha, _) in files.items():
        sizes[dst] = int(git("cat-file", "-s", sha).decode())
    total = sum(sizes.values())
    large = sorted((s, d) for d, s in sizes.items() if s > LARGE)
    print(f"commit {rev}: {len(files)} files, {total / 1048576:.1f} MB")
    for s, d in large:
        print(f"  large file ({s / 1048576:.1f} MB): {d}")
    if a.list:
        for d in sorted(files):
            print(d)
        return
    if not a.dest:
        sys.exit("--dest or --list is required.")
    root = os.path.abspath(a.dest)
    target = os.path.join(root, STAGE)
    if os.path.exists(target) and os.listdir(target):
        if not a.replace:
            sys.exit(f"{target} is not empty; pass --replace to rebuild it.")
        subprocess.run(["rm", "-rf", target], check=True)
    for dst, (mode, sha, _) in sorted(files.items()):
        out = os.path.join(root, dst)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with open(out, "wb") as f:
            f.write(git("cat-file", "blob", sha))
        if mode == "100755":
            os.chmod(out, 0o755)
    with open(os.path.join(target, "SUBMITTED_COMMIT.txt"), "w") as f:
        f.write(f"Packaged from SaadSatter/oath_and_ember commit {rev}\n")
    print(f"wrote {root}/{STAGE} and {root}/{WORKFLOW_DST}")


if __name__ == "__main__":
    main()
