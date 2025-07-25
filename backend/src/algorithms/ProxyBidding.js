const Database = require('../config/database');
const DynamicPricingAlgorithm = require('./DynamicPricing');

class ProxyBiddingAlgorithm {
    constructor() {
        this.db = new Database();
        this.dynamicPricing = new DynamicPricingAlgorithm();
    }

    // Create or update proxy bid
    async createProxyBid(auctionId, bidderId, maxAmount) {
        try {
            // Check if user already has an active proxy bid
            const existingProxyQuery = `
                SELECT * FROM proxy_bids 
                WHERE auction_id = $1 AND bidder_id = $2 AND is_active = true
            `;
            const existingProxy = await this.db.query(existingProxyQuery, [auctionId, bidderId]);

            if (existingProxy.rows.length > 0) {
                // Update existing proxy bid
                const updateQuery = `
                    UPDATE proxy_bids 
                    SET max_amount = $1, updated_at = CURRENT_TIMESTAMP
                    WHERE auction_id = $2 AND bidder_id = $3 AND is_active = true
                    RETURNING *
                `;
                const result = await this.db.query(updateQuery, [maxAmount, auctionId, bidderId]);
                return result.rows[0];
            } else {
                // Create new proxy bid
                const insertQuery = `
                    INSERT INTO proxy_bids (auction_id, bidder_id, max_amount, current_amount)
                    VALUES ($1, $2, $3, $4)
                    RETURNING *
                `;
                
                // Get current auction price to set initial current_amount
                const auctionQuery = 'SELECT current_price FROM auctions WHERE id = $1';
                const auctionResult = await this.db.query(auctionQuery, [auctionId]);
                const currentPrice = auctionResult.rows[0]?.current_price || 0;
                
                const result = await this.db.query(insertQuery, [
                    auctionId, bidderId, maxAmount, currentPrice
                ]);
                return result.rows[0];
            }
        } catch (error) {
            throw new Error(`Failed to create proxy bid: ${error.message}`);
        }
    }

    // Process automatic bidding when a new bid is placed
    async processAutomaticBidding(auctionId, newBidAmount, newBidderId) {
        try {
            // Get all active proxy bids for this auction (excluding the bidder who just bid)
            const proxyBidsQuery = `
                SELECT pb.*, u.username 
                FROM proxy_bids pb
                JOIN users u ON pb.bidder_id = u.id
                WHERE pb.auction_id = $1 
                AND pb.is_active = true 
                AND pb.bidder_id != $2
                AND pb.max_amount > $3
                ORDER BY pb.max_amount DESC, pb.created_at ASC
            `;
            
            const proxyBids = await this.db.query(proxyBidsQuery, [
                auctionId, newBidderId, newBidAmount
            ]);

            if (proxyBids.rows.length === 0) {
                return null; // No proxy bids can counter this bid
            }

            // Get auction data for dynamic pricing
            const auctionData = await this.getAuctionData(auctionId);
            
            // Find the highest proxy bid that can counter
            const highestProxyBid = proxyBids.rows[0];
            
            // Calculate the minimum amount needed to outbid the current bid
            const increment = this.dynamicPricing.calculateProxyIncrement(auctionData);
            const counterBidAmount = newBidAmount + increment;

            // Check if the proxy bid can afford the counter bid
            if (counterBidAmount <= highestProxyBid.max_amount) {
                // Place automatic counter bid
                const automaticBid = await this.placeAutomaticBid(
                    auctionId,
                    highestProxyBid.bidder_id,
                    counterBidAmount,
                    'proxy'
                );

                // Update proxy bid current amount
                await this.updateProxyBidCurrentAmount(
                    highestProxyBid.id,
                    counterBidAmount
                );

                return {
                    bid: automaticBid,
                    proxyBidder: highestProxyBid,
                    amount: counterBidAmount
                };
            }

            return null;
        } catch (error) {
            throw new Error(`Failed to process automatic bidding: ${error.message}`);
        }
    }

    // Greedy algorithm for automatic bidding - place minimum required bid
    async processGreedyAutoBidding(auctionId, currentHighestBid) {
        try {
            // Get all active proxy bids that can outbid current highest
            const proxyBidsQuery = `
                SELECT pb.*, u.username 
                FROM proxy_bids pb
                JOIN users u ON pb.bidder_id = u.id
                WHERE pb.auction_id = $1 
                AND pb.is_active = true 
                AND pb.max_amount > $2
                ORDER BY pb.max_amount DESC, pb.created_at ASC
            `;
            
            const proxyBids = await this.db.query(proxyBidsQuery, [
                auctionId, currentHighestBid
            ]);

            if (proxyBids.rows.length === 0) {
                return null;
            }

            const auctionData = await this.getAuctionData(auctionId);
            const increment = this.dynamicPricing.calculateProxyIncrement(auctionData);
            
            // Greedy approach: place the minimum bid needed to lead
            const highestProxyBid = proxyBids.rows[0];
            let optimalBidAmount;

            if (proxyBids.rows.length === 1) {
                // Only one proxy bidder - bid minimum increment above current highest
                optimalBidAmount = currentHighestBid + increment;
            } else {
                // Multiple proxy bidders - use greedy algorithm
                const secondHighestMax = proxyBids.rows[1].max_amount;
                
                // Bid just enough to beat the second highest proxy bid
                optimalBidAmount = Math.min(
                    secondHighestMax + increment,
                    highestProxyBid.max_amount
                );
                
                // Ensure we're still above current highest
                optimalBidAmount = Math.max(optimalBidAmount, currentHighestBid + increment);
            }

            // Ensure we don't exceed the proxy bidder's maximum
            if (optimalBidAmount <= highestProxyBid.max_amount) {
                const automaticBid = await this.placeAutomaticBid(
                    auctionId,
                    highestProxyBid.bidder_id,
                    optimalBidAmount,
                    'automatic'
                );

                await this.updateProxyBidCurrentAmount(
                    highestProxyBid.id,
                    optimalBidAmount
                );

                return {
                    bid: automaticBid,
                    proxyBidder: highestProxyBid,
                    amount: optimalBidAmount,
                    strategy: 'greedy'
                };
            }

            return null;
        } catch (error) {
            throw new Error(`Failed to process greedy auto bidding: ${error.message}`);
        }
    }

    // Place an automatic bid
    async placeAutomaticBid(auctionId, bidderId, amount, bidType = 'automatic') {
        try {
            const insertBidQuery = `
                INSERT INTO bids (auction_id, bidder_id, amount, bid_type)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `;
            
            const bidResult = await this.db.query(insertBidQuery, [
                auctionId, bidderId, amount, bidType
            ]);

            // Update auction current price and bid count
            const updateAuctionQuery = `
                UPDATE auctions 
                SET current_price = $1, total_bids = total_bids + 1, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `;
            
            await this.db.query(updateAuctionQuery, [amount, auctionId]);

            // Update previous winning bid
            await this.db.query(
                'UPDATE bids SET is_winning = false WHERE auction_id = $1 AND id != $2',
                [auctionId, bidResult.rows[0].id]
            );

            // Set current bid as winning
            await this.db.query(
                'UPDATE bids SET is_winning = true WHERE id = $1',
                [bidResult.rows[0].id]
            );

            return bidResult.rows[0];
        } catch (error) {
            throw new Error(`Failed to place automatic bid: ${error.message}`);
        }
    }

    // Update proxy bid current amount
    async updateProxyBidCurrentAmount(proxyBidId, currentAmount) {
        try {
            const updateQuery = `
                UPDATE proxy_bids 
                SET current_amount = $1, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `;
            
            await this.db.query(updateQuery, [currentAmount, proxyBidId]);
        } catch (error) {
            throw new Error(`Failed to update proxy bid: ${error.message}`);
        }
    }

    // Get auction data for algorithms
    async getAuctionData(auctionId) {
        try {
            const auctionQuery = `
                SELECT 
                    a.*,
                    EXTRACT(EPOCH FROM (a.end_time - NOW())) / 60 as time_remaining_minutes
                FROM auctions a 
                WHERE a.id = $1
            `;
            
            const auctionResult = await this.db.query(auctionQuery, [auctionId]);
            const auction = auctionResult.rows[0];

            // Get bid history
            const bidHistoryQuery = `
                SELECT * FROM bids 
                WHERE auction_id = $1 
                ORDER BY created_at DESC 
                LIMIT 50
            `;
            
            const bidHistoryResult = await this.db.query(bidHistoryQuery, [auctionId]);

            return {
                ...auction,
                timeRemaining: Math.max(0, auction.time_remaining_minutes),
                bidHistory: bidHistoryResult.rows
            };
        } catch (error) {
            throw new Error(`Failed to get auction data: ${error.message}`);
        }
    }

    // Deactivate proxy bid
    async deactivateProxyBid(auctionId, bidderId) {
        try {
            const updateQuery = `
                UPDATE proxy_bids 
                SET is_active = false, updated_at = CURRENT_TIMESTAMP
                WHERE auction_id = $1 AND bidder_id = $2
            `;
            
            await this.db.query(updateQuery, [auctionId, bidderId]);
        } catch (error) {
            throw new Error(`Failed to deactivate proxy bid: ${error.message}`);
        }
    }

    // Get user's active proxy bids
    async getUserProxyBids(bidderId) {
        try {
            const query = `
                SELECT 
                    pb.*,
                    a.title as auction_title,
                    a.current_price,
                    a.status as auction_status,
                    a.end_time,
                    CASE 
                        WHEN pb.current_amount = a.current_price THEN true
                        ELSE false
                    END as is_winning
                FROM proxy_bids pb
                JOIN auctions a ON pb.auction_id = a.id
                WHERE pb.bidder_id = $1 AND pb.is_active = true
                ORDER BY pb.created_at DESC
            `;
            
            const result = await this.db.query(query, [bidderId]);
            return result.rows;
        } catch (error) {
            throw new Error(`Failed to get user proxy bids: ${error.message}`);
        }
    }

    // Check and process expired auctions for proxy bids
    async processExpiredAuctions() {
        try {
            // Find auctions that just ended
            const expiredAuctionsQuery = `
                SELECT id FROM auctions 
                WHERE status = 'live' AND end_time <= NOW()
            `;
            
            const expiredAuctions = await this.db.query(expiredAuctionsQuery);

            for (const auction of expiredAuctions.rows) {
                await this.finalizeAuctionProxyBids(auction.id);
            }
        } catch (error) {
            console.error('Error processing expired auctions:', error);
        }
    }

    // Finalize proxy bids when auction ends
    async finalizeAuctionProxyBids(auctionId) {
        try {
            // Deactivate all proxy bids for this auction
            await this.db.query(
                'UPDATE proxy_bids SET is_active = false WHERE auction_id = $1',
                [auctionId]
            );

            // Update auction status
            await this.db.query(
                'UPDATE auctions SET status = $1 WHERE id = $2',
                ['closed', auctionId]
            );

            // Find winner and update auction
            const winnerQuery = `
                SELECT bidder_id, amount FROM bids 
                WHERE auction_id = $1 AND is_winning = true
                ORDER BY created_at DESC LIMIT 1
            `;
            
            const winnerResult = await this.db.query(winnerQuery, [auctionId]);
            
            if (winnerResult.rows.length > 0) {
                const winner = winnerResult.rows[0];
                await this.db.query(
                    'UPDATE auctions SET winner_id = $1 WHERE id = $2',
                    [winner.bidder_id, auctionId]
                );
            }
        } catch (error) {
            throw new Error(`Failed to finalize auction proxy bids: ${error.message}`);
        }
    }

    // Calculate proxy bid recommendation
    calculateProxyBidRecommendation(currentPrice, auctionData) {
        const increment = this.dynamicPricing.calculateBidIncrement(auctionData);
        const predictedFinalPrice = this.dynamicPricing.predictFinalPrice(auctionData);
        
        // Recommend a proxy bid that's competitive but not excessive
        const recommendedProxy = Math.max(
            currentPrice + (increment * 3), // At least 3 increments above current
            predictedFinalPrice * 1.1       // 10% above predicted final price
        );

        return {
            recommended: Math.round(recommendedProxy),
            minimum: currentPrice + increment,
            predicted: predictedFinalPrice,
            explanation: `Based on current bidding activity and time remaining, we recommend setting your maximum bid at ₹${recommendedProxy.toFixed(2)} to stay competitive.`
        };
    }
}

module.exports = ProxyBiddingAlgorithm;