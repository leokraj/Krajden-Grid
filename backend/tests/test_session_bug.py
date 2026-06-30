"""
Test to reproduce the "Session not found or is full" bug.
Simulates: Host creates session -> Guest tries to join -> Should succeed
"""
import asyncio
import socketio

SERVER_URL = "http://localhost:8001"
SIO_PATH = "/api/socket.io/"

async def test_create_and_join():
    """Test basic create + join flow"""
    host = socketio.AsyncClient()
    guest = socketio.AsyncClient()
    
    host_result = {}
    guest_result = {}
    
    @host.on('session_created')
    def on_session_created(data):
        print(f"[HOST] Session created: {data}")
        host_result['code'] = data['code']
        host_result['created'] = True
    
    @guest.on('session_joined')
    def on_session_joined(data):
        print(f"[GUEST] Joined session: {data['code']}")
        guest_result['joined'] = True
        guest_result['code'] = data['code']
    
    @guest.on('join_error')
    def on_join_error(data):
        print(f"[GUEST] JOIN ERROR: {data}")
        guest_result['error'] = data['message']
    
    # Connect host
    print("[HOST] Connecting...")
    await host.connect(SERVER_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
    print(f"[HOST] Connected: sid={host.sid}")
    
    # Host creates session
    print("[HOST] Creating session...")
    await host.emit('create_session', {'name': 'TestHost'})
    await asyncio.sleep(1)
    
    if 'code' not in host_result:
        print("FAIL: Session was not created")
        await host.disconnect()
        return False
    
    code = host_result['code']
    print(f"[HOST] Session code: {code}")
    
    # Connect guest
    print("[GUEST] Connecting...")
    await guest.connect(SERVER_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
    print(f"[GUEST] Connected: sid={guest.sid}")
    
    # Guest joins session
    print(f"[GUEST] Joining session {code}...")
    await guest.emit('join_session_request', {'code': code, 'name': 'TestGuest'})
    await asyncio.sleep(1)
    
    if 'error' in guest_result:
        print(f"FAIL: Guest got error: {guest_result['error']}")
        await host.disconnect()
        await guest.disconnect()
        return False
    
    if guest_result.get('joined'):
        print("PASS: Guest joined session successfully")
    else:
        print("FAIL: Guest did not receive session_joined event")
        await host.disconnect()
        await guest.disconnect()
        return False
    
    await host.disconnect()
    await guest.disconnect()
    return True


async def test_host_disconnect_then_guest_joins():
    """Test: Host creates session, host disconnects, guest tries to join during grace period"""
    host = socketio.AsyncClient()
    guest = socketio.AsyncClient()
    
    host_result = {}
    guest_result = {}
    
    @host.on('session_created')
    def on_created(data):
        host_result['code'] = data['code']
    
    @guest.on('session_joined')
    def on_joined(data):
        guest_result['joined'] = True
    
    @guest.on('join_error')
    def on_error(data):
        guest_result['error'] = data['message']
    
    # Host creates session
    await host.connect(SERVER_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
    await host.emit('create_session', {'name': 'TestHost'})
    await asyncio.sleep(1)
    
    code = host_result.get('code')
    if not code:
        print("FAIL: No session code")
        return False
    
    print(f"[TEST2] Session created: {code}")
    
    # Host disconnects
    print("[TEST2] Host disconnecting...")
    await host.disconnect()
    await asyncio.sleep(1)
    
    # Guest tries to join (within grace period)
    print("[TEST2] Guest connecting and joining...")
    await guest.connect(SERVER_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
    await guest.emit('join_session_request', {'code': code, 'name': 'TestGuest'})
    await asyncio.sleep(1)
    
    if guest_result.get('joined'):
        print("PASS: Guest joined during grace period")
        await guest.disconnect()
        return True
    elif guest_result.get('error'):
        print(f"FAIL: Guest got error during grace period: {guest_result['error']}")
        await guest.disconnect()
        return False
    else:
        print("FAIL: No response received")
        await guest.disconnect()
        return False


async def test_host_reconnect_then_guest_joins():
    """Test: Host creates, disconnects, reconnects, then guest joins"""
    host1 = socketio.AsyncClient()
    host2 = socketio.AsyncClient()
    guest = socketio.AsyncClient()
    
    host_result = {}
    host2_result = {}
    guest_result = {}
    
    @host1.on('session_created')
    def on_created(data):
        host_result['code'] = data['code']
    
    @host2.on('session_joined')
    def on_rejoined(data):
        host2_result['rejoined'] = True
    
    @guest.on('session_joined')
    def on_joined(data):
        guest_result['joined'] = True
    
    @guest.on('join_error')
    def on_error(data):
        guest_result['error'] = data['message']
    
    # Host creates session
    await host1.connect(SERVER_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
    await host1.emit('create_session', {'name': 'TestHost'})
    await asyncio.sleep(1)
    
    code = host_result.get('code')
    if not code:
        print("FAIL: No session code")
        return False
    
    print(f"[TEST3] Session created: {code}")
    
    # Host disconnects (simulating page refresh)
    print("[TEST3] Host disconnecting (simulating refresh)...")
    await host1.disconnect()
    await asyncio.sleep(1)
    
    # Host reconnects with new client (simulating page refresh)
    print("[TEST3] Host reconnecting...")
    await host2.connect(SERVER_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
    await host2.emit('rejoin_session', {'code': code, 'name': 'TestHost', 'is_host': True})
    await asyncio.sleep(1)
    
    if host2_result.get('rejoined'):
        print("[TEST3] Host successfully rejoined")
    else:
        print("[TEST3] WARNING: Host rejoin not confirmed")
    
    # Now guest joins
    print("[TEST3] Guest joining...")
    await guest.connect(SERVER_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
    await guest.emit('join_session_request', {'code': code, 'name': 'TestGuest'})
    await asyncio.sleep(1)
    
    if guest_result.get('joined'):
        print("PASS: Guest joined after host reconnect")
        result = True
    elif guest_result.get('error'):
        print(f"FAIL: Guest got error: {guest_result['error']}")
        result = False
    else:
        print("FAIL: No response received")
        result = False
    
    await host2.disconnect()
    await guest.disconnect()
    return result


async def main():
    print("=" * 60)
    print("TEST 1: Basic create + join")
    print("=" * 60)
    r1 = await test_create_and_join()
    
    print()
    print("=" * 60)
    print("TEST 2: Host disconnects, guest joins during grace period")
    print("=" * 60)
    r2 = await test_host_disconnect_then_guest_joins()
    
    print()
    print("=" * 60)
    print("TEST 3: Host disconnect + reconnect, then guest joins")
    print("=" * 60)
    r3 = await test_host_reconnect_then_guest_joins()
    
    print()
    print("=" * 60)
    print("RESULTS:")
    print(f"  Test 1 (basic join):              {'PASS' if r1 else 'FAIL'}")
    print(f"  Test 2 (join during grace):        {'PASS' if r2 else 'FAIL'}")
    print(f"  Test 3 (join after host reconnect): {'PASS' if r3 else 'FAIL'}")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
