# Easy Roles - Makefile
# Commands for development and production environments

.PHONY: help dev prod build clean logs stop restart status install

# Default target
help:
	@echo "Easy Roles - Available commands:"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start development environment with hot reload"
	@echo "  make dev-build    - Build and start development environment"
	@echo "  make dev-logs     - Show development logs"
	@echo ""
	@echo "Production:"
	@echo "  make prod         - Start production environment"
	@echo "  make prod-build   - Build and start production environment"
	@echo "  make prod-logs    - Show production logs"
	@echo ""
	@echo "General:"
	@echo "  make stop         - Stop all containers"
	@echo "  make restart      - Restart all containers"
	@echo "  make status       - Show container status"
	@echo "  make clean        - Remove containers, networks, and volumes"
	@echo "  make build        - Build Docker image"
	@echo "  make logs         - Show logs for all services"
	@echo "  make install      - Install dependencies locally"
	@echo "  make help         - Show this help message"

# Development environment
dev:
	@echo "Starting development environment..."
	DOCKER_TARGET=development NODE_ENV=development COMMAND="yarn dev:watch" docker-compose --profile dev up -d

dev-build:
	@echo "Building and starting development environment..."
	DOCKER_TARGET=development NODE_ENV=development COMMAND="yarn dev:watch" docker-compose --profile dev up -d --build

dev-logs:
	@echo "Showing development logs..."
	docker-compose --profile dev logs -f

# Production environment
prod:
	@echo "Starting production environment..."
	DOCKER_TARGET=production NODE_ENV=production COMMAND="yarn start" docker-compose -f docker-compose.yml --profile prod up -d

prod-build:
	@echo "Building and starting production environment..."
	DOCKER_TARGET=production NODE_ENV=production COMMAND="yarn start" docker-compose -f docker-compose.yml --profile prod up -d --build

prod-logs:
	@echo "Showing production logs..."
	docker-compose --profile prod logs -f

# General commands
stop:
	@echo "Stopping all containers..."
	docker-compose --profile dev down
	docker-compose --profile prod down

restart:
	@echo "Restarting containers..."
	docker-compose --profile dev restart
	docker-compose --profile prod restart

status:
	@echo "Development environment status:"
	@docker-compose --profile dev ps
	@echo ""
	@echo "Production environment status:"
	@docker-compose --profile prod ps

clean:
	@echo "Cleaning up containers, networks, and volumes..."
	docker-compose --profile dev down -v --remove-orphans
	docker-compose --profile prod down -v --remove-orphans
	docker system prune -f

build:
	@echo "Building Docker image..."
	docker build -t easy-roles .

logs:
	@echo "Showing logs for all services..."
	@echo "Development logs:"
	@docker-compose --profile dev logs --tail=50
	@echo ""
	@echo "Production logs:"
	@docker-compose --profile prod logs --tail=50

install:
	@echo "Installing dependencies locally..."
	yarn install
