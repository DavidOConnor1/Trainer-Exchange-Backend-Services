export class QuerySanitizer {
    static sanitizeString(input) {
        if (typeof input !== 'string') return '';
        const sanitized = input.replace(/[<>{}[\];'"\\|`~!@#$%^&*()+=]/g, '');
        return sanitized.trim().slice(0, 100);
    }

    static sanitizeQueryObject(params) {
        if (typeof params !== 'object' || params === null) return {};
        
        const sanitized = {};
        
        for (const [key, value] of Object.entries(params)) {
            if (typeof value === 'string') {
                sanitized[key] = this.sanitizeString(value);
            } else if (typeof value === 'number') {
                sanitized[key] = isFinite(value) ? value : 0;
            } else if (Array.isArray(value)) {
                sanitized[key] = value.map(item => 
                    typeof item === 'string' ? this.sanitizeString(item) : item
                );
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeQueryObject(value);
            } else {
                sanitized[key] = value;
            }
        }
        
        return sanitized;
    }

    static validateCardName(name) {
        if (!name || typeof name !== 'string') return null;
        const sanitizedName = this.sanitizeString(name);
        if (!sanitizedName.trim()) return null;
        if (sanitizedName.length > 30) return null;
        return sanitizedName;
    }
}