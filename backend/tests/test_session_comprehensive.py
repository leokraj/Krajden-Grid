"""
Comprehensive Session Tests for OverGrid Collaborative Sessions
Tests: Create, Join, Invalid code, Grace period, Reconnection, Race conditions, Concurrent joins
"""
import pytest
import asyncio
import socketio
import os
import requests

# Use external URL for testing
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://session-sync-debug.preview.emergentagent.com').rstrip('/')
SIO_URL = BASE_URL  # Socket.IO server URL
SIO_PATH = "/api/socket.io/"


class TestDebugEndpoint:
    """Test the debug/sessions endpoint"""
    
    def test_debug_sessions_endpoint_returns_200(self):
        """GET /api/debug/sessions should return 200 with session info"""
        response = requests.get(f"{BASE_URL}/api/debug/sessions")
        assert response.status_code == 200
        data = response.json()
        assert "active_sessions" in data
        assert "count" in data
        print(f"Debug endpoint: {data['count']} active sessions")


class TestSessionCreation:
    """Test session creation via WebSocket"""
    
    @pytest.mark.asyncio
    async def test_create_session_returns_valid_code(self):
        """Create session should return session_created event with valid 6-char code"""
        client = socketio.AsyncClient()
        result = {}
        
        @client.on('session_created')
        def on_created(data):
            result['code'] = data.get('code')
            result['host_name'] = data.get('host_name')
            result['participants'] = data.get('participants')
        
        await client.connect(SIO_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
        await client.emit('create_session', {'name': 'TestHost'})
        await asyncio.sleep(1)
        
        assert 'code' in result, "session_created event not received"
        assert len(result['code']) == 6, f"Session code should be 6 chars, got {len(result['code'])}"
        assert result['host_name'] == 'TestHost'
        assert result['participants']['host']['name'] == 'TestHost'
        
        print(f"Session created: {result['code']}")
        await client.disconnect()


class TestSessionJoin:
    """Test joining sessions"""
    
    @pytest.mark.asyncio
    async def test_join_existing_session_success(self):
        """Join an existing session should receive session_joined event with session data"""
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
            guest_result['code'] = data['code']
            guest_result['host_name'] = data['host_name']
            guest_result['participants'] = data['participants']
        
        @guest.on('join_error')
        def on_error(data):
            guest_result['error'] = data['message']
        
        # Host creates session
        await host.connect(SIO_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
        await host.emit('create_session', {'name': 'TestHost'})
        await asyncio.sleep(1)
        
        code = host_result.get('code')
        assert code, "Session not created"
        
        # Guest joins
        await guest.connect(SIO_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
        await guest.emit('join_session_request', {'code': code, 'name': 'TestGuest'})
        await asyncio.sleep(1)
        
        assert guest_result.get('joined'), f"Guest did not join. Error: {guest_result.get('error')}"
        assert guest_result['code'] == code
        assert guest_result['host_name'] == 'TestHost'
        assert len(guest_result['participants']['guests']) == 1
        
        print(f"Guest joined session {code}")
        await host.disconnect()
        await guest.disconnect()
    
    @pytest.mark.asyncio
    async def test_join_invalid_code_returns_error(self):
        """Joining with invalid/nonexistent code should return join_error"""
        client = socketio.AsyncClient()
        result = {}
        
        @client.on('session_joined')
        def on_joined(data):
            result['joined'] = True
        
        @client.on('join_error')
        def on_error(data):
            result['error'] = data['message']
        
        await client.connect(SIO_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
        await client.emit('join_session_request', {'code': 'ZZZZZZ', 'name': 'TestGuest'})
        await asyncio.sleep(1)
        
        assert 'error' in result, "Expected join_error for invalid code"
        assert 'not found' in result['error'].lower() or 'full' in result['error'].lower()
        
        print(f"Correctly got error for invalid code: {result['error']}")
        await client.disconnect()


class TestGracePeriod:
    """Test session persistence during host disconnect grace period"""
    
    @pytest.mark.asyncio
    async def test_guest_joins_during_host_disconnect_grace_period(self):
        """Guest should be able to join during 5-minute grace period after host disconnects"""
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
        
        # Host creates then disconnects
        await host.connect(SIO_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
        await host.emit('create_session', {'name': 'TestHost'})
        await asyncio.sleep(1)
        
        code = host_result.get('code')
        assert code, "Session not created"
        print(f"Session {code} created, host disconnecting...")
        
        await host.disconnect()
        await asyncio.sleep(1)
        
        # Guest joins during grace period
        await guest.connect(SIO_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
        await guest.emit('join_session_request', {'code': code, 'name': 'TestGuest'})
        await asyncio.sleep(1)
        
        assert guest_result.get('joined'), f"Guest should join during grace period. Error: {guest_result.get('error')}"
        
        print(f"Guest successfully joined during grace period")
        await guest.disconnect()


class TestHostReconnection:
    """Test host reconnection scenarios"""
    
    @pytest.mark.asyncio
    async def test_host_reconnect_then_guest_joins(self):
        """After host reconnects via rejoin_session, guests should be able to join"""
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
        await host1.connect(SIO_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
        await host1.emit('create_session', {'name': 'TestHost'})
        await asyncio.sleep(1)
        
        code = host_result.get('code')
        assert code, "Session not created"
        
        # Host disconnects (simulating page refresh)
        print(f"Session {code}: Host disconnecting...")
        await host1.disconnect()
        await asyncio.sleep(1)
        
        # Host reconnects with rejoin_session
        print("Host reconnecting...")
        await host2.connect(SIO_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
        await host2.emit('rejoin_session', {'code': code, 'name': 'TestHost', 'is_host': True})
        await asyncio.sleep(1)
        
        assert host2_result.get('rejoined'), "Host rejoin not confirmed"
        print("Host successfully rejoined")
        
        # Guest joins
        await guest.connect(SIO_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
        await guest.emit('join_session_request', {'code': code, 'name': 'TestGuest'})
        await asyncio.sleep(1)
        
        assert guest_result.get('joined'), f"Guest should join after host reconnect. Error: {guest_result.get('error')}"
        
        print("Guest successfully joined after host reconnect")
        await host2.disconnect()
        await guest.disconnect()


class TestRaceConditions:
    """Test race condition scenarios with multiple host disconnects"""
    
    @pytest.mark.asyncio
    async def test_multiple_host_disconnects_reconnects_session_survives(self):
        """Session should survive multiple rapid host disconnects/reconnects"""
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
        
        # Host creates session
        await host1.connect(SIO_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
        await host1.emit('create_session', {'name': 'TestHost'})
        await asyncio.sleep(1)
        
        code = host_result.get('code')
        assert code
        print(f"Session {code} created")
        
        # Host disconnect 1
        await host1.disconnect()
        await asyncio.sleep(0.5)
        
        # Host reconnect briefly
        await host2.connect(SIO_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
        await host2.emit('rejoin_session', {'code': code, 'name': 'TestHost', 'is_host': True})
        await asyncio.sleep(0.5)
        
        # Host disconnect 2
        await host2.disconnect()
        await asyncio.sleep(0.5)
        
        # Host reconnect final
        await host3.connect(SIO_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
        await host3.emit('rejoin_session', {'code': code, 'name': 'TestHost', 'is_host': True})
        await asyncio.sleep(1)
        
        assert host3_result.get('rejoined'), "Final host rejoin failed"
        
        # Guest joins
        await guest.connect(SIO_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
        await guest.emit('join_session_request', {'code': code, 'name': 'TestGuest'})
        await asyncio.sleep(1)
        
        assert guest_result.get('joined'), f"Guest should join after multiple host reconnects. Error: {guest_result.get('error')}"
        
        print("Session survived multiple host disconnects/reconnects")
        await host3.disconnect()
        await guest.disconnect()


class TestConcurrentJoins:
    """Test concurrent guest join scenarios"""
    
    @pytest.mark.asyncio
    async def test_multiple_guests_join_concurrently(self):
        """Multiple guests joining simultaneously should all succeed"""
        host = socketio.AsyncClient()
        guests = []
        results = {}
        
        host_result = {}
        
        @host.on('session_created')
        def on_created(data):
            host_result['code'] = data['code']
        
        await host.connect(SIO_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
        await host.emit('create_session', {'name': 'TestHost'})
        await asyncio.sleep(1)
        
        code = host_result.get('code')
        assert code
        print(f"Session {code} created, testing concurrent joins...")
        
        # Create 4 guests
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
            await g.connect(SIO_URL, socketio_path=SIO_PATH, transports=['polling', 'websocket'])
        
        # All join at roughly the same time
        for i, g in enumerate(guests):
            await g.emit('join_session_request', {'code': code, 'name': f'Guest{i}'})
        
        await asyncio.sleep(2)
        
        joined_count = sum(1 for v in results.values() if v == 'joined')
        errors = [v for v in results.values() if v != 'joined']
        
        print(f"Concurrent joins: {joined_count}/4 succeeded, errors: {errors}")
        
        assert joined_count == 4, f"All 4 guests should join concurrently, only {joined_count} joined"
        
        for g in guests:
            await g.disconnect()
        await host.disconnect()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
