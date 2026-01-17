# RealityCheck

A Security and Education-Focused Social Media Threat Detector built with Electron, React, and TypeScript.

## Features

- **Real-time Screen Monitoring**: Captures screenshots every 3 seconds to detect threats
- **AI Content Detection**: Uses Google Gemini Vision API to identify AI-generated content, deepfakes, and synthetic media
- **Threat Analysis**: Analyzes detected content for scams, phishing attempts, and malicious patterns
- **URL Safety Checking**: Validates URLs against Google Safe Browsing API
- **Risk Scoring**: Calculates risk levels (HIGH/MEDIUM/LOW) based on multiple factors
- **Transparent Overlay**: Displays threat badges directly on screen where threats are detected
- **Threat Log**: Maintains a history of all detected threats with screenshots

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Google Gemini API key
- Google Safe Browsing API key (optional but recommended)

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd NWHacks2026
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_SAFE_BROWSING_API_KEY=your_safe_browsing_api_key_here
```

4. Build the Electron main process:
```bash
npm run build:electron
```

## Development

To run in development mode:

```bash
npm run electron:dev
```

This will:
- Start the Vite dev server for the React app
- Compile the Electron main process TypeScript files
- Launch the Electron application

## Building

To build for production:

```bash
npm run build
```

This will:
- Build the React app with Vite
- Compile the Electron main process TypeScript files

Then run:
```bash
npm start
```

## Usage

1. **Start the Application**: Run `npm run electron:dev` or `npm start`
2. **Start Monitoring**: Click the "Start Monitoring" button in the Control Panel
3. **View Threats**: Detected threats will appear in the Threat Log and as badges on the overlay
4. **Review Content**: Click on any threat in the log to view details and screenshots
5. **Stop Monitoring**: Click "Stop Monitoring" when done

## Architecture

- **Main Process** (`main.ts`): Handles window management, screen capture, API calls, and IPC communication
- **Control Panel** (`src/renderer/ControlPanel.tsx`): React UI for monitoring controls and threat log
- **Overlay Window** (`src/renderer/Overlay.tsx`): Transparent overlay that displays threat badges
- **API Services** (`src/services/`): Modular services for Gemini Vision, Gemini Text, and Safe Browsing APIs
- **Utilities** (`src/utils/`): Screen capture and URL extraction utilities

## Tech Stack

- **Electron**: Desktop application framework
- **React**: UI library
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **Vite**: Build tool and dev server
- **Google Gemini API**: AI content detection and threat analysis
- **Google Safe Browsing API**: URL safety validation

## Project Structure

```
NWHacks2026/
├── main.ts                 # Electron main process
├── preload.ts              # Preload script for secure IPC
├── src/
│   ├── main.tsx           # React entry point
│   ├── renderer/
│   │   ├── ControlPanel.tsx
│   │   ├── Overlay.tsx
│   │   ├── components/
│   │   │   ├── ThreatLog.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── ThreatBadge.tsx
│   │   └── styles/
│   │       └── index.css
│   ├── services/
│   │   ├── geminiVision.ts
│   │   ├── geminiText.ts
│   │   ├── safeBrowsing.ts
│   │   └── riskCalculator.ts
│   └── utils/
│       ├── screenCapture.ts
│       └── urlExtractor.ts
├── dist-electron/          # Compiled Electron files
└── dist/                   # Built React app
```

## License

ISC

