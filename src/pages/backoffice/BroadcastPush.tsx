import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Bell, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function BroadcastPush() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('/portal');
  const [isSending, setIsSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ sent: number; recipients: number } | null>(null);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error('Titel och meddelande krävs');
      return;
    }

    setIsSending(true);
    setLastResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('broadcast-push', {
        body: { title: title.trim(), body: body.trim(), url: url.trim() || '/portal' },
      });

      if (error) throw error;

      setLastResult({ sent: data.sent || 0, recipients: data.recipients || 0 });
      toast.success(`Push skickad till ${data.sent} enheter (${data.recipients} användare)`);
      setTitle('');
      setBody('');
      setUrl('/portal');
    } catch (err) {
      console.error('Broadcast error:', err);
      toast.error('Kunde inte skicka push-notis');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="h-6 w-6" />
          Skicka push-notis
        </h1>
        <p className="text-muted-foreground">Skicka en push-notis till alla användare med aktiverade notifikationer</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ny notis</CardTitle>
          <CardDescription>Notisen skickas direkt till alla enheter med push aktiverat</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titel</Label>
            <Input
              id="title"
              placeholder="t.ex. Ny uppdatering av SeaLogg"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Meddelande</Label>
            <Textarea
              id="body"
              placeholder="t.ex. Vi har släppt version 2.5 med nya funktioner..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              disabled={isSending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">Länk (valfritt)</Label>
            <Input
              id="url"
              placeholder="/portal"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isSending}
            />
            <p className="text-xs text-muted-foreground">Sidan som öppnas när användaren klickar på notisen</p>
          </div>

          <Button onClick={handleSend} disabled={isSending || !title.trim() || !body.trim()} className="w-full">
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Skickar...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Skicka till alla
              </>
            )}
          </Button>

          {lastResult && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950/30 dark:text-green-400 p-3 rounded-md">
              <CheckCircle2 className="h-4 w-4" />
              Skickade till {lastResult.sent} enheter ({lastResult.recipients} användare)
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
