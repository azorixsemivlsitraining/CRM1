import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ChakraProvider, Box, Center, Text } from '@chakra-ui/react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Welcome from './pages/Welcome';
import DashboardTG from './pages/DashboardTG';
import DashboardAP from './pages/DashboardAP';
import DashboardChitoor from './pages/DashboardChitoor';
import Projects from './components/Projects';
import ProjectDetails from './components/ProjectDetails';
import Reports from './components/Reports';
import Finance from './pages/Finance';
import Payments from './pages/Payments';
import ServiceTickets from './pages/ServiceTickets';
import TelanganaProjects from './pages/TelanganaProjects';
import APProjects from './pages/APProjects';
import ChitoorProjects from './pages/ChitoorProjects';
import Admin from './pages/Admin';
import StockWarehouse from './pages/StockWarehouse';
import Logistics from './pages/Logistics';
import Procurement from './pages/Procurement';
import HR from './pages/HR';
import UsersManagement from './pages/UsersManagement';
import ResetPassword from './pages/ResetPassword';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import ModuleGuard from './components/ModuleGuard';
import RegionGuard from './components/RegionGuard';
import ModulesPage from './components/ModulesPage';
import ChitoorProjectDetails from './components/ChitoorProjectDetails';
import { AuthProvider } from './context/AuthContext';

// Finance route is handled by PrivateRoute, so this is no longer needed

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Center h="100vh">
          <Box textAlign="center">
            <Text fontSize="xl" color="red.500" mb={4}>
              Something went wrong
            </Text>
            <Text color="gray.600">
              {this.state.error?.message || 'An unexpected error occurred'}
            </Text>
          </Box>
        </Center>
      );
    }

    return this.props.children;
  }
}

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ChakraProvider>
        <Router>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <Navigate to="/welcome" replace />
                  </PrivateRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <PrivateRoute>
                    <ModuleGuard moduleKey="dashboard">
                      <Layout>
                        <Dashboard />
                      </Layout>
                    </ModuleGuard>
                  </PrivateRoute>
                }
              />
              <Route
                path="/welcome"
                element={
                  <PrivateRoute>
                    <Welcome />
                  </PrivateRoute>
                }
              />
              <Route
                path="/dashboard/tg"
                element={
                  <PrivateRoute>
                    <ModuleGuard moduleKey="dashboard">
                      <Layout>
                        <RegionGuard allowed={['Telangana']}><DashboardTG /></RegionGuard>
                      </Layout>
                    </ModuleGuard>
                  </PrivateRoute>
                }
              />
              <Route
                path="/dashboard/ap"
                element={
                  <PrivateRoute>
                    <ModuleGuard moduleKey="dashboard">
                      <Layout>
                        <RegionGuard allowed={['Andhra Pradesh']}><DashboardAP /></RegionGuard>
                      </Layout>
                    </ModuleGuard>
                  </PrivateRoute>
                }
              />
              <Route
                path="/dashboard/chitoor"
                element={
                  <PrivateRoute>
                    <ModuleGuard moduleKey="dashboard">
                      <Layout>
                        <RegionGuard allowed={['Chitoor']}><DashboardChitoor /></RegionGuard>
                      </Layout>
                    </ModuleGuard>
                  </PrivateRoute>
                }
              />
              <Route
                path="/finance"
                element={
                  <PrivateRoute>
                    <ModuleGuard moduleKey="finance">
                      <Layout>
                        <Finance />
                      </Layout>
                    </ModuleGuard>
                  </PrivateRoute>
                }
              />
              <Route
                path="/payments"
                element={
                  <PrivateRoute>
                    <ModuleGuard moduleKey="finance">
                      <Layout>
                        <Payments />
                      </Layout>
                    </ModuleGuard>
                  </PrivateRoute>
                }
              />
              <Route
                path="/projects"
                element={
                  <PrivateRoute>
                    <ModuleGuard moduleKey="projects">
                      <Layout>
                        <Projects />
                      </Layout>
                    </ModuleGuard>
                  </PrivateRoute>
                }
              />
              <Route
                path="/modules"
                element={
                  <PrivateRoute>
                    <ModuleGuard moduleKey="operations">
                      <Layout>
                        <ModulesPage />
                      </Layout>
                    </ModuleGuard>
                  </PrivateRoute>
                }
              />
              <Route
                path="/logistics/modules"
                element={
                  <PrivateRoute>
                    <ModuleGuard moduleKey="operations">
                      <Layout>
                        <ModulesPage />
                      </Layout>
                    </ModuleGuard>
                  </PrivateRoute>
                }
              />
              <Route
                path="/projects/:id"
                element={
                  <PrivateRoute>
                    <ModuleGuard moduleKey="projects">
                      <Layout>
                        <ProjectDetails />
                      </Layout>
                    </ModuleGuard>
                  </PrivateRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <PrivateRoute>
                    <ModuleGuard moduleKey="sales">
                      <Layout>
                        <Reports />
                      </Layout>
                    </ModuleGuard>
                  </PrivateRoute>
                }
              />
              <Route
                path="/reports/tg"
                element={
                  <PrivateRoute>
                    <ModuleGuard moduleKey="sales">
                      <Layout>
                        <RegionGuard allowed={['Telangana']}><Reports stateFilter="Telangana" /></RegionGuard>
                      </Layout>
                    </ModuleGuard>
                  </PrivateRoute>
                }
              />
              <Route
                path="/reports/ap"
                element={
                  <PrivateRoute>
                    <ModuleGuard moduleKey="sales">
                      <Layout>
                        <RegionGuard allowed={['Andhra Pradesh']}><Reports stateFilter="Andhra Pradesh" /></RegionGuard>
                      </Layout>
                    </ModuleGuard>
                  </PrivateRoute>
                }
              />
              <Route
                path="/reports/chitoor"
                element={
                  <PrivateRoute>
                    <ModuleGuard moduleKey="sales">
                      <Layout>
                        <RegionGuard allowed={['Chitoor']}><Reports stateFilter="Chitoor" /></RegionGuard>
                      </Layout>
                    </ModuleGuard>
                  </PrivateRoute>
                }
              />
              <Route
                path="/service-tickets"
                element={
                  <PrivateRoute>
                    <ModuleGuard moduleKey="serviceTickets">
                      <Layout>
                        <ServiceTickets />
                      </Layout>
                    </ModuleGuard>
                  </PrivateRoute>
                }
              />
              <Route
                path="/projects/telangana"
                element={
                  <PrivateRoute>
                    <ModuleGuard moduleKey="projects">
                      <Layout>
                        <RegionGuard allowed={['Telangana']}><TelanganaProjects /></RegionGuard>
                      </Layout>
                    </ModuleGuard>
                  </PrivateRoute>
                }
              />
              <Route
                path="/projects/ap"
                element={
                  <PrivateRoute>
                    <ModuleGuard moduleKey="projects">
                      <Layout>
                        <RegionGuard allowed={['Andhra Pradesh']}><APProjects /></RegionGuard>
                      </Layout>
                    </ModuleGuard>
                  </PrivateRoute>
                }
              />
              <Route
                path="/projects/chitoor"
                element={
                  <PrivateRoute>
                    <ModuleGuard moduleKey="projects">
                      <Layout>
                        <RegionGuard allowed={['Chitoor']}><ChitoorProjects /></RegionGuard>
                      </Layout>
                    </ModuleGuard>
                  </PrivateRoute>
                }
              />
              <Route
                path="/projects/chitoor/:id"
                element={
                  <PrivateRoute>
                    <ModuleGuard moduleKey="projects">
                      <Layout>
                        <RegionGuard allowed={['Chitoor']}><ChitoorProjectDetails /></RegionGuard>
                      </Layout>
                    </ModuleGuard>
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <PrivateRoute>
                    <Layout>
                      <Admin />
                    </Layout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <PrivateRoute>
                    <Layout>
                      <UsersManagement />
                    </Layout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/stock"
                element={
                  <PrivateRoute>
                    <ModuleGuard moduleKey="operations">
                      <Layout>
                        <StockWarehouse />
                      </Layout>
                    </ModuleGuard>
                  </PrivateRoute>
                }
              />
              <Route
                path="/procurement"
                element={
                  <PrivateRoute>
                    <ModuleGuard moduleKey="operations">
                      <Layout>
                        <Procurement />
                      </Layout>
                    </ModuleGuard>
                  </PrivateRoute>
                }
              />
              <Route
                path="/logistics"
                element={
                  <PrivateRoute>
                    <ModuleGuard moduleKey="operations">
                      <Layout>
                        <Logistics />
                      </Layout>
                    </ModuleGuard>
                  </PrivateRoute>
                }
              />
              <Route
                path="/hr"
                element={
                  <PrivateRoute>
                    <ModuleGuard moduleKey="hr">
                      <Layout>
                        <HR />
                      </Layout>
                    </ModuleGuard>
                  </PrivateRoute>
                }
              />
              <Route
                path="/hr/users"
                element={
                  <PrivateRoute>
                    <Layout>
                      <UsersManagement />
                    </Layout>
                  </PrivateRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </Router>
      </ChakraProvider>
    </ErrorBoundary>
  );
};

export default App;
