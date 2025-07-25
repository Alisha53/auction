# Online Auction System

A comprehensive real-time online auction platform built with React, Node.js, Socket.IO, and PostgreSQL. The system supports three user roles: bidders, sellers, and admins, with advanced features like proxy bidding, dynamic pricing algorithms, and real-time bid management.

## 🚀 Features

### Core Functionality
- **Real-time Bidding**: Live auction bidding with WebSocket support via Socket.IO
- **Multi-role System**: Support for bidders, sellers, and administrators
- **Auction Management**: Create, update, and manage auctions with categories and subcategories
- **Advanced Bidding**: Manual bidding, proxy bidding, and automatic bidding algorithms

### Advanced Algorithms
- **Priority Queue**: Manages incoming bids and ensures highest bid updates instantly
- **Dynamic Pricing**: Adjusts bid increments based on bidding activity and time pressure
- **Greedy Algorithm**: Automatic bidding that places minimum required bids
- **Proxy Bidding**: Users can set maximum bids and system automatically bids on their behalf

### User Experience
- **Responsive Design**: Modern, mobile-friendly interface with Tailwind CSS
- **Role-based Navigation**: Different interfaces for bidders, sellers, and admins
- **Real-time Notifications**: Live updates for bid changes, auction status, and winners
- **Search & Filter**: Advanced filtering by category, price, status, and more

## 🏗️ Architecture

### Backend (Node.js + Express)
- **Object-Oriented Design**: Clean OOP architecture with proper separation of concerns
- **RESTful API**: Comprehensive API endpoints for all functionality
- **WebSocket Support**: Real-time communication with Socket.IO
- **Authentication**: JWT-based authentication with role-based access control
- **Database**: PostgreSQL with optimized queries and indexing

### Frontend (React + TypeScript)
- **Component-based Architecture**: Reusable components for different user roles
- **Type Safety**: Full TypeScript implementation for better development experience
- **State Management**: Context API for global state management
- **Real-time Updates**: Socket.IO client for live auction updates

## 📦 Project Structure

```
online-auction-system/
├── backend/
│   ├── src/
│   │   ├── algorithms/          # Bidding algorithms
│   │   │   ├── PriorityQueue.js
│   │   │   ├── DynamicPricing.js
│   │   │   └── ProxyBidding.js
│   │   ├── config/              # Database configuration
│   │   ├── middleware/          # Authentication middleware
│   │   ├── models/              # Data models
│   │   ├── routes/              # API routes
│   │   ├── sockets/             # WebSocket handlers
│   │   └── server.js            # Main server file
│   ├── uploads/                 # File uploads
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/          # React components
│   │   │   ├── common/          # Shared components
│   │   │   ├── bidder/          # Bidder-specific components
│   │   │   ├── seller/          # Seller-specific components
│   │   │   └── admin/           # Admin-specific components
│   │   ├── contexts/            # React contexts
│   │   ├── hooks/               # Custom hooks
│   │   ├── services/            # API services
│   │   ├── types/               # TypeScript types
│   │   └── utils/               # Utility functions
│   └── package.json
└── README.md
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### Backend Setup

1. **Install backend dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   # .env file is already created with default settings
   # Update database password if needed:
   nano .env
   ```

3. **Set up PostgreSQL database (Automatic):**
   ```bash
   # This creates database, tables, and sample data
   npm run setup-db
   ```

4. **Start the backend server:**
   ```bash
   npm run dev
   ```
   Server runs on `http://localhost:5000`

### Frontend Setup

1. **Install frontend dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Start the frontend development server:**
   ```bash
   npm start
   ```

2. **Start the frontend development server:**
   ```bash
   npm start
   ```
   Frontend runs on `http://localhost:3000`

### Running Both Services

From the root directory:
```bash
# Install all dependencies
npm run install-all

# Start both backend and frontend
npm run dev
```

## 🔑 Default Login Credentials

After running the database setup, you can log in with these accounts:

| Role   | Email                | Password   |
|--------|---------------------|------------|
| Admin  | admin@auction.com   | admin123   |
| Bidder | john@example.com    | bidder123  |
| Seller | jane@example.com    | seller123  |

## 🗄️ Database Setup

For detailed database setup instructions, see [DATABASE_SETUP.md](DATABASE_SETUP.md)

**Quick setup:**
```bash
npm run install-all
npm run dev
```

## 🔧 Environment Variables

### Backend (.env)
```
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=auction_db
DB_USER=postgres
DB_PASSWORD=your_password

# JWT Configuration
JWT_SECRET=your_very_secure_jwt_secret_key_here
JWT_EXPIRES_IN=7d

# Upload Configuration
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880

# CORS Configuration
FRONTEND_URL=http://localhost:3000
```

## 📋 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile

### Auctions
- `GET /api/auctions` - Get all auctions with filters
- `GET /api/auctions/:id` - Get auction details
- `POST /api/auctions` - Create auction (sellers only)
- `PUT /api/auctions/:id` - Update auction
- `DELETE /api/auctions/:id` - Cancel auction

### Bidding
- `POST /api/bids/proxy` - Set proxy bid
- `GET /api/bids/proxy` - Get user's proxy bids
- `DELETE /api/bids/proxy/:auctionId` - Deactivate proxy bid

### Categories
- `GET /api/categories` - Get all categories
- `GET /api/categories/:id/subcategories` - Get subcategories

## 🎯 User Roles & Features

### Bidders
- Browse and search auctions
- Place manual bids on live auctions
- Set proxy bids with maximum amounts
- View bidding history
- Receive real-time notifications
- Cannot place consecutive bids (anti-spam protection)

### Sellers
- Create and manage auctions
- Set categories, subcategories, and pricing
- Upload product images
- View auction performance and bid history
- Manage auction status (upcoming, live, closed)
- Access seller dashboard with analytics

### Admins
- Full system access and management
- User management and role assignment
- System monitoring and analytics
- Category and subcategory management

## 🔄 Real-time Features

### WebSocket Events
- `join_auction` - Join auction room for live updates
- `place_bid` - Place a manual bid
- `set_proxy_bid` - Set automatic bidding
- `new_bid` - Receive new bid notifications
- `auction_ended` - Auction completion notifications
- `auction_won` - Winner congratulations

### Bidding Rules
- **Consecutive Bid Prevention**: Same user cannot place two consecutive bids
- **Dynamic Increments**: Bid increments adjust based on activity and time pressure
- **Proxy Bidding**: Automatic bidding up to user's maximum amount
- **Real-time Updates**: All users see bid updates instantly

## 🧮 Algorithms Explained

### 1. Priority Queue Algorithm
- **Purpose**: Manages incoming bids efficiently
- **Implementation**: Max-heap structure for highest bid prioritization
- **Benefits**: O(log n) insertion and extraction of highest bids

### 2. Dynamic Pricing Algorithm
- **Factors**: Price jump magnitude, bidding velocity, time pressure, competition
- **Logic**: Adjusts bid increments from ₹5 to ₹500 based on auction dynamics
- **Example**: If price jumps 300% above starting price, increment increases 4x

### 3. Proxy Bidding Algorithm
- **Greedy Approach**: Places minimum required bid to maintain lead
- **Strategy**: Bids just enough to beat second-highest proxy bid
- **Automation**: Continues bidding even when user is offline

## 🎨 Design Principles

### Frontend
- **Mobile-first**: Responsive design for all screen sizes
- **Accessibility**: WCAG 2.1 compliant components
- **Performance**: Optimized rendering and lazy loading
- **UX**: Intuitive navigation and clear call-to-actions

### Backend
- **Security**: JWT authentication, input validation, rate limiting
- **Scalability**: Efficient database queries and connection pooling
- **Reliability**: Error handling and graceful degradation
- **Maintainability**: Clean code structure and comprehensive logging

## 🔒 Security Features

- **Authentication**: JWT-based with role verification
- **Authorization**: Role-based access control (RBAC)
- **Input Validation**: Joi schema validation for all inputs
- **Rate Limiting**: Protection against spam and DDoS attacks
- **SQL Injection Protection**: Parameterized queries
- **XSS Prevention**: Input sanitization and CSP headers

## 📊 Database Schema

### Key Tables
- **users**: User accounts with roles and profiles
- **auctions**: Auction listings with status and timing
- **bids**: Individual bid records with types
- **proxy_bids**: Automatic bidding configurations
- **categories**: Hierarchical category structure
- **bidding_history**: Complete bidding activity log

## 🚀 Deployment

### Production Setup
1. **Environment**: Set `NODE_ENV=production`
2. **Database**: Use PostgreSQL with SSL
3. **Security**: Enable HTTPS and security headers
4. **Performance**: Use Redis for session management
5. **Monitoring**: Set up logging and error tracking

### Recommended Stack
- **Hosting**: AWS EC2 or DigitalOcean Droplets
- **Database**: AWS RDS PostgreSQL
- **CDN**: CloudFlare for static assets
- **SSL**: Let's Encrypt certificates
- **Process Manager**: PM2 for Node.js

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test
```

### Frontend Tests
```bash
cd frontend
npm test
```

## 📈 Performance Optimizations

- **Database Indexing**: Optimized queries with proper indexes
- **Connection Pooling**: Efficient database connection management
- **Caching**: Redis for frequently accessed data
- **Compression**: Gzip compression for API responses
- **CDN**: Static asset delivery optimization

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Contact the development team
- Check the documentation wiki

---

**Built with ❤️ using React, Node.js, Socket.IO, and PostgreSQL**