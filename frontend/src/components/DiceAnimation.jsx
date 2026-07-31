/**
 * DiceAnimation.jsx
 * 3D CSS tumbling dice animation that appears at the cursor position.
 * Shows all 6 faces rotating before settling on the rolled result.
 * Fades out after ~2.5 seconds. Multiple dice can stack.
 */
import { useState, useEffect, useRef } from 'react';

// Face dots layout for d6 faces 1-6
const FACE_DOTS = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 20], [75, 20], [25, 50], [75, 50], [25, 80], [75, 80]],
};

// CSS 3D face transforms for a cube
const FACE_TRANSFORMS = [
  'rotateY(0deg)   translateZ(40px)',  // front  = 1
  'rotateY(180deg) translateZ(40px)',  // back   = 6
  'rotateY(90deg)  translateZ(40px)',  // right  = 3
  'rotateY(-90deg) translateZ(40px)', // left   = 4
  'rotateX(90deg)  translateZ(40px)',  // top    = 5
  'rotateX(-90deg) translateZ(40px)', // bottom = 2
];

// Which face index shows which number (front=1, back=6, right=3, left=4, top=5, bottom=2)
const FACE_NUMBERS = [1, 6, 3, 4, 5, 2];

// Get the CSS rotation to land on a given result for d6
function getResultRotation(result) {
  const faceMap = { 1: 'rotateX(0deg) rotateY(0deg)', 6: 'rotateX(0deg) rotateY(180deg)', 3: 'rotateX(0deg) rotateY(-90deg)', 4: 'rotateX(0deg) rotateY(90deg)', 5: 'rotateX(-90deg) rotateY(0deg)', 2: 'rotateX(90deg) rotateY(0deg)' };
  // Add extra spins for drama
  const base = faceMap[result] || 'rotateX(0deg) rotateY(0deg)';
  return `rotateX(${720 + (result * 60)}deg) rotateY(${720 - (result * 45)}deg)`;
}

// Non-d6: show a simple polygon shape with the number
function SimplePolyDie({ sides, result, size = 80, color }) {
  const points = Array.from({ length: sides }, (_, i) => {
    const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
    const r = size * 0.42;
    return `${50 + r * Math.cos(angle)}%,${50 + r * Math.sin(angle)}%`;
  }).join(' ');

  const svgStyle = {
    position: 'absolute', inset: 0, width: '100%', height: '100%',
  };

  return (
    <div style={{ width: size, height: size, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg style={svgStyle} viewBox="0 0 100 100">
        <polygon points={points} fill={color} stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
      </svg>
      <span style={{
        position: 'absolute', fontSize: size * 0.35, fontWeight: 900,
        color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.8)',
        fontFamily: 'monospace', lineHeight: 1,
      }}>
        {result}
      </span>
    </div>
  );
}

// Single die animation (d6 = 3D cube, others = 2D polygon with flip)
function SingleDie({ sides, result, color = '#1e3a5f', delay = 0, size = 80 }) {
  const [phase, setPhase] = useState('rolling'); // rolling → landing → done
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    const landTimer = setTimeout(() => setPhase('landing'), 1200 + delay);
    const fadeTimer = setTimeout(() => setOpacity(0), 1900 + delay);
    return () => { clearTimeout(landTimer); clearTimeout(fadeTimer); };
  }, [delay]);

  if (sides === 6) {
    // True 3D cube
    const cubeStyle = {
      width: size, height: size,
      position: 'relative',
      transformStyle: 'preserve-3d',
      transition: phase === 'landing' ? 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none',
      transform: phase === 'rolling'
        ? `rotateX(${Date.now() % 720}deg) rotateY(${Date.now() % 360}deg)`
        : getResultRotation(result),
      animation: phase === 'rolling' ? 'diceRoll 0.15s linear infinite' : 'none',
    };

    return (
      <div style={{ ...cubeStyle, opacity, transition: `${cubeStyle.transition}, opacity 0.5s ease` }}>
        {FACE_TRANSFORMS.map((transform, i) => {
          const num = FACE_NUMBERS[i];
          const dots = FACE_DOTS[num] || [];
          return (
            <div key={i} style={{
              position: 'absolute', width: size, height: size,
              background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
              border: '2px solid rgba(255,255,255,0.4)',
              borderRadius: 8, backfaceVisibility: 'hidden',
              transform, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ position: 'relative', width: '80%', height: '80%' }}>
                {dots.map(([x, y], di) => (
                  <div key={di} style={{
                    position: 'absolute',
                    left: `${x}%`, top: `${y}%`,
                    transform: 'translate(-50%, -50%)',
                    width: size * 0.12, height: size * 0.12,
                    borderRadius: '50%',
                    background: num === result ? '#ffd700' : 'rgba(255,255,255,0.9)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
                  }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Non-d6: zoom + flip reveal
  const polyStyle = {
    opacity,
    transform: phase === 'rolling' ? 'scale(1.1) rotate(720deg)' : 'scale(1) rotate(0deg)',
    transition: phase === 'landing'
      ? 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.5s ease'
      : 'transform 0.1s linear, opacity 0.5s ease',
    animation: phase === 'rolling' ? 'diceSpin 0.12s linear infinite' : 'none',
  };

  return (
    <div style={polyStyle}>
      <SimplePolyDie sides={sides} result={result} size={size} color={color} />
    </div>
  );
}

// The result bubble that fades in after dice settle
function ResultBubble({ total, modifier, type, user, color }) {
  const [visible, setVisible] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), 1400);
    const hideTimer = setTimeout(() => setGone(true), 2800);
    return () => { clearTimeout(showTimer); clearTimeout(hideTimer); };
  }, []);

  if (gone) return null;

  return (
    <div style={{
      position: 'absolute', bottom: -48, left: '50%', transform: 'translateX(-50%)',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.3s ease',
      whiteSpace: 'nowrap',
      textAlign: 'center',
      pointerEvents: 'none',
    }}>
      <div style={{
        background: 'rgba(0,0,0,0.85)', border: `2px solid ${color}`,
        borderRadius: 8, padding: '4px 12px',
        color: '#fff', fontFamily: 'monospace',
      }}>
        <span style={{ color, fontWeight: 900, fontSize: 18 }}>{total}</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginLeft: 4 }}>
          {type}{modifier !== 0 ? ` ${modifier > 0 ? '+' : ''}${modifier}` : ''}
        </span>
      </div>
      {user && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{user}</div>
      )}
    </div>
  );
}

// A complete dice roll event placed at cursor position
function DiceRollEvent({ event, onDone }) {
  const { x, y, rolls, total, modifier, type, sides, user, color } = event;
  const [alive, setAlive] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => { setAlive(false); onDone?.(event.id); }, 3200);
    return () => clearTimeout(timer);
  }, [event.id, onDone]);

  if (!alive) return null;

  // Layout multiple dice in a row
  const dieSize = Math.max(50, Math.min(80, 180 / (rolls.length || 1)));
  const totalW = rolls.length * (dieSize + 8);
  const dieColor = color || '#1e3a5f';

  return (
    <div style={{
      position: 'fixed',
      left: x - totalW / 2,
      top: y - dieSize / 2 - 20,
      zIndex: 99999,
      pointerEvents: 'none',
      display: 'flex',
      gap: 8,
      perspective: 600,
    }}>
      <div style={{ position: 'relative', display: 'flex', gap: 8 }}>
        {rolls.map((roll, i) => (
          <SingleDie
            key={i}
            sides={sides || 6}
            result={roll}
            color={dieColor}
            size={dieSize}
            delay={i * 80}
          />
        ))}
        <ResultBubble
          total={total}
          modifier={modifier}
          type={type}
          user={user}
          color={dieColor}
        />
      </div>
    </div>
  );
}

// CSS keyframes injected once
const KEYFRAMES = `
  @keyframes diceRoll {
    0%   { transform: rotateX(0deg)   rotateY(0deg); }
    25%  { transform: rotateX(90deg)  rotateY(120deg); }
    50%  { transform: rotateX(180deg) rotateY(240deg); }
    75%  { transform: rotateX(270deg) rotateY(360deg); }
    100% { transform: rotateX(360deg) rotateY(480deg); }
  }
  @keyframes diceSpin {
    from { transform: scale(1.1) rotate(0deg); }
    to   { transform: scale(1.1) rotate(360deg); }
  }
`;

// Manager: listens for roll events and renders them
export function DiceAnimationLayer() {
  const [events, setEvents] = useState([]);
  const [cursorPos, setCursorPos] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  // Track cursor position globally
  useEffect(() => {
    const handler = (e) => setCursorPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  // Listen for custom dice roll events dispatched from DiceRollerPanel
  useEffect(() => {
    const handler = (e) => {
      const roll = e.detail;
      setEvents(prev => [...prev, {
        ...roll,
        id: `roll_${Date.now()}_${Math.random()}`,
        x: cursorPos.x,
        y: cursorPos.y,
        color: getDieColor(roll.sides),
      }]);
    };
    window.addEventListener('krajden_dice_roll', handler);
    return () => window.removeEventListener('krajden_dice_roll', handler);
  }, [cursorPos]);

  const handleDone = (id) => {
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  if (!events.length) return null;

  return (
    <>
      <style>{KEYFRAMES}</style>
      {events.map(event => (
        <DiceRollEvent key={event.id} event={event} onDone={handleDone} />
      ))}
    </>
  );
}

function getDieColor(sides) {
  const colors = { 4: '#7c3aed', 6: '#1d4ed8', 8: '#0f766e', 10: '#b45309', 12: '#9f1239', 20: '#166534', 100: '#6b21a8' };
  return colors[sides] || '#1e3a5f';
}

// Helper to dispatch a roll from DiceRollerPanel
export function dispatchDiceRoll(rollData) {
  window.dispatchEvent(new CustomEvent('krajden_dice_roll', { detail: rollData }));
}

export default DiceAnimationLayer;
