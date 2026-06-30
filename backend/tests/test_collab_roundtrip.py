"""
Full roundtrip test for collaborative session sync.
Tests: create session → join session → emit draw_path → verify guest receives it.
Also tests cursor_move and add_measurement broadcasting.
"""
import asyncio
import socketio
import json
import sys

API_URL = "https://session-sync-debug.preview.emergentagent.com"
RESULTS = {}

async def test_full_roundtrip():
    host = socketio.AsyncClient(logger=False, engineio_logger=False)
    guest = socketio.AsyncClient(logger=False, engineio_logger=False)
    
    host_connected = asyncio.Event()
    guest_connected = asyncio.Event()
    session_created = asyncio.Event()
    guest_joined = asyncio.Event()
    
    # Events received by guest
    guest_received_draw = asyncio.Event()
    guest_received_cursor = asyncio.Event()
    guest_received_measurement = asyncio.Event()
    
    # Events received by host
    host_received_draw = asyncio.Event()
    
    session_code = None
    received_data = {}

    # ---- HOST EVENTS ----
    @host.on('connect')
    async def host_on_connect():
        print(f"[HOST] Connected: {host.sid}")
        host_connected.set()

    @host.on('session_created')
    async def host_on_session_created(data):
        nonlocal session_code
        session_code = data['code']
        print(f"[HOST] Session created: {session_code}")
        session_created.set()

    @host.on('draw_path')
    async def host_on_draw_path(data):
        print(f"[HOST] Received draw_path from: {data.get('user_name')}, points: {len(data.get('points', []))}")
        received_data['host_draw'] = data
        host_received_draw.set()

    @host.on('participant_joined')
    async def host_on_participant_joined(data):
        print(f"[HOST] Participant joined: {data.get('name', 'unknown')}")

    # ---- GUEST EVENTS ----
    @guest.on('connect')
    async def guest_on_connect():
        print(f"[GUEST] Connected: {guest.sid}")
        guest_connected.set()

    @guest.on('session_joined')
    async def guest_on_session_joined(data):
        print(f"[GUEST] Joined session: {data['code']}")
        guest_joined.set()

    @guest.on('join_error')
    async def guest_on_join_error(data):
        print(f"[GUEST] Join ERROR: {data.get('message')}")
        RESULTS['join'] = f"FAIL: {data.get('message')}"
        guest_joined.set()  # unblock

    @guest.on('draw_path')
    async def guest_on_draw_path(data):
        print(f"[GUEST] Received draw_path from: {data.get('user_name')}, points: {len(data.get('points', []))}")
        received_data['guest_draw'] = data
        guest_received_draw.set()

    @guest.on('cursor_move')
    async def guest_on_cursor_move(data):
        print(f"[GUEST] Received cursor_move: x={data.get('x')}, y={data.get('y')}, name={data.get('name')}")
        received_data['guest_cursor'] = data
        guest_received_cursor.set()

    @guest.on('add_measurement')
    async def guest_on_add_measurement(data):
        print(f"[GUEST] Received add_measurement from: {data.get('user_name')}")
        received_data['guest_measurement'] = data
        guest_received_measurement.set()

    try:
        # Connect both clients
        print("\n=== Connecting clients ===")
        await host.connect(API_URL, socketio_path='/api/socket.io/', transports=['websocket'])
        await asyncio.wait_for(host_connected.wait(), timeout=10)
        
        await guest.connect(API_URL, socketio_path='/api/socket.io/', transports=['websocket'])
        await asyncio.wait_for(guest_connected.wait(), timeout=10)
        
        RESULTS['connect'] = "PASS"
        print("Both clients connected ✓")

        # Host creates session
        print("\n=== Creating session ===")
        await host.emit('create_session', {'name': 'TestHost', 'grid_settings': {}, 'host_dimensions': {'width': 1920, 'height': 1080}})
        await asyncio.wait_for(session_created.wait(), timeout=10)
        RESULTS['create'] = "PASS"
        print(f"Session created: {session_code} ✓")

        # Guest joins session
        print("\n=== Guest joining session ===")
        await guest.emit('join_session_request', {'code': session_code, 'name': 'TestGuest'})
        await asyncio.wait_for(guest_joined.wait(), timeout=10)
        if 'join' not in RESULTS:
            RESULTS['join'] = "PASS"
            print("Guest joined ✓")
        else:
            print(f"Guest join failed: {RESULTS['join']}")
            return

        # Small delay to ensure room membership is settled
        await asyncio.sleep(0.5)

        # Test 1: Host sends draw_path → Guest should receive
        print("\n=== Test 1: Host draw_path → Guest ===")
        draw_data = {
            'points': [{'x': 10, 'y': 20}, {'x': 30, 'y': 40}, {'x': 50, 'y': 60}],
            'color': '#FF0000',
            'thickness': 3,
            'timestamp': 12345
        }
        await host.emit('draw_path', draw_data)
        try:
            await asyncio.wait_for(guest_received_draw.wait(), timeout=5)
            RESULTS['host_draw_to_guest'] = "PASS"
            print("Guest received host's draw_path ✓")
        except asyncio.TimeoutError:
            RESULTS['host_draw_to_guest'] = "FAIL: Timeout waiting for draw_path"
            print("FAIL: Guest did NOT receive draw_path ✗")

        # Test 2: Host sends cursor_move → Guest should receive
        print("\n=== Test 2: Host cursor_move → Guest ===")
        await host.emit('cursor_move', {'x': 100, 'y': 200, 'name': 'TestHost', 'color': '#FF0000', 'clicking': False})
        try:
            await asyncio.wait_for(guest_received_cursor.wait(), timeout=5)
            RESULTS['host_cursor_to_guest'] = "PASS"
            print("Guest received host's cursor ✓")
        except asyncio.TimeoutError:
            RESULTS['host_cursor_to_guest'] = "FAIL: Timeout"
            print("FAIL: Guest did NOT receive cursor_move ✗")

        # Test 3: Host sends add_measurement → Guest should receive
        print("\n=== Test 3: Host add_measurement → Guest ===")
        await host.emit('add_measurement', {'startX': 0, 'startY': 0, 'endX': 100, 'endY': 100, 'type': 'line'})
        try:
            await asyncio.wait_for(guest_received_measurement.wait(), timeout=5)
            RESULTS['host_measurement_to_guest'] = "PASS"
            print("Guest received host's measurement ✓")
        except asyncio.TimeoutError:
            RESULTS['host_measurement_to_guest'] = "FAIL: Timeout"
            print("FAIL: Guest did NOT receive measurement ✗")

        # Test 4: Guest sends draw_path → Host should receive
        print("\n=== Test 4: Guest draw_path → Host ===")
        guest_draw_data = {
            'points': [{'x': 100, 'y': 100}, {'x': 200, 'y': 200}],
            'color': '#00FF00',
            'thickness': 5,
            'timestamp': 67890
        }
        await guest.emit('draw_path', guest_draw_data)
        try:
            await asyncio.wait_for(host_received_draw.wait(), timeout=5)
            RESULTS['guest_draw_to_host'] = "PASS"
            print("Host received guest's draw_path ✓")
        except asyncio.TimeoutError:
            RESULTS['guest_draw_to_host'] = "FAIL: Timeout"
            print("FAIL: Host did NOT receive draw_path ✗")

    except Exception as e:
        print(f"\nERROR: {e}")
        RESULTS['error'] = str(e)
    finally:
        await host.disconnect()
        await guest.disconnect()

    # Summary
    print("\n" + "=" * 50)
    print("RESULTS SUMMARY:")
    print("=" * 50)
    all_pass = True
    for test, result in RESULTS.items():
        status = "✓" if result == "PASS" else "✗"
        print(f"  {status} {test}: {result}")
        if result != "PASS":
            all_pass = False
    
    print(f"\n{'ALL TESTS PASSED' if all_pass else 'SOME TESTS FAILED'}")
    return all_pass

if __name__ == '__main__':
    result = asyncio.run(test_full_roundtrip())
    sys.exit(0 if result else 1)
