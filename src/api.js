import axios from 'axios';

const API = axios.create({ baseURL: 'https://winprofit-backend-production.up.railway.app/api' });

API.interceptors.request.use(cfg => {
  const keys = Object.keys(localStorage);
  for (const key of keys) {
    try {
      const val = JSON.parse(localStorage.getItem(key));
      if (val && val.access_token) {
        cfg.headers.Authorization = `Bearer ${val.access_token}`;
        break;
      }
    } catch (e) {}
  }
  return cfg;
});

export default API;