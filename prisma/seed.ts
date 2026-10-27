import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@gotravelnha.com' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@gotravelnha.com',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      isActive: true
    }
  })
  console.log('✅ Created admin user:', admin.email)

  // Create sample regular user
  const userPassword = await bcrypt.hash('user123', 10)
  const user = await prisma.user.upsert({
    where: { email: 'user@gotravelnha.com' },
    update: {},
    create: {
      username: 'testuser',
      email: 'user@gotravelnha.com',
      password: userPassword,
      firstName: 'Test',
      lastName: 'User',
      role: 'USER',
      isActive: true
    }
  })
  console.log('✅ Created test user:', user.email)

  // Seed default Klook widgets using official Klook portal categories
  // Note: widgetId is optional for Dynamic Widgets - only adId is required
  // Simplified widgets - only adId needed (one per category from Klook portal)
  const defaultWidgets = [
    {
      adId: '1154201', // Attractions & shows - get from Klook portal
      name: 'Attractions & shows',
      description: 'Theme parks, museums, and shows',
      icon: '🏰',
      category: 'attractions',
      widgetType: 'things_to_do',
      displayOrder: 1,
      isActive: true
    },
    {
      adId: '1154194', // Tours & sightseeing - get from Klook portal
      name: 'Tours & sightseeing',
      description: 'Guided tours and sightseeing experiences',
      icon: '🚶',
      category: 'tours',
      widgetType: 'things_to_do',
      displayOrder: 2,
      isActive: true
    },
    {
      adId: '1154125', // Activities & experiences - get from Klook portal
      name: 'Activities & experiences',
      description: 'Adventure activities and unique experiences',
      icon: '🎢',
      category: 'activities',
      widgetType: 'things_to_do',
      displayOrder: 3,
      isActive: true
    },
    {
      adId: '1154197', // Food & dining - get from Klook portal
      name: 'Food & dining',
      description: 'Restaurant reservations and dining experiences',
      icon: '🍜',
      category: 'food',
      widgetType: 'things_to_do',
      displayOrder: 4,
      isActive: true
    },
    {
      adId: '1154199', // Transport & WiFi - get from Klook portal
      name: 'Transport & WiFi',
      description: 'Trains, buses, and connectivity',
      icon: '🚌',
      category: 'transport',
      widgetType: 'things_to_do',
      displayOrder: 5,
      isActive: true
    },
    {
      adId: '1154200', // Attraction passes - get from Klook portal
      name: 'Attraction passes',
      description: 'Multi-attraction passes and packages',
      icon: '🎫',
      category: 'passes',
      widgetType: 'things_to_do',
      displayOrder: 6,
      isActive: true
    }
    // Note: Add hotel widgets here when you create them in Klook portal
    // Example:
    // {
    //   adId: 'XXXXXX', // Hotel widget Ad ID from Klook portal
    //   name: 'Singapore Hotels',
    //   description: 'Best hotels in Singapore',
    //   icon: '🏨',
    //   category: 'hotels',
    //   widgetType: 'hotels',
    //   displayOrder: 1,
    //   isActive: true
    // }
  ]

  for (const widget of defaultWidgets) {
    await prisma.klookWidget.upsert({
      where: { name: widget.name },
      update: {
        adId: widget.adId,
        description: widget.description,
        icon: widget.icon,
        category: widget.category || null,
        widgetType: widget.widgetType || 'things_to_do',
        displayOrder: widget.displayOrder,
        isActive: widget.isActive !== undefined ? widget.isActive : true
      },
      create: {
        adId: widget.adId,
        name: widget.name,
        description: widget.description,
        icon: widget.icon,
        category: widget.category || null,
        widgetType: widget.widgetType || 'things_to_do',
        displayOrder: widget.displayOrder,
        isActive: widget.isActive !== undefined ? widget.isActive : true
      }
    })
  }
  console.log(`✅ Seeded ${defaultWidgets.length} Klook widgets`)

  console.log('🎉 Seed completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

