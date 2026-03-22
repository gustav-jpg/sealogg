import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog';
import {
  Ship,
  BookOpen,
  Settings,
  User,
  LogOut,
  Users,
  Award,
  AlertTriangle,
  Wrench,
  ClipboardCheck,
  ClipboardList,
  Home,
  Building2,
  Activity,
  Anchor,
  CalendarDays,
  UtensilsCrossed,
  Wine,
  GraduationCap,
  ChevronDown,
  ChevronsUpDown,
  Check,
  UserCheck,
  Route,
  Bell,
  Map,
  FileText,
  HelpCircle,
} from 'lucide-react';
import sealoggLogo from '@/assets/sealog-logo-white.png';
import sealoggIcon from '@/assets/sealog-icon.png';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { KeyRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

type AppModule = 'logbook' | 'deviations' | 'fault_cases' | 'self_control' | 'checklists' | 'bookings' | 'documents';

// Map modules to nav items
const MODULE_NAV_MAP: Record<AppModule, { href: string; label: string; icon: any }> = {
  logbook: { href: '/portal/logbooks', label: 'Loggböcker', icon: BookOpen },
  deviations: { href: '/portal/deviations', label: 'Avvikelser', icon: AlertTriangle },
  fault_cases: { href: '/portal/fault-cases', label: 'Felärenden', icon: Wrench },
  self_control: { href: '/portal/self-control', label: 'Underhåll', icon: ClipboardCheck },
  checklists: { href: '/portal/checklists', label: 'Checklistor', icon: ClipboardList },
  bookings: { href: '/bookings', label: 'Kalender', icon: CalendarDays },
  documents: { href: '/portal/documents', label: 'Dokument', icon: FileText },
};

export function AppSidebar() {
  const { user, profile, isAdmin, isSkeppare, isDeckhand, signOut } = useAuth();
  const { selectedOrgId, selectedOrg, userOrgs, setSelectedOrgId, isLoading: isOrgLoading } = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const { state, isMobile } = useSidebar();
  const isCollapsed = state === 'collapsed' && !isMobile;
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  useEffect(() => {
    const checkSuperadmin = async () => {
      if (!user) return;
      const { data } = await supabase.rpc('is_superadmin', { _user_id: user.id });
      setIsSuperadmin(!!data);
    };
    checkSuperadmin();
  }, [user]);

  // Fetch active modules for selected org
  const { data: orgModules } = useQuery({
    queryKey: ['org-modules', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const { data, error } = await supabase
        .from('organization_features')
        .select('module')
        .eq('organization_id', selectedOrgId)
        .eq('is_active', true)
        .lte('starts_at', new Date().toISOString().split('T')[0])
        .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString().split('T')[0]}`);
      if (error) throw error;
      return data?.map(d => d.module as AppModule) || [];
    },
    enabled: !!selectedOrgId,
  });

  const currentSelectedOrg = userOrgs?.find(o => o.organization_id === selectedOrgId);

  // Filter nav items based on active modules and user role
  const vesselModules: AppModule[] = ['logbook', 'deviations', 'fault_cases', 'self_control', 'checklists', 'documents'];
  const bookingModules: AppModule[] = ['bookings'];

  // Deckhand only sees: Startsida, Passagerare, Felärenden, Checklistor
  const deckhandAllowedModules: AppModule[] = ['fault_cases', 'checklists'];

  let activeVesselModules = vesselModules.filter(m => orgModules?.includes(m) || isSuperadmin);
  let activeBookingModules = bookingModules.filter(m => orgModules?.includes(m) || isSuperadmin);

  // If user is deckhand (and not admin), filter to only allowed modules
  if (isDeckhand && !isAdmin) {
    activeVesselModules = activeVesselModules.filter(m => deckhandAllowedModules.includes(m));
    activeBookingModules = []; // Deckhand has no access to bookings
  }

  const vesselNavItems = activeVesselModules.map(m => MODULE_NAV_MAP[m]);
  
  // Spare parts is now a tab within Self Control, no separate nav item needed

  const bookingNavItems = activeBookingModules.map(m => MODULE_NAV_MAP[m]);

  // Always show Startsida first for all users
  if (vesselNavItems.length > 0 || isSuperadmin || isDeckhand) {
    vesselNavItems.unshift({ href: '/portal/startsida', label: 'Startsida', icon: Home });
    
    // Add Passagerare link for users with logbook module OR deckhand role
    const hasLogbookAccess = orgModules?.includes('logbook') || isSuperadmin;
    if (hasLogbookAccess || isDeckhand) {
      // For deckhand, add after Startsida (index 1)
      // For others, add after logbook
      const insertIndex = isDeckhand && !isAdmin 
        ? 1 
        : vesselNavItems.findIndex(item => item.href === '/portal/logbooks') + 1;
      
      if (insertIndex > 0 || (isDeckhand && !isAdmin)) {
        vesselNavItems.splice(
          isDeckhand && !isAdmin ? 1 : insertIndex, 
          0, 
          { href: '/portal/passagerare', label: 'Passagerare', icon: UserCheck }
        );
      }
    }
    
    // Only add Certifikat for non-deckhand users
    if (!isDeckhand || isAdmin) {
      vesselNavItems.push({ href: '/portal/qualifications', label: 'Certifikat', icon: Award });
    }
    // Kartvisaren dold tills vidare – inväntar svar från Sjöfartsverket
    // vesselNavItems.push({ href: '/portal/kartvisaren', label: 'Kartvisaren', icon: Map });
  }

  // Base admin items always shown (only for admin)
  const baseVesselAdminItems = [
    { href: '/portal/admin/settings', label: 'Inställningar', icon: Settings },
    { href: '/portal/admin/status', label: 'Statusöversikt', icon: Activity },
    { href: '/portal/admin/vessels', label: 'Fartyg', icon: Ship },
    { href: '/portal/admin/users', label: 'Besättning', icon: Users },
    { href: '/portal/admin/notifications', label: 'Notifikationer', icon: Bell },
    
  ];

  // Items that Skeppare can also access
  const skeppareAdminItems = [
    { href: '/portal/admin/users', label: 'Besättning', icon: Users },
  ];

  // Module-specific admin items
  const moduleAdminItems: { module: AppModule; href: string; label: string; icon: any }[] = [
    { module: 'self_control', href: '/portal/admin/control-points', label: 'Kontrollpunkter', icon: ClipboardCheck },
    { module: 'checklists', href: '/portal/admin/checklists', label: 'Checklistor', icon: ClipboardList },
    { module: 'logbook', href: '/portal/admin/exercises', label: 'Övningar', icon: GraduationCap },
    { module: 'logbook', href: '/portal/admin/startsida', label: 'Intranät', icon: Home },
    { module: 'logbook', href: '/portal/admin/passagerare', label: 'Passagerarrutter', icon: Route },
  ];

  // Filter module-specific items based on active modules
  const filteredModuleAdminItems = moduleAdminItems
    .filter(item => orgModules?.includes(item.module) || isSuperadmin)
    .map(({ href, label, icon }) => ({ href, label, icon }));

  const vesselAdminItems = [...baseVesselAdminItems, ...filteredModuleAdminItems];

  const bookingAdminItems = [
    { href: '/bookings/admin/menus', label: 'Menyer', icon: UtensilsCrossed },
    { href: '/bookings/admin/drinks', label: 'Dryckespaket', icon: Wine },
  ];

  const isInVesselSection = location.pathname.startsWith('/portal');
  const isInBookingSection = location.pathname.startsWith('/bookings');

  const isActive = (href: string) => {
    if (href === '/portal' || href === '/bookings') {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const hasMultipleOrgs = (userOrgs?.length || 0) > 1;

  return (
    <Sidebar collapsible="icon">
      {/* Header with Logo */}
      <SidebarHeader className="border-b border-sidebar-border bg-primary">
        <Link to="/portal" className={cn("flex items-center px-2 py-1", isCollapsed && "justify-center")}>
          <img 
            src={isCollapsed ? sealoggIcon : sealoggLogo} 
            alt="SeaLogg" 
            className={isCollapsed ? "h-7 w-auto object-contain" : "h-7"} 
          />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {/* Organization Switcher */}
        {userOrgs && userOrgs.length > 0 && (
          <SidebarGroup>
            {hasMultipleOrgs ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    className={cn(
                      "w-full justify-between",
                      !isCollapsed && "px-2"
                    )}
                    tooltip={selectedOrg?.name || 'Välj organisation'}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="h-4 w-4 shrink-0" />
                      {!isCollapsed && (
                        <span className="truncate font-medium">
                          {selectedOrg?.name || 'Välj organisation'}
                        </span>
                      )}
                    </div>
                    {!isCollapsed && (
                      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                    )}
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {userOrgs.map((org) => {
                    const orgData = org.organizations as any;
                    return (
                      <DropdownMenuItem
                        key={org.organization_id}
                        onClick={() => setSelectedOrgId(org.organization_id)}
                        className="flex items-center justify-between"
                      >
                        <span>{orgData?.name}</span>
                        {org.organization_id === selectedOrgId && (
                          <Check className="h-4 w-4" />
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div
                className={cn(
                  "flex items-center gap-2 px-2 py-2 text-sidebar-foreground",
                  isCollapsed && "justify-center"
                )}
              >
                <Building2 className="h-4 w-4 shrink-0" />
                {!isCollapsed && (
                  <span className="truncate font-medium text-sm">
                    {selectedOrg?.name}
                  </span>
                )}
              </div>
            )}
          </SidebarGroup>
        )}

        <SidebarSeparator />

        {/* Main Navigation */}
        {vesselNavItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {vesselNavItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href)}
                      tooltip={item.label}
                    >
                      <Link to={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Admin Settings */}
        {isAdmin && vesselNavItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs text-muted-foreground px-2">
              Inställningar
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {vesselAdminItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href)}
                      tooltip={item.label}
                    >
                      <Link to={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Skeppare-only Settings (when not admin) */}
        {!isAdmin && isSkeppare && vesselNavItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs text-muted-foreground px-2">
              Inställningar
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {skeppareAdminItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href)}
                      tooltip={item.label}
                    >
                      <Link to={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {vesselNavItems.length > 0 && bookingNavItems.length > 0 && (
          <SidebarSeparator />
        )}

        {/* Bokningar Section */}
        {bookingNavItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs text-muted-foreground px-2">
              Bokningar
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {bookingNavItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href)}
                      tooltip={item.label}
                    >
                      <Link to={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Bokningar Admin */}
        {isAdmin && bookingNavItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs text-muted-foreground px-2">
              Bokningsinställningar
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {bookingAdminItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href)}
                      tooltip={item.label}
                    >
                      <Link to={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Superadmin */}
        {isSuperadmin && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname.startsWith('/backoffice')}
                    tooltip="Back Office"
                  >
                    <Link to="/backoffice">
                      <Building2 className="h-4 w-4" />
                      <span>Back Office</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      {/* Footer with User */}
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={signOut}
              tooltip="Logga ut"
              className="text-destructive hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              <span>Logga ut</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        
        {/* User info - clickable to change password */}
        <button
          onClick={() => setShowPasswordDialog(true)}
          className={cn(
            "flex items-center gap-2 px-2 py-1 rounded-md bg-sidebar-accent/50 hover:bg-sidebar-accent transition-colors w-full text-left cursor-pointer",
            isCollapsed && "justify-center"
          )}
          title="Byt lösenord"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {profile?.full_name ? getInitials(profile.full_name) : <User className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate">{profile?.full_name}</span>
              <span className="text-xs text-muted-foreground truncate">{profile?.email}</span>
            </div>
          )}
        </button>
      </SidebarFooter>

      <ChangePasswordDialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog} />
    </Sidebar>
  );
}
