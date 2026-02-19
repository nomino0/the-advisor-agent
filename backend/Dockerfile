# ============================================
# CloudWise AI — Backend Dockerfile
# Production-Ready FastAPI Application
# ============================================

ARG PYTHON_VERSION=3.11
FROM python:${PYTHON_VERSION}-slim AS base

# Metadata
LABEL maintainer="CloudWise AI Team"
LABEL version="1.0.0"
LABEL description="CloudWise AI Backend - FastAPI Application"

# Environment variables to prevent buffering and .pyc generation
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install system dependencies for asyncpg, bcrypt, Pillow (qrcode), and postgresql
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        gcc \
        g++ \
        libpq-dev \
        libjpeg-dev \
        zlib1g-dev \
        libssl-dev \
        curl \
        wget \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Upgrade pip and install setuptools
RUN pip install --upgrade pip setuptools wheel

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy application code
COPY . .

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser && \
    chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Health check that verifies the application is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8000/api/v1/health || exit 1

# Run the application with optimized settings for production
CMD ["uvicorn", \
     "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "4", \
     "--loop", "uvloop", \
     "--http", "httptools"]
