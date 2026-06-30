import React from 'react';

export const Button = React.forwardRef(({ className = '', variant = 'default', size = 'default', children, ...props }, ref) => {
  const baseStyles = 'inline-flex items-center justify-center rounded-[4px] transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer';
  
  const variants = {
    default: 'bg-[#caa055] text-[#1c1d1f] hover:bg-[#d5b271] font-cinzel font-bold tracking-[0.14em] border border-[#caa055]/30 shadow-md shadow-[#caa055]/5',
    outline: 'border border-[#caa055]/25 bg-transparent text-[#caa055] hover:border-[#caa055]/60 hover:text-white hover:bg-[#caa055]/5 font-cinzel font-semibold tracking-[0.12em]',
    ghost: 'text-slate-muted hover:text-[#caa055] hover:bg-[#caa055]/5 font-cinzel font-semibold tracking-[0.12em]',
    secondary: 'bg-[#141517]/40 text-slate-cool border border-border-gold hover:border-[#caa055]/40 hover:bg-[#141517] hover:text-white font-cinzel font-semibold tracking-[0.12em]'
  };

  const sizes = {
    default: 'h-10 px-5 text-[11px] uppercase font-cinzel',
    sm: 'h-8 px-4 text-[10px] uppercase font-cinzel',
    lg: 'h-12 px-6 text-xs uppercase tracking-[0.14em] font-cinzel',
    icon: 'h-10 w-10 shrink-0'
  };

  const variantClass = variants[variant] || variants.default;
  const sizeClass = sizes[size] || sizes.default;

  return (
    <button
      ref={ref}
      className={`${baseStyles} ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});

Button.displayName = 'Button';
