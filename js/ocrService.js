// ==============================================================================
// VISITING CARD OCR SERVICE
// Uses Tesseract.js directly in the browser to extract text and parse card details
// (Contact Person, Phone Number, Client/Company Name, Email, Address, Designation)
// ==============================================================================

/**
 * Perform OCR on an image file or data URL
 * @param {File|Blob|string} imageSource
 * @param {Function} onProgress - Callback with percent (0-100) and status
 * @returns {Promise<{rawText: string, parsed: Object}>}
 */
export async function scanVisitingCard(imageSource, onProgress = () => {}) {
    if (!window.Tesseract) {
        throw new Error('Tesseract OCR engine is loading. Please check your internet connection or retry in a few seconds.');
    }

    try {
        onProgress(10, 'Initializing OCR engine...');

        const result = await window.Tesseract.recognize(
            imageSource,
            'eng',
            {
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        const pct = Math.round((m.progress || 0) * 80) + 15;
                        onProgress(pct, `Scanning visiting card... ${pct}%`);
                    } else if (m.status) {
                        onProgress(15, `${m.status}...`);
                    }
                }
            }
        );

        onProgress(95, 'Extracting details with smart parser...');
        const rawText = result.data.text || '';
        const parsed = parseVisitingCardText(rawText);
        onProgress(100, 'Data extracted successfully!');

        return { rawText, parsed };
    } catch (error) {
        console.error('OCR Error:', error);
        throw new Error('Failed to parse visiting card image: ' + (error.message || 'Unknown error'));
    }
}

/**
 * Intelligent parser for visiting card text lines
 * Analyzes structure, emails, phone numbers, addresses, and candidate names
 */
export function parseVisitingCardText(rawText) {
    if (!rawText || typeof rawText !== 'string') {
        return {
            contactPerson: '',
            phone: '',
            clientName: '',
            email: '',
            address: '',
            designation: ''
        };
    }

    const lines = rawText
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 1);

    // 1. Extract Email
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
    let foundEmail = '';
    for (const line of lines) {
        const match = line.match(emailRegex);
        if (match) {
            foundEmail = match[1].toLowerCase();
            break;
        }
    }

    // 2. Extract Phone Number
    // Matches Indian 10-digit (+91 optional), or general phone patterns with spaces/dashes
    const phoneCandidates = [];
    const phoneRegexes = [
        /(?:\+91[-.\s]?)?[6-9]\d{4}[-.\s]?\d{5}/g,
        /(?:\+\d{1,3}[-.\s]?)?\(?\d{2,5}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,5}/g,
        /\b\d{10}\b/g
    ];

    for (const line of lines) {
        for (const regex of phoneRegexes) {
            const matches = line.match(regex);
            if (matches) {
                matches.forEach(m => {
                    const clean = m.replace(/[^\d+]/g, '');
                    // Filter out 6-digit pincodes or invalid lengths
                    if (clean.length >= 10 && clean.length <= 15) {
                        phoneCandidates.push(m.trim());
                    }
                });
            }
        }
    }
    const foundPhone = phoneCandidates.length > 0 ? phoneCandidates[0] : '';

    // 3. Company / Client Keywords & Indicators
    const companyKeywords = [
        'ltd', 'limited', 'pvt', 'private', 'inc', 'corp', 'corporation',
        'solutions', 'technologies', 'tech', 'enterprises', 'industries',
        'services', 'group', 'agency', 'associates', 'works', 'studio',
        'logistics', 'trading', 'consulting', 'ventures', 'company', 'co.'
    ];

    // 4. Designation Keywords
    const designationKeywords = [
        'director', 'managing director', 'ceo', 'cto', 'cfo', 'founder', 'co-founder',
        'partner', 'proprietor', 'manager', 'general manager', 'sales manager',
        'marketing manager', 'executive', 'consultant', 'president', 'vice president',
        'vp', 'head', 'lead', 'specialist', 'officer'
    ];

    // 5. Address Keywords & Pincode regex
    const addressKeywords = [
        'road', 'rd', 'street', 'st.', 'st', 'lane', 'floor', 'tower', 'block',
        'sector', 'plot', 'phase', 'nagar', 'marg', 'building', 'bhavan',
        'complex', 'opp', 'opposite', 'near', 'behind', 'pin', 'pincode', 'zip',
        'highway', 'bypass', 'industrial area', 'sq', 'square'
    ];
    const pincodeRegex = /\b[1-9][0-9]{5}\b/; // Standard Indian 6-digit pincode

    let foundClientName = '';
    let foundDesignation = '';
    let foundContactPerson = '';
    const addressLines = [];

    // Analyze lines
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lower = line.toLowerCase();

        // Skip lines that are just phone or email or websites
        if (line.includes('@') || /^(https?:\/\/|www\.)/i.test(line)) {
            continue;
        }

        // Check if line is a designation
        if (!foundDesignation) {
            for (const des of designationKeywords) {
                if (lower.includes(des)) {
                    foundDesignation = line;
                    break;
                }
            }
        }

        // Check if line indicates Company / Client Name
        if (!foundClientName) {
            const isCompany = companyKeywords.some(kw => {
                const wordBoundary = new RegExp(`\\b${kw}\\b`, 'i');
                return wordBoundary.test(lower);
            });
            if (isCompany) {
                foundClientName = line;
                continue;
            }
        }

        // Check if line is part of address
        const isAddress = addressKeywords.some(kw => lower.includes(kw)) || pincodeRegex.test(line);
        if (isAddress) {
            addressLines.push(line);
            continue;
        }
    }

    // Find Contact Person Name
    // Usually lines with honorifics like Mr., Ms., Dr., or a clean 2-3 word capitalized name
    // often right above the designation line or on lines 0-3
    const honorificRegex = /^(mr\.|ms\.|mrs\.|dr\.|prof\.|shri|er\.)\s+[a-z\s]+$/i;

    for (let i = 0; i < Math.min(lines.length, 5); i++) {
        const line = lines[i];
        const lower = line.toLowerCase();

        if (line === foundClientName || line === foundDesignation || addressLines.includes(line)) {
            continue;
        }
        if (line.includes('@') || phoneCandidates.some(p => line.includes(p))) {
            continue;
        }

        if (honorificRegex.test(line)) {
            foundContactPerson = line;
            break;
        }

        // Words count: A person's name is usually 2 or 3 words, all letters, no numbers
        const words = line.split(/\s+/);
        const hasNumbers = /\d/.test(line);
        const isCapitalized = words.every(w => /^[A-Z][a-zA-Z.'-]*$/.test(w));

        if (!hasNumbers && words.length >= 2 && words.length <= 4 && isCapitalized) {
            // Ensure none of the words are company keywords
            const hasCompanyKw = companyKeywords.some(kw => lower.includes(kw));
            if (!hasCompanyKw && !foundContactPerson) {
                foundContactPerson = line;
            }
        }
    }

    // Fallback for Client Name if not matched by keywords:
    // If the first line wasn't used as the contact person, and has letters, it could be company name
    if (!foundClientName && lines.length > 0) {
        for (let i = 0; i < Math.min(lines.length, 3); i++) {
            const line = lines[i];
            if (line !== foundContactPerson && line !== foundDesignation && !addressLines.includes(line)) {
                if (line.length >= 3 && !line.includes('@') && !/\d{6,}/.test(line)) {
                    foundClientName = line;
                    break;
                }
            }
        }
    }

    const fullAddress = addressLines.join(', ');

    return {
        contactPerson: foundContactPerson,
        phone: foundPhone,
        clientName: foundClientName,
        email: foundEmail,
        address: fullAddress,
        designation: foundDesignation
    };
}
