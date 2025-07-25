const express = require('express');
const Database = require('../config/database');

const router = express.Router();
const db = new Database();

// @route   GET /api/categories
// @desc    Get all main categories
// @access  Public
router.get('/', async (req, res) => {
    try {
        const query = `
            SELECT id, name, description 
            FROM categories 
            WHERE parent_id IS NULL AND is_active = true
            ORDER BY name ASC
        `;

        const result = await db.query(query);

        res.json({
            success: true,
            data: {
                categories: result.rows
            }
        });

    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// @route   GET /api/categories/:id/subcategories
// @desc    Get subcategories for a category
// @access  Public
router.get('/:id/subcategories', async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
            SELECT id, name, description 
            FROM categories 
            WHERE parent_id = $1 AND is_active = true
            ORDER BY name ASC
        `;

        const result = await db.query(query, [id]);

        res.json({
            success: true,
            data: {
                subcategories: result.rows
            }
        });

    } catch (error) {
        console.error('Get subcategories error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// @route   GET /api/categories/all
// @desc    Get all categories with their subcategories
// @access  Public
router.get('/all', async (req, res) => {
    try {
        const query = `
            SELECT 
                c.id,
                c.name,
                c.description,
                c.parent_id,
                CASE 
                    WHEN c.parent_id IS NULL THEN 'category'
                    ELSE 'subcategory'
                END as type
            FROM categories c
            WHERE c.is_active = true
            ORDER BY c.parent_id NULLS FIRST, c.name ASC
        `;

        const result = await db.query(query);
        
        // Organize categories and subcategories
        const categories = [];
        const categoryMap = new Map();

        result.rows.forEach(row => {
            if (row.type === 'category') {
                const category = {
                    id: row.id,
                    name: row.name,
                    description: row.description,
                    subcategories: []
                };
                categories.push(category);
                categoryMap.set(row.id, category);
            }
        });

        result.rows.forEach(row => {
            if (row.type === 'subcategory') {
                const parentCategory = categoryMap.get(row.parent_id);
                if (parentCategory) {
                    parentCategory.subcategories.push({
                        id: row.id,
                        name: row.name,
                        description: row.description
                    });
                }
            }
        });

        res.json({
            success: true,
            data: {
                categories
            }
        });

    } catch (error) {
        console.error('Get all categories error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;