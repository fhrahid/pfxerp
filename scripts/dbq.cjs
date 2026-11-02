const { PrismaClient } = require('@prisma/client');

const p = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://pointfex_admin:pointfex_dev_password@localhost:5432/pointfex_db?schema=public',
    },
  },
});

p.$queryRawUnsafe(process.argv[2])
  .then((rows) => {
    const val = rows && rows[0] ? Object.values(rows[0])[0] : '';
    process.stdout.write(String(val ?? ''));
    return p.$disconnect();
  })
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });

