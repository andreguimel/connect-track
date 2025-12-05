import { Check, CheckCheck, Smartphone } from 'lucide-react';

interface WhatsAppPreviewProps {
  message: string;
  mediaUrl?: string | null;
  mediaType?: 'image' | 'video' | 'audio' | null;
  contactName?: string;
}

export function WhatsAppPreview({ message, mediaUrl, mediaType, contactName = 'João' }: WhatsAppPreviewProps) {
  const currentTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const processedMessage = message.replace('{nome}', contactName);

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Smartphone className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-medium text-foreground text-sm">Preview WhatsApp</h3>
      </div>
      
      {/* Phone Frame */}
      <div className="mx-auto max-w-[280px]">
        <div className="rounded-[2rem] border-[8px] border-zinc-800 bg-zinc-800 shadow-xl overflow-hidden">
          {/* Phone Notch */}
          <div className="bg-zinc-800 h-6 flex items-center justify-center">
            <div className="w-16 h-4 bg-zinc-900 rounded-full" />
          </div>
          
          {/* WhatsApp Header */}
          <div className="bg-[#075E54] px-3 py-2 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-zinc-300 flex items-center justify-center text-zinc-600 text-xs font-bold">
              {contactName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{contactName}</p>
              <p className="text-emerald-200 text-[10px]">online</p>
            </div>
          </div>
          
          {/* Chat Background */}
          <div 
            className="min-h-[300px] p-3 relative"
            style={{
              backgroundColor: '#ECE5DD',
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c5beb5' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          >
            {/* Message Bubble */}
            <div className="flex justify-end">
              <div className="max-w-[85%] bg-[#DCF8C6] rounded-lg shadow-sm overflow-hidden">
                {/* Media Preview */}
                {mediaUrl && mediaType === 'image' && (
                  <div className="relative">
                    <img 
                      src={mediaUrl} 
                      alt="Mídia" 
                      className="w-full max-h-[150px] object-cover"
                    />
                  </div>
                )}
                
                {mediaUrl && mediaType === 'video' && (
                  <div className="relative bg-zinc-900">
                    <video 
                      src={mediaUrl} 
                      className="w-full max-h-[150px] object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                        <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-zinc-800 border-b-[8px] border-b-transparent ml-1" />
                      </div>
                    </div>
                  </div>
                )}
                
                {mediaUrl && mediaType === 'audio' && (
                  <div className="px-2 pt-2 pb-1">
                    <div className="flex items-center gap-2 bg-[#c5e1a5] rounded-full px-3 py-2">
                      <div className="w-8 h-8 rounded-full bg-[#075E54] flex items-center justify-center flex-shrink-0">
                        <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-white border-b-[6px] border-b-transparent ml-0.5" />
                      </div>
                      <div className="flex-1 flex items-center gap-0.5">
                        {Array.from({ length: 20 }).map((_, i) => (
                          <div 
                            key={i} 
                            className="w-0.5 bg-[#075E54] rounded-full"
                            style={{ height: `${Math.random() * 12 + 4}px` }}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] text-zinc-600">0:00</span>
                    </div>
                  </div>
                )}
                
                {/* Message Text */}
                {processedMessage && (
                  <div className="px-2 pt-1.5 pb-1">
                    <p className="text-[13px] text-zinc-800 whitespace-pre-wrap break-words leading-[1.35]">
                      {processedMessage}
                    </p>
                  </div>
                )}
                
                {/* Time and Status */}
                <div className="flex items-center justify-end gap-1 px-2 pb-1.5">
                  <span className="text-[10px] text-zinc-500">{currentTime}</span>
                  <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />
                </div>
              </div>
            </div>
            
            {/* Bubble Tail */}
            <div 
              className="absolute right-[12px]" 
              style={{ 
                top: mediaUrl ? (mediaType === 'audio' ? '58px' : '12px') : '12px',
                width: 0,
                height: 0,
                borderTop: '8px solid #DCF8C6',
                borderRight: '8px solid transparent',
              }} 
            />
          </div>
          
          {/* Input Bar */}
          <div className="bg-[#F0F0F0] px-2 py-2 flex items-center gap-2">
            <div className="flex-1 bg-white rounded-full px-3 py-1.5 text-xs text-zinc-400">
              Mensagem
            </div>
            <div className="w-8 h-8 rounded-full bg-[#075E54] flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14.5c-3.04 0-5.5 1.73-5.5 3.5v2h11v-2c0-1.77-2.46-3.5-5.5-3.5zm0-9a3 3 0 100 6 3 3 0 000-6z" />
              </svg>
            </div>
          </div>
          
          {/* Home Indicator */}
          <div className="bg-zinc-800 h-5 flex items-center justify-center">
            <div className="w-24 h-1 bg-white rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}