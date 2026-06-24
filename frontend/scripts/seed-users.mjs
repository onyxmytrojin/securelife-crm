import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://gtjbuqyyctcjlpurgsdu.supabase.co',
  'process.env.SUPABASE_SERVICE_ROLE_KEY'
)

const users = [
  { email: 'broker@securelife.com', password: process.env.NEXT_PUBLIC_DEMO_BROKER_PASSWORD ?? '', role: 'broker', name: 'Rahul Mehta' },
  { email: 'customer@demo.com',     password: process.env.NEXT_PUBLIC_DEMO_CUSTOMER_PASSWORD ?? '', role: 'customer', name: 'Priya Sharma' },
]

for (const u of users) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
    user_metadata: { role: u.role, name: u.name },
  })
  if (error) {
    console.log(`SKIP  ${u.email}: ${error.message}`)
  } else {
    console.log(`OK    ${u.email} (${u.role}) → ${data.user.id}`)
  }
}
