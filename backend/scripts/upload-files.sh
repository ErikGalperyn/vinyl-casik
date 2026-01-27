#!/bin/bash
set -e

BACKEND_URL="https://vinyl-casik-production.up.railway.app"
UPLOADS_DIR="/Users/ernestgalperyn/Documents/Book_Store/bookstore/backend/uploads"

# Get Railway SSH command for file copy
cd "$UPLOADS_DIR"

echo "Uploading files to Railway volume..."

for file in *.webp; do
  if [ -f "$file" ]; then
    echo "Copying $file..."
    cat "$file" | railway ssh --service vinyl-casik --environment production -- "cat > /app/uploads/$file"
  fi
done

# Also copy music folder
if [ -d "music" ]; then
  railway ssh --service vinyl-casik --environment production -- "mkdir -p /app/uploads/music"
  for file in music/*.mp3; do
    if [ -f "$file" ]; then
      filename=$(basename "$file")
      echo "Copying music/$filename..."
      cat "$file" | railway ssh --service vinyl-casik --environment production -- "cat > /app/uploads/music/$filename"
    fi
  done
fi

echo "✅ Upload complete!"
