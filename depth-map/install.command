#!/bin/bash
# Depth Map setup for macOS: double-click this file (first time: right-click > Open).
# Creates backend/.venv, downloads the pinned model code and Small checkpoints, verifies them.
# Safe to run again: finished steps are skipped. Nothing outside this folder is changed.
set -euo pipefail
cd "$(dirname "$0")"

DAV2_COMMIT="a561b849ebae10a6f5ef49e26c83cbbcd36c71bf"
VDA_COMMIT="4f5ae23172ba60fd7bc11ef671cca678842c7072"
DAV2_WEIGHTS="https://huggingface.co/depth-anything/Depth-Anything-V2-Small/resolve/03876f8651c73a60fe4c2c48294e09fcb6838fcf/depth_anything_v2_vits.pth"
VDA_WEIGHTS="https://huggingface.co/depth-anything/Video-Depth-Anything-Small/resolve/256875362cff76724b920335dfb4b29dd611f66e/video_depth_anything_vits.pth"

finish() {
    echo
    echo "$1"
    if [ -t 0 ]; then read -r -n 1 -p "Press any key to close this window." || true; echo; fi
}
fail() { finish "SETUP STOPPED: $1"; exit 1; }
step() { echo; echo "==> $1"; }

step "Looking for Python 3.12"
PYTHON=""
for candidate in python3.12 /opt/homebrew/bin/python3.12 /usr/local/bin/python3.12 /Library/Frameworks/Python.framework/Versions/3.12/bin/python3.12; do
    if command -v "$candidate" >/dev/null 2>&1; then PYTHON="$(command -v "$candidate")"; break; fi
done
[ -n "$PYTHON" ] || fail "Python 3.12 was not found. Install it from https://www.python.org/downloads/ (macOS installer, version 3.12), then run this file again."
echo "Using $PYTHON"

step "Python environment (backend/.venv)"
if [ -x backend/.venv/bin/python ]; then
    echo "Already there."
else
    "$PYTHON" -m venv backend/.venv || fail "Could not create the Python environment."
fi
backend/.venv/bin/python -m pip install --quiet --upgrade pip || fail "Could not update pip (check the internet connection)."
echo "Installing libraries (the first time downloads about 1 GB)..."
backend/.venv/bin/python -m pip install --quiet -r backend/requirements.txt || fail "Could not install the libraries (check the internet connection)."

# Downloads a GitHub repository at a fixed commit, without needing git.
fetch_repo() {
    local repo="$1" commit="$2" target="backend/vendor/$3"
    if [ -d "$target" ]; then echo "$3: already there."; return; fi
    mkdir -p "$target.part"
    curl --fail --location --silent --show-error "https://github.com/$repo/archive/$commit.tar.gz" \
        | tar -xz -C "$target.part" --strip-components=1 || { rm -rf "$target.part"; fail "Could not download $repo."; }
    mv "$target.part" "$target"
    echo "$3: downloaded."
}

# Downloads a checkpoint to a temporary name and keeps it only if its checksum matches.
fetch_weights() {
    local url="$1" target="$2" expected
    expected="$(grep " $target\$" CHECKSUMS.sha256 | cut -d' ' -f1)"
    if [ -f "$target" ]; then echo "$(basename "$target"): already there."; return; fi
    mkdir -p "$(dirname "$target")"
    curl --fail --location --progress-bar --output "$target.part" "$url" || { rm -f "$target.part"; fail "Could not download $(basename "$target")."; }
    if [ "$(shasum -a 256 "$target.part" | cut -d' ' -f1)" != "$expected" ]; then
        rm -f "$target.part"
        fail "$(basename "$target") did not match its checksum and was deleted."
    fi
    mv "$target.part" "$target"
    echo "$(basename "$target"): downloaded and verified."
}

step "Model code"
mkdir -p backend/vendor
fetch_repo DepthAnything/Depth-Anything-V2 "$DAV2_COMMIT" Depth-Anything-V2
fetch_repo DepthAnything/Video-Depth-Anything "$VDA_COMMIT" Video-Depth-Anything

step "Model weights (Small, Apache-2.0)"
fetch_weights "$DAV2_WEIGHTS" backend/vendor/Depth-Anything-V2/checkpoints/depth_anything_v2_vits.pth
fetch_weights "$VDA_WEIGHTS" backend/vendor/Video-Depth-Anything/checkpoints/video_depth_anything_vits.pth

step "Checking everything"
shasum -a 256 -c CHECKSUMS.sha256 >/dev/null || fail "A model file does not match its checksum."
backend/.venv/bin/python backend/doctor.py >/dev/null || fail "The environment check failed. Run: backend/.venv/bin/python backend/doctor.py"

finish "READY. In After Effects: File > Scripts > Run Script File... > depth-map/jsx/DepthMapStatic.jsx"
