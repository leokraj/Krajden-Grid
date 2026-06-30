"""
Test grid settings sync, host dimensions, and host delete functionality.
"""
import asyncio
import socketio

SERVER_URL = "http://localhost:8001"
SIO_PATH = "/api/socket.io/"

async def test_grid_settings_sync():
    """Test: Host creates session with grid settings, guest receives them on join"""
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
        guest_result['grid_settings'] = data.get('grid_settings', {})
        guest_result['host_dimensions'] = data.get('host_dimensions', {})
    
    @guest.on('grid_settings_updated')
    def on_grid_updated(data):
        guest_result['updated_settings'] = data.get('settings', {})
    
    @guest.on('host_dimensions_updated')
    def on_dims_updated(data):
        guest_result['updated_dims'] = data
    
    # Host creates session with grid settings
    await host.connect(SERVER_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
    await host.emit('create_session', {
        'name': 'HostTest',
        'grid_settings': {
            'gridColor': '#FF0000',
            'lineThickness': 2.5,
            'opacity': 0.5,
            'gridEnabled': True,
        },
        'host_dimensions': {'width': 2560, 'height': 1440}
    })
    await asyncio.sleep(1)
    
    code = host_result.get('code')
    if not code:
        print("FAIL: No session code")
        return False
    print(f"Session created: {code}")
    
    # Guest joins
    await guest.connect(SERVER_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
    await guest.emit('join_session_request', {'code': code, 'name': 'GuestTest'})
    await asyncio.sleep(1)
    
    # Check guest received grid settings on join
    if not guest_result.get('joined'):
        print("FAIL: Guest didn't join")
        await host.disconnect(); await guest.disconnect()
        return False
    
    gs = guest_result.get('grid_settings', {})
    dims = guest_result.get('host_dimensions', {})
    
    if gs.get('gridColor') != '#FF0000':
        print(f"FAIL: Grid settings not received on join. Got: {gs}")
        await host.disconnect(); await guest.disconnect()
        return False
    print(f"PASS: Guest received grid settings on join: color={gs.get('gridColor')}, thickness={gs.get('lineThickness')}")
    
    if dims.get('width') != 2560 or dims.get('height') != 1440:
        print(f"FAIL: Host dimensions not received. Got: {dims}")
        await host.disconnect(); await guest.disconnect()
        return False
    print(f"PASS: Guest received host dimensions: {dims}")
    
    # Host updates grid settings
    await host.emit('update_grid_settings', {
        'settings': {
            'gridColor': '#00FF00',
            'lineThickness': 3.0,
            'opacity': 0.8,
        }
    })
    await asyncio.sleep(1)
    
    us = guest_result.get('updated_settings', {})
    if us.get('gridColor') != '#00FF00':
        print(f"FAIL: Grid settings update not received. Got: {us}")
        await host.disconnect(); await guest.disconnect()
        return False
    print(f"PASS: Guest received grid settings update: color={us.get('gridColor')}")
    
    # Host updates dimensions
    await host.emit('update_host_dimensions', {'width': 1920, 'height': 1080})
    await asyncio.sleep(1)
    
    ud = guest_result.get('updated_dims', {})
    if ud.get('width') != 1920:
        print(f"FAIL: Host dimensions update not received. Got: {ud}")
        await host.disconnect(); await guest.disconnect()
        return False
    print(f"PASS: Guest received host dimensions update: {ud}")
    
    await host.disconnect()
    await guest.disconnect()
    return True


async def test_host_delete_drawing():
    """Test: Host can delete a specific guest drawing"""
    host = socketio.AsyncClient()
    guest = socketio.AsyncClient()
    
    host_result = {}
    guest_result = {}
    drawings_updated = {'data': None}
    
    @host.on('session_created')
    def on_created(data):
        host_result['code'] = data['code']
    
    @guest.on('session_joined')
    def on_joined(data):
        guest_result['joined'] = True
    
    @host.on('draw_path')
    def on_draw(data):
        host_result['received_draw'] = True
    
    @host.on('drawings_updated')
    def on_drawings_updated(data):
        drawings_updated['data'] = data
    
    @guest.on('drawings_updated')
    def on_guest_drawings_updated(data):
        guest_result['drawings_updated'] = data
    
    # Setup session
    await host.connect(SERVER_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
    await host.emit('create_session', {'name': 'Host'})
    await asyncio.sleep(1)
    
    code = host_result['code']
    
    await guest.connect(SERVER_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
    await guest.emit('join_session_request', {'code': code, 'name': 'Guest'})
    await asyncio.sleep(1)
    
    # Guest draws something
    await guest.emit('draw_path', {
        'points': [{'x': 10, 'y': 10}, {'x': 100, 'y': 100}],
        'color': '#FF0000',
        'thickness': 3,
    })
    await asyncio.sleep(1)
    
    # Host deletes the drawing (index 0)
    await host.emit('remove_drawing', {'index': 0})
    await asyncio.sleep(1)
    
    if drawings_updated['data'] is not None:
        drawings = drawings_updated['data'].get('drawings', [])
        if len(drawings) == 0:
            print("PASS: Host deleted guest drawing, drawings list is empty")
            await host.disconnect(); await guest.disconnect()
            return True
        else:
            print(f"FAIL: Drawing not deleted, still {len(drawings)} drawings")
            await host.disconnect(); await guest.disconnect()
            return False
    else:
        print("FAIL: No drawings_updated event received")
        await host.disconnect(); await guest.disconnect()
        return False


async def test_guest_cannot_update_grid():
    """Test: Guest cannot update grid settings (only host can)"""
    host = socketio.AsyncClient()
    guest = socketio.AsyncClient()
    
    host_result = {}
    guest_result = {}
    
    @host.on('session_created')
    def on_created(data):
        host_result['code'] = data['code']
    
    @host.on('grid_settings_updated')
    def on_grid_updated(data):
        host_result['received_update'] = True
    
    @guest.on('session_joined')
    def on_joined(data):
        guest_result['joined'] = True
    
    await host.connect(SERVER_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
    await host.emit('create_session', {'name': 'Host'})
    await asyncio.sleep(1)
    
    code = host_result['code']
    
    await guest.connect(SERVER_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
    await guest.emit('join_session_request', {'code': code, 'name': 'Guest'})
    await asyncio.sleep(1)
    
    # Guest tries to update grid settings (should be ignored)
    await guest.emit('update_grid_settings', {'settings': {'gridColor': '#FF00FF'}})
    await asyncio.sleep(1)
    
    if host_result.get('received_update'):
        print("FAIL: Host received grid update from guest (should be blocked)")
        await host.disconnect(); await guest.disconnect()
        return False
    else:
        print("PASS: Guest's grid settings update was correctly ignored")
        await host.disconnect(); await guest.disconnect()
        return True


async def main():
    tests = [
        ("Grid settings sync (create + update + dimensions)", test_grid_settings_sync),
        ("Host delete guest drawing", test_host_delete_drawing),
        ("Guest cannot update grid settings", test_guest_cannot_update_grid),
    ]
    
    results = []
    for name, fn in tests:
        print(f"\n{'=' * 60}")
        print(f"TEST: {name}")
        print(f"{'=' * 60}")
        try:
            r = await fn()
            results.append((name, r))
        except Exception as e:
            print(f"ERROR: {e}")
            import traceback
            traceback.print_exc()
            results.append((name, False))
    
    print(f"\n{'=' * 60}")
    print("RESULTS:")
    for name, passed in results:
        print(f"  {'PASS' if passed else 'FAIL'}: {name}")
    print(f"{'=' * 60}")

if __name__ == "__main__":
    asyncio.run(main())
