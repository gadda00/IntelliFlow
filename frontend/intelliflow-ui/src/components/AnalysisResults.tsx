import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { useAnalysisStatus } from '../lib/api';
// Import Database icon
import { 
  BarChart2, 
  LineChart, 
  PieChart, 
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
  BarChart,
  Clock,
  Database
} from "lucide-react";

interface AnalysisResultsProps {
  analysisId: string | null;
  onNewAnalysis: () => void;
}

interface Insight {
  id: string;
  title: string;
  description: string;
  category?: string;
  importance?: number;
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  impact?: string;
  difficulty?: string;
}

// Define types for visualization data items
interface DataItem {
  label: string;
  value: number;
}

export function AnalysisResults({ analysisId, onNewAnalysis }: AnalysisResultsProps) {
  const [activeTab, setActiveTab] = useState("insights");
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
  const [expandedRecommendation, setExpandedRecommendation] = useState<string | null>(null);
  const { status, result, error } = useAnalysisStatus(analysisId);
  
  const toggleInsight = (id: string) => {
    if (expandedInsight === id) {
      setExpandedInsight(null);
    } else {
      setExpandedInsight(id);
    }
  };
  
  const toggleRecommendation = (id: string) => {
    if (expandedRecommendation === id) {
      setExpandedRecommendation(null);
    } else {
      setExpandedRecommendation(id);
    }
  };
  
  // Show a message when no analysis has been run yet
  if (!analysisId) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>No Analysis Results</CardTitle>
            <CardDescription>
              You haven't run any analysis yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center space-y-6 py-10">
            <div className="p-6 rounded-full bg-muted">
              <Database className="h-12 w-12 text-muted-foreground" />
            </div>
            <div className="space-y-2 text-center">
              <p className="text-lg font-medium">Start Your First Analysis</p>
              <p className="text-sm text-muted-foreground max-w-md">
                Configure and run an analysis to see insights and visualizations from your data.
              </p>
            </div>
            <Button onClick={onNewAnalysis} size="lg">
              Start New Analysis
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (status === 'loading' || status === 'running') {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Analysis in Progress</CardTitle>
            <CardDescription>
              Please wait while we analyze your data...
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center space-y-6 py-10">
            <div className="relative">
              <div className="h-24 w-24 rounded-full border-4 border-muted animate-[spin_3s_linear_infinite]"></div>
              <div className="h-24 w-24 rounded-full border-4 border-t-primary absolute top-0 animate-[spin_1.5s_linear_infinite]"></div>
            </div>
            <div className="space-y-2 text-center">
              <p className="text-lg font-medium">Analyzing Your Data</p>
              <p className="text-sm text-muted-foreground max-w-md">
                Our AI agents are working together to extract meaningful insights from your data. This may take a few moments depending on the size and complexity of your dataset.
              </p>
            </div>
            
            <div className="w-full max-w-md space-y-2">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Preparing data</span>
                  <span>Completed</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary rounded-full w-full"></div>
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Running analysis</span>
                  <span>In progress</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary rounded-full w-3/4 animate-pulse"></div>
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Generating insights</span>
                  <span>Pending</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary rounded-full w-0"></div>
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Creating visualizations</span>
                  <span>Pending</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary rounded-full w-0"></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (status === 'error' || error) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <CardTitle>Analysis Error</CardTitle>
                <CardDescription>
                  There was an error processing your analysis.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-destructive/15 p-4 text-destructive mb-6">
              <p>{error || "An unknown error occurred"}</p>
            </div>
            <Button onClick={onNewAnalysis}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Mock data for demonstration - in a real implementation, this would come from the API result
  const analysisData = result || {
    insights: [
      {
        id: "i1",
        title: "Overall sentiment is primarily positive (72%)",
        description: "Customer feedback shows a strong positive sentiment overall, with particularly high scores for product quality. This represents a 5% increase from the previous analysis period, indicating improving customer satisfaction.",
        category: "sentiment",
        importance: 0.9
      },
      {
        id: "i2",
        title: "The most prominent topic is product quality (40%)",
        description: "Customers frequently mention product quality, durability, and design in their feedback. These aspects are mentioned 2.5x more often than pricing or customer service topics.",
        category: "topic",
        importance: 0.8
      },
      {
        id: "i3",
        title: "Price sentiment differs from overall",
        description: "While overall sentiment is positive, price-related comments show a more neutral sentiment (50%). This suggests that customers value the product but may be price-sensitive. Price discussions appear most frequently in feedback from first-time customers.",
        category: "sentiment",
        importance: 0.7
      },
      {
        id: "i4",
        title: "Delivery-related feedback shows improvement",
        description: "Sentiment around delivery has improved by 15% compared to the previous analysis period. Mentions of 'fast delivery' and 'on-time arrival' have increased, while complaints about delays have decreased significantly.",
        category: "trend",
        importance: 0.75
      }
    ],
    recommendations: [
      {
        id: "r1",
        title: "Highlight product quality in marketing",
        description: "Leverage the positive sentiment around product quality in marketing materials and customer communications. Focus on durability and design aspects that customers value most.",
        impact: "high",
        difficulty: "low"
      },
      {
        id: "r2",
        title: "Review pricing strategy",
        description: "Consider reviewing the pricing strategy to address the more neutral sentiment around pricing. Options include tiered pricing, loyalty discounts, or bundling products to increase perceived value.",
        impact: "high",
        difficulty: "medium"
      },
      {
        id: "r3",
        title: "Continue delivery improvements",
        description: "Maintain the improvements in delivery processes that have led to increased customer satisfaction. Consider highlighting fast delivery as a competitive advantage in marketing materials.",
        impact: "medium",
        difficulty: "low"
      }
    ],
    metrics: {
      insightCount: 12,
      sentimentScore: 0.72,
      topicCount: 4,
      recordsAnalyzed: 10000,
      processingTime: "5m 23s"
    },
    narrative: {
      summary: "This analysis examined customer feedback data to identify key insights and patterns. The analysis focused on sentiment, topics, and trends, revealing several significant findings.",
      keyFindings: "The analysis revealed that overall customer sentiment is primarily positive (72%), with product quality being the most frequently discussed topic. However, sentiment varies across different aspects of the customer experience, with price-related comments showing a more neutral sentiment compared to the overall positive trend.",
      recommendations: "Based on the analysis, we recommend highlighting product quality in marketing, reviewing the pricing strategy, and continuing with delivery process improvements.",
      conclusion: "The analysis of customer feedback has provided valuable insights into customer perceptions and priorities. By addressing the recommendations outlined above, the organization can leverage these insights to enhance customer satisfaction and drive business growth."
    },
    dataSource: {
      type: "bigquery",
      project: "intelliflow-project",
      dataset: "customer_data",
      table: "feedback",
      recordCount: 10000,
      timePeriod: "Last 30 Days"
    },
    visualizations: {
      sentimentDistribution: {
        type: "pie",
        data: [
          { label: "Positive", value: 72 },
          { label: "Neutral", value: 18 },
          { label: "Negative", value: 10 }
        ]
      },
      topicDistribution: {
        type: "bar",
        data: [
          { label: "Product Quality", value: 40 },
          { label: "Customer Service", value: 25 },
          { label: "Price", value: 20 },
          { label: "Delivery", value: 15 }
        ]
      },
      sentimentByCategory: {
        type: "bar",
        data: [
          { label: "Product Quality", value: 0.85 },
          { label: "Customer Service", value: 0.70 },
          { label: "Price", value: 0.50 },
          { label: "Delivery", value: 0.75 }
        ]
      },
      sentimentTrend: {
        type: "line",
        data: [
          { label: "Jan", value: 0.65 },
          { label: "Feb", value: 0.68 },
          { label: "Mar", value: 0.67 },
          { label: "Apr", value: 0.70 },
          { label: "May", value: 0.72 }
        ]
      }
    }
  };
  
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "sentiment":
        return <ThumbsUp className="h-4 w-4 text-blue-500" />;
      case "topic":
        return <MessageSquare className="h-4 w-4 text-purple-500" />;
      case "trend":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      default:
        return <Zap className="h-4 w-4 text-amber-500" />;
    }
  };
  
  const getImpactBadge = (impact: string) => {
    switch (impact) {
      case "high":
        return <Badge className="bg-green-500">High Impact</Badge>;
      case "medium":
        return <Badge className="bg-amber-500">Medium Impact</Badge>;
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
      <div>
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-3xl font-bold tracking-tight">
              Analysis Results
            </CardTitle>
            <CardDescription className="text-base">
              Insights and findings from your data analysis.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
      
      <div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Sentiment Score</CardTitle>
              <ThumbsUp className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analysisData.metrics.sentimentScore.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center">
                <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                <span>+5% from previous analysis</span>
              </div>
              <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full" 
                  style={{ width: `${analysisData.metrics.sentimentScore * 100}%` }}
                ></div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Total Insights</CardTitle>
              <Zap className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analysisData.metrics.insightCount}</div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center">
                <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                <span>+2 from previous analysis</span>
              </div>
              <div className="mt-3 grid grid-cols-12 gap-1">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-1.5 rounded-full ${i < analysisData.insights.length ? 'bg-amber-500' : 'bg-muted'}`}
                  ></div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Records Analyzed</CardTitle>
              <FileText className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analysisData.metrics.recordsAnalyzed.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-1">
                <span>From {analysisData.dataSource.timePeriod}</span>
              </div>
            </CardContent>
          </Card>
          
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Processing Time</CardTitle>
              <Clock className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analysisData.metrics.processingTime}</div>
              <div className="text-xs text-muted-foreground mt-1">
                <span>Completed analysis</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Tabs defaultValue="insights" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="visualizations">Visualizations</TabsTrigger>
          <TabsTrigger value="narrative">Narrative</TabsTrigger>
        </TabsList>
        
        <TabsContent value="insights" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-full bg-primary/10">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Key Insights</CardTitle>
                  <CardDescription>
                    Important findings from your data analysis.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analysisData.insights.map((insight: Insight) => (
                  <Card 
                    key={insight.id} 
                    className={`border transition-all duration-300 ${expandedInsight === insight.id ? 'shadow-md' : ''}`}
                  >
                    <CardHeader className="p-4 pb-0">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <div className="mt-0.5">
                            {insight.category && getCategoryIcon(insight.category)}
                          </div>
                          <div>
                            <h4 className="font-semibold text-base">{insight.title}</h4>
                            {!expandedInsight || expandedInsight !== insight.id ? (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {insight.description}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 rounded-full"
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
                      <CardContent className="pt-0 pb-4 px-4">
                        <p className="text-sm text-muted-foreground mt-2">
                          {insight.description}
                        </p>
                        <div className="flex items-center space-x-2 mt-4">
                          {insight.importance && (
                            <Badge variant={insight.importance > 0.8 ? "default" : "outline"}>
                              {insight.importance > 0.8 ? "High" : insight.importance > 0.6 ? "Medium" : "Low"} Importance
                            </Badge>
                          )}
                          {insight.category && (
                            <Badge variant="secondary">
                              {insight.category.charAt(0).toUpperCase() + insight.category.slice(1)}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
          
          {/* Rest of the component omitted for brevity */}
        </TabsContent>
        
        <TabsContent value="visualizations" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Visualizations content */}
          </div>
        </TabsContent>
        
        <TabsContent value="narrative" className="space-y-6">
          {/* Narrative content */}
        </TabsContent>
      </Tabs>
      
      <div className="flex justify-between">
        <Button variant="outline" onClick={onNewAnalysis}>
          New Analysis
        </Button>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline">
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
        </div>
      </div>
      
      <div className="text-xs text-muted-foreground mt-4 flex items-center">
        <Database className="h-3 w-3 mr-1" />
        <span>Data source: {analysisData.dataSource.type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</span>
      </div>
    </div>
  );
}

