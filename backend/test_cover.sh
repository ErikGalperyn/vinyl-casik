#!/bin/bash

# Get token
TOKEN=$(curl -sS -X POST http://localhost:4001/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

echo "Token: ${TOKEN:0:20}..."

# Create a test image
convert -size 300x300 xc:red /tmp/test-cover.jpg

# Upload cover
echo ""
echo "Uploading cover..."
RESP=$(curl -sS -X POST http://localhost:4001/upload-cover \
  -H "Authorization: Bearer $TOKEN" \
  -F "cover=@/tmp/test-cover.jpg")

echo "Response: $RESP"

# Extract URL
URL=$(echo $RESP | grep -o '"url":"[^"]*"' | cut -d'"' -f4)
echo ""
echo "Cover URL: $URL"

# Create vinyl with cover
echo ""
echo "Creating vinyl with cover..."
curl -sS -X POST http://localhost:4001/vinyls \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"title\":\"Test Album\",\"artist\":\"Test Artist\",\"year\":2025,\"coverUrl\":\"$URL\",\"note\":\"Test\"}" | head -c 200
