import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [backendStatus, setBackendStatus] = useState('Loading...');

  useEffect(() => {
    // Fetch data from our backend's health check endpoint
    fetch('/api/health')
      .then(response => response.json())
      .then(data => {
        // Combine status and message for display
        setBackendStatus(`${data.status} - ${data.message}`);
      })
      .catch(error => {
        console.error('Error fetching data:', error);
        setBackendStatus('Error connecting to backend');
      });
  }, []); // The empty array ensures this runs only once on component mount

  return (
    <>
      <h1>Personalization Platform</h1>
      <h2>Backend Status: {backendStatus}</h2>
    </>
  );
}

export default App;