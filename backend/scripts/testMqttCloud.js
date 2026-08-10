require("dotenv").config();
const mqtt = require("mqtt");

const topic = "parking/group17/test";
const payload = `mqtt-cloud-ok-${Date.now()}`;
const client = mqtt.connect(process.env.MQTT_BROKER, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  connectTimeout: 5000,
});

const timeout = setTimeout(() => {
  console.error("MQTT Cloud test timed out");
  client.end(true);
  process.exitCode = 1;
}, 7000);

client.on("connect", () => {
  client.subscribe(topic, { qos: 1 }, (error) => {
    if (error) throw error;
    client.publish(topic, payload, { qos: 1 });
  });
});

client.on("message", (receivedTopic, message) => {
  if (receivedTopic === topic && message.toString() === payload) {
    clearTimeout(timeout);
    console.log(`MQTT Cloud test passed: ${receivedTopic}`);
    client.end();
  }
});

client.on("error", (error) => {
  clearTimeout(timeout);
  console.error(`MQTT Cloud test failed: ${error.message}`);
  client.end(true);
  process.exitCode = 1;
});
