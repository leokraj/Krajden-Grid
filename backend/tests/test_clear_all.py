"""Test: Host clears all drawings → Guest receives clear event"""
import asyncio
import socketio

API_URL = "https://session-sync-debug.preview.emergentagent.com"

async def test_clear_all():
    host = socketio.AsyncClient(logger=False, engineio_logger=False)
    guest = socketio.AsyncClient(logger=False, engineio_logger=False)
    
    session_code = None
    session_created = asyncio.Event()
    guest_joined = asyncio.Event()
    guest_received_draw = asyncio.Event()
    guest_received_clear = asyncio.Event()
    host_received_clear = asyncio.Event()

    @host.on('session_created')
    async def h_session(data):
        nonlocal session_code
        session_code = data['code']
        session_created.set()

    @host.on('clear_all_drawings')
    async def h_clear(data=None):
        print("[HOST] Received clear_all_drawings")
        host_received_clear.set()

    @guest.on('session_joined')
    async def g_joined(data):
        guest_joined.set()

    @guest.on('draw_path')
    async def g_draw(data):
        print(f"[GUEST] Received draw_path: {len(data.get('points',[]))} pts")
        guest_received_draw.set()

    @guest.on('clear_all_drawings')
    async def g_clear(data=None):
        print("[GUEST] Received clear_all_drawings")
        guest_received_clear.set()

    try:
        await host.connect(API_URL, socketio_path='/api/socket.io/', transports=['websocket'])
        await guest.connect(API_URL, socketio_path='/api/socket.io/', transports=['websocket'])
        
        await host.emit('create_session', {'name': 'Host', 'grid_settings': {}, 'host_dimensions': {'width': 1920, 'height': 1080}})
        await asyncio.wait_for(session_created.wait(), 5)
        print(f"Session: {session_code}")
        
        await guest.emit('join_session_request', {'code': session_code, 'name': 'Guest'})
        await asyncio.wait_for(guest_joined.wait(), 5)
        print("Guest joined")
        await asyncio.sleep(0.5)
        
        # Host draws
        await host.emit('draw_path', {'points': [{'x': 10, 'y': 20}], 'color': '#FF0000', 'thickness': 2})
        await asyncio.wait_for(guest_received_draw.wait(), 5)
        print("Guest received drawing ✓")
        
        # Host clears all
        await host.emit('clear_all_drawings', {})
        await asyncio.wait_for(guest_received_clear.wait(), 5)
        print("Guest received clear_all_drawings ✓")
        await asyncio.wait_for(host_received_clear.wait(), 5)
        print("Host also received clear_all_drawings ✓")
        
        print("\nALL TESTS PASSED ✓")
    except asyncio.TimeoutError as e:
        print(f"\nFAILED: Timeout — {e}")
    finally:
        await host.disconnect()
        await guest.disconnect()

asyncio.run(test_clear_all())
