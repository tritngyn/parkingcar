import { useEffect, useState } from "react";
import { socket } from "../services/socket";

const formatVietnamTime = (value) => new Date(value).toLocaleTimeString("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour12: false,
});

export function useParkingRealtime() {
  const [isBackendConnected, setIsBackendConnected] = useState(socket.connected);
  const [entryLane, setEntryLane] = useState({
    uid: "",
    status: "IDLE",
    fee: "0 VNĐ",
    lastScan: "—",
  });
  const [exitLane, setExitLane] = useState({
    uid: "",
    status: "IDLE",
    fee: "0 VNĐ",
    lastScan: "—",
  });
  const [mqttMessages, setMqttMessages] = useState([]);
  const [device, setDevice] = useState({
    deviceId: null,
    status: "offline",
    receivedAt: null,
  });

  useEffect(() => {
    function onConnect() {
      setIsBackendConnected(true);
    }

    function onDisconnect() {
      setIsBackendConnected(false);
    }

    function onInitialData(data) {
      console.log("Received initial data:", data);
      if (data.gates) {
        if (data.gates.in) {
          setEntryLane(prev => ({
            ...prev,
            uid: data.gates.in.uid || "",
            status: (data.gates.in.status || "IDLE").toUpperCase(),
            fee: data.gates.in.fee ? `${Number(data.gates.in.fee).toLocaleString("vi-VN")} VNĐ` : "0 VNĐ",
            lastScan: data.gates.in.receivedAt
              ? formatVietnamTime(data.gates.in.receivedAt)
              : "—",
          }));
        }
        if (data.gates.out) {
          setExitLane(prev => ({
            ...prev,
            uid: data.gates.out.uid || "",
            status: (data.gates.out.status || "IDLE").toUpperCase(),
            fee: data.gates.out.fee ? `${Number(data.gates.out.fee).toLocaleString("vi-VN")} VNĐ` : "0 VNĐ",
            lastScan: data.gates.out.receivedAt
              ? formatVietnamTime(data.gates.out.receivedAt)
              : "—",
          }));
        }
      }
      if (data.device) setDevice(data.device);
    }

    function onRfidScan(payload) {
      console.log("rfid-scan event:", payload);
      const { data, receivedAt } = payload;
      const formattedTime = formatVietnamTime(receivedAt);
      const mappedStatus = (data.status || "IDLE").toUpperCase();
      const formattedFee = data.fee !== undefined ? `${Number(data.fee).toLocaleString("vi-VN")} VNĐ` : "0 VNĐ";

      if (data.lane === "in") {
        setEntryLane({
          uid: data.uid,
          status: mappedStatus,
          fee: formattedFee,
          lastScan: formattedTime,
        });
      } else if (data.lane === "out") {
        setExitLane({
          uid: data.uid,
          status: mappedStatus,
          fee: formattedFee,
          lastScan: formattedTime,
        });
      }
    }

    function onGateStatus(payload) {
      console.log("gate-status event:", payload);
      const { data, receivedAt } = payload;
      const mappedStatus = (data.status || "IDLE").toUpperCase();
      const formattedTime = formatVietnamTime(receivedAt);

      if (data.lane === "in") {
        setEntryLane(prev => ({
          ...prev,
          status: mappedStatus,
          lastScan: formattedTime,
        }));
      } else if (data.lane === "out") {
        setExitLane(prev => ({
          ...prev,
          status: mappedStatus,
          lastScan: formattedTime,
        }));
      }
    }

    function onMqttMessage(payload) {
      setMqttMessages(prev => [payload, ...prev].slice(0, 50));
    }

    function onDeviceStatus(payload) {
      setDevice(payload);
    }

    // Bind listeners
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("initial-data", onInitialData);
    socket.on("rfid-scan", onRfidScan);
    socket.on("gate-status", onGateStatus);
    socket.on("mqtt-message", onMqttMessage);
    socket.on("device-status", onDeviceStatus);

    // If socket is already connected when component mounts
    if (socket.connected) {
      onConnect();
    } else {
      socket.connect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("initial-data", onInitialData);
      socket.off("rfid-scan", onRfidScan);
      socket.off("gate-status", onGateStatus);
      socket.off("mqtt-message", onMqttMessage);
      socket.off("device-status", onDeviceStatus);
    };
  }, []);

  return {
    isBackendConnected,
    entryLane,
    exitLane,
    mqttMessages,
    device,
    setEntryLane,
    setExitLane,
  };
}
