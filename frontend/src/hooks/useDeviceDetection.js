/**
 * Device Detection Hook - Fixed for Mobile Chrome
 * Lazy initialization to prevent desktop flash on mobile
 */
import { useState, useEffect } from 'react';

export const useDeviceDetection = () => {
  // Lazy initialization - detect on first render, not after
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    
    const width = window.innerWidth;
    const userAgent = navigator.userAgent.toLowerCase();
    
    // Comprehensive detection
    const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(userAgent);
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isMobileWidth = width <= 1024; // Increased from 768 to catch edge cases
    const isMediaQuery = window.matchMedia('(max-width: 768px)').matches;
    
    return isMobileUA || isMobileWidth || isMediaQuery || isTouchDevice;
  });
  
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      const userAgent = navigator.userAgent.toLowerCase();
      
      // More comprehensive mobile detection
      const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(userAgent);
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isMobileWidth = width <= 1024; // Increased breakpoint
      const isMediaQuery = window.matchMedia('(max-width: 768px)').matches;
      const isTabletWidth = width > 1024 && width <= 1280;
      
      // Set mobile if ANY indicator true
      setIsMobile(isMobileUA || isMobileWidth || isMediaQuery || isTouchDevice);
      setIsTablet(isTabletWidth && !isMobileUA);
      
      // Debug log
      console.log('🔍 Device Detection:', {
        width,
        isMobileUA,
        isTouchDevice,
        isMobileWidth,
        isMediaQuery,
        FINAL_IS_MOBILE: isMobileUA || isMobileWidth || isMediaQuery || isTouchDevice
      });
    };

    // Check on mount
    checkDevice();

    // Check on resize
    window.addEventListener('resize', checkDevice);
    
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  return { isMobile, isTablet, isDesktop: !isMobile && !isTablet };
};

export default useDeviceDetection;
