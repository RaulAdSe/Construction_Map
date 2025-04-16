FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    postgresql-client \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install fixed versions of packages to avoid compatibility issues
RUN pip install --no-cache-dir numpy==1.24.3 pandas==2.0.3 
RUN pip install --no-cache-dir cloud-sql-python-connector[pg8000] google-cloud-storage gunicorn uvicorn bcrypt email-validator sendgrid

# Copy startup script
COPY start.sh .
RUN chmod +x /app/start.sh

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p /app/logs /app/uploads

# Set environment variables
ENV PYTHONPATH=/app
ENV PORT=8080

# Run with the startup script
CMD ["/app/start.sh"]
