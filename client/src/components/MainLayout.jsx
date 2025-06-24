/**
 * MainLayout Component
 * 
 * Provides the main layout structure with sidebar ads and content area.
 * Responsive design that adapts to different screen sizes.
 */

import AdComponent from './AdComponent';
import './MainLayout.css';

function MainLayout({ children }) {
  return (
    <div className="main-layout">
      <div className="layout-container">
        {/* Main Content Area */}
        <main className="content-area">
          {children}
        </main>
        
        {/* Sidebar with Ads */}
        <aside className="sidebar">
          <div className="sidebar-content">
            <AdComponent placement="sidebar" />
            
            {/* Additional sidebar ad (if needed) */}
            <div className="sidebar-spacer">
              <AdComponent placement="sidebar" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default MainLayout; 