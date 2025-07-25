const express = require('express');
const AuthMiddleware = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// @route   GET /api/users/profile/:id
// @desc    Get user profile by ID
// @access  Public (limited info) / Private (full info if own profile)
router.get('/profile/:id', AuthMiddleware.optionalAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const isOwnProfile = req.user && req.user.id == id;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Return different levels of information based on access
        const profileData = isOwnProfile 
            ? user.toSafeObject() 
            : {
                id: user.id,
                username: user.username,
                role: user.role,
                createdAt: user.createdAt,
                profileImage: user.profileImage
            };

        res.json({
            success: true,
            data: {
                user: profileData
            }
        });

    } catch (error) {
        console.error('Get user profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;