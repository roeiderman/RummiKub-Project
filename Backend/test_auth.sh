#!/bin/bash

################################################################################
# RummiKub Authentication API Test Suite
# Tests all authentication endpoints using curl
################################################################################

# Configuration
BASE_URL="http://localhost:3000"
TEST_NAME="Test User"
TEST_EMAIL="test_$(date +%s)@example.com"
TEST_PASSWORD="TestPassword123"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=9

# Token storage
ACCESS_TOKEN=""
REFRESH_TOKEN=""

################################################################################
# Utility Functions
################################################################################

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}RummiKub Auth API Test Suite${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo -e "Server: ${BASE_URL}"
    echo -e "Test Email: ${TEST_EMAIL}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

print_test() {
    local test_num=$1
    local test_name=$2
    local endpoint=$3
    echo -e "${BLUE}[${test_num}/${TOTAL_TESTS}]${NC} ${test_name}"
    echo -e "  ${endpoint}"
}

print_result() {
    local status=$1
    local expected=$2
    local is_error_expected=$3

    if [ "$status" = "$expected" ]; then
        if [ "$is_error_expected" = "true" ]; then
            echo -e "  Status: ${status} ${GREEN}✓ PASS${NC} (expected error)"
        else
            echo -e "  Status: ${status} ${GREEN}✓ PASS${NC}"
        fi
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "  Status: ${status} ${RED}✗ FAIL${NC} (expected ${expected})"
        ((TESTS_FAILED++))
        return 1
    fi
}

extract_json_field() {
    local json=$1
    local field=$2

    # Try using jq if available
    if command -v jq &> /dev/null; then
        echo "$json" | jq -r "$field"
    else
        # Fallback to grep/sed
        echo "$json" | grep -o "\"${field//./\"}.*\":\"}[^\"]*\"" | sed 's/.*":"\([^"]*\)".*/\1/' | head -1
    fi
}

check_dependencies() {
    if ! command -v curl &> /dev/null; then
        echo -e "${RED}Error: curl is not installed${NC}"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        echo -e "${YELLOW}Warning: jq is not installed. Using fallback JSON parsing.${NC}"
        echo -e "${YELLOW}For better results, install jq: brew install jq${NC}"
        echo ""
    fi
}

print_summary() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}Results: ${TESTS_PASSED}/${TOTAL_TESTS} passed${NC}"
    else
        echo -e "${YELLOW}Results: ${TESTS_PASSED}/${TOTAL_TESTS} passed, ${RED}${TESTS_FAILED}/${TOTAL_TESTS} failed${NC}"
    fi
    echo -e "${BLUE}========================================${NC}"
}

################################################################################
# Test Cases
################################################################################

test_register_new_user() {
    print_test 1 "Register New User" "POST /api/auth/register"

    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/auth/register" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"${TEST_NAME}\",\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}")

    HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if print_result "$HTTP_STATUS" "201" "false"; then
        # Extract tokens
        if command -v jq &> /dev/null; then
            ACCESS_TOKEN=$(echo "$BODY" | jq -r '.data.accessToken')
            REFRESH_TOKEN=$(echo "$BODY" | jq -r '.data.refreshToken')
        else
            ACCESS_TOKEN=$(echo "$BODY" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
            REFRESH_TOKEN=$(echo "$BODY" | grep -o '"refreshToken":"[^"]*"' | cut -d'"' -f4)
        fi

        if [ -n "$ACCESS_TOKEN" ] && [ "$ACCESS_TOKEN" != "null" ]; then
            echo -e "  ${GREEN}Tokens captured successfully${NC}"
        else
            echo -e "  ${YELLOW}Warning: Could not extract tokens${NC}"
        fi
    fi
    echo ""
}

test_register_duplicate() {
    print_test 2 "Register Duplicate User" "POST /api/auth/register"

    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/auth/register" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"${TEST_NAME}\",\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}")

    HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)

    print_result "$HTTP_STATUS" "409" "true"
    echo ""
}

test_login_valid() {
    print_test 3 "Login with Valid Credentials" "POST /api/auth/login"

    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}")

    HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if print_result "$HTTP_STATUS" "200" "false"; then
        # Update tokens with fresh ones from login
        if command -v jq &> /dev/null; then
            ACCESS_TOKEN=$(echo "$BODY" | jq -r '.data.accessToken')
            REFRESH_TOKEN=$(echo "$BODY" | jq -r '.data.refreshToken')
        else
            ACCESS_TOKEN=$(echo "$BODY" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
            REFRESH_TOKEN=$(echo "$BODY" | grep -o '"refreshToken":"[^"]*"' | cut -d'"' -f4)
        fi

        if [ -n "$ACCESS_TOKEN" ] && [ "$ACCESS_TOKEN" != "null" ]; then
            echo -e "  ${GREEN}Fresh tokens captured${NC}"
        fi
    fi
    echo ""
}

test_login_invalid() {
    print_test 4 "Login with Invalid Password" "POST /api/auth/login"

    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"WrongPassword123\"}")

    HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)

    print_result "$HTTP_STATUS" "401" "true"
    echo ""
}

test_refresh_valid() {
    print_test 5 "Refresh Access Token" "POST /api/auth/refresh"

    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/auth/refresh" \
        -H "Content-Type: application/json" \
        -d "{\"refreshToken\":\"${REFRESH_TOKEN}\"}")

    HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if print_result "$HTTP_STATUS" "200" "false"; then
        # Update access token
        if command -v jq &> /dev/null; then
            ACCESS_TOKEN=$(echo "$BODY" | jq -r '.data.accessToken')
        else
            ACCESS_TOKEN=$(echo "$BODY" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
        fi

        if [ -n "$ACCESS_TOKEN" ] && [ "$ACCESS_TOKEN" != "null" ]; then
            echo -e "  ${GREEN}New access token captured${NC}"
        fi
    fi
    echo ""
}

test_refresh_invalid() {
    print_test 6 "Refresh with Invalid Token" "POST /api/auth/refresh"

    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/auth/refresh" \
        -H "Content-Type: application/json" \
        -d "{\"refreshToken\":\"invalid_token_12345\"}")

    HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)

    print_result "$HTTP_STATUS" "401" "true"
    echo ""
}

test_logout_valid() {
    print_test 7 "Logout with Valid Token" "POST /api/auth/logout"

    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/auth/logout" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}")

    HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)

    print_result "$HTTP_STATUS" "200" "false"
    echo ""
}

test_logout_no_token() {
    print_test 8 "Logout without Token" "POST /api/auth/logout"

    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/auth/logout" \
        -H "Content-Type: application/json")

    HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)

    print_result "$HTTP_STATUS" "401" "true"
    echo ""
}

test_use_token_after_logout() {
    print_test 9 "Use Token After Logout" "POST /api/auth/refresh"

    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/auth/refresh" \
        -H "Content-Type: application/json" \
        -d "{\"refreshToken\":\"${REFRESH_TOKEN}\"}")

    HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)

    print_result "$HTTP_STATUS" "401" "true"
    echo ""
}

################################################################################
# Main Execution
################################################################################

main() {
    # Check dependencies
    check_dependencies

    # Print header
    print_header

    # Run all tests in order
    test_register_new_user
    test_register_duplicate
    test_login_valid
    test_login_invalid
    test_refresh_valid
    test_refresh_invalid
    test_logout_valid
    test_logout_no_token
    test_use_token_after_logout

    # Print summary
    print_summary

    # Exit with appropriate code
    if [ $TESTS_FAILED -eq 0 ]; then
        exit 0
    else
        exit 1
    fi
}

# Run main function
main
