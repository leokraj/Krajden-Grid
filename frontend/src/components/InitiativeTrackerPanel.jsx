import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Sword, Trash2, ArrowRight, ChevronRight, ChevronLeft, UserPlus } from 'lucide-react';

export const InitiativeTrackerPanel = ({
  initiativeList = [],
  currentTurnIndex = -1,
  broadcastUpdateInitiative,
  userName = 'Adventurer',
  isHost = true
}) => {
  const [combatantName, setCombatantName] = useState('');
  const [initiativeVal, setInitiativeVal] = useState('');

  const addCombatant = (e) => {
    e.preventDefault();
    if (!combatantName.trim()) return;

    const newCombatant = {
      id: `combatant_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: combatantName.trim(),
      value: parseInt(initiativeVal) || 0,
      addedBy: userName
    };

    const updatedList = [...initiativeList, newCombatant]
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

    // Keep active turn aligned if we added someone
    let newTurnIndex = currentTurnIndex;
    if (currentTurnIndex === -1 && updatedList.length > 0) {
      newTurnIndex = 0;
    }

    broadcastUpdateInitiative?.(updatedList, newTurnIndex);
    setCombatantName('');
    setInitiativeVal('');
  };

  const removeCombatant = (id) => {
    const targetIdx = initiativeList.findIndex(item => item.id === id);
    const updatedList = initiativeList.filter(item => item.id !== id);
    
    let newTurnIndex = currentTurnIndex;
    if (updatedList.length === 0) {
      newTurnIndex = -1;
    } else if (currentTurnIndex >= updatedList.length) {
      newTurnIndex = 0;
    } else if (targetIdx <= currentTurnIndex && currentTurnIndex > 0) {
      newTurnIndex = currentTurnIndex - 1;
    }

    broadcastUpdateInitiative?.(updatedList, newTurnIndex);
  };

  const handleNextTurn = () => {
    if (initiativeList.length === 0) return;
    const nextIndex = (currentTurnIndex + 1) % initiativeList.length;
    broadcastUpdateInitiative?.(initiativeList, nextIndex);
  };

  const handlePrevTurn = () => {
    if (initiativeList.length === 0) return;
    const prevIndex = currentTurnIndex <= 0 ? initiativeList.length - 1 : currentTurnIndex - 1;
    broadcastUpdateInitiative?.(initiativeList, prevIndex);
  };

  const handleClearAll = () => {
    broadcastUpdateInitiative?.([], -1);
  };

  return (
    <div className="space-y-4 p-3 bg-black/20 rounded border border-white/5 font-sans" data-testid="initiative-panel">
      {/* Quick Add Form - available to host or any session player */}
      <form onSubmit={addCombatant} className="space-y-2">
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <Label className="text-[10px] uppercase text-gray-500 font-mono">Combatant</Label>
            <Input
              type="text"
              placeholder="e.g. Goblin King"
              value={combatantName}
              onChange={(e) => setCombatantName(e.target.value)}
              className="h-8 text-xs bg-black/40 border-white/5 focus:border-[#c3a35a]"
              data-testid="combatant-name-input"
            />
          </div>
          <div className="w-16 space-y-1">
            <Label className="text-[10px] uppercase text-gray-500 font-mono">Roll</Label>
            <Input
              type="number"
              placeholder="12"
              value={initiativeVal}
              onChange={(e) => setInitiativeVal(e.target.value)}
              className="h-8 text-xs font-mono bg-black/40 border-white/5 focus:border-[#c3a35a]"
              data-testid="initiative-value-input"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            className="h-8 bg-[#c3a35a] hover:bg-[#c3a35a]/85 text-black font-semibold px-3"
            data-testid="add-combatant-btn"
          >
            <UserPlus className="w-4 h-4" />
          </Button>
        </div>
      </form>

      {/* Combatant List */}
      {initiativeList.length > 0 ? (
        <div className="space-y-2">
          {/* Turn control buttons (Host/Active users only) */}
          {isHost && (
            <div className="flex justify-between items-center bg-white/5 rounded-sm p-1 border border-white/5 gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrevTurn}
                className="h-7 px-2 text-[10px] text-gray-400 hover:text-white"
                data-testid="prev-turn-btn"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                Prev
              </Button>
              <span className="text-[10px] font-mono text-[#c3a35a] uppercase font-bold tracking-wider">
                Turn {currentTurnIndex + 1} of {initiativeList.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNextTurn}
                className="h-7 px-2 text-[10px] text-gray-400 hover:text-white"
                data-testid="next-turn-btn"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          )}

          {/* List display */}
          <div className="space-y-1 max-h-[180px] overflow-y-auto pr-1">
            {initiativeList.map((item, index) => {
              const isActive = index === currentTurnIndex;
              return (
                <div
                  key={item.id}
                  className={`p-2 rounded flex items-center justify-between border transition-all ${
                    isActive
                      ? 'bg-[#c3a35a]/10 border-[#c3a35a] shadow-[0_0_8px_rgba(195,163,90,0.15)]'
                      : 'bg-white/5 border-white/5'
                  }`}
                  data-testid={`combatant-${item.id}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isActive ? (
                      <ArrowRight className="w-3.5 h-3.5 text-[#c3a35a] animate-pulse shrink-0" />
                    ) : (
                      <div className="w-3.5" />
                    )}
                    <span className={`text-xs font-medium truncate ${isActive ? 'text-[#c3a35a] font-bold' : 'text-gray-300'}`}>
                      {item.name}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-white bg-black/40 px-2 py-0.5 rounded border border-white/5">
                      {item.value}
                    </span>
                    {isHost && (
                      <button
                        onClick={() => removeCombatant(item.id)}
                        className="text-gray-500 hover:text-red-400 transition-colors"
                        title="Remove combatant"
                        data-testid={`remove-combatant-${item.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Clear board trigger */}
          {isHost && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleClearAll}
                className="text-[10px] font-mono text-red-400/70 hover:text-red-300 uppercase tracking-widest"
                data-testid="clear-initiative-btn"
              >
                [ RESET TURN ORDER ]
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4 bg-white/5 rounded border border-dashed border-white/10">
          <Sword className="w-5 h-5 text-gray-600 mx-auto mb-1" />
          <p className="text-[11px] text-gray-500">No combatants scribe in turn order yet.</p>
        </div>
      )}
    </div>
  );
};

export default InitiativeTrackerPanel;
