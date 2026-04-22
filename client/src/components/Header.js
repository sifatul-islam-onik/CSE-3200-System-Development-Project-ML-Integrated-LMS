import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Header.css';

const Header = () => {
  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo">
          <h1>OBESynK</h1>
        </Link>
      </div>
    </header>
  );
};

export default Header;
