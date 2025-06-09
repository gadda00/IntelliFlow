import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { 
  Search, 
  Calendar, 
  Database, 
  MoreVertical, 
  Eye, 
  Trash2, 
  Download, 
  Share2,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Filter,
  SortAsc,
  SortDesc,
  FileText,
  BarChart3,
  TrendingUp,
  Users,
  ShoppingCart,
  MessageSquare,
  RefreshCw
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface AnalysisHistoryProps {
  analysisHistory: any[];
  onViewAnalysis: (id: string) => void;
  onDeleteAnalysis: (id: string) => void;
}

interface FilterOptions {
  status: string;
  type: string;
  dateRange: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export function AnalysisHistory({ analysisHistory, onViewAnalysis, onDeleteAnalysis }: AnalysisHistoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<FilterOptions>({
    status: "all",
    type: "all",
    dateRange: "all",
    sortBy: "createdAt",
    sortOrder: 'desc'
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500 hover:bg-green-600">Completed</Badge>;
      case 'running':
        return <Badge className="bg-blue-500 hover:bg-blue-600">Running</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getAnalysisTypeIcon = (type: string) => {
    switch (type) {
      case 'customer_feedback':
        return <MessageSquare className="h-4 w-4 text-purple-500" />;
      case 'sales_trends':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'product_performance':
        return <ShoppingCart className="h-4 w-4 text-blue-500" />;
      case 'user_behavior':
        return <Users className="h-4 w-4 text-orange-500" />;
      default:
        return <BarChart3 className="h-4 w-4 text-gray-500" />;
    }
  };

  const getAnalysisTypeName = (type: string) => {
    const typeNames: { [key: string]: string } = {
      'customer_feedback': 'Customer Feedback',
      'sales_trends': 'Sales Trends',
      'product_performance': 'Product Performance',
      'user_behavior': 'User Behavior',
      'custom': 'Custom Analysis'
    };
    return typeNames[type] || 'Data Analysis';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  const getProcessingTime = (analysis: any) => {
    if (analysis.status === 'running') {
      const startTime = new Date(analysis.createdAt);
      const now = new Date();
      const diffInMinutes = Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60));
      return `${diffInMinutes}m elapsed`;
    }
    return analysis.processingTime || 'N/A';
  };

  // Filter and sort analysis history
  const filteredAndSortedHistory = analysisHistory
    .filter(analysis => {
      // Search filter
      if (searchTerm && !analysis.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      // Status filter
      if (filters.status !== 'all' && analysis.status !== filters.status) {
        return false;
      }
      
      // Type filter
      if (filters.type !== 'all' && analysis.type !== filters.type) {
        return false;
      }
      
      // Date range filter
      if (filters.dateRange !== 'all') {
        const analysisDate = new Date(analysis.createdAt);
        const now = new Date();
        const diffInDays = Math.floor((now.getTime() - analysisDate.getTime()) / (1000 * 60 * 60 * 24));
        
        switch (filters.dateRange) {
          case 'today':
            if (diffInDays > 0) return false;
            break;
          case 'week':
            if (diffInDays > 7) return false;
            break;
          case 'month':
            if (diffInDays > 30) return false;
            break;
        }
      }
      
      return true;
    })
    .sort((a, b) => {
      let aValue, bValue;
      
      switch (filters.sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        default: // createdAt
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
      }
      
      if (filters.sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  // Get unique analysis types for filter dropdown
  const uniqueTypes = [...new Set(analysisHistory.map(a => a.type))];

  // Statistics
  const stats = {
    total: analysisHistory.length,
    completed: analysisHistory.filter(a => a.status === 'completed').length,
    running: analysisHistory.filter(a => a.status === 'running').length,
    failed: analysisHistory.filter(a => a.status === 'failed').length
  };

  if (analysisHistory.length === 0) {
    return (
      <div className="space-y-4">
        <Card className="border-dashed border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              No Analysis History
            </CardTitle>
            <CardDescription>
              Your analysis history will appear here once you start running analyses.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center space-y-6 py-10">
            <div className="p-8 rounded-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
              <FileText className="h-16 w-16 text-gray-400" />
            </div>
            <div className="space-y-2 text-center">
              <p className="text-xl font-semibold">Start Your First Analysis</p>
              <p className="text-sm text-muted-foreground max-w-md">
                Configure and run an analysis to see it appear in your history. All analyses are stored temporarily in your browser.
              </p>
            </div>
            <Button onClick={() => window.location.hash = '#configure'} size="lg" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Create Analysis
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-3xl font-bold tracking-tight">
              Analysis History
            </CardTitle>
            <CardDescription className="text-base">
              View and manage your analysis history. All data is stored locally in your browser.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Analyses</CardTitle>
            <FileText className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
            <Loader2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.running}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search analyses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Filters */}
            <div className="flex gap-2">
              <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={filters.type} onValueChange={(value) => setFilters(prev => ({ ...prev, type: value }))}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {uniqueTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {getAnalysisTypeName(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={filters.dateRange} onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value }))}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters(prev => ({ 
                  ...prev, 
                  sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc' 
                }))}
                className="gap-1"
              >
                {filters.sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                Sort
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analysis List */}
      <div className="space-y-4">
        {filteredAndSortedHistory.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <div className="space-y-2">
                <Filter className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-lg font-medium">No analyses found</p>
                <p className="text-sm text-muted-foreground">
                  Try adjusting your search or filter criteria.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredAndSortedHistory.map((analysis) => (
            <Card key={analysis.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Analysis Type Icon */}
                    <div className="p-2 rounded-lg bg-muted">
                      {getAnalysisTypeIcon(analysis.type)}
                    </div>
                    
                    {/* Analysis Info */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-lg">{analysis.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {getAnalysisTypeName(analysis.type)}
                            </Badge>
                            {getStatusBadge(analysis.status)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid gap-2 md:grid-cols-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Database className="h-3 w-3" />
                          <span>{analysis.dataSource}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(analysis.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{getProcessingTime(analysis)}</span>
                        </div>
                      </div>
                      
                      {/* Progress bar for running analyses */}
                      {analysis.status === 'running' && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>Processing...</span>
                            <span>In progress</span>
                          </div>
                          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full w-2/3 animate-pulse"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {analysis.status === 'completed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewAnalysis(analysis.id)}
                        className="gap-1"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                    )}
                    
                    {analysis.status === 'running' && (
                      <Button variant="outline" size="sm" disabled className="gap-1">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing
                      </Button>
                    )}
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {analysis.status === 'completed' && (
                          <>
                            <DropdownMenuItem onClick={() => onViewAnalysis(analysis.id)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Results
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Download className="h-4 w-4 mr-2" />
                              Export Report
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Share2 className="h-4 w-4 mr-2" />
                              Share
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        {analysis.status === 'running' && (
                          <>
                            <DropdownMenuItem>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Refresh Status
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem 
                          onClick={() => onDeleteAnalysis(analysis.id)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      
      {/* Footer Info */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              <span>
                Showing {filteredAndSortedHistory.length} of {analysisHistory.length} analyses
              </span>
            </div>
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              <span>Data stored locally in your browser</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

