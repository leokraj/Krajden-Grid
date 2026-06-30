import React from 'react';

export const Separator = ({ className = '', orientation = 'horizontal', ...props }) => {
  return (
    <div
      className={`shrink-0 bg-white/10 ${
        orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]'
      } ${className}`}
      {...props}
    />
  );
};

export default Separator;
