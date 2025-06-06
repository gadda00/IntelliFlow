import React, { useState, useRef } from "react";
import { Button } from "./button";
import { Progress } from "./progress";
import { Badge } from "./badge";
import { AlertCircle, FileText, Upload, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./alert";

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  maxSizeInMB?: number;
  acceptedFileTypes?: string[];
  label?: string;
  description?: string;
  className?: string;
}

export function FileUpload({
  onFilesSelected,
  maxFiles = 5,
  maxSizeInMB = 10,
  acceptedFileTypes = [".csv", ".xlsx", ".json"],
  label = "Upload Files",
  description = "Drag and drop your files here, or click to browse",
  className = "",
}: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const validateFiles = (fileList: FileList | File[]): File[] => {
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

    for (const file of fileArray) {
      // Check file size
      if (file.size > maxSizeInBytes) {
        setError(`File "${file.name}" exceeds the maximum size of ${maxSizeInMB}MB`);
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

      validFiles.push(file);
    }

    return validFiles;
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files.length > 0) {
      const validFiles = validateFiles(e.dataTransfer.files);
      if (validFiles.length > 0) {
        const newFiles = [...files, ...validFiles];
        setFiles(newFiles);
        simulateUpload(validFiles);
        onFilesSelected(newFiles);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const validFiles = validateFiles(e.target.files);
      if (validFiles.length > 0) {
        const newFiles = [...files, ...validFiles];
        setFiles(newFiles);
        simulateUpload(validFiles);
        onFilesSelected(newFiles);
      }
    }
  };

  const handleRemoveFile = (fileToRemove: File) => {
    const updatedFiles = files.filter(file => file !== fileToRemove);
    setFiles(updatedFiles);
    onFilesSelected(updatedFiles);
    
    // Remove progress for this file
    const newProgress = { ...uploadProgress };
    delete newProgress[fileToRemove.name];
    setUploadProgress(newProgress);
  };

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Simulate file upload progress
  const simulateUpload = (newFiles: File[]) => {
    for (const file of newFiles) {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.floor(Math.random() * 10) + 5;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
        }
        setUploadProgress(prev => ({
          ...prev,
          [file.name]: progress
        }));
      }, 300);
    }
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'csv':
        return <FileText className="h-4 w-4 text-green-500" />;
      case 'xlsx':
      case 'xls':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'json':
        return <FileText className="h-4 w-4 text-amber-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

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
          <div className="text-xs text-muted-foreground">
            {description}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="outline">
              Max {maxFiles} files
            </Badge>
            <Badge variant="outline">
              Max {maxSizeInMB}MB per file
            </Badge>
            {acceptedFileTypes.length > 0 && (
              <Badge variant="outline">
                {acceptedFileTypes.join(', ')}
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
            {files.map((file, index) => (
              <div key={`${file.name}-${index}`} className="flex items-center justify-between p-2 border rounded-md">
                <div className="flex items-center space-x-2 overflow-hidden">
                  {getFileIcon(file.name)}
                  <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)}MB
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {uploadProgress[file.name] < 100 ? (
                    <div className="w-24">
                      <Progress value={uploadProgress[file.name] || 0} className="h-2" />
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

