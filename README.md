# Station Manager (single-page static app)

Open `login.html` in your browser to access the app.

## Architecture: WebSocket over MQTT

The application uses a WebSocket server running on Node.js to mediate communication between the web app and ESP32 devices:

- **Web App** ↔ **Node.js WebSocket Server** ↔ **ESP32 WebSocket Client**
- The Node.js server maintains WebSocket connections with ESP32 devices
- Station toggle commands are sent via WebSocket to connected ESP32 devices
- ESP32 devices control GPIO pins based on received commands
- No direct MQTT broker communication - all control goes through the WebSocket server

## Features:
- **Secure Login System**: Dedicated login page with username/password authentication
- **Enhanced UI**: Modern, responsive design with improved station cards and navigation
- **Real-time Stats**: Live dashboard showing total, online, and offline station counts
- **Add Station**: Create new charging stations with custom commands
- **Station Management**: Toggle stations on/off, remove stations
- **Activity Logs**: Collapsible log section with timestamped activity tracking
- **WebSocket Integration**: Direct communication with ESP32 devices via WebSocket server

## File Structure:
- **`login.html`** - Login page with authentication form
- **`login.css`** - Styling for the login page
- **`src/login.js`** - Login page functionality and authentication
- **`index.html`** - Main station manager application
- **`styles.css`** - Main application styling
- **`src/main.js`** - Application entry point and authentication check
- **`src/ui.js`** - User interface rendering and event handling
- **`src/stations.js`** - Station management logic
- **`src/storage.js`** - Data persistence (localStorage)
- **`src/mqtt.js`** - HiveMQ MQTT client integration

## Login Credentials:
- **Username**: `admin`
- **Password**: `admin123`

## To run:
1. Install dependencies: `npm install`
2. Start the server: `npm start` or `node server.js`
3. Open `http://localhost:3000/login` in your browser
4. Login with credentials: `admin` / `admin123`
5. Configure your ESP32 with the server IP and upload the WebSocket sketch

## Navigation Flow:
1. **`login.html`** - User authentication page
2. **`index.html`** - Main station management application (auto-redirects to login if not authenticated)

## Troubleshooting:
- **Login page not showing?** Clear your browser's localStorage: Open Dev Tools (F12) → Console → Run `localStorage.clear()`
- **Already logged in?** The login page will show options to continue to the app or logout
- **Logout not working?** Check browser console for errors and ensure you're on the main application page

## Station Configuration:
- **Station ID**: Unique identifier for the station
- **Charger ID**: Identifier for the charger within the station  
- **MQTT Topic**: Custom topic template (use {stationId} and {chargerId} placeholders)
- **QoS Level**: Quality of Service (0, 1, or 2)
- **Message (ON/OFF)**: Custom messages to send when turning charger on/off

## HiveMQ MQTT Integration:
- The app can publish commands to HiveMQ MQTT broker using MQTT over WebSocket.
- Open `MQTT Settings` and configure with your HiveMQ cluster details:
  - **Broker**: `d0670c8d60cf403dbe0b45f606dd69c3.s1.eu.hivemq.cloud`
  - **Port**: `8884` (WebSocket secure)
  - **Secure**: ✅ Checked
  - **Username**: `hivemq.webclient.1766640179751`
  - **Password**: `xE52UL.1g:8TrpeC#t<D`
- Additional settings: Client ID prefix, Keep Alive interval, QoS level, Retain messages.
- Provide a topic template (default: `stations/{stationId}/charger/{chargerId}/command`). When toggling a station the app will publish the command to that topic.

## ESP32 Integration:
- Use the provided `esp32_websocket_control.ino` Arduino sketch to control ESP32 pins via WebSocket.
- Update the WiFi credentials and WebSocket server details in the sketch:
  - **WebSocket Host**: Your server IP address (e.g., `192.168.1.100`)
  - **WebSocket Port**: `3000` (same as the Node.js server)
  - **WiFi SSID/Password**: Your local network credentials
- The ESP32 connects to the WebSocket server and listens for station control commands.
- Controls GPIO pins 2, 4, 5, 12, 13, 14, 15, 16 for 8 stations based on received commands.
- Requires WebSockets library (install via Arduino IDE Library Manager).
- Station configurations are hardcoded in the sketch - update as needed for your setup.

## Security note:
Storing MQTT credentials in the browser is insecure for production. Prefer a backend or secure authentication method. The login system is basic for demonstration purposes.
