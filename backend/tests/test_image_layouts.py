"""
Test suite for Image Layouts (Save/Load) feature - Iteration 16
Tests the new /api/image-layouts CRUD endpoints
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user credentials
TEST_EMAIL = f"test_layout_{uuid.uuid4().hex[:8]}@example.com"
TEST_PASSWORD = "testpass123"
TEST_NAME = "Layout Test User"


class TestImageLayoutsAuth:
    """Test authentication requirements for image-layouts endpoints"""
    
    @pytest.fixture(scope="class")
    def session(self):
        return requests.Session()
    
    def test_list_layouts_requires_auth(self, session):
        """GET /api/image-layouts should return 401 without auth"""
        response = session.get(f"{BASE_URL}/api/image-layouts")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("PASS: GET /api/image-layouts returns 401 without auth")
    
    def test_create_layout_requires_auth(self, session):
        """POST /api/image-layouts should return 401 without auth"""
        response = session.post(
            f"{BASE_URL}/api/image-layouts",
            json={"name": "Test Layout", "layers": []}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("PASS: POST /api/image-layouts returns 401 without auth")
    
    def test_get_layout_requires_auth(self, session):
        """GET /api/image-layouts/{id} should return 401 without auth"""
        response = session.get(f"{BASE_URL}/api/image-layouts/fake-id-123")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("PASS: GET /api/image-layouts/{id} returns 401 without auth")
    
    def test_delete_layout_requires_auth(self, session):
        """DELETE /api/image-layouts/{id} should return 401 without auth"""
        response = session.delete(f"{BASE_URL}/api/image-layouts/fake-id-123")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("PASS: DELETE /api/image-layouts/{id} returns 401 without auth")


class TestImageLayoutsCRUD:
    """Test CRUD operations for image-layouts with authentication"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Register a test user and return authenticated session"""
        session = requests.Session()
        
        # Register new user
        register_response = session.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
                "name": TEST_NAME
            }
        )
        
        if register_response.status_code == 400:
            # User might already exist, try login
            login_response = session.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
            )
            assert login_response.status_code == 200, f"Login failed: {login_response.text}"
            data = login_response.json()
            session.headers.update({"Authorization": f"Bearer {data['session_token']}"})
        else:
            assert register_response.status_code == 200, f"Register failed: {register_response.text}"
            data = register_response.json()
            session.headers.update({"Authorization": f"Bearer {data['session_token']}"})
        
        print(f"PASS: Authenticated as {TEST_EMAIL}")
        return session
    
    def test_create_layout_validates_name_required(self, auth_session):
        """POST /api/image-layouts should validate name is required"""
        # Test missing name
        response = auth_session.post(
            f"{BASE_URL}/api/image-layouts",
            json={"layers": []}
        )
        assert response.status_code == 422, f"Expected 422 for missing name, got {response.status_code}"
        print("PASS: POST /api/image-layouts validates name is required")
    
    def test_create_layout_validates_name_non_empty(self, auth_session):
        """POST /api/image-layouts should validate name is non-empty"""
        response = auth_session.post(
            f"{BASE_URL}/api/image-layouts",
            json={"name": "", "layers": []}
        )
        assert response.status_code == 422, f"Expected 422 for empty name, got {response.status_code}"
        print("PASS: POST /api/image-layouts validates name is non-empty")
    
    def test_create_layout_success(self, auth_session):
        """POST /api/image-layouts creates a layout successfully"""
        test_layers = [
            {
                "name": "Layer 1",
                "imageData": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                "x": 100,
                "y": 200,
                "scale": 300,
                "rotation": 45,
                "opacity": 80,
                "visible": True
            },
            {
                "name": "Layer 2",
                "imageData": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                "x": 300,
                "y": 400,
                "scale": 200,
                "rotation": 0,
                "opacity": 100,
                "visible": False
            }
        ]
        
        response = auth_session.post(
            f"{BASE_URL}/api/image-layouts",
            json={"name": "Test Layout 1", "layers": test_layers}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain id"
        assert data["name"] == "Test Layout 1", f"Name mismatch: {data['name']}"
        assert "created_at" in data, "Response should contain created_at"
        assert data["layer_count"] == 2, f"Layer count mismatch: {data['layer_count']}"
        
        # Store layout ID for later tests
        auth_session.created_layout_id = data["id"]
        print(f"PASS: POST /api/image-layouts creates layout successfully (id: {data['id']})")
    
    def test_list_layouts_returns_user_layouts(self, auth_session):
        """GET /api/image-layouts returns list of user's layouts"""
        response = auth_session.get(f"{BASE_URL}/api/image-layouts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "layouts" in data, "Response should contain layouts array"
        assert isinstance(data["layouts"], list), "layouts should be a list"
        
        # Should have at least the layout we created
        assert len(data["layouts"]) >= 1, "Should have at least 1 layout"
        
        # Verify layout structure (without layers - list endpoint excludes them)
        layout = data["layouts"][0]
        assert "id" in layout, "Layout should have id"
        assert "name" in layout, "Layout should have name"
        assert "created_at" in layout, "Layout should have created_at"
        # layers should NOT be in list response (excluded for performance)
        assert "layers" not in layout, "List response should not include layers"
        
        print(f"PASS: GET /api/image-layouts returns {len(data['layouts'])} layout(s)")
    
    def test_get_layout_returns_full_layout(self, auth_session):
        """GET /api/image-layouts/{id} returns full layout with layers"""
        layout_id = getattr(auth_session, 'created_layout_id', None)
        if not layout_id:
            pytest.skip("No layout ID from previous test")
        
        response = auth_session.get(f"{BASE_URL}/api/image-layouts/{layout_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["id"] == layout_id, f"ID mismatch: {data['id']}"
        assert data["name"] == "Test Layout 1", f"Name mismatch: {data['name']}"
        assert "layers" in data, "Response should contain layers"
        assert len(data["layers"]) == 2, f"Should have 2 layers, got {len(data['layers'])}"
        
        # Verify layer data
        layer1 = data["layers"][0]
        assert layer1["name"] == "Layer 1", f"Layer 1 name mismatch: {layer1['name']}"
        assert layer1["x"] == 100, f"Layer 1 x mismatch: {layer1['x']}"
        assert layer1["y"] == 200, f"Layer 1 y mismatch: {layer1['y']}"
        assert layer1["scale"] == 300, f"Layer 1 scale mismatch: {layer1['scale']}"
        assert layer1["rotation"] == 45, f"Layer 1 rotation mismatch: {layer1['rotation']}"
        assert layer1["opacity"] == 80, f"Layer 1 opacity mismatch: {layer1['opacity']}"
        assert layer1["visible"] == True, f"Layer 1 visible mismatch: {layer1['visible']}"
        
        print(f"PASS: GET /api/image-layouts/{layout_id} returns full layout with layers")
    
    def test_get_nonexistent_layout_returns_404(self, auth_session):
        """GET /api/image-layouts/{id} returns 404 for non-existent layout"""
        response = auth_session.get(f"{BASE_URL}/api/image-layouts/nonexistent-id-12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("PASS: GET /api/image-layouts/{id} returns 404 for non-existent layout")
    
    def test_delete_layout_success(self, auth_session):
        """DELETE /api/image-layouts/{id} deletes a layout"""
        # Create a layout to delete
        response = auth_session.post(
            f"{BASE_URL}/api/image-layouts",
            json={"name": "Layout to Delete", "layers": []}
        )
        assert response.status_code == 200
        layout_id = response.json()["id"]
        
        # Delete it
        delete_response = auth_session.delete(f"{BASE_URL}/api/image-layouts/{layout_id}")
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
        
        data = delete_response.json()
        assert data.get("success") == True, f"Expected success: true, got {data}"
        
        # Verify it's gone
        get_response = auth_session.get(f"{BASE_URL}/api/image-layouts/{layout_id}")
        assert get_response.status_code == 404, "Deleted layout should return 404"
        
        print(f"PASS: DELETE /api/image-layouts/{layout_id} deletes layout successfully")
    
    def test_delete_nonexistent_layout_returns_404(self, auth_session):
        """DELETE /api/image-layouts/{id} returns 404 for non-existent layout"""
        response = auth_session.delete(f"{BASE_URL}/api/image-layouts/nonexistent-id-67890")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("PASS: DELETE /api/image-layouts/{id} returns 404 for non-existent layout")


class TestDownloadEndpoint:
    """Test the download endpoint"""
    
    def test_download_windows_zip_returns_200(self):
        """GET /api/download/OverGrid-Windows.zip returns 200"""
        response = requests.get(f"{BASE_URL}/api/download/OverGrid-Windows.zip", stream=True)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert "application/octet-stream" in response.headers.get("content-type", ""), \
            f"Expected octet-stream content type, got {response.headers.get('content-type')}"
        print("PASS: GET /api/download/OverGrid-Windows.zip returns 200")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
