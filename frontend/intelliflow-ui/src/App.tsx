import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { AnalysisConfig } from './components/AnalysisConfig';
import { AnalysisResults } from './components/AnalysisResults';
import { AnalysisHistory } from './components/AnalysisHistory';
import { Layout } from './components/Layout';
import { apiClient, AnalysisType } from './lib/api';
import { useToast } from './hooks/use-toast';

function App() {
  const [activeTab, setActiveTab] = useState("configure");
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [analysisTypes, setAnalysisTypes] = useState<AnalysisType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Fetch analysis types when component mounts
    const fetchAnalysisTypes = async () => {
      try {
        const response = await apiClient.getAnalysisTypes();
        if (response.status === 'success') {
          setAnalysisTypes(response.analysis_types);
        }
      } catch (error) {
        console.error('Failed to fetch analysis types:', error);
        toast({
          title: "Error",
          description: "Failed to fetch analysis types. Using default types.",
          variant: "destructive",
        });
      }
    };

    fetchAnalysisTypes();
  }, [toast]);

  const handleStartAnalysis = async (config: any) => {
    setIsLoading(true);
    try {
      const response = await apiClient.startAnalysis(config);
      if (response.status === 'success') {
        setAnalysisId(response.analysis_id);
        setActiveTab("results");
        toast({
          title: "Analysis Started",
          description: "Your analysis has been started successfully.",
        });
      } else {
        throw new Error(response.message || 'Failed to start analysis');
      }
    } catch (error: any) {
      console.error('Failed to start analysis:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to start analysis. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewAnalysis = (id: string) => {
    setAnalysisId(id);
    setActiveTab("results");
  };

  const handleNewAnalysis = () => {
    setActiveTab("configure");
  };

  return (
    <Layout darkMode={darkMode} setDarkMode={setDarkMode}>
      <div className="container mx-auto py-6 space-y-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="configure">Configure</TabsTrigger>
            <TabsTrigger value="results" disabled={!analysisId}>Results</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          
          <TabsContent value="configure" className="mt-6">
            <AnalysisConfig 
              analysisTypes={analysisTypes}
              onStartAnalysis={handleStartAnalysis}
              isLoading={isLoading}
            />
          </TabsContent>
          
          <TabsContent value="results" className="mt-6">
            {analysisId && <AnalysisResults analysisId={analysisId} onNewAnalysis={handleNewAnalysis} />}
          </TabsContent>
          
          <TabsContent value="history" className="mt-6">
            <AnalysisHistory onViewAnalysis={handleViewAnalysis} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

export default App;

