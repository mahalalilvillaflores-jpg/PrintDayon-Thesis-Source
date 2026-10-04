import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProtectedRoute, RoleRoute, GuestRoute } from './routes/ProtectedRoute';
import ToastContainer from './components/ui/Toast';

import CustomerLayout from './layouts/CustomerLayout';
import OwnerLayout from './layouts/OwnerLayout';
import AdminLayout from './layouts/AdminLayout';

import HomePage from './pages/HomePage';

import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import PartnerRegisterPage from './pages/auth/PartnerRegisterPage';

import CustomerDashboard from './pages/customer/DashboardPage';
import FindShopPage from './pages/customer/FindShopPage';
import SubmitRequestPage from './pages/customer/SubmitRequestPage';
import MyRequestsPage from './pages/customer/MyRequestsPage';
import TrackRequestPage from './pages/customer/TrackRequestPage';
import ShopDetailPage from './pages/customer/ShopDetailPage';
import NotificationsPage from './pages/customer/NotificationsPage';
import ProfilePage from './pages/customer/ProfilePage';

import OwnerDashboard from './pages/owner/DashboardPage';
import OwnerRequestsPage from './pages/owner/RequestsPage';
import OwnerQueuePage from './pages/owner/QueuePage';
import OwnerServicesPage from './pages/owner/ServicesPage';
import OwnerSchedulePage from './pages/owner/SchedulePage';
import OwnerOperationalStatusPage from './pages/owner/OperationalStatusPage';
import ShopProfilePage from './pages/owner/ShopProfilePage';
import OwnerVerificationPage from './pages/owner/VerificationPage';
import OwnerSalesPage from './pages/owner/SalesPage';
import ShopManagementPage from './pages/owner/ShopManagementPage';
import OwnerNotificationsPage from './pages/owner/NotificationsPage';
import OwnerSettingsPage from './pages/owner/SettingsPage';

import AdminDashboard from './pages/admin/DashboardPage';
import AdminUsersPage from './pages/admin/UsersPage';
import AdminShopsPage from './pages/admin/ShopsPage';
import AdminRequestsPage from './pages/admin/RequestsPage';
import VerificationPage from './pages/admin/VerificationPage';
import LogsPage from './pages/admin/LogsPage';
import ReportsPage from './pages/admin/ReportsPage';
import AdminSettingsPage from './pages/admin/AdminSettingsPage';

const Unauthorized = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '1rem', background: '#f3f5fb' }}>
    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9b0033' }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>
    </div>
    <h1 style={{ fontWeight: 700, color: '#0a0a0a' }}>Access Denied</h1>
    <p style={{ color: '#64748b' }}>You don't have permission to view this page.</p>
    <a href="/" style={{ color: '#0066FF', fontWeight: 600, textDecoration: 'none' }}>Go Home</a>
  </div>
);

const ShopAliasRedirect = () => {
  const { shopId } = useParams();
  return <Navigate to={`/shop/${shopId}`} replace />;
};

const NotificationsRedirector = () => {
  const { user } = useAuth();
  if (user?.role === 'shop_owner') {
    return <Navigate to="/owner/notifications" replace />;
  }
  if (user?.role === 'admin') {
    return <Navigate to="/admin/logs" replace />;
  }
  return <CustomerLayout><NotificationsPage /></CustomerLayout>;
};

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
            <NotificationProvider>
            <ToastContainer />
            <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                borderRadius: '1rem',
                background: '#001B3C',
                color: '#fff',
                fontSize: '0.875rem',
                fontFamily: 'Inter, sans-serif',
              },
              success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
              error: { iconTheme: { primary: '#9b0033', secondary: '#fff' } },
            }}
          />

          <Routes>
            <Route path="/" element={<HomePage />} />

            <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
            <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
            <Route path="/register/partner" element={<GuestRoute><PartnerRegisterPage /></GuestRoute>} />
            <Route path="/partner-register" element={<Navigate to="/register/partner" replace />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            <Route path="/dashboard" element={
              <RoleRoute roles={['customer']}>
                <CustomerLayout><CustomerDashboard /></CustomerLayout>
              </RoleRoute>
            } />
            <Route path="/find-shop" element={
              <RoleRoute roles={['customer']}>
                <CustomerLayout><FindShopPage /></CustomerLayout>
              </RoleRoute>
            } />
            <Route path="/find-shops" element={<Navigate to="/find-shop" replace />} />
            <Route path="/submit-request" element={
              <RoleRoute roles={['customer']}>
                <CustomerLayout><SubmitRequestPage /></CustomerLayout>
              </RoleRoute>
            } />
            <Route path="/my-requests" element={
              <RoleRoute roles={['customer']}>
                <CustomerLayout><MyRequestsPage /></CustomerLayout>
              </RoleRoute>
            } />
            <Route path="/my-orders" element={<Navigate to="/my-requests" replace />} />
            <Route path="/my-requests/:id" element={
              <RoleRoute roles={['customer']}>
                <CustomerLayout><TrackRequestPage /></CustomerLayout>
              </RoleRoute>
            } />
            <Route path="/track/:id" element={
              <RoleRoute roles={['customer']}>
                <CustomerLayout><TrackRequestPage /></CustomerLayout>
              </RoleRoute>
            } />
            <Route path="/history" element={<Navigate to="/my-requests" replace />} />
            <Route path="/profile" element={
              <RoleRoute roles={['customer']}>
                <CustomerLayout><ProfilePage /></CustomerLayout>
              </RoleRoute>
            } />
            <Route path="/shop/:shopId" element={
              <RoleRoute roles={['customer']}>
                <CustomerLayout><ShopDetailPage /></CustomerLayout>
              </RoleRoute>
            } />
            <Route path="/shops/:shopId" element={<ShopAliasRedirect />} />
            <Route path="/notifications" element={
              <ProtectedRoute>
                <NotificationsRedirector />
              </ProtectedRoute>
            } />
            <Route path="/notifications/:id" element={
              <ProtectedRoute>
                <NotificationsRedirector />
              </ProtectedRoute>
            } />

            <Route path="/owner/dashboard" element={
              <RoleRoute roles={['shop_owner']}>
                <OwnerLayout><OwnerDashboard /></OwnerLayout>
              </RoleRoute>
            } />
            <Route path="/owner/requests" element={
              <RoleRoute roles={['shop_owner']}>
                <OwnerLayout><OwnerRequestsPage /></OwnerLayout>
              </RoleRoute>
            } />
            <Route path="/owner/queue" element={
              <RoleRoute roles={['shop_owner']}>
                <OwnerLayout><OwnerQueuePage /></OwnerLayout>
              </RoleRoute>
            } />
            <Route path="/owner/services" element={
              <RoleRoute roles={['shop_owner']}>
                <OwnerLayout><OwnerServicesPage /></OwnerLayout>
              </RoleRoute>
            } />
            <Route path="/owner/schedule" element={
              <RoleRoute roles={['shop_owner']}>
                <OwnerLayout><OwnerSchedulePage /></OwnerLayout>
              </RoleRoute>
            } />
            <Route path="/owner/operational-status" element={
              <RoleRoute roles={['shop_owner']}>
                <OwnerLayout><OwnerOperationalStatusPage /></OwnerLayout>
              </RoleRoute>
            } />
            <Route path="/owner/shop" element={
              <RoleRoute roles={['shop_owner']}>
                <OwnerLayout><ShopProfilePage /></OwnerLayout>
              </RoleRoute>
            } />
            <Route path="/owner/verification" element={
              <RoleRoute roles={['shop_owner']}>
                <OwnerLayout><OwnerVerificationPage /></OwnerLayout>
              </RoleRoute>
            } />
            <Route path="/owner/sales" element={
              <RoleRoute roles={['shop_owner']}>
                <OwnerLayout><OwnerSalesPage /></OwnerLayout>
              </RoleRoute>
            } />
            <Route path="/owner/management" element={
              <RoleRoute roles={['shop_owner']}>
                <OwnerLayout><ShopManagementPage /></OwnerLayout>
              </RoleRoute>
            } />
            <Route path="/owner/notifications" element={
              <RoleRoute roles={['shop_owner']}>
                <OwnerLayout><OwnerNotificationsPage /></OwnerLayout>
              </RoleRoute>
            } />
            <Route path="/owner/settings" element={
              <RoleRoute roles={['shop_owner']}>
                <OwnerLayout><OwnerSettingsPage /></OwnerLayout>
              </RoleRoute>
            } />
            {/* Legacy redirects — keep old URLs working via tab query param */}
            <Route path="/owner/orders" element={<Navigate to="/owner/requests" replace />} />
            <Route path="/owner/shop" element={<Navigate to="/owner/management?tab=profile" replace />} />
            <Route path="/owner/schedule" element={<Navigate to="/owner/management?tab=schedule" replace />} />
            <Route path="/owner/operational-status" element={<Navigate to="/owner/management?tab=schedule" replace />} />
            <Route path="/owner/verification" element={<Navigate to="/owner/management?tab=verification" replace />} />

            <Route path="/admin/dashboard" element={
              <RoleRoute roles={['admin']}>
                <AdminLayout><AdminDashboard /></AdminLayout>
              </RoleRoute>
            } />
            <Route path="/admin/users" element={
              <RoleRoute roles={['admin']}>
                <AdminLayout><AdminUsersPage /></AdminLayout>
              </RoleRoute>
            } />
            <Route path="/admin/shops" element={
              <RoleRoute roles={['admin']}>
                <AdminLayout><AdminShopsPage /></AdminLayout>
              </RoleRoute>
            } />
            <Route path="/admin/requests" element={<Navigate to="/admin/orders" replace />} />
            <Route path="/admin/orders" element={
              <RoleRoute roles={['admin']}>
                <AdminLayout><AdminRequestsPage /></AdminLayout>
              </RoleRoute>
            } />
            <Route path="/admin/verification" element={
              <RoleRoute roles={['admin']}>
                <AdminLayout><VerificationPage /></AdminLayout>
              </RoleRoute>
            } />
            <Route path="/admin/reports" element={
              <RoleRoute roles={['admin']}>
                <AdminLayout><ReportsPage /></AdminLayout>
              </RoleRoute>
            } />
            <Route path="/admin/logs" element={
              <RoleRoute roles={['admin']}>
                <AdminLayout><LogsPage /></AdminLayout>
              </RoleRoute>
            } />
            <Route path="/admin/settings" element={
              <RoleRoute roles={['admin']}>
                <AdminLayout><AdminSettingsPage /></AdminLayout>
              </RoleRoute>
            } />

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          </NotificationProvider>
        </SocketProvider>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
