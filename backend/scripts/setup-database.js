#!/usr/bin/env node

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

class DatabaseSetup {
    constructor() {
        // First try to connect to the specific database
        this.dbPool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'auction_db',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || '',
        });

        // Pool for connecting to postgres db to create database if needed
        this.postgresPool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: 'postgres',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || '',
        });
    }

    async createDatabaseIfNotExists() {
        const dbName = process.env.DB_NAME || 'auction_db';
        
        try {
            // Check if database exists
            const result = await this.postgresPool.query(
                'SELECT 1 FROM pg_database WHERE datname = $1',
                [dbName]
            );

            if (result.rows.length === 0) {
                console.log(`Database '${dbName}' does not exist. Creating...`);
                await this.postgresPool.query(`CREATE DATABASE "${dbName}"`);
                console.log(`Database '${dbName}' created successfully.`);
            } else {
                console.log(`Database '${dbName}' already exists.`);
            }
        } catch (error) {
            console.error('Error creating database:', error.message);
            throw error;
        }
    }

    async initializeTables() {
        console.log('Initializing database tables...');
        
        const queries = [
            // Users table
            `CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) NOT NULL CHECK (role IN ('bidder', 'seller', 'admin')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT true,
                profile_image VARCHAR(255),
                phone VARCHAR(20),
                address TEXT
            )`,

            // Categories table
            `CREATE TABLE IF NOT EXISTS categories (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                parent_id INTEGER REFERENCES categories(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT true
            )`,

            // Auctions table
            `CREATE TABLE IF NOT EXISTS auctions (
                id SERIAL PRIMARY KEY,
                product_id VARCHAR(50) UNIQUE NOT NULL,
                seller_id INTEGER REFERENCES users(id) NOT NULL,
                category_id INTEGER REFERENCES categories(id) NOT NULL,
                subcategory_id INTEGER REFERENCES categories(id),
                title VARCHAR(200) NOT NULL,
                description TEXT,
                image_url VARCHAR(255),
                starting_price DECIMAL(10,2) NOT NULL,
                reserve_price DECIMAL(10,2),
                current_price DECIMAL(10,2) DEFAULT 0,
                bid_increment DECIMAL(10,2) DEFAULT 5.00,
                start_time TIMESTAMP NOT NULL,
                end_time TIMESTAMP NOT NULL,
                status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'closed', 'cancelled')),
                winner_id INTEGER REFERENCES users(id),
                total_bids INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            // Bids table
            `CREATE TABLE IF NOT EXISTS bids (
                id SERIAL PRIMARY KEY,
                auction_id INTEGER REFERENCES auctions(id) NOT NULL,
                bidder_id INTEGER REFERENCES users(id) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                bid_type VARCHAR(20) DEFAULT 'manual' CHECK (bid_type IN ('manual', 'proxy', 'automatic')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_winning BOOLEAN DEFAULT false
            )`,

            // Proxy bids table for automatic bidding
            `CREATE TABLE IF NOT EXISTS proxy_bids (
                id SERIAL PRIMARY KEY,
                auction_id INTEGER REFERENCES auctions(id) NOT NULL,
                bidder_id INTEGER REFERENCES users(id) NOT NULL,
                max_amount DECIMAL(10,2) NOT NULL,
                current_amount DECIMAL(10,2) NOT NULL,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            // Bidding history table
            `CREATE TABLE IF NOT EXISTS bidding_history (
                id SERIAL PRIMARY KEY,
                bidder_id INTEGER REFERENCES users(id) NOT NULL,
                auction_id INTEGER REFERENCES auctions(id) NOT NULL,
                bid_amount DECIMAL(10,2) NOT NULL,
                bid_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                result VARCHAR(20) CHECK (result IN ('won', 'lost', 'outbid', 'active'))
            )`,
        ];

        for (const query of queries) {
            try {
                await this.dbPool.query(query);
                console.log('✓ Table created successfully');
            } catch (error) {
                console.error('✗ Error creating table:', error.message);
                throw error;
            }
        }
    }

    async createIndexes() {
        console.log('Creating database indexes...');
        
        const indexes = [
            `CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status)`,
            `CREATE INDEX IF NOT EXISTS idx_auctions_start_time ON auctions(start_time)`,
            `CREATE INDEX IF NOT EXISTS idx_auctions_end_time ON auctions(end_time)`,
            `CREATE INDEX IF NOT EXISTS idx_bids_auction_id ON bids(auction_id)`,
            `CREATE INDEX IF NOT EXISTS idx_bids_created_at ON bids(created_at DESC)`,
            `CREATE INDEX IF NOT EXISTS idx_proxy_bids_auction_bidder ON proxy_bids(auction_id, bidder_id)`,
        ];

        for (const index of indexes) {
            try {
                await this.dbPool.query(index);
                console.log('✓ Index created successfully');
            } catch (error) {
                console.error('✗ Error creating index:', error.message);
            }
        }
    }

    async insertDefaultData() {
        console.log('Inserting default data...');

        try {
            // Insert default categories
            await this.dbPool.query(`
                INSERT INTO categories (name, description, parent_id) VALUES 
                    ('Electronics', 'Electronic devices and gadgets', NULL),
                    ('Fashion', 'Clothing and accessories', NULL),
                    ('Home & Garden', 'Home improvement and garden items', NULL),
                    ('Sports', 'Sports equipment and accessories', NULL),
                    ('Books', 'Books and educational materials', NULL),
                    ('Art & Collectibles', 'Artwork and collectible items', NULL)
                ON CONFLICT DO NOTHING
            `);
            console.log('✓ Main categories inserted');

            // Insert subcategories
            await this.dbPool.query(`
                INSERT INTO categories (name, description, parent_id) VALUES 
                    ('Smartphones', 'Mobile phones and accessories', 1),
                    ('Laptops', 'Laptops and notebooks', 1),
                    ('Gaming', 'Gaming consoles and accessories', 1),
                    ('Mens Clothing', 'Clothing for men', 2),
                    ('Womens Clothing', 'Clothing for women', 2),
                    ('Shoes', 'Footwear for all', 2),
                    ('Furniture', 'Home furniture', 3),
                    ('Kitchen', 'Kitchen appliances and tools', 3),
                    ('Garden Tools', 'Gardening equipment', 3),
                    ('Football', 'Football equipment', 4),
                    ('Basketball', 'Basketball equipment', 4),
                    ('Tennis', 'Tennis equipment', 4)
                ON CONFLICT DO NOTHING
            `);
            console.log('✓ Subcategories inserted');

            // Create admin user with hashed password
            const adminPassword = await bcrypt.hash('admin123', 10);
            await this.dbPool.query(`
                INSERT INTO users (username, email, password_hash, role) VALUES 
                    ('admin', 'admin@auction.com', $1, 'admin')
                ON CONFLICT (email) DO NOTHING
            `, [adminPassword]);
            console.log('✓ Admin user created (email: admin@auction.com, password: admin123)');

            // Create sample users
            const bidderPassword = await bcrypt.hash('bidder123', 10);
            const sellerPassword = await bcrypt.hash('seller123', 10);
            
            await this.dbPool.query(`
                INSERT INTO users (username, email, password_hash, role) VALUES 
                    ('john_bidder', 'john@example.com', $1, 'bidder'),
                    ('jane_seller', 'jane@example.com', $2, 'seller')
                ON CONFLICT (email) DO NOTHING
            `, [bidderPassword, sellerPassword]);
            console.log('✓ Sample users created');
            console.log('  - Bidder: john@example.com / bidder123');
            console.log('  - Seller: jane@example.com / seller123');

        } catch (error) {
            console.error('Error inserting default data:', error.message);
        }
    }

    async setup() {
        try {
            console.log('🚀 Starting database setup...\n');

            // Step 1: Create database if it doesn't exist
            await this.createDatabaseIfNotExists();
            
            // Step 2: Initialize tables
            await this.initializeTables();
            
            // Step 3: Create indexes
            await this.createIndexes();
            
            // Step 4: Insert default data
            await this.insertDefaultData();

            console.log('\n✅ Database setup completed successfully!');
            console.log('\n📋 Summary:');
            console.log('- Database created/verified');
            console.log('- All tables created');
            console.log('- Indexes created for performance');
            console.log('- Default categories and users inserted');
            console.log('\n🔑 Login credentials:');
            console.log('Admin: admin@auction.com / admin123');
            console.log('Bidder: john@example.com / bidder123');
            console.log('Seller: jane@example.com / seller123');

        } catch (error) {
            console.error('\n❌ Database setup failed:', error.message);
            process.exit(1);
        } finally {
            await this.close();
        }
    }

    async close() {
        await this.dbPool.end();
        await this.postgresPool.end();
    }
}

// Run setup if called directly
if (require.main === module) {
    const setup = new DatabaseSetup();
    setup.setup();
}

module.exports = DatabaseSetup;