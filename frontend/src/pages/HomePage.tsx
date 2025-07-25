import React from 'react';

const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-secondary-50">
      {/* Navigation */}
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Left Navigation */}
            <div className="flex items-center space-x-8">
              <div className="text-xl font-bold text-gradient">
                AuctionHub
              </div>
              <div className="hidden md:flex space-x-4">
                <a href="/" className="text-secondary-700 hover:text-primary-600">Home</a>
                <a href="#live" className="text-secondary-700 hover:text-primary-600">Live Auctions</a>
                <a href="#closed" className="text-secondary-700 hover:text-primary-600">Closed Auctions</a>
                <a href="#upcoming" className="text-secondary-700 hover:text-primary-600">Upcoming Auctions</a>
              </div>
            </div>

            {/* Search Bar */}
            <div className="hidden md:flex flex-1 max-w-lg mx-8">
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder="Search auctions..."
                  className="input pr-10"
                />
                <button className="absolute right-2 top-1/2 transform -translate-y-1/2 text-secondary-400">
                  🔍
                </button>
              </div>
            </div>

            {/* Auth Buttons */}
            <div className="flex items-center space-x-4">
              <button className="btn-outline">
                Login
              </button>
              <button className="btn-primary">
                Sign Up
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="bg-gradient-primary text-white py-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Welcome to AuctionHub
          </h1>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Discover amazing deals in our real-time online auctions. 
            Bid, win, and enjoy a seamless auction experience.
          </p>
          <div className="flex justify-center space-x-4">
            <button className="btn bg-white text-primary-600 hover:bg-secondary-100">
              Browse Auctions
            </button>
            <button className="btn btn-outline border-white text-white hover:bg-white hover:text-primary-600">
              How It Works
            </button>
          </div>
        </div>
      </div>

      {/* Featured Auctions */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-secondary-900 mb-8 text-center">
          Featured Auctions
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Placeholder auction cards */}
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div key={item} className="auction-card">
              <div className="aspect-w-16 aspect-h-12 bg-secondary-200 rounded-t-lg">
                <div className="flex items-center justify-center text-secondary-500">
                  No Image
                </div>
              </div>
              <div className="card-body">
                <h3 className="font-semibold text-lg mb-2">Sample Auction Item {item}</h3>
                <p className="text-secondary-600 text-sm mb-4">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                </p>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <p className="text-sm text-secondary-500">Current Bid</p>
                    <p className="bid-amount">₹{(1000 * item).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-secondary-500">Time Left</p>
                    <p className="countdown-timer">2h 45m</p>
                  </div>
                </div>
                <button className="btn-primary w-full">
                  Place Bid
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-secondary-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-4">AuctionHub</h3>
            <p className="text-secondary-300 mb-6">
              Your trusted platform for online auctions
            </p>
            <div className="flex justify-center space-x-6">
              <a href="/about" className="text-secondary-300 hover:text-white">About</a>
              <a href="/contact" className="text-secondary-300 hover:text-white">Contact</a>
              <a href="/terms" className="text-secondary-300 hover:text-white">Terms</a>
              <a href="/privacy" className="text-secondary-300 hover:text-white">Privacy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;