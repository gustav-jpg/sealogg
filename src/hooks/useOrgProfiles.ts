import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OrgProfile {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  is_external: boolean;
  organization_id: string | null;
  preferred_vessel_id: string | null;
}

/**
 * Returns the profiles that belong to the selected organization.
 *
 * IMPORTANT: For portal users, org membership is defined by `organization_members`.
 * External users are stored as `profiles.is_external=true` with `profiles.organization_id`.
 */
export function useOrgProfiles(selectedOrgId: string | null) {
  return useQuery({
    queryKey: ["org-profiles", selectedOrgId],
    enabled: !!selectedOrgId,
    queryFn: async () => {
      if (!selectedOrgId) return [] as OrgProfile[];

      // 1) Org members (portal users)
      const { data: members, error: membersError } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", selectedOrgId);
      if (membersError) throw membersError;

      const memberUserIds = (members || [])
        .map((m) => m.user_id)
        .filter(Boolean) as string[];

      // 2) Fetch profiles for those users + external profiles tied directly to org
      // NOTE: PostgREST doesn't support OR across unrelated columns in a single query cleanly,
      // so we do it in two requests and merge.
      const [memberProfilesRes, externalProfilesRes] = await Promise.all([
        memberUserIds.length
          ? supabase
              .from("profiles")
              .select("*")
              .in("user_id", memberUserIds)
          : Promise.resolve({ data: [] as any[], error: null as any }),
        supabase
          .from("profiles")
          .select("*")
          .eq("organization_id", selectedOrgId)
          .eq("is_external", true),
      ]);

      if (memberProfilesRes.error) throw memberProfilesRes.error;
      if (externalProfilesRes.error) throw externalProfilesRes.error;

      const merged = [...(memberProfilesRes.data || []), ...(externalProfilesRes.data || [])] as OrgProfile[];

      // Deduplicate by profile id and sort
      const uniq = Array.from(new Map(merged.map((p) => [p.id, p])).values());
      uniq.sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "", "sv"));
      return uniq;
    },
  });
}
