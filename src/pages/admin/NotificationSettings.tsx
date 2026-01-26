import { MainLayout } from '@/components/layout/MainLayout';
import { NotificationSettings as NotificationSettingsComponent } from '@/components/notifications/NotificationSettings';

export default function NotificationSettingsPage() {
  return (
    <MainLayout>
      <div className="container max-w-2xl py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Notifikationsinställningar</h1>
          <p className="text-muted-foreground">
            Hantera dina e-post- och push-notifikationer
          </p>
        </div>
        
        <NotificationSettingsComponent />
      </div>
    </MainLayout>
  );
}
