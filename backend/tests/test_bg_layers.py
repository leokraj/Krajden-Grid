"""Test background layers sync via WebSocket"""
import asyncio
import socketio

API_URL = "https://session-sync-debug.preview.emergentagent.com"

async def test_bg_layers():
    host = socketio.AsyncClient(logger=False, engineio_logger=False)
    guest = socketio.AsyncClient(logger=False, engineio_logger=False)
    
    session_code = None
    created = asyncio.Event()
    joined = asyncio.Event()
    guest_layer_added = asyncio.Event()
    guest_layer_updated = asyncio.Event()
    guest_layer_removed = asyncio.Event()
    guest_all_cleared = asyncio.Event()
    received = {}

    @host.on('session_created')
    async def h(data):
        nonlocal session_code
        session_code = data['code']
        created.set()

    @guest.on('session_joined')
    async def g(data):
        received['join_bg_layers'] = data.get('bg_layers', [])
        joined.set()

    @guest.on('bg_layer_added')
    async def ga(data):
        received['added'] = data
        guest_layer_added.set()

    @guest.on('bg_layer_updated')
    async def gu(data):
        received['updated'] = data
        guest_layer_updated.set()

    @guest.on('bg_layer_removed')
    async def gr(data):
        received['removed'] = data
        guest_layer_removed.set()

    @guest.on('bg_layers_all_cleared')
    async def gc(data=None):
        received['cleared'] = True
        guest_all_cleared.set()

    results = {}
    try:
        await host.connect(API_URL, socketio_path='/api/socket.io/', transports=['websocket'])
        await guest.connect(API_URL, socketio_path='/api/socket.io/', transports=['websocket'])
        
        await host.emit('create_session', {'name': 'Host', 'grid_settings': {}, 'host_dimensions': {'width': 1920, 'height': 1080}})
        await asyncio.wait_for(created.wait(), 5)
        
        # Host adds a layer
        layer = {'id': 'test_layer_1', 'name': 'TestLayer', 'imageData': 'data:image/png;base64,iVBOR...', 'x': 500, 'y': 300, 'scale': 400, 'rotation': 0, 'opacity': 100, 'visible': True}
        await host.emit('bg_layer_add', layer)
        await asyncio.sleep(0.5)
        
        # Guest joins — should get the layer in initial state
        await guest.emit('join_session_request', {'code': session_code, 'name': 'Guest'})
        await asyncio.wait_for(joined.wait(), 5)
        
        if len(received.get('join_bg_layers', [])) == 1:
            results['join_initial_layers'] = 'PASS'
            print(f"Guest received 1 layer on join ✓")
        else:
            results['join_initial_layers'] = f'FAIL: got {len(received.get("join_bg_layers", []))} layers'
            print(f"FAIL: {results['join_initial_layers']}")
        
        await asyncio.sleep(0.3)
        
        # Host adds another layer
        layer2 = {'id': 'test_layer_2', 'name': 'Layer2', 'imageData': 'data:image/png;base64,test2', 'x': 200, 'y': 200, 'scale': 300, 'rotation': 45, 'opacity': 80, 'visible': True}
        await host.emit('bg_layer_add', layer2)
        try:
            await asyncio.wait_for(guest_layer_added.wait(), 3)
            results['layer_add'] = 'PASS'
            print(f"Guest received bg_layer_added: {received['added']['name']} ✓")
        except asyncio.TimeoutError:
            results['layer_add'] = 'FAIL: timeout'
            print("FAIL: layer add")
        
        # Host updates layer position
        await host.emit('bg_layer_update', {'id': 'test_layer_2', 'updates': {'x': 800, 'y': 600, 'scale': 500}})
        try:
            await asyncio.wait_for(guest_layer_updated.wait(), 3)
            results['layer_update'] = 'PASS'
            print(f"Guest received bg_layer_updated: {received['updated']} ✓")
        except asyncio.TimeoutError:
            results['layer_update'] = 'FAIL: timeout'
            print("FAIL: layer update")
        
        # Host removes layer
        await host.emit('bg_layer_remove', {'id': 'test_layer_1'})
        try:
            await asyncio.wait_for(guest_layer_removed.wait(), 3)
            results['layer_remove'] = 'PASS'
            print(f"Guest received bg_layer_removed: {received['removed']} ✓")
        except asyncio.TimeoutError:
            results['layer_remove'] = 'FAIL: timeout'
            print("FAIL: layer remove")
        
        # Host clears all
        await host.emit('bg_layers_clear_all', {})
        try:
            await asyncio.wait_for(guest_all_cleared.wait(), 3)
            results['clear_all'] = 'PASS'
            print("Guest received bg_layers_all_cleared ✓")
        except asyncio.TimeoutError:
            results['clear_all'] = 'FAIL: timeout'
            print("FAIL: clear all")

    except Exception as e:
        print(f"ERROR: {e}")
        results['error'] = str(e)
    finally:
        await host.disconnect()
        await guest.disconnect()

    print("\n" + "=" * 40)
    all_pass = all(v == 'PASS' for v in results.values())
    for k, v in results.items():
        print(f"  {'✓' if v == 'PASS' else '✗'} {k}: {v}")
    print(f"\n{'ALL PASSED' if all_pass else 'SOME FAILED'}")
    return all_pass

import sys
sys.exit(0 if asyncio.run(test_bg_layers()) else 1)
