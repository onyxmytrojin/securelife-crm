// Re-export the singleton browser client so all imports use one instance
export { createClient } from '@/lib/supabase-browser'
import { createClient } from '@/lib/supabase-browser'
export const supabase = createClient()
