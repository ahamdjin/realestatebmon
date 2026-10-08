#!/usr/bin/env bash
# Double the motion frames of every flythrough clip using optical-flow interpolation.
# Requirements: ffmpeg and ffprobe. Run from the repository root.
# Usage: bash scripts/double-motion-fps.sh
set -euo pipefail
command -v ffmpeg >/dev/null || { echo "Install ffmpeg first" >&2; exit 1; }
command -v ffprobe >/dev/null || { echo "Install ffprobe first" >&2; exit 1; }
shopt -s nullglob
files=(assets/scroll/*.mp4 assets/reverse/*.mp4 assets/hero-loop.mp4)
for input in "${files[@]}"; do
  rate=$(ffprobe -v error -select_streams v:0 -show_entries stream=avg_frame_rate -of default=noprint_wrappers=1:nokey=1 "$input")
  target=$(awk -v rate="$rate" 'BEGIN {split(rate,a,"/"); fps=a[2] ? a[1]/a[2] : a[1]; if (fps<=0) exit 1; printf "%.3f", fps*2}')
  output="${input%.mp4}.interpolated.mp4"
  echo "Interpolating $input ($rate fps -> $target fps)..."
  ffmpeg -hide_banner -loglevel warning -stats -i "$input" -map 0:v:0 -map 0:a? \
    -vf "minterpolate=fps=${target}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1" \
    -c:v libx264 -preset medium -crf 21 -pix_fmt yuv420p -movflags +faststart \
    -c:a copy -y "$output"
  mv "$output" "$input"
done
echo "Done. Review the resulting files before committing; optical flow can introduce artifacts."
