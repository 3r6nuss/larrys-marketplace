import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import AppSidebar from '@/components/layout/AppSidebar';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/context/AuthContext';
import NavigationWheel from '@/components/NavigationWheel';

export default function DashboardLayout() {
  const { user } = useAuth();

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 items-center gap-2 border-b border-border px-4 shrink-0">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 !h-4" />
            <div className="flex-1" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Larry's Marketplace</span>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
      <Toaster richColors position="top-right" />
      <NavigationWheel />
    </TooltipProvider>
  );
}
