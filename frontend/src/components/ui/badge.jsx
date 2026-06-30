import React from 'react';

export const Badge = ({ className = '', variant = 'default', children, ...props }) => {
  const baseStyles = 'inline-flex items-center rounded-sm border px-2 py-0.5 text-[9px] font-mono tracking-widest uppercase transition-colors focus:outline-none focus:ring-1 focus:ring-gold';
  
  const variants = {
    default: 'border-gold-shadow bg-gold text-black hover:bg-gold-bright',
    secondary: 'border-border-gold bg-[#1e2330]/40 text-slate-cool hover:bg-[#1e2330]/60',
    destructive: 'border-red-500/30 bg-red-500/10 text-red-400',
    outline: 'border-border-gold bg-transparent text-slate-cool'
  };

  const variantClass = variants[variant] || variants.default;

  return (
    <div className={`${baseStyles} ${variantClass} ${className}`} {...props}>
      {children}
    </div>
  );
};

Badge.displayName = 'Badge';
