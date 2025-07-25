import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Context Providers
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';

// Common Components
import ProtectedRoute from './components/common/ProtectedRoute';
import PublicRoute from './components/common/PublicRoute';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AuctionDetailPage from './pages/AuctionDetailPage';

// Bidder Pages
import BidderDashboard from './pages/bidder/BidderDashboard';
import BiddingHistory from './pages/bidder/BiddingHistory';
import ProfilePage from './pages/bidder/ProfilePage';

// Seller Pages
import SellerDashboard from './pages/seller/SellerDashboard';
import CreateAuction from './pages/seller/CreateAuction';
import MyAuctions from './pages/seller/MyAuctions';
import SellerProfile from './pages/seller/SellerProfile';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import SystemAnalytics from './pages/admin/SystemAnalytics';

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <SocketProvider>
          <Router>
            <div className="min-h-screen bg-secondary-50">
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<HomePage />} />
                <Route path="/auction/:id" element={<AuctionDetailPage />} />
                
                {/* Auth Routes (only accessible when not logged in) */}
                <Route 
                  path="/login" 
                  element={
                    <PublicRoute>
                      <LoginPage />
                    </PublicRoute>
                  } 
                />
                <Route 
                  path="/register" 
                  element={
                    <PublicRoute>
                      <RegisterPage />
                    </PublicRoute>
                  } 
                />

                {/* Bidder Routes */}
                <Route 
                  path="/bidder/dashboard" 
                  element={
                    <ProtectedRoute role="bidder">
                      <BidderDashboard />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/bidder/history" 
                  element={
                    <ProtectedRoute role="bidder">
                      <BiddingHistory />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/bidder/profile" 
                  element={
                    <ProtectedRoute role="bidder">
                      <ProfilePage />
                    </ProtectedRoute>
                  } 
                />

                {/* Seller Routes */}
                <Route 
                  path="/seller/dashboard" 
                  element={
                    <ProtectedRoute role="seller">
                      <SellerDashboard />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/seller/create-auction" 
                  element={
                    <ProtectedRoute role="seller">
                      <CreateAuction />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/seller/my-auctions" 
                  element={
                    <ProtectedRoute role="seller">
                      <MyAuctions />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/seller/profile" 
                  element={
                    <ProtectedRoute role="seller">
                      <SellerProfile />
                    </ProtectedRoute>
                  } 
                />

                {/* Admin Routes */}
                <Route 
                  path="/admin/dashboard" 
                  element={
                    <ProtectedRoute role="admin">
                      <AdminDashboard />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/admin/users" 
                  element={
                    <ProtectedRoute role="admin">
                      <UserManagement />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/admin/analytics" 
                  element={
                    <ProtectedRoute role="admin">
                      <SystemAnalytics />
                    </ProtectedRoute>
                  } 
                />

                {/* 404 Page */}
                <Route 
                  path="*" 
                  element={
                    <div className="flex items-center justify-center min-h-screen">
                      <div className="text-center">
                        <h1 className="text-4xl font-bold text-secondary-900 mb-4">404</h1>
                        <p className="text-secondary-600 mb-8">Page not found</p>
                        <a href="/" className="btn-primary">
                          Go Home
                        </a>
                      </div>
                    </div>
                  } 
                />
              </Routes>
            </div>
          </Router>

          {/* Global Toast Notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                style: {
                  background: '#10b981',
                },
              },
              error: {
                style: {
                  background: '#ef4444',
                },
              },
            }}
          />
        </SocketProvider>
      </AuthProvider>
    </div>
  );
}

export default App;
