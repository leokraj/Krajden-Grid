import React from 'react';
import { useGrid } from '../context/GridContext';
import { Card, CardContent } from './ui/card';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Ruler, Trash2, ShieldX, Compass } from 'lucide-react';

const CompassStar = ({ className = "w-8 h-8 text-gold/30 mb-2" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2 L14.5 9.5 L22 12 L14.5 14.5 L12 22 L9.5 14.5 L2 12 L9.5 9.5 Z" />
    <circle cx="12" cy="12" r="3.5" strokeWidth="1" strokeDasharray="1 1" />
  </svg>
);

export const MeasurementsList = () => {
  const { measurements, removeMeasurement, clearMeasurements } = useGrid();

  return (
    <Card className="flex flex-col h-[280px] p-7" data-testid="measurements-list-panel">
      <div className="pb-4 border-b border-[#caa055]/12 flex items-center justify-between mb-4 bg-transparent">
        <Label className="text-xs font-bold uppercase tracking-[0.18em] font-cinzel text-[#caa055] flex items-center gap-2">
          <Ruler className="w-4 h-4 text-[#caa055]" /> RECORDED DISTANCES
        </Label>
        {measurements.length > 0 && (
          <Button
            onClick={clearMeasurements}
            variant="ghost"
            size="sm"
            className="h-7 px-3 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10 font-mono tracking-widest uppercase rounded-lg"
            data-testid="clear-measurements-btn"
          >
            Clear All
          </Button>
        )}
      </div>

      <CardContent className="flex-1 overflow-y-auto p-0 space-y-2.5 pr-1">
        {measurements.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-muted text-xs py-2">
            <CompassStar />
            <span className="font-cinzel text-xs font-semibold tracking-[0.12em] uppercase text-[#caa055]">No measurements recorded yet</span>
            <span className="text-[10px] text-slate-cool/70 font-sans mt-1 max-w-[240px] leading-relaxed">Use the measure tool on the canvas grid to record</span>
          </div>
        ) : (
          measurements.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between p-3 bg-[#0d0e10] border border-[#caa055]/10 hover:border-[#caa055]/30 rounded-lg text-xs text-left transition-all duration-200"
              data-testid={`measurement-item-${m.id}`}
            >
              <div className="space-y-0.5">
                <div className="font-bold text-white font-mono tracking-wider text-xs">
                  {parseFloat(m.unitDistance || 0).toFixed(1)} {m.unit || 'units'}
                </div>
                <div className="text-[10px] text-slate-muted font-sans uppercase tracking-wider">
                  {m.type || 'line'} measurement
                </div>
              </div>
              <Button
                onClick={() => removeMeasurement(m.id)}
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-slate-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg"
                title="Delete Record"
                data-testid={`delete-measurement-${m.id}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default MeasurementsList;
