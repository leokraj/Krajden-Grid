"""
Test Auth Fixes for Iteration 10:
- Email/password login/register return session_token in response body
- Bearer token auth works for /api/auth/me and protected endpoints
- Session token is properly generated and validated
- Clipart API works with Bearer token auth
"""

import pytest
import requests
import os
import time
from uuid import uuid4

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthTokenInResponse:
    """Test that login/register return session_token in response body"""
    
    def test_register_returns_session_token(self):
        """Registration should return session_token in response body"""
        unique_email = f"test_register_{uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "test1234",
            "name": "Test User",
            "nickname": "TestNick"
        })
        
        assert response.status_code == 200, f"Register failed: {response.text}"
        data = response.json()
        
        # Key assertion: session_token must be in response body
        assert "session_token" in data, "session_token not found in register response"
        assert data["session_token"].startswith("sess_"), f"Invalid token format: {data['session_token']}"
        assert data["user_id"].startswith("user_"), "user_id not in expected format"
        assert data["email"] == unique_email, "Email mismatch"
        assert data["name"] == "Test User", "Name mismatch"
        print(f"✓ Register returns session_token: {data['session_token'][:20]}...")
    
    def test_login_returns_session_token(self):
        """Login should return session_token in response body"""
        # First register a user
        unique_email = f"test_login_{uuid4().hex[:8]}@test.com"
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "test1234",
            "name": "Login Test User"
        })
        assert reg_response.status_code == 200, f"Register failed: {reg_response.text}"
        
        # Now login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": unique_email,
            "password": "test1234"
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Key assertion: session_token must be in response body
        assert "session_token" in data, "session_token not found in login response"
        assert data["session_token"].startswith("sess_"), f"Invalid token format: {data['session_token']}"
        assert data["email"] == unique_email, "Email mismatch"
        print(f"✓ Login returns session_token: {data['session_token'][:20]}...")
    
    def test_login_with_existing_user(self):
        """Test login with the existing test user: desktoptest@test.com"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "desktoptest@test.com",
            "password": "test1234"
        })
        
        # This might fail if user doesn't exist, which is fine - we'll register first
        if response.status_code == 401:
            # Register first
            reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
                "email": "desktoptest@test.com",
                "password": "test1234",
                "name": "Desktop Test User",
                "nickname": "DesktopTester"
            })
            if reg_response.status_code == 400:  # Already exists with different password?
                print("⚠ desktoptest@test.com exists but different password")
                return
            assert reg_response.status_code == 200, f"Register failed: {reg_response.text}"
            # Try login again
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": "desktoptest@test.com",
                "password": "test1234"
            })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "session_token" in data, "session_token not in response"
        print(f"✓ desktoptest@test.com login works, token: {data['session_token'][:20]}...")


class TestBearerTokenAuth:
    """Test Bearer token authentication works for protected endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get a valid session token"""
        unique_email = f"test_bearer_{uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "test1234",
            "name": "Bearer Test User"
        })
        assert response.status_code == 200, f"Register failed: {response.text}"
        return response.json()["session_token"]
    
    def test_auth_me_with_bearer_token(self, auth_token):
        """GET /api/auth/me should work with Bearer token in Authorization header"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Auth/me with Bearer failed: {response.text}"
        data = response.json()
        assert "user_id" in data, "user_id not in response"
        assert "email" in data, "email not in response"
        print(f"✓ /api/auth/me works with Bearer token for user: {data['email']}")
    
    def test_auth_me_without_token_fails(self):
        """GET /api/auth/me without token should return 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ /api/auth/me correctly returns 401 without auth")
    
    def test_auth_me_with_invalid_token_fails(self):
        """GET /api/auth/me with invalid token should return 401"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": "Bearer invalid_token_123"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ /api/auth/me correctly returns 401 with invalid token")


class TestClipartAPIWithBearerToken:
    """Test clipart API works with Bearer token authentication"""
    
    @pytest.fixture
    def auth_token(self):
        """Get a valid session token"""
        unique_email = f"test_clipart_{uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "test1234",
            "name": "Clipart Test User"
        })
        assert response.status_code == 200, f"Register failed: {response.text}"
        return response.json()["session_token"]
    
    def test_get_cliparts_with_bearer_token(self, auth_token):
        """GET /api/auth/cliparts should work with Bearer token"""
        response = requests.get(
            f"{BASE_URL}/api/auth/cliparts",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Get cliparts failed: {response.text}"
        data = response.json()
        assert "cliparts" in data, "cliparts not in response"
        assert "favorites" in data, "favorites not in response"
        print(f"✓ GET /api/auth/cliparts works with Bearer token")
    
    def test_save_cliparts_with_bearer_token(self, auth_token):
        """PUT /api/auth/cliparts should work with Bearer token"""
        test_cliparts = [
            {"name": "Test Clipart", "image": "test_base64", "category": "test"}
        ]
        test_favorites = ["fav1", "fav2"]
        
        response = requests.put(
            f"{BASE_URL}/api/auth/cliparts",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            json={"cliparts": test_cliparts, "favorites": test_favorites}
        )
        
        assert response.status_code == 200, f"Save cliparts failed: {response.text}"
        data = response.json()
        assert data.get("saved") == True, "saved not True in response"
        print(f"✓ PUT /api/auth/cliparts works with Bearer token")
    
    def test_cliparts_without_auth_fails(self):
        """GET /api/auth/cliparts without auth should return 401"""
        response = requests.get(f"{BASE_URL}/api/auth/cliparts")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ GET /api/auth/cliparts correctly returns 401 without auth")


class TestLogoutClearsSession:
    """Test that logout properly clears the session"""
    
    def test_logout_invalidates_token(self):
        """After logout, token should no longer work"""
        # Register and get token
        unique_email = f"test_logout_{uuid4().hex[:8]}@test.com"
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "test1234",
            "name": "Logout Test User"
        })
        assert reg_response.status_code == 200
        token = reg_response.json()["session_token"]
        
        # Verify token works
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert me_response.status_code == 200, "Token should work before logout"
        
        # Logout with Bearer token
        logout_response = requests.post(
            f"{BASE_URL}/api/auth/logout",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert logout_response.status_code == 200, f"Logout failed: {logout_response.text}"
        
        # Verify token no longer works
        me_response2 = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert me_response2.status_code == 401, "Token should be invalidated after logout"
        print("✓ Logout successfully invalidates session token")


class TestNicknameUpdate:
    """Test nickname update endpoint with Bearer token"""
    
    def test_update_nickname_with_bearer_token(self):
        """PATCH /api/auth/nickname should work with Bearer token"""
        # Register
        unique_email = f"test_nickname_{uuid4().hex[:8]}@test.com"
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "test1234",
            "name": "Nickname Test User",
            "nickname": "OldNick"
        })
        assert reg_response.status_code == 200
        token = reg_response.json()["session_token"]
        
        # Update nickname
        new_nickname = f"NewNick_{uuid4().hex[:4]}"
        response = requests.patch(
            f"{BASE_URL}/api/auth/nickname",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            json={"nickname": new_nickname}
        )
        
        assert response.status_code == 200, f"Update nickname failed: {response.text}"
        data = response.json()
        assert data.get("nickname") == new_nickname, f"Nickname not updated correctly"
        
        # Verify via /me endpoint
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert me_response.status_code == 200
        assert me_response.json().get("nickname") == new_nickname
        print(f"✓ Nickname update works with Bearer token: {new_nickname}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
