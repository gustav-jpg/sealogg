import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { CheckCircle2, AlertCircle, ScanLine, Keyboard } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Bookings visible in the current view, used to validate scans */
  candidates: Array<{
    id: string;
    booking_number: string;
    customer_name: string | null;
    total_passengers: number;
    checked_in_at: string | null;
  }>;
  /** Optional invalidation key to refresh after check-in */
  invalidateKey?: string;
}

type LastResult =
  | { kind: 'success'; name: string; pax: number; alreadyIn: boolean }
  | { kind: 'unknown'; code: string }
  | null;

export function ScanCheckInDialog({ open, onOpenChange, candidates, invalidateKey = 'today-runs' }: Props) {
  const containerId = 'qr-scanner-' + Math.random().toString(36).slice(2, 8);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);
  const [last, setLast] = useState<LastResult>(null);
  const [manual, setManual] = useState('');
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleCode = async (raw: string) => {
    const code = raw.trim().toUpperCase();
    const now = Date.now();
    if (lastScanRef.current && lastScanRef.current.code === code && now - lastScanRef.current.at < 2500) return;
    lastScanRef.current = { code, at: now };

    const match = candidates.find((b) => (b.booking_number || '').toUpperCase() === code);
    if (!match) {
      setLast({ kind: 'unknown', code });
      toast.error(`Bokning ${code} hittades inte i denna vy`);
      return;
    }
    if (match.checked_in_at) {
      setLast({ kind: 'success', name: match.customer_name || code, pax: match.total_passengers, alreadyIn: true });
      toast.info(`${match.customer_name || code} är redan incheckad`);
      return;
    }
    const { error } = await supabase
      .from('bookings')
      .update({ checked_in_at: new Date().toISOString(), checked_in_count: match.total_passengers } as any)
      .eq('id', match.id);
    if (error) {
      toast.error('Kunde inte checka in', { description: error.message });
      return;
    }
    setLast({ kind: 'success', name: match.customer_name || code, pax: match.total_passengers, alreadyIn: false });
    toast.success(`Incheckad: ${match.customer_name || code} (${match.total_passengers} pax)`);
    queryClient.invalidateQueries({ queryKey: [invalidateKey] });
  };

  useEffect(() => {
    if (!open || mode !== 'camera') return;
    let cancelled = false;
    setCameraError(null);
    const start = async () => {
      try {
        const inst = new Html5Qrcode(containerId);
        scannerRef.current = inst;
        await inst.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => { if (!cancelled) handleCode(decoded); },
          () => {}
        );
      } catch (e: any) {
        if (!cancelled) setCameraError(e?.message || 'Kunde inte starta kameran');
      }
    };
    start();
    return () => {
      cancelled = true;
      const inst = scannerRef.current;
      if (inst) {
        inst.stop().then(() => inst.clear()).catch(() => {});
        scannerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manual.trim()) return;
    handleCode(manual);
    setManual('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5" />Skanna QR för incheckning</DialogTitle>
          <DialogDescription>Rikta kameran mot kundens QR-kod eller skriv in bokningsnumret.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 rounded-md bg-muted p-1 text-xs">
          <button onClick={() => setMode('camera')} className={`flex-1 rounded px-2 py-1 transition ${mode === 'camera' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}>Kamera</button>
          <button onClick={() => setMode('manual')} className={`flex-1 rounded px-2 py-1 transition ${mode === 'manual' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}>Manuell</button>
        </div>

        {mode === 'camera' ? (
          <div>
            <div id={containerId} className="w-full rounded-lg overflow-hidden border bg-black aspect-square" />
            {cameraError && (
              <div className="mt-2 text-xs text-destructive flex items-start gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{cameraError}. Använd manuell inmatning istället.</span>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={submitManual} className="flex gap-2">
            <Input
              autoFocus
              placeholder="BK-XXXXXXXX"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              className="font-mono uppercase"
            />
            <Button type="submit"><Keyboard className="h-4 w-4 mr-1" />Checka in</Button>
          </form>
        )}

        {last && (
          <div className={`rounded-md border p-3 text-sm flex items-start gap-2 ${
            last.kind === 'success'
              ? last.alreadyIn ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300'
                : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
              : 'border-destructive/40 bg-destructive/10 text-destructive'
          }`}>
            {last.kind === 'success' ? <CheckCircle2 className="h-4 w-4 mt-0.5" /> : <AlertCircle className="h-4 w-4 mt-0.5" />}
            <div className="flex-1">
              {last.kind === 'success' ? (
                <>
                  <div className="font-semibold">{last.alreadyIn ? 'Redan incheckad' : 'Incheckad ✓'}</div>
                  <div>{last.name} · {last.pax} pax</div>
                </>
              ) : (
                <>
                  <div className="font-semibold">Hittades inte</div>
                  <div className="font-mono text-xs">{last.code}</div>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
