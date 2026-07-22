import { createClient } from '@supabase/supabase-js';

// Retrieve config from localStorage or Vite env variables
export const getSupabaseConfig = () => {
  const storedUrl = localStorage.getItem('binthanna_supabase_url');
  const storedKey = localStorage.getItem('binthanna_supabase_anon_key');
  const envUrl = import.meta.env?.VITE_SUPABASE_URL;
  const envKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

  return {
    url: storedUrl || envUrl || '',
    anonKey: storedKey || envKey || ''
  };
};

export const saveSupabaseConfig = (url, anonKey) => {
  if (url) localStorage.setItem('binthanna_supabase_url', url);
  else localStorage.removeItem('binthanna_supabase_url');

  if (anonKey) localStorage.setItem('binthanna_supabase_anon_key', anonKey);
  else localStorage.removeItem('binthanna_supabase_anon_key');
};

let supabaseInstance = null;

export const getSupabaseClient = () => {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    return null;
  }
  try {
    if (!supabaseInstance || supabaseInstance.supabaseUrl !== url) {
      supabaseInstance = createClient(url, anonKey);
    }
    return supabaseInstance;
  } catch (err) {
    console.error("Failed to initialize Supabase client:", err);
    return null;
  }
};

// Health test method
export const testSupabaseConnection = async (url, key) => {
  if (!url || !key) {
    return { success: false, message: 'URL and Anon Key cannot be empty.' };
  }

  // Validate key format (reject secret key)
  if (key.startsWith('sb_secret_')) {
    return { 
      success: false, 
      message: 'You copied a Secret key (sb_secret_...). Please copy the "Publishable key" (sb_publishable_...) or "Legacy anon key" instead.' 
    };
  }

  if (!key.startsWith('eyJ') && !key.startsWith('sb_publishable_')) {
    return { 
      success: false, 
      message: 'Invalid Key format. Please use the "Publishable key" (starts with sb_publishable_...) or the "Legacy anon key" (starts with eyJ...).' 
    };
  }

  try {
    const testClient = createClient(url, key);
    const { data, error } = await testClient.from('orders').select('id').limit(1);

    if (error) {
      const errMsg = error.message || error.details || error.hint || `Error code ${error.code}`;
      return { success: false, message: errMsg };
    }
    return { success: true, count: data ? data.length : 0 };
  } catch (err) {
    return { success: false, message: err.message || 'Network error connecting to Supabase.' };
  }
};
