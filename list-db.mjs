import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tnoybgdiwiyvnepcuksm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRub3liZ2Rpd2l5dm5lcGN1a3NtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODU5NTczNywiZXhwIjoyMDk0MTcxNzM3fQ.xCdVactarx2mEhyz0-TlMlLNLqaZiMpSAw9zZGgt2ww';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const email = 'st10377293@myemeris.edu.za';
  
  // Find user ID from public.users or auth.users
  const { data: users, error: uErr } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (uErr) {
    console.error('User not found in public.users:', uErr);
    return;
  }

  console.log('User ID:', users.id);

  // Update password via admin API
  const { data, error } = await supabase.auth.admin.updateUserById(
    users.id,
    { password: 'Password123!' }
  );

  if (error) {
    console.error('Failed to update password:', error);
  } else {
    console.log('Password updated successfully for', email);
  }
}

run();
