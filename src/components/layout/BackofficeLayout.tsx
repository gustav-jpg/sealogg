import { ReactNode, useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Building2, LogOut, LayoutDashboard, Menu, Activity, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import sealoggLogo from '@/assets/sealog-logo.png';

interface BackofficeLayoutProps {
  children: ReactNode;
}

export default function BackofficeLayout({ children }: BackofficeLayoutProps) {
  const { user, isLoading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    const checkSuperadmin = async () => {
      if (!user) {
        setIsLoading(false);
        navigate('/portal/login');
        return;
      }

      const { data: isSa, error } = await supabase.rpc('is_superadmin', { _user_id: user.id });

      if (error || !isSa) {
        setIsLoading(false);
        navigate('/portal');
        return;
      }

      setIsSuperadmin(true);
      setIsLoading(false);
    };

    checkSuperadmin();
  }, [user, authLoading, navigate]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

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
    { href: '/backoffice/changelog', label: 'Uppdateringshistorik', icon: History },
    { href: '/backoffice/audit-logs', label: 'Systemloggar', icon: Activity },
  ];

  const isActive = (href: string) => {
    if (href === '/backoffice') {
      return location.pathname === '/backoffice';
    }
    return location.pathname.startsWith(href);
  };

  const SidebarContent = () => (
    <>
      <div className="p-4 border-b">
        <Link to="/backoffice" className="flex items-center gap-2">
          <img src={sealoggLogo} alt="SeaLogg" className="h-6" />
          <span className="text-xs text-muted-foreground">Admin</span>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
              isActive(item.href)
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t space-y-2">
        <Button variant="ghost" size="sm" className="w-full justify-start" asChild>
          <Link to="/portal">
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
    </>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile header */}
      <header className="md:hidden flex items-center justify-between p-4 border-b bg-muted/30">
        <Link to="/backoffice" className="flex items-center gap-2">
          <img src={sealoggLogo} alt="SeaLogg" className="h-6" />
          <span className="text-xs text-muted-foreground">Admin</span>
        </Link>
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 flex flex-col">
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 border-r bg-muted/30 flex-col">
        <SidebarContent />
      </aside>

      {/* Main content */}
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
}
