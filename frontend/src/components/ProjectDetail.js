const fetchCurrentUser = async () => {
  try {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (storedUser && token) {
      const user = JSON.parse(storedUser);
      setCurrentUser(user);
      
      // Set role based on is_admin flag
      if (user.is_admin) {
        setUserRole('ADMIN');
        setEffectiveRole('ADMIN');
      } else {
        setUserRole('MEMBER');
        setEffectiveRole('MEMBER');
      }
    }
  } catch (error) {
    console.error('Error fetching current user:', error);
  }
}; 