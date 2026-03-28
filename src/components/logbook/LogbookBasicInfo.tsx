import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Ship, User, Fuel, Droplets, Trash, X, Wind, Loader2, Droplet } from 'lucide-react';
import { QuickEntry } from '@/lib/logbook-types';

interface LogbookBasicInfoProps {
  weather: string;
  wind: string;
  generalNotes: string;
  bunkerLiters: string;
  quickEntries: QuickEntry[];
  canEditThis: boolean;
  creatorName: string;
  fetchingWind: boolean;
  onWeatherChange: (v: string) => void;
  onWindChange: (v: string) => void;
  onGeneralNotesChange: (v: string) => void;
  onBunkerLitersChange: (v: string) => void;
  onFetchWind: () => void;
  onOpenBunkerDialog: () => void;
  onAddFarskvatten: () => void;
  onAddSeptik: () => void;
  onRemoveQuickEntry: (entry: QuickEntry) => void;
}

export function LogbookBasicInfo({
  weather, wind, generalNotes, bunkerLiters, quickEntries,
  canEditThis, creatorName, fetchingWind,
  onWeatherChange, onWindChange, onGeneralNotesChange, onBunkerLitersChange,
  onFetchWind, onOpenBunkerDialog, onAddFarskvatten, onAddSeptik, onRemoveQuickEntry,
}: LogbookBasicInfoProps) {
  return (
    <Card>
      <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Ship className="h-4 w-4 sm:h-5 sm:w-5" />
          Grunduppgifter
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-3 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="weather">Väder</Label>
            <Input
              id="weather"
              value={weather}
              onChange={e => onWeatherChange(e.target.value)}
              disabled={!canEditThis}
              placeholder="T.ex. Soligt, 18°C"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wind">Vind</Label>
            <div className="flex gap-2">
              <Input
                id="wind"
                value={wind}
                onChange={e => onWindChange(e.target.value)}
                disabled={!canEditThis}
                placeholder="T.ex. SV 5 m/s"
                className="flex-1"
              />
              {canEditThis && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={onFetchWind}
                  disabled={fetchingWind}
                  title="Hämta vinddata från Blockhusudden (Sjöfartsverket)"
                >
                  {fetchingWind ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wind className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="bunker">Nuvarande bunkernivå (liter)</Label>
          <Input
            id="bunker"
            type="number"
            value={bunkerLiters}
            onChange={e => onBunkerLitersChange(e.target.value)}
            disabled={!canEditThis}
            placeholder="T.ex. 500"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="notes">Allmänna anteckningar</Label>
          <Textarea
            id="notes"
            value={generalNotes}
            onChange={e => onGeneralNotesChange(e.target.value)}
            disabled={!canEditThis}
            rows={2}
          />
          {canEditThis && (
            <div className="flex gap-2 flex-wrap pt-1">
              <Button type="button" variant="outline" size="sm" onClick={onOpenBunkerDialog} title="Lägg till bunkring">
                <Fuel className="h-4 w-4 mr-1" />
                Bunkring
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={onAddFarskvatten} title="Lägg till färskvatten">
                <Droplets className="h-4 w-4 mr-1" />
                Färskvatten
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={onAddSeptik} title="Lägg till septiktömning">
                <Trash className="h-4 w-4 mr-1" />
                Septik
              </Button>
            </div>
          )}
          
          {/* Quick entries list */}
          {quickEntries.length > 0 && (
            <div className="space-y-2 pt-2">
              {quickEntries.map(entry => (
                <div key={entry.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50 text-sm">
                  <div className="flex items-center gap-2">
                    {entry.type === 'bunkring' && <Fuel className="h-4 w-4 text-muted-foreground" />}
                    {entry.type === 'farskvatten' && <Droplets className="h-4 w-4 text-muted-foreground" />}
                    {entry.type === 'septik' && <Trash className="h-4 w-4 text-muted-foreground" />}
                    <span className="text-muted-foreground">{entry.timestamp}</span>
                    <span>{entry.text}</span>
                  </div>
                  {canEditThis && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onRemoveQuickEntry(entry)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="h-4 w-4" />
          Skapad av {creatorName}
        </div>
      </CardContent>
    </Card>
  );
}
