from fastapi.testclient import TestClient

def test_login(client: TestClient):
    # Test login with valid credentials
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "testuser", "password": "password"}
    )
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert response.json()["token_type"] == "bearer"

    # Test login with invalid credentials
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "testuser", "password": "wrongpassword"}
    )
    assert response.status_code == 401

def test_register(client: TestClient):
    # Test registering a new user
    response = client.post(
        "/api/v1/auth/register",
        json={
            "username": "newuser",
            "email": "new@example.com",
            "password": "password",
            "role": "regular"
        }
    )
    assert response.status_code == 200
    assert response.json()["username"] == "newuser"
    assert response.json()["email"] == "new@example.com"
    
    # Test registering with duplicate username
    response = client.post(
        "/api/v1/auth/register",
        json={
            "username": "newuser",
            "email": "another@example.com",
            "password": "password"
        }
    )
    assert response.status_code == 400 