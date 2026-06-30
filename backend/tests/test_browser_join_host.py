"""
Creates a session and keeps it alive for browser testing.
Outputs the session code and waits for guest to join.
"""
import asyncio
import socketio
import sys

API_URL = "https://session-sync-debug.preview.emergentagent.com"

async def create_and_wait():
    client = socketio.AsyncClient(logger=False, engineio_logger=False)
    session_code = None
    created = asyncio.Event()
    guest_joined = asyncio.Event()
    received_draw = asyncio.Event()
    
    @client.on('connect')
    async def on_connect():
        print(f'[HOST] Connected: {client.sid}', flush=True)
    
    @client.on('session_created')
    async def on_session_created(data):
        nonlocal session_code
        session_code = data['code']
        print(f'SESSION_CODE={session_code}', flush=True)
        created.set()
    
    @client.on('participant_joined')
    async def on_participant_joined(data):
        print(f'[HOST] Guest joined: {data}', flush=True)
        guest_joined.set()
    
    @client.on('draw_path')
    async def on_draw_path(data):
        print(f'[HOST] Received draw_path from guest: {data.get("user_name")}', flush=True)
        received_draw.set()
    
    @client.on('cursor_move')
    async def on_cursor_move(data):
        print(f'[HOST] Received cursor from: {data.get("name")}', flush=True)
    
    await client.connect(API_URL, socketio_path='/api/socket.io/', transports=['websocket'])
    await client.emit('create_session', {'name': 'PythonHost', 'grid_settings': {}, 'host_dimensions': {'width': 1920, 'height': 1080}})
    await asyncio.wait_for(created.wait(), timeout=10)
    
    print(f'[HOST] Session {session_code} active. Waiting for guest...', flush=True)
    
    # Send a draw path that guest should see when they join
    await client.emit('draw_path', {
        'points': [{'x': 100, 'y': 100}, {'x': 200, 'y': 200}, {'x': 300, 'y': 150}],
        'color': '#FF0000',
        'thickness': 3,
        'timestamp': 12345
    })
    print('[HOST] Sent initial draw_path', flush=True)
    
    # Wait for guest to join (max 90 seconds)
    try:
        await asyncio.wait_for(guest_joined.wait(), timeout=90)
        print('[HOST] Guest joined! Waiting 30 more seconds for interaction...', flush=True)
        
        # Send another draw after guest joins
        await asyncio.sleep(2)
        await client.emit('draw_path', {
            'points': [{'x': 400, 'y': 400}, {'x': 500, 'y': 500}],
            'color': '#00FF00',
            'thickness': 5,
            'timestamp': 67890
        })
        print('[HOST] Sent second draw_path after guest joined', flush=True)
        
        await asyncio.sleep(30)
    except asyncio.TimeoutError:
        print('[HOST] Timeout waiting for guest', flush=True)
    
    await client.disconnect()
    print('[HOST] Disconnected', flush=True)

if __name__ == '__main__':
    asyncio.run(create_and_wait())
