#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000}"
COOKIE="${BMS_COOKIE:-}"
ORG_ID="${ORG_ID:-}"
TENANT_ID="${TENANT_ID:-}"
UNIT_ID="${UNIT_ID:-}"

if [[ -z "$COOKIE" || -z "$ORG_ID" || -z "$TENANT_ID" || -z "$UNIT_ID" ]]; then
  echo "Usage: BMS_COOKIE='bms_session=...' ORG_ID=... TENANT_ID=... UNIT_ID=... $0"
  exit 1
fi

echo "Creating lease..."
leasePayload=$(cat <<'JSON'
{
  "tenantId": "__TENANT__",
  "unitId": "__UNIT__",
  "startDate": "2025-01-01",
  "endDate": "2025-12-31",
  "billingCycle": "monthly",
  "terms": { "rent": 5000, "deposit": 10000, "serviceCharges": 500, "vatRate": 15, "vatIncluded": false },
  "paymentDueDays": 7,
  "penaltyConfig": { "lateFeeRatePerDay": 0.0005, "lateFeeGraceDays": 0, "lateFeeCapDays": 30 },
  "renewalNoticeDays": 60,
  "customTermsText": "No smoking. Business hours 8am-7pm."
}
JSON
)
leasePayload=${leasePayload/__TENANT__/$TENANT_ID}
leasePayload=${leasePayload/__UNIT__/$UNIT_ID}

createResp=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/api/leases" \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d "$leasePayload")
body=$(echo "$createResp" | head -n-1)
code=$(echo "$createResp" | tail -n1)
echo "Create status: $code"
echo "$body"

leaseId=$(echo "$body" | jq -r '.lease._id // empty')
if [[ -z "$leaseId" ]]; then
  echo "Failed to create lease"
  exit 1
fi

echo "Triggering lease invoicing cron..."
curl -s -X POST "$API_BASE/api/cron/lease-invoicing" \
  -H "Authorization: Bearer ${CRON_SECRET:-test}" \
  -H "Content-Type: application/json" \
  -d "{\"organizationId\":\"$ORG_ID\"}" \
  | jq .

echo "Fetching tenant lease view..."
curl -s -H "Cookie: $COOKIE" "$API_BASE/api/tenant/lease" | jq .

echo "Done. Lease ID: $leaseId"













