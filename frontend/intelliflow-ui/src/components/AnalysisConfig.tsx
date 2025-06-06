import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Wizard, WizardContent, WizardNavigation } from "./ui/wizard";
import { AnalysisType } from '../lib/api';
import { LineChart, BarChart2, PieChart, ChevronRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "./ui/badge";

export interface AnalysisConfigProps {
  analysisTypes: AnalysisType[];
  onStartAnalysis: (config: any) => void;
  isLoading: boolean;
}

export function AnalysisConfig({ 
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
  
  return (
    <div className="space-y-6">
      <div>
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
      </div>
      
      <div>
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
      </div>
      
      {error && (
        <div>
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}
      
      <WizardContent>
        {currentStep === 0 && (
          <div className="space-y-6">
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
          </div>
        )}
        
        {currentStep === 1 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-full bg-primary/10">
                    <LineChart className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle>Data Source</CardTitle>
                </div>
                <CardDescription>
                  Configure the data source for your analysis.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="data-source-select">Data Source Type</Label>
                  <Select 
                    value={dataSource} 
                    onValueChange={setDataSource}
                  >
                    <SelectTrigger id="data-source-select" className="h-11">
                      <SelectValue placeholder="Select data source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bigquery">Google BigQuery</SelectItem>
                      <SelectItem value="file_upload">File Upload</SelectItem>
                      <SelectItem value="cloud_storage">Cloud Storage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {dataSource === "bigquery" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="project-id">Project ID</Label>
                      <input
                        id="project-id"
                        className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                        placeholder="Enter your BigQuery project ID"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="dataset-id">Dataset ID</Label>
                      <input
                        id="dataset-id"
                        className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={datasetId}
                        onChange={(e) => setDatasetId(e.target.value)}
                        placeholder="Enter your BigQuery dataset ID"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="table-id">Table ID</Label>
                      <input
                        id="table-id"
                        className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={tableId}
                        onChange={(e) => setTableId(e.target.value)}
                        placeholder="Enter your BigQuery table ID"
                      />
                    </div>
                  </div>
                )}
                
                {dataSource === "file_upload" && (
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="rounded-full bg-primary/10 p-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                          </svg>
                        </div>
                        <div className="text-sm font-medium">
                          Drag and drop your file here, or click to browse
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Supports CSV, Excel, and JSON files (max 10MB)
                        </div>
                        <Badge variant="outline" className="mt-2">
                          Max 5 files
                        </Badge>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept=".csv,.xlsx,.json"
                        multiple
                      />
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                      <Badge variant="outline" className="mr-2">
                        File Limitations
                      </Badge>
                      Maximum file size: 10MB, Maximum files: 5
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Other steps omitted for brevity */}
        
      </WizardContent>
      
      <WizardNavigation>
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0}
          >
            Previous
          </Button>
          
          {currentStep < wizardSteps.length - 1 ? (
            <Button
              onClick={handleNext}
              disabled={isNextDisabled}
            >
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Start Analysis
                  <ChevronRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </WizardNavigation>
    </div>
  );
}

