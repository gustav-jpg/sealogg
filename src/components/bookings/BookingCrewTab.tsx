import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Save, Plus, Trash2, Users } from 'lucide-react';
import { BookingCrew, BookingCrewRole, BOOKING_CREW_ROLE_LABELS } from '@/lib/booking-types';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrgProfiles } from '@/hooks/useOrgProfiles';

interface CrewAssignment {
  tempId: string;
  profileId: string;
  roleType: BookingCrewRole;
}

interface BookingCrewTabProps {
  bookingId: string;
}

export function BookingCrewTab({ bookingId }: BookingCrewTabProps) {
  const queryClient = useQueryClient();
  const { selectedOrgId } = useOrganization();
  const [assignments, setAssignments] = useState<CrewAssignment[]>([]);

  // Fetch existing crew assignments
  const { data: existingCrew, isLoading } = useQuery({
    queryKey: ['booking-crew', bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_crew')
        .select('*, profiles(id, full_name)')
        .eq('booking_id', bookingId);
      if (error) throw error;
      return data as BookingCrew[];
    },
  });

  // Fetch available profiles - scoped to organization
  const { data: profiles } = useOrgProfiles(selectedOrgId);

  // Initialize from existing data
  useEffect(() => {
    if (existingCrew) {
      setAssignments(
        existingCrew.map(c => ({
          tempId: c.id,
          profileId: c.profile_id,
          roleType: c.role_type,
        }))
      );
    }
  }, [existingCrew]);

  const saveCrew = useMutation({
    mutationFn: async () => {
      // Delete all existing and insert new
      const { error: deleteError } = await supabase
        .from('booking_crew')
        .delete()
        .eq('booking_id', bookingId);
      if (deleteError) throw deleteError;

      const validAssignments = assignments.filter(a => a.profileId && a.roleType);
      if (validAssignments.length > 0) {
        const { error: insertError } = await supabase
          .from('booking_crew')
          .insert(
            validAssignments.map(a => ({
              booking_id: bookingId,
              profile_id: a.profileId,
              role_type: a.roleType,
            }))
          );
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      toast.success('Besättning sparad!');
      queryClient.invalidateQueries({ queryKey: ['booking-crew', bookingId] });
    },
    onError: (error: any) => {
      toast.error('Kunde inte spara: ' + error.message);
    },
  });

  const addAssignment = () => {
    setAssignments([
      ...assignments,
      { tempId: crypto.randomUUID(), profileId: '', roleType: 'kapten' as BookingCrewRole }
    ]);
  };

  const updateAssignment = (tempId: string, field: keyof CrewAssignment, value: string) => {
    setAssignments(prev =>
      prev.map(a => a.tempId === tempId ? { ...a, [field]: value } : a)
    );
  };

  const removeAssignment = (tempId: string) => {
    setAssignments(prev => prev.filter(a => a.tempId !== tempId));
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Laddar...</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Besättning för bokningen
            </CardTitle>
            <Button variant="outline" size="sm" onClick={addAssignment}>
              <Plus className="h-4 w-4 mr-1" />
              Lägg till
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {assignments.length > 0 ? (
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <div key={assignment.tempId} className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Roll</Label>
                    <Select
                      value={assignment.roleType}
                      onValueChange={(v) => updateAssignment(assignment.tempId, 'roleType', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(BOOKING_CREW_ROLE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Person</Label>
                    <Select
                      value={assignment.profileId}
                      onValueChange={(v) => updateAssignment(assignment.tempId, 'profileId', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Välj person" />
                      </SelectTrigger>
                      <SelectContent>
                        {profiles?.map((profile) => (
                          <SelectItem key={profile.id} value={profile.id}>
                            {profile.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAssignment(assignment.tempId)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Ingen besättning tilldelad ännu. Klicka "Lägg till" för att tilldela personal.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveCrew.mutate()} disabled={saveCrew.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {saveCrew.isPending ? 'Sparar...' : 'Spara besättning'}
        </Button>
      </div>
    </div>
  );
}
