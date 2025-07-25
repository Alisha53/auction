const jwt = require('jsonwebtoken');
const User = require('../models/User');

class AuthMiddleware {
    // Verify JWT token
    static async verifyToken(req, res, next) {
        try {
            const token = req.header('Authorization')?.replace('Bearer ', '');
            
            if (!token) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Access denied. No token provided.' 
                });
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Get user from database
            const user = await User.findById(decoded.id);
            if (!user) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Invalid token. User not found.' 
                });
            }

            req.user = user;
            next();
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Token expired.' 
                });
            }
            
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid token.' 
            });
        }
    }

    // Check if user has specific role
    static checkRole(roles) {
        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Authentication required.' 
                });
            }

            const userRole = req.user.role;
            const allowedRoles = Array.isArray(roles) ? roles : [roles];

            if (!allowedRoles.includes(userRole)) {
                return res.status(403).json({ 
                    success: false, 
                    message: `Access denied. Required role: ${allowedRoles.join(' or ')}` 
                });
            }

            next();
        };
    }

    // Check if user is a bidder
    static requireBidder(req, res, next) {
        return AuthMiddleware.checkRole('bidder')(req, res, next);
    }

    // Check if user is a seller
    static requireSeller(req, res, next) {
        return AuthMiddleware.checkRole('seller')(req, res, next);
    }

    // Check if user is an admin
    static requireAdmin(req, res, next) {
        return AuthMiddleware.checkRole('admin')(req, res, next);
    }

    // Check if user is either bidder or seller
    static requireBidderOrSeller(req, res, next) {
        return AuthMiddleware.checkRole(['bidder', 'seller'])(req, res, next);
    }

    // Optional authentication (doesn't fail if no token)
    static optionalAuth(req, res, next) {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            req.user = null;
            return next();
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            User.findById(decoded.id).then(user => {
                req.user = user;
                next();
            }).catch(() => {
                req.user = null;
                next();
            });
        } catch (error) {
            req.user = null;
            next();
        }
    }

    // Check if user owns the resource
    static checkOwnership(getResourceOwnerId) {
        return async (req, res, next) => {
            try {
                const resourceOwnerId = await getResourceOwnerId(req);
                
                if (req.user.id !== resourceOwnerId && req.user.role !== 'admin') {
                    return res.status(403).json({ 
                        success: false, 
                        message: 'Access denied. You can only access your own resources.' 
                    });
                }

                next();
            } catch (error) {
                return res.status(500).json({ 
                    success: false, 
                    message: 'Error checking resource ownership.' 
                });
            }
        };
    }

    // Rate limiting for authentication attempts
    static createAuthRateLimit() {
        const attempts = new Map();
        const maxAttempts = 5;
        const lockoutTime = 15 * 60 * 1000; // 15 minutes

        return (req, res, next) => {
            const ip = req.ip || req.connection.remoteAddress;
            const now = Date.now();
            
            if (!attempts.has(ip)) {
                attempts.set(ip, { count: 0, lastAttempt: now });
            }

            const userAttempts = attempts.get(ip);
            
            // Reset if lockout time has passed
            if (now - userAttempts.lastAttempt > lockoutTime) {
                userAttempts.count = 0;
                userAttempts.lastAttempt = now;
            }

            // Check if user is locked out
            if (userAttempts.count >= maxAttempts) {
                const timeLeft = Math.ceil((lockoutTime - (now - userAttempts.lastAttempt)) / 1000 / 60);
                return res.status(429).json({
                    success: false,
                    message: `Too many authentication attempts. Try again in ${timeLeft} minutes.`
                });
            }

            // Store original end function to intercept response
            const originalEnd = res.end;
            res.end = function(chunk, encoding) {
                // If authentication failed, increment attempts
                if (res.statusCode === 401 || res.statusCode === 403) {
                    userAttempts.count++;
                    userAttempts.lastAttempt = now;
                } else if (res.statusCode === 200) {
                    // Reset on successful authentication
                    userAttempts.count = 0;
                }
                
                originalEnd.call(this, chunk, encoding);
            };

            next();
        };
    }

    // Validate API key for certain endpoints
    static validateApiKey(req, res, next) {
        const apiKey = req.header('X-API-Key');
        
        if (!apiKey) {
            return res.status(401).json({ 
                success: false, 
                message: 'API key required.' 
            });
        }

        // In production, store API keys in database
        const validApiKeys = process.env.API_KEYS?.split(',') || [];
        
        if (!validApiKeys.includes(apiKey)) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid API key.' 
            });
        }

        next();
    }

    // Check if user account is active
    static requireActiveAccount(req, res, next) {
        if (!req.user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Authentication required.' 
            });
        }

        if (!req.user.isActive) {
            return res.status(403).json({ 
                success: false, 
                message: 'Account is deactivated. Please contact support.' 
            });
        }

        next();
    }

    // CSRF protection for state-changing operations
    static csrfProtection(req, res, next) {
        const csrfToken = req.header('X-CSRF-Token');
        const sessionCsrfToken = req.session?.csrfToken;

        if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
            return next();
        }

        if (!csrfToken || !sessionCsrfToken || csrfToken !== sessionCsrfToken) {
            return res.status(403).json({ 
                success: false, 
                message: 'Invalid CSRF token.' 
            });
        }

        next();
    }
}

module.exports = AuthMiddleware;