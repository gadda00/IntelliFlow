import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "./ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { apiClient } from '../lib/api';
import { 
  Search, 
  Filter, 
  Clock, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  ChevronRight,
  BarChart2,
  LineChart,
  PieChart,
  ThumbsUp,
  MessageSquare,
  Loader2
} from "lucide-react";

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
  insights?: number;
  records?: number;
}

export function AnalysisHistory({ onViewAnalysis }: AnalysisHistoryProps) {
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<AnalysisHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("list");
  
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setIsLoading(true);
        const response = await apiClient.getAnalysisHistory();
        
        if (response.status === 'success') {
          setHistory(response.history || mockHistory);
          setFilteredHistory(response.history || mockHistory);
        } else {
          setError(response.message || 'Failed to fetch analysis history');
          // Use mock data for demonstration
          setHistory(mockHistory);
          setFilteredHistory(mockHistory);
        }
        
        setIsLoading(false);
      } catch (error: any) {
        console.error('Failed to fetch analysis history:', error);
        setError(error.message || 'Failed to fetch analysis history');
        // Use mock data for demonstration
        setHistory(mockHistory);
        setFilteredHistory(mockHistory);
        setIsLoading(false);
      }
    };
    
    fetchHistory();
  }, []);
  
  // Apply filters when search query or filters change
  useEffect(() => {
    let filtered = [...history];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.type.toLowerCase().includes(query) || 
        item.id.toLowerCase().includes(query)
      );
    }
    
    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(item => item.status === statusFilter);
    }
    
    // Apply type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter(item => item.type === typeFilter);
    }
    
    setFilteredHistory(filtered);
  }, [searchQuery, statusFilter, typeFilter, history]);
  
  // Mock data for demonstration
  const mockHistory: AnalysisHistoryItem[] = [
    {
      id: "a1b2c3",
      status: "completed",
      type: "customer_feedback",
      created_at: "2025-06-05 14:30:22",
      completed_at: "2025-06-05 14:35:47",
      sentiment: 0.72,
      insights: 12,
      records: 10000
    },
    {
      id: "d4e5f6",
      status: "completed",
      type: "sales_trends",
      created_at: "2025-06-03 09:15:33",
      completed_at: "2025-06-03 09:22:18",
      sentiment: 0.58,
      insights: 8,
      records: 5000
    },
    {
      id: "g7h8i9",
      status: "failed",
      type: "product_performance",
      created_at: "2025-05-28 16:45:12",
      completed_at: null,
      insights: 0,
      records: 3000
    },
    {
      id: "j0k1l2",
      status: "completed",
      type: "customer_feedback",
      created_at: "2025-05-25 11:20:45",
      completed_at: "2025-05-25 11:28:33",
      sentiment: 0.45,
      insights: 10,
      records: 8000
    },
    {
      id: "m3n4o5",
      status: "running",
      type: "sales_trends",
      created_at: "2025-06-06 10:05:17",
      completed_at: null,
      records: 12000
    }
  ];
  
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
  
  const getAnalysisTypeIcon = (type: string) => {
    switch (type) {
      case "customer_feedback":
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case "sales_trends":
        return <LineChart className="h-4 w-4 text-green-500" />;
      case "product_performance":
        return <BarChart2 className="h-4 w-4 text-purple-500" />;
      default:
        return <PieChart className="h-4 w-4 text-amber-500" />;
    }
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-500">Completed</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "running":
        return <Badge variant="secondary" className="animate-pulse">Running</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };
  
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return 'just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    } else {
      return date.toLocaleDateString();
    }
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
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="h-10 w-10 rounded-full border-4 border-muted border-t-primary animate-spin"></div>
              <p className="text-sm text-muted-foreground">
                Retrieving your analysis history...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (error && history.length === 0) {
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
    <div className="space-y-6">
      <div>
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-3xl font-bold tracking-tight">
              Analysis History
            </CardTitle>
            <CardDescription className="text-base">
              View and manage your previous analyses.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
      
      <div>
        <Card>
          <CardHeader className="pb-0">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search analyses..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[130px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <span>Status</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="running">Running</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <span>Analysis Type</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="customer_feedback">Customer Feedback</SelectItem>
                    <SelectItem value="sales_trends">Sales Trends</SelectItem>
                    <SelectItem value="product_performance">Product Performance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="pt-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="list">List View</TabsTrigger>
                <TabsTrigger value="calendar">Calendar View</TabsTrigger>
              </TabsList>
              
              <TabsContent value="list" className="space-y-4">
                {filteredHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
                      <Calendar className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium">No analyses found</h3>
                    <p className="text-sm text-muted-foreground mt-1 mb-6">
                      {searchQuery || statusFilter !== "all" || typeFilter !== "all" 
                        ? "Try adjusting your filters to see more results." 
                        : "You haven't run any analyses yet."}
                    </p>
                    <Button onClick={() => window.location.href = "/configure"}>
                      Start Your First Analysis
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredHistory.map((analysis) => (
                      <Card 
                        key={analysis.id}
                        className="overflow-hidden hover:border-primary transition-colors"
                      >
                        <div className="flex flex-col md:flex-row">
                          <div className="flex-1 p-4 md:p-6">
                            <div className="flex items-center space-x-2 mb-2">
                              <div className="p-1.5 rounded-full bg-muted">
                                {getAnalysisTypeIcon(analysis.type)}
                              </div>
                              <h3 className="font-medium">{getAnalysisTypeLabel(analysis.type)}</h3>
                              {getStatusBadge(analysis.status)}
                            </div>
                            
                            <div className="flex flex-col md:flex-row md:items-center text-sm text-muted-foreground space-y-1 md:space-y-0 md:space-x-4 mb-4">
                              <div className="flex items-center">
                                <Clock className="h-3.5 w-3.5 mr-1.5" />
                                <span>Created: {formatTimeAgo(analysis.created_at)}</span>
                              </div>
                              {analysis.completed_at && (
                                <div className="flex items-center">
                                  <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                                  <span>Completed: {formatTimeAgo(analysis.completed_at)}</span>
                                </div>
                              )}
                            </div>
                            
                            {analysis.status === "completed" && (
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                                {analysis.sentiment !== undefined && (
                                  <div className="flex items-center space-x-2">
                                    <div className="p-1.5 rounded-full bg-blue-500/10">
                                      <ThumbsUp className="h-3.5 w-3.5 text-blue-500" />
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground">Sentiment</p>
                                      <p className="text-sm font-medium">{(analysis.sentiment * 100).toFixed(0)}%</p>
                                    </div>
                                  </div>
                                )}
                                
                                {analysis.insights !== undefined && (
                                  <div className="flex items-center space-x-2">
                                    <div className="p-1.5 rounded-full bg-amber-500/10">
                                      <PieChart className="h-3.5 w-3.5 text-amber-500" />
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground">Insights</p>
                                      <p className="text-sm font-medium">{analysis.insights}</p>
                                    </div>
                                  </div>
                                )}
                                
                                {analysis.records !== undefined && (
                                  <div className="flex items-center space-x-2">
                                    <div className="p-1.5 rounded-full bg-green-500/10">
                                      <BarChart2 className="h-3.5 w-3.5 text-green-500" />
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground">Records</p>
                                      <p className="text-sm font-medium">{analysis.records.toLocaleString()}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-end p-4 md:p-6 border-t md:border-t-0 md:border-l bg-muted/30">
                            <Button 
                              variant="outline" 
                              className="w-full md:w-auto"
                              onClick={() => onViewAnalysis(analysis.id)}
                              disabled={analysis.status !== "completed"}
                            >
                              <span>View Results</span>
                              <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="calendar" className="space-y-4">
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
                    <Calendar className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium">Calendar View Coming Soon</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-6">
                    We're working on a calendar view to help you visualize your analysis history over time.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
          
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => window.location.reload()}>
              Refresh
            </Button>
            <Button onClick={() => window.location.href = "/configure"}>
              New Analysis
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

