import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
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
  Waves,
  Home,
  Building2,
  Activity,
  Anchor,
  CalendarDays,
  UtensilsCrossed,
  Wine,
  ChevronDown,
  ChevronsUpDown,
  Check,
} from 'lucide-react';
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
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

type AppModule = 'logbook' | 'deviations' | 'fault_cases' | 'self_control' | 'checklists' | 'bookings';

// Map modules to nav items
const MODULE_NAV_MAP: Record<AppModule, { href: string; label: string; icon: any }> = {
  logbook: { href: '/portal', label: 'Loggböcker', icon: BookOpen },
  deviations: { href: '/portal/deviations', label: 'Avvikelser', icon: AlertTriangle },
  fault_cases: { href: '/portal/fault-cases', label: 'Felärenden', icon: Wrench },
  self_control: { href: '/portal/self-control', label: 'Egenkontroll', icon: ClipboardCheck },
  checklists: { href: '/portal/checklists', label: 'Checklistor', icon: ClipboardList },
  bookings: { href: '/bookings', label: 'Kalender', icon: CalendarDays },
};

export function AppSidebar() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  useEffect(() => {
    const checkSuperadmin = async () => {
      if (!user) return;
      const { data } = await supabase.rpc('is_superadmin', { _user_id: user.id });
      setIsSuperadmin(!!data);
    };
    checkSuperadmin();
  }, [user]);

  // Fetch user's organizations
  const { data: userOrgs } = useQuery({
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
      return data?.filter(d => (d.organizations as any)?.is_active) || [];
    },
    enabled: !!user,
  });

  // Set default org
  useEffect(() => {
    if (userOrgs && userOrgs.length > 0 && !selectedOrgId) {
      setSelectedOrgId(userOrgs[0].organization_id);
    }
  }, [userOrgs, selectedOrgId]);

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

  const selectedOrg = userOrgs?.find(o => o.organization_id === selectedOrgId);

  // Filter nav items based on active modules
  const vesselModules: AppModule[] = ['logbook', 'deviations', 'fault_cases', 'self_control', 'checklists'];
  const bookingModules: AppModule[] = ['bookings'];

  const activeVesselModules = vesselModules.filter(m => orgModules?.includes(m) || isSuperadmin);
  const activeBookingModules = bookingModules.filter(m => orgModules?.includes(m) || isSuperadmin);

  const vesselNavItems = activeVesselModules.map(m => MODULE_NAV_MAP[m]);
  const bookingNavItems = activeBookingModules.map(m => MODULE_NAV_MAP[m]);

  // Always show qualifications for vessel section
  if (vesselNavItems.length > 0 || isSuperadmin) {
    vesselNavItems.push({ href: '/portal/qualifications', label: 'Behörigheter', icon: Award });
  }

  const vesselAdminItems = [
    { href: '/portal/admin/status', label: 'Statusöversikt', icon: Activity },
    { href: '/portal/admin/sea-days', label: 'Sjödagar', icon: Anchor },
    { href: '/portal/admin/vessels', label: 'Fartyg', icon: Ship },
    { href: '/portal/admin/users', label: 'Användare', icon: Users },
    { href: '/portal/admin/rules', label: 'Rollregler', icon: Settings },
    { href: '/portal/admin/control-points', label: 'Kontrollpunkter', icon: ClipboardCheck },
    { href: '/portal/admin/checklists', label: 'Checklistor', icon: ClipboardList },
  ];

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
        <Link to="/portal" className="flex items-center gap-2 px-2 py-1">
          <Waves className="h-6 w-6 text-primary-foreground shrink-0" />
          {!isCollapsed && (
            <span className="font-logo text-lg font-extrabold text-primary-foreground">
              SeaLogg
            </span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {/* Organization Switcher */}
        {userOrgs && userOrgs.length > 0 && (
          <SidebarGroup>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  className={cn(
                    "w-full justify-between",
                    !isCollapsed && "px-2"
                  )}
                  tooltip={selectedOrg ? (selectedOrg.organizations as any)?.name : 'Välj organisation'}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="h-4 w-4 shrink-0" />
                    {!isCollapsed && (
                      <span className="truncate font-medium">
                        {selectedOrg ? (selectedOrg.organizations as any)?.name : 'Välj organisation'}
                      </span>
                    )}
                  </div>
                  {!isCollapsed && hasMultipleOrgs && (
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                  )}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              {hasMultipleOrgs && (
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
              )}
            </DropdownMenu>
          </SidebarGroup>
        )}

        <SidebarSeparator />

        {/* Fartyg Section */}
        {vesselNavItems.length > 0 && (
          <Collapsible defaultOpen={isInVesselSection} className="group/collapsible">
            <SidebarGroup>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent rounded-md h-9 text-sm font-semibold">
                  <Ship className="h-4 w-4 mr-2" />
                  {!isCollapsed && (
                    <>
                      <span className="flex-1">Fartyg</span>
                      <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </>
                  )}
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
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
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}

        {/* Fartyg Admin */}
        {isAdmin && vesselNavItems.length > 0 && (
          <Collapsible defaultOpen={isInVesselSection && location.pathname.includes('/admin')}>
            <SidebarGroup>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent rounded-md h-9 text-sm font-medium text-muted-foreground">
                  <Settings className="h-4 w-4 mr-2" />
                  {!isCollapsed && (
                    <>
                      <span className="flex-1">Inställningar</span>
                      <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </>
                  )}
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
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
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}

        {vesselNavItems.length > 0 && bookingNavItems.length > 0 && (
          <SidebarSeparator />
        )}

        {/* Bokningar Section */}
        {bookingNavItems.length > 0 && (
          <Collapsible defaultOpen={isInBookingSection} className="group/collapsible">
            <SidebarGroup>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent rounded-md h-9 text-sm font-semibold">
                  <BookOpen className="h-4 w-4 mr-2" />
                  {!isCollapsed && (
                    <>
                      <span className="flex-1">Bokningar</span>
                      <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </>
                  )}
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
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
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}

        {/* Bokningar Admin */}
        {isAdmin && bookingNavItems.length > 0 && (
          <Collapsible defaultOpen={isInBookingSection && location.pathname.includes('/admin')}>
            <SidebarGroup>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent rounded-md h-9 text-sm font-medium text-muted-foreground">
                  <Settings className="h-4 w-4 mr-2" />
                  {!isCollapsed && (
                    <>
                      <span className="flex-1">Inställningar</span>
                      <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </>
                  )}
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
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
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
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
        
        {/* User info */}
        <div className={cn(
          "flex items-center gap-2 px-2 py-1 rounded-md bg-sidebar-accent/50",
          isCollapsed && "justify-center"
        )}>
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
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
