import axios from 'axios';

const API = axios.create({ baseURL: 'https://winprofit-backend-production.up.railway.app/api' });

// Attach the Supabase JWT to every request automatically
API.interceptors.request.use(cfg => {
  const session = localStorage.getItem('winprofit_session');
  if (session) {
    const { access_token } = JSON.parse(session);
    cfg.headers.Authorization = `Bearer ${access_token}`;
  }
  return cfg;
});

export default API;
