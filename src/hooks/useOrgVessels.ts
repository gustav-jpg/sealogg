import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OrgVessel {
  id: string;
  name: string;
  description: string | null;
  main_engine_count: number;
  auxiliary_engine_count: number;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Returns vessels that belong to the selected organization.
 */
export function useOrgVessels(selectedOrgId: string | null) {
  return useQuery({
    queryKey: ["org-vessels", selectedOrgId],
    enabled: !!selectedOrgId,
    queryFn: async () => {
      if (!selectedOrgId) return [] as OrgVessel[];
      const { data, error } = await supabase
        .from("vessels")
        .select("*")
        .eq("organization_id", selectedOrgId)
        .order("name");
      if (error) throw error;
      return (data || []) as OrgVessel[];
    },
  });
}
