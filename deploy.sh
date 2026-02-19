#!/bin/bash

################################
# CloudWise AI - Docker Deployment Script
# For Linux/macOS
################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        echo "Please install Docker Desktop or Docker CE from: https://www.docker.com/get-started"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        if ! docker compose version &> /dev/null; then
            print_error "Docker Compose is not installed"
            exit 1
        fi
    fi
    
    print_success "Docker and Docker Compose are installed"
}

# Check if .env file exists
check_env() {
    if [ ! -f .env ]; then
        print_warning ".env file not found"
        if [ -f .env.example ]; then
            print_info "Creating .env from .env.example..."
            cp .env.example .env
            print_success ".env file created. Please review and update it as needed."
            echo ""
            print_info "Edit .env and set your configuration before starting services."
            echo ""
        else
            print_error "Neither .env nor .env.example found"
            exit 1
        fi
    fi
}

# Start services
start_services() {
    echo ""
    print_info "Starting all services..."
    docker-compose up -d
    
    if [ $? -eq 0 ]; then
        echo ""
        print_success "Services started successfully!"
        echo ""
        echo "Access the application at:"
        echo "  Frontend:  ${BLUE}http://localhost:3000${NC}"
        echo "  Backend:   ${BLUE}http://localhost:8000${NC}"
        echo "  API Docs:  ${BLUE}http://localhost:8000/docs${NC}"
        echo ""
        print_info "View logs with: ${BLUE}docker-compose logs -f${NC}"
    else
        print_error "Failed to start services"
        exit 1
    fi
}

# Stop services
stop_services() {
    echo ""
    print_info "Stopping all services..."
    docker-compose down
    
    if [ $? -eq 0 ]; then
        print_success "Services stopped successfully"
    else
        print_error "Failed to stop services"
        exit 1
    fi
}

# View logs
view_logs() {
    echo ""
    print_info "Displaying logs (Press Ctrl+C to exit)"
    docker-compose logs -f
}

# View backend logs
view_backend_logs() {
    echo ""
    print_info "Displaying backend logs (Press Ctrl+C to exit)"
    docker-compose logs -f backend
}

# View frontend logs
view_frontend_logs() {
    echo ""
    print_info "Displaying frontend logs (Press Ctrl+C to exit)"
    docker-compose logs -f frontend
}

# Rebuild images
rebuild_images() {
    echo ""
    print_info "Rebuilding Docker images..."
    docker-compose build --no-cache
    
    if [ $? -eq 0 ]; then
        print_success "Images rebuilt successfully"
    else
        print_error "Failed to rebuild images"
        exit 1
    fi
}

# Health check
health_check() {
    echo ""
    print_info "Checking service health..."
    echo ""
    
    print_info "Service status:"
    docker-compose ps
    echo ""
    
    print_info "Testing backend health..."
    if curl -s http://localhost:8000/api/v1/health > /dev/null 2>&1; then
        print_success "Backend is healthy"
    else
        print_warning "Backend is starting... Please wait"
    fi
    echo ""
    
    print_info "Testing frontend health..."
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        print_success "Frontend is healthy"
    else
        print_warning "Frontend is starting... Please wait"
    fi
    echo ""
    
    print_info "Testing database connection..."
    if docker exec cloudwise-postgres pg_isready -U cloudwise -d cloudwise_db > /dev/null 2>&1; then
        print_success "Database is healthy"
    else
        print_error "Database connection failed"
    fi
    echo ""
    
    print_info "Testing Redis connection..."
    if docker exec cloudwise-redis redis-cli ping > /dev/null 2>&1; then
        print_success "Redis is healthy"
    else
        print_error "Redis connection failed"
    fi
    echo ""
}

# Reset everything
reset_services() {
    echo ""
    print_warning "This will delete all containers and volumes. All data will be lost!"
    read -p "Are you sure? (type 'yes' to confirm): " confirm
    
    if [ "$confirm" = "yes" ]; then
        print_info "Removing all containers and volumes..."
        docker-compose down -v
        
        if [ $? -eq 0 ]; then
            print_success "Everything reset successfully"
        else
            print_error "Error during reset"
            exit 1
        fi
    else
        print_warning "Reset cancelled"
    fi
}

# Show menu
show_menu() {
    clear
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   CloudWise AI - Docker Manager    ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════╝${NC}"
    echo ""
    echo "1) Start all services"
    echo "2) Stop all services"
    echo "3) View all logs (follow)"
    echo "4) View backend logs"
    echo "5) View frontend logs"
    echo "6) Rebuild images"
    echo "7) Health check"
    echo "8) Reset everything"
    echo "9) Open in browser"
    echo "10) Exit"
    echo ""
    read -p "Select option (1-10): " choice
}

# Main menu loop
main() {
    check_docker
    check_env
    
    while true; do
        show_menu
        
        case $choice in
            1) start_services ;;
            2) stop_services ;;
            3) view_logs ;;
            4) view_backend_logs ;;
            5) view_frontend_logs ;;
            6) rebuild_images ;;
            7) health_check ;;
            8) reset_services ;;
            9) 
                echo ""
                print_info "Opening http://localhost:3000 in browser..."
                if command -v xdg-open &> /dev/null; then
                    xdg-open http://localhost:3000
                elif command -v open &> /dev/null; then
                    open http://localhost:3000
                else
                    print_warning "Please open http://localhost:3000 in your browser"
                fi
                ;;
            10) 
                echo ""
                print_success "Goodbye!"
                exit 0
                ;;
            *)
                print_error "Invalid option"
                sleep 2
                ;;
        esac
        
        echo ""
        read -p "Press Enter to continue..."
    done
}

# Run main function
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
