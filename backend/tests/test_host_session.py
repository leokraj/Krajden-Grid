"""
Creates a session and keeps it alive. Emits draw events periodically.
Run in background, then test joining from browser.
"""
import asyncio
import socketio
import json
import signal
import sys

API_URL = "https://session-sync-debug.preview.emergentagent.com"

async def main():
    sio = socketio.AsyncClient(logger=False, engineio_logger=False)
    session_code = None
    connected_evt = asyncio.Event()
    session_evt = asyncio.Event()

    @sio.on('connect')
    async def on_connect():
        print(f"[HOST] Connected: {sio.sid}")
        connected_evt.set()

    @sio.on('disconnect')
    async def on_disconnect():
        print("[HOST] Disconnected")

    @sio.on('session_created')
    async def on_session_created(data):
        nonlocal session_code
        session_code = data['code']
        print(f"[HOST] Session created: {session_code}")
        session_evt.set()

    @sio.on('participant_joined')
    async def on_participant_joined(data):
        print(f"[HOST] Participant joined: {data.get('name', 'unknown')}")

    @sio.on('draw_path')
    async def on_draw_path(data):
        print(f"[HOST] Received draw from guest: {data.get('user_name')}")

    @sio.on('cursor_move')
    async def on_cursor_move(data):
        print(f"[HOST] Cursor from: {data.get('name')} at ({data.get('x')}, {data.get('y')})")

    await sio.connect(API_URL, socketio_path='/api/socket.io/', transports=['websocket'])
    await asyncio.wait_for(connected_evt.wait(), timeout=10)
    
    await sio.emit('create_session', {
        'name': 'PythonHost',
        'grid_settings': {'gridEnabled': True, 'gridColor': '#00F0FF'},
        'host_dimensions': {'width': 1920, 'height': 1080}
    })
    await asyncio.wait_for(session_evt.wait(), timeout=10)
    
    # Write session code to file so browser test can read it
    with open('/tmp/test_session_code.txt', 'w') as f:
        f.write(session_code)
    print(f"\nSession code: {session_code}")
    print("Emitting draw events every 3 seconds...")
    print("Press Ctrl+C to stop\n")
    
    counter = 0
    try:
        while True:
            counter += 1
            # Emit a draw path
            await sio.emit('draw_path', {
                'points': [{'x': 100 + counter * 10, 'y': 100}, {'x': 200 + counter * 10, 'y': 200}],
                'color': '#FF0000',
                'thickness': 3,
                'timestamp': counter
            })
            print(f"[HOST] Emitted draw_path #{counter}")
            
            # Emit cursor move
            await sio.emit('cursor_move', {
                'x': 500 + counter * 5,
                'y': 300,
                'name': 'PythonHost',
                'color': '#FF4444',
                'clicking': False
            })
            
            await asyncio.sleep(3)
    except (KeyboardInterrupt, asyncio.CancelledError):
        pass
    finally:
        await sio.disconnect()
        print("Disconnected")

if __name__ == '__main__':
    asyncio.run(main())
