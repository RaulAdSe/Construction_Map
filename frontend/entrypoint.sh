#!/bin/sh

# Replace the PORT placeholder in the nginx.conf with the actual PORT value from environment
# Default to 8080 if not set
PORT="${PORT:-8080}"
sed -i "s/\${PORT}/$PORT/g" /etc/nginx/conf.d/default.conf

# Start nginx with daemon off
exec nginx -g 'daemon off;' 