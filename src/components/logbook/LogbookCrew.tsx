import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Pencil } from 'lucide-react';
import { CREW_ROLE_LABELS, CrewRole } from '@/lib/types';

interface LogbookCrewProps {
  crewMembers: any[] | undefined;
  canEditThis: boolean;
  onOpenCrewDialog: () => void;
}

export function LogbookCrew({ crewMembers, canEditThis, onOpenCrewDialog }: LogbookCrewProps) {
  return (
    <Card>
      <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
        <CardTitle className="flex items-center justify-between text-base sm:text-lg">
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4 sm:h-5 sm:w-5" />
            Besättning
          </span>
          {canEditThis && crewMembers && crewMembers.length > 0 && (
            <Button variant="outline" size="sm" onClick={onOpenCrewDialog}>
              <Pencil className="h-4 w-4 mr-1" />
              Redigera
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        {!crewMembers || crewMembers.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-muted-foreground">Ingen besättning registrerad.</p>
            {canEditThis && (
              <Button variant="outline" size="sm" className="mt-2" onClick={onOpenCrewDialog}>
                <Plus className="h-4 w-4 mr-1" />
                Lägg till besättning
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {crewMembers.map(member => (
              <div key={member.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                <span>{member.profile?.full_name || 'Okänd'}</span>
                <Badge variant="outline">{CREW_ROLE_LABELS[member.role as CrewRole]}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
