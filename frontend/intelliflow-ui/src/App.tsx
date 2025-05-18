import { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { AnalysisConfig } from './components/AnalysisConfig';
import { AnalysisResults } from './components/AnalysisResults';
import { AnalysisHistory } from './components/AnalysisHistory';
import { apiClient } from './lib/api';
import './App.css';

function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSources, setDataSources] = useState([]);
  const [analysisTypes, setAnalysisTypes] = useState([]);
  
  // Fetch data sources and analysis types on component mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setIsLoading(true);
        
        // Check API health
        await apiClient.healthCheck();
        
        // Fetch data sources
        const dataSourcesResponse = await apiClient.getDataSources();
        if (dataSourcesResponse.status === 'success') {
          setDataSources(dataSourcesResponse.data_sources);
        }
        
        // Fetch analysis types
        const analysisTypesResponse = await apiClient.getAnalysisTypes();
        if (analysisTypesResponse.status === 'success') {
          setAnalysisTypes(analysisTypesResponse.analysis_types);
        }
        
        setIsLoading(false);
      } catch (error: any) {
        console.error('Failed to fetch initial data:', error);
        setError('Failed to connect to the IntelliFlow API. Please ensure the backend is running.');
        setIsLoading(false);
      }
    };
    
    fetchInitialData();
  }, []);
  
  // Handle starting a new analysis
  const handleStartAnalysis = async (analysisConfig: any) => {
    try {
      setIsLoading(true);
      const response = await apiClient.startAnalysis(analysisConfig);
      
      if (response.status === 'success') {
        setAnalysisId(response.analysis_id);
        setActiveView('results');
      } else {
        setError(response.message || 'Failed to start analysis');
      }
      
      setIsLoading(false);
    } catch (error: any) {
      console.error('Failed to start analysis:', error);
      setError(error.message || 'Failed to start analysis');
      setIsLoading(false);
    }
  };
  
  // Render the appropriate view based on activeView state
  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard onStartAnalysis={() => setActiveView('configure')} />;
      case 'configure':
        return (
          <AnalysisConfig 
            dataSources={dataSources}
            analysisTypes={analysisTypes}
            onStartAnalysis={handleStartAnalysis}
            isLoading={isLoading}
          />
        );
      case 'results':
        return (
          <AnalysisResults 
            analysisId={analysisId}
            onNewAnalysis={() => setActiveView('configure')}
          />
        );
      case 'history':
        return (
          <AnalysisHistory 
            onViewAnalysis={(id: string) => {
              setAnalysisId(id);
              setActiveView('results');
            }}
          />
        );
      default:
        return <Dashboard onStartAnalysis={() => setActiveView('configure')} />;
    }
  };
  
  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen bg-background">
        <div className="flex min-h-screen">
          {/* Sidebar */}
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
                <a
                  href="#"
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
                    activeView === 'dashboard' 
                      ? 'text-primary bg-accent' 
                      : 'text-muted-foreground hover:text-primary hover:bg-accent'
                  }`}
                  onClick={() => setActiveView('dashboard')}
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
                </a>
                <a
                  href="#"
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
                    activeView === 'configure' 
                      ? 'text-primary bg-accent' 
                      : 'text-muted-foreground hover:text-primary hover:bg-accent'
                  }`}
                  onClick={() => setActiveView('configure')}
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
                </a>
                <a
                  href="#"
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
                    activeView === 'results' 
                      ? 'text-primary bg-accent' 
                      : 'text-muted-foreground hover:text-primary hover:bg-accent'
                  }`}
                  onClick={() => analysisId && setActiveView('results')}
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
                </a>
                <a
                  href="#"
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
                    activeView === 'history' 
                      ? 'text-primary bg-accent' 
                      : 'text-muted-foreground hover:text-primary hover:bg-accent'
                  }`}
                  onClick={() => setActiveView('history')}
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
                </a>
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
            <button className="mr-2">
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
          
          {/* Main content */}
          <div className="flex-1 md:ml-64 p-4 md:p-8">
            {error ? (
              <div className="rounded-md bg-destructive/15 p-4 text-destructive">
                <p>{error}</p>
              </div>
            ) : isLoading && !analysisId ? (
              <div className="flex flex-col items-center justify-center h-[80vh]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                <p className="mt-4 text-muted-foreground">Loading IntelliFlow...</p>
              </div>
            ) : (
              renderView()
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
