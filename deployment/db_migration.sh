#!/bin/bash

# Database migration script for exporting and importing PostgreSQL data
# This script helps migrate from a local PostgreSQL to a managed database service

# Exit on error
set -e

# Configuration
SOURCE_DB_HOST="${SOURCE_DB_HOST:-localhost}"
SOURCE_DB_PORT="${SOURCE_DB_PORT:-5432}"
SOURCE_DB_NAME="${SOURCE_DB_NAME:-construction_map}"
SOURCE_DB_USER="${SOURCE_DB_USER:-postgres}"
SOURCE_DB_PASSWORD="${SOURCE_DB_PASSWORD:-postgres}"

TARGET_DB_HOST="${TARGET_DB_HOST:-}"
TARGET_DB_PORT="${TARGET_DB_PORT:-5432}"
TARGET_DB_NAME="${TARGET_DB_NAME:-construction_map}"
TARGET_DB_USER="${TARGET_DB_USER:-}"
TARGET_DB_PASSWORD="${TARGET_DB_PASSWORD:-}"

BACKUP_FILE="db_backup_$(date +%Y%m%d_%H%M%S).sql"

# Functions
function show_help {
    echo "Database Migration Script"
    echo "--------------------------"
    echo "Usage:"
    echo "  $0 [command]"
    echo ""
    echo "Commands:"
    echo "  backup    - Create a backup of the source database"
    echo "  restore   - Restore a backup to the target database"
    echo "  help      - Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  SOURCE_DB_HOST, SOURCE_DB_PORT, SOURCE_DB_NAME, SOURCE_DB_USER, SOURCE_DB_PASSWORD"
    echo "  TARGET_DB_HOST, TARGET_DB_PORT, TARGET_DB_NAME, TARGET_DB_USER, TARGET_DB_PASSWORD"
    echo ""
    echo "Example:"
    echo "  SOURCE_DB_HOST=localhost TARGET_DB_HOST=mydb.example.com $0 backup"
}

function create_backup {
    echo "Creating database backup..."
    echo "Source database: $SOURCE_DB_NAME on $SOURCE_DB_HOST:$SOURCE_DB_PORT"
    
    # Export database with pg_dump
    PGPASSWORD="$SOURCE_DB_PASSWORD" pg_dump \
        -h "$SOURCE_DB_HOST" \
        -p "$SOURCE_DB_PORT" \
        -U "$SOURCE_DB_USER" \
        -d "$SOURCE_DB_NAME" \
        -F c \
        -b \
        -v \
        -f "$BACKUP_FILE"
    
    echo "Backup completed: $BACKUP_FILE"
}

function restore_backup {
    if [ -z "$TARGET_DB_HOST" ]; then
        echo "Error: TARGET_DB_HOST is not set"
        exit 1
    fi
    
    if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
        echo "Error: Backup file not found. Please specify a valid file."
        exit 1
    fi
    
    echo "Restoring database backup..."
    echo "Target database: $TARGET_DB_NAME on $TARGET_DB_HOST:$TARGET_DB_PORT"
    
    # Restore database with pg_restore
    PGPASSWORD="$TARGET_DB_PASSWORD" pg_restore \
        -h "$TARGET_DB_HOST" \
        -p "$TARGET_DB_PORT" \
        -U "$TARGET_DB_USER" \
        -d "$TARGET_DB_NAME" \
        -v \
        "$BACKUP_FILE"
    
    echo "Restore completed"
}

# Main
case "$1" in
    backup)
        create_backup
        ;;
    restore)
        restore_backup
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "Error: Unknown command"
        show_help
        exit 1
        ;;
esac 