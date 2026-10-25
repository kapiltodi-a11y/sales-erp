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

    const AppConfig = {
        supabaseUrl: localStorage.getItem(`${CONFIG_STORAGE_KEY}_url`) || '',
        supabaseAnonKey: localStorage.getItem(`${CONFIG_STORAGE_KEY}_key`) || '',
        storageBucketName: 'visit-photos',

        isConfigured() {
            return Boolean(this.supabaseUrl && this.supabaseAnonKey && this.supabaseUrl.startsWith('https://'));
        },

        saveConfig(url, key) {
            this.supabaseUrl = (url || '').trim();
            this.supabaseAnonKey = (key || '').trim();
            localStorage.setItem(`${CONFIG_STORAGE_KEY}_url`, this.supabaseUrl);
            localStorage.setItem(`${CONFIG_STORAGE_KEY}_key`, this.supabaseAnonKey);
        },

        clearConfig() {
            this.supabaseUrl = '';
            this.supabaseAnonKey = '';
            localStorage.removeItem(`${CONFIG_STORAGE_KEY}_url`);
            localStorage.removeItem(`${CONFIG_STORAGE_KEY}_key`);
        }
    };

    // --------------------------------------------------------------------------
    // 2. SUPABASE CLIENT SERVICE
    // --------------------------------------------------------------------------
    let supabaseInstance = null;

    function getSupabase() {
        if (!AppConfig.isConfigured()) return null;
        if (!supabaseInstance && window.supabase && typeof window.supabase.createClient === 'function') {
            supabaseInstance = window.supabase.createClient(AppConfig.supabaseUrl, AppConfig.supabaseAnonKey);
        }
        return supabaseInstance;
    }

    function reinitSupabase() {
        supabaseInstance = null;
        return getSupabase();
    }

    async function testSupabaseConnection(url, key) {
        try {
            if (!url || !key) {
                return { success: false, message: 'URL and Anon Key are required.' };
            }
            if (!window.supabase || typeof window.supabase.createClient !== 'function') {
                return { success: false, message: 'Supabase SDK not loaded. Check internet connection.' };
            }

            const client = window.supabase.createClient(url.trim(), key.trim());
            const { data, error } = await client.from('sales_reps').select('id').limit(1);

            if (error) {
                if (error.code === '42P01') {
                    return {
                        success: false,
                        message: 'Connected to Supabase, but table "sales_reps" was not found! Run schema.sql in Supabase SQL editor.'
                    };
                }
                return { success: false, message: error.message || 'Failed to query Supabase.' };
            }

            return { success: true, message: 'Connected successfully to Supabase! Tables and permissions verified.' };
        } catch (err) {
            return { success: false, message: err.message || 'Network error connecting to Supabase.' };
        }
    }

    async function uploadVisitImage(file, folder = 'visits') {
        if (!file) return null;
        const supabase = getSupabase();
        const timestamp = Date.now();
        const cleanFileName = file.name ? file.name.replace(/[^a-zA-Z0-9._-]/g, '_') : 'photo.jpg';
        const filePath = `${folder}/${timestamp}_${cleanFileName}`;

        if (supabase) {
            try {
                const { data, error } = await supabase.storage
                    .from(AppConfig.storageBucketName)
                    .upload(filePath, file, { cacheControl: '3600', upsert: false });

                if (!error && data) {
                    const { data: publicUrlData } = supabase.storage
                        .from(AppConfig.storageBucketName)
                        .getPublicUrl(filePath);

                    if (publicUrlData && publicUrlData.publicUrl) {
                        return publicUrlData.publicUrl;
                    }
                }
            } catch (e) {
                console.warn('Storage upload error, using data URL fallback:', e);
            }
        }

        // Fallback to data URL
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        });
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
            name: 'Rahul Sharma',
            email: 'rahul.sharma@example.com',
            phone: '+91 98765 43210',
            employee_id: 'EMP-101',
            designation: 'Senior Sales Executive',
            is_active: true,
            created_at: new Date(Date.now() - 30 * 86400000).toISOString()
        },
        {
            id: 'rep-002',
            name: 'Priya Patel',
            email: 'priya.patel@example.com',
            phone: '+91 98765 43211',
            employee_id: 'EMP-102',
            designation: 'Field Sales Specialist',
            is_active: true,
            created_at: new Date(Date.now() - 20 * 86400000).toISOString()
        },
        {
            id: 'rep-003',
            name: 'Amit Verma',
            email: 'amit.verma@example.com',
            phone: '+91 98765 43212',
            employee_id: 'EMP-103',
            designation: 'Business Development Rep',
            is_active: true,
            created_at: new Date(Date.now() - 10 * 86400000).toISOString()
        }
    ];

    function getLocalTeam() {
        try {
            const stored = localStorage.getItem(TEAM_STORAGE_KEY);
            if (stored) return JSON.parse(stored);
        } catch (e) {}
        localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(DEFAULT_TEAM_MEMBERS));
        return [...DEFAULT_TEAM_MEMBERS];
    }

    function saveLocalTeam(team) {
        try { localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(team)); } catch (e) {}
    }

    async function getSalesTeam(activeOnly = false) {
        const supabase = getSupabase();
        if (supabase) {
            try {
                let query = supabase.from('sales_reps').select('*').order('name', { ascending: true });
                if (activeOnly) query = query.eq('is_active', true);
                const { data, error } = await query;
                if (!error && Array.isArray(data)) {
                    saveLocalTeam(data);
                    return data;
                }
            } catch (e) {}
        }
        const local = getLocalTeam();
        return activeOnly ? local.filter(m => m.is_active) : local;
    }

    async function addSalesTeamMember(member) {
        if (!member.name || !member.name.trim()) throw new Error('Member name is required.');
        const newMember = {
            name: member.name.trim(),
            email: (member.email || '').trim(),
            phone: (member.phone || '').trim(),
            employee_id: (member.employee_id || `EMP-${Date.now().toString().slice(-4)}`).trim(),
            designation: (member.designation || 'Field Sales Representative').trim(),
            is_active: member.is_active !== false,
            created_at: new Date().toISOString()
        };

        const supabase = getSupabase();
        if (supabase) {
            try {
                const { data, error } = await supabase.from('sales_reps').insert([newMember]).select().single();
                if (!error && data) {
                    const local = getLocalTeam();
                    local.unshift(data);
                    saveLocalTeam(local);
                    return data;
                }
            } catch (e) {}
        }

        const local = getLocalTeam();
        const createdLocally = { ...newMember, id: 'rep-' + Date.now() };
        local.unshift(createdLocally);
        saveLocalTeam(local);
        return createdLocally;
    }

    async function deleteSalesTeamMember(id) {
        if (!id) return false;
        const supabase = getSupabase();
        if (supabase) {
            try { await supabase.from('sales_reps').delete().eq('id', id); } catch (e) {}
        }
        const local = getLocalTeam();
        const filtered = local.filter(m => m.id !== id);
        saveLocalTeam(filtered);
        return true;
    }

    // --------------------------------------------------------------------------
    // 6. CLIENT VISIT SERVICE
    // --------------------------------------------------------------------------
    const VISITS_STORAGE_KEY = 'sales_erp_client_visits';
    const DEFAULT_SAMPLE_VISITS = [
        {
            id: 'visit-101',
            sales_rep_id: 'rep-001',
            sales_rep_name: 'Rahul Sharma',
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
            sales_rep_name: 'Priya Patel',
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
            sales_rep_name: 'Rahul Sharma',
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
        }
    ];

    function getLocalVisits() {
        try {
            const stored = localStorage.getItem(VISITS_STORAGE_KEY);
            if (stored) return JSON.parse(stored);
        } catch (e) {}
        localStorage.setItem(VISITS_STORAGE_KEY, JSON.stringify(DEFAULT_SAMPLE_VISITS));
        return [...DEFAULT_SAMPLE_VISITS];
    }

    function saveLocalVisits(visits) {
        try { localStorage.setItem(VISITS_STORAGE_KEY, JSON.stringify(visits)); } catch (e) {}
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

        const newRecord = {
            sales_rep_id: visitData.sales_rep_id || null,
            sales_rep_name: (visitData.sales_rep_name || 'Anonymous Rep').trim(),
            business_name: bName,
            client_name: bName, // Alias
            address_option_a: addrA,
            address_option_b: addrB,
            client_address: addrA, // Fallback
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
        };

        const supabase = getSupabase();
        if (supabase) {
            try {
                const { data, error } = await supabase.from('client_visits').insert([newRecord]).select().single();
                if (!error && data) {
                    const local = getLocalVisits();
                    local.unshift(data);
                    saveLocalVisits(local);
                    return data;
                }
            } catch (e) {
                console.warn('Supabase insert failed, saving locally:', e);
            }
        }

        const local = getLocalVisits();
        const createdLocal = { ...newRecord, id: 'visit-' + Date.now() };
        local.unshift(createdLocal);
        saveLocalVisits(local);
        return createdLocal;
    }

    async function getClientVisits(filters = {}) {
        const supabase = getSupabase();
        let allVisits = [];

        if (supabase) {
            try {
                const { data, error } = await supabase.from('client_visits').select('*').order('visit_time', { ascending: false });
                if (!error && Array.isArray(data)) {
                    allVisits = data;
                    saveLocalVisits(data);
                } else {
                    allVisits = getLocalVisits();
                }
            } catch (e) {
                allVisits = getLocalVisits();
            }
        } else {
            allVisits = getLocalVisits();
        }

        let filtered = [...allVisits];

        // Sales Person Filter
        if (filters.salesRep && filters.salesRep !== 'ALL') {
            filtered = filtered.filter(v => v.sales_rep_id === filters.salesRep || (v.sales_rep_name && v.sales_rep_name.toLowerCase() === filters.salesRep.toLowerCase()));
        }

        // Day / Date Filter
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
            } else if (filters.dayFilter.startsWith('DATE:')) {
                const specificDate = filters.dayFilter.replace('DATE:', '');
                filtered = filtered.filter(v => v.visit_time && v.visit_time.startsWith(specificDate));
            }
        }

        // Status Filter
        if (filters.status && filters.status !== 'ALL') {
            filtered = filtered.filter(v => v.status === filters.status);
        }

        // Keyword Search
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

    async function deleteClientVisit(id) {
        if (!id) return false;
        const supabase = getSupabase();
        if (supabase) {
            try { await supabase.from('client_visits').delete().eq('id', id); } catch (e) {}
        }
        const local = getLocalVisits();
        const filtered = local.filter(v => v.id !== id);
        saveLocalVisits(filtered);
        return true;
    }

    // --------------------------------------------------------------------------
    // EXPORT TO EXCEL (.xlsx) & CSV
    // --------------------------------------------------------------------------
    function exportVisitsToExcel(visits) {
        if (!visits || !visits.length) {
            alert('No visits to export.');
            return;
        }

        const headers = [
            'Sales Representative',
            'Employee ID',
            'Visit Date & Time',
            'Business Name',
            'Contact Person Name',
            'Contact Mobile Number',
            'Contact Email ID',
            'Pin Code',
            'Address Option A (Card / Manual)',
            'Address Option B (Auto GPS Live Location)',
            'GPS Latitude',
            'GPS Longitude',
            'Google Maps Link',
            'Meeting Status',
            'Follow-up Date',
            'Remarks & Notes',
            'Office / Shop Photo URL',
            'Visiting Card Front URL',
            'Visiting Card Back URL'
        ];

        const rows = visits.map(v => {
            const dateStr = v.visit_time ? new Date(v.visit_time).toLocaleString() : '';
            const bName = v.business_name || v.client_name || '';
            const addrA = v.address_option_a || v.client_address || '';
            const addrB = v.address_option_b || v.location_address || '';
            const mapsUrl = (v.latitude && v.longitude) ? `https://www.google.com/maps?q=${v.latitude},${v.longitude}` : '';

            return [
                v.sales_rep_name || '',
                v.employee_id || '',
                dateStr,
                bName,
                v.contact_person_name || '',
                v.contact_person_phone || '',
                v.contact_person_email || '',
                v.pincode || '',
                addrA,
                addrB,
                v.latitude || '',
                v.longitude || '',
                mapsUrl,
                v.status || '',
                v.follow_up_date || '',
                v.remarks || '',
                v.office_photo_url || '',
                v.visiting_card_front_url || v.visiting_card_url || '',
                v.visiting_card_back_url || ''
            ];
        });

        // Use SheetJS (XLSX) if available
        if (window.XLSX && typeof window.XLSX.utils !== 'undefined') {
            const sheetData = [headers, ...rows];
            const wb = window.XLSX.utils.book_new();
            const ws = window.XLSX.utils.aoa_to_sheet(sheetData);

            // Column width optimization
            ws['!cols'] = [
                { wch: 20 }, // Sales Rep
                { wch: 14 }, // Emp ID
                { wch: 20 }, // Visit Date & Time
                { wch: 25 }, // Business Name
                { wch: 20 }, // Contact Person
                { wch: 18 }, // Mobile
                { wch: 24 }, // Email
                { wch: 12 }, // Pin Code
                { wch: 32 }, // Address Option A
                { wch: 32 }, // Address Option B
                { wch: 14 }, // Latitude
                { wch: 14 }, // Longitude
                { wch: 30 }, // Google Maps Link
                { wch: 18 }, // Status
                { wch: 14 }, // Follow-up Date
                { wch: 35 }, // Remarks
                { wch: 30 }, // Office Photo URL
                { wch: 30 }, // Front Card URL
                { wch: 30 }  // Back Card URL
            ];

            window.XLSX.utils.book_append_sheet(wb, ws, 'Sales Visits');
            const fileName = `Sales_Visits_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
            window.XLSX.writeFile(wb, fileName);
        } else {
            // Fallback to CSV if SheetJS is offline
            exportVisitsToCsv(visits);
        }
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
    // 7. APPLICATION STATE & UI CONTROLLER
    // --------------------------------------------------------------------------
    const State = {
        currentTab: 'new-visit',
        salesTeam: [],
        visits: [],
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
        ocrRawText: ''
    };

    function initLucideIcons() {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    function switchTab(tabKey) {
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
        } catch (e) {
            console.error('Failed to load sales team:', e);
        }
    }

    function populateSalesTeamDropdowns() {
        const repSelect = document.getElementById('salesRepSelect');
        const filterRepSelect = document.getElementById('filterSalesRep');

        if (repSelect) {
            const currentVal = repSelect.value;
            repSelect.innerHTML = '<option value="">-- Choose Sales Person --</option>';
            State.salesTeam.filter(m => m.is_active).forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.dataset.name = m.name;
                opt.dataset.empid = m.employee_id || '';
                opt.textContent = `${m.name} (${m.employee_id ? m.employee_id + ' • ' : ''}${m.designation || 'Sales'})`;
                repSelect.appendChild(opt);
            });
            if (currentVal) repSelect.value = currentVal;
        }

        if (filterRepSelect) {
            const currentFilterVal = filterRepSelect.value;
            filterRepSelect.innerHTML = '<option value="ALL">All Sales Representatives</option>';
            State.salesTeam.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = m.name;
                filterRepSelect.appendChild(opt);
            });
            if (currentFilterVal) filterRepSelect.value = currentFilterVal;
        }
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
    // BUSINESS NAME DUPLICATION VALIDATION
    // --------------------------------------------------------------------------
    function normalizeBusinessName(name) {
        return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    }

    async function checkBusinessNameDuplication(businessName) {
        if (!businessName || !businessName.trim()) {
            return { isDuplicate: false, existingVisit: null };
        }

        const normalized = normalizeBusinessName(businessName);
        if (normalized.length < 2) {
            return { isDuplicate: false, existingVisit: null };
        }

        // 1. Check local visits (State.visits and getLocalVisits())
        const allLocal = (State.visits && State.visits.length) ? State.visits : getLocalVisits();
        const localMatch = allLocal.find(v => {
            const existing = normalizeBusinessName(v.business_name || v.client_name);
            return existing === normalized;
        });

        if (localMatch) {
            return { isDuplicate: true, existingVisit: localMatch, source: 'local' };
        }

        // 2. Check Supabase database if connected
        const supabase = getSupabase();
        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('client_visits')
                    .select('id, business_name, client_name, sales_rep_name, visit_time, status')
                    .ilike('business_name', businessName.trim())
                    .limit(1);

                if (!error && data && data.length > 0) {
                    return { isDuplicate: true, existingVisit: data[0], source: 'supabase' };
                }
            } catch (e) {
                console.warn('Supabase duplicate lookup failed:', e);
            }
        }

        return { isDuplicate: false, existingVisit: null };
    }

    async function validateBusinessNameUI(inputName, fromCard = false) {
        const warningBox = document.getElementById('duplicateBusinessWarning');
        const detailsElem = document.getElementById('duplicateBusinessDetails');
        const statusBadge = document.getElementById('businessNameStatusBadge');
        const nameInput = document.getElementById('businessNameInput');

        if (!nameInput) return false;

        const trimmed = (inputName || '').trim();
        if (!trimmed || trimmed.length < 2) {
            warningBox?.classList.add('hidden');
            statusBadge?.classList.add('hidden');
            nameInput.classList.remove('border-rose-500', 'bg-rose-50/40', 'focus:ring-rose-500');
            nameInput.classList.add('border-slate-200', 'bg-slate-50', 'focus:ring-blue-500');
            State.isBusinessNameDuplicate = false;
            return false;
        }

        const check = await checkBusinessNameDuplication(trimmed);

        if (check.isDuplicate && check.existingVisit) {
            State.isBusinessNameDuplicate = true;
            const ex = check.existingVisit;
            const vDate = ex.visit_time ? new Date(ex.visit_time).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
            }) : 'previously';
            const repName = ex.sales_rep_name || 'another sales rep';

            // Red styling for input
            nameInput.classList.remove('border-slate-200', 'bg-slate-50', 'focus:ring-blue-500');
            nameInput.classList.add('border-rose-500', 'bg-rose-50/40', 'focus:ring-rose-500');

            // Status Badge
            if (statusBadge) {
                statusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 shadow-sm';
                statusBadge.textContent = 'Already Exists ⛔';
                statusBadge.classList.remove('hidden');
            }

            // Warning details
            if (detailsElem) {
                detailsElem.innerHTML = `
                    <strong>"${escapeHtml(ex.business_name || ex.client_name || trimmed)}"</strong> was already recorded on <strong>${vDate}</strong> by <strong>${escapeHtml(repName)}</strong>.<br>
                    <span class="font-bold text-rose-800">Duplicate business names are strictly blocked in the ERP. Please enter a different business name.</span>
                `;
            }
            warningBox?.classList.remove('hidden');
            initLucideIcons();

            if (fromCard) {
                alert(`⚠️ Visiting Card Alert: Duplicate Business Name!\n\nThe company name "${trimmed}" on this visiting card is already registered in the system (recorded on ${vDate} by ${repName}).\n\nDuplicate business names are not permitted.`);
            }

            return true;
        } else {
            // Unique and Available
            State.isBusinessNameDuplicate = false;
            nameInput.classList.remove('border-rose-500', 'bg-rose-50/40', 'focus:ring-rose-500');
            nameInput.classList.add('border-slate-200', 'bg-slate-50', 'focus:ring-blue-500');

            if (statusBadge) {
                statusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shadow-sm';
                statusBadge.textContent = 'Unique & Available ✓';
                statusBadge.classList.remove('hidden');
            }
            warningBox?.classList.add('hidden');
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
            const selectedRepId = repSelect.value;
            const selectedOption = repSelect.options[repSelect.selectedIndex];
            const selectedRepName = selectedOption ? selectedOption.dataset.name || selectedOption.textContent : 'Field Rep';
            const selectedEmpId = selectedOption ? selectedOption.dataset.empid || '' : '';

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
    function setupDashboardFilters() {
        const filterSalesRep = document.getElementById('filterSalesRep');
        const filterDay = document.getElementById('filterDay');
        const filterCustomDate = document.getElementById('filterCustomDateInput');
        const filterStatus = document.getElementById('filterStatus');
        const filterSearch = document.getElementById('filterSearch');
        const refreshBtn = document.getElementById('refreshVisitsBtn');
        const exportCsvBtn = document.getElementById('exportCsvBtn');
        const exportExcelBtn = document.getElementById('exportExcelBtn');

        const handleFilterChange = () => loadAndRenderVisits();

        filterSalesRep?.addEventListener('change', handleFilterChange);
        filterStatus?.addEventListener('change', handleFilterChange);
        filterSearch?.addEventListener('input', debounce(handleFilterChange, 300));

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
        refreshBtn?.addEventListener('click', () => loadAndRenderVisits());
        exportCsvBtn?.addEventListener('click', () => exportVisitsToCsv(State.visits));
        exportExcelBtn?.addEventListener('click', () => exportVisitsToExcel(State.visits));
    }

    async function loadAndRenderVisits() {
        const filterSalesRep = document.getElementById('filterSalesRep')?.value || 'ALL';
        const filterDay = document.getElementById('filterDay')?.value || 'ALL';
        const filterCustomDate = document.getElementById('filterCustomDateInput')?.value;
        const filterStatus = document.getElementById('filterStatus')?.value || 'ALL';
        const filterSearch = document.getElementById('filterSearch')?.value || '';

        let dayFilterParam = filterDay;
        if (filterDay === 'CUSTOM' && filterCustomDate) {
            dayFilterParam = `DATE:${filterCustomDate}`;
        }

        try {
            const visits = await getClientVisits({
                salesRep: filterSalesRep,
                dayFilter: dayFilterParam,
                status: filterStatus,
                search: filterSearch
            });

            State.visits = visits;
            renderVisitsList(visits);
            updateKpiStats(visits);
        } catch (err) {
            console.error('Failed to load visits:', err);
        }
    }

    function updateKpiStats(visits) {
        document.getElementById('statTotalVisits').textContent = visits.length;
        document.getElementById('statClosedDeals').textContent = visits.filter(v => v.status === 'Successful Closed').length;
        document.getElementById('statFollowups').textContent = visits.filter(v => v.status === 'Follow-up Required').length;
        document.getElementById('statActiveReps').textContent = new Set(visits.map(v => v.sales_rep_name || v.sales_rep_id)).size;
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

            return `
                <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow space-y-4">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                                ${(visit.sales_rep_name || 'SR').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <div class="flex items-center gap-2">
                                    <span class="font-bold text-slate-900 text-base">${escapeHtml(businessName)}</span>
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

                    <!-- Address Comparison: Option A & Option B -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <span class="text-slate-400 font-bold uppercase text-[10px] block mb-0.5">Option A: Card / Manual Address</span>
                            <p class="text-slate-700">${escapeHtml(addrOptionA)}</p>
                            ${visit.pincode ? `<span class="inline-block mt-1 bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-mono">Pin: ${escapeHtml(visit.pincode)}</span>` : ''}
                        </div>

                        <div class="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100">
                            <div class="flex items-center justify-between mb-0.5">
                                <span class="text-emerald-800 font-bold uppercase text-[10px] flex items-center gap-1">
                                    <i data-lucide="lock" class="w-3 h-3 text-amber-600"></i> Option B: Verified Live GPS
                                </span>
                                ${hasGps ? `
                                    <a href="${googleMapsLink}" target="_blank" class="text-blue-600 hover:underline flex items-center gap-1 text-[11px] font-medium">
                                        <span>Map</span>
                                        <i data-lucide="external-link" class="w-3 h-3"></i>
                                    </a>
                                ` : ''}
                            </div>
                            <p class="text-slate-700">${escapeHtml(addrOptionB || 'GPS not captured')}</p>
                            ${hasGps ? `<span class="text-[10px] font-mono text-slate-400 block mt-1">${visit.latitude.toFixed(5)}, ${visit.longitude.toFixed(5)}</span>` : ''}
                        </div>
                    </div>

                    <!-- Contact Person & Communication Quick Actions -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div class="bg-blue-50/40 p-3 rounded-xl border border-blue-100/70 flex items-center justify-between">
                            <div>
                                <span class="text-slate-400 block text-[10px] uppercase font-bold">Contact Person Met</span>
                                <span class="font-bold text-slate-800 text-sm">${escapeHtml(visit.contact_person_name || 'N/A')}</span>
                                ${visit.contact_person_email ? `<span class="text-[11px] text-blue-600 block mt-0.5">${escapeHtml(visit.contact_person_email)}</span>` : ''}
                            </div>
                            <div class="flex items-center space-x-1">
                                ${cleanPhone ? `
                                    <a href="tel:${cleanPhone}" class="p-2 bg-white text-blue-600 rounded-lg shadow-sm hover:bg-blue-600 hover:text-white transition-colors" title="Call">
                                        <i data-lucide="phone" class="w-4 h-4"></i>
                                    </a>
                                    <a href="https://wa.me/${cleanPhone.replace('+', '')}" target="_blank" class="p-2 bg-white text-emerald-600 rounded-lg shadow-sm hover:bg-emerald-600 hover:text-white transition-colors" title="WhatsApp">
                                        <i data-lucide="message-circle" class="w-4 h-4"></i>
                                    </a>
                                ` : ''}
                            </div>
                        </div>

                        <div class="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                            <div>
                                <span class="text-slate-400 block text-[10px] uppercase font-bold">Mobile Number</span>
                                <span class="font-semibold text-slate-800">${escapeHtml(visit.contact_person_phone || 'N/A')}</span>
                            </div>
                            ${visit.follow_up_date ? `
                                <div class="text-right">
                                    <span class="text-amber-700 block text-[10px] uppercase font-bold flex items-center justify-end gap-1">
                                        <i data-lucide="alarm-clock" class="w-3 h-3 text-amber-600"></i> Follow-up (11:30 AM)
                                    </span>
                                    <span class="font-extrabold text-amber-900 text-xs">${visit.follow_up_date} at 11:30 AM</span>
                                    <div class="mt-1 flex items-center justify-end gap-1 flex-wrap">
                                        <button onclick="window.downloadFollowupCalendar('${visit.id}')" class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 transition-colors shadow-sm" title="Download .ics alarm for phone">
                                            <i data-lucide="alarm-clock" class="w-3 h-3 text-amber-700"></i> Set Phone Alarm
                                        </button>
                                        <button onclick="window.openGoogleCalendar('${visit.id}')" class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 hover:bg-blue-200 text-blue-900 transition-colors shadow-sm" title="Add to Google Calendar">
                                            <i data-lucide="calendar-plus" class="w-3 h-3 text-blue-700"></i> Google Cal
                                        </button>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- Remarks -->
                    <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs space-y-1">
                        <span class="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">Remarks / Meeting Discussion</span>
                        <p class="text-slate-700 whitespace-pre-line leading-relaxed">${escapeHtml(visit.remarks || 'No remarks provided.')}</p>
                    </div>

                    <!-- Photos (Front Card, Back Card, Office Photo) -->
                    ${(visit.visiting_card_front_url || visit.visiting_card_back_url || visit.visiting_card_url || visit.office_photo_url) ? `
                        <div class="pt-2 border-t border-slate-100 flex items-center gap-3">
                            <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Attached Photos:</span>
                            <div class="flex flex-wrap items-center gap-2">
                                ${(visit.visiting_card_front_url || visit.visiting_card_url) ? `
                                    <button onclick="window.openImageLightbox('${visit.visiting_card_front_url || visit.visiting_card_url}', 'Visiting Card FRONT - ${escapeHtml(businessName)}')" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors border border-blue-200">
                                        <i data-lucide="contact-2" class="w-3.5 h-3.5"></i>
                                        <span>Card Front</span>
                                    </button>
                                ` : ''}
                                ${visit.visiting_card_back_url ? `
                                    <button onclick="window.openImageLightbox('${visit.visiting_card_back_url}', 'Visiting Card BACK - ${escapeHtml(businessName)}')" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors border border-indigo-200">
                                        <i data-lucide="contact-2" class="w-3.5 h-3.5"></i>
                                        <span>Card Back</span>
                                    </button>
                                ` : ''}
                                ${visit.office_photo_url ? `
                                    <button onclick="window.openImageLightbox('${visit.office_photo_url}', 'Office / Shop Photo - ${escapeHtml(businessName)}')" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors border border-rose-200">
                                        <i data-lucide="store" class="w-3.5 h-3.5"></i>
                                        <span>Office / Shop</span>
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        container.innerHTML = html;
        initLucideIcons();
    }

    window.handleDeleteVisit = async function(id) {
        if (confirm('Are you sure you want to delete this visit record?')) {
            await deleteClientVisit(id);
            await loadAndRenderVisits();
        }
    };

    // --------------------------------------------------------------------------
    // SETTINGS: SALES TEAM MANAGEMENT
    // --------------------------------------------------------------------------
    function setupTeamManagement() {
        const openModalBtn = document.getElementById('openAddMemberModalBtn');
        const closeModalBtn = document.getElementById('closeAddMemberModalBtn');
        const cancelModalBtn = document.getElementById('cancelAddMemberBtn');
        const modal = document.getElementById('addMemberModal');
        const addMemberForm = document.getElementById('addMemberForm');

        const toggleModal = (show) => {
            if (show) {
                modal.classList.remove('hidden');
                document.getElementById('newMemberName')?.focus();
            } else {
                modal.classList.add('hidden');
                addMemberForm?.reset();
            }
            initLucideIcons();
        };

        openModalBtn?.addEventListener('click', () => toggleModal(true));
        closeModalBtn?.addEventListener('click', () => toggleModal(false));
        cancelModalBtn?.addEventListener('click', () => toggleModal(false));

        addMemberForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('newMemberName').value.trim();
            const phone = document.getElementById('newMemberPhone').value.trim();
            const email = document.getElementById('newMemberEmail').value.trim();
            const empId = document.getElementById('newMemberEmpId').value.trim();
            const role = document.getElementById('newMemberRole').value.trim();

            if (!name) {
                alert('Member name is required.');
                return;
            }

            try {
                await addSalesTeamMember({
                    name, phone, email, employee_id: empId, designation: role, is_active: true
                });
                toggleModal(false);
                await loadSalesTeam();
                alert(`Sales person "${name}" added successfully!`);
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
                <div class="p-6 text-center text-slate-400 text-sm">
                    No sales team members found. Click "Add Sales Person" to create one.
                </div>
            `;
            return;
        }

        const html = State.salesTeam.map(member => `
            <div class="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                        ${(member.name || 'SR').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-slate-900 text-sm">${escapeHtml(member.name)}</span>
                            ${member.employee_id ? `<span class="text-[11px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">${escapeHtml(member.employee_id)}</span>` : ''}
                        </div>
                        <div class="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>${escapeHtml(member.designation || 'Sales Rep')}</span>
                            <span>•</span>
                            <span>${escapeHtml(member.phone || member.email || 'No contact')}</span>
                        </div>
                    </div>
                </div>

                <div class="flex items-center space-x-2">
                    <button onclick="window.handleDeleteTeamMember('${member.id}', '${escapeHtml(member.name)}')" class="text-slate-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors" title="Delete Member">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
        initLucideIcons();
    }

    window.handleDeleteTeamMember = async function(id, name) {
        if (confirm(`Are you sure you want to delete sales person "${name}"?`)) {
            await deleteSalesTeamMember(id);
            await loadSalesTeam();
        }
    };

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
        setupSupabaseConfig();
        setupLightbox();

        updateConnectionIndicator();
        await loadSalesTeam();
        await loadAndRenderVisits();

        // Auto-detect live GPS location on page launch so Option B is pre-populated
        captureLiveGpsLocation(false);

        console.log('SalesERP: Initialized successfully with Front/Back cards, Smart OCR, Option A/B, and Excel Export!');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }

})();
