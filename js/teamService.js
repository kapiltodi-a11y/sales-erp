// ==============================================================================
// SALES TEAM MANAGEMENT SERVICE
// Handles fetching, adding, editing, and deleting sales team members
// Syncs with Supabase table `sales_reps` with localStorage fallback
// ==============================================================================

import { getSupabase } from './supabaseClient.js';

const LOCAL_STORAGE_KEY = 'sales_erp_team_members';

// Default initial sales team members for immediate use
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

// Helper to get local team members
function getLocalTeam() {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.warn('Error reading team from localStorage:', e);
    }
    // Seed default
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_TEAM_MEMBERS));
    return [...DEFAULT_TEAM_MEMBERS];
}

function saveLocalTeam(team) {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(team));
    } catch (e) {
        console.warn('Error saving team to localStorage:', e);
    }
}

/**
 * Fetch all sales team members
 * @param {boolean} activeOnly - If true, returns only active members
 * @returns {Promise<Array>}
 */
export async function getSalesTeam(activeOnly = false) {
    const supabase = getSupabase();
    if (supabase) {
        try {
            let query = supabase.from('sales_reps').select('*').order('name', { ascending: true });
            if (activeOnly) {
                query = query.eq('is_active', true);
            }
            const { data, error } = await query;
            if (!error && Array.isArray(data)) {
                // Keep local storage in sync
                saveLocalTeam(data);
                return data;
            }
            console.warn('Supabase query failed, falling back to local storage:', error?.message);
        } catch (e) {
            console.warn('Supabase fetch team exception:', e);
        }
    }

    const local = getLocalTeam();
    if (activeOnly) {
        return local.filter(m => m.is_active);
    }
    return local;
}

/**
 * Add a new sales team member
 * @param {Object} member - { name, phone, email, employee_id, designation, is_active }
 * @returns {Promise<Object>}
 */
export async function addSalesTeamMember(member) {
    if (!member.name || !member.name.trim()) {
        throw new Error('Member name is required.');
    }

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
            const { data, error } = await supabase
                .from('sales_reps')
                .insert([newMember])
                .select()
                .single();

            if (!error && data) {
                const local = getLocalTeam();
                local.unshift(data);
                saveLocalTeam(local);
                return data;
            }
            console.warn('Supabase insert team member failed:', error?.message);
        } catch (e) {
            console.warn('Supabase insert team member error:', e);
        }
    }

    // Local fallback
    const local = getLocalTeam();
    const createdLocally = {
        ...newMember,
        id: 'rep-' + Date.now()
    };
    local.unshift(createdLocally);
    saveLocalTeam(local);
    return createdLocally;
}

/**
 * Delete a sales team member
 * @param {string} id - Member ID
 * @returns {Promise<boolean>}
 */
export async function deleteSalesTeamMember(id) {
    if (!id) return false;

    const supabase = getSupabase();
    if (supabase) {
        try {
            const { error } = await supabase
                .from('sales_reps')
                .delete()
                .eq('id', id);

            if (error) {
                console.warn('Supabase delete team member error:', error.message);
            }
        } catch (e) {
            console.warn('Supabase delete exception:', e);
        }
    }

    // Update local storage
    const local = getLocalTeam();
    const filtered = local.filter(m => m.id !== id);
    saveLocalTeam(filtered);
    return true;
}

/**
 * Toggle member active status
 */
export async function toggleMemberStatus(id, isActive) {
    const supabase = getSupabase();
    if (supabase) {
        try {
            await supabase
                .from('sales_reps')
                .update({ is_active: isActive })
                .eq('id', id);
        } catch (e) {
            console.warn('Supabase toggle error:', e);
        }
    }

    const local = getLocalTeam();
    const member = local.find(m => m.id === id);
    if (member) {
        member.is_active = isActive;
        saveLocalTeam(local);
    }
    return true;
}
