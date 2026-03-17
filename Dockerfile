# BIQc Backend — Production Dockerfile
FROM python:3.11-slim

WORKDIR /app

# System deps for Playwright + general
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl wget gnupg ca-certificates \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 \
    libpango-1.0-0 libcairo2 libasound2 libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
RUN pip install playwright && python -m playwright install chromium --with-deps

# Copy app
COPY backend/ .

# Port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8001/api/health || exit 1

# Start
CMD ["uvicorn", "backend.server:app", "--host", "0.0.0.0", "--port", "80"]
