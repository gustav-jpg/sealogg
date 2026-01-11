import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OrgCertificateType {
  id: string;
  name: string;
  description: string | null;
  organization_id: string;
  created_at: string;
}

/**
 * Returns certificate types that belong to the selected organization.
 */
export function useOrgCertificateTypes(selectedOrgId: string | null) {
  return useQuery({
    queryKey: ["org-certificate-types", selectedOrgId],
    enabled: !!selectedOrgId,
    queryFn: async () => {
      if (!selectedOrgId) return [] as OrgCertificateType[];
      const { data, error } = await supabase
        .from("certificate_types")
        .select("*")
        .eq("organization_id", selectedOrgId)
        .order("name");
      if (error) throw error;
      return (data || []) as OrgCertificateType[];
    },
  });
}
