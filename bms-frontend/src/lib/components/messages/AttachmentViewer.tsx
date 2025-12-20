'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/lib/components/ui/button';
import { X, Download, File, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/lib/utils';

interface Attachment {
  url: string;
  filename: string;
  type: string;
}

interface AttachmentViewerProps {
  attachments: Attachment[];
  className?: string;
}

export function AttachmentViewer({ attachments, className }: AttachmentViewerProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  if (attachments.length === 0) return null;

  const isImage = (type: string) => type.startsWith('image/');

  const handleImageClick = (url: string) => {
    if (isImage(attachments.find((a) => a.url === url)?.type || '')) {
      setPreviewImage(url);
    }
  };

  return (
    <>
      <div className={cn('flex flex-wrap gap-2 mt-2', className)}>
        {attachments.map((attachment, index) => (
          <div
            key={index}
            className={cn(
              'flex items-center gap-2 p-2 border rounded-lg',
              isImage(attachment.type) ? 'cursor-pointer hover:bg-accent' : 'bg-muted/50',
            )}
            onClick={() => handleImageClick(attachment.url)}
          >
            {isImage(attachment.type) ? (
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            ) : (
              <File className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-xs truncate max-w-[150px]">{attachment.filename}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={(e) => {
                e.stopPropagation();
                window.open(attachment.url, '_blank');
              }}
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] p-4">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-white"
              onClick={() => setPreviewImage(null)}
            >
              <X className="h-6 w-6" />
            </Button>
            <Image
              src={previewImage}
              alt="Preview"
              width={1200}
              height={800}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
              unoptimized
            />
          </div>
        </div>
      )}
    </>
  );
}
