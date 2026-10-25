// ==============================================================================
// SALES ERP CONFIGURATION
// Configures Supabase project URL, Anon Key, and application settings
// ==============================================================================

const CONFIG_STORAGE_KEY = 'sales_erp_supabase_config';

export const AppConfig = {
    // You can paste your credentials directly here, or enter them in the app's Settings tab
    supabaseUrl: localStorage.getItem(`${CONFIG_STORAGE_KEY}_url`) || '',
    supabaseAnonKey: localStorage.getItem(`${CONFIG_STORAGE_KEY}_key`) || '',
    storageBucketName: 'visit-photos',

    // Check if Supabase is properly configured
    isConfigured() {
        return Boolean(this.supabaseUrl && this.supabaseAnonKey && this.supabaseUrl.startsWith('https://'));
    },

    // Save configuration to localStorage
    saveConfig(url, key) {
        this.supabaseUrl = (url || '').trim();
        this.supabaseAnonKey = (key || '').trim();
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
