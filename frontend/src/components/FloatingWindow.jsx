import { useState, useEffect, useRef } from 'react';
import { X, Minimize2, GripHorizontal } from 'lucide-react';

export const FloatingWindow = ({ 
  title, 
  onClose, 
  onDock, 
  initialPosition = { x: 420, y: 150 }, 
  width = '320px', 
  children,
  dataTestId
}) => {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const windowRef = useRef(null);

  const handleMouseDown = (e) => {
    if (e.target.closest('.drag-handle-window')) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
      e.preventDefault();
    }
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        // Constrain to viewport boundaries
        const newX = Math.max(10, Math.min(window.innerWidth - 100, e.clientX - dragOffset.x));
        const newY = Math.max(10, Math.min(window.innerHeight - 100, e.clientY - dragOffset.y));
        setPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  return (
    <div
      ref={windowRef}
      className="fixed z-[9998] glass-panel rounded-sm shadow-2xl overflow-hidden select-none"
      style={{ 
        left: `${position.x}px`, 
        top: `${position.y}px`, 
        width,
        border: '1px solid rgba(195, 163, 90, 0.2)'
      }}
      data-testid={dataTestId}
    >
      {/* Window Header */}
      <div 
        onMouseDown={handleMouseDown}
        className="drag-handle-window flex items-center justify-between px-3 py-2 bg-black/40 border-b border-[#c3a35a]/15 cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-3.5 h-3.5 text-[#c3a35a]/60" />
          <span className="font-playfair text-[11px] font-bold tracking-[0.15em] text-white uppercase truncate">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {onDock && (
            <button
              onClick={onDock}
              className="p-1 hover:bg-white/5 rounded-sm text-gray-400 hover:text-[#c3a35a] transition-colors"
              title="Dock Panel"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/5 rounded-sm text-gray-400 hover:text-red-400 transition-colors"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Window Body */}
      <div className="p-4 max-h-[70vh] overflow-y-auto bg-black/20">
        {children}
      </div>
    </div>
  );
};

export default FloatingWindow;
