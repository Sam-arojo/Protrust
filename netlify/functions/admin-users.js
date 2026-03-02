const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Verify JWT token
function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-change-in-production');
    return decoded;
  } catch (error) {
    return null;
  }
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Verify authentication
    const decoded = verifyToken(event.headers.authorization);
    
    if (!decoded) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    // Check if user is admin
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', decoded.userId)
      .single();

    if (!user || user.role !== 'admin') {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Access denied. Admin only.' })
      };
    }

    // Get pending users (not approved yet)
    const { data: pendingUsers, error: pendingError } = await supabase
      .from('users')
      .select('*')
      .eq('is_approved', false)
      .eq('role', 'manufacturer')
      .order('created_at', { ascending: false });

    if (pendingError) {
      console.error('Pending users error:', pendingError);
    }

    // Get all users
    const { data: allUsers, error: allError } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (allError) {
      console.error('All users error:', allError);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        pendingUsers: pendingUsers || [],
        allUsers: allUsers || []
      })
    };

  } catch (error) {
    console.error('Admin users error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Server error' })
    };
  }
};
