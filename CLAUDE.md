# Claude Code Telemetry - Setup Guide for Non-Technical Users 🤖

Hi! I'm Claude. This folder contains a tool that tracks how much money your team spends on AI. I'll help you set it up step by step.

## 🎯 What You'll Get

A dashboard that shows:
- **Daily AI costs** - "We spent $47.32 on AI assistance today"
- **Who uses AI most** - "Sarah used AI 23 times today for report writing"
- **What tasks cost most** - "Code reviews cost $5-10, emails cost $0.50"
- **Usage trends** - "AI usage is up 40% this week"

## ⚠️ Before We Start - You Need Docker

**Docker is required!** Think of Docker as a special program that runs other programs in isolated boxes. Here's how to get it:

### How to Check if You Have Docker:
1. Look for a **whale icon** 🐳 in your menu bar (top of screen on Mac, bottom right on Windows)
2. If you see the whale, you're ready!
3. If not, you need to install Docker first

### How to Install Docker:
1. Go to: https://www.docker.com/products/docker-desktop
2. Click the big blue **"Download Docker Desktop"** button
3. Choose your system:
   - **Mac**: Download for Mac (Intel chip or Apple Silicon)
   - **Windows**: Download for Windows
4. Install it like any other program (double-click the downloaded file)
5. Open Docker Desktop after installation
6. Wait for the whale icon to appear in your menu bar
7. The whale should be steady (not animated) when Docker is ready

### Docker Not Starting?
- **Mac**: Check Applications folder and double-click Docker
- **Windows**: Check Start Menu and click Docker Desktop
- **Still stuck?** Restart your computer and try again

## 🚀 Getting Started - Just Ask Me!

**Once Docker is running** (whale icon visible), type this exactly:
```
Set up the telemetry dashboard
```

## 📝 What I'll Do - Complete Setup Process

When you ask me to set up, I'll run the quickstart script that does everything automatically:

```bash
./quickstart.sh
```

This single command will:
- Check if Docker is installed
- Download everything needed
- Start all services
- Create your login credentials
- Configure Claude to send telemetry

Here's EXACTLY what you'll see:

### Step 1: I'll Check Docker
```
Me: "First, I need to check if Docker is installed and running..."
[I run: docker --version]

IF DOCKER IS MISSING:
Me: "❌ Docker isn't installed yet. Please follow the Docker installation 
     instructions at the top of this guide (see 'Before We Start' section).
     
     Quick reminder:
     1. Go to https://docker.com/products/docker-desktop
     2. Download and install Docker Desktop
     3. Look for the whale icon 🐳 in your menu bar
     4. Once you see the whale, tell me 'Docker is ready' and we'll continue!"

IF DOCKER IS INSTALLED BUT NOT RUNNING:
Me: "❌ Docker is installed but not running. Please:
     1. Find and open Docker Desktop
     2. Wait for the whale icon 🐳 to appear in your menu bar
     3. Make sure the whale is steady (not animating)
     4. Tell me 'Docker is running' when ready!"

IF DOCKER IS READY:
Me: "✅ Great! Docker is installed and running. Let's continue..."
```

### Step 2: I'll Download Everything
```
Me: "Now I'll download all the files we need. This takes about 2 minutes..."
[Progress messages appear]
Me: "✅ Downloaded 1 of 5 components..."
Me: "✅ Downloaded 2 of 5 components..."
[etc.]
```

### Step 3: I'll Start the Dashboard
```
Me: "Starting your dashboard services..."
Me: "✅ Database started"
Me: "✅ Analytics engine started"
Me: "✅ Web dashboard started"
Me: "✅ Telemetry collector started"
Me: "Everything is running!"
```

### Step 4: I'll Set Up Your Login
```
Me: "Creating your login credentials..."
Me: "
YOUR DASHBOARD ACCESS:
📍 Website: http://localhost:3000
📧 Email: admin@example.com
🔑 Password: [unique password generated for you]

I've also saved these in a file called 'langfuse-credentials.txt'
"
```

### Step 5: I'll Configure Claude
```
Me: "Now I'll set up Claude to send telemetry data..."
Me: "Running: source claude-telemetry.env"
Me: "✅ Claude is now configured to track usage!"
```

### Step 6: I'll Help You Test It
```
Me: "Let's make sure you can access your dashboard:
     1. Click this link: http://localhost:3000
     2. You should see a login page
     3. Copy and paste the email and password I gave you
     4. Click 'Sign In'
     
     Do you see the dashboard? (yes/no)"
```

## 🚨 When Things Go Wrong - I'll Fix Them!

### "I see an error message"
Tell me: "I got an error" and copy/paste what you see. I'll:
1. Read the error
2. Explain what it means in plain English
3. Fix it for you
4. Try again

### "Nothing happens when I click the link"
Tell me: "The website won't open". I'll:
1. Check if services are running
2. Restart them if needed
3. Give you a new link to try
4. Test it with you

### "I can't find the whale icon"
Tell me: "I don't see Docker". I'll:
1. Help you check if it's installed
2. Guide you through installation with pictures
3. Show you exactly where to look
4. Wait while you install it

### "The password doesn't work"
Tell me: "I can't log in". I'll:
1. Show you the password again
2. Make sure you're copying it exactly
3. Create a new password if needed
4. Walk you through typing it

## 📊 Using Your Dashboard - What You'll See

Once logged in, you'll see:

### Main Dashboard Page
```
Today's AI Costs: $47.32
Total This Week: $156.89
Most Active User: sarah@company.com (45 requests)
Most Expensive Task: "Analyze sales data" ($12.47)
```

### Traces Page (Individual Conversations)
```
10:32 AM - john@company.com - "Write email to client" - $0.73
10:45 AM - sarah@company.com - "Debug Python code" - $3.21
11:02 AM - mike@company.com - "Summarize meeting notes" - $1.15
```

### Sessions Page (Work Blocks)
```
Morning Session (9 AM - 10 AM) - Total: $15.43
- 5 code reviews
- 3 emails written
- 2 reports analyzed
```

## 🛑 Stopping Everything

When you're done, tell me:
```
Stop the dashboard
```

I'll:
1. Save any pending data
2. Shut down all services
3. Confirm everything stopped
4. Tell you how to start again later

## 🔄 Starting Again Later

Next time, just tell me:
```
Start my dashboard
```

I'll:
1. Check everything is ready
2. Start all services
3. Give you the login link
4. Make sure you can access it

## ❓ Questions I Can Answer

- "How much did we spend on AI yesterday?"
- "Show me who uses AI the most"
- "What tasks are most expensive?"
- "How do I download a cost report?"
- "Can I add other team members?"
- "How do I see what questions were asked?"

## 🎉 Success Checklist

You'll know everything worked when:
- ✅ You see the whale icon in your menu bar
- ✅ You can open http://localhost:3000
- ✅ You can log in with the email/password
- ✅ You see cost data appearing
- ✅ The numbers update when you use Claude

## 💡 Important Notes

- **Docker is required** - This won't work without Docker Desktop installed
- **Your data stays on your computer** - Nothing goes to the cloud
- **The dashboard runs locally** - Only you can see it
- **Costs appear after you use Claude** - Not from past usage
- **Keep Docker running** - The whale icon must stay in your menu bar

## 🐳 Quick Docker Check

Before starting, make sure:
1. Docker Desktop is installed (see instructions at top)
2. The whale icon 🐳 is visible in your menu bar
3. The whale is steady (not animating)

If any of these aren't true, go back to the "Before We Start" section.

---

**Ready? Once Docker is running, just type: `Set up the telemetry dashboard`**

I'll handle everything else and guide you through each step!