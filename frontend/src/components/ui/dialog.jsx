import React, { createContext, useContext, useState } from 'react';

const DialogContext = createContext(null);

export const Dialog = ({ children, open, onOpenChange, ...props }) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open !== undefined ? open : internalOpen;
  const setIsOpen = onOpenChange !== undefined ? onOpenChange : setInternalOpen;
  
  return (
    <DialogContext.Provider value={{ isOpen, setIsOpen }}>
      {children}
    </DialogContext.Provider>
  );
};

export const DialogTrigger = ({ asChild, children, ...props }) => {
  const { setIsOpen } = useContext(DialogContext);
  
  // If asChild, clone the child and attach onClick, otherwise wrap in button
  if (asChild) {
    return React.cloneElement(children, {
      onClick: (e) => {
        if (children.props.onClick) children.props.onClick(e);
        setIsOpen(true);
      }
    });
  }

  return (
    <button type="button" onClick={() => setIsOpen(true)} {...props}>
      {children}
    </button>
  );
};

export const DialogContent = ({ children, className = '', ...props }) => {
  const { isOpen, setIsOpen } = useContext(DialogContext);
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div 
        className={`relative bg-[#111214] border border-[#caa055]/30 rounded-[4px] w-full max-w-md p-6 shadow-2xl space-y-4 ${className}`} 
        {...props}
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 text-slate-muted hover:text-gold p-1 rounded-sm hover:bg-gold/5 transition-colors text-xs"
          title="Close dialog"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
};

export const DialogHeader = ({ children, ...props }) => {
  return <div className="space-y-1.5 text-left" {...props}>{children}</div>;
};

export const DialogTitle = ({ children, ...props }) => {
  return <h2 className="text-lg font-bold text-white tracking-wide" style={{ fontFamily: "'Cinzel', serif" }} {...props}>{children}</h2>;
};
