/**
 * Operator-only tool to grant or revoke a platform role in PostgreSQL.
 * There is intentionally no HTTP endpoint for this. The user must have
 * signed in at least once (so their `users` row exists).
 *
 *   npm run grant-role -w @neighbourhood/api -- <email> <staff|product_category_editor> [--revoke]
 */
import { PlatformRoleSchema } from '@neighbourhood/shared';
import { loadConfig } from '../src/config.js';
import { createDb } from '../src/lib/db.js';

const [emailArg, roleArg, flag] = process.argv.slice(2);
const role = PlatformRoleSchema.safeParse(roleArg);
if (!emailArg || !role.success) {
  console.error('Usage: grant-role <email> <staff|product_category_editor> [--revoke]');
  process.exit(1);
}

const config = loadConfig();
const db = createDb(config.databaseUrl!);
try {
  const user = await db.user.findUnique({ where: { email: emailArg.trim().toLowerCase() }, select: { id: true } });
  if (!user) {
    console.error('No user with that email. They must sign in once first.');
    process.exitCode = 1;
  } else if (flag === '--revoke') {
    await db.userRole.deleteMany({ where: { userId: user.id, role: role.data } });
    console.warn(`Revoked ${role.data} from user ${user.id}`);
  } else {
    await db.userRole.upsert({
      where: { userId_role: { userId: user.id, role: role.data } },
      update: {},
      create: { userId: user.id, role: role.data },
    });
    console.warn(`Granted ${role.data} to user ${user.id}`);
  }
} finally {
  await db.$disconnect();
}
