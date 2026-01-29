import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { History, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

interface ChangelogEntry {
  id: string;
  version: string;
  title: string;
  description: string | null;
  published_at: string;
}

export default function Changelog() {
  const { data: entries, isLoading } = useQuery({
    queryKey: ['changelog-public'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('changelog')
        .select('id, version, title, description, published_at')
        .eq('is_published', true)
        .order('published_at', { ascending: false });
      if (error) throw error;
      return data as ChangelogEntry[];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl py-8 px-4">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-display font-bold flex items-center gap-2">
              <History className="h-8 w-8" />
              Uppdateringshistorik
            </h1>
            <p className="text-muted-foreground mt-1">
              Senaste uppdateringar och nyheter i SeaLogg
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : entries && entries.length > 0 ? (
          <div className="space-y-6">
            {entries.map((entry, index) => (
              <div key={entry.id}>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <Badge variant="default" className="font-mono text-sm">
                          {entry.version}
                        </Badge>
                        <CardTitle className="text-lg">{entry.title}</CardTitle>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(entry.published_at), 'd MMMM yyyy', { locale: sv })}
                      </span>
                    </div>
                  </CardHeader>
                  {entry.description && (
                    <CardContent>
                      <p className="text-muted-foreground whitespace-pre-wrap">
                        {entry.description}
                      </p>
                    </CardContent>
                  )}
                </Card>
                {index < entries.length - 1 && <Separator className="my-6" />}
              </div>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <History className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                Inga uppdateringar publicerade ännu.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}