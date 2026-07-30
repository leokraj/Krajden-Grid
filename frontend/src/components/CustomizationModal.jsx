import React, { useState, useEffect } from 'react';
import { useGrid, DEFAULT_ACTIONS } from '../context/GridContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { toast } from 'sonner';
import {
  Keyboard,
  Zap,
  Plus,
  Trash2,
  Play,
  RotateCcw,
  X,
  Search,
  Check,
  Edit2,
  Sliders,
  Settings,
  Sparkles,
  Radio,
  ArrowUp,
  ArrowDown,
  Info,
  Ruler,
  PenTool,
  Image,
  Disc
} from 'lucide-react';

export function formatKeyboardEvent(e) {
  const parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Meta');

  let key = e.key;
  if (!key) return '';

  // Ignore modifier key presses alone
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
    return '';
  }

  if (key === ' ') key = 'Space';
  else if (key.length === 1) key = key.toUpperCase();
  else if (key.startsWith('Arrow')) key = key.replace('Arrow', '');

  parts.push(key);
  return parts.join('+');
}

export function CustomizationModal({ isOpen, onClose }) {
  const {
    customHotkeys,
    updateHotkey,
    resetHotkeysToDefault,
    macros,
    saveMacro,
    deleteMacro,
    executeAction,
    executeMacro,
    recordingMacro,
    startMacroRecording,
    stopMacroRecording,
    recordedSteps,
    radialMenuConfig,
    updateRadialConfig,
    resetRadialConfig
  } = useGrid();

  const [activeTab, setActiveTab] = useState('hotkeys'); // 'hotkeys' | 'macros'
  const [searchQuery, setSearchQuery] = useState('');
  const [rebindingActionId, setRebindingActionId] = useState(null);

  // Macro Editor State
  const [editingMacro, setEditingMacro] = useState(null);
  const [macroName, setMacroName] = useState('');
  const [macroDesc, setMacroDesc] = useState('');
  const [macroHotkey, setMacroHotkey] = useState('');
  const [macroSteps, setMacroSteps] = useState([]);
  const [selectedActionToAdd, setSelectedActionToAdd] = useState(DEFAULT_ACTIONS[0]?.id || 'toggle_grid');
  const [rebindingMacroHotkey, setRebindingMacroHotkey] = useState(false);

  // Listen for hotkey press when rebinding an action or macro hotkey
  useEffect(() => {
    if (!rebindingActionId && !rebindingMacroHotkey) return;

    const handleKeyDown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const keyCombo = formatKeyboardEvent(e);
      if (!keyCombo) return;

      if (rebindingActionId) {
        updateHotkey(rebindingActionId, keyCombo);
        const action = DEFAULT_ACTIONS.find(a => a.id === rebindingActionId);
        toast.success(`Bound "${action?.name || rebindingActionId}" to ${keyCombo}`);
        setRebindingActionId(null);
      } else if (rebindingMacroHotkey) {
        setMacroHotkey(keyCombo);
        toast.success(`Set macro hotkey to ${keyCombo}`);
        setRebindingMacroHotkey(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [rebindingActionId, rebindingMacroHotkey, updateHotkey]);

  if (!isOpen) return null;

  // Filter actions by search query
  const filteredActions = DEFAULT_ACTIONS.filter(action =>
    action.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    action.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (customHotkeys[action.id] || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group filtered actions by category
  const categories = Array.from(new Set(filteredActions.map(a => a.category)));

  // Start creating or editing a macro
  const handleOpenMacroEditor = (macro = null) => {
    if (macro) {
      setEditingMacro(macro);
      setMacroName(macro.name);
      setMacroDesc(macro.description || '');
      setMacroHotkey(macro.hotkey || '');
      setMacroSteps(macro.steps || []);
    } else {
      setEditingMacro('new');
      setMacroName('');
      setMacroDesc('');
      setMacroHotkey('');
      setMacroSteps([]);
    }
  };

  const handleSaveMacroForm = (e) => {
    e?.preventDefault();
    if (!macroName.trim()) {
      toast.error('Please enter a name for your macro');
      return;
    }
    if (macroSteps.length === 0) {
      toast.error('Please add at least one step to your macro');
      return;
    }

    const macroObj = {
      id: typeof editingMacro === 'object' && editingMacro?.id ? editingMacro.id : `macro_${Date.now()}`,
      name: macroName.trim(),
      description: macroDesc.trim(),
      hotkey: macroHotkey,
      steps: macroSteps
    };

    saveMacro(macroObj);
    toast.success(`Macro "${macroObj.name}" saved!`);
    setEditingMacro(null);
  };

  const handleAddStepToMacro = () => {
    if (!selectedActionToAdd) return;
    setMacroSteps(prev => [...prev, { actionId: selectedActionToAdd }]);
  };

  const handleRemoveStepFromMacro = (index) => {
    setMacroSteps(prev => prev.filter((_, i) => i !== index));
  };

  const handleMoveStep = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= macroSteps.length) return;
    const newSteps = [...macroSteps];
    const temp = newSteps[index];
    newSteps[index] = newSteps[targetIndex];
    newSteps[targetIndex] = temp;
    setMacroSteps(newSteps);
  };

  const handleApplyRecordedSteps = () => {
    const newSteps = stopMacroRecording();
    if (newSteps.length > 0) {
      setMacroSteps(prev => [...prev, ...newSteps]);
      toast.success(`Added ${newSteps.length} recorded step(s) to macro!`);
    } else {
      toast.info('No new actions recorded during recording session');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200"
      data-testid="customization-modal"
    >
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-[#111215] border border-[#caa055]/30 rounded-xl shadow-2xl flex flex-col overflow-hidden text-white font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-black/80 via-[#18191c] to-black/80 border-b border-[#caa055]/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#caa055]/10 border border-[#caa055]/30 rounded-lg text-[#caa055]">
              <Settings className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-base font-bold font-cinzel text-[#caa055] tracking-wider flex items-center gap-2">
                CUSTOMIZATION WORKSHOP
                <Badge variant="outline" className="border-[#caa055]/30 text-[#caa055] text-[9px] font-mono px-1.5 py-0">
                  HOTKEYS & MACROS
                </Badge>
              </h2>
              <p className="text-[11px] text-gray-400 font-outfit">
                Configure custom hotkey bindings and sequence automated macros
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-gray-400 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
            data-testid="close-customization-modal"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-black/40 border-b border-white/10">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setActiveTab('hotkeys'); setEditingMacro(null); }}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold font-cinzel transition-all cursor-pointer ${
                activeTab === 'hotkeys'
                  ? 'bg-[#caa055]/20 text-[#caa055] border border-[#caa055]/40 shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
              data-testid="tab-hotkeys"
            >
              <Keyboard className="w-3.5 h-3.5" />
              Custom Hotkeys ({DEFAULT_ACTIONS.length})
            </button>

            <button
              onClick={() => setActiveTab('macros')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold font-cinzel transition-all cursor-pointer ${
                activeTab === 'macros'
                  ? 'bg-[#caa055]/20 text-[#caa055] border border-[#caa055]/40 shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
              data-testid="tab-macros"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Macro Builder ({macros.length})
            </button>

            <button
              onClick={() => setActiveTab('radial')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold font-cinzel transition-all cursor-pointer ${
                activeTab === 'radial'
                  ? 'bg-[#caa055]/20 text-[#caa055] border border-[#caa055]/40 shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
              data-testid="tab-radial"
            >
              <Disc className="w-3.5 h-3.5 text-[#caa055]" />
              Radial Menu
            </button>
          </div>

          {activeTab === 'hotkeys' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetHotkeysToDefault();
                toast.success('Hotkeys reset to default bindings');
              }}
              className="h-7 text-[10px] border-red-500/30 text-red-400 hover:bg-red-500/10 font-mono tracking-wider cursor-pointer"
              data-testid="reset-hotkeys-btn"
            >
              <RotateCcw className="w-3 h-3 mr-1" /> Reset All Hotkeys
            </Button>
          )}

          {activeTab === 'macros' && !editingMacro && (
            <Button
              size="sm"
              onClick={() => handleOpenMacroEditor()}
              className="h-7 text-xs bg-[#caa055] hover:bg-[#b88f46] text-[#111215] font-bold font-cinzel cursor-pointer"
              data-testid="create-macro-btn"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> New Macro
            </Button>
          )}
        </div>

        {/* Modal Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* TAB 1: HOTKEYS */}
          {activeTab === 'hotkeys' && (
            <div className="space-y-5">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search actions or hotkeys (e.g., 'grid', 'draw', 'Ctrl+D')..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-black/50 border-white/10 text-xs h-9 focus:border-[#caa055]/50"
                  data-testid="search-hotkeys-input"
                />
              </div>

              {/* Rebinding Overlay Banner */}
              {rebindingActionId && (
                <div className="p-3 bg-amber-500/20 border border-amber-500/50 rounded-lg flex items-center justify-between animate-pulse">
                  <div className="flex items-center gap-2 text-xs text-amber-200">
                    <Radio className="w-4 h-4 text-amber-400 animate-spin" />
                    <span>
                      Press any key combination now for <strong>"{DEFAULT_ACTIONS.find(a => a.id === rebindingActionId)?.name}"</strong>...
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRebindingActionId(null)}
                    className="h-6 text-[10px] text-amber-300 hover:bg-amber-500/20"
                  >
                    Cancel
                  </Button>
                </div>
              )}

              {/* Action Categories */}
              {categories.map((category) => {
                const categoryActions = filteredActions.filter(a => a.category === category);
                if (categoryActions.length === 0) return null;

                return (
                  <div key={category} className="space-y-2">
                    <h3 className="text-xs font-bold font-cinzel text-[#caa055] uppercase tracking-wider flex items-center gap-2 border-b border-[#caa055]/15 pb-1">
                      <Sliders className="w-3.5 h-3.5 text-[#caa055]/70" />
                      {category}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {categoryActions.map((action) => {
                        const currentHotkey = customHotkeys[action.id] || action.defaultHotkey;
                        const isRebindingThis = rebindingActionId === action.id;

                        return (
                          <div
                            key={action.id}
                            className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                              isRebindingThis
                                ? 'bg-amber-500/10 border-amber-500/50 shadow-md ring-1 ring-amber-500/30'
                                : 'bg-black/40 border-white/5 hover:border-white/15'
                            }`}
                            data-testid={`hotkey-row-${action.id}`}
                          >
                            <div className="flex-1 pr-3 text-left">
                              <div className="text-xs font-semibold text-gray-200">
                                {action.name}
                              </div>
                              <div className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">
                                {action.description}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Badge
                                variant="outline"
                                className={`font-mono text-[11px] px-2 py-0.5 border ${
                                  currentHotkey
                                    ? 'border-[#caa055]/40 text-[#caa055] bg-[#caa055]/10'
                                    : 'border-gray-600 text-gray-500'
                                }`}
                              >
                                {isRebindingThis ? 'Press keys...' : (currentHotkey || 'None')}
                              </Badge>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setRebindingActionId(action.id)}
                                className="h-7 px-2 text-[10px] border-white/10 hover:border-[#caa055]/50 hover:bg-[#caa055]/10 text-gray-300 cursor-pointer"
                                data-testid={`rebind-btn-${action.id}`}
                              >
                                {isRebindingThis ? 'Cancel' : 'Rebind'}
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                title="Test execute function"
                                onClick={() => executeAction(action.id)}
                                className="h-7 w-7 p-0 text-gray-400 hover:text-amber-400 hover:bg-amber-400/10 cursor-pointer"
                              >
                                <Play className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {filteredActions.length === 0 && (
                <div className="p-8 text-center text-gray-500 text-xs">
                  No actions match your search query "{searchQuery}".
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MACROS */}
          {activeTab === 'macros' && (
            <div className="space-y-5">
              
              {/* MACRO EDITOR FORM */}
              {editingMacro ? (
                <div className="p-4 bg-black/60 border border-[#caa055]/30 rounded-xl space-y-4 text-left animate-in fade-in duration-200">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <h3 className="text-sm font-bold font-cinzel text-[#caa055] flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      {editingMacro === 'new' ? 'Create New Macro' : `Edit Macro: "${macroName}"`}
                    </h3>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingMacro(null)}
                      className="h-6 text-[11px] text-gray-400 hover:text-white"
                    >
                      Cancel
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-gray-300 font-semibold uppercase tracking-wider">Macro Name *</Label>
                      <Input
                        value={macroName}
                        onChange={(e) => setMacroName(e.target.value)}
                        placeholder="e.g., Quick Combat Clear"
                        className="bg-black/50 border-white/10 text-xs h-8"
                        data-testid="macro-name-input"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] text-gray-300 font-semibold uppercase tracking-wider">Hotkey Binding</Label>
                      <div className="flex gap-2">
                        <Input
                          value={macroHotkey}
                          readOnly
                          placeholder="No Hotkey (Optional)"
                          className="bg-black/50 border-white/10 text-xs h-8 font-mono text-[#caa055]"
                          data-testid="macro-hotkey-input"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() => setRebindingMacroHotkey(true)}
                          className={`h-8 px-3 text-[11px] cursor-pointer ${
                            rebindingMacroHotkey ? 'bg-amber-500/20 text-amber-300 border-amber-500' : 'border-white/10'
                          }`}
                          data-testid="rebind-macro-hotkey-btn"
                        >
                          {rebindingMacroHotkey ? 'Press keys...' : 'Bind Hotkey'}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] text-gray-300 font-semibold uppercase tracking-wider">Description</Label>
                    <Input
                      value={macroDesc}
                      onChange={(e) => setMacroDesc(e.target.value)}
                      placeholder="e.g., Clears drawings, removes measurements, and rolls d20"
                      className="bg-black/50 border-white/10 text-xs h-8"
                    />
                  </div>

                  {/* Steps Sequencer */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                      <Label className="text-xs font-bold text-[#caa055] font-cinzel uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" /> Macro Action Steps ({macroSteps.length})
                      </Label>

                      {/* Live Recorder Toggle */}
                      {!recordingMacro ? (
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={startMacroRecording}
                          className="h-6 px-2 text-[10px] border-red-500/40 text-red-400 hover:bg-red-500/10 cursor-pointer flex items-center gap-1"
                          data-testid="record-macro-btn"
                        >
                          <Radio className="w-3 h-3 text-red-500 animate-pulse" /> Record Live Actions
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          type="button"
                          onClick={handleApplyRecordedSteps}
                          className="h-6 px-2 text-[10px] bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer flex items-center gap-1 animate-bounce"
                          data-testid="stop-record-macro-btn"
                        >
                          ⏹ Stop & Add ({recordedSteps.length} captured)
                        </Button>
                      )}
                    </div>

                    {/* Step Adder Row */}
                    <div className="flex items-center gap-2 bg-black/40 p-2 rounded-lg border border-white/5">
                      <select
                        value={selectedActionToAdd}
                        onChange={(e) => setSelectedActionToAdd(e.target.value)}
                        className="flex-1 bg-zinc-900 border border-white/10 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#caa055]"
                        data-testid="select-action-step"
                      >
                        {DEFAULT_ACTIONS.map((action) => (
                          <option key={action.id} value={action.id}>
                            [{action.category}] {action.name}
                          </option>
                        ))}
                      </select>

                      <Button
                        size="sm"
                        type="button"
                        onClick={handleAddStepToMacro}
                        className="h-7 text-xs bg-[#caa055] hover:bg-[#b88f46] text-[#111215] font-bold cursor-pointer shrink-0"
                        data-testid="add-step-btn"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Step
                      </Button>
                    </div>

                    {/* Sequential List of Steps */}
                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                      {macroSteps.map((step, idx) => {
                        const actionInfo = DEFAULT_ACTIONS.find(a => a.id === step.actionId);

                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 bg-zinc-900/80 border border-white/5 rounded-lg text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] font-mono text-[#caa055] border-[#caa055]/30">
                                Step {idx + 1}
                              </Badge>
                              <span className="font-semibold text-gray-200">
                                {actionInfo?.name || step.actionId}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                ({actionInfo?.category})
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={idx === 0}
                                onClick={() => handleMoveStep(idx, -1)}
                                className="h-6 w-6 p-0 text-gray-400 hover:text-white disabled:opacity-30"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={idx === macroSteps.length - 1}
                                onClick={() => handleMoveStep(idx, 1)}
                                className="h-6 w-6 p-0 text-gray-400 hover:text-white disabled:opacity-30"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRemoveStepFromMacro(idx)}
                                className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}

                      {macroSteps.length === 0 && (
                        <div className="p-4 text-center text-gray-500 text-xs border border-dashed border-white/10 rounded-lg">
                          No action steps added yet. Use the dropdown above or click "Record Live Actions".
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end gap-2 border-t border-white/10">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingMacro(null)}
                      className="h-8 text-xs border-white/10 text-gray-300 cursor-pointer"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSaveMacroForm}
                      className="h-8 text-xs bg-[#caa055] hover:bg-[#b88f46] text-[#111215] font-bold font-cinzel cursor-pointer"
                      data-testid="save-macro-btn"
                    >
                      <Check className="w-3.5 h-3.5 mr-1" /> Save Macro
                    </Button>
                  </div>
                </div>
              ) : (
                /* MACROS LIST VIEW */
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3">
                    {macros.map((macro) => (
                      <div
                        key={macro.id}
                        className="p-3 bg-black/40 border border-white/10 hover:border-[#caa055]/40 rounded-xl space-y-2 text-left transition-all"
                        data-testid={`macro-card-${macro.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-amber-400" />
                            <h4 className="text-xs font-bold text-white font-cinzel">
                              {macro.name}
                            </h4>
                            {macro.hotkey && (
                              <Badge variant="outline" className="font-mono text-[10px] text-[#caa055] border-[#caa055]/40 bg-[#caa055]/10">
                                {macro.hotkey}
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              onClick={() => executeMacro(macro)}
                              className="h-7 px-3 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                              data-testid={`run-macro-${macro.id}`}
                            >
                              <Play className="w-3 h-3 mr-1" /> Run Macro
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenMacroEditor(macro)}
                              className="h-7 w-7 p-0 border-white/10 hover:bg-white/10 text-gray-300 cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                deleteMacro(macro.id);
                                toast.success(`Deleted macro "${macro.name}"`);
                              }}
                              className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>

                        {macro.description && (
                          <p className="text-[11px] text-gray-400">
                            {macro.description}
                          </p>
                        )}

                        {/* Sequential Step Badges */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {macro.steps.map((step, idx) => {
                            const actionInfo = DEFAULT_ACTIONS.find(a => a.id === step.actionId);
                            return (
                              <span
                                key={idx}
                                className="inline-flex items-center text-[10px] bg-zinc-900 border border-white/10 rounded px-2 py-0.5 text-gray-300 font-mono"
                              >
                                <span className="text-[#caa055] mr-1">{idx + 1}.</span>
                                {actionInfo?.name || step.actionId}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {macros.length === 0 && (
                      <div className="p-8 text-center text-gray-500 text-xs border border-dashed border-white/10 rounded-xl space-y-2">
                        <Zap className="w-6 h-6 text-gray-600 mx-auto" />
                        <p>No custom macros created yet.</p>
                        <Button
                          size="sm"
                          onClick={() => handleOpenMacroEditor()}
                          className="h-7 text-xs bg-[#caa055] hover:bg-[#b88f46] text-[#111215] font-bold font-cinzel mt-2 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Create Your First Macro
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RADIAL CONTEXT MENU CUSTOMIZATION */}
          {activeTab === 'radial' && (
            <div className="space-y-6">
              {/* Radial Menu General Settings */}
              <div className="bg-black/30 border border-[#caa055]/20 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold font-cinzel text-[#caa055] tracking-wide flex items-center gap-2">
                      <Radio className="w-4 h-4 text-[#caa055]" />
                      Right-Click Radial Context Wheel
                    </h3>
                    <p className="text-xs text-gray-400 font-outfit">
                      Holding or clicking right-click on the map canvas opens a 4-quadrant quick action wheel centered at your cursor.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-medium text-gray-300">
                      {radialMenuConfig?.enabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                    <button
                      onClick={() => updateRadialConfig({ enabled: !radialMenuConfig?.enabled })}
                      className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer ${radialMenuConfig?.enabled ? 'bg-[#caa055]' : 'bg-gray-700'}`}
                      data-testid="toggle-radial-menu-setting"
                    >
                      <div className={`w-4 h-4 rounded-full bg-black transition-transform ${radialMenuConfig?.enabled ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>

                <Separator className="bg-[#caa055]/15" />

                <div className="flex items-center justify-between text-xs text-gray-300 font-outfit">
                  <span>Activation Mode:</span>
                  <span className="text-[#caa055] font-mono font-bold bg-[#caa055]/10 px-2 py-0.5 rounded border border-[#caa055]/30">
                    Right-Click Drag or Hold
                  </span>
                </div>
              </div>

              {/* Default Quadrants Overview */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold font-cinzel text-[#caa055] uppercase tracking-wider">
                    Default Radial Wheel Sections
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetRadialConfig}
                    className="h-7 text-xs border-[#caa055]/30 text-[#caa055] hover:bg-[#caa055]/10 font-cinzel cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" /> Reset Radial Wheel Defaults
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* TOP: MEASURE */}
                  <div className="p-3 bg-zinc-900/80 border border-[#caa055]/20 rounded-xl space-y-2">
                    <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                      <span className="text-xs font-bold font-cinzel text-[#caa055] flex items-center gap-1.5">
                        <Ruler className="w-4 h-4 text-[#caa055]" />
                        TOP QUADRANT
                      </span>
                      <Badge variant="outline" className="text-[9px] border-[#caa055]/30 text-[#caa055]">Measure Tools</Badge>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Opens sub-menu: <strong className="text-white">Line</strong> (Left), <strong className="text-white">Radial/Circle</strong> (Top), <strong className="text-white">Cone</strong> (Right), and <strong className="text-red-400">Off</strong> (Bottom).
                    </p>
                  </div>

                  {/* RIGHT: BEACON */}
                  <div className="p-3 bg-zinc-900/80 border border-[#caa055]/20 rounded-xl space-y-2">
                    <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                      <span className="text-xs font-bold font-cinzel text-[#caa055] flex items-center gap-1.5">
                        <Radio className="w-4 h-4 text-[#caa055]" />
                        RIGHT QUADRANT
                      </span>
                      <Badge variant="outline" className="text-[9px] border-[#caa055]/30 text-[#caa055]">Map Beacon</Badge>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Immediately places an <strong className="text-white">Animated Ping Beacon</strong> at the clicked map position or toggles ping mode.
                    </p>
                  </div>

                  {/* BOTTOM: LIBRARY */}
                  <div className="p-3 bg-zinc-900/80 border border-[#caa055]/20 rounded-xl space-y-2">
                    <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                      <span className="text-xs font-bold font-cinzel text-[#caa055] flex items-center gap-1.5">
                        <Image className="w-4 h-4 text-[#caa055]" />
                        BOTTOM QUADRANT
                      </span>
                      <Badge variant="outline" className="text-[9px] border-[#caa055]/30 text-[#caa055]">Token Library</Badge>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Opens the <strong className="text-white">Token & Clipart Library</strong> for fast token dragging onto the map grid.
                    </p>
                  </div>

                  {/* LEFT: DRAW */}
                  <div className="p-3 bg-zinc-900/80 border border-[#caa055]/20 rounded-xl space-y-2">
                    <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                      <span className="text-xs font-bold font-cinzel text-[#caa055] flex items-center gap-1.5">
                        <PenTool className="w-4 h-4 text-[#caa055]" />
                        LEFT QUADRANT
                      </span>
                      <Badge variant="outline" className="text-[9px] border-[#caa055]/30 text-[#caa055]">Drawing Tools</Badge>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Opens sub-menu: <strong className="text-white">Draw Pen</strong>, <strong className="text-white">Eraser</strong>, <strong className="text-amber-400">Clear Drawings</strong>, and <strong className="text-red-400">Off</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-black/60 border-t border-white/10 flex items-center justify-between text-[11px] text-gray-400 font-mono">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-[#caa055]" />
            <span>Hotkeys & Macros automatically trigger when no input box is focused.</span>
          </div>

          <Button
            size="sm"
            onClick={onClose}
            className="h-7 text-xs bg-white/10 hover:bg-white/20 text-white font-semibold cursor-pointer"
          >
            Done
          </Button>
        </div>

      </div>
    </div>
  );
}
