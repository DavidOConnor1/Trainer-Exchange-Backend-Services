import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

// Store blacklisted tokens (in production, use Redis)
const blacklistedTokens = new Set();

export const verifyAPIKeyJWT = (req, res, next) => {
  // Check if secret exists
  const secret = process.env.JWT_API_KEY_SECRET;

  // Get token from headers
  let token =
    req.headers["x-api-key"] ||
    req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({
      success: false,
      error: "API key required",
    });
  }

  // Check blacklist
  if (blacklistedTokens.has(token)) {
    return res.status(401).json({
      success: false,
      error: "API key has been revoked",
    });
  }

  try {
    const decoded = jwt.verify(token, secret);
    req.apiKey = decoded;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        error: "API key has expired",
      });
    }

    return res.status(401).json({
      success: false,
      error: "Invalid API key",
    });
  }
};

// Scope-based authorization
export const requireScope = (requiredScope) => {
  return (req, res, next) => {
    if (!req.apiKey) {
      return res.status(401).json({
        success: false,
        error: "API key required",
      });
    }

    if (!req.apiKey.scope || !req.apiKey.scope.includes(requiredScope)) {
      return res.status(403).json({
        success: false,
        error: `Insufficient permissions. Requires scope: ${requiredScope}`,
      });
    }

    next();
  };
};

// Revoke an API key
export const revokeAPIKey = (token) => {
  blacklistedTokens.add(token);

  try {
    const decoded = jwt.decode(token);
    if (decoded && decoded.exp) {
      const ttl = decoded.exp * 1000 - Date.now();
      setTimeout(
        () => {
          blacklistedTokens.delete(token);
        },
        Math.max(0, ttl),
      );
    }
  } catch (e) {
    // Ignore decode errors
  }
};
