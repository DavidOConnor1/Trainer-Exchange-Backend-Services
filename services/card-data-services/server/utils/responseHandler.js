export class ResponseHandler {
    static success(res, data, message = 'Success', statusCode = 200) {
        return res.status(statusCode).json({
            success: true,
            message,
            data,
            timestamp: new Date().toISOString()
        });
    }

    static error(res, error, statusCode = 500) {
        const errorMessage = typeof error === 'string' ? error : error.message;
        return res.status(statusCode).json({
            success: false,
            error: errorMessage,
            timestamp: new Date().toISOString()
        });
    }

    static paginated(res, data, pagination, message = 'Success') {
        return res.status(200).json({
            success: true,
            message,
            data,
            pagination,
            timestamp: new Date().toISOString()
        });
    }

    static notFound(res, resource = 'Resource') {
        return res.status(404).json({
            success: false,
            error: `${resource} not found`,
            timestamp: new Date().toISOString()
        });
    }
}