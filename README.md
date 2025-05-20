# SecurePass - Your Digital Memory Saver 🧠

## The Story Behind SecurePass

Picture this: It's Monday morning, you're running late for work, and you need to check your bank account. You type in your password... "Incorrect password". You try again... "Incorrect password". You start sweating. "Was it my dog's name? My birthday? My favorite pizza topping? 🤔"

We've all been there - that moment when you realize you've forgotten yet another password. And let's be honest, who hasn't used "password123" at least once? (Don't worry, your secret is safe with us! 😉)

That's why we created **SecurePass** - your friendly neighborhood password manager that's here to save the day (and your sanity)!

## Why SecurePass? 🚀

- **Never Forget Again**: Store all your passwords in one secure place
- **Super Secure**: Your passwords are encrypted and protected
- **Easy to Use**: Clean, simple interface that won't make you cry
- **Google Sign-in**: No need to remember another password (ironic, right? 😄)

## Features ✨

- 🔐 Secure password storage
- 🔒 End-to-end encryption
- 👤 Google authentication
- 📱 Responsive design

## Getting Started 🏁

1. Clone this repository
2. Copy `.env.example` to `.env` and fill in your values
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Tech Stack 🛠️

- Next.js 14
- TypeScript
- Prisma
- PostgreSQL
- NextAuth.js
- Tailwind CSS
- Headless UI
- Heroicons
- bcryptjs

## Contributing 🤝

Found a bug? Have a feature request? We'd love to hear from you! Feel free to open an issue or submit a pull request.

## License 📝

MIT License - feel free to use this project for your own password management needs!

---

Remember: The only password you need to remember now is the Google account. And if you forget that one... well, we might need to have a serious talk about your memory! 😅

Made with ❤️ and a lot of forgotten passwords

## Features

- 🔐 Secure password storage with encryption
- 👤 Google Authentication
- 📱 Beautiful and responsive UI
- 🔄 Real-time updates
- 🛡️ Secure password handling

## Prerequisites

- Node.js 18+ installed
- PostgreSQL installed and running
- Google Cloud Platform account for OAuth credentials

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd password-manager
```

2. Install dependencies:
```bash
npm install
```

3. Set up your PostgreSQL database:
```bash
createdb password_manager
```

4. Configure environment variables:
Create a `.env` file in the root directory with the following variables:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/password_manager?schema=public"
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

5. Set up Google OAuth:
   - Go to the [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project
   - Enable the Google+ API
   - Navigate to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Select "Web application" as the application type
   - Add a name for your OAuth client
   - Under "Authorized redirect URIs", add:
     ```
     http://localhost:3000/api/auth/callback/google
     ```
   - Click "Create"
   - Copy the generated Client ID and Client Secret
   - Add them to your `.env` file:
     ```
     GOOGLE_CLIENT_ID="your-client-id-here"
     GOOGLE_CLIENT_SECRET="your-client-secret-here"
     ```
   - Important: Make sure the redirect URI exactly matches `http://localhost:3000/api/auth/callback/google`
   - If you're deploying to production, add your production URL as well:
     ```
     https://your-domain.com/api/auth/callback/google
     ```

6. Initialize the database:
```bash
npx prisma generate
npx prisma db push
```

7. Run the development server:
```bash
npm run dev
```

8. Open [http://localhost:3000](http://localhost:3000) in your browser

## Security Features

- Passwords are encrypted using bcrypt before storage
- Google OAuth for secure authentication
- Session-based authentication
- CSRF protection
- Secure password transmission

## Technologies Used

- Next.js 13+ (App Router)
- TypeScript
- PostgreSQL
- Prisma ORM
- NextAuth.js
- Tailwind CSS
- Heroicons
- Headless UI 

## Project Structure

```
password-manager/
├── src/                    # Source directory
│   ├── app/               # Next.js app directory (App Router)
│   │   ├── api/          # API routes
│   │   ├── auth/         # Authentication related pages
│   │   └── layout.tsx    # Root layout
│   └── components/       # Reusable React components
├── lib/                   # Utility functions and shared code
├── prisma/               # Prisma schema and migrations
│   └── schema.prisma     # Database schema
├── public/               # Static assets
├── types/                # TypeScript type definitions
├── .env                  # Environment variables
├── .env.example         # Example environment variables
├── .gitignore           # Git ignore file
├── next.config.js       # Next.js configuration
├── package.json         # Project dependencies
├── tsconfig.json        # TypeScript configuration
└── README.md            # Project documentation
```

### Key Files and Folders

- `src/app/`: Contains all the pages and API routes using Next.js 14 App Router
- `src/components/`: Reusable React components
- `lib/`: Shared utilities and helper functions
- `prisma/`: Database schema and migration files
- `public/`: Static assets like images and fonts
- `types/`: TypeScript type definitions and interfaces
- `.env`: Environment variables (not committed to version control)
- `next.config.js`: Next.js configuration file
- `package.json`: Project dependencies and scripts
- `tsconfig.json`: TypeScript configuration

## Development Guidelines

### Code Style and Standards

- Follow the [TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
- Use ESLint and Prettier for code formatting
- Maximum line length: 100 characters
- Use meaningful variable and function names
- Write comments for complex logic
- Follow the DRY (Don't Repeat Yourself) principle
- Use async/await instead of raw promises
- Implement proper error handling

### Git Workflow

1. **Branching Strategy**
   - `main` - Production-ready code
   - `develop` - Integration branch for features
   - `feature/*` - New features
   - `bugfix/*` - Bug fixes
   - `hotfix/*` - Urgent production fixes
   - `release/*` - Release preparation

2. **Commit Guidelines**
   - Use conventional commits format:
     ```
     feat: add new feature
     fix: resolve bug
     docs: update documentation
     style: format code
     refactor: restructure code
     test: add tests
     chore: update dependencies
     ```
   - Write clear, descriptive commit messages
   - Reference issue numbers when applicable

3. **Pull Request Process**
   - Create feature branches from `develop`
   - Keep PRs focused and small
   - Include tests for new features
   - Update documentation as needed
   - Request reviews from at least one team member
   - Ensure CI/CD checks pass

### Development Workflow

1. **Local Development**
   ```bash
   # Create and switch to feature branch
   git checkout -b feature/your-feature-name

   # Install dependencies
   npm install

   # Start development server
   npm run dev

   # Run tests
   npm test

   # Run linting
   npm run lint
   ```
