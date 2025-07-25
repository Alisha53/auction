const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const Database = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const auctionRoutes = require('./routes/auctionRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const bidRoutes = require('./routes/bidRoutes');
const userRoutes = require('./routes/userRoutes');
const AuctionSocketHandler = require('./sockets/auctionSocketHandler');

class Server {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: process.env.FRONTEND_URL || "http://localhost:3000",
                methods: ["GET", "POST"]
            }
        });
        this.port = process.env.PORT || 5000;
        this.database = new Database();
        
        this.initializeMiddleware();
        this.initializeRoutes();
        this.initializeSocketHandlers();
        this.initializeDatabase();
    }

    initializeMiddleware() {
        // Security middleware
        this.app.use(helmet());
        
        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100 // limit each IP to 100 requests per windowMs
        });
        this.app.use(limiter);

        // CORS
        this.app.use(cors({
            origin: process.env.FRONTEND_URL || "http://localhost:3000",
            credentials: true
        }));

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // Static files
        this.app.use('/uploads', express.static('uploads'));
    }

    initializeRoutes() {
        this.app.use('/api/auth', authRoutes);
        this.app.use('/api/auctions', auctionRoutes);
        this.app.use('/api/categories', categoryRoutes);
        this.app.use('/api/bids', bidRoutes);
        this.app.use('/api/users', userRoutes);

        // Health check
        this.app.get('/api/health', (req, res) => {
            res.json({ status: 'OK', timestamp: new Date().toISOString() });
        });
    }

    initializeSocketHandlers() {
        const auctionSocketHandler = new AuctionSocketHandler(this.io);
        auctionSocketHandler.initialize();
    }

    async initializeDatabase() {
        try {
            await this.database.connect();
            await this.database.initializeTables();
            console.log('Database connected and initialized successfully');
        } catch (error) {
            console.error('Database initialization failed:', error.message);
            console.error('\n🔧 To fix this issue:');
            console.error('1. Make sure PostgreSQL is running');
            console.error('2. Check your database credentials in .env file');
            console.error('3. Run: npm run setup-db');
            console.error('4. Or create the database manually and restart the server\n');
            process.exit(1);
        }
    }

    start() {
        this.server.listen(this.port, () => {
            console.log(`Server running on port ${this.port}`);
            console.log(`Environment: ${process.env.NODE_ENV}`);
        });
    }
}

const server = new Server();
server.start();

module.exports = Server;