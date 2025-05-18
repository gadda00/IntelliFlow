import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";

interface DashboardProps {
  onStartAnalysis: () => void;
}

export function Dashboard({ onStartAnalysis }: DashboardProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight gradient-text">Welcome to IntelliFlow</h1>
        <p className="text-muted-foreground">
          A sophisticated multi-agent data analysis and insights platform.
        </p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="card-hover-effect">
          <CardHeader>
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
        </Card>
        
        <Card className="card-hover-effect">
          <CardHeader>
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
        </Card>
        
        <Card className="card-hover-effect">
          <CardHeader>
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
        </Card>
      </div>
      
      <Card 
        className={`relative overflow-hidden transition-all duration-300 ${isHovered ? 'shadow-lg' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-primary/5 z-0"></div>
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
            className="w-full md:w-auto"
            onClick={onStartAnalysis}
          >
            Start New Analysis
          </Button>
        </CardContent>
      </Card>
      
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Updates</CardTitle>
            <CardDescription>
              Latest improvements to the platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-l-4 border-primary pl-4">
                <h4 className="text-sm font-medium">Enhanced Visualization Engine</h4>
                <p className="text-sm text-muted-foreground">
                  New visualization capabilities for better data representation.
                </p>
              </div>
              <div className="border-l-4 border-primary pl-4">
                <h4 className="text-sm font-medium">Improved Insight Generation</h4>
                <p className="text-sm text-muted-foreground">
                  More accurate and relevant insights from your data.
                </p>
              </div>
              <div className="border-l-4 border-primary pl-4">
                <h4 className="text-sm font-medium">New Data Source Integrations</h4>
                <p className="text-sm text-muted-foreground">
                  Connect to more data sources for comprehensive analysis.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>
              Quick tips to make the most of IntelliFlow.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="bg-primary/10 rounded-full p-2 mt-0.5">
                  <span className="text-primary font-medium text-sm">1</span>
                </div>
                <div>
                  <h4 className="text-sm font-medium">Configure Your Data Source</h4>
                  <p className="text-sm text-muted-foreground">
                    Connect to your data source to begin analysis.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="bg-primary/10 rounded-full p-2 mt-0.5">
                  <span className="text-primary font-medium text-sm">2</span>
                </div>
                <div>
                  <h4 className="text-sm font-medium">Select Analysis Objectives</h4>
                  <p className="text-sm text-muted-foreground">
                    Choose what you want to learn from your data.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="bg-primary/10 rounded-full p-2 mt-0.5">
                  <span className="text-primary font-medium text-sm">3</span>
                </div>
                <div>
                  <h4 className="text-sm font-medium">Review and Share Insights</h4>
                  <p className="text-sm text-muted-foreground">
                    Explore the generated insights and share with your team.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
