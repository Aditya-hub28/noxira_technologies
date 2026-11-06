import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const SiteSettingsContext = createContext({
  googleForm1Url: '',
  isFormConfigured: false,
  loading: true,
  error: null,
  refetchSettings: async () => {}
});

export function SiteSettingsProvider({ children }) {
  const [googleForm1Url, setGoogleForm1Url] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getPublicSettings();
      const url = typeof res?.googleForm1Url === 'string' ? res.googleForm1Url.trim() : '';
      setGoogleForm1Url(url);
    } catch (err) {
      console.error('Failed to load public site settings:', err);
      setError(err);
      setGoogleForm1Url('');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Form 1 is only considered configured when successfully loaded, no error, and URL is non-empty
  const isFormConfigured = Boolean(!loading && !error && googleForm1Url && googleForm1Url.trim().length > 0);

  return (
    <SiteSettingsContext.Provider
      value={{
        googleForm1Url,
        isFormConfigured,
        loading,
        error,
        refetchSettings: fetchSettings
      }}
    >
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}
