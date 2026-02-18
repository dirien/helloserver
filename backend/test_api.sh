#!/bin/bash

# Simple test script for the URL Shortener API
# Make sure the server is running before executing this script

API_BASE="http://localhost:8000"

echo "=========================================="
echo "URL Shortener API Test"
echo "=========================================="
echo ""

# Test health check
echo "1. Testing health check..."
curl -s $API_BASE/ | python3 -m json.tool
echo ""
echo ""

# Test creating a short URL
echo "2. Creating a short URL..."
RESPONSE=$(curl -s -X POST $API_BASE/shorten \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.github.com"}')
echo "$RESPONSE" | python3 -m json.tool

# Extract short code
SHORT_CODE=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['short_code'])" 2>/dev/null)
echo ""
echo "Created short code: $SHORT_CODE"
echo ""

# Test redirect
echo "3. Testing redirect (will follow to github.com)..."
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" $API_BASE/$SHORT_CODE
echo ""

# Test stats
echo "4. Checking statistics..."
curl -s $API_BASE/api/stats/$SHORT_CODE | python3 -m json.tool
echo ""
echo ""

# Test another click
echo "5. Clicking the short URL again..."
curl -s -o /dev/null $API_BASE/$SHORT_CODE
echo ""

# Test stats again
echo "6. Checking updated statistics (clicks should be 2)..."
curl -s $API_BASE/api/stats/$SHORT_CODE | python3 -m json.tool
echo ""
echo ""

# Test 404
echo "7. Testing 404 for invalid short code..."
curl -s $API_BASE/invalid999 | python3 -m json.tool
echo ""
echo ""

echo "=========================================="
echo "Test completed!"
echo "=========================================="
