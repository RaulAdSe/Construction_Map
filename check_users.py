from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

engine = create_engine('postgresql://postgres:postgres@localhost:5432/construction_map')
Session = sessionmaker(bind=engine)
session = Session()

try:
    # Check if users table exists
    result = session.execute(text("SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='users')"))
    if not result.scalar():
        print("Users table doesn't exist in the database")
        exit()
    
    # Get table structure
    result = session.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='users'"))
    columns = [row[0] for row in result]
    print("Users table columns:")
    print(", ".join(columns))
    
    # Get user data
    result = session.execute(text('SELECT * FROM users LIMIT 5'))
    print("\nUser data:")
    for row in result:
        print(row)
    
    # Check specifically for password hashes
    result = session.execute(text("SELECT id, username, password_hash FROM users LIMIT 2"))
    print("\nPassword hashes:")
    for row in result:
        print(f"User: {row.username}, Password Hash: {row.password_hash[:25]}...")

except Exception as e:
    print(f'Error: {e}')
finally:
    session.close() 