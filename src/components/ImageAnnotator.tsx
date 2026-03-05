import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Pencil, Undo2, Trash2, Check, X } from 'lucide-react';

interface ImageAnnotatorProps {
  file: File;
  onSave: (annotatedFile: File) => void;
  onCancel: () => void;
  open: boolean;
}

interface DrawPoint {
  x: number;
  y: number;
}

interface DrawPath {
  points: DrawPoint[];
  color: string;
  lineWidth: number;
}

export function ImageAnnotator({ file, onSave, onCancel, open }: ImageAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [paths, setPaths] = useState<DrawPath[]>([]);
  const [currentPath, setCurrentPath] = useState<DrawPath | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Load image when file changes
  useEffect(() => {
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.onerror = () => {
      console.error('Failed to load image for annotation');
      setImageLoaded(false);
    };
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  // Set canvas size based on container and image - responsive
  useEffect(() => {
    if (!imageLoaded || !imageRef.current || !containerRef.current) return;

    const updateSize = () => {
      const container = containerRef.current;
      const img = imageRef.current;
      if (!container || !img) return;

      // Responsive max dimensions based on viewport
      const isMobile = window.innerWidth < 640;
      const isTablet = window.innerWidth < 1024;
      
      const maxWidth = container.clientWidth - (isMobile ? 16 : 32);
      const maxHeight = isMobile 
        ? window.innerHeight * 0.4 
        : isTablet 
          ? window.innerHeight * 0.5 
          : window.innerHeight * 0.6;

      let width = img.naturalWidth;
      let height = img.naturalHeight;

      // Scale down if needed
      if (width > maxWidth) {
        const ratio = maxWidth / width;
        width = maxWidth;
        height = height * ratio;
      }

      if (height > maxHeight) {
        const ratio = maxHeight / height;
        height = maxHeight;
        width = width * ratio;
      }

      setCanvasSize({ width, height });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [imageLoaded]);

  // Draw everything on canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imageRef.current;

    if (!canvas || !ctx || !img || canvasSize.width === 0) return;

    // Clear and draw image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw all saved paths
    paths.forEach((path) => {
      if (path.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(path.points[0].x, path.points[0].y);
      path.points.forEach((point) => {
        ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
    });

    // Draw current path
    if (currentPath && currentPath.points.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = currentPath.color;
      ctx.lineWidth = currentPath.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(currentPath.points[0].x, currentPath.points[0].y);
      currentPath.points.forEach((point) => {
        ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
    }
  }, [paths, currentPath, canvasSize]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent): DrawPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const point = getCanvasCoords(e);
    if (!point) return;

    setIsDrawing(true);
    setCurrentPath({
      points: [point],
      color: '#ef4444', // Red color
      lineWidth: 4,
    });
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing || !currentPath) return;

    const point = getCanvasCoords(e);
    if (!point) return;

    setCurrentPath({
      ...currentPath,
      points: [...currentPath.points, point],
    });
  };

  const stopDrawing = () => {
    if (isDrawing && currentPath && currentPath.points.length > 1) {
      setPaths([...paths, currentPath]);
    }
    setIsDrawing(false);
    setCurrentPath(null);
  };

  const handleUndo = () => {
    setPaths(paths.slice(0, -1));
  };

  const handleClear = () => {
    setPaths([]);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || canvasSize.width === 0) return;

    // Create a memory-safe off-screen canvas for export
    const maxDimension = 2048;
    const largestSide = Math.max(img.naturalWidth, img.naturalHeight);
    const exportScale = largestSide > maxDimension ? maxDimension / largestSide : 1;
    const exportWidth = Math.max(1, Math.round(img.naturalWidth * exportScale));
    const exportHeight = Math.max(1, Math.round(img.naturalHeight * exportScale));

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = exportWidth;
    exportCanvas.height = exportHeight;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    // Draw original image within the safe export size
    ctx.drawImage(img, 0, 0, exportWidth, exportHeight);

    // Scale factor from display canvas to export canvas
    const scaleX = exportWidth / canvasSize.width;
    const scaleY = exportHeight / canvasSize.height;

    // Redraw all paths scaled to full resolution
    paths.forEach((path) => {
      if (path.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.lineWidth * Math.max(scaleX, scaleY);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(path.points[0].x * scaleX, path.points[0].y * scaleY);
      path.points.forEach((point) => {
        ctx.lineTo(point.x * scaleX, point.y * scaleY);
      });
      ctx.stroke();
    });

    exportCanvas.toBlob((blob) => {
      if (!blob) return;
      const annotatedFile = new File([blob], file.name, { type: 'image/png' });
      onSave(annotatedFile);
    }, 'image/png');
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[95vh] sm:max-h-[90vh] flex flex-col p-3 sm:p-6">
        <DialogHeader className="pb-2 sm:pb-4">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Pencil className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
            Markera på bilden
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto min-h-0" ref={containerRef}>
          <div className="flex justify-center">
            {canvasSize.width > 0 && (
              <canvas
                ref={canvasRef}
                width={canvasSize.width}
                height={canvasSize.height}
                className="border border-border rounded-lg cursor-crosshair touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-3 sm:pt-4 border-t">
          <div className="flex gap-2 justify-center sm:justify-start">
            <Button
              variant="outline"
              size="sm"
              onClick={handleUndo}
              disabled={paths.length === 0}
            >
              <Undo2 className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Ångra</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={paths.length === 0}
            >
              <Trash2 className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Rensa</span>
            </Button>
          </div>

          <div className="flex gap-2 justify-center sm:justify-end">
            <Button variant="outline" size="sm" onClick={onCancel}>
              <X className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Avbryt</span>
            </Button>
            <Button size="sm" onClick={handleSave}>
              <Check className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Spara</span>
              <span className="sm:hidden">Spara</span>
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center hidden sm:block">
          Rita med röd penna för att markera läckage, skador eller andra problem
        </p>
      </DialogContent>
    </Dialog>
  );
}
