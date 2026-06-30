import React from 'react';
import { useGrid } from '../context/GridContext';
import { Card, CardContent } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import {
  Grid3X3, Sliders, Palette, Layout, Eye, EyeOff, Lock, Unlock,
  RotateCcw, Shield, HelpCircle, Monitor, Compass
} from 'lucide-react';

export const ConfigPanel = () => {
  const { settings, updateSettings, resetSettings } = useGrid();

  const handleToggle = (key) => {
    updateSettings({ [key]: !settings[key] });
  };

  const handleValueChange = (key, val) => {
    updateSettings({ [key]: val });
  };

  return (
    <Card className="flex flex-col max-h-[85vh] overflow-y-auto p-7" data-testid="config-panel">
      {/* Panel Header */}
      <div className="pb-4 border-b border-[#caa055]/12 flex items-center justify-between bg-transparent z-10 mb-5">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#caa055]" />
          <Label className="text-xs font-bold uppercase tracking-[0.18em] font-cinzel text-[#caa055]">Grid Workshop</Label>
        </div>
        <button
          onClick={resetSettings}
          className="text-[10px] text-[#caa055]/70 hover:text-[#caa055] transition-all flex items-center gap-1.5 font-mono tracking-widest uppercase font-semibold bg-transparent border-none cursor-pointer"
          data-testid="reset-config-btn"
        >
          <RotateCcw className="w-3 h-3 text-[#caa055]" /> RESET
        </button>
      </div>

      <CardContent className="p-0 space-y-6">
        {/* Display Settings Section */}
        <div className="space-y-4" data-testid="section-display">
          <Label className="text-[11px] uppercase font-bold text-[#caa055] tracking-[0.14em] font-cinzel flex items-center gap-2 border-b border-[#caa055]/15 pb-2.5 w-full text-left">
            <Monitor className="w-4 h-4 text-[#caa055]/80" /> Projector & Display
          </Label>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 text-left">
              <Label htmlFor="screen-width" className="text-[10px] uppercase tracking-wider text-slate-cool font-outfit font-semibold">Resolution Width</Label>
              <Input
                id="screen-width"
                type="number"
                value={settings.screenWidth || 1920}
                onChange={(e) => handleValueChange('screenWidth', parseInt(e.target.value) || 1920)}
                className="font-mono text-sm"
                data-testid="screen-width-input"
              />
            </div>
            <div className="space-y-1.5 text-left">
              <Label htmlFor="screen-height" className="text-[10px] uppercase tracking-wider text-slate-cool font-outfit font-semibold">Resolution Height</Label>
              <Input
                id="screen-height"
                type="number"
                value={settings.screenHeight || 1080}
                onChange={(e) => handleValueChange('screenHeight', parseInt(e.target.value) || 1080)}
                className="font-mono text-sm"
                data-testid="screen-height-input"
              />
            </div>
          </div>
        </div>

        {/* Grid Geometry Section */}
        <div className="space-y-4" data-testid="section-geometry">
          <Label className="text-[11px] uppercase font-bold text-[#caa055] tracking-[0.14em] font-cinzel flex items-center gap-2 border-b border-[#caa055]/15 pb-2.5 w-full text-left">
            <Grid3X3 className="w-4 h-4 text-[#caa055]/80" /> Grid Geometry
          </Label>

          {/* Toggle Lock Aspect Ratio */}
          <div className="flex items-center justify-between bg-white/[0.01] border border-[#caa055]/5 rounded-lg p-3">
            <div className="space-y-0.5 text-left pr-2">
              <Label className="text-xs text-[#F3EEE7] uppercase tracking-wider font-cinzel font-medium">Square Grid Ratio</Label>
              <p className="text-[10px] text-slate-muted font-sans leading-relaxed">Force lock perfect horizontal/vertical 1:1 squares</p>
            </div>
            <Switch
              checked={settings.lockRatio !== false}
              onCheckedChange={(checked) => handleValueChange('lockRatio', checked)}
              data-testid="lock-ratio-switch"
            />
          </div>

          {settings.lockRatio ? (
            <div className="space-y-2.5 bg-white/[0.01] border border-[#caa055]/5 rounded-lg p-3">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-cool font-outfit uppercase tracking-wider font-semibold text-[10px]">Grid Dimensions (Count)</span>
                <span className="text-[#caa055]/80 font-medium font-sans text-xs">{settings.gridSize || 40} cells</span>
              </div>
              <Slider
                value={[settings.gridSize || 40]}
                onValueChange={([val]) => handleValueChange('gridSize', val)}
                min={5}
                max={150}
                step={1}
                data-testid="grid-size-slider"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 text-left">
                <Label htmlFor="unit-width" className="text-[10px] uppercase tracking-wider text-slate-cool font-outfit font-semibold">Cell Width (px)</Label>
                <Input
                  id="unit-width"
                  type="number"
                  value={settings.unitWidth || 50}
                  onChange={(e) => handleValueChange('unitWidth', parseInt(e.target.value) || 50)}
                  className="font-mono text-sm mb-2"
                  data-testid="unit-width-input"
                />
                <Slider
                  value={[settings.unitWidth || 50]}
                  onValueChange={([val]) => handleValueChange('unitWidth', val)}
                  min={5}
                  max={200}
                  step={1}
                  data-testid="unit-width-slider"
                />
              </div>
              <div className="space-y-2 text-left">
                <Label htmlFor="unit-height" className="text-[10px] uppercase tracking-wider text-slate-cool font-outfit font-semibold">Cell Height (px)</Label>
                <Input
                  id="unit-height"
                  type="number"
                  value={settings.unitHeight || 50}
                  onChange={(e) => handleValueChange('unitHeight', parseInt(e.target.value) || 50)}
                  className="font-mono text-sm mb-2"
                  data-testid="unit-height-input"
                />
                <Slider
                  value={[settings.unitHeight || 50]}
                  onValueChange={([val]) => handleValueChange('unitHeight', val)}
                  min={5}
                  max={200}
                  step={1}
                  data-testid="unit-height-slider"
                />
              </div>
            </div>
          )}
        </div>

        {/* Aesthetic Aesthetics Styling Section */}
        <div className="space-y-4" data-testid="section-styling">
          <Label className="text-[11px] uppercase font-bold text-[#caa055] tracking-[0.14em] font-cinzel flex items-center gap-2 border-b border-[#caa055]/15 pb-2.5 w-full text-left">
            <Palette className="w-4 h-4 text-[#caa055]/80" /> Styling & Aesthetics
          </Label>

          {/* Grid Visibility toggle */}
          <div className="flex items-center justify-between bg-white/[0.01] border border-[#caa055]/5 rounded-lg p-3">
            <div className="space-y-0.5 text-left pr-2">
              <Label className="text-xs text-[#F3EEE7] flex items-center gap-1.5 font-cinzel font-medium">
                {settings.gridEnabled !== false ? <Eye className="w-3.5 h-3.5 text-[#caa055]" /> : <EyeOff className="w-3.5 h-3.5 text-slate-muted" />}
                Render Grid Lines
              </Label>
            </div>
            <Switch
              checked={settings.gridEnabled !== false}
              onCheckedChange={(checked) => handleValueChange('gridEnabled', checked)}
              data-testid="grid-enabled-switch"
            />
          </div>

          {/* Grid Color */}
          <div className="flex items-center justify-between gap-4 w-full">
            <span className="text-slate-cool font-outfit uppercase tracking-wider font-semibold text-[10px]">Grid Accent Color</span>
            <div className="flex items-center gap-3 bg-[#0d0e10] border border-[#caa055]/20 rounded-lg p-2.5">
              <div className="relative w-7 h-7 rounded-md overflow-hidden border border-[#caa055]/30 shadow-inner flex-shrink-0">
                <input
                  type="color"
                  value={settings.gridColor || '#caa055'}
                  onChange={(e) => handleValueChange('gridColor', e.target.value)}
                  className="absolute inset-0 w-full h-full cursor-pointer opacity-100 p-0 border-none scale-150"
                  data-testid="grid-color-picker"
                />
              </div>
              <span className="text-xs font-mono text-slate-muted uppercase tracking-wider">
                {settings.gridColor || '#caa055'}
              </span>
            </div>
          </div>

          {/* Line Opacity Slider */}
          <div className="space-y-2.5 bg-white/[0.01] border border-[#caa055]/5 rounded-lg p-3">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-cool font-outfit uppercase tracking-wider font-semibold text-[10px]">Line Opacity</span>
              <span className="text-[#caa055]/80 font-medium font-sans text-xs">{Math.round((settings.opacity || 0.3) * 100)}%</span>
            </div>
            <Slider
              value={[settings.opacity ?? 0.3]}
              onValueChange={([val]) => handleValueChange('opacity', val)}
              min={0}
              max={1}
              step={0.01}
              data-testid="grid-opacity-slider"
            />
          </div>

          {/* Line Thickness Slider */}
          <div className="space-y-2.5 bg-white/[0.01] border border-[#caa055]/5 rounded-lg p-3">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-cool font-outfit uppercase tracking-wider font-semibold text-[10px]">Line Thickness</span>
              <span className="text-[#caa055]/80 font-medium font-sans text-xs">{settings.lineThickness || 1}px</span>
            </div>
            <Slider
              value={[settings.lineThickness || 1]}
              onValueChange={([val]) => handleValueChange('lineThickness', val)}
              min={1}
              max={8}
              step={1}
              data-testid="grid-thickness-slider"
            />
          </div>
        </div>

        {/* Measuring & Templates Section */}
        <div className="space-y-4" data-testid="section-templates">
          <Label className="text-[11px] uppercase font-bold text-[#caa055] tracking-[0.14em] font-cinzel flex items-center gap-2 border-b border-[#caa055]/15 pb-2.5 w-full text-left">
            <Compass className="w-4 h-4 text-[#caa055]/80" /> Measurement Scaling
          </Label>

          <div className="space-y-1.5 text-left">
            <Label htmlFor="measure-multiplier" className="text-[10px] uppercase tracking-wider text-slate-cool font-outfit font-semibold">Scale Multiplier (e.g. 5 ft per cell)</Label>
            <Input
              id="measure-multiplier"
              type="number"
              value={settings.measureMultiplier || 1}
              onChange={(e) => handleValueChange('measureMultiplier', parseFloat(e.target.value) || 1)}
              className="font-mono text-sm"
              data-testid="measure-multiplier-input"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ConfigPanel;
