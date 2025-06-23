# Fantasy Sports Betting - Frontend Documentation

## 📱 Frontend Overview

This is the React frontend for the Fantasy Sports Betting platform. Built with React 18, Vite, and modern CSS, it provides a responsive and intuitive user interface for sports betting.

## 🏗️ Technology Stack

- **React 18**: Modern functional components with hooks
- **Vite**: Fast build tool and development server
- **CSS3**: Custom styling with responsive design
- **JavaScript ES6+**: Modern JavaScript features
- **Fetch API**: HTTP client for backend communication

## 📁 Project Structure

```
client/
├── public/                 # Static assets
│   └── vite.svg           # Vite logo
├── src/                   # Source code
│   ├── components/        # React components
│   │   ├── BettingHistory.jsx    # User bet history
│   │   ├── BettingHistory.css    # Betting history styles
│   │   ├── Leaderboard.jsx       # Global leaderboard
│   │   ├── Leaderboard.css       # Leaderboard styles
│   │   ├── Login.jsx             # User authentication
│   │   ├── Login.css             # Login page styles
│   │   ├── Register.jsx          # User registration
│   │   └── Register.css          # Registration styles
│   ├── api.js             # API communication layer
│   ├── App.jsx            # Main application component
│   ├── App.css            # Global application styles
│   ├── index.css          # Global base styles
│   └── main.jsx           # React entry point
├── eslint.config.js       # ESLint configuration
├── index.html             # HTML template
├── package.json           # Dependencies and scripts
└── vite.config.js         # Vite configuration
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v14.18.0 or higher)
- npm or yarn package manager

### Installation
```bash
# Navigate to client directory
cd client

# Install dependencies
npm install

# Start development server
npm run dev
```

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

## 🎯 Component Architecture

### App.jsx - Main Application
The root component that handles:
- **Authentication State**: Login/logout and user management
- **Route Management**: Switch between auth and main app views
- **Global State**: User data, betting state, and UI controls
- **API Integration**: Centralized data fetching and error handling

**Key Features:**
- Conditional rendering based on authentication status
- Centralized error handling and loading states
- Responsive layout management
- State management for betting interface

### Login.jsx - Authentication Interface
Modern, responsive login component with:
- **Two-Column Layout**: Branding on left, form on right
- **Desktop Optimized**: Uses 95% width up to 1200px maximum
- **Mobile Responsive**: Stacks vertically on smaller screens
- **Professional Design**: Gradient backgrounds and smooth animations

**Key Features:**
- JWT token-based authentication
- Form validation and error handling
- Responsive design for all screen sizes
- Registration link integration

### Register.jsx - User Registration
User registration form with:
- Validation for username, password, and email
- Error handling for duplicate users
- Consistent styling with login component

### BettingHistory.jsx - Bet Tracking
Displays user betting history with:
- **Chronological Listing**: Most recent bets first
- **Bet Cancellation**: Cancel pending bets
- **Status Tracking**: Win/loss/pending states
- **Real-time Updates**: Refreshes when new bets are placed

### Leaderboard.jsx - Global Rankings
Shows global user rankings with:
- User rankings by total winnings
- Balance display for all users
- Real-time updates

## 🎨 Styling Guidelines

### CSS Organization
- **Component-Specific**: Each component has its own CSS file
- **Global Styles**: `index.css` for base styles, `App.css` for app-wide styles
- **Responsive Design**: Mobile-first approach with desktop enhancements
- **Color Scheme**: Professional blue/gold theme consistent throughout

### Design Principles
- **Desktop-First UX**: Optimized for computer browsers
- **Mobile Compatible**: Responsive design for all devices
- **Professional Appearance**: Clean, modern design suitable for betting platform
- **Accessibility**: Proper contrast ratios and keyboard navigation

### CSS Variables and Themes
```css
/* Color palette */
--primary-color: #1a2a6c
--secondary-color: #2a3a7c  
--accent-color: #fdbb2d
--error-color: #dc3545
--success-color: #4caf50
```

## 🔗 API Integration

### api.js - Centralized API Layer
All backend communication is handled through `api.js`:

```javascript
// Authentication
login(credentials)
register(userData)
logout()

// Betting
fetchOdds(page, sport)
placeBet(betData)

// User data
fetchUserData()
```

### Error Handling
- **Network Errors**: Graceful handling of connection issues
- **API Errors**: User-friendly error messages
- **Validation Errors**: Real-time form validation feedback
- **Authentication Errors**: Automatic token refresh and logout

## 📱 Responsive Design

### Breakpoints
- **Mobile**: ≤ 768px (single column, simplified UI)
- **Tablet**: 769px - 1024px (optimized spacing)
- **Desktop**: ≥ 1025px (full two-column layout)

### Layout Behavior
- **Login Page**: Two-column on desktop, stacked on mobile
- **Main App**: Responsive grid for game cards
- **Navigation**: Collapsible menus on smaller screens

## 🔧 State Management

### Local State (useState)
- Component-specific state for forms and UI interactions
- Loading states for async operations
- Error states for user feedback

### Shared State (Props)
- User authentication status and data
- Betting interface state and selections
- Pagination and filtering options

### State Flow
```
App.jsx (root state)
├── Authentication state
├── User data and balance
├── Betting interface state
└── UI state (loading, errors)
```

## 🧪 Testing Guidelines

### Recommended Testing Strategy
```bash
# Install testing dependencies
npm install --save-dev @testing-library/react @testing-library/jest-dom jest

# Component testing
npm run test
```

### Test Coverage Areas
- **Component Rendering**: Ensure components render without errors
- **User Interactions**: Button clicks, form submissions, navigation
- **API Integration**: Mock API calls and test responses
- **Responsive Behavior**: Test layout on different screen sizes

## 🚀 Performance Optimization

### Current Optimizations
- **Vite Build Tool**: Fast bundling and hot module replacement
- **Component Lazy Loading**: Conditional rendering to reduce initial load
- **API Caching**: Intelligent caching of sports odds data
- **Image Optimization**: Optimized assets and loading strategies

### Recommended Improvements
- **Code Splitting**: Implement React.lazy() for route-based splitting
- **Memoization**: Use React.memo() for expensive components
- **Virtual Scrolling**: For large lists of games or bets
- **Service Workers**: For offline capability and caching

## 🔐 Security Considerations

### Client-Side Security
- **Token Storage**: JWT tokens in localStorage with expiration
- **Input Validation**: Client-side validation for all forms
- **XSS Prevention**: Proper data sanitization and React's built-in protection
- **HTTPS**: All API calls over secure connections

### Best Practices
- Never store sensitive data in localStorage
- Validate all user inputs before sending to backend
- Use environment variables for configuration
- Implement proper error boundaries

## 🎯 User Experience Features

### Login Experience
- **Professional Design**: Two-column layout with branding
- **Smooth Animations**: Hover effects and transitions
- **Clear Feedback**: Loading states and error messages
- **Easy Registration**: One-click switch to registration form

### Betting Interface
- **Intuitive Design**: Clear game cards with odds display
- **Flexible Betting**: Preset amounts or custom values
- **Real-time Updates**: Live odds and balance updates
- **History Tracking**: Complete betting history with status

## 🔄 Development Workflow

### Adding New Components
1. Create component file in `src/components/`
2. Create accompanying CSS file
3. Export component from main file
4. Import and use in parent components
5. Add proper JSDoc comments

### Styling New Features
1. Follow existing naming conventions
2. Use CSS variables for colors and spacing
3. Implement responsive design from mobile up
4. Test on multiple screen sizes

### API Integration
1. Add new API functions to `api.js`
2. Include proper error handling
3. Update component state management
4. Test with loading and error states

## 📊 Monitoring and Analytics

### Performance Metrics
- **Page Load Times**: Monitor initial and subsequent loads
- **Component Render Times**: Identify performance bottlenecks
- **API Response Times**: Track backend communication efficiency
- **User Interactions**: Button clicks, form submissions, navigation patterns

### Error Tracking
- **JavaScript Errors**: Catch and log client-side errors
- **API Failures**: Track failed requests and network issues
- **User Experience Issues**: Monitor form abandonment and user flow

## 🚀 Deployment

### Build Process
```bash
# Production build
npm run build

# Output directory
dist/
├── index.html
├── assets/
│   ├── index-[hash].js
│   └── index-[hash].css
└── vite.svg
```

### Deployment Options
- **Static Hosting**: Vercel, Netlify, GitHub Pages
- **CDN**: CloudFront, CloudFlare
- **Container**: Docker with nginx
- **Traditional**: Apache/nginx web server

### Environment Variables
```javascript
// vite.config.js
export default {
  define: {
    __API_URL__: JSON.stringify(process.env.VITE_API_URL || 'http://localhost:5000')
  }
}
```

## 🔮 Future Enhancements

### Planned Features
- **Real-time Updates**: WebSocket integration for live odds
- **Advanced Betting**: Parlays, over/under, prop bets
- **Social Features**: Friend challenges and shared leaderboards
- **Mobile App**: React Native or PWA implementation

### Technical Improvements
- **State Management**: Redux or Zustand for complex state
- **Testing**: Comprehensive test suite with high coverage
- **Performance**: Advanced optimization and caching strategies
- **Accessibility**: Full WCAG compliance

---

**Last Updated**: December 2024  
**Frontend Version**: 1.0.0  
**React Version**: 18.x  
**Vite Version**: 5.x
