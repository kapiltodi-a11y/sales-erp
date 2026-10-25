// ==============================================================================
// SUPABASE CLIENT SERVICE
// Initializes Supabase SDK, manages database queries and file uploads to Storage
// ==============================================================================

import { AppConfig } from './config.js';

let supabaseInstance = null;

// Initialize or retrieve the Supabase client
export function getSupabase() {
    if (!AppConfig.isConfigured()) {
        return null;
    }
    if (!supabaseInstance) {
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            supabaseInstance = window.supabase.createClient(
                AppConfig.supabaseUrl,
                AppConfig.supabaseAnonKey
            );
        }
    }
    return supabaseInstance;
}

// Re-initialize client (e.g. after updating credentials in Settings)
export function reinitSupabase() {
    supabaseInstance = null;
    return getSupabase();
}

// Test connection to Supabase database
export async function testSupabaseConnection(url, key) {
    try {
        if (!url || !key) {
            return { success: false, message: 'URL and Anon Key are required.' };
        }
        if (!window.supabase || typeof window.supabase.createClient !== 'function') {
            return { success: false, message: 'Supabase SDK not loaded yet. Please check your internet connection.' };
        }

        const client = window.supabase.createClient(url.trim(), key.trim());
        // Try selecting 1 row from sales_reps
        const { data, error } = await client.from('sales_reps').select('id').limit(1);

        if (error) {
            if (error.code === '42P01') {
                return {
                    success: false,
                    message: 'Connected to Supabase, but the table "sales_reps" was not found! Please run the schema.sql in Supabase SQL editor.'
                };
            }
            return { success: false, message: error.message || 'Failed to query Supabase.' };
        }

        return { success: true, message: 'Connected successfully to Supabase! Tables and permissions verified.' };
    } catch (err) {
        return { success: false, message: err.message || 'Unknown network error connecting to Supabase.' };
    }
}

// Upload file to Supabase Storage Bucket or return base64 data URL as fallback
export async function uploadVisitImage(file, folder = 'visits') {
    if (!file) return null;

    const supabase = getSupabase();
    const timestamp = Date.now();
    const cleanFileName = file.name ? file.name.replace(/[^a-zA-Z0-9._-]/g, '_') : 'photo.jpg';
    const filePath = `${folder}/${timestamp}_${cleanFileName}`;

    // If Supabase is connected, attempt uploading to the storage bucket
    if (supabase) {
        try {
            const { data, error } = await supabase.storage
                .from(AppConfig.storageBucketName)
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (!error && data) {
                // Get public URL
                const { data: publicUrlData } = supabase.storage
                    .from(AppConfig.storageBucketName)
                    .getPublicUrl(filePath);

                if (publicUrlData && publicUrlData.publicUrl) {
                    return publicUrlData.publicUrl;
                }
            } else if (error) {
                console.warn('Storage bucket upload issue (falling back to data URL):', error.message);
            }
        } catch (e) {
            console.warn('Storage upload error, using fallback:', e);
        }
    }

    // Fallback: Convert file to Base64 data URL so photos are never lost even offline or without storage bucket
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
    });
}
