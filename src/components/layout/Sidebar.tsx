import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Users, 
  MessageSquare, 
  Send, 
  Settings,
  Zap,
  FileText,
  LogOut,
  Shield
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'contacts', label: 'Contatos', icon: Users },
  { id: 'templates', label: 'Templates', icon: FileText },
  { id: 'campaigns', label: 'Campanhas', icon: MessageSquare },
  { id: 'send', label: 'Enviar', icon: Send },
  { id: 'settings', label: 'Configurações', icon: Settings },
];

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const { signOut } = useAuth();
  const { isAdmin } = useAdmin();
  
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-card">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-border px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-hero shadow-md">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-foreground">ZapMassa</h1>
            <p className="text-xs text-muted-foreground">Mensagens em massa</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200",
                  isActive 
                    ? "bg-accent text-accent-foreground shadow-sm" 
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-4 space-y-4">
          {isAdmin && (
            <Link to="/admin">
              <Button 
                variant="outline" 
                className="w-full justify-start border-primary/50 text-primary hover:bg-primary/10"
              >
                <Shield className="mr-2 h-4 w-4" />
                Painel Admin
              </Button>
            </Link>
          )}
          <div className="rounded-lg bg-accent/50 p-4">
            <p className="text-xs font-medium text-accent-foreground">Integração n8n</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Configure seu webhook para automação
            </p>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-muted-foreground hover:text-destructive"
            onClick={() => signOut()}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>
    </aside>
  );
}
