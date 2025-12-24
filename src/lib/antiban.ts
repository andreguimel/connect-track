// Anti-ban settings and utilities for WhatsApp message sending

export type ProtectionLevel = 'safe' | 'moderate' | 'aggressive';

export interface AntiBanSettings {
  protectionLevel: ProtectionLevel;
  minDelaySeconds: number;
  maxDelaySeconds: number;
  dailyLimit: number;
  batchSize: number;
  batchPauseMinutes: number;
  enableRandomVariation: boolean;
  enableAIVariation: boolean;
}

const ANTIBAN_STORAGE_KEY = 'zapsender_antiban_settings';
const DAILY_SENT_KEY = 'zapsender_daily_sent';

// Presets for different protection levels
export const protectionPresets: Record<ProtectionLevel, Omit<AntiBanSettings, 'protectionLevel' | 'enableAIVariation'>> = {
  safe: {
    minDelaySeconds: 15,
    maxDelaySeconds: 45,
    dailyLimit: 300,
    batchSize: 20,
    batchPauseMinutes: 10,
    enableRandomVariation: true,
  },
  moderate: {
    minDelaySeconds: 8,
    maxDelaySeconds: 25,
    dailyLimit: 500,
    batchSize: 35,
    batchPauseMinutes: 5,
    enableRandomVariation: true,
  },
  aggressive: {
    minDelaySeconds: 5,
    maxDelaySeconds: 15,
    dailyLimit: 800,
    batchSize: 50,
    batchPauseMinutes: 3,
    enableRandomVariation: true,
  },
};

export const protectionLevelInfo: Record<ProtectionLevel, { label: string; description: string; color: string }> = {
  safe: {
    label: 'Seguro',
    description: 'Menor risco de ban, envio mais lento',
    color: 'text-success',
  },
  moderate: {
    label: 'Moderado',
    description: 'Equilíbrio entre velocidade e segurança',
    color: 'text-warning',
  },
  aggressive: {
    label: 'Rápido',
    description: 'Mais rápido, maior risco de ban',
    color: 'text-destructive',
  },
};

export const defaultAntiBanSettings: AntiBanSettings = {
  protectionLevel: 'moderate',
  ...protectionPresets.moderate,
  enableAIVariation: false,
};

export function getAntiBanSettings(): AntiBanSettings {
  const stored = localStorage.getItem(ANTIBAN_STORAGE_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    // Ensure protectionLevel exists for backwards compatibility
    if (!parsed.protectionLevel) {
      parsed.protectionLevel = 'moderate';
    }
    return { ...defaultAntiBanSettings, ...parsed };
  }
  return defaultAntiBanSettings;
}

export function saveAntiBanSettings(settings: AntiBanSettings): void {
  localStorage.setItem(ANTIBAN_STORAGE_KEY, JSON.stringify(settings));
}

export function getSettingsForLevel(level: ProtectionLevel, currentSettings: AntiBanSettings): AntiBanSettings {
  return {
    ...protectionPresets[level],
    protectionLevel: level,
    enableAIVariation: currentSettings.enableAIVariation,
  };
}

export function getRandomDelay(settings: AntiBanSettings): number {
  const { minDelaySeconds, maxDelaySeconds, enableRandomVariation } = settings;
  
  if (!enableRandomVariation) {
    return (minDelaySeconds + maxDelaySeconds) / 2 * 1000;
  }
  
  // Random delay between min and max
  const baseDelay = Math.random() * (maxDelaySeconds - minDelaySeconds) + minDelaySeconds;
  
  // Add extra random variation (±20%)
  const variation = baseDelay * 0.2 * (Math.random() - 0.5);
  
  return Math.round((baseDelay + variation) * 1000);
}

interface DailySentData {
  date: string;
  count: number;
}

export function getDailySentCount(): number {
  const today = new Date().toISOString().split('T')[0];
  const stored = localStorage.getItem(DAILY_SENT_KEY);
  
  if (stored) {
    const data: DailySentData = JSON.parse(stored);
    if (data.date === today) {
      return data.count;
    }
  }
  
  return 0;
}

export function incrementDailySentCount(): number {
  const today = new Date().toISOString().split('T')[0];
  const current = getDailySentCount();
  const newCount = current + 1;
  
  localStorage.setItem(DAILY_SENT_KEY, JSON.stringify({
    date: today,
    count: newCount,
  }));
  
  return newCount;
}

export function canSendMore(settings: AntiBanSettings): boolean {
  return getDailySentCount() < settings.dailyLimit;
}

export function getRemainingDaily(settings: AntiBanSettings): number {
  return Math.max(0, settings.dailyLimit - getDailySentCount());
}

// Check if batch pause is needed
export function shouldPauseForBatch(messageIndex: number, settings: AntiBanSettings): boolean {
  // Pause after every batchSize messages (but not on the first message)
  return messageIndex > 0 && messageIndex % settings.batchSize === 0;
}

// Get batch pause duration in milliseconds
export function getBatchPauseDuration(settings: AntiBanSettings): number {
  return settings.batchPauseMinutes * 60 * 1000;
}

// Message variation helpers to avoid detection (basic fallback)
export function addMessageVariation(message: string): string {
  const variations = [
    () => message + ' ',
    () => message + '  ',
    () => ' ' + message,
    () => message.replace(/\./g, '。'),
    () => message + '\u200B', // Zero-width space
    () => '\u200B' + message,
  ];
  
  const randomVariation = variations[Math.floor(Math.random() * variations.length)];
  return randomVariation();
}

// Calculate estimated time in seconds for sending messages
export function calculateEstimatedTime(
  totalMessages: number, 
  currentMessage: number,
  settings: AntiBanSettings
): number {
  const remainingMessages = totalMessages - currentMessage;
  if (remainingMessages <= 0) return 0;
  
  // Average delay per message
  const avgDelaySeconds = (settings.minDelaySeconds + settings.maxDelaySeconds) / 2;
  
  // Calculate how many batch pauses will occur
  const messagesInCurrentBatch = currentMessage % settings.batchSize;
  const remainingInCurrentBatch = settings.batchSize - messagesInCurrentBatch;
  const messagesAfterFirstBatch = Math.max(0, remainingMessages - remainingInCurrentBatch);
  const fullBatchPauses = Math.floor(messagesAfterFirstBatch / settings.batchSize);
  const hasPartialBatch = remainingInCurrentBatch < remainingMessages;
  const totalBatchPauses = fullBatchPauses + (hasPartialBatch ? 1 : 0);
  
  // Total time = (remaining messages * avg delay) + (batch pauses * pause duration)
  const messageTime = remainingMessages * avgDelaySeconds;
  const pauseTime = totalBatchPauses * settings.batchPauseMinutes * 60;
  
  return Math.round(messageTime + pauseTime);
}

// Format seconds to readable time string
export function formatTimeRemaining(totalSeconds: number): string {
  if (totalSeconds <= 0) return '< 1 min';
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  if (hours > 0) {
    return `~${hours}h ${minutes}min`;
  }
  
  if (minutes > 0) {
    return `~${minutes} min`;
  }
  
  return '< 1 min';
}
