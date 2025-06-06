import * as React from "react";
import { cn } from "../../lib/utils";
import { Button } from "./button";
import { Progress } from "./progress";
import { Alert, AlertDescription } from "./alert";

interface FileUploadProps {
  onFileSelect: (files: File[]) => void;
  onFileUpload?: (files: File[]) => Promise<void>;
  maxFileSize?: number; // in MB
  maxFiles?: number;
  acceptedFileTypes?: string[];
  className?: string;
  buttonText?: string;
  description?: string;
}

export function FileUpload({
  onFileSelect,
  onFileUpload,
  maxFileSize = 10, // Default 10MB
  maxFiles = 5, // Default 5 files
  acceptedFileTypes = [".csv", ".xlsx", ".json", ".txt"],
  className,
  buttonText = "Select Files",
  description = "Drag and drop files here or click to browse",
}: FileUploadProps) {
  const [files, setFiles] = React.useState<File[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    // Convert FileList to array
    const fileArray = Array.from(selectedFiles);
    
    // Validate file count
    if (fileArray.length > maxFiles) {
      setError(`You can only upload up to ${maxFiles} files at once.`);
      return;
    }
    
    // Validate file types and sizes
    const invalidFiles: string[] = [];
    const oversizedFiles: string[] = [];
    const validFiles: File[] = [];
    
    fileArray.forEach(file => {
      const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
      
      if (!acceptedFileTypes.includes(fileExtension) && !acceptedFileTypes.includes("*")) {
        invalidFiles.push(file.name);
      } else if (file.size > maxFileSize * 1024 * 1024) {
        oversizedFiles.push(file.name);
      } else {
        validFiles.push(file);
      }
    });
    
    if (invalidFiles.length > 0) {
      setError(`Invalid file type(s): ${invalidFiles.join(", ")}. Accepted types: ${acceptedFileTypes.join(", ")}`);
      return;
    }
    
    if (oversizedFiles.length > 0) {
      setError(`File(s) exceed the ${maxFileSize}MB limit: ${oversizedFiles.join(", ")}`);
      return;
    }
    
    setFiles(validFiles);
    setError(null);
    onFileSelect(validFiles);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleUpload = async () => {
    if (!onFileUpload || files.length === 0) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      // Simulate upload progress
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          const newProgress = prev + 10;
          if (newProgress >= 100) {
            clearInterval(interval);
            return 100;
          }
          return newProgress;
        });
      }, 300);
      
      await onFileUpload(files);
      
      // Ensure progress reaches 100%
      setUploadProgress(100);
      
      // Reset after upload
      setTimeout(() => {
        setFiles([]);
        setIsUploading(false);
        setUploadProgress(0);
      }, 1000);
      
    } catch (error) {
      setError("Upload failed. Please try again.");
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
          isUploading && "pointer-events-none opacity-70"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          multiple
          accept={acceptedFileTypes.join(",")}
          onChange={(e) => handleFileSelect(e.target.files)}
          disabled={isUploading}
        />
        
        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="rounded-full bg-muted p-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <div className="text-sm font-medium">{buttonText}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
          <div className="text-xs text-muted-foreground">
            Max {maxFiles} files, up to {maxFileSize}MB each
          </div>
          <div className="text-xs text-muted-foreground">
            Accepted formats: {acceptedFileTypes.join(", ")}
          </div>
        </div>
      </div>
      
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Selected Files:</div>
          <ul className="space-y-1">
            {files.map((file, index) => (
              <li key={index} className="text-sm flex justify-between items-center p-2 bg-muted rounded">
                <span className="truncate max-w-[70%]">{file.name}</span>
                <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
              </li>
            ))}
          </ul>
          
          {isUploading ? (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          ) : onFileUpload ? (
            <Button onClick={handleUpload} className="w-full">
              Upload {files.length} {files.length === 1 ? "File" : "Files"}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

