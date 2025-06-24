/**
 * MainLayout Component - Clean vertical layout with separated ad placement
 * 
 * Provides a simple container layout where ads are placed vertically between
 * functional components rather than mixed with them. This keeps ads separate
 * from the core betting functionality.
 * 
 * @param {React.ReactNode} children - The main content components
 */

import './MainLayout.css';

function MainLayout({ children }) {
  return (
    <div className="main-layout">
      <div className="content-container">
        {children}
      </div>
    </div>
  );
}

export default MainLayout; 