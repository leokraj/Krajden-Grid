import React from 'react';

export const Card = ({ className = '', ...props }) => {
  return (
    <div
      className={`rounded-[6px] border border-[#caa055]/20 bg-[#111214]/94 backdrop-blur-md text-[#F3EEE7] shadow-2xl relative ${className}`}
      {...props}
    />
  );
};

export const CardContent = ({ className = '', ...props }) => {
  return (
    <div className={`p-6 pt-0 ${className}`} {...props} />
  );
};

export const CardHeader = ({ className = '', ...props }) => {
  return (
    <div className={`flex flex-col space-y-1.5 p-6 ${className}`} {...props} />
  );
};

export const CardTitle = ({ className = '', ...props }) => {
  return (
    <h3 className={`font-cinzel text-xs font-bold uppercase tracking-[0.18em] text-[#caa055] leading-tight ${className}`} {...props} />
  );
};

export const CardDescription = ({ className = '', ...props }) => {
  return (
    <p className={`font-sans text-xs text-slate-cool ${className}`} {...props} />
  );
};

Card.displayName = 'Card';
CardContent.displayName = 'CardContent';
CardHeader.displayName = 'CardHeader';
CardTitle.displayName = 'CardTitle';
CardDescription.displayName = 'CardDescription';
