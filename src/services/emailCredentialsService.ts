import { API_CONFIG } from '../config';

interface EmailCredential {
  id: string;
  user: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsed?: string;
}

interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: any[];
}

class EmailCredentialsService {
  private baseUrl = `${API_CONFIG.API_BASE}/email-credentials`;

  private async makeRequest<T = any>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
    };

    // Get token from localStorage (same as other components)
    const token = localStorage.getItem('token');
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }
      
      return result;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  /**
   * Store Gmail credentials securely in database
   */
  async storeCredentials(email: string, password: string): Promise<EmailCredential> {
    const response = await this.makeRequest<EmailCredential>('/store', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (!response.success) {
      throw new Error(response.message || 'Failed to store credentials');
    }

    return response.data!;
  }

  /**
   * Verify Gmail credentials
   */
  async verifyCredentials(email: string, password: string): Promise<boolean> {
    const response = await this.makeRequest<{ isValid: boolean }>('/verify', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (!response.success) {
      throw new Error(response.message || 'Failed to verify credentials');
    }

    return response.data!.isValid;
  }

  /**
   * Get stored Gmail credential info (without password)
   */
  async getCredentialInfo(email?: string): Promise<EmailCredential | null> {
    try {
      const endpoint = email ? `/info/${encodeURIComponent(email)}` : '/info';
      const response = await this.makeRequest<EmailCredential>(endpoint);

      if (!response.success) {
        if (response.message?.includes('not found')) {
          return null;
        }
        throw new Error(response.message || 'Failed to get credential info');
      }

      return response.data!;
    } catch (error) {
      if (error.message?.includes('not found')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get all user Gmail configurations
   */
  async getUserCredentials(): Promise<EmailCredential[]> {
    const response = await this.makeRequest<EmailCredential[]>('/list');

    if (!response.success) {
      throw new Error(response.message || 'Failed to get user credentials');
    }

    return response.data || [];
  }

  /**
   * Check if user has any stored credentials
   */
  async hasStoredCredentials(): Promise<boolean> {
    try {
      const response = await this.makeRequest<{ hasCredentials: boolean }>('/has-password');

      if (!response.success) {
        throw new Error(response.message || 'Failed to check credentials');
      }

      return response.data!.hasCredentials;
    } catch (error) {
      // If user is not authenticated, return false instead of throwing
      if (error.message?.includes('Access token') || error.message?.includes('401')) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Deactivate Gmail credentials (soft delete)
   */
  async deactivateCredentials(email: string): Promise<void> {
    const response = await this.makeRequest('/deactivate', {
      method: 'PATCH',
      body: JSON.stringify({ email }),
    });

    if (!response.success) {
      throw new Error(response.message || 'Failed to deactivate credentials');
    }
  }

  /**
   * Delete Gmail credentials permanently
   */
  async deleteCredentials(email: string): Promise<void> {
    const response = await this.makeRequest(`/${encodeURIComponent(email)}`, {
      method: 'DELETE',
    });

    if (!response.success) {
      throw new Error(response.message || 'Failed to delete credentials');
    }
  }

  /**
   * Get the primary/active Gmail credential for the user
   */
  async getPrimaryCredential(): Promise<EmailCredential | null> {
    try {
      const credentials = await this.getUserCredentials();
      const activeCredentials = credentials.filter(cred => cred.isActive);
      
      // Return the most recently used or created active credential
      if (activeCredentials.length === 0) {
        return null;
      }

      return activeCredentials.sort((a, b) => {
        const aTime = a.lastUsed || a.createdAt;
        const bTime = b.lastUsed || b.createdAt;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      })[0];
    } catch (error) {
      // If user is not authenticated, return null instead of throwing
      if (error.message?.includes('Access token') || error.message?.includes('401')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Store just the password (simplified version)
   */
  async storePassword(password: string, gmailEmail?: string): Promise<void> {
    const requestBody: { password: string; gmailEmail?: string } = { password };
    if (gmailEmail) {
      requestBody.gmailEmail = gmailEmail;
    }

    const response = await this.makeRequest('/store-password', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    if (!response.success) {
      throw new Error(response.message || 'Failed to store password');
    }
  }

  /**
   * Get stored password (for loading saved passwords)
   */
  async getStoredPassword(): Promise<string | null> {
    try {
      const response = await this.makeRequest<{ password: string }>('/get-password');

      if (!response.success) {
        return null;
      }

      return response.data?.password || null;
    } catch (error) {
      if (error.message?.includes('Access token') || error.message?.includes('401') || error.message?.includes('not found')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Delete stored password
   */
  async deleteStoredPassword(): Promise<void> {
    const response = await this.makeRequest('/delete-password', {
      method: 'DELETE',
    });

    if (!response.success) {
      throw new Error(response.message || 'Failed to delete stored password');
    }
  }
}

// Export singleton instance
export const emailCredentialsService = new EmailCredentialsService();
export type { EmailCredential, ApiResponse };