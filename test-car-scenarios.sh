#!/bin/bash

####################################################################
#                                                                  #
#     CAR SCENARIO SIMULATION TESTING v2.0                        #
#     Real-world Automotive Environment Testing                   #
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
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_RESULTS_DIR="./test-results/car-scenarios-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$TEST_RESULTS_DIR"

# Car scenario definitions
declare -A CAR_SCENARIOS=(
    ["morning_commute"]="speed:45,noise:moderate,music:on,navigation:off,traffic:heavy"
    ["highway_cruise"]="speed:100,noise:loud,music:off,navigation:on,traffic:light"
    ["city_driving"]="speed:25,noise:high,music:on,navigation:on,traffic:heavy"
    ["parking_lot"]="speed:5,noise:quiet,music:off,navigation:off,traffic:none"
    ["tunnel_drive"]="speed:60,noise:extreme,music:off,navigation:on,traffic:moderate"
    ["rain_driving"]="speed:40,noise:high,music:on,navigation:on,traffic:moderate"
    ["night_drive"]="speed:70,noise:moderate,music:on,navigation:off,traffic:light"
    ["phone_call"]="speed:50,noise:moderate,music:off,navigation:off,phone:active"
    ["passenger_conversation"]="speed:60,noise:moderate,music:soft,passengers:talking"
    ["emergency_situation"]="speed:80,noise:extreme,music:off,navigation:off,emergency:true"
)

# Audio test phrases for different contexts
MORNING_COMMUTE_PHRASES=(
    "Hello my car, what's the traffic like ahead?"
    "Hello my car, call my office"
    "Hello my car, play my morning playlist"
    "Hello my car, set temperature to 72 degrees"
)

HIGHWAY_PHRASES=(
    "Hello my car, find the nearest gas station"
    "Hello my car, what's my ETA?"
    "Hello my car, increase volume"
    "Hello my car, call roadside assistance"
)

CITY_PHRASES=(
    "Hello my car, find parking nearby"
    "Hello my car, avoid tolls"
    "Hello my car, what's that restaurant?"
    "Hello my car, text my wife I'm running late"
)

EMERGENCY_PHRASES=(
    "Hello my car, call 911"
    "Hello my car, emergency assistance"
    "Hello my car, I need help"
    "Hello my car, contact emergency services"
)

# Logging functions
log() {
    echo -e "$1" | tee -a "$TEST_RESULTS_DIR/scenario_test.log"
}

log_header() {
    echo "" | tee -a "$TEST_RESULTS_DIR/scenario_test.log"
    echo "================================================================================================" | tee -a "$TEST_RESULTS_DIR/scenario_test.log"
    echo -e "$1" | tee -a "$TEST_RESULTS_DIR/scenario_test.log"
    echo "================================================================================================" | tee -a "$TEST_RESULTS_DIR/scenario_test.log"
}

log_scenario() {
    echo -e "${CYAN}🚗 SCENARIO:${NC} $1" | tee -a "$TEST_RESULTS_DIR/scenario_test.log"
}

log_pass() {
    echo -e "${GREEN}✅ PASS:${NC} $1" | tee -a "$TEST_RESULTS_DIR/scenario_test.log"
}

log_fail() {
    echo -e "${RED}❌ FAIL:${NC} $1" | tee -a "$TEST_RESULTS_DIR/scenario_test.log"
}

log_info() {
    echo -e "${BLUE}ℹ️  INFO:${NC} $1" | tee -a "$TEST_RESULTS_DIR/scenario_test.log"
}

# Scenario simulation functions
simulate_scenario() {
    local scenario_name="$1"
    local scenario_params="${CAR_SCENARIOS[$scenario_name]}"
    
    log_scenario "Setting up $scenario_name scenario"
    log_info "Parameters: $scenario_params"
    
    # Parse scenario parameters
    local speed=$(echo "$scenario_params" | grep -o 'speed:[0-9]*' | cut -d: -f2)
    local noise=$(echo "$scenario_params" | grep -o 'noise:[a-z]*' | cut -d: -f2)
    local music=$(echo "$scenario_params" | grep -o 'music:[a-z]*' | cut -d: -f2)
    local navigation=$(echo "$scenario_params" | grep -o 'navigation:[a-z]*' | cut -d: -f2)
    local traffic=$(echo "$scenario_params" | grep -o 'traffic:[a-z]*' | cut -d: -f2)
    local phone=$(echo "$scenario_params" | grep -o 'phone:[a-z]*' | cut -d: -f2)
    local emergency=$(echo "$scenario_params" | grep -o 'emergency:[a-z]*' | cut -d: -f2)
    
    # Create context object
    local context="{\"scenario\":\"$scenario_name\",\"speed\":$speed,\"noise\":\"$noise\",\"music\":\"$music\",\"navigation\":\"$navigation\",\"traffic\":\"$traffic\""
    
    if [ -n "$phone" ]; then
        context="$context,\"phone\":\"$phone\""
    fi
    
    if [ -n "$emergency" ]; then
        context="$context,\"emergency\":\"$emergency\""
    fi
    
    context="$context}"
    
    echo "$context"
}

test_wake_word_in_scenario() {
    local scenario_name="$1"
    local context="$2"
    
    log_info "Testing wake word detection in $scenario_name"
    
    # Test wake word trigger
    local response=$(curl -s -w "%{http_code}" -X POST \
        http://localhost:3000/api/wake-word \
        -H "Content-Type: application/json" \
        -d "$context")
    
    local http_code="${response: -3}"
    local body="${response%???}"
    
    if [ "$http_code" = "200" ]; then
        log_pass "Wake word triggered successfully in $scenario_name"
        return 0
    else
        log_fail "Wake word failed in $scenario_name (HTTP $http_code)"
        return 1
    fi
}

test_voice_commands_in_scenario() {
    local scenario_name="$1"
    local context="$2"
    local phrases_var="${scenario_name^^}_PHRASES[@]"
    
    # Get appropriate phrases for this scenario
    local phrases
    case "$scenario_name" in
        "morning_commute")
            phrases=("${MORNING_COMMUTE_PHRASES[@]}")
            ;;
        "highway_cruise")
            phrases=("${HIGHWAY_PHRASES[@]}")
            ;;
        "city_driving")
            phrases=("${CITY_PHRASES[@]}")
            ;;
        "emergency_situation")
            phrases=("${EMERGENCY_PHRASES[@]}")
            ;;
        *)
            phrases=("Hello my car, help me" "Hello my car, what can you do?")
            ;;
    esac
    
    local success_count=0
    local total_phrases=${#phrases[@]}
    
    log_info "Testing $total_phrases voice commands in $scenario_name"
    
    for phrase in "${phrases[@]}"; do
        log_info "Testing: '$phrase'"
        
        local response=$(curl -s -w "%{http_code}" -X POST \
            http://localhost:3000/api/voice-command \
            -H "Content-Type: application/json" \
            -d "{\"command\":\"$phrase\",\"context\":$context}")
        
        local http_code="${response: -3}"
        local body="${response%???}"
        
        if [ "$http_code" = "200" ] && echo "$body" | grep -q '"success":true'; then
            ((success_count++))
            log_info "✓ Command successful"
        else
            log_info "✗ Command failed"
        fi
        
        sleep 2  # Wait between commands
    done
    
    local success_rate=$(( (success_count * 100) / total_phrases ))
    
    if [ $success_rate -ge 80 ]; then
        log_pass "$scenario_name: $success_count/$total_phrases commands successful ($success_rate%)"
    elif [ $success_rate -ge 60 ]; then
        log_info "$scenario_name: $success_count/$total_phrases commands successful ($success_rate%) - Acceptable"
    else
        log_fail "$scenario_name: Only $success_count/$total_phrases commands successful ($success_rate%)"
    fi
    
    return $success_count
}

test_response_time_in_scenario() {
    local scenario_name="$1"
    local context="$2"
    
    log_info "Testing response times in $scenario_name"
    
    local total_time=0
    local test_count=0
    local max_time=0
    
    for i in {1..5}; do
        local start_time=$(date +%s%3N)
        
        local response=$(curl -s -X POST \
            http://localhost:3000/api/wake-word \
            -H "Content-Type: application/json" \
            -d "$context")
        
        local end_time=$(date +%s%3N)
        local response_time=$((end_time - start_time))
        
        if echo "$response" | grep -q '"success":true'; then
            total_time=$((total_time + response_time))
            ((test_count++))
            
            if [ $response_time -gt $max_time ]; then
                max_time=$response_time
            fi
            
            log_info "Response $i: ${response_time}ms"
        fi
        
        sleep 1
    done
    
    if [ $test_count -gt 0 ]; then
        local avg_time=$((total_time / test_count))
        log_info "Average response time: ${avg_time}ms (max: ${max_time}ms)"
        
        # Save response time data
        echo "$scenario_name,$avg_time,$max_time,$test_count" >> "$TEST_RESULTS_DIR/response_times.csv"
        
        # Check if response time is acceptable for scenario
        local max_acceptable=2000  # Default 2 seconds
        
        case "$scenario_name" in
            "emergency_situation")
                max_acceptable=1000  # Emergency should be faster
                ;;
            "highway_cruise")
                max_acceptable=2500  # Can be slower on highway due to noise
                ;;
            "tunnel_drive")
                max_acceptable=3000  # Tunnels are challenging
                ;;
        esac
        
        if [ $avg_time -le $max_acceptable ]; then
            log_pass "Response time acceptable for $scenario_name (${avg_time}ms ≤ ${max_acceptable}ms)"
        else
            log_fail "Response time too slow for $scenario_name (${avg_time}ms > ${max_acceptable}ms)"
        fi
    else
        log_fail "Could not measure response times in $scenario_name"
    fi
}

test_audio_ducking_in_scenario() {
    local scenario_name="$1"
    local context="$2"
    
    # Only test ducking in scenarios with music
    if echo "$context" | grep -q '"music":"on"' || echo "$context" | grep -q '"music":"soft"'; then
        log_info "Testing audio ducking in $scenario_name"
        
        # Send a command that should trigger TTS response
        local response=$(curl -s -X POST \
            http://localhost:3000/api/voice-command \
            -H "Content-Type: application/json" \
            -d "{\"command\":\"Hello my car, test audio ducking\",\"context\":$context}")
        
        if echo "$response" | grep -q '"success":true'; then
            log_pass "Audio ducking test completed in $scenario_name"
        else
            log_fail "Audio ducking test failed in $scenario_name"
        fi
    else
        log_info "No music in $scenario_name - skipping audio ducking test"
    fi
}

run_stress_test_scenario() {
    local scenario_name="$1"
    local context="$2"
    
    log_info "Running stress test in $scenario_name"
    
    local success_count=0
    local total_attempts=20
    
    for i in $(seq 1 $total_attempts); do
        local response=$(curl -s -X POST \
            http://localhost:3000/api/wake-word \
            -H "Content-Type: application/json" \
            -d "$context" 2>/dev/null)
        
        if echo "$response" | grep -q '"success":true'; then
            ((success_count++))
        fi
        
        # Vary the timing to simulate real usage
        local delay=$(( (RANDOM % 3) + 1 ))
        sleep $delay
        
        # Progress indicator
        if [ $((i % 5)) -eq 0 ]; then
            log_info "Stress test progress: $i/$total_attempts"
        fi
    done
    
    local success_rate=$(( (success_count * 100) / total_attempts ))
    
    if [ $success_rate -ge 85 ]; then
        log_pass "Stress test in $scenario_name: $success_count/$total_attempts successful ($success_rate%)"
    elif [ $success_rate -ge 70 ]; then
        log_info "Stress test in $scenario_name: $success_count/$total_attempts successful ($success_rate%) - Acceptable under stress"
    else
        log_fail "Stress test in $scenario_name: Only $success_count/$total_attempts successful ($success_rate%)"
    fi
}

generate_scenario_report() {
    log_header "${GREEN}SCENARIO TEST REPORT${NC}"
    
    # Create CSV header for response times if not exists
    if [ ! -f "$TEST_RESULTS_DIR/response_times.csv" ]; then
        echo "Scenario,AvgResponseTime,MaxResponseTime,TestCount" > "$TEST_RESULTS_DIR/response_times.csv"
    fi
    
    # Generate comprehensive report
    cat > "$TEST_RESULTS_DIR/scenario_report.html" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>CarBot Scenario Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { background-color: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 5px; text-align: center; }
        .scenario { background-color: #f8f9fa; margin: 15px 0; padding: 15px; border-radius: 5px; border-left: 4px solid #007bff; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .metric-card { background-color: #e8f4f8; padding: 15px; border-radius: 5px; text-align: center; }
        .pass { color: #28a745; font-weight: bold; }
        .fail { color: #dc3545; font-weight: bold; }
        .warning { color: #ffc107; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; font-weight: bold; }
        .chart { margin: 20px 0; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚗 CarBot Automotive Scenario Testing</h1>
            <p>Comprehensive Real-World Environment Testing</p>
            <p><strong>Test Date:</strong> $(date)</p>
        </div>
        
        <div class="metrics">
            <div class="metric-card">
                <h3>📊 Total Scenarios</h3>
                <p style="font-size: 2em; margin: 0;">${#CAR_SCENARIOS[@]}</p>
            </div>
            <div class="metric-card">
                <h3>🎯 Test Categories</h3>
                <p>Wake Word Detection<br/>Voice Commands<br/>Response Times<br/>Audio Ducking<br/>Stress Testing</p>
            </div>
            <div class="metric-card">
                <h3>🚗 Environments</h3>
                <p>City • Highway • Parking<br/>Tunnel • Rain • Night<br/>Emergency • Calls</p>
            </div>
        </div>
        
        <h2>🎭 Tested Scenarios</h2>
EOF
    
    # Add scenario descriptions
    for scenario in "${!CAR_SCENARIOS[@]}"; do
        local params="${CAR_SCENARIOS[$scenario]}"
        cat >> "$TEST_RESULTS_DIR/scenario_report.html" << EOF
        <div class="scenario">
            <h3>🚗 ${scenario//_/ }</h3>
            <p><strong>Parameters:</strong> $params</p>
            <p><strong>Description:</strong> Simulates real-world driving conditions for this specific scenario.</p>
        </div>
EOF
    done
    
    # Add response time chart if data exists
    if [ -f "$TEST_RESULTS_DIR/response_times.csv" ] && [ $(wc -l < "$TEST_RESULTS_DIR/response_times.csv") -gt 1 ]; then
        cat >> "$TEST_RESULTS_DIR/scenario_report.html" << 'EOF'
        
        <h2>📈 Response Time Analysis</h2>
        <div class="chart">
            <p>Response times measured across different automotive scenarios:</p>
            <table>
                <tr><th>Scenario</th><th>Avg Response Time (ms)</th><th>Max Response Time (ms)</th><th>Test Count</th></tr>
EOF
        
        tail -n +2 "$TEST_RESULTS_DIR/response_times.csv" | while IFS=, read scenario avg_time max_time count; do
            echo "                <tr><td>${scenario//_/ }</td><td>$avg_time</td><td>$max_time</td><td>$count</td></tr>" >> "$TEST_RESULTS_DIR/scenario_report.html"
        done
        
        cat >> "$TEST_RESULTS_DIR/scenario_report.html" << 'EOF'
            </table>
        </div>
EOF
    fi
    
    cat >> "$TEST_RESULTS_DIR/scenario_report.html" << 'EOF'
        
        <h2>🔍 Test Results</h2>
        <p>Detailed test results can be found in the <a href="scenario_test.log">scenario_test.log</a> file.</p>
        
        <h2>💡 Recommendations</h2>
        <ul>
            <li><strong>Emergency Scenarios:</strong> Ensure sub-1-second response times for critical situations</li>
            <li><strong>Highway Driving:</strong> Optimize noise cancellation for high-speed environments</li>
            <li><strong>City Driving:</strong> Improve filtering for complex audio interference</li>
            <li><strong>Audio Ducking:</strong> Fine-tune music ducking levels for different genres</li>
        </ul>
        
        <div style="margin-top: 30px; padding: 15px; background-color: #d4edda; border-radius: 5px; border: 1px solid #c3e6cb;">
            <h3>✅ Next Steps</h3>
            <p>Based on these scenario tests, consider:</p>
            <ul>
                <li>Tuning sensitivity for problematic scenarios</li>
                <li>Implementing scenario-specific audio processing</li>
                <li>Adding car manufacturer-specific optimizations</li>
                <li>Integrating with additional car sensors for context</li>
            </ul>
        </div>
    </div>
</body>
</html>
EOF
    
    log_pass "Scenario test report generated: $TEST_RESULTS_DIR/scenario_report.html"
}

# Main execution
main() {
    log_header "${PURPLE}🚗 CARBOT SCENARIO TESTING SUITE${NC}"
    log "Testing CarBot wake word detection across realistic automotive scenarios..."
    log ""
    
    # Initialize CSV for response times
    echo "Scenario,AvgResponseTime,MaxResponseTime,TestCount" > "$TEST_RESULTS_DIR/response_times.csv"
    
    # Test each car scenario
    for scenario_name in "${!CAR_SCENARIOS[@]}"; do
        log_header "${CYAN}Testing Scenario: ${scenario_name^^}${NC}"
        
        # Set up scenario
        local context=$(simulate_scenario "$scenario_name")
        
        # Run comprehensive tests for this scenario
        test_wake_word_in_scenario "$scenario_name" "$context"
        sleep 2
        
        test_voice_commands_in_scenario "$scenario_name" "$context"
        sleep 2
        
        test_response_time_in_scenario "$scenario_name" "$context"
        sleep 2
        
        test_audio_ducking_in_scenario "$scenario_name" "$context"
        sleep 2
        
        # Run stress test for critical scenarios
        if [[ "$scenario_name" == "emergency_situation" ]] || [[ "$scenario_name" == "highway_cruise" ]]; then
            run_stress_test_scenario "$scenario_name" "$context"
        fi
        
        log_info "Scenario $scenario_name completed"
        sleep 3  # Rest between scenarios
    done
    
    # Generate comprehensive report
    generate_scenario_report
    
    log ""
    log_header "${GREEN}🏁 SCENARIO TESTING COMPLETED${NC}"
    log "Test results saved to: $TEST_RESULTS_DIR"
    log "Open scenario_report.html for detailed analysis"
    
    # Open report if possible
    if command -v open >/dev/null 2>&1; then
        open "$TEST_RESULTS_DIR/scenario_report.html"
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$TEST_RESULTS_DIR/scenario_report.html"
    fi
}

# Handle interruption
trap 'log "${RED}Scenario testing interrupted${NC}"; exit 1' INT TERM

# Run main function
main "$@"