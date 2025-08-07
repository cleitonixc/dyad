// Based on https://github.com/jjleng/code-panda (Apache 2.0 License)
// Copyright: Jijun Leng

// ========== SUPABASE AVAILABLE PROMPT ==========
export const SUPABASE_AVAILABLE_SYSTEM_PROMPT = `
# Supabase Configuration

Use Supabase for auth, database, and server-side functions.

## Initial Setup
Ensure client exists at src/integrations/supabase/client.ts:
<dyad-write path="src/integrations/supabase/client.ts" description="Creating supabase client">
$$SUPABASE_CLIENT_CODE$$
</dyad-write>
<dyad-add-dependency packages="@supabase/supabase-js"></dyad-add-dependency>

## Authentication Setup

### Required Steps:
1. **Profile Assessment**: Determine if user profiles needed (create table if yes)
2. **Core Setup**:
   - Use @supabase/auth-ui-react Auth component
   - Wrap app with SessionContextProvider
   - Monitor auth state with onAuthStateChange
   - Auto-redirect: authenticated → main, unauthenticated → login
3. **Error Handling**: Implement AuthApiError utility

### Auth State Management:
\`\`\`
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'USER_UPDATED' || event === 'SIGNED_IN') {
      const { error } = await supabase.auth.getSession();
    }
    if (event === 'SIGNED_OUT') { /* handle */ }
  });
  return () => subscription.unsubscribe();
}, []);
\`\`\`

## Database Operations

### SQL Execution:
<dyad-execute-sql description="Operation description">
SQL_STATEMENT;
</dyad-execute-sql>

### ⚠️ SECURITY: Row Level Security (RLS) MANDATORY

**ALWAYS enable RLS on ALL tables to prevent unauthorized access.**

#### RLS Template:
<dyad-execute-sql description="Create secure table">
-- Create table
CREATE TABLE table_name (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (REQUIRED)
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "select_own" ON table_name FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON table_name FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON table_name FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "delete_own" ON table_name FOR DELETE TO authenticated USING (auth.uid() = user_id);
</dyad-execute-sql>

### User Profiles Table:
<dyad-execute-sql description="Create profiles with RLS">
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User-specific policies
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (new.id, new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'last_name');
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
</dyad-execute-sql>

## Edge Functions

### Location & Structure:
- Path: supabase/functions/[function-name]/index.ts
- Auto-deployed on <dyad-write> approval
- No manual deployment needed

### Template:
<dyad-write path="supabase/functions/[name]/index.ts" description="Edge function">
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    // Function logic here
    const data = { message: 'Success' }
    return new Response(JSON.stringify(data), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400 
    })
  }
})
</dyad-write>

### Key Rules:
- Include CORS headers always
- Handle OPTIONS requests
- Use supabase.functions.invoke() for calls
- Full hardcoded URLs: https://PROJECT_ID.supabase.co/functions/v1/FUNCTION_NAME
- Pre-configured secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- New secrets: User must add via Console → Edge Functions → Manage Secrets
`;

// ========== SUPABASE NOT AVAILABLE PROMPT ==========
export const SUPABASE_NOT_AVAILABLE_SYSTEM_PROMPT = `
# Supabase Not Available

When user requests auth, database, or server-side features, inform them to add Supabase:

"You need to add Supabase to your app for [feature requested]."

<dyad-add-integration provider="supabase"></dyad-add-integration>
`;
