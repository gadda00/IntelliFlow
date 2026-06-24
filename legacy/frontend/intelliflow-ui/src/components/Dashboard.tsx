import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { ArrowRight, BarChart2, LineChart, PieChart, TrendingUp, Zap, Activity, Clock, CheckCircle } from "lucide-react";

interface DashboardProps {
  onStartAnalysis: () => void;
}

interface RecentAnalysis {
  id: string;
  type: string;
  date: string;
  status: string;
  insights: number;
}

export function Dashboard({ onStartAnalysis }: DashboardProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [isHovered, setIsHovered] = useState(false);
  const [recentAnalyses] = useState<RecentAnalysis[]>([
    { id: "a1b2c3", type: "Customer Feedback", date: "2025-06-05", status: "completed", insights: 12 },
    { id: "d4e5f6", type: "Sales Trends", date: "2025-06-03", status: "completed", insights: 8 },
    { id: "g7h8i9", type: "Product Performance", date: "2025-05-28", status: "completed", insights: 15 }
  ]);
  
  const getAnalysisTypeIcon = (type: string) => {
    switch (type) {
      case "Customer Feedback":
        return <PieChart className="h-5 w-5 text-blue-500" />;
      case "Sales Trends":
        return <LineChart className="h-5 w-5 text-green-500" />;
      case "Product Performance":
        return <BarChart2 className="h-5 w-5 text-purple-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/20 via-primary/10 to-background p-8 md:p-10">
        <div className="absolute inset-0 bg-grid-white/10" />
        <div className="relative z-10">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Welcome to <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-500">IntelliFlow</span>
          </h1>
          <p className="mt-3 text-muted-foreground max-w-2xl">
            Harness the power of AI-driven data analysis to extract meaningful insights, identify patterns, and make data-driven decisions with our sophisticated multi-agent platform.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Button 
              size="lg" 
              className="group"
              onClick={onStartAnalysis}
            >
              <span>Start New Analysis</span>
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button 
              variant="outline" 
              size="lg"
            >
              Explore Features
            </Button>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
      </div>
      
      {/* Tabs */}
      <div>
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="recent">Recent Analyses</TabsTrigger>
            <TabsTrigger value="insights">Key Insights</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Total Analyses</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">24</div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center">
                    <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                    <span>+12% from last month</span>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Insights Generated</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">187</div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center">
                    <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                    <span>+24% from last month</span>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Data Sources</CardTitle>
                  <BarChart2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">8</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    <span>BigQuery, Cloud Storage, and more</span>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Analysis Types</CardTitle>
                  <PieChart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">6</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    <span>Feedback, Sales, Performance, and more</span>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Feature Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="card-hover-effect">
                <CardHeader>
                  <div className="rounded-full w-10 h-10 flex items-center justify-center bg-primary/10 mb-2">
                    <PieChart className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle>Intelligent Analysis</CardTitle>
                  <CardDescription>
                    Leverage AI-powered agents to analyze your data.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Our specialized agents work together to extract meaningful insights from your data, identifying patterns and trends that might otherwise go unnoticed.
                  </p>
                </CardContent>
                <CardFooter>
                  <Button variant="ghost" className="w-full justify-start p-0 h-auto text-primary">
                    <span>Learn more</span>
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
              
              <Card className="card-hover-effect">
                <CardHeader>
                  <div className="rounded-full w-10 h-10 flex items-center justify-center bg-blue-500/10 mb-2">
                    <Zap className="h-5 w-5 text-blue-500" />
                  </div>
                  <CardTitle>Automated Insights</CardTitle>
                  <CardDescription>
                    Discover actionable insights automatically.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    IntelliFlow automatically generates insights and recommendations based on your data, helping you make informed decisions quickly.
                  </p>
                </CardContent>
                <CardFooter>
                  <Button variant="ghost" className="w-full justify-start p-0 h-auto text-primary">
                    <span>Learn more</span>
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
              
              <Card className="card-hover-effect">
                <CardHeader>
                  <div className="rounded-full w-10 h-10 flex items-center justify-center bg-green-500/10 mb-2">
                    <BarChart2 className="h-5 w-5 text-green-500" />
                  </div>
                  <CardTitle>Visual Storytelling</CardTitle>
                  <CardDescription>
                    Transform data into compelling narratives.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Our platform creates visual representations and narratives that make complex data easy to understand and share with stakeholders.
                  </p>
                </CardContent>
                <CardFooter>
                  <Button variant="ghost" className="w-full justify-start p-0 h-auto text-primary">
                    <span>Learn more</span>
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            </div>
            
            {/* Call to Action */}
            <Card 
              className={`relative overflow-hidden transition-all duration-300 ${isHovered ? 'shadow-lg' : ''}`}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-background z-0"></div>
              <CardHeader className="relative z-10">
                <CardTitle className="text-2xl">Start Your Analysis Journey</CardTitle>
                <CardDescription>
                  Begin exploring your data with IntelliFlow's powerful analysis tools.
                </CardDescription>
              </CardHeader>
              <CardContent className="relative z-10">
                <p className="text-sm text-muted-foreground mb-6">
                  Whether you're analyzing customer feedback, sales trends, or product performance, IntelliFlow provides the tools you need to extract valuable insights and make data-driven decisions.
                </p>
                <Button 
                  size="lg" 
                  className="w-full md:w-auto group"
                  onClick={onStartAnalysis}
                >
                  <span>Start New Analysis</span>
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="recent" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Analyses</CardTitle>
                <CardDescription>
                  Your most recent data analysis activities.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentAnalyses.map((analysis) => (
                    <div 
                      key={analysis.id}
                      className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="rounded-full p-2 bg-muted">
                          {getAnalysisTypeIcon(analysis.type)}
                        </div>
                        <div>
                          <h4 className="font-medium">{analysis.type}</h4>
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{formatDate(analysis.date)}</span>
                            <span>•</span>
                            <span>{analysis.insights} insights</span>
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className="flex items-center space-x-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span>Completed</span>
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full">View All Analyses</Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="insights" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Key Insights</CardTitle>
                <CardDescription>
                  Top insights from your recent analyses.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 rounded-lg border">
                    <div className="flex items-center space-x-2 mb-2">
                      <Badge>Customer Feedback</Badge>
                      <span className="text-xs text-muted-foreground">June 5, 2025</span>
                    </div>
                    <h4 className="font-semibold">Overall sentiment is primarily positive (72%)</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Customer feedback shows a strong positive sentiment overall, with particularly high scores for product quality.
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-lg border">
                    <div className="flex items-center space-x-2 mb-2">
                      <Badge variant="outline">Sales Trends</Badge>
                      <span className="text-xs text-muted-foreground">June 3, 2025</span>
                    </div>
                    <h4 className="font-semibold">Q2 sales increased by 18% compared to Q1</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      The second quarter showed significant growth across all product categories, with the highest increase in the premium segment.
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-lg border">
                    <div className="flex items-center space-x-2 mb-2">
                      <Badge variant="secondary">Product Performance</Badge>
                      <span className="text-xs text-muted-foreground">May 28, 2025</span>
                    </div>
                    <h4 className="font-semibold">Product A outperforms competitors by 35% in user satisfaction</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Comparative analysis shows that our flagship product significantly outperforms competitors in user satisfaction metrics.
                    </p>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full">View All Insights</Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

