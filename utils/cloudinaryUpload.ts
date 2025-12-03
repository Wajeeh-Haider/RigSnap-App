/**
 * Cloudinary image upload utility
 * Handles uploading images to Cloudinary cloud storage
 */

export interface CloudinaryUploadResponse {
  public_id: string;
  secure_url: string;
  url: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  created_at: string;
}

export interface CloudinaryUploadError {
  message: string;
  error?: any;
}

const CLOUDINARY_CONFIG = {
  cloudName: 'djcgbz8ud', // Your cloud name
  apiKey: '313475539929624',
  uploadPreset: 'parizah', // You'll need to create this preset in Cloudinary dashboard
};

/**
 * Upload image to Cloudinary with timeout and retry logic
 * @param imageUri - Local image URI from camera
 * @param options - Additional upload options
 * @returns Promise with upload result or error
 */
export async function uploadImageToCloudinary(
  imageUri: string,
  options: {
    folder?: string;
    publicId?: string;
    quality?: 'auto' | number;
    format?: 'auto' | 'jpg' | 'png' | 'webp';
    timeout?: number;
    retries?: number;
  } = {}
): Promise<CloudinaryUploadResponse> {
  const maxRetries = options.retries ?? 3;
  const timeoutMs = options.timeout ?? 30000; // 30 seconds default
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Cloudinary upload attempt ${attempt}/${maxRetries}`);
      
      // Create form data
      const formData = new FormData();
      
      // Add the image file
      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: `rigsnap_photo_${Date.now()}.jpg`,
      } as any);

      // Add upload parameters
      formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
      formData.append('cloud_name', CLOUDINARY_CONFIG.cloudName);
      
      // Add optional parameters (only those allowed for unsigned uploads)
      if (options.folder) {
        formData.append('folder', options.folder);
      }
      
      if (options.publicId) {
        formData.append('public_id', options.publicId);
      }
      
      // Note: quality and format parameters are not allowed in unsigned uploads
      // These must be configured in the upload preset along with transformations

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Upload timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      // Create upload promise
      const uploadPromise = fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
        {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      // Race between upload and timeout
      const response = await Promise.race([uploadPromise, timeoutPromise]);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Upload failed');
      }

      console.log('Cloudinary upload successful');
      return result as CloudinaryUploadResponse;
      
    } catch (error) {
      console.error(`Cloudinary upload attempt ${attempt} failed:`, error);
      
      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        throw {
          message: error instanceof Error ? error.message : 'Upload failed after all retries',
          error,
        } as CloudinaryUploadError;
      }
      
      // Wait before retry (exponential backoff)
      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      console.log(`Retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  // This should never be reached due to the throw in the loop
  throw {
    message: 'Upload failed after all retries',
    error: new Error('Unexpected error'),
  } as CloudinaryUploadError;
}

/**
 * Upload multiple images to Cloudinary
 * @param imageUris - Array of local image URIs
 * @param options - Upload options
 * @returns Promise with array of upload results
 */
export async function uploadMultipleImages(
  imageUris: string[],
  options: {
    folder?: string;
    quality?: 'auto' | number;
    format?: 'auto' | 'jpg' | 'png' | 'webp';
    onProgress?: (uploaded: number, total: number) => void;
  } = {}
): Promise<CloudinaryUploadResponse[]> {
  const results: CloudinaryUploadResponse[] = [];
  
  for (let i = 0; i < imageUris.length; i++) {
    try {
      const result = await uploadImageToCloudinary(imageUris[i], {
        ...options,
        publicId: `photo_${Date.now()}_${i}`,
      });
      
      results.push(result);
      
      // Call progress callback if provided
      if (options.onProgress) {
        options.onProgress(i + 1, imageUris.length);
      }
    } catch (error) {
      console.error(`Failed to upload image ${i}:`, error);
      // Continue with other uploads
    }
  }
  
  return results;
}

/**
 * Generate optimized image URL from Cloudinary
 * @param publicId - Cloudinary public ID
 * @param transformations - Image transformations
 * @returns Optimized image URL
 */
export function getOptimizedImageUrl(
  publicId: string,
  transformations: {
    width?: number;
    height?: number;
    crop?: 'fill' | 'fit' | 'limit' | 'scale';
    quality?: 'auto' | number;
    format?: 'auto' | 'jpg' | 'png' | 'webp';
  } = {}
): string {
  const baseUrl = `https://res.cloudinary.com/${CLOUDINARY_CONFIG.cloudName}/image/upload`;
  
  const transforms: string[] = [];
  
  if (transformations.width) transforms.push(`w_${transformations.width}`);
  if (transformations.height) transforms.push(`h_${transformations.height}`);
  if (transformations.crop) transforms.push(`c_${transformations.crop}`);
  if (transformations.quality) transforms.push(`q_${transformations.quality}`);
  if (transformations.format) transforms.push(`f_${transformations.format}`);
  
  const transformString = transforms.length > 0 ? transforms.join(',') + '/' : '';
  
  return `${baseUrl}/${transformString}${publicId}`;
}