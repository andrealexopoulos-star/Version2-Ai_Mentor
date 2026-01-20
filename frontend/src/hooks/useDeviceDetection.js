/**
 * Device Detection Hook
 * Detects if user is on mobile device for different UI rendering
 */
import { useState, useEffect } from 'react';

export const useDeviceDetection = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      const userAgent = navigator.userAgent.toLowerCase();
      
      // More comprehensive mobile detection
      const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(userAgent);
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      // Check screen width
      const isMobileWidth = width <= 768;
      const isTabletWidth = width > 768 && width <= 1024;
      
      // Set mobile if ANY mobile indicator true
      setIsMobile(isMobileUA || isMobileWidth || (isTouchDevice && isMobileWidth));
      setIsTablet(isTabletWidth && !isMobileUA);
      
      // Debug log
      console.log('Device Detection:', {
        width,
        isMobileUA,
        isTouchDevice,
        isMobileWidth,
        RESULT_IS_MOBILE: isMobileUA || isMobileWidth || (isTouchDevice && isMobileWidth)
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
