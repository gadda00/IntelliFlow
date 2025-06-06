import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { useAnalysisStatus } from '../lib/api';
import { motion } from "framer-motion";
import { 
  BarChart2, 
  LineChart, 
  PieChart, 
  Download, 
  Share2, 
  Loader2, 
  AlertTriangle, 
  ChevronRight, 
  ChevronDown, 
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  TrendingDown,
  Zap,
  FileText,
  MessageSquare,
  BarChart,
  Clock
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

export function AnalysisResults({ analysisId, onNewAnalysis }: AnalysisResultsProps) {
  const [activeTab, setActiveTab] = useState("insights");
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
  const [expandedRecommendation, setExpandedRecommendation] = useState<string | null>(null);
  const { status, result, error } = useAnalysisStatus(analysisId);
  
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
  
  if (status === 'loading' || status === 'running') {
    return (
      <motion.div 
        className="space-y-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
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
      </motion.div>
    );
  }
  
  if (status === 'error' || error) {
    return (
      <motion.div 
        className="space-y-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
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
      </motion.div>
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
              Analysis Results
            </CardTitle>
            <CardDescription className="text-base">
              Insights and findings from your data analysis.
            </CardDescription>
          </CardHeader>
        </Card>
      </motion.div>
      
      <motion.div variants={itemVariants}>
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
              <div className="mt-3 flex items-center space-x-1">
                <div className="h-1.5 w-1/3 rounded-full bg-purple-500"></div>
                <div className="h-1.5 w-1/4 rounded-full bg-purple-400"></div>
                <div className="h-1.5 w-1/5 rounded-full bg-purple-300"></div>
                <div className="h-1.5 flex-1 rounded-full bg-muted"></div>
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
              <div className="mt-3 flex items-center space-x-1">
                <div className="h-1.5 w-2/5 rounded-full bg-green-500"></div>
                <div className="h-1.5 w-1/3 rounded-full bg-green-400"></div>
                <div className="h-1.5 flex-1 rounded-full bg-green-300"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
      
      <motion.div variants={itemVariants}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="insights">Insights</TabsTrigger>
            <TabsTrigger value="visualizations">Visualizations</TabsTrigger>
            <TabsTrigger value="narrative">Narrative</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
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
                      Automatically generated insights from your data.
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
                          <div className="flex items-start space-x-2">
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
            
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-full bg-primary/10">
                    <LineChart className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Recommendations</CardTitle>
                    <CardDescription>
                      Strategic recommendations based on the analysis.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analysisData.recommendations.map((recommendation: Recommendation) => (
                    <Card 
                      key={recommendation.id} 
                      className={`border transition-all duration-300 ${expandedRecommendation === recommendation.id ? 'shadow-md' : ''}`}
                    >
                      <CardHeader className="p-4 pb-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold text-base">{recommendation.title}</h4>
                            {!expandedRecommendation || expandedRecommendation !== recommendation.id ? (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {recommendation.description}
                              </p>
                            ) : null}
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 rounded-full"
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
                        <CardContent className="pt-0 pb-4 px-4">
                          <p className="text-sm text-muted-foreground mt-2">
                            {recommendation.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-4">
                            {recommendation.impact && getImpactBadge(recommendation.impact)}
                            {recommendation.difficulty && getDifficultyBadge(recommendation.difficulty)}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="visualizations" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 rounded-full bg-blue-500/10">
                        <PieChart className="h-4 w-4 text-blue-500" />
                      </div>
                      <div>
                        <CardTitle>Sentiment Distribution</CardTitle>
                        <CardDescription>
                          Distribution of sentiment across customer feedback.
                        </CardDescription>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="aspect-square relative">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-3/4 h-3/4 rounded-full border-8 border-blue-100 dark:border-blue-950"></div>
                      <div 
                        className="absolute top-0 left-0 right-0 bottom-0 border-8 border-transparent border-t-blue-500 rounded-full"
                        style={{ transform: 'rotate(45deg)' }}
                      ></div>
                      <div 
                        className="absolute top-0 left-0 right-0 bottom-0 border-8 border-transparent border-t-blue-300 rounded-full"
                        style={{ transform: 'rotate(110deg)' }}
                      ></div>
                      <div 
                        className="absolute top-0 left-0 right-0 bottom-0 border-8 border-transparent border-t-blue-200 rounded-full"
                        style={{ transform: 'rotate(175deg)' }}
                      ></div>
                      <div className="absolute inset-0 flex items-center justify-center flex-col">
                        <span className="text-3xl font-bold">72%</span>
                        <span className="text-sm text-muted-foreground">Positive</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <div className="flex items-center space-x-2">
                      <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                      <span className="text-sm">Positive (72%)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="h-3 w-3 rounded-full bg-blue-300"></div>
                      <span className="text-sm">Neutral (18%)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="h-3 w-3 rounded-full bg-blue-200"></div>
                      <span className="text-sm">Negative (10%)</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 rounded-full bg-purple-500/10">
                        <BarChart className="h-4 w-4 text-purple-500" />
                      </div>
                      <div>
                        <CardTitle>Topic Distribution</CardTitle>
                        <CardDescription>
                          Main topics identified in the feedback.
                        </CardDescription>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-[250px] flex items-end justify-between space-x-2">
                    {analysisData.visualizations.topicDistribution.data.map((item, index) => (
                      <div key={index} className="flex flex-col items-center space-y-2">
                        <div 
                          className="w-12 bg-purple-500 rounded-t-md transition-all duration-1000 ease-out"
                          style={{ 
                            height: `${(item.value / 40) * 200}px`,
                            opacity: 0.5 + (item.value / 80)
                          }}
                        ></div>
                        <span className="text-xs text-muted-foreground">{item.label.split(' ')[0]}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 rounded-full bg-green-500/10">
                        <BarChart2 className="h-4 w-4 text-green-500" />
                      </div>
                      <div>
                        <CardTitle>Sentiment by Category</CardTitle>
                        <CardDescription>
                          Sentiment breakdown across different categories.
                        </CardDescription>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-4">
                    {analysisData.visualizations.sentimentByCategory.data.map((item, index) => (
                      <div key={index} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{item.label}</span>
                          <span className="font-medium">{(item.value * 100).toFixed(0)}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              item.value > 0.7 ? 'bg-green-500' : 
                              item.value > 0.5 ? 'bg-amber-500' : 
                              'bg-red-500'
                            }`}
                            style={{ width: `${item.value * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 rounded-full bg-blue-500/10">
                        <LineChart className="h-4 w-4 text-blue-500" />
                      </div>
                      <div>
                        <CardTitle>Sentiment Trend</CardTitle>
                        <CardDescription>
                          Sentiment changes over time.
                        </CardDescription>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-[250px] relative">
                    <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-muted"></div>
                    <div className="absolute bottom-1/4 left-0 right-0 h-[1px] bg-muted/50"></div>
                    <div className="absolute bottom-1/2 left-0 right-0 h-[1px] bg-muted/50"></div>
                    <div className="absolute bottom-3/4 left-0 right-0 h-[1px] bg-muted/50"></div>
                    
                    <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="0.5" />
                          <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      
                      {/* Area under the line */}
                      <path
                        d="M0,140 L80,120 L160,124 L240,110 L320,100 L400,100 L400,200 L0,200 Z"
                        fill="url(#gradient)"
                      />
                      
                      {/* Line */}
                      <path
                        d="M0,140 L80,120 L160,124 L240,110 L320,100"
                        fill="none"
                        stroke="rgb(59, 130, 246)"
                        strokeWidth="2"
                      />
                      
                      {/* Data points */}
                      <circle cx="0" cy="140" r="4" fill="white" stroke="rgb(59, 130, 246)" strokeWidth="2" />
                      <circle cx="80" cy="120" r="4" fill="white" stroke="rgb(59, 130, 246)" strokeWidth="2" />
                      <circle cx="160" cy="124" r="4" fill="white" stroke="rgb(59, 130, 246)" strokeWidth="2" />
                      <circle cx="240" cy="110" r="4" fill="white" stroke="rgb(59, 130, 246)" strokeWidth="2" />
                      <circle cx="320" cy="100" r="4" fill="white" stroke="rgb(59, 130, 246)" strokeWidth="2" />
                    </svg>
                  </div>
                  
                  <div className="flex justify-between mt-2">
                    {analysisData.visualizations.sentimentTrend.data.map((item, index) => (
                      <div key={index} className="text-xs text-muted-foreground">
                        {item.label}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="narrative" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-full bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Executive Summary</CardTitle>
                    <CardDescription>
                      Comprehensive narrative of the analysis findings.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none dark:prose-invert">
                  <div className="p-4 rounded-lg bg-muted/50 border mb-6">
                    <p className="text-lg font-medium">{analysisData.narrative.summary}</p>
                  </div>
                  
                  <h3 className="text-xl font-semibold mt-8 mb-4 flex items-center">
                    <span className="p-1.5 rounded-full bg-blue-500/10 mr-2">
                      <Zap className="h-4 w-4 text-blue-500" />
                    </span>
                    Key Findings
                  </h3>
                  <p>{analysisData.narrative.keyFindings}</p>
                  
                  <h3 className="text-xl font-semibold mt-8 mb-4 flex items-center">
                    <span className="p-1.5 rounded-full bg-green-500/10 mr-2">
                      <LineChart className="h-4 w-4 text-green-500" />
                    </span>
                    Recommendations
                  </h3>
                  <p>{analysisData.narrative.recommendations}</p>
                  
                  <h3 className="text-xl font-semibold mt-8 mb-4 flex items-center">
                    <span className="p-1.5 rounded-full bg-purple-500/10 mr-2">
                      <FileText className="h-4 w-4 text-purple-500" />
                    </span>
                    Conclusion
                  </h3>
                  <p>{analysisData.narrative.conclusion}</p>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end space-x-2 border-t pt-6">
                <Button variant="outline" className="flex items-center space-x-2">
                  <Download className="h-4 w-4 mr-2" />
                  <span>Download PDF</span>
                </Button>
                <Button variant="outline" className="flex items-center space-x-2">
                  <Share2 className="h-4 w-4 mr-2" />
                  <span>Share Report</span>
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="data" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Database className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Data Summary</CardTitle>
                    <CardDescription>
                      Overview of the analyzed data.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="p-4 rounded-lg border">
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Data Source</h4>
                        <div className="flex items-center space-x-2">
                          <Database className="h-5 w-5 text-blue-500" />
                          <p className="text-base font-medium">
                            {analysisData.dataSource.type === 'bigquery' ? 'BigQuery' : 
                             analysisData.dataSource.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {`${analysisData.dataSource.project}.${analysisData.dataSource.dataset}.${analysisData.dataSource.table}`}
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="p-4 rounded-lg border">
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Analysis Scope</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Time Period</p>
                            <p className="text-base font-medium">{analysisData.dataSource.timePeriod}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Records Analyzed</p>
                            <p className="text-base font-medium">{analysisData.dataSource.recordCount.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-base font-medium mb-3">Data Fields</h4>
                    <div className="rounded-md border overflow-hidden">
                      <div className="grid grid-cols-4 gap-4 p-4 border-b bg-muted/50">
                        <div className="font-medium">Field</div>
                        <div className="font-medium">Type</div>
                        <div className="font-medium">Completeness</div>
                        <div className="font-medium">Sample Values</div>
                      </div>
                      <div className="grid grid-cols-4 gap-4 p-4 border-b hover:bg-muted/20 transition-colors">
                        <div>feedback_id</div>
                        <div>STRING</div>
                        <div>100%</div>
                        <div className="text-muted-foreground">FB12345, FB12346</div>
                      </div>
                      <div className="grid grid-cols-4 gap-4 p-4 border-b hover:bg-muted/20 transition-colors">
                        <div>customer_id</div>
                        <div>STRING</div>
                        <div>100%</div>
                        <div className="text-muted-foreground">C5001, C5002</div>
                      </div>
                      <div className="grid grid-cols-4 gap-4 p-4 border-b hover:bg-muted/20 transition-colors">
                        <div>product_id</div>
                        <div>STRING</div>
                        <div>98%</div>
                        <div className="text-muted-foreground">P100, P200</div>
                      </div>
                      <div className="grid grid-cols-4 gap-4 p-4 border-b hover:bg-muted/20 transition-colors">
                        <div>rating</div>
                        <div>INTEGER</div>
                        <div>100%</div>
                        <div className="text-muted-foreground">1-5</div>
                      </div>
                      <div className="grid grid-cols-4 gap-4 p-4 hover:bg-muted/20 transition-colors">
                        <div>comment</div>
                        <div>STRING</div>
                        <div>85%</div>
                        <div className="text-muted-foreground">"Great product!", "Fast delivery"</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" className="flex items-center space-x-2">
                      <Download className="h-4 w-4 mr-2" />
                      <span>Export Data Schema</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
      
      <motion.div variants={itemVariants} className="flex justify-between space-x-2">
        <Button variant="outline" onClick={onNewAnalysis}>
          New Analysis
        </Button>
        <div className="space-x-2">
          <Button variant="outline" className="flex items-center space-x-2">
            <Download className="h-4 w-4 mr-2" />
            <span>Export PDF</span>
          </Button>
          <Button variant="outline" className="flex items-center space-x-2">
            <Share2 className="h-4 w-4 mr-2" />
            <span>Share Results</span>
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

