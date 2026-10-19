FROM python:3.11.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Install libgomp1 for OpenMP support (used by XGBoost and ONNX Runtime)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root system user and group
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Copy locked dependencies and install
COPY requirements.lock .
RUN pip install --default-timeout=1000 --no-cache-dir -r requirements.lock

# Copy the application code
COPY . .

# Ensure data directory exists for runtime SQLite predictions database
# Set ownership so appuser can write to /app/data and read /app/models
RUN mkdir -p /app/data /app/models \
    && chown -R appuser:appuser /app \
    && chmod -R 755 /app \
    && chmod -R 775 /app/data

# Switch to non-root user
USER appuser

# Expose port 8000
EXPOSE 8000

# Health check using standard library urllib (no curl needed in slim image)
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

# Run FastAPI via uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

