import { ReactNode, useState, useEffect } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import sealoggLogo from '@/assets/sealog-logo.png';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [defaultOpen, setDefaultOpen] = useState(() => window.innerWidth >= 1024);

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col min-h-screen">
          {/* Compact Header with safe area built in */}
          <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-12 items-center gap-4 px-4">
              <SidebarTrigger />
              <div className="flex items-center md:hidden">
                <img src={sealoggLogo} alt="SeaLogg" className="h-6" />
              </div>
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 container py-6 px-3 md:px-4 lg:px-8 animate-fade-in overflow-x-hidden max-w-full">
            {children}
          </main>

          {/* Footer */}
          <footer className="border-t border-border/40 bg-muted/30">
            <div className="container py-4 text-center text-sm text-muted-foreground">
              SeaLogg™ – en del av AhrensGroup AB
            </div>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}
