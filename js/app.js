// ==============================================================================
// SALES ERP - COMPLETE UNIFIED APPLICATION BUNDLE
// Self-contained script compatible with BOTH local file:// and web servers/GitHub Pages
// Supports: Front/Back Visiting Card, Smart OCR (Company, Person, Phone, Email, Pin),
// Business Name, Address Option A & Option B (Locked GPS), Mandatory Office Photo,
// and Admin Excel (.xlsx) Export
// ==============================================================================

(function () {
    'use strict';

    // --------------------------------------------------------------------------
    // 1. CONFIGURATION SERVICE
    // --------------------------------------------------------------------------
    const CONFIG_STORAGE_KEY = 'sales_erp_supabase_config';
    const DEFAULT_SUPABASE_URL = 'https://vdgmbqhjzpxwhndnpocq.supabase.co';
    const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkZ21icWhqenB4d2huZG5wb2NxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2Mzg5ODAsImV4cCI6MjEwOTIxNDk4MH0.cz3P49D_e4DMpS0JajQpp6Ids1WE8Ka-oLlL5ds29lE';

    function getInitialConfigUrl() {
        const stored = localStorage.getItem(`${CONFIG_STORAGE_KEY}_url`);
        if (stored && stored.includes('vdgmbqhjzpxwhndnpocq')) return stored.trim();
        localStorage.setItem(`${CONFIG_STORAGE_KEY}_url`, DEFAULT_SUPABASE_URL);
        return DEFAULT_SUPABASE_URL;
    }

    function getInitialConfigKey() {
        const stored = localStorage.getItem(`${CONFIG_STORAGE_KEY}_key`);
        if (stored && stored.trim().length > 40 && !stored.includes('yourprojectid')) return stored.trim();
        localStorage.setItem(`${CONFIG_STORAGE_KEY}_key`, DEFAULT_SUPABASE_KEY);
        return DEFAULT_SUPABASE_KEY;
    }

    const AppConfig = {
        supabaseUrl: getInitialConfigUrl(),
        supabaseAnonKey: getInitialConfigKey(),
        storageBucketName: 'visit-photos',

        isConfigured() {
            return Boolean(
                this.supabaseUrl &&
                this.supabaseAnonKey &&
                this.supabaseUrl.trim().startsWith('https://') &&
                this.supabaseAnonKey.trim().length > 20
            );
        },

        saveConfig(url, key) {
            this.supabaseUrl = (url || DEFAULT_SUPABASE_URL).trim().replace(/\/+$/, '');
            this.supabaseAnonKey = (key || DEFAULT_SUPABASE_KEY).trim().replace(/^["']|["']$/g, '');
            localStorage.setItem(`${CONFIG_STORAGE_KEY}_url`, this.supabaseUrl);
            localStorage.setItem(`${CONFIG_STORAGE_KEY}_key`, this.supabaseAnonKey);
        },

        clearConfig() {
            this.supabaseUrl = DEFAULT_SUPABASE_URL;
            this.supabaseAnonKey = DEFAULT_SUPABASE_KEY;
            localStorage.setItem(`${CONFIG_STORAGE_KEY}_url`, DEFAULT_SUPABASE_URL);
            localStorage.setItem(`${CONFIG_STORAGE_KEY}_key`, DEFAULT_SUPABASE_KEY);
        }
    };

    // --------------------------------------------------------------------------
    // 2. UNIVERSAL CLOUD DATABASE SERVICE (SUPABASE SDK + DIRECT REST FALLBACK)
    // Works reliably on ALL mobile browsers, PCs, cellular connections, and networks
    // --------------------------------------------------------------------------
    let supabaseInstance = null;

    function getSupabase() {
        if (!AppConfig.isConfigured()) return null;
        if (!supabaseInstance && window.supabase && typeof window.supabase.createClient === 'function') {
            try {
                supabaseInstance = window.supabase.createClient(AppConfig.supabaseUrl, AppConfig.supabaseAnonKey);
            } catch (e) {
                console.warn('Supabase client creation error:', e);
            }
        }
        return supabaseInstance;
    }

    function reinitSupabase() {
        supabaseInstance = null;
        return getSupabase();
    }

    function prepareVisitForDatabase(v) {
        if (!v) return null;
        const cleanLat = (v.latitude !== null && v.latitude !== undefined && v.latitude !== '' && !isNaN(Number(v.latitude))) ? Number(v.latitude) : null;
        const cleanLng = (v.longitude !== null && v.longitude !== undefined && v.longitude !== '' && !isNaN(Number(v.longitude))) ? Number(v.longitude) : null;
        
        let cleanFollowUp = null;
        if (v.follow_up_date && typeof v.follow_up_date === 'string') {
            const trimmed = v.follow_up_date.trim();
            if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
                cleanFollowUp = trimmed.slice(0, 10);
            }
        }

        const bName = (v.business_name || v.client_name || '').trim();
        const addrA = (v.address_option_a || v.client_address || '').trim();
        const addrB = (v.address_option_b || v.location_address || '').trim();

        return {
            id: String(v.id || ('visit-' + Date.now())),
            sales_rep_id: String(v.sales_rep_id || 'rep-002'),
            sales_rep_name: sanitizeRepName(v.sales_rep_name, v.employee_id, v.sales_rep_id),
            employee_id: (v.employee_id || '').trim(),
            business_name: bName || 'Client Visit',
            client_name: bName || 'Client Visit',
            address_option_a: addrA || null,
            address_option_b: addrB || null,
            client_address: addrA || null,
            visit_time: v.visit_time ? new Date(v.visit_time).toISOString() : new Date().toISOString(),
            latitude: cleanLat,
            longitude: cleanLng,
            location_address: addrB || null,
            contact_person_name: (v.contact_person_name || 'Contact Person').trim(),
            contact_person_phone: (v.contact_person_phone || '').trim(),
            contact_person_email: (v.contact_person_email || '').trim() || null,
            pincode: (v.pincode || '').trim() || null,
            status: (v.status === 'Successful Closed') ? 'Successful Closed' : 'Follow-up Required',
            follow_up_date: cleanFollowUp,
            remarks: (v.remarks || '').trim() || null,
            visiting_card_front_url: v.visiting_card_front_url || v.visiting_card_url || null,
            visiting_card_back_url: v.visiting_card_back_url || null,
            visiting_card_url: v.visiting_card_front_url || v.visiting_card_url || null,
            office_photo_url: v.office_photo_url || null,
            ocr_raw_text: v.ocr_raw_text || null,
            ocr_extracted_data: (v.ocr_extracted_data && typeof v.ocr_extracted_data === 'object') ? v.ocr_extracted_data : {},
            created_at: v.created_at ? new Date(v.created_at).toISOString() : new Date().toISOString()
        };
    }

    const CloudDB = {
        async getVisits() {
            // 1. Try Supabase SDK
            const client = getSupabase();
            if (client) {
                try {
                    const { data, error } = await client.from('client_visits').select('*').order('visit_time', { ascending: false });
                    if (!error && Array.isArray(data)) return data;
                } catch (e) {
                    console.warn('Supabase SDK getVisits error:', e);
                }
            }

            // 2. Direct REST fetch fallback (100% reliable, zero CDN dependency)
            try {
                const res = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/client_visits?select=*&order=visit_time.desc`, {
                    headers: {
                        'apikey': DEFAULT_SUPABASE_KEY,
                        'Authorization': `Bearer ${DEFAULT_SUPABASE_KEY}`
                    }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) return data;
                }
            } catch (e) {
                console.warn('Direct REST getVisits error:', e);
            }
            return null;
        },

        async saveVisit(visit) {
            const clean = prepareVisitForDatabase(visit);
            if (!clean) return null;

            // 1. Try Supabase SDK
            const client = getSupabase();
            if (client) {
                try {
                    const { data, error } = await client.from('client_visits').upsert([clean]).select().single();
                    if (!error && data) return data;
                } catch (e) {
                    console.warn('Supabase SDK saveVisit error:', e);
                }
            }

            // 2. Direct REST fetch fallback
            try {
                const res = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/client_visits`, {
                    method: 'POST',
                    headers: {
                        'apikey': DEFAULT_SUPABASE_KEY,
                        'Authorization': `Bearer ${DEFAULT_SUPABASE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=merge-duplicates,return=representation'
                    },
                    body: JSON.stringify(clean)
                });
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data) && data[0]) return data[0];
                    return clean;
                }
            } catch (e) {
                console.warn('Direct REST saveVisit error:', e);
            }
            return null;
        },

        async getTeam() {
            const client = getSupabase();
            if (client) {
                try {
                    const { data, error } = await client.from('sales_reps').select('*').order('name', { ascending: true });
                    if (!error && Array.isArray(data)) return data;
                } catch (e) {}
            }
            try {
                const res = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/sales_reps?select=*&order=name.asc`, {
                    headers: {
                        'apikey': DEFAULT_SUPABASE_KEY,
                        'Authorization': `Bearer ${DEFAULT_SUPABASE_KEY}`
                    }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) return data;
                }
            } catch (e) {}
            return null;
        }
    };
    window.CloudDB = CloudDB;

    async function testSupabaseConnection(url, key) {
        const testUrl = (url || DEFAULT_SUPABASE_URL).trim().replace(/\/+$/, '');
        const testKey = (key || DEFAULT_SUPABASE_KEY).trim().replace(/^["']|["']$/g, '');
        try {
            const res = await fetch(`${testUrl}/rest/v1/sales_reps?select=id&limit=1`, {
                headers: {
                    'apikey': testKey,
                    'Authorization': `Bearer ${testKey}`
                }
            });
            if (res.ok) {
                return { success: true, message: 'Connected successfully to Supabase! Tables and permissions verified.' };
            }
            if (res.status === 404) {
                return { success: false, message: 'Table "sales_reps" not found. Run schema.sql in Supabase SQL editor.' };
            }
            return { success: false, message: `Supabase returned HTTP ${res.status}. Check API keys.` };
        } catch (err) {
            return { success: false, message: err.message || 'Network error connecting to Supabase.' };
        }
    }

    function compressImageForStorage(fileOrBlob, maxWidth = 900, maxHeight = 900, quality = 0.65) {
        return new Promise((resolve) => {
            if (!fileOrBlob) return resolve(null);
            if (typeof fileOrBlob === 'string') return resolve(fileOrBlob);

            if (fileOrBlob.type === 'application/pdf' || (fileOrBlob.name && fileOrBlob.name.toLowerCase().endsWith('.pdf'))) {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(fileOrBlob);
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    let w = img.width;
                    let h = img.height;
                    if (w > maxWidth || h > maxHeight) {
                        if (w > h) {
                            h = Math.round((h * maxWidth) / w);
                            w = maxWidth;
                        } else {
                            w = Math.round((w * maxHeight) / h);
                            h = maxHeight;
                        }
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    const dataUrl = canvas.toDataURL('image/jpeg', quality);
                    resolve(dataUrl);
                };
                img.onerror = () => resolve(e.target.result);
                img.src = e.target.result;
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(fileOrBlob);
        });
    }

    function compressImageToBlob(fileOrBlob, maxWidth = 1000, maxHeight = 1000, quality = 0.7) {
        if (!fileOrBlob) return Promise.resolve(null);
        if (typeof fileOrBlob === 'string') return Promise.resolve(null);
        if (fileOrBlob.type === 'application/pdf' || (fileOrBlob.name && fileOrBlob.name.toLowerCase().endsWith('.pdf'))) {
            return Promise.resolve(fileOrBlob);
        }
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    let w = img.width;
                    let h = img.height;
                    if (w > maxWidth || h > maxHeight) {
                        if (w > h) {
                            h = Math.round((h * maxWidth) / w);
                            w = maxWidth;
                        } else {
                            w = Math.round((w * maxHeight) / h);
                            h = maxHeight;
                        }
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    canvas.toBlob((blob) => {
                        resolve(blob || fileOrBlob);
                    }, 'image/jpeg', quality);
                };
                img.onerror = () => resolve(fileOrBlob);
                img.src = e.target.result;
            };
            reader.onerror = () => resolve(fileOrBlob);
            reader.readAsDataURL(fileOrBlob);
        });
    }

    async function uploadVisitImage(file, folder = 'visits') {
        if (!file) return null;
        const supabase = getSupabase();
        const timestamp = Date.now();
        const cleanFileName = file.name ? file.name.replace(/[^a-zA-Z0-9._-]/g, '_') : 'photo.jpg';
        const filePath = `${folder}/${timestamp}_${cleanFileName}`;

        // Fast-compress first so upload is ~100KB (instant, zero timeout risk on mobile)
        let uploadPayload = file;
        try {
            const compressedBlob = await compressImageToBlob(file, 1000, 1000, 0.7);
            if (compressedBlob) uploadPayload = compressedBlob;
        } catch (e) {}

        if (supabase) {
            try {
                const { data, error } = await supabase.storage
                    .from(AppConfig.storageBucketName)
                    .upload(filePath, uploadPayload, { cacheControl: '3600', upsert: true });

                if (!error && data) {
                    const { data: publicUrlData } = supabase.storage
                        .from(AppConfig.storageBucketName)
                        .getPublicUrl(filePath);

                    if (publicUrlData && publicUrlData.publicUrl) {
                        return publicUrlData.publicUrl;
                    }
                }
            } catch (e) {
                console.warn('Storage upload error, trying direct REST fallback:', e);
            }
        }

        // Direct fetch to storage REST as fallback
        try {
            const storageRes = await fetch(`${DEFAULT_SUPABASE_URL}/storage/v1/object/${AppConfig.storageBucketName}/${filePath}`, {
                method: 'POST',
                headers: {
                    'apikey': DEFAULT_SUPABASE_KEY,
                    'Authorization': `Bearer ${DEFAULT_SUPABASE_KEY}`,
                    'x-upsert': 'true'
                },
                body: uploadPayload
            });
            if (storageRes.ok) {
                return `${DEFAULT_SUPABASE_URL}/storage/v1/object/public/${AppConfig.storageBucketName}/${filePath}`;
            }
        } catch (e) {}

        // Compressed data URL fallback (stored directly in TEXT column)
        return await compressImageForStorage(file);
    }

    // --------------------------------------------------------------------------
    // 3. LOCATION SERVICE (GPS & REVERSE GEOCODING)
    // --------------------------------------------------------------------------
    function getCurrentCoordinates() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported by your browser.'));
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    resolve({
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude,
                        accuracy: pos.coords.accuracy
                    });
                },
                (err) => {
                    let msg = 'Failed to get location.';
                    if (err.code === err.PERMISSION_DENIED) msg = 'Location permission was denied. Please allow location access.';
                    else if (err.code === err.POSITION_UNAVAILABLE) msg = 'Location is unavailable.';
                    else if (err.code === err.TIMEOUT) msg = 'Location request timed out.';
                    reject(new Error(msg));
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        });
    }

    async function reverseGeocode(latitude, longitude) {
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`;
            const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
            if (!res.ok) return `GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
            const data = await res.json();
            return data.display_name || `GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        } catch (e) {
            return `GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        }
    }

    function getGoogleMapsUrl(lat, lng) {
        if (!lat || !lng) return null;
        return `https://www.google.com/maps?q=${lat},${lng}`;
    }

    // --------------------------------------------------------------------------
    // 4. VISITING CARD OCR SERVICE (Tesseract.js & PDF.js)
    // --------------------------------------------------------------------------
    async function renderPdfToCanvas(file) {
        if (!window.pdfjsLib) {
            throw new Error('PDF reader engine is still loading. Please retry in a few seconds.');
        }

        if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);

        let pdfText = '';
        try {
            const textContent = await page.getTextContent();
            pdfText = textContent.items.map(item => item.str).join(' ');
        } catch (e) {
            console.warn('Direct PDF text extraction:', e);
        }

        // Render page 1 at scale 2.0 for high OCR recognition accuracy
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

        return { canvas, dataUrl, pdfText };
    }

    async function scanVisitingCard(imageSource, onProgress = () => {}, extraDirectText = '') {
        let rawText = (extraDirectText || '').trim();

        if (window.Tesseract && imageSource) {
            try {
                onProgress(10, 'Initializing OCR engine...');
                const result = await window.Tesseract.recognize(imageSource, 'eng', {
                    logger: (m) => {
                        if (m.status === 'recognizing text') {
                            const pct = Math.round((m.progress || 0) * 80) + 15;
                            onProgress(pct, `Scanning card... ${pct}%`);
                        } else if (m.status) {
                            onProgress(15, `${m.status}...`);
                        }
                    }
                });

                const tesseractText = result.data.text || '';
                rawText = (rawText + '\n' + tesseractText).trim();
            } catch (err) {
                console.warn('Tesseract OCR warning:', err);
                if (!rawText) {
                    throw new Error('Failed to parse visiting card: ' + (err.message || 'Unknown error'));
                }
            }
        } else if (!rawText) {
            throw new Error('Tesseract OCR engine is not ready.');
        }

        onProgress(95, 'Extracting Company, Name, Phone, Email & Pin Code...');
        const parsed = parseVisitingCardText(rawText);
        onProgress(100, 'Details extracted successfully!');
        return { rawText, parsed };
    }

    function parseVisitingCardText(rawText) {
        if (!rawText) return { contactPerson: '', phone: '', companyName: '', email: '', pincode: '', address: '', designation: '' };

        const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 1);

        // 1. Email ID
        const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
        let foundEmail = '';
        for (const line of lines) {
            const match = line.match(emailRegex);
            if (match) { foundEmail = match[1].toLowerCase(); break; }
        }

        // 2. Mobile Number (Indian 10-digit, +91, international formats)
        const phoneCandidates = [];
        const phoneRegexes = [
            /(?:\+91[-.\s]?)?[6-9]\d{4}[-.\s]?\d{5}/g,
            /(?:\+\d{1,3}[-.\s]?)?\(?\d{2,5}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,5}/g,
            /\b\d{10}\b/g
        ];
        for (const line of lines) {
            for (const rx of phoneRegexes) {
                const matches = line.match(rx);
                if (matches) {
                    matches.forEach(m => {
                        const clean = m.replace(/[^\d+]/g, '');
                        if (clean.length >= 10 && clean.length <= 15) phoneCandidates.push(m.trim());
                    });
                }
            }
        }
        const foundPhone = phoneCandidates.length > 0 ? phoneCandidates[0] : '';

        // 3. Pin Code (6-digit Indian PIN code regex or 5-digit zip code)
        let foundPin = '';
        const pinRegex = /\b[1-9][0-9]{5}\b/;
        for (const line of lines) {
            const match = line.match(pinRegex);
            if (match) {
                foundPin = match[0];
                break;
            }
        }
        if (!foundPin) {
            // Check for explicit "PIN" or "PINCODE" or "ZIP" indicator
            for (const line of lines) {
                const match = line.match(/(?:pin|pincode|zip|postal)\s*[:-]?\s*(\d{5,6})/i);
                if (match) {
                    foundPin = match[1];
                    break;
                }
            }
        }

        // 4. Company / Business Name Keywords
        const companyKeywords = ['ltd', 'limited', 'pvt', 'private', 'inc', 'corp', 'corporation', 'solutions', 'technologies', 'tech', 'enterprises', 'industries', 'services', 'group', 'agency', 'works', 'trading', 'logistics', 'hub', 'associates', 'company', 'consulting', 'ventures'];
        const designationKeywords = ['director', 'managing director', 'ceo', 'cto', 'cfo', 'founder', 'partner', 'manager', 'executive', 'consultant', 'president', 'vp', 'head', 'lead', 'specialist', 'officer'];
        const addressKeywords = ['road', 'rd', 'street', 'st', 'lane', 'floor', 'tower', 'block', 'sector', 'plot', 'phase', 'nagar', 'complex', 'opp', 'near', 'marg', 'building', 'bhavan', 'city', 'pin', 'highway'];

        let foundCompanyName = '';
        let foundDesignation = '';
        let foundContactPerson = '';
        const addressLines = [];

        for (const line of lines) {
            const lower = line.toLowerCase();
            if (line.includes('@') || /^(https?:\/\/|www\.)/i.test(line)) continue;

            if (!foundDesignation) {
                for (const des of designationKeywords) {
                    if (lower.includes(des)) { foundDesignation = line; break; }
                }
            }

            if (!foundCompanyName) {
                const isCompany = companyKeywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(lower));
                if (isCompany) { foundCompanyName = line; continue; }
            }

            const isAddress = addressKeywords.some(kw => lower.includes(kw)) || pinRegex.test(line);
            if (isAddress) { addressLines.push(line); continue; }
        }

        // 5. Contact Person Name
        const honorificRegex = /^(mr\.|ms\.|mrs\.|dr\.|prof\.|shri|er\.)\s+[a-z\s]+$/i;
        for (let i = 0; i < Math.min(lines.length, 5); i++) {
            const line = lines[i];
            const lower = line.toLowerCase();
            if (line === foundCompanyName || line === foundDesignation || addressLines.includes(line)) continue;
            if (line.includes('@') || phoneCandidates.some(p => line.includes(p))) continue;

            if (honorificRegex.test(line)) { foundContactPerson = line; break; }

            const words = line.split(/\s+/);
            const isCapitalized = words.every(w => /^[A-Z][a-zA-Z.'-]*$/.test(w));
            if (!/\d/.test(line) && words.length >= 2 && words.length <= 4 && isCapitalized) {
                if (!companyKeywords.some(kw => lower.includes(kw)) && !foundContactPerson) {
                    foundContactPerson = line;
                }
            }
        }

        if (!foundCompanyName && lines.length > 0) {
            for (let i = 0; i < Math.min(lines.length, 3); i++) {
                const line = lines[i];
                if (line !== foundContactPerson && line !== foundDesignation && !addressLines.includes(line)) {
                    if (line.length >= 3 && !line.includes('@') && !/\d{6,}/.test(line)) {
                        foundCompanyName = line;
                        break;
                    }
                }
            }
        }

        return {
            contactPerson: foundContactPerson,
            phone: foundPhone,
            companyName: foundCompanyName,
            email: foundEmail,
            pincode: foundPin,
            address: addressLines.join(', '),
            designation: foundDesignation
        };
    }

    // --------------------------------------------------------------------------
    // 5. SALES TEAM MANAGEMENT SERVICE
    // --------------------------------------------------------------------------
    const TEAM_STORAGE_KEY = 'sales_erp_team_members';
    const DEFAULT_TEAM_MEMBERS = [
        {
            id: 'rep-001',
            name: 'Kapil Todi',
            email: 'kapil.todi@gmail.com',
            phone: '+91 97696 61978',
            employee_id: 'EMP-101',
            role_type: 'sr_sales_rep',
            designation: 'Sr. Sales Rep',
            is_active: true,
            created_at: new Date(Date.now() - 30 * 86400000).toISOString()
        },
        {
            id: 'rep-002',
            name: 'Supriya Yadav',
            email: 'supriya.yadav@example.com',
            phone: '+91 98765 43211',
            employee_id: 'EMP-102',
            role_type: 'sales_rep',
            designation: 'Sales Rep',
            is_active: true,
            created_at: new Date(Date.now() - 20 * 86400000).toISOString()
        },
        {
            id: 'rep-003',
            name: 'Kalyani Mundada',
            email: 'kalyani.mundada@example.com',
            phone: '+91 98765 43212',
            employee_id: 'EMP-103',
            role_type: 'sales_rep',
            designation: 'Sales Rep',
            is_active: true,
            created_at: new Date(Date.now() - 10 * 86400000).toISOString()
        }
    ];

    function sanitizeRepName(name, empId = '', repId = '') {
        const str = String(name || '').trim();
        const lower = str.toLowerCase();
        const idLower = String(repId || '').toLowerCase();
        const empLower = String(empId || '').toLowerCase();

        // 1. Kapil Todi (Sr. Sales Rep)
        if (
            idLower === 'rep-001' ||
            empLower === 'emp-101' ||
            lower.includes('rahul') ||
            lower.includes('kapil') ||
            lower === 'sr. sales rep' ||
            lower === 'sr sales rep'
        ) {
            return 'Kapil Todi';
        }

        // 2. Supriya Yadav (Sales Rep 1)
        if (
            idLower === 'rep-002' ||
            empLower === 'emp-102' ||
            lower.includes('supriya') ||
            lower.includes('priya') ||
            lower.includes('sales rep 1') ||
            lower.includes('sales-rep-1') ||
            lower.includes('sales_rep_1') ||
            lower.includes('sales person 1') ||
            lower.includes('rep 1') ||
            lower.includes('rep-1') ||
            lower.includes('rep_1') ||
            lower === '1' ||
            lower === 'sales rep' ||
            lower === 'sales representative'
        ) {
            return 'Supriya Yadav';
        }

        // 3. Kalyani Mundada (Sales Rep 2)
        if (
            idLower === 'rep-003' ||
            empLower === 'emp-103' ||
            lower.includes('kalyani') ||
            lower.includes('amit') ||
            lower.includes('sales rep 2') ||
            lower.includes('sales-rep-2') ||
            lower.includes('sales_rep_2') ||
            lower.includes('sales person 2') ||
            lower.includes('rep 2') ||
            lower.includes('rep-2') ||
            lower.includes('rep_2') ||
            lower === '2'
        ) {
            return 'Kalyani Mundada';
        }

        return str || 'Supriya Yadav';
    }
    window.sanitizeRepName = sanitizeRepName;

    function sanitizeTeamMember(m, index = 0) {
        if (!m || typeof m !== 'object') return m;
        const name = (m.name || '').trim();
        const lower = name.toLowerCase();
        const idLower = (m.id || '').toLowerCase();
        const empLower = (m.employee_id || '').toLowerCase();

        if (idLower === 'rep-001' || empLower === 'emp-101' || lower.includes('kapil') || lower.includes('rahul') || m.role_type === 'sr_sales_rep') {
            m.name = 'Kapil Todi';
            m.email = m.email && !m.email.includes('example.com') ? m.email : 'kapil.todi@gmail.com';
            m.phone = m.phone || '+91 97696 61978';
            m.employee_id = 'EMP-101';
            m.role_type = 'sr_sales_rep';
            m.designation = 'Sr. Sales Rep';
            return m;
        }

        if (
            idLower === 'rep-002' ||
            empLower === 'emp-102' ||
            lower.includes('supriya') ||
            lower.includes('priya') ||
            lower.includes('sales rep 1') ||
            lower.includes('sales-rep-1') ||
            lower.includes('sales person 1') ||
            lower.includes('rep 1') ||
            lower.includes('rep-1') ||
            lower === '1' ||
            lower === 'sales rep' ||
            lower === 'sales representative' ||
            index === 1
        ) {
            m.name = 'Supriya Yadav';
            m.email = 'supriya.yadav@example.com';
            m.phone = m.phone || '+91 98765 43211';
            m.employee_id = 'EMP-102';
            m.role_type = 'sales_rep';
            m.designation = 'Sales Rep';
            return m;
        }

        if (
            idLower === 'rep-003' ||
            empLower === 'emp-103' ||
            lower.includes('kalyani') ||
            lower.includes('amit') ||
            lower.includes('sales rep 2') ||
            lower.includes('sales-rep-2') ||
            lower.includes('sales person 2') ||
            lower.includes('rep 2') ||
            lower.includes('rep-2') ||
            lower === '2' ||
            index === 2
        ) {
            m.name = 'Kalyani Mundada';
            m.email = 'kalyani.mundada@example.com';
            m.phone = m.phone || '+91 98765 43212';
            m.employee_id = 'EMP-103';
            m.role_type = 'sales_rep';
            m.designation = 'Sales Rep';
            return m;
        }

        m.name = sanitizeRepName(m.name, m.employee_id, m.id);
        return m;
    }

    function deduplicateAndCleanTeam(team) {
        if (!Array.isArray(team) || team.length === 0) return [...DEFAULT_TEAM_MEMBERS];

        const regularReps = team.filter(m => m.role_type === 'sales_rep');
        const srReps = team.filter(m => m.role_type === 'sr_sales_rep');

        const cleaned = [];

        // 1. Always ensure Kapil Todi as Sr. Sales Rep
        const sr = srReps.find(m => m.id === 'rep-001' || (m.name && m.name.toLowerCase().includes('kapil'))) || team[0] || DEFAULT_TEAM_MEMBERS[0];
        cleaned.push(sanitizeTeamMember({ ...sr }, 0));

        // 2. Always ensure Supriya Yadav as Sales Rep 1
        const rep1 = regularReps.find(m => {
            const l = (m.name || '').toLowerCase();
            return m.id === 'rep-002' || m.employee_id === 'EMP-102' || l.includes('supriya') || l.includes('priya') || l.includes('sales rep 1') || l.includes('rep 1');
        }) || regularReps[0] || DEFAULT_TEAM_MEMBERS[1];
        cleaned.push(sanitizeTeamMember({ ...rep1 }, 1));

        // 3. Always ensure Kalyani Mundada as Sales Rep 2
        const rep2 = regularReps.find(m => {
            const l = (m.name || '').toLowerCase();
            return m.id === 'rep-003' || m.employee_id === 'EMP-103' || l.includes('kalyani') || l.includes('amit') || l.includes('sales rep 2') || l.includes('rep 2');
        }) || (regularReps[1] && regularReps[1] !== rep1 ? regularReps[1] : DEFAULT_TEAM_MEMBERS[2]);
        cleaned.push(sanitizeTeamMember({ ...rep2 }, 2));

        // 4. Any other custom-created team members beyond the core 3
        team.forEach(m => {
            const cleanName = sanitizeRepName(m.name, m.employee_id, m.id);
            if (!cleaned.some(c => c.name.toLowerCase() === cleanName.toLowerCase())) {
                cleaned.push({ ...m, name: cleanName });
            }
        });

        return cleaned;
    }
    window.deduplicateAndCleanTeam = deduplicateAndCleanTeam;

    function getLocalTeam() {
        try {
            const stored = localStorage.getItem(TEAM_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const cleaned = deduplicateAndCleanTeam(parsed);
                    saveLocalTeam(cleaned);
                    return cleaned;
                }
            }
        } catch (e) {}
        localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(DEFAULT_TEAM_MEMBERS));
        return [...DEFAULT_TEAM_MEMBERS];
    }

    function saveLocalTeam(team) {
        try {
            const cleaned = deduplicateAndCleanTeam(team);
            localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(cleaned));
        } catch (e) {}
    }

    async function getSalesTeam(activeOnly = false) {
        try {
            const data = await CloudDB.getTeam();
            if (Array.isArray(data) && data.length > 0) {
                // Automatically fix & rename any 'Sales Rep 1' / 'Sales Rep 2' records in Supabase
                data.forEach(async (orig) => {
                    const sanitizedName = sanitizeRepName(orig.name, orig.employee_id, orig.id);
                    if (sanitizedName !== orig.name) {
                        try {
                            const client = getSupabase();
                            if (client) {
                                await client.from('sales_reps').update({
                                    name: sanitizedName,
                                    employee_id: orig.employee_id === 'EMP-101' ? 'EMP-101' : (sanitizedName === 'Supriya Yadav' ? 'EMP-102' : (sanitizedName === 'Kalyani Mundada' ? 'EMP-103' : orig.employee_id))
                                }).eq('id', orig.id);
                            }
                        } catch (e) {}
                    }
                });

                const local = getLocalTeam();
                const localOnly = local.filter(l => l.id && l.id.startsWith('rep-') && !data.some(d => d.id === l.id || (d.name && l.name && d.name.toLowerCase() === l.name.toLowerCase())));
                const merged = deduplicateAndCleanTeam([...data, ...localOnly]);
                saveLocalTeam(merged);
                return activeOnly ? merged.filter(m => m.is_active) : merged;
            }
        } catch (e) {}

        const local = getLocalTeam();
        return activeOnly ? local.filter(m => m.is_active) : local;
    }

    async function addSalesTeamMember(member) {
        if (!member.name || !member.name.trim()) throw new Error('Member name is required.');
        const roleType = member.role_type || 'sales_rep';
        const newMember = {
            name: member.name.trim(),
            email: (member.email || '').trim(),
            phone: (member.phone || '').trim(),
            employee_id: (member.employee_id || `EMP-${Date.now().toString().slice(-4)}`).trim(),
            role_type: roleType,
            designation: (member.designation || (roleType === 'sr_sales_rep' ? 'Sr. Sales Rep' : 'Sales Rep')).trim(),
            is_active: member.is_active !== false,
            created_at: new Date().toISOString()
        };

        const supabase = getSupabase();
        if (supabase) {
            try {
                const { data, error } = await supabase.from('sales_reps').insert([newMember]).select().single();
                if (!error && data) {
                    const local = getLocalTeam();
                    const filtered = local.filter(m => m.id !== data.id && m.name.toLowerCase() !== data.name.toLowerCase());
                    filtered.unshift(data);
                    saveLocalTeam(filtered);
                    return data;
                } else if (error) {
                    console.warn('Supabase insert sales_reps failed, persisting locally:', error);
                }
            } catch (e) {
                console.warn('Supabase insert sales_reps exception, persisting locally:', e);
            }
        }

        const local = getLocalTeam();
        const createdLocally = { ...newMember, id: 'rep-' + Date.now() };
        const filtered = local.filter(m => m.name.toLowerCase() !== createdLocally.name.toLowerCase());
        filtered.unshift(createdLocally);
        saveLocalTeam(filtered);
        return createdLocally;
    }

    async function deleteSalesTeamMember(id) {
        if (!id) return false;

        const local = getLocalTeam();
        const target = local.find(m => m.id === id);

        // Security check: Sr. Sales Rep can only delete regular Sales Reps
        if (target && target.role_type === 'sr_sales_rep' && !isExecutiveAdmin()) {
            throw new Error('Permission Denied: Sr. Sales Reps cannot delete another Sr. Sales Rep. Only Admin can perform this action.');
        }

        const supabase = getSupabase();
        if (supabase) {
            try { await supabase.from('sales_reps').delete().eq('id', id); } catch (e) {}
        }
        const filtered = local.filter(m => m.id !== id);
        saveLocalTeam(filtered);
        return true;
    }

    async function updateSalesTeamMember(id, updates) {
        if (!id) throw new Error('Member ID is required.');
        if (!updates.name || !updates.name.trim()) throw new Error('Member name cannot be empty.');

        const local = getLocalTeam();
        const index = local.findIndex(m => m.id === id);
        if (index === -1) throw new Error('Sales team member not found.');

        const existing = local[index];

        // Security check: If target is a Sr. Sales Rep, ONLY Admin can edit!
        if (existing.role_type === 'sr_sales_rep' && !isExecutiveAdmin()) {
            throw new Error('Permission Denied: Only Admin can edit the name and details of a Sr. Sales Rep.');
        }

        const oldName = existing.name;
        const newName = updates.name.trim();

        const updatedMember = {
            ...existing,
            name: newName,
            phone: (updates.phone !== undefined ? updates.phone : existing.phone || '').trim(),
            email: (updates.email !== undefined ? updates.email : existing.email || '').trim(),
            employee_id: (updates.employee_id !== undefined ? updates.employee_id : existing.employee_id || '').trim(),
            role_type: updates.role_type || existing.role_type || 'sales_rep',
            designation: (updates.designation || (updates.role_type === 'sr_sales_rep' ? 'Sr. Sales Rep' : 'Sales Rep')).trim(),
            updated_at: new Date().toISOString()
        };

        // 1. Update in local storage
        local[index] = updatedMember;
        saveLocalTeam(local);

        // 2. Update Supabase if connected
        const supabase = getSupabase();
        if (supabase) {
            try {
                await supabase.from('sales_reps').update({
                    name: updatedMember.name,
                    phone: updatedMember.phone,
                    email: updatedMember.email,
                    employee_id: updatedMember.employee_id,
                    role_type: updatedMember.role_type,
                    designation: updatedMember.designation,
                    updated_at: updatedMember.updated_at
                }).eq('id', id);

                // Update visits associated with this rep if name changed
                if (oldName !== newName) {
                    await supabase.from('client_visits').update({
                        sales_rep_name: newName
                    }).eq('sales_rep_id', id);
                }
            } catch (e) {
                console.warn('Supabase updateSalesTeamMember sync error:', e);
            }
        }

        // 3. Update existing client visits in local storage if name changed
        if (oldName !== newName) {
            const localVisits = getLocalVisits();
            let visitsModified = false;
            localVisits.forEach(v => {
                if (v.sales_rep_id === id || (v.sales_rep_name && v.sales_rep_name.toLowerCase() === oldName.toLowerCase())) {
                    v.sales_rep_name = newName;
                    visitsModified = true;
                }
            });
            if (visitsModified) {
                saveLocalVisits(localVisits);
                if (State.allVisitsCache) {
                    State.allVisitsCache.forEach(v => {
                        if (v.sales_rep_id === id || (v.sales_rep_name && v.sales_rep_name.toLowerCase() === oldName.toLowerCase())) {
                            v.sales_rep_name = newName;
                        }
                    });
                }
                if (State.visits) {
                    State.visits.forEach(v => {
                        if (v.sales_rep_id === id || (v.sales_rep_name && v.sales_rep_name.toLowerCase() === oldName.toLowerCase())) {
                            v.sales_rep_name = newName;
                        }
                    });
                }
            }
        }

        // 4. If active session is this user, update active session name & UI immediately
        if (State.currentUser && (State.currentUser.id === id || State.currentUser.name === oldName)) {
            State.currentUser.name = newName;
            State.currentUser.role = updatedMember.role_type;
            State.currentUser.role_type = updatedMember.role_type;
            State.currentUser.designation = updatedMember.designation;
            State.currentUser.phone = updatedMember.phone;
            State.currentUser.employee_id = updatedMember.employee_id;
            try {
                localStorage.setItem(USER_SESSION_STORAGE_KEY, JSON.stringify(State.currentUser));
            } catch (e) {}
            updateUserSessionUI();
        }

        return updatedMember;
    }

    // --------------------------------------------------------------------------
    // 6. CLIENT VISIT SERVICE
    // --------------------------------------------------------------------------
    const VISITS_STORAGE_KEY = 'sales_erp_client_visits';
    const DEFAULT_SAMPLE_VISITS = [
        {
            id: 'visit-101',
            sales_rep_id: 'rep-001',
            sales_rep_name: 'Kapil Todi',
            employee_id: 'EMP-101',
            business_name: 'Nexus Retail Enterprises',
            client_name: 'Nexus Retail Enterprises',
            address_option_a: 'Plot 45, Sector 18, Commercial Belt, Cyber City',
            address_option_b: 'Sector 18, Gurugram, Haryana 122002',
            client_address: 'Plot 45, Sector 18, Commercial Belt, Cyber City',
            visit_time: new Date(Date.now() - 2 * 3600000).toISOString(),
            latitude: 28.4985,
            longitude: 77.0890,
            location_address: 'Sector 18, Gurugram, Haryana 122002',
            contact_person_name: 'Vikas Malhotra',
            contact_person_phone: '+91 98112 34567',
            contact_person_email: 'vikas@nexusretail.com',
            pincode: '122002',
            status: 'Successful Closed',
            follow_up_date: null,
            remarks: 'Met with the Purchase Director. Discussed annual contract terms for bulk enterprise supply. Final contract signed for 500 units!',
            visiting_card_front_url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80',
            visiting_card_back_url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80',
            visiting_card_url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80',
            office_photo_url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=600&q=80',
            ocr_extracted_data: { companyName: 'Nexus Retail Enterprises', contactPerson: 'Vikas Malhotra', phone: '+91 98112 34567', email: 'vikas@nexusretail.com', pincode: '122002' },
            created_at: new Date(Date.now() - 2 * 3600000).toISOString()
        },
        {
            id: 'visit-102',
            sales_rep_id: 'rep-002',
            sales_rep_name: 'Supriya Yadav',
            employee_id: 'EMP-102',
            business_name: 'Apex Infotech Solutions',
            client_name: 'Apex Infotech Solutions',
            address_option_a: '3rd Floor, Tower B, Infinity Tech Park, MG Road',
            address_option_b: 'Infinity Park, MG Road, Mumbai, Maharashtra 400051',
            client_address: '3rd Floor, Tower B, Infinity Tech Park, MG Road',
            visit_time: new Date(Date.now() - 5 * 3600000).toISOString(),
            latitude: 19.0760,
            longitude: 72.8777,
            location_address: 'Infinity Park, MG Road, Mumbai, Maharashtra 400051',
            contact_person_name: 'Ananya Deshmukh',
            contact_person_phone: '+91 98220 98765',
            contact_person_email: 'ananya.d@apexinfotech.io',
            pincode: '400051',
            status: 'Follow-up Required',
            follow_up_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
            remarks: 'Product demo given to tech team. Highly impressed with features. Follow up next Tuesday with revised commercial proposal.',
            visiting_card_front_url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80',
            visiting_card_back_url: null,
            visiting_card_url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80',
            office_photo_url: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=600&q=80',
            ocr_extracted_data: { companyName: 'Apex Infotech Solutions', contactPerson: 'Ananya Deshmukh', phone: '+91 98220 98765', email: 'ananya.d@apexinfotech.io', pincode: '400051' },
            created_at: new Date(Date.now() - 5 * 3600000).toISOString()
        },
        {
            id: 'visit-103',
            sales_rep_id: 'rep-001',
            sales_rep_name: 'Kapil Todi',
            employee_id: 'EMP-101',
            business_name: 'Sunrise Logistics Hub',
            client_name: 'Sunrise Logistics Hub',
            address_option_a: 'National Highway 48, Near Toll Plaza, Cargo Complex',
            address_option_b: 'Cargo Complex, NH48, Noida, Uttar Pradesh 201301',
            client_address: 'National Highway 48, Near Toll Plaza, Cargo Complex',
            visit_time: new Date(Date.now() - 26 * 3600000).toISOString(),
            latitude: 28.5355,
            longitude: 77.3910,
            location_address: 'Cargo Complex, NH48, Noida, Uttar Pradesh 201301',
            contact_person_name: 'Rajinder Gill',
            contact_person_phone: '+91 97110 54321',
            contact_person_email: 'rgill@sunriselogistics.in',
            pincode: '201301',
            status: 'Successful Closed',
            follow_up_date: null,
            remarks: 'Payment terms agreed upon. Received advance cheque for pilot deployment. Onboarding scheduled for next week.',
            visiting_card_front_url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80',
            visiting_card_back_url: null,
            visiting_card_url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80',
            office_photo_url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80',
            ocr_extracted_data: { companyName: 'Sunrise Logistics Hub', contactPerson: 'Rajinder Gill', phone: '+91 97110 54321', email: 'rgill@sunriselogistics.in', pincode: '201301' },
            created_at: new Date(Date.now() - 26 * 3600000).toISOString()
        },
        {
            id: 'visit-104',
            sales_rep_id: 'rep-002',
            sales_rep_name: 'Supriya Yadav',
            employee_id: 'EMP-102',
            business_name: 'Nexus Retail Enterprises',
            client_name: 'Nexus Retail Enterprises',
            address_option_a: 'Unit 12, Express Towers, Nariman Point',
            address_option_b: 'Nariman Point, Mumbai, Maharashtra 400021',
            client_address: 'Unit 12, Express Towers, Nariman Point',
            visit_time: new Date(Date.now() - 48 * 3600000).toISOString(),
            latitude: 18.9256,
            longitude: 72.8242,
            location_address: 'Nariman Point, Mumbai, Maharashtra 400021',
            contact_person_name: 'Sunil Kothari',
            contact_person_phone: '+91 98201 11223',
            contact_person_email: 'sunil.k@nexusretail.com',
            pincode: '400021',
            status: 'Follow-up Required',
            follow_up_date: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
            remarks: 'Met Regional VP of Retail Operations. Explored western region expansion and bulk POS integration.',
            visiting_card_front_url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80',
            visiting_card_back_url: null,
            visiting_card_url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80',
            office_photo_url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=600&q=80',
            ocr_extracted_data: { companyName: 'Nexus Retail Enterprises', contactPerson: 'Sunil Kothari', phone: '+91 98201 11223', email: 'sunil.k@nexusretail.com', pincode: '400021' },
            created_at: new Date(Date.now() - 48 * 3600000).toISOString()
        },
        {
            id: 'visit-105',
            sales_rep_id: 'rep-003',
            sales_rep_name: 'Kalyani Mundada',
            employee_id: 'EMP-103',
            business_name: 'Sterling Design Studio',
            client_name: 'Sterling Design Studio',
            address_option_a: '502, Prime Plaza, SV Road, Bandra West',
            address_option_b: 'Bandra West, Mumbai, Maharashtra 400050',
            client_address: '502, Prime Plaza, SV Road, Bandra West',
            visit_time: new Date(Date.now() - 4 * 3600000).toISOString(),
            latitude: 19.0596,
            longitude: 72.8295,
            location_address: 'Bandra West, Mumbai, Maharashtra 400050',
            contact_person_name: 'Pooja Mehta',
            contact_person_phone: '+91 98205 67890',
            contact_person_email: 'pooja@sterlingdesign.in',
            pincode: '400050',
            status: 'Follow-up Required',
            follow_up_date: new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0],
            remarks: 'Product catalogue presented to principal architect. Follow-up meeting scheduled next week for sample approvals.',
            visiting_card_front_url: null,
            visiting_card_back_url: null,
            visiting_card_url: null,
            office_photo_url: null,
            ocr_extracted_data: { companyName: 'Sterling Design Studio', contactPerson: 'Pooja Mehta', phone: '+91 98205 67890', email: 'pooja@sterlingdesign.in', pincode: '400050' },
            created_at: new Date(Date.now() - 4 * 3600000).toISOString()
        },
        {
            id: 'visit-106',
            sales_rep_id: 'rep-003',
            sales_rep_name: 'Kalyani Mundada',
            employee_id: 'EMP-103',
            business_name: 'Zenith Architecture Group',
            client_name: 'Zenith Architecture Group',
            address_option_a: '14th Floor, Maker Chambers, Nariman Point',
            address_option_b: 'Nariman Point, Mumbai, Maharashtra 400021',
            client_address: '14th Floor, Maker Chambers, Nariman Point',
            visit_time: new Date(Date.now() - 28 * 3600000).toISOString(),
            latitude: 18.9256,
            longitude: 72.8242,
            location_address: 'Nariman Point, Mumbai, Maharashtra 400021',
            contact_person_name: 'Rohan Kulkarni',
            contact_person_phone: '+91 99301 23456',
            contact_person_email: 'rohan.k@zenitharch.com',
            pincode: '400021',
            status: 'Successful Closed',
            follow_up_date: null,
            remarks: 'Purchase agreement executed for upcoming commercial complex project. Advance received.',
            visiting_card_front_url: null,
            visiting_card_back_url: null,
            visiting_card_url: null,
            office_photo_url: null,
            ocr_extracted_data: { companyName: 'Zenith Architecture Group', contactPerson: 'Rohan Kulkarni', phone: '+91 99301 23456', email: 'rohan.k@zenitharch.com', pincode: '400021' },
            created_at: new Date(Date.now() - 28 * 3600000).toISOString()
        }
    ];

    function sanitizeVisitRecord(v) {
        if (!v || typeof v !== 'object') return v;
        const repName = (v.sales_rep_name || '').trim();
        const vId = (v.sales_rep_id || '').toLowerCase();
        const vEmp = (v.employee_id || '').toLowerCase();

        const cleanName = sanitizeRepName(repName, vEmp, vId);
        v.sales_rep_name = cleanName;

        if (cleanName === 'Kapil Todi') {
            v.sales_rep_id = v.sales_rep_id || 'rep-001';
            v.employee_id = v.employee_id || 'EMP-101';
        } else if (cleanName === 'Supriya Yadav') {
            v.sales_rep_id = v.sales_rep_id || 'rep-002';
            v.employee_id = v.employee_id || 'EMP-102';
        } else if (cleanName === 'Kalyani Mundada') {
            v.sales_rep_id = v.sales_rep_id || 'rep-003';
            v.employee_id = v.employee_id || 'EMP-103';
        }
        return v;
    }
    window.sanitizeVisitRecord = sanitizeVisitRecord;

    // --------------------------------------------------------------------------
    // ROBUST CLIENT STORAGE: INDEXEDDB + COMPRESSED LOCALSTORAGE
    // --------------------------------------------------------------------------
    const IDB_NAME = 'SalesErpDB_v2';
    const IDB_STORE = 'client_visits';

    function openVisitsIDB() {
        return new Promise((resolve) => {
            if (typeof window === 'undefined' || !window.indexedDB) return resolve(null);
            try {
                const req = window.indexedDB.open(IDB_NAME, 1);
                req.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(IDB_STORE)) {
                        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
                    }
                };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(null);
            } catch (e) {
                resolve(null);
            }
        });
    }

    async function saveVisitsToIndexedDB(visits) {
        if (!Array.isArray(visits) || visits.length === 0) return;
        const db = await openVisitsIDB();
        if (!db) return;
        try {
            const tx = db.transaction(IDB_STORE, 'readwrite');
            const store = tx.objectStore(IDB_STORE);
            for (const v of visits) {
                if (v && v.id) store.put(v);
            }
        } catch (e) {
            console.warn('IDB put error:', e);
        }
    }

    async function getVisitsFromIndexedDB() {
        const db = await openVisitsIDB();
        if (!db) return null;
        return new Promise((resolve) => {
            try {
                const tx = db.transaction(IDB_STORE, 'readonly');
                const store = tx.objectStore(IDB_STORE);
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => resolve(null);
            } catch (e) {
                resolve(null);
            }
        });
    }

    async function deleteVisitFromIndexedDB(id) {
        const db = await openVisitsIDB();
        if (!db || !id) return;
        try {
            const tx = db.transaction(IDB_STORE, 'readwrite');
            tx.objectStore(IDB_STORE).delete(id);
        } catch (e) {}
    }

    function getLocalVisits() {
        try {
            const stored = localStorage.getItem(VISITS_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    let mod = false;
                    parsed.forEach(v => {
                        const oldName = v.sales_rep_name;
                        sanitizeVisitRecord(v);
                        if (v.sales_rep_name !== oldName) mod = true;
                    });

                    // Ensure Supriya has visits in local storage if missing
                    const hasSupriya = parsed.some(v => v.sales_rep_name === 'Supriya Yadav');
                    if (!hasSupriya) {
                        const supriyaSamples = DEFAULT_SAMPLE_VISITS.filter(v => v.sales_rep_id === 'rep-002').map(v => sanitizeVisitRecord({ ...v, sales_rep_name: 'Supriya Yadav' }));
                        parsed.push(...supriyaSamples);
                        mod = true;
                    }

                    // Ensure Kalyani has visits in local storage if missing
                    const hasKalyani = parsed.some(v => v.sales_rep_name === 'Kalyani Mundada');
                    if (!hasKalyani) {
                        const kalyaniSamples = DEFAULT_SAMPLE_VISITS.filter(v => v.sales_rep_id === 'rep-003').map(v => sanitizeVisitRecord({ ...v, sales_rep_name: 'Kalyani Mundada' }));
                        parsed.push(...kalyaniSamples);
                        mod = true;
                    }

                    if (mod) saveLocalVisits(parsed);
                    return parsed;
                }
            }
        } catch (e) {}
        const defaultClean = DEFAULT_SAMPLE_VISITS.map(v => sanitizeVisitRecord({ ...v }));
        saveLocalVisits(defaultClean);
        return defaultClean;
    }

    function saveLocalVisits(visits) {
        if (!Array.isArray(visits)) return;
        try {
            localStorage.setItem(VISITS_STORAGE_KEY, JSON.stringify(visits));
        } catch (e) {
            console.warn('localStorage quota reached, pruning heavy base64 strings from older records:', e);
            try {
                // Keep photos for 3 newest visits, trim data URLs for older visits to ensure all records fit
                const pruned = visits.map((v, i) => {
                    if (i < 3) return v;
                    return {
                        ...v,
                        visiting_card_front_url: (v.visiting_card_front_url && v.visiting_card_front_url.startsWith('http')) ? v.visiting_card_front_url : null,
                        visiting_card_back_url: (v.visiting_card_back_url && v.visiting_card_back_url.startsWith('http')) ? v.visiting_card_back_url : null,
                        visiting_card_url: (v.visiting_card_url && v.visiting_card_url.startsWith('http')) ? v.visiting_card_url : null,
                        office_photo_url: (v.office_photo_url && v.office_photo_url.startsWith('http')) ? v.office_photo_url : null
                    };
                });
                localStorage.setItem(VISITS_STORAGE_KEY, JSON.stringify(pruned));
            } catch (err2) {
                console.error('Critical localStorage error:', err2);
            }
        }
        // Always persist the full visits (with all photos) to IndexedDB
        saveVisitsToIndexedDB(visits);
    }

    async function recordClientVisit(visitData) {
        let cardFrontUrl = visitData.visiting_card_front_url || null;
        let cardBackUrl = visitData.visiting_card_back_url || null;
        let officePhotoUrl = visitData.office_photo_url || null;

        if (visitData.visitingCardFrontFile) {
            cardFrontUrl = await uploadVisitImage(visitData.visitingCardFrontFile, 'visiting_cards_front');
        }
        if (visitData.visitingCardBackFile) {
            cardBackUrl = await uploadVisitImage(visitData.visitingCardBackFile, 'visiting_cards_back');
        }
        if (visitData.officePhotoFile) {
            officePhotoUrl = await uploadVisitImage(visitData.officePhotoFile, 'office_photos');
        }

        const bName = (visitData.business_name || visitData.client_name || '').trim();
        const addrA = (visitData.address_option_a || visitData.client_address || '').trim();
        const addrB = (visitData.address_option_b || visitData.location_address || '').trim();

        const cleanRecord = prepareVisitForDatabase({
            id: 'visit-' + Date.now(),
            sales_rep_id: visitData.sales_rep_id || (State.currentUser?.id || 'rep-002'),
            sales_rep_name: sanitizeRepName(visitData.sales_rep_name || State.currentUser?.name, visitData.employee_id, visitData.sales_rep_id),
            employee_id: (visitData.employee_id || State.currentUser?.employee_id || '').trim(),
            business_name: bName,
            client_name: bName,
            address_option_a: addrA,
            address_option_b: addrB,
            client_address: addrA,
            visit_time: visitData.visit_time || new Date().toISOString(),
            latitude: visitData.latitude ? Number(visitData.latitude) : null,
            longitude: visitData.longitude ? Number(visitData.longitude) : null,
            location_address: addrB,
            contact_person_name: (visitData.contact_person_name || '').trim(),
            contact_person_phone: (visitData.contact_person_phone || '').trim(),
            contact_person_email: (visitData.contact_person_email || '').trim(),
            pincode: (visitData.pincode || '').trim(),
            status: visitData.status || 'Follow-up Required',
            follow_up_date: visitData.follow_up_date || null,
            remarks: (visitData.remarks || '').trim(),
            visiting_card_front_url: cardFrontUrl,
            visiting_card_back_url: cardBackUrl,
            visiting_card_url: cardFrontUrl,
            office_photo_url: officePhotoUrl,
            ocr_raw_text: visitData.ocr_raw_text || null,
            ocr_extracted_data: visitData.ocr_extracted_data || {},
            created_at: new Date().toISOString()
        });

        // Save to central cloud database first
        let savedCloud = null;
        try {
            savedCloud = await CloudDB.saveVisit(cleanRecord);
        } catch (e) {
            console.warn('Cloud save attempt failed:', e);
        }

        // Always save locally to this device
        const recordToKeep = savedCloud || cleanRecord;
        const local = getLocalVisits();
        local.unshift(recordToKeep);
        saveLocalVisits(local);

        return recordToKeep;
    }

    // --------------------------------------------------------------------------
    // NORMALIZATION & COMMON ACCOUNTS SERVICE
    // --------------------------------------------------------------------------
    function normalizeBusinessName(name) {
        return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    }

    function getCommonAccountsMap(allVisits) {
        const map = new Map(); // normalizedName -> { businessName, repIds: Set, repNames: Set, visits: [] }
        (allVisits || []).forEach(v => {
            const rawName = v.business_name || v.client_name;
            if (!rawName) return;
            const norm = normalizeBusinessName(rawName);
            if (!norm) return;
            if (!map.has(norm)) {
                map.set(norm, {
                    businessName: rawName.trim(),
                    repIds: new Set(),
                    repNames: new Set(),
                    visits: []
                });
            }
            const entry = map.get(norm);
            if (v.sales_rep_id) entry.repIds.add(v.sales_rep_id);
            if (v.sales_rep_name) entry.repNames.add(v.sales_rep_name.trim());
            entry.visits.push(v);
        });

        const commonMap = new Map();
        for (const [norm, data] of map.entries()) {
            if (data.repNames.size >= 2 || data.repIds.size >= 2) {
                commonMap.set(norm, data);
            }
        }
        return commonMap;
    }

    async function getClientVisits(filters = {}) {
        let allVisits = [];
        let cloudData = null;

        try {
            cloudData = await CloudDB.getVisits();
        } catch (e) {
            console.warn('Failed to fetch visits from CloudDB:', e);
        }

        if (Array.isArray(cloudData)) {
            cloudData.forEach(v => {
                const oldName = v.sales_rep_name;
                sanitizeVisitRecord(v);
                if (oldName !== v.sales_rep_name) {
                    CloudDB.saveVisit(v).catch(() => {});
                }
            });

            // Keep local visits that might not yet be in Supabase (e.g. created offline or on mobile)
            const serverIds = new Set(cloudData.map(v => String(v.id)));
            const local = getLocalVisits();
            let idb = [];
            try { idb = (await getVisitsFromIndexedDB()) || []; } catch(e) {}
            const localUnsynced = [...local, ...idb].filter(v => 
                v && v.id && 
                !serverIds.has(String(v.id)) && 
                !String(v.id).startsWith('mock-') && 
                !String(v.id).startsWith('visit-10')
            );

            // Combine server data and local unsynced data
            const map = new Map();
            cloudData.forEach(v => map.set(String(v.id), sanitizeVisitRecord(v)));
            localUnsynced.forEach(v => {
                if (!map.has(String(v.id))) {
                    map.set(String(v.id), sanitizeVisitRecord(v));
                }
            });

            allVisits = Array.from(map.values()).sort((a, b) => new Date(b.visit_time || 0) - new Date(a.visit_time || 0));
            saveLocalVisits(allVisits);

            // If there are unsynced visits on this device, push them to Supabase in the background
            if (localUnsynced.length > 0) {
                setTimeout(() => {
                    syncLocalVisitsToCloud().catch(() => {});
                }, 400);
            }
        } else {
            // Check IndexedDB for any visits saved that might not be in localStorage
            try {
                const idbVisits = await getVisitsFromIndexedDB();
                const localVisits = getLocalVisits();
                if (Array.isArray(idbVisits) && idbVisits.length > 0) {
                    const map = new Map();
                    localVisits.forEach(v => map.set(v.id, sanitizeVisitRecord(v)));
                    idbVisits.forEach(v => map.set(v.id, sanitizeVisitRecord(v)));
                    allVisits = Array.from(map.values()).sort((a, b) => new Date(b.visit_time || 0) - new Date(a.visit_time || 0));
                    saveLocalVisits(allVisits);
                } else {
                    allVisits = localVisits;
                }
            } catch (err) {
                allVisits = getLocalVisits();
            }
        }

        // Cache all visits and compute cross-rep common accounts map
        State.allVisitsCache = allVisits;
        State.commonAccountsMap = getCommonAccountsMap(allVisits);

        let filtered = [...allVisits];

        // 1. REP PRIVACY / ISOLATION:
        // One sales representative MUST NOT be allowed to see other sales reps' visits or remarks
        // Sr. Sales Reps and Managers have access to all functions (all visits across the company)
        if (isSalesRep()) {
            const currentRepId = (State.currentUser?.id || '').toLowerCase();
            const currentRepName = (State.currentUser?.name || '').toLowerCase();
            const currentEmpId = (State.currentUser?.employee_id || '').toLowerCase();
            const repFirstWord = currentRepName.split(/\s+/)[0];

            filtered = filtered.filter(v => {
                const vId = (v.sales_rep_id || '').toLowerCase();
                const vName = (v.sales_rep_name || '').toLowerCase();
                const vEmp = (v.employee_id || '').toLowerCase();

                const idMatch = currentRepId && vId === currentRepId;
                const empMatch = currentEmpId && vEmp && vEmp === currentEmpId;
                const nameMatch = currentRepName && (vName === currentRepName || vName.includes(currentRepName) || currentRepName.includes(vName));
                const firstWordMatch = repFirstWord && repFirstWord.length >= 3 && vName.includes(repFirstWord);

                return idMatch || empMatch || nameMatch || firstWordMatch;
            });
        } else if (filters.salesRep && filters.salesRep !== 'ALL') {
            // Sr. Sales Rep & Manager mode can filter by any specific sales representative or view ALL
            filtered = filtered.filter(v => v.sales_rep_id === filters.salesRep || (v.sales_rep_name && v.sales_rep_name.toLowerCase() === filters.salesRep.toLowerCase()));
        }

        // 2. Common Accounts Only Filter
        if (filters.commonOnly) {
            filtered = filtered.filter(v => {
                const norm = normalizeBusinessName(v.business_name || v.client_name);
                return State.commonAccountsMap.has(norm);
            });
        }

        // 3. Day / Date Filter
        if (filters.dayFilter && filters.dayFilter !== 'ALL') {
            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];
            const yesterday = new Date(now.getTime() - 86400000);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            if (filters.dayFilter === 'TODAY') {
                filtered = filtered.filter(v => v.visit_time && v.visit_time.startsWith(todayStr));
            } else if (filters.dayFilter === 'YESTERDAY') {
                filtered = filtered.filter(v => v.visit_time && v.visit_time.startsWith(yesterdayStr));
            } else if (filters.dayFilter === 'THIS_WEEK') {
                const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
                filtered = filtered.filter(v => new Date(v.visit_time) >= sevenDaysAgo);
            } else if (filters.dayFilter === 'THIS_MONTH') {
                const monthStr = todayStr.slice(0, 7);
                filtered = filtered.filter(v => v.visit_time && v.visit_time.startsWith(monthStr));
            } else if (filters.dayFilter.startsWith('DATE:')) {
                const specificDate = filters.dayFilter.replace('DATE:', '');
                filtered = filtered.filter(v => v.visit_time && v.visit_time.startsWith(specificDate));
            }
        }

        // 4. Status Filter
        if (filters.status && filters.status !== 'ALL') {
            filtered = filtered.filter(v => v.status === filters.status);
        }

        // 5. Keyword Search
        if (filters.search && filters.search.trim()) {
            const query = filters.search.trim().toLowerCase();
            filtered = filtered.filter(v => {
                const bName = (v.business_name || v.client_name || '').toLowerCase();
                const person = (v.contact_person_name || '').toLowerCase();
                const phone = (v.contact_person_phone || '');
                const email = (v.contact_person_email || '').toLowerCase();
                const pin = (v.pincode || '');
                const addrA = (v.address_option_a || v.client_address || '').toLowerCase();
                const addrB = (v.address_option_b || v.location_address || '').toLowerCase();
                const notes = (v.remarks || '').toLowerCase();

                return bName.includes(query) || person.includes(query) || phone.includes(query) || email.includes(query) || pin.includes(query) || addrA.includes(query) || addrB.includes(query) || notes.includes(query);
            });
        }

        return filtered;
    }
    window.getClientVisits = getClientVisits;

    async function deleteClientVisit(id) {
        if (!id) return false;
        const supabase = getSupabase();
        if (supabase) {
            try { await supabase.from('client_visits').delete().eq('id', id); } catch (e) {}
        }
        await deleteVisitFromIndexedDB(id);
        const local = getLocalVisits();
        const filtered = local.filter(v => v.id !== id);
        saveLocalVisits(filtered);
        return true;
    }

    // --------------------------------------------------------------------------
    // TOAST NOTIFICATION HELPER
    // --------------------------------------------------------------------------
    function showToastNotification(message, iconName = 'check-circle', durationMs = 4500) {
        let toast = document.getElementById('salesErpGlobalToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'salesErpGlobalToast';
            toast.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[90%] px-4 py-3 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700/80 flex items-center gap-3 transition-all duration-300 opacity-0 pointer-events-none transform translate-y-2';
            document.body.appendChild(toast);
        }
        toast.innerHTML = `
            <div class="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <i data-lucide="${iconName}" class="w-5 h-5"></i>
            </div>
            <div class="text-xs font-semibold leading-snug flex-1">${escapeHtml(message)}</div>
        `;
        initLucideIcons();
        toast.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-2');
        toast.classList.add('opacity-100', 'translate-y-0');

        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.classList.remove('opacity-100', 'translate-y-0');
            toast.classList.add('opacity-0', 'pointer-events-none', 'translate-y-2');
        }, durationMs);
    }
    window.showToastNotification = showToastNotification;

    // --------------------------------------------------------------------------
    // RELIABLE MOBILE & DESKTOP EXCEL FILE DOWNLOADER
    // --------------------------------------------------------------------------
    function triggerBlobDownload(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName;
        a.setAttribute('download', fileName);
        document.body.appendChild(a);
        a.click();
        showToastNotification(`📥 File downloaded: ${fileName}\nCheck your Downloads folder.`, 'download');
        setTimeout(() => {
            try {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } catch (e) {}
        }, 4000);
    }

    function generateExcelHtmlTable(sheetData) {
        let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">';
        html += '<head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Sales Visits</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table border="1">';
        (sheetData || []).forEach((row, idx) => {
            html += '<tr>';
            row.forEach(cell => {
                const tag = idx === 0 ? 'th style="background:#2563eb;color:#ffffff;font-weight:bold;padding:6px 10px;"' : 'td style="padding:4px 8px;"';
                html += `<${tag}>${escapeHtml(String(cell === null || cell === undefined ? '' : cell))}</${tag.split(' ')[0]}>`;
            });
            html += '</tr>';
        });
        html += '</table></body></html>';
        return html;
    }

    function downloadExcelFile(wb, fileName, sheetData) {
        let downloaded = false;

        // Method 1: SheetJS ArrayBuffer + Blob + Anchor download
        if (window.XLSX && typeof window.XLSX.write === 'function' && wb) {
            try {
                const wbout = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                triggerBlobDownload(blob, fileName);
                downloaded = true;
                return;
            } catch (e) {
                console.warn('SheetJS binary write failed, trying fallback:', e);
            }
        }

        // Method 2: SheetJS writeFile
        if (!downloaded && window.XLSX && typeof window.XLSX.writeFile === 'function' && wb) {
            try {
                window.XLSX.writeFile(wb, fileName);
                showToastNotification(`📥 File downloaded: ${fileName}\nCheck your Downloads folder.`, 'download');
                downloaded = true;
                return;
            } catch (e) {
                console.warn('SheetJS writeFile failed:', e);
            }
        }

        // Method 3: 100% Reliable HTML/XML Spreadsheet (.xls) Fallback (Opens in Excel, Google Sheets, Mobile Office)
        if (!downloaded && sheetData) {
            try {
                const htmlContent = generateExcelHtmlTable(sheetData);
                const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
                const xlsName = fileName.replace(/\.xlsx$/i, '.xls');
                triggerBlobDownload(blob, xlsName);
                downloaded = true;
                return;
            } catch (e) {
                console.error('Excel HTML fallback failed:', e);
            }
        }

        if (!downloaded) {
            alert('Unable to generate Excel file on this device. Please ensure downloads are permitted.');
        }
    }

    // --------------------------------------------------------------------------
    // EXPORT VISITS TO EXCEL (.xlsx)
    // --------------------------------------------------------------------------
    function exportVisitsToExcel(visits, customFilename = null) {
        let exportData = (visits && visits.length) ? visits : (State.visits && State.visits.length ? State.visits : null);

        // Fallback: fetch from storage if State.visits was empty
        if (!exportData || !exportData.length) {
            const allLocal = getLocalVisits();
            if (isSalesRep()) {
                const currentRepId = (State.currentUser?.id || '').toLowerCase();
                const currentRepName = (State.currentUser?.name || '').toLowerCase();
                const currentEmpId = (State.currentUser?.employee_id || '').toLowerCase();
                const repFirst = currentRepName.split(/\s+/)[0];
                exportData = allLocal.filter(v => {
                    const vId = (v.sales_rep_id || '').toLowerCase();
                    const vName = (v.sales_rep_name || '').toLowerCase();
                    const vEmp = (v.employee_id || '').toLowerCase();
                    return (currentRepId && vId === currentRepId) ||
                           (currentEmpId && vEmp && vEmp === currentEmpId) ||
                           (currentRepName && vName.includes(currentRepName)) ||
                           (repFirst && repFirst.length >= 3 && vName.includes(repFirst));
                });
            } else {
                exportData = allLocal;
            }
        }

        if (!exportData || !exportData.length) {
            alert('No visits to export. Please record a client visit first.');
            return;
        }

        // Ordered with user-requested fields first:
        // BUSINESS NAME / NAME OF PERSON / PHONE NO / REMARKS / NEXT FOLLOW UP DATE
        const headers = [
            'Business Name',
            'Name of Person Met',
            'Contact Mobile Number',
            'Remarks / Discussion',
            'Next Follow-up Date',
            'Meeting Status',
            'Visiting Card Photo',
            'Office Photo',
            'Visit Date & Time',
            'Sales Representative',
            'Employee ID',
            'Contact Email ID',
            'Pin Code',
            'Address Option A (Card / Manual)',
            'Address Option B (GPS Location)',
            'Google Maps Link'
        ];

        const rows = exportData.map(v => {
            const dateStr = v.visit_time ? new Date(v.visit_time).toLocaleString() : '';
            const bName = v.business_name || v.client_name || '';
            const addrA = v.address_option_a || v.client_address || '';
            const addrB = v.address_option_b || v.location_address || '';
            const mapsUrl = (v.latitude && v.longitude) ? `https://www.google.com/maps?q=${v.latitude},${v.longitude}` : '';
            const cardAttached = (v.visiting_card_front_url || v.visiting_card_url)
                ? ((String(v.visiting_card_front_url || v.visiting_card_url).startsWith('http')) ? (v.visiting_card_front_url || v.visiting_card_url) : 'Yes (Saved on Device)')
                : 'No';
            const officeAttached = v.office_photo_url
                ? ((String(v.office_photo_url).startsWith('http')) ? v.office_photo_url : 'Yes (Saved on Device)')
                : 'No';

            return [
                bName,
                v.contact_person_name || '',
                v.contact_person_phone || '',
                v.remarks || '',
                v.follow_up_date || (v.status === 'Successful Closed' ? 'Deal Closed' : ''),
                v.status || '',
                cardAttached,
                officeAttached,
                dateStr,
                v.sales_rep_name || '',
                v.employee_id || '',
                v.contact_person_email || '',
                v.pincode || '',
                addrA,
                addrB,
                mapsUrl
            ];
        });

        const sheetData = [headers, ...rows];
        let wb = null;
        if (window.XLSX && typeof window.XLSX.utils !== 'undefined') {
            wb = window.XLSX.utils.book_new();
            const ws = window.XLSX.utils.aoa_to_sheet(sheetData);
            ws['!cols'] = [
                { wch: 28 }, // Business Name
                { wch: 22 }, // Name of Person
                { wch: 18 }, // Mobile
                { wch: 38 }, // Remarks
                { wch: 18 }, // Next Follow-up
                { wch: 18 }, // Status
                { wch: 22 }, // Visiting Card Photo
                { wch: 22 }, // Office Photo
                { wch: 20 }, // Date & Time
                { wch: 20 }, // Sales Rep
                { wch: 12 }, // Emp ID
                { wch: 24 }, // Email
                { wch: 10 }, // Pin
                { wch: 30 }, // Option A
                { wch: 30 }, // Option B
                { wch: 30 }  // Maps Link
            ];
            const sheetName = isSalesRep() ? 'My Visits' : 'All Visits';
            window.XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }

        let fileName = customFilename;
        if (!fileName) {
            if (isSalesRep()) {
                const cleanName = (State.currentUser?.name || 'Rep').replace(/[^a-zA-Z0-9]/g, '_');
                fileName = `My_Sales_Visits_${cleanName}_${new Date().toISOString().split('T')[0]}.xlsx`;
            } else {
                fileName = `Sales_Visits_Report_All_Reps_${new Date().toISOString().split('T')[0]}.xlsx`;
            }
        }

        downloadExcelFile(wb, fileName, sheetData);
    }

    function exportVisitsToCsv(visits) {
        if (!visits || !visits.length) {
            alert('No visits to export.');
            return;
        }

        const headers = [
            'Sales Representative', 'Employee ID', 'Visit Date & Time', 'Business Name', 'Common Account (Shared)?',
            'Contact Person Name', 'Contact Mobile Number', 'Contact Email ID', 'Pin Code',
            'Address Option A (Card / Manual)', 'Address Option B (Auto GPS Location)',
            'Latitude', 'Longitude', 'Google Maps Link',
            'Meeting Status', 'Follow-up Date', 'Remarks', 'Office Photo URL',
            'Visiting Card Front URL', 'Visiting Card Back URL'
        ];

        const escapeCsv = (val) => {
            if (val === null || val === undefined) return '""';
            const str = String(val).replace(/"/g, '""');
            return `"${str}"`;
        };

        const rows = visits.map(v => {
            const bName = v.business_name || v.client_name || '';
            const isCommon = State.commonAccountsMap && State.commonAccountsMap.has(normalizeBusinessName(bName));
            return [
                escapeCsv(v.sales_rep_name),
                escapeCsv(v.employee_id || ''),
                escapeCsv(v.visit_time ? new Date(v.visit_time).toLocaleString() : ''),
                escapeCsv(bName),
                escapeCsv(isCommon ? 'YES' : 'NO'),
                escapeCsv(v.contact_person_name),
                escapeCsv(v.contact_person_phone),
                escapeCsv(v.contact_person_email || ''),
                escapeCsv(v.pincode || ''),
                escapeCsv(v.address_option_a || v.client_address || ''),
                escapeCsv(v.address_option_b || v.location_address || ''),
                escapeCsv(v.latitude || ''),
                escapeCsv(v.longitude || ''),
                escapeCsv((v.latitude && v.longitude) ? `https://www.google.com/maps?q=${v.latitude},${v.longitude}` : ''),
                escapeCsv(v.status),
                escapeCsv(v.follow_up_date || ''),
                escapeCsv(v.remarks),
                escapeCsv(v.office_photo_url || ''),
                escapeCsv(v.visiting_card_front_url || v.visiting_card_url || ''),
                escapeCsv(v.visiting_card_back_url || '')
            ];
        });

        const csvContent = [headers.map(escapeCsv).join(','), ...rows.map(r => r.join(','))].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const fileName = isSalesRep()
            ? `My_Sales_Visits_${(State.currentUser?.name || 'Rep').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
            : `Sales_Visits_Report_${new Date().toISOString().split('T')[0]}.csv`;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(link.href), 1500);
    }

    // --------------------------------------------------------------------------
    // MULTI-SHEET MIS EXCEL EXPORTER
    // --------------------------------------------------------------------------
    function exportMisReportToExcel(visits, rep, period) {
        if (!window.XLSX || typeof window.XLSX.utils === 'undefined') {
            alert('Excel exporter is still loading. Please retry.');
            return;
        }

        const wb = window.XLSX.utils.book_new();

        // 1. SHEET 1: Performance Summary & Scorecard
        const totalVisits = visits.length;
        const closed = visits.filter(v => v.status === 'Successful Closed').length;
        const followups = visits.filter(v => v.status === 'Follow-up Required').length;
        const conversionRate = totalVisits > 0 ? ((closed / totalVisits) * 100).toFixed(1) + '%' : '0%';
        const commonVisits = visits.filter(v => State.commonAccountsMap && State.commonAccountsMap.has(normalizeBusinessName(v.business_name || v.client_name)));

        const summaryData = [
            ['MANAGEMENT INFORMATION SYSTEM (MIS) REPORT', ''],
            ['FIELD SALES EXECUTIVE PERFORMANCE SCORECARD', ''],
            ['', ''],
            ['Sales Representative Name:', rep.name || 'Sales Rep'],
            ['Employee ID:', rep.employee_id || 'N/A'],
            ['Designation / Role:', rep.designation || 'Field Sales Executive'],
            ['Phone Number:', rep.phone || 'N/A'],
            ['Reporting Period:', period || 'All Time'],
            ['Report Generated On:', new Date().toLocaleString()],
            ['', ''],
            ['EXECUTIVE METRICS & KPIS', 'VALUE'],
            ['Total Client Visits Completed:', totalVisits],
            ['Deals Successfully Closed (Won):', closed],
            ['Follow-up Pipeline in Progress:', followups],
            ['Conversion Efficiency Rate:', conversionRate],
            ['Common Business Accounts (Cross-Rep):', commonVisits.length]
        ];
        const wsSummary = window.XLSX.utils.aoa_to_sheet(summaryData);
        wsSummary['!cols'] = [{ wch: 38 }, { wch: 32 }];
        window.XLSX.utils.book_append_sheet(wb, wsSummary, 'MIS Performance Scorecard');

        // 2. SHEET 2: Visits Activity Ledger
        const headers = [
            'Visit Date & Time', 'Business Name', 'Common Account (Shared)?', 'Contact Person Name', 'Mobile Number',
            'Email ID', 'Pin Code', 'Status', 'Follow-up Date (11:30 AM)', 'Option A Address (Card/Manual)',
            'Option B Verified GPS Address', 'Google Maps Link', 'Remarks & Notes'
        ];
        const visitRows = visits.map(v => {
            const isCommon = State.commonAccountsMap && State.commonAccountsMap.has(normalizeBusinessName(v.business_name || v.client_name));
            return [
                v.visit_time ? new Date(v.visit_time).toLocaleString() : '',
                v.business_name || v.client_name || '',
                isCommon ? 'YES (Multi-Rep Common Account)' : 'No',
                v.contact_person_name || '',
                v.contact_person_phone || '',
                v.contact_person_email || '',
                v.pincode || '',
                v.status || '',
                v.follow_up_date ? `${v.follow_up_date} at 11:30 AM` : '',
                v.address_option_a || v.client_address || '',
                v.address_option_b || v.location_address || '',
                (v.latitude && v.longitude) ? `https://www.google.com/maps?q=${v.latitude},${v.longitude}` : '',
                v.remarks || ''
            ];
        });
        const wsVisits = window.XLSX.utils.aoa_to_sheet([headers, ...visitRows]);
        wsVisits['!cols'] = [
            { wch: 22 }, { wch: 28 }, { wch: 28 }, { wch: 20 }, { wch: 18 },
            { wch: 24 }, { wch: 12 }, { wch: 18 }, { wch: 24 }, { wch: 35 },
            { wch: 35 }, { wch: 30 }, { wch: 40 }
        ];
        window.XLSX.utils.book_append_sheet(wb, wsVisits, 'Visit Activity Ledger');

        // 3. SHEET 3: Common Accounts Overlap
        const commonHeaders = ['Business Name', 'Visits by This Rep', 'Total Visits by All Reps', 'Other Sales Reps Involved', 'Status'];
        const commonAccountRows = [];
        if (State.commonAccountsMap) {
            State.commonAccountsMap.forEach((entry, norm) => {
                const myVisits = visits.filter(v => normalizeBusinessName(v.business_name || v.client_name) === norm);
                if (myVisits.length > 0 || hasAllFunctionsAccess()) {
                    const otherReps = Array.from(entry.repNames).filter(n => n.toLowerCase() !== (rep.name || '').toLowerCase());
                    commonAccountRows.push([
                        entry.businessName,
                        myVisits.length,
                        entry.visits.length,
                        otherReps.join(', ') || 'Shared with team',
                        myVisits[0] ? myVisits[0].status : 'Multiple'
                    ]);
                }
            });
        }
        const wsCommon = window.XLSX.utils.aoa_to_sheet([commonHeaders, ...commonAccountRows]);
        wsCommon['!cols'] = [{ wch: 32 }, { wch: 18 }, { wch: 24 }, { wch: 35 }, { wch: 18 }];
        window.XLSX.utils.book_append_sheet(wb, wsCommon, 'Common Accounts Overlap');

        const cleanRep = (rep.name || 'Sales_Rep').replace(/[^a-zA-Z0-9]/g, '_');
        const cleanPeriod = (period || 'ALL').replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `MIS_Report_${cleanRep}_${cleanPeriod}_${new Date().toISOString().split('T')[0]}.xlsx`;
        downloadExcelFile(wb, fileName, null);
    }

    function exportVisitsToCsv(visits) {
        if (!visits || !visits.length) {
            alert('No visits to export.');
            return;
        }

        const headers = [
            'Sales Representative', 'Employee ID', 'Visit Date & Time', 'Business Name',
            'Contact Person Name', 'Contact Mobile Number', 'Contact Email ID', 'Pin Code',
            'Address Option A (Card / Manual)', 'Address Option B (Auto GPS Location)',
            'Latitude', 'Longitude', 'Google Maps Link',
            'Meeting Status', 'Follow-up Date', 'Remarks', 'Office Photo URL',
            'Visiting Card Front URL', 'Visiting Card Back URL'
        ];

        const escapeCsv = (val) => {
            if (val === null || val === undefined) return '""';
            const str = String(val).replace(/"/g, '""');
            return `"${str}"`;
        };

        const rows = visits.map(v => [
            escapeCsv(v.sales_rep_name),
            escapeCsv(v.employee_id || ''),
            escapeCsv(v.visit_time ? new Date(v.visit_time).toLocaleString() : ''),
            escapeCsv(v.business_name || v.client_name || ''),
            escapeCsv(v.contact_person_name),
            escapeCsv(v.contact_person_phone),
            escapeCsv(v.contact_person_email || ''),
            escapeCsv(v.pincode || ''),
            escapeCsv(v.address_option_a || v.client_address || ''),
            escapeCsv(v.address_option_b || v.location_address || ''),
            escapeCsv(v.latitude || ''),
            escapeCsv(v.longitude || ''),
            escapeCsv(v.latitude && v.longitude ? `https://www.google.com/maps?q=${v.latitude},${v.longitude}` : ''),
            escapeCsv(v.status),
            escapeCsv(v.follow_up_date || ''),
            escapeCsv(v.remarks),
            escapeCsv(v.office_photo_url || ''),
            escapeCsv(v.visiting_card_front_url || v.visiting_card_url || ''),
            escapeCsv(v.visiting_card_back_url || '')
        ].join(','));

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `sales_visits_report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // --------------------------------------------------------------------------
    // 7. FOLLOW-UP REMINDER SERVICES (11:30 AM Alarm & iCalendar / Google Sync)
    // --------------------------------------------------------------------------
    function generateIcsFollowupCalendar(visit) {
        if (!visit || !visit.follow_up_date) return '';

        const bName = visit.business_name || visit.client_name || 'Client';
        const contactName = visit.contact_person_name || 'Client Contact';
        const contactPhone = visit.contact_person_phone || '';
        const repName = visit.sales_rep_name || 'Field Sales Rep';
        const remarks = visit.remarks || '';
        const address = visit.address_option_a || visit.address_option_b || visit.client_address || '';

        // Follow-up Date YYYYMMDD
        const dateParts = String(visit.follow_up_date).split('-');
        if (dateParts.length < 3) return '';
        const dateStr = dateParts.join('');

        // Scheduled specifically for 11:30 AM (113000)
        const dtStart = `${dateStr}T113000`;
        const dtEnd = `${dateStr}T120000`;
        const uid = `saleserp-followup-${visit.id || Date.now()}@saleserp.local`;
        const nowStr = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

        const escapeIcs = (str) => (str || '').replace(/[\\,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n');

        const icsLines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Sales ERP//Field Visit Follow-up 11:30 AM//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'BEGIN:VEVENT',
            `UID:${uid}`,
            `DTSTAMP:${nowStr}`,
            `DTSTART:${dtStart}`,
            `DTEND:${dtEnd}`,
            `SUMMARY:Follow-up Meeting: ${escapeIcs(bName)} (${escapeIcs(contactName)})`,
            `DESCRIPTION:Sales Follow-up Scheduled for 11:30 AM\\nClient: ${escapeIcs(bName)}\\nContact: ${escapeIcs(contactName)} (${escapeIcs(contactPhone)})\\nSales Rep: ${escapeIcs(repName)}\\n\\nRemarks & Notes:\\n${escapeIcs(remarks)}`,
            `LOCATION:${escapeIcs(address)}`,
            'STATUS:CONFIRMED',
            'BEGIN:VALARM',
            'TRIGGER:-PT15M',
            'ACTION:DISPLAY',
            `DESCRIPTION:Sales Follow-up Reminder: ${escapeIcs(bName)} in 15 minutes (11:30 AM)`,
            'END:VALARM',
            'BEGIN:VALARM',
            'TRIGGER:PT0M',
            'ACTION:DISPLAY',
            `DESCRIPTION:Sales Follow-up with ${escapeIcs(bName)} is starting now (11:30 AM)`,
            'END:VALARM',
            'END:VEVENT',
            'END:VCALENDAR'
        ];

        return icsLines.join('\r\n');
    }

    function downloadIcsFile(filename, icsContent) {
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(link.href), 1500);
    }

    function getGoogleCalendarUrl(visit) {
        if (!visit || !visit.follow_up_date) return '#';
        const dateParts = String(visit.follow_up_date).split('-');
        if (dateParts.length < 3) return '#';
        const dateStr = dateParts.join('');

        const start = `${dateStr}T113000`;
        const end = `${dateStr}T120000`;
        const bName = visit.business_name || visit.client_name || 'Client';
        const contactName = visit.contact_person_name || '';
        const phone = visit.contact_person_phone || '';
        const remarks = visit.remarks || '';
        const address = visit.address_option_a || visit.address_option_b || visit.client_address || '';

        const title = `Follow-up: ${bName} (${contactName})`;
        const details = `Sales Follow-up Meeting Scheduled for 11:30 AM\n\nClient: ${bName}\nContact: ${contactName} (${phone})\nSales Rep: ${visit.sales_rep_name || ''}\n\nRemarks:\n${remarks}`;

        return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${end}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(address)}`;
    }

    window.downloadFollowupCalendar = function(visitId) {
        const visit = (State.visits || []).find(v => String(v.id) === String(visitId)) ||
                      (getLocalVisits() || []).find(v => String(v.id) === String(visitId));
        if (!visit || !visit.follow_up_date) {
            alert('No follow-up date found for this visit.');
            return;
        }
        const ics = generateIcsFollowupCalendar(visit);
        const bClean = (visit.business_name || visit.client_name || 'Client').replace(/[^a-zA-Z0-9]/g, '_');
        downloadIcsFile(`Followup_${bClean}_1130AM_${visit.follow_up_date}.ics`, ics);
    };

    window.openGoogleCalendar = function(visitId) {
        const visit = (State.visits || []).find(v => String(v.id) === String(visitId)) ||
                      (getLocalVisits() || []).find(v => String(v.id) === String(visitId));
        if (!visit || !visit.follow_up_date) {
            alert('No follow-up date found for this visit.');
            return;
        }
        const url = getGoogleCalendarUrl(visit);
        window.open(url, '_blank');
    };
    const EMBEDDED_SQL_SCHEMA = `-- Sales ERP Supabase SQL Schema (Updated with Front/Back Visiting Card, Option A & B Address, Pin Code, Email)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.sales_reps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    employee_id VARCHAR(100),
    designation VARCHAR(150) DEFAULT 'Field Sales Representative',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.client_visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sales_rep_id UUID REFERENCES public.sales_reps(id) ON DELETE SET NULL,
    sales_rep_name VARCHAR(255) NOT NULL,
    business_name VARCHAR(255) NOT NULL,
    client_name VARCHAR(255),
    address_option_a TEXT NOT NULL,
    address_option_b TEXT,
    client_address TEXT,
    visit_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    location_address TEXT,
    contact_person_name VARCHAR(255) NOT NULL,
    contact_person_phone VARCHAR(50) NOT NULL,
    contact_person_email VARCHAR(255),
    pincode VARCHAR(20),
    status VARCHAR(50) NOT NULL DEFAULT 'Follow-up Required',
    follow_up_date DATE,
    remarks TEXT,
    visiting_card_front_url TEXT,
    visiting_card_back_url TEXT,
    visiting_card_url TEXT,
    office_photo_url TEXT NOT NULL,
    ocr_raw_text TEXT,
    ocr_extracted_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_visits_sales_rep_id ON public.client_visits(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_visits_visit_time ON public.client_visits(visit_time DESC);
CREATE INDEX IF NOT EXISTS idx_visits_status ON public.client_visits(status);
CREATE INDEX IF NOT EXISTS idx_visits_business_name ON public.client_visits(business_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_visits_unique_business_name ON public.client_visits (LOWER(TRIM(business_name)));

ALTER TABLE public.sales_reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access to sales reps" ON public.sales_reps;
CREATE POLICY "Public access to sales reps" ON public.sales_reps FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access to client visits" ON public.client_visits;
CREATE POLICY "Public access to client visits" ON public.client_visits FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public) VALUES ('visit-photos', 'visit-photos', true) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Public access to visit photos" ON storage.objects;
CREATE POLICY "Public access to visit photos" ON storage.objects FOR ALL TO anon, authenticated USING (bucket_id = 'visit-photos') WITH CHECK (bucket_id = 'visit-photos');`;

    // --------------------------------------------------------------------------
    // 7. APPLICATION STATE & USER SESSION MANAGEMENT
    // --------------------------------------------------------------------------
    const USER_SESSION_STORAGE_KEY = 'sales_erp_active_user_session';
    const ADMIN_PIN_STORAGE_KEY = 'sales_erp_admin_pin';
    const DEFAULT_MANAGER_PIN = '1234';

    function getAdminPin() {
        try {
            return localStorage.getItem(ADMIN_PIN_STORAGE_KEY) || DEFAULT_MANAGER_PIN;
        } catch (e) {
            return DEFAULT_MANAGER_PIN;
        }
    }

    function isPinValid(enteredPin) {
        const clean = (enteredPin || '').trim();
        if (!clean) return false;
        return clean === DEFAULT_MANAGER_PIN || clean === getAdminPin();
    }

    function setAdminPin(newPin) {
        try {
            localStorage.setItem(ADMIN_PIN_STORAGE_KEY, newPin);
            return true;
        } catch (e) {
            return false;
        }
    }

    window.unlockAdminModeNow = function() {
        if (typeof State !== 'undefined') {
            State.isLockedRepPortal = false;
        }
        document.getElementById('managerPinModal')?.classList.add('hidden');
        document.getElementById('userLoginModal')?.classList.add('hidden');
        saveUserSession({
            role: 'manager',
            role_type: 'manager',
            id: 'admin',
            name: 'Manager / Admin',
            employee_id: 'MGR-01',
            designation: 'Sales Director',
            phone: ''
        });
        loadAndRenderVisits();
        renderSalesTeamSettings();
        alert('👑 Admin Mode Unlocked Successfully!\n\nYou now have full Executive Admin privileges. All features, team management, and Supabase cloud sync are unlocked.');
    };

    // Role helper predicates
    function isSalesRep(u) {
        if (typeof State !== 'undefined' && State.isLockedRepPortal) return true;
        const user = u || (typeof State !== 'undefined' ? State.currentUser : null);
        if (!user) return false;
        return user.role === 'sales_rep' || user.role === 'rep' || user.role_type === 'sales_rep';
    }

    function isSrSalesRep(u) {
        if (typeof State !== 'undefined' && State.isLockedRepPortal) return false;
        const user = u || (typeof State !== 'undefined' ? State.currentUser : null);
        if (!user) return false;
        return user.role === 'sr_sales_rep' || user.role_type === 'sr_sales_rep';
    }

    function isExecutiveAdmin(u) {
        if (typeof State !== 'undefined' && State.isLockedRepPortal) return false;
        const user = u || (typeof State !== 'undefined' ? State.currentUser : null);
        if (!user) return false;
        return user.role === 'manager' || user.role === 'admin' || user.role_type === 'manager' || user.role_type === 'admin';
    }

    function isManagerOrAdmin(u) {
        if (typeof State !== 'undefined' && State.isLockedRepPortal) return false;
        const user = u || (typeof State !== 'undefined' ? State.currentUser : null);
        if (!user) return false;
        return isExecutiveAdmin(user) || isSrSalesRep(user);
    }

    function hasAllFunctionsAccess(u) {
        if (typeof State !== 'undefined' && State.isLockedRepPortal) return false;
        return isSrSalesRep(u) || isManagerOrAdmin(u);
    }

    const State = {
        currentTab: 'new-visit',
        isLockedRepPortal: false,
        repNotFoundNotice: null,
        currentUser: {
            role: 'sr_sales_rep', // 'sales_rep', 'sr_sales_rep', or 'manager'
            role_type: 'sr_sales_rep',
            id: 'rep-001',
            name: 'Kapil Todi',
            employee_id: 'EMP-101',
            designation: 'Sr. Sales Rep',
            phone: '+91 97696 61978'
        },
        salesTeam: [],
        visits: [],
        allVisitsCache: [],
        commonAccountsMap: new Map(),
        selectedGps: null,
        gpsAddress: '',
        visitingCardFrontFile: null,
        visitingCardBackFile: null,
        officePhotoFile: null,
        isBusinessNameDuplicate: false,
        extractedOcrData: {
            companyName: '',
            contactPerson: '',
            phone: '',
            email: '',
            pincode: '',
            address: ''
        },
        ocrRawText: '',
        misSelectedPeriod: 'ALL'
    };
    window.State = State;

    function initLucideIcons() {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    // --------------------------------------------------------------------------
    // USER SESSION & ACCESS CONTROL
    // --------------------------------------------------------------------------
    function guardAgainstLockedRep(actionDesc) {
        if (typeof State !== 'undefined' && State.isLockedRepPortal) {
            const adminUrl = window.location.origin + window.location.pathname;
            const goToAdmin = confirm(`🔒 Dedicated Sales Rep Portal\n\nThis portal is permanently locked to ${State.currentUser?.name || 'your sales account'}.\n\nUser switching and ${actionDesc} are disabled on sales representative links.\n\nWould you like to open the Sr. Sales Rep Admin Portal?`);
            if (goToAdmin) {
                window.location.href = adminUrl;
            }
            return true;
        }
        return false;
    }

    window.guardAgainstLockedRep = guardAgainstLockedRep;

    window.handleActiveUserPillClick = function() {
        if (guardAgainstLockedRep('User Switching / Manager Mode')) return;
        window.openUserLoginModal();
    };

    function getUrlQueryParam(paramName) {
        if (typeof window !== 'undefined' && window.location) {
            if (typeof URLSearchParams !== 'undefined') {
                try {
                    const params = new URLSearchParams(window.location.search);
                    const val = params.get(paramName);
                    if (val !== null) return val;
                } catch (e) {}
            }
            const search = window.location.search || '';
            const match = search.match(new RegExp('[?&]' + paramName + '=([^&#]*)', 'i'));
            return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : null;
        }
        return null;
    }

    function resolveRepFromQuery(paramValue, team) {
        if (!paramValue || !Array.isArray(team) || team.length === 0) return null;

        const raw = String(paramValue).trim();
        const clean = raw.toLowerCase();
        const cleanNoPrefix = clean.replace(/^(rep[-_]?|emp[-_]?|id[-_]?)/, '');
        const cleanDigits = clean.replace(/\D/g, '');

        const regularReps = team.filter(m => m.role_type === 'sales_rep');

        // Priority Tier 0: Direct match for Kapil Todi / Sr. Sales Rep / Admin
        if (
            clean === 'kapil' ||
            clean === 'kapiltodi' ||
            clean === 'kapil todi' ||
            clean === 'admin' ||
            clean === 'sr' ||
            clean === 'sr_sales_rep' ||
            clean === 'sr-sales-rep' ||
            clean === 'sr rep' ||
            clean === 'sr-rep' ||
            clean === 'rep-001' ||
            clean === 'rep-1' ||
            clean === 'rep1' ||
            clean === 'emp-101' ||
            clean === '001' ||
            clean === '101'
        ) {
            const found = team.find(m => (m.name && m.name.toLowerCase().includes('kapil')) || m.role_type === 'sr_sales_rep' || m.id === 'rep-001' || m.employee_id === 'EMP-101');
            return {
                id: found?.id || 'rep-001',
                name: 'Kapil Todi',
                employee_id: found?.employee_id || 'EMP-101',
                role: 'sr_sales_rep',
                role_type: 'sr_sales_rep',
                designation: 'Sr. Sales Rep',
                phone: found?.phone || '+91 97696 61978',
                email: found?.email || 'kapil@example.com'
            };
        }

        // Priority Tier 0: Direct match for Rep 1 / Supriya Yadav
        if (
            clean === 'supriya' ||
            clean === 'supriya yadav' ||
            clean === 'priya' ||
            clean === 'sales rep 1' ||
            clean === 'sales-rep-1' ||
            clean === 'sales_rep_1' ||
            clean === 'rep 1' ||
            clean === 'rep-1' ||
            clean === 'rep1' ||
            clean === '1' ||
            clean === '002' ||
            clean === 'rep-002' ||
            clean === 'emp-102'
        ) {
            const found = team.find(m => (m.name && m.name.toLowerCase().includes('supriya')) || m.id === 'rep-002' || m.employee_id === 'EMP-102') || regularReps[0];
            if (found) return { ...found, name: 'Supriya Yadav', employee_id: 'EMP-102', role_type: 'sales_rep', designation: 'Sales Rep' };
        }

        // Priority Tier 0: Direct match for Rep 2 / Kalyani Mundada
        if (
            clean === 'kalyani' ||
            clean === 'kalyani mundada' ||
            clean === 'amit' ||
            clean === 'sales rep 2' ||
            clean === 'sales-rep-2' ||
            clean === 'sales_rep_2' ||
            clean === 'rep 2' ||
            clean === 'rep-2' ||
            clean === 'rep2' ||
            clean === '2' ||
            clean === '003' ||
            clean === 'rep-003' ||
            clean === 'emp-103'
        ) {
            const found = team.find(m => (m.name && m.name.toLowerCase().includes('kalyani')) || m.id === 'rep-003' || m.employee_id === 'EMP-103') || regularReps[1] || regularReps[0];
            if (found) return { ...found, name: 'Kalyani Mundada', employee_id: 'EMP-103', role_type: 'sales_rep', designation: 'Sales Rep' };
        }

        // Tier 1: Exact ID match (case-insensitive)
        let matched = team.find(m => m.id && m.id.toLowerCase() === clean);
        if (matched) return matched;

        // Tier 2: Exact Employee ID match (case-insensitive)
        matched = team.find(m => m.employee_id && m.employee_id.toLowerCase() === clean);
        if (matched) return matched;

        // Tier 3: Stripped prefix match (e.g. '002' matches 'rep-002' or 'EMP-102')
        if (cleanNoPrefix) {
            matched = team.find(m => {
                const mIdNoPrefix = (m.id || '').toLowerCase().replace(/^(rep[-_]?|emp[-_]?|id[-_]?)/, '');
                const mEmpNoPrefix = (m.employee_id || '').toLowerCase().replace(/^(rep[-_]?|emp[-_]?|id[-_]?)/, '');
                return (mIdNoPrefix && mIdNoPrefix === cleanNoPrefix) || (mEmpNoPrefix && mEmpNoPrefix === cleanNoPrefix);
            });
            if (matched) return matched;
        }

        // Tier 4: Exact Name match (case-insensitive)
        matched = team.find(m => m.name && m.name.toLowerCase() === clean);
        if (matched) return matched;

        // Tier 5: Substring / Word / First-name match
        matched = team.find(m => {
            if (!m.name) return false;
            const mName = m.name.toLowerCase();
            const mFirstWord = mName.split(/\s+/)[0];
            const cleanFirstWord = clean.split(/\s+/)[0];
            return mName.includes(clean) || clean.includes(mName) ||
                   (cleanFirstWord && cleanFirstWord.length >= 3 && mFirstWord === cleanFirstWord);
        });
        if (matched) return matched;

        // Tier 6: Pure digit matching (e.g. '002' or '2' matching 'rep-002' or 'EMP-102')
        if (cleanDigits) {
            matched = team.find(m => {
                const mIdDigits = (m.id || '').replace(/\D/g, '');
                const mEmpDigits = (m.employee_id || '').replace(/\D/g, '');
                return (mIdDigits && (mIdDigits === cleanDigits || mIdDigits.endsWith(cleanDigits))) ||
                       (mEmpDigits && (mEmpDigits === cleanDigits || mEmpDigits.endsWith(cleanDigits)));
            });
            if (matched) return matched;
        }

        // Tier 7: Positional Slot Fallback for legacy demo links
        if (regularReps.length > 0) {
            if (clean === 'rep-002' || clean === 'rep-2' || clean === '2' || clean === '002' || clean === 'emp-102' || clean === '102' || clean.includes('priya') || clean.includes('supriya')) {
                return regularReps[0];
            }
            if (clean === 'rep-003' || clean === 'rep-3' || clean === '3' || clean === '003' || clean === 'emp-103' || clean === '103' || clean.includes('amit') || clean.includes('kalyani')) {
                return regularReps[1] || regularReps[0];
            }
            if (clean === 'rep-004' || clean === 'rep-4' || clean === '4' || clean === '004' || clean === 'emp-104' || clean === '104') {
                return regularReps[2] || regularReps[regularReps.length - 1];
            }
        }

        return null;
    }

    function initUserSession() {
        // Check for dedicated Sales Rep Portal URL parameter (?rep=rep-002, ?rep_id=..., ?emp=...)
        const repParam = getUrlQueryParam('rep') || getUrlQueryParam('rep_id') || getUrlQueryParam('emp') || getUrlQueryParam('id');
        const adminParam = getUrlQueryParam('admin');
        const roleParam = getUrlQueryParam('role');

        const allTeam = (State.salesTeam && State.salesTeam.length) ? State.salesTeam : getLocalTeam();

        const cleanRep = (repParam || '').trim().toLowerCase();
        const isExplicitAdminQuery = adminParam === '1' || adminParam === 'true' || 
                                     roleParam === 'admin' || roleParam === 'sr_sales_rep' || roleParam === 'sr' ||
                                     cleanRep === 'admin' || cleanRep === 'kapil' || cleanRep === 'kapiltodi' || 
                                     cleanRep === 'kapil todi' || cleanRep === 'sr' || cleanRep === 'sr_sales_rep' || 
                                     cleanRep === 'sr-sales-rep' || cleanRep === 'rep-001' || cleanRep === 'emp-101' || 
                                     cleanRep === '001' || cleanRep === '101';

        if (isExplicitAdminQuery) {
            // Explicit Admin query (e.g. ?rep=Kapil, ?admin=1, ?role=admin)
            State.isLockedRepPortal = false;
            State.repNotFoundNotice = null;
            const srRep = allTeam.find(m => m.role_type === 'sr_sales_rep' || (m.name && m.name.toLowerCase().includes('kapil'))) || allTeam[0];
            State.currentUser = {
                id: srRep?.id || 'rep-001',
                name: 'Kapil Todi',
                employee_id: srRep?.employee_id || 'EMP-101',
                role: 'sr_sales_rep',
                role_type: 'sr_sales_rep',
                designation: 'Sr. Sales Rep',
                phone: srRep?.phone || '+91 97696 61978',
                email: srRep?.email || 'kapil@example.com'
            };
            try {
                localStorage.setItem(USER_SESSION_STORAGE_KEY, JSON.stringify(State.currentUser));
            } catch (e) {}
            console.log('SalesERP: Explicit Sr. Sales Rep Admin link activated for Kapil Todi');
        } else if (repParam) {
            // Dedicated regular sales rep link (?rep=Supriya, ?rep=Kalyani)
            const matched = resolveRepFromQuery(repParam, allTeam);

            if (matched) {
                const isRegularRep = matched.role_type === 'sales_rep';
                const cleanName = sanitizeRepName(matched.name, matched.employee_id, matched.id);
                State.currentUser = {
                    role: matched.role_type || (isRegularRep ? 'sales_rep' : 'sr_sales_rep'),
                    role_type: matched.role_type || (isRegularRep ? 'sales_rep' : 'sr_sales_rep'),
                    id: matched.id,
                    name: cleanName,
                    employee_id: matched.employee_id || (cleanName === 'Supriya Yadav' ? 'EMP-102' : (cleanName === 'Kalyani Mundada' ? 'EMP-103' : 'EMP-101')),
                    designation: matched.designation || (isRegularRep ? 'Sales Rep' : 'Sr. Sales Rep'),
                    phone: matched.phone || ''
                };
                State.isLockedRepPortal = isRegularRep;
                State.repNotFoundNotice = null;
                console.log(`SalesERP: Dedicated portal active for ${cleanName} (isLockedRepPortal = ${isRegularRep})`);
            } else {
                console.warn(`SalesERP: Rep ID "${repParam}" not found in team directory.`);
                State.isLockedRepPortal = true;
                const cleanParam = String(repParam).toLowerCase();
                const isRep2 = cleanParam.includes('2') || cleanParam.includes('kalyani') || cleanParam.includes('amit');
                const cleanName = isRep2 ? 'Kalyani Mundada' : 'Supriya Yadav';
                const cleanEmpId = isRep2 ? 'EMP-103' : 'EMP-102';
                State.currentUser = {
                    role: 'sales_rep',
                    role_type: 'sales_rep',
                    id: isRep2 ? 'rep-003' : 'rep-002',
                    name: cleanName,
                    employee_id: cleanEmpId,
                    designation: 'Sales Rep',
                    phone: ''
                };
                State.repNotFoundNotice = null;
            }
        } else {
            // BASE URL WITHOUT ANY QUERY PARAMETERS:
            // https://kapiltodi-a11y.github.io/sales-erp/
            // This is the default Admin / Sr. Sales Rep portal for Kapil Todi.
            State.isLockedRepPortal = false;
            State.repNotFoundNotice = null;
            let userToSet = null;

            try {
                const stored = localStorage.getItem(USER_SESSION_STORAGE_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    // If user was previously in Manager / Director mode via PIN 1234, preserve it
                    if (parsed && (parsed.role === 'manager' || parsed.id === 'admin')) {
                        userToSet = parsed;
                    }
                }
            } catch (e) {}

            if (!userToSet) {
                // Default unconditionally to Kapil Todi (Sr. Sales Rep Admin)
                const srRep = allTeam.find(m => m.role_type === 'sr_sales_rep' || (m.name && m.name.toLowerCase().includes('kapil'))) || allTeam[0];
                userToSet = {
                    id: srRep?.id || 'rep-001',
                    name: 'Kapil Todi',
                    employee_id: srRep?.employee_id || 'EMP-101',
                    role: 'sr_sales_rep',
                    role_type: 'sr_sales_rep',
                    designation: 'Sr. Sales Rep',
                    phone: srRep?.phone || '+91 97696 61978',
                    email: srRep?.email || 'kapil@example.com'
                };
            }

            State.currentUser = userToSet;
            try {
                localStorage.setItem(USER_SESSION_STORAGE_KEY, JSON.stringify(userToSet));
            } catch (e) {}
            console.log(`SalesERP: Base URL initialized as ${userToSet.name} (${userToSet.designation || userToSet.role})`);
        }

        updateUserSessionUI();
        setupUserLoginModal();
        setupManagerPinModal();
        setupMisReportModal();
    }
    window.initUserSession = initUserSession;

    function saveUserSession(user) {
        State.currentUser = user;
        try {
            localStorage.setItem(USER_SESSION_STORAGE_KEY, JSON.stringify(user));
        } catch (e) {}
        updateUserSessionUI();
    }

    function updateUserSessionUI() {
        const u = State.currentUser;
        const cleanName = sanitizeRepName(u?.name, u?.employee_id, u?.id);
        const isRep = isSalesRep(u);
        const isSr = isSrSalesRep(u);
        const isAdmin = isManagerOrAdmin(u);
        const isLocked = Boolean(State.isLockedRepPortal);

        // 1. NAVIGATION PERMISSIONS (STRICT 2-TIER ARCHITECTURE):
        // Part 1: Admin (Sr. Sales Rep) -> Full access to all 5 navigation areas & Admin Panel
        // Part 2: Sales Team (regular Sales Reps) -> STRICTLY ONLY New Visit & Dashboard
        const tabBtnMisDesk = document.getElementById('tabBtnMisDesk');
        const tabBtnMisMob = document.getElementById('tabBtnMisMob');
        const tabBtnSettingsDesk = document.getElementById('tabBtnSettingsDesk');
        const tabBtnSettingsMob = document.getElementById('tabBtnSettingsMob');
        const tabBtnAdminDesk = document.getElementById('tabBtnAdminDesk');
        const tabBtnAdminMob = document.getElementById('tabBtnAdminMob');
        const headerAdminPanelBtn = document.getElementById('headerAdminPanelBtn');
        const switchUserFormBtn = document.getElementById('switchUserFormBtn');
        const activeUserPillBtn = document.getElementById('activeUserPillBtn');
        const activeUserChevron = document.getElementById('activeUserChevron');

        const viewMisReportBtn = document.getElementById('viewMisReportBtn');
        const repNoticeBanner = document.getElementById('repPortalNoticeBanner');

        if (isLocked) {
            // DEDICATED LOCKED SALES REP PORTAL (?rep=Supriya, ?rep=Kalyani):
            // Strictly hide MIS Report, Settings, Admin Panel buttons & Switch User form button
            if (tabBtnMisDesk) tabBtnMisDesk.classList.add('hidden');
            if (tabBtnMisMob) tabBtnMisMob.classList.add('hidden');
            if (tabBtnSettingsDesk) tabBtnSettingsDesk.classList.add('hidden');
            if (tabBtnSettingsMob) tabBtnSettingsMob.classList.add('hidden');
            if (tabBtnAdminDesk) tabBtnAdminDesk.classList.add('hidden');
            if (tabBtnAdminMob) tabBtnAdminMob.classList.add('hidden');
            if (headerAdminPanelBtn) headerAdminPanelBtn.classList.add('hidden');
            if (switchUserFormBtn) switchUserFormBtn.classList.add('hidden');
            if (viewMisReportBtn) viewMisReportBtn.classList.add('hidden');

            // Defensive redirect: If rep is on any restricted tab, strictly redirect to New Visit
            if (State.currentTab !== 'new-visit' && State.currentTab !== 'visits') {
                switchTab('new-visit');
            }
        } else if (isRep) {
            // Unlocked portal viewing as sales rep (e.g. testing or previewing on admin device):
            if (tabBtnMisDesk) tabBtnMisDesk.classList.add('hidden');
            if (tabBtnMisMob) tabBtnMisMob.classList.add('hidden');
            if (tabBtnSettingsDesk) tabBtnSettingsDesk.classList.add('hidden');
            if (tabBtnSettingsMob) tabBtnSettingsMob.classList.add('hidden');
            if (tabBtnAdminDesk) tabBtnAdminDesk.classList.add('hidden');
            if (tabBtnAdminMob) tabBtnAdminMob.classList.add('hidden');
            if (viewMisReportBtn) viewMisReportBtn.classList.add('hidden');
            // Keep Admin Panel button visible so admin can immediately return to Admin mode!
            if (headerAdminPanelBtn) {
                headerAdminPanelBtn.classList.remove('hidden');
                headerAdminPanelBtn.className = 'px-3 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm ring-2 ring-purple-300 transition-all';
                headerAdminPanelBtn.innerHTML = `<i data-lucide="shield-check" class="w-4 h-4 text-amber-300"></i><span class="hidden sm:inline">Admin Panel</span>`;
            }
            if (switchUserFormBtn) switchUserFormBtn.classList.remove('hidden');

            if (State.currentTab !== 'new-visit' && State.currentTab !== 'visits') {
                switchTab('new-visit');
            }
        } else {
            // ADMIN / SR. SALES REP (Kapil Todi) / MANAGER: Full access to all tabs
            if (viewMisReportBtn) viewMisReportBtn.classList.remove('hidden');
            if (tabBtnMisDesk) tabBtnMisDesk.classList.remove('hidden');
            if (tabBtnMisMob) tabBtnMisMob.classList.remove('hidden');
            if (tabBtnSettingsDesk) tabBtnSettingsDesk.classList.remove('hidden');
            if (tabBtnSettingsMob) tabBtnSettingsMob.classList.remove('hidden');
            if (tabBtnAdminDesk) {
                tabBtnAdminDesk.classList.remove('hidden');
                tabBtnAdminDesk.classList.add('bg-purple-100', 'text-purple-900');
            }
            if (tabBtnAdminMob) tabBtnAdminMob.classList.remove('hidden');
            if (headerAdminPanelBtn) {
                headerAdminPanelBtn.classList.remove('hidden');
                headerAdminPanelBtn.className = 'px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm ring-2 ring-purple-300 transition-all';
                headerAdminPanelBtn.innerHTML = `<i data-lucide="shield-check" class="w-4 h-4 text-amber-300"></i><span class="hidden sm:inline">Admin Panel</span><span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>`;
            }
            if (switchUserFormBtn) switchUserFormBtn.classList.remove('hidden');
        }

        // 2. SETTINGS VIEW PERMISSIONS:
        // Supabase cloud database configuration is ALWAYS accessible on the Settings page
        const supabaseSettingsCard = document.getElementById('supabaseSettingsCard');
        const supabaseLockedNotice = document.getElementById('supabaseLockedNotice');

        if (supabaseSettingsCard) {
            supabaseSettingsCard.classList.remove('hidden');
        }
        if (supabaseLockedNotice) {
            supabaseLockedNotice.classList.add('hidden');
        }

        // 3. HEADER ACTIVE USER PILL
        const avatar = document.getElementById('activeUserAvatar');
        const nameText = document.getElementById('activeUserNameText');
        const roleBadge = document.getElementById('activeUserRoleBadge');

        if (activeUserPillBtn) {
            if (isLocked) {
                activeUserPillBtn.classList.remove('hover:bg-slate-100', 'cursor-pointer');
                activeUserPillBtn.classList.add('cursor-default');
                activeUserPillBtn.setAttribute('title', `Dedicated Sales Portal for ${cleanName} (Locked to your account)`);
                if (activeUserChevron) activeUserChevron.classList.add('hidden');
            } else {
                activeUserPillBtn.classList.add('hover:bg-slate-100', 'cursor-pointer');
                activeUserPillBtn.classList.remove('cursor-default');
                activeUserPillBtn.setAttribute('title', 'Switch User / Manager Mode');
                if (activeUserChevron) activeUserChevron.classList.remove('hidden');
            }
        }

        if (avatar) {
            if (isAdmin && !isLocked) {
                avatar.textContent = '🛡️';
                avatar.className = 'w-7 h-7 rounded-lg bg-purple-700 text-white flex items-center justify-center font-bold text-xs shadow-sm ring-1 ring-purple-300';
            } else {
                avatar.textContent = (cleanName || 'SR').slice(0, 2).toUpperCase();
                avatar.className = 'w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm';
            }
        }
        if (nameText) {
            if (isLocked) {
                nameText.textContent = cleanName;
            } else {
                nameText.textContent = isAdmin ? (cleanName ? `${cleanName} (Admin)` : 'Sr. Sales Rep') : cleanName;
            }
        }
        if (roleBadge) {
            if (isLocked) {
                roleBadge.textContent = '🔒 Personal Portal (Private)';
                roleBadge.className = 'inline-block text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200';
            } else if (isAdmin) {
                roleBadge.textContent = '👑 Admin (Sr. Sales Rep) • Full Access';
                roleBadge.className = 'inline-block text-[10px] text-purple-700 font-bold';
            } else {
                roleBadge.textContent = `👤 ${u.designation || 'Sales Rep'} (Private Mode)`;
                roleBadge.className = 'inline-block text-[10px] text-blue-600 font-medium';
            }
        }

        // 4. DASHBOARD TITLES & PRIVACY MODE
        const dTitle = document.getElementById('dashboardViewTitle');
        const dSub = document.getElementById('dashboardViewSubtitle');
        const exportBtnText = document.getElementById('exportExcelBtnText');
        const totalLabel = document.getElementById('statTotalVisitsLabel');

        if (dTitle) {
            if (isLocked || isRep) {
                dTitle.innerHTML = `My Sales Visits <span id="privacyModeBadge" class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">🔒 Private Rep Mode</span>`;
            } else {
                dTitle.innerHTML = `Sales Visits Overview <span id="privacyModeBadge" class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-200">👑 Admin Mode (All Reps)</span>`;
            }
        }
        if (dSub) {
            if (isLocked || isRep) {
                dSub.textContent = `Viewing only visits and remarks for ${cleanName}. Other sales reps cannot see your records.`;
            } else {
                dSub.textContent = 'Full visibility across all sales representatives, visits, common accounts, and team reports';
            }
        }
        if (exportBtnText) {
            exportBtnText.textContent = hasAllFunctionsAccess(u) && !isLocked ? 'Download All Visits (.xlsx)' : 'Download My Visits (.xlsx)';
        }
        if (totalLabel) {
            totalLabel.textContent = hasAllFunctionsAccess(u) && !isLocked ? 'All team visits' : 'Your recorded visits';
        }

        // 5. DASHBOARD SALES REP FILTER DROPDOWN
        const salesRepSelect = document.getElementById('filterSalesRep');
        const filterLockBadge = document.getElementById('salesRepFilterLockBadge');
        if (salesRepSelect) {
            if (isRep || isLocked) {
                salesRepSelect.value = u.id;
                salesRepSelect.disabled = true;
                salesRepSelect.classList.add('cursor-not-allowed', 'opacity-80', 'bg-slate-100');
                if (filterLockBadge) filterLockBadge.classList.remove('hidden');
            } else {
                salesRepSelect.disabled = false;
                salesRepSelect.classList.remove('cursor-not-allowed', 'opacity-80', 'bg-slate-100');
                if (filterLockBadge) filterLockBadge.classList.add('hidden');
                // Ensure default for Admin is ALL so all team members' visits are visible
                if (!salesRepSelect.value || salesRepSelect.value === u.id || isRep) {
                    salesRepSelect.value = 'ALL';
                }
            }
        }

        // 6. NEW VISIT FORM REP SELECT & BANNER
        const newVisitRepSelect = document.getElementById('salesRepSelect');
        const repLockHint = document.getElementById('salesRepLockHint');
        if (newVisitRepSelect) {
            newVisitRepSelect.value = u.id;
            if (newVisitRepSelect.value !== u.id && u.id) {
                const opt = document.createElement('option');
                opt.value = u.id;
                opt.textContent = `${cleanName} (${u.employee_id || 'Rep'})`;
                newVisitRepSelect.appendChild(opt);
                newVisitRepSelect.value = u.id;
            }
            if (isRep || isLocked) {
                newVisitRepSelect.disabled = true;
                newVisitRepSelect.classList.add('bg-slate-100', 'cursor-not-allowed');
                if (repLockHint) {
                    repLockHint.innerHTML = `<i data-lucide="lock" class="w-3.5 h-3.5 text-blue-200"></i><span>Personal Portal locked to <strong>${escapeHtml(cleanName)}</strong>. Visits are private to your account.</span>`;
                    repLockHint.classList.remove('hidden');
                }
            } else {
                newVisitRepSelect.disabled = false;
                newVisitRepSelect.classList.remove('bg-slate-100', 'cursor-not-allowed');
                if (repLockHint) {
                    repLockHint.innerHTML = `<i data-lucide="shield-check" class="w-3.5 h-3.5 text-amber-300"></i><span><strong>Admin Mode</strong>: Recording visit as <strong>${escapeHtml(cleanName)}</strong> (or select another rep from dropdown).</span>`;
                    repLockHint.classList.remove('hidden');
                }
            }
        }

        // 7. REP PORTAL NOTICE BANNER
        if (repNoticeBanner) {
            if (State.repNotFoundNotice) {
                repNoticeBanner.className = 'p-4 bg-amber-50 border border-amber-300 rounded-2xl text-amber-900 text-xs flex items-start gap-3 shadow-xs';
                repNoticeBanner.innerHTML = `
                    <div class="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-bold">
                        ⚠️
                    </div>
                    <div class="space-y-1">
                        <p class="font-bold text-amber-950">Personal Link "${escapeHtml(State.repNotFoundNotice)}" Not Found in Active Team</p>
                        <p class="text-[11px] text-amber-800 leading-relaxed">This personal link does not match any current sales representative (the rep may have been renamed or reassigned). The app is operating in <strong>Secure Restricted Sales Rep Mode</strong>. User switching and Admin panels are permanently blocked.</p>
                        <p class="text-[11px] text-amber-900 font-semibold mt-1">Sr. Sales Rep: Please copy your current personal links from <strong>Settings &rarr; Dedicated Sales Rep Portal Links</strong>.</p>
                    </div>
                `;
                repNoticeBanner.classList.remove('hidden');
            } else if (isLocked) {
                repNoticeBanner.className = 'p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs flex items-center justify-between gap-2 shadow-xs';
                repNoticeBanner.innerHTML = `
                    <div class="flex items-center gap-2">
                        <div class="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 text-xs">
                            🔒
                        </div>
                        <span class="font-semibold text-emerald-950">Personal Portal locked to <strong>${escapeHtml(cleanName)}</strong> (${escapeHtml(u.employee_id || (cleanName === 'Supriya Yadav' ? 'EMP-102' : (cleanName === 'Kalyani Mundada' ? 'EMP-103' : 'Sales Rep')))})</span>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                        <span class="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">Private Link Active</span>
                        <a href="${window.location.origin}${window.location.pathname}" class="text-[10px] text-emerald-800 hover:text-emerald-950 font-bold underline ml-1" title="Go to Sr. Sales Rep Admin Portal">Admin Login</a>
                    </div>
                `;
                repNoticeBanner.classList.remove('hidden');
            } else {
                repNoticeBanner.classList.add('hidden');
            }
        }

        updateCloudSyncBanner();
        initLucideIcons();
    }

    // --------------------------------------------------------------------------
    // DEDICATED SALES REP PORTAL LINKS SERVICE
    // --------------------------------------------------------------------------
    window.getRepPortalUrl = function(rep) {
        const cleanBase = window.location.href.split('?')[0].split('#')[0];
        let slug = 'rep';
        const team = (typeof State !== 'undefined' && State.salesTeam && State.salesTeam.length) ? State.salesTeam : getLocalTeam();

        if (typeof rep === 'object' && rep !== null) {
            const rName = (rep.name || '').toLowerCase();
            const rId = (rep.id || '').toLowerCase();
            const rEmp = (rep.employee_id || '').toLowerCase();
            if (rId === 'rep-001' || rEmp === 'emp-101' || rName.includes('kapil') || rep.role_type === 'sr_sales_rep') {
                return cleanBase;
            } else if (rId === 'rep-002' || rEmp === 'emp-102' || rName.includes('supriya') || rName.includes('priya') || rName.includes('sales rep 1') || rName.includes('rep 1')) {
                slug = 'Supriya';
            } else if (rId === 'rep-003' || rEmp === 'emp-103' || rName.includes('kalyani') || rName.includes('amit') || rName.includes('sales rep 2') || rName.includes('rep 2')) {
                slug = 'Kalyani';
            } else if (rep.name) {
                slug = sanitizeRepName(rep.name, rep.employee_id, rep.id).split(/\s+/)[0];
            } else {
                slug = rep.id || 'rep';
            }
        } else if (typeof rep === 'string') {
            const clean = rep.toLowerCase();
            if (clean === 'rep-001' || clean === 'emp-101' || clean.includes('kapil') || clean === 'admin' || clean === 'sr') {
                return cleanBase;
            } else if (clean === 'rep-002' || clean.includes('supriya') || clean === 'emp-102' || clean.includes('sales rep 1') || clean.includes('rep 1') || clean === '1') {
                slug = 'Supriya';
            } else if (clean === 'rep-003' || clean.includes('kalyani') || clean === 'emp-103' || clean.includes('sales rep 2') || clean.includes('rep 2') || clean === '2') {
                slug = 'Kalyani';
            } else {
                const member = team.find(m => m.id === rep || m.employee_id === rep || (m.name && m.name.toLowerCase().includes(clean)));
                if (member && (member.role_type === 'sr_sales_rep' || (member.name && member.name.toLowerCase().includes('kapil')))) {
                    return cleanBase;
                } else if (member && member.name) {
                    slug = sanitizeRepName(member.name, member.employee_id, member.id).split(/\s+/)[0];
                } else {
                    slug = rep;
                }
            }
        }
        return `${cleanBase}?rep=${encodeURIComponent(slug)}`;
    };

    window.getSalesTeamLinks = function() {
        const team = (State.salesTeam && State.salesTeam.length) ? State.salesTeam : getLocalTeam();
        const results = team.map(m => {
            const isRegularRep = m.role_type === 'sales_rep';
            const portalUrl = window.getRepPortalUrl(m.id);
            return {
                name: m.name,
                role: m.designation || (isRegularRep ? 'Sales Rep' : 'Sr. Sales Rep'),
                employee_id: m.employee_id || '',
                id: m.id,
                is_locked_portal: isRegularRep,
                portal_url: portalUrl
            };
        });
        console.table(results);
        return results;
    };

    window.copyRepPortalLink = function(repId, repName) {
        const url = window.getRepPortalUrl(repId);
        const isSr = repId === 'rep-001' || (repName && (repName.toLowerCase().includes('kapil') || repName.toLowerCase().includes('admin')));
        const titleMsg = isSr ? 'Admin Portal Link Copied' : 'Dedicated Portal Link Copied';
        const noteMsg = isSr
            ? 'This is the main administrative link with full access to all ERP features (Visits, MIS Reports, Settings, Admin Panel).'
            : `Send this unique link to ${repName}. When they open it, user-switching and admin features will be permanently disabled.`;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(() => {
                alert(`📋 ${titleMsg}!\n\nUser: ${repName}\nLink: ${url}\n\n${noteMsg}`);
            }).catch(() => {
                window.prompt(`Copy portal link for ${repName}:`, url);
            });
        } else {
            window.prompt(`Copy portal link for ${repName}:`, url);
        }
    };

    window.shareRepLinkWhatsapp = function(repId, repName, phone) {
        const url = window.getRepPortalUrl(repId);
        const isSr = repId === 'rep-001' || (repName && (repName.toLowerCase().includes('kapil') || repName.toLowerCase().includes('admin')));
        const message = isSr
            ? `Hello ${repName},\n\nHere is the Admin Portal link for Field Sales ERP:\n${url}\n\nFull administrative access enabled.`
            : `Hello ${repName},\n\nHere is your private link for the Field Sales ERP:\n${url}\n\nPlease bookmark this link on your phone. You can log all your client visits directly here.\n\nNote: This link is unique and private to your account.`;

        const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
        const waUrl = cleanPhone && cleanPhone.length >= 10
            ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
            : `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(waUrl, '_blank');
    };

    window.renderRepPortalLinks = function() {
        const container = document.getElementById('repPortalLinksContainer');
        if (!container) return;

        const rawTeam = (State.salesTeam && State.salesTeam.length) ? State.salesTeam : getLocalTeam();
        const team = deduplicateAndCleanTeam(rawTeam);
        const cleanBaseUrl = window.location.href.split('?')[0].split('#')[0];

        const srMember = team.find(m => m.role_type === 'sr_sales_rep' || (m.name && m.name.toLowerCase().includes('kapil'))) || {
            id: 'rep-001',
            name: 'Kapil Todi',
            employee_id: 'EMP-101',
            designation: 'Sr. Sales Rep',
            phone: '+91 97696 61978'
        };
        const salesReps = team.filter(m => m.role_type === 'sales_rep');

        const srName = escapeHtml(srMember.name || 'Kapil Todi');
        const srEmpId = escapeHtml(srMember.employee_id || 'EMP-101');
        const srPhone = escapeHtml(srMember.phone || '+91 97696 61978');

        const srCardHtml = `
            <div class="p-3.5 bg-gradient-to-r from-purple-50 via-indigo-50/50 to-purple-50 rounded-xl border-2 border-purple-300 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                <div class="min-w-0 flex items-center space-x-3">
                    <div class="w-9 h-9 rounded-xl bg-purple-700 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs ring-1 ring-purple-300">
                        🛡️
                    </div>
                    <div class="min-w-0">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <h4 class="text-xs font-bold text-purple-950 truncate">${srName}</h4>
                            <span class="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.2 rounded-full border border-purple-200">👑 Sr. Sales Rep (Admin)</span>
                            <span class="text-[10px] font-mono bg-purple-50 text-purple-700 px-1.5 py-0.2 rounded border border-purple-100">${srEmpId}</span>
                            ${srPhone ? `<span class="text-[10px] text-slate-500 font-mono">📱 ${srPhone}</span>` : ''}
                        </div>
                        <div class="flex items-center gap-1 mt-1">
                            <input type="text" readonly value="${cleanBaseUrl}" onclick="this.select()" class="text-[11px] font-mono bg-white text-purple-900 border border-purple-200 rounded-lg px-2 py-1 w-full max-w-md select-all cursor-pointer truncate font-semibold" title="Click to select Admin Portal URL">
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-1.5 shrink-0 self-end md:self-center">
                    <button type="button" onclick="window.copyRepPortalLink('${srMember.id || 'rep-001'}', '${srName}')" class="px-2.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 transition-colors" title="Copy Sr. Sales Rep Admin Link">
                        <i data-lucide="copy" class="w-3.5 h-3.5"></i> Copy Admin Link
                    </button>
                    <a href="${cleanBaseUrl}" target="_blank" class="p-1.5 text-purple-600 hover:text-purple-900 hover:bg-purple-100 rounded-lg transition-colors" title="Open Admin Portal in new tab">
                        <i data-lucide="external-link" class="w-4 h-4"></i>
                    </a>
                </div>
            </div>
        `;

        let repCardsHtml = '';
        if (salesReps.length === 0) {
            repCardsHtml = `
                <div class="p-6 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
                    No regular sales representatives found. Click "Add Sales Person" above to create one.
                </div>
            `;
        } else {
            repCardsHtml = salesReps.map(rep => {
                const cleanRepName = sanitizeRepName(rep.name, rep.employee_id, rep.id);
                const portalUrl = window.getRepPortalUrl(cleanRepName);
                const safeName = escapeHtml(cleanRepName);
                const safeEmpId = escapeHtml(rep.employee_id || (cleanRepName === 'Supriya Yadav' ? 'EMP-102' : (cleanRepName === 'Kalyani Mundada' ? 'EMP-103' : rep.id)));
                const safePhone = escapeHtml(rep.phone || (cleanRepName === 'Supriya Yadav' ? '+91 98765 43211' : (cleanRepName === 'Kalyani Mundada' ? '+91 98765 43212' : '')));

                return `
                    <div class="p-3.5 bg-white rounded-xl border border-blue-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-blue-300 transition-colors">
                        <div class="min-w-0 flex items-center space-x-3">
                            <div class="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                                ${(cleanRepName || 'SR').slice(0, 2).toUpperCase()}
                            </div>
                            <div class="min-w-0">
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    <h4 class="text-xs font-bold text-slate-900 truncate">${safeName}</h4>
                                    <span class="text-[10px] font-mono bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded border border-blue-100">${safeEmpId}</span>
                                    ${safePhone ? `<span class="text-[10px] text-slate-500 font-mono">📱 ${safePhone}</span>` : ''}
                                </div>
                                <div class="flex items-center gap-1 mt-1">
                                    <input type="text" readonly value="${portalUrl}" onclick="this.select()" class="text-[11px] font-mono bg-slate-50 text-blue-800 border border-slate-200 rounded-lg px-2 py-1 w-full max-w-md select-all cursor-pointer truncate" title="Click to select URL">
                                </div>
                            </div>
                        </div>

                        <div class="flex items-center gap-1.5 shrink-0 self-end md:self-center">
                            <button type="button" onclick="window.copyRepPortalLink('${rep.id}', '${safeName}')" class="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1 transition-colors" title="Copy dedicated link">
                                <i data-lucide="copy" class="w-3.5 h-3.5"></i> Copy Link
                            </button>
                            <button type="button" onclick="window.shareRepLinkWhatsapp('${rep.id}', '${safeName}', '${safePhone}')" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1 transition-colors" title="Send via WhatsApp">
                                <i data-lucide="send" class="w-3.5 h-3.5"></i> WhatsApp
                            </button>
                            <a href="${portalUrl}" target="_blank" class="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Open and test rep portal in new tab">
                                <i data-lucide="external-link" class="w-4 h-4"></i>
                            </a>
                        </div>
                    </div>
                `;
            }).join('');
        }

        container.innerHTML = srCardHtml + repCardsHtml;
        initLucideIcons();
    };

    window.showNewRepLinkModal = function(member) {
        if (!member) return;
        const modal = document.getElementById('newRepLinkModal');
        if (!modal) return;

        const portalUrl = window.getRepPortalUrl(member.id);
        const nameElem = document.getElementById('newRepModalName');
        const empIdElem = document.getElementById('newRepModalEmpId');
        const urlInput = document.getElementById('newRepModalUrlInput');
        const copyBtn = document.getElementById('newRepModalCopyBtn');
        const waBtn = document.getElementById('newRepModalWhatsappBtn');
        const closeBtn = document.getElementById('newRepModalCloseBtn');

        if (nameElem) nameElem.textContent = member.name;
        if (empIdElem) empIdElem.textContent = member.employee_id || member.id;
        if (urlInput) urlInput.value = portalUrl;

        if (copyBtn) {
            copyBtn.onclick = () => window.copyRepPortalLink(member.id, member.name);
        }
        if (waBtn) {
            waBtn.onclick = () => window.shareRepLinkWhatsapp(member.id, member.name, member.phone);
        }
        if (closeBtn) {
            closeBtn.onclick = () => modal.classList.add('hidden');
        }

        modal.classList.remove('hidden');
        initLucideIcons();
    };

    function setupUserLoginModal() {
        const modal = document.getElementById('userLoginModal');
        const closeBtn = document.getElementById('closeUserLoginModalBtn');
        const cancelBtn = document.getElementById('cancelUserLoginModalBtn');
        const unlockBtn = document.getElementById('unlockManagerBtn');
        const pinInput = document.getElementById('managerPinInput');
        const pinError = document.getElementById('managerPinError');

        const closeModal = () => modal?.classList.add('hidden');

        closeBtn?.addEventListener('click', closeModal);
        cancelBtn?.addEventListener('click', closeModal);
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        unlockBtn?.addEventListener('click', () => {
            const enteredPin = (pinInput?.value || '').trim();
            if (isPinValid(enteredPin)) {
                pinError?.classList.add('hidden');
                pinInput.value = '';
                saveUserSession({
                    role: 'manager',
                    role_type: 'manager',
                    id: 'admin',
                    name: 'Manager / Admin',
                    employee_id: 'MGR-01',
                    designation: 'Sales Director',
                    phone: ''
                });
                closeModal();
                loadAndRenderVisits();
                renderSalesTeamSettings();
                alert('👑 Admin Mode Unlocked Successfully!\n\nYou now have full Executive Admin privileges.');
                openAdminAccessPanel();
            } else {
                if (pinError) {
                    pinError.textContent = `Invalid Admin PIN. (Default: ${DEFAULT_MANAGER_PIN})`;
                    pinError.classList.remove('hidden');
                }
            }
        });

        pinInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') unlockBtn?.click();
        });
    }

    window.openUserLoginModal = function() {
        if (guardAgainstLockedRep('User Switching / Manager Mode')) return;
        const modal = document.getElementById('userLoginModal');
        const repList = document.getElementById('loginRepList');
        const modalActiveAvatar = document.getElementById('modalActiveAvatar');
        const modalActiveName = document.getElementById('modalActiveName');
        const modalActiveRole = document.getElementById('modalActiveRole');
        const pinInput = document.getElementById('managerPinInput');
        const pinError = document.getElementById('managerPinError');

        if (!modal) return;
        if (pinInput) pinInput.value = '1234';
        pinError?.classList.add('hidden');

        const u = State.currentUser;
        const isAdmin = isManagerOrAdmin(u);
        const isSr = isSrSalesRep(u);

        if (modalActiveAvatar) {
            if (isAdmin) {
                modalActiveAvatar.textContent = '🛡️';
                modalActiveAvatar.className = 'w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-sm shadow-sm';
            } else if (isSr) {
                modalActiveAvatar.textContent = (u.name || 'SR').slice(0, 2).toUpperCase();
                modalActiveAvatar.className = 'w-10 h-10 rounded-xl bg-purple-700 text-white flex items-center justify-center font-black text-sm shadow-sm ring-1 ring-purple-300';
            } else {
                modalActiveAvatar.textContent = (u.name || 'SR').slice(0, 2).toUpperCase();
                modalActiveAvatar.className = 'w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-sm';
            }
        }
        if (modalActiveName) {
            modalActiveName.textContent = isAdmin ? 'Manager / Admin' : u.name;
        }
        if (modalActiveRole) {
            if (isAdmin) {
                modalActiveRole.textContent = '👑 Admin Mode (All Reps & Settings)';
            } else if (isSr) {
                modalActiveRole.textContent = '⭐ Sr. Sales Rep (All Functions Access)';
            } else {
                modalActiveRole.textContent = `👤 ${u.designation || 'Sales Representative'} (Private Mode)`;
            }
        }

        // Populate rep list
        if (repList) {
            const rawReps = (State.salesTeam && State.salesTeam.length) ? State.salesTeam : getLocalTeam();
            const reps = deduplicateAndCleanTeam(rawReps);
            const adminSwitchHtml = `
                <div onclick="window.unlockAdminModeNow()" class="p-2.5 rounded-xl border ${isAdmin ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-300' : 'border-purple-200 bg-purple-50/50 hover:bg-purple-100'} cursor-pointer flex items-center justify-between transition-all mb-2 shadow-xs">
                    <div class="flex items-center space-x-2.5">
                        <div class="w-8 h-8 rounded-lg bg-purple-700 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                            👑
                        </div>
                        <div>
                            <div class="flex items-center gap-1.5">
                                <h5 class="text-xs font-bold text-purple-950">Manager / Admin</h5>
                                <span class="text-[10px] bg-purple-200 text-purple-900 font-bold px-2 py-0.5 rounded-full">Executive Mode</span>
                            </div>
                            <p class="text-[10px] text-purple-700">All Reps, All Settings & Cloud Sync (PIN: 1234)</p>
                        </div>
                    </div>
                    ${isAdmin ? '<span class="text-[10px] bg-purple-700 text-white font-bold px-2.5 py-1 rounded-full">Active</span>' : '<span class="text-[10px] text-purple-800 font-bold hover:underline bg-white px-2.5 py-1 rounded-lg border border-purple-200 shadow-xs">Switch to Admin</span>'}
                </div>
            `;
            repList.innerHTML = adminSwitchHtml + reps.map(m => {
                const cleanMemberName = sanitizeRepName(m.name, m.employee_id, m.id);
                const isSelected = !isAdmin && (u.id === m.id || u.name === cleanMemberName || u.name === m.name);
                const isMemberSr = m.role_type === 'sr_sales_rep';
                const roleBadge = isMemberSr
                    ? '<span class="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full border border-purple-200">⭐ Sr. Sales Rep</span>'
                    : '<span class="text-[10px] bg-blue-50 text-blue-700 font-medium px-2 py-0.5 rounded-full border border-blue-200">👤 Sales Rep</span>';

                return `
                    <div onclick="window.selectSalesRepUser('${m.id}')" class="p-2.5 rounded-xl border ${isSelected ? (isMemberSr ? 'border-purple-500 bg-purple-50/70' : 'border-blue-500 bg-blue-50/70') : 'border-slate-200 bg-white hover:bg-slate-50'} cursor-pointer flex items-center justify-between transition-colors">
                        <div class="flex items-center space-x-2.5">
                            <div class="w-8 h-8 rounded-lg ${isSelected ? (isMemberSr ? 'bg-purple-700 text-white' : 'bg-blue-600 text-white') : (isMemberSr ? 'bg-purple-100 text-purple-700 font-bold' : 'bg-slate-100 text-slate-700')} flex items-center justify-center font-bold text-xs">
                                ${(cleanMemberName || 'SR').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    <h5 class="text-xs font-bold text-slate-800">${escapeHtml(cleanMemberName)}</h5>
                                    ${roleBadge}
                                </div>
                                <p class="text-[10px] text-slate-500">${escapeHtml(m.designation || (isMemberSr ? 'Sr. Sales Rep' : 'Sales Rep'))} • ${escapeHtml(m.employee_id || (cleanMemberName === 'Supriya Yadav' ? 'EMP-102' : (cleanMemberName === 'Kalyani Mundada' ? 'EMP-103' : 'ID')))}</p>
                            </div>
                        </div>
                        ${isSelected ? '<span class="text-[10px] bg-slate-800 text-white font-bold px-2 py-0.5 rounded-full">Active</span>' : '<span class="text-[10px] text-blue-600 font-semibold hover:underline">Switch</span>'}
                    </div>
                `;
            }).join('');
        }

        modal.classList.remove('hidden');
        initLucideIcons();
    };

    window.selectSalesRepUser = function(repId) {
        if (guardAgainstLockedRep('User Switching')) return;
        const reps = (State.salesTeam && State.salesTeam.length) ? State.salesTeam : getLocalTeam();
        const found = reps.find(m => m.id === repId);
        if (found) {
            const roleType = found.role_type || (found.designation && (found.designation.toLowerCase().includes('sr') || found.designation.toLowerCase().includes('senior')) ? 'sr_sales_rep' : 'sales_rep');
            saveUserSession({
                role: roleType,
                role_type: roleType,
                id: found.id,
                name: found.name,
                employee_id: found.employee_id || '',
                designation: found.designation || (roleType === 'sr_sales_rep' ? 'Sr. Sales Rep' : 'Sales Rep'),
                phone: found.phone || ''
            });
            document.getElementById('userLoginModal')?.classList.add('hidden');

            // If switching to regular Sales Rep while currently on Settings tab, redirect to visits
            if (roleType === 'sales_rep' && State.currentTab === 'settings') {
                switchTab('visits');
            } else {
                loadAndRenderVisits();
            }
        }
    };

    window.updateUserSessionUI = updateUserSessionUI;

    let pendingManagerAction = null;

    function promptManagerPin(onSuccess) {
        if (guardAgainstLockedRep('Manager PIN Authorization')) return;
        pendingManagerAction = onSuccess;
        const modal = document.getElementById('managerPinModal');
        const pinInput = document.getElementById('quickPinInput');
        const pinError = document.getElementById('quickPinError');
        if (pinInput) pinInput.value = '1234';
        pinError?.classList.add('hidden');
        modal?.classList.remove('hidden');
        pinInput?.focus();
        pinInput?.select();
    }
    window.promptManagerPin = promptManagerPin;

    function setupManagerPinModal() {
        const modal = document.getElementById('managerPinModal');
        const submitBtn = document.getElementById('submitQuickPinBtn');
        const closeBtn = document.getElementById('closeQuickPinBtn');
        const pinInput = document.getElementById('quickPinInput');
        const pinError = document.getElementById('quickPinError');

        const closeModal = () => modal?.classList.add('hidden');
        closeBtn?.addEventListener('click', closeModal);
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        submitBtn?.addEventListener('click', () => {
            const val = (pinInput?.value || '').trim();
            if (isPinValid(val)) {
                pinError?.classList.add('hidden');
                closeModal();
                saveUserSession({
                    role: 'manager',
                    role_type: 'manager',
                    id: 'admin',
                    name: 'Manager / Admin',
                    employee_id: 'MGR-01',
                    designation: 'Sales Director',
                    phone: ''
                });
                loadAndRenderVisits();
                renderSalesTeamSettings();
                alert('👑 Admin Mode Unlocked Successfully!\n\nYou now have full Executive Admin privileges.');
                if (typeof pendingManagerAction === 'function') {
                    pendingManagerAction();
                    pendingManagerAction = null;
                }
            } else {
                if (pinError) {
                    pinError.textContent = `Incorrect PIN. Default is ${DEFAULT_MANAGER_PIN}.`;
                    pinError.classList.remove('hidden');
                }
            }
        });

        pinInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submitBtn?.click();
        });
    }

    // --------------------------------------------------------------------------
    // MIS REPORT MODAL & RENDERER
    // --------------------------------------------------------------------------
    window.openMisReportModal = function(period = 'ALL') {
        if (isSalesRep()) {
            alert('⛔ Access Restricted: MIS Report is only accessible to Admin (Sr. Sales Rep). Sales team members have access to New Visit and Dashboard only.');
            return;
        }
        const modal = document.getElementById('misReportModal');
        if (!modal) return;

        State.misSelectedPeriod = period;
        renderMisReport(period);
        modal.classList.remove('hidden');
        initLucideIcons();
    };

    function setupMisReportModal() {
        const modal = document.getElementById('misReportModal');
        const closeBtn = document.getElementById('closeMisReportModalBtn');
        const bottomCloseBtn = document.getElementById('closeMisReportBottomBtn');
        const downloadExcelBtn = document.getElementById('misDownloadExcelBtn');
        const printPdfBtn = document.getElementById('misPrintPdfBtn');
        const periodContainer = document.getElementById('misPeriodButtons');

        const closeModal = () => modal?.classList.add('hidden');
        closeBtn?.addEventListener('click', closeModal);
        bottomCloseBtn?.addEventListener('click', closeModal);
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        // Period filter buttons
        periodContainer?.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-period]');
            if (!btn) return;
            const period = btn.getAttribute('data-period');
            State.misSelectedPeriod = period;

            // Update button styles
            periodContainer.querySelectorAll('button').forEach(b => {
                b.className = 'mis-period-btn px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 transition-colors';
            });
            btn.className = 'mis-period-btn px-3 py-1.5 rounded-lg bg-white text-purple-700 font-bold shadow-sm transition-colors';

            renderMisReport(period);
        });

        downloadExcelBtn?.addEventListener('click', () => {
            const u = State.currentUser;
            const period = State.misSelectedPeriod || 'ALL';
            const visits = getFilteredVisitsForMis(period);
            exportMisReportToExcel(visits, u, period);
        });

        printPdfBtn?.addEventListener('click', () => {
            window.print();
        });
    }

    function getFilteredVisitsForMis(period = 'ALL') {
        let visits = [...(State.allVisitsCache || getLocalVisits())];

        // If regular sales rep, strictly filter to their visits
        if (isSalesRep()) {
            const repId = State.currentUser?.id;
            const repName = (State.currentUser?.name || '').toLowerCase();
            visits = visits.filter(v => v.sales_rep_id === repId || (v.sales_rep_name && v.sales_rep_name.toLowerCase() === repName));
        }

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        if (period === 'TODAY') {
            visits = visits.filter(v => v.visit_time && v.visit_time.startsWith(todayStr));
        } else if (period === 'THIS_WEEK') {
            const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
            visits = visits.filter(v => new Date(v.visit_time) >= sevenDaysAgo);
        } else if (period === 'THIS_MONTH') {
            const monthStr = todayStr.slice(0, 7);
            visits = visits.filter(v => v.visit_time && v.visit_time.startsWith(monthStr));
        }

        return visits;
    }

    function renderMisReport(period = 'ALL') {
        const u = State.currentUser;
        const repNameHeader = document.getElementById('misRepNameHeader');
        const repEmpIdHeader = document.getElementById('misRepEmpIdHeader');
        const badge = document.getElementById('misRepBadge');

        if (repNameHeader) {
            repNameHeader.textContent = hasAllFunctionsAccess(u)
                ? (isManagerOrAdmin(u) ? 'All Sales Representatives (Manager View)' : 'All Sales Representatives (Sr. Sales Rep View)')
                : u.name;
        }
        if (repEmpIdHeader) {
            repEmpIdHeader.textContent = hasAllFunctionsAccess(u)
                ? (isManagerOrAdmin(u) ? 'Executive Overview' : `${u.name} (Sr. Sales Rep)`)
                : (u.employee_id || 'EMP-101');
        }
        if (badge) {
            badge.textContent = hasAllFunctionsAccess(u) ? 'Company-wide MIS' : 'Personal MIS Ledger';
        }

        const visits = getFilteredVisitsForMis(period);
        const total = visits.length;
        const closed = visits.filter(v => v.status === 'Successful Closed').length;
        const followups = visits.filter(v => v.status === 'Follow-up Required').length;
        const convRate = total > 0 ? ((closed / total) * 100).toFixed(1) + '%' : '0%';

        // Common accounts count
        const commonMap = State.commonAccountsMap || new Map();
        const commonVisits = visits.filter(v => commonMap.has(normalizeBusinessName(v.business_name || v.client_name)));

        // Scorecard
        const sTotal = document.getElementById('misStatTotalVisits');
        const sClosed = document.getElementById('misStatClosedDeals');
        const sFollow = document.getElementById('misStatFollowups');
        const sConv = document.getElementById('misStatConversionRate');
        const sCommon = document.getElementById('misStatCommonAccounts');

        if (sTotal) sTotal.textContent = total;
        if (sClosed) sClosed.textContent = closed;
        if (sFollow) sFollow.textContent = followups;
        if (sConv) sConv.textContent = convRate;
        if (sCommon) sCommon.textContent = commonVisits.length;

        // Pipeline bar
        const pctClosed = total > 0 ? Math.round((closed / total) * 100) : 0;
        const pctFollowup = total > 0 ? Math.round((followups / total) * 100) : 0;

        const barClosed = document.getElementById('misBarClosed');
        const barFollowup = document.getElementById('misBarFollowup');
        const pctClosedText = document.getElementById('misPctClosed');
        const pctFollowupText = document.getElementById('misPctFollowup');
        const ratioText = document.getElementById('misPipelineRatioText');

        if (barClosed) barClosed.style.width = `${pctClosed}%`;
        if (barFollowup) barFollowup.style.width = `${pctFollowup}%`;
        if (pctClosedText) pctClosedText.textContent = `${pctClosed}%`;
        if (pctFollowupText) pctFollowupText.textContent = `${pctFollowup}%`;
        if (ratioText) ratioText.textContent = `${closed} Closed Won (${pctClosed}%) • ${followups} Follow-up (${pctFollowup}%)`;

        // Common accounts overlap list
        const commonContainer = document.getElementById('misCommonAccountsContainer');
        const commonBadge = document.getElementById('misCommonBadge');

        const activeCommonAccounts = [];
        commonMap.forEach((entry, norm) => {
            const repVisits = visits.filter(v => normalizeBusinessName(v.business_name || v.client_name) === norm);
            if (repVisits.length > 0 || u.role === 'manager') {
                activeCommonAccounts.push({
                    name: entry.businessName,
                    myVisits: repVisits,
                    allVisits: entry.visits,
                    reps: Array.from(entry.repNames)
                });
            }
        });

        if (commonBadge) commonBadge.textContent = `${activeCommonAccounts.length} Common Accounts`;

        if (commonContainer) {
            if (activeCommonAccounts.length === 0) {
                commonContainer.innerHTML = `
                    <div class="p-4 text-center text-xs text-slate-400">
                        No cross-rep common accounts detected in this period.
                    </div>
                `;
            } else {
                commonContainer.innerHTML = activeCommonAccounts.map(acc => {
                    const otherReps = acc.reps.filter(r => r.toLowerCase() !== (u.name || '').toLowerCase());
                    return `
                        <div class="py-2.5 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div class="flex items-center space-x-2.5">
                                <div class="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                                    🏢
                                </div>
                                <div>
                                    <div class="flex items-center gap-2">
                                        <h5 class="text-xs font-bold text-slate-900">${escapeHtml(acc.name)}</h5>
                                        <span class="text-[10px] bg-purple-100 text-purple-800 font-extrabold px-2 py-0.5 rounded-full">Common Client</span>
                                    </div>
                                    <p class="text-[11px] text-purple-700 mt-0.5">
                                        Shared with: <strong>${escapeHtml(otherReps.join(', ') || 'Team members')}</strong> • Total visits logged: <strong>${acc.allVisits.length}</strong>
                                    </p>
                                </div>
                            </div>
                            <span class="text-[11px] text-slate-500 font-medium">
                                ${acc.myVisits.length} visit(s) by you
                            </span>
                        </div>
                    `;
                }).join('');
            }
        }

        // Visits Activity Ledger table
        const tbody = document.getElementById('misVisitTableBody');
        const ledgerCount = document.getElementById('misLedgerCount');

        if (ledgerCount) ledgerCount.textContent = `${visits.length} visits found`;

        if (tbody) {
            if (visits.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="p-6 text-center text-slate-400 text-xs">
                            No visits recorded in this period.
                        </td>
                    </tr>
                `;
            } else {
                tbody.innerHTML = visits.map(v => {
                    const bName = v.business_name || v.client_name || 'Business';
                    const isCommon = commonMap.has(normalizeBusinessName(bName));
                    const isClosed = v.status === 'Successful Closed';
                    const dateStr = v.visit_time ? new Date(v.visit_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
                    const timeStr = v.visit_time ? new Date(v.visit_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';

                    return `
                        <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100">
                            <td class="p-2.5 whitespace-nowrap text-slate-700 font-medium">
                                <div>${dateStr}</div>
                                <div class="text-[10px] text-slate-400 font-mono">${timeStr}</div>
                            </td>
                            <td class="p-2.5">
                                <div class="font-bold text-slate-900">${escapeHtml(bName)}</div>
                                ${isCommon ? '<span class="inline-block mt-0.5 text-[9px] bg-purple-600 text-white font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">Common Account</span>' : ''}
                            </td>
                            <td class="p-2.5">
                                <div class="font-medium text-slate-800">${escapeHtml(v.contact_person_name || '-')}</div>
                                <div class="text-[10px] text-slate-500 font-mono">${escapeHtml(v.contact_person_phone || '')}</div>
                            </td>
                            <td class="p-2.5 whitespace-nowrap">
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isClosed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
                                    ${escapeHtml(v.status)}
                                </span>
                            </td>
                            <td class="p-2.5 max-w-xs truncate text-[11px] text-slate-600">
                                <div><strong class="text-slate-500">A:</strong> ${escapeHtml(v.address_option_a || v.client_address || '-')}</div>
                                <div class="text-[10px] text-emerald-700 truncate"><strong class="text-emerald-800">B (GPS):</strong> ${escapeHtml(v.address_option_b || v.location_address || '-')}</div>
                            </td>
                            <td class="p-2.5 whitespace-nowrap text-[11px] font-medium text-slate-700">
                                ${v.follow_up_date ? `<span class="bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-lg font-bold">${v.follow_up_date} (11:30 AM)</span>` : '-'}
                            </td>
                            <td class="p-2.5 max-w-xs text-[11px] text-slate-600">
                                ${escapeHtml(v.remarks || '-')}
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }

        initLucideIcons();
    }

    function switchTab(tabKey) {
        // Enforce 2-tier role permissions: Sales Reps ONLY have access to New Visit and Dashboard
        if (isSalesRep() && tabKey !== 'new-visit' && tabKey !== 'visits') {
            alert('⛔ Access Restricted: Sales team members only have access to New Visit and Dashboard. Settings and Admin tools are restricted to Admin (Sr. Sales Rep).');
            return;
        }

        State.currentTab = tabKey;

        const views = {
            'new-visit': document.getElementById('viewNewVisit'),
            'visits': document.getElementById('viewVisits'),
            'settings': document.getElementById('viewSettings')
        };

        const deskButtons = {
            'new-visit': document.getElementById('tabBtnNewVisitDesk'),
            'visits': document.getElementById('tabBtnVisitsDesk'),
            'settings': document.getElementById('tabBtnSettingsDesk')
        };

        const mobButtons = {
            'new-visit': document.getElementById('tabBtnNewVisitMob'),
            'visits': document.getElementById('tabBtnVisitsMob'),
            'settings': document.getElementById('tabBtnSettingsMob')
        };

        // Toggle Views
        Object.keys(views).forEach(key => {
            if (views[key]) {
                if (key === tabKey) {
                    views[key].classList.remove('hidden');
                } else {
                    views[key].classList.add('hidden');
                }
            }
        });

        // Toggle Desktop Buttons
        Object.keys(deskButtons).forEach(key => {
            const btn = deskButtons[key];
            if (btn) {
                if (key === tabKey) {
                    btn.classList.add('bg-white', 'text-blue-600', 'shadow-sm');
                    btn.classList.remove('text-slate-600');
                } else {
                    btn.classList.remove('bg-white', 'text-blue-600', 'shadow-sm');
                    btn.classList.add('text-slate-600');
                }
            }
        });

        // Toggle Mobile Buttons
        Object.keys(mobButtons).forEach(key => {
            const btn = mobButtons[key];
            if (btn) {
                if (key === tabKey) {
                    btn.classList.add('text-blue-600');
                    btn.classList.remove('text-slate-400');
                } else {
                    btn.classList.remove('text-blue-600');
                    btn.classList.add('text-slate-400');
                }
            }
        });

        if (tabKey === 'visits') {
            loadAndRenderVisits();
        } else if (tabKey === 'settings') {
            renderSalesTeamSettings();
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
        initLucideIcons();
    }

    // Expose immediately
    window.switchAppTab = switchTab;

    function setupNavigation() {
        const deskButtons = {
            'new-visit': document.getElementById('tabBtnNewVisitDesk'),
            'visits': document.getElementById('tabBtnVisitsDesk'),
            'settings': document.getElementById('tabBtnSettingsDesk')
        };

        const mobButtons = {
            'new-visit': document.getElementById('tabBtnNewVisitMob'),
            'visits': document.getElementById('tabBtnVisitsMob'),
            'settings': document.getElementById('tabBtnSettingsMob')
        };

        // Attach Click Listeners
        Object.keys(deskButtons).forEach(key => {
            deskButtons[key]?.addEventListener('click', (e) => {
                e.preventDefault();
                switchTab(key);
            });
        });

        Object.keys(mobButtons).forEach(key => {
            mobButtons[key]?.addEventListener('click', (e) => {
                e.preventDefault();
                switchTab(key);
            });
        });

        document.getElementById('quickHelpBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            if (isSalesRep()) {
                alert('ℹ️ Sales Rep Mode: You have access to New Visit and Dashboard.\n\nSettings & cloud database configuration are managed by Admin (Sr. Sales Rep).');
                return;
            }
            switchTab('settings');
        });
    }

    function setupCurrentTime() {
        const timeDisplay = document.getElementById('currentTimeDisplay');
        const visitTimeInput = document.getElementById('visitTimeInput');

        const updateClock = () => {
            const now = new Date();
            if (timeDisplay) {
                timeDisplay.textContent = now.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
        };
        updateClock();
        setInterval(updateClock, 30000);

        if (visitTimeInput) {
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            visitTimeInput.value = now.toISOString().slice(0, 16);
        }
    }

    async function loadSalesTeam() {
        try {
            State.salesTeam = await getSalesTeam();
            populateSalesTeamDropdowns();
            renderSalesTeamSettings();
            if (typeof renderAdminPanelData === 'function') {
                renderAdminPanelData();
            }
        } catch (e) {
            console.error('Failed to load sales team:', e);
        }
    }

    function populateSalesTeamDropdowns() {
        const repSelect = document.getElementById('salesRepSelect');
        const filterRepSelect = document.getElementById('filterSalesRep');

        State.salesTeam = deduplicateAndCleanTeam(State.salesTeam);

        if (repSelect) {
            const currentVal = repSelect.value;
            repSelect.innerHTML = '<option value="">-- Choose Sales Person --</option>';
            State.salesTeam.filter(m => m.is_active).forEach(m => {
                const opt = document.createElement('option');
                const cleanName = sanitizeRepName(m.name, m.employee_id, m.id);
                opt.value = m.id;
                opt.dataset.name = cleanName;
                opt.dataset.empid = m.employee_id || '';
                opt.textContent = `${cleanName} (${m.employee_id ? m.employee_id + ' • ' : ''}${m.designation || 'Sales'})`;
                repSelect.appendChild(opt);
            });
            if (currentVal) {
                repSelect.value = currentVal;
            } else if (State.currentUser && State.currentUser.id) {
                repSelect.value = State.currentUser.id;
            }
        }

        if (filterRepSelect) {
            const currentFilterVal = filterRepSelect.value;
            filterRepSelect.innerHTML = '<option value="ALL">All Sales Representatives</option>';
            State.salesTeam.forEach(m => {
                const opt = document.createElement('option');
                const cleanName = sanitizeRepName(m.name, m.employee_id, m.id);
                opt.value = m.id;
                opt.textContent = cleanName;
                filterRepSelect.appendChild(opt);
            });
            if (currentFilterVal) filterRepSelect.value = currentFilterVal;
        }

        updateUserSessionUI();
    }

    // --------------------------------------------------------------------------
    // GPS LOCATION CAPTURE (Auto-captured & locked Option B)
    // --------------------------------------------------------------------------
    async function captureLiveGpsLocation(isManualTrigger = false) {
        const gpsBtnText = document.getElementById('gpsBtnText');
        const captureGpsBtn = document.getElementById('captureGpsBtn');
        const addressOptionBInput = document.getElementById('addressOptionBInput');
        const gpsStatusPill = document.getElementById('gpsStatusPill');
        const gpsCoordsText = document.getElementById('gpsCoordsText');
        const gpsMapLink = document.getElementById('gpsMapLink');

        try {
            if (gpsBtnText) gpsBtnText.textContent = 'Locating...';
            if (captureGpsBtn) captureGpsBtn.classList.add('opacity-75', 'cursor-not-allowed');

            const coords = await getCurrentCoordinates();
            State.selectedGps = coords;

            if (gpsCoordsText) {
                gpsCoordsText.textContent = `GPS: ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)} (±${Math.round(coords.accuracy)}m)`;
            }
            const mapUrl = getGoogleMapsUrl(coords.latitude, coords.longitude);
            if (gpsMapLink) gpsMapLink.setAttribute('href', mapUrl);
            if (gpsStatusPill) {
                gpsStatusPill.classList.remove('hidden');
                gpsStatusPill.classList.add('flex');
            }

            if (gpsBtnText) gpsBtnText.textContent = 'Fetching Address...';
            const readableAddress = await reverseGeocode(coords.latitude, coords.longitude);
            State.gpsAddress = readableAddress;

            if (addressOptionBInput) {
                addressOptionBInput.value = `${readableAddress}\n[GPS: ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)} ±${Math.round(coords.accuracy)}m]`;
            }

            if (gpsBtnText) {
                gpsBtnText.textContent = 'GPS Verified ✓';
                setTimeout(() => {
                    gpsBtnText.textContent = 'Re-detect GPS';
                    if (captureGpsBtn) captureGpsBtn.classList.remove('opacity-75', 'cursor-not-allowed');
                }, 2000);
            }
        } catch (err) {
            console.warn('GPS capture notice:', err.message);
            if (addressOptionBInput && !addressOptionBInput.value) {
                addressOptionBInput.value = 'GPS location permission required. Click "Re-detect GPS" above to allow location.';
            }
            if (gpsBtnText) {
                gpsBtnText.textContent = 'Re-detect GPS';
                if (captureGpsBtn) captureGpsBtn.classList.remove('opacity-75', 'cursor-not-allowed');
            }
            if (isManualTrigger) {
                alert(err.message || 'Could not fetch GPS coordinates.');
            }
        }
        initLucideIcons();
    }

    function setupGpsDetection() {
        const captureGpsBtn = document.getElementById('captureGpsBtn');
        captureGpsBtn?.addEventListener('click', () => captureLiveGpsLocation(true));
    }

    // --------------------------------------------------------------------------
    // VISITING CARD UPLOAD & OCR (Front & Back - Camera + PDF/Photo)
    // --------------------------------------------------------------------------
    function setupVisitingCardUpload() {
        // Front elements
        const frontCameraBtn = document.getElementById('frontCameraBtn');
        const frontFileBtn = document.getElementById('frontFileBtn');
        const frontCameraInput = document.getElementById('visitingCardFrontCameraInput');
        const frontFileInput = document.getElementById('visitingCardFrontFileInput');
        const frontEmptyState = document.getElementById('frontEmptyState');
        const frontPreviewContainer = document.getElementById('frontPreviewContainer');
        const frontPreviewImg = document.getElementById('visitingCardFrontPreviewImg');
        const removeFrontBtn = document.getElementById('removeFrontBtn');
        const frontBadge = document.getElementById('frontBadge');

        // Back elements
        const backCameraBtn = document.getElementById('backCameraBtn');
        const backFileBtn = document.getElementById('backFileBtn');
        const backCameraInput = document.getElementById('visitingCardBackCameraInput');
        const backFileInput = document.getElementById('visitingCardBackFileInput');
        const backEmptyState = document.getElementById('backEmptyState');
        const backPreviewContainer = document.getElementById('backPreviewContainer');
        const backPreviewImg = document.getElementById('visitingCardBackPreviewImg');
        const removeBackBtn = document.getElementById('removeBackBtn');
        const backBadge = document.getElementById('backBadge');

        // OCR indicators
        const ocrProgressContainer = document.getElementById('ocrProgressContainer');
        const ocrProgressBar = document.getElementById('ocrProgressBar');
        const ocrStatusText = document.getElementById('ocrStatusText');
        const ocrPercentText = document.getElementById('ocrPercentText');
        const ocrBanner = document.getElementById('ocrExtractedBanner');
        const reapplyBtn = document.getElementById('reapplyOcrBtn');

        // Unified Card Processor (Handles Camera Photo, Gallery Image, and PDF document)
        async function processCardFile(file, isFront) {
            if (!file) return;

            if (isFront) {
                State.visitingCardFrontFile = file;
            } else {
                State.visitingCardBackFile = file;
            }

            const previewImg = isFront ? frontPreviewImg : backPreviewImg;
            const emptyState = isFront ? frontEmptyState : backEmptyState;
            const previewContainer = isFront ? frontPreviewContainer : backPreviewContainer;
            const badge = isFront ? frontBadge : backBadge;
            const sideLabel = isFront ? 'Front' : 'Back';

            const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

            if (isPdf) {
                ocrProgressContainer.classList.remove('hidden');
                ocrBanner.classList.add('hidden');
                ocrStatusText.textContent = `Rendering PDF Visiting Card (${sideLabel})...`;
                ocrProgressBar.style.width = '20%';
                ocrPercentText.textContent = '20%';

                try {
                    const { canvas, dataUrl, pdfText } = await renderPdfToCanvas(file);
                    if (previewImg) previewImg.src = dataUrl;
                    emptyState?.classList.add('hidden');
                    previewContainer?.classList.remove('hidden');
                    if (badge) {
                        badge.textContent = 'PDF Attached';
                        badge.className = 'text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold shadow-sm';
                        badge.classList.remove('hidden');
                    }

                    await handleOcrScan(canvas, `Scanning PDF Visiting Card (${sideLabel})...`, pdfText);
                } catch (pdfErr) {
                    console.error('PDF Processing Error:', pdfErr);
                    alert(`Could not parse PDF: ${pdfErr.message}`);
                    ocrProgressContainer.classList.add('hidden');
                }
            } else {
                // Image (Camera capture or image file)
                const reader = new FileReader();
                reader.onload = (re) => {
                    if (previewImg) previewImg.src = re.target.result;
                    emptyState?.classList.add('hidden');
                    previewContainer?.classList.remove('hidden');
                    if (badge) {
                        badge.textContent = 'Photo Attached';
                        badge.className = 'text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold shadow-sm';
                        badge.classList.remove('hidden');
                    }
                };
                reader.readAsDataURL(file);

                await handleOcrScan(file, `Scanning Visiting Card ${sideLabel}...`);
            }
        }

        // FRONT TRIGGERS: Camera & File/PDF
        frontCameraBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            frontCameraInput?.click();
        });

        frontFileBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            frontFileInput?.click();
        });

        frontCameraInput?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) processCardFile(file, true);
        });

        frontFileInput?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) processCardFile(file, true);
        });

        removeFrontBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            State.visitingCardFrontFile = null;
            if (frontCameraInput) frontCameraInput.value = '';
            if (frontFileInput) frontFileInput.value = '';
            if (frontPreviewImg) frontPreviewImg.src = '';
            frontPreviewContainer?.classList.add('hidden');
            frontEmptyState?.classList.remove('hidden');
            frontBadge?.classList.add('hidden');
        });

        // BACK TRIGGERS: Camera & File/PDF
        backCameraBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            backCameraInput?.click();
        });

        backFileBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            backFileInput?.click();
        });

        backCameraInput?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) processCardFile(file, false);
        });

        backFileInput?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) processCardFile(file, false);
        });

        removeBackBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            State.visitingCardBackFile = null;
            if (backCameraInput) backCameraInput.value = '';
            if (backFileInput) backFileInput.value = '';
            if (backPreviewImg) backPreviewImg.src = '';
            backPreviewContainer?.classList.add('hidden');
            backEmptyState?.classList.remove('hidden');
            backBadge?.classList.add('hidden');
        });

        // OCR Scan Worker
        async function handleOcrScan(imageOrCanvas, statusTitle, extraDirectText = '') {
            ocrProgressContainer.classList.remove('hidden');
            ocrBanner.classList.add('hidden');

            try {
                const { rawText, parsed } = await scanVisitingCard(imageOrCanvas, (percent, status) => {
                    ocrProgressBar.style.width = `${percent}%`;
                    ocrPercentText.textContent = `${percent}%`;
                    ocrStatusText.textContent = status;
                }, extraDirectText);

                State.ocrRawText += '\n' + rawText;

                // Merge with existing extracted data across Front & Back scans
                State.extractedOcrData = {
                    companyName: parsed.companyName || State.extractedOcrData.companyName || '',
                    contactPerson: parsed.contactPerson || State.extractedOcrData.contactPerson || '',
                    phone: parsed.phone || State.extractedOcrData.phone || '',
                    email: parsed.email || State.extractedOcrData.email || '',
                    pincode: parsed.pincode || State.extractedOcrData.pincode || '',
                    address: parsed.address || State.extractedOcrData.address || '',
                    designation: parsed.designation || State.extractedOcrData.designation || ''
                };

                applyOcrToForm(State.extractedOcrData);

                // Update extracted badge in banner
                const compElem = document.getElementById('ocrExtractedCompany');
                const nameElem = document.getElementById('ocrExtractedName');
                const phoneElem = document.getElementById('ocrExtractedPhone');
                const emailElem = document.getElementById('ocrExtractedEmail');
                const pinElem = document.getElementById('ocrExtractedPin');
                const desigElem = document.getElementById('ocrExtractedDesig');

                if (compElem) compElem.textContent = State.extractedOcrData.companyName || '(Not detected)';
                if (nameElem) nameElem.textContent = State.extractedOcrData.contactPerson || '(Not detected)';
                if (phoneElem) phoneElem.textContent = State.extractedOcrData.phone || '(Not detected)';
                if (emailElem) emailElem.textContent = State.extractedOcrData.email || '(Not detected)';
                if (pinElem) pinElem.textContent = State.extractedOcrData.pincode || '(Not detected)';
                if (desigElem) desigElem.textContent = State.extractedOcrData.designation || '(Not detected)';

                ocrProgressContainer.classList.add('hidden');
                ocrBanner.classList.remove('hidden');
                initLucideIcons();
            } catch (err) {
                console.error('OCR Error:', err);
                ocrStatusText.textContent = err.message || 'OCR extraction completed';
                setTimeout(() => {
                    ocrProgressContainer.classList.add('hidden');
                }, 3500);
            }
        }

        reapplyBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (State.extractedOcrData) {
                applyOcrToForm(State.extractedOcrData);
                alert('Visiting card details re-applied to form fields!');
            }
        });
    }

    // --------------------------------------------------------------------------
    // BUSINESS NAME DUPLICATION & COMMON ACCOUNT VALIDATION
    // --------------------------------------------------------------------------
    async function checkBusinessNameDuplication(businessName) {
        if (!businessName || !businessName.trim()) {
            return { isDuplicate: false, isCommon: false, existingVisit: null, otherRepNames: [] };
        }

        const normalized = normalizeBusinessName(businessName);
        if (normalized.length < 2) {
            return { isDuplicate: false, isCommon: false, existingVisit: null, otherRepNames: [] };
        }

        // Check against local and cached visits
        const allLocal = (State.allVisitsCache && State.allVisitsCache.length)
            ? State.allVisitsCache
            : ((State.visits && State.visits.length) ? State.visits : getLocalVisits());
        const currentRepId = State.currentUser?.id;
        const currentRepName = (State.currentUser?.name || '').toLowerCase();

        const matches = allLocal.filter(v => {
            const existing = normalizeBusinessName(v.business_name || v.client_name);
            return existing === normalized;
        });

        if (matches.length > 0) {
            // Check if already visited by the SAME sales rep
            const sameRepMatch = matches.find(v => {
                const repIdMatch = v.sales_rep_id && v.sales_rep_id === currentRepId;
                const repNameMatch = v.sales_rep_name && v.sales_rep_name.toLowerCase() === currentRepName;
                return repIdMatch || repNameMatch;
            });

            // Reps who also visited this business
            const otherReps = matches
                .filter(v => (v.sales_rep_name && v.sales_rep_name.toLowerCase() !== currentRepName))
                .map(v => v.sales_rep_name || 'Other Rep');
            const uniqueOtherReps = Array.from(new Set(otherReps));

            if (sameRepMatch) {
                // Same rep already logged this: Strictly blocked to prevent duplication
                return {
                    isDuplicate: true,
                    isCommon: uniqueOtherReps.length > 0,
                    existingVisit: sameRepMatch,
                    otherRepNames: uniqueOtherReps
                };
            } else {
                // Logged by another sales rep: This is a Common Account (allowed & highlighted)!
                return {
                    isDuplicate: false,
                    isCommon: true,
                    existingVisit: matches[0],
                    otherRepNames: uniqueOtherReps
                };
            }
        }

        return { isDuplicate: false, isCommon: false, existingVisit: null, otherRepNames: [] };
    }

    async function validateBusinessNameUI(inputName, fromCard = false) {
        const warningBox = document.getElementById('duplicateBusinessWarning');
        const detailsElem = document.getElementById('duplicateBusinessDetails');
        const commonBanner = document.getElementById('commonAccountBanner');
        const commonDetails = document.getElementById('commonAccountDetails');
        const statusBadge = document.getElementById('businessNameStatusBadge');
        const nameInput = document.getElementById('businessNameInput');

        if (!nameInput) return false;

        const trimmed = (inputName || '').trim();
        if (!trimmed || trimmed.length < 2) {
            warningBox?.classList.add('hidden');
            commonBanner?.classList.add('hidden');
            statusBadge?.classList.add('hidden');
            nameInput.classList.remove('border-rose-500', 'bg-rose-50/40', 'focus:ring-rose-500', 'border-purple-400', 'bg-purple-50/30', 'focus:ring-purple-500');
            nameInput.classList.add('border-slate-200', 'bg-slate-50', 'focus:ring-blue-500');
            State.isBusinessNameDuplicate = false;
            return false;
        }

        const check = await checkBusinessNameDuplication(trimmed);

        if (check.isDuplicate) {
            // Duplicate by the SAME sales rep: Blocked
            State.isBusinessNameDuplicate = true;
            nameInput.classList.remove('border-slate-200', 'bg-slate-50', 'focus:ring-blue-500', 'border-purple-400', 'bg-purple-50/30', 'focus:ring-purple-500');
            nameInput.classList.add('border-rose-500', 'bg-rose-50/40', 'focus:ring-rose-500');

            if (statusBadge) {
                statusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 shadow-sm';
                statusBadge.textContent = 'Already Recorded by You ⛔';
                statusBadge.classList.remove('hidden');
            }

            if (detailsElem) {
                const vDate = check.existingVisit?.visit_time ? new Date(check.existingVisit.visit_time).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric'
                }) : 'previously';
                detailsElem.innerHTML = `
                    <strong>"${escapeHtml(trimmed)}"</strong> has already been visited by you on <strong>${vDate}</strong>.<br>
                    <span class="font-bold text-rose-800">Duplicate visits to the same business by the same sales rep are blocked in the ERP.</span>
                `;
            }
            warningBox?.classList.remove('hidden');
            commonBanner?.classList.add('hidden');
            initLucideIcons();

            if (fromCard) {
                alert(`⚠️ Duplicate Warning: You have already logged a visit for "${trimmed}". Duplicate entries by the same sales person are not permitted.`);
            }
            return true;
        } else if (check.isCommon) {
            // Common Account with another rep: HIGHLIGHTED & ALLOWED
            State.isBusinessNameDuplicate = false;
            warningBox?.classList.add('hidden');

            nameInput.classList.remove('border-slate-200', 'bg-slate-50', 'border-rose-500', 'bg-rose-50/40', 'focus:ring-rose-500');
            nameInput.classList.add('border-purple-400', 'bg-purple-50/30', 'focus:ring-purple-500');

            if (statusBadge) {
                statusBadge.className = 'text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-300 shadow-sm';
                statusBadge.textContent = '🏢 Common Account ✓';
                statusBadge.classList.remove('hidden');
            }

            if (commonDetails) {
                const otherNames = check.otherRepNames.join(', ') || 'other team members';
                commonDetails.innerHTML = `
                    <strong>"${escapeHtml(trimmed)}"</strong> is a <strong>Common Corporate Account</strong> also handled by <strong>${escapeHtml(otherNames)}</strong>.<br>
                    This visit will be saved under your name and highlighted as a shared account on your dashboard and MIS report.
                `;
            }
            commonBanner?.classList.remove('hidden');
            initLucideIcons();
            return false;
        } else {
            // Unique account
            State.isBusinessNameDuplicate = false;
            warningBox?.classList.add('hidden');
            commonBanner?.classList.add('hidden');

            nameInput.classList.remove('border-rose-500', 'bg-rose-50/40', 'focus:ring-rose-500', 'border-purple-400', 'bg-purple-50/30', 'focus:ring-purple-500');
            nameInput.classList.add('border-slate-200', 'bg-slate-50', 'focus:ring-blue-500');

            if (statusBadge) {
                statusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shadow-sm';
                statusBadge.textContent = 'Unique Account ✓';
                statusBadge.classList.remove('hidden');
            }
            return false;
        }
    }

    function applyOcrToForm(parsed) {
        const businessNameInput = document.getElementById('businessNameInput');
        const contactPersonNameInput = document.getElementById('contactPersonNameInput');
        const contactPersonPhoneInput = document.getElementById('contactPersonPhoneInput');
        const contactPersonEmailInput = document.getElementById('contactPersonEmailInput');
        const pincodeInput = document.getElementById('pincodeInput');
        const addressOptionAInput = document.getElementById('addressOptionAInput');

        if (parsed.companyName && businessNameInput) {
            businessNameInput.value = parsed.companyName;
            validateBusinessNameUI(parsed.companyName, true);
        }
        if (parsed.contactPerson && contactPersonNameInput && !contactPersonNameInput.value) {
            contactPersonNameInput.value = parsed.contactPerson;
        }
        if (parsed.phone && contactPersonPhoneInput && !contactPersonPhoneInput.value) {
            contactPersonPhoneInput.value = parsed.phone;
        }
        if (parsed.email && contactPersonEmailInput && !contactPersonEmailInput.value) {
            contactPersonEmailInput.value = parsed.email;
        }
        if (parsed.pincode && pincodeInput && !pincodeInput.value) {
            pincodeInput.value = parsed.pincode;
        }
        if (parsed.address && addressOptionAInput && !addressOptionAInput.value) {
            addressOptionAInput.value = parsed.address;
        }
    }

    // --------------------------------------------------------------------------
    // OFFICE / SHOP PHOTO (Mandatory with Camera Access)
    // --------------------------------------------------------------------------
    function setupOfficePhotoUpload() {
        const officeBtn = document.getElementById('officePhotoBtn');
        const officeInput = document.getElementById('officePhotoInput');
        const btnText = document.getElementById('officePhotoBtnText');
        const badge = document.getElementById('officePhotoBadge');
        const previewContainer = document.getElementById('officePhotoPreviewContainer');
        const previewImg = document.getElementById('officePhotoPreviewImg');
        const removeBtn = document.getElementById('removeOfficePhotoBtn');

        officeBtn?.addEventListener('click', () => officeInput.click());

        officeInput?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) {
                State.officePhotoFile = file;

                const reader = new FileReader();
                reader.onload = (re) => {
                    if (previewImg) previewImg.src = re.target.result;
                    previewContainer?.classList.remove('hidden');
                };
                reader.readAsDataURL(file);

                btnText.innerHTML = `<i data-lucide="check" class="w-4 h-4 text-emerald-600"></i> Office Photo Selected ✓`;
                badge?.classList.remove('hidden');
                initLucideIcons();
            }
        });

        removeBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            State.officePhotoFile = null;
            officeInput.value = '';
            previewContainer?.classList.add('hidden');
            badge?.classList.add('hidden');
            btnText.innerHTML = 'Open Camera & Take Photo';
            initLucideIcons();
        });
    }

    // --------------------------------------------------------------------------
    // MEETING STATUS CARDS
    // --------------------------------------------------------------------------
    function setupMeetingStatusCards() {
        const closedCard = document.getElementById('statusClosedCard');
        const followupCard = document.getElementById('statusFollowupCard');
        const followupDateContainer = document.getElementById('followupDateContainer');

        function updateStatusUI(selectedStatus) {
            if (selectedStatus === 'Successful Closed') {
                closedCard.classList.add('border-emerald-500', 'bg-emerald-50/40');
                closedCard.classList.remove('border-slate-200', 'bg-white');
                followupCard.classList.remove('border-blue-500', 'bg-blue-50/40');
                followupCard.classList.add('border-slate-200', 'bg-white');
                followupDateContainer.classList.add('hidden');
            } else {
                followupCard.classList.add('border-blue-500', 'bg-blue-50/40');
                followupCard.classList.remove('border-slate-200', 'bg-white');
                closedCard.classList.remove('border-emerald-500', 'bg-emerald-50/40');
                closedCard.classList.add('border-slate-200', 'bg-white');
                followupDateContainer.classList.remove('hidden');
            }
        }

        closedCard?.addEventListener('click', () => {
            const radio = closedCard.querySelector('input');
            if (radio) radio.checked = true;
            updateStatusUI('Successful Closed');
        });

        followupCard?.addEventListener('click', () => {
            const radio = followupCard.querySelector('input');
            if (radio) radio.checked = true;
            updateStatusUI('Follow-up Required');
        });
    }

    // --------------------------------------------------------------------------
    // VISIT FORM SUBMISSION
    // --------------------------------------------------------------------------
    function setupVisitFormSubmission() {
        const form = document.getElementById('visitForm');
        const submitBtn = document.getElementById('submitVisitBtn');
        const submitBtnText = document.getElementById('submitBtnText');

        form?.addEventListener('submit', async (e) => {
            e.preventDefault();

            // 1. Validate Sales Representative
            const repSelect = document.getElementById('salesRepSelect');
            let selectedRepId = repSelect.value;
            const selectedOption = repSelect.options[repSelect.selectedIndex];
            let selectedRepName = selectedOption ? selectedOption.dataset.name || selectedOption.textContent : 'Supriya Yadav';
            let selectedEmpId = selectedOption ? selectedOption.dataset.empid || '' : '';

            // Enforce Sales Rep ID & Name integrity (prevents submitting on behalf of other reps)
            if (isSalesRep() && State.currentUser) {
                selectedRepId = State.currentUser.id || selectedRepId;
                selectedRepName = State.currentUser.name || selectedRepName;
                selectedEmpId = State.currentUser.employee_id || selectedEmpId;
            }

            selectedRepName = sanitizeRepName(selectedRepName, selectedEmpId, selectedRepId);

            if (!selectedRepId) {
                alert('Please select your Sales Representative name at the top of the form.');
                repSelect.focus();
                return;
            }

            // 2. Validate Office / Shop Photo (MANDATORY)
            if (!State.officePhotoFile) {
                alert('⚠️ Office / Shop Photo is mandatory!\n\nPlease tap "Open Camera & Take Photo" to photograph the client office or storefront before submitting.');
                document.getElementById('officePhotoBtn')?.scrollIntoView({ behavior: 'smooth' });
                return;
            }

            const businessName = document.getElementById('businessNameInput').value.trim();
            const addressOptionA = document.getElementById('addressOptionAInput').value.trim();
            const addressOptionB = document.getElementById('addressOptionBInput').value.trim();
            const visitTime = document.getElementById('visitTimeInput').value;
            const contactPersonName = document.getElementById('contactPersonNameInput').value.trim();
            const contactPersonPhone = document.getElementById('contactPersonPhoneInput').value.trim();
            const contactPersonEmail = document.getElementById('contactPersonEmailInput').value.trim();
            const pincode = document.getElementById('pincodeInput').value.trim();
            const statusRadio = document.querySelector('input[name="meetingStatus"]:checked');
            const status = statusRadio ? statusRadio.value : 'Follow-up Required';
            const followUpDate = document.getElementById('followupDateInput').value || null;
            const remarks = document.getElementById('remarksInput').value.trim();

            if (!businessName) {
                alert('Business Name is required.');
                document.getElementById('businessNameInput').focus();
                return;
            }

            if (status === 'Follow-up Required' && !followUpDate) {
                alert('⚠️ Next Follow-up Date is required!\n\nPlease select the Next Follow-up Date before submitting.');
                document.getElementById('followupDateInput').focus();
                return;
            }

            // STRICT DUPLICATE BUSINESS NAME PREVENTION
            const isDuplicate = await validateBusinessNameUI(businessName, false);
            if (isDuplicate || State.isBusinessNameDuplicate) {
                alert(`⛔ Submission Blocked: Duplicate Business Name!\n\nA visit for "${businessName}" already exists in the system.\n\nDuplicate business names are strictly not allowed. Please enter a unique business name.`);
                const bInput = document.getElementById('businessNameInput');
                bInput?.focus();
                bInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }

            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-75', 'cursor-not-allowed');
            submitBtnText.textContent = 'Saving Visit Record...';

            try {
                const visitPayload = {
                    sales_rep_id: selectedRepId,
                    sales_rep_name: selectedRepName,
                    employee_id: selectedEmpId,
                    business_name: businessName,
                    client_name: businessName,
                    address_option_a: addressOptionA,
                    address_option_b: addressOptionB || State.gpsAddress,
                    client_address: addressOptionA,
                    visit_time: new Date(visitTime).toISOString(),
                    latitude: State.selectedGps ? State.selectedGps.latitude : null,
                    longitude: State.selectedGps ? State.selectedGps.longitude : null,
                    location_address: addressOptionB || State.gpsAddress,
                    contact_person_name: contactPersonName,
                    contact_person_phone: contactPersonPhone,
                    contact_person_email: contactPersonEmail,
                    pincode: pincode,
                    status: status,
                    follow_up_date: followUpDate,
                    remarks: remarks,
                    visitingCardFrontFile: State.visitingCardFrontFile,
                    visitingCardBackFile: State.visitingCardBackFile,
                    officePhotoFile: State.officePhotoFile,
                    ocr_raw_text: State.ocrRawText,
                    ocr_extracted_data: State.extractedOcrData || {}
                };

                const savedRecord = await recordClientVisit(visitPayload);

                if (status === 'Successful Closed') {
                    if (window.confetti) {
                        window.confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
                    }
                    alert(`Deal Closed! Visit for "${businessName}" recorded successfully.`);
                } else if (status === 'Follow-up Required' && followUpDate) {
                    // Trigger the 11:30 AM Follow-Up Reminder Modal
                    const reminderModal = document.getElementById('followupReminderModal');
                    const reminderDateTime = document.getElementById('modalReminderDateTime');
                    const reminderBusiness = document.getElementById('modalReminderBusiness');
                    const reminderContact = document.getElementById('modalReminderContact');
                    const reminderPhone = document.getElementById('modalReminderPhone');
                    const modalIcsBtn = document.getElementById('modalDownloadIcsBtn');
                    const modalGoogleBtn = document.getElementById('modalGoogleCalBtn');
                    const closeReminderBtn = document.getElementById('closeReminderModalBtn');

                    if (reminderModal && reminderDateTime) {
                        const formattedDate = new Date(followUpDate + 'T11:30:00').toLocaleDateString('en-US', {
                            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                        });
                        reminderDateTime.textContent = `${formattedDate} at 11:30 AM`;
                        if (reminderBusiness) reminderBusiness.textContent = businessName;
                        if (reminderContact) reminderContact.textContent = contactPersonName || 'Client Representative';
                        if (reminderPhone) reminderPhone.textContent = contactPersonPhone || 'N/A';

                        const recordForCalendar = savedRecord || visitPayload;

                        if (modalIcsBtn) {
                            modalIcsBtn.onclick = () => {
                                const ics = generateIcsFollowupCalendar(recordForCalendar);
                                const bClean = businessName.replace(/[^a-zA-Z0-9]/g, '_');
                                downloadIcsFile(`Followup_${bClean}_1130AM_${followUpDate}.ics`, ics);
                            };
                        }

                        if (modalGoogleBtn) {
                            modalGoogleBtn.onclick = () => {
                                const gUrl = getGoogleCalendarUrl(recordForCalendar);
                                window.open(gUrl, '_blank');
                            };
                        }

                        if (closeReminderBtn) {
                            closeReminderBtn.onclick = () => {
                                reminderModal.classList.add('hidden');
                                switchTab('visits');
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            };
                        }

                        reminderModal.classList.remove('hidden');
                        initLucideIcons();
                    } else {
                        alert(`Visit for "${businessName}" saved! Follow-up reminder scheduled for ${followUpDate} at 11:30 AM.`);
                    }
                } else {
                    alert(`Visit for "${businessName}" recorded successfully!`);
                }

                // Cleanly Reset Form Inputs
                form.reset();
                const frontCam = document.getElementById('visitingCardFrontCameraInput');
                const frontFile = document.getElementById('visitingCardFrontFileInput');
                const backCam = document.getElementById('visitingCardBackCameraInput');
                const backFile = document.getElementById('visitingCardBackFileInput');
                const officeInput = document.getElementById('officePhotoInput');

                if (frontCam) frontCam.value = '';
                if (frontFile) frontFile.value = '';
                if (backCam) backCam.value = '';
                if (backFile) backFile.value = '';
                if (officeInput) officeInput.value = '';

                document.getElementById('visitingCardFrontPreviewImg').src = '';
                document.getElementById('visitingCardBackPreviewImg').src = '';
                document.getElementById('officePhotoPreviewImg').src = '';

                document.getElementById('frontPreviewContainer')?.classList.add('hidden');
                document.getElementById('frontEmptyState')?.classList.remove('hidden');
                document.getElementById('frontBadge')?.classList.add('hidden');

                document.getElementById('backPreviewContainer')?.classList.add('hidden');
                document.getElementById('backEmptyState')?.classList.remove('hidden');
                document.getElementById('backBadge')?.classList.add('hidden');

                document.getElementById('ocrExtractedBanner')?.classList.add('hidden');
                document.getElementById('officePhotoPreviewContainer')?.classList.add('hidden');
                document.getElementById('officePhotoBadge')?.classList.add('hidden');
                const officePhotoText = document.getElementById('officePhotoBtnText');
                if (officePhotoText) officePhotoText.innerHTML = 'Open Camera & Take Photo';

                State.visitingCardFrontFile = null;
                State.visitingCardBackFile = null;
                State.officePhotoFile = null;
                State.ocrRawText = '';
                State.extractedOcrData = { companyName: '', contactPerson: '', phone: '', email: '', pincode: '', address: '', designation: '' };

                // Cleanly reset duplicate warning & badge states
                document.getElementById('businessNameStatusBadge')?.classList.add('hidden');
                document.getElementById('duplicateBusinessWarning')?.classList.add('hidden');
                const bInput = document.getElementById('businessNameInput');
                if (bInput) {
                    bInput.classList.remove('border-rose-500', 'bg-rose-50/40', 'focus:ring-rose-500');
                    bInput.classList.add('border-slate-200', 'bg-slate-50', 'focus:ring-blue-500');
                }
                State.isBusinessNameDuplicate = false;

                setupCurrentTime();
                captureLiveGpsLocation(); // Re-fetch GPS for next visit
                initLucideIcons();
                await loadAndRenderVisits();
                if (status !== 'Follow-up Required' || !followUpDate) {
                    switchTab('visits');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }

            } catch (error) {
                console.error('Error submitting visit:', error);
                alert('Failed to record visit: ' + (error.message || 'Unknown error'));
            } finally {
                submitBtn.disabled = false;
                submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
                submitBtnText.textContent = 'Submit Visit Record';
            }
        });

        // Live manual typing listener to instantly check & prevent duplicate business names
        const businessNameInput = document.getElementById('businessNameInput');
        businessNameInput?.addEventListener('input', debounce(() => {
            validateBusinessNameUI(businessNameInput.value, false);
        }, 250));
        businessNameInput?.addEventListener('blur', () => {
            validateBusinessNameUI(businessNameInput.value, false);
        });
    }

    // --------------------------------------------------------------------------
    // DASHBOARD FILTERS & EXCEL EXPORT
    // --------------------------------------------------------------------------
    // --------------------------------------------------------------------------
    // DASHBOARD FILTERS & EXCEL EXPORT
    // --------------------------------------------------------------------------
    function setupDashboardFilters() {
        const filterSalesRep = document.getElementById('filterSalesRep');
        const filterDay = document.getElementById('filterDay');
        const filterCustomDate = document.getElementById('filterCustomDateInput');
        const filterStatus = document.getElementById('filterStatus');
        const filterSearch = document.getElementById('filterSearch');
        const filterCommonOnly = document.getElementById('filterCommonAccountsOnly');
        const refreshBtn = document.getElementById('refreshVisitsBtn');
        const exportCsvBtn = document.getElementById('exportCsvBtn');
        const exportExcelBtn = document.getElementById('exportExcelBtn');

        const handleFilterChange = () => loadAndRenderVisits();

        filterSalesRep?.addEventListener('change', handleFilterChange);
        filterStatus?.addEventListener('change', handleFilterChange);
        filterSearch?.addEventListener('input', debounce(handleFilterChange, 300));
        filterCommonOnly?.addEventListener('change', handleFilterChange);

        filterDay?.addEventListener('change', () => {
            if (filterDay.value === 'CUSTOM') {
                filterCustomDate.classList.remove('hidden');
                filterCustomDate.focus();
            } else {
                filterCustomDate.classList.add('hidden');
                handleFilterChange();
            }
        });

        filterCustomDate?.addEventListener('change', handleFilterChange);
        refreshBtn?.addEventListener('click', async () => {
            const icon = refreshBtn.querySelector('i');
            if (icon) icon.classList.add('animate-spin');
            showToastNotification('🔄 Syncing live data with central cloud...', 'refresh-cw', 2000);
            try {
                await syncLocalVisitsToCloud();
                await loadAndRenderVisits();
                const count = (State.visits || []).length;
                showToastNotification(`✅ Sync complete! ${count} visits loaded.`, 'check-circle');
            } catch (err) {
                console.error('Refresh sync error:', err);
            } finally {
                setTimeout(() => {
                    if (icon) icon.classList.remove('animate-spin');
                }, 400);
            }
        });
        exportCsvBtn?.addEventListener('click', () => exportVisitsToCsv(State.visits));
        exportExcelBtn?.addEventListener('click', () => exportVisitsToExcel(State.visits));
    }

    async function loadAndRenderVisits() {
        const filterSalesRep = document.getElementById('filterSalesRep')?.value || 'ALL';
        const filterDay = document.getElementById('filterDay')?.value || 'ALL';
        const filterCustomDate = document.getElementById('filterCustomDateInput')?.value;
        const filterStatus = document.getElementById('filterStatus')?.value || 'ALL';
        const filterSearch = document.getElementById('filterSearch')?.value || '';
        const filterCommonOnly = document.getElementById('filterCommonAccountsOnly')?.checked || false;

        let dayFilterParam = filterDay;
        if (filterDay === 'CUSTOM' && filterCustomDate) {
            dayFilterParam = `DATE:${filterCustomDate}`;
        }

        try {
            const visits = await getClientVisits({
                salesRep: filterSalesRep,
                dayFilter: dayFilterParam,
                status: filterStatus,
                search: filterSearch,
                commonOnly: filterCommonOnly
            });

            State.visits = visits;
            renderVisitsList(visits);
            updateKpiStats(visits);
        } catch (err) {
            console.error('Failed to load visits:', err);
        }
    }

    function updateKpiStats(visits) {
        const total = visits.length;
        const closed = visits.filter(v => v.status === 'Successful Closed').length;
        const followups = visits.filter(v => v.status === 'Follow-up Required').length;
        const convRate = total > 0 ? ((closed / total) * 100).toFixed(1) + '%' : '0%';
        const commonCount = visits.filter(v => State.commonAccountsMap && State.commonAccountsMap.has(normalizeBusinessName(v.business_name || v.client_name))).length;

        const totalElem = document.getElementById('statTotalVisits');
        const closedElem = document.getElementById('statClosedDeals');
        const followElem = document.getElementById('statFollowups');
        const convElem = document.getElementById('statConversionRate');
        const commonElem = document.getElementById('statCommonAccounts');

        if (totalElem) totalElem.textContent = total;
        if (closedElem) closedElem.textContent = closed;
        if (followElem) followElem.textContent = followups;
        if (convElem) convElem.textContent = convRate;
        if (commonElem) commonElem.textContent = commonCount;
    }

    function renderTodayFollowupReminders() {
        const banner = document.getElementById('followupRemindersBanner');
        const list = document.getElementById('todayFollowupList');
        const badge = document.getElementById('followupCountBadge');
        if (!banner || !list) return;

        // Current date in YYYY-MM-DD
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;

        const todayFollowups = (State.visits || []).filter(v => {
            return v.status === 'Follow-up Required' && String(v.follow_up_date || '').startsWith(todayStr);
        });

        if (todayFollowups.length === 0) {
            banner.classList.add('hidden');
            list.innerHTML = '';
            return;
        }

        if (badge) badge.textContent = `${todayFollowups.length} Due Today (11:30 AM)`;
        banner.classList.remove('hidden');

        list.innerHTML = todayFollowups.map(visit => {
            const bName = visit.business_name || visit.client_name || 'Client';
            const cleanPhone = (visit.contact_person_phone || '').replace(/[^\d+]/g, '');
            return `
                <div class="bg-white rounded-xl p-3 border border-amber-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-black text-xs flex-shrink-0 shadow-inner">
                            11:30
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="font-bold text-slate-900 text-sm">${escapeHtml(bName)}</span>
                                <span class="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">11:30 AM Reminder</span>
                            </div>
                            <div class="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                <span>Rep: <strong>${escapeHtml(visit.sales_rep_name || 'Field Rep')}</strong></span>
                                <span>•</span>
                                <span>Meet: <strong>${escapeHtml(visit.contact_person_name || 'Client')}</strong></span>
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center space-x-1.5 self-end sm:self-center flex-wrap gap-1">
                        ${cleanPhone ? `
                            <a href="tel:${cleanPhone}" class="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-semibold transition-colors" title="Call">
                                <i data-lucide="phone" class="w-3.5 h-3.5"></i> Call
                            </a>
                            <a href="https://wa.me/${cleanPhone.replace('+', '')}" target="_blank" class="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg text-xs font-semibold transition-colors" title="WhatsApp">
                                <i data-lucide="message-circle" class="w-3.5 h-3.5"></i> WhatsApp
                            </a>
                        ` : ''}
                        <button onclick="window.downloadFollowupCalendar('${visit.id}')" class="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-xs font-bold transition-colors shadow-sm" title="Download .ics alarm for phone">
                            <i data-lucide="alarm-clock" class="w-3.5 h-3.5 text-amber-700"></i> Set Phone Alarm
                        </button>
                        <button onclick="window.openGoogleCalendar('${visit.id}')" class="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors" title="Open Google Calendar">
                            <i data-lucide="external-link" class="w-3 h-3 text-blue-600"></i> Google Cal
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        initLucideIcons();
    }

    function renderVisitsList(visits) {
        const container = document.getElementById('visitsFeedContainer');
        const emptyState = document.getElementById('emptyVisitsState');

        renderTodayFollowupReminders();

        if (!container) return;

        if (!visits || visits.length === 0) {
            container.innerHTML = '';
            emptyState?.classList.remove('hidden');
            return;
        }

        emptyState?.classList.add('hidden');

        const html = visits.map(visit => {
            const isClosed = visit.status === 'Successful Closed';
            const statusBadgeClass = isClosed ? 'badge-closed' : 'badge-followup';
            const statusIcon = isClosed ? 'check-check' : 'calendar';
            const visitDate = visit.visit_time ? new Date(visit.visit_time) : new Date();
            const dateFormatted = visitDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const timeFormatted = visitDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            const hasGps = visit.latitude && visit.longitude;
            const googleMapsLink = hasGps ? getGoogleMapsUrl(visit.latitude, visit.longitude) : null;
            const cleanPhone = (visit.contact_person_phone || '').replace(/[^\d+]/g, '');
            const businessName = visit.business_name || visit.client_name || 'Business Name';
            const addrOptionA = visit.address_option_a || visit.client_address || 'Address not specified';
            const addrOptionB = visit.address_option_b || visit.location_address || '';
            const hasCardFront = Boolean(visit.visiting_card_front_url || visit.visiting_card_url);
            const hasCardBack = Boolean(visit.visiting_card_back_url);
            const hasOfficePhoto = Boolean(visit.office_photo_url);

            // Common Account Overlap Check
            const normName = normalizeBusinessName(businessName);
            const isCommon = State.commonAccountsMap && State.commonAccountsMap.has(normName);
            const commonEntry = isCommon ? State.commonAccountsMap.get(normName) : null;
            const otherReps = commonEntry
                ? Array.from(commonEntry.repNames).filter(n => n.toLowerCase() !== (visit.sales_rep_name || '').toLowerCase())
                : [];
            const otherRepsText = otherReps.join(', ');

            const cardBorderClass = isCommon
                ? 'border-2 border-purple-400 bg-gradient-to-br from-purple-50/40 via-white to-indigo-50/20 shadow-md ring-1 ring-purple-200'
                : 'border border-slate-200 shadow-sm';

            return `
                <div class="bg-white rounded-2xl p-5 ${cardBorderClass} hover:shadow-md transition-shadow space-y-4">
                    
                    ${isCommon ? `
                        <!-- Prominent Common Account Highlight Banner -->
                        <div class="p-2.5 bg-purple-100/70 border border-purple-200/80 rounded-xl text-xs text-purple-950 flex flex-col sm:flex-row sm:items-center justify-between gap-1 shadow-sm">
                            <div class="flex items-center gap-1.5 font-bold">
                                <i data-lucide="layers" class="w-4 h-4 text-purple-700 flex-shrink-0"></i>
                                <span>🏢 Common Account (Cross-Rep Client)</span>
                            </div>
                            <span class="text-[11px] text-purple-800 font-medium">
                                ${isSalesRep() ? 'Shared corporate account • Contact Admin for cross-rep coordination' : (otherRepsText ? `Also visited by: <strong>${escapeHtml(otherRepsText)}</strong>` : 'Shared across multiple sales reps')}
                            </span>
                        </div>
                    ` : ''}

                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 rounded-xl ${isCommon ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-300' : 'bg-blue-50 text-blue-600'} flex items-center justify-center font-bold text-sm">
                                ${(visit.sales_rep_name || 'SR').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="font-extrabold text-slate-900 text-base">${escapeHtml(businessName)}</span>
                                    ${isCommon ? `
                                        <span class="inline-flex items-center gap-1 text-[10px] font-extrabold bg-purple-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                                            <i data-lucide="layers" class="w-3 h-3"></i> Common
                                        </span>
                                    ` : ''}
                                </div>
                                <div class="text-xs text-slate-500 flex items-center gap-2">
                                    <span class="font-medium text-blue-600">${escapeHtml(visit.sales_rep_name)}</span>
                                    <span>•</span>
                                    <span>${dateFormatted} at ${timeFormatted}</span>
                                </div>
                            </div>
                        </div>

                        <div class="flex items-center space-x-2">
                            <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${statusBadgeClass}">
                                <i data-lucide="${statusIcon}" class="w-3.5 h-3.5"></i>
                                ${escapeHtml(visit.status)}
                            </span>
                            <button onclick="window.handleDeleteVisit('${visit.id}')" class="text-slate-400 hover:text-red-600 p-1 rounded-lg transition-colors" title="Delete Visit">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>

                    <!-- 2. NAME OF PERSON & 3. PHONE NO -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                        <div class="bg-blue-50/50 p-3 rounded-xl border border-blue-100/70">
                            <span class="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Name of Person</span>
                            <span class="font-extrabold text-slate-800 text-sm block mt-0.5">${escapeHtml(visit.contact_person_name || 'N/A')}</span>
                        </div>

                        <div class="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                            <div>
                                <span class="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Phone No</span>
                                <span class="font-bold text-slate-800 text-sm font-mono block mt-0.5">${escapeHtml(visit.contact_person_phone || 'N/A')}</span>
                            </div>
                            ${cleanPhone ? `
                                <div class="flex items-center space-x-1">
                                    <a href="tel:${cleanPhone}" class="p-2 bg-white text-blue-600 rounded-lg shadow-xs hover:bg-blue-600 hover:text-white transition-colors" title="Call">
                                        <i data-lucide="phone" class="w-4 h-4"></i>
                                    </a>
                                    <a href="https://wa.me/${cleanPhone.replace('+', '')}" target="_blank" class="p-2 bg-white text-emerald-600 rounded-lg shadow-xs hover:bg-emerald-600 hover:text-white transition-colors" title="WhatsApp">
                                        <i data-lucide="message-circle" class="w-4 h-4"></i>
                                    </a>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- 4. REMARKS -->
                    <div class="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1">
                        <span class="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">Remarks</span>
                        <p class="text-slate-700 whitespace-pre-line leading-relaxed font-medium">${escapeHtml(visit.remarks || 'No remarks provided.')}</p>
                    </div>

                    <!-- 5. NEXT FOLLOW UP DATE -->
                    <div class="p-3 rounded-xl border ${visit.follow_up_date ? 'bg-amber-50/70 border-amber-200/80' : 'bg-slate-50 border-slate-100'} flex items-center justify-between flex-wrap gap-2 text-xs">
                        <div>
                            <span class="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Next Follow Up Date</span>
                            <div class="flex items-center gap-1.5 mt-0.5">
                                <i data-lucide="calendar" class="w-3.5 h-3.5 ${visit.follow_up_date ? 'text-amber-600' : 'text-slate-400'}"></i>
                                <span class="font-extrabold ${visit.follow_up_date ? 'text-amber-900 text-sm' : 'text-slate-500'}">
                                    ${visit.follow_up_date ? `${visit.follow_up_date} (11:30 AM)` : 'None Scheduled'}
                                </span>
                            </div>
                        </div>
                        ${visit.follow_up_date ? `
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <button onclick="window.downloadFollowupCalendar('${visit.id}')" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 transition-colors shadow-xs" title="Download .ics alarm for phone">
                                    <i data-lucide="alarm-clock" class="w-3.5 h-3.5 text-amber-700"></i> Set Phone Alarm
                                </button>
                                <button onclick="window.openGoogleCalendar('${visit.id}')" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-100 hover:bg-blue-200 text-blue-900 transition-colors shadow-xs" title="Add to Google Calendar">
                                    <i data-lucide="calendar-plus" class="w-3.5 h-3.5 text-blue-700"></i> Google Cal
                                </button>
                            </div>
                        ` : ''}
                    </div>

                    <!-- ATTACHED PHOTOS & VISITING CARD -->
                    ${(hasCardFront || hasCardBack || hasOfficePhoto) ? `
                        <div class="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs">
                            <span class="text-slate-500 font-bold text-[11px] flex items-center gap-1.5">
                                <i data-lucide="image" class="w-3.5 h-3.5 text-blue-600"></i> Attached Photos:
                            </span>
                            <div class="flex items-center gap-1.5 flex-wrap">
                                ${hasCardFront ? `
                                    <button type="button" onclick="window.viewVisitPhoto('${visit.id}', 'front')" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs">
                                        <i data-lucide="credit-card" class="w-3.5 h-3.5"></i> View Visiting Card
                                    </button>
                                ` : ''}
                                ${hasCardBack ? `
                                    <button type="button" onclick="window.viewVisitPhoto('${visit.id}', 'back')" class="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-all shadow-xs">
                                        <i data-lucide="file-text" class="w-3.5 h-3.5"></i> Card Back
                                    </button>
                                ` : ''}
                                ${hasOfficePhoto ? `
                                    <button type="button" onclick="window.viewVisitPhoto('${visit.id}', 'office')" class="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold transition-all shadow-xs">
                                        <i data-lucide="camera" class="w-3.5 h-3.5"></i> Office Photo
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}

                    <!-- ADDRESS & GPS DETAILS (COLLAPSIBLE) -->
                    ${(addrOptionA !== 'Address not specified' || addrOptionB || googleMapsLink) ? `
                        <details class="text-xs text-slate-500 group">
                            <summary class="cursor-pointer text-[11px] font-semibold text-slate-400 hover:text-slate-600 select-none flex items-center gap-1 list-none">
                                <i data-lucide="chevron-right" class="w-3 h-3 transition-transform group-open:rotate-90"></i>
                                <span>View Address & GPS Details</span>
                            </summary>
                            <div class="mt-2 pl-3 border-l-2 border-slate-200 space-y-1 py-1 text-slate-600">
                                ${addrOptionA && addrOptionA !== 'Address not specified' ? `
                                    <div><span class="font-bold text-slate-700">Address (Card/Manual):</span> ${escapeHtml(addrOptionA)}</div>
                                ` : ''}
                                ${addrOptionB ? `
                                    <div><span class="font-bold text-slate-700">Location Address:</span> ${escapeHtml(addrOptionB)}</div>
                                ` : ''}
                                ${googleMapsLink ? `
                                    <div><a href="${googleMapsLink}" target="_blank" class="inline-flex items-center gap-1 text-blue-600 hover:underline font-bold"><i data-lucide="map-pin" class="w-3 h-3"></i> Open Google Maps (${visit.latitude?.toFixed(4)}, ${visit.longitude?.toFixed(4)})</a></div>
                                ` : ''}
                            </div>
                        </details>
                    ` : ''}
                </div>
            `;
        }).join('');

        container.innerHTML = html;
        initLucideIcons();
    }

    window.viewVisitPhoto = function(visitId, type) {
        const visits = State.visits || [];
        const v = visits.find(x => x.id === visitId) || (getLocalVisits().find(x => x.id === visitId));
        if (!v) {
            alert('Visit record not found.');
            return;
        }
        let url = null;
        let title = 'Visiting Card';
        if (type === 'front') {
            url = v.visiting_card_front_url || v.visiting_card_url;
            title = `Visiting Card Front - ${v.business_name || v.client_name || ''}`;
        } else if (type === 'back') {
            url = v.visiting_card_back_url;
            title = `Visiting Card Back - ${v.business_name || v.client_name || ''}`;
        } else if (type === 'office') {
            url = v.office_photo_url;
            title = `Office Photo - ${v.business_name || v.client_name || ''}`;
        }
        if (url) {
            window.openImageLightbox(url, title);
        } else {
            alert('No photo attached for this record.');
        }
    };

    window.handleDeleteVisit = async function(id) {
        if (confirm('Are you sure you want to delete this visit record?')) {
            await deleteClientVisit(id);
            await loadAndRenderVisits();
        }
    };

    // --------------------------------------------------------------------------
    // SETTINGS: SALES TEAM MANAGEMENT
    // --------------------------------------------------------------------------
    window.openAddMemberModal = function() {
        const modal = document.getElementById('addMemberModal');
        const roleSelect = document.getElementById('newMemberRoleType');
        const roleNote = document.getElementById('addMemberRoleNote');
        const roleInput = document.getElementById('newMemberRole');
        const empInput = document.getElementById('newMemberEmpId');
        const addMemberForm = document.getElementById('addMemberForm');

        if (!modal) return;

        addMemberForm?.reset();

        const team = (State.salesTeam && State.salesTeam.length) ? State.salesTeam : getLocalTeam();
        if (empInput) {
            empInput.placeholder = `EMP-${100 + team.length + 1}`;
        }

        if (roleSelect) {
            Array.from(roleSelect.options).forEach(opt => {
                opt.disabled = false;
                if (opt.value === 'sr_sales_rep') {
                    opt.textContent = '⭐ Sr. Sales Rep (All Functions Access & Team Management)';
                } else {
                    opt.textContent = '👤 Sales Rep (Field Visits & Personal Dashboard)';
                }
            });
            roleSelect.value = 'sales_rep';
        }
        if (roleNote) roleNote.classList.add('hidden');
        if (roleInput) roleInput.value = 'Sales Rep';

        modal.classList.remove('hidden');
        document.getElementById('newMemberName')?.focus();
        initLucideIcons();
    };

    window.closeAddMemberModal = function() {
        const modal = document.getElementById('addMemberModal');
        modal?.classList.add('hidden');
        document.getElementById('addMemberForm')?.reset();
    };

    function setupTeamManagement() {
        const openModalBtn = document.getElementById('openAddMemberModalBtn');
        const closeModalBtn = document.getElementById('closeAddMemberModalBtn');
        const cancelModalBtn = document.getElementById('cancelAddMemberBtn');
        const modal = document.getElementById('addMemberModal');
        const addMemberForm = document.getElementById('addMemberForm');

        openModalBtn?.addEventListener('click', window.openAddMemberModal);
        closeModalBtn?.addEventListener('click', window.closeAddMemberModal);
        cancelModalBtn?.addEventListener('click', window.closeAddMemberModal);
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) window.closeAddMemberModal();
        });

        addMemberForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('newMemberName').value.trim();
            const phone = document.getElementById('newMemberPhone').value.trim();
            const email = document.getElementById('newMemberEmail').value.trim();
            const empId = document.getElementById('newMemberEmpId').value.trim();
            const roleType = document.getElementById('newMemberRoleType')?.value || 'sales_rep';
            let roleTitle = document.getElementById('newMemberRole')?.value.trim();

            if (!name) {
                alert('Member name is required.');
                return;
            }

            if (!roleTitle) {
                roleTitle = roleType === 'sr_sales_rep' ? 'Sr. Sales Rep' : 'Sales Rep';
            }

            try {
                const createdMember = await addSalesTeamMember({
                    name,
                    phone,
                    email,
                    employee_id: empId,
                    role_type: roleType,
                    designation: roleTitle,
                    is_active: true
                });
                window.closeAddMemberModal();
                await loadSalesTeam();
                renderSalesTeamSettings();
                if (typeof renderAdminPanelData === 'function') {
                    renderAdminPanelData();
                }
                populateSalesTeamDropdowns();

                if (roleType === 'sales_rep') {
                    window.showNewRepLinkModal(createdMember);
                } else {
                    alert(`⭐ Sr. Sales Rep "${name}" (${roleTitle}) added successfully with full executive access!`);
                }
            } catch (err) {
                alert('Failed to add member: ' + err.message);
            }
        });
    }

    function renderSalesTeamSettings() {
        const container = document.getElementById('teamMembersList');
        const countBadge = document.getElementById('teamCountBadge');

        if (!container) return;

        if (countBadge) {
            countBadge.textContent = `${State.salesTeam.length} Members`;
        }

        if (State.salesTeam.length === 0) {
            container.innerHTML = `
                <div class="p-8 text-center text-slate-400 text-sm">
                    No sales team members found. Click "Add Sales Person" to create one.
                </div>
            `;
            return;
        }

        const currentUserIsSrRep = isSrSalesRep();
        const currentUserIsExecutiveAdmin = isExecutiveAdmin();

        State.salesTeam = deduplicateAndCleanTeam(State.salesTeam);

        const html = State.salesTeam.map(member => {
            const cleanName = sanitizeRepName(member.name, member.employee_id, member.id);
            const cleanEmpId = member.employee_id || (cleanName === 'Supriya Yadav' ? 'EMP-102' : (cleanName === 'Kalyani Mundada' ? 'EMP-103' : 'EMP-101'));
            const isMemberSrRep = member.role_type === 'sr_sales_rep';
            const roleLabel = isMemberSrRep ? 'Sr. Sales Rep' : 'Sales Rep';
            const roleBadge = isMemberSrRep
                ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                     <i data-lucide="award" class="w-3.5 h-3.5 text-purple-600"></i> Sr. Sales Rep
                   </span>`
                : `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                     <i data-lucide="user" class="w-3.5 h-3.5 text-blue-500"></i> Sales Rep
                   </span>`;

            const repQuickLinkBtns = !isMemberSrRep ? `
                <button type="button" onclick="window.copyRepPortalLink('${member.id}', '${escapeHtml(cleanName)}')" class="text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-xs" title="Copy dedicated locked portal link">
                    <i data-lucide="link" class="w-3 h-3"></i> Link
                </button>
                <button type="button" onclick="window.shareRepLinkWhatsapp('${member.id}', '${escapeHtml(cleanName)}', '${escapeHtml(member.phone || '')}')" class="text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-xs" title="Send dedicated link via WhatsApp">
                    <i data-lucide="send" class="w-3 h-3"></i> WA
                </button>
            ` : '';

            // Action buttons:
            // Admin can edit and delete anyone (including the Sr. Sales Rep)
            // Sr. Sales Rep can ONLY delete regular Sales Reps; Sr. Sales Rep row requires Admin mode (PIN: 1234) to edit
            let actionButtonHtml = '';
            if (currentUserIsExecutiveAdmin) {
                actionButtonHtml = `
                    <div class="flex items-center justify-end space-x-1.5 flex-wrap gap-y-1">
                        ${repQuickLinkBtns}
                        <button onclick="window.openEditMemberModal('${member.id}')" class="text-slate-500 hover:text-purple-700 p-1.5 rounded-xl hover:bg-purple-50 transition-colors" title="Edit Member Name & Details">
                            <i data-lucide="pencil" class="w-4 h-4"></i>
                        </button>
                        <button onclick="window.handleDeleteTeamMember('${member.id}', '${escapeHtml(cleanName)}')" class="text-slate-400 hover:text-red-600 p-1.5 rounded-xl hover:bg-red-50 transition-colors" title="Delete Member">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                `;
            } else if (currentUserIsSrRep) {
                if (isMemberSrRep) {
                    actionButtonHtml = `
                        <div class="flex items-center justify-end space-x-1.5">
                            <button onclick="window.promptManagerPin(() => window.openEditMemberModal('${member.id}'))" class="text-xs text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors shadow-xs" title="Unlock Admin Mode (PIN: 1234) to edit Sr. Sales Rep Name">
                                <i data-lucide="lock" class="w-3 h-3"></i> Edit (Admin)
                            </button>
                            <span class="inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-100 px-2 py-1 rounded-lg font-medium" title="Only Admin can delete a Sr. Sales Rep">
                                <i data-lucide="shield" class="w-3 h-3 text-slate-400"></i> Protected
                            </span>
                        </div>
                    `;
                } else {
                    actionButtonHtml = `
                        <div class="flex items-center justify-end space-x-1.5 flex-wrap gap-y-1">
                            ${repQuickLinkBtns}
                            <button onclick="window.openEditMemberModal('${member.id}')" class="text-slate-500 hover:text-purple-700 p-1.5 rounded-xl hover:bg-purple-50 transition-colors" title="Edit ${escapeHtml(cleanName)}">
                                <i data-lucide="pencil" class="w-4 h-4"></i>
                            </button>
                            <button onclick="window.handleDeleteTeamMember('${member.id}', '${escapeHtml(cleanName)}')" class="text-slate-400 hover:text-red-600 p-1.5 rounded-xl hover:bg-red-50 transition-colors" title="Delete Sales Rep">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    `;
                }
            }

            return `
                <div class="p-4 sm:px-6 hover:bg-slate-50/70 transition-colors grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-2 items-center">
                    <!-- Column 1: Member Name & ID (col-span-4) -->
                    <div class="sm:col-span-4 flex items-center space-x-3">
                        <div class="w-10 h-10 rounded-xl ${isMemberSrRep ? 'bg-purple-100 text-purple-700 font-bold' : 'bg-blue-100 text-blue-700 font-bold'} flex items-center justify-center text-sm shadow-sm shrink-0">
                            ${(cleanName || 'SR').slice(0, 2).toUpperCase()}
                        </div>
                        <div class="min-w-0">
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <span class="font-bold text-slate-900 text-sm truncate">${escapeHtml(cleanName)}</span>
                                ${cleanEmpId ? `<span class="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">${escapeHtml(cleanEmpId)}</span>` : ''}
                            </div>
                            <div class="text-[11px] text-slate-400 truncate">${escapeHtml(member.email || (cleanName === 'Supriya Yadav' ? 'supriya.yadav@example.com' : (cleanName === 'Kalyani Mundada' ? 'kalyani.mundada@example.com' : 'kapil.todi@gmail.com')))}</div>
                        </div>
                    </div>

                    <!-- Column 2: Role / Access Level (col-span-3) -->
                    <div class="sm:col-span-3 flex items-center">
                        <div class="space-y-0.5">
                            ${roleBadge}
                            ${member.designation && member.designation !== roleLabel ? `<div class="text-[10px] text-slate-400 pl-1">${escapeHtml(member.designation)}</div>` : ''}
                        </div>
                    </div>

                    <!-- Column 3: Contact Phone (col-span-3) -->
                    <div class="sm:col-span-3 text-xs text-slate-600">
                        <div class="font-mono text-[11px]">${escapeHtml(member.phone || (cleanName === 'Supriya Yadav' ? '+91 98765 43211' : (cleanName === 'Kalyani Mundada' ? '+91 98765 43212' : '+91 97696 61978')))}</div>
                        <div class="text-[10px] text-slate-400">Added ${new Date(member.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    </div>

                    <!-- Column 4: Actions (col-span-2 text-right) -->
                    <div class="sm:col-span-2 flex items-center justify-end">
                        ${actionButtonHtml}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
        renderRepPortalLinks();
        initLucideIcons();
    }

    window.handleDeleteTeamMember = async function(id, name) {
        const reps = (State.salesTeam && State.salesTeam.length) ? State.salesTeam : getLocalTeam();
        const target = reps.find(m => m.id === id);

        if (isSrSalesRep()) {
            if (target && target.role_type === 'sr_sales_rep') {
                alert('⛔ Permission Denied: Sr. Sales Reps can only delete regular Sales Reps. Sr. Sales Reps can only be removed by Admin.');
                return;
            }
        }

        if (confirm(`Are you sure you want to delete sales person "${name}"?`)) {
            try {
                await deleteSalesTeamMember(id);
                await loadSalesTeam();
                alert(`Sales person "${name}" was deleted successfully.`);
            } catch (err) {
                alert('Failed to delete member: ' + err.message);
            }
        }
    };

    window.openEditMemberModal = function(memberId) {
        const reps = (State.salesTeam && State.salesTeam.length) ? State.salesTeam : getLocalTeam();
        const member = reps.find(m => m.id === memberId);
        if (!member) {
            alert('Sales team member not found.');
            return;
        }

        // Security check: If target is Sr. Sales Rep and user is not Executive Admin, prompt for Admin PIN
        if (member.role_type === 'sr_sales_rep' && !isExecutiveAdmin()) {
            promptManagerPin(() => {
                updateUserSessionUI();
                window.openEditMemberModal(memberId);
            });
            return;
        }

        const modal = document.getElementById('editMemberModal');
        const idInput = document.getElementById('editMemberId');
        const nameInput = document.getElementById('editMemberName');
        const phoneInput = document.getElementById('editMemberPhone');
        const emailInput = document.getElementById('editMemberEmail');
        const empIdInput = document.getElementById('editMemberEmpId');
        const roleTypeSelect = document.getElementById('editMemberRoleType');
        const designationInput = document.getElementById('editMemberRole');
        const modalTitle = document.getElementById('editMemberModalTitle');

        if (!modal) return;

        if (idInput) idInput.value = member.id;
        const cleanMemberName = sanitizeRepName(member.name, member.employee_id, member.id);
        const cleanMemberEmpId = member.employee_id || (cleanMemberName === 'Supriya Yadav' ? 'EMP-102' : (cleanMemberName === 'Kalyani Mundada' ? 'EMP-103' : 'EMP-101'));
        if (nameInput) nameInput.value = cleanMemberName;
        if (phoneInput) phoneInput.value = member.phone || '';
        if (emailInput) emailInput.value = member.email || '';
        if (empIdInput) empIdInput.value = cleanMemberEmpId;
        if (roleTypeSelect) roleTypeSelect.value = member.role_type || 'sales_rep';
        if (designationInput) designationInput.value = member.designation || (member.role_type === 'sr_sales_rep' ? 'Sr. Sales Rep' : 'Sales Rep');

        if (modalTitle) {
            modalTitle.textContent = member.role_type === 'sr_sales_rep' ? 'Edit Sr. Sales Rep Name & Details' : 'Edit Sales Rep Details';
        }

        modal.classList.remove('hidden');
        nameInput?.focus();
        nameInput?.select();
        initLucideIcons();
    };

    function setupEditMemberModal() {
        const modal = document.getElementById('editMemberModal');
        const closeBtn = document.getElementById('closeEditMemberModalBtn');
        const cancelBtn = document.getElementById('cancelEditMemberBtn');
        const form = document.getElementById('editMemberForm');

        const closeModal = () => modal?.classList.add('hidden');
        closeBtn?.addEventListener('click', closeModal);
        cancelBtn?.addEventListener('click', closeModal);
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('editMemberId')?.value;
            const name = document.getElementById('editMemberName')?.value.trim();
            const phone = document.getElementById('editMemberPhone')?.value.trim();
            const email = document.getElementById('editMemberEmail')?.value.trim();
            const empId = document.getElementById('editMemberEmpId')?.value.trim();
            const roleType = document.getElementById('editMemberRoleType')?.value || 'sales_rep';
            let designation = document.getElementById('editMemberRole')?.value.trim();

            if (!name) {
                alert('Member name is required.');
                return;
            }

            if (!designation) {
                designation = roleType === 'sr_sales_rep' ? 'Sr. Sales Rep' : 'Sales Rep';
            }

            try {
                const updated = await updateSalesTeamMember(id, {
                    name, phone, email, employee_id: empId, role_type: roleType, designation
                });
                closeModal();
                await loadSalesTeam();
                await loadAndRenderVisits();
                if (typeof renderAdminPanelData === 'function') {
                    renderAdminPanelData();
                }
                renderSalesTeamSettings();
                populateSalesTeamDropdowns();
                if (updated.role_type === 'sales_rep') {
                    window.showNewRepLinkModal(updated);
                } else {
                    alert(`✅ Successfully updated ${updated.name} (${updated.designation || updated.role_type})!`);
                }
            } catch (err) {
                alert('Failed to update member: ' + err.message);
            }
        });
    }

    // --------------------------------------------------------------------------
    // SETTINGS: SUPABASE CLOUD CONNECTION
    // --------------------------------------------------------------------------
    function setupSupabaseConfig() {
        const configForm = document.getElementById('supabaseConfigForm');
        const urlInput = document.getElementById('configUrlInput');
        const keyInput = document.getElementById('configKeyInput');
        const alertBox = document.getElementById('connectionStatusAlert');
        const clearBtn = document.getElementById('clearConfigBtn');
        const copySqlBtn = document.getElementById('copySqlSchemaBtn');

        if (urlInput) urlInput.value = AppConfig.supabaseUrl || '';
        if (keyInput) keyInput.value = AppConfig.supabaseAnonKey || '';

        configForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const url = urlInput.value.trim();
            const key = keyInput.value.trim();

            alertBox.className = 'p-3 rounded-xl text-xs bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-2';
            alertBox.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Testing Supabase connection...';
            alertBox.classList.remove('hidden');
            initLucideIcons();

            const testResult = await testSupabaseConnection(url, key);

            if (testResult.success) {
                AppConfig.saveConfig(url, key);
                reinitSupabase();

                alertBox.className = 'p-3 rounded-xl text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-2';
                alertBox.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4 text-emerald-600"></i> ${testResult.message}`;
                updateConnectionIndicator();

                await loadSalesTeam();
                await loadAndRenderVisits();
            } else {
                alertBox.className = 'p-3 rounded-xl text-xs bg-red-50 text-red-800 border border-red-200 flex items-center gap-2';
                alertBox.innerHTML = `<i data-lucide="alert-triangle" class="w-4 h-4 text-red-600"></i> ${testResult.message}`;
            }
            initLucideIcons();
        });

        clearBtn?.addEventListener('click', () => {
            if (confirm('Disconnect Supabase and switch back to local browser demo mode?')) {
                AppConfig.clearConfig();
                reinitSupabase();
                if (urlInput) urlInput.value = '';
                if (keyInput) keyInput.value = '';
                alertBox.classList.add('hidden');
                updateConnectionIndicator();
                loadSalesTeam();
                loadAndRenderVisits();
            }
        });

        copySqlBtn?.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(EMBEDDED_SQL_SCHEMA);
                copySqlBtn.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-600"></i> Copied to Clipboard!';
                setTimeout(() => {
                    copySqlBtn.innerHTML = '<i data-lucide="copy" class="w-3.5 h-3.5"></i> Copy SQL Schema';
                    initLucideIcons();
                }, 2500);
            } catch (e) {
                alert('Copied schema to clipboard.');
            }
        });
    }

    function updateConnectionIndicator() {
        const badge = document.getElementById('connectionBadge');
        if (!badge) return;

        if (AppConfig.isConfigured()) {
            badge.className = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800';
            badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1"></span> Supabase Connected';
        } else {
            badge.className = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800';
            badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1 animate-pulse"></span> Demo Mode';
        }
    }

    function updateCloudSyncBanner() {
        const banner = document.getElementById('cloudSyncStatusBanner');
        if (!banner) return;
        const iconBadge = document.getElementById('cloudSyncIconBadge');
        const title = document.getElementById('cloudSyncStatusTitle');
        const desc = document.getElementById('cloudSyncStatusDesc');
        const typeBadge = document.getElementById('cloudSyncDeviceTypeBadge');

        if (AppConfig.isConfigured()) {
            banner.className = 'p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-emerald-950 shadow-xs';
            if (iconBadge) {
                iconBadge.className = 'w-8 h-8 rounded-xl bg-emerald-200/80 text-emerald-800 flex items-center justify-center shrink-0';
                iconBadge.innerHTML = '<i data-lucide="cloud" class="w-4 h-4 text-emerald-700"></i>';
            }
            if (title) title.textContent = '🟢 Live Supabase Cloud Sync Active';
            if (typeBadge) {
                typeBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200/60 text-emerald-900 border border-emerald-300';
                typeBadge.textContent = 'Live Multi-Device';
            }
            if (desc) desc.textContent = 'Visits and photos are synchronized automatically across all Android phones, iPhones, and PC.';
        } else {
            banner.className = 'p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-xs';
            if (iconBadge) {
                iconBadge.className = 'w-8 h-8 rounded-xl bg-amber-200/80 text-amber-800 flex items-center justify-center shrink-0';
                iconBadge.innerHTML = '<i data-lucide="cloud-off" class="w-4 h-4"></i>';
            }
            if (title) title.textContent = 'Single-Device Local Storage (Offline Mode)';
            if (typeBadge) {
                typeBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/60 text-amber-900 border border-amber-300';
                typeBadge.textContent = 'This Device';
            }
            if (desc) desc.textContent = 'Visits recorded on this device stay in this browser. To see visits live on your PC, connect Supabase Cloud or use Sync / Transfer.';
        }
        initLucideIcons();
    }
    window.updateCloudSyncBanner = updateCloudSyncBanner;

    async function syncLocalVisitsToCloud() {
        try {
            const local = getLocalVisits();
            const idbVisits = (await getVisitsFromIndexedDB()) || [];
            const map = new Map();
            local.forEach(v => map.set(v.id, v));
            idbVisits.forEach(v => map.set(v.id, v));
            const allToSync = Array.from(map.values()).filter(v => v.id && !v.id.startsWith('mock-') && !v.id.startsWith('visit-10'));
            if (allToSync.length === 0) return { count: 0 };

            // Check what is already on server
            const serverVisits = (await CloudDB.getVisits()) || [];
            const serverIds = new Set(serverVisits.map(s => String(s.id)));

            let syncedCount = 0;
            for (const v of allToSync) {
                if (!serverIds.has(String(v.id))) {
                    const saved = await CloudDB.saveVisit(v);
                    if (saved) {
                        syncedCount++;
                        serverIds.add(String(v.id));
                    }
                }
            }
            if (syncedCount > 0) {
                showToastNotification(`☁️ Synced ${syncedCount} visits to central cloud database!`, 'cloud');
            }
            return { count: syncedCount };
        } catch (e) {
            console.warn('Sync error:', e);
            return { count: 0 };
        }
    }
    window.syncLocalVisitsToCloud = syncLocalVisitsToCloud;

    window.openDataTransferModal = function() {
        const modal = document.getElementById('dataTransferModal');
        modal?.classList.remove('hidden');
        initLucideIcons();
    };

    window.closeDataTransferModal = function() {
        const modal = document.getElementById('dataTransferModal');
        modal?.classList.add('hidden');
    };

    window.exportVisitsBackupJson = async function() {
        const idb = (await getVisitsFromIndexedDB()) || [];
        const local = getLocalVisits() || [];
        const map = new Map();
        local.forEach(v => map.set(v.id, v));
        idb.forEach(v => map.set(v.id, v));
        const all = Array.from(map.values());

        const exportPayload = {
            app: 'SalesERP',
            version: '2.5.1',
            export_time: new Date().toISOString(),
            exported_by: State.currentUser?.name || 'User',
            visits: all
        };

        const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
        triggerBlobDownload(blob, `sales_visits_backup_${new Date().toISOString().split('T')[0]}.json`);
        showToastNotification('📥 Backup downloaded! Transfer this file to your PC.', 'download');
    };

    window.copyVisitsBackupText = async function() {
        const idb = (await getVisitsFromIndexedDB()) || [];
        const local = getLocalVisits() || [];
        const map = new Map();
        local.forEach(v => map.set(v.id, v));
        idb.forEach(v => map.set(v.id, v));
        const all = Array.from(map.values());

        const exportPayload = {
            app: 'SalesERP',
            version: '2.5.1',
            visits: all
        };

        const jsonStr = JSON.stringify(exportPayload);
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(jsonStr);
                alert('📋 Data copied to clipboard!\n\nYou can now paste it into WhatsApp Web or Email to transfer to your PC.');
                return;
            } catch (e) {}
        }
        prompt('Copy this backup text and send it to your PC:', jsonStr);
    };

    window.importVisitsFromJsonFile = async function(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const parsed = JSON.parse(e.target.result);
                const visitsToImport = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.visits) ? parsed.visits : null);
                if (!visitsToImport || !visitsToImport.length) {
                    alert('Invalid backup file: no visits found in the selected file.');
                    return;
                }

                const currentLocal = getLocalVisits();
                const map = new Map();
                currentLocal.forEach(v => map.set(v.id, sanitizeVisitRecord(v)));
                visitsToImport.forEach(v => map.set(v.id, sanitizeVisitRecord(v)));
                const merged = Array.from(map.values()).sort((a, b) => new Date(b.visit_time || 0) - new Date(a.visit_time || 0));

                saveLocalVisits(merged);
                await saveVisitsToIndexedDB(merged);

                if (AppConfig.isConfigured()) {
                    await syncLocalVisitsToCloud();
                }

                await loadAndRenderVisits();
                window.closeDataTransferModal();
                alert(`✅ Success! Imported ${visitsToImport.length} visits into this device. Dashboard updated!`);
            } catch (err) {
                alert('Failed to parse file: ' + err.message);
            }
        };
        reader.readAsText(file);
    };

    window.importVisitsFromTextInput = async function() {
        const input = document.getElementById('importJsonTextInput');
        const text = (input?.value || '').trim();
        if (!text) {
            alert('Please paste the backup text or code first.');
            return;
        }
        try {
            const parsed = JSON.parse(text);
            const visitsToImport = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.visits) ? parsed.visits : null);
            if (!visitsToImport || !visitsToImport.length) {
                alert('Invalid data: no visits found.');
                return;
            }

            const currentLocal = getLocalVisits();
            const map = new Map();
            currentLocal.forEach(v => map.set(v.id, sanitizeVisitRecord(v)));
            visitsToImport.forEach(v => map.set(v.id, sanitizeVisitRecord(v)));
            const merged = Array.from(map.values()).sort((a, b) => new Date(b.visit_time || 0) - new Date(a.visit_time || 0));

            saveLocalVisits(merged);
            await saveVisitsToIndexedDB(merged);

            if (AppConfig.isConfigured()) {
                await syncLocalVisitsToCloud();
            }

            await loadAndRenderVisits();
            window.closeDataTransferModal();
            alert(`✅ Success! Imported ${visitsToImport.length} visits into this device. Dashboard updated!`);
        } catch (err) {
            alert('Invalid JSON text: ' + err.message);
        }
    };

    window.openCloudSetupModal = function() {
        const modal = document.getElementById('cloudSetupModal');
        const urlInput = document.getElementById('quickDbUrlInput');
        const keyInput = document.getElementById('quickDbKeyInput');
        if (urlInput) urlInput.value = AppConfig.supabaseUrl || '';
        if (keyInput) keyInput.value = AppConfig.supabaseAnonKey || '';
        modal?.classList.remove('hidden');
        initLucideIcons();
    };

    window.closeCloudSetupModal = function() {
        const modal = document.getElementById('cloudSetupModal');
        modal?.classList.add('hidden');
    };

    function setupDataTransferAndCloudModals() {
        const fileInput = document.getElementById('importJsonFileInput');
        fileInput?.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                window.importVisitsFromJsonFile(e.target.files[0]);
            }
        });

        const cloudForm = document.getElementById('quickCloudSetupForm');
        cloudForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const url = (document.getElementById('quickDbUrlInput')?.value || '').trim();
            const key = (document.getElementById('quickDbKeyInput')?.value || '').trim();
            const alertBox = document.getElementById('quickCloudAlert');
            const submitBtn = document.getElementById('saveQuickCloudBtn');

            if (!url || !key) {
                alert('Please provide both Project URL and Anon Key.');
                return;
            }

            if (alertBox) {
                alertBox.className = 'p-3 rounded-xl text-xs bg-purple-50 text-purple-800 border border-purple-200 flex items-center gap-2';
                alertBox.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin text-purple-600"></i> Testing Supabase connection...';
                alertBox.classList.remove('hidden');
                initLucideIcons();
            }

            if (submitBtn) submitBtn.disabled = true;

            const res = await testSupabaseConnection(url, key);

            if (submitBtn) submitBtn.disabled = false;

            if (res.success) {
                AppConfig.saveConfig(url, key);
                reinitSupabase();

                const confUrl = document.getElementById('configUrlInput');
                const confKey = document.getElementById('configKeyInput');
                const adminUrl = document.getElementById('adminDbUrlInput');
                const adminKey = document.getElementById('adminDbKeyInput');
                if (confUrl) confUrl.value = url;
                if (confKey) confKey.value = key;
                if (adminUrl) adminUrl.value = url;
                if (adminKey) adminKey.value = key;

                updateConnectionIndicator();
                updateCloudSyncBanner();
                renderAdminPanelData();

                // Sync existing local visits to cloud
                const syncRes = await syncLocalVisitsToCloud();
                await loadSalesTeam();
                await loadAndRenderVisits();

                window.closeCloudSetupModal();
                alert(`🎉 Connected to Supabase Cloud Successfully!\n\nMulti-device live sync is now active between PC and Android phones.${syncRes.count > 0 ? `\nSynced ${syncRes.count} existing local visits to the cloud database.` : ''}`);
            } else {
                if (alertBox) {
                    alertBox.className = 'p-3 rounded-xl text-xs bg-rose-50 text-rose-800 border border-rose-200';
                    alertBox.textContent = res.message || 'Connection failed.';
                    alertBox.classList.remove('hidden');
                }
            }
        });
    }

    // --------------------------------------------------------------------------
    // LIGHTBOX MODAL
    // --------------------------------------------------------------------------
    function setupLightbox() {
        const modal = document.getElementById('imageLightboxModal');
        const closeBtn = document.getElementById('closeLightboxBtn');

        closeBtn?.addEventListener('click', () => modal?.classList.add('hidden'));
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
                modal.classList.add('hidden');
            }
        });
    }

    window.openImageLightbox = function(imageUrl, title = 'Visiting Card / Photo View') {
        const modal = document.getElementById('imageLightboxModal');
        const img = document.getElementById('lightboxImage');
        const iframe = document.getElementById('lightboxPdfFrame');
        const titleElem = document.getElementById('lightboxTitle');
        const downloadBtn = document.getElementById('lightboxDownloadBtn');

        if (!modal || !imageUrl) return;

        if (titleElem) titleElem.textContent = title;
        if (downloadBtn) {
            downloadBtn.href = imageUrl;
            downloadBtn.classList.remove('hidden');
        }

        const isPdf = imageUrl.toLowerCase().includes('.pdf') || imageUrl.startsWith('data:application/pdf');

        if (isPdf && iframe) {
            img?.classList.add('hidden');
            iframe.src = imageUrl;
            iframe.classList.remove('hidden');
        } else if (img) {
            iframe?.classList.add('hidden');
            img.src = imageUrl;
            img.classList.remove('hidden');
        }

        modal.classList.remove('hidden');
        initLucideIcons();
    };

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    }

    // --------------------------------------------------------------------------
    // EXECUTIVE MASTER ADMIN PANEL CONTROLLER & LOGIC
    // --------------------------------------------------------------------------
    window.openAdminAccessPanel = function() {
        if (guardAgainstLockedRep('Admin Control Panel')) return;
        if (isManagerOrAdmin()) {
            showAdminAccessPanelModal();
        } else {
            promptManagerPin(() => {
                updateUserSessionUI();
                showAdminAccessPanelModal();
            }, 'Admin Panel Authorization', 'Enter your 4-digit Admin PIN to open the Admin Control Center (Default: 1234).');
        }
    };

    function showAdminAccessPanelModal() {
        const modal = document.getElementById('adminAccessPanelModal');
        if (!modal) return;

        renderAdminPanelData();
        modal.classList.remove('hidden');
        initLucideIcons();
    }

    window.closeAdminAccessPanel = function() {
        const modal = document.getElementById('adminAccessPanelModal');
        modal?.classList.add('hidden');
    };

    window.adminSwitchTab = function(tabName) {
        const tabs = ['overview', 'team', 'database', 'security'];
        tabs.forEach(t => {
            const cap = t.charAt(0).toUpperCase() + t.slice(1);
            const sec = document.getElementById('adminSec' + cap);
            const pill = document.getElementById('adminPill' + cap);
            if (sec) {
                if (t === tabName) {
                    sec.classList.remove('hidden');
                } else {
                    sec.classList.add('hidden');
                }
            }
            if (pill) {
                if (t === tabName) {
                    pill.className = 'admin-pill px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-purple-700 text-white shadow-sm flex items-center gap-1.5 shrink-0';
                } else {
                    pill.className = 'admin-pill px-3 py-1.5 rounded-xl text-xs font-medium transition-all text-purple-900 hover:bg-purple-100 flex items-center gap-1.5 shrink-0';
                }
            }
        });
        initLucideIcons();
    };

    function renderAdminPanelData() {
        const reps = (State.salesTeam && State.salesTeam.length) ? State.salesTeam : getLocalTeam();
        const visits = (State.visits && State.visits.length) ? State.visits : getLocalVisits();

        // 1. KPI Stats
        const statVisits = document.getElementById('adminStatTotalVisits');
        const statSrRep = document.getElementById('adminStatSrRepName');
        const statTeam = document.getElementById('adminStatTeamCount');
        const statDb = document.getElementById('adminStatSupabaseStatus');
        const dbBadge = document.getElementById('adminDbStatusBadge');

        if (statVisits) statVisits.textContent = String(visits.length);
        if (statTeam) statTeam.textContent = String(reps.length);

        // Find Sr. Sales Rep
        const srMember = reps.find(m => m.role_type === 'sr_sales_rep');
        if (statSrRep) {
            statSrRep.textContent = srMember ? srMember.name : 'Not Designated';
        }

        // Sr Rep Card in Team Tab
        const srCardName = document.getElementById('adminSrRepCardName');
        const srCardRole = document.getElementById('adminSrRepCardRole');
        const srCardEmpId = document.getElementById('adminSrRepCardEmpId');

        if (srCardName) srCardName.textContent = srMember ? srMember.name : 'No Sr. Sales Rep Designated';
        if (srCardRole) srCardRole.textContent = srMember ? (srMember.designation || 'Sr. Sales Rep') : '-';
        if (srCardEmpId) srCardEmpId.textContent = srMember ? (srMember.employee_id || 'SR-00') : '-';

        // Supabase Status
        const isDbConnected = AppConfig.isConfigured();
        if (statDb) {
            statDb.textContent = isDbConnected ? 'Supabase Connected' : 'Demo (LocalStorage)';
            statDb.className = isDbConnected ? 'text-xs font-black text-emerald-700 block truncate' : 'text-xs font-black text-slate-900 block truncate';
        }
        if (dbBadge) {
            dbBadge.textContent = isDbConnected ? '🟢 Live PostgreSQL Connected' : 'Demo (LocalStorage)';
            dbBadge.className = isDbConnected
                ? 'text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200';
        }

        // Database Inputs
        const urlInput = document.getElementById('adminDbUrlInput');
        const keyInput = document.getElementById('adminDbKeyInput');
        if (urlInput) urlInput.value = AppConfig.supabaseUrl || '';
        if (keyInput) keyInput.value = AppConfig.supabaseAnonKey || '';

        // 2. Team Directory Table
        const teamContainer = document.getElementById('adminTeamMembersList');
        if (teamContainer) {
            const cleanReps = deduplicateAndCleanTeam(reps);
            if (cleanReps.length === 0) {
                teamContainer.innerHTML = `
                    <div class="p-8 text-center text-slate-400 text-sm">
                        No team members registered. Click "Add Member" to onboard sales reps.
                    </div>
                `;
            } else {
                teamContainer.innerHTML = cleanReps.map(m => {
                    const cleanName = sanitizeRepName(m.name, m.employee_id, m.id);
                    const cleanEmpId = m.employee_id || (cleanName === 'Supriya Yadav' ? 'EMP-102' : (cleanName === 'Kalyani Mundada' ? 'EMP-103' : 'EMP-101'));
                    const isSr = m.role_type === 'sr_sales_rep';
                    const repVisits = visits.filter(v => v.sales_rep_id === m.id || v.sales_rep_name === cleanName || v.sales_rep_name === m.name);
                    const roleBadge = isSr
                        ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                             <i data-lucide="award" class="w-3.5 h-3.5 text-purple-600"></i> Sr. Sales Rep
                           </span>`
                        : `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                             <i data-lucide="user" class="w-3.5 h-3.5 text-blue-500"></i> Sales Rep
                           </span>`;

                    return `
                        <div class="p-3.5 sm:px-5 hover:bg-slate-50 transition-colors grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-1 items-center">
                            <!-- Member Name & ID -->
                            <div class="sm:col-span-4 flex items-center space-x-2.5">
                                <div class="w-9 h-9 rounded-xl ${isSr ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'} flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                                    ${(cleanName || 'SR').slice(0, 2).toUpperCase()}
                                </div>
                                <div class="min-w-0">
                                    <div class="flex items-center gap-1.5 flex-wrap">
                                        <h5 class="text-xs font-bold text-slate-900 truncate">${escapeHtml(cleanName)}</h5>
                                        ${isSr ? '<span class="text-[9px] bg-purple-600 text-white font-bold px-1.5 py-0.2 rounded">SR</span>' : ''}
                                    </div>
                                    <p class="text-[10px] text-slate-500 font-mono">ID: ${escapeHtml(cleanEmpId)}</p>
                                </div>
                            </div>

                            <!-- Role & Visits -->
                            <div class="sm:col-span-3">
                                <div class="flex items-center gap-1 flex-wrap">
                                    ${roleBadge}
                                    <span class="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                                        ${repVisits.length} visits
                                    </span>
                                </div>
                            </div>

                            <!-- Contact -->
                            <div class="sm:col-span-3 text-xs text-slate-600 space-y-0.5">
                                <div class="flex items-center gap-1 truncate text-[11px]">
                                    <i data-lucide="phone" class="w-3 h-3 text-slate-400 shrink-0"></i>
                                    <span>${escapeHtml(m.phone || '-')}</span>
                                </div>
                                <div class="flex items-center gap-1 truncate text-[10px] text-slate-500">
                                    <i data-lucide="mail" class="w-3 h-3 text-slate-400 shrink-0"></i>
                                    <span>${escapeHtml(m.email || '-')}</span>
                                </div>
                            </div>

                            <!-- Admin Actions -->
                            <div class="sm:col-span-2 flex items-center justify-end space-x-1">
                                ${!isSr ? `
                                    <button type="button" onclick="window.copyRepPortalLink('${m.id}', '${escapeHtml(cleanName)}')" class="text-blue-600 hover:text-blue-800 p-1.5 rounded-lg hover:bg-blue-50 transition-colors" title="Copy dedicated rep portal link">
                                        <i data-lucide="link" class="w-4 h-4"></i>
                                    </button>
                                    <button type="button" onclick="window.shareRepLinkWhatsapp('${m.id}', '${escapeHtml(cleanName)}', '${escapeHtml(m.phone || '')}')" class="text-emerald-600 hover:text-emerald-800 p-1.5 rounded-lg hover:bg-emerald-50 transition-colors" title="Send dedicated link via WhatsApp">
                                        <i data-lucide="send" class="w-4 h-4"></i>
                                    </button>
                                ` : ''}
                                <button type="button" onclick="window.openEditMemberModal('${m.id}')" class="text-slate-500 hover:text-purple-700 p-1.5 rounded-lg hover:bg-purple-50 transition-colors" title="Edit ${escapeHtml(cleanName)}">
                                    <i data-lucide="pencil" class="w-4 h-4"></i>
                                </button>
                                <button type="button" onclick="window.handleDeleteTeamMember('${m.id}', '${escapeHtml(cleanName)}')" class="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Delete Member">
                                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        // 3. Persona Switcher Rep Select
        const personaSelect = document.getElementById('adminPersonaRepSelect');
        if (personaSelect) {
            personaSelect.innerHTML = cleanReps.map(m => {
                const cleanName = sanitizeRepName(m.name, m.employee_id, m.id);
                const cleanEmpId = m.employee_id || (cleanName === 'Supriya Yadav' ? 'EMP-102' : (cleanName === 'Kalyani Mundada' ? 'EMP-103' : 'EMP-101'));
                return `<option value="${m.id}">${escapeHtml(cleanName)} (${m.role_type === 'sr_sales_rep' ? 'Sr. Sales Rep' : 'Sales Rep'} - ${escapeHtml(cleanEmpId)})</option>`;
            }).join('');
        }

        initLucideIcons();
    }

    window.adminQuickEditSrRep = function() {
        const reps = (State.salesTeam && State.salesTeam.length) ? State.salesTeam : getLocalTeam();
        const srMember = reps.find(m => m.role_type === 'sr_sales_rep');
        if (srMember) {
            window.openEditMemberModal(srMember.id);
        } else {
            alert('No Sr. Sales Rep designated yet. Click "Add Sales Person" or edit an existing representative to designate as Sr. Sales Rep.');
            window.openAddMemberModal();
        }
    };

    window.adminExportAllExcel = function() {
        const allVisits = (State.visits && State.visits.length) ? State.visits : getLocalVisits();
        if (!allVisits || !allVisits.length) {
            alert('No visits recorded in the system yet to export.');
            return;
        }
        exportVisitsToExcel(allVisits, `Company_All_Sales_Visits_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    window.adminExportAllCsv = function() {
        const allVisits = (State.visits && State.visits.length) ? State.visits : getLocalVisits();
        if (!allVisits || !allVisits.length) {
            alert('No visits recorded in the system yet to export.');
            return;
        }
        exportVisitsToCsv(allVisits);
    };

    window.adminDisconnectSupabase = function() {
        if (!confirm('Disconnect Supabase and return to local browser demo mode?')) return;
        AppConfig.clearConfig();
        reinitSupabase();

        const confUrl = document.getElementById('configUrlInput');
        const confKey = document.getElementById('configKeyInput');
        const adminUrl = document.getElementById('adminDbUrlInput');
        const adminKey = document.getElementById('adminDbKeyInput');
        if (confUrl) confUrl.value = '';
        if (confKey) confKey.value = '';
        if (adminUrl) adminUrl.value = '';
        if (adminKey) adminKey.value = '';

        updateConnectionIndicator();
        renderAdminPanelData();
        loadSalesTeam();
        loadAndRenderVisits();
        alert('Switched back to Local Browser Demo Mode.');
    };

    window.adminCopySqlSchema = async function() {
        try {
            await navigator.clipboard.writeText(EMBEDDED_SQL_SCHEMA);
            const copyBtn = document.getElementById('adminCopySqlBtn');
            if (copyBtn) {
                copyBtn.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-600"></i> Copied to Clipboard!';
                setTimeout(() => {
                    copyBtn.innerHTML = '<i data-lucide="copy" class="w-3.5 h-3.5"></i> Copy SQL Schema';
                    initLucideIcons();
                }, 2500);
            }
            initLucideIcons();
        } catch (err) {
            alert('SQL Schema:\n' + EMBEDDED_SQL_SCHEMA);
        }
    };

    window.adminSwitchToSelectedRep = function() {
        const select = document.getElementById('adminPersonaRepSelect');
        const repId = select?.value;
        if (!repId) return;

        window.selectSalesRepUser(repId);
        window.closeAdminAccessPanel();
    };

    function setupAdminAccessPanel() {
        const modal = document.getElementById('adminAccessPanelModal');
        const closeTopBtn = document.getElementById('closeAdminAccessPanelModalBtn');
        const closeBottomBtn = document.getElementById('closeAdminAccessPanelBottomBtn');
        const supabaseForm = document.getElementById('adminSupabaseForm');
        const pinForm = document.getElementById('adminChangePinForm');

        closeTopBtn?.addEventListener('click', window.closeAdminAccessPanel);
        closeBottomBtn?.addEventListener('click', window.closeAdminAccessPanel);
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) window.closeAdminAccessPanel();
        });

        // Supabase Save & Test in Admin Panel
        supabaseForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const urlInput = document.getElementById('adminDbUrlInput');
            const keyInput = document.getElementById('adminDbKeyInput');
            const alertBox = document.getElementById('adminDbAlert');

            const url = (urlInput?.value || '').trim();
            const key = (keyInput?.value || '').trim();

            if (!url || !key) {
                if (alertBox) {
                    alertBox.className = 'p-3 rounded-xl text-xs bg-rose-50 text-rose-800 border border-rose-200';
                    alertBox.textContent = 'Please enter both Supabase Project URL and Anon API Key.';
                    alertBox.classList.remove('hidden');
                }
                return;
            }

            if (alertBox) {
                alertBox.className = 'p-3 rounded-xl text-xs bg-purple-50 text-purple-800 border border-purple-200 flex items-center gap-2';
                alertBox.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin text-purple-600"></i> Testing Supabase connection...';
                alertBox.classList.remove('hidden');
                initLucideIcons();
            }

            const testResult = await testSupabaseConnection(url, key);

            if (testResult.success) {
                AppConfig.saveConfig(url, key);
                reinitSupabase();

                const confUrl = document.getElementById('configUrlInput');
                const confKey = document.getElementById('configKeyInput');
                if (confUrl) confUrl.value = url;
                if (confKey) confKey.value = key;

                if (alertBox) {
                    alertBox.className = 'p-3 rounded-xl text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-2';
                    alertBox.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4 text-emerald-600"></i> ${testResult.message}`;
                }
                updateConnectionIndicator();
                renderAdminPanelData();
                await loadSalesTeam();
                await loadAndRenderVisits();
            } else {
                if (alertBox) {
                    alertBox.className = 'p-3 rounded-xl text-xs bg-red-50 text-red-800 border border-red-200 flex items-center gap-2';
                    alertBox.innerHTML = `<i data-lucide="alert-triangle" class="w-4 h-4 text-red-600"></i> ${testResult.message}`;
                }
            }
            initLucideIcons();
        });

        // Admin PIN Change
        pinForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            const pinInput = document.getElementById('newAdminPinInput');
            const alertEl = document.getElementById('adminPinUpdateMsg');
            const newPin = (pinInput?.value || '').trim();

            if (!/^\d{4,6}$/.test(newPin)) {
                if (alertEl) {
                    alertEl.textContent = 'PIN must be between 4 and 6 numeric digits.';
                    alertEl.className = 'text-xs font-semibold p-2.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200';
                    alertEl.classList.remove('hidden');
                }
                return;
            }

            setAdminPin(newPin);
            if (pinInput) pinInput.value = '';
            if (alertEl) {
                alertEl.textContent = `✅ Admin Master PIN successfully updated to ${newPin}! Use this PIN to access the Admin Panel.`;
                alertEl.className = 'text-xs font-semibold p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200';
                alertEl.classList.remove('hidden');
            }
        });
    }

    // --------------------------------------------------------------------------
    // 8. INITIALIZE APPLICATION
    // --------------------------------------------------------------------------
    async function initApp() {
        console.log('SalesERP: Initializing application...');
        initLucideIcons();
        setupNavigation();
        setupCurrentTime();
        setupGpsDetection();
        setupVisitingCardUpload();
        setupOfficePhotoUpload();
        setupMeetingStatusCards();
        setupVisitFormSubmission();
        setupDashboardFilters();
        setupTeamManagement();
        setupEditMemberModal();
        setupSupabaseConfig();
        setupAdminAccessPanel();
        setupLightbox();
        setupDataTransferAndCloudModals();

        await loadSalesTeam();
        initUserSession();
        updateConnectionIndicator();
        updateCloudSyncBanner();
        await loadAndRenderVisits();

        // Background auto-sync for visits recorded on mobile
        if (AppConfig.isConfigured()) {
            syncLocalVisitsToCloud().then(res => {
                if (res && res.count > 0) {
                    console.log(`Auto-synced ${res.count} visits to Supabase on startup`);
                    loadAndRenderVisits();
                }
            }).catch(() => {});
        }

        window.addEventListener('online', () => {
            if (AppConfig.isConfigured()) {
                syncLocalVisitsToCloud().then(() => loadAndRenderVisits()).catch(() => {});
            }
        });

        // Auto-detect live GPS location on page launch so Option B is pre-populated
        captureLiveGpsLocation(false);

        console.log('SalesERP: Initialized successfully with Rep Privacy, Common Account Highlighting, and MIS Reports!');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }

})();
