import { useEffect, useState } from "react";
import { socket } from "../services/socket";

export function useParkingRealtime() {
  const [isBackendConnected, setIsBackendConnected] = useState(socket.connected);
  const [entryLane, setEntryLane] = useState({
    uid: "",
    status: "IDLE",
    fee: "₱ 0.00",
    lastScan: "—",
  });
  const [exitLane, setExitLane] = useState({
    uid: "",
    status: "IDLE",
    fee: "₱ 0.00",
    lastScan: "—",
  });
  const [mqttMessages, setMqttMessages] = useState([]);

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
            fee: data.gates.in.fee ? `₱ ${data.gates.in.fee.toFixed(2)}` : "₱ 0.00",
            lastScan: data.gates.in.receivedAt
              ? new Date(data.gates.in.receivedAt).toLocaleTimeString()
              : "—",
          }));
        }
        if (data.gates.out) {
          setExitLane(prev => ({
            ...prev,
            uid: data.gates.out.uid || "",
            status: (data.gates.out.status || "IDLE").toUpperCase(),
            fee: data.gates.out.fee ? `₱ ${data.gates.out.fee.toFixed(2)}` : "₱ 0.00",
            lastScan: data.gates.out.receivedAt
              ? new Date(data.gates.out.receivedAt).toLocaleTimeString()
              : "—",
          }));
        }
      }
    }

    function onRfidScan(payload) {
      console.log("rfid-scan event:", payload);
      const { data, receivedAt } = payload;
      const formattedTime = new Date(receivedAt).toLocaleTimeString();
      const mappedStatus = (data.status || "IDLE").toUpperCase();
      const formattedFee = data.fee !== undefined ? `₱ ${Number(data.fee).toFixed(2)}` : "₱ 0.00";

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
      const formattedTime = new Date(receivedAt).toLocaleTimeString();

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

    // Bind listeners
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("initial-data", onInitialData);
    socket.on("rfid-scan", onRfidScan);
    socket.on("gate-status", onGateStatus);
    socket.on("mqtt-message", onMqttMessage);

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
    };
  }, []);

  return {
    isBackendConnected,
    entryLane,
    exitLane,
    mqttMessages,
    setEntryLane,
    setExitLane,
  };
}
