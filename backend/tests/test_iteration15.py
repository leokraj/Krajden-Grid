"""
Iteration 15 Tests: PlacedBackgroundImage and PlacedClipart toolbar persistence fix
Tests the download endpoint and basic API health
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndDownload:
    """Test health endpoint and download functionality"""
    
    def test_health_endpoint(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"Health check passed: {data}")
    
    def test_download_endpoint_exists(self):
        """Test /api/download/OverGrid-Windows.zip returns 200"""
        response = requests.get(f"{BASE_URL}/api/download/OverGrid-Windows.zip", stream=True)
        assert response.status_code == 200
        # Check content type
        content_type = response.headers.get('content-type', '')
        assert 'application/octet-stream' in content_type or 'application/zip' in content_type
        print(f"Download endpoint works: status={response.status_code}, content-type={content_type}")
    
    def test_download_nonexistent_file(self):
        """Test /api/download with non-existent file returns 404"""
        response = requests.get(f"{BASE_URL}/api/download/nonexistent.zip")
        assert response.status_code == 404
        print("Non-existent file correctly returns 404")


class TestAuthAPI:
    """Test authentication endpoints"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "test123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "session_token" in data
        assert "user_id" in data
        print(f"Login successful: user_id={data['user_id']}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("Invalid credentials correctly returns 401")


class TestPresetsAPI:
    """Test presets CRUD endpoints"""
    
    def test_get_presets(self):
        """Test GET /api/presets"""
        response = requests.get(f"{BASE_URL}/api/presets")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Got {len(data)} presets")
    
    def test_get_default_settings(self):
        """Test GET /api/default-settings"""
        response = requests.get(f"{BASE_URL}/api/default-settings")
        assert response.status_code == 200
        data = response.json()
        assert "screen_width" in data
        assert "screen_height" in data
        print(f"Default settings: {data['screen_width']}x{data['screen_height']}")


class TestDebugEndpoints:
    """Test debug endpoints"""
    
    def test_debug_sessions(self):
        """Test GET /api/debug/sessions"""
        response = requests.get(f"{BASE_URL}/api/debug/sessions")
        assert response.status_code == 200
        data = response.json()
        assert "active_sessions" in data
        assert "count" in data
        print(f"Active sessions: {data['count']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
