"""
Backend API and Session Tests for OverGrid
Tests:
- Health check endpoint
- Presets CRUD
- Session management functions
- Clipart sync event handlers
"""

import pytest
import requests
import os
import sys

# Add backend to path for importing sessions module
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndBasicAPI:
    """Test basic API endpoints"""
    
    def test_health_check(self):
        """Test health endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'healthy'
        assert 'timestamp' in data
        print(f"Health check passed: {data}")
    
    def test_root_endpoint(self):
        """Test root API endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert 'message' in data
        assert 'OverGrid' in data['message']
        print(f"Root endpoint passed: {data}")
    
    def test_default_settings(self):
        """Test default settings endpoint"""
        response = requests.get(f"{BASE_URL}/api/default-settings")
        assert response.status_code == 200
        data = response.json()
        assert 'screen_width' in data
        assert 'screen_height' in data
        assert data['screen_width'] == 1920
        assert data['screen_height'] == 1080
        print(f"Default settings passed: {data}")


class TestPresetsCRUD:
    """Test Presets CRUD operations"""
    
    @pytest.fixture
    def test_preset_data(self):
        return {
            "name": "TEST_Preset_DnD",
            "description": "Test preset for D&D grid",
            "settings": {
                "screen_width": 1920,
                "screen_height": 1080,
                "unit_width": 40,
                "unit_height": 40,
                "grid_color": "#FF0000",
                "line_thickness": 2.0,
                "opacity": 0.5,
                "show_subdivisions": True,
                "subdivision_count": 4
            }
        }
    
    def test_create_preset(self, test_preset_data):
        """Test creating a new preset"""
        response = requests.post(f"{BASE_URL}/api/presets", json=test_preset_data)
        assert response.status_code == 200
        data = response.json()
        assert data['name'] == test_preset_data['name']
        assert 'id' in data
        print(f"Created preset: {data['id']}")
        return data['id']
    
    def test_get_presets(self):
        """Test getting all presets"""
        response = requests.get(f"{BASE_URL}/api/presets")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} presets")
    
    def test_preset_crud_flow(self, test_preset_data):
        """Test full CRUD flow for presets"""
        # CREATE
        create_response = requests.post(f"{BASE_URL}/api/presets", json=test_preset_data)
        assert create_response.status_code == 200
        created = create_response.json()
        preset_id = created['id']
        print(f"Created preset with ID: {preset_id}")
        
        # READ
        get_response = requests.get(f"{BASE_URL}/api/presets/{preset_id}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched['name'] == test_preset_data['name']
        print(f"Fetched preset: {fetched['name']}")
        
        # UPDATE
        update_data = {"name": "TEST_Updated_Preset"}
        update_response = requests.put(f"{BASE_URL}/api/presets/{preset_id}", json=update_data)
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated['name'] == "TEST_Updated_Preset"
        print(f"Updated preset name to: {updated['name']}")
        
        # DELETE
        delete_response = requests.delete(f"{BASE_URL}/api/presets/{preset_id}")
        assert delete_response.status_code == 200
        print(f"Deleted preset: {preset_id}")
        
        # VERIFY DELETION
        verify_response = requests.get(f"{BASE_URL}/api/presets/{preset_id}")
        assert verify_response.status_code == 404
        print("Verified preset deletion")


class TestSessionFunctions:
    """Test session management functions (unit tests)"""
    
    def test_session_module_imports(self):
        """Test that session module can be imported"""
        try:
            from sessions import (
                generate_session_code,
                create_new_session,
                get_session,
                join_session,
                leave_session,
                end_session,
                block_guest,
                is_blocked,
                get_participants
            )
            print("All session functions imported successfully")
            assert True
        except ImportError as e:
            pytest.fail(f"Failed to import session functions: {e}")
    
    def test_generate_session_code(self):
        """Test session code generation"""
        from sessions import generate_session_code
        
        code = generate_session_code()
        assert len(code) == 6
        assert code.isalnum()
        assert code.isupper()
        print(f"Generated session code: {code}")
    
    def test_create_and_get_session(self):
        """Test creating and retrieving a session"""
        from sessions import create_new_session, get_session, end_session
        
        # Create session
        session = create_new_session("test_host_sid", "Test Host")
        assert session is not None
        assert 'code' in session
        assert session['host_name'] == "Test Host"
        assert session['cliparts'] == []  # Verify cliparts array exists
        print(f"Created session: {session['code']}")
        
        # Get session
        retrieved = get_session(session['code'])
        assert retrieved is not None
        assert retrieved['code'] == session['code']
        print(f"Retrieved session: {retrieved['code']}")
        
        # Cleanup
        end_session(session['code'])
        print("Session cleaned up")
    
    def test_session_cliparts_storage(self):
        """Test that sessions can store cliparts"""
        from sessions import create_new_session, get_session, end_session
        
        # Create session
        session = create_new_session("test_clipart_host", "Clipart Host")
        code = session['code']
        
        # Verify cliparts array exists
        assert 'cliparts' in session
        assert isinstance(session['cliparts'], list)
        
        # Add a clipart manually (simulating what the event handler does)
        test_clipart = {
            'instanceId': 'test_123',
            'id': 'token_fighter',
            'name': 'Fighter',
            'x': 100,
            'y': 200,
            'scale': 50,
            'rotation': 0,
            'user_sid': 'test_clipart_host',
            'user_name': 'Clipart Host'
        }
        session['cliparts'].append(test_clipart)
        
        # Verify clipart was added
        retrieved = get_session(code)
        assert len(retrieved['cliparts']) == 1
        assert retrieved['cliparts'][0]['instanceId'] == 'test_123'
        print(f"Clipart stored successfully: {retrieved['cliparts'][0]['name']}")
        
        # Cleanup
        end_session(code)
    
    def test_join_session(self):
        """Test joining a session"""
        from sessions import create_new_session, join_session, get_participants, end_session
        
        # Create session
        session = create_new_session("host_sid_join", "Host")
        code = session['code']
        
        # Join session
        joined = join_session(code, "guest_sid_1", "Guest 1")
        assert joined is not None
        
        # Check participants
        participants = get_participants(code)
        assert participants['host']['name'] == "Host"
        assert len(participants['guests']) == 1
        assert participants['guests'][0]['name'] == "Guest 1"
        print(f"Guest joined session: {participants}")
        
        # Cleanup
        end_session(code)
    
    def test_block_guest(self):
        """Test blocking a guest"""
        from sessions import create_new_session, join_session, block_guest, is_blocked, end_session
        
        # Create session and add guest
        session = create_new_session("host_sid_block", "Host")
        code = session['code']
        join_session(code, "guest_sid_block", "Guest")
        
        # Block guest
        result = block_guest(code, "guest_sid_block", True)
        assert result == True
        
        # Verify blocked
        assert is_blocked("guest_sid_block") == True
        print("Guest blocked successfully")
        
        # Unblock
        block_guest(code, "guest_sid_block", False)
        assert is_blocked("guest_sid_block") == False
        print("Guest unblocked successfully")
        
        # Cleanup
        end_session(code)


class TestMeasurementsAPI:
    """Test Measurements API"""
    
    def test_get_measurements(self):
        """Test getting measurements list"""
        response = requests.get(f"{BASE_URL}/api/measurements")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} measurements")
    
    def test_create_measurement(self):
        """Test creating a measurement"""
        measurement_data = {
            "start_x": 100.0,
            "start_y": 100.0,
            "end_x": 200.0,
            "end_y": 200.0,
            "pixel_distance": 141.42,
            "unit_distance": 5.0,
            "unit_label": "squares"
        }
        
        response = requests.post(f"{BASE_URL}/api/measurements", json=measurement_data)
        assert response.status_code == 200
        data = response.json()
        assert 'id' in data
        assert data['start_x'] == 100.0
        print(f"Created measurement: {data['id']}")
        
        # Cleanup - delete the measurement
        delete_response = requests.delete(f"{BASE_URL}/api/measurements/{data['id']}")
        assert delete_response.status_code == 200
        print("Measurement cleaned up")


# Cleanup function to remove test data
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data():
    """Cleanup TEST_ prefixed data after all tests"""
    yield
    # Cleanup presets with TEST_ prefix
    try:
        response = requests.get(f"{BASE_URL}/api/presets")
        if response.status_code == 200:
            presets = response.json()
            for preset in presets:
                if preset.get('name', '').startswith('TEST_'):
                    requests.delete(f"{BASE_URL}/api/presets/{preset['id']}")
                    print(f"Cleaned up test preset: {preset['name']}")
    except Exception as e:
        print(f"Cleanup error: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
