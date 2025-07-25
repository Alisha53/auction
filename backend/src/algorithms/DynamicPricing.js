class DynamicPricingAlgorithm {
    constructor() {
        this.defaultIncrement = 5.00;
        this.maxIncrement = 500.00;
        this.minIncrement = 1.00;
    }

    // Calculate dynamic bid increment based on current auction state
    calculateBidIncrement(auctionData) {
        const {
            startingPrice,
            currentPrice,
            totalBids,
            timeRemaining, // in minutes
            bidHistory = []
        } = auctionData;

        let dynamicIncrement = this.defaultIncrement;

        // Factor 1: Price jump magnitude
        const priceJumpFactor = this.calculatePriceJumpFactor(startingPrice, currentPrice);
        
        // Factor 2: Bidding velocity (bids per minute)
        const velocityFactor = this.calculateVelocityFactor(totalBids, bidHistory);
        
        // Factor 3: Time pressure (urgency based on time remaining)
        const timePressureFactor = this.calculateTimePressureFactor(timeRemaining);
        
        // Factor 4: Competition intensity
        const competitionFactor = this.calculateCompetitionFactor(bidHistory);

        // Combine all factors to calculate dynamic increment
        dynamicIncrement = this.defaultIncrement * 
            priceJumpFactor * 
            velocityFactor * 
            timePressureFactor * 
            competitionFactor;

        // Apply boundaries and rounding
        dynamicIncrement = Math.max(this.minIncrement, 
            Math.min(this.maxIncrement, dynamicIncrement));
        
        // Round to nearest meaningful increment
        return this.roundToMeaningfulIncrement(dynamicIncrement, currentPrice);
    }

    // Calculate factor based on price jump from starting price
    calculatePriceJumpFactor(startingPrice, currentPrice) {
        if (currentPrice <= startingPrice) return 1.0;
        
        const priceJumpRatio = currentPrice / startingPrice;
        
        if (priceJumpRatio <= 1.5) return 1.0;      // 0-50% jump: normal increment
        if (priceJumpRatio <= 2.0) return 1.5;      // 50-100% jump: 1.5x increment
        if (priceJumpRatio <= 3.0) return 2.0;      // 100-200% jump: 2x increment
        if (priceJumpRatio <= 5.0) return 3.0;      // 200-400% jump: 3x increment
        return 4.0;                                  // >400% jump: 4x increment
    }

    // Calculate factor based on bidding velocity
    calculateVelocityFactor(totalBids, bidHistory) {
        if (bidHistory.length < 2) return 1.0;
        
        // Calculate bids in last 10 minutes
        const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
        const recentBids = bidHistory.filter(bid => 
            new Date(bid.created_at).getTime() > tenMinutesAgo
        );
        
        const bidsPerMinute = recentBids.length / 10;
        
        if (bidsPerMinute < 0.5) return 1.0;        // Low activity
        if (bidsPerMinute < 1.0) return 1.2;        // Moderate activity
        if (bidsPerMinute < 2.0) return 1.5;        // High activity
        if (bidsPerMinute < 5.0) return 2.0;        // Very high activity
        return 3.0;                                 // Extreme activity
    }

    // Calculate factor based on time remaining
    calculateTimePressureFactor(timeRemaining) {
        if (timeRemaining > 60) return 1.0;         // More than 1 hour: normal
        if (timeRemaining > 30) return 1.1;         // 30-60 minutes: slight increase
        if (timeRemaining > 15) return 1.3;         // 15-30 minutes: moderate increase
        if (timeRemaining > 5) return 1.5;          // 5-15 minutes: high increase
        if (timeRemaining > 1) return 2.0;          // 1-5 minutes: very high increase
        return 3.0;                                 // Last minute: extreme increase
    }

    // Calculate factor based on competition (unique bidders)
    calculateCompetitionFactor(bidHistory) {
        if (bidHistory.length === 0) return 1.0;
        
        // Count unique bidders in recent history
        const recentBids = bidHistory.slice(-20); // Last 20 bids
        const uniqueBidders = new Set(recentBids.map(bid => bid.bidder_id));
        const competitorCount = uniqueBidders.size;
        
        if (competitorCount <= 2) return 1.0;       // Low competition
        if (competitorCount <= 4) return 1.2;       // Moderate competition
        if (competitorCount <= 6) return 1.4;       // High competition
        if (competitorCount <= 10) return 1.6;      // Very high competition
        return 2.0;                                 // Extreme competition
    }

    // Round increment to meaningful values based on current price
    roundToMeaningfulIncrement(increment, currentPrice) {
        if (currentPrice < 100) {
            // For prices under $100, round to nearest $1
            return Math.round(increment);
        } else if (currentPrice < 500) {
            // For prices $100-$500, round to nearest $5
            return Math.round(increment / 5) * 5;
        } else if (currentPrice < 1000) {
            // For prices $500-$1000, round to nearest $10
            return Math.round(increment / 10) * 10;
        } else if (currentPrice < 5000) {
            // For prices $1000-$5000, round to nearest $25
            return Math.round(increment / 25) * 25;
        } else {
            // For prices over $5000, round to nearest $50
            return Math.round(increment / 50) * 50;
        }
    }

    // Calculate suggested next bid amount
    calculateNextBidAmount(currentPrice, auctionData) {
        const increment = this.calculateBidIncrement(auctionData);
        return currentPrice + increment;
    }

    // Calculate increment for proxy bidding (more conservative)
    calculateProxyIncrement(auctionData) {
        const normalIncrement = this.calculateBidIncrement(auctionData);
        // Proxy bids use smaller increments to be more competitive
        return Math.max(this.minIncrement, normalIncrement * 0.7);
    }

    // Get increment explanation for UI
    getIncrementExplanation(auctionData) {
        const {
            startingPrice,
            currentPrice,
            totalBids,
            timeRemaining,
            bidHistory = []
        } = auctionData;

        const factors = [];
        
        const priceJumpRatio = currentPrice / startingPrice;
        if (priceJumpRatio > 2.0) {
            factors.push(`High price activity (${Math.round((priceJumpRatio - 1) * 100)}% above starting price)`);
        }
        
        if (timeRemaining <= 15) {
            factors.push(`Auction ending soon (${timeRemaining} minutes remaining)`);
        }
        
        const recentBids = bidHistory.slice(-10);
        const uniqueBidders = new Set(recentBids.map(bid => bid.bidder_id));
        if (uniqueBidders.size >= 4) {
            factors.push(`High competition (${uniqueBidders.size} active bidders)`);
        }
        
        if (factors.length === 0) {
            return "Standard increment";
        }
        
        return `Increased increment due to: ${factors.join(', ')}`;
    }

    // Predict final price based on current trends
    predictFinalPrice(auctionData) {
        const {
            currentPrice,
            timeRemaining,
            bidHistory = []
        } = auctionData;

        if (bidHistory.length < 3) {
            return currentPrice * 1.2; // Conservative estimate
        }

        // Calculate bidding velocity
        const recentBids = bidHistory.slice(-10);
        const avgTimeBetweenBids = this.calculateAverageTimeBetweenBids(recentBids);
        
        if (avgTimeBetweenBids === 0) return currentPrice;
        
        // Estimate remaining bids
        const estimatedRemainingBids = Math.floor(timeRemaining * 60 / avgTimeBetweenBids);
        
        // Calculate average increment from recent bids
        const avgIncrement = this.calculateAverageIncrement(recentBids);
        
        // Predict final price with decay factor (activity typically slows down)
        const decayFactor = 0.8;
        const predictedIncrease = estimatedRemainingBids * avgIncrement * decayFactor;
        
        return Math.round(currentPrice + predictedIncrease);
    }

    // Helper method to calculate average time between bids
    calculateAverageTimeBetweenBids(bids) {
        if (bids.length < 2) return 0;
        
        const times = bids.map(bid => new Date(bid.created_at).getTime());
        const intervals = [];
        
        for (let i = 1; i < times.length; i++) {
            intervals.push(times[i] - times[i-1]);
        }
        
        const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
        return avgInterval / 1000; // Convert to seconds
    }

    // Helper method to calculate average increment
    calculateAverageIncrement(bids) {
        if (bids.length < 2) return this.defaultIncrement;
        
        const increments = [];
        for (let i = 1; i < bids.length; i++) {
            increments.push(bids[i].amount - bids[i-1].amount);
        }
        
        return increments.reduce((sum, inc) => sum + inc, 0) / increments.length;
    }
}

module.exports = DynamicPricingAlgorithm;