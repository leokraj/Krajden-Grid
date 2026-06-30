import React from 'react';

export const Switch = ({ checked, onCheckedChange, className = '', ...props }) => {
  const handleClick = () => {
    if (onCheckedChange) {
      onCheckedChange(!checked);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={handleClick}
      className={`peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-border-gold bg-[#1c1d1f] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#caa055]/50 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      <span
        className={`pointer-events-none block h-3 w-3 rounded-full shadow-sm ring-0 transition-all bg-[#caa055] ${
          checked ? 'translate-x-[20px]' : 'translate-x-[4px]'
        }`}
      />
    </button>
  );
};

Switch.displayName = 'Switch';
