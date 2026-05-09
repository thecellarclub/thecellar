/**
 * One-time script to hash and upsert admin user passwords.
 * Run with: npx tsx scripts/seed-admin-users.ts
 *
 * Reads passwords from env vars ADMIN_PW_DANIEL, ADMIN_PW_JULIA, ADMIN_PW_CRAIG,
 * or prompts interactively if not set.
 */
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'
import { createInterface } from 'readline'

const USERS = [
  { name: 'Daniel', email: 'daniel@thecellar.club', envVar: 'ADMIN_PW_DANIEL' },
  { name: 'Julia',  email: 'julia@thebothy.club',   envVar: 'ADMIN_PW_JULIA'  },
  { name: 'Craig',  email: 'craig@thecellar.club',   envVar: 'ADMIN_PW_CRAIG'  },
]

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const sb = createClient(supabaseUrl, supabaseKey)

  for (const user of USERS) {
    let password = process.env[user.envVar] ?? ''
    if (!password) {
      password = await prompt(`Password for ${user.name} (${user.email}): `)
    }
    if (!password) {
      console.warn(`Skipping ${user.name} — no password provided`)
      continue
    }

    const hash = await bcrypt.hash(password, 12)

    const { error } = await sb
      .from('admin_users')
      .upsert(
        { email: user.email, name: user.name, password_hash: hash },
        { onConflict: 'email' }
      )

    if (error) {
      console.error(`Failed to upsert ${user.name}:`, error.message)
    } else {
      console.log(`✓ ${user.name} (${user.email}) upserted`)
    }
  }

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
