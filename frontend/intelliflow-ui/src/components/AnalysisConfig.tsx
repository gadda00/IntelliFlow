import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Checkbox } from "./ui/checkbox";
import { Slider } from "./ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Wizard, WizardContent, WizardNavigation } from "./ui/wizard";
import { AnalysisType, DataSource } from '../lib/api';
import { motion } from "framer-motion";
import { Database, LineChart, BarChart2, PieChart, Settings, FileText, ChevronRight, Loader2 } from "lucide-react";

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
  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [isNextDisabled, setIsNextDisabled] = useState(false);
  
  // Form state
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
  
  // Wizard steps
  const wizardSteps = [
    { id: "analysis-type", title: "Analysis Type", description: "Select the type of analysis" },
    { id: "data-source", title: "Data Source", description: "Configure your data source" },
    { id: "objectives", title: "Objectives", description: "Define analysis objectives" },
    { id: "advanced", title: "Advanced", description: "Configure advanced options" },
    { id: "review", title: "Review", description: "Review and start analysis" }
  ];
  
  // Update objectives when analysis type changes
  useEffect(() => {
    const selectedType = analysisTypes.find(type => type.id === analysisType);
    if (selectedType && selectedType.default_objectives) {
      setObjectives(selectedType.default_objectives);
    }
  }, [analysisType, analysisTypes]);
  
  // Validate current step
  useEffect(() => {
    validateCurrentStep();
  }, [currentStep, analysisType, dataSource, projectId, datasetId, tableId, objectives]);
  
  const validateCurrentStep = () => {
    switch (currentStep) {
      case 0: // Analysis Type
        setIsNextDisabled(!analysisType);
        break;
      case 1: // Data Source
        if (dataSource === "bigquery") {
          setIsNextDisabled(!projectId || !datasetId || !tableId);
        } else {
          setIsNextDisabled(false);
        }
        break;
      case 2: // Objectives
        setIsNextDisabled(objectives.length === 0);
        break;
      case 3: // Advanced Options
        setIsNextDisabled(false);
        break;
      case 4: // Review
        setIsNextDisabled(false);
        break;
      default:
        setIsNextDisabled(false);
    }
  };
  
  const handleObjectiveChange = (objective: string) => {
    setObjectives(
      objectives.includes(objective)
        ? objectives.filter(o => o !== objective)
        : [...objectives, objective]
    );
  };
  
  const handleNext = () => {
    if (currentStep < wizardSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };
  
  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
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
  
  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };
  
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15
      }
    }
  };
  
  return (
    <motion.div 
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <motion.div variants={itemVariants}>
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-3xl font-bold tracking-tight">
              Configure Your Analysis
            </CardTitle>
            <CardDescription className="text-base">
              Set up your data analysis parameters to get meaningful insights.
            </CardDescription>
          </CardHeader>
        </Card>
      </motion.div>
      
      <motion.div variants={itemVariants}>
        <Wizard 
          steps={wizardSteps} 
          currentStep={currentStep} 
          onStepClick={(index) => {
            // Only allow clicking on completed steps or current step
            if (index <= currentStep) {
              setCurrentStep(index);
            }
          }}
        />
      </motion.div>
      
      {error && (
        <motion.div variants={itemVariants}>
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </motion.div>
      )}
      
      <WizardContent>
        {currentStep === 0 && (
          <motion.div 
            className="space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-full bg-primary/10">
                    <LineChart className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle>Analysis Type</CardTitle>
                </div>
                <CardDescription>
                  Select the type of analysis you want to perform on your data.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card 
                    className={`cursor-pointer transition-all hover:border-primary ${analysisType === 'customer_feedback' ? 'border-primary bg-primary/5' : ''}`}
                    onClick={() => setAnalysisType('customer_feedback')}
                  >
                    <CardHeader className="pb-2">
                      <div className="rounded-full w-10 h-10 flex items-center justify-center bg-blue-500/10 mb-2">
                        <PieChart className="h-5 w-5 text-blue-500" />
                      </div>
                      <CardTitle className="text-base">Customer Feedback</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground">
                        Analyze customer comments and feedback to identify sentiment and key themes.
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card 
                    className={`cursor-pointer transition-all hover:border-primary ${analysisType === 'sales_trends' ? 'border-primary bg-primary/5' : ''}`}
                    onClick={() => setAnalysisType('sales_trends')}
                  >
                    <CardHeader className="pb-2">
                      <div className="rounded-full w-10 h-10 flex items-center justify-center bg-green-500/10 mb-2">
                        <LineChart className="h-5 w-5 text-green-500" />
                      </div>
                      <CardTitle className="text-base">Sales Trends</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground">
                        Identify patterns and trends in sales data across different time periods.
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card 
                    className={`cursor-pointer transition-all hover:border-primary ${analysisType === 'product_performance' ? 'border-primary bg-primary/5' : ''}`}
                    onClick={() => setAnalysisType('product_performance')}
                  >
                    <CardHeader className="pb-2">
                      <div className="rounded-full w-10 h-10 flex items-center justify-center bg-purple-500/10 mb-2">
                        <BarChart2 className="h-5 w-5 text-purple-500" />
                      </div>
                      <CardTitle className="text-base">Product Performance</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground">
                        Evaluate product metrics and performance indicators to identify strengths and weaknesses.
                      </p>
                    </CardContent>
                  </Card>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="analysis-type-select">Other Analysis Types</Label>
                  <Select 
                    value={analysisType} 
                    onValueChange={setAnalysisType}
                  >
                    <SelectTrigger id="analysis-type-select" className="h-11">
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
              </CardContent>
            </Card>
          </motion.div>
        )}
        
        {currentStep === 1 && (
          <motion.div 
            className="space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Database className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle>Data Source</CardTitle>
                </div>
                <CardDescription>
                  Configure the data source for your analysis.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card 
                    className={`cursor-pointer transition-all hover:border-primary ${dataSource === 'bigquery' ? 'border-primary bg-primary/5' : ''}`}
                    onClick={() => setDataSource('bigquery')}
                  >
                    <CardHeader className="pb-2 text-center">
                      <div className="mx-auto rounded-full w-10 h-10 flex items-center justify-center bg-blue-500/10 mb-2">
                        <Database className="h-5 w-5 text-blue-500" />
                      </div>
                      <CardTitle className="text-base">BigQuery</CardTitle>
                    </CardHeader>
                  </Card>
                  
                  <Card 
                    className={`cursor-pointer transition-all hover:border-primary ${dataSource === 'cloud_storage' ? 'border-primary bg-primary/5' : ''}`}
                    onClick={() => setDataSource('cloud_storage')}
                  >
                    <CardHeader className="pb-2 text-center">
                      <div className="mx-auto rounded-full w-10 h-10 flex items-center justify-center bg-green-500/10 mb-2">
                        <FileText className="h-5 w-5 text-green-500" />
                      </div>
                      <CardTitle className="text-base">Cloud Storage</CardTitle>
                    </CardHeader>
                  </Card>
                  
                  <Card 
                    className={`cursor-pointer transition-all hover:border-primary ${dataSource === 'api' ? 'border-primary bg-primary/5' : ''}`}
                    onClick={() => setDataSource('api')}
                  >
                    <CardHeader className="pb-2 text-center">
                      <div className="mx-auto rounded-full w-10 h-10 flex items-center justify-center bg-purple-500/10 mb-2">
                        <Settings className="h-5 w-5 text-purple-500" />
                      </div>
                      <CardTitle className="text-base">External API</CardTitle>
                    </CardHeader>
                  </Card>
                  
                  <Card 
                    className={`cursor-pointer transition-all hover:border-primary ${dataSource === 'upload' ? 'border-primary bg-primary/5' : ''}`}
                    onClick={() => setDataSource('upload')}
                  >
                    <CardHeader className="pb-2 text-center">
                      <div className="mx-auto rounded-full w-10 h-10 flex items-center justify-center bg-orange-500/10 mb-2">
                        <FileText className="h-5 w-5 text-orange-500" />
                      </div>
                      <CardTitle className="text-base">Upload File</CardTitle>
                    </CardHeader>
                  </Card>
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
              </CardContent>
            </Card>
          </motion.div>
        )}
        
        {currentStep === 2 && (
          <motion.div 
            className="space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Settings className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle>Analysis Objectives</CardTitle>
                </div>
                <CardDescription>
                  Define what you want to learn from your data.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Card 
                    className={`cursor-pointer transition-all hover:border-primary ${objectives.includes('analyze_text') ? 'border-primary bg-primary/5' : ''}`}
                    onClick={() => handleObjectiveChange('analyze_text')}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="analyze_text" 
                          checked={objectives.includes("analyze_text")}
                          onCheckedChange={() => handleObjectiveChange("analyze_text")}
                          className="h-5 w-5"
                        />
                        <Label htmlFor="analyze_text" className="cursor-pointer font-medium">Analyze Text</Label>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground">
                        Extract meaning, sentiment, and topics from text data.
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card 
                    className={`cursor-pointer transition-all hover:border-primary ${objectives.includes('discover_patterns') ? 'border-primary bg-primary/5' : ''}`}
                    onClick={() => handleObjectiveChange('discover_patterns')}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="discover_patterns" 
                          checked={objectives.includes("discover_patterns")}
                          onCheckedChange={() => handleObjectiveChange("discover_patterns")}
                          className="h-5 w-5"
                        />
                        <Label htmlFor="discover_patterns" className="cursor-pointer font-medium">Discover Patterns</Label>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground">
                        Identify recurring patterns and correlations in your data.
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card 
                    className={`cursor-pointer transition-all hover:border-primary ${objectives.includes('detect_anomalies') ? 'border-primary bg-primary/5' : ''}`}
                    onClick={() => handleObjectiveChange('detect_anomalies')}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="detect_anomalies" 
                          checked={objectives.includes("detect_anomalies")}
                          onCheckedChange={() => handleObjectiveChange("detect_anomalies")}
                          className="h-5 w-5"
                        />
                        <Label htmlFor="detect_anomalies" className="cursor-pointer font-medium">Detect Anomalies</Label>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground">
                        Find unusual data points or outliers that deviate from normal patterns.
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card 
                    className={`cursor-pointer transition-all hover:border-primary ${objectives.includes('predict') ? 'border-primary bg-primary/5' : ''}`}
                    onClick={() => handleObjectiveChange('predict')}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="predict" 
                          checked={objectives.includes("predict")}
                          onCheckedChange={() => handleObjectiveChange("predict")}
                          className="h-5 w-5"
                        />
                        <Label htmlFor="predict" className="cursor-pointer font-medium">Predict Trends</Label>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground">
                        Forecast future trends based on historical data patterns.
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card 
                    className={`cursor-pointer transition-all hover:border-primary ${objectives.includes('classify') ? 'border-primary bg-primary/5' : ''}`}
                    onClick={() => handleObjectiveChange('classify')}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="classify" 
                          checked={objectives.includes("classify")}
                          onCheckedChange={() => handleObjectiveChange("classify")}
                          className="h-5 w-5"
                        />
                        <Label htmlFor="classify" className="cursor-pointer font-medium">Classify Data</Label>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground">
                        Categorize data into predefined groups or segments.
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card 
                    className={`cursor-pointer transition-all hover:border-primary ${objectives.includes('summarize') ? 'border-primary bg-primary/5' : ''}`}
                    onClick={() => handleObjectiveChange('summarize')}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="summarize" 
                          checked={objectives.includes("summarize")}
                          onCheckedChange={() => handleObjectiveChange("summarize")}
                          className="h-5 w-5"
                        />
                        <Label htmlFor="summarize" className="cursor-pointer font-medium">Summarize Data</Label>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground">
                        Create concise summaries of large datasets or text content.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
        
        {currentStep === 3 && (
          <motion.div 
            className="space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Settings className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle>Advanced Options</CardTitle>
                </div>
                <CardDescription>
                  Configure additional analysis parameters.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </div>
                
                <div className="space-y-2">
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
                
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="include-recommendations" 
                      checked={includeRecommendations}
                      onCheckedChange={(checked) => setIncludeRecommendations(checked as boolean)}
                      className="h-5 w-5"
                    />
                    <Label htmlFor="include-recommendations">Include Recommendations</Label>
                  </div>
                  <p className="text-xs text-muted-foreground pl-7">
                    Generate actionable recommendations based on the analysis results.
                  </p>
                  
                  <div className="flex items-center space-x-2 mt-4">
                    <Checkbox 
                      id="use-data-studio" 
                      checked={useDataStudio}
                      onCheckedChange={(checked) => setUseDataStudio(checked as boolean)}
                      className="h-5 w-5"
                    />
                    <Label htmlFor="use-data-studio">Use Data Studio for Enhanced Visualizations</Label>
                  </div>
                  <p className="text-xs text-muted-foreground pl-7">
                    Create interactive dashboards with Google Data Studio integration.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
        
        {currentStep === 4 && (
          <motion.div 
            className="space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-full bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle>Review Configuration</CardTitle>
                </div>
                <CardDescription>
                  Review your analysis configuration before starting.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Analysis Type</h3>
                      <p className="text-base font-medium">
                        {analysisType === 'customer_feedback' ? 'Customer Feedback Analysis' : 
                         analysisType === 'sales_trends' ? 'Sales Trends Analysis' : 
                         analysisType === 'product_performance' ? 'Product Performance Analysis' : 
                         analysisType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Data Source</h3>
                      <p className="text-base font-medium">
                        {dataSource === 'bigquery' ? 'BigQuery' : 
                         dataSource === 'cloud_storage' ? 'Cloud Storage' : 
                         dataSource === 'api' ? 'External API' : 
                         dataSource === 'upload' ? 'File Upload' : 
                         dataSource.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                      {dataSource === 'bigquery' && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {projectId}.{datasetId}.{tableId}
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Time Period</h3>
                      <p className="text-base font-medium">
                        {timePeriod === 'last_7_days' ? 'Last 7 Days' : 
                         timePeriod === 'last_30_days' ? 'Last 30 Days' : 
                         timePeriod === 'last_90_days' ? 'Last 90 Days' : 
                         timePeriod === 'last_year' ? 'Last Year' : 
                         timePeriod === 'all_time' ? 'All Time' : 
                         timePeriod.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Analysis Objectives</h3>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {objectives.map(objective => (
                          <Badge key={objective} variant="outline">
                            {objective === 'analyze_text' ? 'Analyze Text' : 
                             objective === 'discover_patterns' ? 'Discover Patterns' : 
                             objective === 'detect_anomalies' ? 'Detect Anomalies' : 
                             objective === 'predict' ? 'Predict Trends' : 
                             objective === 'classify' ? 'Classify Data' : 
                             objective === 'summarize' ? 'Summarize Data' : 
                             objective.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Advanced Options</h3>
                      <div className="space-y-1 mt-1">
                        <p className="text-sm">
                          <span className="font-medium">Insight Threshold:</span> {insightThreshold.toFixed(1)}
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">Include Recommendations:</span> {includeRecommendations ? 'Yes' : 'No'}
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">Visualization Theme:</span> {visualizationTheme.replace(/\b\w/g, l => l.toUpperCase())}
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">Use Data Studio:</span> {useDataStudio ? 'Yes' : 'No'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-center pt-2">
                <Button 
                  size="lg" 
                  className="w-full md:w-auto"
                  onClick={handleSubmit}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting Analysis...
                    </>
                  ) : (
                    <>
                      Start Analysis
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        )}
        
        <WizardNavigation 
          currentStep={currentStep}
          totalSteps={wizardSteps.length}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onComplete={handleSubmit}
          isNextDisabled={isNextDisabled}
          isPreviousDisabled={false}
          completeLabel={isLoading ? "Starting..." : "Start Analysis"}
        />
      </WizardContent>
    </motion.div>
  );
}

