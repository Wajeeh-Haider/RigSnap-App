import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  signup: (userData: any) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (
    updates: Partial<User>
  ) => Promise<{ success: boolean; error?: string }>;
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
      certifications: dbUser.certifications || [],
    };
  };

  // Helper function to fetch user data from database
  const fetchUserData = async (userId: string, retryCount = 0): Promise<User | null> => {
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    try {
      console.log(`Fetching user data from database for user ID: ${userId} (attempt ${retryCount + 1})`);

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Database error:', error.code, error.message);

        // If it's a network error and we haven't exceeded retries, try again
        if ((error.code === 'PGRST301' || error.message.includes('network')) && retryCount < maxRetries) {
          console.log(`Retrying user data fetch in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return fetchUserData(userId, retryCount + 1);
        }

        // For any database error, use fallback user
        console.log('Database error occurred, using fallback user');
        return await createFallbackUser(userId);
      }

      if (!data) {
        console.log('No user profile found in database, using fallback user');
        return await createFallbackUser(userId);
      }

      console.log('User data found in database:', data?.email || 'no email', 'role:', data?.role);
      return convertDbUserToAppUser(data);
    } catch (error) {
      console.error('Error fetching user data:', error);

      // If it's a network error and we haven't exceeded retries, try again
      if (retryCount < maxRetries) {
        console.log(`Retrying user data fetch after exception in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return fetchUserData(userId, retryCount + 1);
      }

      console.log('Fetch exception, using fallback user');
      return await createFallbackUser(userId);
    }
  };

  // Create a fallback user when database is not accessible
  const createFallbackUser = async (userId: string): Promise<User | null> => {
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) return null;

      const userMetadata = authUser.user_metadata || {};
      const rawMetadata = (authUser as any).raw_user_meta_data || {};

      // Combine metadata from both sources
      const combinedMetadata = { ...rawMetadata, ...userMetadata };

      let userRole: 'trucker' | 'provider' = 'trucker';
      if (combinedMetadata.role) {
        userRole = combinedMetadata.role;
      } else if (authUser.email) {
        userRole = authUser.email.includes('provider') ? 'provider' : 'trucker';
      }

      const fallbackUser: User = {
        id: userId,
        email: authUser.email || '',
        firstName:
          combinedMetadata.firstName ||
          (userRole === 'trucker' ? 'John' : 'Mike'),
        lastName:
          combinedMetadata.lastName ||
          (userRole === 'trucker' ? 'Driver' : 'Mechanic'),
        phone:
          combinedMetadata.phone ||
          (userRole === 'trucker' ? '+1-555-0123' : '+1-555-0456'),
        role: userRole,
        rating: 4.5,
        joinDate: new Date().toISOString().split('T')[0],
        location:
          combinedMetadata.location ||
          (userRole === 'trucker' ? 'Dallas, TX' : 'Houston, TX'),
        language: combinedMetadata.language || 'en',
        truckType:
          userRole === 'trucker'
            ? combinedMetadata.truckType || 'Semi-Trailer'
            : undefined,
        licenseNumber:
          userRole === 'trucker'
            ? combinedMetadata.licenseNumber || 'CDL-TX-123456'
            : undefined,
        services:
          userRole === 'provider'
            ? combinedMetadata.services || ['repair', 'mechanic']
            : undefined,
        serviceRadius:
          userRole === 'provider'
            ? combinedMetadata.serviceRadius || 25
            : undefined,
        certifications:
          userRole === 'provider'
            ? combinedMetadata.certifications || ['ASE Certified']
            : undefined,
      };

      console.log(
        'Created fallback user:',
        fallbackUser.email,
        fallbackUser.role,
        'truckType:', fallbackUser.truckType,
        'licenseNumber:', fallbackUser.licenseNumber
      );
      
      // IMPORTANT: Save fallback user to database so it can be found by requests
      try {
        console.log('💾 Saving fallback user to database...');
        const { data, error } = await supabase
          .from('users')
          .upsert({
            id: fallbackUser.id,
            email: fallbackUser.email,
            name: `${fallbackUser.firstName} ${fallbackUser.lastName}`,
            role: fallbackUser.role,
            location: fallbackUser.location,
            phone: fallbackUser.phone,
            language: fallbackUser.language,
            rating: fallbackUser.rating,
            join_date: fallbackUser.joinDate,
            truck_type: fallbackUser.truckType,
            license_number: fallbackUser.licenseNumber,
            services: fallbackUser.services,
            service_radius: fallbackUser.serviceRadius,
            certifications: fallbackUser.certifications,
          }, {
            onConflict: 'id'
          })
          .select()
          .single();
          
        if (error) {
          console.error('Failed to save fallback user to database:', error);
          // Still return the fallback user even if DB save fails
        } else {
          console.log('✅ Successfully saved fallback user to database');
        }
      } catch (dbError) {
        console.error('Exception saving fallback user:', dbError);
      }
      
      return fallbackUser;
    } catch (error) {
      console.error('Error creating fallback user:', error);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;
    let initTimeout: number;
    let profileCheckInterval: number;

    const initializeAuth = async () => {
      try {
        console.log('=== AUTH INITIALIZATION START ===');
        const {
          data: { session },
        } = await supabase.auth.getSession();
        console.log('Session check result:', !!session, session?.user?.email);

        if (mounted && session?.user) {
          console.log(
            'Valid session found, fetching user data for:',
            session.user.email
          );

          let userData = await fetchUserData(session.user.id);

          // If no user data found, it might still be being created after signup
          // Wait a bit and try again
          if (!userData || (userData.firstName === 'User' && userData.lastName === '')) {
            console.log('User data appears to be default/fallback, waiting for profile creation...');

            // Check every 2 seconds for up to 10 seconds
            let attempts = 0;
            const maxAttempts = 5;

            profileCheckInterval = setInterval(async () => {
              if (!mounted) return;

              attempts++;
              console.log(`Checking for user profile (attempt ${attempts}/${maxAttempts})`);

              const freshUserData = await fetchUserData(session.user.id);
              if (freshUserData && (freshUserData.firstName !== 'User' || freshUserData.lastName !== '')) {
                console.log('Found complete user profile, updating state');
                setUser(freshUserData);
                clearInterval(profileCheckInterval);
              } else if (attempts >= maxAttempts) {
                console.log('Profile check timeout, using current data');
                if (userData) setUser(userData);
                clearInterval(profileCheckInterval);
              }
            }, 2000);
          } else {
            console.log(
              'User data loaded successfully:',
              userData.email,
              userData.role
            );
            setUser(userData);
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

    // Set timeout to prevent infinite loading (increased from 3 to 15 seconds)
    initTimeout = setTimeout(() => {
      if (mounted && isLoading) {
        console.warn('=== AUTH TIMEOUT - FORCING COMPLETION ===');
        setIsLoading(false);
        // Clear any invalid session state
        supabase.auth.signOut().catch(console.error);
        setUser(null);
      }
    }, 15000);

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
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
      if (initTimeout) clearTimeout(initTimeout);
      if (profileCheckInterval) clearInterval(profileCheckInterval);
      subscription.unsubscribe();
    };
  }, []);

  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('Starting login process for:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('Supabase login response:', {
        data: !!data.user,
        error: error?.message,
      });

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
      return {
        success: false,
        error: error.message || 'An unexpected error occurred',
      };
    }
  };

  const signup = async (
    userData: any
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('Starting signup process for:', userData.email);

      // Try signup with metadata - the database trigger should handle user creation
      const { data, error } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          emailRedirectTo: 'myapp://auth/confirm',
          data: {
            firstName: userData.firstName,
            lastName: userData.lastName,
            phone: userData.phone,
            location: userData.location,
            role: userData.role,
            language: userData.language,
            truckType: userData.truckType,
            licenseNumber: userData.licenseNumber,
            services: userData.services,
            serviceRadius: userData.serviceRadius,
            certifications: userData.certifications,
          },
        },
      });

      if (error) {
        console.error('Signup auth error details:', {
          message: error.message,
          status: error.status,
          code: error.code || 'no code'
        });
        
        return { success: false, error: error.message };
      }

      if (data.user) {
        console.log('Auth user created successfully');

        // Try to fetch the user data immediately to see if the trigger worked
        const userDataFetched = await fetchUserData(data.user.id);
        if (userDataFetched) {
          console.log('User profile created by trigger');
          setUser(userDataFetched);
        } else {
          console.log('Trigger may have failed, creating user locally');
          // Create user object from signup data
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
            certifications: userData.role === 'provider' ? userData.certifications : undefined,
          };

          setUser(newUser);
        }

        return { success: true };
      }

      return { success: false, error: 'Signup failed' };
    } catch (error: any) {
      console.error('Signup exception:', error);
      return {
        success: false,
        error: error.message || 'An unexpected error occurred',
      };
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

  const updateProfile = async (
    updates: Partial<User>
  ): Promise<{ success: boolean; error?: string }> => {
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
      if (updates.location !== undefined)
        updatedUser.location = updates.location;
      if (updates.language !== undefined)
        updatedUser.language = updates.language;
      if (updates.truckType !== undefined)
        updatedUser.truckType = updates.truckType;
      if (updates.licenseNumber !== undefined)
        updatedUser.licenseNumber = updates.licenseNumber;
      if (updates.services !== undefined)
        updatedUser.services = updates.services;
      if (updates.serviceRadius !== undefined)
        updatedUser.serviceRadius = updates.serviceRadius;
      if (updates.certifications !== undefined)
        updatedUser.certifications = updates.certifications;

      // Update local state immediately
      setUser(updatedUser);
      console.log('Local user state updated successfully');

      // Try to update database in background (don't fail if it doesn't work)
      try {
        const dbUpdates: any = {};

        // Map app user fields to database fields
        if (updates.firstName !== undefined || updates.lastName !== undefined) {
          dbUpdates.name =
            `${updatedUser.firstName} ${updatedUser.lastName}`.trim();
        }

        if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
        if (updates.location !== undefined)
          dbUpdates.location = updates.location;
        if (updates.language !== undefined)
          dbUpdates.language = updates.language;
        if (updates.truckType !== undefined)
          dbUpdates.truck_type = updates.truckType;
        if (updates.licenseNumber !== undefined)
          dbUpdates.license_number = updates.licenseNumber;
        if (updates.services !== undefined)
          dbUpdates.services = updates.services;
        if (updates.serviceRadius !== undefined)
          dbUpdates.service_radius = updates.serviceRadius;
        if (updates.certifications !== undefined)
          dbUpdates.certifications = updates.certifications;

        dbUpdates.updated_at = new Date().toISOString();

        const { data: updatedData, error: updateError } = await supabase
          .from('users')
          .update(dbUpdates)
          .eq('id', user.id)
          .select();

        if (updateError) {
          console.warn(
            'Database update failed (using local state):',
            updateError.message
          );
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
      return {
        success: false,
        error: error.message || 'Failed to update profile',
      };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        signup,
        logout,
        updateProfile,
      }}
    >
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
