#!/bin/bash
# Local render of the 3D version (macOS / Linux / Windows Git Bash or WSL).
# Needs: node 18+, python3, ffmpeg. A real GPU makes WebGL ~10-30x faster than the cloud CPU.
# Usage:  cd video && ./render_local.sh [workers]      -> out/why-soldiers-break-step-3d.mp4
set -e
cd "$(dirname "$0")"
K=${1:-2}
mkdir -p build out
cp -n data/timeline.json data/events.json data/mix.wav build/ 2>/dev/null || true
[ -d node_modules/three ] || npm install
[ -d node_modules/playwright ] || npm install --no-save playwright
npx playwright install chromium
python3 -m http.server 8765 --bind 127.0.0.1 >/dev/null 2>&1 & SRV=$!
trap "kill $SRV" EXIT
sleep 1
N=$(python3 -c "import json;print(round(json.load(open('build/events.json'))['total']*60))")
S=$(( (N + K - 1) / K ))
cd src
for i in $(seq 0 $((K-1))); do a=$((i*S)); b=$(( (i+1)*S < N ? (i+1)*S : N )); GPU=1 node capture.js range $a $b ../build/seg3d_$i.mp4 & done
wait
cd ..
for i in $(seq 0 $((K-1))); do echo "file 'seg3d_$i.mp4'"; done > build/segs3d.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i build/segs3d.txt -c copy build/video3d.mp4
ffmpeg -y -loglevel error -i build/video3d.mp4 -i build/mix.wav -map 0:v -map 1:a -c:v copy \
  -af "loudnorm=I=-14:TP=-1.0:LRA=11" -ar 48000 -c:a aac -b:a 192k -movflags +faststart out/why-soldiers-break-step-3d.mp4
echo "Done: video/out/why-soldiers-break-step-3d.mp4"
