/**
 * AdComponent - Flexible Advertisement Display System
 * 
 * Provides revenue-generating advertisement system with multiple placement types.
 * Supports demo mode for presentations and production mode for real ads.
 * Configuration-driven via backend API with easy toggle controls.
 * 
 * @param {string} placement - Ad placement: 'header', 'sidebar', 'betweenGames'  
 * @param {string} className - Additional CSS classes for styling
 */

import { useState, useEffect } from 'react';
import './AdComponent.css';

function AdComponent({ placement = 'sidebar', className = '' }) {
  const [adConfig, setAdConfig] = useState(null);
  const [currentAd, setCurrentAd] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch ad configuration from backend
  useEffect(() => {
    const fetchAdConfig = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/ads/config');
        if (response.ok) {
          const config = await response.json();
          setAdConfig(config);
          
          // Set current ad based on placement
          if (config.enabled && config.placements[placement]?.enabled) {
            selectRandomAd(config, placement);
          }
        }
      } catch (error) {
        console.error('Error fetching ad config:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAdConfig();
  }, [placement]);

  // Select random ad based on placement type
  const selectRandomAd = (config, placement) => {
    if (!config.fakeAds) return;

    let adPool = [];
    
    if (placement === 'header') {
      adPool = config.fakeAds.banner || [];
    } else if (placement === 'sidebar') {
      adPool = config.fakeAds.sportsbook || [];
    } else if (placement === 'banner' || placement === 'betweenGames') {
      // Use banner ads for the new landscape placement between components
      adPool = config.fakeAds.banner || [];
    }

    if (adPool.length > 0) {
      const randomAd = adPool[Math.floor(Math.random() * adPool.length)];
      setCurrentAd(randomAd);
    }
  };

  // Handle ad click (for tracking/analytics)
  const handleAdClick = () => {
    // In development mode, just show alert
    if (adConfig?.developmentMode) {
      alert(`Demo ad clicked: ${currentAd?.title}\n\nIn production, this would redirect to the advertiser.`);
    } else {
      // In production, this would handle real ad clicks
      console.log('Real ad clicked:', currentAd);
    }
  };

  // Don't render if ads are disabled or loading
  if (loading || !adConfig?.enabled || !adConfig?.placements[placement]?.enabled || !currentAd) {
    return null;
  }

  return (
    <div className={`ad-component ad-${placement} ${className}`}>
      {adConfig.developmentMode && (
        <div className="ad-demo-label">Demo Ad</div>
      )}
      
      <div 
        className="ad-content"
        onClick={handleAdClick}
      >
        <div className="ad-image">
          <img 
            src={currentAd.image} 
            alt={currentAd.title}
            loading="lazy"
          />
        </div>
        
        <div className="ad-text">
          <h4 className="ad-title">{currentAd.title}</h4>
          <p className="ad-description">{currentAd.text}</p>
          <button className="ad-cta">{currentAd.cta}</button>
        </div>
      </div>
    </div>
  );
}

export default AdComponent; 