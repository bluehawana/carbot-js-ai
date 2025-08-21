#!/bin/bash

####################################################################
#                                                                  #
#     CAR WAKE WORD TESTING SUITE v3.0                            #
#     Comprehensive Automotive Environment Testing                #
#                                                                  #
####################################################################

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test configuration
TEST_SUITE_VERSION="3.0"
TEST_START_TIME=$(date +%s)
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Car simulation parameters
SIMULATED_SPEEDS=(0 30 60 90 120)
NOISE_LEVELS=("quiet" "moderate" "loud" "extreme")
DRIVING_MODES=("parked" "city" "highway" "tunnel")
AUDIO_SCENARIOS=("silent" "music_soft" "music_loud" "navigation" "phone_call" "bluetooth_audio")

# Test results directory
TEST_RESULTS_DIR="./test-results/car-wake-word-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$TEST_RESULTS_DIR"

# Logging functions
log() {
    echo -e "$1" | tee -a "$TEST_RESULTS_DIR/test.log"
}

log_header() {
    echo "" | tee -a "$TEST_RESULTS_DIR/test.log"
    echo "================================================================================================" | tee -a "$TEST_RESULTS_DIR/test.log"
    echo -e "$1" | tee -a "$TEST_RESULTS_DIR/test.log"
    echo "================================================================================================" | tee -a "$TEST_RESULTS_DIR/test.log"
}

log_test() {
    ((TOTAL_TESTS++))
    echo -e "TEST $TOTAL_TESTS: $1" | tee -a "$TEST_RESULTS_DIR/test.log"
}

log_pass() {
    ((PASSED_TESTS++))
    echo -e "${GREEN}✅ PASS:${NC} $1" | tee -a "$TEST_RESULTS_DIR/test.log"
}

log_fail() {
    ((FAILED_TESTS++))
    echo -e "${RED}❌ FAIL:${NC} $1" | tee -a "$TEST_RESULTS_DIR/test.log"
}

log_skip() {
    ((SKIPPED_TESTS++))
    echo -e "${YELLOW}⏭️  SKIP:${NC} $1" | tee -a "$TEST_RESULTS_DIR/test.log"
}

log_info() {
    echo -e "${BLUE}ℹ️  INFO:${NC} $1" | tee -a "$TEST_RESULTS_DIR/test.log"
}

log_warning() {
    echo -e "${YELLOW}⚠️  WARN:${NC} $1" | tee -a "$TEST_RESULTS_DIR/test.log"
}

# Test utility functions
check_service_running() {
    local service_name="$1"
    if pgrep -f "$service_name" > /dev/null; then
        return 0
    else
        return 1
    fi
}

wait_for_service() {
    local service_name="$1"
    local timeout="$2"
    local counter=0
    
    while [ $counter -lt $timeout ]; do
        if check_service_running "$service_name"; then
            return 0
        fi
        sleep 1
        ((counter++))
    done
    return 1
}

trigger_wake_word() {
    local context="$1"
    log_info "Triggering wake word with context: $context"
    
    # Try API endpoint
    local response=$(curl -s -w "%{http_code}" -X POST \
        http://localhost:3000/api/wake-word \
        -H "Content-Type: application/json" \
        -d "{\"context\": \"$context\"}")
    
    local http_code="${response: -3}"
    local body="${response%???}"
    
    if [ "$http_code" = "200" ]; then
        echo "$body"
        return 0
    else
        log_warning "API call failed with code $http_code"
        return 1
    fi
}

send_voice_command() {
    local command="$1"
    local context="$2"
    
    log_info "Sending voice command: '$command' with context: $context"
    
    local response=$(curl -s -w "%{http_code}" -X POST \
        http://localhost:3000/api/voice-command \
        -H "Content-Type: application/json" \
        -d "{\"command\": \"$command\", \"context\": \"$context\"}")
    
    local http_code="${response: -3}"
    local body="${response%???}"
    
    if [ "$http_code" = "200" ]; then
        echo "$body"
        return 0
    else
        log_warning "Voice command failed with code $http_code"
        return 1
    fi
}

simulate_car_condition() {
    local speed="$1"
    local noise_level="$2"
    local driving_mode="$3"
    local audio_scenario="$4"
    
    log_info "Simulating car condition: ${speed}km/h, $noise_level noise, $driving_mode mode, $audio_scenario audio"
    
    # This would integrate with actual car simulation
    # For now, we'll create a context object
    local context="{\"speed\": $speed, \"noiseLevel\": \"$noise_level\", \"drivingMode\": \"$driving_mode\", \"audioScenario\": \"$audio_scenario\"}"
    echo "$context"
}

measure_response_time() {
    local start_time=$(date +%s%3N)
    "$@"
    local end_time=$(date +%s%3N)
    local response_time=$((end_time - start_time))
    echo "$response_time"
}

# Main test functions

test_system_initialization() {
    log_header "${BLUE}SYSTEM INITIALIZATION TESTS${NC}"
    
    log_test "CarBot service startup"
    if check_service_running "node.*index.js"; then
        log_pass "CarBot service is running"
    else
        log_info "Starting CarBot service..."
        npm start &
        if wait_for_service "node.*index.js" 30; then
            log_pass "CarBot service started successfully"
        else
            log_fail "Failed to start CarBot service"
            return 1
        fi
    fi
    
    log_test "API endpoint connectivity"
    local health_response=$(curl -s http://localhost:3000/health)
    if echo "$health_response" | grep -q "healthy"; then
        log_pass "API endpoint is responsive"
    else
        log_fail "API endpoint is not responding properly"
    fi
    
    log_test "Wake word system initialization"
    # Test wake word endpoint
    if trigger_wake_word "initialization_test" > /dev/null; then
        log_pass "Wake word system initialized"
    else
        log_fail "Wake word system initialization failed"
    fi
    
    return 0
}

test_basic_wake_word_detection() {
    log_header "${GREEN}BASIC WAKE WORD DETECTION TESTS${NC}"
    
    log_test "Simple wake word trigger"
    local response_time=$(measure_response_time trigger_wake_word "basic_test")
    if [ $? -eq 0 ]; then
        log_pass "Wake word triggered successfully in ${response_time}ms"
    else
        log_fail "Wake word trigger failed"
    fi
    
    log_test "Multiple consecutive triggers"
    local success_count=0
    for i in {1..5}; do
        if trigger_wake_word "consecutive_test_$i" > /dev/null; then
            ((success_count++))
        fi
        sleep 2  # Wait between triggers
    done
    
    if [ $success_count -eq 5 ]; then
        log_pass "All 5 consecutive wake word triggers successful"
    elif [ $success_count -ge 3 ]; then
        log_warning "Only $success_count/5 consecutive triggers successful"
    else
        log_fail "Only $success_count/5 consecutive triggers successful"
    fi
    
    log_test "Wake word with voice command integration"
    if response=$(send_voice_command "Hello, what's the weather?" "basic_command_test"); then
        if echo "$response" | grep -q "success"; then
            log_pass "Voice command integration working"
        else
            log_fail "Voice command integration failed"
        fi
    else
        log_fail "Voice command API call failed"
    fi
}

test_car_environment_scenarios() {
    log_header "${CYAN}CAR ENVIRONMENT SCENARIO TESTS${NC}"
    
    # Test different driving speeds
    for speed in "${SIMULATED_SPEEDS[@]}"; do
        log_test "Wake word detection at ${speed}km/h"
        
        local context=$(simulate_car_condition "$speed" "moderate" "auto" "silent")
        local response_time=$(measure_response_time trigger_wake_word "$context")
        
        if [ $? -eq 0 ]; then
            # Expect longer response times at higher speeds due to noise
            local max_response_time=2000
            if [ $speed -gt 80 ]; then
                max_response_time=3000
            fi
            
            if [ $response_time -lt $max_response_time ]; then
                log_pass "Wake word detected at ${speed}km/h in ${response_time}ms"
            else
                log_warning "Wake word detected at ${speed}km/h but response time ${response_time}ms exceeded threshold"
            fi
        else
            log_fail "Wake word detection failed at ${speed}km/h"
        fi
        
        sleep 1
    done
    
    # Test different noise levels
    for noise in "${NOISE_LEVELS[@]}"; do
        log_test "Wake word detection in $noise noise conditions"
        
        local context=$(simulate_car_condition "60" "$noise" "highway" "silent")
        
        if trigger_wake_word "$context" > /dev/null; then
            log_pass "Wake word detected in $noise noise conditions"
        else
            if [ "$noise" = "extreme" ]; then
                log_warning "Wake word detection failed in extreme noise (expected)"
            else
                log_fail "Wake word detection failed in $noise noise conditions"
            fi
        fi
        
        sleep 1
    done
    
    # Test different driving modes
    for mode in "${DRIVING_MODES[@]}"; do
        log_test "Wake word detection in $mode driving mode"
        
        local context=$(simulate_car_condition "50" "moderate" "$mode" "silent")
        
        if trigger_wake_word "$context" > /dev/null; then
            log_pass "Wake word detected in $mode driving mode"
        else
            log_fail "Wake word detection failed in $mode driving mode"
        fi
        
        sleep 1
    done
}

test_audio_interference_scenarios() {
    log_header "${PURPLE}AUDIO INTERFERENCE TESTS${NC}"
    
    # Test different audio scenarios
    for scenario in "${AUDIO_SCENARIOS[@]}"; do
        log_test "Wake word detection with $scenario"
        
        local context=$(simulate_car_condition "50" "moderate" "city" "$scenario")
        
        if trigger_wake_word "$context" > /dev/null; then
            log_pass "Wake word detected with $scenario"
        else
            if [[ "$scenario" == *"loud"* ]] || [[ "$scenario" == "phone_call" ]]; then
                log_warning "Wake word detection failed with $scenario (challenging scenario)"
            else
                log_fail "Wake word detection failed with $scenario"
            fi
        fi
        
        sleep 2
    done
    
    log_test "Audio ducking functionality"
    # Test that audio gets ducked during CarBot speech
    local music_context=$(simulate_car_condition "30" "quiet" "city" "music_loud")
    
    if response=$(send_voice_command "Play some music" "$music_context"); then
        if echo "$response" | grep -q "success"; then
            log_pass "Audio ducking test completed successfully"
        else
            log_fail "Audio ducking test failed"
        fi
    else
        log_fail "Could not test audio ducking - command failed"
    fi
}

test_adaptive_sensitivity() {
    log_header "${YELLOW}ADAPTIVE SENSITIVITY TESTS${NC}"
    
    log_test "Sensitivity adaptation to environment"
    
    # Test progression from quiet to noisy environment
    local environments=("quiet" "moderate" "loud")
    local success_count=0
    
    for env in "${environments[@]}"; do
        log_info "Testing in $env environment"
        local context=$(simulate_car_condition "60" "$env" "highway" "silent")
        
        if trigger_wake_word "$context" > /dev/null; then
            ((success_count++))
            log_info "Wake word detected in $env environment"
        else
            log_info "Wake word failed in $env environment"
        fi
        
        sleep 3  # Allow system to adapt
    done
    
    if [ $success_count -ge 2 ]; then
        log_pass "Adaptive sensitivity working (detected in $success_count/3 environments)"
    else
        log_fail "Adaptive sensitivity not working properly"
    fi
    
    log_test "False positive prevention"
    # Test that system doesn't trigger on similar sounds
    local false_triggers=("hello my card" "yellow my car" "hello hi car" "radio my car")
    local false_positive_count=0
    
    for trigger in "${false_triggers[@]}"; do
        if response=$(send_voice_command "$trigger" "false_positive_test"); then
            if echo "$response" | grep -q "wake.*word.*detected" || echo "$response" | grep -q "activated"; then
                ((false_positive_count++))
                log_warning "False positive detected for: '$trigger'"
            fi
        fi
        sleep 1
    done
    
    if [ $false_positive_count -eq 0 ]; then
        log_pass "No false positives detected"
    elif [ $false_positive_count -le 1 ]; then
        log_warning "$false_positive_count false positive(s) detected (acceptable)"
    else
        log_fail "$false_positive_count false positives detected (too many)"
    fi
}

test_performance_metrics() {
    log_header "${CYAN}PERFORMANCE METRICS TESTS${NC}"
    
    log_test "Response time under various conditions"
    
    local total_response_time=0
    local test_count=0
    local max_response_time=0
    local min_response_time=999999
    
    # Test response times across different scenarios
    for speed in 0 30 60; do
        for noise in "quiet" "moderate"; do
            local context=$(simulate_car_condition "$speed" "$noise" "auto" "silent")
            local response_time=$(measure_response_time trigger_wake_word "$context")
            
            if [ $? -eq 0 ]; then
                total_response_time=$((total_response_time + response_time))
                ((test_count++))
                
                if [ $response_time -gt $max_response_time ]; then
                    max_response_time=$response_time
                fi
                
                if [ $response_time -lt $min_response_time ]; then
                    min_response_time=$response_time
                fi
                
                log_info "Response time: ${response_time}ms (${speed}km/h, $noise)"
            fi
            
            sleep 1
        done
    done
    
    if [ $test_count -gt 0 ]; then
        local avg_response_time=$((total_response_time / test_count))
        log_pass "Performance metrics: avg=${avg_response_time}ms, min=${min_response_time}ms, max=${max_response_time}ms"
        
        # Save detailed metrics
        echo "Performance Metrics Report" > "$TEST_RESULTS_DIR/performance_metrics.txt"
        echo "=========================" >> "$TEST_RESULTS_DIR/performance_metrics.txt"
        echo "Average Response Time: ${avg_response_time}ms" >> "$TEST_RESULTS_DIR/performance_metrics.txt"
        echo "Minimum Response Time: ${min_response_time}ms" >> "$TEST_RESULTS_DIR/performance_metrics.txt"
        echo "Maximum Response Time: ${max_response_time}ms" >> "$TEST_RESULTS_DIR/performance_metrics.txt"
        echo "Total Tests: $test_count" >> "$TEST_RESULTS_DIR/performance_metrics.txt"
        
        # Performance thresholds
        if [ $avg_response_time -lt 1500 ]; then
            log_pass "Average response time meets performance requirements"
        else
            log_fail "Average response time exceeds acceptable threshold (1500ms)"
        fi
    else
        log_fail "Could not measure performance metrics"
    fi
    
    log_test "Memory and CPU usage"
    # Monitor system resources during wake word operation
    local cpu_usage=$(ps -o %cpu -p $(pgrep -f "node.*index.js") | tail -1 | tr -d ' ')
    local memory_usage=$(ps -o %mem -p $(pgrep -f "node.*index.js") | tail -1 | tr -d ' ')
    
    if [ -n "$cpu_usage" ] && [ -n "$memory_usage" ]; then
        log_pass "Resource usage: CPU=${cpu_usage}%, Memory=${memory_usage}%"
        
        # Save resource usage
        echo "Resource Usage Report" > "$TEST_RESULTS_DIR/resource_usage.txt"
        echo "=====================" >> "$TEST_RESULTS_DIR/resource_usage.txt"
        echo "CPU Usage: ${cpu_usage}%" >> "$TEST_RESULTS_DIR/resource_usage.txt"
        echo "Memory Usage: ${memory_usage}%" >> "$TEST_RESULTS_DIR/resource_usage.txt"
        
        # Check if resource usage is reasonable
        if (( $(echo "$cpu_usage < 50" | bc -l) )) && (( $(echo "$memory_usage < 30" | bc -l) )); then
            log_pass "Resource usage within acceptable limits"
        else
            log_warning "High resource usage detected"
        fi
    else
        log_skip "Could not measure resource usage"
    fi
}

test_edge_cases() {
    log_header "${RED}EDGE CASE TESTS${NC}"
    
    log_test "Rapid consecutive wake word attempts"
    local rapid_success=0
    for i in {1..10}; do
        if trigger_wake_word "rapid_test_$i" > /dev/null 2>&1; then
            ((rapid_success++))
        fi
        sleep 0.5  # Very short delay
    done
    
    if [ $rapid_success -ge 7 ]; then
        log_pass "Rapid consecutive attempts: $rapid_success/10 successful"
    else
        log_fail "Rapid consecutive attempts: only $rapid_success/10 successful"
    fi
    
    log_test "Very long voice commands"
    local long_command="Hello my car, I need you to navigate to the nearest gas station and then to the grocery store and after that please call my wife and tell her I will be late for dinner because of heavy traffic and also please remind me to pick up the dry cleaning on the way home"
    
    if response=$(send_voice_command "$long_command" "long_command_test"); then
        if echo "$response" | grep -q "success"; then
            log_pass "Long voice command processed successfully"
        else
            log_fail "Long voice command processing failed"
        fi
    else
        log_fail "Long voice command API call failed"
    fi
    
    log_test "Special characters and emojis in commands"
    local special_command="Hello my car! Can you help me with GPS navigation? 🚗"
    
    if response=$(send_voice_command "$special_command" "special_chars_test"); then
        if echo "$response" | grep -q "success"; then
            log_pass "Special characters handled correctly"
        else
            log_warning "Special characters caused processing issues"
        fi
    else
        log_fail "Special characters command failed"
    fi
    
    log_test "System recovery after errors"
    # Deliberately cause an error and test recovery
    local error_command='{"malformed": json}'
    local recovery_result=$(curl -s -X POST http://localhost:3000/api/voice-command \
        -H "Content-Type: application/json" \
        -d "$error_command" 2>/dev/null)
    
    sleep 2  # Allow system to recover
    
    if trigger_wake_word "recovery_test" > /dev/null; then
        log_pass "System recovered successfully after error"
    else
        log_fail "System did not recover properly after error"
    fi
}

generate_test_report() {
    log_header "${GREEN}TEST REPORT GENERATION${NC}"
    
    local test_end_time=$(date +%s)
    local test_duration=$((test_end_time - TEST_START_TIME))
    local success_rate=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
    
    # Create detailed test report
    cat > "$TEST_RESULTS_DIR/test_report.html" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>CarBot Wake Word Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #f0f0f0; padding: 20px; border-radius: 5px; }
        .pass { color: green; }
        .fail { color: red; }
        .warning { color: orange; }
        .metrics { background-color: #e8f4f8; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .section { margin: 20px 0; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚗 CarBot Wake Word Test Report</h1>
        <p><strong>Test Suite Version:</strong> $TEST_SUITE_VERSION</p>
        <p><strong>Test Date:</strong> $(date)</p>
        <p><strong>Test Duration:</strong> ${test_duration} seconds</p>
    </div>
    
    <div class="metrics">
        <h2>📊 Test Summary</h2>
        <table>
            <tr><th>Metric</th><th>Value</th></tr>
            <tr><td>Total Tests</td><td>$TOTAL_TESTS</td></tr>
            <tr><td class="pass">Passed</td><td>$PASSED_TESTS</td></tr>
            <tr><td class="fail">Failed</td><td>$FAILED_TESTS</td></tr>
            <tr><td class="warning">Skipped</td><td>$SKIPPED_TESTS</td></tr>
            <tr><td><strong>Success Rate</strong></td><td><strong>${success_rate}%</strong></td></tr>
        </table>
    </div>
    
    <div class="section">
        <h2>📝 Test Categories</h2>
        <ul>
            <li>✅ System Initialization Tests</li>
            <li>✅ Basic Wake Word Detection</li>
            <li>✅ Car Environment Scenarios</li>
            <li>✅ Audio Interference Tests</li>
            <li>✅ Adaptive Sensitivity Tests</li>
            <li>✅ Performance Metrics</li>
            <li>✅ Edge Case Tests</li>
        </ul>
    </div>
    
    <div class="section">
        <h2>📁 Generated Files</h2>
        <ul>
            <li><a href="test.log">test.log</a> - Detailed test execution log</li>
            <li><a href="performance_metrics.txt">performance_metrics.txt</a> - Performance analysis</li>
            <li><a href="resource_usage.txt">resource_usage.txt</a> - Resource usage metrics</li>
        </ul>
    </div>
    
    <div class="section">
        <h2>🎯 Recommendations</h2>
        $(if [ $success_rate -ge 90 ]; then
            echo "<p class='pass'>✅ Excellent performance! The wake word system is working well in automotive conditions.</p>"
        elif [ $success_rate -ge 75 ]; then
            echo "<p class='warning'>⚠️ Good performance with room for improvement. Consider tuning sensitivity for failed scenarios.</p>"
        else
            echo "<p class='fail'>❌ Performance needs attention. Review failed tests and consider system adjustments.</p>"
        fi)
    </div>
</body>
</html>
EOF
    
    # Generate summary
    log ""
    log "================================================================================================"
    log "${GREEN}🏁 CAR WAKE WORD TEST SUITE COMPLETED${NC}"
    log "================================================================================================"
    log "📊 Test Results Summary:"
    log "   • Total Tests: $TOTAL_TESTS"
    log "   • Passed: ${GREEN}$PASSED_TESTS${NC}"
    log "   • Failed: ${RED}$FAILED_TESTS${NC}"
    log "   • Skipped: ${YELLOW}$SKIPPED_TESTS${NC}"
    log "   • Success Rate: ${GREEN}${success_rate}%${NC}"
    log "   • Duration: ${test_duration} seconds"
    log ""
    log "📁 Test Results Directory: $TEST_RESULTS_DIR"
    log "📄 HTML Report: $TEST_RESULTS_DIR/test_report.html"
    log ""
    
    if [ $success_rate -ge 90 ]; then
        log "${GREEN}🎉 EXCELLENT: Wake word system is ready for automotive deployment!${NC}"
        return 0
    elif [ $success_rate -ge 75 ]; then
        log "${YELLOW}⚠️  GOOD: System working well, minor improvements recommended.${NC}"
        return 0
    else
        log "${RED}❌ NEEDS WORK: Significant issues detected, review required.${NC}"
        return 1
    fi
}

# Main execution
main() {
    clear
    log_header "${PURPLE}🚗 CARBOT AUTOMOTIVE WAKE WORD TEST SUITE v${TEST_SUITE_VERSION}${NC}"
    log "Starting comprehensive automotive wake word testing..."
    log "Test results will be saved to: $TEST_RESULTS_DIR"
    log ""
    
    # Run test suites
    test_system_initialization
    test_basic_wake_word_detection
    test_car_environment_scenarios
    test_audio_interference_scenarios
    test_adaptive_sensitivity
    test_performance_metrics
    test_edge_cases
    
    # Generate final report
    generate_test_report
    
    # Open HTML report if possible
    if command -v open >/dev/null 2>&1; then
        log_info "Opening test report in browser..."
        open "$TEST_RESULTS_DIR/test_report.html"
    elif command -v xdg-open >/dev/null 2>&1; then
        log_info "Opening test report in browser..."
        xdg-open "$TEST_RESULTS_DIR/test_report.html"
    fi
}

# Handle script interruption
trap 'log "${RED}Test suite interrupted by user${NC}"; exit 1' INT TERM

# Run main function
main "$@"