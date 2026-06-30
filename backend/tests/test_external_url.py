"""
Test Socket.IO through external URL (Kubernetes ingress) to check proxy routing
"""
import asyncio
import socketio

EXTERNAL_URL = "https://session-sync-debug.preview.emergentagent.com"
SIO_PATH = "/api/socket.io/"

async def test_external_create_and_join():
    """Test create + join through external URL"""
    host = socketio.AsyncClient(logger=False)
    guest = socketio.AsyncClient(logger=False)
    
    host_result = {}
    guest_result = {}
    
    @host.on('connect')
    def host_connected():
        print(f"[HOST] Connected via external URL, sid={host.sid}")
    
    @host.on('connect_error')
    def host_error(data):
        print(f"[HOST] Connection error: {data}")
        host_result['conn_error'] = str(data)
    
    @host.on('session_created')
    def on_created(data):
        print(f"[HOST] Session created: code={data['code']}")
        host_result['code'] = data['code']
    
    @guest.on('connect')
    def guest_connected():
        print(f"[GUEST] Connected via external URL, sid={guest.sid}")
    
    @guest.on('connect_error')
    def guest_error(data):
        print(f"[GUEST] Connection error: {data}")
        guest_result['conn_error'] = str(data)
    
    @guest.on('session_joined')
    def on_joined(data):
        print(f"[GUEST] Joined session: {data['code']}")
        guest_result['joined'] = True
    
    @guest.on('join_error')
    def on_join_error(data):
        print(f"[GUEST] JOIN ERROR: {data}")
        guest_result['error'] = data['message']
    
    try:
        # Connect host through external URL
        print(f"[HOST] Connecting to {EXTERNAL_URL}...")
        await host.connect(EXTERNAL_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
        print(f"[HOST] Connected successfully")
        
        # Create session
        await host.emit('create_session', {'name': 'ExternalHost'})
        await asyncio.sleep(2)
        
        if 'conn_error' in host_result:
            print(f"FAIL: Host connection error: {host_result['conn_error']}")
            return
        
        if 'code' not in host_result:
            print("FAIL: No session code received")
            await host.disconnect()
            return
        
        code = host_result['code']
        
        # Connect guest through external URL
        print(f"[GUEST] Connecting to {EXTERNAL_URL}...")
        await guest.connect(EXTERNAL_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
        print(f"[GUEST] Connected successfully")
        
        # Guest joins
        print(f"[GUEST] Joining session {code}...")
        await guest.emit('join_session_request', {'code': code, 'name': 'ExternalGuest'})
        await asyncio.sleep(2)
        
        if guest_result.get('joined'):
            print("PASS: External URL test passed - guest joined successfully")
        elif guest_result.get('error'):
            print(f"FAIL: Guest got error: {guest_result['error']}")
        else:
            print("FAIL: No response from server")
        
        await host.disconnect()
        await guest.disconnect()
        
    except Exception as e:
        print(f"ERROR: {e}")
        try:
            await host.disconnect()
        except:
            pass
        try:
            await guest.disconnect()
        except:
            pass

asyncio.run(test_external_create_and_join())
