# Password Manager Setup Guide

This guide will help you set up the Password Manager project on a new PC.

## Prerequisites

1. Install Node.js 18 or higher
   - Download from: https://nodejs.org/
   - Verify installation: `node --version`

2. Install PostgreSQL
   - Download from: https://www.postgresql.org/download/
   - Default port: 5432
   - Remember your password for the postgres user

3. Install Git
   - Download from: https://git-scm.com/downloads
   - Verify installation: `git --version`

## Step-by-Step Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd password-manager
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up PostgreSQL Database
1. Open PostgreSQL command prompt or pgAdmin
2. Create a new database:
```sql
CREATE DATABASE password_manager;
```

### 4. Configure Environment Variables
1. Create a `.env` file in the root directory
2. Add the following variables:
```
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/password_manager?schema=public"
NEXTAUTH_SECRET="generate-a-secure-random-string"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### 5. Set Up Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Google+ API
4. Go to "APIs & Services" > "Credentials"
5. Click "Create Credentials" > "OAuth client ID"
6. Select "Web application"
7. Add authorized redirect URI:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
8. Copy Client ID and Client Secret to your `.env` file

### 6. Initialize Database
```bash
npx prisma generate
npx prisma db push
```

### 7. Start Development Server
```bash
npm run dev
```

### 8. Access the Application
Open your browser and go to: http://localhost:3000

## Troubleshooting

### Common Issues

1. Database Connection Error
   - Verify PostgreSQL is running
   - Check DATABASE_URL in .env
   - Ensure correct password in connection string

2. Google OAuth Error
   - Verify redirect URI matches exactly
   - Check Client ID and Secret
   - Ensure Google+ API is enabled

3. Node.js Version Error
   - Run `node --version` to check version
   - Install Node.js 18+ if needed

4. Port Already in Use
   - Check if port 3000 is available
   - Kill process using port 3000
   - Or change port in package.json scripts

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run linter
npm run lint
```

## Security Notes

1. Never commit `.env` file
2. Keep your Google OAuth credentials secure
3. Use strong passwords for PostgreSQL
4. Regularly update dependencies

## Need Help?

If you encounter any issues:
1. Check the error message carefully
2. Verify all prerequisites are installed
3. Ensure all environment variables are set correctly
4. Check the console for detailed error logs 