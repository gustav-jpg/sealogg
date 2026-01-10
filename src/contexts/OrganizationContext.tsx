import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface Organization {
  id: string;
  name: string;
  is_active: boolean;
}

interface OrganizationMembership {
  organization_id: string;
  role: string;
  organizations: Organization;
}

interface OrganizationContextType {
  selectedOrgId: string | null;
  selectedOrg: Organization | null;
  userOrgs: OrganizationMembership[];
  setSelectedOrgId: (orgId: string) => void;
  isLoading: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [selectedOrgId, setSelectedOrgIdState] = useState<string | null>(() => {
    return localStorage.getItem('selectedOrgId');
  });

  // Fetch user's organizations
  const { data: userOrgs = [], isLoading } = useQuery({
    queryKey: ['user-organizations', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          organization_id,
          role,
          organizations:organization_id (
            id,
            name,
            is_active
          )
        `)
        .eq('user_id', user.id);
      if (error) throw error;
      return (data?.filter(d => (d.organizations as any)?.is_active) || []) as unknown as OrganizationMembership[];
    },
    enabled: !!user,
  });

  // Set default org only if no valid selection exists
  useEffect(() => {
    if (userOrgs && userOrgs.length > 0) {
      const isValidSelection = selectedOrgId && userOrgs.some(o => o.organization_id === selectedOrgId);
      if (!isValidSelection) {
        const defaultOrgId = userOrgs[0].organization_id;
        setSelectedOrgIdState(defaultOrgId);
        localStorage.setItem('selectedOrgId', defaultOrgId);
      }
    }
  }, [userOrgs, selectedOrgId]);

  const setSelectedOrgId = (orgId: string) => {
    setSelectedOrgIdState(orgId);
    localStorage.setItem('selectedOrgId', orgId);
  };

  const selectedOrg = userOrgs.find(o => o.organization_id === selectedOrgId)?.organizations || null;

  return (
    <OrganizationContext.Provider
      value={{
        selectedOrgId,
        selectedOrg,
        userOrgs,
        setSelectedOrgId,
        isLoading,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}
