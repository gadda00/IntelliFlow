import { useState, useEffect } from "react";
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
  FileText,
  Clock,
  Database,
  Brain,
  BarChart3,
  CheckCircle,
  Loader2,
  Sparkles,
  Target,
  Lightbulb,
  RefreshCw,
  Users,
  Activity,
  Eye,
  Settings
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
  agent?: string;
}

interface AgentResult {
  agent: string;
  status: string;
  confidence: number;
  result: any;
  processingTime: number;
}

interface EnhancedAnalysisResult {
  status: string;
  confidence: number;
  processingTime: number;
  agentResults: {
    [key: string]: AgentResult;
  };
  summary: {
    dataQuality: number;
    insightCount: number;
    recommendationCount: number;
    visualizationCount: number;
  };
  executiveSummary: string;
  keyFindings: any[];
  recommendations: any[];
  visualizations: any[];
  narrative: {
    executiveSummary: string;
    keyFindings: string;
    methodology: string;
    recommendations: string;
    conclusion: string;
    fullReport: string;
  };
}

export function AnalysisResults({ analysisId, analysisData, onNewAnalysis }: AnalysisResultsProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
  const [expandedRecommendation, setExpandedRecommendation] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<EnhancedAnalysisResult | null>(null);

  // Enhanced processing steps with agent information
  useEffect(() => {
    if (analysisId && !analysisData) {
      setIsProcessing(true);
      initializeProcessing();
    } else if (analysisData) {
      setAnalysisResult(analysisData.result || analysisData);
      setIsProcessing(false);
    }
  }, [analysisId, analysisData]);

  const initializeProcessing = () => {
    const steps: ProcessingStep[] = [
      {
        id: 'data-scout',
        title: 'Data Discovery & Validation',
        description: 'AI agent analyzing data structure, quality, and characteristics',
        status: 'running',
        progress: 0,
        icon: Database,
        agent: 'Data Scout'
      },
      {
        id: 'data-engineer',
        title: 'Data Processing & Cleaning',
        description: 'AI agent cleaning, transforming, and optimizing data quality',
        status: 'pending',
        progress: 0,
        icon: Settings,
        agent: 'Data Engineer'
      },
      {
        id: 'analysis-strategist',
        title: 'Analysis Strategy Planning',
        description: 'AI agent developing optimal analysis methodology and approach',
        status: 'pending',
        progress: 0,
        icon: Brain,
        agent: 'Analysis Strategist'
      },
      {
        id: 'insight-generator',
        title: 'AI-Powered Insight Generation',
        description: 'AI agent generating actionable insights and recommendations',
        status: 'pending',
        progress: 0,
        icon: Lightbulb,
        agent: 'Insight Generator'
      },
      {
        id: 'visualization-specialist',
        title: 'Dynamic Visualization Creation',
        description: 'AI agent creating interactive charts and visual representations',
        status: 'pending',
        progress: 0,
        icon: BarChart3,
        agent: 'Visualization Specialist'
      },
      {
        id: 'narrative-composer',
        title: 'Comprehensive Report Generation',
        description: 'AI agent compiling executive summary and detailed narrative',
        status: 'pending',
        progress: 0,
        icon: FileText,
        agent: 'Narrative Composer'
      }
    ];

    setProcessingSteps(steps);
    simulateProcessing(steps);
  };

  const simulateProcessing = async (steps: ProcessingStep[]) => {
    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(i);
      
      // Update current step to running
      setProcessingSteps(prev => prev.map((step, index) => 
        index === i ? { ...step, status: 'running' } : step
      ));

      // Simulate progress for current step
      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setProcessingSteps(prev => prev.map((step, index) => 
          index === i ? { ...step, progress } : step
        ));
      }

      // Mark current step as completed
      setProcessingSteps(prev => prev.map((step, index) => 
        index === i ? { ...step, status: 'completed', progress: 100 } : step
      ));

      // Start next step
      if (i < steps.length - 1) {
        setProcessingSteps(prev => prev.map((step, index) => 
          index === i + 1 ? { ...step, status: 'running' } : step
        ));
      }
    }

    // Complete processing after 3 seconds
    setTimeout(() => {
      setIsProcessing(false);
      // Simulate receiving analysis result with enhanced data
      const mockResult: EnhancedAnalysisResult = {
        status: 'completed',
        confidence: 0.92,
        processingTime: 45000,
        agentResults: {
          'data-scout': {
            agent: 'Data Scout',
            status: 'completed',
            confidence: 0.95,
            result: { dataQuality: 0.95, recordCount: 1250 },
            processingTime: 8000
          },
          'insight-generator': {
            agent: 'Insight Generator',
            status: 'completed',
            confidence: 0.89,
            result: { insightCount: 7 },
            processingTime: 12000
          }
        },
        summary: {
          dataQuality: 0.95,
          insightCount: 7,
          recommendationCount: 5,
          visualizationCount: 4
        },
        executiveSummary: 'Comprehensive analysis reveals strong data patterns with high-confidence insights for strategic decision-making.',
        keyFindings: [
          {
            title: 'Significant Growth Trend Identified',
            description: 'Data shows consistent 15% month-over-month growth pattern with strong seasonal correlations.',
            confidence: 0.94
          },
          {
            title: 'Operational Efficiency Opportunities',
            description: 'Analysis reveals 3 key areas where process optimization could yield 20-30% efficiency gains.',
            confidence: 0.87
          },
          {
            title: 'Customer Behavior Patterns',
            description: 'Distinct customer segments identified with varying engagement patterns and preferences.',
            confidence: 0.91
          }
        ],
        recommendations: [
          {
            title: 'Implement Predictive Analytics',
            description: 'Deploy machine learning models to forecast demand and optimize resource allocation.',
            priority: 'high',
            impact: 'high',
            effort: 'medium'
          },
          {
            title: 'Enhance Customer Segmentation',
            description: 'Develop targeted marketing strategies based on identified customer behavior patterns.',
            priority: 'medium',
            impact: 'high',
            effort: 'low'
          }
        ],
        visualizations: [
          {
            title: 'Growth Trend Analysis',
            type: 'line',
            description: 'Monthly growth patterns over the analysis period',
            data: []
          },
          {
            title: 'Customer Segmentation',
            type: 'pie',
            description: 'Distribution of customer segments by behavior patterns',
            data: []
          }
        ],
        narrative: {
          executiveSummary: 'Our multi-agent analysis system has successfully processed your data, revealing significant patterns and actionable insights. The analysis demonstrates strong data quality and provides comprehensive recommendations for strategic decision-making.',
          keyFindings: 'The analysis identified several critical patterns including consistent growth trends, operational efficiency opportunities, and distinct customer behavior segments.',
          methodology: 'Advanced AI agents employed statistical analysis, pattern recognition, and machine learning techniques to extract insights.',
          recommendations: 'Strategic recommendations focus on predictive analytics implementation and enhanced customer segmentation for maximum business impact.',
          conclusion: 'The findings provide a robust foundation for data-driven decision making with high confidence levels and actionable next steps.',
          fullReport: 'Complete analysis available in the detailed sections below.'
        }
      };
      setAnalysisResult(mockResult);
    }, 3000);
  };

  const toggleInsight = (id: string) => {
    setExpandedInsight(expandedInsight === id ? null : id);
  };

  const toggleRecommendation = (id: string) => {
    setExpandedRecommendation(expandedRecommendation === id ? null : id);
  };

  // Enhanced PDF export with IntelliFlow branding
  const exportToPDF = async () => {
    if (!analysisResult) return;
    
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      
      // IntelliFlow Header
      doc.setFontSize(24);
      doc.setTextColor(37, 99, 235); // Blue color
      doc.text('IntelliFlow', 20, 30);
      doc.setFontSize(16);
      doc.setTextColor(100, 116, 139); // Gray color
      doc.text('Multi-Agent Data Analysis Report', 20, 45);
      
      // Executive Summary
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text('Executive Summary', 20, 70);
      doc.setFontSize(10);
      const summaryText = analysisResult.narrative?.executiveSummary || 'Comprehensive analysis completed successfully.';
      const splitSummary = doc.splitTextToSize(summaryText, 170);
      doc.text(splitSummary, 20, 85);
      
      // Key Findings
      let yPosition = 85 + (splitSummary.length * 5) + 15;
      doc.setFontSize(14);
      doc.text('Key Findings', 20, yPosition);
      yPosition += 15;
      
      if (analysisResult.keyFindings && analysisResult.keyFindings.length > 0) {
        analysisResult.keyFindings.slice(0, 5).forEach((finding, index) => {
          doc.setFontSize(10);
          doc.text(`${index + 1}. ${finding.title || finding.description || finding}`, 25, yPosition);
          yPosition += 10;
        });
      }
      
      // Recommendations
      yPosition += 10;
      doc.setFontSize(14);
      doc.text('Strategic Recommendations', 20, yPosition);
      yPosition += 15;
      
      if (analysisResult.recommendations && analysisResult.recommendations.length > 0) {
        analysisResult.recommendations.slice(0, 5).forEach((rec, index) => {
          doc.setFontSize(10);
          doc.text(`${index + 1}. ${rec.title || rec.description || rec}`, 25, yPosition);
          yPosition += 10;
        });
      }
      
      // Footer
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('Generated by IntelliFlow Multi-Agent Analysis System', 20, 280);
      doc.text(`Report Date: ${new Date().toLocaleDateString()}`, 20, 290);
      
      // Save the PDF
      doc.save(`IntelliFlow_Analysis_Report_${Date.now()}.pdf`);
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('PDF export failed. Please try again.');
    }
  };

  // Show processing animation
  if (isProcessing) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              IntelliFlow Multi-Agent Analysis in Progress
            </CardTitle>
            <CardDescription>
              Our AI agents are working together to analyze your data and generate comprehensive insights
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Estimated Time */}
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Estimated Time</span>
              </div>
              <span className="text-sm text-blue-700">
                {Math.max(1, Math.ceil((processingSteps.length - currentStep) * 0.5))} minutes remaining
              </span>
            </div>

            {/* Processing Steps */}
            <div className="space-y-3">
              {processingSteps.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.id} className="flex items-center gap-3 p-3 rounded-lg border">
                    <div className={`p-2 rounded-full ${
                      step.status === 'completed' ? 'bg-green-100 text-green-600' :
                      step.status === 'running' ? 'bg-blue-100 text-blue-600' :
                      'bg-gray-100 text-gray-400'
                    }`}>
                      {step.status === 'completed' ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : step.status === 'running' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">{step.title}</h4>
                        <Badge variant={step.status === 'completed' ? 'default' : 'secondary'}>
                          {step.agent}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{step.description}</p>
                      {step.status === 'running' && (
                        <Progress value={step.progress} className="mt-2 h-2" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Current Processing Info */}
            <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Brain className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-blue-900">
                  Processing your data with {processingSteps[currentStep]?.agent || 'AI Agent'}
                </span>
              </div>
              <p className="text-sm text-gray-600">
                Using advanced machine learning and statistical analysis techniques
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main results display
  if (!analysisResult) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Analysis Results Available</h3>
            <p className="text-gray-600 mb-4">
              Unable to load analysis results. Please try running the analysis again.
            </p>
            <Button onClick={onNewAnalysis}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Start New Analysis
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Header with Agent Summary */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Sparkles className="h-6 w-6 text-blue-600" />
                IntelliFlow Multi-Agent Analysis Complete
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Comprehensive analysis powered by 7 specialized AI agents
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">
                {Math.round((analysisResult.confidence || 0.9) * 100)}%
              </div>
              <div className="text-sm text-gray-600">Confidence Score</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-white rounded-lg">
              <div className="text-lg font-semibold text-green-600">
                {analysisResult.summary?.dataQuality ? Math.round(analysisResult.summary.dataQuality * 100) : 95}%
              </div>
              <div className="text-xs text-gray-600">Data Quality</div>
            </div>
            <div className="text-center p-3 bg-white rounded-lg">
              <div className="text-lg font-semibold text-blue-600">
                {analysisResult.summary?.insightCount || analysisResult.keyFindings?.length || 0}
              </div>
              <div className="text-xs text-gray-600">Key Insights</div>
            </div>
            <div className="text-center p-3 bg-white rounded-lg">
              <div className="text-lg font-semibold text-purple-600">
                {analysisResult.summary?.recommendationCount || analysisResult.recommendations?.length || 0}
              </div>
              <div className="text-xs text-gray-600">Recommendations</div>
            </div>
            <div className="text-center p-3 bg-white rounded-lg">
              <div className="text-lg font-semibold text-orange-600">
                {analysisResult.summary?.visualizationCount || analysisResult.visualizations?.length || 0}
              </div>
              <div className="text-xs text-gray-600">Visualizations</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Action Buttons */}
      <div className="flex gap-3">
        <Button onClick={exportToPDF} className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export IntelliFlow Report
        </Button>
        <Button variant="outline" onClick={onNewAnalysis}>
          <RefreshCw className="h-4 w-4 mr-2" />
          New Analysis
        </Button>
        <Button variant="outline">
          <Share2 className="h-4 w-4 mr-2" />
          Share Results
        </Button>
      </div>

      {/* Enhanced Results Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="agents">Agent Details</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Executive Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none">
                <p className="text-gray-700 leading-relaxed">
                  {analysisResult.narrative?.executiveSummary || analysisResult.executiveSummary || 
                   'Our multi-agent analysis system has successfully processed your data, revealing significant patterns and actionable insights. The analysis demonstrates strong data quality and provides comprehensive recommendations for strategic decision-making.'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Processing Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analysisResult.processingTime ? `${Math.round(analysisResult.processingTime / 1000)}s` : '< 1min'}
                </div>
                <p className="text-xs text-gray-600">Multi-agent coordination</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Analysis Depth</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">Deep</div>
                <p className="text-xs text-gray-600">Comprehensive coverage</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Actionability</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">High</div>
                <p className="text-xs text-gray-600">Ready for implementation</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Key Insights
              </CardTitle>
              <CardDescription>
                AI-generated insights from comprehensive data analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(analysisResult.keyFindings || []).map((insight, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm mb-2">
                        {insight.title || `Insight ${index + 1}`}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {insight.description || insight}
                      </p>
                      {insight.confidence && (
                        <div className="mt-2">
                          <Badge variant="secondary">
                            {Math.round(insight.confidence * 100)}% confidence
                          </Badge>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleInsight(index.toString())}
                    >
                      {expandedInsight === index.toString() ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {expandedInsight === index.toString() && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-sm text-gray-700">
                        {insight.details || 'This insight was generated through advanced pattern recognition and statistical analysis, providing actionable intelligence for strategic decision-making.'}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Strategic Recommendations
              </CardTitle>
              <CardDescription>
                Actionable recommendations based on analysis findings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(analysisResult.recommendations || []).map((rec, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium text-sm">
                          {rec.title || `Recommendation ${index + 1}`}
                        </h4>
                        {rec.priority && (
                          <Badge variant={rec.priority === 'high' ? 'destructive' : 'secondary'}>
                            {rec.priority} priority
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {rec.description || rec}
                      </p>
                      {(rec.impact || rec.effort) && (
                        <div className="mt-2 flex gap-2">
                          {rec.impact && (
                            <Badge variant="outline">Impact: {rec.impact}</Badge>
                          )}
                          {rec.effort && (
                            <Badge variant="outline">Effort: {rec.effort}</Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleRecommendation(index.toString())}
                    >
                      {expandedRecommendation === index.toString() ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {expandedRecommendation === index.toString() && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-sm text-gray-700">
                        {rec.details || 'This recommendation is based on comprehensive data analysis and industry best practices, designed to maximize impact while minimizing implementation complexity.'}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Agent Performance Details
              </CardTitle>
              <CardDescription>
                Detailed breakdown of each AI agent's contribution to the analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {analysisResult.agentResults && Object.entries(analysisResult.agentResults).map(([agentKey, agentData]) => (
                <div key={agentKey} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-blue-600" />
                      <h4 className="font-medium">{agentData.agent}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={agentData.status === 'completed' ? 'default' : 'secondary'}>
                        {agentData.status}
                      </Badge>
                      <span className="text-sm text-gray-600">
                        {Math.round(agentData.confidence * 100)}% confidence
                      </span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    Processing time: {Math.round(agentData.processingTime / 1000)}s
                  </div>
                  <div className="mt-2">
                    <Progress value={agentData.confidence * 100} className="h-2" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

