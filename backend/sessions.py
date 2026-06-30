"""
Collaborative Session Management for OverGrid
- Real-time sync for drawings, measurements, eraser
- Host can block guests (view-only mode)
- 15 min inactivity timeout with 2 min warning
"""

import random
import string
from datetime import datetime, timezone
from typing import Dict, List, Optional
import socketio
import logging

logger = logging.getLogger(__name__)

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=False,
    engineio_logger=False,
    ping_timeout=30,
    ping_interval=15,
    max_http_buffer_size=10 * 1024 * 1024,  # 10MB for background images
)

# In-memory session storage (can be moved to MongoDB for persistence)
sessions: Dict[str, dict] = {}
sid_to_session: Dict[str, str] = {}  # Maps socket ID to session code
sid_to_user: Dict[str, dict] = {}  # Maps socket ID to user info

def generate_session_code() -> str:
    """Generate a 6-character alphanumeric code"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

def get_session(code: str) -> Optional[dict]:
    """Get session by code"""
    return sessions.get(code.upper())

def create_new_session(host_sid: str, host_name: str) -> dict:
    """Create a new collaborative session"""
    code = generate_session_code()
    while code in sessions:
        code = generate_session_code()
    
    session = {
        'code': code,
        'host_sid': host_sid,
        'host_name': host_name,
        'guests': [],  # List of {sid, name, blocked}
        'drawings': [],
        'measurements': [],
        'cliparts': [],  # Shared cliparts on the grid
        'bg_layers': [],  # Background image layers (max 5)
        'created_at': datetime.now(timezone.utc).isoformat(),
        'last_activity': datetime.now(timezone.utc).isoformat(),
        'max_guests': 8,
        'background_image': None,  # Shared background image data
        'pending_bg_requests': [],  # Pending background image requests from guests
        'host_disconnected': False,
        'disconnect_version': 0,  # Incremented on each host disconnect, used to prevent stale grace period tasks
        'grid_settings': {},  # Host's grid settings synced to all guests
        'host_dimensions': {'width': 1920, 'height': 1080},  # Host's screen dimensions for ratio matching
    }
    sessions[code] = session
    sid_to_session[host_sid] = code
    sid_to_user[host_sid] = {'name': host_name, 'is_host': True}
    return session

def join_session(code: str, guest_sid: str, guest_name: str) -> Optional[dict]:
    """Join an existing session"""
    session = get_session(code)
    if not session:
        logger.warning(f"join_session failed: no session with code '{code}'. Active sessions: {list(sessions.keys())}")
        return None
    
    if len(session['guests']) >= session['max_guests']:
        logger.warning(f"join_session failed: session {code} is full ({len(session['guests'])}/{session['max_guests']})")
        return None
    
    # Check if already in session (by SID)
    for guest in session['guests']:
        if guest['sid'] == guest_sid:
            return session
    
    session['guests'].append({
        'sid': guest_sid,
        'name': guest_name,
        'blocked': False,
        'joined_at': datetime.now(timezone.utc).isoformat()
    })
    session['last_activity'] = datetime.now(timezone.utc).isoformat()
    sid_to_session[guest_sid] = code
    sid_to_user[guest_sid] = {'name': guest_name, 'is_host': False}
    logger.info(f"Guest '{guest_name}' (sid={guest_sid}) joined session {code}")
    return session

def leave_session(sid: str) -> Optional[str]:
    """Leave a session, returns session code if found"""
    code = sid_to_session.get(sid)
    if not code:
        return None
    
    session = sessions.get(code)
    if not session:
        # Clean up stale mappings
        sid_to_session.pop(sid, None)
        sid_to_user.pop(sid, None)
        return None
    
    # If host leaves via explicit leave (not disconnect), end the session
    if session['host_sid'] == sid:
        end_session(code)
        return code
    
    # Remove guest
    session['guests'] = [g for g in session['guests'] if g['sid'] != sid]
    sid_to_session.pop(sid, None)
    sid_to_user.pop(sid, None)
    
    return code

def end_session(code: str) -> bool:
    """End a session completely"""
    session = sessions.get(code)
    if not session:
        return False
    
    # Clean up all participants
    host_sid = session['host_sid']
    if host_sid in sid_to_session:
        del sid_to_session[host_sid]
    if host_sid in sid_to_user:
        del sid_to_user[host_sid]
    
    for guest in session['guests']:
        if guest['sid'] in sid_to_session:
            del sid_to_session[guest['sid']]
        if guest['sid'] in sid_to_user:
            del sid_to_user[guest['sid']]
    
    del sessions[code]
    return True

def block_guest(code: str, guest_sid: str, blocked: bool) -> bool:
    """Block or unblock a guest"""
    session = get_session(code)
    if not session:
        return False
    
    for guest in session['guests']:
        if guest['sid'] == guest_sid:
            guest['blocked'] = blocked
            return True
    return False

def is_blocked(sid: str) -> bool:
    """Check if a user is blocked"""
    code = sid_to_session.get(sid)
    if not code:
        return False
    
    session = sessions.get(code)
    if not session:
        return False
    
    for guest in session['guests']:
        if guest['sid'] == sid:
            return guest['blocked']
    return False

def update_activity(code: str):
    """Update last activity timestamp"""
    session = sessions.get(code)
    if session:
        session['last_activity'] = datetime.now(timezone.utc).isoformat()

def get_participants(code: str) -> dict:
    """Get all participants in a session"""
    session = get_session(code)
    if not session:
        return {'host': None, 'guests': []}
    
    return {
        'host': {
            'sid': session['host_sid'],
            'name': session['host_name']
        },
        'guests': [{
            'sid': g['sid'],
            'name': g['name'],
            'blocked': g['blocked']
        } for g in session['guests']]
    }

# Socket.IO Event Handlers
@sio.event
async def connect(sid, environ):
    logger.info(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    logger.info(f"Client disconnected: {sid}")
    code = sid_to_session.get(sid)
    if not code:
        # Not in a session, just clean up
        sid_to_user.pop(sid, None)
        return
    
    session = get_session(code)
    if not session:
        # Clean up stale mapping
        sid_to_session.pop(sid, None)
        sid_to_user.pop(sid, None)
        return
    
    is_host = session['host_sid'] == sid
    
    if is_host:
        # Increment disconnect version so stale grace tasks are ignored
        session['disconnect_version'] = session.get('disconnect_version', 0) + 1
        current_version = session['disconnect_version']
        
        # Mark host as disconnected but DON'T end session immediately
        session['host_disconnected'] = True
        session['host_disconnect_time'] = datetime.now(timezone.utc).isoformat()
        # Clean up SID mappings for old SID
        sid_to_session.pop(sid, None)
        sid_to_user.pop(sid, None)
        # Notify guests that host briefly disconnected
        await sio.emit('host_reconnecting', {
            'message': 'Host is reconnecting...'
        }, room=code)
        logger.info(f"Host disconnected from session {code}, grace period started (version={current_version})")
        
        # Schedule session end after grace period (5 minutes)
        async def end_after_grace():
            import asyncio
            await asyncio.sleep(300)  # 5 minutes grace period
            s = sessions.get(code)
            if not s:
                return  # Session already ended
            # Only proceed if this is still the same disconnect event (version matches)
            if s.get('disconnect_version', 0) != current_version:
                logger.info(f"Session {code}: Grace period (v{current_version}) expired but version changed to {s.get('disconnect_version')}, skipping cleanup")
                return
            if not s.get('host_disconnected'):
                logger.info(f"Session {code}: Grace period (v{current_version}) expired but host reconnected, skipping cleanup")
                return
            # Host didn't reconnect - end session
            logger.info(f"Session {code}: Grace period (v{current_version}) expired, ending session")
            await sio.emit('session_ended', {'reason': 'Host disconnected'}, room=code)
            end_session(code)
        
        import asyncio
        asyncio.create_task(end_after_grace())
    else:
        # Guest disconnected - remove normally
        leave_session(sid)
        await sio.emit('participant_left', {
            'sid': sid,
            'participants': get_participants(code)
        }, room=code)

@sio.event
async def create_session(sid, data):
    """Host creates a new session"""
    host_name = data.get('name', 'Host')
    session = create_new_session(sid, host_name)
    
    # Store host's initial grid settings and dimensions if provided
    if data.get('grid_settings'):
        session['grid_settings'] = data['grid_settings']
    if data.get('host_dimensions'):
        session['host_dimensions'] = data['host_dimensions']
    
    # Join the socket room
    await sio.enter_room(sid, session['code'])
    
    await sio.emit('session_created', {
        'code': session['code'],
        'host_name': host_name,
        'participants': get_participants(session['code'])
    }, to=sid)
    
    logger.info(f"Session created: {session['code']} by {host_name}")

@sio.event
async def rejoin_session(sid, data):
    """Host reconnects to an existing session after a brief disconnect"""
    code = data.get('code', '').upper()
    name = data.get('name', 'Host')
    is_host = data.get('is_host', False)
    
    session = get_session(code)
    if not session:
        # Session no longer exists
        await sio.emit('session_ended', {'reason': 'Session no longer exists'}, to=sid)
        return
    
    if is_host:
        # Update host SID to new one
        session['host_sid'] = sid
        session['host_disconnected'] = False
        session['host_name'] = name
        # Increment disconnect_version to invalidate any pending grace period tasks
        session['disconnect_version'] = session.get('disconnect_version', 0) + 1
        sid_to_session[sid] = code
        sid_to_user[sid] = {'name': name, 'is_host': True}
        
        # Join the socket room
        await sio.enter_room(sid, code)
        
        # Send current session state back to the host
        await sio.emit('session_joined', {
            'code': code,
            'host_name': session['host_name'],
            'participants': get_participants(code),
            'drawings': session['drawings'],
            'measurements': session['measurements'],
            'cliparts': session.get('cliparts', []),
            'bg_layers': session.get('bg_layers', []),
            'background_image': session.get('background_image'),
            'grid_settings': session.get('grid_settings', {}),
            'host_dimensions': session.get('host_dimensions', {'width': 1920, 'height': 1080}),
        }, to=sid)
        
        # Notify guests that host is back
        await sio.emit('participants_updated', {
            'participants': get_participants(code)
        }, room=code, skip_sid=sid)
        
        logger.info(f"Host {name} reconnected to session {code} with new SID {sid}")
    else:
        # Guest reconnecting - use normal join flow
        guest_session = join_session(code, sid, name)
        if guest_session:
            await sio.enter_room(sid, code)
            await sio.emit('session_joined', {
                'code': code,
                'host_name': session['host_name'],
                'participants': get_participants(code),
                'drawings': session['drawings'],
                'measurements': session['measurements'],
                'cliparts': session.get('cliparts', []),
            'bg_layers': session.get('bg_layers', []),
                'background_image': session.get('background_image'),
                'grid_settings': session.get('grid_settings', {}),
                'host_dimensions': session.get('host_dimensions', {'width': 1920, 'height': 1080}),
            }, to=sid)
            await sio.emit('participant_joined', {
                'sid': sid,
                'name': name,
                'participants': get_participants(code)
            }, room=code, skip_sid=sid)
            logger.info(f"Guest {name} reconnected to session {code}")


@sio.event
async def join_session_request(sid, data):
    """Guest requests to join a session"""
    code = data.get('code', '').upper()
    guest_name = data.get('name', 'Guest')
    
    logger.info(f"join_session_request: sid={sid}, code='{code}', name='{guest_name}'")
    
    session = join_session(code, sid, guest_name)
    
    if not session:
        logger.warning(f"join_session_request FAILED for code '{code}' by '{guest_name}' (sid={sid})")
        await sio.emit('join_error', {
            'message': 'Session not found or is full'
        }, to=sid)
        return
    
    # Join the socket room
    await sio.enter_room(sid, code)
    
    # Send current state to the new guest
    await sio.emit('session_joined', {
        'code': code,
        'host_name': session['host_name'],
        'participants': get_participants(code),
        'drawings': session['drawings'],
        'measurements': session['measurements'],
        'cliparts': session.get('cliparts', []),
        'bg_layers': session.get('bg_layers', []),
        'background_image': session.get('background_image'),
        'grid_settings': session.get('grid_settings', {}),
        'host_dimensions': session.get('host_dimensions', {'width': 1920, 'height': 1080}),
    }, to=sid)
    
    # Notify others
    await sio.emit('participant_joined', {
        'sid': sid,
        'name': guest_name,
        'participants': get_participants(code)
    }, room=code, skip_sid=sid)
    
    logger.info(f"Guest '{guest_name}' successfully joined session {code}")

@sio.event
async def end_session_request(sid, data):
    """Host ends the session"""
    code = sid_to_session.get(sid)
    if not code:
        return
    
    session = get_session(code)
    if not session or session['host_sid'] != sid:
        return
    
    # Notify all participants
    await sio.emit('session_ended', {'reason': 'Host ended the session'}, room=code)
    
    # End the session
    end_session(code)
    logger.info(f"Session {code} ended by host")

@sio.event
async def leave_session_request(sid, data):
    """Guest leaves the session"""
    code = leave_session(sid)
    if code:
        await sio.leave_room(sid, code)
        session = get_session(code)
        if session:
            await sio.emit('participant_left', {
                'sid': sid,
                'participants': get_participants(code)
            }, room=code)

@sio.event
async def draw_path(sid, data):
    """Broadcast a drawing path to all participants"""
    if is_blocked(sid):
        await sio.emit('action_blocked', {'message': 'You are blocked from drawing'}, to=sid)
        return
    
    code = sid_to_session.get(sid)
    if not code:
        return
    
    session = get_session(code)
    if not session:
        return
    
    # Add user info to the path
    user_info = sid_to_user.get(sid, {})
    path_data = {
        **data,
        'user_sid': sid,
        'user_name': user_info.get('name', 'Unknown'),
        'timestamp': datetime.now(timezone.utc).isoformat()
    }
    
    # Store the drawing
    session['drawings'].append(path_data)
    update_activity(code)
    
    # Broadcast to all in the room
    await sio.emit('draw_path', path_data, room=code, skip_sid=sid)

@sio.event
async def add_measurement(sid, data):
    """Broadcast a measurement to all participants"""
    if is_blocked(sid):
        await sio.emit('action_blocked', {'message': 'You are blocked from measuring'}, to=sid)
        return
    
    code = sid_to_session.get(sid)
    if not code:
        return
    
    session = get_session(code)
    if not session:
        return
    
    user_info = sid_to_user.get(sid, {})
    measurement_data = {
        **data,
        'user_sid': sid,
        'user_name': user_info.get('name', 'Unknown'),
        'timestamp': datetime.now(timezone.utc).isoformat()
    }
    
    session['measurements'].append(measurement_data)
    update_activity(code)
    
    await sio.emit('add_measurement', measurement_data, room=code, skip_sid=sid)

@sio.event
async def erase_at(sid, data):
    """Broadcast an erase action to all participants"""
    code = sid_to_session.get(sid)
    if not code:
        return
    
    session = get_session(code)
    if not session:
        return
    
    is_host = session['host_sid'] == sid
    
    # Block check only for non-hosts
    if not is_host and is_blocked(sid):
        await sio.emit('action_blocked', {'message': 'You are blocked from erasing'}, to=sid)
        return
    
    x = data.get('x')
    y = data.get('y')
    radius = data.get('radius', 20)
    
    # Host can erase all drawings, guests can only erase their own
    if is_host:
        # Host erases from all drawings
        session['drawings'] = [
            {**drawing, 'points': [
                p for p in drawing.get('points', [])
                if ((p.get('x', 0) - x) ** 2 + (p.get('y', 0) - y) ** 2) ** 0.5 > radius
            ]}
            for drawing in session['drawings']
            if len([p for p in drawing.get('points', []) if ((p.get('x', 0) - x) ** 2 + (p.get('y', 0) - y) ** 2) ** 0.5 > radius]) >= 2
        ]
    else:
        # Guest erases only their own drawings
        session['drawings'] = [
            {**drawing, 'points': [
                p for p in drawing.get('points', [])
                if drawing.get('user_sid') != sid or ((p.get('x', 0) - x) ** 2 + (p.get('y', 0) - y) ** 2) ** 0.5 > radius
            ]} if drawing.get('user_sid') == sid else drawing
            for drawing in session['drawings']
        ]
        session['drawings'] = [d for d in session['drawings'] if len(d.get('points', [])) >= 2]
    
    update_activity(code)
    
    # Broadcast erase action to ALL participants (including sender for sync)
    await sio.emit('erase_at', {
        'x': x,
        'y': y,
        'radius': radius,
        'user_sid': sid,
        'is_host': is_host
    }, room=code)

@sio.event
async def clear_all_drawings(sid, data):
    """Host clears all drawings"""
    code = sid_to_session.get(sid)
    if not code:
        return
    
    session = get_session(code)
    if not session:
        return
    
    # Only host can clear all
    if session['host_sid'] != sid:
        await sio.emit('action_blocked', {'message': 'Only host can clear all drawings'}, to=sid)
        return
    
    session['drawings'] = []
    session['measurements'] = []
    update_activity(code)
    
    # Broadcast to ALL including sender
    await sio.emit('clear_all_drawings', {}, room=code)

@sio.event
async def block_user(sid, data):
    """Host blocks/unblocks a guest"""
    code = sid_to_session.get(sid)
    if not code:
        return
    
    session = get_session(code)
    if not session or session['host_sid'] != sid:
        return
    
    guest_sid = data.get('guest_sid')
    blocked = data.get('blocked', True)
    
    if block_guest(code, guest_sid, blocked):
        # Notify the blocked user
        await sio.emit('block_status_changed', {
            'blocked': blocked,
            'message': 'You have been blocked by the host' if blocked else 'You have been unblocked'
        }, to=guest_sid)
        
        # Update participants list for everyone
        await sio.emit('participants_updated', {
            'participants': get_participants(code)
        }, room=code)

@sio.event
async def kick_user(sid, data):
    """Host kicks a guest from the session"""
    code = sid_to_session.get(sid)
    if not code:
        return
    
    session = get_session(code)
    if not session or session['host_sid'] != sid:
        return
    
    guest_sid = data.get('guest_sid')
    
    # Notify the kicked user
    await sio.emit('kicked', {'message': 'You have been removed from the session'}, to=guest_sid)
    
    # Remove from session
    leave_session(guest_sid)
    await sio.leave_room(guest_sid, code)
    
    # Update participants for everyone
    await sio.emit('participants_updated', {
        'participants': get_participants(code)
    }, room=code)

@sio.event
async def activity_ping(sid, data):
    """Client sends activity ping to prevent timeout"""
    code = sid_to_session.get(sid)
    if code:
        update_activity(code)

@sio.event
async def get_session_info(sid, data):
    """Get current session info"""
    code = data.get('code', '').upper()
    session = get_session(code)
    
    if session:
        await sio.emit('session_info', {
            'exists': True,
            'code': code,
            'host_name': session['host_name'],
            'guest_count': len(session['guests']),
            'max_guests': session['max_guests']
        }, to=sid)
    else:
        await sio.emit('session_info', {
            'exists': False,
            'code': code
        }, to=sid)


@sio.event
async def cursor_move(sid, data):
    """Broadcast cursor position to all participants"""
    code = sid_to_session.get(sid)
    if not code:
        return
    
    cursor_data = {
        'sid': sid,
        'x': data.get('x', 0),
        'y': data.get('y', 0),
        'name': data.get('name', 'Unknown'),
        'color': data.get('color', '#FFFFFF'),
        'clicking': data.get('clicking', False),  # Track if user is clicking
    }
    
    # Broadcast to all except sender (they don't need their own cursor)
    await sio.emit('cursor_move', cursor_data, room=code, skip_sid=sid)

@sio.event
async def cursor_leave(sid, data):
    """Notify others that cursor left"""
    code = sid_to_session.get(sid)
    if not code:
        return
    
    await sio.emit('cursor_leave', {'sid': sid}, room=code, skip_sid=sid)


@sio.event
async def live_measurement(sid, data):
    """Broadcast a measurement-in-progress visualization to other users"""
    code = sid_to_session.get(sid)
    if not code:
        return
    
    if is_blocked(sid):
        return
    
    user_info = sid_to_user.get(sid, {})
    live_data = {
        **data,
        'user_sid': sid,
        'user_name': user_info.get('name', 'Unknown'),
    }
    
    await sio.emit('live_measurement', live_data, room=code, skip_sid=sid)

@sio.event
async def clear_live_measurement(sid, data):
    """Clear a user's live measurement"""
    code = sid_to_session.get(sid)
    if not code:
        return
    
    await sio.emit('clear_live_measurement', {'user_sid': sid}, room=code, skip_sid=sid)

@sio.event
async def live_clipart_move(sid, data):
    """Broadcast real-time clipart drag position to other users (throttled on client)"""
    code = sid_to_session.get(sid)
    if not code:
        return
    
    if is_blocked(sid):
        return
    
    # Lightweight event - just forward position/scale/rotation
    await sio.emit('live_clipart_move', data, room=code, skip_sid=sid)

@sio.event
async def ping_location(sid, data):
    """Broadcast a 'ping' attention marker to all participants"""
    code = sid_to_session.get(sid)
    if not code:
        return
    
    if is_blocked(sid):
        return
    
    user_info = sid_to_user.get(sid, {})
    ping_data = {
        'x': data.get('x', 0),
        'y': data.get('y', 0),
        'user_sid': sid,
        'user_name': user_info.get('name', 'Unknown'),
        'color': data.get('color', '#FFD700'),
    }
    
    # Broadcast to ALL including sender so they see the ping too
    await sio.emit('ping_location', ping_data, room=code)

@sio.event
async def undo_drawing(sid, data):
    """Undo the last drawing path (only user's own)"""
    code = sid_to_session.get(sid)
    if not code:
        return
    
    session = get_session(code)
    if not session:
        return
    
    # Find and remove last drawing by this user
    for i in range(len(session['drawings']) - 1, -1, -1):
        if session['drawings'][i].get('user_sid') == sid:
            removed = session['drawings'].pop(i)
            # Store in undo stack
            if 'redo_stack' not in session:
                session['redo_stack'] = {}
            if sid not in session['redo_stack']:
                session['redo_stack'][sid] = []
            session['redo_stack'][sid].append(removed)
            
            await sio.emit('drawing_undone', {
                'user_sid': sid,
                'drawings': session['drawings'],
            }, room=code)
            break

@sio.event
async def redo_drawing(sid, data):
    """Redo the last undone drawing"""
    code = sid_to_session.get(sid)
    if not code:
        return
    
    session = get_session(code)
    if not session:
        return
    
    redo_stack = session.get('redo_stack', {}).get(sid, [])
    if not redo_stack:
        return
    
    restored = redo_stack.pop()
    session['drawings'].append(restored)
    
    await sio.emit('drawing_redone', {
        'user_sid': sid,
        'drawings': session['drawings'],
    }, room=code)

@sio.event
async def update_activity_status(sid, data):
    """Broadcast user's current activity status (drawing, measuring, idle)"""
    code = sid_to_session.get(sid)
    if not code:
        return
    
    user_info = sid_to_user.get(sid, {})
    await sio.emit('activity_status_updated', {
        'sid': sid,
        'name': user_info.get('name', 'Unknown'),
        'status': data.get('status', 'idle'),
    }, room=code, skip_sid=sid)


@sio.event
async def set_background_image(sid, data):
    """Host sets the shared background image"""
    code = sid_to_session.get(sid)
    if not code:
        return
    
    session = get_session(code)
    if not session:
        return
    
    # Only host can directly set background
    if session['host_sid'] != sid:
        await sio.emit('action_blocked', {'message': 'Only host can set background image'}, to=sid)
        return
    
    # Store the background image data
    session['background_image'] = {
        'data': data.get('data'),  # Base64 image data
        'scale': data.get('scale', 100),
        'x': data.get('x', 0),
        'y': data.get('y', 0),
        'rotation': data.get('rotation', 0),
        'tile': data.get('tile', False),
        'set_by': sid_to_user.get(sid, {}).get('name', 'Host'),
    }
    
    update_activity(code)
    
    # Broadcast to all participants
    await sio.emit('background_image_updated', session['background_image'], room=code)
    logger.info(f"Background image set in session {code}")


@sio.event
async def clear_background_image(sid, data):
    """Host clears the shared background image"""
    code = sid_to_session.get(sid)
    if not code:
        return
    
    session = get_session(code)
    if not session:
        return
    
    # Only host can clear background
    if session['host_sid'] != sid:
        await sio.emit('action_blocked', {'message': 'Only host can clear background image'}, to=sid)
        return
    
    session['background_image'] = None
    update_activity(code)
    
    # Notify all participants
    await sio.emit('background_image_cleared', {}, room=code)
    logger.info(f"Background image cleared in session {code}")


@sio.event
async def request_background_image(sid, data):
    """Guest requests to set their background image as the shared one"""
    code = sid_to_session.get(sid)
    if not code:
        return
    
    session = get_session(code)
    if not session:
        return
    
    # Check if blocked
    if is_blocked(sid):
        await sio.emit('action_blocked', {'message': 'You are blocked'}, to=sid)
        return
    
    user_info = sid_to_user.get(sid, {})
    request_data = {
        'requester_sid': sid,
        'requester_name': user_info.get('name', 'Guest'),
        'image_data': data.get('data'),
        'scale': data.get('scale', 100),
        'x': data.get('x', 0),
        'y': data.get('y', 0),
        'rotation': data.get('rotation', 0),
        'tile': data.get('tile', False),
    }
    
    # Store pending request
    session['pending_bg_requests'].append(request_data)
    
    # Notify host of the request
    await sio.emit('background_image_request', request_data, to=session['host_sid'])
    
    # Confirm to requester
    await sio.emit('background_request_sent', {'message': 'Request sent to host'}, to=sid)
    logger.info(f"Background image request from {user_info.get('name')} in session {code}")


@sio.event
async def respond_background_request(sid, data):
    """Host approves or denies a background image request"""
    code = sid_to_session.get(sid)
    if not code:
        return
    
    session = get_session(code)
    if not session:
        return
    
    # Only host can respond to requests
    if session['host_sid'] != sid:
        return
    
    requester_sid = data.get('requester_sid')
    approved = data.get('approved', False)
    
    # Find and remove the pending request
    request_data = None
    for req in session['pending_bg_requests']:
        if req['requester_sid'] == requester_sid:
            request_data = req
            break
    
    if not request_data:
        return
    
    session['pending_bg_requests'] = [r for r in session['pending_bg_requests'] if r['requester_sid'] != requester_sid]
    
    if approved:
        # Set the background image
        session['background_image'] = {
            'data': request_data['image_data'],
            'scale': request_data['scale'],
            'x': request_data['x'],
            'y': request_data['y'],
            'rotation': request_data['rotation'],
            'tile': request_data['tile'],
            'set_by': request_data['requester_name'],
        }
        
        # Broadcast to all participants
        await sio.emit('background_image_updated', session['background_image'], room=code)
        
        # Notify requester
        await sio.emit('background_request_approved', {'message': 'Your background image was approved'}, to=requester_sid)
        logger.info(f"Background request approved for {request_data['requester_name']} in session {code}")
    else:
        # Notify requester of denial
        await sio.emit('background_request_denied', {'message': 'Your background image request was denied'}, to=requester_sid)
        logger.info(f"Background request denied for {request_data['requester_name']} in session {code}")


# Clipart sync events
@sio.event
async def add_clipart(sid, data):
    """Add a clipart to the session"""
    if is_blocked(sid):
        await sio.emit('action_blocked', {'message': 'You are blocked'}, to=sid)
        return
    
    code = sid_to_session.get(sid)
    if not code:
        return
    
    session = get_session(code)
    if not session:
        return
    
    user_info = sid_to_user.get(sid, {})
    clipart_data = {
        **data,
        'user_sid': sid,
        'user_name': user_info.get('name', 'Unknown'),
        'added_at': datetime.now(timezone.utc).isoformat()
    }
    
    session['cliparts'].append(clipart_data)
    update_activity(code)
    
    # Broadcast to all EXCEPT sender (sender already added locally)
    await sio.emit('clipart_added', clipart_data, room=code, skip_sid=sid)
    logger.info(f"Clipart added by {user_info.get('name')} in session {code}")


@sio.event
async def update_clipart(sid, data):
    """Update a clipart's position, scale, or rotation"""
    code = sid_to_session.get(sid)
    if not code:
        return
    
    session = get_session(code)
    if not session:
        return
    
    instance_id = data.get('instanceId')
    if not instance_id:
        return
    
    # Find and update the clipart
    for clipart in session['cliparts']:
        if clipart.get('instanceId') == instance_id:
            # Only allow update by owner or host
            is_host = session['host_sid'] == sid
            is_owner = clipart.get('user_sid') == sid
            
            if not is_host and not is_owner:
                await sio.emit('action_blocked', {'message': 'You can only modify your own cliparts'}, to=sid)
                return
            
            if is_blocked(sid) and not is_host:
                await sio.emit('action_blocked', {'message': 'You are blocked'}, to=sid)
                return
            
            # Update clipart properties
            clipart['x'] = data.get('x', clipart.get('x'))
            clipart['y'] = data.get('y', clipart.get('y'))
            clipart['scale'] = data.get('scale', clipart.get('scale'))
            clipart['rotation'] = data.get('rotation', clipart.get('rotation'))
            break
    
    update_activity(code)
    
    # Broadcast to all EXCEPT sender (sender updates locally)
    await sio.emit('clipart_updated', data, room=code, skip_sid=sid)


@sio.event
async def remove_clipart(sid, data):
    """Remove a clipart from the session"""
    code = sid_to_session.get(sid)
    if not code:
        return
    
    session = get_session(code)
    if not session:
        return
    
    instance_id = data.get('instanceId')
    if not instance_id:
        return
    
    is_host = session['host_sid'] == sid
    
    # Find clipart and check permissions
    for clipart in session['cliparts']:
        if clipart.get('instanceId') == instance_id:
            is_owner = clipart.get('user_sid') == sid
            
            if not is_host and not is_owner:
                await sio.emit('action_blocked', {'message': 'You can only remove your own cliparts'}, to=sid)
                return
            
            if is_blocked(sid) and not is_host:
                await sio.emit('action_blocked', {'message': 'You are blocked'}, to=sid)
                return
            break
    
    # Remove the clipart
    session['cliparts'] = [c for c in session['cliparts'] if c.get('instanceId') != instance_id]
    update_activity(code)
    
    # Broadcast to all EXCEPT sender (sender removes locally)
    await sio.emit('clipart_removed', {'instanceId': instance_id}, room=code, skip_sid=sid)


@sio.event
async def clear_all_cliparts(sid, data):
    """Host clears all cliparts"""
    code = sid_to_session.get(sid)
    if not code:
        return
    
    session = get_session(code)
    if not session:
        return
    
    # Only host can clear all
    if session['host_sid'] != sid:
        await sio.emit('action_blocked', {'message': 'Only host can clear all cliparts'}, to=sid)
        return
    
    session['cliparts'] = []
    update_activity(code)
    
    # Broadcast to all
    await sio.emit('all_cliparts_cleared', {}, room=code)
    logger.info(f"All cliparts cleared in session {code}")


# ==================== GRID SETTINGS SYNC ====================

@sio.event
async def update_grid_settings(sid, data):
    """Host broadcasts grid settings to all guests"""
    code = sid_to_session.get(sid)
    if not code:
        return
    session = get_session(code)
    if not session:
        return
    # Only host can update grid settings
    if session['host_sid'] != sid:
        return
    session['grid_settings'] = data.get('settings', {})
    update_activity(code)
    # Broadcast to all guests (not host)
    await sio.emit('grid_settings_updated', {'settings': session['grid_settings']}, room=code, skip_sid=sid)


@sio.event
async def update_host_dimensions(sid, data):
    """Host broadcasts screen dimensions for ratio matching"""
    code = sid_to_session.get(sid)
    if not code:
        return
    session = get_session(code)
    if not session:
        return
    if session['host_sid'] != sid:
        return
    session['host_dimensions'] = {
        'width': data.get('width', 1920),
        'height': data.get('height', 1080),
    }
    # Broadcast to all guests
    await sio.emit('host_dimensions_updated', session['host_dimensions'], room=code, skip_sid=sid)


# ==================== HOST DELETE GUEST CONTENT ====================

@sio.event
async def remove_drawing(sid, data):
    """Host removes a specific drawing by index or timestamp"""
    code = sid_to_session.get(sid)
    if not code:
        return
    session = get_session(code)
    if not session:
        return
    # Only host can remove specific drawings
    if session['host_sid'] != sid:
        await sio.emit('action_blocked', {'message': 'Only host can delete drawings'}, to=sid)
        return
    drawing_index = data.get('index')
    if drawing_index is not None and 0 <= drawing_index < len(session.get('drawings', [])):
        session['drawings'].pop(drawing_index)
    update_activity(code)
    # Broadcast updated drawings to all
    await sio.emit('drawings_updated', {'drawings': session.get('drawings', [])}, room=code)


@sio.event
async def remove_measurement(sid, data):
    """Host removes a specific measurement"""
    code = sid_to_session.get(sid)
    if not code:
        return
    session = get_session(code)
    if not session:
        return
    if session['host_sid'] != sid:
        await sio.emit('action_blocked', {'message': 'Only host can delete measurements'}, to=sid)
        return
    measurement_id = data.get('id')
    if measurement_id:
        session['measurements'] = [m for m in session.get('measurements', []) if m.get('id') != measurement_id]
    update_activity(code)
    await sio.emit('measurements_updated', {'measurements': session.get('measurements', [])}, room=code)



# ==================== BACKGROUND LAYERS SYNC ====================

@sio.event
async def bg_layer_add(sid, data):
    """Host adds a background layer"""
    code = sid_to_session.get(sid)
    if not code:
        return
    session = get_session(code)
    if not session:
        return
    if session['host_sid'] != sid:
        await sio.emit('action_blocked', {'message': 'Only host can add background layers'}, to=sid)
        return
    if 'bg_layers' not in session:
        session['bg_layers'] = []
    if len(session['bg_layers']) >= 5:
        return
    session['bg_layers'].append(data)
    update_activity(code)
    await sio.emit('bg_layer_added', data, room=code, skip_sid=sid)


@sio.event
async def bg_layer_update(sid, data):
    """Update a background layer (position, scale, opacity, etc.)"""
    code = sid_to_session.get(sid)
    if not code:
        return
    session = get_session(code)
    if not session:
        return
    layer_id = data.get('id')
    updates = data.get('updates', {})
    if 'bg_layers' in session:
        for layer in session['bg_layers']:
            if layer.get('id') == layer_id:
                layer.update(updates)
                break
    update_activity(code)
    await sio.emit('bg_layer_updated', {'id': layer_id, 'updates': updates}, room=code, skip_sid=sid)


@sio.event
async def bg_layer_remove(sid, data):
    """Host removes a background layer"""
    code = sid_to_session.get(sid)
    if not code:
        return
    session = get_session(code)
    if not session:
        return
    if session['host_sid'] != sid:
        await sio.emit('action_blocked', {'message': 'Only host can remove layers'}, to=sid)
        return
    layer_id = data.get('id')
    if 'bg_layers' in session:
        session['bg_layers'] = [layer for layer in session['bg_layers'] if layer.get('id') != layer_id]
    update_activity(code)
    await sio.emit('bg_layer_removed', {'id': layer_id}, room=code, skip_sid=sid)


@sio.event
async def bg_layer_reorder(sid, data):
    """Host reorders background layers"""
    code = sid_to_session.get(sid)
    if not code:
        return
    session = get_session(code)
    if not session:
        return
    if session['host_sid'] != sid:
        return
    from_idx = data.get('fromIndex', 0)
    to_idx = data.get('toIndex', 0)
    if 'bg_layers' in session and 0 <= from_idx < len(session['bg_layers']):
        layers = session['bg_layers']
        moved = layers.pop(from_idx)
        layers.insert(to_idx, moved)
    update_activity(code)
    await sio.emit('bg_layers_reordered', {'fromIndex': from_idx, 'toIndex': to_idx}, room=code, skip_sid=sid)


@sio.event
async def bg_layers_clear_all(sid, data):
    """Host clears all background layers"""
    code = sid_to_session.get(sid)
    if not code:
        return
    session = get_session(code)
    if not session:
        return
    if session['host_sid'] != sid:
        return
    session['bg_layers'] = []
    update_activity(code)
    await sio.emit('bg_layers_all_cleared', {}, room=code)
