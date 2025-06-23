# Fantasy Sports Betting App

A modern web application for fantasy sports betting, built with React and Node.js. Place bets on upcoming games, track your balance, and enjoy a sleek user interface.

## Features

- 🔐 Secure user authentication
- 💰 Virtual betting system
- 📊 Real-time sports odds
- 💼 User account management
- 🎨 Modern, responsive design

## Prerequisites

Before you begin, ensure you have installed:
- Node.js (v14 or higher)
- npm (usually comes with Node.js)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/fantasy-sports-bets.git
cd fantasy-sports-bets
```

2. Install backend dependencies:
```bash
npm install
```

3. Install frontend dependencies:
```bash
cd client
npm install
```

4. Create a `.env` file in the root directory and add your Odds API key:
```
ODDS_API_KEY=your_api_key_here
```

## Running the Application

1. Start the backend server (from the root directory):
```bash
node server.js
```

2. In a new terminal, start the frontend development server:
```bash
cd client
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173 (or next available port)
- Backend: http://localhost:5000

## Project Structure

```
fantasy-sports-bets/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── api.js        # API communication
│   │   └── App.jsx       # Main application component
│   └── package.json
├── server.js              # Backend Express server
├── bets.db               # SQLite database
└── package.json
```

## API Endpoints

- `POST /register` - Create a new user account
- `POST /login` - Authenticate user
- `GET /odds` - Fetch current sports odds
- `POST /bet` - Place a bet
- `GET /bets/:userId` - Get user's betting history

## Technologies Used

### Frontend
- React
- Vite
- Axios
- Modern CSS

### Backend
- Node.js
- Express
- SQLite3
- bcrypt for password hashing
- express-validator
- CORS

## Security Features

- Password hashing with bcrypt
- Input validation and sanitization
- CORS protection
- Secure password requirements
- Email validation

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- The Odds API for providing sports data
- React team for the amazing frontend library
- Express.js team for the robust backend framework 