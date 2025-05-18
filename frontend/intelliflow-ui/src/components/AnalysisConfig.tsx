import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Checkbox } from "./ui/checkbox";
import { Slider } from "./ui/slider";
import { AnalysisType, DataSource } from '../lib/api';
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

interface AnalysisConfigProps {
  dataSources: DataSource[];
  analysisTypes: AnalysisType[];
  onStartAnalysis: (config: any) => void;
  isLoading: boolean;
}

export function AnalysisConfig({ 
  dataSources = [], 
  analysisTypes = [], 
  onStartAnalysis, 
  isLoading 
}: AnalysisConfigProps) {
  const [analysisType, setAnalysisType] = useState("customer_feedback");
  const [dataSource, setDataSource] = useState("bigquery");
  const [objectives, setObjectives] = useState<string[]>(["analyze_text", "discover_patterns", "detect_anomalies"]);
  const [projectId, setProjectId] = useState("intelliflow-project");
  const [datasetId, setDatasetId] = useState("customer_data");
  const [tableId, setTableId] = useState("feedback");
  const [timePeriod, setTimePeriod] = useState("last_30_days");
  const [visualizationTheme, setVisualizationTheme] = useState("light");
  const [insightThreshold, setInsightThreshold] = useState(0.7);
  const [includeRecommendations, setIncludeRecommendations] = useState(true);
  const [useDataStudio, setUseDataStudio] = useState(false);
  const [error, setError] = useState("");
  
  // Update objectives when analysis type changes
  useEffect(() => {
    const selectedType = analysisTypes.find(type => type.id === analysisType);
    if (selectedType && selectedType.default_objectives) {
      setObjectives(selectedType.default_objectives);
    }
  }, [analysisType, analysisTypes]);
  
  const handleObjectiveChange = (objective: string) => {
    setObjectives(
      objectives.includes(objective)
        ? objectives.filter(o => o !== objective)
        : [...objectives, objective]
    );
  };
  
  const handleSubmit = () => {
    // Validate form
    if (!dataSource) {
      setError("Please select a data source");
      return;
    }
    
    if (dataSource === "bigquery" && (!projectId || !datasetId || !tableId)) {
      setError("Please fill in all BigQuery details");
      return;
    }
    
    if (objectives.length === 0) {
      setError("Please select at least one analysis objective");
      return;
    }
    
    // Clear any previous errors
    setError("");
    
    // Prepare analysis configuration
    const analysisConfig = {
      type: analysisType,
      data_source: {
        source_type: dataSource,
        ...(dataSource === "bigquery" && {
          project_id: projectId,
          dataset_id: datasetId,
          table_id: tableId
        })
      },
      objectives: objectives,
      parameters: {
        time_period: timePeriod,
        include_recommendations: includeRecommendations,
        insight_threshold: insightThreshold,
        visualization_config: {
          theme: visualizationTheme,
          use_data_studio: useDataStudio
        }
      }
    };
    
    // Start analysis
    onStartAnalysis(analysisConfig);
  };
  
  return (
    <div className="animate-fade-in">
      <Card className="card-hover-effect">
        <CardHeader>
          <CardTitle className="gradient-text text-2xl">Analysis Configuration</CardTitle>
          <CardDescription>
            Configure your data analysis parameters and objectives.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="analysis-type" className="text-base">Analysis Type</Label>
            <Select 
              value={analysisType} 
              onValueChange={setAnalysisType}
            >
              <SelectTrigger id="analysis-type" className="h-11">
                <SelectValue placeholder="Select analysis type" />
              </SelectTrigger>
              <SelectContent>
                {analysisTypes.length > 0 ? (
                  analysisTypes.map(type => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))
                ) : (
                  <>
                    <SelectItem value="customer_feedback">Customer Feedback Analysis</SelectItem>
                    <SelectItem value="sales_trends">Sales Trends Analysis</SelectItem>
                    <SelectItem value="product_performance">Product Performance Analysis</SelectItem>
                    <SelectItem value="custom">Custom Analysis</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-1">
              {analysisTypes.find(type => type.id === analysisType)?.description || 
               "Analyze data to extract insights and patterns."}
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="data-source" className="text-base">Data Source</Label>
            <Select 
              value={dataSource} 
              onValueChange={setDataSource}
            >
              <SelectTrigger id="data-source" className="h-11">
                <SelectValue placeholder="Select data source" />
              </SelectTrigger>
              <SelectContent>
                {dataSources.length > 0 ? (
                  dataSources.map(source => (
                    <SelectItem key={source.id} value={source.id}>
                      {source.name}
                    </SelectItem>
                  ))
                ) : (
                  <>
                    <SelectItem value="bigquery">BigQuery</SelectItem>
                    <SelectItem value="cloud_storage">Cloud Storage</SelectItem>
                    <SelectItem value="api">External API</SelectItem>
                    <SelectItem value="upload">Upload File</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
          
          {dataSource === "bigquery" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border animate-slide-in">
              <div className="space-y-2">
                <Label htmlFor="project-id">Project ID</Label>
                <Input 
                  id="project-id" 
                  placeholder="intelliflow-project" 
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataset-id">Dataset ID</Label>
                <Input 
                  id="dataset-id" 
                  placeholder="customer_data" 
                  value={datasetId}
                  onChange={(e) => setDatasetId(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="table-id">Table ID</Label>
                <Input 
                  id="table-id" 
                  placeholder="feedback" 
                  value={tableId}
                  onChange={(e) => setTableId(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>
          )}
          
          {dataSource === "cloud_storage" && (
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg border animate-slide-in">
              <div className="space-y-2">
                <Label htmlFor="bucket-name">Bucket Name</Label>
                <Input id="bucket-name" placeholder="intelliflow-data" className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="object-prefix">Object Prefix (Optional)</Label>
                <Input id="object-prefix" placeholder="customer_exports/" className="h-11" />
              </div>
            </div>
          )}
          
          {dataSource === "api" && (
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg border animate-slide-in">
              <div className="space-y-2">
                <Label htmlFor="api-url">API URL</Label>
                <Input id="api-url" placeholder="https://api.example.com/data" className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api-method">Method</Label>
                <Select defaultValue="GET">
                  <SelectTrigger id="api-method" className="h-11">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          
          {dataSource === "upload" && (
            <div className="space-y-2 p-4 bg-muted/30 rounded-lg border animate-slide-in">
              <Label htmlFor="file-upload">Upload File</Label>
              <Input id="file-upload" type="file" className="h-11" />
              <p className="text-sm text-muted-foreground mt-1">
                Supported formats: CSV, JSON, Excel
              </p>
            </div>
          )}
          
          <div className="space-y-3">
            <Label className="text-base">Analysis Objectives</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-muted/30 rounded-lg border">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="analyze_text" 
                  checked={objectives.includes("analyze_text")}
                  onCheckedChange={() => handleObjectiveChange("analyze_text")}
                  className="h-5 w-5"
                />
                <Label htmlFor="analyze_text" className="cursor-pointer">Analyze Text</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="discover_patterns" 
                  checked={objectives.includes("discover_patterns")}
                  onCheckedChange={() => handleObjectiveChange("discover_patterns")}
                  className="h-5 w-5"
                />
                <Label htmlFor="discover_patterns" className="cursor-pointer">Discover Patterns</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="detect_anomalies" 
                  checked={objectives.includes("detect_anomalies")}
                  onCheckedChange={() => handleObjectiveChange("detect_anomalies")}
                  className="h-5 w-5"
                />
                <Label htmlFor="detect_anomalies" className="cursor-pointer">Detect Anomalies</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="predict" 
                  checked={objectives.includes("predict")}
                  onCheckedChange={() => handleObjectiveChange("predict")}
                  className="h-5 w-5"
                />
                <Label htmlFor="predict" className="cursor-pointer">Predict Trends</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="classify" 
                  checked={objectives.includes("classify")}
                  onCheckedChange={() => handleObjectiveChange("classify")}
                  className="h-5 w-5"
                />
                <Label htmlFor="classify" className="cursor-pointer">Classify Data</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="summarize" 
                  checked={objectives.includes("summarize")}
                  onCheckedChange={() => handleObjectiveChange("summarize")}
                  className="h-5 w-5"
                />
                <Label htmlFor="summarize" className="cursor-pointer">Summarize Data</Label>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <Label className="text-base">Advanced Options</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border">
              <div className="space-y-2">
                <Label htmlFor="time-period">Time Period</Label>
                <Select 
                  value={timePeriod}
                  onValueChange={setTimePeriod}
                >
                  <SelectTrigger id="time-period" className="h-11">
                    <SelectValue placeholder="Select time period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                    <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                    <SelectItem value="last_90_days">Last 90 Days</SelectItem>
                    <SelectItem value="last_year">Last Year</SelectItem>
                    <SelectItem value="all_time">All Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="visualization-theme">Visualization Theme</Label>
                <Select 
                  value={visualizationTheme}
                  onValueChange={setVisualizationTheme}
                >
                  <SelectTrigger id="visualization-theme" className="h-11">
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="colorblind_friendly">Colorblind Friendly</SelectItem>
                    <SelectItem value="monochrome">Monochrome</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2 md:col-span-2">
                <div className="flex justify-between">
                  <Label htmlFor="insight-threshold">Insight Threshold</Label>
                  <span className="text-sm text-muted-foreground">{insightThreshold.toFixed(1)}</span>
                </div>
                <Slider
                  value={[insightThreshold]}
                  min={0.1}
                  max={1}
                  step={0.1}
                  onValueChange={(value) => setInsightThreshold(value[0])}
                  id="insight-threshold"
                />
                <p className="text-xs text-muted-foreground">
                  Higher values produce fewer but more significant insights.
                </p>
              </div>
              
              <div className="space-y-3 md:col-span-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="include-recommendations" 
                    checked={includeRecommendations}
                    onCheckedChange={(checked) => setIncludeRecommendations(checked as boolean)}
                    className="h-5 w-5"
                  />
                  <Label htmlFor="include-recommendations">Include Recommendations</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="use-data-studio" 
                    checked={useDataStudio}
                    onCheckedChange={(checked) => setUseDataStudio(checked as boolean)}
                    className="h-5 w-5"
                  />
                  <Label htmlFor="use-data-studio">Use Data Studio for Enhanced Visualizations</Label>
                </div>
              </div>
            </div>
          </div>
          
          <Button 
            className="w-full h-12 text-base font-medium mt-4" 
            size="lg"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
                Starting Analysis...
              </>
            ) : (
              'Start Analysis'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
