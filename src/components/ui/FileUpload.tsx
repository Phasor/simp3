'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { getProfilePictureUrl } from '@/lib/utils/bunnynet';

interface FileUploadProps {
  onFileSelect: (file: File | null) => void;
  accept?: Record<string, string[]>;
  maxSize?: number;
  className?: string;
  currentImageUrl?: string;
}

export function FileUpload({
  onFileSelect,
  accept = {
    'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
  },
  maxSize = 5 * 1024 * 1024, // 5MB default
  className = '',
  currentImageUrl
}: FileUploadProps) {
  const [preview, setPreview] = useState<string | null>(
    currentImageUrl ? getProfilePictureUrl(currentImageUrl, { width: 64, height: 64 }) : null
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
    multiple: false
  });

  const removeFile = useCallback(() => {
    setSelectedFile(null);
    setPreview(null);
    onFileSelect(null);
  }, [onFileSelect]);

  return (
    <div className={className}>
      {!preview ? (
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
            ${isDragActive 
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }
          `}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-gray-400" />
            <div className="text-sm">
              {isDragActive ? (
                <p className="text-blue-600 font-medium">Drop the image here</p>
              ) : (
                <>
                  <p className="text-gray-600">
                    <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    PNG, JPG, GIF up to {Math.round(maxSize / 1024 / 1024)}MB
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="relative">
          <div className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                {preview ? (
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-gray-400" />
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {selectedFile?.name || 'Profile picture'}
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
                className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                title="Remove image"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Replace button */}
          <div className="mt-2">
            <div
              {...getRootProps()}
              className="text-center cursor-pointer"
            >
              <input {...getInputProps()} />
              <button
                type="button"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Replace image
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
