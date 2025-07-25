const jwt = require('jsonwebtoken');
const BidPriorityQueue = require('../algorithms/PriorityQueue');
const ProxyBiddingAlgorithm = require('../algorithms/ProxyBidding');
const DynamicPricingAlgorithm = require('../algorithms/DynamicPricing');
const Database = require('../config/database');

class AuctionSocketHandler {
    constructor(io) {
        this.io = io;
        this.db = new Database();
        this.bidQueue = new BidPriorityQueue();
        this.proxyBidding = new ProxyBiddingAlgorithm();
        this.dynamicPricing = new DynamicPricingAlgorithm();
        this.connectedUsers = new Map(); // Track connected users
        this.auctionRooms = new Map(); // Track users in auction rooms
        this.lastBidders = new Map(); // Track last bidder per auction for consecutive bid prevention
    }

    initialize() {
        this.io.use(this.authenticateSocket.bind(this));
        this.io.on('connection', this.handleConnection.bind(this));
        
        // Start auction status updater
        this.startAuctionStatusUpdater();
        
        // Start proxy bid processor
        this.startProxyBidProcessor();
    }

    // Authenticate socket connections
    async authenticateSocket(socket, next) {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Authentication error: No token provided'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Get user details from database
            const userQuery = 'SELECT * FROM users WHERE id = $1 AND is_active = true';
            const userResult = await this.db.query(userQuery, [decoded.id]);
            
            if (userResult.rows.length === 0) {
                return next(new Error('Authentication error: User not found'));
            }

            socket.user = userResult.rows[0];
            next();
        } catch (error) {
            next(new Error('Authentication error: Invalid token'));
        }
    }

    // Handle new socket connections
    handleConnection(socket) {
        console.log(`User ${socket.user.username} connected`);
        
        // Store connected user
        this.connectedUsers.set(socket.user.id, {
            socketId: socket.id,
            user: socket.user,
            connectedAt: new Date()
        });

        // Set up event handlers
        socket.on('join_auction', (data) => this.handleJoinAuction(socket, data));
        socket.on('leave_auction', (data) => this.handleLeaveAuction(socket, data));
        socket.on('place_bid', (data) => this.handlePlaceBid(socket, data));
        socket.on('set_proxy_bid', (data) => this.handleSetProxyBid(socket, data));
        socket.on('get_auction_status', (data) => this.handleGetAuctionStatus(socket, data));
        socket.on('get_bid_history', (data) => this.handleGetBidHistory(socket, data));
        socket.on('disconnect', () => this.handleDisconnect(socket));

        // Send user's active proxy bids
        this.sendUserProxyBids(socket);
    }

    // Handle joining auction room
    async handleJoinAuction(socket, data) {
        try {
            const { auctionId } = data;
            const roomName = `auction_${auctionId}`;
            
            // Join the auction room
            socket.join(roomName);
            
            // Track user in auction room
            if (!this.auctionRooms.has(auctionId)) {
                this.auctionRooms.set(auctionId, new Set());
            }
            this.auctionRooms.get(auctionId).add(socket.user.id);

            // Send current auction status
            const auctionStatus = await this.getAuctionStatus(auctionId);
            socket.emit('auction_status', auctionStatus);

            // Send recent bid history
            const bidHistory = await this.getRecentBidHistory(auctionId);
            socket.emit('bid_history', bidHistory);

            // Notify others in the room
            socket.to(roomName).emit('user_joined', {
                userId: socket.user.id,
                username: socket.user.username,
                timestamp: new Date()
            });

            console.log(`User ${socket.user.username} joined auction ${auctionId}`);
        } catch (error) {
            console.error('Error joining auction:', error);
            socket.emit('error', { message: 'Failed to join auction' });
        }
    }

    // Handle leaving auction room
    handleLeaveAuction(socket, data) {
        try {
            const { auctionId } = data;
            const roomName = `auction_${auctionId}`;
            
            socket.leave(roomName);
            
            // Remove user from auction room tracking
            if (this.auctionRooms.has(auctionId)) {
                this.auctionRooms.get(auctionId).delete(socket.user.id);
            }

            // Notify others in the room
            socket.to(roomName).emit('user_left', {
                userId: socket.user.id,
                username: socket.user.username,
                timestamp: new Date()
            });

            console.log(`User ${socket.user.username} left auction ${auctionId}`);
        } catch (error) {
            console.error('Error leaving auction:', error);
        }
    }

    // Handle placing a bid
    async handlePlaceBid(socket, data) {
        try {
            const { auctionId, amount } = data;
            const bidderId = socket.user.id;

            // Validate auction status
            const auction = await this.getAuctionById(auctionId);
            if (!auction) {
                return socket.emit('bid_error', { message: 'Auction not found' });
            }

            if (auction.status !== 'live') {
                return socket.emit('bid_error', { message: 'Auction is not live' });
            }

            if (auction.seller_id === bidderId) {
                return socket.emit('bid_error', { message: 'Sellers cannot bid on their own auctions' });
            }

            // Check consecutive bid rule
            const lastBidderId = this.lastBidders.get(auctionId);
            if (lastBidderId === bidderId) {
                return socket.emit('bid_error', { 
                    message: 'You cannot place consecutive bids. Wait for another bidder to bid first.' 
                });
            }

            // Validate bid amount
            const auctionData = await this.proxyBidding.getAuctionData(auctionId);
            const requiredIncrement = this.dynamicPricing.calculateBidIncrement(auctionData);
            const minimumBid = auction.current_price + requiredIncrement;

            if (amount < minimumBid) {
                return socket.emit('bid_error', { 
                    message: `Minimum bid is ₹${minimumBid.toFixed(2)}`,
                    minimumBid 
                });
            }

            // Place the bid
            const bid = await this.placeBid(auctionId, bidderId, amount, 'manual');
            
            // Add to priority queue
            this.bidQueue.add({
                ...bid,
                auctionId: parseInt(auctionId),
                timestamp: Date.now()
            });

            // Update last bidder
            this.lastBidders.set(auctionId, bidderId);

            // Process proxy bidding
            const proxyResponse = await this.proxyBidding.processAutomaticBidding(
                auctionId, amount, bidderId
            );

            // Broadcast bid update to auction room
            const roomName = `auction_${auctionId}`;
            const bidUpdate = {
                bidId: bid.id,
                auctionId: auctionId,
                amount: amount,
                bidderUsername: socket.user.username,
                timestamp: bid.created_at,
                totalBids: auction.total_bids + 1,
                bidType: 'manual'
            };

            this.io.to(roomName).emit('new_bid', bidUpdate);

            // If proxy bid was triggered, broadcast it too
            if (proxyResponse) {
                const proxyBidUpdate = {
                    bidId: proxyResponse.bid.id,
                    auctionId: auctionId,
                    amount: proxyResponse.amount,
                    bidderUsername: proxyResponse.proxyBidder.username,
                    timestamp: proxyResponse.bid.created_at,
                    totalBids: auction.total_bids + 2,
                    bidType: 'proxy'
                };

                this.io.to(roomName).emit('new_bid', proxyBidUpdate);

                // Update last bidder to proxy bidder
                this.lastBidders.set(auctionId, proxyResponse.proxyBidder.bidder_id);
            }

            // Send updated auction status
            const updatedStatus = await this.getAuctionStatus(auctionId);
            this.io.to(roomName).emit('auction_status', updatedStatus);

            console.log(`Bid placed: ${socket.user.username} bid ₹${amount} on auction ${auctionId}`);

        } catch (error) {
            console.error('Error placing bid:', error);
            socket.emit('bid_error', { message: 'Failed to place bid' });
        }
    }

    // Handle setting proxy bid
    async handleSetProxyBid(socket, data) {
        try {
            const { auctionId, maxAmount } = data;
            const bidderId = socket.user.id;

            const auction = await this.getAuctionById(auctionId);
            if (!auction) {
                return socket.emit('proxy_bid_error', { message: 'Auction not found' });
            }

            if (auction.status !== 'live') {
                return socket.emit('proxy_bid_error', { message: 'Auction is not live' });
            }

            if (auction.seller_id === bidderId) {
                return socket.emit('proxy_bid_error', { message: 'Sellers cannot bid on their own auctions' });
            }

            if (maxAmount <= auction.current_price) {
                return socket.emit('proxy_bid_error', { 
                    message: `Maximum bid must be higher than current price of ₹${auction.current_price}` 
                });
            }

            // Create or update proxy bid
            const proxyBid = await this.proxyBidding.createProxyBid(auctionId, bidderId, maxAmount);

            // Process greedy auto bidding if appropriate
            const autoBidResponse = await this.proxyBidding.processGreedyAutoBidding(
                auctionId, auction.current_price
            );

            socket.emit('proxy_bid_set', {
                proxyBidId: proxyBid.id,
                maxAmount: maxAmount,
                message: 'Proxy bid set successfully'
            });

            // If auto bid was placed, broadcast it
            if (autoBidResponse) {
                const roomName = `auction_${auctionId}`;
                const autoBidUpdate = {
                    bidId: autoBidResponse.bid.id,
                    auctionId: auctionId,
                    amount: autoBidResponse.amount,
                    bidderUsername: socket.user.username,
                    timestamp: autoBidResponse.bid.created_at,
                    totalBids: auction.total_bids + 1,
                    bidType: 'automatic'
                };

                this.io.to(roomName).emit('new_bid', autoBidUpdate);
                
                // Update last bidder
                this.lastBidders.set(auctionId, bidderId);

                // Send updated auction status
                const updatedStatus = await this.getAuctionStatus(auctionId);
                this.io.to(roomName).emit('auction_status', updatedStatus);
            }

            console.log(`Proxy bid set: ${socket.user.username} set max ₹${maxAmount} on auction ${auctionId}`);

        } catch (error) {
            console.error('Error setting proxy bid:', error);
            socket.emit('proxy_bid_error', { message: 'Failed to set proxy bid' });
        }
    }

    // Handle getting auction status
    async handleGetAuctionStatus(socket, data) {
        try {
            const { auctionId } = data;
            const status = await this.getAuctionStatus(auctionId);
            socket.emit('auction_status', status);
        } catch (error) {
            console.error('Error getting auction status:', error);
            socket.emit('error', { message: 'Failed to get auction status' });
        }
    }

    // Handle getting bid history
    async handleGetBidHistory(socket, data) {
        try {
            const { auctionId, limit = 20 } = data;
            const history = await this.getRecentBidHistory(auctionId, limit);
            socket.emit('bid_history', history);
        } catch (error) {
            console.error('Error getting bid history:', error);
            socket.emit('error', { message: 'Failed to get bid history' });
        }
    }

    // Handle user disconnect
    handleDisconnect(socket) {
        console.log(`User ${socket.user.username} disconnected`);
        
        // Remove from connected users
        this.connectedUsers.delete(socket.user.id);
        
        // Remove from all auction rooms
        for (const [auctionId, users] of this.auctionRooms.entries()) {
            if (users.has(socket.user.id)) {
                users.delete(socket.user.id);
                socket.to(`auction_${auctionId}`).emit('user_left', {
                    userId: socket.user.id,
                    username: socket.user.username,
                    timestamp: new Date()
                });
            }
        }
    }

    // Helper method to place a bid
    async placeBid(auctionId, bidderId, amount, bidType = 'manual') {
        const insertBidQuery = `
            INSERT INTO bids (auction_id, bidder_id, amount, bid_type)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;
        
        const bidResult = await this.db.query(insertBidQuery, [auctionId, bidderId, amount, bidType]);

        // Update auction current price and bid count
        await this.db.query(
            'UPDATE auctions SET current_price = $1, total_bids = total_bids + 1 WHERE id = $2',
            [amount, auctionId]
        );

        // Update winning bid status
        await this.db.query(
            'UPDATE bids SET is_winning = false WHERE auction_id = $1 AND id != $2',
            [auctionId, bidResult.rows[0].id]
        );

        await this.db.query(
            'UPDATE bids SET is_winning = true WHERE id = $1',
            [bidResult.rows[0].id]
        );

        return bidResult.rows[0];
    }

    // Helper method to get auction by ID
    async getAuctionById(auctionId) {
        const query = 'SELECT * FROM auctions WHERE id = $1';
        const result = await this.db.query(query, [auctionId]);
        return result.rows[0] || null;
    }

    // Helper method to get auction status
    async getAuctionStatus(auctionId) {
        const query = `
            SELECT 
                a.*,
                u.username as seller_username,
                c.name as category_name,
                sc.name as subcategory_name,
                EXTRACT(EPOCH FROM (a.end_time - NOW())) as time_remaining_seconds,
                (SELECT COUNT(*) FROM bids WHERE auction_id = a.id) as total_bids,
                (SELECT amount FROM bids WHERE auction_id = a.id ORDER BY created_at DESC LIMIT 1) as highest_bid
            FROM auctions a
            LEFT JOIN users u ON a.seller_id = u.id
            LEFT JOIN categories c ON a.category_id = c.id
            LEFT JOIN categories sc ON a.subcategory_id = sc.id
            WHERE a.id = $1
        `;
        
        const result = await this.db.query(query, [auctionId]);
        const auction = result.rows[0];
        
        if (auction) {
            auction.time_remaining_seconds = Math.max(0, auction.time_remaining_seconds);
            auction.is_ended = auction.time_remaining_seconds <= 0;
        }
        
        return auction;
    }

    // Helper method to get recent bid history
    async getRecentBidHistory(auctionId, limit = 20) {
        const query = `
            SELECT 
                b.id,
                b.amount,
                b.bid_type,
                b.created_at,
                u.username as bidder_username
            FROM bids b
            JOIN users u ON b.bidder_id = u.id
            WHERE b.auction_id = $1
            ORDER BY b.created_at DESC
            LIMIT $2
        `;
        
        const result = await this.db.query(query, [auctionId, limit]);
        return result.rows;
    }

    // Send user's proxy bids
    async sendUserProxyBids(socket) {
        try {
            const proxyBids = await this.proxyBidding.getUserProxyBids(socket.user.id);
            socket.emit('user_proxy_bids', proxyBids);
        } catch (error) {
            console.error('Error sending user proxy bids:', error);
        }
    }

    // Start auction status updater
    startAuctionStatusUpdater() {
        setInterval(async () => {
            try {
                // Check for auctions that should change status
                await this.updateAuctionStatuses();
            } catch (error) {
                console.error('Error updating auction statuses:', error);
            }
        }, 30000); // Check every 30 seconds
    }

    // Start proxy bid processor
    startProxyBidProcessor() {
        setInterval(async () => {
            try {
                await this.proxyBidding.processExpiredAuctions();
            } catch (error) {
                console.error('Error processing expired auctions:', error);
            }
        }, 60000); // Check every minute
    }

    // Update auction statuses based on time
    async updateAuctionStatuses() {
        // Update upcoming auctions to live
        const upcomingToLiveQuery = `
            UPDATE auctions 
            SET status = 'live' 
            WHERE status = 'upcoming' AND start_time <= NOW()
            RETURNING id
        `;
        
        const liveAuctions = await this.db.query(upcomingToLiveQuery);
        
        // Broadcast status updates for newly live auctions
        for (const auction of liveAuctions.rows) {
            const roomName = `auction_${auction.id}`;
            this.io.to(roomName).emit('auction_status_changed', {
                auctionId: auction.id,
                status: 'live',
                message: 'Auction is now live!'
            });
        }

        // Update live auctions to closed
        const liveToClosedQuery = `
            UPDATE auctions 
            SET status = 'closed' 
            WHERE status = 'live' AND end_time <= NOW()
            RETURNING id
        `;
        
        const closedAuctions = await this.db.query(liveToClosedQuery);
        
        // Process closed auctions
        for (const auction of closedAuctions.rows) {
            await this.handleAuctionEnd(auction.id);
        }
    }

    // Handle auction end
    async handleAuctionEnd(auctionId) {
        try {
            const roomName = `auction_${auctionId}`;
            
            // Find the winner
            const winnerQuery = `
                SELECT b.bidder_id, b.amount, u.username 
                FROM bids b
                JOIN users u ON b.bidder_id = u.id
                WHERE b.auction_id = $1 AND b.is_winning = true
                ORDER BY b.created_at DESC 
                LIMIT 1
            `;
            
            const winnerResult = await this.db.query(winnerQuery, [auctionId]);
            
            if (winnerResult.rows.length > 0) {
                const winner = winnerResult.rows[0];
                
                // Update auction with winner
                await this.db.query(
                    'UPDATE auctions SET winner_id = $1 WHERE id = $2',
                    [winner.bidder_id, auctionId]
                );

                // Notify auction room about the end
                this.io.to(roomName).emit('auction_ended', {
                    auctionId: auctionId,
                    winner: {
                        userId: winner.bidder_id,
                        username: winner.username,
                        winningBid: winner.amount
                    },
                    timestamp: new Date()
                });

                // Send congratulation message to winner if online
                const winnerConnection = this.connectedUsers.get(winner.bidder_id);
                if (winnerConnection) {
                    this.io.to(winnerConnection.socketId).emit('auction_won', {
                        auctionId: auctionId,
                        winningBid: winner.amount,
                        message: `Congratulations! You won the auction with a bid of ₹${winner.amount}`
                    });
                }
            } else {
                // No winner (no bids)
                this.io.to(roomName).emit('auction_ended', {
                    auctionId: auctionId,
                    winner: null,
                    message: 'Auction ended with no bids',
                    timestamp: new Date()
                });
            }

            // Clean up
            this.lastBidders.delete(auctionId);
            this.bidQueue.removeBidsForAuction(auctionId);
            
        } catch (error) {
            console.error('Error handling auction end:', error);
        }
    }
}

module.exports = AuctionSocketHandler;