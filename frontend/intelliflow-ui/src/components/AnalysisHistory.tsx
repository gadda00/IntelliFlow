import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { apiClient } from '../lib/api';

interface AnalysisHistoryProps {
  onViewAnalysis: (id: string) => void;
}

interface AnalysisHistoryItem {
  id: string;
  status: string;
  type: string;
  created_at: string;
  completed_at: string | null;
  sentiment?: number;
}

export function AnalysisHistory({ onViewAnalysis }: AnalysisHistoryProps) {
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setIsLoading(true);
        const response = await apiClient.getAnalysisHistory();
        
        if (response.status === 'success') {
          setHistory(response.history || []);
        } else {
          setError(response.message || 'Failed to fetch analysis history');
        }
        
        setIsLoading(false);
      } catch (error: any) {
        console.error('Failed to fetch analysis history:', error);
        setError(error.message || 'Failed to fetch analysis history');
        setIsLoading(false);
      }
    };
    
    fetchHistory();
  }, []);
  
  // Mock data for demonstration
  const mockHistory: AnalysisHistoryItem[] = [
    {
      id: "a1b2c3",
      status: "completed",
      type: "customer_feedback",
      created_at: "2025-05-18 14:30:22",
      completed_at: "2025-05-18 14:35:47",
      sentiment: 0.72
    },
    {
      id: "d4e5f6",
      status: "completed",
      type: "sales_trends",
      created_at: "2025-05-17 09:15:33",
      completed_at: "2025-05-17 09:22:18",
      sentiment: 0.58
    },
    {
      id: "g7h8i9",
      status: "failed",
      type: "product_performance",
      created_at: "2025-05-16 16:45:12",
      completed_at: null,
      sentiment: 0.0
    },
    {
      id: "j0k1l2",
      status: "completed",
      type: "customer_feedback",
      created_at: "2025-05-15 11:20:45",
      completed_at: "2025-05-15 11:28:33",
      sentiment: 0.45
    }
  ];
  
  const displayHistory = history.length > 0 ? history : mockHistory;
  
  const getAnalysisTypeLabel = (type: string) => {
    switch (type) {
      case "customer_feedback":
        return "Customer Feedback";
      case "sales_trends":
        return "Sales Trends";
      case "product_performance":
        return "Product Performance";
      default:
        return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Analysis History</CardTitle>
            <CardDescription>
              Loading your previous analyses...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="w-full space-y-2">
                    <div className="h-4 bg-muted rounded w-1/3 animate-pulse"></div>
                    <div className="h-3 bg-muted rounded w-1/4 animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Analysis History</CardTitle>
            <CardDescription>
              There was an error loading your analysis history.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-destructive/15 p-4 text-destructive">
              <p>{error}</p>
            </div>
            <Button className="mt-4" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Analysis History</CardTitle>
          <CardDescription>
            View and manage your previous analyses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {displayHistory.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No analysis history found.</p>
              <Button className="mt-4">Start Your First Analysis</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {displayHistory.map(analysis => (
                <div key={analysis.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="space-y-1 mb-2 md:mb-0">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium">{getAnalysisTypeLabel(analysis.type)}</h4>
                      <Badge variant={analysis.status === "completed" ? "default" : analysis.status === "failed" ? "destructive" : "outline"}>
                        {analysis.status.charAt(0).toUpperCase() + analysis.status.slice(1)}
                      </Badge>
                      {analysis.sentiment !== undefined && analysis.status === "completed" && (
                        <Badge variant={analysis.sentiment > 0.7 ? "default" : analysis.sentiment > 0.5 ? "outline" : "destructive"}>
                          Sentiment: {analysis.sentiment.toFixed(2)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Created: {formatDate(analysis.created_at)}
                      {analysis.completed_at && ` • Completed: ${formatDate(analysis.completed_at)}`}
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => onViewAnalysis(analysis.id)}
                    disabled={analysis.status !== "completed"}
                  >
                    View Results
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
