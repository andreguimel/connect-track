// Anti-ban settings and utilities for WhatsApp message sending

export interface AntiBanSettings {
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

export const defaultAntiBanSettings: AntiBanSettings = {
  minDelaySeconds: 8,
  maxDelaySeconds: 25,
  dailyLimit: 800,
  batchSize: 50,
  batchPauseMinutes: 5,
  enableRandomVariation: true,
  enableAIVariation: false,
};

export function getAntiBanSettings(): AntiBanSettings {
  const stored = localStorage.getItem(ANTIBAN_STORAGE_KEY);
  if (stored) {
    return { ...defaultAntiBanSettings, ...JSON.parse(stored) };
  }
  return defaultAntiBanSettings;
}

export function saveAntiBanSettings(settings: AntiBanSettings): void {
  localStorage.setItem(ANTIBAN_STORAGE_KEY, JSON.stringify(settings));
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
