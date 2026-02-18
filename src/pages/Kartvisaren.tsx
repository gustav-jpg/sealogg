import { MainLayout } from '@/components/layout/MainLayout';

export default function Kartvisaren() {
  return (
    <MainLayout>
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <h1 className="text-2xl font-semibold mb-4">Kartvisaren</h1>
        <iframe
          src="https://geokatalog.sjofartsverket.se/kartvisarefyren/"
          className="flex-1 w-full rounded-lg border border-border"
          title="Sjöfartsverkets Kartvisare"
          allowFullScreen
        />
      </div>
    </MainLayout>
  );
}
