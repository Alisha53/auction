# 🗄️ Database Setup Guide

This guide will help you set up the PostgreSQL database for the Online Auction System.

## 📋 Prerequisites

1. **PostgreSQL installed** on your system
   - Download from: https://www.postgresql.org/download/
   - Or use Docker: `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password --name auction_postgres postgres`

2. **Database credentials** configured in `backend/.env`

## 🚀 Quick Setup

### Option 1: Automatic Setup (Recommended)

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Run the database setup script
npm run setup-db
```

This script will:
- ✅ Create the database if it doesn't exist
- ✅ Create all required tables
- ✅ Add performance indexes
- ✅ Insert default categories and sample users

### Option 2: Manual Setup

1. **Create Database:**
   ```sql
   CREATE DATABASE auction_db;
   ```

2. **Run the server** (it will create tables automatically):
   ```bash
   npm run dev
   ```

## 🔧 Configuration

### Environment Variables

Update `backend/.env` with your PostgreSQL credentials:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=auction_db
DB_USER=postgres
DB_PASSWORD=your_password
```

### Default Database Settings

- **Host:** localhost
- **Port:** 5432
- **Database:** auction_db
- **User:** postgres

## 👥 Default User Accounts

After setup, you can log in with these accounts:

| Role   | Email                | Password   |
|--------|---------------------|------------|
| Admin  | admin@auction.com   | admin123   |
| Bidder | john@example.com    | bidder123  |
| Seller | jane@example.com    | seller123  |

## 📊 Database Schema

### Tables Created:

1. **users** - User accounts and profiles
2. **categories** - Auction categories and subcategories
3. **auctions** - Auction items and details
4. **bids** - Individual bids placed on auctions
5. **proxy_bids** - Automatic bidding configurations
6. **bidding_history** - Complete bidding history for users

### Sample Categories:

- **Electronics** (Smartphones, Laptops, Gaming)
- **Fashion** (Men's/Women's Clothing, Shoes)
- **Home & Garden** (Furniture, Kitchen, Garden Tools)
- **Sports** (Football, Basketball, Tennis)
- **Books**
- **Art & Collectibles**

## 🔄 Reset Database

To completely reset the database:

```bash
# Drop and recreate database
psql -U postgres -c "DROP DATABASE IF EXISTS auction_db;"
psql -U postgres -c "CREATE DATABASE auction_db;"

# Run setup again
npm run setup-db
```

## 🐛 Troubleshooting

### Common Issues:

1. **Connection refused:**
   - Ensure PostgreSQL is running
   - Check if the port 5432 is available

2. **Authentication failed:**
   - Verify username and password in `.env`
   - Check PostgreSQL user permissions

3. **Database does not exist:**
   - Run `npm run setup-db` to create it automatically
   - Or create manually: `createdb auction_db`

4. **Permission denied:**
   - Ensure the PostgreSQL user has CREATE privileges
   - Grant permissions: `GRANT ALL PRIVILEGES ON DATABASE auction_db TO your_user;`

### Getting Help:

If you encounter issues:
1. Check PostgreSQL service status
2. Verify connection with: `psql -h localhost -U postgres -d auction_db`
3. Review error logs in the terminal
4. Ensure all environment variables are set correctly

## 📈 Performance Optimizations

The setup script automatically creates indexes for:
- Auction status and timing
- Bid relationships and timestamps
- User and auction relationships

These indexes ensure optimal performance for:
- Real-time bidding operations
- Auction listing and filtering
- User activity tracking

## 🔒 Security Notes

- Default passwords are for development only
- Change all passwords in production
- Use environment variables for sensitive data
- Enable SSL for production databases