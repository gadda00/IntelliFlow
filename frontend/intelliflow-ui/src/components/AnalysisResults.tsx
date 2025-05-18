import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { useAnalysisStatus } from '../lib/api';

interface AnalysisResultsProps {
  analysisId: string | null;
  onNewAnalysis: () => void;
}

interface Insight {
  id: string;
  title: string;
  description: string;
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
}

export function AnalysisResults({ analysisId, onNewAnalysis }: AnalysisResultsProps) {
  const [activeTab, setActiveTab] = useState("insights");
  const { status, result, error } = useAnalysisStatus(analysisId);
  
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
          <CardContent className="flex flex-col items-center justify-center space-y-4 py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p className="text-sm text-muted-foreground">
              This may take a few moments depending on the size of your data.
            </p>
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
            <CardTitle>Analysis Error</CardTitle>
            <CardDescription>
              There was an error processing your analysis.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-destructive/15 p-4 text-destructive">
              <p>{error || "An unknown error occurred"}</p>
            </div>
            <Button className="mt-4" onClick={onNewAnalysis}>
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
        description: "Customer feedback shows a strong positive sentiment overall, with particularly high scores for product quality."
      },
      {
        id: "i2",
        title: "The most prominent topic is product quality (40%)",
        description: "Customers frequently mention product quality, durability, and design in their feedback."
      },
      {
        id: "i3",
        title: "Price sentiment differs from overall",
        description: "While overall sentiment is positive, price-related comments show a more neutral sentiment (50%)."
      },
      {
        id: "i4",
        title: "Delivery-related feedback shows improvement",
        description: "Sentiment around delivery has improved by 15% compared to the previous analysis period."
      }
    ],
    recommendations: [
      {
        id: "r1",
        title: "Highlight product quality in marketing",
        description: "Leverage the positive sentiment around product quality in marketing materials and customer communications."
      },
      {
        id: "r2",
        title: "Review pricing strategy",
        description: "Consider reviewing the pricing strategy to address the more neutral sentiment around pricing."
      },
      {
        id: "r3",
        title: "Continue delivery improvements",
        description: "Maintain the improvements in delivery processes that have led to increased customer satisfaction."
      }
    ],
    metrics: {
      insightCount: 12,
      sentimentScore: 0.72,
      topicCount: 4
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
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Insights
            </CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysisData.metrics.insightCount}</div>
            <p className="text-xs text-muted-foreground">
              +2 from previous analysis
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Sentiment Score
            </CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M16 18a4 4 0 0 0-8 0" />
              <circle cx="12" cy="10" r="3" />
              <path d="M12 2a8 8 0 0 0-8 8 12 12 0 0 0 8 12 12 12 0 0 0 8-12 8 8 0 0 0-8-8Z" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysisData.metrics.sentimentScore.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Positive sentiment
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Topics</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <rect width="20" height="14" x="2" y="5" rx="2" />
              <path d="M2 10h20" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysisData.metrics.topicCount}</div>
            <p className="text-xs text-muted-foreground">
              Product, Service, Price, Delivery
            </p>
          </CardContent>
        </Card>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="visualizations">Visualizations</TabsTrigger>
          <TabsTrigger value="narrative">Narrative</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
        </TabsList>
        
        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Key Insights</CardTitle>
              <CardDescription>
                Automatically generated insights from your data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analysisData.insights.map((insight: Insight) => (
                  <div key={insight.id} className="rounded-lg border p-4">
                    <h4 className="font-semibold">{insight.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {insight.description}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Recommendations</CardTitle>
              <CardDescription>
                Strategic recommendations based on the analysis.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analysisData.recommendations.map((recommendation: Recommendation) => (
                  <div key={recommendation.id} className="rounded-lg border p-4">
                    <h4 className="font-semibold">{recommendation.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {recommendation.description}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="visualizations" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Sentiment Analysis</CardTitle>
                <CardDescription>
                  Distribution of sentiment across customer feedback.
                </CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                <div className="h-[300px] w-full bg-muted rounded-md flex items-center justify-center">
                  <p className="text-muted-foreground">Sentiment Chart</p>
                </div>
              </CardContent>
            </Card>
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Topic Distribution</CardTitle>
                <CardDescription>
                  Main topics identified in the feedback.
                </CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                <div className="h-[300px] w-full bg-muted rounded-md flex items-center justify-center">
                  <p className="text-muted-foreground">Topic Chart</p>
                </div>
              </CardContent>
            </Card>
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Sentiment by Category</CardTitle>
                <CardDescription>
                  Sentiment breakdown across different categories.
                </CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                <div className="h-[300px] w-full bg-muted rounded-md flex items-center justify-center">
                  <p className="text-muted-foreground">Category Sentiment Chart</p>
                </div>
              </CardContent>
            </Card>
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Sentiment Trend</CardTitle>
                <CardDescription>
                  Sentiment changes over time.
                </CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                <div className="h-[300px] w-full bg-muted rounded-md flex items-center justify-center">
                  <p className="text-muted-foreground">Trend Chart</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="narrative" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Executive Summary</CardTitle>
              <CardDescription>
                Comprehensive narrative of the analysis findings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none">
                <p>{analysisData.narrative.summary}</p>
                
                <h3>Key Findings</h3>
                <p>{analysisData.narrative.keyFindings}</p>
                
                <h3>Recommendations</h3>
                <p>{analysisData.narrative.recommendations}</p>
                
                <h3>Conclusion</h3>
                <p>{analysisData.narrative.conclusion}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="data" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Summary</CardTitle>
              <CardDescription>
                Overview of the analyzed data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium">Data Source</h4>
                    <p className="text-sm text-muted-foreground">{analysisData.dataSource.type}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">Dataset</h4>
                    <p className="text-sm text-muted-foreground">{`${analysisData.dataSource.project}.${analysisData.dataSource.dataset}.${analysisData.dataSource.table}`}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">Time Period</h4>
                    <p className="text-sm text-muted-foreground">{analysisData.dataSource.timePeriod}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">Records Analyzed</h4>
                    <p className="text-sm text-muted-foreground">{analysisData.dataSource.recordCount.toLocaleString()}</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium mb-2">Data Fields</h4>
                  <div className="rounded-md border">
                    <div className="grid grid-cols-4 gap-4 p-4 border-b">
                      <div className="font-medium">Field</div>
                      <div className="font-medium">Type</div>
                      <div className="font-medium">Completeness</div>
                      <div className="font-medium">Sample Values</div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 p-4 border-b">
                      <div>feedback_id</div>
                      <div>STRING</div>
                      <div>100%</div>
                      <div>FB12345, FB12346</div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 p-4 border-b">
                      <div>customer_id</div>
                      <div>STRING</div>
                      <div>100%</div>
                      <div>C5001, C5002</div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 p-4 border-b">
                      <div>product_id</div>
                      <div>STRING</div>
                      <div>98%</div>
                      <div>P100, P200</div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 p-4 border-b">
                      <div>rating</div>
                      <div>INTEGER</div>
                      <div>100%</div>
                      <div>1-5</div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 p-4">
                      <div>comment</div>
                      <div>STRING</div>
                      <div>85%</div>
                      <div>"Great product!", "Fast delivery"</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <div className="flex justify-end space-x-2">
        <Button variant="outline">Export PDF</Button>
        <Button variant="outline">Share Results</Button>
        <Button onClick={onNewAnalysis}>New Analysis</Button>
      </div>
    </div>
  );
}
