import { useState, useEffect, useMemo } from 'react';

const weatherCodes = {
  0: { desc: 'Clear sky', icon: '☀️' },
  1: { desc: 'Mainly clear', icon: '🌤️' },
  2: { desc: 'Partly cloudy', icon: '⛅' },
  3: { desc: 'Overcast', icon: '☁️' },
  45: { desc: 'Fog', icon: '🌫️' },
  48: { desc: 'Rime fog', icon: '🌫️' },
  51: { desc: 'Light drizzle', icon: '🌧️' },
  53: { desc: 'Moderate drizzle', icon: '🌧️' },
  55: { desc: 'Dense drizzle', icon: '🌧️' },
  56: { desc: 'Light freezing drizzle', icon: '🌨️' },
  57: { desc: 'Dense freezing drizzle', icon: '🌨️' },
  61: { desc: 'Slight rain', icon: '🌦️' },
  63: { desc: 'Moderate rain', icon: '🌧️' },
  65: { desc: 'Heavy rain', icon: '🌧️' },
  66: { desc: 'Light freezing rain', icon: '🌨️' },
  67: { desc: 'Heavy freezing rain', icon: '🌨️' },
  71: { desc: 'Slight snow', icon: '❄️' },
  73: { desc: 'Moderate snow', icon: '❄️' },
  75: { desc: 'Heavy snow', icon: '❄️' },
  77: { desc: 'Snow grains', icon: '🌨️' },
  80: { desc: 'Slight rain showers', icon: '🌦️' },
  81: { desc: 'Moderate rain showers', icon: '🌧️' },
  82: { desc: 'Violent rain showers', icon: '🌧️' },
  85: { desc: 'Slight snow showers', icon: '🌨️' },
  86: { desc: 'Heavy snow showers', icon: '🌨️' },
  95: { desc: 'Thunderstorm', icon: '⛈️' },
  96: { desc: 'Thunderstorm with hail', icon: '⛈️' },
  99: { desc: 'Heavy thunderstorm with hail', icon: '⛈️' },
};

const formatDate = (dateString, timezone) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: timezone
  });
};

export default function App() {
  const [location, setLocation] = useState('');
  const [weather, setWeather] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [coords, setCoords] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        if (location.trim().length < 2) {
          setSuggestions([]);
          return;
        }

        const response = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=5&language=en&format=json`
        );

        if (!response.ok) throw new Error('Location service unavailable');
        
        const data = await response.json();
        
        if (!data.results?.length) {
          setSuggestions([]);
          return;
        }

        const validLocations = data.results.filter(loc => 
          Math.abs(loc.latitude) <= 90 && 
          Math.abs(loc.longitude) <= 180
        );

        setSuggestions(validLocations);
        setError('');
      } catch (err) {
        setSuggestions([]);
        setError(err.message);
      }
    };

    const debounceTimer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [location]);

  const selectLocation = (location) => {
    const lat = parseFloat(location.latitude);
    const lon = parseFloat(location.longitude);
    
    if (isNaN(lat) || isNaN(lon)) {
      setError('Invalid location coordinates');
      return;
    }

    setCoords({ latitude: lat, longitude: lon });
    setLocation(`${location.name}, ${location.admin1 || ''} ${location.country_code}`);
    setSuggestions([]);
  };

  const fetchWeather = async () => {
    if (!coords) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        latitude: coords.latitude,
        longitude: coords.longitude,
        current: 'temperature_2m,weather_code,wind_speed_10m',
        hourly: 'temperature_2m,weather_code',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min',
        temperature_unit: 'fahrenheit',
        wind_speed_unit: 'mph',
        timezone: 'auto',
      });

      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?${params}`
      );

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.reason || 'Failed to fetch weather data');
      }

      if (!data.current || !data.hourly || !data.daily) {
        throw new Error('Incomplete weather data received');
      }

      setWeather(data);
      setError('');
    } catch (err) {
      setError(err.message);
      setWeather(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    if (coords) {
      fetchWeather();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && suggestions.length > 0) {
      selectLocation(suggestions[0]);
    }
  };

  useEffect(() => {
    if (coords) {
      fetchWeather();
    }
  }, [coords]);

  const adjustedDailyData = useMemo(() => {
    if (!weather) return { time: [], weather_code: [], temperature_2m_max: [], temperature_2m_min: [] };

    try {
      const daily = weather.daily;
      const today = new Date().toLocaleDateString('en-CA', { timeZone: weather.timezone });
      
      let startIndex = daily.time.findIndex((dateString) => {
        const date = new Date(dateString).toLocaleDateString('en-CA', { timeZone: weather.timezone });
        return date >= today;
      });

      startIndex = startIndex === -1 ? 0 : startIndex;

      return {
        time: daily.time.slice(startIndex, startIndex + 7),
        weather_code: daily.weather_code.slice(startIndex, startIndex + 7),
        temperature_2m_max: daily.temperature_2m_max.slice(startIndex, startIndex + 7),
        temperature_2m_min: daily.temperature_2m_min.slice(startIndex, startIndex + 7)
      };
    } catch (err) {
      console.error('Error processing daily forecast:', err);
      return weather.daily;
    }
  }, [weather]);

  return (
    <div className="container">
      <div className="header-row">
        <h1>Weather Forecast</h1>
        <button 
          onClick={handleRefresh} 
          disabled={!coords || isLoading}
          className="refresh-button"
          aria-label="Refresh weather data"
        >
          🔄
        </button>
      </div>
      
      <div className="search-container">
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Enter city or address"
          disabled={isLoading}
        />

        {suggestions.length > 0 && (
          <div className="suggestions">
            {suggestions.map((loc) => (
              <div
                key={loc.id}
                className="suggestion-item"
                onClick={() => selectLocation(loc)}
              >
                {loc.name}, {loc.admin1} ({loc.country_code})
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      {isLoading && <div className="loading">⏳ Loading...</div>}

      {weather && !isLoading && (
        <div className="weather-info">
          <div className="coordinates">
            {weather.latitude.toFixed(2)}°N, {weather.longitude.toFixed(2)}°E
          </div>

          <div className="weather-card current-weather">
            <div className="current-temp">
              {weather.current.temperature_2m}°F
            </div>
            <div className="weather-condition">
              <span>{weatherCodes[weather.current.weather_code].icon}</span>
              {weatherCodes[weather.current.weather_code].desc}
            </div>
            <div>Wind: {weather.current.wind_speed_10m} mph</div>
          </div>

          <div className="weather-card">
            <h3>24-Hour Forecast</h3>
            <div className="hourly-forecast">
              {weather.hourly.time.slice(0, 24).map((time, index) => {
                const code = weather.hourly.weather_code[index];
                return (
                  <div key={time} className="hourly-item">
                    <div>{new Date(time).toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      hour12: false, 
                      timeZone: weather.timezone 
                    }).padStart(2, '0')}:00</div>
                    <div>{weather.hourly.temperature_2m[index]}°F</div>
                    <div className="hourly-desc">{weatherCodes[code].desc}</div>
                    <div>{weatherCodes[code].icon}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="weather-card">
            <h3>Week Forecast</h3>
            <div className="daily-forecast">
              {adjustedDailyData.time.map((time, index) => {
                const weatherCode = adjustedDailyData.weather_code[index];
                return (
                  <div key={time} className="daily-item">
                    <div className="daily-date">
                      {formatDate(time, weather.timezone)}
                    </div>
                    <div className="daily-condition">
                      <div>{weatherCodes[weatherCode].icon}</div>
                      <div className="condition-desc">
                        {weatherCodes[weatherCode].desc}
                      </div>
                    </div>
                    <div>
                      {adjustedDailyData.temperature_2m_max[index]}°
                      <span className="min-temp">
                        /{adjustedDailyData.temperature_2m_min[index]}°
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <footer className="attribution">
        Weather data from <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
      </footer>
    </div>
  );
}