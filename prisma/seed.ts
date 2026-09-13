import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Passw0rd123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@messkhuji.com' },
    update: {},
    create: { name: 'Platform Admin', email: 'admin@messkhuji.com', passwordHash, role: Role.ADMIN },
  });

  const provider = await prisma.user.upsert({
    where: { email: 'provider@messkhuji.com' },
    update: {},
    create: { name: 'Test Provider', email: 'provider@messkhuji.com', passwordHash, role: Role.PROVIDER },
  });

  const customer = await prisma.user.upsert({
    where: { email: 'customer@messkhuji.com' },
    update: {},
    create: { name: 'Test Customer', email: 'customer@messkhuji.com', passwordHash, role: Role.CUSTOMER },
  });

  const listing = await prisma.listing.create({
    data: {
      providerId: provider.id,
      title: 'Sunny Shared Mess near NSU',
      description: 'A well-furnished shared mess close to campus, 3 minutes walk.',
      city: 'Dhaka',
      address: 'Bashundhara R/A, Road 12',
      rentAmount: 8000,
      roomType: 'shared',
      capacity: 4,
      amenities: ['wifi', 'attached bathroom', 'laundry'],
      images: [],
    },
  });

  console.log({ admin: admin.email, provider: provider.email, customer: customer.email, listing: listing.title });
  console.log('Seed password for all accounts: Password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
