import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AppSetting {
  id: string;
  key: string;
  value: string | null;
  created_at: string;
  updated_at: string;
}

export function useAppSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*');

      if (error) throw error;

      const settingsMap: Record<string, string> = {};
      (data as AppSetting[])?.forEach((setting) => {
        settingsMap[setting.key] = setting.value || '';
      });
      setSettings(settingsMap);
    } catch (error) {
      console.error('Error fetching app settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSetting = useCallback(async (key: string, value: string) => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ value })
        .eq('key', key);

      if (error) throw error;

      setSettings((prev) => ({ ...prev, [key]: value }));
      return { success: true };
    } catch (error) {
      console.error('Error updating app setting:', error);
      return { success: false, error };
    }
  }, []);

  const getSetting = useCallback((key: string, defaultValue: string = '') => {
    return settings[key] ?? defaultValue;
  }, [settings]);

  return {
    settings,
    isLoading,
    getSetting,
    updateSetting,
    refetch: fetchSettings,
  };
}
