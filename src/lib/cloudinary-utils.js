import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Generate Cloudinary unsigned upload preset for client-side uploads
 * Note: This should be created in Cloudinary dashboard
 */
export function getCloudinaryConfig() {
  return {
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
  };
}

/**
 * Sign a Cloudinary upload call (server-side)
 */
export async function signCloudinaryUpload(params) {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    
    const signatureParams = {
      timestamp,
      ...params,
    };
    
    const signature = cloudinary.utils.build_upload_params(signatureParams).signature;
    
    return {
      timestamp,
      signature,
      ...signatureParams,
    };
  } catch (error) {
    console.error('Error signing Cloudinary upload:', error);
    throw error;
  }
}

/**
 * Upload file to Cloudinary (server-side fallback)
 */
export async function uploadToCloudinary(file, options = {}) {
  try {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'auto',
        folder: 'drais-communication',
        ...options,
      },
      (error, result) => {
        if (error) throw error;
        return result;
      }
    );
    
    return new Promise((resolve, reject) => {
      uploadStream.on('finish', () => {
        resolve(uploadStream.result);
      });
      uploadStream.on('error', reject);
      
      uploadStream.write(file);
      uploadStream.end();
    });
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
}

/**
 * Delete file from Cloudinary
 */
export async function deleteFromCloudinary(publicId) {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
}

/**
 * Get optimized media URL from Cloudinary
 * Handles images, videos, audio
 */
export function getOptimizedMediaUrl(publicId, options = {}) {
  try {
    const defaults = {
      quality: 'auto',
      fetch_format: 'auto',
    };
    
    // For images, add transformations
    if (options.type === 'image') {
      return cloudinary.url(publicId, {
        ...defaults,
        width: options.width || 800,
        height: options.height || 600,
        crop: options.crop || 'fill',
        gravity: 'auto',
      });
    }
    
    // For videos, add video-specific transformations
    if (options.type === 'video') {
      return cloudinary.url(publicId, {
        resource_type: 'video',
        quality: 'auto',
        width: options.width || 640,
        height: options.height || 480,
      });
    }
    
    // For audio, just return the URL
    if (options.type === 'audio') {
      return cloudinary.url(publicId, {
        resource_type: 'video', // Audio files are stored as video in Cloudinary
      });
    }
    
    // For documents/files, no transformations
    return cloudinary.url(publicId);
  } catch (error) {
    console.error('Error generating optimized URL:', error);
    return publicId; // Fallback to public ID
  }
}

/**
 * Validate file before upload
 */
export function validateMediaFile(file, allowedTypes = [], maxSizeMb = 100) {
  if (!file) {
    throw new Error('File is required');
  }
  
  // Check file size
  const fileSizeMb = file.size / (1024 * 1024);
  if (fileSizeMb > maxSizeMb) {
    throw new Error(`File size exceeds ${maxSizeMb}MB limit`);
  }
  
  // Check file type
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    throw new Error(`File type not allowed. Allowed: ${allowedTypes.join(', ')}`);
  }
  
  return true;
}

/**
 * Generate thumbnail for media
 */
export function getThumbnailUrl(publicId, mediaType) {
  if (mediaType === 'image') {
    return cloudinary.url(publicId, {
      width: 200,
      height: 200,
      crop: 'thumb',
      gravity: 'face',
      quality: 'auto',
      fetch_format: 'auto',
    });
  }
  
  if (mediaType === 'video') {
    return cloudinary.url(publicId, {
      resource_type: 'video',
      width: 200,
      height: 150,
      crop: 'fill',
      start_offset: '1s', // Get frame at 1 second
      quality: 'auto',
      fetch_format: 'jpg',
    });
  }
  
  return null;
}

export default {
  getCloudinaryConfig,
  signCloudinaryUpload,
  uploadToCloudinary,
  deleteFromCloudinary,
  getOptimizedMediaUrl,
  validateMediaFile,
  getThumbnailUrl,
};
