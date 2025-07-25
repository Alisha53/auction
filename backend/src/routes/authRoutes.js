const express = require('express');
const Joi = require('joi');
const User = require('../models/User');
const AuthMiddleware = require('../middleware/auth');

const router = express.Router();

// Validation schemas
const registerSchema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
    role: Joi.string().valid('bidder', 'seller').required(),
    phone: Joi.string().pattern(/^[0-9]{10}$/).optional(),
    address: Joi.string().min(10).max(500).optional()
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
});

const changePasswordSchema = Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(6).required(),
    confirmNewPassword: Joi.string().valid(Joi.ref('newPassword')).required()
});

const updateProfileSchema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).optional(),
    email: Joi.string().email().optional(),
    phone: Joi.string().pattern(/^[0-9]{10}$/).optional(),
    address: Joi.string().min(10).max(500).optional(),
    profile_image: Joi.string().uri().optional()
});

// Apply rate limiting to auth routes
router.use(AuthMiddleware.createAuthRateLimit());

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', async (req, res) => {
    try {
        // Validate input
        const { error, value } = registerSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const { username, email, password, role, phone, address } = value;

        // Check if user already exists
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Check if username is taken
        const existingUsername = await User.findByUsername(username);
        if (existingUsername) {
            return res.status(400).json({
                success: false,
                message: 'Username is already taken'
            });
        }

        // Create new user
        const newUser = await User.create({
            username,
            email,
            password,
            role,
            phone,
            address
        });

        // Generate JWT token
        const token = newUser.generateToken();

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                user: newUser.toSafeObject(),
                token
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during registration'
        });
    }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
    try {
        // Validate input
        const { error, value } = loginSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const { email, password } = value;

        // Find user by email
        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Verify password
        const isPasswordValid = await user.verifyPassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Generate JWT token
        const token = user.generateToken();

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: user.toSafeObject(),
                token
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during login'
        });
    }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', AuthMiddleware.verifyToken, async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                user: req.user.toSafeObject()
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', AuthMiddleware.verifyToken, async (req, res) => {
    try {
        // Validate input
        const { error, value } = updateProfileSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        // Check if email is being changed and if it's already taken
        if (value.email && value.email !== req.user.email) {
            const existingUser = await User.findByEmail(value.email);
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Email is already taken'
                });
            }
        }

        // Check if username is being changed and if it's already taken
        if (value.username && value.username !== req.user.username) {
            const existingUsername = await User.findByUsername(value.username);
            if (existingUsername) {
                return res.status(400).json({
                    success: false,
                    message: 'Username is already taken'
                });
            }
        }

        // Update profile
        const updatedUser = await req.user.updateProfile(value);

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                user: updatedUser.toSafeObject()
            }
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during profile update'
        });
    }
});

// @route   PUT /api/auth/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', AuthMiddleware.verifyToken, async (req, res) => {
    try {
        // Validate input
        const { error, value } = changePasswordSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const { currentPassword, newPassword } = value;

        // Change password
        await req.user.changePassword(currentPassword, newPassword);

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        if (error.message === 'Current password is incorrect') {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during password change'
        });
    }
});

// @route   GET /api/auth/bidding-history
// @desc    Get user's bidding history
// @access  Private (Bidders only)
router.get('/bidding-history', [
    AuthMiddleware.verifyToken,
    AuthMiddleware.requireBidder
], async (req, res) => {
    try {
        const biddingHistory = await req.user.getBiddingHistory();

        res.json({
            success: true,
            data: {
                biddingHistory
            }
        });

    } catch (error) {
        console.error('Get bidding history error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// @route   GET /api/auth/my-auctions
// @desc    Get seller's auctions
// @access  Private (Sellers only)
router.get('/my-auctions', [
    AuthMiddleware.verifyToken,
    AuthMiddleware.requireSeller
], async (req, res) => {
    try {
        const myAuctions = await req.user.getMyAuctions();

        res.json({
            success: true,
            data: {
                auctions: myAuctions
            }
        });

    } catch (error) {
        console.error('Get my auctions error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// @route   POST /api/auth/refresh-token
// @desc    Refresh JWT token
// @access  Private
router.post('/refresh-token', AuthMiddleware.verifyToken, async (req, res) => {
    try {
        // Generate new token
        const newToken = req.user.generateToken();

        res.json({
            success: true,
            message: 'Token refreshed successfully',
            data: {
                token: newToken
            }
        });

    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token invalidation)
// @access  Private
router.post('/logout', AuthMiddleware.verifyToken, (req, res) => {
    // For JWT, logout is typically handled client-side by removing the token
    // But we can log the logout event for security monitoring
    console.log(`User ${req.user.username} logged out`);
    
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// @route   DELETE /api/auth/deactivate
// @desc    Deactivate user account
// @access  Private
router.delete('/deactivate', AuthMiddleware.verifyToken, async (req, res) => {
    try {
        await req.user.deactivate();

        res.json({
            success: true,
            message: 'Account deactivated successfully'
        });

    } catch (error) {
        console.error('Deactivate account error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during account deactivation'
        });
    }
});

// @route   GET /api/auth/check-availability
// @desc    Check username/email availability
// @access  Public
router.get('/check-availability', async (req, res) => {
    try {
        const { type, value } = req.query;

        if (!type || !value) {
            return res.status(400).json({
                success: false,
                message: 'Type and value are required'
            });
        }

        let isAvailable = false;

        if (type === 'username') {
            const user = await User.findByUsername(value);
            isAvailable = !user;
        } else if (type === 'email') {
            const user = await User.findByEmail(value);
            isAvailable = !user;
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid type. Must be username or email'
            });
        }

        res.json({
            success: true,
            data: {
                available: isAvailable
            }
        });

    } catch (error) {
        console.error('Check availability error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;