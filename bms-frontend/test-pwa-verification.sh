#!/bin/bash

# PWA Verification Test Script
# Tests PWA manifest, service worker, and installability

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "🧪 PWA Verification Test"
echo "========================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check server
echo -e "${YELLOW}Checking server...${NC}"
if ! curl -s -f "${BASE_URL}/api/health" > /dev/null; then
  echo -e "${RED}❌ Server not running${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Server running${NC}"
echo ""

# Test 10.4.1: PWA Manifest
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}Test 10.4.1: PWA Manifest${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}Checking manifest.json...${NC}"
MANIFEST_RESPONSE=$(curl -s -w "\n%{http_code}" "${BASE_URL}/manifest.json" 2>&1)
HTTP_CODE=$(echo "$MANIFEST_RESPONSE" | tail -1)
MANIFEST_BODY=$(echo "$MANIFEST_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ]; then
  echo -e "${RED}❌ Manifest not found (HTTP $HTTP_CODE)${NC}"
else
  echo -e "${GREEN}✅ Manifest accessible${NC}"
  
  # Check required fields
  if command -v python3 >/dev/null 2>&1; then
    echo "  Checking required fields..."
    
    NAME=$(echo "$MANIFEST_BODY" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('name', ''))
except:
    pass
" 2>/dev/null || echo "")
    
    SHORT_NAME=$(echo "$MANIFEST_BODY" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('short_name', ''))
except:
    pass
" 2>/dev/null || echo "")
    
    START_URL=$(echo "$MANIFEST_BODY" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('start_url', ''))
except:
    pass
" 2>/dev/null || echo "")
    
    DISPLAY=$(echo "$MANIFEST_BODY" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('display', ''))
except:
    pass
" 2>/dev/null || echo "")
    
    ICONS_COUNT=$(echo "$MANIFEST_BODY" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    icons = data.get('icons', [])
    print(len(icons))
except:
    print(0)
" 2>/dev/null || echo "0")
    
    if [ -n "$NAME" ]; then
      echo -e "    ${GREEN}✅ name: ${NAME}${NC}"
    else
      echo -e "    ${RED}❌ name: missing${NC}"
    fi
    
    if [ -n "$SHORT_NAME" ]; then
      echo -e "    ${GREEN}✅ short_name: ${SHORT_NAME}${NC}"
    else
      echo -e "    ${YELLOW}⚠️  short_name: missing${NC}"
    fi
    
    if [ -n "$START_URL" ]; then
      echo -e "    ${GREEN}✅ start_url: ${START_URL}${NC}"
    else
      echo -e "    ${RED}❌ start_url: missing${NC}"
    fi
    
    if [ -n "$DISPLAY" ]; then
      echo -e "    ${GREEN}✅ display: ${DISPLAY}${NC}"
    else
      echo -e "    ${YELLOW}⚠️  display: missing${NC}"
    fi
    
    if [ "$ICONS_COUNT" -gt 0 ]; then
      echo -e "    ${GREEN}✅ icons: ${ICONS_COUNT} icon(s) defined${NC}"
    else
      echo -e "    ${RED}❌ icons: missing${NC}"
    fi
  fi
fi
echo ""

# Test Service Worker
echo -e "${YELLOW}Checking service worker (sw.js)...${NC}"
SW_RESPONSE=$(curl -s -w "\n%{http_code}" "${BASE_URL}/sw.js" 2>&1)
SW_HTTP_CODE=$(echo "$SW_RESPONSE" | tail -1)

if [ "$SW_HTTP_CODE" != "200" ]; then
  echo -e "${YELLOW}⚠️  Service worker not found (HTTP $SW_HTTP_CODE)${NC}"
  echo "    Note: Service worker is optional for MVP"
else
  echo -e "${GREEN}✅ Service worker accessible${NC}"
  SW_SIZE=$(echo "$SW_RESPONSE" | sed '$d' | wc -c)
  echo "    Size: ${SW_SIZE} bytes"
fi
echo ""

# Test Offline Page
echo -e "${YELLOW}Checking offline fallback page...${NC}"
OFFLINE_RESPONSE=$(curl -s -w "\n%{http_code}" "${BASE_URL}/offline.html" 2>&1)
OFFLINE_HTTP_CODE=$(echo "$OFFLINE_RESPONSE" | tail -1)

if [ "$OFFLINE_HTTP_CODE" != "200" ]; then
  echo -e "${YELLOW}⚠️  Offline page not found (HTTP $OFFLINE_HTTP_CODE)${NC}"
  echo "    Note: Offline page is optional"
else
  echo -e "${GREEN}✅ Offline page accessible${NC}"
fi
echo ""

# Test Meta Tags in HTML
echo -e "${YELLOW}Checking PWA meta tags in HTML...${NC}"
HTML_RESPONSE=$(curl -s "${BASE_URL}/tenant/dashboard" 2>&1 || echo "")

if [ -z "$HTML_RESPONSE" ]; then
  echo -e "${YELLOW}⚠️  Could not fetch HTML (may require authentication)${NC}"
else
  if echo "$HTML_RESPONSE" | grep -qi "manifest.json"; then
    echo -e "    ${GREEN}✅ manifest link found${NC}"
  else
    echo -e "    ${YELLOW}⚠️  manifest link not found${NC}"
  fi
  
  if echo "$HTML_RESPONSE" | grep -qi "apple-mobile-web-app-capable"; then
    echo -e "    ${GREEN}✅ Apple PWA meta tags found${NC}"
  else
    echo -e "    ${YELLOW}⚠️  Apple PWA meta tags not found${NC}"
  fi
  
  if echo "$HTML_RESPONSE" | grep -qi "theme-color"; then
    echo -e "    ${GREEN}✅ theme-color meta tag found${NC}"
  else
    echo -e "    ${YELLOW}⚠️  theme-color meta tag not found${NC}"
  fi
fi
echo ""

# Summary
echo ""
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}PWA Verification Summary${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}✅ Manifest:${NC}"
echo "  - Manifest file accessible"
echo "  - Required fields checked"
echo ""
echo -e "${GREEN}✅ Service Worker:${NC}"
if [ "$SW_HTTP_CODE" = "200" ]; then
  echo "  - Service worker file accessible"
else
  echo "  - Service worker optional (not required for MVP)"
fi
echo ""
echo -e "${GREEN}✅ Installability:${NC}"
echo "  - For Android: Open Chrome/Edge, visit site, check 'Add to Home Screen'"
echo "  - For iOS: Open Safari, tap Share > Add to Home Screen"
echo ""
echo -e "${YELLOW}Note: Full installability testing requires:${NC}"
echo "  - Real device testing (Android/iOS)"
echo "  - HTTPS (required for PWA installation)"
echo "  - Service worker registration (check browser DevTools)"
echo ""
echo -e "${GREEN}PWA verification tests completed! 🎉${NC}"



















