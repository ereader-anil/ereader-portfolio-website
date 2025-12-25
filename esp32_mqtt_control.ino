#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// Required Libraries (install via Arduino IDE Library Manager):
// - PubSubClient by Nick O'Leary
// - ArduinoJson by Benoit Blanchon

// WiFi credentials - Update these
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// HiveMQ MQTT Broker details - Update these to match your web app settings
const char* mqtt_server = "d0670c8d60cf403dbe0b45f606dd69c3.s1.eu.hivemq.cloud";  // HiveMQ Cloud cluster
const int mqtt_port = 8883;  // Secure port for HiveMQ Cloud (TLS required)
const char* mqtt_username = "hivemq.webclient.1766640179751";  // Your HiveMQ username
const char* mqtt_password = "xE52UL.1g:8TrpeC#t<D";  // Your HiveMQ password
const char* client_id_prefix = "esp32-station";  // Client ID prefix
const int keep_alive = 60;  // Keep alive in seconds

// Pins for controlling chargers
#define PIN_TEST_CHARGER 2   // For station "test", charger "test1"

WiFiClientSecure espClient;
PubSubClient client(espClient);

void setup() {
  Serial.begin(115200);

  // Initialize pins
  pinMode(PIN_TEST_CHARGER, OUTPUT);
  digitalWrite(PIN_TEST_CHARGER, LOW);  // Start OFF

  // Connect to WiFi
  setup_wifi();

  // Setup MQTT with secure client
  espClient.setInsecure();  // For testing - skips certificate verification
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
  client.setKeepAlive(keep_alive);
}

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");

  // Convert payload to string
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println(message);

  // Handle specific topic for test station
  if (strcmp(topic, "stations/test/charger/test1/command") == 0) {
    if (message == "ON" || message == "TURN_ON" || message == "START") {
      digitalWrite(PIN_TEST_CHARGER, HIGH);
      Serial.println("Test charger ON");
    } else if (message == "OFF" || message == "TURN_OFF" || message == "STOP") {
      digitalWrite(PIN_TEST_CHARGER, LOW);
      Serial.println("Test charger OFF");
    }
  }

  // You can add more logic here for different topics/messages
  // For example, check topic for specific charger control
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    String clientId = String(client_id_prefix) + "-" + String(random(0xffff), HEX);
    
    Serial.print("Client ID: ");
    Serial.println(clientId);
    Serial.print("Broker: ");
    Serial.print(mqtt_server);
    Serial.print(":");
    Serial.println(mqtt_port);

    if (client.connect(clientId.c_str(), mqtt_username, mqtt_password)) {
      Serial.println("connected");
      // Subscribe to test station topic
      client.subscribe("stations/test/charger/test1/command");
      Serial.println("Subscribed to stations/test/charger/test1/command");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
}