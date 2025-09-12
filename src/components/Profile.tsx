import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { User, Edit, Save, X, Upload, Camera, Trash2, Crop, RotateCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { API_CONFIG } from '@/config';

interface ProfileProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  profilePicture?: string;
  bio?: string;
  phone?: string;
  organization?: string;
  role?: string;
}

const Profile: React.FC<ProfileProps> = ({ isOpen, onClose }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [cropData, setCropData] = useState({ x: 0, y: 0, size: 200 });
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadUserProfile();
    }
  }, [isOpen]);

  const loadUserProfile = () => {
    // Load user from localStorage
    const userData = localStorage.getItem("user");
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setEditForm(parsedUser);
      } catch (error) {
        console.error("Error parsing user data:", error);
      }
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      
      // Make API call to update profile
      const response = await fetch(`${API_CONFIG.API_BASE}/users/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editForm)
      });

      if (response.ok) {
        const updatedUser = await response.json();
        
        // Update localStorage
        localStorage.setItem('user', JSON.stringify(updatedUser.data || editForm));
        
        setUser(editForm as UserProfile);
        setIsEditing(false);
        
        toast({
          title: "Profile Updated",
          description: "Your profile has been successfully updated.",
        });
      } else {
        // If API call fails, still update local storage for demo purposes
        localStorage.setItem('user', JSON.stringify(editForm));
        setUser(editForm as UserProfile);
        setIsEditing(false);
        
        toast({
          title: "Profile Updated",
          description: "Your profile has been successfully updated locally.",
        });
      }
    } catch (error) {
      // Update locally if API fails
      localStorage.setItem('user', JSON.stringify(editForm));
      setUser(editForm as UserProfile);
      setIsEditing(false);
      
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated locally.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditForm(user || {});
    setIsEditing(false);
  };

  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File Type",
        description: "Please select an image file (JPG, PNG, GIF, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    // Read the file and show cropper
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageDataUrl = e.target?.result as string;
      setSelectedImage(imageDataUrl);
      setShowCropper(true);
    };

    reader.onerror = () => {
      toast({
        title: "Upload Error",
        description: "Failed to process the image file.",
        variant: "destructive",
      });
    };

    reader.readAsDataURL(file);

    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const cropImage = (): string | null => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    
    if (!canvas || !image || !selectedImage) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Set canvas size to desired output size (square)
    const outputSize = 400; // High quality output
    canvas.width = outputSize;
    canvas.height = outputSize;

    // Calculate the scale factor
    const scaleX = image.naturalWidth / image.offsetWidth;
    const scaleY = image.naturalHeight / image.offsetHeight;

    // Calculate crop area in original image coordinates
    const sourceX = cropData.x * scaleX;
    const sourceY = cropData.y * scaleY;
    const sourceSize = cropData.size * Math.min(scaleX, scaleY);

    // Draw the cropped image
    ctx.drawImage(
      image,
      sourceX, sourceY, sourceSize, sourceSize, // source rectangle
      0, 0, outputSize, outputSize // destination rectangle
    );

    return canvas.toDataURL('image/jpeg', 0.9); // High quality JPEG
  };

  const handleCropConfirm = async () => {
    setIsUploadingPhoto(true);
    
    try {
      const croppedImageData = cropImage();
      if (!croppedImageData) {
        throw new Error('Failed to crop image');
      }

      // Update user profile with cropped image
      const updatedUser = { ...user, profilePicture: croppedImageData };
      const updatedEditForm = { ...editForm, profilePicture: croppedImageData };
      
      // Try to upload to server (convert dataURL to blob first)
      try {
        const token = localStorage.getItem('token');
        
        // Convert dataURL to blob
        const response = await fetch(croppedImageData);
        const blob = await response.blob();
        
        const formData = new FormData();
        formData.append('profilePicture', blob, 'profile.jpg');
        
        const uploadResponse = await fetch(`${API_CONFIG.API_BASE}/users/upload-avatar`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData
        });

        if (uploadResponse.ok) {
          const result = await uploadResponse.json();
          // Use server URL if available
          if (result.data?.profilePictureUrl) {
            updatedUser.profilePicture = result.data.profilePictureUrl;
            updatedEditForm.profilePicture = result.data.profilePictureUrl;
          }
        }
      } catch (error) {
        console.log('Server upload failed, using local storage:', error);
      }

      // Update state and localStorage
      setUser(updatedUser as UserProfile);
      setEditForm(updatedEditForm);
      localStorage.setItem('user', JSON.stringify(updatedUser));

      // Close cropper
      setShowCropper(false);
      setSelectedImage(null);

      toast({
        title: "Photo Updated",
        description: "Your profile picture has been successfully updated.",
      });
    } catch (error) {
      toast({
        title: "Crop Error",
        description: "Failed to crop and save the image.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setSelectedImage(null);
    setCropData({ x: 0, y: 0, size: 200 });
  };

  const handleRemovePhoto = () => {
    const updatedUser = { ...user, profilePicture: undefined };
    const updatedEditForm = { ...editForm, profilePicture: undefined };
    
    setUser(updatedUser as UserProfile);
    setEditForm(updatedEditForm);
    localStorage.setItem('user', JSON.stringify(updatedUser));

    toast({
      title: "Photo Removed",
      description: "Your profile picture has been removed.",
    });
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            User Profile
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Profile Picture Section */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Profile Picture</CardTitle>
              <CardDescription>Upload a profile picture (JPG, PNG, GIF - Max 5MB)</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center space-x-6">
              <div className="relative">
                <Avatar className="h-24 w-24 border-4 border-muted">
                  <AvatarImage src={user.profilePicture} alt={user.name} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                    <User className="h-12 w-12" />
                  </AvatarFallback>
                </Avatar>
                {isUploadingPhoto && (
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  </div>
                )}
              </div>
              
              <div className="flex flex-col space-y-3">
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={triggerFileInput}
                    disabled={isUploadingPhoto}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    {isUploadingPhoto ? 'Uploading...' : 'Change Photo'}
                  </Button>
                  
                  {user.profilePicture && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleRemovePhoto}
                      disabled={isUploadingPhoto}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove
                    </Button>
                  )}
                </div>
                
                <p className="text-xs text-muted-foreground">
                  Recommended: Square image, at least 200x200 pixels
                </p>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />
            </CardContent>
          </Card>

          {/* Image Cropper Modal */}
          {showCropper && selectedImage && (
            <Card className="border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crop className="w-5 h-5" />
                  Crop Profile Picture
                </CardTitle>
                <CardDescription>
                  Drag the crop area to select the part of the image you want to use
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative max-w-md mx-auto">
                  <img
                    ref={imageRef}
                    src={selectedImage}
                    alt="Preview"
                    className="w-full h-auto max-h-80 object-contain border rounded"
                    onLoad={() => {
                      // Initialize crop area when image loads
                      const img = imageRef.current;
                      if (img) {
                        const size = Math.min(img.offsetWidth, img.offsetHeight) * 0.8;
                        setCropData({
                          x: (img.offsetWidth - size) / 2,
                          y: (img.offsetHeight - size) / 2,
                          size: size
                        });
                      }
                    }}
                  />
                  
                  {/* Crop overlay */}
                  <div
                    className="absolute border-2 border-primary bg-primary/10 cursor-move select-none transition-transform hover:scale-[1.01] active:scale-[1.02]"
                    style={{
                      left: `${cropData.x}px`,
                      top: `${cropData.y}px`,
                      width: `${cropData.size}px`,
                      height: `${cropData.size}px`,
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const img = imageRef.current;
                      if (!img) return;

                      const rect = img.getBoundingClientRect();
                      const startX = e.clientX - rect.left - cropData.x;
                      const startY = e.clientY - rect.top - cropData.y;
                      
                      const handleMouseMove = (e: MouseEvent) => {
                        e.preventDefault();
                        const currentRect = img.getBoundingClientRect();
                        const newX = Math.max(0, Math.min(
                          e.clientX - currentRect.left - startX, 
                          img.offsetWidth - cropData.size
                        ));
                        const newY = Math.max(0, Math.min(
                          e.clientY - currentRect.top - startY, 
                          img.offsetHeight - cropData.size
                        ));
                        
                        setCropData(prev => ({ ...prev, x: newX, y: newY }));
                      };
                      
                      const handleMouseUp = (e: MouseEvent) => {
                        e.preventDefault();
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', handleMouseUp);
                        document.body.style.userSelect = '';
                        document.body.style.cursor = '';
                      };
                      
                      document.body.style.userSelect = 'none';
                      document.body.style.cursor = 'move';
                      document.addEventListener('mousemove', handleMouseMove);
                      document.addEventListener('mouseup', handleMouseUp);
                    }}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      const img = imageRef.current;
                      if (!img || e.touches.length !== 1) return;

                      const touch = e.touches[0];
                      const rect = img.getBoundingClientRect();
                      const startX = touch.clientX - rect.left - cropData.x;
                      const startY = touch.clientY - rect.top - cropData.y;
                      
                      const handleTouchMove = (e: TouchEvent) => {
                        e.preventDefault();
                        if (e.touches.length !== 1) return;
                        
                        const touch = e.touches[0];
                        const currentRect = img.getBoundingClientRect();
                        const newX = Math.max(0, Math.min(
                          touch.clientX - currentRect.left - startX, 
                          img.offsetWidth - cropData.size
                        ));
                        const newY = Math.max(0, Math.min(
                          touch.clientY - currentRect.top - startY, 
                          img.offsetHeight - cropData.size
                        ));
                        
                        setCropData(prev => ({ ...prev, x: newX, y: newY }));
                      };
                      
                      const handleTouchEnd = (e: TouchEvent) => {
                        e.preventDefault();
                        document.removeEventListener('touchmove', handleTouchMove);
                        document.removeEventListener('touchend', handleTouchEnd);
                      };
                      
                      document.addEventListener('touchmove', handleTouchMove, { passive: false });
                      document.addEventListener('touchend', handleTouchEnd);
                    }}
                  >
                    {/* Corner resize handles */}
                    <div
                      className="absolute w-4 h-4 bg-primary border-2 border-white rounded-full -bottom-2 -right-2 cursor-nw-resize shadow-lg hover:scale-110 transition-transform"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const img = imageRef.current;
                        if (!img) return;

                        const startSize = cropData.size;
                        const startX = e.clientX;
                        const startY = e.clientY;
                        
                        const handleMouseMove = (e: MouseEvent) => {
                          e.preventDefault();
                          const deltaX = e.clientX - startX;
                          const deltaY = e.clientY - startY;
                          const delta = Math.max(deltaX, deltaY);
                          
                          const newSize = Math.max(50, Math.min(
                            startSize + delta,
                            img.offsetWidth - cropData.x,
                            img.offsetHeight - cropData.y
                          ));
                          
                          setCropData(prev => ({ ...prev, size: newSize }));
                        };
                        
                        const handleMouseUp = (e: MouseEvent) => {
                          e.preventDefault();
                          document.removeEventListener('mousemove', handleMouseMove);
                          document.removeEventListener('mouseup', handleMouseUp);
                          document.body.style.userSelect = '';
                          document.body.style.cursor = '';
                        };
                        
                        document.body.style.userSelect = 'none';
                        document.body.style.cursor = 'nw-resize';
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const img = imageRef.current;
                        if (!img || e.touches.length !== 1) return;

                        const touch = e.touches[0];
                        const startSize = cropData.size;
                        const startX = touch.clientX;
                        const startY = touch.clientY;
                        
                        const handleTouchMove = (e: TouchEvent) => {
                          e.preventDefault();
                          if (e.touches.length !== 1) return;
                          
                          const touch = e.touches[0];
                          const deltaX = touch.clientX - startX;
                          const deltaY = touch.clientY - startY;
                          const delta = Math.max(deltaX, deltaY);
                          
                          const newSize = Math.max(50, Math.min(
                            startSize + delta,
                            img.offsetWidth - cropData.x,
                            img.offsetHeight - cropData.y
                          ));
                          
                          setCropData(prev => ({ ...prev, size: newSize }));
                        };
                        
                        const handleTouchEnd = (e: TouchEvent) => {
                          e.preventDefault();
                          document.removeEventListener('touchmove', handleTouchMove);
                          document.removeEventListener('touchend', handleTouchEnd);
                        };
                        
                        document.addEventListener('touchmove', handleTouchMove, { passive: false });
                        document.addEventListener('touchend', handleTouchEnd);
                      }}
                    />
                    
                    {/* Center drag indicator */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                      <div className="w-8 h-8 border-2 border-white rounded-full bg-primary/20 flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                    </div>
                    
                    {/* Edge indicators for better visibility */}
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1 w-6 h-2 bg-primary rounded-full opacity-50"></div>
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1 w-6 h-2 bg-primary rounded-full opacity-50"></div>
                    <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-2 h-6 bg-primary rounded-full opacity-50"></div>
                    <div className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-1 w-2 h-6 bg-primary rounded-full opacity-50"></div>
                  </div>
                </div>

                <div className="flex justify-center space-x-3">
                  <Button variant="outline" onClick={handleCropCancel}>
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button onClick={handleCropConfirm} disabled={isUploadingPhoto}>
                    <Crop className="w-4 h-4 mr-2" />
                    {isUploadingPhoto ? 'Saving...' : 'Crop & Save'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Hidden canvas for cropping */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Basic Information */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg">Basic Information</CardTitle>
                  <CardDescription>Your basic profile information</CardDescription>
                </div>
                {!isEditing && (
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  {isEditing ? (
                    <Input
                      id="name"
                      value={editForm.name || ''}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="Enter your full name"
                    />
                  ) : (
                    <p className="p-2 bg-muted rounded-md">{user.name}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  {isEditing ? (
                    <Input
                      id="email"
                      type="email"
                      value={editForm.email || ''}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="Enter your email"
                    />
                  ) : (
                    <p className="p-2 bg-muted rounded-md">{user.email}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  {isEditing ? (
                    <Input
                      id="phone"
                      value={editForm.phone || ''}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="Enter your phone number"
                    />
                  ) : (
                    <p className="p-2 bg-muted rounded-md">{user.phone || 'Not provided'}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="organization">Organization</Label>
                  {isEditing ? (
                    <Input
                      id="organization"
                      value={editForm.organization || ''}
                      onChange={(e) => handleInputChange('organization', e.target.value)}
                      placeholder="Enter your organization"
                    />
                  ) : (
                    <p className="p-2 bg-muted rounded-md">{user.organization || 'Not provided'}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="bio">Bio</Label>
                {isEditing ? (
                  <Textarea
                    id="bio"
                    value={editForm.bio || ''}
                    onChange={(e) => handleInputChange('bio', e.target.value)}
                    placeholder="Tell us about yourself"
                    rows={3}
                  />
                ) : (
                  <p className="p-2 bg-muted rounded-md min-h-[80px]">{user.bio || 'No bio provided'}</p>
                )}
              </div>

              {isEditing && (
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={handleCancel}>
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving}>
                    <Save className="w-4 h-4 mr-2" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Profile;