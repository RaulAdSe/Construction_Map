FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    pkg-config \
    libcurl4-openssl-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install Cloud SQL Python Connector for IAM authentication
RUN pip install --no-cache-dir -r requirements.txt \
    cloud-sql-python-connector[pg8000]==1.2.3 \
    google-cloud-secret-manager

# Copy the rest of the application
COPY . .

# Make sure .env.gcp is copied into the container
COPY .env.gcp .env

# Create necessary directories
RUN mkdir -p uploads/comments uploads/events logs

# Create start script that runs migrations and starts the app
RUN echo '#!/bin/bash\n\
echo "Running database migrations..."\n\
python create_cloud_schema.py\n\
echo "Starting API server..."\n\
uvicorn app.main:app --host 0.0.0.0 --port 8000\n\
' > /app/start.sh && chmod +x /app/start.sh

# Run the start script
CMD ["/app/start.sh"] 