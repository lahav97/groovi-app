# 🎵 GrooviApp

<div align="center">
  <img src="https://img.shields.io/badge/React%20Native-0.76.9-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React Native" />
  <img src="https://img.shields.io/badge/Expo-52.0.6-000020?style=for-the-badge&logo=expo&logoColor=white" alt="Expo" />
  <img src="https://img.shields.io/badge/AWS%20Amplify-FF9900?style=for-the-badge&logo=aws-amplify&logoColor=white" alt="AWS Amplify" />
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
</div>

<br />

<div align="center">
  <h3>🎸 The Ultimate Music Collaboration Platform</h3>
  <p>Connect with musicians, share your talent, and create amazing music together</p>
</div>

---

## 📱 About GrooviApp

GrooviApp is a social music platform that connects musicians worldwide. Share your musical videos, discover talented artists, filter by instruments and genres, and build your musical network. Whether you're a beginner or a professional musician, GrooviApp helps you find your groove!

### ✨ Key Features

- 🎬 **Video Feed**: Swipe through musical performances
- 🎯 **Smart Filtering**: Find musicians by instrument, skill level, genre, and location
- 👤 **Rich Profiles**: Showcase your instruments, skills, and musical journey
- 🔍 **Discovery**: Explore new talent and connect with like-minded musicians
- 🌍 **Location-Based**: Find musicians in your area or search globally
- 📱 **Cross-Platform**: Available on iOS and Android

---

## 🚀 Quick Start

### Prerequisites

Make sure you have these tools installed on your computer:

| Tool | Version | Purpose |
|------|---------|---------|
| [Node.js](https://nodejs.org/) | 18+ | JavaScript runtime |
| [npm](https://www.npmjs.com/) | Latest | Package manager |
| [Git](https://git-scm.com/) | Latest | Version control |
| [Expo Go](https://expo.dev/client) | Latest | Mobile app for testing |

> 💡 **New to development?** Don't worry! Click the links above to download and install each tool. Follow their installation guides step by step.

### 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <your-repository-url>
   cd groovi-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```
   > ⏳ This might take a few minutes. Perfect time for a coffee break! ☕

3. **Set up environment variables**
   ```bash
   # Create a .env file in the root directory
   cp .env.example .env
   
   # Add your configuration (ask your team lead for the values)
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_ANDROID_ID=your_android_client_id
   FACEBOOK_APP_ID=your_facebook_app_id
   ```

---

## 🏃‍♂️ Running the App

### Method 1: Expo Go (Recommended for beginners)

This is the **easiest way** to test the app on your phone:

1. **Download Expo Go** on your phone:
   - [📱 iOS App Store](https://apps.apple.com/us/app/expo-go/id1397950961)
   - [🤖 Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. **Start the development server**
   ```bash
   npm start
   ```

3. **Connect your phone**
   - A QR code will appear in your terminal
   - Open Expo Go and scan the QR code
   - The app will load on your phone! 🎉

   > 📱 **Make sure your phone and computer are on the same Wi-Fi network**

### Method 2: Android Development

For a more native experience or if you prefer emulators:

<details>
<summary>🤖 <strong>Click to expand Android setup instructions</strong></summary>

#### Setup Android Studio

1. **Download Android Studio** from [developer.android.com](https://developer.android.com/studio)

2. **Create a Virtual Device**:
   - Open Android Studio
   - Go to `Tools` → `Device Manager`
   - Click `Create Device`
   - Choose a phone (e.g., "Pixel 7")
   - Select a system image (latest stable Android version)
   - Click `Finish`

3. **Start the emulator**:
   - In Device Manager, click ▶️ next to your device

4. **Run the app**:
   ```bash
   npm run android
   ```

</details>

### Method 3: iOS Development (Mac only)

<details>
<summary>🍎 <strong>Click to expand iOS setup instructions</strong></summary>

#### Setup Xcode

1. **Install Xcode** from the Mac App Store
2. **Install iOS Simulator** (included with Xcode)
3. **Run the app**:
   ```bash
   npm run ios
   ```

</details>

---

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run tests in watch mode (automatically re-runs when files change)
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Test Coverage

Our app includes tests for:
- 🔐 Authentication flows (SignUp, Login)
- 🎵 Instrument selection
- 📱 Screen navigation
- 🎯 Component functionality

---

## 📁 Project Structure

```
groovi-app/
├── 📱 src/
│   ├── 🔐 screens/           # App screens
│   │   ├── authentication/   # Login, SignUp, etc.
│   │   ├── main/            # Feed, Profile, etc.
│   │   └── onboarding/      # Setup screens
│   ├── 🧩 components/       # Reusable UI components
│   ├── 🧭 navigation/       # App navigation setup
│   ├── 🎨 styles/           # Themes and styling
│   ├── 🔧 utils/            # Helper functions
│   ├── 📦 context/          # React context providers
│   └── 🧪 tests/            # Test files
├── 📋 package.json
└── 📖 README.md
```

---

## 🛠️ Technology Stack

### Frontend
- **React Native 0.76.9** - Cross-platform mobile development
- **Expo 52.0.6** - Development platform and tools
- **React Navigation 7** - Screen navigation
- **React Native Reanimated** - Smooth animations

### Backend & Services
- **AWS Amplify** - Authentication and API
- **AWS Cognito** - User management
- **AWS S3** - Video and image storage

### Development Tools
- **Jest** - Testing framework
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **TypeScript** - Type safety (partial)

---

## 🔧 Development Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start Expo development server |
| `npm run android` | Run on Android device/emulator |
| `npm run ios` | Run on iOS device/simulator |
| `npm test` | Run test suite |
| `npm run lint` | Check code style |
| `npm run format` | Format code with Prettier |

---

## 🌍 Environment Setup

### Required Environment Variables

Create a `.env` file in your project root:

```env
# Social Authentication
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_ANDROID_ID=your_android_oauth_client_id
FACEBOOK_APP_ID=your_facebook_app_id

# AWS Configuration (already configured in awsConfig.js)
# These are typically set up through Amplify CLI
```

### AWS Amplify Setup

The app uses AWS Amplify for backend services. The configuration is already set up in `src/utils/awsConfig.js`. If you need to modify backend services:

1. Install Amplify CLI: `npm install -g @aws-amplify/cli`
2. Configure: `amplify configure`
3. Initialize: `amplify init`

---

## 🔍 Troubleshooting

### Common Issues

<details>
<summary><strong>❌ "Metro bundler error" or "Unable to resolve module"</strong></summary>

**Solution:**
```bash
# Clear Metro cache
npx react-native start --reset-cache

# Or clear npm cache
npm start -- --clear
```
</details>

<details>
<summary><strong>❌ "Android build failed"</strong></summary>

**Solutions:**
1. Make sure Android Studio is properly installed
2. Check that you have the correct Android SDK
3. Try cleaning the build:
   ```bash
   cd android
   ./gradlew clean
   cd ..
   npm run android
   ```
</details>

<details>
<summary><strong>❌ "Expo Go won't connect"</strong></summary>

**Solutions:**
1. Ensure phone and computer are on the same Wi-Fi
2. Try using the tunnel connection: `npm start --tunnel`
3. Restart the Expo development server
</details>

<details>
<summary><strong>❌ "Dependencies installation fails"</strong></summary>

**Solutions:**
```bash
# Clear npm cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```
</details>

### Getting Help

- 📖 Check the [Expo Documentation](https://docs.expo.dev/)
- 🐛 Create an issue in this repository
- 💬 Ask your team lead or senior developer
- 🔍 Search [Stack Overflow](https://stackoverflow.com/questions/tagged/react-native)

---

## 🤝 Contributing

We love contributions! Here's how to get started:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Write tests** for your changes
4. **Commit your changes**: `git commit -m 'Add amazing feature'`
5. **Push to the branch**: `git push origin feature/amazing-feature`
6. **Open a Pull Request**

### Code Style

We use ESLint and Prettier to maintain consistent code style:

```bash
# Check for style issues
npm run lint

# Automatically fix style issues
npm run format
```

---

## 📄 License

This project is proprietary and confidential. All rights reserved.

---

## 👥 Team

Built with ❤️ by the GrooviApp development team.

---

<div align="center">
  <p>Happy coding! 🎵✨</p>
  <p><strong>Questions?</strong> Don't hesitate to ask your team lead or create an issue!</p>
</div>