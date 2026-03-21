import React from 'react';
import '../styles/Home.css';

const Home = () => {
  return (
    <div className="home-page cobalt-home-page">
      <iframe
        className="cobalt-overview-frame"
        src="/overview.html"
        title="COBALT Responsive Platform Overview"
      />
    </div>
  );
};

export default Home;
