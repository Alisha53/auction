const { Pool } = require('pg');
require('dotenv').config();

class Database {
    constructor() {
        this.pool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'auction_db',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || '',
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
    }

    async connect() {
        try {
            const client = await this.pool.connect();
            console.log('Connected to PostgreSQL database');
            client.release();
        } catch (error) {
            console.error('Database connection error:', error);
            throw error;
        }
    }

    async query(text, params = []) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(text, params);
            return result;
        } catch (error) {
            console.error('Database query error:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async initializeTables() {
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

            // Create indexes for better performance
            `CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status)`,
            `CREATE INDEX IF NOT EXISTS idx_auctions_start_time ON auctions(start_time)`,
            `CREATE INDEX IF NOT EXISTS idx_auctions_end_time ON auctions(end_time)`,
            `CREATE INDEX IF NOT EXISTS idx_bids_auction_id ON bids(auction_id)`,
            `CREATE INDEX IF NOT EXISTS idx_bids_created_at ON bids(created_at DESC)`,
            `CREATE INDEX IF NOT EXISTS idx_proxy_bids_auction_bidder ON proxy_bids(auction_id, bidder_id)`,

            // Insert default categories
            `INSERT INTO categories (name, description, parent_id) VALUES 
                ('Electronics', 'Electronic devices and gadgets', NULL),
                ('Fashion', 'Clothing and accessories', NULL),
                ('Home & Garden', 'Home improvement and garden items', NULL),
                ('Sports', 'Sports equipment and accessories', NULL),
                ('Books', 'Books and educational materials', NULL),
                ('Art & Collectibles', 'Artwork and collectible items', NULL)
            ON CONFLICT DO NOTHING`,

            // Insert subcategories
            `INSERT INTO categories (name, description, parent_id) VALUES 
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
            ON CONFLICT DO NOTHING`,

            // Create admin user if not exists
            `INSERT INTO users (username, email, password_hash, role) VALUES 
                ('admin', 'admin@auction.com', '$2a$10$rQzF8gGJkwqF.Nx6hQ6nz.X8hNbY9t.Wx2OQmF8qX6.a1J3F9K0Km', 'admin')
            ON CONFLICT DO NOTHING`
        ];

        for (const query of queries) {
            try {
                await this.query(query);
            } catch (error) {
                console.error('Error executing query:', query.substring(0, 100) + '...');
                console.error(error);
            }
        }

        console.log('Database tables initialized successfully');
    }

    async close() {
        await this.pool.end();
    }
}

module.exports = Database;