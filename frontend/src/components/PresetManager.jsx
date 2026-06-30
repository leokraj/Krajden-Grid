import { useState, useEffect, useCallback } from 'react';
import { useGrid } from '../context/GridContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Save, FolderOpen, Trash2, Plus, Check } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
const API = `${backendUrl}/api`;

export const PresetManager = () => {
  const { settings, updateSettings, presets, setPresets } = useGrid();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDescription, setNewPresetDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchPresets = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/presets`);
      if (Array.isArray(response.data)) {
        setPresets(response.data);
      } else {
        setPresets([]);
      }
    } catch (error) {
      console.error('Failed to fetch presets:', error);
      setPresets([]);
    }
  }, [setPresets]);

  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  const savePreset = async () => {
    if (!newPresetName.trim()) {
      toast.error('Please enter a preset name');
      return;
    }

    setLoading(true);
    try {
      const presetData = {
        name: newPresetName.trim(),
        description: newPresetDescription.trim(),
        settings: {
          screen_width: settings.screenWidth,
          screen_height: settings.screenHeight,
          unit_width: settings.unitWidth,
          unit_height: settings.unitHeight,
          grid_color: settings.gridColor,
          line_thickness: settings.lineThickness,
          opacity: settings.opacity,
          show_subdivisions: settings.showSubdivisions,
          subdivision_count: settings.subdivisionCount,
        },
      };

      await axios.post(`${API}/presets`, presetData);
      toast.success('Preset saved successfully');
      setNewPresetName('');
      setNewPresetDescription('');
      setIsDialogOpen(false);
      fetchPresets();
    } catch (error) {
      console.error('Failed to save preset:', error);
      toast.error('Failed to save preset');
    } finally {
      setLoading(false);
    }
  };

  const loadPreset = (preset) => {
    const s = preset.settings;
    updateSettings({
      screenWidth: s.screen_width,
      screenHeight: s.screen_height,
      unitWidth: s.unit_width,
      unitHeight: s.unit_height,
      gridColor: s.grid_color,
      lineThickness: s.line_thickness,
      opacity: s.opacity,
      showSubdivisions: s.show_subdivisions,
      subdivisionCount: s.subdivision_count,
    });
    toast.success(`Loaded preset: ${preset.name}`);
  };

  const deletePreset = async (presetId, presetName) => {
    try {
      await axios.delete(`${API}/presets/${presetId}`);
      toast.success(`Deleted preset: ${presetName}`);
      fetchPresets();
    } catch (error) {
      console.error('Failed to delete preset:', error);
      toast.error('Failed to delete preset');
    }
  };

  return (
    <Card className="flex flex-col h-[280px] p-7" data-testid="preset-manager">
      <div className="pb-4 border-b border-[#caa055]/12 flex items-center justify-between mb-4 bg-transparent shrink-0">
        <Label className="text-xs font-bold uppercase tracking-[0.18em] font-cinzel text-[#caa055] flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-[#caa055]" /> PRESETS
        </Label>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="border-[#caa055]/30 text-[#caa055] hover:bg-[#caa055]/5 font-mono text-[9px] tracking-widest font-bold h-8 rounded-lg" data-testid="save-preset-trigger">
              <Plus className="w-3 h-3 mr-1" />
              SAVE CURRENT
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#141517] border border-[#caa055]/25 rounded-[12px] p-6 max-w-sm">
            <DialogHeader className="border-b border-[#caa055]/12 pb-3 mb-4">
              <DialogTitle className="text-sm font-cinzel tracking-widest uppercase text-[#caa055]">Save Preset</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-left">
              <div className="space-y-1.5">
                <Label htmlFor="presetName" className="text-[10px] uppercase font-outfit tracking-wider font-semibold text-slate-cool">Preset Name</Label>
                <Input
                  id="presetName"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder="My Grid Preset"
                  className="bg-white/[0.01] border-[#caa055]/10 rounded-lg text-sm"
                  data-testid="preset-name-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="presetDescription" className="text-[10px] uppercase font-outfit tracking-wider font-semibold text-slate-cool">Description (optional)</Label>
                <Input
                  id="presetDescription"
                  value={newPresetDescription}
                  onChange={(e) => setNewPresetDescription(e.target.value)}
                  placeholder="1080p design grid"
                  className="bg-white/[0.01] border-[#caa055]/10 rounded-lg text-sm"
                  data-testid="preset-description-input"
                />
              </div>
              <Button
                onClick={savePreset}
                disabled={loading}
                className="w-full h-11 mt-2 rounded-lg"
                data-testid="save-preset-btn"
              >
                <Save className="w-3.5 h-3.5 mr-2" />
                {loading ? 'Saving...' : 'Save Preset'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <CardContent className="flex-1 overflow-y-auto p-0 space-y-2.5 pr-1">
        {!Array.isArray(presets) || presets.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-muted text-xs py-2">
            <FolderOpen className="w-8 h-8 text-[#caa055]/30 mb-2 stroke-[1.5]" />
            <span className="font-cinzel text-xs font-semibold tracking-[0.12em] uppercase text-[#caa055]" data-testid="no-presets-title">No Presets Saved Yet</span>
            <span className="text-[10px] text-slate-cool/70 font-sans mt-1 max-w-[240px] leading-relaxed">Save your current settings as a preset</span>
          </div>
        ) : (
          <div className="space-y-2">
            {presets.map((preset, index) => (
              <div
                key={preset.id}
                className="flex items-center justify-between p-3 bg-[#0d0e10] border border-[#caa055]/10 hover:border-[#caa055]/30 transition-all rounded-lg text-left group"
                data-testid={`preset-item-${index}`}
              >
                <div className="flex-1 min-w-0 text-left">
                  <div className="font-cinzel text-xs font-bold text-white tracking-wider uppercase">{preset.name}</div>
                  {preset.description && (
                    <div className="text-[10px] text-slate-cool font-sans truncate mt-0.5">{preset.description}</div>
                  )}
                  <div className="text-[9px] text-slate-muted font-mono tracking-wide mt-1">
                    {preset.settings.screen_width}×{preset.settings.screen_height} • {preset.settings.unit_width}×{preset.settings.unit_height} units
                  </div>
                </div>
                <div className="flex items-center gap-1.5 ml-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => loadPreset(preset)}
                    className="h-7 w-7 p-0 text-[#caa055] hover:text-[#d5b271] hover:bg-[#caa055]/10 rounded-lg"
                    data-testid={`load-preset-${index}`}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deletePreset(preset.id, preset.name)}
                    className="h-7 w-7 p-0 text-slate-muted hover:text-red-500 rounded-lg"
                    data-testid={`delete-preset-${index}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PresetManager;
