import { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Download, Printer, QrCode } from 'lucide-react';

interface Vessel {
  id: string;
  name: string;
}

interface ChecklistQRCodeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  templateName: string;
  vessels: Vessel[];
  appliesToAll: boolean;
  assignedVesselIds?: string[];
}

export function ChecklistQRCode({
  open,
  onOpenChange,
  templateId,
  templateName,
  vessels,
  appliesToAll,
  assignedVesselIds = [],
}: ChecklistQRCodeProps) {
  const [selectedVesselId, setSelectedVesselId] = useState<string>('');
  const qrRef = useRef<HTMLDivElement>(null);

  // Filter vessels based on template assignment
  const availableVessels = appliesToAll 
    ? vessels 
    : vessels.filter(v => assignedVesselIds.includes(v.id));

  const selectedVessel = vessels.find(v => v.id === selectedVesselId);

  // Generate the URL for the QR code
  const baseUrl = window.location.origin;
  const qrUrl = selectedVesselId 
    ? `${baseUrl}/portal/checklists/execute?template=${templateId}&vessel=${selectedVesselId}`
    : '';

  const handleDownload = () => {
    if (!qrRef.current) return;
    
    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    // Create a canvas to convert SVG to PNG
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    
    img.onload = () => {
      canvas.width = 400;
      canvas.height = 400;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, 400, 400);
      
      const link = document.createElement('a');
      const vesselName = selectedVessel?.name || 'unknown';
      link.download = `QR-${templateName}-${vesselName}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const vesselName = selectedVessel?.name || '';
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR-kod: ${templateName}</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              font-family: system-ui, -apple-system, sans-serif;
              padding: 40px;
              box-sizing: border-box;
            }
            .container {
              text-align: center;
              border: 2px solid #e5e7eb;
              border-radius: 16px;
              padding: 40px;
              max-width: 400px;
            }
            h1 {
              font-size: 24px;
              margin: 0 0 8px 0;
              color: #111827;
            }
            .vessel {
              font-size: 18px;
              color: #6b7280;
              margin: 0 0 24px 0;
            }
            .qr-container {
              background: white;
              padding: 20px;
              display: inline-block;
              border-radius: 8px;
            }
            .instructions {
              margin-top: 24px;
              font-size: 14px;
              color: #6b7280;
            }
            @media print {
              body {
                padding: 20px;
              }
              .container {
                border: 1px solid #d1d5db;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${templateName}</h1>
            <p class="vessel">${vesselName}</p>
            <div class="qr-container">
              ${qrRef.current?.innerHTML || ''}
            </div>
            <p class="instructions">
              Scanna QR-koden med din mobil för att starta checklistan
            </p>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            QR-kod för {templateName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Välj fartyg</Label>
            <Select value={selectedVesselId} onValueChange={setSelectedVesselId}>
              <SelectTrigger>
                <SelectValue placeholder="Välj fartyg för QR-koden..." />
              </SelectTrigger>
              <SelectContent>
                {availableVessels.map((vessel) => (
                  <SelectItem key={vessel.id} value={vessel.id}>
                    {vessel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Varje QR-kod är kopplad till ett specifikt fartyg
            </p>
          </div>

          {selectedVesselId && (
            <>
              <div 
                ref={qrRef}
                className="flex justify-center p-6 bg-white rounded-lg border"
              >
                <QRCodeSVG
                  value={qrUrl}
                  size={200}
                  level="H"
                  includeMargin={false}
                />
              </div>

              <div className="text-center text-sm text-muted-foreground">
                <p className="font-medium">{selectedVessel?.name}</p>
                <p className="text-xs mt-1 break-all">{qrUrl}</p>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={handleDownload}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Ladda ner
                </Button>
                <Button 
                  className="flex-1"
                  onClick={handlePrint}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Skriv ut
                </Button>
              </div>
            </>
          )}

          {!selectedVesselId && availableVessels.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>Inga fartyg tillgängliga för denna checklista</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
