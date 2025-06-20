import React, { useState, useRef } from "react";
import { Button } from "./button";
import { Progress } from "./progress";
import { Badge } from "./badge";
import { AlertCircle, FileText, Upload, X, Database, FileSpreadsheet, FileCode } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./alert";

interface FileUploadProps {
  onFilesSelected: (files: { file: File; content: string }[]) => void;
  maxFiles?: number;
  maxSizeInMB?: number;
  acceptedFileTypes?: string[];
  label?: string;
  description?: string;
  className?: string;
  analysisType?: string;
}

export function FileUpload({
  onFilesSelected,
  maxFiles = 10,
  maxSizeInMB = 50,
  acceptedFileTypes = [".csv", ".xlsx", ".xls", ".json", ".txt", ".tsv", ".parquet"],
  label = "Upload Data Files",
  description = "Drag and drop your data files here, or click to browse",
  className = "",
  analysisType = "",
}: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [fileAnalysis, setFileAnalysis] = useState<Record<string, any>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;

  // Enhanced file type detection and validation
  const getRecommendedFileTypes = (analysisType: string): string[] => {
    switch (analysisType) {
      case "customer_feedback":
        return [".csv", ".xlsx", ".json", ".txt"];
      case "sales_trends":
        return [".csv", ".xlsx", ".parquet"];
      case "product_performance":
        return [".csv", ".xlsx", ".json"];
      default:
        return [".csv", ".xlsx", ".xls", ".json", ".txt", ".tsv", ".parquet"];
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  // Helper function to read file content
  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target?.result as string);
      };
      reader.onerror = () => {
        reject(new Error(`Failed to read file: ${file.name}`));
      };
      reader.readAsText(file);
    });
  };

  const analyzeFile = async (file: File): Promise<any> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const analysis: any = {
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          estimatedRows: 0,
          estimatedColumns: 0,
          dataTypes: [],
          preview: "",
        };

        try {
          if (file.name.endsWith('.csv') || file.name.endsWith('.tsv')) {
            const lines = content.split('\n').filter(line => line.trim());
            const delimiter = file.name.endsWith('.tsv') ? '\t' : ',';
            const headers = lines[0]?.split(delimiter) || [];
            
            analysis.estimatedRows = lines.length - 1;
            analysis.estimatedColumns = headers.length;
            analysis.dataTypes = headers.map(header => ({ name: header.trim(), type: 'string' }));
            analysis.preview = lines.slice(0, 3).join('\n');
          } else if (file.name.endsWith('.json')) {
            const jsonData = JSON.parse(content);
            if (Array.isArray(jsonData)) {
              analysis.estimatedRows = jsonData.length;
              if (jsonData.length > 0) {
                analysis.estimatedColumns = Object.keys(jsonData[0]).length;
                analysis.dataTypes = Object.keys(jsonData[0]).map(key => ({ 
                  name: key, 
                  type: typeof jsonData[0][key] 
                }));
              }
            } else {
              analysis.estimatedColumns = Object.keys(jsonData).length;
              analysis.dataTypes = Object.keys(jsonData).map(key => ({ 
                name: key, 
                type: typeof jsonData[key] 
              }));
            }
            analysis.preview = JSON.stringify(jsonData, null, 2).substring(0, 200) + '...';
          } else if (file.name.endsWith('.txt')) {
            const lines = content.split('\n').filter(line => line.trim());
            analysis.estimatedRows = lines.length;
            analysis.estimatedColumns = 1;
            analysis.dataTypes = [{ name: 'text', type: 'string' }];
            analysis.preview = lines.slice(0, 3).join('\n');
          }
        } catch (error) {
          console.warn('Error analyzing file:', error);
          analysis.preview = content.substring(0, 200) + '...';
        }

        resolve(analysis);
      };

      reader.onerror = () => {
        resolve({
          name: file.name,
          size: file.size,
          type: file.type,
          error: 'Failed to read file'
        });
      };

      // Read only first 10KB for analysis to avoid performance issues
      reader.readAsText(file);
    });
  };

  const validateFiles = async (fileList: FileList | File[]): Promise<File[]> => {
    const validFiles: File[] = [];
    const currentFiles = files.length;
    setError(null);

    // Convert FileList to array
    const fileArray = Array.from(fileList);

    // Check if adding these files would exceed the max files limit
    if (currentFiles + fileArray.length > maxFiles) {
      setError(`You can only upload a maximum of ${maxFiles} files`);
      return validFiles;
    }

    const recommendedTypes = getRecommendedFileTypes(analysisType);

    for (const file of fileArray) {
      // Check file size
      if (file.size > maxSizeInBytes) {
        setError(`File "${file.name}" exceeds the maximum size of ${maxSizeInMB}MB`);
        continue;
      }

      // Check if file is empty
      if (file.size === 0) {
        setError(`File "${file.name}" is empty`);
        continue;
      }

      // Check file type if acceptedFileTypes is provided
      if (acceptedFileTypes.length > 0) {
        const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
        if (!acceptedFileTypes.includes(fileExtension) && !acceptedFileTypes.includes(file.type)) {
          setError(`File "${file.name}" has an unsupported format. Accepted formats: ${acceptedFileTypes.join(', ')}`);
          continue;
        }
      }

      // Warn if file type is not recommended for the analysis type
      if (analysisType && recommendedTypes.length > 0) {
        const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
        if (!recommendedTypes.includes(fileExtension)) {
          console.warn(`File "${file.name}" may not be optimal for ${analysisType} analysis. Recommended: ${recommendedTypes.join(', ')}`);
        }
      }

      validFiles.push(file);
    }

    // Analyze valid files
    for (const file of validFiles) {
      try {
        const analysis = await analyzeFile(file);
        setFileAnalysis(prev => ({
          ...prev,
          [file.name]: analysis
        }));
      } catch (error) {
        console.warn(`Failed to analyze file ${file.name}:`, error);
      }
    }

    return validFiles;
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files.length > 0) {
      const validFiles = await validateFiles(e.dataTransfer.files);
      if (validFiles.length > 0) {
        const newFiles = [...files, ...validFiles];
        setFiles(newFiles);
        simulateUpload(validFiles);
        
        // Read file contents and pass to parent
        const filesWithContent = await Promise.all(
          newFiles.map(async (file) => {
            const content = await readFileContent(file);
            return { file, content };
          })
        );
        onFilesSelected(filesWithContent);
      }
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const validFiles = await validateFiles(e.target.files);
      if (validFiles.length > 0) {
        const newFiles = [...files, ...validFiles];
        setFiles(newFiles);
        simulateUpload(validFiles);
        
        // Read file contents and pass to parent
        const filesWithContent = await Promise.all(
          newFiles.map(async (file) => {
            const content = await readFileContent(file);
            return { file, content };
          })
        );
        onFilesSelected(filesWithContent);
      }
    }
  };

  const handleRemoveFile = async (fileToRemove: File) => {
    const updatedFiles = files.filter(file => file !== fileToRemove);
    setFiles(updatedFiles);
    
    // Read file contents and pass to parent
    const filesWithContent = await Promise.all(
      updatedFiles.map(async (file) => {
        const content = await readFileContent(file);
        return { file, content };
      })
    );
    onFilesSelected(filesWithContent);
    
    // Remove progress and analysis for this file
    const newProgress = { ...uploadProgress };
    const newAnalysis = { ...fileAnalysis };
    delete newProgress[fileToRemove.name];
    delete newAnalysis[fileToRemove.name];
    setUploadProgress(newProgress);
    setFileAnalysis(newAnalysis);
  };

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Simulate file upload progress with more realistic timing
  const simulateUpload = (newFiles: File[]) => {
    for (const file of newFiles) {
      let progress = 0;
      const fileSize = file.size;
      const uploadSpeed = 1024 * 1024; // 1MB per second simulation
      const totalTime = Math.max(1000, (fileSize / uploadSpeed) * 1000); // Minimum 1 second
      const interval = 100; // Update every 100ms
      const increment = (100 / totalTime) * interval;

      const progressInterval = setInterval(() => {
        progress += increment + Math.random() * 2; // Add some randomness
        if (progress >= 100) {
          progress = 100;
          clearInterval(progressInterval);
        }
        setUploadProgress(prev => ({
          ...prev,
          [file.name]: Math.round(progress)
        }));
      }, interval);
    }
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'csv':
      case 'tsv':
        return <Database className="h-4 w-4 text-green-500" />;
      case 'xlsx':
      case 'xls':
        return <FileSpreadsheet className="h-4 w-4 text-blue-500" />;
      case 'json':
        return <FileCode className="h-4 w-4 text-amber-500" />;
      case 'txt':
        return <FileText className="h-4 w-4 text-gray-500" />;
      case 'parquet':
        return <Database className="h-4 w-4 text-purple-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const recommendedTypes = getRecommendedFileTypes(analysisType);

  return (
    <div className={`space-y-4 ${className}`}>
      <div
        className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
          isDragging ? "border-primary bg-primary/5" : "border-gray-300"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="rounded-full bg-primary/10 p-2">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground text-center">
            {description}
          </div>
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            <Badge variant="outline">
              Max {maxFiles} files
            </Badge>
            <Badge variant="outline">
              Max {maxSizeInMB}MB per file
            </Badge>
            {analysisType && recommendedTypes.length > 0 && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                Recommended: {recommendedTypes.slice(0, 3).join(', ')}
                {recommendedTypes.length > 3 && '...'}
              </Badge>
            )}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2"
            onClick={handleButtonClick}
          >
            Choose Files
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept={acceptedFileTypes.join(',')}
            onChange={handleFileInputChange}
          />
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Selected Files ({files.length}/{maxFiles})</div>
          <div className="space-y-2">
            {files.map((file, index) => {
              const analysis = fileAnalysis[file.name];
              const progress = uploadProgress[file.name] || 0;
              
              return (
                <div key={`${file.name}-${index}`} className="border rounded-md overflow-hidden">
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center space-x-2 overflow-hidden flex-1">
                      {getFileIcon(file.name)}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{file.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatFileSize(file.size)}
                          {analysis && analysis.estimatedRows > 0 && (
                            <span> • ~{analysis.estimatedRows.toLocaleString()} rows</span>
                          )}
                          {analysis && analysis.estimatedColumns > 0 && (
                            <span> • {analysis.estimatedColumns} columns</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {progress < 100 ? (
                        <div className="w-24">
                          <Progress value={progress} className="h-2" />
                          <div className="text-xs text-center mt-1">{progress}%</div>
                        </div>
                      ) : (
                        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                          Ready
                        </Badge>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => handleRemoveFile(file)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {analysis && analysis.dataTypes && analysis.dataTypes.length > 0 && (
                    <div className="px-3 pb-3 border-t bg-muted/20">
                      <div className="text-xs text-muted-foreground mt-2 mb-1">Detected columns:</div>
                      <div className="flex flex-wrap gap-1">
                        {analysis.dataTypes.slice(0, 5).map((col: any, idx: number) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {col.name}
                          </Badge>
                        ))}
                        {analysis.dataTypes.length > 5 && (
                          <Badge variant="secondary" className="text-xs">
                            +{analysis.dataTypes.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

