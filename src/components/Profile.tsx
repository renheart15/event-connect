import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { User, Edit, Save, X, Upload, Camera, Trash2, Crop, RotateCw, Building2, Users, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
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
  organization?: {
    _id: string;
    name: string;
    organizationCode: string;
  } | string;
  role?: string;
}

interface UserOrganization {
  _id: string;
  name: string;
  description?: string;
  organizationCode: string;
  owner: {
    _id: string;
    name: string;
    email: string;
  };
  memberCount: number;
  userRole: 'owner' | 'admin' | 'member';
  joinedAt: string;
}


const Profile: React.FC<ProfileProps> = ({ isOpen, onClose }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [userOrganizations, setUserOrganizations] = useState<UserOrganization[]>([]);
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(false);
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

  // Change password state
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadUserProfile();
      fetchLatestUserData();
      fetchUserOrganizations();
    }
  }, [isOpen]);

  const fetchLatestUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_CONFIG.API_BASE}/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        const freshUser = result.data.user;
        
        // Normalize the user data
        const normalizedUser = {
          ...freshUser,
          id: freshUser.id || freshUser._id
        };
        
        // Update localStorage with fresh data
        localStorage.setItem('user', JSON.stringify(normalizedUser));
        
        // Update state
        setUser(normalizedUser);
        const editFormData = {
          ...normalizedUser,
          organization: getOrganizationForEdit(normalizedUser.organization)
        };
        setEditForm(editFormData);
        
        // Notify other components
        window.dispatchEvent(new CustomEvent('userUpdated'));
      }
    } catch (error) {
      console.log('Failed to fetch latest user data:', error);
    }
  };

  const fetchUserOrganizations = async () => {
    setIsLoadingOrganizations(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Fetch owned organizations
      const ownedResponse = await fetch(`${API_CONFIG.API_BASE}/organizations/owned`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
      });

      // Fetch joined organization
      const joinedResponse = await fetch(`${API_CONFIG.API_BASE}/organizations/my`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
      });

      const allOrganizations: UserOrganization[] = [];

      // Process owned organizations
      if (ownedResponse.ok) {
        const ownedResult = await ownedResponse.json();
        if (ownedResult.success && ownedResult.data) {
          ownedResult.data.forEach((org: any) => {
            allOrganizations.push({
              _id: org._id,
              name: org.name,
              description: org.description,
              organizationCode: org.organizationCode,
              owner: org.owner,
              memberCount: org.memberCount,
              userRole: 'owner',
              joinedAt: org.createdAt
            });
          });
        }
      }

      // Process joined organization (if different from owned)
      if (joinedResponse.ok) {
        const joinedResult = await joinedResponse.json();
        if (joinedResult.success && joinedResult.data) {
          const joinedOrg = joinedResult.data;
          // Only add if not already in owned organizations
          if (!allOrganizations.some(org => org._id === joinedOrg._id)) {
            const userMember = joinedOrg.members?.find((member: any) => member.user._id === user?.id);
            allOrganizations.push({
              _id: joinedOrg._id,
              name: joinedOrg.name,
              description: joinedOrg.description,
              organizationCode: joinedOrg.organizationCode,
              owner: joinedOrg.owner,
              memberCount: joinedOrg.memberCount,
              userRole: userMember?.role || 'member',
              joinedAt: userMember?.joinedAt || joinedOrg.createdAt
            });
          }
        }
      }

      setUserOrganizations(allOrganizations);
    } catch (error) {
      console.log('Failed to fetch user organizations:', error);
    } finally {
      setIsLoadingOrganizations(false);
    }
  };


  const loadUserProfile = () => {
    // Load user from localStorage
    const userData = localStorage.getItem("user");
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        // Ensure id field is consistent
        const normalizedUser = {
          ...parsedUser,
          id: parsedUser.id || parsedUser._id
        };
        
        // Create edit form with organization name for editing
        const editFormData = {
          ...normalizedUser,
          organization: getOrganizationForEdit(normalizedUser.organization)
        };
        
        setUser(normalizedUser);
        setEditForm(editFormData);
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

  const getOrganizationName = (org: UserProfile['organization']): string => {
    if (!org) return 'Not provided';
    if (typeof org === 'string') {
      // If it looks like a MongoDB ObjectId (24 hex characters), show a fallback
      if (org.match(/^[0-9a-fA-F]{24}$/)) {
        return 'Organization (ID: ' + org.substring(0, 8) + '...)';
      }
      return org;
    }
    return org.name || 'Not provided';
  };

  const getOrganizationForEdit = (org: UserProfile['organization']): string => {
    if (!org) return '';
    if (typeof org === 'string') {
      // If it looks like a MongoDB ObjectId, return empty for editing
      if (org.match(/^[0-9a-fA-F]{24}$/)) {
        return '';
      }
      return org;
    }
    return org.name || '';
  };

  const validateForm = () => {
    if (!editForm.name || editForm.name.trim().length === 0) {
      toast({
        title: "Validation Error",
        description: "Name is required",
        variant: "destructive",
      });
      return false;
    }
    if (!editForm.email || editForm.email.trim().length === 0) {
      toast({
        title: "Validation Error", 
        description: "Email is required",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!user) return;
    
    // Validate form before saving
    if (!validateForm()) {
      return;
    }
    
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      
      // Prepare update data - only send changed fields
      const updateData = {
        name: editForm.name,
        email: editForm.email,
        bio: editForm.bio,
        phone: editForm.phone,
        organization: editForm.organization,
        profilePicture: editForm.profilePicture
      };
      
      // Make API call to update profile
      const response = await fetch(`${API_CONFIG.API_BASE}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include cookies for session
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        const result = await response.json();
        
        // Use server response if available, otherwise merge with existing user data
        const finalUserData = result.data?.user || { ...user, ...updateData };
        
        // Ensure consistent id field
        const normalizedUserData = {
          ...finalUserData,
          id: finalUserData.id || finalUserData._id
        };
        
        localStorage.setItem('user', JSON.stringify(normalizedUserData));
        setUser(normalizedUserData as UserProfile);
        setEditForm(normalizedUserData);
        setIsEditing(false);
        
        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('userUpdated'));
        
        toast({
          title: "Profile Updated",
          description: "Your profile has been successfully updated.",
        });
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      const editFormData = {
        ...user,
        organization: getOrganizationForEdit(user.organization)
      };
      setEditForm(editFormData);
    }
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
          credentials: 'include', // Include cookies for session
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

      // Also update the backend profile
      try {
        const token = localStorage.getItem('token');
        await fetch(`${API_CONFIG.API_BASE}/auth/profile`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({ profilePicture: updatedUser.profilePicture })
        });
      } catch (error) {
        console.log('Failed to update profile picture on server:', error);
      }

      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('userUpdated'));

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

  const handleRemovePhoto = async () => {
    const updatedUser = { ...user, profilePicture: undefined };
    const updatedEditForm = { ...editForm, profilePicture: undefined };
    
    setUser(updatedUser as UserProfile);
    setEditForm(updatedEditForm);
    localStorage.setItem('user', JSON.stringify(updatedUser));

    // Also update the backend profile
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_CONFIG.API_BASE}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ profilePicture: null })
      });
    } catch (error) {
      console.log('Failed to remove profile picture on server:', error);
    }

    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('userUpdated'));

    toast({
      title: "Photo Removed",
      description: "Your profile picture has been removed.",
    });
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Change password handlers
  const handleOpenChangePassword = () => {
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setShowPasswords({
      current: false,
      new: false,
      confirm: false
    });
    setShowChangePasswordModal(true);
  };

  const handleCloseChangePassword = () => {
    setShowChangePasswordModal(false);
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setShowPasswords({
      current: false,
      new: false,
      confirm: false
    });
  };

  const handleChangePassword = async () => {
    // Validation
    if (!passwordForm.currentPassword) {
      toast({
        title: "Validation Error",
        description: "Current password is required",
        variant: "destructive",
      });
      return;
    }

    if (!passwordForm.newPassword) {
      toast({
        title: "Validation Error",
        description: "New password is required",
        variant: "destructive",
      });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast({
        title: "Validation Error",
        description: "New password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: "Validation Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_CONFIG.API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Password Changed",
          description: "Your password has been successfully updated.",
        });
        handleCloseChangePassword();
      } else {
        throw new Error(result.message || 'Failed to change password');
      }
    } catch (error: any) {
      toast({
        title: "Change Password Failed",
        description: error.message || "Failed to change password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
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
                <div className="md:col-span-2">
                  <Label htmlFor="organizations">Organizations</Label>
                  {isEditing ? (
                    <Input
                      id="organization"
                      value={getOrganizationForEdit(editForm.organization)}
                      onChange={(e) => handleInputChange('organization', e.target.value)}
                      placeholder="Enter your organization name"
                    />
                  ) : (
                    <div className="space-y-2">
                      {isLoadingOrganizations ? (
                        <div className="p-2 bg-muted rounded-md flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                          Loading organizations...
                        </div>
                      ) : userOrganizations.length === 0 ? (
                        <div className="p-2 bg-muted rounded-md flex items-center text-muted-foreground">
                          <Building2 className="w-4 h-4 mr-2" />
                          No organizations
                        </div>
                      ) : (
                        <div className="p-2 bg-muted rounded-md">
                          {userOrganizations.map((org, index) => (
                            <span key={org._id}>
                              {org.name}
                              {index < userOrganizations.length - 1 && ', '}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
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

          {/* Account Security */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Account Security
              </CardTitle>
              <CardDescription>Manage your password and security settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">Password</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Change your account password
                    </p>
                  </div>
                  <Button
                    onClick={handleOpenChangePassword}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    Change Password
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Change Password Modal */}
        <Dialog open={showChangePasswordModal} onOpenChange={setShowChangePasswordModal}>
          <DialogContent className="mx-4 sm:mx-auto sm:max-w-md max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Change Password
              </DialogTitle>
              <DialogDescription>
                Enter your current password and choose a new one.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={(e) => { e.preventDefault(); handleChangePassword(); }} className="space-y-4">
              <div>
                <Label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Current Password
                </Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showPasswords.current ? "text" : "password"}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                    placeholder="Enter current password"
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({...showPasswords, current: !showPasswords.current})}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPasswords.new ? "text" : "password"}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                    placeholder="Enter new password (minimum 6 characters)"
                    className="pr-10"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({...showPasswords, new: !showPasswords.new})}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Confirm New Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showPasswords.confirm ? "text" : "password"}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                    placeholder="Confirm new password"
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({...showPasswords, confirm: !showPasswords.confirm})}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseChangePassword}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isChangingPassword}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isChangingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Changing...
                    </>
                  ) : (
                    'Change Password'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
};

export default Profile;