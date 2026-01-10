import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Ship,
  BookOpen,
  Settings,
  User,
  LogOut,
  Menu,
  Users,
  Award,
  AlertTriangle,
  Wrench,
  ClipboardCheck,
  ClipboardList,
  Waves,
  Home,
  Building2,
  Activity,
  Anchor,
  CalendarDays,
  UtensilsCrossed,
  Wine,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { user, profile, isAdmin, canEdit, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSuperadmin, setIsSuperadmin] = useState(false);

  useEffect(() => {
    const checkSuperadmin = async () => {
      if (!user) return;
      const { data } = await supabase.rpc('is_superadmin', { _user_id: user.id });
      setIsSuperadmin(!!data);
    };
    checkSuperadmin();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/portal/login');
  };

  // Fartygssektion - allt relaterat till fartyg och drift
  const vesselNavItems = [
    { href: '/portal', label: 'Loggböcker', icon: BookOpen },
    { href: '/portal/deviations', label: 'Avvikelser', icon: AlertTriangle },
    { href: '/portal/fault-cases', label: 'Felärenden', icon: Wrench },
    { href: '/portal/self-control', label: 'Egenkontroll', icon: ClipboardCheck },
    { href: '/portal/checklists', label: 'Checklistor', icon: ClipboardList },
    { href: '/portal/qualifications', label: 'Behörigheter', icon: Award },
  ];

  const vesselAdminItems = [
    { href: '/portal/admin/status', label: 'Statusöversikt', icon: Activity },
    { href: '/portal/admin/sea-days', label: 'Sjödagar', icon: Anchor },
    { href: '/portal/admin/vessels', label: 'Fartyg', icon: Ship },
    { href: '/portal/admin/users', label: 'Användare', icon: Users },
    { href: '/portal/admin/rules', label: 'Rollregler', icon: Settings },
    { href: '/portal/admin/control-points', label: 'Kontrollpunkter', icon: ClipboardCheck },
    { href: '/portal/admin/checklists', label: 'Checklistor', icon: ClipboardList },
  ];

  // Bokningssektion
  const bookingNavItems = [
    { href: '/bookings', label: 'Kalender', icon: CalendarDays },
  ];

  const bookingAdminItems = [
    { href: '/bookings/admin/menus', label: 'Menyer', icon: UtensilsCrossed },
    { href: '/bookings/admin/drinks', label: 'Dryckespaket', icon: Wine },
  ];

  const isInVesselSection = location.pathname.startsWith('/portal');
  const isInBookingSection = location.pathname.startsWith('/bookings');

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="maritime-gradient sticky top-0 z-50 border-b border-primary/20">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/portal" className="flex items-center gap-2">
              <Waves className="h-7 w-7 text-primary-foreground" />
              <span className="font-logo text-xl font-extrabold text-primary-foreground">
                SeaLogg
              </span>
            </Link>
            
            <nav className="hidden md:flex items-center gap-1">
              {/* Fartyg dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      'flex items-center gap-1 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10',
                      isInVesselSection && 'bg-primary-foreground/20 text-primary-foreground'
                    )}
                  >
                    <Ship className="h-4 w-4" />
                    Fartyg
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  {vesselNavItems.map((item) => (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link to={item.href} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-muted-foreground">Admin</DropdownMenuLabel>
                      {vesselAdminItems.map((item) => (
                        <DropdownMenuItem key={item.href} asChild>
                          <Link to={item.href} className="flex items-center gap-2">
                            <item.icon className="h-4 w-4" />
                            {item.label}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Bokningar dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      'flex items-center gap-1 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10',
                      isInBookingSection && 'bg-primary-foreground/20 text-primary-foreground'
                    )}
                  >
                    <CalendarDays className="h-4 w-4" />
                    Bokningar
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  {bookingNavItems.map((item) => (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link to={item.href} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-muted-foreground">Admin</DropdownMenuLabel>
                      {bookingAdminItems.map((item) => (
                        <DropdownMenuItem key={item.href} asChild>
                          <Link to={item.href} className="flex items-center gap-2">
                            <item.icon className="h-4 w-4" />
                            {item.label}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
                >
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">{profile?.full_name}</span>
                  <Menu className="h-4 w-4 sm:hidden" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{profile?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{profile?.email}</p>
                </div>
                <DropdownMenuSeparator />
                
                {/* Mobile nav items */}
                <div className="md:hidden">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Fartyg</DropdownMenuLabel>
                  {vesselNavItems.map((item) => (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link to={item.href} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                  {isAdmin && vesselAdminItems.map((item) => (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link to={item.href} className="flex items-center gap-2 text-muted-foreground">
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Bokningar</DropdownMenuLabel>
                  {bookingNavItems.map((item) => (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link to={item.href} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                  {isAdmin && bookingAdminItems.map((item) => (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link to={item.href} className="flex items-center gap-2 text-muted-foreground">
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </div>
                
                {isSuperadmin && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/backoffice" className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Back Office
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem asChild>
                  <Link to="/" className="flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    Till startsidan
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  Logga ut
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container py-6 animate-fade-in flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-muted/30">
        <div className="container py-4 text-center text-sm text-muted-foreground">
          Sealogg.se en del av AhrensGroup AB • Org.nr 559553-5443
        </div>
      </footer>
    </div>
  );
}
