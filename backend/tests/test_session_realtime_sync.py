"""
Backend WebSocket Session Tests for OverGrid
Tests real-time session synchronization:
- Session creation and joining via WebSocket
- live_measurement event broadcasting (skip_sid)
- add_measurement event broadcasting (skip_sid)
- add_clipart event broadcasting (skip_sid)
- update_clipart event broadcasting (skip_sid)
- remove_clipart event broadcasting (skip_sid)
- live_clipart_move event broadcasting (skip_sid)
- clear_live_measurement event broadcasting
- draw_path event broadcasting (skip_sid)
- set_background_image event broadcasting
- clear_background_image event broadcasting
"""

import pytest
import asyncio
import socketio
import os

# Backend URL - connect directly to internal port for WebSocket
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://session-sync-debug.preview.emergentagent.com').rstrip('/')
SOCKET_URL = 'http://localhost:8001'  # Internal socket URL
SOCKET_PATH = '/api/socket.io'


class TestSessionCreationAndJoin:
    """Test session creation and joining via WebSocket"""
    
    @pytest.mark.asyncio
    async def test_create_session(self):
        """Test that a host can create a session"""
        sio = socketio.AsyncClient()
        session_data = {}
        
        @sio.on('session_created')
        async def on_session_created(data):
            session_data['code'] = data['code']
            session_data['host_name'] = data['host_name']
            session_data['participants'] = data['participants']
        
        await sio.connect(SOCKET_URL, socketio_path=SOCKET_PATH)
        await sio.emit('create_session', {'name': 'TEST_Host_Create'})
        await asyncio.sleep(0.5)
        
        assert 'code' in session_data, "Session should have a code"
        assert len(session_data['code']) == 6, "Session code should be 6 characters"
        assert session_data['host_name'] == 'TEST_Host_Create'
        print(f"✓ Session created: {session_data['code']} by {session_data['host_name']}")
        
        await sio.disconnect()
    
    @pytest.mark.asyncio
    async def test_join_session_request(self):
        """Test that a guest can join a session via join_session_request event"""
        host = socketio.AsyncClient()
        guest = socketio.AsyncClient()
        session_code = None
        guest_joined = asyncio.Event()
        
        @host.on('session_created')
        async def on_host_created(data):
            nonlocal session_code
            session_code = data['code']
        
        @host.on('participant_joined')
        async def on_participant_joined(data):
            guest_joined.set()
        
        guest_data = {}
        @guest.on('session_joined')
        async def on_guest_joined(data):
            guest_data.update(data)
        
        # Host creates session
        await host.connect(SOCKET_URL, socketio_path=SOCKET_PATH)
        await host.emit('create_session', {'name': 'TEST_Host_Join'})
        await asyncio.sleep(0.3)
        
        assert session_code is not None, "Host should have created a session"
        
        # Guest joins using join_session_request (NOT join_session)
        await guest.connect(SOCKET_URL, socketio_path=SOCKET_PATH)
        await guest.emit('join_session_request', {'code': session_code, 'name': 'TEST_Guest'})
        await asyncio.sleep(0.3)
        
        assert guest_data.get('code') == session_code
        assert 'drawings' in guest_data  # Session state sent to guest
        assert 'measurements' in guest_data
        assert 'cliparts' in guest_data
        print(f"✓ Guest joined session {session_code} successfully")
        
        await host.disconnect()
        await guest.disconnect()


class TestMeasurementEvents:
    """Test measurement event broadcasting"""
    
    @pytest.mark.asyncio
    async def test_live_measurement_broadcasts_to_guests_not_sender(self):
        """Test live_measurement event broadcasts to guests but not sender"""
        host = socketio.AsyncClient()
        guest = socketio.AsyncClient()
        
        session_code = None
        host_received = []
        guest_received = []
        
        @host.on('session_created')
        async def on_created(data):
            nonlocal session_code
            session_code = data['code']
        
        @host.on('live_measurement')
        async def on_host_live(data):
            host_received.append(data)
        
        @guest.on('live_measurement')
        async def on_guest_live(data):
            guest_received.append(data)
        
        @guest.on('session_joined')
        async def on_joined(data):
            pass
        
        await host.connect(SOCKET_URL, socketio_path=SOCKET_PATH)
        await host.emit('create_session', {'name': 'TEST_Host_Measure'})
        await asyncio.sleep(0.3)
        
        await guest.connect(SOCKET_URL, socketio_path=SOCKET_PATH)
        await guest.emit('join_session_request', {'code': session_code, 'name': 'TEST_Guest_Measure'})
        await asyncio.sleep(0.3)
        
        # Host sends live_measurement
        await host.emit('live_measurement', {
            'startX': 100, 'startY': 100,
            'endX': 200, 'endY': 200,
            'type': 'line'
        })
        await asyncio.sleep(0.3)
        
        assert len(host_received) == 0, "Host should NOT receive their own live_measurement (skip_sid)"
        assert len(guest_received) == 1, "Guest should receive the live_measurement"
        assert guest_received[0]['type'] == 'line'
        print(f"✓ live_measurement broadcasts to guest but not sender")
        
        await host.disconnect()
        await guest.disconnect()
    
    @pytest.mark.asyncio
    async def test_add_measurement_broadcasts_to_guests_not_sender(self):
        """Test add_measurement event broadcasts to guests but not sender"""
        host = socketio.AsyncClient()
        guest = socketio.AsyncClient()
        
        session_code = None
        host_received = []
        guest_received = []
        
        @host.on('session_created')
        async def on_created(data):
            nonlocal session_code
            session_code = data['code']
        
        @host.on('add_measurement')
        async def on_host_measure(data):
            host_received.append(data)
        
        @guest.on('add_measurement')
        async def on_guest_measure(data):
            guest_received.append(data)
        
        @guest.on('session_joined')
        async def on_joined(data):
            pass
        
        await host.connect(SOCKET_URL, socketio_path=SOCKET_PATH)
        await host.emit('create_session', {'name': 'TEST_Host_AddMeasure'})
        await asyncio.sleep(0.3)
        
        await guest.connect(SOCKET_URL, socketio_path=SOCKET_PATH)
        await guest.emit('join_session_request', {'code': session_code, 'name': 'TEST_Guest_AddMeasure'})
        await asyncio.sleep(0.3)
        
        # Host sends add_measurement
        await host.emit('add_measurement', {
            'startX': 100, 'startY': 100,
            'endX': 300, 'endY': 300,
            'type': 'line',
            'pixelDistance': 282.84,
            'unitDistance': 10.0
        })
        await asyncio.sleep(0.3)
        
        assert len(host_received) == 0, "Host should NOT receive their own add_measurement (skip_sid)"
        assert len(guest_received) == 1, "Guest should receive the add_measurement"
        print(f"✓ add_measurement broadcasts to guest but not sender")
        
        await host.disconnect()
        await guest.disconnect()
    
    @pytest.mark.asyncio
    async def test_clear_live_measurement_broadcasts(self):
        """Test clear_live_measurement event broadcasts correctly"""
        host = socketio.AsyncClient()
        guest = socketio.AsyncClient()
        
        session_code = None
        guest_received = []
        
        @host.on('session_created')
        async def on_created(data):
            nonlocal session_code
            session_code = data['code']
        
        @guest.on('clear_live_measurement')
        async def on_guest_clear(data):
            guest_received.append(data)
        
        @guest.on('session_joined')
        async def on_joined(data):
            pass
        
        await host.connect(SOCKET_URL, socketio_path=SOCKET_PATH)
        await host.emit('create_session', {'name': 'TEST_Host_ClearMeasure'})
        await asyncio.sleep(0.3)
        
        await guest.connect(SOCKET_URL, socketio_path=SOCKET_PATH)
        await guest.emit('join_session_request', {'code': session_code, 'name': 'TEST_Guest_ClearMeasure'})
        await asyncio.sleep(0.3)
        
        # Host clears live measurement
        await host.emit('clear_live_measurement', {})
        await asyncio.sleep(0.3)
        
        assert len(guest_received) == 1, "Guest should receive clear_live_measurement"
        assert 'user_sid' in guest_received[0]
        print(f"✓ clear_live_measurement broadcasts correctly")
        
        await host.disconnect()
        await guest.disconnect()


class TestClipartEvents:
    """Test clipart event broadcasting"""
    
    @pytest.mark.asyncio
    async def test_add_clipart_broadcasts_to_guests_not_sender(self):
        """Test add_clipart event broadcasts to guests but not sender (skip_sid)"""
        host = socketio.AsyncClient()
        guest = socketio.AsyncClient()
        
        session_code = None
        host_received = []
        guest_received = []
        
        @host.on('session_created')
        async def on_created(data):
            nonlocal session_code
            session_code = data['code']
        
        @host.on('clipart_added')
        async def on_host_clipart(data):
            host_received.append(data)
        
        @guest.on('clipart_added')
        async def on_guest_clipart(data):
            guest_received.append(data)
        
        @guest.on('session_joined')
        async def on_joined(data):
            pass
        
        await host.connect(SOCKET_URL, socketio_path=SOCKET_PATH)
        await host.emit('create_session', {'name': 'TEST_Host_Clipart'})
        await asyncio.sleep(0.3)
        
        await guest.connect(SOCKET_URL, socketio_path=SOCKET_PATH)
        await guest.emit('join_session_request', {'code': session_code, 'name': 'TEST_Guest_Clipart'})
        await asyncio.sleep(0.3)
        
        # Host adds clipart
        await host.emit('add_clipart', {
            'instanceId': 'test_clip_001',
            'id': 'token_fighter',
            'name': 'Fighter',
            'x': 200, 'y': 200,
            'scale': 50, 'rotation': 0
        })
        await asyncio.sleep(0.3)
        
        assert len(host_received) == 0, "Host should NOT receive their own clipart_added (skip_sid)"
        assert len(guest_received) == 1, "Guest should receive clipart_added"
        assert guest_received[0]['instanceId'] == 'test_clip_001'
        print(f"✓ add_clipart broadcasts to guest but not sender (skip_sid)")
        
        await host.disconnect()
        await guest.disconnect()
    
    @pytest.mark.asyncio
    async def test_update_clipart_broadcasts_to_guests_not_sender(self):
        """Test update_clipart event broadcasts to guests but not sender (skip_sid)"""
        host = socketio.AsyncClient()
        guest = socketio.AsyncClient()
        
        session_code = None
        host_received = []
        guest_received = []
        
        @host.on('session_created')
        async def on_created(data):
            nonlocal session_code
            session_code = data['code']
        
        @host.on('clipart_updated')
        async def on_host_update(data):
            host_received.append(data)
        
        @guest.on('clipart_updated')
        async def on_guest_update(data):
            guest_received.append(data)
        
        @guest.on('session_joined')
        async def on_joined(data):
            pass
        
        await host.connect(SOCKET_URL, socketio_path=SOCKET_PATH)
        await host.emit('create_session', {'name': 'TEST_Host_UpdateClip'})
        await asyncio.sleep(0.3)
        
        await guest.connect(SOCKET_URL, socketio_path=SOCKET_PATH)
        await guest.emit('join_session_request', {'code': session_code, 'name': 'TEST_Guest_UpdateClip'})
        await asyncio.sleep(0.3)
        
        # First add a clipart
        await host.emit('add_clipart', {
            'instanceId': 'test_clip_update',
            'id': 'token_wizard',
            'name': 'Wizard',
            'x': 100, 'y': 100,
            'scale': 50, 'rotation': 0
        })
        await asyncio.sleep(0.2)
        
        # Then update it
        await host.emit('update_clipart', {
            'instanceId': 'test_clip_update',
            'x': 300, 'y': 300,
            'scale': 75, 'rotation': 45
        })
        await asyncio.sleep(0.3)
        
        assert len(host_received) == 0, "Host should NOT receive their own clipart_updated (skip_sid)"
        assert len(guest_received) == 1, "Guest should receive clipart_updated"
        assert guest_received[0]['x'] == 300
        print(f"✓ update_clipart broadcasts to guest but not sender (skip_sid)")
        
        await host.disconnect()
        await guest.disconnect()
    
    @pytest.mark.asyncio
    async def test_remove_clipart_broadcasts_to_guests_not_sender(self):
        """Test remove_clipart event broadcasts to guests but not sender (skip_sid)"""
        host = socketio.AsyncClient()
        guest = socketio.AsyncClient()
        
        session_code = None
        host_received = []
        guest_received = []
        
        @host.on('session_created')
        async def on_created(data):
            nonlocal session_code
            session_code = data['code']
        
        @host.on('clipart_removed')
        async def on_host_remove(data):
            host_received.append(data)
        
        @guest.on('clipart_removed')
        async def on_guest_remove(data):
            guest_received.append(data)
        
        @guest.on('session_joined')
        async def on_joined(data):
            pass
        
        await host.connect(SOCKET_URL, socketio_path=SOCKET_PATH)
        await host.emit('create_session', {'name': 'TEST_Host_RemoveClip'})
        await asyncio.sleep(0.3)
        
        await guest.connect(SOCKET_URL, socketio_path=SOCKET_PATH)
        await guest.emit('join_session_request', {'code': session_code, 'name': 'TEST_Guest_RemoveClip'})
        await asyncio.sleep(0.3)
        
        # First add a clipart
        await host.emit('add_clipart', {
            'instanceId': 'test_clip_remove',
            'id': 'token_rogue',
            'name': 'Rogue',
            'x': 150, 'y': 150,
            'scale': 50, 'rotation': 0
        })
        await asyncio.sleep(0.2)
        
        # Then remove it
        await host.emit('remove_clipart', {'instanceId': 'test_clip_remove'})
        await asyncio.sleep(0.3)
        
        assert len(host_received) == 0, "Host should NOT receive their own clipart_removed (skip_sid)"
        assert len(guest_received) == 1, "Guest should receive clipart_removed"
        assert guest_received[0]['instanceId'] == 'test_clip_remove'
        print(f"✓ remove_clipart broadcasts to guest but not sender (skip_sid)")
        
        await host.disconnect()
        await guest.disconnect()
    
    @pytest.mark.asyncio
    async def test_live_clipart_move_broadcasts_to_guests_not_sender(self):
        """Test live_clipart_move event broadcasts to guests but not sender"""
        host = socketio.AsyncClient()
        guest = socketio.AsyncClient()
        
        session_code = None
        host_received = []
        guest_received = []
        
        @host.on('session_created')
        async def on_created(data):
            nonlocal session_code
            session_code = data['code']
        
        @host.on('live_clipart_move')
        async def on_host_move(data):
            host_received.append(data)
        
        @guest.on('live_clipart_move')
        async def on_guest_move(data):
            guest_received.append(data)
        
        @guest.on('session_joined')
        async def on_joined(data):
            pass
        
        await host.connect(SOCKET_URL, socketio_path=SOCKET_PATH)
        await host.emit('create_session', {'name': 'TEST_Host_LiveMove'})
        await asyncio.sleep(0.3)
        
        await guest.connect(SOCKET_URL, socketio_path=SOCKET_PATH)
        await guest.emit('join_session_request', {'code': session_code, 'name': 'TEST_Guest_LiveMove'})
        await asyncio.sleep(0.3)
        
        # Host sends live_clipart_move (during drag)
        await host.emit('live_clipart_move', {
            'instanceId': 'test_live_move',
            'x': 250, 'y': 250,
            'scale': 50, 'rotation': 0
        })
        await asyncio.sleep(0.3)
        
        assert len(host_received) == 0, "Host should NOT receive their own live_clipart_move"
        assert len(guest_received) == 1, "Guest should receive live_clipart_move"
        assert guest_received[0]['x'] == 250
        print(f"✓ live_clipart_move broadcasts to guest but not sender")
        
        await host.disconnect()
        await guest.disconnect()


class TestDrawingEvents:
    """Test drawing event broadcasting"""
    
    @pytest.mark.asyncio
    async def test_draw_path_broadcasts_to_guests_not_sender(self):
        """Test draw_path event broadcasts to guests but not sender"""
        host = socketio.AsyncClient()
        guest = socketio.AsyncClient()
        
        session_code = None
        host_received = []
        guest_received = []
        
        @host.on('session_created')
        async def on_created(data):
            nonlocal session_code
            session_code = data['code']
        
        @host.on('draw_path')
        async def on_host_draw(data):
            host_received.append(data)
        
        @guest.on('draw_path')
        async def on_guest_draw(data):
            guest_received.append(data)
        
        @guest.on('session_joined')
        async def on_joined(data):
            pass
        
        await host.connect(SOCKET_URL, socketio_path=SOCKET_PATH)
        await host.emit('create_session', {'name': 'TEST_Host_Draw'})
        await asyncio.sleep(0.3)
        
        await guest.connect(SOCKET_URL, socketio_path=SOCKET_PATH)
        await guest.emit('join_session_request', {'code': session_code, 'name': 'TEST_Guest_Draw'})
        await asyncio.sleep(0.3)
        
        # Host sends draw_path
        await host.emit('draw_path', {
            'points': [{'x': 100, 'y': 100}, {'x': 200, 'y': 200}],
            'color': '#FF4444',
            'thickness': 3
        })
        await asyncio.sleep(0.3)
        
        assert len(host_received) == 0, "Host should NOT receive their own draw_path"
        assert len(guest_received) == 1, "Guest should receive draw_path"
        assert guest_received[0]['color'] == '#FF4444'
        print(f"✓ draw_path broadcasts to guest but not sender")
        
        await host.disconnect()
        await guest.disconnect()


class TestBackgroundImageEvents:
    """Test background image event broadcasting"""
    
    @pytest.mark.asyncio
    async def test_set_background_image_broadcasts_to_all(self):
        """Test set_background_image event broadcasts to all in room"""
        host = socketio.AsyncClient()
        guest = socketio.AsyncClient()
        
        session_code = None
        host_received = []
        guest_received = []
        
        @host.on('session_created')
        async def on_created(data):
            nonlocal session_code
            session_code = data['code']
        
        @host.on('background_image_updated')
        async def on_host_bg(data):
            host_received.append(data)
        
        @guest.on('background_image_updated')
        async def on_guest_bg(data):
            guest_received.append(data)
        
        @guest.on('session_joined')
        async def on_joined(data):
            pass
        
        await host.connect(SOCKET_URL, socketio_path=SOCKET_PATH)
        await host.emit('create_session', {'name': 'TEST_Host_BG'})
        await asyncio.sleep(0.3)
        
        await guest.connect(SOCKET_URL, socketio_path=SOCKET_PATH)
        await guest.emit('join_session_request', {'code': session_code, 'name': 'TEST_Guest_BG'})
        await asyncio.sleep(0.3)
        
        # Host sets background image (broadcasts to all including sender)
        await host.emit('set_background_image', {
            'data': 'data:image/png;base64,test_image_data',
            'scale': 100,
            'x': 0, 'y': 0,
            'rotation': 0,
            'tile': False
        })
        await asyncio.sleep(0.3)
        
        # Note: set_background_image broadcasts to ALL in room (including sender)
        assert len(host_received) == 1, "Host should receive background_image_updated (broadcast to all)"
        assert len(guest_received) == 1, "Guest should receive background_image_updated"
        print(f"✓ set_background_image broadcasts to all in room")
        
        await host.disconnect()
        await guest.disconnect()
    
    @pytest.mark.asyncio
    async def test_clear_background_image_broadcasts_to_all(self):
        """Test clear_background_image event broadcasts to all in room"""
        host = socketio.AsyncClient()
        guest = socketio.AsyncClient()
        
        session_code = None
        host_received = []
        guest_received = []
        
        @host.on('session_created')
        async def on_created(data):
            nonlocal session_code
            session_code = data['code']
        
        @host.on('background_image_cleared')
        async def on_host_clear(data):
            host_received.append(data)
        
        @guest.on('background_image_cleared')
        async def on_guest_clear(data):
            guest_received.append(data)
        
        @guest.on('session_joined')
        async def on_joined(data):
            pass
        
        await host.connect(SOCKET_URL, socketio_path=SOCKET_PATH)
        await host.emit('create_session', {'name': 'TEST_Host_ClearBG'})
        await asyncio.sleep(0.3)
        
        await guest.connect(SOCKET_URL, socketio_path=SOCKET_PATH)
        await guest.emit('join_session_request', {'code': session_code, 'name': 'TEST_Guest_ClearBG'})
        await asyncio.sleep(0.3)
        
        # Host clears background image
        await host.emit('clear_background_image', {})
        await asyncio.sleep(0.3)
        
        # Note: clear_background_image broadcasts to ALL in room
        assert len(host_received) == 1, "Host should receive background_image_cleared"
        assert len(guest_received) == 1, "Guest should receive background_image_cleared"
        print(f"✓ clear_background_image broadcasts to all in room")
        
        await host.disconnect()
        await guest.disconnect()


class TestBidirectionalSync:
    """Test bidirectional sync - guest to host"""
    
    @pytest.mark.asyncio
    async def test_guest_draw_path_reaches_host(self):
        """Test that guest's draw_path reaches host but not guest"""
        host = socketio.AsyncClient()
        guest = socketio.AsyncClient()
        
        session_code = None
        host_received = []
        guest_received = []
        
        @host.on('session_created')
        async def on_created(data):
            nonlocal session_code
            session_code = data['code']
        
        @host.on('draw_path')
        async def on_host_draw(data):
            host_received.append(data)
        
        @guest.on('draw_path')
        async def on_guest_draw(data):
            guest_received.append(data)
        
        @guest.on('session_joined')
        async def on_joined(data):
            pass
        
        await host.connect(SOCKET_URL, socketio_path=SOCKET_PATH)
        await host.emit('create_session', {'name': 'TEST_Host_Bidir'})
        await asyncio.sleep(0.3)
        
        await guest.connect(SOCKET_URL, socketio_path=SOCKET_PATH)
        await guest.emit('join_session_request', {'code': session_code, 'name': 'TEST_Guest_Bidir'})
        await asyncio.sleep(0.3)
        
        # Guest sends draw_path
        await guest.emit('draw_path', {
            'points': [{'x': 50, 'y': 50}, {'x': 150, 'y': 150}],
            'color': '#00FF00',
            'thickness': 2
        })
        await asyncio.sleep(0.3)
        
        assert len(host_received) == 1, "Host should receive guest's draw_path"
        assert len(guest_received) == 0, "Guest should NOT receive their own draw_path"
        assert host_received[0]['color'] == '#00FF00'
        print(f"✓ Bidirectional sync: guest draw_path reaches host but not guest")
        
        await host.disconnect()
        await guest.disconnect()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
