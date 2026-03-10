#!/bin/bash
# ZeroClaw RAG Limits Stress Test
#
# Tests the robustness of the RAG (Retrieval-Augmented Generation) system
# under various load conditions with vector and keyword searches.
#
# Prerequisites:
# - ZeroClaw daemon running on http://localhost:42617
# - Qdrant running on 127.0.0.1:6333
# - SQLite memory initialized at ~/.zeroclaw/memory/brain.db
# - Auth token or paired gateway
#
# Usage:
#   ./rag_limits.sh                    # Run all tests
#   ./rag_limits.sh --store-only       # Only store test data
#   ./rag_limits.sh --query-only       # Only run query tests
#   ./rag_limits.sh --stress           # Run stress tests
#
# Environment variables:
# - API_URL: ZeroClaw API URL (default: http://localhost:42617)
# - TEST_TOKEN: Auth token (optional)
# - VECTOR_SIZE: Embedding dimension (default: 384)
# - NUM_VECTORS: Number of test vectors (default: 1000)
# - CONCURRENT_REQUESTS: Concurrent query count (default: 20)

set -euo pipefail

# =============================================================================
# CONFIGURATION
# =============================================================================

API_URL="${API_URL:-http://localhost:42617}"
TEST_TOKEN="${TEST_TOKEN:-}"
VECTOR_SIZE="${VECTOR_SIZE:-384}"
NUM_VECTORS="${NUM_VECTORS:-1000}"
CONCURRENT_REQUESTS="${CONCURRENT_REQUESTS:-20}"
RESULTS_DIR="test_results/rag_$(date +%Y%m%d_%H%M%S)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# =============================================================================
# UTILITIES
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED_TESTS++))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED_TESTS++))
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Create results directory
mkdir -p "$RESULTS_DIR"

# Check if ZeroClaw is running
check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! curl -s -f "${API_URL}/health" > /dev/null 2>&1; then
        log_error "ZeroClaw daemon not running at ${API_URL}"
        exit 1
    fi

    if ! curl -s -f "http://localhost:6333/collections" > /dev/null 2>&1; then
        log_error "Qdrant not running at http://localhost:6333"
        exit 1
    fi

    log_success "All prerequisites met"
    ((TOTAL_TESTS++))
}

# Make authenticated API request
api_request() {
    local endpoint="$1"
    local method="${2:-GET}"
    local data="${3:-}"

    local curl_args=(
        -s
        -X "$method"
        -H "Content-Type: application/json"
    )

    if [[ -n "$TEST_TOKEN" ]]; then
        curl_args+=(-H "Authorization: Bearer $TEST_TOKEN")
    fi

    if [[ -n "$data" ]]; then
        curl_args+=(-d "$data")
    fi

    curl "${curl_args[@]}" "${API_URL}${endpoint}"
}

# Generate random embedding vector (for testing)
generate_embedding() {
    local size="$1"
    local vector="["

    for ((i=0; i<size; i++)); do
        if [[ $i -gt 0 ]]; then
            vector+=","
        fi
        # Generate random float between -1 and 1
        vector+="$(awk -v min=-1 -v max=1 'BEGIN{srand(); print min+rand()*(max-min)}')"
    done

    vector+="]"
    echo "$vector"
}

# =============================================================================
# TEST SUITES
# =============================================================================

# Test 1: Store single memory entry
test_store_single_memory() {
    log_info "Test 1: Store single memory entry"

    local test_key="test_single_$(date +%s)"
    local test_content="This is a test memory entry for RAG limits testing."

    local response=$(api_request "/api/v1/memory/store" "POST" "{\"key\":\"$test_key\",\"content\":\"$test_content\",\"category\":\"rag_test\"}")

    if [[ $? -eq 0 ]]; then
        log_success "Single memory stored successfully"
        echo "$response" > "$RESULTS_DIR/test1_store_response.json"
    else
        log_error "Failed to store single memory"
    fi
    ((TOTAL_TESTS++))
}

# Test 2: Bulk store N memories
test_bulk_store() {
    log_info "Test 2: Bulk store $NUM_VECTORS memories"

    local start_time=$(date +%s)
    local successful=0
    local failed=0

    for ((i=1; i<=NUM_VECTORS; i++)); do
        local test_key="bulk_test_${i}_$(date +%s)"
        local test_content="Bulk test entry $i with some content for vector search testing."

        if api_request "/api/v1/memory/store" "POST" "{\"key\":\"$test_key\",\"content\":\"$test_content\",\"category\":\"bulk_test\"}" > /dev/null 2>&1; then
            ((successful++))
        else
            ((failed++))
        fi

        # Progress indicator
        if [[ $((i % 100)) -eq 0 ]]; then
            echo -n "."
        fi
    done

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local rate=$((successful / duration))

    echo ""
    log_info "Bulk store completed: $successful successful, $failed failed in ${duration}s (${rate} ops/s)"

    if [[ $successful -ge $((NUM_VECTORS * 95 / 100)) ]]; then
        log_success "Bulk store achieved 95%+ success rate"
        echo "successful=$successful,failed=$failed,duration=${duration}s,rate=${rate}ops/s" > "$RESULTS_DIR/test2_bulk_stats.txt"
    else
        log_error "Bulk store success rate below 95%"
    fi
    ((TOTAL_TESTS++))
}

# Test 3: Vector search with varying limits
test_vector_search_limits() {
    log_info "Test 3: Vector search with varying limits"

    local limits=(1 5 10 20 50 100)
    local all_passed=true

    for limit in "${limits[@]}"; do
        local response=$(api_request "/api/v1/memory/recall?query=test&limit=$limit&use_vector=true")
        local count=$(echo "$response" | jq '.results | length' 2>/dev/null || echo "0")

        if [[ $count -le $limit ]]; then
            log_success "Vector search limit=$limit returned $count results (≤ $limit)"
        else
            log_error "Vector search limit=$limit returned $count results (> $limit)"
            all_passed=false
        fi
    done

    if [[ "$all_passed" == "true" ]]; then
        log_success "All vector search limit tests passed"
    fi
    ((TOTAL_TESTS++))
}

# Test 4: Keyword search performance
test_keyword_search_performance() {
    log_info "Test 4: Keyword search performance"

    local queries=(
        "rust"
        "python"
        "testing"
        "memory"
        "vector"
        "database"
        "search"
        "performance"
        "async"
        "concurrent"
    )

    local total_time=0
    local all_passed=true

    for query in "${queries[@]}"; do
        local start_time=$(date +%s%N)
        local response=$(api_request "/api/v1/memory/recall?query=$query&use_vector=false")
        local end_time=$(date +%s%N)
        local duration=$(( (end_time - start_time) / 1000000 )) # milliseconds

        total_time=$((total_time + duration))

        if [[ $duration -lt 1000 ]]; then
            log_success "Keyword search '$query' completed in ${duration}ms"
        else
            log_warn "Keyword search '$query' took ${duration}ms (> 1s)"
            all_passed=false
        fi
    done

    local avg_time=$((total_time / ${#queries[@]}))
    log_info "Average keyword search time: ${avg_time}ms"

    if [[ "$all_passed" == "true" ]]; then
        log_success "Keyword search performance acceptable"
    fi
    ((TOTAL_TESTS++))
}

# Test 5: Hybrid search (vector + keyword)
test_hybrid_search() {
    log_info "Test 5: Hybrid search (vector + keyword fusion)"

    local response=$(api_request "/api/v1/memory/recall?query=rust+async+safety&use_vector=true")
    local count=$(echo "$response" | jq '.results | length' 2>/dev/null || echo "0")

    if [[ $count -gt 0 ]]; then
        log_success "Hybrid search returned $count results"
        echo "$response" > "$RESULTS_DIR/test5_hybrid_search.json"
    else
        log_warn "Hybrid search returned no results"
    fi
    ((TOTAL_TESTS++))
}

# Test 6: Concurrent queries with large random text (context overflow simulation)
test_concurrent_queries() {
    log_info "Test 6: Concurrent queries ($CONCURRENT_REQUESTS parallel requests with large random texts)"

    local start_time=$(date +%s)

    # Generate large random text for context overflow simulation (2000+ words each)
    generate_large_random_text() {
        local seed="$1"
        local words=()
        local word_list=(
            "rust" "async" "memory" "vector" "embedding" "semantic" "recall" "context"
            "overflow" "stress" "test" "concurrent" "parallel" "query" "search" "database"
            "qdrant" "sqlite" "token" "limit" "chunk" "retrieval" "generation" "agent"
            "channel" "provider" "gateway" "api" "http" "response" "request" "timeout"
            "latency" "throughput" "performance" "scalability" "robustness" "resilience"
            "fragmentation" "compression" "encoding" "decoding" "serialization" "buffer"
            "stream" "websocket" "sse" "event" "message" "queue" "worker" "executor"
            "scheduler" "dispatcher" "handler" "middleware" "filter" "validator" "parser"
            "lexer" "tokenizer" "stemmer" "lemmatizer" "normalizer" "sanitizer" "cleaner"
            "transformer" "encoder" "decoder" "translator" "converter" "adapter" "wrapper"
        )

        local text=""
        for ((j=0; j<2000; j++)); do
            local idx=$(( (seed + j) % ${#word_list[@]} ))
            text+="${word_list[$idx]} "
            # Add some randomness
            if [[ $((j % 10)) -eq 0 ]]; then
                text+="lorem_ipsum_dolor_sit_amet_consectetur_adipiscing_elit "
            fi
        done
        echo "$text"
    }

    # Launch concurrent requests in background with large texts and HTTP status collection
    for ((i=1; i<=CONCURRENT_REQUESTS; i++)); do
        (
            local large_text=$(generate_large_random_text "$i")
            local encoded_query=$(echo "$large_text" | head -c 500 | sed 's/ /%20/g' | tr -d '\n')

            # Make request and capture HTTP status code
            local http_code=$(curl -s -o "$RESULTS_DIR/concurrent_$i.json" -w "%{http_code}" \
                -X "GET" \
                -H "Content-Type: application/json" \
                ${TEST_TOKEN:+-H "Authorization: Bearer $TEST_TOKEN"} \
                "${API_URL}/api/v1/memory/recall?query=${encoded_query}&limit=5" 2>&1)

            # Save HTTP status to separate file
            echo "$http_code" > "$RESULTS_DIR/concurrent_${i}_status.txt"

            # Also save whether it was successful (2xx status)
            if [[ "$http_code" =~ ^2 ]]; then
                echo "success" > "$RESULTS_DIR/concurrent_${i}_result.txt"
            else
                echo "failed_http_${http_code}" > "$RESULTS_DIR/concurrent_${i}_result.txt"
            fi
        ) &
    done

    # Wait for all background jobs
    wait

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    # Collect and analyze HTTP status codes
    local successful_2xx=0
    local client_errors_4xx=0
    local server_errors_5xx=0
    local other_errors=0
    declare -A status_codes

    for ((i=1; i<=CONCURRENT_REQUESTS; i++)); do
        if [[ -f "$RESULTS_DIR/concurrent_${i}_status.txt" ]]; then
            local status=$(cat "$RESULTS_DIR/concurrent_${i}_status.txt")
            status_codes["$status"]=$((${status_codes["$status"]:-0} + 1))

            case "$status" in
                2*)
                    ((successful_2xx++))
                    ;;
                4*)
                    ((client_errors_4xx++))
                    ;;
                5*)
                    ((server_errors_5xx++))
                    ;;
                *)
                    ((other_errors++))
                    ;;
            esac
        fi
    done

    log_info "Concurrent test completed in ${duration}s"
    log_info "HTTP Status Distribution:"
    for code in "${!status_codes[@]}"; do
        log_info "  - HTTP $code: ${status_codes[$code]} requests"
    done
    log_info "Summary: $successful_2xx successful (2xx), $client_errors_4xx client errors (4xx), $server_errors_5xx server errors (5xx)"

    # Save detailed status report
    cat > "$RESULTS_DIR/test6_http_status_report.txt" <<EOF
Concurrent Queries HTTP Status Report
======================================
Total Requests: $CONCURRENT_REQUESTS
Duration: ${duration}s
Timestamp: $(date)

HTTP Status Breakdown:
----------------------
2xx (Success): $successful_2xx
4xx (Client Error): $client_errors_4xx
5xx (Server Error): $server_errors_5xx
Other: $other_errors

Detailed Status Codes:
----------------------
EOF
    for code in $(echo "${!status_codes[@]}" | sort -n); do
        echo "  HTTP $code: ${status_codes[$code]}" >> "$RESULTS_DIR/test6_http_status_report.txt"
    done

    if [[ $successful_2xx -ge $((CONCURRENT_REQUESTS * 90 / 100)) ]]; then
        log_success "Concurrent queries achieved 90%+ success rate ($successful_2xx/$CONCURRENT_REQUESTS)"
    elif [[ $successful_2xx -ge $((CONCURRENT_REQUESTS * 70 / 100)) ]]; then
        log_warn "Concurrent queries success rate $successful_2xx/$CONCURRENT_REQUESTS (70-90%)"
    else
        log_error "Concurrent queries success rate below 70% ($successful_2xx/$CONCURRENT_REQUESTS)"
    fi
    ((TOTAL_TESTS++))
}

# Test 7: Memory recall with RAG chunk limit
test_rag_chunk_limit() {
    log_info "Test 7: Memory recall with RAG chunk limit"

    local chunk_limits=(1 2 5 10)
    local all_passed=true

    for limit in "${chunk_limits[@]}"; do
        local response=$(api_request "/api/v1/memory/recall?query=test&limit=10&rag_chunk_limit=$limit")
        local count=$(echo "$response" | jq '.results | length' 2>/dev/null || echo "0")

        log_info "RAG chunk limit=$limit returned $count results"
    done

    log_success "RAG chunk limit test completed"
    ((TOTAL_TESTS++))
}

# Test 8: Large query handling
test_large_query() {
    log_info "Test 8: Large query handling"

    # Create a very long query (1000+ words)
    local large_query=""
    for ((i=1; i<=100; i++)); do
        large_query+="word$i "
    done

    local start_time=$(date +%s%N)
    local response=$(api_request "/api/v1/memory/recall?query=$(echo "$large_query" | sed 's/ /%20/g')" "GET")
    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 ))

    if [[ $duration -lt 5000 ]]; then
        log_success "Large query (100 words) completed in ${duration}ms"
    else
        log_warn "Large query took ${duration}ms (> 5s)"
    fi
    ((TOTAL_TESTS++))
}

# Test 9: Special characters in queries
test_special_characters() {
    log_info "Test 9: Special characters in queries"

    local queries=(
        "test+query+with+pluses"
        "test?query&with=special"
        "test:query;with_various"
        "test/query/with/slashes"
        "test.query.with.dots"
    )

    local all_passed=true

    for query in "${queries[@]}"; do
        if api_request "/api/v1/memory/recall?query=$query" > /dev/null 2>&1; then
            log_success "Special char query handled: $query"
        else
            log_error "Special char query failed: $query"
            all_passed=false
        fi
    done

    if [[ "$all_passed" == "true" ]]; then
        log_success "All special character queries handled"
    fi
    ((TOTAL_TESTS++))
}

# Test 10: Empty/null query handling
test_empty_query() {
    log_info "Test 10: Empty query handling"

    local response=$(api_request "/api/v1/memory/recall?query=" "GET")
    local status=$?

    if [[ $status -eq 0 ]] || grep -q "error" <<< "$response"; then
        log_success "Empty query handled gracefully"
    else
        log_error "Empty query caused unexpected behavior"
    fi
    ((TOTAL_TESTS++))
}

# =============================================================================
# STRESS TESTS
# =============================================================================

# Stress test: Rapid sequential queries
stress_test_sequential() {
    log_info "Stress Test: 100 sequential rapid queries"

    local start_time=$(date +%s)
    local successful=0

    for ((i=1; i<=100; i++)); do
        if api_request "/api/v1/memory/recall?query=stress_$i&limit=5" > /dev/null 2>&1; then
            ((successful++))
        fi
    done

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local qps=$((successful / duration))

    log_info "Sequential stress test: $successful/100 successful in ${duration}s (${qps} QPS)"

    if [[ $qps -gt 10 ]]; then
        log_success "Achieved >10 QPS in sequential stress test"
    else
        log_warn "QPS below 10 in sequential stress test"
    fi
}

# Stress test: Memory recall under load
stress_test_memory_load() {
    log_info "Stress Test: Memory recall under concurrent load"

    local concurrent=20
    local queries_per_thread=10

    local start_time=$(date +%s)

    for ((thread=1; thread<=concurrent; thread++)); do
        (
            for ((q=1; q<=queries_per_thread; q++)); do
                api_request "/api/v1/memory/recall?query=load_${thread}_${q}" > /dev/null 2>&1
            done
        ) &
    done

    wait

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local total_queries=$((concurrent * queries_per_thread))
    local qps=$((total_queries / duration))

    log_info "Load stress test: $total_queries queries in ${duration}s (${qps} QPS)"

    if [[ $qps -gt 20 ]]; then
        log_success "Achieved >20 QPS under concurrent load"
    else
        log_warn "QPS below 20 under concurrent load"
    fi
}

# =============================================================================
# MAIN
# =============================================================================

main() {
    echo "========================================"
    echo "ZeroClaw RAG Limits Stress Test"
    echo "========================================"
    echo "API URL: $API_URL"
    echo "Results: $RESULTS_DIR"
    echo "========================================"
    echo ""

    check_prerequisites
    echo ""

    # Parse arguments
    local run_store=true
    local run_query=true
    local run_stress=false

    for arg in "$@"; do
        case "$arg" in
            --store-only)
                run_query=false
                run_stress=false
                ;;
            --query-only)
                run_store=false
                ;;
            --stress)
                run_stress=true
                ;;
        esac
    done

    # Run tests
    if [[ "$run_store" == "true" ]]; then
        log_info "=== STORE TESTS ==="
        test_store_single_memory
        test_bulk_store
        echo ""
    fi

    if [[ "$run_query" == "true" ]]; then
        log_info "=== QUERY TESTS ==="
        test_vector_search_limits
        test_keyword_search_performance
        test_hybrid_search
        test_concurrent_queries
        test_rag_chunk_limit
        test_large_query
        test_special_characters
        test_empty_query
        echo ""
    fi

    if [[ "$run_stress" == "true" ]]; then
        log_info "=== STRESS TESTS ==="
        stress_test_sequential
        stress_test_memory_load
        echo ""
    fi

    # Summary
    echo "========================================"
    echo "TEST SUMMARY"
    echo "========================================"
    echo "Total Tests: $TOTAL_TESTS"
    echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
    echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
    echo "Results saved to: $RESULTS_DIR"
    echo "========================================"

    # Save summary
    cat > "$RESULTS_DIR/summary.txt" <<EOF
ZeroClaw RAG Limits Stress Test Summary
========================================
Date: $(date)
API URL: $API_URL
Vector Size: $VECTOR_SIZE
Num Vectors: $NUM_VECTORS
Concurrent Requests: $CONCURRENT_REQUESTS

Results:
--------
Total Tests: $TOTAL_TESTS
Passed: $PASSED_TESTS
Failed: $FAILED_TESTS

Pass Rate: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%
EOF

    if [[ $FAILED_TESTS -gt 0 ]]; then
        exit 1
    fi
}

# Run main function
main "$@"
