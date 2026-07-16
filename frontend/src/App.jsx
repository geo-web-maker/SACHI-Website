import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Nav from './components/Nav/Nav';
import Footer from './components/Footer/Footer';
import Home from './pages/Home/Home';
import About from './pages/About/About';
import Programmes from './pages/Programmes/Programmes';
import ProgrammeDetail from './pages/ProgrammeDetail/ProgrammeDetail';
import Gallery from './pages/Gallery/Gallery';
import Contact from './pages/Contact/Contact';
import Career from './pages/Career/Career';
import Donate from './pages/Donate/Donate';

import { RoleProvider } from './admin/context/RoleContext';
import AdminLayout from './admin/components/AdminLayout/AdminLayout';
import Login from './admin/pages/Login/Login';
import Dashboard from './admin/pages/Dashboard/Dashboard';
import ProgrammesAdmin from './admin/pages/ProgrammesAdmin/ProgrammesAdmin';
import CareerAdmin from './admin/pages/CareerAdmin/CareerAdmin';
import GalleryAdmin from './admin/pages/GalleryAdmin/GalleryAdmin';
import ContactAdmin from './admin/pages/ContactAdmin/ContactAdmin';
import DonationsAdmin from './admin/pages/DonationsAdmin/DonationsAdmin';
import UsersAdmin from './admin/pages/UsersAdmin/UsersAdmin';

function PublicLayout({ children }) {
  return (
    <>
      <Nav />
      {children}
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <HelmetProvider>
      <RoleProvider>
        <BrowserRouter>
          <Routes>
            {/* Public site */}
            <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
            <Route path="/about" element={<PublicLayout><About /></PublicLayout>} />
            <Route path="/programmes" element={<PublicLayout><Programmes /></PublicLayout>} />
            <Route path="/programmes/:slug" element={<PublicLayout><ProgrammeDetail /></PublicLayout>} />
            <Route path="/gallery" element={<PublicLayout><Gallery /></PublicLayout>} />
            <Route path="/contact" element={<PublicLayout><Contact /></PublicLayout>} />
            <Route path="/career" element={<PublicLayout><Career /></PublicLayout>} />
            <Route path="/donate" element={<PublicLayout><Donate /></PublicLayout>} />

            {/* Admin */}
            <Route path="/admin/login" element={<Login />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="programmes" element={<ProgrammesAdmin />} />
              <Route path="career" element={<CareerAdmin />} />
              <Route path="gallery" element={<GalleryAdmin />} />
              <Route path="contact" element={<ContactAdmin />} />
              <Route path="donations" element={<DonationsAdmin />} />
              <Route path="users" element={<UsersAdmin />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </RoleProvider>
    </HelmetProvider>
  );
}
