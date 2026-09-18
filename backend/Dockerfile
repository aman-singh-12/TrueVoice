# TrueVoice Backend Dockerfile
FROM python:3.11-slim

# Install system dependencies for audio DSP and database connectivity
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ffmpeg \
    libsndfile1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source and Alembic migrations
COPY alembic.ini .
COPY alembic/ alembic/
COPY app/ app/

# Non-root application user for container security
RUN useradd -m -u 1000 truevoice && chown -R truevoice:truevoice /app
USER truevoice

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start Uvicorn ASGI server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
