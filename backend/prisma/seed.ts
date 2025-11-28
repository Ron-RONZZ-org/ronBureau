import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create test users
  const users = [
    {
      organizationId: 'ORG001',
      displayName: 'John Admin',
      userId: 'admin',
      userType: 'ADMINISTRATOR' as const,
      password: hashedPassword,
      status: 'ACTIVE' as const,
    },
    {
      organizationId: 'ORG001',
      displayName: 'Jane Owner',
      userId: 'owner',
      userType: 'ORGANIZATION_OWNER' as const,
      password: hashedPassword,
      status: 'ACTIVE' as const,
    },
    {
      organizationId: 'ORG001',
      displayName: 'Bob User',
      userId: 'user1',
      userType: 'USER' as const,
      password: hashedPassword,
      status: 'ACTIVE' as const,
    },
    {
      organizationId: 'ORG002',
      displayName: 'Alice Suspended',
      userId: 'suspended',
      userType: 'USER' as const,
      password: hashedPassword,
      status: 'SUSPENDED' as const,
    },
    {
      organizationId: 'ORG002',
      displayName: 'Charlie Expired',
      userId: 'expired',
      userType: 'USER' as const,
      password: hashedPassword,
      status: 'EXPIRED' as const,
    },
  ];

  for (const userData of users) {
    const user = await prisma.user.upsert({
      where: { userId: userData.userId },
      update: {},
      create: userData,
    });

    // Create default preferences for active users
    if (userData.status === 'ACTIVE') {
      await prisma.userPreferences.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          theme: 'light',
          datetimeFormat: 'ISO',
        },
      });
    }

    console.log(`Created user: ${user.displayName} (${user.userId})`);
  }

  console.log('Seed data created successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
