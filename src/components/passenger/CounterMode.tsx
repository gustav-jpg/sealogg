import { useState, useRef, useCallback } from 'react';
import { X, Plus, Minus, ChevronRight, Users, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHaptics } from '@/hooks/useHaptics';
import { toast } from 'sonner';

// Short blip sound via Web Audio API
function playBlip(type: 'on' | 'off') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = type === 'on' ? 880 : 440;
    gain.gain.value = 0.12;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.stop(ctx.currentTime + 0.1);
  } catch {
    // Audio not available
  }
}

interface CounterModeProps {
  dockName: string;
  currentOnboard: number;
  maxPassengers?: number | null;
  isActive: boolean;
  onSave: (paxOn: number, paxOff: number) => Promise<void>;
  onClose: () => void;
}

export function CounterMode({
  dockName,
  currentOnboard,
  maxPassengers,
  isActive,
  onSave,
  onClose,
}: CounterModeProps) {
  const [paxOn, setPaxOn] = useState(0);
  const [paxOff, setPaxOff] = useState(0);
  const [saving, setSaving] = useState(false);
  const { impact } = useHaptics();

  const projected = currentOnboard + paxOn - paxOff;
  const overCapacity = maxPassengers != null && projected > maxPassengers;

  const handleTap = useCallback((action: 'on+' | 'on-' | 'off+' | 'off-') => {
    impact('light');
    switch (action) {
      case 'on+':
        playBlip('on');
        setPaxOn(v => v + 1);
        break;
      case 'on-':
        playBlip('off');
        setPaxOn(v => Math.max(0, v - 1));
        break;
      case 'off+':
        playBlip('on');
        setPaxOff(v => v + 1);
        break;
      case 'off-':
        playBlip('off');
        setPaxOff(v => Math.max(0, v - 1));
        break;
    }
  }, [impact]);

  const handleSave = async () => {
    if (!isActive) return;
    if (paxOn === 0 && paxOff === 0) {
      toast.error('Ange minst en påstigande eller avstigande');
      return;
    }
    setSaving(true);
    try {
      await onSave(paxOn, paxOff);
      setPaxOn(0);
      setPaxOff(0);
      impact('medium');
    } catch {
      toast.error('Kunde inte spara');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Brygga</p>
          <h2 className="text-xl font-bold truncate">{dockName || 'Ingen brygga'}</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className={`text-2xl font-bold tabular-nums ${overCapacity ? 'text-destructive' : 'text-foreground'}`}>
              {projected}
            </div>
            <p className="text-[10px] text-muted-foreground">ombord</p>
          </div>
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {overCapacity && (
        <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 flex items-center gap-2 text-destructive text-sm font-medium">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          Max {maxPassengers} passagerare överskrids!
        </div>
      )}

      {/* Counter sections */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Påstigande */}
        <div className="flex-1 flex flex-col items-center justify-center border-b px-4 py-2 min-h-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Påstigande</p>
          <div className="flex items-center gap-4 w-full max-w-xs">
            <button
              type="button"
              onClick={() => handleTap('on-')}
              disabled={paxOn === 0}
              className="h-20 w-20 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center active:scale-95 transition-transform disabled:opacity-30 flex-shrink-0"
              aria-label="Minska påstigande"
            >
              <Minus className="h-10 w-10" strokeWidth={3} />
            </button>
            <div className="flex-1 text-center">
              <span className="text-6xl font-bold tabular-nums text-foreground">{paxOn}</span>
            </div>
            <button
              type="button"
              onClick={() => handleTap('on+')}
              className="h-20 w-20 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center active:scale-95 transition-transform flex-shrink-0"
              aria-label="Öka påstigande"
            >
              <Plus className="h-10 w-10" strokeWidth={3} />
            </button>
          </div>
        </div>

        {/* Avstigande */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-2 min-h-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Avstigande</p>
          <div className="flex items-center gap-4 w-full max-w-xs">
            <button
              type="button"
              onClick={() => handleTap('off-')}
              disabled={paxOff === 0}
              className="h-20 w-20 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center active:scale-95 transition-transform disabled:opacity-30 flex-shrink-0"
              aria-label="Minska avstigande"
            >
              <Minus className="h-10 w-10" strokeWidth={3} />
            </button>
            <div className="flex-1 text-center">
              <span className="text-6xl font-bold tabular-nums text-foreground">{paxOff}</span>
            </div>
            <button
              type="button"
              onClick={() => handleTap('off+')}
              className="h-20 w-20 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center active:scale-95 transition-transform flex-shrink-0"
              aria-label="Öka avstigande"
            >
              <Plus className="h-10 w-10" strokeWidth={3} />
            </button>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="px-4 py-3 border-t bg-muted/40">
        <Button
          onClick={handleSave}
          disabled={!isActive || saving || (paxOn === 0 && paxOff === 0)}
          className="w-full h-14 text-base font-semibold gap-2"
          size="lg"
        >
          {saving ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground" />
          ) : (
            <>
              <ChevronRight className="h-5 w-5" />
              Spara & nästa brygga
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
