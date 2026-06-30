"""
Test race conditions and edge cases in session management.
"""
import asyncio
import socketio

SERVER_URL = "http://localhost:8001"
SIO_PATH = "/api/socket.io/"

async def test_multiple_host_disconnects():
    """Test: Host creates session, disconnects twice quickly, then reconnects. Session should survive."""
    host1 = socketio.AsyncClient()
    host2 = socketio.AsyncClient()
    host3 = socketio.AsyncClient()
    guest = socketio.AsyncClient()
    
    host_result = {}
    host3_result = {}
    guest_result = {}
    
    @host1.on('session_created')
    def on_created(data):
        host_result['code'] = data['code']
    
    @host3.on('session_joined')
    def on_rejoined(data):
        host3_result['rejoined'] = True
    
    @guest.on('session_joined')
    def on_joined(data):
        guest_result['joined'] = True
    
    @guest.on('join_error')
    def on_error(data):
        guest_result['error'] = data['message']
    
    @guest.on('session_ended')
    def on_ended(data):
        guest_result['ended'] = data.get('reason', '')
    
    # Host creates session
    await host1.connect(SERVER_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
    await host1.emit('create_session', {'name': 'TestHost'})
    await asyncio.sleep(1)
    
    code = host_result.get('code')
    if not code:
        print("FAIL: No session code")
        return False
    print(f"[RACE TEST] Session created: {code}")
    
    # Host disconnects (1st time)
    print("[RACE TEST] Host disconnecting (1st time)...")
    await host1.disconnect()
    await asyncio.sleep(0.5)
    
    # Host reconnects briefly
    await host2.connect(SERVER_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
    await host2.emit('rejoin_session', {'code': code, 'name': 'TestHost', 'is_host': True})
    await asyncio.sleep(0.5)
    
    # Host disconnects again (2nd time)
    print("[RACE TEST] Host disconnecting (2nd time)...")
    await host2.disconnect()
    await asyncio.sleep(0.5)
    
    # Host reconnects again (3rd connection)
    print("[RACE TEST] Host reconnecting (final)...")
    await host3.connect(SERVER_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
    await host3.emit('rejoin_session', {'code': code, 'name': 'TestHost', 'is_host': True})
    await asyncio.sleep(1)
    
    if host3_result.get('rejoined'):
        print("[RACE TEST] Host successfully rejoined after multiple disconnects")
    else:
        print("[RACE TEST] WARNING: Host rejoin not confirmed")
    
    # Guest joins
    print("[RACE TEST] Guest joining...")
    await guest.connect(SERVER_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
    await guest.emit('join_session_request', {'code': code, 'name': 'TestGuest'})
    await asyncio.sleep(1)
    
    if guest_result.get('joined'):
        print("PASS: Guest joined after multiple host disconnects/reconnects")
        result = True
    elif guest_result.get('error'):
        print(f"FAIL: Guest got error: {guest_result['error']}")
        result = False
    else:
        print("FAIL: No response")
        result = False
    
    await host3.disconnect()
    await guest.disconnect()
    return result


async def test_guest_reconnect_doesnt_duplicate():
    """Test: Guest reconnects multiple times, should not duplicate entries"""
    host = socketio.AsyncClient()
    guest1 = socketio.AsyncClient()
    guest2 = socketio.AsyncClient()
    
    host_result = {}
    join_count = {'count': 0}
    
    @host.on('session_created')
    def on_created(data):
        host_result['code'] = data['code']
        host_result['participants'] = data['participants']
    
    @host.on('participant_joined')
    def on_participant_joined(data):
        join_count['count'] += 1
        host_result['participants'] = data['participants']
    
    @host.on('participant_left')
    def on_participant_left(data):
        host_result['participants'] = data['participants']
    
    # Host creates session
    await host.connect(SERVER_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
    await host.emit('create_session', {'name': 'TestHost'})
    await asyncio.sleep(1)
    
    code = host_result.get('code')
    print(f"[DUPE TEST] Session created: {code}")
    
    # Guest joins
    await guest1.connect(SERVER_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
    await guest1.emit('join_session_request', {'code': code, 'name': 'TestGuest'})
    await asyncio.sleep(1)
    
    # Guest disconnects
    print("[DUPE TEST] Guest disconnecting...")
    await guest1.disconnect()
    await asyncio.sleep(1)
    
    # Guest reconnects with new client
    print("[DUPE TEST] Guest reconnecting...")
    g2_result = {}
    
    @guest2.on('session_joined')
    def on_g2_joined(data):
        g2_result['joined'] = True
        g2_result['participants'] = data['participants']
    
    await guest2.connect(SERVER_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
    await guest2.emit('join_session_request', {'code': code, 'name': 'TestGuest'})
    await asyncio.sleep(1)
    
    # Check participant count - should be 1 guest, not 2
    participants = g2_result.get('participants', {})
    guest_count = len(participants.get('guests', []))
    
    if guest_count == 1:
        print(f"PASS: Only 1 guest entry after reconnect (no duplicates)")
        result = True
    else:
        print(f"FAIL: {guest_count} guest entries after reconnect (expected 1)")
        result = False
    
    await host.disconnect()
    await guest2.disconnect()
    return result


async def test_concurrent_joins():
    """Test: Multiple guests join at the same time"""
    host = socketio.AsyncClient()
    guests = []
    results = {}
    
    host_result = {}
    
    @host.on('session_created')
    def on_created(data):
        host_result['code'] = data['code']
    
    await host.connect(SERVER_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
    await host.emit('create_session', {'name': 'TestHost'})
    await asyncio.sleep(1)
    
    code = host_result.get('code')
    print(f"[CONCURRENT TEST] Session created: {code}")
    
    # Create 4 guests and join simultaneously
    for i in range(4):
        g = socketio.AsyncClient()
        
        def make_handlers(idx, client):
            @client.on('session_joined')
            def on_joined(data):
                results[idx] = 'joined'
            @client.on('join_error')
            def on_error(data):
                results[idx] = f'error: {data["message"]}'
        
        make_handlers(i, g)
        guests.append(g)
    
    # Connect all guests
    for g in guests:
        await g.connect(SERVER_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
    
    # Join all at roughly the same time
    for i, g in enumerate(guests):
        await g.emit('join_session_request', {'code': code, 'name': f'Guest{i}'})
    
    await asyncio.sleep(2)
    
    joined = sum(1 for v in results.values() if v == 'joined')
    errors = [v for v in results.values() if v != 'joined']
    
    print(f"[CONCURRENT TEST] {joined}/4 guests joined, errors: {errors}")
    
    # Clean up
    for g in guests:
        await g.disconnect()
    await host.disconnect()
    
    if joined == 4:
        print("PASS: All 4 guests joined concurrently")
        return True
    else:
        print(f"FAIL: Only {joined}/4 guests joined")
        return False


async def main():
    tests = [
        ("Race condition: multiple host disconnects", test_multiple_host_disconnects),
        ("Guest reconnect no duplicates", test_guest_reconnect_doesnt_duplicate),
        ("Concurrent joins", test_concurrent_joins),
    ]
    
    results = []
    for name, test_fn in tests:
        print(f"\n{'=' * 60}")
        print(f"TEST: {name}")
        print(f"{'=' * 60}")
        try:
            r = await test_fn()
            results.append((name, r))
        except Exception as e:
            print(f"ERROR: {e}")
            results.append((name, False))
    
    print(f"\n{'=' * 60}")
    print("RESULTS:")
    for name, passed in results:
        print(f"  {'PASS' if passed else 'FAIL'}: {name}")
    print(f"{'=' * 60}")

if __name__ == "__main__":
    asyncio.run(main())
