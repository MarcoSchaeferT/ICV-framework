import 'dotenv/config';
import { defineConfig } from 'prisma/config';


// prisma is only used for GUI database inspection via prisma studio
export default defineConfig({
  schema: 'db/schema.prisma',
  migrations: {
    path: 'db/migrations'
  },
  datasource: {
    url: process.env.DATABASE_URL!
  }
});
