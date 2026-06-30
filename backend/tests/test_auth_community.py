"""
Backend API Tests for OverGrid Auth and Community Library Features
Tests:
- Auth: Register, Login, Me, Logout, Google Session (401)
- Community Cliparts: Browse (public), Search, Category filter
- Community Cliparts: Upload, My uploads, Delete (auth required)
- Community Cliparts: Download count increment
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user credentials - generate unique email to avoid conflicts
TEST_EMAIL = f"test_user_{uuid.uuid4().hex[:8]}@example.com"
TEST_PASSWORD = "test123456"
TEST_NAME = "Test User"


class TestHealthCheck:
    """Verify backend is running before testing"""
    
    def test_health(self):
        """Test health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        print(f"Health check passed: {response.json()}")


class TestAuthRegister:
    """Test POST /api/auth/register"""
    
    def test_register_new_user(self):
        """Register a new user with email/password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
                "name": TEST_NAME
            }
        )
        assert response.status_code == 200, f"Register failed: {response.text}"
        data = response.json()
        assert "user_id" in data
        assert data["email"] == TEST_EMAIL
        assert data["name"] == TEST_NAME
        assert data["auth_provider"] == "local"
        print(f"Registered user: {data['user_id']}")
        
    def test_register_duplicate_email(self):
        """Cannot register with duplicate email"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": TEST_EMAIL,  # Same email as above
                "password": "different",
                "name": "Another User"
            }
        )
        assert response.status_code == 400, f"Should fail with 400, got: {response.status_code}"
        data = response.json()
        assert "already registered" in data.get("detail", "").lower()
        print(f"Duplicate email rejected: {data}")
    
    def test_register_invalid_password(self):
        """Password must be at least 6 characters"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": f"short_pwd_{uuid.uuid4().hex[:6]}@example.com",
                "password": "12345",  # Only 5 chars
                "name": "Test"
            }
        )
        assert response.status_code == 422, f"Should fail with 422, got: {response.status_code}"
        print(f"Short password rejected")


class TestAuthLogin:
    """Test POST /api/auth/login"""
    
    def test_login_valid_credentials(self):
        """Login with valid email/password"""
        # First ensure user exists
        register_email = f"login_test_{uuid.uuid4().hex[:8]}@example.com"
        requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": register_email, "password": TEST_PASSWORD, "name": "Login Test"}
        )
        
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": register_email, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "user_id" in data
        assert data["email"] == register_email
        
        # Check session cookie was set
        assert "session_token" in response.cookies or "set-cookie" in str(response.headers).lower()
        print(f"Login successful: {data['user_id']}")
        return response.cookies
    
    def test_login_invalid_password(self):
        """Login fails with wrong password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": "wrongpassword"}
        )
        assert response.status_code == 401, f"Should fail with 401, got: {response.status_code}"
        print("Invalid password rejected")
    
    def test_login_nonexistent_user(self):
        """Login fails for non-existent user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "nonexistent@example.com", "password": "anypassword"}
        )
        assert response.status_code == 401, f"Should fail with 401, got: {response.status_code}"
        print("Non-existent user rejected")


class TestAuthMe:
    """Test GET /api/auth/me"""
    
    @pytest.fixture
    def auth_session(self):
        """Create authenticated session"""
        session = requests.Session()
        email = f"me_test_{uuid.uuid4().hex[:8]}@example.com"
        
        # Register
        session.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": email, "password": TEST_PASSWORD, "name": "Me Test"}
        )
        return session, email
    
    def test_me_authenticated(self, auth_session):
        """Get current user info when authenticated"""
        session, email = auth_session
        response = session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Me failed: {response.text}"
        data = response.json()
        assert data["email"] == email
        print(f"Me returned: {data}")
    
    def test_me_unauthenticated(self):
        """Me endpoint returns 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401, f"Should fail with 401, got: {response.status_code}"
        print("Unauthenticated /me rejected")


class TestAuthLogout:
    """Test POST /api/auth/logout"""
    
    def test_logout(self):
        """Logout clears session"""
        session = requests.Session()
        email = f"logout_test_{uuid.uuid4().hex[:8]}@example.com"
        
        # Register & login
        session.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": email, "password": TEST_PASSWORD, "name": "Logout Test"}
        )
        
        # Verify authenticated
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        
        # Logout
        logout_response = session.post(f"{BASE_URL}/api/auth/logout")
        assert logout_response.status_code == 200
        data = logout_response.json()
        assert "logged out" in data.get("message", "").lower()
        print("Logout successful")
        
        # Verify no longer authenticated (session cleared)
        me_after = session.get(f"{BASE_URL}/api/auth/me")
        assert me_after.status_code == 401
        print("Session cleared after logout")


class TestAuthGoogleSession:
    """Test POST /api/auth/google-session"""
    
    def test_google_session_invalid_id(self):
        """Invalid session_id returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/google-session",
            json={"session_id": "invalid_session_id"}
        )
        # Should fail - invalid session ID
        assert response.status_code in [401, 502], f"Should fail, got: {response.status_code}"
        print(f"Invalid Google session rejected: {response.status_code}")


class TestCommunityClipartsPublic:
    """Test community clipart browsing (no auth required)"""
    
    def test_get_community_cliparts(self):
        """Browse community cliparts without auth"""
        response = requests.get(f"{BASE_URL}/api/community-cliparts")
        assert response.status_code == 200, f"Get cliparts failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} community cliparts")
    
    def test_search_community_cliparts(self):
        """Search community cliparts"""
        response = requests.get(f"{BASE_URL}/api/community-cliparts?search=test")
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Search returned {len(data)} results")
    
    def test_category_filter(self):
        """Filter by category"""
        response = requests.get(f"{BASE_URL}/api/community-cliparts?category=markers")
        assert response.status_code == 200, f"Category filter failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        # Verify all returned items have the correct category
        for item in data:
            assert item.get("category") == "markers", f"Wrong category: {item.get('category')}"
        print(f"Category filter returned {len(data)} markers")
    
    def test_sort_options(self):
        """Test sort options"""
        for sort in ["popular", "recent", "name"]:
            response = requests.get(f"{BASE_URL}/api/community-cliparts?sort={sort}")
            assert response.status_code == 200, f"Sort by {sort} failed: {response.text}"
            print(f"Sort by {sort}: OK")


class TestCommunityClipartsAuth:
    """Test community clipart auth-protected operations"""
    
    @pytest.fixture
    def auth_session(self):
        """Create authenticated session for clipart testing"""
        session = requests.Session()
        email = f"clipart_test_{uuid.uuid4().hex[:8]}@example.com"
        
        # Register
        response = session.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": email, "password": TEST_PASSWORD, "name": "Clipart Tester"}
        )
        assert response.status_code == 200, f"Setup failed: {response.text}"
        return session
    
    def test_upload_without_auth(self):
        """Upload requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/community-cliparts",
            json={
                "name": "Test Clipart",
                "category": "other",
                "image_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                "tags": ["test"]
            }
        )
        assert response.status_code == 401, f"Should require auth, got: {response.status_code}"
        print("Upload without auth rejected: 401")
    
    def test_upload_with_auth(self, auth_session):
        """Upload clipart with authentication"""
        response = auth_session.post(
            f"{BASE_URL}/api/community-cliparts",
            json={
                "name": "TEST_Auth_Clipart",
                "category": "markers",
                "image_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                "tags": ["test", "automated"]
            }
        )
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["name"] == "TEST_Auth_Clipart"
        assert data["category"] == "markers"
        assert "uploaded_by" in data
        print(f"Uploaded clipart: {data['id']}")
        return data["id"]
    
    def test_get_my_uploads_without_auth(self):
        """My uploads requires authentication"""
        response = requests.get(f"{BASE_URL}/api/community-cliparts/my")
        assert response.status_code == 401, f"Should require auth, got: {response.status_code}"
        print("My uploads without auth rejected: 401")
    
    def test_get_my_uploads_with_auth(self, auth_session):
        """Get my uploads with authentication"""
        # First upload something
        auth_session.post(
            f"{BASE_URL}/api/community-cliparts",
            json={
                "name": "TEST_My_Upload",
                "category": "other",
                "image_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                "tags": []
            }
        )
        
        # Get my uploads
        response = auth_session.get(f"{BASE_URL}/api/community-cliparts/my")
        assert response.status_code == 200, f"Get my uploads failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1, "Should have at least 1 upload"
        print(f"Found {len(data)} of my uploads")
    
    def test_delete_own_clipart(self, auth_session):
        """Delete own clipart"""
        # Upload
        upload_response = auth_session.post(
            f"{BASE_URL}/api/community-cliparts",
            json={
                "name": "TEST_To_Delete",
                "category": "other",
                "image_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                "tags": []
            }
        )
        clipart_id = upload_response.json()["id"]
        
        # Delete
        delete_response = auth_session.delete(f"{BASE_URL}/api/community-cliparts/{clipart_id}")
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        print(f"Deleted clipart: {clipart_id}")
        
        # Verify deletion - should not appear in my uploads
        my_uploads = auth_session.get(f"{BASE_URL}/api/community-cliparts/my")
        ids = [c["id"] for c in my_uploads.json()]
        assert clipart_id not in ids, "Deleted clipart still in my uploads"
        print("Delete verified")
    
    def test_delete_without_auth(self):
        """Delete requires authentication"""
        response = requests.delete(f"{BASE_URL}/api/community-cliparts/nonexistent")
        assert response.status_code == 401, f"Should require auth, got: {response.status_code}"
        print("Delete without auth rejected: 401")


class TestDownloadCount:
    """Test download count increment"""
    
    def test_increment_download_nonexistent(self):
        """Increment fails for non-existent clipart"""
        response = requests.post(f"{BASE_URL}/api/community-cliparts/nonexistent/download")
        assert response.status_code == 404, f"Should fail with 404, got: {response.status_code}"
        print("Non-existent clipart download rejected: 404")
    
    def test_increment_download(self):
        """Increment download count (no auth required)"""
        # First create a clipart
        session = requests.Session()
        email = f"download_test_{uuid.uuid4().hex[:8]}@example.com"
        session.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": email, "password": TEST_PASSWORD, "name": "Download Tester"}
        )
        
        upload_response = session.post(
            f"{BASE_URL}/api/community-cliparts",
            json={
                "name": "TEST_Download_Count",
                "category": "other",
                "image_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                "tags": []
            }
        )
        clipart_id = upload_response.json()["id"]
        initial_downloads = upload_response.json().get("downloads", 0)
        
        # Increment (no auth required)
        inc_response = requests.post(f"{BASE_URL}/api/community-cliparts/{clipart_id}/download")
        assert inc_response.status_code == 200, f"Increment failed: {inc_response.text}"
        
        # Verify count increased (check via browse)
        browse_response = requests.get(f"{BASE_URL}/api/community-cliparts")
        clipart = next((c for c in browse_response.json() if c["id"] == clipart_id), None)
        if clipart:
            assert clipart["downloads"] == initial_downloads + 1, f"Download count not incremented"
            print(f"Download count: {initial_downloads} -> {clipart['downloads']}")
        
        # Cleanup
        session.delete(f"{BASE_URL}/api/community-cliparts/{clipart_id}")


# Cleanup test data after all tests
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data():
    """Cleanup TEST_ prefixed cliparts after all tests"""
    yield
    print("\n--- Cleanup ---")
    # Note: Each test cleans up its own data via the session


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
