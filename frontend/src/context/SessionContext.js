import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

const SessionContext = createContext(null);

export const SessionProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [sessionCode, setSessionCode] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [userName, setUserName] = useState('');
  const [error, setError] = useState(null);
  const [showMyCursor, setShowMyCursor] = useState(true);

  // Participant list: { host: { sid, name }, guests: [ { sid, name, blocked } ] }
  const [participants, setParticipants] = useState({ host: null, guests: [] });

  // Collaborative Room States
  const [remoteDrawings, setRemoteDrawings] = useState([]);
  const [remoteMeasurements, setRemoteMeasurements] = useState([]);
  const [remoteCliparts, setRemoteCliparts] = useState([]);
  const [remoteBgLayers, setRemoteBgLayers] = useState([]);
  const [sessionBackgroundImage, setSessionBackgroundImage] = useState(null);
  const [remoteGridSettings, setRemoteGridSettings] = useState({});
  const [hostDimensions, setHostDimensions] = useState({ width: 1920, height: 1080 });

  // VTT States
  const [diceRolls, setDiceRolls] = useState([]);
  const [initiativeList, setInitiativeList] = useState([]);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(-1);

  // Transient real-time events
  const [remoteCursors, setRemoteCursors] = useState({});
  const [cursorTrails, setCursorTrails] = useState({});
  const [pingMarkers, setPingMarkers] = useState([]);
  const [remoteLiveMeasurements, setRemoteLiveMeasurements] = useState({});
  const [remoteLiveClipartMoves, setRemoteLiveClipartMoves] = useState({});
  const [lastEraseEvent, setLastEraseEvent] = useState(null);
  const [clearAllEvent, setClearAllEvent] = useState(null);
  const [activityStatuses, setActivityStatuses] = useState({});

  // Background image requests from guests
  const [pendingBgRequest, setPendingBgRequest] = useState(null);

  // Inactivity warning state
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [warningCountdown, setWarningCountdown] = useState(60);

  const socketRef = useRef(null);
  const inactivityTimerRef = useRef(null);

  // Setup Socket connection
  useEffect(() => {
    // Connect to same host/port under /api/socket.io/ path
    const backendUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin;
    const socket = io(backendUrl, {
      path: '/api/socket.io/',
      autoConnect: false,
      reconnection: true
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setError(null);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('session_created', (data) => {
      setSessionCode(data.code);
      setIsHost(true);
      setParticipants(data.participants);
    });

    socket.on('session_joined', (data) => {
      setSessionCode(data.code);
      setIsHost(false);
      setParticipants(data.participants);
      setRemoteDrawings(data.drawings || []);
      setRemoteMeasurements(data.measurements || []);
      setRemoteCliparts(data.cliparts || []);
      setRemoteBgLayers(data.bg_layers || []);
      setSessionBackgroundImage(data.background_image);
      setRemoteGridSettings(data.grid_settings || {});
      setHostDimensions(data.host_dimensions || { width: 1920, height: 1080 });
      setDiceRolls(data.dice_rolls || []);
      setInitiativeList(data.initiative_list || []);
      setCurrentTurnIndex(data.current_turn_index !== undefined ? data.current_turn_index : -1);
    });

    socket.on('session_error', (data) => {
      setError(data.message);
      socket.disconnect();
    });

    socket.on('participants_updated', (data) => {
      setParticipants(data);
    });

    socket.on('host_status_changed', (data) => {
      if (data.host_disconnected) {
        setError("Host has disconnected. Waiting for host to return...");
      } else {
        setError(null);
      }
    });

    socket.on('session_ended', (data) => {
      setError(data.reason);
      setSessionCode(null);
      setIsHost(false);
      socket.disconnect();
    });

    // Real-time canvas sync listeners
    socket.on('draw_path', (path) => {
      setRemoteDrawings((prev) => [...prev, path]);
    });

    socket.on('erase_at', (data) => {
      setLastEraseEvent(data);
    });

    socket.on('clear_all_drawings', () => {
      setRemoteDrawings([]);
      setClearAllEvent(Date.now());
    });

    socket.on('undo_drawing', () => {
      setRemoteDrawings((prev) => prev.slice(0, -1));
    });

    socket.on('add_measurement', (m) => {
      setRemoteMeasurements((prev) => [...prev, m]);
    });

    socket.on('remove_measurement', (data) => {
      setRemoteMeasurements((prev) => prev.filter((m) => m.id !== data.id));
    });

    socket.on('live_measurement', (data) => {
      setRemoteLiveMeasurements((prev) => ({
        ...prev,
        [data.sid]: data
      }));
    });

    socket.on('clear_live_measurement', (data) => {
      setRemoteLiveMeasurements((prev) => {
        const next = { ...prev };
        delete next[data.sid];
        return next;
      });
    });

    // Clipart sync listeners
    socket.on('add_clipart', (clipart) => {
      setRemoteCliparts((prev) => [...prev, clipart]);
    });

    socket.on('update_clipart', (data) => {
      setRemoteCliparts((prev) =>
        prev.map((c) => (c.id === data.id ? { ...c, ...data } : c))
      );
    });

    socket.on('remove_clipart', (data) => {
      setRemoteCliparts((prev) => prev.filter((c) => c.id !== data.id));
    });

    socket.on('live_clipart_move', (data) => {
      setRemoteLiveClipartMoves((prev) => ({
        ...prev,
        [data.instanceId]: data
      }));
    });

    // Background layer / image sync listeners
    socket.on('background_image_updated', (data) => {
      setSessionBackgroundImage(data);
    });

    socket.on('background_image_cleared', () => {
      setSessionBackgroundImage(null);
    });

    socket.on('grid_settings_updated', (data) => {
      setRemoteGridSettings(data.settings || {});
    });

    // Cursor tracking
    socket.on('cursor_moved', (data) => {
      setRemoteCursors((prev) => ({
        ...prev,
        [data.sid]: data
      }));
      // Build trails
      setCursorTrails((prev) => {
        const list = prev[data.sid] || [];
        const nextList = [...list, { x: data.x, y: data.y, t: Date.now() }].slice(-10);
        return { ...prev, [data.sid]: nextList };
      });
    });

    socket.on('cursor_left', (data) => {
      setRemoteCursors((prev) => {
        const next = { ...prev };
        delete next[data.sid];
        return next;
      });
    });

    socket.on('location_pinged', (data) => {
      const ping = {
        id: "ping_" + Date.now() + "_" + Math.random(),
        x: data.x,
        y: data.y,
        name: data.name,
        color: data.color || '#FF4444'
      };
      setPingMarkers((prev) => [...prev, ping]);
      setTimeout(() => {
        setPingMarkers((prev) => prev.filter((p) => p.id !== ping.id));
      }, 3000);
    });

    socket.on('dice_rolled', (roll) => {
      setDiceRolls((prev) => [...prev, roll].slice(-50));
    });

    socket.on('dice_rolls_cleared', () => {
      setDiceRolls([]);
    });

    socket.on('initiative_updated', (data) => {
      setInitiativeList(data.initiative_list || []);
      setCurrentTurnIndex(data.current_turn_index !== undefined ? data.current_turn_index : -1);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Inactivity tracking
  const resetInactivityTimer = useCallback(() => {
    if (isHost) return; // Hosts don't timeout
    setShowInactivityWarning(false);
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(() => {
      setShowInactivityWarning(true);
      setWarningCountdown(60);
    }, 15 * 60 * 1000); // 15 mins
  }, [isHost]);

  useEffect(() => {
    resetInactivityTimer();
    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [resetInactivityTimer]);

  const leaveSession = useCallback(() => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('leave_session_request', { code: sessionCode });
      socketRef.current.disconnect();
    }
    setSessionCode(null);
    setIsHost(false);
    setParticipants({ host: null, guests: [] });
    setRemoteDrawings([]);
    setRemoteMeasurements([]);
    setRemoteCliparts([]);
    setRemoteBgLayers([]);
    setSessionBackgroundImage(null);
    setRemoteCursors({});
    setCursorTrails({});
    setRemoteLiveMeasurements({});
    setRemoteLiveClipartMoves({});
    setRemoteGridSettings(null);
    setHostDimensions(null);
    setBlockList([]);
    setIsBlocked(false);
  }, [sessionCode]);

  useEffect(() => {
    if (!showInactivityWarning) return;
    const interval = setInterval(() => {
      setWarningCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          leaveSession();
          setError("Disconnected due to inactivity");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showInactivityWarning, leaveSession]);

  const continueSession = useCallback(() => {
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  // Methods
  const createSession = useCallback((name, gridSettings = {}, hostDims = { width: 1920, height: 1080 }) => {
    setUserName(name);
    if (!socketRef.current.connected) {
      socketRef.current.connect();
    }
    // Socket connect runs async, listen on connection or emit directly if connected
    const run = () => {
      socketRef.current.emit('create_session', { name });
      socketRef.current.emit('update_grid_settings', { settings: gridSettings });
      socketRef.current.emit('update_host_dimensions', hostDims);
    };
    if (socketRef.current.connected) run();
    else socketRef.current.once('connect', run);
  }, []);

  const joinSession = useCallback((code, name) => {
    setUserName(name);
    if (!socketRef.current.connected) {
      socketRef.current.connect();
    }
    const run = () => {
      socketRef.current.emit('join_session_request', { code, name });
    };
    if (socketRef.current.connected) run();
    else socketRef.current.once('connect', run);
  }, []);

  const blockUser = useCallback((sid) => {
    // Unimplemented in standard schema but we provide stub
  }, []);

  const kickUser = useCallback((sid) => {
    if (socketRef.current && isHost) {
      socketRef.current.emit('kick_user', { sid });
    }
  }, [isHost]);

  const getShareableLink = useCallback(() => {
    if (!sessionCode) return '';
    const baseUrl = process.env.REACT_APP_WEB_URL || window.location.origin;
    return `${baseUrl}/join?code=${sessionCode}`;
  }, [sessionCode]);

  const broadcastDrawPath = useCallback((path) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('draw_path', path);
    }
  }, []);

  const broadcastMeasurement = useCallback((m) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('add_measurement', m);
    }
  }, []);

  const broadcastErase = useCallback((x, y, radius) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('erase_at', { x, y, radius });
    }
  }, []);

  const broadcastClearAll = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('clear_all_drawings', {});
    }
  }, []);

  const broadcastCursor = useCallback((x, y, visible = true) => {
    if (socketRef.current?.connected && showMyCursor) {
      socketRef.current.emit('cursor_move', { x, y, visible });
    }
  }, [showMyCursor]);

  const hideCursor = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('cursor_leave');
    }
  }, []);

  const broadcastBackgroundImage = useCallback((data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('set_background_image', data);
    }
  }, []);

  const clearSessionBackground = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('clear_background_image', {});
    }
  }, []);

  const requestBackgroundImage = useCallback(() => {}, []);
  const respondToBackgroundRequest = useCallback(() => {}, []);
  const dismissBgRequest = useCallback(() => {}, []);

  const broadcastAddClipart = useCallback((clipart) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('add_clipart', clipart);
    }
  }, []);

  const broadcastUpdateClipart = useCallback((data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('update_clipart', data);
    }
  }, []);

  const broadcastRemoveClipart = useCallback((instanceId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('remove_clipart', { id: instanceId });
    }
  }, []);

  const broadcastClearAllCliparts = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('clear_all_cliparts', {});
    }
  }, []);

  const broadcastBgLayerAdd = useCallback(() => {}, []);
  const broadcastBgLayerUpdate = useCallback(() => {}, []);
  const broadcastBgLayerRemove = useCallback(() => {}, []);
  const broadcastBgLayerReorder = useCallback(() => {}, []);
  const broadcastBgLayersClearAll = useCallback(() => {}, []);

  const broadcastLiveMeasurement = useCallback((lm) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('live_measurement', lm);
    }
  }, []);

  const clearLiveMeasurement = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('clear_live_measurement', {});
    }
  }, []);

  const broadcastLiveClipartMove = useCallback((data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('live_clipart_move', data);
    }
  }, []);

  const broadcastPing = useCallback((x, y) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('ping_location', { x, y });
    }
  }, []);

  const broadcastRollDice = useCallback((rollData) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('roll_dice', rollData);
    }
  }, []);

  const broadcastUpdateInitiative = useCallback((list, turnIndex) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('update_initiative', { initiative_list: list, current_turn_index: turnIndex });
    }
  }, []);

  const broadcastClearDiceRolls = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('clear_dice_rolls');
    }
  }, []);

  const broadcastUndoDrawing = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('undo_drawing', {});
    }
  }, []);

  const broadcastRedoDrawing = useCallback(() => {}, []);
  const broadcastActivityStatus = useCallback(() => {}, []);
  const broadcastGridSettings = useCallback((settings) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('update_grid_settings', { settings });
    }
  }, []);

  const broadcastHostDimensions = useCallback(() => {}, []);
  const broadcastRemoveDrawing = useCallback(() => {}, []);
  const broadcastRemoveMeasurement = useCallback(() => {}, []);

  const value = {
    isConnected,
    sessionCode,
    isHost,
    isBlocked,
    participants,
    userName,
    error,
    showMyCursor,
    setShowMyCursor,
    showInactivityWarning,
    warningCountdown,
    continueSession,
    createSession,
    joinSession,
    leaveSession,
    blockUser,
    kickUser,
    getShareableLink,
    broadcastDrawPath,
    broadcastMeasurement,
    broadcastErase,
    broadcastClearAll,
    broadcastCursor,
    hideCursor,
    sessionBackgroundImage,
    pendingBgRequest,
    broadcastBackgroundImage,
    clearSessionBackground,
    requestBackgroundImage,
    respondToBackgroundRequest,
    dismissBgRequest,
    remoteCliparts,
    remoteBgLayers,
    broadcastAddClipart,
    broadcastUpdateClipart,
    broadcastRemoveClipart,
    broadcastClearAllCliparts,
    broadcastBgLayerAdd,
    broadcastBgLayerUpdate,
    broadcastBgLayerRemove,
    broadcastBgLayerReorder,
    broadcastBgLayersClearAll,
    remoteLiveMeasurements,
    remoteLiveClipartMoves,
    broadcastLiveMeasurement,
    clearLiveMeasurement,
    broadcastLiveClipartMove,
    cursorTrails,
    pingMarkers,
    broadcastPing,
    diceRolls,
    initiativeList,
    currentTurnIndex,
    broadcastRollDice,
    broadcastUpdateInitiative,
    broadcastClearDiceRolls,
    broadcastUndoDrawing,
    broadcastRedoDrawing,
    activityStatuses,
    broadcastActivityStatus,
    remoteGridSettings,
    broadcastGridSettings,
    hostDimensions,
    broadcastHostDimensions,
    broadcastRemoveDrawing,
    broadcastRemoveMeasurement,
    remoteDrawings,
    remoteMeasurements,
    remoteCursors,
    lastEraseEvent,
    clearAllEvent,
    resetInactivityTimer
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
};

export default SessionContext;
