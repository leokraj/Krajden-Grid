import React from 'react';
import { GridCanvas } from './GridCanvas';
import { Card } from './ui/card';
import { ShieldAlert, Cast } from 'lucide-react';

export const GridPreview = ({ interactive = true }) => {
  return (
    <Card className="relative overflow-hidden aspect-video flex flex-col" data-testid="grid-preview-container">
      {/* Aspect-ratio constrained live preview container */}
      <div className="flex-1 relative overflow-hidden bg-[#0d0e10]">
        <GridCanvas interactive={interactive} className="absolute inset-0" />
      </div>

      {/* Floating preview status footer */}
      <div className="bg-[#141517]/95 border-t border-[#caa055]/12 px-5 py-3 flex items-center justify-between text-[10px] text-slate-cool uppercase font-outfit tracking-wider font-semibold">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#caa055] shrink-0 shadow-[0_0_6px_#caa055]"></span>
          <span>Live Tactical View</span>
        </div>
        <span className="text-[10px] text-[#caa055]/80 font-medium font-outfit capitalize tracking-wider">Use controls to cast projection</span>
      </div>
    </Card>
  );
};

export default GridPreview;
