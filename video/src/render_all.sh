#!/bin/bash
# Renders all frames in 4 parallel segments, then concatenates.
cd "$(dirname "$0")"
N=3925; K=4; S=$(( (N + K - 1) / K ))
for i in $(seq 0 $((K-1))); do a=$((i*S)); b=$(( (i+1)*S < N ? (i+1)*S : N )); node capture.js range $a $b ../build/seg$i.mp4 & done
wait
printf "file 'seg%d.mp4'\n" 0 1 2 3 > ../build/segs.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i ../build/segs.txt -c copy ../build/video.mp4
