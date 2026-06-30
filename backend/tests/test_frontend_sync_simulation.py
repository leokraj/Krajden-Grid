"""
Frontend Sync Simulation Test
This test simulates what the frontend does:
1. Creates a host session
2. Joins as guest
3. Tests bidirectional sync for:
   - Clipart (host→guest, guest→host)
   - Drawing (host→guest, guest→host)
   - Background image (host→all)

The backend tests already pass 13/13, so this focuses on verifying
the exact event flow that the frontend uses.
"""

import pytest
import asyncio
import socketio
import os

# Internal socket URL
SOCKET_URL = 'http://localhost:8001'
SOCKET_PATH = '/api/socket.io'


class TestFrontendSyncSimulation:
    """Simulate frontend sync patterns"""
    
    @pytest.mark.asyncio
    async def test_full_clipart_sync_bidirectional(self):
        """
        Test clipart sync in both directions - simulating actual frontend flow:
        1. Host creates session
        2. Guest joins
        3. HOST adds clipart → guest receives clipart_added
        4. GUEST adds clipart → host receives clipart_added
        """
        host = socketio.AsyncClient()
        guest = socketio.AsyncClient()
        
        session_code = None
        host_received_cliparts = []
        guest_received_cliparts = []
        
        # Host event handlers
        @host.on('session_created')
        async def on_host_created(data):
            nonlocal session_code
            session_code = data['code']
            print(f"[HOST] Session created: {session_code}")
        
        @host.on('clipart_added')
        async def on_host_clipart(data):
            host_received_cliparts.append(data)
            print(f"[HOST] Received clipart_added: {data.get('instanceId')} from {data.get('user_name')}")
        
        # Guest event handlers
        @guest.on('session_joined')
        async def on_guest_joined(data):
            print(f"[GUEST] Joined session: {data.get('code')}")
        
        @guest.on('clipart_added')
        async def on_guest_clipart(data):
            guest_received_cliparts.append(data)
            print(f"[GUEST] Received clipart_added: {data.get('instanceId')} from {data.get('user_name')}")
        
        # 1. Host connects and creates session
        await host.connect(SOCKET_URL, socketio_path=SOCKET_PATH)
        await host.emit('create_session', {'name': 'TestHost'})
        await asyncio.sleep(0.5)
        assert session_code is not None, "Session should be created"
        
        # 2. Guest connects and joins
        await guest.connect(SOCKET_URL, socketio_path=SOCKET_PATH)
        await guest.emit('join_session_request', {'code': session_code, 'name': 'TestGuest'})
        await asyncio.sleep(0.5)
        
        # 3. HOST adds clipart
        print("\n=== HOST adding clipart ===")
        await host.emit('add_clipart', {
            'instanceId': 'host_clip_001',
            'id': 'token_fighter',
            'name': 'Fighter Token',
            'x': 200, 'y': 200,
            'scale': 50, 'rotation': 0
        })
        await asyncio.sleep(0.5)
        
        # Verify: Host should NOT receive (skip_sid), Guest SHOULD receive
        assert len(host_received_cliparts) == 0, f"Host should NOT receive own clipart but got: {host_received_cliparts}"
        assert len(guest_received_cliparts) == 1, f"Guest should receive host's clipart but got: {guest_received_cliparts}"
        assert guest_received_cliparts[0]['instanceId'] == 'host_clip_001'
        print(f"✓ HOST→GUEST clipart sync works: Guest received {guest_received_cliparts[0]['instanceId']}")
        
        # 4. GUEST adds clipart
        print("\n=== GUEST adding clipart ===")
        await guest.emit('add_clipart', {
            'instanceId': 'guest_clip_001',
            'id': 'token_wizard',
            'name': 'Wizard Token',
            'x': 300, 'y': 300,
            'scale': 50, 'rotation': 0
        })
        await asyncio.sleep(0.5)
        
        # Verify: Guest should NOT receive (skip_sid), Host SHOULD receive
        assert len(guest_received_cliparts) == 1, f"Guest should NOT receive own clipart (still 1), got: {len(guest_received_cliparts)}"
        assert len(host_received_cliparts) == 1, f"Host should receive guest's clipart but got: {host_received_cliparts}"
        assert host_received_cliparts[0]['instanceId'] == 'guest_clip_001'
        print(f"✓ GUEST→HOST clipart sync works: Host received {host_received_cliparts[0]['instanceId']}")
        
        print("\n=== BIDIRECTIONAL CLIPART SYNC: PASS ===")
        
        await host.disconnect()
        await guest.disconnect()

    @pytest.mark.asyncio
    async def test_full_drawing_sync_bidirectional(self):
        """
        Test drawing sync in both directions:
        1. HOST draws → guest receives draw_path
        2. GUEST draws → host receives draw_path
        """
        host = socketio.AsyncClient()
        guest = socketio.AsyncClient()
        
        session_code = None
        host_received_drawings = []
        guest_received_drawings = []
        
        @host.on('session_created')
        async def on_host_created(data):
            nonlocal session_code
            session_code = data['code']
            print(f"[HOST] Session created: {session_code}")
        
        @host.on('draw_path')
        async def on_host_draw(data):
            host_received_drawings.append(data)
            print(f"[HOST] Received draw_path: {len(data.get('points', []))} points from {data.get('user_name')}")
        
        @guest.on('session_joined')
        async def on_guest_joined(data):
            print(f"[GUEST] Joined session")
        
        @guest.on('draw_path')
        async def on_guest_draw(data):
            guest_received_drawings.append(data)
            print(f"[GUEST] Received draw_path: {len(data.get('points', []))} points from {data.get('user_name')}")
        
        # Setup
        await host.connect(SOCKET_URL, socketio_path=SOCKET_PATH)
        await host.emit('create_session', {'name': 'DrawHost'})
        await asyncio.sleep(0.5)
        
        await guest.connect(SOCKET_URL, socketio_path=SOCKET_PATH)
        await guest.emit('join_session_request', {'code': session_code, 'name': 'DrawGuest'})
        await asyncio.sleep(0.5)
        
        # HOST draws
        print("\n=== HOST drawing ===")
        await host.emit('draw_path', {
            'points': [{'x': 100, 'y': 100}, {'x': 200, 'y': 200}, {'x': 300, 'y': 300}],
            'color': '#FF4444',
            'thickness': 3,
            'timestamp': 12345
        })
        await asyncio.sleep(0.5)
        
        assert len(host_received_drawings) == 0, "Host should NOT receive own draw_path"
        assert len(guest_received_drawings) == 1, "Guest should receive host's draw_path"
        print(f"✓ HOST→GUEST drawing sync works")
        
        # GUEST draws
        print("\n=== GUEST drawing ===")
        await guest.emit('draw_path', {
            'points': [{'x': 400, 'y': 400}, {'x': 500, 'y': 500}],
            'color': '#00FF00',
            'thickness': 5,
            'timestamp': 12346
        })
        await asyncio.sleep(0.5)
        
        assert len(guest_received_drawings) == 1, "Guest should NOT receive own draw_path (still 1)"
        assert len(host_received_drawings) == 1, "Host should receive guest's draw_path"
        assert host_received_drawings[0]['color'] == '#00FF00'
        print(f"✓ GUEST→HOST drawing sync works")
        
        print("\n=== BIDIRECTIONAL DRAWING SYNC: PASS ===")
        
        await host.disconnect()
        await guest.disconnect()

    @pytest.mark.asyncio
    async def test_full_background_sync(self):
        """
        Test background image sync:
        - Only HOST can set background
        - Background broadcasts to ALL (including host for self-confirmation)
        """
        host = socketio.AsyncClient()
        guest = socketio.AsyncClient()
        
        session_code = None
        host_received_bg = []
        guest_received_bg = []
        
        @host.on('session_created')
        async def on_host_created(data):
            nonlocal session_code
            session_code = data['code']
        
        @host.on('background_image_updated')
        async def on_host_bg(data):
            host_received_bg.append(data)
            print(f"[HOST] Received background_image_updated, set_by: {data.get('set_by')}")
        
        @guest.on('session_joined')
        async def on_guest_joined(data):
            pass
        
        @guest.on('background_image_updated')
        async def on_guest_bg(data):
            guest_received_bg.append(data)
            print(f"[GUEST] Received background_image_updated, set_by: {data.get('set_by')}")
        
        # Setup
        await host.connect(SOCKET_URL, socketio_path=SOCKET_PATH)
        await host.emit('create_session', {'name': 'BGHost'})
        await asyncio.sleep(0.5)
        
        await guest.connect(SOCKET_URL, socketio_path=SOCKET_PATH)
        await guest.emit('join_session_request', {'code': session_code, 'name': 'BGGuest'})
        await asyncio.sleep(0.5)
        
        # HOST sets background (broadcasts to ALL including self)
        print("\n=== HOST setting background ===")
        await host.emit('set_background_image', {
            'data': 'data:image/png;base64,fake_image_data_123',
            'scale': 100,
            'x': 0, 'y': 0,
            'rotation': 0,
            'tile': False
        })
        await asyncio.sleep(0.5)
        
        # Note: set_background_image broadcasts to ALL in room (no skip_sid)
        assert len(host_received_bg) == 1, "Host should receive background_image_updated (broadcast to all)"
        assert len(guest_received_bg) == 1, "Guest should receive background_image_updated"
        assert host_received_bg[0]['set_by'] == 'BGHost'
        assert guest_received_bg[0]['set_by'] == 'BGHost'
        print(f"✓ BACKGROUND sync works: Both host and guest received update")
        
        print("\n=== BACKGROUND SYNC: PASS ===")
        
        await host.disconnect()
        await guest.disconnect()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
