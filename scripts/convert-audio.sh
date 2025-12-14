#!/bin/bash
# Convert FLAC files to WAV for browser validation
# Usage: ./scripts/convert-audio.sh [limit]

LIMIT=${1:-50}
SRC_DIR="test-data"
DST_DIR="test-data/wav-dev"
FILE_LIST="test-data/reference-materials/flists.flac/dev-asr.tsv"

mkdir -p "$DST_DIR"

count=0
while IFS=$'\t' read -r id path; do
  if [ $count -ge $LIMIT ]; then break; fi
  
  src="$SRC_DIR/$path"
  dst="$DST_DIR/${id}.wav"
  
  if [ -f "$src" ] && [ ! -f "$dst" ]; then
    ffmpeg -i "$src" -ar 16000 -ac 1 "$dst" -y -loglevel error
    echo "[$count/$LIMIT] Converted: $id"
    ((count++))
  elif [ -f "$dst" ]; then
    ((count++))
  fi
done < "$FILE_LIST"

echo "Done! Converted $count files to $DST_DIR"
