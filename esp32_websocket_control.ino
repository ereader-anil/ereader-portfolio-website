#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// WebSocket server details
const char* wsHost = "YOUR_SERVER_IP"; // Replace with your server IP
const int wsPort = 3000;
const char* wsPath = "/";

// WebSocket client
WebSocketsClient webSocket;

// GPIO pins for stations (adjust as needed)
const int STATION_PINS[] = {2, 4, 5, 12, 13, 14, 15, 16};
const int NUM_STATIONS = 8;

// Station configurations
struct StationConfig {
  String stationId;
  String chargerId;
  String mqttTopic;
  String msgOn;
  String msgOff;
  int gpioPin;
};

StationConfig stations[] = {
  {"station1", "charger1", "station/1/control", "ON", "OFF", STATION_PINS[0]},
  {"station2", "charger2", "station/2/control", "ON", "OFF", STATION_PINS[1]},
  {"station3", "charger3", "station/3/control", "ON", "OFF", STATION_PINS[2]},
  {"station4", "charger4", "station/4/control", "ON", "OFF", STATION_PINS[3]},
  {"station5", "charger5", "station/5/control", "ON", "OFF", STATION_PINS[4]},
  {"station6", "charger6", "station/6/control", "ON", "OFF", STATION_PINS[5]},
  {"station7", "charger7", "station/7/control", "ON", "OFF", STATION_PINS[6]},
  {"station8", "charger8", "station/8/control", "ON", "OFF", STATION_PINS[7]}
};

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("🔌 WebSocket disconnected");
      break;
    case WStype_CONNECTED:
      Serial.println("🔌 WebSocket connected");
      break;
    case WStype_TEXT: {
      Serial.printf("📨 Received: %s\n", payload);

      // Parse JSON message
      DynamicJsonDocument doc(1024);
      DeserializationError error = deserializeJson(doc, payload);

      if (error) {
        Serial.println("❌ Failed to parse JSON");
        return;
      }

      String stationId = doc["stationId"];
      String command = doc["command"];

      // Find the station
      for (int i = 0; i < NUM_STATIONS; i++) {
        if (stations[i].stationId == stationId) {
          int pin = stations[i].gpioPin;

          if (command == stations[i].msgOn) {
            digitalWrite(pin, HIGH);
            Serial.printf("✅ Station %s turned ON (GPIO %d)\n", stationId.c_str(), pin);
          } else if (command == stations[i].msgOff) {
            digitalWrite(pin, LOW);
            Serial.printf("❌ Station %s turned OFF (GPIO %d)\n", stationId.c_str(), pin);
          }
          break;
        }
      }
      break;
    }
    case WStype_ERROR:
      Serial.println("❌ WebSocket error");
      break;
  }
}

void setup() {
  Serial.begin(115200);
  Serial.println("🚀 ESP32 WebSocket Station Controller");

  // Initialize GPIO pins
  for (int i = 0; i < NUM_STATIONS; i++) {
    pinMode(stations[i].gpioPin, OUTPUT);
    digitalWrite(stations[i].gpioPin, LOW); // Start with all off
  }

  // Connect to WiFi
  WiFi.begin(ssid, password);
  Serial.print("🔗 Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n✅ WiFi connected");
  Serial.printf("📡 IP Address: %s\n", WiFi.localIP().toString().c_str());

  // Connect to WebSocket server
  webSocket.begin(wsHost, wsPort, wsPath);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
}

void loop() {
  webSocket.loop();

  // Optional: Send heartbeat or status updates
  static unsigned long lastHeartbeat = 0;
  if (millis() - lastHeartbeat > 30000) { // Every 30 seconds
    webSocket.sendTXT("{\"type\":\"heartbeat\",\"device\":\"esp32\"}");
    lastHeartbeat = millis();
  }
}