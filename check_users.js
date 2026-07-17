const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.findMany({
  select: { email: true, firstName: true, status: true, failedLoginAttempts: true, lockedUntil: true },
  take: 10
}).then(users => {
  console.log(JSON.stringify(users, null, 2));
  prisma.$disconnect();
}).catch(e => {
  console.error(e.message);
  prisma.$disconnect();
});
