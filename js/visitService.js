// ==============================================================================
// CLIENT VISIT MANAGEMENT SERVICE
// Handles recording new field visits, uploading images, querying visits by rep & day,
// generating analytics stats, and exporting visit logs to CSV
// ==============================================================================

import { getSupabase, uploadVisitImage } from './supabaseClient.js';

const LOCAL_STORAGE_KEY = 'sales_erp_client_visits';

// Seed sample visit data for immediate testing
const DEFAULT_SAMPLE_VISITS = [
    {
        id: 'visit-101',
        sales_rep_id: 'rep-001',
        sales_rep_name: 'Rahul Sharma',
        client_name: 'Nexus Retail Enterprises',
        client_address: 'Plot 45, Sector 18, Commercial Belt, Cyber City',
        visit_time: new Date(Date.now() - 2 * 3600000).toISOString(),
        latitude: 28.4985,
        longitude: 77.0890,
        location_address: 'Sector 18, Gurugram, Haryana 122002',
        contact_person_name: 'Vikas Malhotra',
        contact_person_phone: '+91 98112 34567',
        status: 'Successful Closed',
        follow_up_date: null,
        remarks: 'Met with the Purchase Director. Discussed annual contract terms for bulk enterprise supply. Final contract signed for 500 units!',
        visiting_card_url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80',
        office_photo_url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=600&q=80',
        ocr_extracted_data: {
            clientName: 'Nexus Retail Enterprises',
            contactPerson: 'Vikas Malhotra',
            designation: 'Director of Procurement',
            phone: '+91 98112 34567',
            email: 'vikas@nexusretail.com'
        },
        created_at: new Date(Date.now() - 2 * 3600000).toISOString()
    },
    {
        id: 'visit-102',
        sales_rep_id: 'rep-002',
        sales_rep_name: 'Priya Patel',
        client_name: 'Apex Infotech Solutions',
        client_address: '3rd Floor, Tower B, Infinity Tech Park, MG Road',
        visit_time: new Date(Date.now() - 5 * 3600000).toISOString(),
        latitude: 19.0760,
        longitude: 72.8777,
        location_address: 'Infinity Park, MG Road, Mumbai, Maharashtra 400051',
        contact_person_name: 'Ananya Deshmukh',
        contact_person_phone: '+91 98220 98765',
        status: 'Follow-up Required',
        follow_up_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
        remarks: 'Product demo given to tech team. Highly impressed with features. Follow up next Tuesday with revised commercial proposal.',
        visiting_card_url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80',
        office_photo_url: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=600&q=80',
        ocr_extracted_data: {
            clientName: 'Apex Infotech Solutions',
            contactPerson: 'Ananya Deshmukh',
            designation: 'Head of Operations',
            phone: '+91 98220 98765',
            email: 'ananya.d@apexinfotech.io'
        },
        created_at: new Date(Date.now() - 5 * 3600000).toISOString()
    },
    {
        id: 'visit-103',
        sales_rep_id: 'rep-001',
        sales_rep_name: 'Rahul Sharma',
        client_name: 'Sunrise Logistics Hub',
        client_address: 'National Highway 48, Near Toll Plaza, Cargo Complex',
        visit_time: new Date(Date.now() - 26 * 3600000).toISOString(),
        latitude: 28.5355,
        longitude: 77.3910,
        location_address: 'Cargo Complex, NH48, Noida, Uttar Pradesh 201301',
        contact_person_name: 'Rajinder Gill',
        contact_person_phone: '+91 97110 54321',
        status: 'Successful Closed',
        follow_up_date: null,
        remarks: 'Payment terms agreed upon. Received advance cheque for pilot deployment. Onboarding scheduled for next week.',
        visiting_card_url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80',
        office_photo_url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80',
        ocr_extracted_data: {
            clientName: 'Sunrise Logistics Hub',
            contactPerson: 'Rajinder Gill',
            designation: 'General Manager',
            phone: '+91 97110 54321',
            email: 'rgill@sunriselogistics.in'
        },
        created_at: new Date(Date.now() - 26 * 3600000).toISOString()
    }
];

function getLocalVisits() {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.warn('Error reading visits from localStorage:', e);
    }
    // Seed initial
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_SAMPLE_VISITS));
    return [...DEFAULT_SAMPLE_VISITS];
}

function saveLocalVisits(visits) {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(visits));
    } catch (e) {
        console.warn('Error saving visits to localStorage:', e);
    }
}

/**
 * Record a new visit from the sales rep
 * @param {Object} visitData
 * @returns {Promise<Object>}
 */
export async function recordClientVisit(visitData) {
    // 1. Upload Visiting Card & Office Photo if provided as File/Blob
    let visitingCardUrl = visitData.visiting_card_url || null;
    let officePhotoUrl = visitData.office_photo_url || null;

    if (visitData.visitingCardFile) {
        visitingCardUrl = await uploadVisitImage(visitData.visitingCardFile, 'visiting_cards');
    }
    if (visitData.officePhotoFile) {
        officePhotoUrl = await uploadVisitImage(visitData.officePhotoFile, 'office_photos');
    }

    const newRecord = {
        sales_rep_id: visitData.sales_rep_id || null,
        sales_rep_name: (visitData.sales_rep_name || 'Anonymous Rep').trim(),
        client_name: (visitData.client_name || '').trim(),
        client_address: (visitData.client_address || '').trim(),
        visit_time: visitData.visit_time || new Date().toISOString(),
        latitude: visitData.latitude ? Number(visitData.latitude) : null,
        longitude: visitData.longitude ? Number(visitData.longitude) : null,
        location_address: (visitData.location_address || '').trim(),
        contact_person_name: (visitData.contact_person_name || '').trim(),
        contact_person_phone: (visitData.contact_person_phone || '').trim(),
        status: visitData.status || 'Follow-up Required',
        follow_up_date: visitData.follow_up_date || null,
        remarks: (visitData.remarks || '').trim(),
        visiting_card_url: visitingCardUrl,
        office_photo_url: officePhotoUrl,
        ocr_raw_text: visitData.ocr_raw_text || null,
        ocr_extracted_data: visitData.ocr_extracted_data || {},
        created_at: new Date().toISOString()
    };

    const supabase = getSupabase();
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('client_visits')
                .insert([newRecord])
                .select()
                .single();

            if (!error && data) {
                const local = getLocalVisits();
                local.unshift(data);
                saveLocalVisits(local);
                return data;
            }
            console.warn('Supabase insert visit failed, saving locally:', error?.message);
        } catch (e) {
            console.warn('Supabase insert visit exception:', e);
        }
    }

    // Local storage fallback
    const local = getLocalVisits();
    const createdLocal = {
        ...newRecord,
        id: 'visit-' + Date.now()
    };
    local.unshift(createdLocal);
    saveLocalVisits(local);
    return createdLocal;
}

/**
 * Fetch and filter visits
 * @param {Object} filters
 * @returns {Promise<Array>}
 */
export async function getClientVisits(filters = {}) {
    const supabase = getSupabase();
    let allVisits = [];

    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('client_visits')
                .select('*')
                .order('visit_time', { ascending: false });

            if (!error && Array.isArray(data)) {
                allVisits = data;
                saveLocalVisits(data);
            } else {
                console.warn('Supabase query visits failed:', error?.message);
                allVisits = getLocalVisits();
            }
        } catch (e) {
            console.warn('Supabase fetch visits exception:', e);
            allVisits = getLocalVisits();
        }
    } else {
        allVisits = getLocalVisits();
    }

    // Apply client-side filtering (handles sales person, day wise, status, search)
    let filtered = [...allVisits];

    // Filter by Sales Person (ID or Name)
    if (filters.salesRep && filters.salesRep !== 'ALL') {
        filtered = filtered.filter(v => 
            v.sales_rep_id === filters.salesRep || 
            v.sales_rep_name.toLowerCase() === filters.salesRep.toLowerCase()
        );
    }

    // Filter by Day / Date
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

    // Filter by Status ('Successful Closed' or 'Follow-up Required')
    if (filters.status && filters.status !== 'ALL') {
        filtered = filtered.filter(v => v.status === filters.status);
    }

    // Filter by Search text (Client name, contact person, phone, remarks, address)
    if (filters.search && filters.search.trim()) {
        const query = filters.search.trim().toLowerCase();
        filtered = filtered.filter(v => 
            (v.client_name && v.client_name.toLowerCase().includes(query)) ||
            (v.contact_person_name && v.contact_person_name.toLowerCase().includes(query)) ||
            (v.contact_person_phone && v.contact_person_phone.includes(query)) ||
            (v.remarks && v.remarks.toLowerCase().includes(query)) ||
            (v.client_address && v.client_address.toLowerCase().includes(query))
        );
    }

    return filtered;
}

/**
 * Delete a visit entry
 */
export async function deleteClientVisit(id) {
    if (!id) return false;

    const supabase = getSupabase();
    if (supabase) {
        try {
            await supabase.from('client_visits').delete().eq('id', id);
        } catch (e) {
            console.warn('Supabase delete visit error:', e);
        }
    }

    const local = getLocalVisits();
    const filtered = local.filter(v => v.id !== id);
    saveLocalVisits(filtered);
    return true;
}

/**
 * Generate CSV data from visits and trigger browser download
 */
export function exportVisitsToCsv(visits) {
    if (!visits || !visits.length) {
        alert('No visits to export.');
        return;
    }

    const headers = [
        'Visit ID',
        'Sales Representative',
        'Client Name',
        'Client Address',
        'Visit Date & Time',
        'Latitude',
        'Longitude',
        'Location Address',
        'Google Maps Link',
        'Contact Person Name',
        'Contact Person Phone',
        'Meeting Status',
        'Follow-up Date',
        'Remarks',
        'Visiting Card URL',
        'Office Photo URL'
    ];

    const escapeCsv = (val) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
    };

    const rows = visits.map(v => [
        escapeCsv(v.id),
        escapeCsv(v.sales_rep_name),
        escapeCsv(v.client_name),
        escapeCsv(v.client_address),
        escapeCsv(v.visit_time ? new Date(v.visit_time).toLocaleString() : ''),
        escapeCsv(v.latitude || ''),
        escapeCsv(v.longitude || ''),
        escapeCsv(v.location_address || ''),
        escapeCsv(v.latitude && v.longitude ? `https://www.google.com/maps?q=${v.latitude},${v.longitude}` : ''),
        escapeCsv(v.contact_person_name),
        escapeCsv(v.contact_person_phone),
        escapeCsv(v.status),
        escapeCsv(v.follow_up_date || ''),
        escapeCsv(v.remarks),
        escapeCsv(v.visiting_card_url || ''),
        escapeCsv(v.office_photo_url || '')
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
