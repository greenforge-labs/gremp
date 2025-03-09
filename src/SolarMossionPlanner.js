import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import mqtt from "mqtt";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const MQTT_BROKER_URL = "ws://your-mqtt-broker:9001";
const VEHICLE_TOPIC = "vehicle/status";
const MISSION_TOPIC = "vehicle/mission";
const MISSION_STATUS_TOPIC = "vehicle/mission_status";
const MISSION_HISTORY_TOPIC = "vehicle/mission_history";
const MISSION_CONTROL_TOPIC = "vehicle/mission_control";
const MISSION_PROGRESS_TOPIC = "vehicle/mission_progress";

const SolarMissionPlanner = () => {
  const [waypoints, setWaypoints] = useState([]);
  const [vehiclePosition, setVehiclePosition] = useState(null);
  const [missionStatus, setMissionStatus] = useState("No active mission");
  const [missionHistory, setMissionHistory] = useState([]);
  const [missionProgress, setMissionProgress] = useState("0%");
  const [missionDuration, setMissionDuration] = useState("0s");
  const [progressData, setProgressData] = useState({ labels: [], datasets: [{ label: "Mission Progress", data: [] }] });
  const [mqttClient, setMqttClient] = useState(null);

  useEffect(() => {
    const client = mqtt.connect(MQTT_BROKER_URL);
    setMqttClient(client);

    client.on("connect", () => {
      client.subscribe(VEHICLE_TOPIC);
      client.subscribe(MISSION_STATUS_TOPIC);
      client.subscribe(MISSION_HISTORY_TOPIC);
      client.subscribe(MISSION_PROGRESS_TOPIC);
    });

    client.on("message", (topic, message) => {
      if (topic === VEHICLE_TOPIC) {
        const data = JSON.parse(message.toString());
        setVehiclePosition([data.lat, data.lon]);
      } else if (topic === MISSION_STATUS_TOPIC) {
        setMissionStatus(message.toString());
      } else if (topic === MISSION_HISTORY_TOPIC) {
        setMissionHistory(prevHistory => [message.toString(), ...prevHistory]);
      } else if (topic === MISSION_PROGRESS_TOPIC) {
        const progressData = JSON.parse(message.toString());
        setMissionProgress(progressData.progress);
        setMissionDuration(progressData.duration);
        setProgressData(prevData => ({
          labels: [...prevData.labels, progressData.duration],
          datasets: [{
            label: "Mission Progress",
            data: [...prevData.datasets[0].data, parseFloat(progressData.progress.replace('%', ''))],
            borderColor: "#4CAF50",
            backgroundColor: "rgba(76, 175, 80, 0.2)"
          }]
        }));
      }
    });

    return () => client.end();
  }, []);

  const handleMapClick = (e) => {
    const { lat, lng } = e.latlng;
    setWaypoints([...waypoints, { lat, lng }]);
  };

  const exportToCSV = () => {
    const csvContent = ["latitude,longitude"].concat(
      waypoints.map((wp) => `${wp.lat},${wp.lng}`)
    ).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mission_waypoints.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="w-full h-screen">
      <MapContainer center={[-27.0, 153.0]} zoom={16} className="w-full h-5/6" onClick={handleMapClick}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {waypoints.map((wp, index) => (
          <Marker key={index} position={[wp.lat, wp.lng]}>
            <Popup>Waypoint {index + 1}</Popup>
          </Marker>
        ))}
        <Polyline positions={waypoints.map((wp) => [wp.lat, wp.lng])} color="blue" />
        {vehiclePosition && (
          <Marker position={vehiclePosition}>
            <Popup>Vehicle Location</Popup>
          </Marker>
        )}
      </MapContainer>
      <div className="p-4 bg-gray-100 text-center text-lg font-semibold">
        Mission Status: {missionStatus}
      </div>
      <div className="p-4 bg-gray-100 text-center text-lg">
        Progress: {missionProgress} | Duration: {missionDuration}
      </div>
      <div className="p-4 bg-white">
        <Line data={progressData} />
      </div>
      <div className="p-4 bg-gray-200 text-sm overflow-auto h-32">
        <h3 className="font-semibold">Mission History</h3>
        <ul>
          {missionHistory.map((entry, index) => (
            <li key={index}>{entry}</li>
          ))}
        </ul>
      </div>
      <button className="p-2 m-4 bg-blue-500 text-white rounded" onClick={exportToCSV}>
        Export Mission Plan (CSV)
      </button>
      <button className="p-2 m-4 bg-green-500 text-white rounded" onClick={() => mqttClient.publish(MISSION_TOPIC, JSON.stringify({ waypoints }))}>
        Send Mission to Vehicle
      </button>
    </div>
  );
};

export default SolarMissionPlanner;
