import React from 'react';

export const Slider = ({ value, onValueChange, min = 0, max = 100, step = 1, className = '', ...props }) => {
  const handleChange = (e) => {
    if (onValueChange) {
      onValueChange([parseFloat(e.target.value)]);
    }
  };

  const val = value !== undefined ? value[0] : min;

  return (
    <div className={`relative flex w-full touch-none select-none items-center py-2 ${className}`}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={val}
        onChange={handleChange}
        className="w-full cursor-pointer focus-visible:outline-none focus:outline-none"
        {...props}
      />
    </div>
  );
};

Slider.displayName = 'Slider';
