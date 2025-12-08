import { MessageSquare, Check, CheckCheck, Send, Users } from 'lucide-react';

const contacts = [
  { name: 'João Silva', phone: '+55 81 9****-1234', status: 'delivered', delay: '0s' },
  { name: 'Maria Santos', phone: '+55 11 9****-5678', status: 'delivered', delay: '0.2s' },
  { name: 'Pedro Oliveira', phone: '+55 21 9****-9012', status: 'sending', delay: '0.4s' },
  { name: 'Ana Costa', phone: '+55 31 9****-3456', status: 'pending', delay: '0.6s' },
  { name: 'Lucas Ferreira', phone: '+55 41 9****-7890', status: 'pending', delay: '0.8s' },
];

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'delivered':
      return <CheckCheck className="h-3 w-3 text-[#53bdeb]" />;
    case 'sending':
      return <Check className="h-3 w-3 text-muted-foreground" />;
    default:
      return <div className="h-3 w-3 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />;
  }
};

export default function WhatsAppMockup() {
  return (
    <div className="relative w-full max-w-4xl mx-auto">
      {/* Main Container */}
      <div className="relative bg-gradient-to-br from-card via-card to-card/80 rounded-3xl border shadow-2xl shadow-primary/10 overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/10 rounded-full blur-2xl" />
        
        <div className="relative grid md:grid-cols-2 gap-6 p-6 md:p-8">
          {/* Left Side - Message Being Sent */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Send className="h-4 w-4 text-primary" />
              <span className="font-medium">Mensagem sendo enviada</span>
            </div>
            
            {/* WhatsApp Phone Mockup */}
            <div className="bg-[#111b21] rounded-2xl overflow-hidden shadow-xl">
              {/* Phone Header */}
              <div className="bg-[#202c33] px-4 py-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white text-sm">ZapMassa</p>
                  <p className="text-xs text-gray-400">Campanha: Black Friday 2024</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-primary bg-primary/20 px-2 py-1 rounded-full">
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  Enviando
                </div>
              </div>
              
              {/* Chat Area */}
              <div className="bg-[#0b141a] p-4 min-h-[200px] relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-5" style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }} />
                
                {/* Message Bubble */}
                <div className="relative animate-fade-in">
                  <div className="bg-[#005c4b] rounded-lg p-3 max-w-[85%] ml-auto shadow-lg">
                    <p className="text-white text-sm leading-relaxed">
                      🔥 <strong>MEGA PROMOÇÃO!</strong><br /><br />
                      Olá, {"{{nome}}"}, tudo bem?<br /><br />
                      Você foi selecionado para uma oferta EXCLUSIVA! 🎁<br /><br />
                      📦 Até 70% OFF em todos os produtos<br />
                      🚚 Frete grátis acima de R$99<br />
                      ⏰ Só até domingo!<br /><br />
                      👉 Acesse: link.exemplo.com
                    </p>
                    <div className="flex items-center justify-end gap-1 mt-2">
                      <span className="text-[10px] text-gray-400">14:32</span>
                      <CheckCheck className="h-3 w-3 text-[#53bdeb]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Recipients List */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Users className="h-4 w-4 text-primary" />
              <span className="font-medium">Destinatários ({contacts.length} contatos)</span>
            </div>
            
            <div className="space-y-2">
              {contacts.map((contact, index) => (
                <div
                  key={contact.name}
                  className="flex items-center gap-3 bg-secondary/50 rounded-xl p-3 border border-border/50 animate-fade-in"
                  style={{ animationDelay: contact.delay }}
                >
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                    {contact.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{contact.name}</p>
                    <p className="text-xs text-muted-foreground">{contact.phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      contact.status === 'delivered' 
                        ? 'bg-green-500/10 text-green-500' 
                        : contact.status === 'sending'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {contact.status === 'delivered' ? 'Entregue' : contact.status === 'sending' ? 'Enviando' : 'Aguardando'}
                    </span>
                    <StatusIcon status={contact.status} />
                  </div>
                </div>
              ))}
            </div>
            
            {/* Progress Bar */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Progresso do envio</span>
                <span className="text-primary font-medium">3/5 (60%)</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-1000"
                  style={{ width: '60%' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Floating Stats */}
      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4">
        <div className="bg-card border shadow-lg rounded-full px-4 py-2 flex items-center gap-2 animate-fade-in" style={{ animationDelay: '0.5s' }}>
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium">2 entregues</span>
        </div>
        <div className="bg-card border shadow-lg rounded-full px-4 py-2 flex items-center gap-2 animate-fade-in" style={{ animationDelay: '0.7s' }}>
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="text-sm font-medium">1 enviando</span>
        </div>
        <div className="bg-card border shadow-lg rounded-full px-4 py-2 flex items-center gap-2 animate-fade-in" style={{ animationDelay: '0.9s' }}>
          <div className="h-2 w-2 rounded-full bg-muted-foreground" />
          <span className="text-sm font-medium">2 aguardando</span>
        </div>
      </div>
    </div>
  );
}
