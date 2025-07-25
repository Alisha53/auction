const express = require('express');
const Joi = require('joi');
const AuthMiddleware = require('../middleware/auth');
const ProxyBiddingAlgorithm = require('../algorithms/ProxyBidding');

const router = express.Router();
const proxyBidding = new ProxyBiddingAlgorithm();

// Validation schemas
const proxyBidSchema = Joi.object({
    auction_id: Joi.number().integer().positive().required(),
    max_amount: Joi.number().positive().precision(2).required()
});

// @route   POST /api/bids/proxy
// @desc    Set proxy bid
// @access  Private (Bidders only)
router.post('/proxy', [
    AuthMiddleware.verifyToken,
    AuthMiddleware.requireBidder
], async (req, res) => {
    try {
        // Validate input
        const { error, value } = proxyBidSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const { auction_id, max_amount } = value;

        // Create proxy bid
        const proxyBid = await proxyBidding.createProxyBid(
            auction_id,
            req.user.id,
            max_amount
        );

        res.json({
            success: true,
            message: 'Proxy bid set successfully',
            data: {
                proxyBid
            }
        });

    } catch (error) {
        console.error('Set proxy bid error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Internal server error'
        });
    }
});

// @route   GET /api/bids/proxy
// @desc    Get user's proxy bids
// @access  Private (Bidders only)
router.get('/proxy', [
    AuthMiddleware.verifyToken,
    AuthMiddleware.requireBidder
], async (req, res) => {
    try {
        const proxyBids = await proxyBidding.getUserProxyBids(req.user.id);

        res.json({
            success: true,
            data: {
                proxyBids
            }
        });

    } catch (error) {
        console.error('Get proxy bids error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// @route   DELETE /api/bids/proxy/:auctionId
// @desc    Deactivate proxy bid
// @access  Private (Bidders only)
router.delete('/proxy/:auctionId', [
    AuthMiddleware.verifyToken,
    AuthMiddleware.requireBidder
], async (req, res) => {
    try {
        const { auctionId } = req.params;

        await proxyBidding.deactivateProxyBid(auctionId, req.user.id);

        res.json({
            success: true,
            message: 'Proxy bid deactivated successfully'
        });

    } catch (error) {
        console.error('Deactivate proxy bid error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// @route   GET /api/bids/recommendation/:auctionId
// @desc    Get proxy bid recommendation
// @access  Private (Bidders only)
router.get('/recommendation/:auctionId', [
    AuthMiddleware.verifyToken,
    AuthMiddleware.requireBidder
], async (req, res) => {
    try {
        const { auctionId } = req.params;

        // Get auction data
        const auctionData = await proxyBidding.getAuctionData(auctionId);
        
        if (!auctionData) {
            return res.status(404).json({
                success: false,
                message: 'Auction not found'
            });
        }

        const recommendation = proxyBidding.calculateProxyBidRecommendation(
            auctionData.current_price,
            auctionData
        );

        res.json({
            success: true,
            data: {
                recommendation
            }
        });

    } catch (error) {
        console.error('Get bid recommendation error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;