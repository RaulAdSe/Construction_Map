#!/usr/bin/env python
"""
Script to check and describe the current database schema.
This is useful for understanding the current state of the database.
"""
import os
import sys
import sqlalchemy as sa
from sqlalchemy.schema import CreateTable

# Add the parent directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

try:
    from app.db.database import engine
except ImportError:
    print("Error: Unable to import database engine.")
    print("Make sure you're running this from the backend directory.")
    sys.exit(1)

def check_database_schema():
    """Check the database schema and describe each table."""
    try:
        # Create metadata object
        metadata = sa.MetaData()
        # Reflect all tables
        metadata.reflect(bind=engine)
        
        # Print summary
        print(f"\n{'=' * 80}")
        print(f"DATABASE SCHEMA SUMMARY")
        print(f"{'=' * 80}")
        print(f"Total tables: {len(metadata.tables)}")
        print(f"Tables: {', '.join(sorted(metadata.tables.keys()))}")
        print(f"{'=' * 80}\n")
        
        # Get table details
        for table_name in sorted(metadata.tables.keys()):
            table = metadata.tables[table_name]
            print(f"\n{'-' * 40}")
            print(f"TABLE: {table_name}")
            print(f"{'-' * 40}")
            
            # Print columns
            print("COLUMNS:")
            for column in table.columns:
                nullable = "NULL" if column.nullable else "NOT NULL"
                pk = "PRIMARY KEY" if column.primary_key else ""
                default = f"DEFAULT {column.default.arg}" if column.default is not None else ""
                fk = ""
                if column.foreign_keys:
                    for fk_obj in column.foreign_keys:
                        target = f"{fk_obj.column.table.name}.{fk_obj.column.name}"
                        fk = f"REFERENCES {target}"
                print(f"  - {column.name}: {column.type} {nullable} {pk} {default} {fk}".strip())
            
            # Print indexes
            if table.indexes:
                print("\nINDEXES:")
                for index in sorted(table.indexes, key=lambda idx: idx.name or ""):
                    columns = ", ".join(col.name for col in index.columns)
                    unique = "UNIQUE " if index.unique else ""
                    print(f"  - {index.name or 'unnamed'}: {unique}({columns})")
            
            # Print constraints
            constraints = []
            for constraint in sorted(table.constraints, key=lambda con: con.name or ""):
                if isinstance(constraint, sa.PrimaryKeyConstraint):
                    # We already showed PK info with the columns
                    continue
                if isinstance(constraint, sa.ForeignKeyConstraint):
                    columns = ", ".join(col.name for col in constraint.columns)
                    ref_columns = ", ".join(col.name for col in constraint.elements[0].column.table.columns)
                    ref_table = constraint.elements[0].column.table.name
                    constraints.append(f"  - {constraint.name or 'unnamed'}: FOREIGN KEY ({columns}) REFERENCES {ref_table} ({ref_columns})")
                elif isinstance(constraint, sa.UniqueConstraint):
                    columns = ", ".join(col.name for col in constraint.columns)
                    constraints.append(f"  - {constraint.name or 'unnamed'}: UNIQUE ({columns})")
                else:
                    constraints.append(f"  - {constraint.name or 'unnamed'}: {type(constraint).__name__}")
            
            if constraints:
                print("\nCONSTRAINTS:")
                for constraint in constraints:
                    print(constraint)
            
            # Print CREATE TABLE statement for reference
            print("\nCREATE TABLE STATEMENT:")
            create_table_stmt = str(CreateTable(table).compile(engine))
            # Format with proper indentation
            formatted_stmt = create_table_stmt.replace(",", ",\n    ").replace("(", "(\n    ").replace(")", "\n)")
            print(f"  {formatted_stmt.strip()}")
            
        # Check alembic version
        with engine.connect() as conn:
            result = conn.execute(sa.text("SELECT * FROM alembic_version"))
            versions = result.fetchall()
            print(f"\n{'=' * 80}")
            print(f"ALEMBIC VERSIONS")
            print(f"{'=' * 80}")
            for version in versions:
                print(f"  - {version[0]}")
            print(f"{'=' * 80}\n")
            
        return True
    except Exception as e:
        print(f"Error checking database schema: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("Checking database schema...")
    success = check_database_schema()
    sys.exit(0 if success else 1) 