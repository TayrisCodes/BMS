'use client';

import { useState, useRef } from 'react';
import { Button } from '@/lib/components/ui/button';
import { X, Upload, File, Image as ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/lib/utils';

interface Attachment {
  url: string;
  filename: string;
  type: string;
  size: number;
}

interface AttachmentUploadProps {
  conversationId: string;
  onAttachmentsUploaded: (attachments: Attachment[]) => void;
  maxFiles?: number;
}

export function AttachmentUpload({
  conversationId,
  onAttachmentsUploaded,
  maxFiles = 5,
}: AttachmentUploadProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    if (fileArray.length + attachments.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      fileArray.forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch(`/api/conversations/${conversationId}/messages/attachments`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload files');
      }

      const data = await response.json();
      const newAttachments = [...attachments, ...data.attachments];
      setAttachments(newAttachments);
      onAttachmentsUploaded(newAttachments);
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.message || 'Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = (index: number) => {
    const newAttachments = attachments.filter((_, i) => i !== index);
    setAttachments(newAttachments);
    onAttachmentsUploaded(newAttachments);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const isImage = (type: string) => type.startsWith('image/');

  return (
    <div className="space-y-2">
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-4 transition-colors',
          dragActive ? 'border-primary bg-primary/5' : 'border-muted',
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || attachments.length >= maxFiles}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Attach Files
              </>
            )}
          </Button>
          <span className="text-xs text-muted-foreground">
            {attachments.length}/{maxFiles} files
          </span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
          accept="image/*,.pdf,.doc,.docx,.txt"
        />
        <p className="text-xs text-muted-foreground mt-2">
          Drag and drop files here, or click to select. Max 10MB per file.
        </p>
      </div>

      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment, index) => (
            <div key={index} className="flex items-center gap-2 p-2 border rounded-lg bg-muted/50">
              {isImage(attachment.type) ? (
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
              ) : (
                <File className="h-4 w-4 text-muted-foreground" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{attachment.filename}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(attachment.size)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => handleRemove(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
