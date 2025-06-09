import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Wizard, WizardContent, WizardNavigation } from "./ui/wizard";
import { FileUpload } from "./ui/file-upload";
import { AnalysisType } from '../lib/api';
import { ChevronRight, Loader2, Link as LinkIcon, Globe, Database, FileText, CheckCircle, AlertCircle, X } from "lucide-react";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";

export interface AnalysisConfigProps {
  analysisTypes: AnalysisType[];
  onStartAnalysis: (config: any) => void;
  isLoading: boolean;
}

interface URLValidation {
  url: string;
  isValid: boolean;
  type: 'csv' | 'json' | 'api' | 'sheets' | 'unknown';
  status: 'checking' | 'valid' | 'invalid';
  error?: string;
  metadata?: {
    size?: number;
    contentType?: string;
    lastModified?: string;
  };
}

export function AnalysisConfig({ 
  onStartAnalysis, 
  isLoading 
}: AnalysisConfigProps) {
  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [isNextDisabled, setIsNextDisabled] = useState(false);
  
  // Form state - simplified for intelligent auto-analysis
  const [dataSource, setDataSource] = useState("bigquery");
  const [projectId, setProjectId] = useState("intelliflow-project");
  const [datasetId, setDatasetId] = useState("customer_data");
  const [tableId, setTableId] = useState("feedback");
  const [timePeriod] = useState("last_30_days");
  const [visualizationTheme] = useState("light");
  const [insightThreshold] = useState(0.7);
  const [includeRecommendations] = useState(true);
  const [useDataStudio] = useState(false);
  const [error, setError] = useState("");
  
  // File upload state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  
  // Enhanced URL state
  const [dataUrl, setDataUrl] = useState("");
  const [urlList, setUrlList] = useState<URLValidation[]>([]);
  const [isValidatingUrl, setIsValidatingUrl] = useState(false);
  
  // Google Sheets state
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [sheetsRange, setSheetsRange] = useState("A1:Z1000");
  
  // Database connection state
  const [dbConnectionString, setDbConnectionString] = useState("");
  const [dbQuery, setDbQuery] = useState("");
  
  // Wizard steps - simplified to only data source and review
  const wizardSteps = [
    { id: "data-source", title: "Data Source", description: "Upload your data" },
    { id: "review", title: "Review", description: "Review and start analysis" }
  ];
  
  // Validate current step
  useEffect(() => {
    validateCurrentStep();
  }, [currentStep, dataSource, projectId, datasetId, tableId, selectedFiles, urlList, sheetsUrl, dbConnectionString]);
  
  const validateCurrentStep = () => {
    switch (currentStep) {
      case 0: // Data Source
        if (dataSource === "bigquery") {
          setIsNextDisabled(!projectId || !datasetId || !tableId);
        } else if (dataSource === "file_upload") {
          setIsNextDisabled(selectedFiles.length === 0);
        } else if (dataSource === "url") {
          setIsNextDisabled(urlList.filter(u => u.isValid).length === 0);
        } else if (dataSource === "google_sheets") {
          setIsNextDisabled(!sheetsUrl);
        } else if (dataSource === "database") {
          setIsNextDisabled(!dbConnectionString || !dbQuery);
        } else {
          setIsNextDisabled(false);
        }
        break;
      case 1: // Review
        setIsNextDisabled(false);
        break;
      default:
        setIsNextDisabled(false);
    }
  };
  
  const validateUrl = async (url: string): Promise<URLValidation> => {
    const validation: URLValidation = {
      url,
      isValid: false,
      type: 'unknown',
      status: 'checking'
    };
    
    try {
      // Basic URL validation
      const urlObj = new URL(url);
      
      // Determine URL type based on extension or domain
      if (url.includes('docs.google.com/spreadsheets')) {
        validation.type = 'sheets';
      } else if (url.endsWith('.csv')) {
        validation.type = 'csv';
      } else if (url.endsWith('.json')) {
        validation.type = 'json';
      } else if (url.includes('/api/') || url.includes('api.')) {
        validation.type = 'api';
      }
      
      // For demo purposes, simulate validation
      // In a real implementation, you would make a HEAD request to check the URL
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate validation results
      const isValidDomain = ['github.com', 'raw.githubusercontent.com', 'docs.google.com', 'drive.google.com'].some(domain => 
        urlObj.hostname.includes(domain)
      );
      
      if (isValidDomain || urlObj.protocol === 'https:') {
        validation.isValid = true;
        validation.status = 'valid';
        validation.metadata = {
          contentType: validation.type === 'csv' ? 'text/csv' : 'application/json',
          size: Math.floor(Math.random() * 1000000) + 10000, // Random size for demo
          lastModified: new Date().toISOString()
        };
      } else {
        validation.status = 'invalid';
        validation.error = 'URL appears to be invalid or inaccessible';
      }
      
    } catch (error) {
      validation.status = 'invalid';
      validation.error = 'Invalid URL format';
    }
    
    return validation;
  };
  
  const handleAddUrl = async () => {
    if (!dataUrl || urlList.some(u => u.url === dataUrl)) {
      return;
    }
    
    setIsValidatingUrl(true);
    
    // Add URL with checking status
    const newValidation: URLValidation = {
      url: dataUrl,
      isValid: false,
      type: 'unknown',
      status: 'checking'
    };
    
    setUrlList(prev => [...prev, newValidation]);
    setDataUrl("");
    
    // Validate the URL
    try {
      const validation = await validateUrl(newValidation.url);
      setUrlList(prev => prev.map(u => u.url === validation.url ? validation : u));
    } catch (error) {
      setUrlList(prev => prev.map(u => 
        u.url === newValidation.url 
          ? { ...u, status: 'invalid', error: 'Validation failed' }
          : u
      ));
    }
    
    setIsValidatingUrl(false);
  };
  
  const handleRemoveUrl = (url: string) => {
    setUrlList(prev => prev.filter(u => u.url !== url));
  };
  
  const getUrlTypeIcon = (type: string) => {
    switch (type) {
      case 'csv':
        return <Database className="h-4 w-4 text-green-500" />;
      case 'json':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'api':
        return <Globe className="h-4 w-4 text-purple-500" />;
      case 'sheets':
        return <FileText className="h-4 w-4 text-amber-500" />;
      default:
        return <LinkIcon className="h-4 w-4 text-gray-500" />;
    }
  };
  
  const getUrlStatusIcon = (status: string) => {
    switch (status) {
      case 'valid':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'invalid':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'checking':
        return <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      default:
        return null;
    }
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
  
  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(files);
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
    
    if (dataSource === "file_upload" && selectedFiles.length === 0) {
      setError("Please upload at least one file");
      return;
    }
    
    if (dataSource === "url" && urlList.filter(u => u.isValid).length === 0) {
      setError("Please add at least one valid URL");
      return;
    }
    
    if (dataSource === "google_sheets" && !sheetsUrl) {
      setError("Please provide a Google Sheets URL");
      return;
    }
    
    if (dataSource === "database" && (!dbConnectionString || !dbQuery)) {
      setError("Please provide database connection details and query");
      return;
    }
    
    // Clear any previous errors
    setError("");
    
    // Prepare analysis configuration with intelligent defaults
    const analysisConfig = {
      type: "intelligent_analysis", // Let the system determine the best analysis type
      data_source: {
        source_type: dataSource,
        ...(dataSource === "bigquery" && {
          project_id: projectId,
          dataset_id: datasetId,
          table_id: tableId
        }),
        ...(dataSource === "file_upload" && {
          files: selectedFiles.map(file => ({
            name: file.name,
            size: file.size,
            type: file.type
          }))
        }),
        ...(dataSource === "url" && {
          urls: urlList.filter(u => u.isValid).map(u => ({
            url: u.url,
            type: u.type,
            metadata: u.metadata
          }))
        }),
        ...(dataSource === "google_sheets" && {
          sheets_url: sheetsUrl,
          range: sheetsRange
        }),
        ...(dataSource === "database" && {
          connection_string: dbConnectionString,
          query: dbQuery
        })
      },
      objectives: ["auto_detect"], // Let the system determine objectives based on data
      parameters: {
        time_period: timePeriod,
        include_recommendations: includeRecommendations,
        insight_threshold: insightThreshold,
        visualization_config: {
          theme: visualizationTheme,
          use_data_studio: useDataStudio
        },
        auto_analysis: true // Enable intelligent analysis mode
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
                    <Database className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle>Data Source</CardTitle>
                </div>
                <CardDescription>
                  Upload your data and let IntelliFlow intelligently analyze it for you.
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
                      <SelectItem value="url">URL/Web Data</SelectItem>
                      <SelectItem value="google_sheets">Google Sheets</SelectItem>
                      <SelectItem value="database">Database Connection</SelectItem>
                      <SelectItem value="cloud_storage">Cloud Storage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {dataSource === "bigquery" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="project-id">Project ID</Label>
                      <Input
                        id="project-id"
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                        placeholder="Enter your BigQuery project ID"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="dataset-id">Dataset ID</Label>
                      <Input
                        id="dataset-id"
                        value={datasetId}
                        onChange={(e) => setDatasetId(e.target.value)}
                        placeholder="Enter your BigQuery dataset ID"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="table-id">Table ID</Label>
                      <Input
                        id="table-id"
                        value={tableId}
                        onChange={(e) => setTableId(e.target.value)}
                        placeholder="Enter your BigQuery table ID"
                      />
                    </div>
                  </div>
                )}
                
                {dataSource === "file_upload" && (
                  <div className="space-y-4">
                    <FileUpload
                      onFilesSelected={handleFilesSelected}
                      maxFiles={10}
                      maxSizeInMB={50}
                      acceptedFileTypes={[".csv", ".xlsx", ".xls", ".json", ".txt", ".tsv", ".parquet"]}
                      label="Upload Data Files"
                      description="Drag and drop your data files here, or click to browse. IntelliFlow will automatically determine the best analysis approach for your data."
                      analysisType="intelligent_analysis"
                    />
                  </div>
                )}
                
                {dataSource === "url" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="data-url">Data URL</Label>
                      <div className="flex space-x-2">
                        <Input
                          id="data-url"
                          value={dataUrl}
                          onChange={(e) => setDataUrl(e.target.value)}
                          placeholder="https://example.com/data.csv or API endpoint"
                          className="flex-1"
                        />
                        <Button 
                          onClick={handleAddUrl} 
                          type="button"
                          disabled={!dataUrl || isValidatingUrl}
                        >
                          {isValidatingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Supports CSV files, JSON APIs, Google Sheets (public), and other web-accessible data sources.
                      </p>
                    </div>
                    
                    {urlList.length > 0 && (
                      <div className="space-y-2">
                        <Label>Added URLs ({urlList.filter(u => u.isValid).length} valid)</Label>
                        <div className="space-y-2">
                          {urlList.map((urlValidation, index) => (
                            <div key={index} className="flex items-center justify-between p-3 border rounded-md">
                              <div className="flex items-center space-x-2 overflow-hidden flex-1">
                                {getUrlTypeIcon(urlValidation.type)}
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm truncate max-w-[300px]">{urlValidation.url}</div>
                                  <div className="flex items-center space-x-2 mt-1">
                                    <Badge variant="outline" className="text-xs">
                                      {urlValidation.type}
                                    </Badge>
                                    {urlValidation.metadata?.size && (
                                      <span className="text-xs text-muted-foreground">
                                        {(urlValidation.metadata.size / 1024).toFixed(0)}KB
                                      </span>
                                    )}
                                  </div>
                                  {urlValidation.error && (
                                    <div className="text-xs text-red-500 mt-1">{urlValidation.error}</div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                {getUrlStatusIcon(urlValidation.status)}
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8"
                                  onClick={() => handleRemoveUrl(urlValidation.url)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {dataSource === "google_sheets" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="sheets-url">Google Sheets URL</Label>
                      <Input
                        id="sheets-url"
                        value={sheetsUrl}
                        onChange={(e) => setSheetsUrl(e.target.value)}
                        placeholder="https://docs.google.com/spreadsheets/d/..."
                      />
                      <p className="text-xs text-muted-foreground">
                        Make sure the Google Sheet is publicly accessible or shared with appropriate permissions.
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="sheets-range">Data Range (Optional)</Label>
                      <Input
                        id="sheets-range"
                        value={sheetsRange}
                        onChange={(e) => setSheetsRange(e.target.value)}
                        placeholder="A1:Z1000"
                      />
                      <p className="text-xs text-muted-foreground">
                        Specify the range of cells to analyze (e.g., A1:Z1000). Leave default to analyze all data.
                      </p>
                    </div>
                  </div>
                )}
                
                {dataSource === "database" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="db-connection">Database Connection String</Label>
                      <Input
                        id="db-connection"
                        type="password"
                        value={dbConnectionString}
                        onChange={(e) => setDbConnectionString(e.target.value)}
                        placeholder="postgresql://user:password@host:port/database"
                      />
                      <p className="text-xs text-muted-foreground">
                        Supports PostgreSQL, MySQL, SQLite, and other SQL databases.
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="db-query">SQL Query</Label>
                      <Textarea
                        id="db-query"
                        value={dbQuery}
                        onChange={(e) => setDbQuery(e.target.value)}
                        placeholder="SELECT * FROM your_table WHERE created_at >= '2024-01-01'"
                        rows={4}
                      />
                      <p className="text-xs text-muted-foreground">
                        Write a SQL query to extract the data you want to analyze.
                      </p>
                    </div>
                  </div>
                )}
                
                {dataSource === "cloud_storage" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="bucket-name">Bucket Name</Label>
                      <Input
                        id="bucket-name"
                        placeholder="Enter your Cloud Storage bucket name"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="object-path">Object Path</Label>
                      <Input
                        id="object-path"
                        placeholder="Enter the path to your data object"
                      />
                    </div>
                  </div>
                )}
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
                    <CheckCircle className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle>Review & Start Analysis</CardTitle>
                </div>
                <CardDescription>
                  IntelliFlow will intelligently analyze your data and determine the best insights to extract.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Data Source</h4>
                    <p className="text-sm text-muted-foreground">{dataSource.replace('_', ' ')}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Analysis Mode</h4>
                    <p className="text-sm text-muted-foreground">Intelligent Auto-Analysis</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Data Items</h4>
                    <p className="text-sm text-muted-foreground">
                      {dataSource === "file_upload" && `${selectedFiles.length} files`}
                      {dataSource === "url" && `${urlList.filter(u => u.isValid).length} URLs`}
                      {dataSource === "bigquery" && `${projectId}.${datasetId}.${tableId}`}
                      {dataSource === "google_sheets" && "Google Sheets"}
                      {dataSource === "database" && "Database query"}
                      {dataSource === "cloud_storage" && "Cloud Storage"}
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Features</h4>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>• Automatic pattern detection</div>
                      <div>• Smart insight generation</div>
                      <div>• Interactive visualizations</div>
                      <div>• Comprehensive reporting</div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start space-x-3">
                    <div className="p-1 rounded-full bg-blue-500/10">
                      <Database className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                        Intelligent Analysis
                      </h5>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        IntelliFlow will automatically determine the nature of your data, identify the most relevant analysis types, 
                        and generate insights tailored to your specific dataset. No manual configuration required.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
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

