'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { getBannerImageUrl } from '@/lib/utils/bunnynet';

interface BannerUploadProps {
  onFileSelect: (file: File | null) => void;
  accept?: Record<string, string[]>;
  maxSize?: number;
  className?: string;
  currentImageUrl?: string;
  uploading?: boolean;
}

export function BannerUpload({
  onFileSelect,
  accept = {
    'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
  },
  maxSize = 10 * 1024 * 1024, // 10MB default for banners
  className = '',
  currentImageUrl,
  uploading = false
}: BannerUploadProps) {
  const [preview, setPreview] = useState<string | null>(
    currentImageUrl ? getBannerImageUrl(currentImageUrl, { width: 400, height: 200 }) : null
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: Array<{ errors: ReadonlyArray<{ code: string }> }>) => {
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors.some((e: { code: string }) => e.code === 'file-too-large')) {
        toast.error(`File is too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB`);
      } else if (rejection.errors.some((e: { code: string }) => e.code === 'file-invalid-type')) {
        toast.error('Invalid file type. Please select an image file.');
      } else {
        toast.error('File upload failed. Please try again.');
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setSelectedFile(file);
      onFileSelect(file);

      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);
    }
  }, [onFileSelect, maxSize]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple: false,
    disabled: uploading
  });

  const removeFile = useCallback(() => {
    setSelectedFile(null);
    setPreview(currentImageUrl ? getBannerImageUrl(currentImageUrl, { width: 400, height: 200 }) : null);
    onFileSelect(null);
  }, [onFileSelect, currentImageUrl]);

  return (
    <div className={className}>
      {!preview ? (
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors
            aspect-[1.91/1] flex items-center justify-center
            ${uploading 
              ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50' 
              : isDragActive 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }
          `}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-3 p-8">
            <Upload className={`w-12 h-12 ${uploading ? 'text-gray-300' : 'text-gray-400'}`} />
            <div className="text-sm">
              {uploading ? (
                <p className="text-gray-500 font-medium">Uploading banner...</p>
              ) : isDragActive ? (
                <p className="text-blue-600 font-medium">Drop the banner image here</p>
              ) : (
                <>
                  <p className="text-gray-600">
                    <span className="font-medium text-blue-600">Click to upload banner</span> or drag and drop
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    PNG, JPG, GIF up to {Math.round(maxSize / 1024 / 1024)}MB
                  </p>
                  <p className="text-gray-500 text-xs">
                    Recommended: 1200×630px (Twitter optimized)
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="relative">
          <div className="border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50">
            <div className="aspect-[1.91/1] relative">
              <img
                src={preview}
                alt="Banner preview"
                className="w-full h-full object-cover"
              />
              
              {/* Overlay with file info and controls */}
              <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                <div className="bg-white rounded-lg p-4 m-4 max-w-sm">
                  <div className="flex items-center gap-3">
                    <ImageIcon className="w-8 h-8 text-gray-400 flex-shrink-0" />
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {selectedFile?.name || 'Banner image'}
                      </p>
                      {selectedFile && (
                        <p className="text-xs text-gray-500">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={removeFile}
                      disabled={uploading}
                      className="p-1 hover:bg-gray-200 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Remove banner"
                    >
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Upload progress indicator */}
              {uploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="bg-white rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="text-sm font-medium text-gray-900">Uploading banner...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Replace button */}
          {!uploading && (
            <div className="mt-3 text-center">
              <div
                {...getRootProps()}
                className="inline-block cursor-pointer"
              >
                <input {...getInputProps()} />
                <button
                  type="button"
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium px-3 py-1 rounded-md hover:bg-blue-50 transition-colors"
                >
                  Replace banner image
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
