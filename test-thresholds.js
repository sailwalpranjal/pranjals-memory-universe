require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testThresholds() {
  const dummy = Array.from({length: 128}, () => Math.random() - 0.5);
  const { data: matches } = await supabase.rpc('match_faces', { query_embedding: `[${dummy.join(',')}]`, match_threshold: 0.1, match_count: 5 });
  console.log("Matches for random face:", matches);
}
testThresholds();
