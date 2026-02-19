#!/bin/bash
# Health Check & Monitoring Script
# Usage: ./health-check.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
PASS=0
FAIL=0
WARN=0

# Helper functions
check_status() {
    local name=$1
    local status=$2
    
    if [ $status -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $name"
        ((PASS++))
    else
        echo -e "${RED}✗${NC} $name"
        ((FAIL++))
    fi
}

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════${NC}"
}

# Check Docker
print_header "Docker Installation"
docker --version && check_status "Docker" 0 || check_status "Docker" 1
docker-compose --version && check_status "Docker Compose" 0 || check_status "Docker Compose" 1

# Check Running Containers
print_header "Running Containers"
RUNNING=$(docker-compose ps --services --filter "status=running" 2>/dev/null | wc -l)
TOTAL=$(docker-compose ps --services 2>/dev/null | wc -l)

echo "Running: $RUNNING / $TOTAL services"

docker composeps --format "table {{.Service}}\t{{.Status}}" 2>/dev/null || echo "Could not get container status"

# Check Ports
print_header "Port Availability"
check_port() {
    local port=$1
    local name=$2
    
    if nc -z localhost $port 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Port $port ($name) is listening"
        ((PASS++))
    else
        echo -e "${YELLOW}⚠${NC} Port $port ($name) is not responding (service may be starting)"
        ((WARN++))
    fi
}

check_port 3000 "Frontend"
check_port 8000 "Backend"
check_port 5432 "PostgreSQL"
check_port 6379 "Redis"

# Check Health Endpoints
print_header "Health Check Endpoints"

check_health() {
    local url=$1
    local name=$2
    
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
    
    if [[ $STATUS == "200" || $STATUS == "302" ]]; then
        echo -e "${GREEN}✓${NC} $name ($url) - HTTP $STATUS"
        ((PASS++))
    else
        echo -e "${YELLOW}⚠${NC} $name ($url) - HTTP $STATUS"
        ((WARN++))
    fi
}

check_health "http://localhost:3000" "Frontend"
check_health "http://localhost:8000/api/v1/health" "Backend API"

# Check Database
print_header "Database Checks"

if docker exec cloudwise-postgres pg_isready -U cloudwise -d cloudwise_db > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} PostgreSQL is responding"
    ((PASS++))
    
    # Count database size
    DB_SIZE=$(docker exec cloudwise-postgres psql -U cloudwise -d cloudwise_db -c "SELECT pg_size_pretty(pg_database_size('cloudwise_db'));" -t 2>/dev/null || echo "N/A")
    echo "  Database size: $DB_SIZE"
else
    echo -e "${RED}✗${NC} PostgreSQL is not responding"
    ((FAIL++))
fi

# Check Redis
print_header "Redis Checks"

if docker exec cloudwise-redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Redis is responding"
    ((PASS++))
    
    # Get memory usage
    MEM_USED=$(docker exec cloudwise-redis redis-cli info memory | grep used_memory_human | cut -d: -f2 || echo "N/A")
    echo "  Memory used: $MEM_USED"
else
    echo -e "${RED}✗${NC} Redis is not responding"
    ((FAIL++))
fi

# Check Disk Space
print_header "Disk Space"

DISK_USAGE=$(df -h / | tail -1 | awk '{print $5}')
DISK_FREE=$(df -h / | tail -1 | awk '{print $4}')

echo "Disk usage: $DISK_USAGE"
echo "Disk free:  $DISK_FREE"

if [[ ${DISK_USAGE%\%} -lt 90 ]]; then
    echo -e "${GREEN}✓${NC} Adequate disk space"
    ((PASS++))
else
    echo -e "${RED}✗${NC} Low disk space (>90% used)"
    ((FAIL++))
fi

# Check Memory
print_header "Memory Usage"

TOTAL_MEM=$(free -h | awk '/^Mem:/ {print $2}')
USED_MEM=$(free -h | awk '/^Mem:/ {print $3}')
FREE_MEM=$(free -h | awk '/^Mem:/ {print $4}')

echo "Total: $TOTAL_MEM"
echo "Used:  $USED_MEM"
echo "Free:  $FREE_MEM"

# Summary
print_header "Summary"
echo -e "${GREEN}Passed:${NC}  $PASS"
echo -e "${YELLOW}Warnings:${NC} $WARN"
echo -e "${RED}Failed:${NC}  $FAIL"

if [ $FAIL -eq 0 ]; then
    echo ""
    echo -e "${GREEN}All critical checks passed! ✓${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}Some critical checks failed. Please review the errors above.${NC}"
    exit 1
fi
