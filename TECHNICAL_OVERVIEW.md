# Fantasy Sports Betting App - Technical Overview

## How It Works (ELI15)

This application is split into two main parts: the frontend (what you see in your browser) and the backend (the server that handles all the data and logic). Here's how everything works together:

### Backend (server.js)

The backend is like a restaurant's kitchen - it's where all the important work happens behind the scenes:

1. **Database (SQLite)**
   - Think of this as our filing cabinet where we store all user information and bets
   - We use SQLite because it's like a simple Excel file that can handle all our data without needing a complex setup
   - We have two main "sheets" (tables):
     - Users: Stores usernames, passwords (securely encrypted), and account balances
     - Bets: Keeps track of who bet on what and how much

2. **API Endpoints**
   These are like different counters in our restaurant where users can request specific services:
   - `/register`: Where new users can create an account
   - `/login`: Where existing users can sign in
   - `/odds`: Gets the latest sports game odds from a professional service
   - `/bet`: Where users can place their bets
   - `/bets/:userId`: Shows a user's betting history

3. **Security**
   - Passwords are encrypted (using bcrypt) - it's like turning them into a secret code that even we can't read
   - We validate all user input to make sure it's safe and correct
   - We use CORS to make sure only our frontend can talk to our backend

### Frontend (React App)

The frontend is like the restaurant's dining room - it's what the customers actually see and interact with:

1. **Components**
   These are like different sections of our restaurant:
   - `App.jsx`: The main component that controls everything (like the restaurant manager)
   - `Register.jsx`: Handles new user registration (like the host desk for new customers)
   - `Login.jsx`: Handles user login (like the host desk for returning customers)

2. **State Management**
   - We use React's useState to keep track of things like:
     - Whether a user is logged in
     - Their account balance
     - Available games and odds
   - Think of this like the restaurant's current status board

3. **API Communication**
   - The frontend talks to the backend using axios (like a waiter running between the dining room and kitchen)
   - All these communications are organized in `api.js`

### How Data Flows

1. When you first visit the site:
   - You see the login/register page
   - No sensitive data is loaded yet

2. When you log in:
   - Frontend sends your username/password to the backend
   - Backend checks if they're correct
   - If correct, sends back your user info
   - Frontend then loads the games and odds

3. When you place a bet:
   - Frontend sends bet details to backend
   - Backend checks if you have enough money
   - Updates your balance if successful
   - Sends back confirmation
   - Frontend updates to show your new balance

### Technical Stack

- **Frontend**: React + Vite (for super fast loading)
- **Backend**: Node.js + Express (reliable and easy to work with)
- **Database**: SQLite (simple but effective)
- **API**: The Odds API (for real sports data)
- **Styling**: CSS with modern features

## Development Workflow

1. Backend runs on port 5000
2. Frontend runs on port 5173 (or next available)
3. Changes to frontend code update instantly in browser
4. Database changes persist between sessions 