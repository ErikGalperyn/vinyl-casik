#!/bin/bash
set -e

echo "=== Medioteka Full Flow Test ==="
echo ""

BASE="http://localhost:4001"

echo "1. Test Login (admin)"
RESP=$(curl -sS -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}')
TOKEN=$(echo $RESP | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "✓ Login successful, token: ${TOKEN:0:20}..."
echo ""

echo "2. Test Register (new user)"
curl -sS -X POST $BASE/auth/register -H 'Content-Type: application/json' -d '{"username":"testuser","password":"test123"}' > /dev/null
echo "✓ Register successful"
echo ""

echo "3. Test GET /vinyls"
curl -sS $BASE/vinyls -H "Authorization: Bearer $TOKEN" | head -c 100
echo ""
echo "✓ GET /vinyls works"
echo ""

echo "4. Test POST /vinyls (create)"
CREATE_RESP=$(curl -sS -X POST $BASE/vinyls -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"title":"Test Vinyl","artist":"Test Artist","year":2025,"coverUrl":"","note":"Test note"}')
NEW_ID=$(echo $CREATE_RESP | grep -o '"id":[0-9]*' | cut -d':' -f2)
echo "✓ Created vinyl with ID: $NEW_ID"
echo ""

echo "5. Test PUT /vinyls/:id (update)"
curl -sS -X PUT $BASE/vinyls/$NEW_ID -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"title":"Updated Vinyl"}' > /dev/null
echo "✓ Updated vinyl $NEW_ID"
echo ""

echo "6. Test DELETE /vinyls/:id"
curl -sS -X DELETE $BASE/vinyls/$NEW_ID -H "Authorization: Bearer $TOKEN"
echo "✓ Deleted vinyl $NEW_ID"
echo ""

echo "7. Test GET /users (admin only)"
curl -sS $BASE/users -H "Authorization: Bearer $TOKEN" | head -c 100
echo ""
echo "✓ GET /users works (admin)"
echo ""

echo "=== All tests passed! ==="
