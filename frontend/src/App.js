import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import AuthService from './services/AuthService';
import Login from './components/Login';
import Register from './components/Register';
import Chat from './components/Chat';
import './App.css'; // Keep or replace with your own styles

function App() {
  const [currentUser, setCurrentUser] = useState(undefined);
  const [loading, setLoading] = useState(true); // Add loading state

  useEffect(() => {
    const user = AuthService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
    }
    setLoading(false); // Set loading to false after checking user
  }, []);

  const logOut = () => {
    AuthService.logout();
    setCurrentUser(undefined);
    // No explicit navigation needed here, Router will handle based on currentUser
  };

  if (loading) {
    return <div className="container mt-3 text-center"><h5>Loading...</h5></div>; // Or any spinner component
  }

  return (
    <Router>
      <div>
        <nav className="navbar navbar-expand navbar-dark bg-dark">
          <Link to={"/"} className="navbar-brand">
            SecureChat
          </Link>
          <div className="navbar-nav mr-auto">
            {currentUser && (
              <li className="nav-item">
                <Link to={"/chat"} className="nav-link">
                  Chat
                </Link>
              </li>
            )}
          </div>

          {currentUser ? (
            <div className="navbar-nav ml-auto">
              <li className="nav-item">
                {/* Could show username: {currentUser.username} if decoded from token */}
                <a href="/login" className="nav-link" onClick={logOut}>
                  Logout
                </a>
              </li>
            </div>
          ) : (
            <div className="navbar-nav ml-auto">
              <li className="nav-item">
                <Link to={"/login"} className="nav-link">
                  Login
                </Link>
              </li>
              <li className="nav-item">
                <Link to={"/register"} className="nav-link">
                  Sign Up
                </Link>
              </li>
            </div>
          )}
        </nav>

        {/* Removed the overall "container mt-3" div to allow Chat to be full-width */}
        <Routes>
          <Route 
            path="/" 
            element={
              <div className="container mt-3"> {/* Keep container for non-chat default routes */}
                {currentUser ? <Navigate to="/chat" /> : <Navigate to="/login" />}
              </div>
            } 
          />
          <Route 
            path="/login" 
            element={
              <div className="container mt-3"> {/* Keep container for login */}
                <Login />
              </div>
            } 
          />
          <Route 
            path="/register" 
            element={
              <div className="container mt-3"> {/* Keep container for register */}
                <Register />
              </div>
            } 
          />
          {/* Chat route does not have the .container wrapper */}
          <Route 
            path="/chat" 
            element={currentUser ? <Chat /> : <Navigate to="/login" />} 
          />
          {/* Add other routes here, wrapping with <div className="container mt-3"> if needed */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;
