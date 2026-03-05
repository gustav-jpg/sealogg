import { useCallback } from 'react';
import { isNativePlatform } from '@/lib/capacitor';

/**
 * Hook that provides camera/photo access using @capacitor/camera on native
 * and falls back to a regular file input on web.
 * 
 * IMPORTANT: The returned function must be called directly from a user gesture
 * (click/tap handler) to satisfy browser security policies.
 */
export function useNativeCamera() {
  const takePhoto = useCallback(async (): Promise<File | null> => {
    if (isNativePlatform()) {
      try {
        const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
        const photo = await Camera.getPhoto({
          quality: 80,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Prompt, // Let user choose camera or gallery
          width: 1920,
          height: 1920,
          correctOrientation: true,
        });

        if (!photo.dataUrl) return null;

        // Convert data URL to File
        const response = await fetch(photo.dataUrl);
        const blob = await response.blob();
        const extension = photo.format || 'jpeg';
        const fileName = `photo-${Date.now()}.${extension}`;
        return new File([blob], fileName, { type: `image/${extension}` });
      } catch (error: any) {
        // User cancelled or permission denied
        if (error?.message?.includes('User cancelled') || error?.message?.includes('cancelled')) {
          return null;
        }
        console.error('[NativeCamera] Error:', error);
        throw error;
      }
    } else {
      // Web fallback: use file input
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        
        input.onchange = () => {
          const file = input.files?.[0] || null;
          resolve(file);
        };
        
        // Handle cancel
        const handleFocus = () => {
          setTimeout(() => {
            if (!input.files?.length) {
              resolve(null);
            }
            window.removeEventListener('focus', handleFocus);
          }, 300);
        };
        window.addEventListener('focus', handleFocus);
        
        // CRITICAL: click() must happen synchronously in the gesture handler
        input.click();
      });
    }
  }, []);

  const pickFiles = useCallback(async (options?: { 
    multiple?: boolean; 
    accept?: string;
  }): Promise<File[]> => {
    if (isNativePlatform()) {
      try {
        const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
        
        if (options?.accept && !options.accept.includes('image')) {
          // For non-image files, fall through to file input
          return pickFilesViaInput(options);
        }

        const photo = await Camera.getPhoto({
          quality: 80,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Photos, // Gallery only for picking
          width: 1920,
          height: 1920,
          correctOrientation: true,
        });

        if (!photo.dataUrl) return [];

        const response = await fetch(photo.dataUrl);
        const blob = await response.blob();
        const extension = photo.format || 'jpeg';
        const fileName = `photo-${Date.now()}.${extension}`;
        return [new File([blob], fileName, { type: `image/${extension}` })];
      } catch (error: any) {
        if (error?.message?.includes('User cancelled') || error?.message?.includes('cancelled')) {
          return [];
        }
        console.error('[NativeCamera] Pick error:', error);
        // Fall back to file input
        return pickFilesViaInput(options);
      }
    }
    
    return pickFilesViaInput(options);
  }, []);

  return { takePhoto, pickFiles };
}

function pickFilesViaInput(options?: { multiple?: boolean; accept?: string }): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = options?.accept || 'image/*,.pdf';
    input.multiple = options?.multiple ?? true;
    
    input.onchange = () => {
      resolve(Array.from(input.files || []));
    };
    
    const handleFocus = () => {
      setTimeout(() => {
        if (!input.files?.length) {
          resolve([]);
        }
        window.removeEventListener('focus', handleFocus);
      }, 300);
    };
    window.addEventListener('focus', handleFocus);
    
    input.click();
  });
}
