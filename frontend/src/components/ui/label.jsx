import React from 'react';

export const Label = React.forwardRef(({ className = '', ...props }, ref) => {
  return (
    <label
      ref={ref}
      className={`text-xs font-semibold leading-none text-gray-300 select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}
      {...props}
    />
  );
});

Label.displayName = 'Label';
