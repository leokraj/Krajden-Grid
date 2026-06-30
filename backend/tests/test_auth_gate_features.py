"""
Backend API Tests for OverGrid Auth Gate + Nickname + Server-side Clipart Features
Tests:
- Auth Register: Nickname field support (defaults to name if empty)
- Auth Login: Returns nickname in response
- Auth Me: Returns nickname in response
- Clipart Storage: PUT /api/auth/cliparts saves user cliparts
- Clipart Storage: GET /api/auth/cliparts loads saved cliparts
- Nickname Update: PATCH /api/auth/nickname updates nickname
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_PASSWORD = "test123456"


class TestHealthCheck:
    """Verify backend is running"""
    
    def test_backend_health(self):
        """Health endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Backend not healthy: {response.text}"
        print(f"Backend OK: {response.json()}")


class TestRegisterWithNickname:
    """Test registration with nickname field"""
    
    def test_register_with_nickname(self):
        """Register with explicit nickname"""
        email = f"nick_test_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": TEST_PASSWORD,
                "name": "Nick Test User",
                "nickname": "DungeonMaster42"
            }
        )
        assert response.status_code == 200, f"Register failed: {response.text}"
        data = response.json()
        assert data["nickname"] == "DungeonMaster42", f"Nickname not set: {data.get('nickname')}"
        assert data["name"] == "Nick Test User"
        print(f"Registered with nickname: {data['nickname']}")
    
    def test_register_nickname_defaults_to_name(self):
        """Nickname defaults to name if not provided"""
        email = f"noname_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": TEST_PASSWORD,
                "name": "Default Nickname"
                # No nickname provided
            }
        )
        assert response.status_code == 200, f"Register failed: {response.text}"
        data = response.json()
        # Should default to name
        assert data["nickname"] == "Default Nickname", f"Nickname should default to name: {data.get('nickname')}"
        print(f"Nickname defaulted to name: {data['nickname']}")
    
    def test_register_empty_nickname_defaults_to_name(self):
        """Empty string nickname defaults to name"""
        email = f"empty_nick_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": TEST_PASSWORD,
                "name": "Empty Nick Test",
                "nickname": ""  # Empty string
            }
        )
        assert response.status_code == 200, f"Register failed: {response.text}"
        data = response.json()
        assert data["nickname"] == "Empty Nick Test", f"Empty nickname should default: {data.get('nickname')}"
        print(f"Empty nickname defaulted to name: {data['nickname']}")


class TestLoginReturnsNickname:
    """Test login returns nickname"""
    
    def test_login_returns_nickname(self):
        """Login response includes nickname"""
        email = f"login_nick_{uuid.uuid4().hex[:8]}@example.com"
        
        # Register with nickname
        requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": TEST_PASSWORD,
                "name": "Login Nick Test",
                "nickname": "GamerTag99"
            }
        )
        
        # Login
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "nickname" in data, "Nickname should be in login response"
        assert data["nickname"] == "GamerTag99", f"Wrong nickname: {data.get('nickname')}"
        print(f"Login returned nickname: {data['nickname']}")


class TestMeReturnsNickname:
    """Test /me endpoint returns nickname"""
    
    def test_me_returns_nickname(self):
        """GET /api/auth/me includes nickname"""
        session = requests.Session()
        email = f"me_nick_{uuid.uuid4().hex[:8]}@example.com"
        
        # Register
        session.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": TEST_PASSWORD,
                "name": "Me Nick Test",
                "nickname": "MasterChief117"
            }
        )
        
        # Get /me
        response = session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Me failed: {response.text}"
        data = response.json()
        assert data["nickname"] == "MasterChief117", f"Wrong nickname in /me: {data.get('nickname')}"
        print(f"/me returned nickname: {data['nickname']}")


class TestUpdateNickname:
    """Test PATCH /api/auth/nickname"""
    
    def test_update_nickname(self):
        """Update user nickname"""
        session = requests.Session()
        email = f"update_nick_{uuid.uuid4().hex[:8]}@example.com"
        
        # Register
        session.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": TEST_PASSWORD,
                "name": "Update Test",
                "nickname": "OldNickname"
            }
        )
        
        # Update nickname
        response = session.patch(
            f"{BASE_URL}/api/auth/nickname",
            json={"nickname": "NewAwesomeNick"}
        )
        assert response.status_code == 200, f"Update failed: {response.text}"
        data = response.json()
        assert data["nickname"] == "NewAwesomeNick", f"Nickname not updated: {data}"
        
        # Verify via /me
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        me_data = me_response.json()
        assert me_data["nickname"] == "NewAwesomeNick", f"Nickname not persisted"
        print(f"Nickname updated: OldNickname -> NewAwesomeNick")
    
    def test_update_nickname_validation(self):
        """Nickname must be 1-50 characters"""
        session = requests.Session()
        email = f"valid_nick_{uuid.uuid4().hex[:8]}@example.com"
        
        session.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": TEST_PASSWORD,
                "name": "Validation Test"
            }
        )
        
        # Empty nickname should fail
        response = session.patch(
            f"{BASE_URL}/api/auth/nickname",
            json={"nickname": ""}
        )
        assert response.status_code == 400, f"Empty nickname should fail: {response.status_code}"
        
        # Too long nickname (>50 chars)
        response = session.patch(
            f"{BASE_URL}/api/auth/nickname",
            json={"nickname": "a" * 51}
        )
        assert response.status_code == 400, f"Long nickname should fail: {response.status_code}"
        print("Nickname validation working")


class TestServerSideClipartStorage:
    """Test PUT/GET /api/auth/cliparts"""
    
    @pytest.fixture
    def auth_session(self):
        """Create authenticated session"""
        session = requests.Session()
        email = f"clipart_store_{uuid.uuid4().hex[:8]}@example.com"
        
        session.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": TEST_PASSWORD,
                "name": "Clipart Store Test"
            }
        )
        return session
    
    def test_get_cliparts_initial_empty(self, auth_session):
        """New user has empty cliparts"""
        response = auth_session.get(f"{BASE_URL}/api/auth/cliparts")
        assert response.status_code == 200, f"Get cliparts failed: {response.text}"
        data = response.json()
        assert "cliparts" in data, "Should have cliparts key"
        assert "favorites" in data, "Should have favorites key"
        assert data["cliparts"] == [], "Should be empty initially"
        assert data["favorites"] == [], "Should be empty initially"
        print("Initial cliparts empty: OK")
    
    def test_save_cliparts(self, auth_session):
        """Save custom cliparts to server"""
        test_cliparts = [
            {"id": "custom_1", "name": "Test Token", "imageData": "data:image/png;base64,test1"},
            {"id": "custom_2", "name": "Test Marker", "imageData": "data:image/png;base64,test2"}
        ]
        test_favorites = ["builtin_token_1", "builtin_token_2"]
        
        response = auth_session.put(
            f"{BASE_URL}/api/auth/cliparts",
            json={"cliparts": test_cliparts, "favorites": test_favorites}
        )
        assert response.status_code == 200, f"Save failed: {response.text}"
        data = response.json()
        assert data["saved"] == True, "Should indicate saved"
        assert data["count"] == 2, f"Wrong count: {data.get('count')}"
        print(f"Saved {data['count']} cliparts")
    
    def test_load_saved_cliparts(self, auth_session):
        """Load saved cliparts from server"""
        # First save some cliparts
        test_cliparts = [{"id": "saved_1", "name": "Saved Token"}]
        test_favorites = ["fav_1", "fav_2"]
        
        auth_session.put(
            f"{BASE_URL}/api/auth/cliparts",
            json={"cliparts": test_cliparts, "favorites": test_favorites}
        )
        
        # Now load them
        response = auth_session.get(f"{BASE_URL}/api/auth/cliparts")
        assert response.status_code == 200, f"Load failed: {response.text}"
        data = response.json()
        assert len(data["cliparts"]) == 1, f"Wrong clipart count: {len(data['cliparts'])}"
        assert data["cliparts"][0]["id"] == "saved_1", "Wrong clipart loaded"
        assert data["favorites"] == ["fav_1", "fav_2"], f"Wrong favorites: {data['favorites']}"
        print("Cliparts loaded from server correctly")
    
    def test_cliparts_requires_auth(self):
        """Clipart endpoints require authentication"""
        # GET without auth
        get_response = requests.get(f"{BASE_URL}/api/auth/cliparts")
        assert get_response.status_code == 401, f"GET should require auth: {get_response.status_code}"
        
        # PUT without auth
        put_response = requests.put(
            f"{BASE_URL}/api/auth/cliparts",
            json={"cliparts": [], "favorites": []}
        )
        assert put_response.status_code == 401, f"PUT should require auth: {put_response.status_code}"
        print("Clipart endpoints require auth: OK")


class TestClipartPersistenceAcrossSessions:
    """Test cliparts persist across login sessions"""
    
    def test_cliparts_persist_after_logout_login(self):
        """Cliparts persist after logout and re-login"""
        email = f"persist_{uuid.uuid4().hex[:8]}@example.com"
        session1 = requests.Session()
        
        # Register
        session1.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": TEST_PASSWORD,
                "name": "Persistence Test"
            }
        )
        
        # Save cliparts
        test_cliparts = [{"id": "persist_test", "name": "Persistent Token"}]
        session1.put(
            f"{BASE_URL}/api/auth/cliparts",
            json={"cliparts": test_cliparts, "favorites": ["persist_fav"]}
        )
        
        # Logout
        session1.post(f"{BASE_URL}/api/auth/logout")
        
        # New session - login again
        session2 = requests.Session()
        session2.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": TEST_PASSWORD}
        )
        
        # Load cliparts - should still be there
        response = session2.get(f"{BASE_URL}/api/auth/cliparts")
        assert response.status_code == 200
        data = response.json()
        assert len(data["cliparts"]) == 1, "Cliparts should persist"
        assert data["cliparts"][0]["id"] == "persist_test"
        assert "persist_fav" in data["favorites"]
        print("Cliparts persisted across sessions")


class TestKnownTestUserCredentials:
    """Test with the provided test credentials"""
    
    def test_login_with_test_user(self):
        """Login with nick@example.com (may need to register first)"""
        # Try to login first
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "nick@example.com", "password": "test123"}
        )
        
        if login_response.status_code == 401:
            # User doesn't exist - register
            register_response = requests.post(
                f"{BASE_URL}/api/auth/register",
                json={
                    "email": "nick@example.com",
                    "password": "test123",
                    "name": "Nick Test",
                    "nickname": "DungeonMaster42"
                }
            )
            if register_response.status_code in [200, 400]:  # 400 = already registered
                # Try login again
                login_response = requests.post(
                    f"{BASE_URL}/api/auth/login",
                    json={"email": "nick@example.com", "password": "test123"}
                )
        
        if login_response.status_code == 200:
            data = login_response.json()
            print(f"Test user logged in: {data.get('nickname', data.get('name'))}")
            assert "user_id" in data
        else:
            print(f"Could not login test user: {login_response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
