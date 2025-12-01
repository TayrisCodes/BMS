#!/bin/bash

# Complete test script for Password Management System
# Tests both direct MongoDB functions and API endpoints

BASE_URL="http://localhost:3000"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Password Management Complete Test${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Test 1: Direct MongoDB Test
echo -e "${YELLOW}Test 1: Direct MongoDB Test${NC}"
echo -e "${BLUE}----------------------------------------${NC}"
MONGODB_URI="mongodb://bms_root:bms_password@localhost:27021/bms?authSource=admin" \
  node test-password-management-direct.mjs

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Direct MongoDB test passed${NC}\n"
else
  echo -e "${RED}❌ Direct MongoDB test failed${NC}\n"
  exit 1
fi

# Test 2: API Endpoint Test
echo -e "${YELLOW}Test 2: API Endpoint Test${NC}"
echo -e "${BLUE}----------------------------------------${NC}"
./test-password-management-api.sh

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ API endpoint test passed${NC}\n"
else
  echo -e "${RED}❌ API endpoint test failed${NC}\n"
  exit 1
fi

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Complete Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Password policy validation${NC}"
echo -e "${GREEN}✅ Password reset service${NC}"
echo -e "${GREEN}✅ Forgot password endpoint${NC}"
echo -e "${GREEN}✅ Reset password endpoint${NC}"
echo -e "${GREEN}✅ Change password endpoint${NC}"
echo -e "${GREEN}✅ Password policy enforcement${NC}"
echo -e "${GREEN}✅ All tests passed!${NC}\n"


















