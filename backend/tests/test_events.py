import pytest
import io
from PIL import Image
from fastapi.testclient import TestClient

# Reuse auth_headers fixture from test_projects.py
from backend.tests.test_projects import auth_headers, test_project


@pytest.fixture(scope="module")
def sample_image():
    """Create a sample image for testing"""
    # Create a small test image
    img = Image.new("RGB", (100, 100), color="red")
    img_io = io.BytesIO()
    img.save(img_io, format="JPEG")
    img_io.seek(0)
    return img_io


def test_create_event(client: TestClient, auth_headers, test_project, sample_image):
    # Test creating an event
    response = client.post(
        "/api/v1/events/",
        data={
            "project_id": test_project["id"],
            "title": "Test Event",
            "description": "This is a test event",
            "x_coordinate": 100.5,
            "y_coordinate": 200.5,
            "tags": '["test", "issue"]'
        },
        files={"image": ("test.jpg", sample_image, "image/jpeg")},
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Test Event"
    assert response.json()["description"] == "This is a test event"
    assert response.json()["project_id"] == test_project["id"]
    assert response.json()["x_coordinate"] == 100.5
    assert response.json()["y_coordinate"] == 200.5
    assert "image_url" in response.json()
    assert response.json()["image_url"].startswith("events/")
    
    # Save event data for later tests
    return response.json()


def test_get_events(client: TestClient, auth_headers, test_project):
    # Test getting all events for a project
    response = client.get(
        f"/api/v1/events/?project_id={test_project['id']}",
        headers=auth_headers
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    # Should have at least one event (the one created in test_create_event)
    assert len(response.json()) >= 1


def test_get_event(client: TestClient, auth_headers, test_project):
    # First get all events to find one to test
    response = client.get(
        f"/api/v1/events/?project_id={test_project['id']}",
        headers=auth_headers
    )
    events = response.json()
    assert len(events) > 0
    
    # Test getting a specific event
    event_id = events[0]["id"]
    response = client.get(
        f"/api/v1/events/{event_id}",
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["id"] == event_id
    assert response.json()["project_id"] == test_project["id"]
    assert "created_by_user_name" in response.json()
    
    # Test getting a non-existent event
    response = client.get(
        "/api/v1/events/999",
        headers=auth_headers
    )
    assert response.status_code == 404


def test_update_event(client: TestClient, auth_headers, test_project):
    # First get all events to find one to update
    response = client.get(
        f"/api/v1/events/?project_id={test_project['id']}",
        headers=auth_headers
    )
    events = response.json()
    assert len(events) > 0
    
    # Test updating an event
    event_id = events[0]["id"]
    response = client.put(
        f"/api/v1/events/{event_id}",
        json={
            "title": "Updated Event",
            "description": "This event has been updated",
            "tags": ["updated", "test"]
        },
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["id"] == event_id
    assert response.json()["title"] == "Updated Event"
    assert response.json()["description"] == "This event has been updated"
    assert response.json()["tags"] == ["updated", "test"]


def test_export_events(client: TestClient, auth_headers, test_project):
    # Test exporting events as CSV
    response = client.get(
        f"/api/v1/events/export?project_id={test_project['id']}&format=csv",
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.headers["Content-Type"] == "text/csv"
    assert "Content-Disposition" in response.headers
    assert f"events-project-{test_project['id']}.csv" in response.headers["Content-Disposition"]
    
    # Test exporting events as Excel
    response = client.get(
        f"/api/v1/events/export?project_id={test_project['id']}&format=xlsx",
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.headers["Content-Type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert "Content-Disposition" in response.headers
    assert f"events-project-{test_project['id']}.xlsx" in response.headers["Content-Disposition"] 