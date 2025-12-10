import { useImpersonation } from '@/hooks/useImpersonation';
import { Button } from '@/components/ui/button';
import { X, Eye } from 'lucide-react';

export function ImpersonationBanner() {
  const { impersonatedUser, isImpersonating, stopImpersonation } = useImpersonation();

  if (!isImpersonating || !impersonatedUser) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-amber-950 py-2 px-4 flex items-center justify-center gap-3">
      <Eye className="h-4 w-4" />
      <span className="text-sm font-medium">
        Visualizando como: <strong>{impersonatedUser.full_name || impersonatedUser.email}</strong>
      </span>
      <Button
        size="sm"
        variant="outline"
        className="h-7 bg-amber-600 border-amber-700 text-amber-950 hover:bg-amber-700"
        onClick={stopImpersonation}
      >
        <X className="h-3 w-3 mr-1" />
        Sair
      </Button>
    </div>
  );
}
