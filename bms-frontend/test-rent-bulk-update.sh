#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000}"
COOKIE="${BMS_COOKIE:-}"
BUILDING_ID="${BUILDING_ID:-}"

if [[ -z "$COOKIE" || -z "$BUILDING_ID" ]]; then
  echo "Usage: BMS_COOKIE='bms_session=...' BUILDING_ID=... $0"
  exit 1
fi

echo "Previewing rent bulk update..."
PREVIEW_RESP=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/api/rent/bulk-update" \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d '{
    "buildingId": "'"$BUILDING_ID"'",
    "policy": {
      "baseRatePerSqm": 1200,
      "decrementPerFloor": 20,
      "groundFloorMultiplier": 1.15,
      "minRatePerSqm": 900
    },
    "floorFilter": { "from": 0, "to": 10 },
    "apply": false
  }')

PREVIEW_BODY=$(echo "$PREVIEW_RESP" | head -n-1)
PREVIEW_CODE=$(echo "$PREVIEW_RESP" | tail -n1)
echo "Preview status: $PREVIEW_CODE"
echo "$PREVIEW_BODY" | jq .

echo "Applying rent bulk update..."
APPLY_RESP=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/api/rent/bulk-update" \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d '{
    "buildingId": "'"$BUILDING_ID"'",
    "policy": {
      "baseRatePerSqm": 1200,
      "decrementPerFloor": 20,
      "groundFloorMultiplier": 1.15,
      "minRatePerSqm": 900
    },
    "floorFilter": { "from": 0, "to": 10 },
    "apply": true
  }')

APPLY_BODY=$(echo "$APPLY_RESP" | head -n-1)
APPLY_CODE=$(echo "$APPLY_RESP" | tail -n1)
echo "Apply status: $APPLY_CODE"
echo "$APPLY_BODY" | jq .











