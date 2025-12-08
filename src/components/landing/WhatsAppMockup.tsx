import { useState, useEffect } from 'react';
import { MessageSquare, Check, CheckCheck, Send, Users } from 'lucide-react';

type ContactStatus = 'pending' | 'sending' | 'sent' | 'delivered';

interface Contact {
  name: string;
  phone: string;
  status: ContactStatus;
}

const initialContacts: Contact[] = [
  { name: 'João Silva', phone: '+55 81 9****-1234', status: 'pending' },
  { name: 'Maria Santos', phone: '+55 11 9****-5678', status: 'pending' },
  { name: 'Pedro Oliveira', phone: '+55 21 9****-9012', status: 'pending' },
  { name: 'Ana Costa', phone: '+55 31 9****-3456', status: 'pending' },
  { name: 'Lucas Ferreira', phone: '+55 41 9****-7890', status: 'pending' },
];

const StatusIcon = ({ status }: { status: ContactStatus }) => {
  switch (status) {
    case 'delivered':
      return <CheckCheck className="h-3 w-3 text-[#53bdeb] animate-scale-in" />;
    case 'sent':
      return <CheckCheck className="h-3 w-3 text-muted-foreground animate-scale-in" />;
    case 'sending':
      return <Check className="h-3 w-3 text-muted-foreground animate-pulse" />;
    default:
      return <div className="h-3 w-3 rounded-full border-2 border-muted-foreground/30" />;
  }
};

const getStatusLabel = (status: ContactStatus) => {
  switch (status) {
    case 'delivered': return 'Entregue';
    case 'sent': return 'Enviado';
    case 'sending': return 'Enviando';
    default: return 'Aguardando';
  }
};

const getStatusStyle = (status: ContactStatus) => {
  switch (status) {
    case 'delivered': return 'bg-green-500/10 text-green-500';
    case 'sent': return 'bg-blue-500/10 text-blue-500';
    case 'sending': return 'bg-primary/10 text-primary';
    default: return 'bg-muted text-muted-foreground';
  }
};

export default function WhatsAppMockup() {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [messageVisible, setMessageVisible] = useState(false);
  const [typingVisible, setTypingVisible] = useState(true);

  // Animation cycle
  useEffect(() => {
    // Show typing first, then message
    const typingTimer = setTimeout(() => {
      setTypingVisible(false);
      setMessageVisible(true);
    }, 1500);

    return () => clearTimeout(typingTimer);
  }, []);

  // Process contacts one by one
  useEffect(() => {
    if (!messageVisible) return;

    const interval = setInterval(() => {
      setContacts(prev => {
        const newContacts = [...prev];
        
        // Find first pending contact
        const pendingIndex = newContacts.findIndex(c => c.status === 'pending');
        
        // Update statuses progressively
        newContacts.forEach((contact, idx) => {
          if (contact.status === 'sent') {
            newContacts[idx] = { ...contact, status: 'delivered' };
          } else if (contact.status === 'sending') {
            newContacts[idx] = { ...contact, status: 'sent' };
          }
        });

        // Start sending next pending contact
        if (pendingIndex !== -1) {
          newContacts[pendingIndex] = { ...newContacts[pendingIndex], status: 'sending' };
          setCurrentIndex(pendingIndex);
        }

        // Check if all delivered, then reset
        const allDelivered = newContacts.every(c => c.status === 'delivered');
        if (allDelivered) {
          setTimeout(() => {
            setContacts(initialContacts.map(c => ({ ...c, status: 'pending' })));
            setCurrentIndex(0);
          }, 2000);
        }

        return newContacts;
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [messageVisible]);

  const deliveredCount = contacts.filter(c => c.status === 'delivered').length;
  const sentCount = contacts.filter(c => c.status === 'sent').length;
  const sendingCount = contacts.filter(c => c.status === 'sending').length;
  const progress = ((deliveredCount + sentCount + sendingCount) / contacts.length) * 100;

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      {/* Main Container */}
      <div className="relative bg-gradient-to-br from-card via-card to-card/80 rounded-3xl border shadow-2xl shadow-primary/10 overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-pulse" />
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
              <div className="bg-[#0b141a] p-4 min-h-[240px] relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-5" style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }} />
                
                {/* Typing Indicator */}
                {typingVisible && (
                  <div className="relative animate-fade-in">
                    <div className="bg-[#202c33] rounded-lg p-3 max-w-[100px] shadow-lg">
                      <div className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Message Bubble */}
                {messageVisible && (
                  <div className="relative animate-fade-in">
                    <div className="bg-[#005c4b] rounded-lg p-3 max-w-[85%] ml-auto shadow-lg transform transition-all duration-500">
                      <p className="text-white text-sm leading-relaxed">
                        🔥 <strong>MEGA PROMOÇÃO!</strong><br /><br />
                        Olá, <span className="bg-white/20 px-1 rounded">{`{{nome}}`}</span>, tudo bem?<br /><br />
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
                    
                    {/* Flying message indicator */}
                    {sendingCount > 0 && (
                      <div className="absolute -right-2 top-1/2 -translate-y-1/2">
                        <div className="flex items-center gap-1 animate-pulse">
                          <Send className="h-4 w-4 text-primary animate-bounce" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Side - Recipients List */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Users className="h-4 w-4 text-primary" />
              <span className="font-medium">Destinatários ({contacts.length} contatos)</span>
            </div>
            
            <div className="space-y-2 max-h-[280px] overflow-hidden">
              {contacts.map((contact, index) => (
                <div
                  key={contact.name}
                  className={`flex items-center gap-3 rounded-xl p-3 border transition-all duration-500 ${
                    contact.status === 'sending' 
                      ? 'bg-primary/10 border-primary/30 scale-[1.02] shadow-lg shadow-primary/10' 
                      : contact.status === 'delivered'
                      ? 'bg-green-500/5 border-green-500/20'
                      : contact.status === 'sent'
                      ? 'bg-blue-500/5 border-blue-500/20'
                      : 'bg-secondary/50 border-border/50'
                  }`}
                >
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${
                    contact.status === 'sending'
                      ? 'bg-primary/20 text-primary ring-2 ring-primary/30 ring-offset-2 ring-offset-background'
                      : contact.status === 'delivered'
                      ? 'bg-green-500/20 text-green-500'
                      : 'bg-gradient-to-br from-primary/20 to-primary/10 text-primary'
                  }`}>
                    {contact.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{contact.name}</p>
                    <p className="text-xs text-muted-foreground">{contact.phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full transition-all duration-300 ${getStatusStyle(contact.status)}`}>
                      {getStatusLabel(contact.status)}
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
                <span className="text-primary font-medium transition-all duration-300">
                  {deliveredCount + sentCount}/{contacts.length} ({Math.round(((deliveredCount + sentCount) / contacts.length) * 100)}%)
                </span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-green-500 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Floating Stats */}
      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 md:gap-4">
        <div className="bg-card border shadow-lg rounded-full px-3 md:px-4 py-2 flex items-center gap-2 transition-all duration-300">
          <div className={`h-2 w-2 rounded-full transition-all duration-300 ${deliveredCount > 0 ? 'bg-green-500 animate-pulse' : 'bg-green-500/30'}`} />
          <span className="text-xs md:text-sm font-medium">{deliveredCount} entregues</span>
        </div>
        <div className="bg-card border shadow-lg rounded-full px-3 md:px-4 py-2 flex items-center gap-2 transition-all duration-300">
          <div className={`h-2 w-2 rounded-full transition-all duration-300 ${sendingCount > 0 ? 'bg-primary animate-pulse' : 'bg-primary/30'}`} />
          <span className="text-xs md:text-sm font-medium">{sendingCount} enviando</span>
        </div>
        <div className="bg-card border shadow-lg rounded-full px-3 md:px-4 py-2 flex items-center gap-2 transition-all duration-300">
          <div className={`h-2 w-2 rounded-full transition-all duration-300 ${contacts.filter(c => c.status === 'pending').length > 0 ? 'bg-muted-foreground' : 'bg-muted-foreground/30'}`} />
          <span className="text-xs md:text-sm font-medium">{contacts.filter(c => c.status === 'pending').length} aguardando</span>
        </div>
      </div>
    </div>
  );
}
