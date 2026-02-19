# Docker Installation & Deployment Guide

## Prerequisites

Before running the application, ensure you have installed:

- **Docker Desktop**: [Download](https://www.docker.com/products/docker-desktop)
- **Docker Compose**: Included with Docker Desktop (v2.0+)
- **Git**: For cloning the repository

### System Requirements

- **RAM**: Minimum 4GB (8GB+ recommended)
- **Disk Space**: Minimum 5GB free space
- **CPU**: Multi-core processor (4+ cores recommended)

---

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd the-advisor-agent
```

### 2. Configure Environment Variables

Copy the example environment file and customize it:

```bash
# On Windows (PowerShell)
Copy-Item .env.example .env

# On Linux/macOS
cp .env.example .env
```

Edit `.env` and update these critical variables:

```env
# Required for AI features
OPENAI_API_KEY=sk-your-api-key-here

# Database credentials (optional - defaults are safe for development)
POSTGRES_USER=cloudwise
POSTGRES_PASSWORD=cloudwise_secret
POSTGRES_DB=cloudwise_db

# Frontend API URL - adjust based on your domain
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. Start Services

```bash
# Build and start all services
docker-compose up -d

# View logs in real-time
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

### 4. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

### 5. Stop Services

```bash
docker-compose down

# To also remove volumes (delete all data)
docker-compose down -v
```

---

## Deployment to Different Machines

### Step 1: Prepare the Repository

Ensure all files are committed to git:

```bash
git add .
git commit -m "Docker configuration updates"
git push
```

### Step 2: On Target Machine

Clone the repository on the target machine:

```bash
git clone <repository-url>
cd the-advisor-agent
```

### Step 3: Configure for Target Environment

Update `.env` file for the target environment:

```bash
# For production deployment
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=warn

# Update API URL to match your domain
NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# Update CORS origins
BACKEND_CORS_ORIGINS=["https://yourdomain.com"]

# Change default passwords
POSTGRES_PASSWORD=strong-random-password-here
JWT_SECRET_KEY=another-strong-random-key
SECRET_KEY=yet-another-strong-random-key
```

### Step 4: Start Services

```bash
docker-compose up -d
```

---

## Advanced Configuration

### Custom Ports

Edit `.env` to use different ports:

```env
BACKEND_PORT=8001
FRONTEND_PORT=3001
POSTGRES_PORT=5433
REDIS_PORT=6380
```

Update `docker-compose.yml` port mappings accordingly.

### Environment-Specific Configs

Create separate compose files:

```bash
# Development
docker-compose -f docker-compose.yml up -d

# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Staging
docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d
```

### Database Backup & Restore

```bash
# Backup database
docker exec cloudwise-postgres pg_dump -U cloudwise cloudwise_db > backup.sql

# Restore database
docker exec -i cloudwise-postgres psql -U cloudwise cloudwise_db < backup.sql
```

### View Container Logs

```bash
# All services
docker-compose logs -f

# Specific service with tail
docker-compose logs -f --tail=50 backend

# By time range
docker-compose logs --since 2h backend
```

---

## Troubleshooting

### Services not starting?

```bash
# Check service status
docker-compose ps

# View detailed error logs
docker-compose logs

# Rebuild images
docker-compose build --no-cache
```

### Database connection issues?

```bash
# Verify database is healthy
docker exec cloudwise-postgres pg_isready -U cloudwise -d cloudwise_db

# Check Redis connectivity
docker exec cloudwise-redis redis-cli ping
```

### Port already in use?

Change ports in `.env`:
```env
BACKEND_PORT=8001
FRONTEND_PORT=3001
```

### Memory/Resource issues?

Limit resource usage in `docker-compose.yml`:
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
```

### Clear everything and start fresh

```bash
# Stop and remove all containers/volumes
docker-compose down -v

# Rebuild from scratch
docker-compose build --no-cache

# Start fresh
docker-compose up -d
```

---

## Health Checks

The application includes health checks. Verify:

```bash
# Backend health
curl http://localhost:8000/api/v1/health

# Frontend health
curl http://localhost:3000/

# Database health
docker exec cloudwise-postgres pg_isready -U cloudwise

# Redis health
docker exec cloudwise-redis redis-cli ping
```

---

## Security Recommendations for Production

1. **Change all default credentials** in `.env`
2. **Use strong passwords** (minimum 32 characters)
3. **Enable SSL/TLS** by using reverse proxy (nginx, Caddy)
4. **Set DEBUG=false** in production
5. **Use managed database services** instead of Docker containers
6. **Enable firewall rules** to restrict access
7. **Use secrets management** (AWS Secrets Manager, HashiCorp Vault)
8. **Regular backups** of PostgreSQL data

---

## Performance Tuning

### Backend Optimization

Update `docker-compose.yml`:
```yaml
backend:
  environment:
    - WORKERS=8  # Match CPU cores
    - LOG_LEVEL=warning
```

### Database Optimization

```env
DATABASE_POOL_SIZE=30
DATABASE_MAX_OVERFLOW=10
```

### Redis Optimization

Monitor Redis memory:
```bash
docker exec cloudwise-redis redis-cli info memory
```

---

## Environment Variables Reference

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `OPENAI_API_KEY` | Yes* | - | OpenAI API key for AI features |
| `POSTGRES_USER` | No | cloudwise | Database user |
| `POSTGRES_PASSWORD` | No | cloudwise_secret | Database password |
| `NEXT_PUBLIC_API_URL` | No | http://localhost:8000 | Frontend API endpoint |
| `ENVIRONMENT` | No | development | App environment |
| `SECRET_KEY` | Yes | - | JWT signing key |
| `REDIS_PASSWORD` | No | (empty) | Redis authentication |

\* Required only if not using `LLM_MOCK_MODE=true`

---

## Support

For issues or questions:

1. Check logs: `docker-compose logs`
2. Review `.env` configuration
3. Verify system requirements
4. Check Docker resource allocation
