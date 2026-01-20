#!/bin/bash
echo "=== Likes System Test ==="
echo ""

# Get token
TOKEN=$(curl -sS -X POST http://localhost:4001/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.token')

echo "1. Check initial vinyls"
VINYLS=$(curl -sS http://localhost:4001/vinyls -H "Authorization: Bearer $TOKEN")
echo "$VINYLS" | jq '.[] | {id, title, likes: .likes | length}'
echo ""

echo "2. Like vinyl ID 1"
LIKE_RESULT=$(curl -sS -X POST http://localhost:4001/vinyls/1/like \
  -H "Authorization: Bearer $TOKEN")
echo "Result: $LIKE_RESULT"
echo ""

echo "3. Check updated likes"
curl -sS http://localhost:4001/vinyls/1 -H "Authorization: Bearer $TOKEN" | jq '{id, title, likes}'
echo ""

echo "4. Try to like again (should not duplicate)"
curl -sS -X POST http://localhost:4001/vinyls/1/like \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

echo "5. Unlike vinyl ID 1"
UNLIKE_RESULT=$(curl -sS -X DELETE http://localhost:4001/vinyls/1/like \
  -H "Authorization: Bearer $TOKEN")
echo "Result: $UNLIKE_RESULT"
echo ""

echo "6. Check final state"
curl -sS http://localhost:4001/vinyls/1 -H "Authorization: Bearer $TOKEN" | jq '{id, title, likes}'
echo ""

echo "=== Likes system working! ==="
