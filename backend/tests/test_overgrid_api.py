"""
OverGrid API Tests - Iteration 7
Tests for Auth, Health, Community Cliparts, and Core API endpoints
"""

import pytest
import requests
import os
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = f"test_api_{datetime.now().strftime('%Y%m%d%H%M%S')}@test.com"
TEST_PASSWORD = "test123"
TEST_NAME = "API Test User"
TEST_NICKNAME = "APITester42"

# Existing test user
EXISTING_EMAIL = "test@test.com"
EXISTING_PASSWORD = "test123"


class TestHealthEndpoints:
    """Health and Root endpoint tests"""
    
    def test_health_check(self):
        """Test /api/health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        print(f"✓ Health check passed: {data}")
    
    def test_root_endpoint(self):
        """Test /api/ root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "version" in data
        print(f"✓ Root endpoint passed: {data}")


class TestAuthRegister:
    """Registration endpoint tests"""
    
    def test_register_new_user(self):
        """Test POST /api/auth/register with new user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
                "name": TEST_NAME,
                "nickname": TEST_NICKNAME
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == TEST_EMAIL
        assert data["name"] == TEST_NAME
        assert data["nickname"] == TEST_NICKNAME
        assert "user_id" in data
        assert data["auth_provider"] == "local"
        print(f"✓ Registration passed for {TEST_EMAIL}")
    
    def test_register_duplicate_email(self):
        """Test registration with existing email fails"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": EXISTING_EMAIL,
                "password": "anypassword",
                "name": "Duplicate User",
                "nickname": ""
            }
        )
        assert response.status_code == 400
        data = response.json()
        assert "already registered" in data.get("detail", "").lower()
        print("✓ Duplicate email registration correctly rejected")


class TestAuthLogin:
    """Login endpoint tests"""
    
    def test_login_success(self):
        """Test POST /api/auth/login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": EXISTING_EMAIL,
                "password": EXISTING_PASSWORD
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == EXISTING_EMAIL
        assert "user_id" in data
        assert "name" in data
        # Check cookie is set
        assert "session_token" in response.cookies
        print(f"✓ Login successful for {EXISTING_EMAIL}")
    
    def test_login_invalid_password(self):
        """Test login with wrong password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": EXISTING_EMAIL,
                "password": "wrongpassword"
            }
        )
        assert response.status_code == 401
        print("✓ Invalid password correctly rejected")
    
    def test_login_nonexistent_user(self):
        """Test login with non-existent email"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "nonexistent@test.com",
                "password": "anypassword"
            }
        )
        assert response.status_code == 401
        print("✓ Non-existent user login correctly rejected")


class TestAuthMe:
    """GET /api/auth/me endpoint tests"""
    
    def test_get_me_authenticated(self):
        """Test GET /api/auth/me with valid session"""
        # First login to get session
        session = requests.Session()
        login_resp = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": EXISTING_EMAIL, "password": EXISTING_PASSWORD}
        )
        assert login_resp.status_code == 200
        
        # Now call /me
        me_resp = session.get(f"{BASE_URL}/api/auth/me")
        assert me_resp.status_code == 200
        data = me_resp.json()
        assert data["email"] == EXISTING_EMAIL
        print(f"✓ GET /me returned user: {data['email']}")
    
    def test_get_me_unauthenticated(self):
        """Test GET /api/auth/me without session"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("✓ Unauthenticated /me correctly returns 401")


class TestCommunityCliparts:
    """Community cliparts endpoint tests"""
    
    def test_get_community_cliparts(self):
        """Test GET /api/community-cliparts (public)"""
        response = requests.get(f"{BASE_URL}/api/community-cliparts")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Community cliparts returned {len(data)} items")
    
    def test_get_cliparts_with_category(self):
        """Test GET /api/community-cliparts with category filter"""
        response = requests.get(f"{BASE_URL}/api/community-cliparts?category=effects")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Category filter returned {len(data)} items")
    
    def test_get_cliparts_with_search(self):
        """Test GET /api/community-cliparts with search query"""
        response = requests.get(f"{BASE_URL}/api/community-cliparts?search=fire")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Search query returned {len(data)} items")
    
    def test_upload_clipart_unauthenticated(self):
        """Test POST /api/community-cliparts without auth"""
        response = requests.post(
            f"{BASE_URL}/api/community-cliparts",
            json={
                "name": "Test Clipart",
                "category": "other",
                "image_data": "data:image/png;base64,iVBORw0KGgo=",
                "tags": ["test"]
            }
        )
        assert response.status_code == 401
        print("✓ Clipart upload without auth correctly rejected")


class TestPresets:
    """Preset CRUD endpoint tests"""
    
    def test_get_presets(self):
        """Test GET /api/presets"""
        response = requests.get(f"{BASE_URL}/api/presets")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Presets returned {len(data)} items")
    
    def test_create_and_delete_preset(self):
        """Test POST /api/presets and DELETE"""
        # Create preset
        create_response = requests.post(
            f"{BASE_URL}/api/presets",
            json={
                "name": "TEST_Preset_API",
                "description": "Test preset from API tests",
                "settings": {
                    "screen_width": 1920,
                    "screen_height": 1080,
                    "unit_width": 64,
                    "unit_height": 32,
                    "grid_color": "#00FF00",
                    "line_thickness": 1.0,
                    "opacity": 0.5,
                    "show_subdivisions": False,
                    "subdivision_count": 2
                }
            }
        )
        assert create_response.status_code == 200
        created = create_response.json()
        assert created["name"] == "TEST_Preset_API"
        preset_id = created["id"]
        print(f"✓ Preset created with id: {preset_id}")
        
        # Verify by GET
        get_response = requests.get(f"{BASE_URL}/api/presets/{preset_id}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["name"] == "TEST_Preset_API"
        print("✓ Preset verified via GET")
        
        # Delete preset
        delete_response = requests.delete(f"{BASE_URL}/api/presets/{preset_id}")
        assert delete_response.status_code == 200
        print("✓ Preset deleted successfully")
        
        # Verify deletion
        verify_response = requests.get(f"{BASE_URL}/api/presets/{preset_id}")
        assert verify_response.status_code == 404
        print("✓ Preset deletion verified")


class TestDefaultSettings:
    """Default settings endpoint test"""
    
    def test_get_default_settings(self):
        """Test GET /api/default-settings"""
        response = requests.get(f"{BASE_URL}/api/default-settings")
        assert response.status_code == 200
        data = response.json()
        assert "screen_width" in data
        assert "screen_height" in data
        assert "grid_color" in data
        print(f"✓ Default settings returned: {data['screen_width']}x{data['screen_height']}")


class TestLogout:
    """Logout endpoint test"""
    
    def test_logout(self):
        """Test POST /api/auth/logout"""
        # Login first
        session = requests.Session()
        login_resp = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": EXISTING_EMAIL, "password": EXISTING_PASSWORD}
        )
        assert login_resp.status_code == 200
        
        # Logout
        logout_resp = session.post(f"{BASE_URL}/api/auth/logout")
        assert logout_resp.status_code == 200
        print("✓ Logout successful")
        
        # Verify session is invalidated
        me_resp = session.get(f"{BASE_URL}/api/auth/me")
        assert me_resp.status_code == 401
        print("✓ Session invalidated after logout")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
