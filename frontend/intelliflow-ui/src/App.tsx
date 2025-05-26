import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { AnalysisConfig } from './components/AnalysisConfig';
import { AnalysisResults } from './components/AnalysisResults';
import { AnalysisHistory } from './components/AnalysisHistory';
import { Layout } from './components/Layout';
import { apiClient } from './lib/api';
import './App.css';

// Define interfaces for better type safety
interface AnalysisConfigType {
  dataSource: string;
  analysisType: string;
  parameters: Record<string, string>;
  objectives: string[];
}

function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSources, setDataSources] = useState([]);
  const [analysisTypes, setAnalysisTypes] = useState([]);
  const navigate = useNavigate();
  
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
  const handleStartAnalysis = async (analysisConfig: AnalysisConfigType) => {
    try {
      setIsLoading(true);
      const response = await apiClient.startAnalysis(analysisConfig);
      
      if (response.status === 'success') {
        setAnalysisId(response.analysis_id);
        navigate(`/results/${response.analysis_id}`);
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

  // Results component with route parameters
  const ResultsWithParams = () => {
    const { id } = useParams();
    
    useEffect(() => {
      if (id) {
        setAnalysisId(id);
      }
    }, [id]);
    
    return (
      <AnalysisResults 
        analysisId={id || analysisId}
        onNewAnalysis={() => navigate('/configure')}
      />
    );
  };
  
  return (
    <Layout darkMode={darkMode} setDarkMode={setDarkMode}>
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
        <Routes>
          <Route path="/" element={<Dashboard onStartAnalysis={() => navigate('/configure')} />} />
          <Route path="/configure" element={
            <AnalysisConfig 
              dataSources={dataSources}
              analysisTypes={analysisTypes}
              onStartAnalysis={handleStartAnalysis}
              isLoading={isLoading}
            />
          } />
          <Route path="/results/:id?" element={<ResultsWithParams />} />
          <Route path="/history" element={
            <AnalysisHistory 
              onViewAnalysis={(id: string) => {
                setAnalysisId(id);
                navigate(`/results/${id}`);
              }}
            />
          } />
        </Routes>
      )}
    </Layout>
  );
}

export default App;
