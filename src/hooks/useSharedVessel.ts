import { useState, useEffect } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';

const STORAGE_KEY = 'sealog-shared-vessel';

/**
 * Hook for sharing vessel selection between SelfControl and Checklists pages.
 * Persists selection in localStorage scoped by organization.
 */
export function useSharedVessel(urlVessel?: string | null) {
  const { selectedOrgId } = useOrganization();
  
  const getStorageKey = () => `${STORAGE_KEY}-${selectedOrgId}`;
  
  const getInitialVessel = () => {
    // URL param takes priority
    if (urlVessel) return urlVessel;
    
    // Check localStorage
    if (selectedOrgId) {
      const stored = localStorage.getItem(getStorageKey());
      if (stored) return stored;
    }
    return '';
  };

  const [selectedVessel, setSelectedVesselState] = useState<string>(getInitialVessel);

  // Sync from localStorage when org changes
  useEffect(() => {
    if (selectedOrgId) {
      const stored = localStorage.getItem(getStorageKey());
      if (stored && !urlVessel) {
        setSelectedVesselState(stored);
      } else if (urlVessel) {
        setSelectedVesselState(urlVessel);
      }
    }
  }, [selectedOrgId, urlVessel]);

  const setSelectedVessel = (vesselId: string) => {
    setSelectedVesselState(vesselId);
    if (selectedOrgId) {
      localStorage.setItem(getStorageKey(), vesselId);
    }
  };

  return { selectedVessel, setSelectedVessel };
}
