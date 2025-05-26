import { useState } from 'react';

import { NavLink } from 'react-router-dom';

interface LayoutProps {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
  children: React.ReactNode;
}

export function Layout({ darkMode, setDarkMode, children }: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen bg-background">
        <div className="flex min-h-screen">
          {/* Sidebar - Desktop */}
          <div className="hidden md:flex w-64 flex-col fixed inset-y-0 z-50 border-r bg-background">
            <div className="flex h-14 items-center px-4 border-b">
              <div className="flex items-center space-x-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6"
                >
                  <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
                </svg>
                <span className="font-bold">IntelliFlow</span>
              </div>
            </div>
            <div className="flex-1 overflow-auto py-2">
              <nav className="grid items-start px-2 text-sm font-medium">
                <NavLink
                  to="/"
                  className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
                    isActive 
                      ? 'text-primary bg-accent' 
                      : 'text-muted-foreground hover:text-primary hover:bg-accent'
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="9" y1="21" x2="9" y2="9" />
                  </svg>
                  Dashboard
                </NavLink>
                <NavLink
                  to="/configure"
                  className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
                    isActive 
                      ? 'text-primary bg-accent' 
                      : 'text-muted-foreground hover:text-primary hover:bg-accent'
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                  New Analysis
                </NavLink>
                <NavLink
                  to="/results"
                  className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
                    isActive 
                      ? 'text-primary bg-accent' 
                      : 'text-muted-foreground hover:text-primary hover:bg-accent'
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                  Results
                </NavLink>
                <NavLink
                  to="/history"
                  className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
                    isActive 
                      ? 'text-primary bg-accent' 
                      : 'text-muted-foreground hover:text-primary hover:bg-accent'
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  History
                </NavLink>
              </nav>
            </div>
            <div className="mt-auto p-4 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-primary h-8 w-8 flex items-center justify-center text-primary-foreground">
                    U
                  </div>
                  <div>
                    <p className="text-xs font-medium">User</p>
                    <p className="text-xs text-muted-foreground">user@example.com</p>
                  </div>
                </div>
                <button 
                  onClick={() => setDarkMode(!darkMode)}
                  className="rounded-full p-1 hover:bg-accent"
                >
                  {darkMode ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                    >
                      <circle cx="12" cy="12" r="5" />
                      <line x1="12" y1="1" x2="12" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="1" y1="12" x2="3" y2="12" />
                      <line x1="21" y1="12" x2="23" y2="12" />
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                    >
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
          
          {/* Mobile header */}
          <div className="md:hidden flex h-14 items-center px-4 border-b sticky top-0 z-50 bg-background">
            <button className="mr-2" onClick={toggleMobileMenu}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
              >
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </svg>
            </button>
            <div className="flex items-center space-x-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
              >
                <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
              </svg>
              <span className="font-bold">IntelliFlow</span>
            </div>
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="ml-auto rounded-full p-1 hover:bg-accent"
            >
              {darkMode ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
          </div>
          
          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="md:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm">
              <div className="fixed inset-y-0 left-0 w-3/4 max-w-xs bg-background border-r p-6 shadow-lg">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center space-x-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-6 w-6"
                    >
                      <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
                    </svg>
                    <span className="font-bold">IntelliFlow</span>
                  </div>
                  <button onClick={toggleMobileMenu}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-6 w-6"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                <nav className="grid gap-4 text-lg font-medium">
                  <NavLink
                    to="/"
                    className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
                      isActive 
                        ? 'text-primary bg-accent' 
                        : 'text-muted-foreground hover:text-primary hover:bg-accent'
                    }`}
                    onClick={toggleMobileMenu}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <line x1="3" y1="9" x2="21" y2="9" />
                      <line x1="9" y1="21" x2="9" y2="9" />
                    </svg>
                    Dashboard
                  </NavLink>
                  <NavLink
                    to="/configure"
                    className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
                      isActive 
                        ? 'text-primary bg-accent' 
                        : 'text-muted-foreground hover:text-primary hover:bg-accent'
                    }`}
                    onClick={toggleMobileMenu}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5"
                    >
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    New Analysis
                  </NavLink>
                  <NavLink
                    to="/results"
                    className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
                      isActive 
                        ? 'text-primary bg-accent' 
                        : 'text-muted-foreground hover:text-primary hover:bg-accent'
                    }`}
                    onClick={toggleMobileMenu}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5"
                    >
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                    </svg>
                    Results
                  </NavLink>
                  <NavLink
                    to="/history"
                    className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
                      isActive 
                        ? 'text-primary bg-accent' 
                        : 'text-muted-foreground hover:text-primary hover:bg-accent'
                    }`}
                    onClick={toggleMobileMenu}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    History
                  </NavLink>
                </nav>
                <div className="mt-auto pt-4 border-t mt-8">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-primary h-8 w-8 flex items-center justify-center text-primary-foreground">
                      U
                    </div>
                    <div>
                      <p className="text-sm font-medium">User</p>
                      <p className="text-xs text-muted-foreground">user@example.com</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="fixed inset-0 bg-black/20" onClick={toggleMobileMenu}></div>
            </div>
          )}
          
          {/* Main content */}
          <div className="flex-1 md:ml-64 p-4 md:p-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
