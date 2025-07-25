// User types
export interface User {
  id: number;
  username: string;
  email: string;
  role: 'bidder' | 'seller' | 'admin';
  createdAt: string;
  profileImage?: string;
  phone?: string;
  address?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Auction types
export interface Auction {
  id: number;
  product_id: string;
  seller_id: number;
  seller_username?: string;
  category_id: number;
  subcategory_id?: number;
  category_name?: string;
  subcategory_name?: string;
  title: string;
  description: string;
  image_url?: string;
  starting_price: number;
  reserve_price?: number;
  current_price: number;
  bid_increment: number;
  start_time: string;
  end_time: string;
  status: 'upcoming' | 'live' | 'closed' | 'cancelled';
  winner_id?: number;
  winner_username?: string;
  total_bids: number;
  created_at: string;
  updated_at: string;
  time_remaining_seconds?: number;
  is_ended?: boolean;
  next_bid_increment?: number;
  suggested_bid?: number;
}

// Bid types
export interface Bid {
  id: number;
  auction_id: number;
  bidder_id: number;
  bidder_username?: string;
  amount: number;
  bid_type: 'manual' | 'proxy' | 'automatic';
  created_at: string;
  is_winning: boolean;
}

export interface ProxyBid {
  id: number;
  auction_id: number;
  auction_title?: string;
  bidder_id: number;
  max_amount: number;
  current_amount: number;
  is_active: boolean;
  is_winning?: boolean;
  auction_status?: string;
  end_time?: string;
  created_at: string;
  updated_at: string;
}

// Category types
export interface Category {
  id: number;
  name: string;
  description?: string;
  parent_id?: number;
  subcategories?: Category[];
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    items: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

// Form types
export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: 'bidder' | 'seller';
  phone?: string;
  address?: string;
}

export interface AuctionForm {
  product_id: string;
  title: string;
  description: string;
  category_id: number;
  subcategory_id?: number;
  starting_price: number;
  reserve_price?: number;
  start_time: string;
  end_time: string;
  image?: File;
}

// Socket types
export interface SocketEvents {
  join_auction: (data: { auctionId: number }) => void;
  leave_auction: (data: { auctionId: number }) => void;
  place_bid: (data: { auctionId: number; amount: number }) => void;
  set_proxy_bid: (data: { auctionId: number; maxAmount: number }) => void;
  get_auction_status: (data: { auctionId: number }) => void;
  get_bid_history: (data: { auctionId: number; limit?: number }) => void;
}

export interface SocketListeners {
  auction_status: (data: Auction) => void;
  bid_history: (data: Bid[]) => void;
  new_bid: (data: {
    bidId: number;
    auctionId: number;
    amount: number;
    bidderUsername: string;
    timestamp: string;
    totalBids: number;
    bidType: string;
  }) => void;
  auction_ended: (data: {
    auctionId: number;
    winner?: {
      userId: number;
      username: string;
      winningBid: number;
    };
    timestamp: string;
  }) => void;
  auction_won: (data: {
    auctionId: number;
    winningBid: number;
    message: string;
  }) => void;
  bid_error: (data: { message: string; minimumBid?: number }) => void;
  proxy_bid_set: (data: {
    proxyBidId: number;
    maxAmount: number;
    message: string;
  }) => void;
  proxy_bid_error: (data: { message: string }) => void;
  user_joined: (data: {
    userId: number;
    username: string;
    timestamp: string;
  }) => void;
  user_left: (data: {
    userId: number;
    username: string;
    timestamp: string;
  }) => void;
  error: (data: { message: string }) => void;
}

// Component props types
export interface ProtectedRouteProps {
  children: React.ReactNode;
  role?: 'bidder' | 'seller' | 'admin';
}

export interface PublicRouteProps {
  children: React.ReactNode;
}

// Filter and search types
export interface AuctionFilters {
  status?: 'all' | 'upcoming' | 'live' | 'closed';
  category?: number | 'all';
  search?: string;
  sort?: 'newest' | 'price_low' | 'price_high' | 'ending_soon' | 'most_bids';
  page?: number;
  limit?: number;
}

// Bidding history types
export interface BiddingHistoryItem {
  id: number;
  bidder_id: number;
  auction_id: number;
  auction_title: string;
  auction_image?: string;
  auction_status: string;
  bid_amount: number;
  bid_time: string;
  result: 'won' | 'lost' | 'outbid' | 'active';
}