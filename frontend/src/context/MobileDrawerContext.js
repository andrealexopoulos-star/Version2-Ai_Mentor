import { createContext, useContext, useState, useEffect } from 'react';

/**
 * Mobile Drawer State Manager
 * Ensures only ONE drawer is open at a time on mobile (< 768px)
 * Values: 'none' | 'nav' | 'chat'
 */

const MobileDrawerContext = createContext();

export const MobileDrawerProvider = ({ children }) => {
  const [activeDrawer, setActiveDrawer] = useState('none');

  // Auto-close on window resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setActiveDrawer('none');
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const openNav = () => setActiveDrawer('nav');
  const openChat = () => setActiveDrawer('chat');
  const closeAll = () => setActiveDrawer('none');

  return (
    <MobileDrawerContext.Provider value={{ 
      activeDrawer, 
      openNav, 
      openChat, 
      closeAll,
      isNavOpen: activeDrawer === 'nav',
      isChatOpen: activeDrawer === 'chat'
    }}>
      {children}
    </MobileDrawerContext.Provider>
  );
};

export const useMobileDrawer = () => {
  const context = useContext(MobileDrawerContext);
  if (!context) {
    throw new Error('useMobileDrawer must be used within MobileDrawerProvider');
  }
  return context;
};
