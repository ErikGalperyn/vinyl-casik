import '../styles/global.css';
import { useEffect } from 'react';

export default function App({ Component, pageProps }){
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        document.documentElement.dataset.theme = savedTheme;
      } else {
        document.documentElement.dataset.theme = 'ferrari-black';
      }
    } catch {
      // no-op
    }
  }, []);

  return <Component {...pageProps} />
}
