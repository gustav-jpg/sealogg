import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AppRole, Profile } from '@/lib/types';
import { backupSession, getBackupSession, clearBackupSession } from '@/lib/capacitor-auth-persistence';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  isLoading: boolean;
  isAdmin: boolean;
  isSkeppare: boolean;
  isDeckhand: boolean;
  canEdit: boolean;
  isPendingRegistration: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isPendingRegistration, setIsPendingRegistration] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    setProfile(data as Profile | null);
  };

  const fetchRoles = async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    
    if (data) {
      setRoles(data.map(r => r.role as AppRole));
    }
  };

  const fetchPendingStatus = async (userId: string) => {
    const { data } = await supabase
      .from('pending_registrations')
      .select('status')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .maybeSingle();
    
    setIsPendingRegistration(!!data);
  };

  const refreshProfile = async () => {
    if (user) {
      await Promise.all([fetchProfile(user.id), fetchRoles(user.id)]);
    }
  };

  useEffect(() => {
    // Set up auth state listener BEFORE getting session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          // Backup session to native storage for persistence
          backupSession({
            access_token: currentSession.access_token,
            refresh_token: currentSession.refresh_token,
          });
          // Use setTimeout to avoid potential deadlock
          setTimeout(() => {
            fetchProfile(currentSession.user.id);
            fetchRoles(currentSession.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          if (event === 'SIGNED_OUT') {
            clearBackupSession();
          }
        }
        
        setIsLoading(false);
      }
    );

    // Get initial session, fall back to native backup if localStorage was cleared
    const restoreSession = async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      
      if (initialSession?.user) {
        setSession(initialSession);
        setUser(initialSession.user);
        fetchProfile(initialSession.user.id);
        fetchRoles(initialSession.user.id);
        setIsLoading(false);
        return;
      }

      // No session in localStorage — try native backup
      const backup = await getBackupSession();
      if (backup) {
        const { data, error } = await supabase.auth.setSession({
          access_token: backup.access_token,
          refresh_token: backup.refresh_token,
        });
        if (error || !data.session) {
          clearBackupSession();
        }
        // onAuthStateChange will handle the rest
      }
      
      setIsLoading(false);
    };

    restoreSession();

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });
    return { error };
  };

  const signOut = async () => {
    // Clear local state first to ensure UI updates even if signOut fails
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    
    // Attempt to sign out from Supabase - ignore errors (session may already be invalid)
    try {
      await supabase.auth.signOut();
    } catch {
      // Session was already invalid, which is fine - user is logged out locally
    }
  };

  const isAdmin = roles.includes('admin');
  const isSkeppare = roles.includes('skeppare');
  const isDeckhand = roles.includes('deckhand');
  const canEdit = isAdmin || isSkeppare;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        isLoading,
        isAdmin,
        isSkeppare,
        isDeckhand,
        canEdit,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
