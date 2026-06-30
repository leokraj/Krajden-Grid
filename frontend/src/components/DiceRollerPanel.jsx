import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dices, Trash2 } from 'lucide-react';

export const DiceRollerPanel = ({
  diceRolls = [],
  broadcastRollDice,
  broadcastClearDiceRolls,
  userName = 'Adventurer',
  isHost = true
}) => {
  const [modifier, setModifier] = useState(0);
  const [count, setCount] = useState(1);

  const diceTypes = [
    { label: 'd4', value: 4 },
    { label: 'd6', value: 6 },
    { label: 'd8', value: 8 },
    { label: 'd10', value: 10 },
    { label: 'd12', value: 12 },
    { label: 'd20', value: 20 },
    { label: 'd100', value: 100 },
  ];

  const rollDice = (sides) => {
    const rolls = [];
    let sum = 0;
    for (let i = 0; i < Math.min(100, Math.max(1, count)); i++) {
      const roll = Math.floor(Math.random() * sides) + 1;
      rolls.push(roll);
      sum += roll;
    }
    const total = sum + Number(modifier);

    const rollData = {
      type: `${count}d${sides}`,
      rolls,
      modifier: Number(modifier),
      total,
      sides,
      user: userName
    };

    broadcastRollDice?.(rollData);
  };

  return (
    <div className="space-y-4 p-3 bg-black/20 rounded border border-white/5 font-sans" data-testid="dice-roller-panel">
      {/* Dice Type Grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {diceTypes.map((die) => (
          <Button
            key={die.value}
            variant="outline"
            size="sm"
            onClick={() => rollDice(die.value)}
            className="h-9 text-xs font-mono border-white/5 hover:border-[#c3a35a]/40 bg-white/5 text-gray-200"
            data-testid={`roll-${die.label}`}
          >
            {die.label}
          </Button>
        ))}
      </div>

      {/* Controls: Count & Modifier */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[10px] uppercase text-gray-500 font-mono">Count</Label>
          <Input
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
            className="h-8 text-xs font-mono bg-black/40 border-white/5 focus:border-[#c3a35a]"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase text-gray-500 font-mono">Modifier</Label>
          <Input
            type="number"
            value={modifier}
            onChange={(e) => setModifier(parseInt(e.target.value) || 0)}
            className="h-8 text-xs font-mono bg-black/40 border-white/5 focus:border-[#c3a35a]"
          />
        </div>
      </div>

      {/* Roll Logs */}
      {diceRolls.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase text-gray-500 font-mono flex items-center gap-1">
              <Dices className="w-3 h-3 text-[#c3a35a]" />
              Roll Archives
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={broadcastClearDiceRolls}
              className="h-5 text-[10px] text-red-400 hover:text-red-300 px-1 hover:bg-transparent"
              title="Clear rolls"
              data-testid="clear-dice-rolls"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>

          <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
            {diceRolls.slice().reverse().map((roll) => (
              <div 
                key={roll.id} 
                className="p-2 bg-white/5 rounded text-xs border border-white/5 flex flex-col gap-0.5"
                data-testid={`dice-roll-${roll.id}`}
              >
                <div className="flex justify-between items-center text-[10px] text-gray-400 font-mono">
                  <span>{roll.user || 'Adventurer'}</span>
                  <span className="text-[#c3a35a] font-bold">{roll.type}</span>
                </div>
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-[11px] text-gray-300 truncate">
                    [{roll.rolls.join(', ')}] {roll.modifier !== 0 ? `${roll.modifier > 0 ? '+' : ''}${roll.modifier}` : ''}
                  </span>
                  <span className="text-sm font-bold text-white font-mono shrink-0">
                    {roll.total}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DiceRollerPanel;
