#!/bin/bash

# Pre-Demo Verification Script for Peach AI SDR
# Run this before any demo to ensure all systems are working

echo "🍑 Peach AI SDR - Pre-Demo Check"
echo "================================"
echo ""

BASE_URL="${1:-http://localhost:3000}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
WARNINGS=0

check() {
    local name=$1
    local url=$2
    local method=${3:-GET}
    local data=$4

    if [ "$method" == "POST" ] && [ -n "$data" ]; then
        response=$(curl -s -X POST "$url" -H "Content-Type: application/json" -d "$data" -w "\n%{http_code}" 2>/dev/null)
    else
        response=$(curl -s "$url" -w "\n%{http_code}" 2>/dev/null)
    fi

    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" == "200" ]; then
        echo -e "${GREEN}✓${NC} $name"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $name (HTTP $http_code)"
        ((FAILED++))
        return 1
    fi
}

warn_check() {
    local name=$1
    local url=$2

    response=$(curl -s "$url" -w "\n%{http_code}" 2>/dev/null)
    http_code=$(echo "$response" | tail -1)

    if [ "$http_code" == "200" ]; then
        echo -e "${GREEN}✓${NC} $name"
        ((PASSED++))
    else
        echo -e "${YELLOW}⚠${NC} $name (optional - HTTP $http_code)"
        ((WARNINGS++))
    fi
}

echo "Checking core endpoints..."
echo ""

# Core System Checks
echo "📊 System Health"
check "Health check" "$BASE_URL/api/health"
echo ""

# Lead Management
echo "👥 Lead Management"
check "List leads" "$BASE_URL/api/leads"
check "Email verification status" "$BASE_URL/api/leads/verify"
echo ""

# Email Generation
echo "✉️ Email System"
check "List sequences" "$BASE_URL/api/sequences"
check "List campaigns" "$BASE_URL/api/campaigns"
check "Sending domains" "$BASE_URL/api/domains"
echo ""

# Inbox
echo "📥 Inbox"
check "Inbox messages" "$BASE_URL/api/inbox"
warn_check "Inbox sync status" "$BASE_URL/api/inbox/sync"
echo ""

# Notion CRM
echo "📝 Notion CRM"
check "Notion connection" "$BASE_URL/api/notion/sync"
check "Relation status" "$BASE_URL/api/notion/setup-relation"
echo ""

# Meetings
echo "📅 Meetings"
warn_check "Meetings list" "$BASE_URL/api/meetings"
echo ""

# Chatbot
echo "🤖 AI Chatbot"
check "Chat API status" "$BASE_URL/api/chat"
echo ""

# Summary
echo ""
echo "================================"
echo "Summary"
echo "================================"
echo -e "${GREEN}Passed:${NC} $PASSED"
echo -e "${RED}Failed:${NC} $FAILED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All critical checks passed! Ready for demo.${NC}"
    exit 0
else
    echo -e "${RED}❌ Some checks failed. Please fix before demo.${NC}"
    exit 1
fi
