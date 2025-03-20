import pytest
from fastapi.testclient import TestClient

@pytest.fixture(scope="module")
def auth_headers(client: TestClient):
    # Login and get the token
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "testuser", "password": "password"}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def test_project(client: TestClient, auth_headers):
    # Create a test project
    response = client.post(
        "/api/v1/projects/",
        json={"name": "Test Project", "description": "A test project"},
        headers=auth_headers
    )
    assert response.status_code == 200
    return response.json()


def test_create_project(client: TestClient, auth_headers):
    # Test creating a project
    response = client.post(
        "/api/v1/projects/",
        json={"name": "New Project", "description": "A new test project"},
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["name"] == "New Project"
    assert response.json()["description"] == "A new test project"


def test_get_projects(client: TestClient, auth_headers, test_project):
    # Test getting all projects
    response = client.get(
        "/api/v1/projects/",
        headers=auth_headers
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert len(response.json()) >= 1
    
    # Verify the test project is in the list
    project_ids = [p["id"] for p in response.json()]
    assert test_project["id"] in project_ids


def test_get_project(client: TestClient, auth_headers, test_project):
    # Test getting a specific project
    response = client.get(
        f"/api/v1/projects/{test_project['id']}",
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["id"] == test_project["id"]
    assert response.json()["name"] == test_project["name"]
    assert response.json()["description"] == test_project["description"]
    
    # Test getting a non-existent project
    response = client.get(
        "/api/v1/projects/999",
        headers=auth_headers
    )
    assert response.status_code == 404


def test_update_project(client: TestClient, auth_headers, test_project):
    # Test updating a project
    response = client.put(
        f"/api/v1/projects/{test_project['id']}",
        json={"name": "Updated Project", "description": "An updated test project"},
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["id"] == test_project["id"]
    assert response.json()["name"] == "Updated Project"
    assert response.json()["description"] == "An updated test project"


def test_delete_project(client: TestClient, auth_headers):
    # Create a project to delete
    response = client.post(
        "/api/v1/projects/",
        json={"name": "Project to Delete", "description": "This project will be deleted"},
        headers=auth_headers
    )
    project_id = response.json()["id"]
    
    # Test deleting the project
    response = client.delete(
        f"/api/v1/projects/{project_id}",
        headers=auth_headers
    )
    assert response.status_code == 204
    
    # Verify the project was deleted
    response = client.get(
        f"/api/v1/projects/{project_id}",
        headers=auth_headers
    )
    assert response.status_code == 404 