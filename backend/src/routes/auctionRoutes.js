const express = require('express');
const Joi = require('joi');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const AuthMiddleware = require('../middleware/auth');
const Database = require('../config/database');
const DynamicPricingAlgorithm = require('../algorithms/DynamicPricing');

const router = express.Router();
const db = new Database();
const dynamicPricing = new DynamicPricingAlgorithm();

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/auctions/');
    },
    filename: (req, file, cb) => {
        const uniqueName = `auction_${Date.now()}_${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
        }
    }
});

// Validation schemas
const createAuctionSchema = Joi.object({
    product_id: Joi.string().required(),
    title: Joi.string().min(5).max(200).required(),
    description: Joi.string().min(10).max(2000).required(),
    category_id: Joi.number().integer().positive().required(),
    subcategory_id: Joi.number().integer().positive().optional(),
    starting_price: Joi.number().positive().precision(2).required(),
    reserve_price: Joi.number().positive().precision(2).optional(),
    start_time: Joi.date().iso().required(),
    end_time: Joi.date().iso().greater(Joi.ref('start_time')).required()
});

// @route   GET /api/auctions
// @desc    Get all auctions with filters
// @access  Public
router.get('/', AuthMiddleware.optionalAuth, async (req, res) => {
    try {
        const {
            status = 'all',
            category = 'all',
            search = '',
            sort = 'newest',
            page = 1,
            limit = 12
        } = req.query;

        let whereClause = 'WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        // Status filter
        if (status !== 'all') {
            whereClause += ` AND a.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        // Category filter
        if (category !== 'all') {
            whereClause += ` AND a.category_id = $${paramIndex}`;
            params.push(category);
            paramIndex++;
        }

        // Search filter
        if (search) {
            whereClause += ` AND (a.title ILIKE $${paramIndex} OR a.description ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        // Sort options
        let orderClause = '';
        switch (sort) {
            case 'price_low':
                orderClause = 'ORDER BY a.current_price ASC';
                break;
            case 'price_high':
                orderClause = 'ORDER BY a.current_price DESC';
                break;
            case 'ending_soon':
                orderClause = 'ORDER BY a.end_time ASC';
                break;
            case 'most_bids':
                orderClause = 'ORDER BY a.total_bids DESC';
                break;
            default:
                orderClause = 'ORDER BY a.created_at DESC';
        }

        // Pagination
        const offset = (page - 1) * limit;
        const limitClause = `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const query = `
            SELECT 
                a.*,
                u.username as seller_username,
                c.name as category_name,
                sc.name as subcategory_name,
                EXTRACT(EPOCH FROM (a.end_time - NOW())) as time_remaining_seconds,
                CASE 
                    WHEN a.end_time <= NOW() THEN 'closed'
                    WHEN a.start_time <= NOW() THEN 'live'
                    ELSE 'upcoming'
                END as computed_status
            FROM auctions a
            LEFT JOIN users u ON a.seller_id = u.id
            LEFT JOIN categories c ON a.category_id = c.id
            LEFT JOIN categories sc ON a.subcategory_id = sc.id
            ${whereClause}
            ${orderClause}
            ${limitClause}
        `;

        const result = await db.query(query, params);
        
        // Get total count for pagination
        const countQuery = `
            SELECT COUNT(*) as total
            FROM auctions a
            ${whereClause}
        `;
        const countResult = await db.query(countQuery, params.slice(0, -2));
        const total = parseInt(countResult.rows[0].total);

        res.json({
            success: true,
            data: {
                auctions: result.rows.map(auction => ({
                    ...auction,
                    time_remaining_seconds: Math.max(0, auction.time_remaining_seconds || 0),
                    is_ended: (auction.time_remaining_seconds || 0) <= 0
                })),
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('Get auctions error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// @route   GET /api/auctions/:id
// @desc    Get auction by ID
// @access  Public
router.get('/:id', AuthMiddleware.optionalAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
            SELECT 
                a.*,
                u.username as seller_username,
                u.email as seller_email,
                c.name as category_name,
                sc.name as subcategory_name,
                EXTRACT(EPOCH FROM (a.end_time - NOW())) as time_remaining_seconds,
                CASE 
                    WHEN a.end_time <= NOW() THEN 'closed'
                    WHEN a.start_time <= NOW() THEN 'live'
                    ELSE 'upcoming'
                END as computed_status,
                w.username as winner_username
            FROM auctions a
            LEFT JOIN users u ON a.seller_id = u.id
            LEFT JOIN users w ON a.winner_id = w.id
            LEFT JOIN categories c ON a.category_id = c.id
            LEFT JOIN categories sc ON a.subcategory_id = sc.id
            WHERE a.id = $1
        `;

        const result = await db.query(query, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Auction not found'
            });
        }

        const auction = result.rows[0];
        
        // Get bid history
        const bidHistoryQuery = `
            SELECT 
                b.amount,
                b.bid_type,
                b.created_at,
                u.username as bidder_username
            FROM bids b
            JOIN users u ON b.bidder_id = u.id
            WHERE b.auction_id = $1
            ORDER BY b.created_at DESC
            LIMIT 20
        `;
        
        const bidHistoryResult = await db.query(bidHistoryQuery, [id]);

        // Calculate dynamic pricing information
        const auctionData = {
            startingPrice: auction.starting_price,
            currentPrice: auction.current_price,
            totalBids: auction.total_bids,
            timeRemaining: Math.max(0, auction.time_remaining_seconds / 60), // Convert to minutes
            bidHistory: bidHistoryResult.rows
        };

        const nextBidIncrement = dynamicPricing.calculateBidIncrement(auctionData);
        const suggestedBid = dynamicPricing.calculateNextBidAmount(auction.current_price, auctionData);

        res.json({
            success: true,
            data: {
                auction: {
                    ...auction,
                    time_remaining_seconds: Math.max(0, auction.time_remaining_seconds || 0),
                    is_ended: (auction.time_remaining_seconds || 0) <= 0,
                    next_bid_increment: nextBidIncrement,
                    suggested_bid: suggestedBid
                },
                bidHistory: bidHistoryResult.rows
            }
        });

    } catch (error) {
        console.error('Get auction error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// @route   POST /api/auctions
// @desc    Create new auction
// @access  Private (Sellers only)
router.post('/', [
    AuthMiddleware.verifyToken,
    AuthMiddleware.requireSeller,
    upload.single('image')
], async (req, res) => {
    try {
        // Validate input
        const { error, value } = createAuctionSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const {
            product_id,
            title,
            description,
            category_id,
            subcategory_id,
            starting_price,
            reserve_price,
            start_time,
            end_time
        } = value;

        // Check if product_id is unique
        const existingProductQuery = 'SELECT id FROM auctions WHERE product_id = $1';
        const existingProduct = await db.query(existingProductQuery, [product_id]);
        
        if (existingProduct.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Product ID already exists'
            });
        }

        // Validate category exists
        const categoryQuery = 'SELECT id FROM categories WHERE id = $1 AND is_active = true';
        const categoryResult = await db.query(categoryQuery, [category_id]);
        
        if (categoryResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid category'
            });
        }

        // Validate subcategory if provided
        if (subcategory_id) {
            const subcategoryQuery = 'SELECT id FROM categories WHERE id = $1 AND parent_id = $2 AND is_active = true';
            const subcategoryResult = await db.query(subcategoryQuery, [subcategory_id, category_id]);
            
            if (subcategoryResult.rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid subcategory for the selected category'
                });
            }
        }

        // Handle image upload
        let imageUrl = null;
        if (req.file) {
            imageUrl = `/uploads/auctions/${req.file.filename}`;
        }

        // Determine initial status based on start time
        const now = new Date();
        const startDate = new Date(start_time);
        const initialStatus = startDate <= now ? 'live' : 'upcoming';

        // Create auction
        const insertQuery = `
            INSERT INTO auctions (
                product_id, seller_id, category_id, subcategory_id,
                title, description, image_url, starting_price, reserve_price,
                current_price, start_time, end_time, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
        `;

        const insertValues = [
            product_id,
            req.user.id,
            category_id,
            subcategory_id || null,
            title,
            description,
            imageUrl,
            starting_price,
            reserve_price || null,
            starting_price, // initial current_price equals starting_price
            start_time,
            end_time,
            initialStatus
        ];

        const result = await db.query(insertQuery, insertValues);
        const newAuction = result.rows[0];

        res.status(201).json({
            success: true,
            message: 'Auction created successfully',
            data: {
                auction: newAuction
            }
        });

    } catch (error) {
        console.error('Create auction error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during auction creation'
        });
    }
});

// @route   PUT /api/auctions/:id
// @desc    Update auction (only before it starts)
// @access  Private (Seller who owns the auction)
router.put('/:id', [
    AuthMiddleware.verifyToken,
    AuthMiddleware.requireSeller,
    upload.single('image')
], async (req, res) => {
    try {
        const { id } = req.params;

        // Check if auction exists and belongs to the seller
        const auctionQuery = 'SELECT * FROM auctions WHERE id = $1 AND seller_id = $2';
        const auctionResult = await db.query(auctionQuery, [id, req.user.id]);

        if (auctionResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Auction not found or you do not have permission to edit it'
            });
        }

        const auction = auctionResult.rows[0];

        // Check if auction has already started
        if (auction.status !== 'upcoming') {
            return res.status(400).json({
                success: false,
                message: 'Cannot edit auction that has already started'
            });
        }

        // Validate input (make all fields optional for updates)
        const updateSchema = Joi.object({
            title: Joi.string().min(5).max(200).optional(),
            description: Joi.string().min(10).max(2000).optional(),
            category_id: Joi.number().integer().positive().optional(),
            subcategory_id: Joi.number().integer().positive().optional(),
            starting_price: Joi.number().positive().precision(2).optional(),
            reserve_price: Joi.number().positive().precision(2).optional(),
            start_time: Joi.date().iso().optional(),
            end_time: Joi.date().iso().optional()
        });

        const { error, value } = updateSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        // Build update query dynamically
        const updates = [];
        const updateValues = [];
        let paramIndex = 1;

        for (const [key, val] of Object.entries(value)) {
            if (val !== undefined) {
                updates.push(`${key} = $${paramIndex}`);
                updateValues.push(val);
                paramIndex++;
            }
        }

        // Handle image upload
        if (req.file) {
            updates.push(`image_url = $${paramIndex}`);
            updateValues.push(`/uploads/auctions/${req.file.filename}`);
            paramIndex++;
        }

        if (updates.length === 0 && !req.file) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        updateValues.push(id);

        const updateQuery = `
            UPDATE auctions 
            SET ${updates.join(', ')} 
            WHERE id = $${paramIndex} 
            RETURNING *
        `;

        const result = await db.query(updateQuery, updateValues);

        res.json({
            success: true,
            message: 'Auction updated successfully',
            data: {
                auction: result.rows[0]
            }
        });

    } catch (error) {
        console.error('Update auction error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during auction update'
        });
    }
});

// @route   DELETE /api/auctions/:id
// @desc    Cancel auction (only before it starts or if no bids)
// @access  Private (Seller who owns the auction)
router.delete('/:id', [
    AuthMiddleware.verifyToken,
    AuthMiddleware.requireSeller
], async (req, res) => {
    try {
        const { id } = req.params;

        // Check if auction exists and belongs to the seller
        const auctionQuery = 'SELECT * FROM auctions WHERE id = $1 AND seller_id = $2';
        const auctionResult = await db.query(auctionQuery, [id, req.user.id]);

        if (auctionResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Auction not found or you do not have permission to cancel it'
            });
        }

        const auction = auctionResult.rows[0];

        // Check if auction can be cancelled
        if (auction.status === 'closed') {
            return res.status(400).json({
                success: false,
                message: 'Cannot cancel a closed auction'
            });
        }

        // If auction is live, check if there are any bids
        if (auction.status === 'live' && auction.total_bids > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot cancel auction with existing bids'
            });
        }

        // Cancel the auction
        const cancelQuery = `
            UPDATE auctions 
            SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
            WHERE id = $1 
            RETURNING *
        `;

        const result = await db.query(cancelQuery, [id]);

        res.json({
            success: true,
            message: 'Auction cancelled successfully',
            data: {
                auction: result.rows[0]
            }
        });

    } catch (error) {
        console.error('Cancel auction error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during auction cancellation'
        });
    }
});

// @route   GET /api/auctions/live
// @desc    Get live auctions
// @access  Public
router.get('/status/live', AuthMiddleware.optionalAuth, async (req, res) => {
    try {
        const query = `
            SELECT 
                a.*,
                u.username as seller_username,
                c.name as category_name,
                sc.name as subcategory_name,
                EXTRACT(EPOCH FROM (a.end_time - NOW())) as time_remaining_seconds
            FROM auctions a
            LEFT JOIN users u ON a.seller_id = u.id
            LEFT JOIN categories c ON a.category_id = c.id
            LEFT JOIN categories sc ON a.subcategory_id = sc.id
            WHERE a.status = 'live'
            ORDER BY a.end_time ASC
        `;

        const result = await db.query(query);

        res.json({
            success: true,
            data: {
                auctions: result.rows.map(auction => ({
                    ...auction,
                    time_remaining_seconds: Math.max(0, auction.time_remaining_seconds || 0),
                    is_ended: (auction.time_remaining_seconds || 0) <= 0
                }))
            }
        });

    } catch (error) {
        console.error('Get live auctions error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// @route   GET /api/auctions/upcoming
// @desc    Get upcoming auctions
// @access  Public
router.get('/status/upcoming', AuthMiddleware.optionalAuth, async (req, res) => {
    try {
        const query = `
            SELECT 
                a.*,
                u.username as seller_username,
                c.name as category_name,
                sc.name as subcategory_name,
                EXTRACT(EPOCH FROM (a.start_time - NOW())) as time_until_start_seconds
            FROM auctions a
            LEFT JOIN users u ON a.seller_id = u.id
            LEFT JOIN categories c ON a.category_id = c.id
            LEFT JOIN categories sc ON a.subcategory_id = sc.id
            WHERE a.status = 'upcoming'
            ORDER BY a.start_time ASC
        `;

        const result = await db.query(query);

        res.json({
            success: true,
            data: {
                auctions: result.rows.map(auction => ({
                    ...auction,
                    time_until_start_seconds: Math.max(0, auction.time_until_start_seconds || 0)
                }))
            }
        });

    } catch (error) {
        console.error('Get upcoming auctions error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// @route   GET /api/auctions/closed
// @desc    Get closed auctions
// @access  Public
router.get('/status/closed', AuthMiddleware.optionalAuth, async (req, res) => {
    try {
        const query = `
            SELECT 
                a.*,
                u.username as seller_username,
                w.username as winner_username,
                c.name as category_name,
                sc.name as subcategory_name
            FROM auctions a
            LEFT JOIN users u ON a.seller_id = u.id
            LEFT JOIN users w ON a.winner_id = w.id
            LEFT JOIN categories c ON a.category_id = c.id
            LEFT JOIN categories sc ON a.subcategory_id = sc.id
            WHERE a.status = 'closed'
            ORDER BY a.end_time DESC
        `;

        const result = await db.query(query);

        res.json({
            success: true,
            data: {
                auctions: result.rows
            }
        });

    } catch (error) {
        console.error('Get closed auctions error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;