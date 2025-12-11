import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAdmin, UserStats } from '@/hooks/useAdmin';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Users, Smartphone, MessageSquare, BarChart3, Shield, Edit, ArrowLeft, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading, users, loadingUsers, updateSubscription, fetchUsers } = useAdmin();
  const [editingUser, setEditingUser] = useState<UserStats | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [newPlan, setNewPlan] = useState<string>('');
  const [saving, setSaving] = useState(false);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Skeleton className="h-8 w-64 mb-8" />
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const totalUsers = users.length;
  const totalDevices = users.reduce((sum, u) => sum + u.devices_count, 0);
  const totalMessages = users.reduce((sum, u) => sum + u.messages_sent, 0);
  const activeSubscriptions = users.filter(u => u.subscription_status === 'active').length;

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Ativo</Badge>;
      case 'trial':
        return <Badge className="bg-blue-500">Trial</Badge>;
      case 'expired':
        return <Badge variant="destructive">Expirado</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Cancelado</Badge>;
      default:
        return <Badge variant="outline">-</Badge>;
    }
  };

  const handleEdit = (userStats: UserStats) => {
    setEditingUser(userStats);
    setNewStatus(userStats.subscription_status || 'trial');
    setNewPlan(userStats.subscription_plan || 'standard');
  };

  const handleSave = async () => {
    if (!editingUser) return;

    setSaving(true);
    try {
      await updateSubscription(
        editingUser.user_id,
        newStatus as 'trial' | 'active' | 'expired' | 'cancelled',
        newPlan
      );
      toast.success('Assinatura atualizada com sucesso');
      setEditingUser(null);
    } catch (error) {
      toast.error('Erro ao atualizar assinatura');
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="flex h-14 md:h-16 items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-2 md:gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2 md:gap-3">
              <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-xl bg-gradient-hero shadow-md">
                <Zap className="h-4 w-4 md:h-5 md:w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-display text-base md:text-lg font-bold text-foreground">ZapMassa</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">Painel Admin</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-8 overflow-auto">
        <div className="flex items-center gap-2 md:gap-3 mb-6 md:mb-8">
          <Shield className="h-6 w-6 md:h-8 md:w-8 text-primary" />
          <h1 className="text-xl md:text-3xl font-bold">Painel de Administração</h1>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4 mb-6 md:mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-4 md:p-6 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">Total de Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
              <div className="text-xl md:text-2xl font-bold">{totalUsers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-4 md:p-6 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">Aparelhos</CardTitle>
              <Smartphone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
              <div className="text-xl md:text-2xl font-bold">{totalDevices}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-4 md:p-6 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">Mensagens</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
              <div className="text-xl md:text-2xl font-bold">{totalMessages.toLocaleString('pt-BR')}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-4 md:p-6 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">Assinaturas</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
              <div className="text-xl md:text-2xl font-bold">{activeSubscriptions}</div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base md:text-lg">Usuários</CardTitle>
              <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loadingUsers}>
                Atualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 md:p-6 md:pt-0">
            {loadingUsers ? (
              <div className="space-y-2 p-4 md:p-0">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px]">Usuário</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden sm:table-cell">Plano</TableHead>
                      <TableHead className="text-center hidden md:table-cell">Aparelhos</TableHead>
                      <TableHead className="text-center hidden md:table-cell">Mensagens</TableHead>
                      <TableHead className="text-center hidden lg:table-cell">Campanhas</TableHead>
                      <TableHead className="hidden lg:table-cell">Cadastro</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((userStats) => (
                      <TableRow key={userStats.user_id}>
                        <TableCell>
                          <div>
                            <div className="font-medium text-sm">{userStats.full_name || 'Sem nome'}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[150px]">{userStats.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(userStats.subscription_status)}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline" className="text-xs">
                            {userStats.subscription_plan === 'premium' ? 'Premium' : 'Standard'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center hidden md:table-cell">{userStats.devices_count}</TableCell>
                        <TableCell className="text-center hidden md:table-cell">{userStats.messages_sent.toLocaleString('pt-BR')}</TableCell>
                        <TableCell className="text-center hidden lg:table-cell">{userStats.campaigns_count}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {userStats.created_at 
                            ? format(new Date(userStats.created_at), 'dd/MM/yyyy', { locale: ptBR })
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(userStats)}
                            title="Editar assinatura"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Assinatura</DialogTitle>
            </DialogHeader>
            {editingUser && (
              <div className="space-y-4 py-4">
                <div>
                  <p className="text-sm text-muted-foreground">Usuário</p>
                  <p className="font-medium">{editingUser.email}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="expired">Expirado</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Plano</label>
                  <Select value={newPlan} onValueChange={setNewPlan}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingUser(null)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
