import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { StyleProvider } from './context/StyleContext';
import { ToastProvider } from './context/ToastContext';

import AdminLayout from './layouts/AdminLayout';
import PublicLayout from './layouts/PublicLayout';

import {
  AdminDashboard, AdminWorks, AdminUsers, AdminStyles, AdminMessages, AdminSettings, AdminOperationLogs, AdminMediaLibrary, AdminReports, AdminSeo, AdminSensitiveWords,
  Home, Works, Login, Register, Profile, WorkDetail, MessageList, MessageDetail, BrowseHistory
} from './pages';

const App = () => {
  return (
    <AuthProvider>
      <StyleProvider>
        <BrowserRouter>
          <ToastProvider>
            <Routes>
              {/* Public Routes with Header/Footer Wrap */}
              <Route element={<PublicLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/works" element={<Works />} />
                <Route path="/works/:id" element={<WorkDetail />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/browse-history" element={<BrowseHistory />} />
                <Route path="/messages" element={<MessageList />} />
                <Route path="/messages/:id" element={<MessageDetail />} />
              </Route>

              {/* Admin Routes with Sidebar Wrap */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="works" element={<AdminWorks />} />
                <Route path="media" element={<AdminMediaLibrary />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="styles" element={<AdminStyles />} />
                <Route path="messages" element={<AdminMessages />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="seo" element={<AdminSeo />} />
                <Route path="sensitive-words" element={<AdminSensitiveWords />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="logs" element={<AdminOperationLogs />} />
              </Route>

              {/* 404 block */}
              <Route path="*" element={<div className="p-8 text-center text-red-500">Page not found</div>} />
            </Routes>
          </ToastProvider>
        </BrowserRouter>
      </StyleProvider>
    </AuthProvider>
  );
};

export default App;
