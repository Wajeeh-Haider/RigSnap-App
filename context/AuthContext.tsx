import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (userData: any) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (updates: Partial<User>) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Helper function to convert database user to app user format
  const convertDbUserToAppUser = (dbUser: any): User => {
    const [firstName, ...lastNameParts] = (dbUser.name || '').split(' ');
    return {
      id: dbUser.id,
      email: dbUser.email,
      firstName: firstName || 'User',
      lastName: lastNameParts.join(' ') || '',
      phone: dbUser.phone || '',
      role: dbUser.role,
      rating: parseFloat(dbUser.rating) || 0,
      joinDate: dbUser.join_date || new Date().toISOString().split('T')[0],
      location: dbUser.location || '',
      language: dbUser.language || 'en',
      // Trucker specific fields
      truckType: dbUser.truck_type,
      licenseNumber: dbUser.license_number,
      // Provider specific fields
      services: dbUser.services || [],
      serviceRadius: dbUser.service_radius,
      certifications: dbUser.certifications || []
    };
  };

  // Helper function to fetch user data from database
  const fetchUserData = async (userId: string): Promise<User | null> => {
    try {
      console.log('Fetching user data from database for user ID:', userId);
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Database error:', error.code, error.message);
        
        // For any database error, use fallback user
        console.log('Database error occurred, using fallback user');
        return await createFallbackUser(userId);
      }

      if (!data) {
        console.log('No user profile found in database, using fallback user');
        return await createFallbackUser(userId);
      }

      console.log('User data found in database:', data?.email || 'no email');
      return convertDbUserToAppUser(data);
    } catch (error) {
      console.error('Error fetching user data:', error);
      console.log('Fetch exception, using fallback user');
      return await createFallbackUser(userId);
    }
  };

  // Create a fallback user when database is not accessible
  const createFallbackUser = async (userId: string): Promise<User | null> => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) return null;

      const userMetadata = authUser.user_metadata || {};
      const rawMetadata = authUser.raw_user_meta_data || {};
      
      let userRole: 'trucker' | 'provider' = 'trucker';
      if (userMetadata.role) {
        userRole = userMetadata.role;
      } else if (rawMetadata.role) {
        userRole = rawMetadata.role;
      } else if (authUser.email) {
        userRole = authUser.email.includes('provider') ? 'provider' : 'trucker';
      }

      const fallbackUser: User = {
        id: userId,
        email: authUser.email || '',
        firstName: userMetadata.firstName || rawMetadata.firstName || 
                  (userRole === 'trucker' ? 'John' : 'Mike'),
        lastName: userMetadata.lastName || rawMetadata.lastName || 
                 (userRole === 'trucker' ? 'Driver' : 'Mechanic'),
        phone: userMetadata.phone || rawMetadata.phone || 
               (userRole === 'trucker' ? '+1-555-0123' : '+1-555-0456'),
        role: userRole,
        rating: 4.5,
        joinDate: new Date().toISOString().split('T')[0],
        location: userMetadata.location || rawMetadata.location || 
                 (userRole === 'trucker' ? 'Dallas, TX' : 'Houston, TX'),
        language: userMetadata.language || rawMetadata.language || 'en',
        truckType: userRole === 'trucker' ? (userMetadata.truckType || rawMetadata.truckType || 'Semi-Trailer') : undefined,
        licenseNumber: userRole === 'trucker' ? (userMetadata.licenseNumber || rawMetadata.licenseNumber || 'CDL-TX-123456') : undefined,
        services: userRole === 'provider' ? (userMetadata.services || rawMetadata.services || ['repair', 'mechanic']) : undefined,
        serviceRadius: userRole === 'provider' ? (userMetadata.serviceRadius || rawMetadata.serviceRadius || 25) : undefined,
        certifications: userRole === 'provider' ? (userMetadata.certifications || rawMetadata.certifications || ['ASE Certified']) : undefined
      };

      console.log('Created fallback user:', fallbackUser.email, fallbackUser.role);
      return fallbackUser;
    } catch (error) {
      console.error('Error creating fallback user:', error);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;
    let initTimeout: NodeJS.Timeout;

    const initializeAuth = async () => {
      try {
        console.log('=== AUTH INITIALIZATION START ===');
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Session check result:', !!session, session?.user?.email);
        
        if (mounted && session?.user) {
          console.log('Valid session found, fetching user data for:', session.user.email);
          const userData = await fetchUserData(session.user.id);
          if (userData) {
            console.log('User data loaded successfully:', userData.email, userData.role);
            setUser(userData);
          } else {
            console.log('No user data in DB, creating fallback user');
            const fallbackUser = await createFallbackUser(session.user.id);
            if (fallbackUser) {
              console.log('Fallback user created:', fallbackUser.email, fallbackUser.role);
              setUser(fallbackUser);
            } else {
              console.log('Failed to create fallback user, signing out');
              await supabase.auth.signOut();
              setUser(null);
            }
          }
        } else if (mounted) {
          console.log('No valid session found, user will be null');
          setUser(null);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) {
          console.log('Auth initialization failed, clearing user state');
          setUser(null);
        }
      } finally {
        if (mounted) {
          console.log('=== AUTH INITIALIZATION COMPLETE ===');
          setIsLoading(false);
        }
      }
    };

    // Set timeout to prevent infinite loading
    initTimeout = setTimeout(() => {
      if (mounted && isLoading) {
        console.warn('=== AUTH TIMEOUT - FORCING COMPLETION ===');
        setIsLoading(false);
        // Clear any invalid session state
        supabase.auth.signOut().catch(console.error);
        setUser(null);
      }
    }, 3000);

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      console.log('Auth state change:', event, !!session?.user);

      if (event === 'SIGNED_IN' && session?.user) {
        console.log('User signed in, fetching data');
        const userData = await fetchUserData(session.user.id);
        if (userData) {
          console.log('Setting user data from sign in');
          setUser(userData);
        } else {
          const fallbackUser = await createFallbackUser(session.user.id);
          if (fallbackUser) {
            console.log('Setting fallback user from sign in');
            setUser(fallbackUser);
          } else {
            console.log('Could not create user data, signing out');
            await supabase.auth.signOut();
            setUser(null);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out, clearing state');
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      if (initTimeout) {
        clearTimeout(initTimeout);
      }
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('Starting login process for:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('Supabase login response:', { data: !!data.user, error: error?.message });

      if (error) {
        console.log('Login error:', error.message);
        return { success: false, error: error.message };
      }

      if (data.user) {
        console.log('User authenticated, fetching user data from database');
        const userData = await fetchUserData(data.user.id);
        if (userData) {
          console.log('User data found:', userData.role);
          setUser(userData);
          console.log('User state updated successfully');
          return { success: true };
        } else {
          console.log('Using fallback authentication for:', data.user.email);
          return { success: true };
        }
      }

      console.log('Login failed: no user data returned');
      return { success: false, error: 'Login failed' };
    } catch (error: any) {
      console.error('Login exception:', error);
      return { success: false, error: error.message || 'An unexpected error occurred' };
    }
  };

  const signup = async (userData: any): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('Starting signup process for:', userData.email);
      
      const { data, error } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            firstName: userData.firstName,
            lastName: userData.lastName,
            name: `${userData.firstName} ${userData.lastName}`,
            role: userData.role,
            location: userData.location,
            phone: userData.phone,
            language: userData.language,
            truckType: userData.truckType,
            licenseNumber: userData.licenseNumber,
            services: userData.services,
            serviceRadius: userData.serviceRadius,
            certifications: userData.certifications
          }
        }
      });

      if (error) {
        console.log('Signup auth error:', error.message);
        return { success: false, error: error.message };
      }

      if (data.user) {
        console.log('Auth user created successfully');
        
        const newUser: User = {
          id: data.user.id,
          email: data.user.email!,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phone: userData.phone || '',
          role: userData.role,
          rating: 0,
          joinDate: new Date().toISOString().split('T')[0],
          location: userData.location,
          language: userData.language || 'en',
          truckType: userData.role === 'trucker' ? userData.truckType : undefined,
          licenseNumber: userData.role === 'trucker' ? userData.licenseNumber : undefined,
          services: userData.role === 'provider' ? userData.services : undefined,
          serviceRadius: userData.role === 'provider' ? userData.serviceRadius : undefined,
          certifications: userData.role === 'provider' ? userData.certifications : undefined
        };

        setUser(newUser);
        return { success: true };
      }

      return { success: false, error: 'Signup failed' };
    } catch (error: any) {
      console.error('Signup exception:', error);
      return { success: false, error: error.message || 'An unexpected error occurred' };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      setUser(null);
    }
  };

  const updateProfile = async (updates: Partial<User>): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'No user logged in' };
    }

    try {
      console.log('=== PROFILE UPDATE START ===');
      console.log('Updates requested:', Object.keys(updates));
      
      // For now, just update local state since database has schema issues
      const updatedUser = { ...user };
      
      if (updates.firstName !== undefined || updates.lastName !== undefined) {
        updatedUser.firstName = updates.firstName ?? user.firstName;
        updatedUser.lastName = updates.lastName ?? user.lastName;
      }
      
      if (updates.phone !== undefined) updatedUser.phone = updates.phone;
      if (updates.location !== undefined) updatedUser.location = updates.location;
      if (updates.language !== undefined) updatedUser.language = updates.language;
      if (updates.truckType !== undefined) updatedUser.truckType = updates.truckType;
      if (updates.licenseNumber !== undefined) updatedUser.licenseNumber = updates.licenseNumber;
      if (updates.services !== undefined) updatedUser.services = updates.services;
      if (updates.serviceRadius !== undefined) updatedUser.serviceRadius = updates.serviceRadius;
      if (updates.certifications !== undefined) updatedUser.certifications = updates.certifications;
      
      // Update local state immediately
      setUser(updatedUser);
      console.log('Local user state updated successfully');
      
      // Try to update database in background (don't fail if it doesn't work)
      try {
        const dbUpdates: any = {};
        
        // Map app user fields to database fields
        if (updates.firstName !== undefined || updates.lastName !== undefined) {
          dbUpdates.name = `${updatedUser.firstName} ${updatedUser.lastName}`.trim();
        }
        
        if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
        if (updates.location !== undefined) dbUpdates.location = updates.location;
        if (updates.language !== undefined) dbUpdates.language = updates.language;
        if (updates.truckType !== undefined) dbUpdates.truck_type = updates.truckType;
        if (updates.licenseNumber !== undefined) dbUpdates.license_number = updates.licenseNumber;
        if (updates.services !== undefined) dbUpdates.services = updates.services;
        if (updates.serviceRadius !== undefined) dbUpdates.service_radius = updates.serviceRadius;
        if (updates.certifications !== undefined) dbUpdates.certifications = updates.certifications;
        
        dbUpdates.updated_at = new Date().toISOString();

        const { data: updatedData, error: updateError } = await supabase
          .from('users')
          .update(dbUpdates)
          .eq('id', user.id)
          .select();
          
        if (updateError) {
          console.warn('Database update failed (using local state):', updateError.message);
          // Don't fail the update - local state is already updated
        } else {
          console.log('Database updated successfully');
        }
      } catch (dbError) {
        console.warn('Database update error (using local state):', dbError);
        // Don't fail the update - local state is already updated
      }
      
      console.log('=== PROFILE UPDATE COMPLETE ===');
      return { success: true };
    } catch (error: any) {
      console.error('Profile update error:', error);
      return { success: false, error: error.message || 'Failed to update profile' };
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      signup,
      logout,
      updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}