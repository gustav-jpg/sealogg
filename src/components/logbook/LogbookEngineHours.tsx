import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Gauge, Plus, Pencil, Droplets, X } from 'lucide-react';
import { EngineHourEntry, EngineRefill } from '@/lib/logbook-types';

interface LogbookEngineHoursProps {
  editableEngineHours: EngineHourEntry[];
  engineHours: any[] | undefined;
  vesselEngineHours: any[] | undefined;
  isOpen: boolean;
  canEditThis: boolean;
  onUpdateEngineHour: (tempId: string, field: keyof EngineHourEntry, value: any) => void;
  onInitializeFromVessel: () => void;
}

function RefillButton({ entry, canEdit, onUpdate }: { entry: EngineHourEntry; canEdit: boolean; onUpdate: (tempId: string, field: keyof EngineHourEntry, value: any) => void }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'olja' | 'glykol'>('olja');
  const [liters, setLiters] = useState('');

  const addRefill = () => {
    if (!liters || Number(liters) <= 0) return;
    const newRefill: EngineRefill = {
      tempId: crypto.randomUUID(),
      refillType: type,
      liters: Number(liters),
    };
    onUpdate(entry.tempId, 'refills', [...entry.refills, newRefill]);
    setLiters('');
    setOpen(false);
  };

  const removeRefill = (refillTempId: string) => {
    onUpdate(entry.tempId, 'refills', entry.refills.filter(r => r.tempId !== refillTempId));
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1 flex-wrap">
        {entry.refills.map(r => (
          <Badge key={r.tempId} variant="secondary" className="text-xs gap-1">
            <Droplets className="h-3 w-3" />
            {r.liters}L {r.refillType === 'olja' ? 'olja' : 'glykol'}
            {canEdit && (
              <button onClick={() => removeRefill(r.tempId)} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
        {canEdit && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-6 px-2 text-xs">
                <Droplets className="h-3 w-3 mr-1" />
                Påfyllning
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3 space-y-3" align="start">
              <p className="text-sm font-medium">Lägg till påfyllning</p>
              <div className="space-y-2">
                <Select value={type} onValueChange={(v: 'olja' | 'glykol') => setType(v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="olja">Olja</SelectItem>
                    <SelectItem value="glykol">Glykol</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Liter</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={liters}
                      onChange={e => setLiters(e.target.value)}
                      placeholder="0"
                      className="h-8 text-xs"
                    />
                  </div>
                  <Button size="sm" className="h-8" onClick={addRefill} disabled={!liters || Number(liters) <= 0}>
                    <Plus className="h-3 w-3 mr-1" />
                    Lägg till
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}

export function LogbookEngineHours({
  editableEngineHours, engineHours, vesselEngineHours,
  isOpen, canEditThis, onUpdateEngineHour, onInitializeFromVessel,
}: LogbookEngineHoursProps) {
  return (
    <Card>
      <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
        <CardTitle className="flex items-center justify-between text-base sm:text-lg">
          <span className="flex items-center gap-2">
            <Gauge className="h-4 w-4 sm:h-5 sm:w-5" />
            Maskintimmar
          </span>
          {canEditThis && editableEngineHours.length > 0 && (
            <Button variant="outline" size="sm" onClick={onInitializeFromVessel}>
              <Pencil className="h-4 w-4 mr-1" />
              Redigera
            </Button>
          )}
          {canEditThis && editableEngineHours.length === 0 && vesselEngineHours && vesselEngineHours.length > 0 && (
            <Button variant="outline" size="sm" onClick={onInitializeFromVessel}>
              <Plus className="h-4 w-4 mr-1" />
              Hämta maskindata
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        {isOpen && canEditThis ? (
          editableEngineHours.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground">Inga maskintimmar registrerade.</p>
              {vesselEngineHours && vesselEngineHours.length > 0 && (
                <Button variant="outline" size="sm" className="mt-2" onClick={onInitializeFromVessel}>
                  <Plus className="h-4 w-4 mr-1" />
                  Hämta maskindata
                </Button>
              )}
              {(!vesselEngineHours || vesselEngineHours.length === 0) && (
                <p className="text-xs text-muted-foreground mt-2">
                  Fartyget har inga motorer konfigurerade.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {editableEngineHours.map(entry => (
                <div key={entry.tempId} className="space-y-1">
                  <Label className="text-sm font-medium">{entry.engineLabel}</Label>
                  <div className="grid grid-cols-3 gap-2 items-end sm:flex">
                    <div className="space-y-1 sm:w-24">
                      <Label className="text-xs">Start</Label>
                      <Input 
                        type="number" 
                        min="0"
                        value={entry.startHours === 0 ? '' : entry.startHours} 
                        onChange={e => {
                          const val = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0);
                          onUpdateEngineHour(entry.tempId, 'startHours', val);
                        }} 
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1 sm:w-24">
                      <Label className="text-xs">Stopp</Label>
                      <Input 
                        type="number" 
                        min="0"
                        value={entry.stopHours === null ? '' : (entry.stopHours === 0 ? '' : entry.stopHours)} 
                        onChange={e => {
                          const val = e.target.value === '' ? null : Math.max(0, parseInt(e.target.value) || 0);
                          onUpdateEngineHour(entry.tempId, 'stopHours', val);
                        }} 
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1 sm:w-20">
                      <Label className="text-xs">Diff</Label>
                      <div className="h-10 flex items-center px-3 bg-muted rounded-md text-sm font-mono">
                        {entry.stopHours !== null ? `${(entry.stopHours || 0) - entry.startHours}h` : '—'}
                      </div>
                    </div>
                    <div className="col-span-2 sm:col-span-1 sm:flex-1 space-y-1">
                      <Label className="text-xs">Anteckning</Label>
                      <Input 
                        value={entry.notes} 
                        onChange={e => onUpdateEngineHour(entry.tempId, 'notes', e.target.value)}
                        className="text-xs h-10"
                      />
                    </div>
                    <div className="col-span-1 sm:col-span-1 sm:w-auto space-y-1 flex flex-col justify-end">
                      <RefillButton entry={entry} canEdit={true} onUpdate={onUpdateEngineHour} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          engineHours && engineHours.length > 0 ? (
            <div className="space-y-2">
              {engineHours.map((entry: any) => {
                const matchingEditable = editableEngineHours.find(
                  e => e.engineType === entry.engine_type && e.engineNumber === (entry.engine_number || 1)
                );
                return (
                  <div key={entry.id} className="p-2 rounded bg-muted/50 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {entry.engine_name || (entry.engine_type === 'auxiliary' 
                          ? `Hjälpmaskin ${entry.engine_number}` 
                          : `Huvudmaskin ${entry.engine_number || 1}`)}
                      </span>
                      <Badge variant="outline">{(entry.stop_hours ?? 0) - (entry.start_hours ?? 0)}h</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{entry.start_hours} → {entry.stop_hours ?? '—'}</span>
                      {entry.notes && <span>· {entry.notes}</span>}
                    </div>
                    {matchingEditable && matchingEditable.refills.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-1">
                        {matchingEditable.refills.map(r => (
                          <Badge key={r.tempId} variant="secondary" className="text-xs gap-1">
                            <Droplets className="h-3 w-3" />
                            {r.liters}L {r.refillType === 'olja' ? 'olja' : 'glykol'}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">Inga maskintimmar registrerade.</p>
          )
        )}
      </CardContent>
    </Card>
  );
}
