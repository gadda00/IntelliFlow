import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Progress } from "./ui/progress";
import { 
  Download, 
  Share2, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp,
  ThumbsUp,
  TrendingUp,
  Zap,
  FileText,
  MessageSquare,
  Clock,
  Database,
  Brain,
  BarChart3,
  PieChart,
  LineChart,
  CheckCircle,
  Loader2,
  Sparkles,
  Target,
  Lightbulb,
  ArrowRight,
  RefreshCw
} from "lucide-react";

interface AnalysisResultsProps {
  analysisId: string | null;
  analysisData?: any;
  onNewAnalysis?: () => void;
}

interface ProcessingStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  icon: any;
}

interface Insight {
  id: string;
  title: string;
  description: string;
  category?: string;
  importance?: number;
  confidence?: number;
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  impact?: string;
  difficulty?: string;
  priority?: number;
}

interface VisualizationData {
  type: string;
  title: string;
  data: any[];
  description?: string;
}

interface AnalysisResult {
  insights: Insight[];
  recommendations: Recommendation[];
  metrics: {
    insightCount: number;
    sentimentScore?: number;
    topicCount?: number;
    recordsAnalyzed: number;
    processingTime: string;
    confidence: number;
  };
  narrative: {
    summary: string;
    keyFindings: string;
    recommendations: string;
    conclusion: string;
  };
  dataSource: {
    type: string;
    name: string;
    recordCount: number;
    timePeriod: string;
  };
  visualizations: VisualizationData[];
}

export function AnalysisResults({ analysisId, analysisData, onNewAnalysis }: AnalysisResultsProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
  const [expandedRecommendation, setExpandedRecommendation] = useState<string | null>(null);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);
  const [animationPhase, setAnimationPhase] = useState<'loading' | 'processing' | 'completed'>('loading');

  // Initialize processing steps
  useEffect(() => {
    if (analysisData?.status === 'running') {
      const steps: ProcessingStep[] = [
        {
          id: 'data_validation',
          title: 'Data Validation',
          description: 'Validating data quality and structure',
          status: 'completed',
          progress: 100,
          icon: CheckCircle
        },
        {
          id: 'data_preprocessing',
          title: 'Data Preprocessing',
          description: 'Cleaning and preparing data for analysis',
          status: 'completed',
          progress: 100,
          icon: RefreshCw
        },
        {
          id: 'pattern_analysis',
          title: 'Pattern Analysis',
          description: 'Identifying patterns and trends in the data',
          status: 'running',
          progress: 65,
          icon: Brain
        },
        {
          id: 'insight_generation',
          title: 'Insight Generation',
          description: 'Generating actionable insights using AI',
          status: 'pending',
          progress: 0,
          icon: Lightbulb
        },
        {
          id: 'visualization_creation',
          title: 'Visualization Creation',
          description: 'Creating charts and visual representations',
          status: 'pending',
          progress: 0,
          icon: BarChart3
        },
        {
          id: 'report_compilation',
          title: 'Report Compilation',
          description: 'Compiling final analysis report',
          status: 'pending',
          progress: 0,
          icon: FileText
        }
      ];
      
      setProcessingSteps(steps);
      setAnimationPhase('processing');
      
      // Simulate processing progression
      const interval = setInterval(() => {
        setProcessingSteps(prev => {
          const updated = [...prev];
          const runningIndex = updated.findIndex(step => step.status === 'running');
          
          if (runningIndex !== -1) {
            if (updated[runningIndex].progress < 100) {
              updated[runningIndex].progress += Math.random() * 15;
              if (updated[runningIndex].progress >= 100) {
                updated[runningIndex].progress = 100;
                updated[runningIndex].status = 'completed';
                
                // Start next step
                if (runningIndex + 1 < updated.length) {
                  updated[runningIndex + 1].status = 'running';
                }
              }
            }
          }
          
          return updated;
        });
      }, 800);
      
      // Complete processing after analysis is done
      const completionTimeout = setTimeout(() => {
        setProcessingSteps(prev => 
          prev.map(step => ({ ...step, status: 'completed', progress: 100 }))
        );
        setAnimationPhase('completed');
        clearInterval(interval);
      }, 8000);
      
      return () => {
        clearInterval(interval);
        clearTimeout(completionTimeout);
      };
    } else if (analysisData?.status === 'completed') {
      setAnimationPhase('completed');
    }
  }, [analysisData?.status]);

  const toggleInsight = (id: string) => {
    setExpandedInsight(expandedInsight === id ? null : id);
  };
  
  const toggleRecommendation = (id: string) => {
    setExpandedRecommendation(expandedRecommendation === id ? null : id);
  };
  
  // Show a message when no analysis has been run yet
  if (!analysisId) {
    return (
      <div className="space-y-4">
        <Card className="border-dashed border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              No Analysis Results
            </CardTitle>
            <CardDescription>
              You haven't run any analysis yet. Start by configuring your first analysis.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center space-y-6 py-10">
            <div className="p-8 rounded-full bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
              <BarChart3 className="h-16 w-16 text-blue-500" />
            </div>
            <div className="space-y-2 text-center">
              <p className="text-xl font-semibold">Start Your First Analysis</p>
              <p className="text-sm text-muted-foreground max-w-md">
                Configure your data source and analysis parameters to get started with AI-powered insights.
              </p>
            </div>
            {onNewAnalysis && (
              <Button onClick={onNewAnalysis} size="lg" className="gap-2">
                <Sparkles className="h-4 w-4" />
                Start New Analysis
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Show processing animation when analysis is running
  if (analysisData?.status === 'running' || animationPhase === 'processing') {
    return (
      <div className="space-y-6">
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="relative">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <Sparkles className="h-3 w-3 absolute -top-1 -right-1 text-purple-500 animate-pulse" />
              </div>
              Analysis in Progress
            </CardTitle>
            <CardDescription>
              Our AI agents are analyzing your data to extract meaningful insights.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Overall Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Overall Progress</span>
                <span>{Math.round((processingSteps.filter(s => s.status === 'completed').length / processingSteps.length) * 100)}%</span>
              </div>
              <Progress 
                value={(processingSteps.filter(s => s.status === 'completed').length / processingSteps.length) * 100} 
                className="h-3"
              />
            </div>
            
            {/* Processing Steps */}
            <div className="space-y-4">
              {processingSteps.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.id} className="flex items-center gap-4 p-4 rounded-lg bg-white/50 dark:bg-gray-800/50">
                    <div className={`p-2 rounded-full ${
                      step.status === 'completed' ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400' :
                      step.status === 'running' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400' :
                      'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
                    }`}>
                      {step.status === 'running' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </div>
                    
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium">{step.title}</h4>
                        <Badge variant={
                          step.status === 'completed' ? 'default' :
                          step.status === 'running' ? 'secondary' :
                          'outline'
                        }>
                          {step.status === 'completed' ? 'Completed' :
                           step.status === 'running' ? 'Processing' :
                           'Pending'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                      {step.status !== 'pending' && (
                        <Progress value={step.progress} className="h-1" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Estimated Time */}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Estimated completion: 2-3 minutes</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (analysisData?.status === 'failed') {
    return (
      <div className="space-y-4">
        <Card className="border-red-200 bg-red-50 dark:bg-red-950">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <CardTitle className="text-red-900 dark:text-red-100">Analysis Failed</CardTitle>
                <CardDescription className="text-red-700 dark:text-red-300">
                  There was an error processing your analysis.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-red-100 dark:bg-red-900 p-4 text-red-800 dark:text-red-200 mb-6">
              <p>The analysis could not be completed. This might be due to data format issues or processing errors.</p>
            </div>
            <div className="flex gap-2">
              {onNewAnalysis && (
                <Button onClick={onNewAnalysis} variant="outline">
                  Try Again
                </Button>
              )}
              <Button variant="default">
                Contact Support
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Generate comprehensive mock results for completed analysis
  const generateMockResults = (): AnalysisResult => {
    const analysisTypes = {
      'customer_feedback': {
        insights: [
          {
            id: "i1",
            title: "Overall sentiment is primarily positive (78%)",
            description: "Customer feedback shows strong positive sentiment, with particularly high scores for product quality and customer service. This represents a 12% increase from the previous quarter.",
            category: "sentiment",
            importance: 0.95,
            confidence: 0.89
          },
          {
            id: "i2",
            title: "Product quality is the most discussed topic (45%)",
            description: "Customers frequently mention product durability, design, and functionality. Quality-related mentions are 3x more frequent than pricing discussions.",
            category: "topic",
            importance: 0.88,
            confidence: 0.92
          },
          {
            id: "i3",
            title: "Customer service response time improved significantly",
            description: "Response time satisfaction increased by 35% with average resolution time dropping from 48 hours to 18 hours. This correlates with higher overall satisfaction scores.",
            category: "trend",
            importance: 0.82,
            confidence: 0.87
          }
        ],
        recommendations: [
          {
            id: "r1",
            title: "Leverage quality messaging in marketing campaigns",
            description: "Capitalize on the strong positive sentiment around product quality by featuring customer testimonials and quality certifications in marketing materials.",
            impact: "high",
            difficulty: "low",
            priority: 1
          },
          {
            id: "r2",
            title: "Implement proactive customer service outreach",
            description: "Build on improved response times by implementing proactive customer check-ins and satisfaction surveys to maintain high service standards.",
            impact: "medium",
            difficulty: "medium",
            priority: 2
          }
        ],
        metrics: {
          insightCount: 15,
          sentimentScore: 0.78,
          topicCount: 8,
          recordsAnalyzed: 12500,
          processingTime: "4m 32s",
          confidence: 0.89
        }
      },
      'sales_trends': {
        insights: [
          {
            id: "i1",
            title: "Q4 sales exceeded projections by 23%",
            description: "Fourth quarter performance significantly outpaced forecasts, driven primarily by holiday season demand and successful promotional campaigns.",
            category: "performance",
            importance: 0.92,
            confidence: 0.95
          },
          {
            id: "i2",
            title: "Mobile commerce growth accelerating",
            description: "Mobile sales increased 67% year-over-year, now representing 42% of total online revenue. Mobile conversion rates improved by 28%.",
            category: "channel",
            importance: 0.85,
            confidence: 0.91
          },
          {
            id: "i3",
            title: "Customer acquisition cost decreased by 18%",
            description: "Improved targeting and conversion optimization led to more efficient customer acquisition, with CAC dropping from $45 to $37 per customer.",
            category: "efficiency",
            importance: 0.79,
            confidence: 0.88
          }
        ],
        recommendations: [
          {
            id: "r1",
            title: "Increase mobile optimization investment",
            description: "Allocate additional resources to mobile experience improvements and mobile-specific marketing campaigns to capitalize on the growth trend.",
            impact: "high",
            difficulty: "medium",
            priority: 1
          },
          {
            id: "r2",
            title: "Scale successful Q4 strategies",
            description: "Analyze and replicate the promotional and marketing strategies that drove Q4 success for implementation in the upcoming year.",
            impact: "high",
            difficulty: "low",
            priority: 2
          }
        ],
        metrics: {
          insightCount: 18,
          recordsAnalyzed: 8750,
          processingTime: "3m 45s",
          confidence: 0.91
        }
      }
    };
    
    const defaultType = analysisTypes['customer_feedback'];
    const selectedType = analysisTypes[analysisData?.type as keyof typeof analysisTypes] || defaultType;
    
    return {
      ...selectedType,
      narrative: {
        summary: "This comprehensive analysis examined your data to identify key patterns, trends, and actionable insights using advanced AI algorithms.",
        keyFindings: "The analysis revealed several significant patterns that indicate strong performance across multiple metrics with opportunities for strategic improvements.",
        recommendations: "Based on the findings, we recommend focusing on the high-impact, low-difficulty initiatives first to maximize immediate returns on investment.",
        conclusion: "The data shows positive trends with clear opportunities for optimization. Implementing the recommended actions could lead to significant improvements in key performance indicators."
      },
      dataSource: {
        type: analysisData?.dataSource || "Multiple Sources",
        name: analysisData?.name || "Analysis Dataset",
        recordCount: selectedType.metrics.recordsAnalyzed,
        timePeriod: "Last 30 Days"
      },
      visualizations: [
        {
          type: "pie",
          title: "Sentiment Distribution",
          data: [
            { label: "Positive", value: 78, color: "#10b981" },
            { label: "Neutral", value: 15, color: "#6b7280" },
            { label: "Negative", value: 7, color: "#ef4444" }
          ],
          description: "Overall sentiment breakdown across all analyzed feedback"
        },
        {
          type: "bar",
          title: "Topic Frequency",
          data: [
            { label: "Product Quality", value: 45 },
            { label: "Customer Service", value: 28 },
            { label: "Pricing", value: 15 },
            { label: "Delivery", value: 12 }
          ],
          description: "Most frequently discussed topics in customer feedback"
        },
        {
          type: "line",
          title: "Sentiment Trend Over Time",
          data: [
            { label: "Week 1", value: 0.72 },
            { label: "Week 2", value: 0.75 },
            { label: "Week 3", value: 0.76 },
            { label: "Week 4", value: 0.78 }
          ],
          description: "Sentiment score progression over the analysis period"
        }
      ]
    };
  };
  
  const results = generateMockResults();
  
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "sentiment":
        return <ThumbsUp className="h-4 w-4 text-blue-500" />;
      case "topic":
        return <MessageSquare className="h-4 w-4 text-purple-500" />;
      case "trend":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "performance":
        return <Target className="h-4 w-4 text-orange-500" />;
      case "channel":
        return <BarChart3 className="h-4 w-4 text-indigo-500" />;
      case "efficiency":
        return <Zap className="h-4 w-4 text-amber-500" />;
      default:
        return <Lightbulb className="h-4 w-4 text-gray-500" />;
    }
  };
  
  const getImpactBadge = (impact: string) => {
    switch (impact) {
      case "high":
        return <Badge className="bg-green-500 hover:bg-green-600">High Impact</Badge>;
      case "medium":
        return <Badge className="bg-amber-500 hover:bg-amber-600">Medium Impact</Badge>;
      case "low":
        return <Badge variant="outline">Low Impact</Badge>;
      default:
        return null;
    }
  };
  
  const getDifficultyBadge = (difficulty: string) => {
    switch (difficulty) {
      case "high":
        return <Badge variant="destructive">High Effort</Badge>;
      case "medium":
        return <Badge variant="secondary">Medium Effort</Badge>;
      case "low":
        return <Badge variant="outline">Low Effort</Badge>;
      default:
        return null;
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Header with completion animation */}
      <div className="relative">
        <Card className="border-green-200 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950 dark:to-blue-950 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-green-400/10 to-blue-400/10 animate-pulse"></div>
          <CardHeader className="relative">
            <CardTitle className="flex items-center gap-3 text-2xl">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              Analysis Complete!
            </CardTitle>
            <CardDescription className="text-base">
              Your data has been successfully analyzed. Here are the key insights and recommendations.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
      
      {/* Key Metrics Dashboard */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="overflow-hidden hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Confidence Score</CardTitle>
            <Brain className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(results.metrics.confidence * 100).toFixed(0)}%</div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              <span>High confidence analysis</span>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
              <div 
                className="h-full bg-purple-500 rounded-full transition-all duration-1000" 
                style={{ width: `${results.metrics.confidence * 100}%` }}
              ></div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="overflow-hidden hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Insights</CardTitle>
            <Lightbulb className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{results.metrics.insightCount}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Key findings discovered
            </div>
          </CardContent>
        </Card>
        
        <Card className="overflow-hidden hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Records Analyzed</CardTitle>
            <Database className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{results.metrics.recordsAnalyzed.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Data points processed
            </div>
          </CardContent>
        </Card>
        
        <Card className="overflow-hidden hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Processing Time</CardTitle>
            <Clock className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{results.metrics.processingTime}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Analysis duration
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="visualizations">Charts</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* Executive Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Executive Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Summary</h4>
                <p className="text-muted-foreground">{results.narrative.summary}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Key Findings</h4>
                <p className="text-muted-foreground">{results.narrative.keyFindings}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Recommendations</h4>
                <p className="text-muted-foreground">{results.narrative.recommendations}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Conclusion</h4>
                <p className="text-muted-foreground">{results.narrative.conclusion}</p>
              </div>
            </CardContent>
          </Card>
          
          {/* Data Source Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Data Source Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium">Source Type</p>
                  <p className="text-muted-foreground">{results.dataSource.type}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Dataset Name</p>
                  <p className="text-muted-foreground">{results.dataSource.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Records Count</p>
                  <p className="text-muted-foreground">{results.dataSource.recordCount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Time Period</p>
                  <p className="text-muted-foreground">{results.dataSource.timePeriod}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="insights" className="mt-6 space-y-4">
          {results.insights.map((insight) => (
            <Card key={insight.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {getCategoryIcon(insight.category || '')}
                    <div className="flex-1">
                      <CardTitle className="text-lg">{insight.title}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {insight.category}
                        </Badge>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">Confidence:</span>
                          <span className="text-xs font-medium">{((insight.confidence || 0.8) * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleInsight(insight.id)}
                  >
                    {expandedInsight === insight.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              {expandedInsight === insight.id && (
                <CardContent>
                  <p className="text-muted-foreground">{insight.description}</p>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-sm font-medium">Importance:</span>
                    <Progress value={(insight.importance || 0.8) * 100} className="flex-1 h-2" />
                    <span className="text-sm text-muted-foreground">{((insight.importance || 0.8) * 100).toFixed(0)}%</span>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </TabsContent>
        
        <TabsContent value="recommendations" className="mt-6 space-y-4">
          {results.recommendations.map((recommendation) => (
            <Card key={recommendation.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <Target className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div className="flex-1">
                      <CardTitle className="text-lg">{recommendation.title}</CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        {getImpactBadge(recommendation.impact || '')}
                        {getDifficultyBadge(recommendation.difficulty || '')}
                        <Badge variant="secondary">
                          Priority {recommendation.priority || 1}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleRecommendation(recommendation.id)}
                  >
                    {expandedRecommendation === recommendation.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              {expandedRecommendation === recommendation.id && (
                <CardContent>
                  <p className="text-muted-foreground mb-4">{recommendation.description}</p>
                  <div className="flex gap-2">
                    <Button size="sm">
                      <ArrowRight className="h-4 w-4 mr-1" />
                      Implement
                    </Button>
                    <Button variant="outline" size="sm">
                      Learn More
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </TabsContent>
        
        <TabsContent value="visualizations" className="mt-6 space-y-6">
          {results.visualizations.map((viz, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {viz.type === 'pie' && <PieChart className="h-5 w-5" />}
                  {viz.type === 'bar' && <BarChart3 className="h-5 w-5" />}
                  {viz.type === 'line' && <LineChart className="h-5 w-5" />}
                  {viz.title}
                </CardTitle>
                {viz.description && (
                  <CardDescription>{viz.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center bg-muted rounded-lg">
                  <div className="text-center space-y-2">
                    <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {viz.title} visualization would be rendered here
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Data: {viz.data.length} data points
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
      
      {/* Action Buttons */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-2">
            <Button className="gap-2">
              <Download className="h-4 w-4" />
              Export Report
            </Button>
            <Button variant="outline" className="gap-2">
              <Share2 className="h-4 w-4" />
              Share Results
            </Button>
            {onNewAnalysis && (
              <Button variant="outline" onClick={onNewAnalysis} className="gap-2">
                <Sparkles className="h-4 w-4" />
                New Analysis
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

