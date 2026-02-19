# CloudWise AI - Makefile for Docker Management
# Usage: make [target]
# Run 'make help' for all targets

.PHONY: help build up down logs restart clean health test

# Default target
.DEFAULT_GOAL := help

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
NC := \033[0m

help: ## Show this help message
	@echo '$(BLUE)═══════════════════════════════════════$(NC)'
	@echo '$(BLUE)CloudWise AI - Docker Management$(NC)'
	@echo '$(BLUE)═══════════════════════════════════════$(NC)'
	@echo ''
	@echo '$(YELLOW)Usage:$(NC)'
	@echo '  make [target]'
	@echo ''
	@echo '$(YELLOW)Available targets:$(NC)'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ''
	@echo '$(YELLOW)Examples:$(NC)'
	@echo '  make up            # Start all services'
	@echo '  make logs          # View logs'
	@echo '  make down          # Stop all services'
	@echo '  make clean         # Remove containers and volumes'
	@echo ''

# Build targets
build: ## Build Docker images
	@echo '$(BLUE)Building Docker images...$(NC)'
	docker-compose build

build-no-cache: ## Build Docker images without cache
	@echo '$(BLUE)Building Docker images (no cache)...$(NC)'
	docker-compose build --no-cache

# Service management
up: ## Start all services
	@echo '$(BLUE)Starting services...$(NC)'
	docker-compose up -d
	@echo '$(GREEN)Services started!$(NC)'
	@echo ''
	@echo 'Access the application at:'
	@echo '  Frontend: http://localhost:3000'
	@echo '  Backend:  http://localhost:8000'
	@echo '  API Docs: http://localhost:8000/docs'
	@echo ''

down: ## Stop all services
	@echo '$(BLUE)Stopping services...$(NC)'
	docker-compose down
	@echo '$(GREEN)Services stopped!$(NC)'

restart: ## Restart all services
	@echo '$(BLUE)Restarting services...$(NC)'
	docker-compose restart
	@echo '$(GREEN)Services restarted!$(NC)'

ps: ## Show running containers
	@docker-compose ps

# Logging
logs: ## View logs from all services (follow mode)
	docker-compose logs -f

logs-backend: ## View backend logs
	docker-compose logs -f backend

logs-frontend: ## View frontend logs
	docker-compose logs -f frontend

logs-db: ## View database logs
	docker-compose logs -f postgres

logs-redis: ## View Redis logs
	docker-compose logs -f redis

# Environment
env-setup: ## Create .env file from .env.example
	@if [ ! -f .env ]; then \
		echo '$(BLUE)Creating .env from .env.example...$(NC)'; \
		cp .env.example .env; \
		echo '$(GREEN).env created!$(NC)'; \
		echo '$(YELLOW)Please edit .env and set your configuration.$(NC)'; \
	else \
		echo '$(YELLOW).env already exists$(NC)'; \
	fi

env-show: ## Show current environment variables
	@echo '$(BLUE)Current .env variables:$(NC)'
	@grep -E '^[A-Z_]+=' .env | sort || echo '$(YELLOW).env not found$(NC)'

# Health checks
health: ## Run health checks
	@echo '$(BLUE)Running health checks...$(NC)'
	@echo ''
	@echo '$(BLUE)Services status:$(NC)'
	@docker-compose ps || true
	@echo ''
	@echo '$(BLUE)Frontend health:$(NC)'
	@curl -s -o /dev/null -w 'HTTP %{http_code}' http://localhost:3000 || echo 'Not responding'
	@echo ''
	@echo '$(BLUE)Backend health:$(NC)'
	@curl -s http://localhost:8000/api/v1/health | head -c 50 || echo 'Not responding'
	@echo ''
	@echo '$(BLUE)Database health:$(NC)'
	@docker exec cloudwise-postgres pg_isready -U cloudwise -d cloudwise_db || echo 'Not responding'
	@echo ''

test: ## Run tests
	@echo '$(BLUE)Running tests...$(NC)'
	docker-compose exec -T backend pytest || echo '$(YELLOW)No tests configured$(NC)'

# Database operations
db-backup: ## Backup PostgreSQL database
	@echo '$(BLUE)Backing up database...$(NC)'
	@mkdir -p backups
	docker exec cloudwise-postgres pg_dump -U cloudwise cloudwise_db > backups/backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo '$(GREEN)Database backed up to backups/$(NC)'

db-restore: ## Restore PostgreSQL database (use BACKUP_FILE=filename)
	@if [ -z "$(BACKUP_FILE)" ]; then \
		echo '$(RED)Error: BACKUP_FILE not specified$(NC)'; \
		echo 'Usage: make db-restore BACKUP_FILE=backups/backup_YYYYMMDD_HHMMSS.sql'; \
		exit 1; \
	fi
	@echo '$(BLUE)Restoring database from $(BACKUP_FILE)...$(NC)'
	docker exec -i cloudwise-postgres psql -U cloudwise cloudwise_db < $(BACKUP_FILE)
	@echo '$(GREEN)Database restored!$(NC)'

db-shell: ## Open PostgreSQL shell
	docker exec -it cloudwise-postgres psql -U cloudwise -d cloudwise_db

redis-cli: ## Open Redis CLI
	docker exec -it cloudwise-redis redis-cli

# Container operations
shell-backend: ## Open shell in backend container
	docker exec -it cloudwise-backend /bin/bash

shell-frontend: ## Open shell in frontend container
	docker exec -it cloudwise-frontend /bin/sh

# Cleanup
clean: ## Remove containers and images
	@echo '$(YELLOW)WARNING: This will remove all containers and images$(NC)'
	@read -p "Continue? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose down; \
		echo '$(GREEN)Cleanup complete!$(NC)'; \
	else \
		echo '$(YELLOW)Cleanup cancelled$(NC)'; \
	fi

clean-volumes: ## Remove containers, images, and volumes (DANGER!)
	@echo '$(RED)WARNING: This will delete ALL data including volumes!$(NC)'
	@read -p "Type 'yes' to continue: " -r confirm; \
	if [ "$$confirm" = "yes" ]; then \
		docker-compose down -v; \
		echo '$(GREEN)Everything cleaned!$(NC)'; \
	else \
		echo '$(YELLOW)Operation cancelled$(NC)'; \
	fi

clean-logs: ## Clean up Docker logs
	@echo '$(BLUE)Cleaning up Docker logs...$(NC)'
	docker system prune -f --filter "until=72h"
	@echo '$(GREEN)Logs cleaned!$(NC)'

# Utility targets
install: env-setup build up ## Full installation (setup env, build, start)
	@echo '$(GREEN)Installation complete!$(NC)'
	@echo 'Access the application at:'
	@echo '  Frontend: http://localhost:3000'
	@echo '  Backend:  http://localhost:8000'

dev: ## Start services for development (with logs)
	@echo '$(BLUE)Starting services in development mode...$(NC)'
	docker-compose up

prod: ## Start services in production mode
	@echo '$(BLUE)Starting services in production mode...$(NC)'
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
	@echo '$(GREEN)Production services started!$(NC)'

validate: ## Validate docker-compose configuration
	@echo '$(BLUE)Validating docker-compose.yml...$(NC)'
	docker-compose config > /dev/null && echo '$(GREEN)Configuration valid!$(NC)' || echo '$(RED)Configuration invalid!$(NC)'

stats: ## Show real-time container statistics
	docker stats

prune: ## Remove unused Docker objects
	@echo '$(BLUE)Pruning Docker system...$(NC)'
	docker system prune -f
	@echo '$(GREEN)Pruning complete!$(NC)'

version: ## Show versions
	@echo '$(BLUE)Docker and Docker Compose versions:$(NC)'
	@docker --version
	@docker-compose --version

.PHONY: install dev prod validate stats prune version db-backup db-restore db-shell redis-cli shell-backend shell-frontend clean clean-volumes clean-logs clean help build build-no-cache up down restart ps logs logs-backend logs-frontend logs-db logs-redis env-setup env-show health test
