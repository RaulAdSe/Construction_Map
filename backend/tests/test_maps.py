import os
import pytest
import io
from fastapi.testclient import TestClient
import tempfile
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

# Reuse auth_headers fixture from test_projects.py
from backend.tests.test_projects import auth_headers, test_project


@pytest.fixture(scope="module")
def sample_pdf():
    """Create a sample PDF file for testing"""
    # Create a temporary PDF file
    pdf_buffer = io.BytesIO()
    c = canvas.Canvas(pdf_buffer, pagesize=letter)
    c.drawString(100, 750, "Test PDF for Map Upload")
    c.save()
    pdf_buffer.seek(0)
    return pdf_buffer


def test_create_map(client: TestClient, auth_headers, test_project, sample_pdf):
    # Test creating a map with a PDF file
    response = client.post(
        "/api/v1/maps/",
        data={
            "project_id": test_project["id"],
            "map_type": "implantation",
            "name": "Test Map",
            "transform_data": '{"scale": 1.0, "rotation": 0, "x_offset": 0, "y_offset": 0}'
        },
        files={"file": ("test.pdf", sample_pdf, "application/pdf")},
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Test Map"
    assert response.json()["map_type"] == "implantation"
    assert response.json()["project_id"] == test_project["id"]
    assert "filename" in response.json()
    assert response.json()["filename"].endswith(".pdf")
    
    # Save map ID for later tests
    return response.json()


def test_get_maps(client: TestClient, auth_headers, test_project):
    # Test getting all maps for a project
    response = client.get(
        f"/api/v1/maps/?project_id={test_project['id']}",
        headers=auth_headers
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    # Should have at least one map (the one created in test_create_map)
    assert len(response.json()) >= 1


def test_get_map(client: TestClient, auth_headers, test_project):
    # First get all maps to find one to test
    response = client.get(
        f"/api/v1/maps/?project_id={test_project['id']}",
        headers=auth_headers
    )
    maps = response.json()
    assert len(maps) > 0
    
    # Test getting a specific map
    map_id = maps[0]["id"]
    response = client.get(
        f"/api/v1/maps/{map_id}",
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["id"] == map_id
    assert response.json()["project_id"] == test_project["id"]
    
    # Test getting a non-existent map
    response = client.get(
        "/api/v1/maps/999",
        headers=auth_headers
    )
    assert response.status_code == 404


def test_update_map(client: TestClient, auth_headers, test_project):
    # First get all maps to find one to update
    response = client.get(
        f"/api/v1/maps/?project_id={test_project['id']}",
        headers=auth_headers
    )
    maps = response.json()
    assert len(maps) > 0
    
    # Test updating a map
    map_id = maps[0]["id"]
    response = client.put(
        f"/api/v1/maps/{map_id}",
        json={
            "name": "Updated Map",
            "transform_data": {"scale": 1.5, "rotation": 90, "x_offset": 10, "y_offset": 20}
        },
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["id"] == map_id
    assert response.json()["name"] == "Updated Map"
    assert response.json()["transform_data"] == {"scale": 1.5, "rotation": 90, "x_offset": 10, "y_offset": 20} 