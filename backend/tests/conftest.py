import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.database import Base, get_db
from app.core.security import get_password_hash
from app.models.user import User


# Use in-memory SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session")
def db():
    # Create the tables
    Base.metadata.create_all(bind=engine)
    
    # Create a session
    db = TestingSessionLocal()
    
    # Add a test user
    hashed_password = get_password_hash("password")
    user = User(
        username="testuser",
        email="test@example.com",
        password_hash=hashed_password,
        role="admin",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    yield db
    
    # Clean up
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="module")
def client(db):
    # Override the get_db dependency
    def override_get_db():
        try:
            yield db
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    
    # Create a test uploads directory
    os.makedirs("./test_uploads", exist_ok=True)
    
    with TestClient(app) as c:
        yield c
    
    # Clean up
    app.dependency_overrides = {} 