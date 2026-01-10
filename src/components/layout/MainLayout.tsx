import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Waves } from 'lucide-react';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col min-h-screen">
          {/* Compact Header */}
          <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-12 items-center gap-4 px-4">
              <SidebarTrigger />
              <div className="flex items-center gap-2 md:hidden">
                <Waves className="h-5 w-5 text-primary" />
                <span className="font-logo text-lg font-bold text-primary">SeaLogg</span>
              </div>
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 container py-6 animate-fade-in">
            {children}
          </main>

          {/* Footer */}
          <footer className="border-t border-border/40 bg-muted/30">
            <div className="container py-4 text-center text-sm text-muted-foreground">
              Sealogg.se en del av AhrensGroup AB • Org.nr 559553-5443
            </div>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}
