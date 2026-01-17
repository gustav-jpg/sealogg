import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface LogbookSignature {
  id: string;
  logbook_id: string;
  signed_by: string;
  signed_at: string;
  signature_type: string;
  content_hash: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  signer_profile?: {
    full_name: string;
  };
}

// Generate SHA-256 hash of logbook content for integrity verification
async function generateContentHash(logbookData: object): Promise<string> {
  const content = JSON.stringify(logbookData, Object.keys(logbookData).sort());
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function useLogbookSignatures(logbookId: string | undefined) {
  return useQuery({
    queryKey: ['logbook-signatures', logbookId],
    queryFn: async () => {
      if (!logbookId) return [];
      
      const { data, error } = await supabase
        .from('logbook_signatures')
        .select('*')
        .eq('logbook_id', logbookId)
        .order('signed_at', { ascending: false });
      
      if (error) throw error;
      
      // Fetch signer profiles separately
      const signerIds = [...new Set(data.map(s => s.signed_by))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', signerIds);
      
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      
      return data.map(sig => ({
        ...sig,
        signer_profile: profileMap.get(sig.signed_by),
      })) as LogbookSignature[];
    },
    enabled: !!logbookId,
  });
}

interface SignLogbookParams {
  logbookId: string;
  logbookData: object;
  signatureType?: string;
}

export function useSignLogbook() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ logbookId, logbookData, signatureType = 'close' }: SignLogbookParams) => {
      if (!user) throw new Error('Du måste vara inloggad för att signera.');
      
      // Generate content hash for integrity verification
      const contentHash = await generateContentHash(logbookData);
      
      const { data, error } = await supabase
        .from('logbook_signatures')
        .insert({
          logbook_id: logbookId,
          signed_by: user.id,
          signature_type: signatureType,
          content_hash: contentHash,
          user_agent: navigator.userAgent,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['logbook-signatures', variables.logbookId] });
    },
  });
}

export function useVerifySignature() {
  return useMutation({
    mutationFn: async ({ signature, currentLogbookData }: { signature: LogbookSignature; currentLogbookData: object }) => {
      const currentHash = await generateContentHash(currentLogbookData);
      const isValid = currentHash === signature.content_hash;
      return { isValid, originalHash: signature.content_hash, currentHash };
    },
  });
}
