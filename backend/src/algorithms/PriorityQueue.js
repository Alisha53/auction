class BidPriorityQueue {
    constructor() {
        this.heap = [];
    }

    // Get parent index
    getParentIndex(index) {
        return Math.floor((index - 1) / 2);
    }

    // Get left child index
    getLeftChildIndex(index) {
        return 2 * index + 1;
    }

    // Get right child index
    getRightChildIndex(index) {
        return 2 * index + 2;
    }

    // Check if has parent
    hasParent(index) {
        return this.getParentIndex(index) >= 0;
    }

    // Check if has left child
    hasLeftChild(index) {
        return this.getLeftChildIndex(index) < this.heap.length;
    }

    // Check if has right child
    hasRightChild(index) {
        return this.getRightChildIndex(index) < this.heap.length;
    }

    // Get parent value
    parent(index) {
        return this.heap[this.getParentIndex(index)];
    }

    // Get left child value
    leftChild(index) {
        return this.heap[this.getLeftChildIndex(index)];
    }

    // Get right child value
    rightChild(index) {
        return this.heap[this.getRightChildIndex(index)];
    }

    // Swap elements
    swap(indexOne, indexTwo) {
        const temp = this.heap[indexOne];
        this.heap[indexOne] = this.heap[indexTwo];
        this.heap[indexTwo] = temp;
    }

    // Peek at the highest priority bid (highest amount)
    peek() {
        if (this.heap.length === 0) {
            return null;
        }
        return this.heap[0];
    }

    // Remove and return the highest priority bid
    poll() {
        if (this.heap.length === 0) {
            return null;
        }
        
        const item = this.heap[0];
        this.heap[0] = this.heap[this.heap.length - 1];
        this.heap.pop();
        this.heapifyDown();
        return item;
    }

    // Add a new bid to the priority queue
    add(bid) {
        this.heap.push(bid);
        this.heapifyUp();
    }

    // Heapify up (for max heap - highest bid at top)
    heapifyUp() {
        let index = this.heap.length - 1;
        while (this.hasParent(index) && this.parent(index).amount < this.heap[index].amount) {
            this.swap(this.getParentIndex(index), index);
            index = this.getParentIndex(index);
        }
    }

    // Heapify down
    heapifyDown() {
        let index = 0;
        while (this.hasLeftChild(index)) {
            let largerChildIndex = this.getLeftChildIndex(index);
            
            if (this.hasRightChild(index) && 
                this.rightChild(index).amount > this.leftChild(index).amount) {
                largerChildIndex = this.getRightChildIndex(index);
            }

            if (this.heap[index].amount > this.heap[largerChildIndex].amount) {
                break;
            } else {
                this.swap(index, largerChildIndex);
            }
            
            index = largerChildIndex;
        }
    }

    // Get all bids for a specific auction
    getBidsForAuction(auctionId) {
        return this.heap.filter(bid => bid.auctionId === auctionId);
    }

    // Get highest bid for a specific auction
    getHighestBidForAuction(auctionId) {
        const auctionBids = this.getBidsForAuction(auctionId);
        if (auctionBids.length === 0) return null;
        
        return auctionBids.reduce((highest, current) => 
            current.amount > highest.amount ? current : highest
        );
    }

    // Remove all bids for a specific auction
    removeBidsForAuction(auctionId) {
        this.heap = this.heap.filter(bid => bid.auctionId !== auctionId);
        this.rebuildHeap();
    }

    // Rebuild heap after removing elements
    rebuildHeap() {
        const elements = [...this.heap];
        this.heap = [];
        elements.forEach(element => this.add(element));
    }

    // Check if queue is empty
    isEmpty() {
        return this.heap.length === 0;
    }

    // Get size of queue
    size() {
        return this.heap.length;
    }

    // Clear all bids
    clear() {
        this.heap = [];
    }

    // Get all bids sorted by amount (highest first)
    getAllBidsSorted() {
        return [...this.heap].sort((a, b) => b.amount - a.amount);
    }

    // Process bid with timestamp priority for same amounts
    addBidWithTimePriority(bid) {
        bid.timestamp = bid.timestamp || Date.now();
        
        // Find if there's an existing bid with same amount
        const existingIndex = this.heap.findIndex(
            existingBid => existingBid.amount === bid.amount && 
                          existingBid.auctionId === bid.auctionId
        );

        if (existingIndex !== -1) {
            // If new bid has earlier timestamp (submitted first), it gets priority
            if (bid.timestamp < this.heap[existingIndex].timestamp) {
                this.heap[existingIndex] = bid;
                this.heapifyUp();
                this.heapifyDown();
            }
        } else {
            this.add(bid);
        }
    }
}

module.exports = BidPriorityQueue;