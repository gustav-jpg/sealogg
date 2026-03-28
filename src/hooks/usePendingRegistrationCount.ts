import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function usePendingRegistrationCount(orgId: string | null) {
  return useQuery({
    queryKey: ['pending-registration-count', orgId],
    enabled: !!orgId,
    refetchInterval: 30000,
    queryFn: async () => {
      if (!orgId) return 0;
      const { count, error } = await supabase
        .from('pending_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'pending');
      if (error) throw error;
      return count || 0;
    },
  });
}
