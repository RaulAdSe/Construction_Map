#!/usr/bin/env python3
"""
Helper script to prepare environment variables for Cloud Run deployment.
This script reads the .env.production file and outputs environment variables
in a format suitable for the gcloud command.
"""

import sys
import re
import json
import shlex

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 prepare_env.py .env.production")
        sys.exit(1)
    
    env_file = sys.argv[1]
    env_vars = {}
    
    try:
        with open(env_file, 'r') as f:
            for line in f:
                line = line.strip()
                # Skip comments and empty lines
                if not line or line.startswith('#'):
                    continue
                
                # Handle special case: key with no value
                if '=' not in line:
                    env_vars[line] = ""
                    continue
                
                # Split at first equals sign
                key, value = line.split('=', 1)
                
                # Store in env_vars dictionary
                env_vars[key] = value
        
        # Convert env_vars to JSON string
        json_string = json.dumps(env_vars)
        # Output for gcloud command (the command expects a JSON string)
        print(shlex.quote(json_string))
    
    except Exception as e:
        print(f"Error processing environment file: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main() 