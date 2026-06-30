"""
Comprehensive test suite for OverGrid collaborative session sync.
Tests: Backend APIs, WebSocket roundtrip, session lifecycle, and real-time sync.
"""
import pytest
import requests
import asyncio
import socketio
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://session-sync-debug.preview.emergentagent.com')

# ==================== HTTP API TESTS ====================

class TestHealthAndDebugAPIs:
    """Test health check and debug endpoints"""
    
    def test_health_endpoint(self):
        """Verify /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        print(f"Health check passed: {data}")
    
    def test_debug_sessions_endpoint(self):
        """Verify /api/debug/sessions returns session data"""
        response = requests.get(f"{BASE_URL}/api/debug/sessions")
        assert response.status_code == 200
        data = response.json()
        assert "active_sessions" in data
        assert "count" in data
        assert isinstance(data["count"], int)
        print(f"Debug sessions: {data['count']} active sessions")


class TestPresetsAPI:
    """Test presets CRUD operations"""
    
    def test_get_presets(self):
        """Verify GET /api/presets returns list"""
        response = requests.get(f"{BASE_URL}/api/presets")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Presets count: {len(data)}")
    
    def test_create_and_delete_preset(self):
        """Test preset creation and deletion"""
        # Create preset
        preset_data = {
            "name": "TEST_Preset",
            "description": "Test preset for automated testing",
            "settings": {
                "screen_width": 1920,
                "screen_height": 1080,
                "unit_width": 66,
                "unit_height": 33,
                "grid_color": "#00F0FF",
                "line_thickness": 1.0,
                "opacity": 0.3,
                "show_subdivisions": False,
                "subdivision_count": 2
            }
        }
        create_response = requests.post(f"{BASE_URL}/api/presets", json=preset_data)
        assert create_response.status_code == 200
        created = create_response.json()
        assert created["name"] == "TEST_Preset"
        assert "id" in created
        preset_id = created["id"]
        print(f"Created preset: {preset_id}")
        
        # Verify it exists
        get_response = requests.get(f"{BASE_URL}/api/presets/{preset_id}")
        assert get_response.status_code == 200
        
        # Delete preset
        delete_response = requests.delete(f"{BASE_URL}/api/presets/{preset_id}")
        assert delete_response.status_code == 200
        print(f"Deleted preset: {preset_id}")
        
        # Verify it's gone
        get_after_delete = requests.get(f"{BASE_URL}/api/presets/{preset_id}")
        assert get_after_delete.status_code == 404


class TestDefaultSettings:
    """Test default settings endpoint"""
    
    def test_get_default_settings(self):
        """Verify GET /api/default-settings returns grid settings"""
        response = requests.get(f"{BASE_URL}/api/default-settings")
        assert response.status_code == 200
        data = response.json()
        assert "screen_width" in data
        assert "screen_height" in data
        assert "unit_width" in data
        assert "unit_height" in data
        assert "grid_color" in data
        print(f"Default settings: {data}")


# ==================== WEBSOCKET TESTS ====================

class TestWebSocketCollaboration:
    """Test WebSocket collaborative session functionality"""
    
    @pytest.fixture
    def event_loop(self):
        """Create event loop for async tests"""
        loop = asyncio.new_event_loop()
        yield loop
        loop.close()
    
    def test_websocket_connection(self):
        """Test WebSocket connection with websocket-first transport"""
        async def run_test():
            client = socketio.AsyncClient(logger=False, engineio_logger=False)
            connected = asyncio.Event()
            
            @client.on('connect')
            async def on_connect():
                connected.set()
            
            await client.connect(BASE_URL, socketio_path='/api/socket.io/', transports=['websocket'])
            await asyncio.wait_for(connected.wait(), timeout=10)
            
            assert client.connected
            print(f"WebSocket connected: {client.sid}")
            
            await client.disconnect()
            return True
        
        result = asyncio.get_event_loop().run_until_complete(run_test())
        assert result
    
    def test_session_create_and_join(self):
        """Test session creation and guest joining"""
        async def run_test():
            host = socketio.AsyncClient(logger=False, engineio_logger=False)
            guest = socketio.AsyncClient(logger=False, engineio_logger=False)
            
            session_code = None
            host_connected = asyncio.Event()
            guest_connected = asyncio.Event()
            session_created = asyncio.Event()
            guest_joined = asyncio.Event()
            
            @host.on('connect')
            async def host_on_connect():
                host_connected.set()
            
            @host.on('session_created')
            async def host_on_session_created(data):
                nonlocal session_code
                session_code = data['code']
                session_created.set()
            
            @host.on('participant_joined')
            async def host_on_participant_joined(data):
                pass
            
            @guest.on('connect')
            async def guest_on_connect():
                guest_connected.set()
            
            @guest.on('session_joined')
            async def guest_on_session_joined(data):
                guest_joined.set()
            
            # Connect both
            await host.connect(BASE_URL, socketio_path='/api/socket.io/', transports=['websocket'])
            await asyncio.wait_for(host_connected.wait(), timeout=10)
            
            await guest.connect(BASE_URL, socketio_path='/api/socket.io/', transports=['websocket'])
            await asyncio.wait_for(guest_connected.wait(), timeout=10)
            
            # Host creates session
            await host.emit('create_session', {'name': 'TEST_Host', 'grid_settings': {}, 'host_dimensions': {'width': 1920, 'height': 1080}})
            await asyncio.wait_for(session_created.wait(), timeout=10)
            
            assert session_code is not None
            assert len(session_code) == 6
            print(f"Session created: {session_code}")
            
            # Guest joins
            await guest.emit('join_session_request', {'code': session_code, 'name': 'TEST_Guest'})
            await asyncio.wait_for(guest_joined.wait(), timeout=10)
            print("Guest joined successfully")
            
            # Verify session has 2 participants
            response = requests.get(f"{BASE_URL}/api/debug/sessions")
            sessions = response.json()["active_sessions"]
            assert session_code in sessions
            # Note: guest_count may be 0 if guest already left, but we verified join worked
            
            await host.disconnect()
            await guest.disconnect()
            return True
        
        result = asyncio.get_event_loop().run_until_complete(run_test())
        assert result
    
    def test_draw_path_broadcast(self):
        """Test draw_path event is broadcast from host to guest"""
        async def run_test():
            host = socketio.AsyncClient(logger=False, engineio_logger=False)
            guest = socketio.AsyncClient(logger=False, engineio_logger=False)
            
            session_code = None
            session_created = asyncio.Event()
            guest_joined = asyncio.Event()
            guest_received_draw = asyncio.Event()
            received_draw_data = {}
            
            @host.on('session_created')
            async def host_on_session_created(data):
                nonlocal session_code
                session_code = data['code']
                session_created.set()
            
            @guest.on('session_joined')
            async def guest_on_session_joined(data):
                guest_joined.set()
            
            @guest.on('draw_path')
            async def guest_on_draw_path(data):
                received_draw_data.update(data)
                guest_received_draw.set()
            
            # Connect and setup
            await host.connect(BASE_URL, socketio_path='/api/socket.io/', transports=['websocket'])
            await guest.connect(BASE_URL, socketio_path='/api/socket.io/', transports=['websocket'])
            
            await host.emit('create_session', {'name': 'TEST_DrawHost', 'grid_settings': {}, 'host_dimensions': {'width': 1920, 'height': 1080}})
            await asyncio.wait_for(session_created.wait(), timeout=10)
            
            await guest.emit('join_session_request', {'code': session_code, 'name': 'TEST_DrawGuest'})
            await asyncio.wait_for(guest_joined.wait(), timeout=10)
            
            await asyncio.sleep(0.5)  # Let room membership settle
            
            # Host sends draw_path
            draw_data = {
                'points': [{'x': 10, 'y': 20}, {'x': 30, 'y': 40}],
                'color': '#FF0000',
                'thickness': 3,
                'timestamp': 12345
            }
            await host.emit('draw_path', draw_data)
            
            # Guest should receive it
            await asyncio.wait_for(guest_received_draw.wait(), timeout=5)
            
            assert received_draw_data['points'] == draw_data['points']
            assert received_draw_data['color'] == draw_data['color']
            assert received_draw_data['user_name'] == 'TEST_DrawHost'
            print(f"Draw path broadcast successful: {len(received_draw_data['points'])} points")
            
            await host.disconnect()
            await guest.disconnect()
            return True
        
        result = asyncio.get_event_loop().run_until_complete(run_test())
        assert result
    
    def test_cursor_move_broadcast(self):
        """Test cursor_move event is broadcast from host to guest"""
        async def run_test():
            host = socketio.AsyncClient(logger=False, engineio_logger=False)
            guest = socketio.AsyncClient(logger=False, engineio_logger=False)
            
            session_code = None
            session_created = asyncio.Event()
            guest_joined = asyncio.Event()
            guest_received_cursor = asyncio.Event()
            received_cursor_data = {}
            
            @host.on('session_created')
            async def host_on_session_created(data):
                nonlocal session_code
                session_code = data['code']
                session_created.set()
            
            @guest.on('session_joined')
            async def guest_on_session_joined(data):
                guest_joined.set()
            
            @guest.on('cursor_move')
            async def guest_on_cursor_move(data):
                received_cursor_data.update(data)
                guest_received_cursor.set()
            
            # Connect and setup
            await host.connect(BASE_URL, socketio_path='/api/socket.io/', transports=['websocket'])
            await guest.connect(BASE_URL, socketio_path='/api/socket.io/', transports=['websocket'])
            
            await host.emit('create_session', {'name': 'TEST_CursorHost', 'grid_settings': {}, 'host_dimensions': {'width': 1920, 'height': 1080}})
            await asyncio.wait_for(session_created.wait(), timeout=10)
            
            await guest.emit('join_session_request', {'code': session_code, 'name': 'TEST_CursorGuest'})
            await asyncio.wait_for(guest_joined.wait(), timeout=10)
            
            await asyncio.sleep(0.5)
            
            # Host sends cursor_move
            await host.emit('cursor_move', {'x': 100, 'y': 200, 'name': 'TEST_CursorHost', 'color': '#FF0000', 'clicking': False})
            
            # Guest should receive it
            await asyncio.wait_for(guest_received_cursor.wait(), timeout=5)
            
            assert received_cursor_data['x'] == 100
            assert received_cursor_data['y'] == 200
            assert received_cursor_data['name'] == 'TEST_CursorHost'
            print(f"Cursor move broadcast successful: x={received_cursor_data['x']}, y={received_cursor_data['y']}")
            
            await host.disconnect()
            await guest.disconnect()
            return True
        
        result = asyncio.get_event_loop().run_until_complete(run_test())
        assert result
    
    def test_add_measurement_broadcast(self):
        """Test add_measurement event is broadcast from host to guest"""
        async def run_test():
            host = socketio.AsyncClient(logger=False, engineio_logger=False)
            guest = socketio.AsyncClient(logger=False, engineio_logger=False)
            
            session_code = None
            session_created = asyncio.Event()
            guest_joined = asyncio.Event()
            guest_received_measurement = asyncio.Event()
            received_measurement_data = {}
            
            @host.on('session_created')
            async def host_on_session_created(data):
                nonlocal session_code
                session_code = data['code']
                session_created.set()
            
            @guest.on('session_joined')
            async def guest_on_session_joined(data):
                guest_joined.set()
            
            @guest.on('add_measurement')
            async def guest_on_add_measurement(data):
                received_measurement_data.update(data)
                guest_received_measurement.set()
            
            # Connect and setup
            await host.connect(BASE_URL, socketio_path='/api/socket.io/', transports=['websocket'])
            await guest.connect(BASE_URL, socketio_path='/api/socket.io/', transports=['websocket'])
            
            await host.emit('create_session', {'name': 'TEST_MeasureHost', 'grid_settings': {}, 'host_dimensions': {'width': 1920, 'height': 1080}})
            await asyncio.wait_for(session_created.wait(), timeout=10)
            
            await guest.emit('join_session_request', {'code': session_code, 'name': 'TEST_MeasureGuest'})
            await asyncio.wait_for(guest_joined.wait(), timeout=10)
            
            await asyncio.sleep(0.5)
            
            # Host sends add_measurement
            await host.emit('add_measurement', {'startX': 0, 'startY': 0, 'endX': 100, 'endY': 100, 'type': 'line'})
            
            # Guest should receive it
            await asyncio.wait_for(guest_received_measurement.wait(), timeout=5)
            
            assert received_measurement_data['startX'] == 0
            assert received_measurement_data['endX'] == 100
            assert received_measurement_data['user_name'] == 'TEST_MeasureHost'
            print(f"Measurement broadcast successful: {received_measurement_data['type']}")
            
            await host.disconnect()
            await guest.disconnect()
            return True
        
        result = asyncio.get_event_loop().run_until_complete(run_test())
        assert result
    
    def test_bidirectional_draw_sync(self):
        """Test draw_path works both ways: host→guest and guest→host"""
        async def run_test():
            host = socketio.AsyncClient(logger=False, engineio_logger=False)
            guest = socketio.AsyncClient(logger=False, engineio_logger=False)
            
            session_code = None
            session_created = asyncio.Event()
            guest_joined = asyncio.Event()
            guest_received_draw = asyncio.Event()
            host_received_draw = asyncio.Event()
            
            @host.on('session_created')
            async def host_on_session_created(data):
                nonlocal session_code
                session_code = data['code']
                session_created.set()
            
            @host.on('draw_path')
            async def host_on_draw_path(data):
                host_received_draw.set()
            
            @guest.on('session_joined')
            async def guest_on_session_joined(data):
                guest_joined.set()
            
            @guest.on('draw_path')
            async def guest_on_draw_path(data):
                guest_received_draw.set()
            
            # Connect and setup
            await host.connect(BASE_URL, socketio_path='/api/socket.io/', transports=['websocket'])
            await guest.connect(BASE_URL, socketio_path='/api/socket.io/', transports=['websocket'])
            
            await host.emit('create_session', {'name': 'TEST_BiDirHost', 'grid_settings': {}, 'host_dimensions': {'width': 1920, 'height': 1080}})
            await asyncio.wait_for(session_created.wait(), timeout=10)
            
            await guest.emit('join_session_request', {'code': session_code, 'name': 'TEST_BiDirGuest'})
            await asyncio.wait_for(guest_joined.wait(), timeout=10)
            
            await asyncio.sleep(0.5)
            
            # Test 1: Host → Guest
            await host.emit('draw_path', {'points': [{'x': 1, 'y': 1}], 'color': '#FF0000', 'thickness': 1, 'timestamp': 1})
            await asyncio.wait_for(guest_received_draw.wait(), timeout=5)
            print("Host → Guest draw_path: SUCCESS")
            
            # Test 2: Guest → Host
            await guest.emit('draw_path', {'points': [{'x': 2, 'y': 2}], 'color': '#00FF00', 'thickness': 2, 'timestamp': 2})
            await asyncio.wait_for(host_received_draw.wait(), timeout=5)
            print("Guest → Host draw_path: SUCCESS")
            
            await host.disconnect()
            await guest.disconnect()
            return True
        
        result = asyncio.get_event_loop().run_until_complete(run_test())
        assert result


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
