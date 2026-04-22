export class QuerySanitizer {
    static sanitizeString(input) {
        if (typeof input !== 'string') return '';
        
        // Remove control characters
        let sanitized = input.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        
        // Remove potential SQL injection patterns
        sanitized = sanitized.replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b)/gi, '');
        
        // Remove path traversal patterns
        sanitized = sanitized.replace(/\.\.\/|\.\.\\/g, '');
        
        // Limit length
        sanitized = sanitized.trim().slice(0, 100);
        
        return sanitized;
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