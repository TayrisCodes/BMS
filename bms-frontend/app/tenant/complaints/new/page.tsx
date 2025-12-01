'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { MobileForm, MobileFormField } from '@/lib/components/tenant/MobileForm';
import { Button } from '@/lib/components/ui/button';
import { X, Upload, Loader2 } from 'lucide-react';
import { useOfflineQueue } from '@/lib/hooks/useOfflineQueue';

const COMPLAINT_CATEGORIES = [
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'noise', label: 'Noise' },
  { value: 'security', label: 'Security' },
  { value: 'cleanliness', label: 'Cleanliness' },
  { value: 'other', label: 'Other' },
];

const MAX_PHOTOS = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export default function NewComplaintPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isOnline, queueAction } = useOfflineQueue();
  const [loading, setLoading] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    category: '',
    title: '',
    description: '',
  });
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    // Validate file count
    if (selectedPhotos.length + files.length > MAX_PHOTOS) {
      setErrors({ photos: `Maximum ${MAX_PHOTOS} photos allowed` });
      return;
    }

    // Validate file types and sizes
    const validFiles: File[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setErrors({ photos: 'Only image files are allowed' });
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setErrors({ photos: `File ${file.name} exceeds 5MB limit` });
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    // Add to selected photos
    const newPhotos = [...selectedPhotos, ...validFiles];
    setSelectedPhotos(newPhotos);

    // Create previews
    const newPreviews = validFiles.map((file) => URL.createObjectURL(file));
    setPhotoPreviews([...photoPreviews, ...newPreviews]);

    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = selectedPhotos.filter((_, i) => i !== index);
    const newPreviews = photoPreviews.filter((_, i) => i !== index);
    setSelectedPhotos(newPhotos);
    setPhotoPreviews(newPreviews);

    // Revoke object URL to free memory
    const url = photoPreviews[index];
    if (url) {
      URL.revokeObjectURL(url);
    }
  };

  const uploadPhotos = async (): Promise<string[]> => {
    if (selectedPhotos.length === 0) return [];

    setUploadingPhotos(true);
    try {
      const formData = new FormData();
      selectedPhotos.forEach((photo) => {
        formData.append('photos', photo);
      });

      const response = await fetch('/api/tenant/complaints/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload photos');
      }

      const data = await response.json();
      return data.urls || [];
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    // Validation
    const newErrors: Record<string, string> = {};
    if (!formData.category) {
      newErrors.category = 'Category is required';
    }
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setLoading(false);
      return;
    }

    try {
      // Upload photos first (only if online)
      let uploadedPhotoUrls: string[] = [];
      if (selectedPhotos.length > 0 && isOnline) {
        uploadedPhotoUrls = await uploadPhotos();
      } else if (selectedPhotos.length > 0 && !isOnline) {
        // If offline, we can't upload photos - show warning
        setErrors({
          submit:
            'Cannot upload photos while offline. Please connect to the internet to submit with photos.',
        });
        setLoading(false);
        return;
      }

      const complaintData = {
        ...formData,
        photos: uploadedPhotoUrls,
      };

      // If offline, queue the complaint
      if (!isOnline) {
        queueAction('complaint', complaintData);
        alert(
          "You're offline. Your complaint has been queued and will be submitted when you're back online.",
        );
        router.push('/tenant/complaints');
        return;
      }

      // Submit complaint with photo URLs
      const response = await fetch('/api/tenant/complaints', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(complaintData),
      });

      if (response.ok) {
        router.push('/tenant/complaints');
      } else {
        const data = await response.json();
        setErrors({ submit: data.error || 'Failed to submit complaint' });
      }
    } catch (error) {
      console.error('Failed to submit complaint:', error);

      // If network error and offline, queue the complaint
      if (!isOnline || (error instanceof Error && error.message.includes('fetch'))) {
        const complaintData = {
          ...formData,
          photos: [],
        };
        queueAction('complaint', complaintData);
        alert(
          "You're offline. Your complaint has been queued and will be submitted when you're back online.",
        );
        router.push('/tenant/complaints');
        return;
      }

      setErrors({
        submit:
          error instanceof Error ? error.message : 'Failed to submit complaint. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Submit Complaint</h1>
        <p className="text-muted-foreground">
          Describe the issue you&apos;re experiencing. Our team will review and respond as soon as
          possible.
        </p>
      </div>

      <MobileForm onSubmit={handleSubmit} isLoading={loading} submitLabel="Submit Complaint">
        <div className="space-y-2">
          <label htmlFor="category" className="text-base font-medium">
            Category <span className="text-destructive">*</span>
          </label>
          <select
            id="category"
            name="category"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="flex h-12 w-full rounded-md border border-input bg-background px-4 py-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            required
          >
            <option value="">Select a category</option>
            {COMPLAINT_CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
          {errors.category && <p className="text-sm text-destructive">{errors.category}</p>}
        </div>

        <MobileFormField
          label="Title"
          name="title"
          placeholder="Brief description of the issue"
          required
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          {...(errors.title ? { error: errors.title } : {})}
        />

        <MobileFormField
          label="Description"
          name="description"
          placeholder="Provide more details about the issue..."
          required
          textarea
          rows={6}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          {...(errors.description ? { error: errors.description } : {})}
        />

        {/* Photo Upload Section */}
        <div className="space-y-2">
          <label className="text-base font-medium">
            Photos (Optional)
            {selectedPhotos.length > 0 && (
              <span className="text-sm text-muted-foreground ml-2">
                {selectedPhotos.length}/{MAX_PHOTOS}
              </span>
            )}
          </label>

          {photoPreviews.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photoPreviews.map((preview, index) => (
                <div key={index} className="relative group h-24 w-full">
                  <Image
                    src={preview}
                    alt={`Preview ${index + 1}`}
                    fill
                    className="object-cover rounded-md border"
                    unoptimized
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove photo"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {selectedPhotos.length < MAX_PHOTOS && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoSelect}
                className="hidden"
                id="photo-upload"
              />
              <label
                htmlFor="photo-upload"
                className="flex items-center justify-center gap-2 h-24 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted transition-colors"
              >
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {selectedPhotos.length === 0 ? 'Add photos (up to 5)' : 'Add more photos'}
                </span>
              </label>
            </div>
          )}

          {errors.photos && <p className="text-sm text-destructive">{errors.photos}</p>}
        </div>

        {errors.submit && (
          <div className="p-4 rounded-md bg-destructive/10 text-destructive text-sm">
            {errors.submit}
          </div>
        )}

        {(uploadingPhotos || loading) && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{uploadingPhotos ? 'Uploading photos...' : 'Submitting complaint...'}</span>
          </div>
        )}
      </MobileForm>
    </div>
  );
}
