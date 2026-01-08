import { ReactNode, useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Anchor, Building2, Users, LogOut, LayoutDashboard } from 'lucide-react';

interface BackofficeLayoutProps {
  children: ReactNode;
}

export default function BackofficeLayout({ children }: BackofficeLayoutProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSuperadmin = async () => {
      if (!user) {
        navigate('/portal/login');
        return;
      }

      const { data } = await supabase
        .from('superadmins')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!data) {
        navigate('/portal/dashboard');
        return;
      }

      setIsSuperadmin(true);
      setIsLoading(false);
    };

    checkSuperadmin();
  }, [user, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Laddar...</p>
      </div>
    );
  }

  if (!isSuperadmin) {
    return null;
  }

  const navItems = [
    { href: '/backoffice', label: 'Översikt', icon: LayoutDashboard },
    { href: '/backoffice/organizations', label: 'Organisationer', icon: Building2 },
  ];

  const isActive = (href: string) => {
    if (href === '/backoffice') {
      return location.pathname === '/backoffice';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-muted/30 flex flex-col">
        <div className="p-4 border-b">
          <Link to="/backoffice" className="flex items-center gap-2">
            <Anchor className="h-6 w-6 text-primary" />
            <span className="font-display font-bold">SeaLogg</span>
            <span className="text-xs text-muted-foreground ml-1">Admin</span>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive(item.href)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t space-y-2">
          <Button variant="ghost" size="sm" className="w-full justify-start" asChild>
            <Link to="/portal/dashboard">
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Till portalen
            </Link>
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full justify-start text-destructive hover:text-destructive"
            onClick={() => signOut()}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logga ut
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
}
