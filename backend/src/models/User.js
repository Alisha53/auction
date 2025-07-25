const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('../config/database');

class User {
    constructor(userData = {}) {
        this.id = userData.id;
        this.username = userData.username;
        this.email = userData.email;
        this.passwordHash = userData.password_hash;
        this.role = userData.role;
        this.createdAt = userData.created_at;
        this.updatedAt = userData.updated_at;
        this.isActive = userData.is_active;
        this.profileImage = userData.profile_image;
        this.phone = userData.phone;
        this.address = userData.address;
        this.db = new Database();
    }

    // Static method to create new user
    static async create(userData) {
        const database = new Database();
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        
        const query = `
            INSERT INTO users (username, email, password_hash, role, phone, address) 
            VALUES ($1, $2, $3, $4, $5, $6) 
            RETURNING *
        `;
        
        const values = [
            userData.username,
            userData.email,
            hashedPassword,
            userData.role,
            userData.phone || null,
            userData.address || null
        ];
        
        try {
            const result = await database.query(query, values);
            return new User(result.rows[0]);
        } catch (error) {
            throw new Error(`Failed to create user: ${error.message}`);
        }
    }

    // Static method to find user by email
    static async findByEmail(email) {
        const database = new Database();
        const query = 'SELECT * FROM users WHERE email = $1 AND is_active = true';
        
        try {
            const result = await database.query(query, [email]);
            return result.rows.length > 0 ? new User(result.rows[0]) : null;
        } catch (error) {
            throw new Error(`Failed to find user: ${error.message}`);
        }
    }

    // Static method to find user by ID
    static async findById(id) {
        const database = new Database();
        const query = 'SELECT * FROM users WHERE id = $1 AND is_active = true';
        
        try {
            const result = await database.query(query, [id]);
            return result.rows.length > 0 ? new User(result.rows[0]) : null;
        } catch (error) {
            throw new Error(`Failed to find user: ${error.message}`);
        }
    }

    // Static method to find user by username
    static async findByUsername(username) {
        const database = new Database();
        const query = 'SELECT * FROM users WHERE username = $1 AND is_active = true';
        
        try {
            const result = await database.query(query, [username]);
            return result.rows.length > 0 ? new User(result.rows[0]) : null;
        } catch (error) {
            throw new Error(`Failed to find user: ${error.message}`);
        }
    }

    // Instance method to verify password
    async verifyPassword(password) {
        return await bcrypt.compare(password, this.passwordHash);
    }

    // Instance method to generate JWT token
    generateToken() {
        return jwt.sign(
            { 
                id: this.id, 
                username: this.username, 
                email: this.email, 
                role: this.role 
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );
    }

    // Instance method to update profile
    async updateProfile(updateData) {
        const allowedFields = ['username', 'email', 'phone', 'address', 'profile_image'];
        const updates = [];
        const values = [];
        let paramCounter = 1;

        for (const [key, value] of Object.entries(updateData)) {
            if (allowedFields.includes(key) && value !== undefined) {
                updates.push(`${key} = $${paramCounter}`);
                values.push(value);
                paramCounter++;
            }
        }

        if (updates.length === 0) {
            throw new Error('No valid fields to update');
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(this.id);

        const query = `
            UPDATE users 
            SET ${updates.join(', ')} 
            WHERE id = $${paramCounter} 
            RETURNING *
        `;

        try {
            const result = await this.db.query(query, values);
            if (result.rows.length > 0) {
                Object.assign(this, result.rows[0]);
                return this;
            }
            throw new Error('User not found');
        } catch (error) {
            throw new Error(`Failed to update profile: ${error.message}`);
        }
    }

    // Instance method to change password
    async changePassword(currentPassword, newPassword) {
        const isCurrentPasswordValid = await this.verifyPassword(currentPassword);
        if (!isCurrentPasswordValid) {
            throw new Error('Current password is incorrect');
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        const query = `
            UPDATE users 
            SET password_hash = $1, updated_at = CURRENT_TIMESTAMP 
            WHERE id = $2 
            RETURNING *
        `;

        try {
            const result = await this.db.query(query, [hashedNewPassword, this.id]);
            if (result.rows.length > 0) {
                this.passwordHash = hashedNewPassword;
                return true;
            }
            throw new Error('User not found');
        } catch (error) {
            throw new Error(`Failed to change password: ${error.message}`);
        }
    }

    // Instance method to get bidding history
    async getBiddingHistory() {
        const query = `
            SELECT 
                bh.*,
                a.title as auction_title,
                a.image_url as auction_image,
                a.status as auction_status
            FROM bidding_history bh
            JOIN auctions a ON bh.auction_id = a.id
            WHERE bh.bidder_id = $1
            ORDER BY bh.bid_time DESC
        `;

        try {
            const result = await this.db.query(query, [this.id]);
            return result.rows;
        } catch (error) {
            throw new Error(`Failed to get bidding history: ${error.message}`);
        }
    }

    // Instance method to get user's auctions (for sellers)
    async getMyAuctions() {
        if (this.role !== 'seller') {
            throw new Error('Only sellers can access this method');
        }

        const query = `
            SELECT 
                a.*,
                c.name as category_name,
                sc.name as subcategory_name,
                COUNT(b.id) as total_bids,
                MAX(b.amount) as highest_bid
            FROM auctions a
            LEFT JOIN categories c ON a.category_id = c.id
            LEFT JOIN categories sc ON a.subcategory_id = sc.id
            LEFT JOIN bids b ON a.id = b.auction_id
            WHERE a.seller_id = $1
            GROUP BY a.id, c.name, sc.name
            ORDER BY a.created_at DESC
        `;

        try {
            const result = await this.db.query(query, [this.id]);
            return result.rows;
        } catch (error) {
            throw new Error(`Failed to get auctions: ${error.message}`);
        }
    }

    // Instance method to deactivate account
    async deactivate() {
        const query = `
            UPDATE users 
            SET is_active = false, updated_at = CURRENT_TIMESTAMP 
            WHERE id = $1 
            RETURNING *
        `;

        try {
            const result = await this.db.query(query, [this.id]);
            if (result.rows.length > 0) {
                this.isActive = false;
                return true;
            }
            throw new Error('User not found');
        } catch (error) {
            throw new Error(`Failed to deactivate account: ${error.message}`);
        }
    }

    // Method to get safe user data (without sensitive information)
    toSafeObject() {
        return {
            id: this.id,
            username: this.username,
            email: this.email,
            role: this.role,
            createdAt: this.createdAt,
            profileImage: this.profileImage,
            phone: this.phone,
            address: this.address
        };
    }
}

module.exports = User;