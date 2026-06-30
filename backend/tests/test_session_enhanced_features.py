"""
Test the enhanced session features:
- ping_location event broadcasts to ALL participants (including sender)
- undo_drawing / redo_drawing events for synced undo
- update_activity_status broadcasts to all except sender
- cursor_move always broadcasts (not just when clicking)
"""

import pytest
import socketio
import asyncio
import os
import time
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SOCKET_URL = BASE_URL.replace('/api', '') if BASE_URL.endswith('/api') else BASE_URL


class TestSessionEnhancedFeatures:
    """Tests for the new session features: ping, undo/redo, activity status, cursor trails"""

    @pytest.fixture
    def test_user(self):
        """Create or login a test user"""
        email = "nick@example.com"
        password = "test123"
        
        # Try login first
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        
        if resp.status_code == 200:
            data = resp.json()
            return {"email": email, "name": data.get("name", "Nick"), "session_token": data.get("session_token")}
        
        # User might not exist, register
        resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "name": "Nick",
            "password": password,
            "nickname": "DungeonMaster42"
        })
        
        if resp.status_code in [200, 201]:
            data = resp.json()
            return {"email": email, "name": "Nick", "session_token": data.get("session_token")}
        
        pytest.skip(f"Could not create test user: {resp.text}")

    @pytest.mark.asyncio
    async def test_ping_location_broadcasts_to_all_including_sender(self):
        """Test ping_location event broadcasts to ALL participants including sender"""
        print("Testing ping_location broadcasts to all (including sender)...")
        
        host_client = socketio.AsyncClient(logger=False)
        guest_client = socketio.AsyncClient(logger=False)
        
        host_ping_received = []
        guest_ping_received = []
        session_code = None
        
        @host_client.on('session_created')
        async def on_session_created(data):
            nonlocal session_code
            session_code = data['code']
            print(f"  Session created: {session_code}")
        
        @host_client.on('ping_location')
        async def on_host_ping(data):
            host_ping_received.append(data)
            print(f"  Host received ping: x={data['x']}, y={data['y']}, from={data.get('user_name')}")
        
        @guest_client.on('ping_location')
        async def on_guest_ping(data):
            guest_ping_received.append(data)
            print(f"  Guest received ping: x={data['x']}, y={data['y']}, from={data.get('user_name')}")
        
        try:
            # Connect host
            await host_client.connect(SOCKET_URL, socketio_path='/api/socket.io/')
            await host_client.emit('create_session', {'name': 'PingTestHost'})
            await asyncio.sleep(0.5)
            
            assert session_code, "Session should be created"
            
            # Connect guest
            await guest_client.connect(SOCKET_URL, socketio_path='/api/socket.io/')
            await guest_client.emit('join_session_request', {'code': session_code, 'name': 'PingTestGuest'})
            await asyncio.sleep(0.5)
            
            # Host sends ping
            await host_client.emit('ping_location', {'x': 100, 'y': 200, 'color': '#FFD700'})
            await asyncio.sleep(0.5)
            
            # Both should receive the ping (including sender)
            assert len(host_ping_received) == 1, f"Host should receive their own ping, got {len(host_ping_received)}"
            assert len(guest_ping_received) == 1, f"Guest should receive host's ping, got {len(guest_ping_received)}"
            
            # Verify ping data
            assert host_ping_received[0]['x'] == 100
            assert host_ping_received[0]['y'] == 200
            
            print("  PASS: ping_location broadcasts to ALL including sender")
            
        finally:
            await host_client.disconnect()
            await guest_client.disconnect()

    @pytest.mark.asyncio
    async def test_undo_drawing_broadcasts_drawing_undone(self):
        """Test undo_drawing event works and broadcasts drawing_undone to all"""
        print("Testing undo_drawing broadcasts drawing_undone...")
        
        host_client = socketio.AsyncClient(logger=False)
        guest_client = socketio.AsyncClient(logger=False)
        
        session_code = None
        host_undone_events = []
        guest_undone_events = []
        
        @host_client.on('session_created')
        async def on_session_created(data):
            nonlocal session_code
            session_code = data['code']
        
        @host_client.on('drawing_undone')
        async def on_host_undone(data):
            host_undone_events.append(data)
            print(f"  Host received drawing_undone: user_sid={data.get('user_sid')}")
        
        @guest_client.on('drawing_undone')
        async def on_guest_undone(data):
            guest_undone_events.append(data)
            print(f"  Guest received drawing_undone: user_sid={data.get('user_sid')}")
        
        try:
            # Connect host
            await host_client.connect(SOCKET_URL, socketio_path='/api/socket.io/')
            await host_client.emit('create_session', {'name': 'UndoTestHost'})
            await asyncio.sleep(0.5)
            
            # Connect guest
            await guest_client.connect(SOCKET_URL, socketio_path='/api/socket.io/')
            await guest_client.emit('join_session_request', {'code': session_code, 'name': 'UndoTestGuest'})
            await asyncio.sleep(0.5)
            
            # Host draws something
            await host_client.emit('draw_path', {
                'points': [{'x': 10, 'y': 10}, {'x': 50, 'y': 50}],
                'color': '#FF0000',
                'thickness': 3
            })
            await asyncio.sleep(0.3)
            
            # Host undoes the drawing
            await host_client.emit('undo_drawing', {})
            await asyncio.sleep(0.5)
            
            # Both should receive drawing_undone
            assert len(host_undone_events) >= 1, f"Host should receive drawing_undone, got {len(host_undone_events)}"
            assert len(guest_undone_events) >= 1, f"Guest should receive drawing_undone, got {len(guest_undone_events)}"
            
            print("  PASS: undo_drawing broadcasts drawing_undone to all")
            
        finally:
            await host_client.disconnect()
            await guest_client.disconnect()

    @pytest.mark.asyncio
    async def test_redo_drawing_broadcasts_drawing_redone(self):
        """Test redo_drawing event works and broadcasts drawing_redone to all"""
        print("Testing redo_drawing broadcasts drawing_redone...")
        
        host_client = socketio.AsyncClient(logger=False)
        guest_client = socketio.AsyncClient(logger=False)
        
        session_code = None
        guest_redone_events = []
        
        @host_client.on('session_created')
        async def on_session_created(data):
            nonlocal session_code
            session_code = data['code']
        
        @guest_client.on('drawing_redone')
        async def on_guest_redone(data):
            guest_redone_events.append(data)
            print(f"  Guest received drawing_redone: user_sid={data.get('user_sid')}")
        
        try:
            # Connect host
            await host_client.connect(SOCKET_URL, socketio_path='/api/socket.io/')
            await host_client.emit('create_session', {'name': 'RedoTestHost'})
            await asyncio.sleep(0.5)
            
            # Connect guest
            await guest_client.connect(SOCKET_URL, socketio_path='/api/socket.io/')
            await guest_client.emit('join_session_request', {'code': session_code, 'name': 'RedoTestGuest'})
            await asyncio.sleep(0.5)
            
            # Host draws something
            await host_client.emit('draw_path', {
                'points': [{'x': 10, 'y': 10}, {'x': 50, 'y': 50}],
                'color': '#FF0000',
                'thickness': 3
            })
            await asyncio.sleep(0.3)
            
            # Host undoes
            await host_client.emit('undo_drawing', {})
            await asyncio.sleep(0.3)
            
            # Host redoes
            await host_client.emit('redo_drawing', {})
            await asyncio.sleep(0.5)
            
            # Guest should receive drawing_redone
            assert len(guest_redone_events) >= 1, f"Guest should receive drawing_redone, got {len(guest_redone_events)}"
            
            print("  PASS: redo_drawing broadcasts drawing_redone to all")
            
        finally:
            await host_client.disconnect()
            await guest_client.disconnect()

    @pytest.mark.asyncio
    async def test_update_activity_status_broadcasts_to_others(self):
        """Test update_activity_status broadcasts activity_status_updated to all except sender"""
        print("Testing update_activity_status broadcasts to others...")
        
        host_client = socketio.AsyncClient(logger=False)
        guest_client = socketio.AsyncClient(logger=False)
        
        session_code = None
        host_status_updates = []
        guest_status_updates = []
        
        @host_client.on('session_created')
        async def on_session_created(data):
            nonlocal session_code
            session_code = data['code']
        
        @host_client.on('activity_status_updated')
        async def on_host_status(data):
            host_status_updates.append(data)
            print(f"  Host received status update: {data.get('name')} is {data.get('status')}")
        
        @guest_client.on('activity_status_updated')
        async def on_guest_status(data):
            guest_status_updates.append(data)
            print(f"  Guest received status update: {data.get('name')} is {data.get('status')}")
        
        try:
            # Connect host
            await host_client.connect(SOCKET_URL, socketio_path='/api/socket.io/')
            await host_client.emit('create_session', {'name': 'StatusTestHost'})
            await asyncio.sleep(0.5)
            
            # Connect guest
            await guest_client.connect(SOCKET_URL, socketio_path='/api/socket.io/')
            await guest_client.emit('join_session_request', {'code': session_code, 'name': 'StatusTestGuest'})
            await asyncio.sleep(0.5)
            
            # Guest updates their activity status to "drawing"
            await guest_client.emit('update_activity_status', {'status': 'drawing'})
            await asyncio.sleep(0.5)
            
            # Host should receive the status update, guest should NOT (skip_sid)
            assert len(host_status_updates) >= 1, f"Host should receive guest's status update, got {len(host_status_updates)}"
            assert len(guest_status_updates) == 0, f"Guest should NOT receive their own status update, got {len(guest_status_updates)}"
            
            # Verify the status data
            assert host_status_updates[0]['status'] == 'drawing'
            assert host_status_updates[0]['name'] == 'StatusTestGuest'
            
            print("  PASS: update_activity_status broadcasts to all except sender")
            
        finally:
            await host_client.disconnect()
            await guest_client.disconnect()

    @pytest.mark.asyncio
    async def test_cursor_move_always_broadcasts(self):
        """Test cursor_move always broadcasts (not just when clicking)"""
        print("Testing cursor_move always broadcasts...")
        
        host_client = socketio.AsyncClient(logger=False)
        guest_client = socketio.AsyncClient(logger=False)
        
        session_code = None
        host_cursor_moves = []
        
        @host_client.on('session_created')
        async def on_session_created(data):
            nonlocal session_code
            session_code = data['code']
        
        @host_client.on('cursor_move')
        async def on_host_cursor(data):
            host_cursor_moves.append(data)
            print(f"  Host received cursor: x={data['x']}, y={data['y']}, clicking={data.get('clicking')}")
        
        try:
            # Connect host
            await host_client.connect(SOCKET_URL, socketio_path='/api/socket.io/')
            await host_client.emit('create_session', {'name': 'CursorTestHost'})
            await asyncio.sleep(0.5)
            
            # Connect guest
            await guest_client.connect(SOCKET_URL, socketio_path='/api/socket.io/')
            await guest_client.emit('join_session_request', {'code': session_code, 'name': 'CursorTestGuest'})
            await asyncio.sleep(0.5)
            
            # Guest moves cursor WITHOUT clicking
            await guest_client.emit('cursor_move', {
                'x': 100, 'y': 200, 'name': 'CursorTestGuest', 'color': '#FF0000', 'clicking': False
            })
            await asyncio.sleep(0.3)
            
            # Guest moves cursor again
            await guest_client.emit('cursor_move', {
                'x': 150, 'y': 250, 'name': 'CursorTestGuest', 'color': '#FF0000', 'clicking': False
            })
            await asyncio.sleep(0.3)
            
            # Host should receive cursor moves even when not clicking
            assert len(host_cursor_moves) >= 2, f"Host should receive cursor moves, got {len(host_cursor_moves)}"
            
            # Verify non-clicking moves are received
            non_clicking_moves = [m for m in host_cursor_moves if not m.get('clicking', False)]
            assert len(non_clicking_moves) >= 2, "Should receive non-clicking cursor moves"
            
            print("  PASS: cursor_move always broadcasts (even without clicking)")
            
        finally:
            await host_client.disconnect()
            await guest_client.disconnect()


class TestBasicSessionFunctionality:
    """Quick tests to verify basic session functionality still works"""

    @pytest.mark.asyncio
    async def test_create_and_join_session(self):
        """Test basic session creation and joining"""
        print("Testing basic session create/join...")
        
        host_client = socketio.AsyncClient(logger=False)
        guest_client = socketio.AsyncClient(logger=False)
        
        session_code = None
        host_joined = None
        guest_joined = None
        
        @host_client.on('session_created')
        async def on_session_created(data):
            nonlocal session_code
            session_code = data['code']
            print(f"  Session created: {session_code}")
        
        @host_client.on('participant_joined')
        async def on_participant_joined(data):
            nonlocal host_joined
            host_joined = data
            print(f"  Host notified of guest joining: {data.get('name')}")
        
        @guest_client.on('session_joined')
        async def on_session_joined(data):
            nonlocal guest_joined
            guest_joined = data
            print(f"  Guest joined session: {data.get('code')}")
        
        try:
            await host_client.connect(SOCKET_URL, socketio_path='/api/socket.io/')
            await host_client.emit('create_session', {'name': 'TestHost'})
            await asyncio.sleep(0.5)
            
            assert session_code, "Session should be created"
            
            await guest_client.connect(SOCKET_URL, socketio_path='/api/socket.io/')
            await guest_client.emit('join_session_request', {'code': session_code, 'name': 'TestGuest'})
            await asyncio.sleep(0.5)
            
            assert guest_joined, "Guest should successfully join"
            assert host_joined, "Host should be notified of guest"
            
            print("  PASS: Basic session create/join works")
            
        finally:
            await host_client.disconnect()
            await guest_client.disconnect()

    @pytest.mark.asyncio
    async def test_draw_path_sync(self):
        """Test drawing paths sync between participants"""
        print("Testing draw_path sync...")
        
        host_client = socketio.AsyncClient(logger=False)
        guest_client = socketio.AsyncClient(logger=False)
        
        session_code = None
        guest_drawings = []
        
        @host_client.on('session_created')
        async def on_session_created(data):
            nonlocal session_code
            session_code = data['code']
        
        @guest_client.on('draw_path')
        async def on_draw_path(data):
            guest_drawings.append(data)
            print(f"  Guest received drawing from: {data.get('user_name')}")
        
        try:
            await host_client.connect(SOCKET_URL, socketio_path='/api/socket.io/')
            await host_client.emit('create_session', {'name': 'DrawHost'})
            await asyncio.sleep(0.5)
            
            await guest_client.connect(SOCKET_URL, socketio_path='/api/socket.io/')
            await guest_client.emit('join_session_request', {'code': session_code, 'name': 'DrawGuest'})
            await asyncio.sleep(0.5)
            
            # Host draws
            await host_client.emit('draw_path', {
                'points': [{'x': 10, 'y': 10}, {'x': 50, 'y': 50}],
                'color': '#FF0000',
                'thickness': 3
            })
            await asyncio.sleep(0.5)
            
            assert len(guest_drawings) >= 1, "Guest should receive host's drawing"
            
            print("  PASS: draw_path sync works")
            
        finally:
            await host_client.disconnect()
            await guest_client.disconnect()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
