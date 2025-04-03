#!/bin/bash
set -e

# Default to 8080 if PORT not set (Cloud Run typically sets PORT=8080)
if [ -z "$PORT" ]; then
    export PORT=8080
fi

echo "============================================"
echo "Starting minimal server on port $PORT"
echo "Container ID: $(hostname)"
echo "User: $(whoami)"
echo "Date: $(date)"
echo "============================================"

# Print system info
echo "System info:"
echo "------------"
uname -a
echo "Memory: $(free -h)"
echo "Disk space: $(df -h /)"
echo "Network: $(ip addr | grep -E 'inet.*global' || echo 'No global IP')"

# Print environment variables (without sensitive values)
echo "Environment variables:"
echo "---------------------"
printenv | grep -v "PASSWORD\|KEY\|SECRET\|TOKEN" | sort

# List files in current directory
echo "Files in /app:"
echo "--------------"
ls -la /app

# Create required directories if they don't exist
mkdir -p /app/uploads/events /app/uploads/comments /app/logs
echo "Directories created successfully"

# Make all Python files executable
find /app -name "*.py" -exec chmod +x {} \;
echo "Made Python files executable"

echo "Starting the MINIMAL HTTP SERVER..."
python /app/minimal_server.py 