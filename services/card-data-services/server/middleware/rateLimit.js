import rateLimit from "express-rate-limit";

// Convert string values to numbers
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // each user can make 500 requests in 15 min
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: {
    success: false,
    error: "Too many requests, please try again later.",
    retryAfter: Math.ceil(
      (parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000) / 1000,
    ),
  },
});

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many search requests, please slow down.",
  },
});

export const pricingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 15, // 15 pricing requests per user per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many pricing requests, please try again later.",
    retryAfter: 60,
  },
});

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many admin requests." },
});

// Export ALL of them
export { globalLimiter, searchLimiter, adminLimiter };
