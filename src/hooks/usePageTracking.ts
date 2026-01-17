import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';

// Generate a session ID that persists for the browser session
const getSessionId = () => {
  let sessionId = sessionStorage.getItem('tracking_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('tracking_session_id', sessionId);
  }
  return sessionId;
};

export function usePageTracking() {
  const location = useLocation();
  const { user } = useAuth();
  const { selectedOrgId } = useOrganization();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    // Don't track the same path twice in a row
    if (lastTrackedPath.current === location.pathname) return;
    lastTrackedPath.current = location.pathname;

    const trackPageView = async () => {
      try {
        await supabase.from('page_views').insert({
          path: location.pathname,
          user_agent: navigator.userAgent,
          referrer: document.referrer || null,
          session_id: getSessionId(),
          user_id: user?.id || null,
          organization_id: selectedOrgId || null,
        });
      } catch (error) {
        // Silent fail - don't break the app for tracking issues
        console.error('Page tracking error:', error);
      }
    };

    trackPageView();
  }, [location.pathname, user?.id, selectedOrgId]);
}
