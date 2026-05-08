import { useEffect, useState } from "react";

export default function App() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => setMessage(data.message))
      .catch(() => setMessage("Backend not running"));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-900">JobNimbus</h1>
        <p className="text-lg text-gray-600">{message || "Loading..."}</p>
      </div>
    </div>
  );
}
