// ==============================================================================
// SALES ERP CONFIGURATION
// Configures Supabase project URL, Anon Key, and application settings
// ==============================================================================

const CONFIG_STORAGE_KEY = 'sales_erp_supabase_config';
const DEFAULT_SUPABASE_URL = 'https://vdgmbqhjzpxwhndnpocq.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkZ21icWhqenB4d2huZG5wb2NxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2Mzg5ODAsImV4cCI6MjEwOTIxNDk4MH0.cz3P49D_e4DMpS0JajQpp6Ids1WE8Ka-oLlL5ds29lE';

function getInitialConfigUrl() {
    const stored = localStorage.getItem(`${CONFIG_STORAGE_KEY}_url`);
    if (stored && stored.trim().startsWith('https://')) return stored.trim();
    return DEFAULT_SUPABASE_URL;
}

function getInitialConfigKey() {
    const stored = localStorage.getItem(`${CONFIG_STORAGE_KEY}_key`);
    if (stored && stored.trim().length > 20) return stored.trim();
    return DEFAULT_SUPABASE_KEY;
}

export const AppConfig = {
    supabaseUrl: getInitialConfigUrl(),
    supabaseAnonKey: getInitialConfigKey(),
    storageBucketName: 'visit-photos',

    // Check if Supabase is properly configured
    isConfigured() {
        return Boolean(
            this.supabaseUrl &&
            this.supabaseAnonKey &&
            this.supabaseUrl.trim().startsWith('https://') &&
            this.supabaseAnonKey.trim().length > 20
        );
    },

    // Save configuration to localStorage
    saveConfig(url, key) {
        this.supabaseUrl = (url || DEFAULT_SUPABASE_URL).trim().replace(/\/+$/, '');
        this.supabaseAnonKey = (key || DEFAULT_SUPABASE_KEY).trim().replace(/^["']|["']$/g, '');
        localStorage.setItem(`${CONFIG_STORAGE_KEY}_url`, this.supabaseUrl);
        localStorage.setItem(`${CONFIG_STORAGE_KEY}_key`, this.supabaseAnonKey);
    },

    // Clear saved configuration
    clearConfig() {
        this.supabaseUrl = '';
        this.supabaseAnonKey = '';
        localStorage.removeItem(`${CONFIG_STORAGE_KEY}_url`);
        localStorage.removeItem(`${CONFIG_STORAGE_KEY}_key`);
    }
};
