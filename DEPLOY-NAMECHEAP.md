# Deploy EmojiCopyPaster on Namecheap Node.js Hosting

## Step 1: Get a PostgreSQL Database

Your app needs a PostgreSQL database. If Namecheap doesn't include one, create a free database at https://neon.tech:
1. Sign up at neon.tech
2. Create a new project
3. Copy the connection string (looks like: postgresql://user:password@host/database?sslmode=require)

## Step 2: Download the App

Download the full app from GitHub:
https://github.com/rookie7312/emojicopypaster/archive/refs/heads/main.zip

Unzip it on your computer.

## Step 3: Upload to Namecheap

1. Log into your Namecheap cPanel
2. Go to "Setup Node.js App"
3. Click "Create Application"
4. Set:
   - Node.js version: 20 (or latest available)
   - Application mode: Production
   - Application root: the folder where you uploaded the files
   - Application startup file: dist/index.cjs
   - Port: will be auto-assigned by Namecheap

5. Upload all the files from the zip to your application root using File Manager or FTP

## Step 4: Set Environment Variables

In the Node.js app setup page, add these environment variables:
- DATABASE_URL = your PostgreSQL connection string from Step 1
- SESSION_SECRET = any random text (e.g., my-secret-key-abc123)
- NODE_ENV = production
- PORT = (use whatever port Namecheap assigns)

## Step 5: Install and Build

In cPanel's Terminal (or SSH), navigate to your app folder and run:
```
npm install
npm run build
```

## Step 6: Set Up the Database

Run this command to create the database tables:
```
npm run db:push
```

## Step 7: Start the App

Click "Run App" in the Node.js setup page, or restart the application.

Your site should now be live with the full admin panel!

## Troubleshooting

- If you see "Cannot find module" errors, make sure you ran npm install
- If the database won't connect, double-check your DATABASE_URL
- If the app won't start, check that the startup file is set to dist/index.cjs
- Make sure you ran npm run build before starting
