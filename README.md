# Simple HUD Extension

A Chrome extension that displays a simple HUD (Heads-Up Display) overlay on web pages. The extension shows current URL, time, and status information.

## Features

- **HUD Overlay**: Displays information overlay on all web pages
- **Real-time Updates**: Shows current time and updates every second
- **URL Display**: Shows the current website's hostname
- **Extension Popup**: Simple popup interface showing extension status

## Project Structure

```
ts_extention/
├── src/                    # TypeScript source files
│   ├── content.ts         # Main HUD logic
│   ├── hud.css            # HUD styling
│   └── content.js         # Compiled JavaScript (auto-generated)
├── public/                 # Extension files
│   ├── manifest.json      # Extension manifest
│   ├── popup.html         # Extension popup
│   ├── content.js         # Content script (copied from src)
│   └── hud.css            # Styles (copied from src)
├── tsconfig.json          # TypeScript configuration
└── README.md              # This file
```

## Prerequisites

- **Node.js** (version 14 or higher)
- **npm** or **yarn** package manager
- **Chrome browser** for testing

## Setup Instructions

### 1. Install Dependencies

First, you need to install the required dependencies. Since this project doesn't have a `package.json` yet, you'll need to create one:

```bash
npm init -y
npm install --save-dev typescript
```

### 2. Build the Project

Compile TypeScript files to JavaScript:

```bash
npx tsc
```

This will compile `src/content.ts` to `src/content.js`.

### 3. Copy Files to Public Directory

After building, copy the compiled files to the public directory:

```bash
cp src/content.js public/
cp src/hud.css public/
```

### 4. Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `public/` folder from your project
5. The extension should now appear in your extensions list

### 5. Test the Extension

1. Navigate to any website
2. You should see a HUD overlay in the top-left corner
3. Click the extension icon in the toolbar to see the popup
4. The HUD should display current URL, time, and update every second

## Development Workflow

### Making Changes

1. Edit TypeScript files in the `src/` directory
2. Run `npx tsc` to compile
3. Copy compiled files to `public/` directory
4. Reload the extension in Chrome (`chrome://extensions/` → Reload button)

### File Descriptions

- **`content.ts`**: Main HUD logic and DOM manipulation
- **`hud.css`**: Styling for the HUD overlay
- **`manifest.json`**: Extension configuration and permissions
- **`popup.html`**: Extension popup interface

## Current Issues to Fix

### 1. Missing Package.json
The project needs a proper `package.json` file with dependencies and build scripts.

### 2. Build Process
Need to automate the copy process from `src/` to `public/` directory.

### 3. Missing Icons
The extension needs icon files (16px, 48px, 128px) for proper display.

### 4. Development Scripts
Add npm scripts for building, watching, and development workflow.

## Next Steps

1. **Create package.json** with proper dependencies
2. **Add build scripts** for development workflow
3. **Create placeholder icons** for the extension
4. **Set up file watching** for automatic rebuilds
5. **Add error handling** and improve HUD positioning
6. **Implement configuration options** for HUD customization

## Troubleshooting

### Extension Not Loading
- Check that all files are in the `public/` directory
- Ensure `manifest.json` is valid JSON
- Check Chrome console for errors

### HUD Not Displaying
- Verify content script is loaded in `chrome://extensions/`
- Check browser console for JavaScript errors
- Ensure the website allows content scripts

### Build Errors
- Verify TypeScript is installed: `npm install -g typescript`
- Check `tsconfig.json` configuration
- Ensure source files are in the correct location

## Browser Compatibility

- **Chrome**: Full support (manifest v3)
- **Edge**: Full support (Chromium-based)
- **Firefox**: Requires manifest v2 conversion
- **Safari**: Not supported (different extension system)

## Contributing

1. Make changes in the `src/` directory
2. Build with `npx tsc`
3. Copy files to `public/` directory
4. Test in Chrome
5. Update this README if needed

## License

This project is open source. Feel free to modify and distribute as needed. 