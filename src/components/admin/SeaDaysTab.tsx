import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Download } from 'lucide-react';
import { CREW_ROLE_LABELS, CrewRole } from '@/lib/types';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrgVessels } from '@/hooks/useOrgVessels';
import { useOrgProfiles } from '@/hooks/useOrgProfiles';

interface SeaDayEntry {
  date: string;
  vesselId: string;
  vesselName: string;
  profileId: string;
  profileName: string;
  role: CrewRole;
  preferredVesselId: string | null;
}

interface SeaDayRow {
  profileName: string;
  vesselName: string;
  role: CrewRole;
  days: number;
}

export function SeaDaysTab() {
  const { selectedOrgId } = useOrganization();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedVessel, setSelectedVessel] = useState<string>('all');
  const [selectedProfile, setSelectedProfile] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');

  const { data: vessels } = useOrgVessels(selectedOrgId);
  const { data: profiles } = useOrgProfiles(selectedOrgId);

  const vesselIds = vessels?.map(v => v.id) || [];

  // Fetch all closed logbooks for the selected year with crew - scoped to org vessels
  const { data: logbookCrew, isLoading } = useQuery({
    queryKey: ['sea-days-data', selectedYear, vesselIds],
    queryFn: async () => {
      if (vesselIds.length === 0) return [];
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
        .eq('logbook.status', 'stangd')
        .in('logbook.vessel_id', vesselIds);

      if (error) throw error;
      return data;
    },
    enabled: vesselIds.length > 0,
  });

  // Process sea days - returns flat rows for table
  const seaDayRows = useMemo(() => {
    if (!logbookCrew) return [];

    // Group entries by date, profile, AND role
    const entriesByDateProfileRole = new Map<string, SeaDayEntry[]>();

    logbookCrew.forEach((crew) => {
      const logbook = crew.logbook as any;
      const profile = crew.profile as any;
      const vessel = logbook?.vessel as any;

      if (!logbook || !profile || !vessel) return;

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

    // Resolve to one entry per date/profile/role
    const resolvedDays: SeaDayEntry[] = [];
    entriesByDateProfileRole.forEach((entries) => {
      if (entries.length === 1) {
        resolvedDays.push(entries[0]);
      } else {
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
    if (selectedRole !== 'all') {
      filteredDays = filteredDays.filter((d) => d.role === selectedRole);
    }

    // Group by profile + vessel + role for flat rows
    const rowMap = new Map<string, SeaDayRow>();
    filteredDays.forEach((day) => {
      const key = `${day.profileId}_${day.vesselId}_${day.role}`;
      if (!rowMap.has(key)) {
        rowMap.set(key, {
          profileName: day.profileName,
          vesselName: day.vesselName,
          role: day.role,
          days: 0,
        });
      }
      rowMap.get(key)!.days++;
    });

    return Array.from(rowMap.values()).sort((a, b) => {
      const nameCompare = a.profileName.localeCompare(b.profileName, 'sv');
      if (nameCompare !== 0) return nameCompare;
      const vesselCompare = a.vesselName.localeCompare(b.vesselName, 'sv');
      if (vesselCompare !== 0) return vesselCompare;
      return CREW_ROLE_LABELS[a.role].localeCompare(CREW_ROLE_LABELS[b.role], 'sv');
    });
  }, [logbookCrew, selectedVessel, selectedProfile, selectedRole]);

  const totalSeaDays = seaDayRows.reduce((sum, r) => sum + r.days, 0);

  const exportToCSV = () => {
    const rows: string[] = ['Namn,Fartyg,Befattning,Antal dagar'];
    seaDayRows.forEach((row) => {
      rows.push(`"${row.profileName}","${row.vesselName}","${CREW_ROLE_LABELS[row.role]}",${row.days}`);
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
    seaDayRows.forEach((row) => {
      lines.push(`${row.profileName}, ${row.vesselName}, ${CREW_ROLE_LABELS[row.role]}, ${row.days} dagar`);
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
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Filter</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportToCSV} disabled={seaDayRows.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportToText} disabled={seaDayRows.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Text
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
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
            <div className="space-y-2">
              <Label>Befattning</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla befattningar</SelectItem>
                  {Object.entries(CREW_ROLE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
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
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : seaDayRows.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Inga sjödagar hittades för valt år och filter
            </p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Namn</th>
                    <th className="text-left p-3 font-medium">Fartyg</th>
                    <th className="text-left p-3 font-medium">Befattning</th>
                    <th className="text-right p-3 font-medium">Antal dagar</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {seaDayRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-muted/30">
                      <td className="p-3">{row.profileName}</td>
                      <td className="p-3">{row.vesselName}</td>
                      <td className="p-3">{CREW_ROLE_LABELS[row.role]}</td>
                      <td className="p-3 text-right font-medium">{row.days}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/50">
                  <tr>
                    <td colSpan={3} className="p-3 font-semibold">Totalt</td>
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
  );
}
