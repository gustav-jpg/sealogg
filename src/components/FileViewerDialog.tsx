import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink, Download, X } from 'lucide-react';
import { useFileViewer, closeFileViewer, detectKind } from '@/lib/file-viewer';

export function FileViewerDialog() {
  const file = useFileViewer();
  const open = !!file;

  if (!file) {
    return (
      <Dialog open={false} onOpenChange={() => closeFileViewer()}>
        <DialogContent />
      </Dialog>
    );
  }

  const kind = file.kind ?? detectKind(file.url, file.fileName);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeFileViewer()}>
      <DialogContent
        className="max-w-[96vw] sm:max-w-5xl w-[96vw] h-[92vh] p-0 gap-0 flex flex-col bg-background overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/50">
          <p className="text-sm font-medium truncate flex-1">
            {file.fileName || 'Förhandsvisning'}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              asChild
              title="Öppna i ny flik"
            >
              <a href={file.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              asChild
              title="Ladda ner"
            >
              <a href={file.url} download={file.fileName || ''}>
                <Download className="h-4 w-4" />
              </a>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => closeFileViewer()}
              title="Stäng"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 bg-black/5 dark:bg-black/40 overflow-auto flex items-center justify-center">
          {kind === 'image' && (
            <img
              src={file.url}
              alt={file.fileName || 'Bild'}
              className="max-w-full max-h-full object-contain"
            />
          )}
          {kind === 'pdf' && (
            <iframe
              src={file.url}
              title={file.fileName || 'PDF'}
              className="w-full h-full border-0 bg-background"
            />
          )}
          {kind === 'other' && (
            <div className="p-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Den här filtypen kan inte förhandsvisas i appen.
              </p>
              <Button asChild>
                <a href={file.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Öppna fil
                </a>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}