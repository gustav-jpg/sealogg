import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface PushSubscriptionState {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  permission: NotificationPermission | 'default';
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [state, setState] = useState<PushSubscriptionState>({
    isSupported: false,
    isSubscribed: false,
    isLoading: true,
    permission: 'default'
  });

  // Check if push notifications are supported
  const checkSupport = useCallback(() => {
    const isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
    const permission = 'Notification' in window ? Notification.permission : 'default';
    return { isSupported, permission };
  }, []);

  // Check if user is already subscribed
  const checkSubscription = useCallback(async () => {
    if (!user) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) return false;

      // Verify subscription exists in database
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('endpoint', subscription.endpoint)
        .maybeSingle();

      return !!data && !error;
    } catch (error) {
      console.error('Error checking subscription:', error);
      return false;
    }
  }, [user]);

  // Initialize state
  useEffect(() => {
    const init = async () => {
      const { isSupported, permission } = checkSupport();
      
      if (!isSupported) {
        setState(prev => ({ ...prev, isSupported: false, isLoading: false }));
        return;
      }

      // Register service worker
      try {
        await navigator.serviceWorker.register('/sw.js');
      } catch (error) {
        console.error('Service worker registration failed:', error);
      }

      const isSubscribed = await checkSubscription();
      
      setState({
        isSupported,
        isSubscribed,
        isLoading: false,
        permission
      });
    };

    init();
  }, [checkSupport, checkSubscription, user]);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!user || !state.isSupported) return false;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Request permission
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        toast.error('Du måste tillåta notifikationer för att aktivera push-notiser');
        setState(prev => ({ ...prev, isLoading: false, permission }));
        return false;
      }

      // Get VAPID public key from edge function
      const { data: configData, error: configError } = await supabase.functions.invoke('get-vapid-key');
      
      if (configError || !configData?.publicKey) {
        throw new Error('Kunde inte hämta VAPID-nyckel');
      }

      const registration = await navigator.serviceWorker.ready;
      
      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(configData.publicKey)
      });

      const subscriptionJson = subscription.toJSON();

      // Save subscription to database
      const { error: saveError } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: subscriptionJson.endpoint!,
          p256dh: subscriptionJson.keys!.p256dh,
          auth: subscriptionJson.keys!.auth,
          user_agent: navigator.userAgent
        }, {
          onConflict: 'endpoint'
        });

      if (saveError) throw saveError;

      toast.success('Push-notifikationer aktiverade!');
      setState(prev => ({ ...prev, isSubscribed: true, isLoading: false, permission: 'granted' }));
      return true;
    } catch (error) {
      console.error('Error subscribing to push:', error);
      toast.error('Kunde inte aktivera push-notifikationer');
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [user, state.isSupported]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    if (!user) return false;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Remove from database
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint);
      }

      toast.success('Push-notifikationer avaktiverade');
      setState(prev => ({ ...prev, isSubscribed: false, isLoading: false }));
      return true;
    } catch (error) {
      console.error('Error unsubscribing from push:', error);
      toast.error('Kunde inte avaktivera push-notifikationer');
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [user]);

  return {
    ...state,
    subscribe,
    unsubscribe
  };
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}
