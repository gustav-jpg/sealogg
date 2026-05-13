import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { QrCode } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  bookingNumber: string;
  customerName?: string | null;
  size?: 'sm' | 'md';
  variant?: 'icon' | 'button';
  className?: string;
}

export function BookingQrButton({ bookingNumber, customerName, size = 'sm', variant = 'icon', className }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          className={cn('p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition', className)}
          title="Visa QR-kod för incheckning"
        >
          <QrCode className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </button>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setOpen(true); }} className={className}>
          <QrCode className="h-4 w-4 mr-1.5" />QR
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Incheckning · QR-kod</DialogTitle>
            <DialogDescription>Visa denna kod för befälhavaren vid incheckning.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="rounded-lg bg-white p-4 shadow-sm border">
              <QRCodeSVG value={bookingNumber} size={220} level="M" />
            </div>
            {customerName && <div className="text-sm font-medium">{customerName}</div>}
            <div className="font-mono text-base font-semibold tabular-nums">{bookingNumber}</div>
            <p className="text-xs text-muted-foreground text-center">
              Befälhavaren skannar koden med "Skanna QR" i Dagens körningar.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
