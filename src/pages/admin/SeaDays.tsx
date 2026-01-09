import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Anchor, Download } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { CREW_ROLE_LABELS, CrewRole } from '@/lib/types';

interface SeaDayEntry {
  date: string;
  vesselId: string;
  vesselName: string;
  profileId: string;
  profileName: string;
  role: CrewRole;
  preferredVesselId: string | null;
}

interface SeaDaySummary {
  profileId: string;
  profileName: string;
  totalDays: number;
  byVesselAndRole: {
    vesselId: string;
    vesselName: string;
    role: CrewRole;
    days: number;
  }[];
}

export default function SeaDays() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedVessel, setSelectedVessel] = useState<string>('all');
  const [selectedProfile, setSelectedProfile] = useState<string>('all');

  // Fetch vessels
  const { data: vessels } = useQuery({
    queryKey: ['vessels'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vessels').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch profiles
  const { data: profiles } = useQuery({
    queryKey: ['profiles-with-preferred'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('full_name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch all closed logbooks for the selected year with crew
  const { data: logbookCrew, isLoading } = useQuery({
    queryKey: ['sea-days-data', selectedYear],
    queryFn: async () => {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;

      const { data, error } = await supabase
        .from('logbook_crew')
        .select(`
          *,
          logbook:logbooks!inner(id, date, status, vessel_id, vessel:vessels(id, name)),
          profile:profiles!logbook_crew_profile_id_fkey(id, full_name, preferred_vessel_id)
        `)
        .gte('logbook.date', startDate)
        .lte('logbook.date', endDate)
        .eq('logbook.status', 'stangd');

      if (error) throw error;
      return data;
    },
  });

  // Process sea days with double-day resolution
  // Rule: One day per ROLE per calendar day. If same role on multiple vessels same day, use preferred vessel.
  const seaDaySummaries = useMemo(() => {
    if (!logbookCrew) return [];

    // Group entries by date, profile, AND role (key: date_profileId_role)
    const entriesByDateProfileRole = new Map<string, SeaDayEntry[]>();

    logbookCrew.forEach((crew) => {
      const logbook = crew.logbook as any;
      const profile = crew.profile as any;
      const vessel = logbook?.vessel as any;

      if (!logbook || !profile || !vessel) return;

      // Key includes role - so different roles on same day = separate entries
      const key = `${logbook.date}_${profile.id}_${crew.role}`;
      const entry: SeaDayEntry = {
        date: logbook.date,
        vesselId: vessel.id,
        vesselName: vessel.name,
        profileId: profile.id,
        profileName: profile.full_name,
        role: crew.role as CrewRole,
        preferredVesselId: profile.preferred_vessel_id,
      };

      if (!entriesByDateProfileRole.has(key)) {
        entriesByDateProfileRole.set(key, []);
      }
      entriesByDateProfileRole.get(key)!.push(entry);
    });

    // For each date/profile/role combo, pick one vessel (preferred vessel wins if same role on multiple vessels)
    const resolvedDays: SeaDayEntry[] = [];

    entriesByDateProfileRole.forEach((entries) => {
      if (entries.length === 1) {
        resolvedDays.push(entries[0]);
      } else {
        // Same role on multiple vessels same day - pick preferred vessel or first one
        const preferredVesselId = entries[0].preferredVesselId;
        const preferred = entries.find((e) => e.vesselId === preferredVesselId);
        resolvedDays.push(preferred || entries[0]);
      }
    });

    // Apply filters
    let filteredDays = resolvedDays;
    if (selectedVessel !== 'all') {
      filteredDays = filteredDays.filter((d) => d.vesselId === selectedVessel);
    }
    if (selectedProfile !== 'all') {
      filteredDays = filteredDays.filter((d) => d.profileId === selectedProfile);
    }

    // Group by profile and summarize
    const summaryMap = new Map<string, SeaDaySummary>();

    filteredDays.forEach((day) => {
      if (!summaryMap.has(day.profileId)) {
        summaryMap.set(day.profileId, {
          profileId: day.profileId,
          profileName: day.profileName,
          totalDays: 0,
          byVesselAndRole: [],
        });
      }

      const summary = summaryMap.get(day.profileId)!;
      summary.totalDays++;

      // Find or create vessel/role combo
      let vesselRole = summary.byVesselAndRole.find(
        (vr) => vr.vesselId === day.vesselId && vr.role === day.role
      );
      if (!vesselRole) {
        vesselRole = {
          vesselId: day.vesselId,
          vesselName: day.vesselName,
          role: day.role,
          days: 0,
        };
        summary.byVesselAndRole.push(vesselRole);
      }
      vesselRole.days++;
    });

    return Array.from(summaryMap.values()).sort((a, b) =>
      a.profileName.localeCompare(b.profileName, 'sv')
    );
  }, [logbookCrew, selectedVessel, selectedProfile]);

  const totalSeaDays = seaDaySummaries.reduce((sum, s) => sum + s.totalDays, 0);

  const exportToCSV = () => {
    const rows: string[] = ['Namn,Fartyg,Roll,Antal dagar'];

    seaDaySummaries.forEach((summary) => {
      summary.byVesselAndRole.forEach((vr) => {
        rows.push(
          `"${summary.profileName}","${vr.vesselName}","${CREW_ROLE_LABELS[vr.role]}",${vr.days}`
        );
      });
    });

    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sjodagar_${selectedYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportToText = () => {
    const lines: string[] = [`Sjödagar ${selectedYear}`, ''];

    seaDaySummaries.forEach((summary) => {
      const parts = summary.byVesselAndRole.map(
        (vr) => `${vr.days} dagar ${CREW_ROLE_LABELS[vr.role]} ${vr.vesselName}`
      );
      lines.push(`${summary.profileName}: ${parts.join(', ')}`);
    });

    const text = lines.join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sjodagar_${selectedYear}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold flex items-center gap-3">
              <Anchor className="h-8 w-8" />
              Sjödagar
            </h1>
            <p className="text-muted-foreground mt-1">
              Rapportering till Transportstyrelsen
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToCSV} disabled={seaDaySummaries.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Exportera CSV
            </Button>
            <Button variant="outline" onClick={exportToText} disabled={seaDaySummaries.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Exportera Text
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>År</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fartyg</Label>
                <Select value={selectedVessel} onValueChange={setSelectedVessel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alla fartyg</SelectItem>
                    {vessels?.map((vessel) => (
                      <SelectItem key={vessel.id} value={vessel.id}>
                        {vessel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Personal</Label>
                <Select value={selectedProfile} onValueChange={setSelectedProfile}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alla anställda</SelectItem>
                    {profiles?.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Sjödagar per person</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : seaDaySummaries.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Inga sjödagar hittades för valt år och filter
              </p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">Namn</th>
                      <th className="text-left p-3 font-medium">Fördelning</th>
                      <th className="text-right p-3 font-medium">Totalt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {seaDaySummaries.map((summary) => (
                      <tr key={summary.profileId} className="hover:bg-muted/30">
                        <td className="p-3 font-medium">{summary.profileName}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {summary.byVesselAndRole.map((vr, idx) => (
                              <span key={idx} className="text-xs text-muted-foreground">
                                {vr.days} {CREW_ROLE_LABELS[vr.role]} {vr.vesselName}
                                {idx < summary.byVesselAndRole.length - 1 && ','}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-right font-semibold">{summary.totalDays}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/50">
                    <tr>
                      <td className="p-3 font-semibold">Totalt</td>
                      <td className="p-3 text-muted-foreground text-sm">{seaDaySummaries.length} personer</td>
                      <td className="p-3 text-right font-bold">{totalSeaDays}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info box */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              <strong>OBS:</strong> En sjödag räknas per person, roll och dag. Arbetar man som befälhavare på förmiddagen och jungman på eftermiddagen får man 2 dagar. Om man arbetar samma roll på flera fartyg samma dag räknas den föredragna båten (ställs in i användarens profil).
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
