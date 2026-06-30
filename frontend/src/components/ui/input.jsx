import React from 'react';

export const Input = React.forwardRef(({ className = '', type = 'text', ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      className={`flex h-11 w-full rounded-[4px] border border-[#caa055]/25 bg-black/40 px-[14px] py-2 text-sm text-[#F3EEE7] shadow-inner transition-all placeholder:text-slate-muted focus:border-[#caa055]/60 focus-visible:outline-none focus:outline-none focus:shadow-[0_0_12px_rgba(202,160,85,0.15)] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
});

Input.displayName = 'Input';
