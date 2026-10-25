// ==============================================================================
// LOCATION SERVICE
// Captures GPS coordinates and performs reverse geocoding to human-readable address
// ==============================================================================

/**
 * Get current GPS coordinates from the device
 * @returns {Promise<{latitude: number, longitude: number, accuracy: number}>}
 */
export function getCurrentCoordinates() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by your browser or device.'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
            },
            (error) => {
                let message = 'Failed to get location.';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        message = 'Location permission was denied. Please allow location access in your browser settings.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        message = 'Location information is currently unavailable.';
                        break;
                    case error.TIMEOUT:
                        message = 'Location request timed out. Please try again.';
                        break;
                }
                reject(new Error(message));
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0
            }
        );
    });
}

/**
 * Reverse geocode coordinates to a readable address using OpenStreetMap Nominatim
 * @param {number} latitude 
 * @param {number} longitude 
 * @returns {Promise<string>}
 */
export async function reverseGeocode(latitude, longitude) {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`;
        const response = await fetch(url, {
            headers: {
                'Accept-Language': 'en'
            }
        });

        if (!response.ok) {
            return `GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        }

        const data = await response.json();
        return data.display_name || `GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    } catch (err) {
        console.warn('Reverse geocoding error:', err);
        return `GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    }
}

/**
 * Generates a Google Maps link for the given coordinates
 */
export function getGoogleMapsUrl(latitude, longitude) {
    if (!latitude || !longitude) return null;
    return `https://www.google.com/maps?q=${latitude},${longitude}`;
}
